#!/usr/bin/env node
/**
 * ADAS Travel MCP — Solution Connector (stdio)
 *
 * Unified travel search across major providers:
 *   - Google Flights (search)
 *   - Booking.com  (hotel search + user bookings)
 *   - Airbnb       (home/apartment search)
 *   - Kayak        (rental cars)
 *
 * Tools exposed to the planner / skills:
 *   travel.searchFlights — Google Flights search (no auth)
 *   travel.searchHotels  — Booking.com hotel search (no auth)
 *   travel.searchHomes   — Airbnb home search (no auth)
 *   travel.searchCars    — Kayak rental car search (no auth)
 *   travel.planTrip      — combined flights + hotels for one trip (no auth)
 *   travel.myBookings    — Booking.com user bookings (needs auth_cookies:booking.com)
 *
 * Tools exposed to platform / Core (hidden from planner):
 *   auth.listServices    — self-registers booking + airbnb webview_cookie services
 *                          into the TENANT auth catalog on connector start
 *
 * V1 implementation note:
 *   All searches delegate to the platform browser-mcp (JS-heavy SPAs).
 *   Per-actor browser contexts + auth cookies are isolated by browser-mcp.
 *
 * Env (injected by Core's ConnectorManager on spawn):
 *   ADAS_SDK_URL             — platform MCP gateway (e.g. http://backend:4000/mcp).
 *                              PREFERRED path: browser calls go through Core's
 *                              platform.callTool. Works from the tenant sandbox,
 *                              which cannot reach platform containers directly.
 *   ADAS_CONNECTOR_PAT       — tenant-scoped PAT for the gateway (preferred auth)
 *   ADAS_MCP_TOKEN           — legacy shared secret (gateway fallback auth,
 *                              also used for the direct browser-mcp fallback)
 *   ADAS_TENANT              — current tenant (gateway header)
 *   BROWSER_MCP_URL / PLATFORM_BROWSER_MCP_URL — direct browser-mcp URL,
 *                              fallback for non-sandboxed local dev only
 *
 * Transport: stdio (spawned as a Core child process — no HTTP surface).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { z } from "zod";

const GATEWAY_URL = process.env.ADAS_SDK_URL
  || (process.env.ADAS_CORE_URL ? process.env.ADAS_CORE_URL + "/mcp" : null);
const CONNECTOR_PAT = process.env.ADAS_CONNECTOR_PAT || "";
const MCP_TOKEN = process.env.ADAS_MCP_TOKEN || "";
const TENANT = process.env.ADAS_TENANT || "";
const BROWSER_MCP_URL = process.env.BROWSER_MCP_URL
  || (process.env.PLATFORM_BROWSER_MCP_URL
    ? process.env.PLATFORM_BROWSER_MCP_URL.replace(/\/$/, "") + "/mcp"
    : "http://browser-mcp:7315/mcp");

// ─── Gateway path: browser-mcp via Core's platform.callTool ────────────────
// The tenant sandbox network can reach ONLY the backend — never platform
// containers directly. Mirrors @ateam/sdk platform.mcpCall (kept dependency-
// free so mcp-store npm install stays registry-only).

let _rpcId = 0;

async function gatewayCallTool(tool, args) {
  const body = {
    jsonrpc: "2.0",
    id: ++_rpcId,
    method: "tools/call",
    params: {
      name: "platform.callTool",
      arguments: { connector: "browser-mcp", tool, args },
    },
  };
  const headers = {
    "content-type": "application/json",
    "accept": "application/json, text/event-stream",
    ...(TENANT ? { "x-adas-tenant": TENANT } : {}),
    ...(CONNECTOR_PAT
      ? { authorization: `Bearer ${CONNECTOR_PAT}` }
      : (MCP_TOKEN ? { "x-adas-token": MCP_TOKEN } : {})),
  };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60000);
  try {
    const res = await fetch(GATEWAY_URL, {
      method: "POST", headers, body: JSON.stringify(body), signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`gateway ${res.status} ${res.statusText}`);
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      // SSE fallback: join data: lines
      const lines = text.split("\n").filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(l.indexOf(":") + 1).trim());
      if (!lines.length) throw new Error("gateway: empty response");
      data = JSON.parse(lines.join("\n"));
    }
    if (data?.error) throw new Error(`gateway error: ${data.error.message || data.error}`);
    const block = data?.result?.content?.[0];
    let payload = null;
    if (block?.type === "text") {
      try { payload = JSON.parse(block.text); } catch { payload = { text: block.text }; }
    }
    // platform.callTool wraps as { ok, result } — unwrap to the tool's own payload.
    if (payload?.ok === false) throw new Error(payload.error || `browser-mcp ${tool} failed`);
    return payload?.result ?? payload;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Direct path: MCP client to browser-mcp (non-sandboxed local dev) ──────

let _browserClient = null;
let _browserClientConnecting = null;

async function getBrowserClient() {
  if (_browserClient) return _browserClient;
  if (_browserClientConnecting) return await _browserClientConnecting;

  _browserClientConnecting = (async () => {
    const transport = new StreamableHTTPClientTransport(new URL(BROWSER_MCP_URL), {
      requestInit: {
        headers: MCP_TOKEN ? { "x-adas-token": MCP_TOKEN } : {},
      },
    });
    const client = new Client(
      { name: "adas-travel-mcp", version: "0.1.0" },
      { capabilities: {} },
    );
    await client.connect(transport);
    _browserClient = client;
    console.error("[adas-travel-mcp] Connected to browser-mcp (direct)");
    return client;
  })();

  try {
    return await _browserClientConnecting;
  } finally {
    _browserClientConnecting = null;
  }
}

function dropBrowserClient() {
  _browserClient = null;
}

// ─── Auth services this connector registers with platform.auth ────────────

const AUTH_SERVICES = [
  {
    service_id: "booking",
    provider: null,
    strategy: "webview_cookie",
    scopes: [],
    login_url: "https://account.booking.com/sign-in",
    cookie_domain: "booking.com",
    success_pattern: "booking\\.com/(myaccount|mytrips|index|myreservations|searchresults)",
    probe_tool: null,
    ttl_seconds: 604800,
  },
  {
    service_id: "airbnb",
    provider: null,
    strategy: "webview_cookie",
    scopes: [],
    login_url: "https://www.airbnb.com/login",
    cookie_domain: "airbnb.com",
    success_pattern: "airbnb\\.com/(\\?|s/|trips|rooms|users|account)",
    probe_tool: null,
    ttl_seconds: 604800,
  },
];

// ─── Helpers ───────────────────────────────────────────────────────────────

const ACTOR_FIELD = {
  _adas_actor: z.string().optional().describe("Internal: actor ID injected by Core"),
  _adas_tenant: z.string().optional().describe("Internal: tenant ID injected by Core"),
};

function ok(payload) {
  return { content: [{ type: "text", text: JSON.stringify(payload) }] };
}

function err(message, extra = {}) {
  return ok({ ok: false, error: String(message), ...extra });
}

// Wrap a tool handler with safe error capture so an exception never breaks the
// MCP transport — the planner gets a clean { ok:false, error } payload instead.
function safeHandler(fn) {
  return async (args) => {
    try {
      return await fn(args || {});
    } catch (e) {
      return err(e.message || e, { failure_class: "execution" });
    }
  };
}

// Forward a tool call to browser-mcp. Per-actor browser contexts are isolated
// by browser-mcp keyed off _adas_actor. Cookies auto-load from
// auth_cookies:{domain} for that actor.
//
// Preferred: Core gateway (platform.callTool) — the only route that works
// from the tenant sandbox. Fallback: direct MCP client for local dev.
async function callBrowserMcp(tool, args, actorId, tenant) {
  const enriched = {
    ...args,
    ...(actorId ? { _adas_actor: actorId } : {}),
    ...(tenant ? { _adas_tenant: tenant } : {}),
  };

  if (GATEWAY_URL) {
    return await gatewayCallTool(tool, enriched);
  }

  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const client = await getBrowserClient();
      const result = await client.callTool({ name: tool, arguments: enriched });
      const block = result?.content?.[0];
      if (!block) return null;
      try { return JSON.parse(block.text); } catch { return { raw: block.text }; }
    } catch (e) {
      lastErr = e;
      // Connection might be stale — drop and retry once.
      dropBrowserClient();
    }
  }
  throw lastErr || new Error("browser-mcp call failed");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Tool implementations ──────────────────────────────────────────────────

// Reject past dates with a helpful nudge containing today's ISO date,
// so the LLM can re-think (its training-data year bias often picks 2024/2025).
// Returns null if OK, or an ok({error}) MCP response if rejected.
function validateFutureDate(label, dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  // Allow today itself; only reject strictly past.
  if (dateStr < todayIso) {
    const suggestion = (() => {
      // Common LLM mistake: picked previous year. Bump year forward to today's year and beyond.
      const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m) return null;
      const [_, y, mo, d] = m;
      const guesses = [];
      for (let yr = today.getFullYear(); yr <= today.getFullYear() + 2; yr++) {
        const candidate = `${yr}-${mo}-${d}`;
        if (candidate >= todayIso) guesses.push(candidate);
      }
      return guesses.slice(0, 2);
    })();
    return ok({
      ok: false,
      error: "date_in_past",
      failure_class: "logical",
      detail: `${label} "${dateStr}" is in the past. Today is ${todayIso}.`,
      today: todayIso,
      suggestion: suggestion?.length
        ? `Did you mean ${suggestion.join(" or ")}? Re-call this tool with a future ${label}.`
        : `Re-call this tool with a future ${label} (>= ${todayIso}).`,
    });
  }
  return null;
}

// Extract stop count from a flight summary string.
// Examples: "Direct" → 0, "1 stop ZRH" → 1, "2 stops AUH, FRA" → 2.
function extractStops(summary) {
  if (!summary) return null;
  if (/\bDirect\b/i.test(summary) || /\bnon[-\s]?stop\b/i.test(summary)) return 0;
  const m = summary.match(/(\d+)\s*stop/i);
  return m ? parseInt(m[1], 10) : null;
}

// Extract a numeric price (ignoring currency symbol).
function extractPrice(summary) {
  const m = summary && summary.match(/[₪$€£]\s*([\d,]+)/);
  return m ? parseInt(m[1].replace(/,/g, ""), 10) : null;
}

// Extract total duration in minutes — "16 hr 35 min" → 995.
function extractDurationMinutes(summary) {
  if (!summary) return null;
  const m = summary.match(/(\d+)\s*hr(?:\s*(\d+)\s*min)?/i);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + (m[2] ? parseInt(m[2], 10) : 0);
}

// Extract numeric rating from "Scored 8.5 8.5 Very Good 918 reviews"
// or "· 4.9 (128) ·" (airbnb style). Returns 0-10 scale.
function extractRating(text) {
  if (!text) return null;
  let m = text.match(/Scored\s+(\d+(?:\.\d+)?)/i);
  if (m) return parseFloat(m[1]);
  m = text.match(/(?:^|[·\s])(\d(?:\.\d+)?)(?:\s*\(\d+\))?(?=[·\s]|$)/);
  if (m) {
    const v = parseFloat(m[1]);
    // Airbnb is on 5-scale — normalize to 10 so filters are comparable.
    if (v <= 5) return Math.round(v * 20) / 10;
    if (v <= 10) return v;
  }
  return null;
}

// Map cabin name to Google Flights `class` URL param. Default: economy.
function cabinToFlightClass(cabin) {
  switch ((cabin || "").toLowerCase()) {
    case "premium_economy":
    case "premium economy": return 2;
    case "business": return 3;
    case "first": return 4;
    default: return 1;
  }
}

// Pick a display currency for an external travel search based on the route.
// The connector runs behind an Israeli-egress browser session, so the
// underlying sites otherwise default to ILS even for routes that have
// nothing to do with Israel (observed: Copenhagen→Riga returning ₪ prices).
// Honor an explicit override when the planner passes `currency`; otherwise
// infer from the location strings.
function pickCurrency(...locations) {
  const text = locations.filter(Boolean).map(String).join(" ").toUpperCase();
  const IL = /\b(TLV|ETM|HFA|EIY|ISRAEL|TEL\s*AVIV|JERUSALEM|HAIFA|EILAT)\b/;
  const GB = /\b(LHR|LGW|STN|LTN|MAN|EDI|GLA|BHX|BRS|LCY|LONDON|MANCHESTER|EDINBURGH|GLASGOW|BIRMINGHAM|UNITED\s*KINGDOM|ENGLAND|SCOTLAND)\b/;
  const US = /\b(JFK|LGA|EWR|LAX|SFO|OAK|SJC|ORD|MDW|ATL|MIA|FLL|BOS|SEA|DEN|IAD|DCA|BWI|PHX|LAS|DFW|HOU|IAH|MSP|DTW|PHL|SAN|MCO|TPA|CLT|RDU|STL|MCI|SLC|PDX|HNL|USA|UNITED\s*STATES|NEW\s*YORK|LOS\s*ANGELES|SAN\s*FRANCISCO|CHICAGO|MIAMI|BOSTON|SEATTLE|DENVER|WASHINGTON|HOUSTON|DALLAS|ATLANTA|ORLANDO)\b/;

  const hitIL = IL.test(text);
  const hitGB = GB.test(text);
  const hitUS = US.test(text);

  // Domestic Israel only — keep ILS.
  if (hitIL && !hitGB && !hitUS) {
    const allIL = locations.every((l) => l && IL.test(String(l).toUpperCase()));
    if (allIL) return "ILS";
  }
  if (hitUS) return "USD";
  if (hitGB) return "GBP";
  return "EUR";
}

// Sort flights by the requested key.
function sortFlights(flights, sortBy) {
  const arr = [...flights];
  switch (sortBy) {
    case "price":     return arr.sort((a, b) => (a.price ?? 1e15) - (b.price ?? 1e15));
    case "duration":  return arr.sort((a, b) => (a.duration_minutes ?? 1e9) - (b.duration_minutes ?? 1e9));
    case "departure": return arr; // raw order matches departure time roughly
    default: return arr;
  }
}

// Sort hotels/homes.
function sortPlaces(places, sortBy) {
  const arr = [...places];
  switch (sortBy) {
    case "price":
      return arr.sort((a, b) => (a.price_per_night ?? 1e9) - (b.price_per_night ?? 1e9));
    case "rating":
      return arr.sort((a, b) => (b.rating_num ?? 0) - (a.rating_num ?? 0));
    default: return arr;
  }
}

async function searchFlights({
  origin, destination, depart_date, return_date, adults,
  max_stops, min_stops, max_price, airlines, max_results,
  cabin, sort_by, max_duration_hours, currency,
  _adas_actor, _adas_tenant,
}) {
  const dErr = validateFutureDate("depart_date", depart_date) || validateFutureDate("return_date", return_date);
  if (dErr) return dErr;
  const classParam = cabinToFlightClass(cabin);
  const curr = (currency || pickCurrency(origin, destination)).toUpperCase();
  const q = `Flights from ${origin} to ${destination} on ${depart_date}${return_date ? ` returning ${return_date}` : ""}`;
  const url = `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}&curr=${curr}&hl=en${classParam !== 1 ? `&tfs=` : ""}`;

  await callBrowserMcp("web.navigate", { url }, _adas_actor, _adas_tenant);
  await sleep(4000);

  // Scrape up to 20 raw rows then filter+slice client-side so we have enough
  // to satisfy max_stops / max_price / airlines filters.
  const script =
    "(() => { const rows = document.querySelectorAll('[role=listitem][aria-label*=From], li.pIav2d, ul.Rk10dc li'); const out = []; rows.forEach((r,i) => { if (i>=20) return; const text = (r.innerText||'').replace(/\\s+/g,' ').trim().slice(0,400); if (text) out.push(text); }); return JSON.stringify(out); })()";

  const res = await callBrowserMcp("web.evaluate", { script }, _adas_actor, _adas_tenant);
  let raw = [];
  try { raw = JSON.parse(res?.result ?? "[]"); } catch { raw = []; }

  // Decorate every row with parsed fields and apply filters.
  const enriched = raw.map((summary) => ({
    summary,
    stops: extractStops(summary),
    price: extractPrice(summary),
    duration_minutes: extractDurationMinutes(summary),
  }));

  const airlineList = Array.isArray(airlines)
    ? airlines.map((a) => String(a).toLowerCase())
    : null;
  const maxDurMin = typeof max_duration_hours === "number" ? max_duration_hours * 60 : null;

  let filtered = enriched.filter((f) => {
    if (typeof max_stops === "number" && f.stops !== null && f.stops > max_stops) return false;
    if (typeof min_stops === "number" && f.stops !== null && f.stops < min_stops) return false;
    if (typeof max_price === "number" && f.price !== null && f.price > max_price) return false;
    if (maxDurMin && f.duration_minutes !== null && f.duration_minutes > maxDurMin) return false;
    if (airlineList?.length) {
      const lc = (f.summary || "").toLowerCase();
      if (!airlineList.some((a) => lc.includes(a))) return false;
    }
    return true;
  });

  filtered = sortFlights(filtered, sort_by);

  const limit = Math.max(1, Math.min(20, max_results || 5));
  filtered = filtered.slice(0, limit);

  return ok({
    ok: true,
    flights: filtered,
    count: filtered.length,
    total_scraped: raw.length,
    query: {
      origin, destination, depart_date,
      return_date: return_date || null,
      adults: adults || 1,
      max_stops: max_stops ?? null,
      min_stops: min_stops ?? null,
      max_price: max_price ?? null,
      max_duration_hours: max_duration_hours ?? null,
      airlines: airlineList,
      cabin: cabin || "economy",
      sort_by: sort_by || null,
      max_results: limit,
      currency: curr,
    },
    failure_class: filtered.length ? "ok" : (raw.length ? "logical" : "domain_break"),
    _note: raw.length && !filtered.length ? "Scraped flights exist but all were filtered out — relax constraints." : undefined,
  });
}

async function searchHotels({
  location, checkin_date, checkout_date, guests,
  max_price_per_night, min_rating, sort_by, max_results, currency,
  _adas_actor, _adas_tenant,
}) {
  const dErr = validateFutureDate("checkin_date", checkin_date) || validateFutureDate("checkout_date", checkout_date);
  if (dErr) return dErr;
  const adults = guests || 2;
  const curr = (currency || pickCurrency(location)).toUpperCase();
  const url = `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(location)}&checkin=${checkin_date}&checkout=${checkout_date}&group_adults=${adults}&selected_currency=${curr}`;

  await callBrowserMcp("web.navigate", { url }, _adas_actor, _adas_tenant);
  await sleep(4000);

  // Scrape up to 25 then filter client-side.
  const script =
    "(() => { const cards = document.querySelectorAll('[data-testid=property-card]'); const out = []; cards.forEach((c,i) => { if (i>=25) return; const name = c.querySelector('[data-testid=title]')?.innerText?.trim() || null; const priceEl = c.querySelector('[data-testid=price-and-discounted-price]') || c.querySelector('[data-testid=availability-rate-information]'); const price = priceEl?.innerText?.trim() || null; const rating = c.querySelector('[data-testid=review-score]')?.innerText?.replace(/\\s+/g,' ').trim() || null; const link = c.querySelector('a')?.href || null; out.push({name, price, rating, url: link}); }); return JSON.stringify(out); })()";

  const res = await callBrowserMcp("web.evaluate", { script }, _adas_actor, _adas_tenant);
  let raw = [];
  try { raw = JSON.parse(res?.result ?? "[]"); } catch { raw = []; }

  // Decorate.
  const enriched = raw.map((h) => {
    const totalPrice = extractPrice(h.price || "");
    const nights = Math.max(1, Math.round((new Date(checkout_date) - new Date(checkin_date)) / (24 * 60 * 60 * 1000)));
    return {
      ...h,
      price_total: totalPrice,
      price_per_night: totalPrice !== null ? Math.round(totalPrice / nights) : null,
      rating_num: extractRating(h.rating || ""),
    };
  });

  let filtered = enriched.filter((h) => {
    if (typeof max_price_per_night === "number" && h.price_per_night !== null && h.price_per_night > max_price_per_night) return false;
    if (typeof min_rating === "number" && h.rating_num !== null && h.rating_num < min_rating) return false;
    return true;
  });

  filtered = sortPlaces(filtered, sort_by);

  const limit = Math.max(1, Math.min(25, max_results || 5));
  filtered = filtered.slice(0, limit);

  return ok({
    ok: true,
    hotels: filtered,
    count: filtered.length,
    total_scraped: raw.length,
    query: {
      location, checkin_date, checkout_date, guests: adults,
      max_price_per_night: max_price_per_night ?? null,
      min_rating: min_rating ?? null,
      sort_by: sort_by || null,
      max_results: limit,
      currency: curr,
    },
    failure_class: filtered.length ? "ok" : (raw.length ? "logical" : "domain_break"),
    _note: raw.length && !filtered.length ? "Hotels found but all filtered out — relax constraints." : undefined,
  });
}

async function searchHomes({
  location, checkin_date, checkout_date, guests,
  max_price_per_night, min_rating, sort_by, max_results,
  _adas_actor, _adas_tenant,
}) {
  const dErr = validateFutureDate("checkin_date", checkin_date) || validateFutureDate("checkout_date", checkout_date);
  if (dErr) return dErr;
  const adults = guests || 2;
  const slug = encodeURIComponent(location);
  const url = `https://www.airbnb.com/s/${slug}/homes?checkin=${checkin_date}&checkout=${checkout_date}&adults=${adults}`;

  await callBrowserMcp("web.navigate", { url }, _adas_actor, _adas_tenant);
  await sleep(5000);

  const script =
    "(() => { const cards = document.querySelectorAll('[itemprop=itemListElement], [data-testid=card-container]'); const out = []; cards.forEach((c,i) => { if (i>=25) return; const text = (c.innerText||'').replace(/\\s+/g,' ').trim().slice(0,300); const link = c.querySelector('a')?.href || null; if (text) out.push({summary: text, url: link}); }); return JSON.stringify(out); })()";

  const res = await callBrowserMcp("web.evaluate", { script }, _adas_actor, _adas_tenant);
  let raw = [];
  try { raw = JSON.parse(res?.result ?? "[]"); } catch { raw = []; }

  const nights = Math.max(1, Math.round((new Date(checkout_date) - new Date(checkin_date)) / (24 * 60 * 60 * 1000)));

  // Decorate. Airbnb summaries: "Cozy 1BR · 4.9 (128) · $95/night" — extract /night price.
  const enriched = raw.map((h) => {
    const m = (h.summary || "").match(/[₪$€£]\s*([\d,]+)\s*\/?\s*night/i);
    const pricePerNight = m ? parseInt(m[1].replace(/,/g, ""), 10) : null;
    return {
      ...h,
      price_per_night: pricePerNight,
      price_total: pricePerNight !== null ? pricePerNight * nights : null,
      rating_num: extractRating(h.summary || ""),
    };
  });

  let filtered = enriched.filter((h) => {
    if (typeof max_price_per_night === "number" && h.price_per_night !== null && h.price_per_night > max_price_per_night) return false;
    if (typeof min_rating === "number" && h.rating_num !== null && h.rating_num < min_rating) return false;
    return true;
  });

  filtered = sortPlaces(filtered, sort_by);

  const limit = Math.max(1, Math.min(25, max_results || 5));
  filtered = filtered.slice(0, limit);

  return ok({
    ok: true,
    homes: filtered,
    count: filtered.length,
    total_scraped: raw.length,
    query: {
      location, checkin_date, checkout_date, guests: adults,
      max_price_per_night: max_price_per_night ?? null,
      min_rating: min_rating ?? null,
      sort_by: sort_by || null,
      max_results: limit,
    },
    failure_class: filtered.length ? "ok" : (raw.length ? "logical" : "domain_break"),
    _note: raw.length && !filtered.length ? "Homes found but all filtered out — relax constraints." : undefined,
  });
}

async function searchCars({
  pickup_location, dropoff_location, pickup_date, return_date,
  driver_age, max_price_per_day, max_price, car_type, suppliers,
  sort_by, max_results,
  _adas_actor, _adas_tenant,
}) {
  const dErr = validateFutureDate("pickup_date", pickup_date) || validateFutureDate("return_date", return_date);
  if (dErr) return dErr;

  const dropoff = dropoff_location || pickup_location;
  // Kayak car rental URL — most reliable structured scrape target for cars.
  // Pattern: /cars/<pickup>/<dropoff>/<pickup-date>/<return-date>
  const url = `https://www.kayak.com/cars/${encodeURIComponent(pickup_location)}/${encodeURIComponent(dropoff)}/${pickup_date}/${return_date}${driver_age ? `?ages=${driver_age}` : ""}`;

  await callBrowserMcp("web.navigate", { url }, _adas_actor, _adas_tenant);
  await sleep(8000);

  // Kayak's car DOM has rotating class names. Strategy: find every text node
  // matching "$X Total" or similar, walk up to the nearest reasonable wrapper
  // (one that also contains the car model name and supplier info), and use
  // its innerText. Dedupe by wrapper element.
  const script = `(() => {
    const seen = new Set();
    const out = [];
    // Anchor on the "Total" price label which appears once per card.
    const totals = document.querySelectorAll('*');
    for (const el of totals) {
      if (out.length >= 25) break;
      const t = (el.textContent || '').trim();
      // Match "$NNN" or "$NN.NN" followed by "Total" in some descendant text.
      if (el.children.length > 0) continue;
      if (!/^Total$/.test(t)) continue;
      // Walk up until we find a container with >= 4 lines (car name, type, pax, price, etc.)
      let card = el;
      for (let i = 0; i < 8 && card.parentElement; i++) {
        card = card.parentElement;
        const txt = (card.innerText || '').replace(/\\s+/g, ' ').trim();
        if (txt.length > 40 && /[₪$€£]\\s*\\d/.test(txt) && /(view deal|book|select|deal)/i.test(txt)) break;
      }
      if (seen.has(card)) continue;
      seen.add(card);
      const text = (card.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 500);
      const link = card.querySelector('a')?.href || null;
      if (text) out.push({ summary: text, url: link });
    }
    return JSON.stringify(out);
  })()`;

  const res = await callBrowserMcp("web.evaluate", { script }, _adas_actor, _adas_tenant);
  let raw = [];
  try { raw = JSON.parse(res?.result ?? "[]"); } catch { raw = []; }

  const days = Math.max(1, Math.round((new Date(return_date) - new Date(pickup_date)) / (24 * 60 * 60 * 1000)));

  // Decorate. Kayak shows per-card total like "$87 Total" or sometimes "$45/day".
  // Distinguish the two and derive the missing one from rental_days.
  const enriched = raw.map((c) => {
    const t = c.summary || "";
    const dayM = t.match(/[₪$€£]\s*([\d,]+)\s*\/?\s*(?:day|night)/i);
    const totalM = t.match(/[₪$€£]\s*([\d,]+)\s+(?:total|trip)/i);
    const totalPrice = totalM ? parseInt(totalM[1].replace(/,/g, ""), 10) : null;
    const perDayShown = dayM ? parseInt(dayM[1].replace(/,/g, ""), 10) : null;
    const pricePerDay = perDayShown !== null ? perDayShown
      : (totalPrice !== null ? Math.round(totalPrice / days) : null);
    const priceTotal = totalPrice !== null ? totalPrice
      : (perDayShown !== null ? perDayShown * days : null);
    const typeM = t.match(/\b(Economy|Compact|Mini|Mid[- ]?size|Midsize|Standard|Full[- ]?size|Premium|Luxury|SUV|Van|Convertible|Pickup|Truck|Electric)\b/i);
    return {
      ...c,
      price_per_day: pricePerDay,
      price_total: priceTotal,
      car_type: typeM ? typeM[1] : null,
    };
  });

  const supplierList = Array.isArray(suppliers) ? suppliers.map((s) => String(s).toLowerCase()) : null;
  const typeFilter = car_type ? String(car_type).toLowerCase() : null;

  let filtered = enriched.filter((c) => {
    if (typeof max_price_per_day === "number" && c.price_per_day !== null && c.price_per_day > max_price_per_day) return false;
    if (typeof max_price === "number" && c.price_total !== null && c.price_total > max_price) return false;
    if (typeFilter && (!c.car_type || !c.car_type.toLowerCase().includes(typeFilter))) return false;
    if (supplierList?.length) {
      const lc = (c.summary || "").toLowerCase();
      if (!supplierList.some((s) => lc.includes(s))) return false;
    }
    return true;
  });

  // Sort
  if (sort_by === "price") {
    filtered.sort((a, b) => (a.price_per_day ?? a.price_total ?? 1e9) - (b.price_per_day ?? b.price_total ?? 1e9));
  } else if (sort_by === "total") {
    filtered.sort((a, b) => (a.price_total ?? 1e9) - (b.price_total ?? 1e9));
  }

  const limit = Math.max(1, Math.min(25, max_results || 5));
  filtered = filtered.slice(0, limit);

  return ok({
    ok: true,
    cars: filtered,
    count: filtered.length,
    total_scraped: raw.length,
    rental_days: days,
    query: {
      pickup_location, dropoff_location: dropoff, pickup_date, return_date,
      driver_age: driver_age ?? null,
      max_price_per_day: max_price_per_day ?? null,
      max_price: max_price ?? null,
      car_type: car_type ?? null,
      suppliers: supplierList,
      sort_by: sort_by || null,
      max_results: limit,
    },
    failure_class: filtered.length ? "ok" : (raw.length ? "logical" : "domain_break"),
    _note: raw.length && !filtered.length ? "Cars found but all filtered out — relax constraints." : undefined,
  });
}

// Unwrap an ok({...}) MCP response payload back into a plain object.
function unwrap(toolResponse) {
  try { return JSON.parse(toolResponse?.content?.[0]?.text ?? "null"); }
  catch { return null; }
}

// One-shot trip planner — runs searchFlights + searchHotels in parallel
// against the same dates and rolls them up with a price estimate.
async function planTrip({
  origin, destination, depart_date, return_date,
  adults, guests,
  // flight passthrough
  cabin, max_stops, max_price, max_duration_hours, airlines,
  flight_sort_by,
  // hotel passthrough
  max_price_per_night, min_rating, hotel_sort_by,
  // shared
  max_results, _adas_actor, _adas_tenant,
}) {
  if (!return_date) {
    return ok({
      ok: false,
      error: "return_date_required",
      failure_class: "logical",
      hint: "planTrip needs a return_date so hotels can be searched for the stay window. For one-way flights use travel.searchFlights directly.",
    });
  }

  const limit = Math.max(1, Math.min(10, max_results || 3));

  // SERIAL — both searches drive the same browser-mcp per-actor context;
  // running them in parallel makes the second navigation clobber the first.
  const flightsResp = await searchFlights({
    origin, destination, depart_date, return_date,
    adults: adults || 1,
    cabin, max_stops, max_price, max_duration_hours, airlines,
    sort_by: flight_sort_by || "price",
    max_results: limit,
    _adas_actor, _adas_tenant,
  });
  const hotelsResp = await searchHotels({
    location: destination,
    checkin_date: depart_date,
    checkout_date: return_date,
    guests: guests || adults || 2,
    max_price_per_night, min_rating,
    sort_by: hotel_sort_by || "price",
    max_results: limit,
    _adas_actor, _adas_tenant,
  });

  const flightsBody = unwrap(flightsResp) || { flights: [], count: 0 };
  const hotelsBody = unwrap(hotelsResp) || { hotels: [], count: 0 };

  const cheapestFlight = flightsBody.flights?.[0]?.price ?? null;
  const cheapestHotelTotal = hotelsBody.hotels?.[0]?.price_total ?? null;
  const estimatedTotal = (cheapestFlight !== null && cheapestHotelTotal !== null)
    ? cheapestFlight + cheapestHotelTotal
    : null;

  const nights = Math.max(1, Math.round(
    (new Date(return_date) - new Date(depart_date)) / (24 * 60 * 60 * 1000),
  ));

  return ok({
    ok: true,
    trip: { origin, destination, depart_date, return_date, nights, travelers: adults || guests || 1 },
    flights: flightsBody.flights || [],
    flights_count: flightsBody.count ?? 0,
    hotels: hotelsBody.hotels || [],
    hotels_count: hotelsBody.count ?? 0,
    estimate: {
      cheapest_flight: cheapestFlight,
      cheapest_hotel_total: cheapestHotelTotal,
      total: estimatedTotal,
      note: "Total = cheapest flight price + cheapest hotel total (for the full stay). Per-traveler estimate; currency matches scraped values.",
    },
    failure_class: (flightsBody.count || hotelsBody.count) ? "ok" : "domain_break",
  });
}

async function myBookings({ _adas_actor, _adas_tenant }) {
  // Cookies auto-loaded by browser-mcp from auth_cookies:booking.com per actor.
  await callBrowserMcp(
    "web.navigate",
    { url: "https://secure.booking.com/myreservations.html" },
    _adas_actor,
    _adas_tenant,
  );
  await sleep(3500);

  const urlCheck = await callBrowserMcp(
    "web.evaluate",
    { script: "window.location.href" },
    _adas_actor,
    _adas_tenant,
  );
  const currentUrl = String(urlCheck?.result ?? "");

  if (/sign|login/i.test(currentUrl)) {
    return ok({
      ok: false,
      connected: false,
      error: "not_connected",
      failure_class: "logical",
      hint: "Call platform.auth.ensureConnected({service_id: 'booking'}) first.",
    });
  }

  const script =
    "(() => { const rows = document.querySelectorAll('[data-testid=reservation], .reservation, .booking, [data-confirmation-number]'); const out = []; rows.forEach((r,i) => { if (i>=10) return; const text = (r.innerText||'').replace(/\\s+/g,' ').trim().slice(0,400); if (text) out.push(text); }); return JSON.stringify(out); })()";

  const res = await callBrowserMcp("web.evaluate", { script }, _adas_actor, _adas_tenant);
  let items = [];
  try { items = JSON.parse(res?.result ?? "[]"); } catch { items = []; }

  return ok({
    ok: true,
    connected: true,
    bookings: items.map((t) => ({ summary: t })),
    count: items.length,
    failure_class: "ok",
  });
}

// ─── MCP server wiring ─────────────────────────────────────────────────────

function registerTools(server) {
  server.registerTool(
    "travel.searchFlights",
    {
      description:
        "Search Google Flights for flights between two airports/cities on given dates. Returns matching flights with summary, parsed stops, price, and duration_minutes. Server-side filters: max_stops (0=direct), min_stops (1=connecting), max_price, max_duration_hours, airlines, cabin. Server-side sort: price | duration | departure.",
      inputSchema: {
        origin: z.string().describe("Origin airport code (e.g. 'TLV') or city name"),
        destination: z.string().describe("Destination airport code or city name"),
        depart_date: z.string().describe("Departure date YYYY-MM-DD"),
        return_date: z.string().optional().describe("Return date YYYY-MM-DD. Omit for one-way."),
        adults: z.number().optional().describe("Number of adult passengers. Default 1."),
        cabin: z.enum(["economy", "premium_economy", "business", "first"]).optional().describe("Cabin class. Default economy."),
        max_stops: z.number().optional().describe("Max stops allowed. 0 = direct only."),
        min_stops: z.number().optional().describe("Min stops required. 1 = exclude direct flights."),
        max_price: z.number().optional().describe("Max total price (integer, in displayed currency)."),
        max_duration_hours: z.number().optional().describe("Max total trip duration in hours."),
        airlines: z.array(z.string()).optional().describe("Limit to flights matching any of these airline names (substring, case-insensitive)."),
        sort_by: z.enum(["price", "duration", "departure"]).optional().describe("Sort key applied AFTER filtering."),
        max_results: z.number().optional().describe("Max results after filtering+sort. Default 5, max 20."),
        currency: z.string().optional().describe("ISO 4217 currency code (e.g. 'EUR', 'USD', 'GBP', 'ILS'). Inferred from route when omitted."),
        ...ACTOR_FIELD,
      },
    },
    safeHandler(searchFlights),
  );

  server.registerTool(
    "travel.searchHotels",
    {
      description:
        "Search Booking.com for hotels. Returns hotels with parsed price_per_night and rating_num (0-10). Server-side filters: max_price_per_night, min_rating. Sort by 'price' or 'rating'. No auth required for search.",
      inputSchema: {
        location: z.string().describe("City, area, or hotel name"),
        checkin_date: z.string().describe("Check-in date YYYY-MM-DD"),
        checkout_date: z.string().describe("Check-out date YYYY-MM-DD"),
        guests: z.number().optional().describe("Number of adult guests. Default 2."),
        max_price_per_night: z.number().optional().describe("Max nightly price (integer, displayed currency)."),
        min_rating: z.number().optional().describe("Min review score on 0-10 scale (e.g. 8.0 for 'very good' or higher)."),
        sort_by: z.enum(["price", "rating"]).optional().describe("Sort key applied AFTER filtering."),
        max_results: z.number().optional().describe("Max results after filtering+sort. Default 5, max 25."),
        currency: z.string().optional().describe("ISO 4217 currency code (e.g. 'EUR', 'USD', 'GBP', 'ILS'). Inferred from location when omitted."),
        ...ACTOR_FIELD,
      },
    },
    safeHandler(searchHotels),
  );

  server.registerTool(
    "travel.searchHomes",
    {
      description:
        "Search Airbnb for home/apartment rentals. Returns listings with parsed price_per_night and rating_num (0-10). Server-side filters: max_price_per_night, min_rating. Sort by 'price' or 'rating'. No auth required.",
      inputSchema: {
        location: z.string().describe("City, neighborhood, or landmark"),
        checkin_date: z.string().describe("Check-in date YYYY-MM-DD"),
        checkout_date: z.string().describe("Check-out date YYYY-MM-DD"),
        guests: z.number().optional().describe("Number of guests. Default 2."),
        max_price_per_night: z.number().optional().describe("Max nightly price (integer, displayed currency)."),
        min_rating: z.number().optional().describe("Min review score on 0-10 scale (Airbnb 5-scale is normalized)."),
        sort_by: z.enum(["price", "rating"]).optional().describe("Sort key applied AFTER filtering."),
        max_results: z.number().optional().describe("Max results after filtering+sort. Default 5, max 25."),
        ...ACTOR_FIELD,
      },
    },
    safeHandler(searchHomes),
  );

  server.registerTool(
    "travel.searchCars",
    {
      description:
        "Search Kayak for rental cars at a pickup location for given pickup/return dates. Returns cars with parsed price_per_day, price_total, and car_type when detectable. Server-side filters: max_price_per_day, max_price (total), car_type (Economy/SUV/Premium/etc., substring match), suppliers (rental company name list). Sort by 'price' (per-day) or 'total'. No auth required.",
      inputSchema: {
        pickup_location: z.string().describe("Pickup city, airport code, or area (e.g. 'Rome', 'LAX', 'Paris')"),
        dropoff_location: z.string().optional().describe("Dropoff location. Defaults to pickup_location."),
        pickup_date: z.string().describe("Pickup date YYYY-MM-DD"),
        return_date: z.string().describe("Return date YYYY-MM-DD"),
        driver_age: z.number().optional().describe("Driver age (Kayak adjusts pricing for under 25)."),
        max_price_per_day: z.number().optional().describe("Max nightly/daily price (integer)."),
        max_price: z.number().optional().describe("Max total trip price (integer)."),
        car_type: z.string().optional().describe("Substring match against detected car_type (Economy, Compact, SUV, Premium, Luxury, Van, etc.)"),
        suppliers: z.array(z.string()).optional().describe("Filter to specific rental companies (substring match, case-insensitive). Examples: ['Hertz','Avis','Sixt']."),
        sort_by: z.enum(["price", "total"]).optional().describe("Sort by per-day price or total price."),
        max_results: z.number().optional().describe("Max results after filtering+sort. Default 5, max 25."),
        ...ACTOR_FIELD,
      },
    },
    safeHandler(searchCars),
  );

  server.registerTool(
    "travel.planTrip",
    {
      description:
        "One-shot trip planner — searches Google Flights AND Booking.com hotels in parallel for the same dates and returns a combined view with a cheapest-option price estimate. Requires return_date (for the hotel checkout). All filter params from searchFlights and searchHotels are accepted as passthrough. No auth required.",
      inputSchema: {
        origin: z.string().describe("Origin airport code or city name"),
        destination: z.string().describe("Destination — used as the city for hotels too"),
        depart_date: z.string().describe("Depart / hotel check-in YYYY-MM-DD"),
        return_date: z.string().describe("Return / hotel check-out YYYY-MM-DD"),
        adults: z.number().optional().describe("Number of adults (flights). Default 1."),
        guests: z.number().optional().describe("Number of hotel guests. Default = adults."),
        cabin: z.enum(["economy", "premium_economy", "business", "first"]).optional(),
        max_stops: z.number().optional().describe("Flight: max stops. 0 = direct only."),
        max_price: z.number().optional().describe("Flight: max total price."),
        max_duration_hours: z.number().optional().describe("Flight: max duration in hours."),
        airlines: z.array(z.string()).optional().describe("Flight: airline name filter."),
        flight_sort_by: z.enum(["price", "duration", "departure"]).optional().describe("Flight sort. Default 'price'."),
        max_price_per_night: z.number().optional().describe("Hotel: max nightly price."),
        min_rating: z.number().optional().describe("Hotel: min review score 0-10."),
        hotel_sort_by: z.enum(["price", "rating"]).optional().describe("Hotel sort. Default 'price'."),
        max_results: z.number().optional().describe("Max items per category (flights, hotels). Default 3, max 10."),
        ...ACTOR_FIELD,
      },
    },
    safeHandler(planTrip),
  );

  server.registerTool(
    "travel.myBookings",
    {
      description:
        "Fetch the current user's bookings from Booking.com. Requires the actor to be connected — caller must call platform.auth.ensureConnected({service_id:'booking'}) first if needed.",
      inputSchema: {
        ...ACTOR_FIELD,
      },
    },
    safeHandler(myBookings),
  );

  server.registerTool(
    "auth.listServices",
    {
      description:
        "Internal — returns the auth services this connector handles, for platform.auth self-registration.",
      inputSchema: {},
      _meta: { planner_visible: false },
    },
    safeHandler(async () => ok({ services: AUTH_SERVICES })),
  );
}

// ─── Stdio transport ───────────────────────────────────────────────────────
// Spawned as a Core child process by ConnectorManager — stdin/stdout carry the
// MCP JSON-RPC stream, so no HTTP surface and no token gate are needed here.
// All logging MUST go to stderr (console.error) to keep stdout protocol-clean.

const server = new McpServer({ name: "adas-travel-mcp", version: "0.2.0" });
registerTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);

console.error(`[adas-travel-mcp v0.2.0] stdio MCP ready`);
console.error(`  Tools: travel.searchFlights, travel.searchHotels, travel.searchHomes, travel.searchCars, travel.planTrip, travel.myBookings, auth.listServices`);
console.error(`  Upstream: ${GATEWAY_URL ? `Core gateway at ${GATEWAY_URL} (platform.callTool → browser-mcp)` : `browser-mcp direct at ${BROWSER_MCP_URL}`}`);
