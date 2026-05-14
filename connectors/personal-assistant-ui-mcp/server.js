#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { meetingCommutePrep } from "./lib/meetingCommutePrep.js";

const TRIGGER_RUNNER_URL = process.env.TRIGGER_RUNNER_URL || "http://trigger-runner:3100";
const CORE_API_URL = process.env.ADAS_BACKEND_URL || "http://localhost:4000";

async function triggerRunnerFetch(path, tenant, options = {}) {
  const url = `${TRIGGER_RUNNER_URL}${path}`;
  const res = await fetch(url, { ...options, headers: { "Content-Type": "application/json", "X-ADAS-TENANT": tenant, ...options.headers } });
  if (!res.ok) throw new Error(`Trigger-runner ${path}: ${res.status} ${res.statusText}`);
  return res.json();
}

async function coreApiFetch(path, tenant, options = {}) {
  const url = `${CORE_API_URL}${path}`;
  const res = await fetch(url, { ...options, headers: { "Content-Type": "application/json", "X-ADAS-TENANT": tenant, ...options.headers } });
  if (!res.ok) throw new Error(`Core API ${path}: ${res.status} ${res.statusText}`);
  return res.json();
}

// ── Platform tool gateway ────────────────────────────────────────────────
// Connectors run in a separate sandbox; they reach platform tools via the
// MCP gateway (Core handles `platform.*` and `cp.*` tools locally, see
// /app/server.js:516 — the local-prefix branch). We use the @ateam-ai/sdk
// (auto-injected env vars: ADAS_SDK_URL, ADAS_CONNECTOR_PAT, ADAS_TENANT,
// ADAS_ACTOR_ID).
import { platform as adasPlatform } from "@ateam-ai/sdk";

async function callPlatformTool(name, _tenant, actorId, extraArgs = {}) {
  // mcpCall sends a tools/call with name=<toolName>; Core's /mcp routes
  // platform.* / cp.* prefixes locally via the runtime tool map. Tenant +
  // PAT come from env via the SDK headers; actor we pass explicitly.
  const args = { ...extraArgs };
  if (actorId && !args._adas_actor) args._adas_actor = actorId;
  return await adasPlatform.mcpCall(name, args);
}

// ── UI Plugin registry ──
const UI_PLUGINS = [
  { id: "schedule-panel",    name: "Schedule",           version: "1.0.0", description: "Today's calendar, upcoming events, and weather at a glance" },
  { id: "pa-dashboard",      name: "Personal Assistant", version: "1.0.0", description: "At-a-glance dashboard — calendar, memories, contacts, and weather" },
  { id: "memories-panel",    name: "Memories",           version: "1.0.0", description: "View, search, and manage stored memories and preferences" },
  { id: "teach-panel",       name: "Teach",              version: "1.0.0", description: "Create and manage rules, automations, and taught behaviors" },
  { id: "triggers-panel",    name: "Reminders",          version: "1.0.1", description: "View and manage scheduled reminders and triggers" },
  { id: "home-layout-panel", name: "Smart Home",         version: "1.0.0", description: "Smart home dashboard — rooms, devices, quick controls, and integration status" },
  { id: "connections-panel", name: "Connections",        version: "1.0.0", description: "External systems connected to your account — manage and disconnect" },
];

const PLUGIN_MANIFESTS = {
  "schedule-panel":    { id: "schedule-panel",    name: "Schedule",           version: "1.0.0", description: "Today's calendar, upcoming events, and weather at a glance",                             render: { mode: "adaptive", iframeUrl: "/ui/schedule-panel/index.html",    reactNative: { component: "schedule-panel" } },    channels: ["command"], capabilities: { commands: [] } },
  "pa-dashboard":      { id: "pa-dashboard",      name: "Personal Assistant", version: "1.0.0", description: "At-a-glance dashboard — calendar, memories, contacts, and weather",                      render: { mode: "adaptive", iframeUrl: "/ui/pa-dashboard/index.html",      reactNative: { component: "pa-dashboard" } },      channels: ["command"], capabilities: { commands: [] } },
  "memories-panel":    { id: "memories-panel",    name: "Memories",           version: "1.0.0", description: "View, search, and manage stored memories and preferences",                               render: { mode: "adaptive", iframeUrl: "/ui/memories-panel/index.html",    reactNative: { component: "memories-panel" } },    channels: ["command"], capabilities: { commands: [] }, uiActions: { deeplink: "?focus=:focusId", surfaces: ["chip"], intents: { view_entity: { entity_kinds: ["memory"] }, quick_toggle: { verbs: ["edit", "delete"] } } } },
  "teach-panel":       { id: "teach-panel",       name: "Teach",              version: "1.0.0", description: "Create and manage rules, automations, and taught behaviors",                             render: { mode: "adaptive", iframeUrl: "/ui/teach-panel/index.html",       reactNative: { component: "teach-panel" } },       channels: ["command"], capabilities: { commands: [] } },
  "triggers-panel":    { id: "triggers-panel",    name: "Reminders",          version: "1.0.1", description: "View and manage scheduled reminders and triggers",                                       render: { mode: "adaptive", iframeUrl: "/ui/triggers-panel/index.html",    reactNative: { component: "triggers-panel" } },    channels: ["command"], capabilities: { commands: [] }, uiActions: { deeplink: "?focus=:focusId", surfaces: ["chip"], intents: { view_entity: { entity_kinds: ["reminder", "trigger"] }, suggested_action: { tool_names: ["sys.trigger"] }, quick_toggle: { verbs: ["pause", "resume", "delete"] } } } },
  "home-layout-panel": { id: "home-layout-panel", name: "Smart Home",         version: "1.0.0", description: "Smart home dashboard — rooms, devices, quick controls, and integration status",         render: { mode: "adaptive", iframeUrl: "/ui/home-layout-panel/index.html", reactNative: { component: "home-layout-panel" } }, channels: ["command"], capabilities: { haptics: true, commands: [] } },
  "connections-panel": { id: "connections-panel", name: "Connections",        version: "1.0.0", description: "External systems connected to your account — manage and disconnect",                       render: { mode: "adaptive", iframeUrl: "/ui/connections-panel/index.html", reactNative: { component: "connections-panel" } }, channels: ["command"], capabilities: { commands: [] } },
};

const server = new McpServer({ name: "personal-assistant-ui-mcp", version: "1.1.0" });

server.tool("ui.listPlugins", "List all available UI plugins", {}, async () => {
  // Merge the uiActions block from PLUGIN_MANIFESTS into each list entry so
  // Core's cp.uiActions_api can build the polisher inventory in ONE round-trip
  // instead of N separate ui.getPlugin calls (which require lazy-starting this
  // connector from any skill that doesn't already have it loaded).
  const enriched = UI_PLUGINS.map((p) => {
    const m = PLUGIN_MANIFESTS[p.id];
    return m?.uiActions ? { ...p, uiActions: m.uiActions } : p;
  });
  return { content: [{ type: "text", text: JSON.stringify({ plugins: enriched }) }] };
});

server.tool("ui.getPlugin", "Get a specific UI plugin by ID", { id: z.string().describe("Plugin ID") }, async ({ id }) => {
  const manifest = PLUGIN_MANIFESTS[id];
  if (!manifest) return { content: [{ type: "text", text: JSON.stringify({ error: `Plugin '${id}' not found` }) }], isError: true };
  return { content: [{ type: "text", text: JSON.stringify(manifest) }] };
});

server.tool(
  "triggers.list",
  "List all triggers (static + dynamic) for this tenant",
  {
    _adas_tenant: z.string().optional().describe("Injected by platform — do not set manually"),
    _adas_actor: z.string().optional().describe("Injected by platform — do not set manually"),
  },
  async ({ _adas_tenant }) => {
    const tenant = _adas_tenant || "mobile-pa";
    try {
      const staticResult = await triggerRunnerFetch("/triggers", tenant);
      const staticTriggers = Array.isArray(staticResult) ? staticResult : (staticResult.triggers || []);
      let dynamicTriggers = [];
      try { const dynResult = await coreApiFetch("/api/triggers/dynamic", tenant); dynamicTriggers = dynResult.triggers || dynResult || []; } catch {}
      return { content: [{ type: "text", text: JSON.stringify({ ok: true, static: staticTriggers, dynamic: dynamicTriggers }) }] };
    } catch (err) {
      return { content: [{ type: "text", text: JSON.stringify({ ok: false, error: err.message }) }], isError: true };
    }
  }
);

server.tool(
  "triggers.toggle",
  "Pause or resume a specific trigger",
  { skillSlug: z.string().describe("Skill slug that owns the trigger"), triggerId: z.string().describe("Trigger ID to toggle"), _adas_tenant: z.string().optional().describe("Injected by platform"), _adas_actor: z.string().optional().describe("Injected by platform") },
  async ({ skillSlug, triggerId, _adas_tenant }) => {
    const tenant = _adas_tenant || "mobile-pa";
    try { const result = await triggerRunnerFetch(`/triggers/${encodeURIComponent(skillSlug)}/${encodeURIComponent(triggerId)}/toggle`, tenant, { method: "POST" }); return { content: [{ type: "text", text: JSON.stringify({ ok: true, ...result }) }] }; }
    catch (err) { return { content: [{ type: "text", text: JSON.stringify({ ok: false, error: err.message }) }], isError: true }; }
  }
);

server.tool(
  "meeting.commute.prep",
  "Twice-daily meeting commute prep. Lists upcoming events, classifies which need driving alerts (one LLM call), estimates drive time, and creates one-shot 'leave now' triggers. Idempotent (stable trigger_ids - dedup). Returns { ok, scanned, scheduled, skipped, errors, connections }.",
  {
    _adas_tenant: z.string().optional().describe("Injected by platform"),
    _adas_actor: z.string().optional().describe("Injected by platform"),
  },
  async (args) => {
    try {
      const result = await meetingCommutePrep(args);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (err) {
      return { content: [{ type: "text", text: JSON.stringify({ ok: false, error: err.message }) }], isError: true };
    }
  }
);

server.tool(
  "triggers.deleteDynamic",
  "Delete a dynamic (user-created) trigger/reminder",
  { triggerId: z.string().describe("Dynamic trigger ID to delete"), _adas_tenant: z.string().optional().describe("Injected by platform"), _adas_actor: z.string().optional().describe("Injected by platform") },
  async ({ triggerId, _adas_tenant }) => {
    const tenant = _adas_tenant || "mobile-pa";
    try {
      // Trigger-runner is the source of truth for dynamic triggers (it owns
      // the registry and reload pipeline). It deletes the doc and refreshes
      // its own scheduler in one call. The earlier path went through Core's
      // /api/triggers/dynamic/:id, which never existed — silent 404.
      const result = await triggerRunnerFetch(`/triggers/dynamic/${encodeURIComponent(triggerId)}`, tenant, { method: "DELETE" });
      return { content: [{ type: "text", text: JSON.stringify({ ok: true, ...result }) }] };
    } catch (err) { return { content: [{ type: "text", text: JSON.stringify({ ok: false, error: err.message }) }], isError: true }; }
  }
);

// ── Connections (auth) — wrap platform.auth.* so the connections-panel
//    plugin can reach them via /api/connectors/personal-assistant-ui-mcp/call.
//    The /mcp endpoint doesn't expose platform.auth.*, so we proxy here.
//    WhatsApp is the exception: not OAuth, so its state lives on whatsapp-mcp
//    (per-actor Baileys session). We probe it via platform.callTool and merge
//    it into the unified list so the UI stays a single source of truth.
async function probeWhatsApp(actorId) {
  try {
    // Must forward the user's actor explicitly. platform.callTool only injects
    // job.actorId, which for SDK calls from a connector is the service actor —
    // whatsapp.status would reject it. The user actor lives on connections.list's
    // own _adas_actor arg.
    const args = actorId ? { _adas_actor: actorId } : {};
    const wa = await adasPlatform.callTool("whatsapp-mcp", "whatsapp.status", args);
    const connected = wa?.connected === true || wa?.state === "open";
    return {
      service_id: "whatsapp",
      name: "WhatsApp",
      connected,
      mode: connected ? "paired" : (wa?.state || "disconnected"),
    };
  } catch (err) {
    console.error("[connections] whatsapp probe failed:", err?.message || err);
    return null;
  }
}

server.tool(
  "connections.list",
  "List external services + connection state for this actor (Gmail, WhatsApp, Dropbox, etc.).",
  {
    _adas_tenant: z.string().optional().describe("Injected by platform"),
    _adas_actor: z.string().optional().describe("Injected by platform"),
  },
  async ({ _adas_tenant, _adas_actor }) => {
    try {
      const tenant = _adas_tenant || "mobile-pa";
      const result = await callPlatformTool("platform.auth.listServices", tenant, _adas_actor || null);
      const services = Array.isArray(result?.services) ? [...result.services] : [];
      const wa = await probeWhatsApp(_adas_actor || null);
      if (wa) {
        const idx = services.findIndex(s => String(s?.service_id || s?.id || "").toLowerCase() === "whatsapp");
        if (idx >= 0) services.splice(idx, 1, wa);
        else services.push(wa);
      }
      return { content: [{ type: "text", text: JSON.stringify({ ...(result || {}), services }) }] };
    } catch (err) {
      return { content: [{ type: "text", text: JSON.stringify({ ok: false, error: err.message }) }], isError: true };
    }
  }
);

server.tool(
  "connections.disconnect",
  "Revoke an external service connection for this actor.",
  {
    service_id: z.string().describe("Service id (e.g. 'gmail', 'linkedin'). Use connections.list to see valid ids."),
    _adas_tenant: z.string().optional().describe("Injected by platform"),
    _adas_actor: z.string().optional().describe("Injected by platform"),
  },
  async ({ service_id, _adas_tenant, _adas_actor }) => {
    // WhatsApp pairing lives on the user's phone (Linked Devices). Server-side
    // disconnect would just orphan the session; the user has to unlink there.
    if (String(service_id || "").toLowerCase() === "whatsapp") {
      return { content: [{ type: "text", text: JSON.stringify({
        ok: false,
        error: "To disconnect WhatsApp, open WhatsApp on your phone → Settings → Linked Devices, then remove this device.",
      }) }], isError: true };
    }
    try {
      const tenant = _adas_tenant || "mobile-pa";
      const result = await callPlatformTool("platform.auth.disconnect", tenant, _adas_actor || null, { service_id });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (err) {
      return { content: [{ type: "text", text: JSON.stringify({ ok: false, error: err.message }) }], isError: true };
    }
  }
);

// ── Smart Home demo data (HA entity_id format: domain.name) ──
const ROOMS = [
  { id: "kitchen", name: "Kitchen", devices: ["light.kitchen", "switch.coffee_machine", "media_player.kitchen_speaker"] },
  { id: "living-room", name: "Living Room", devices: ["light.living_room", "media_player.tv", "climate.ac_living"] },
  { id: "bedroom", name: "Bedroom", devices: ["light.bedroom", "climate.ac_bedroom", "cover.bedroom_blinds"] },
  { id: "bathroom", name: "Bathroom", devices: ["light.bathroom", "switch.water_heater"] },
  { id: "entrance", name: "Entrance", devices: ["light.entrance", "lock.front_door"] },
  { id: "garage", name: "Garage", devices: ["cover.garage_door"] },
];

const DEVICES = {
  "light.kitchen":              { entity_id: "light.kitchen",              name: "Kitchen Light",     type: "light",        room: "kitchen",     provider: "hue",  default_state: "on" },
  "switch.coffee_machine":      { entity_id: "switch.coffee_machine",      name: "Coffee Machine",    type: "switch",       room: "kitchen",     provider: "tuya", default_state: "off" },
  "media_player.kitchen_speaker":{ entity_id: "media_player.kitchen_speaker",name: "Kitchen Speaker",  type: "media_player", room: "kitchen",     provider: "nest", default_state: "off" },
  "light.living_room":          { entity_id: "light.living_room",          name: "Living Room Light", type: "light",        room: "living-room", provider: "hue",  default_state: "on" },
  "media_player.tv":            { entity_id: "media_player.tv",            name: "TV",                type: "media_player", room: "living-room", provider: "nest", default_state: "on" },
  "climate.ac_living":          { entity_id: "climate.ac_living",          name: "AC (Living)",       type: "climate",      room: "living-room", provider: "tuya", default_state: "on" },
  "light.bedroom":              { entity_id: "light.bedroom",              name: "Bedroom Light",     type: "light",        room: "bedroom",     provider: "hue",  default_state: "off" },
  "climate.ac_bedroom":         { entity_id: "climate.ac_bedroom",         name: "AC (Bedroom)",      type: "climate",      room: "bedroom",     provider: "tuya", default_state: "off" },
  "cover.bedroom_blinds":       { entity_id: "cover.bedroom_blinds",       name: "Bedroom Blinds",    type: "cover",        room: "bedroom",     provider: "tuya", default_state: "closed" },
  "light.bathroom":             { entity_id: "light.bathroom",             name: "Bathroom Light",    type: "light",        room: "bathroom",    provider: "hue",  default_state: "off" },
  "switch.water_heater":        { entity_id: "switch.water_heater",        name: "Water Heater",      type: "switch",       room: "bathroom",    provider: "tuya", default_state: "off" },
  "light.entrance":             { entity_id: "light.entrance",             name: "Entrance Light",    type: "light",        room: "entrance",    provider: "hue",  default_state: "off" },
  "lock.front_door":            { entity_id: "lock.front_door",            name: "Front Door Lock",   type: "lock",         room: "entrance",    provider: "ha",   default_state: "locked" },
  "cover.garage_door":          { entity_id: "cover.garage_door",          name: "Garage Door",       type: "cover",        room: "garage",      provider: "ha",   default_state: "closed" },
};

const deviceState = {};
for (const [id, dev] of Object.entries(DEVICES)) deviceState[id] = dev.default_state;

server.tool("rooms.list", "List all rooms with their devices and states", {}, async () => {
  const rooms = ROOMS.map(r => ({
    ...r,
    devices: r.devices.map(dId => {
      const dev = DEVICES[dId];
      return { ...dev, state: deviceState[dId] };
    }),
  }));
  return { content: [{ type: "text", text: JSON.stringify({ ok: true, rooms }) }] };
});

server.tool("entity.state", "Get the current state of a device", { entity_id: z.string().describe("Entity ID (e.g. light.kitchen)") }, async ({ entity_id }) => {
  const dev = DEVICES[entity_id];
  if (!dev) return { content: [{ type: "text", text: JSON.stringify({ error: "Not found" }) }], isError: true };
  return { content: [{ type: "text", text: JSON.stringify({ ok: true, state: deviceState[entity_id], attributes: dev }) }] };
});

server.tool("services.call", "Toggle or control a device", { domain: z.string().describe("Domain (light, switch, etc)"), service: z.string().describe("Service (turn_on, turn_off, toggle, lock, unlock)"), entity_id: z.string().describe("Entity ID") }, async ({ domain, service, entity_id }) => {
  const dev = DEVICES[entity_id];
  if (!dev) return { content: [{ type: "text", text: JSON.stringify({ error: "Not found" }) }], isError: true };
  if (service === "toggle") {
    const cur = deviceState[entity_id];
    deviceState[entity_id] = cur === "on" ? "off" : cur === "off" ? "on" : cur === "locked" ? "unlocked" : cur === "unlocked" ? "locked" : cur === "open" ? "closed" : "open";
  } else if (service === "turn_on") {
    deviceState[entity_id] = "on";
  } else if (service === "turn_off") {
    deviceState[entity_id] = "off";
  } else if (service === "lock") {
    deviceState[entity_id] = "locked";
  } else if (service === "unlock") {
    deviceState[entity_id] = "unlocked";
  } else {
    deviceState[entity_id] = service;
  }
  return { content: [{ type: "text", text: JSON.stringify({ ok: true, state: deviceState[entity_id] }) }] };
});

server.tool("hue.status", "Get Philips Hue integration status", {}, async () => {
  return { content: [{ type: "text", text: JSON.stringify({ ok: true, provider: "hue", connected: true, bridge: "192.168.1.10", lights: 5 }) }] };
});

server.tool("tuya.status", "Get Tuya/Smart Life integration status", {}, async () => {
  return { content: [{ type: "text", text: JSON.stringify({ ok: true, provider: "tuya", connected: true, devices: 5 }) }] };
});

server.tool("google.status", "Get Google Home/Nest integration status", {}, async () => {
  return { content: [{ type: "text", text: JSON.stringify({ ok: true, provider: "nest", connected: true, devices: 2 }) }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
