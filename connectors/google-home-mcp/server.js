#!/usr/bin/env node
// Google Home MCP Connector — Smart Device Management (SDM) API
// Multi-user: auth and device state scoped per actor_id
// Transport: stdio JSON-RPC 2.0

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), ".data");
const GOOGLE_PROJECT_ID = process.env.GOOGLE_PROJECT_ID || null;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || null;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || null;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || "https://app.ateam-ai.com/oauth/callback";
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, "google-home.db"));
db.exec(`
  CREATE TABLE IF NOT EXISTS auth(
    key TEXT NOT NULL,
    actor_id TEXT NOT NULL DEFAULT 'default',
    value_json TEXT,
    updated_at TEXT,
    PRIMARY KEY(key, actor_id)
  );
  CREATE TABLE IF NOT EXISTS devices(
    device_id TEXT NOT NULL,
    actor_id TEXT NOT NULL DEFAULT 'default',
    device_type TEXT,
    friendly_name TEXT,
    room TEXT,
    capabilities_json TEXT,
    last_seen TEXT,
    PRIMARY KEY(device_id, actor_id)
  );
  CREATE TABLE IF NOT EXISTS device_states(
    device_id TEXT NOT NULL,
    actor_id TEXT NOT NULL DEFAULT 'default',
    state TEXT DEFAULT 'unknown',
    attributes_json TEXT DEFAULT '{}',
    PRIMARY KEY(device_id, actor_id)
  );
`);

try { db.exec(`
  CREATE INDEX IF NOT EXISTS idx_auth_actor ON auth(actor_id);
  CREATE INDEX IF NOT EXISTS idx_devices_actor ON devices(actor_id);
  CREATE INDEX IF NOT EXISTS idx_states_actor ON device_states(actor_id);
`); } catch {}

// --- Actor isolation ---
function getActorId(args) { return args?._adas_actor || "default"; }

function now() { return new Date().toISOString(); }
function writeResult(id, result) { process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n"); }
function writeError(id, message) { process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32000, message } }) + "\n"); }

// --- Auth helpers (per actor) ---
function getAuth(actorId) {
  const row = db.prepare("SELECT value_json FROM auth WHERE key = 'google' AND actor_id = ?").get(actorId);
  return row ? JSON.parse(row.value_json) : null;
}
function saveAuth(data, actorId) {
  db.prepare("INSERT OR REPLACE INTO auth(key, actor_id, value_json, updated_at) VALUES('google', ?, ?, ?)").run(actorId, JSON.stringify(data), now());
}

async function refreshTokenIfNeeded(actorId) {
  const auth = getAuth(actorId); if (!auth?.refresh_token) throw new Error("Google Home not connected. Use google.auth first.");
  if (auth.expires_at && Date.now() < auth.expires_at - 60000) return auth;
  const res = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: auth.refresh_token, client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET }) });
  const data = await res.json(); if (data.error) throw new Error(`Google token refresh failed: ${data.error_description || data.error}`);
  const updated = { ...auth, access_token: data.access_token, expires_at: Date.now() + (data.expires_in * 1000), ...(data.refresh_token ? { refresh_token: data.refresh_token } : {}) };
  saveAuth(updated, actorId); return updated;
}

const SDM_BASE = "https://smartdevicemanagement.googleapis.com/v1";
async function sdmFetch(endpoint, actorId, options = {}) {
  const auth = await refreshTokenIfNeeded(actorId);
  const res = await fetch(`${SDM_BASE}${endpoint}`, { ...options, headers: { Authorization: `Bearer ${auth.access_token}`, "Content-Type": "application/json", ...(options.headers || {}) } });
  if (!res.ok) { const txt = await res.text().catch(() => ""); throw new Error(`Google SDM ${res.status}: ${txt}`); }
  return res.json();
}

const TYPE_MAP = {
  "sdm.devices.types.THERMOSTAT": { type: "thermostat", caps: ["set_temperature", "set_mode", "set_fan", "get_eco"] },
  "sdm.devices.types.CAMERA":     { type: "camera",     caps: ["get_stream"] },
  "sdm.devices.types.DOORBELL":   { type: "doorbell",   caps: ["get_stream"] },
  "sdm.devices.types.DISPLAY":    { type: "display",    caps: ["read_state"] },
};
const COMMAND_MAP = {
  SetHeat:     "sdm.devices.commands.ThermostatTemperatureSetpoint.SetHeat",
  SetCool:     "sdm.devices.commands.ThermostatTemperatureSetpoint.SetCool",
  SetRange:    "sdm.devices.commands.ThermostatTemperatureSetpoint.SetRange",
  SetMode:     "sdm.devices.commands.ThermostatMode.SetMode",
  SetFanTimer: "sdm.devices.commands.Fan.SetTimer",
  SetEcoMode:  "sdm.devices.commands.ThermostatEco.SetMode",
};

function extractTraitValues(traits) {
  const attrs = {};
  for (const [key, val] of Object.entries(traits || {})) {
    const k = key.replace("sdm.devices.traits.", "");
    if (k === "Temperature") attrs.ambient_temperature_c = val.ambientTemperatureCelsius;
    else if (k === "ThermostatTemperatureSetpoint") { attrs.heat_setpoint_c = val.heatCelsius; attrs.cool_setpoint_c = val.coolCelsius; }
    else if (k === "ThermostatMode") attrs.thermostat_mode = val.mode;
    else if (k === "ThermostatEco") { attrs.eco_mode = val.mode; }
    else if (k === "ThermostatHvac") attrs.hvac_status = val.status;
    else if (k === "Humidity") attrs.humidity_percent = val.ambientHumidityPercent;
    else if (k === "Connectivity") attrs.connectivity = val.status;
    else if (k === "Info") attrs.custom_name = val.customName;
    else attrs[k] = val;
  }
  return attrs;
}

const TOOLS = [
  { name: "google.auth",       description: "Start Google Home authorization — returns OAuth URL",                  inputSchema: { type: "object", properties: { _adas_actor: { type: "string" } } } },
  { name: "google.callback",   description: "Complete Google Home authorization with the OAuth code",               inputSchema: { type: "object", properties: { code: { type: "string" }, _adas_actor: { type: "string" } }, required: ["code"] } },
  { name: "google.devices",    description: "List all Google Home / Nest devices for the current user",             inputSchema: { type: "object", properties: { refresh: { type: "boolean" }, _adas_actor: { type: "string" } } } },
  { name: "google.state",      description: "Get current state of a Google Home device",                           inputSchema: { type: "object", properties: { device_id: { type: "string" }, _adas_actor: { type: "string" } }, required: ["device_id"] } },
  { name: "google.command",    description: "Control a Nest device (SetHeat, SetCool, SetRange, SetMode, SetFanTimer, SetEcoMode)", inputSchema: { type: "object", properties: { device_id: { type: "string" }, command: { type: "string" }, params: { type: "object" }, _adas_actor: { type: "string" } }, required: ["device_id", "command"] } },
  { name: "google.structures", description: "List Google Home structures and rooms for the current user",           inputSchema: { type: "object", properties: { _adas_actor: { type: "string" } } } },
  { name: "google.status",     description: "Get Google Home connection status for the current user",               inputSchema: { type: "object", properties: { _adas_actor: { type: "string" } } } },
];

async function callTool(name, args) {
  const actorId = getActorId(args);
  switch (name) {
    case "google.auth": {
      if (!GOOGLE_CLIENT_ID || !GOOGLE_PROJECT_ID) return { error: "Google Home not configured. Set GOOGLE_PROJECT_ID, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET. Register at https://console.nest.google.com/device-access" };
      const authUrl = `https://nestservices.google.com/partnerconnections/${GOOGLE_PROJECT_ID}/auth?` + new URLSearchParams({ response_type: "code", client_id: GOOGLE_CLIENT_ID, redirect_uri: GOOGLE_REDIRECT_URI, scope: "https://www.googleapis.com/auth/sdm.service", access_type: "offline", prompt: "consent" });
      return { auth_url: authUrl, next_step: "Visit the URL, authorize, then call google.callback with the 'code' from the redirect" };
    }
    case "google.callback": {
      if (!args.code) throw new Error("Authorization code required");
      const res = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", code: args.code, client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, redirect_uri: GOOGLE_REDIRECT_URI }) });
      const data = await res.json(); if (data.error) throw new Error(`OAuth error: ${data.error_description || data.error}`);
      saveAuth({ access_token: data.access_token, refresh_token: data.refresh_token, expires_at: Date.now() + (data.expires_in * 1000) }, actorId);
      const projectPath = `/enterprises/${GOOGLE_PROJECT_ID}`;
      const result = await sdmFetch(`${projectPath}/devices`, actorId);
      const devices = (result.devices || []).map(dev => ({ id: dev.name.split("/").pop(), type: (TYPE_MAP[dev.type] || {}).type || "unknown", name: extractTraitValues(dev.traits).custom_name }));
      return { connected: true, devices_found: devices.length, devices };
    }
    case "google.devices": {
      const projectPath = `/enterprises/${GOOGLE_PROJECT_ID}`;
      const result = await sdmFetch(`${projectPath}/devices`, actorId);
      const devices = [];
      for (const dev of result.devices || []) {
        const id = dev.name.split("/").pop(); const typeInfo = TYPE_MAP[dev.type] || { type: "unknown", caps: [] }; const attrs = extractTraitValues(dev.traits);
        let room = null; for (const rel of dev.parentRelations || []) { if (rel.displayName) room = rel.displayName; }
        devices.push({ id, full_id: dev.name, type: typeInfo.type, name: attrs.custom_name, room, connectivity: attrs.connectivity, ...attrs });
      }
      return { count: devices.length, devices };
    }
    case "google.state": {
      if (!args.device_id) throw new Error("device_id required");
      const projectPath = `/enterprises/${GOOGLE_PROJECT_ID}`;
      const fullId = args.device_id.includes("/") ? args.device_id : `${projectPath}/devices/${args.device_id}`;
      const dev = await sdmFetch(`/${fullId.replace(/^\//, "")}`, actorId);
      const attrs = extractTraitValues(dev.traits); const typeInfo = TYPE_MAP[dev.type] || { type: "unknown" };
      return { device_id: args.device_id, type: typeInfo.type, name: attrs.custom_name, ...attrs };
    }
    case "google.command": {
      if (!args.device_id || !args.command) throw new Error("device_id and command required");
      const sdmCommand = COMMAND_MAP[args.command]; if (!sdmCommand) throw new Error(`Unknown command: ${args.command}. Available: ${Object.keys(COMMAND_MAP).join(", ")}`);
      const projectPath = `/enterprises/${GOOGLE_PROJECT_ID}`;
      const fullId = args.device_id.includes("/") ? args.device_id : `${projectPath}/devices/${args.device_id}`;
      const result = await sdmFetch(`/${fullId.replace(/^\//, "")}:executeCommand`, actorId, { method: "POST", body: JSON.stringify({ command: sdmCommand, params: args.params || {} }) });
      return { success: true, device_id: args.device_id, command: args.command, result };
    }
    case "google.structures": {
      const projectPath = `/enterprises/${GOOGLE_PROJECT_ID}`;
      const result = await sdmFetch(`${projectPath}/structures`, actorId);
      return (result.structures || []).map(s => ({ id: s.name.split("/").pop(), name: s.traits?.["sdm.structures.traits.Info"]?.customName || "Home" }));
    }
    case "google.status": {
      const auth = getAuth(actorId); if (!auth?.access_token) return { connected: false, message: "Not connected. Use google.auth.", project_id: GOOGLE_PROJECT_ID || "not set" };
      return { connected: !!auth.refresh_token, has_refresh_token: !!auth.refresh_token, project_id: GOOGLE_PROJECT_ID };
    }
    default: throw new Error(`Unknown tool: ${name}`);
  }
}

process.stdin.setEncoding("utf8"); let buffer = "";
process.stdin.on("data", async (chunk) => {
  buffer += chunk; let idx;
  while ((idx = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, idx).trim(); buffer = buffer.slice(idx + 1); if (!line) continue;
    let msg; try { msg = JSON.parse(line); } catch { continue; }
    const { id, method, params } = msg;
    try {
      if (method === "initialize") { writeResult(id, { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "google-home-mcp", version: "1.1.0" } }); continue; }
      if (method === "notifications/initialized") continue;
      if (method === "tools/list") { writeResult(id, { tools: TOOLS }); continue; }
      if (method === "tools/call") { const result = await callTool(params.name, params.arguments || {}); writeResult(id, { content: [{ type: "text", text: JSON.stringify(result) }] }); continue; }
      writeError(id, `Unsupported method: ${method}`);
    } catch (err) { console.error(`[google] Error:`, err.message); if (id != null) writeError(id, err.message); }
  }
});
console.error("[google-home-mcp v1.1.0] Google Home connector started — multi-user actor-scoped");
