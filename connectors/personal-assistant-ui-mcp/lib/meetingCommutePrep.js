// Deterministic orchestration for the twice-daily meeting-commute-prep
// trigger. The script handles connection checks, listing, drive estimation,
// trigger creation, and dedup. The LLM is invoked exactly ONCE per run to do
// the only fuzzy work — classify which events need a driving alert and pick
// a clean destination string from free-text locations — plus parse user prefs
// out of a memory dump.
//
// Master trigger prompt collapses to: "Call meeting.commute.prep."

import { platform as adasPlatform, llm as adasLlm } from "@ateam-ai/sdk";

const DEFAULT_TZ = "Asia/Jerusalem";
const DEFAULT_ADVANCE_MIN = 30;

/** Ask the platform for connection state of services we care about. */
async function probeConnections(actorId) {
  const out = {};
  try {
    const args = actorId ? { _adas_actor: actorId } : {};
    const auth = await adasPlatform.mcpCall("platform.auth.listServices", args);
    for (const s of auth?.services || []) {
      out[s.service_id] = !!s.connected;
    }
  } catch (e) {
    out._error = e.message;
  }
  return out;
}

/** One LLM call: classify events + extract prefs from memory dump. */
async function classifyAndExtract({ events, memoryDump, advanceMin }) {
  const system = `You serve a commute-alert system. You must return ONLY valid JSON in this exact shape, no prose:

{
  "prefs": {
    "home_addr": string | null,
    "office_addr": string | null,
    "user_phone": string | null,
    "tz": string | null,
    "advance_min": number
  },
  "events": [
    { "event_id": string, "in_person": boolean, "drive_destination": string | null, "reason": string }
  ]
}

Rules for events:
- in_person = true ONLY if the meeting requires physical travel to a real address or place.
- in_person = false for: virtual platforms (Zoom/Teams/Google Meet/Webex/Jitsi/etc), phone/video calls, or starts within ${advanceMin + 10} minutes from now (too close to alert).
- drive_destination = a complete, geocodable address string usable by a routing service like Google Maps. Use your real-world knowledge — language, timezone, well-known landmarks, the user's other meeting locations, the memory dump — to resolve partial addresses into a routable one. Pull source from event.location, fall back to the title.
- If you genuinely cannot resolve a routable destination, set in_person=false with reason describing what's missing.
- reason = 1 short phrase explaining the decision (in English).

Rules for prefs:
- Extract home_addr, office_addr, user_phone, tz, advance_min from the memory dump if present.
- Set advance_min default to ${DEFAULT_ADVANCE_MIN} if not found.
- Set tz default to "${DEFAULT_TZ}" if not found.
- Use null for any string field not found.`;

  const payload = {
    now_iso: new Date().toISOString(),
    memory_dump: memoryDump,
    events: events.map((e) => ({
      event_id: String(e.id || e.event_id || e.uid || ""),
      title: String(e.title || e.summary || ""),
      location: String(e.location || ""),
      start_iso: e.start_iso || e.start || null,
    })),
  };

  const r = await adasLlm.call({
    system,
    prompt: JSON.stringify(payload),
    max_tokens: 1800,
    temperature: 0,
    caller: "meeting_commute_prep",
  });

  const text = (r?.text || "").trim();
  // Strip ```json fences if model added them.
  const jsonText = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
  return JSON.parse(jsonText);
}

/** Sanitize event_id into a valid sys.trigger trigger_id (3-60 chars, lowercase alphanumeric+hyphen, ends alpha-num). */
function buildTriggerId(rawEventId) {
  const cleaned = String(rawEventId || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!cleaned) return null;
  let id = ("gtm-" + cleaned).slice(0, 50).replace(/-+$/, "");
  if (id.length < 4 || !/^[a-z0-9]/.test(id) || !/[a-z0-9]$/.test(id)) return null;
  return id;
}

/** Format a Date for the alert message body. */
function humanWhen(ms, tz) {
  try {
    return new Date(ms).toLocaleString("en-GB", {
      timeZone: tz || DEFAULT_TZ,
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return new Date(ms).toISOString();
  }
}

export async function meetingCommutePrep({ _adas_tenant, _adas_actor } = {}) {
  const actorId = _adas_actor || null;
  const out = {
    ok: true,
    scanned: 0,
    scheduled: 0,
    skipped: 0,
    errors: [],
    connections: {},
  };

  // 1. Connection statuses (informational)
  out.connections = await probeConnections(actorId);

  // 2. Pull memory dump (best-effort; failure is non-fatal)
  let memoryDump = "";
  try {
    const m = await adasPlatform.callTool("memory-mcp", "memory.recall", {
      query: "commute home office phone timezone advance preferences",
      ...(actorId ? { _adas_actor: actorId } : {}),
    });
    memoryDump = JSON.stringify(m || {}).slice(0, 2500);
  } catch (e) {
    out.errors.push({ stage: "memory.recall", error: e.message });
  }

  // 3. Calendar — try Google Calendar first (authoritative for invites the
  //    user just added), then merge in iOS calendar (covers offline-added
  //    events). De-dup by iCalUID/title+start so a single event from both
  //    sources only appears once.
  const sources = [];
  try {
    const g = await adasPlatform.callTool("gmail-mcp", "gmail.calendar.upcoming", {
      hours: 36,
      ...(actorId ? { _adas_actor: actorId } : {}),
    });
    if (Array.isArray(g?.events)) sources.push(...g.events);
  } catch (e) {
    out.errors.push({ stage: "gmail.calendar.upcoming", error: e.message });
  }
  try {
    const r = await adasPlatform.callTool("mobile-device-mcp", "device.calendar.upcoming", {
      hours: 36,
      ...(actorId ? { _adas_actor: actorId } : {}),
    });
    const ios = r?.events || r?.items || (Array.isArray(r) ? r : []);
    for (const e of ios) sources.push({ ...e, source: e.source || "ios_calendar" });
  } catch (e) {
    out.errors.push({ stage: "device.calendar.upcoming", error: e.message });
  }

  // De-dup. Same logical event can come from both (Google -> iOS via iCloud sync).
  const seen = new Map();
  for (const e of sources) {
    const key =
      e.ical_uid ||
      `${(e.title || e.summary || "").trim().toLowerCase()}|${e.start_iso || e.start || ""}`;
    if (!seen.has(key)) seen.set(key, e);
  }
  const events = Array.from(seen.values());
  out.scanned = events.length;
  out.calendar_sources = {
    google: sources.filter(e => e.source === "google_calendar").length,
    ios: sources.filter(e => e.source !== "google_calendar").length,
    after_dedup: events.length,
  };

  if (events.length === 0) {
    return { ...out, ok: true, summary: "no upcoming events from any source" };
  }

  // 4. Single LLM call — classify all events + extract prefs.
  let classification;
  try {
    classification = await classifyAndExtract({
      events,
      memoryDump,
      advanceMin: DEFAULT_ADVANCE_MIN,
    });
  } catch (e) {
    return { ok: false, error: `LLM classify failed: ${e.message}`, connections: out.connections };
  }

  const prefs = classification.prefs || {};
  const tz = prefs.tz || DEFAULT_TZ;
  const advance = Number(prefs.advance_min) || DEFAULT_ADVANCE_MIN;
  const phone = prefs.user_phone || null;

  // 5. For each in_person event, estimate commute + schedule the one-shot alert.
  for (const c of classification.events || []) {
    if (!c.in_person || !c.drive_destination) {
      out.skipped++;
      continue;
    }
    const event = events.find(
      (e) => String(e.id || e.event_id || e.uid || "") === String(c.event_id)
    );
    if (!event) {
      out.skipped++;
      continue;
    }

    const triggerId = buildTriggerId(c.event_id);
    if (!triggerId) {
      out.errors.push({ event_id: c.event_id, error: "could not build trigger_id" });
      continue;
    }

    // Origin: home address in the morning if known, else current location.
    const hour = new Date().getHours();
    const origin = hour <= 11 && prefs.home_addr ? prefs.home_addr : "current";

    let driveMin = null;
    try {
      const cm = await adasPlatform.callTool("mobile-device-mcp", "device.commute.estimate", {
        from: origin,
        to: c.drive_destination,
        mode: "driving",
        ...(actorId ? { _adas_actor: actorId } : {}),
      });
      // Tool returns estimated_minutes (and source="heuristic-fallback" when
      // Nominatim misses — still a usable rough number).
      driveMin = cm?.estimated_minutes ?? null;
    } catch (e) {
      out.errors.push({ event_id: c.event_id, error: `commute: ${e.message}` });
      continue;
    }
    if (!driveMin || driveMin <= 0) {
      out.errors.push({ event_id: c.event_id, error: "no drive time returned" });
      continue;
    }

    const startMs = new Date(event.start_iso || event.start || 0).getTime();
    if (!startMs) {
      out.errors.push({ event_id: c.event_id, error: "no start time" });
      continue;
    }

    const fireMs = startMs - (driveMin + advance) * 60_000;
    if (fireMs <= Date.now()) {
      out.skipped++;
      continue;
    }
    const fireIso = new Date(fireMs).toISOString();

    const title = String(event.title || event.summary || "meeting");
    const startHuman = humanWhen(startMs, tz);
    const recipient = phone || "the user's saved phone (use contacts to resolve 'me')";

    const alertPrompt = `Send ONE short mobile message via whatsapp.sendMessage to ${recipient} (fallback: device.message.send). Text: "Leave now — ${title} at ${c.drive_destination}. Drive ~${driveMin}m. Starts ${startHuman}." Send once, then end. No chat.`;

    try {
      const sr = await adasPlatform.mcpCall("sys.trigger", {
        action: "create",
        trigger_id: triggerId,
        schedule: "once:" + fireIso,
        skill_slug: "messaging-agent",
        timezone: tz,
        scope: "per_actor",
        auto_delete: true,
        description: "Go-to-meeting alert: " + title,
        prompt: alertPrompt,
        ...(actorId ? { _adas_actor: actorId } : {}),
      });

      if (sr?.ok || /already exists/i.test(sr?.error || "")) {
        out.scheduled++;
      } else {
        out.errors.push({ event_id: c.event_id, error: sr?.error || "sys.trigger.create failed" });
      }
    } catch (e) {
      out.errors.push({ event_id: c.event_id, error: `sys.trigger: ${e.message}` });
    }
  }

  return out;
}
