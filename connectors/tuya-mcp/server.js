#!/usr/bin/env node
// Tuya / Smart Life MCP Connector — Cloud API with HMAC-SHA256 signing
// Multi-user: auth and device state scoped per actor_id
// Transport: stdio JSON-RPC 2.0

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), ".data");
const TUYA_ACCESS_ID = process.env.TUYA_ACCESS_ID || null;
const TUYA_ACCESS_SECRET = process.env.TUYA_ACCESS_SECRET || null;
const TUYA_REGION = process.env.TUYA_REGION || "us";
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, "tuya.db"));
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

const REGION_URLS = { us: "https://openapi.tuyaus.com", eu: "https://openapi.tuyaeu.com", cn: "https://openapi.tuyacn.com", in: "https://openapi.tuyain.com" };

// --- Auth helpers (per actor) ---
function getAuth(actorId) {
  const row = db.prepare("SELECT value_json FROM auth WHERE key = 'tuya' AND actor_id = ?").get(actorId);
  return row ? JSON.parse(row.value_json) : null;
}
function saveAuth(data, actorId) {
  db.prepare("INSERT OR REPLACE INTO auth(key, actor_id, value_json, updated_at) VALUES('tuya', ?, ?, ?)").run(actorId, JSON.stringify(data), now());
}

function signRequest(method, pathUrl, body, accessToken) {
  const accessId = TUYA_ACCESS_ID; const secret = TUYA_ACCESS_SECRET;
  if (!accessId || !secret) throw new Error("TUYA_ACCESS_ID and TUYA_ACCESS_SECRET env vars required");
  const t = Date.now().toString();
  const contentHash = crypto.createHash("sha256").update(body || "").digest("hex");
  const stringToSign = [method.toUpperCase(), contentHash, "", pathUrl].join("\n");
  const signStr = accessId + (accessToken || "") + t + stringToSign;
  const sign = crypto.createHmac("sha256", secret).update(signStr).digest("hex").toUpperCase();
  return { client_id: accessId, sign, t, sign_method: "HMAC-SHA256", ...(accessToken ? { access_token: accessToken } : {}) };
}

async function getToken(actorId) {
  const base = REGION_URLS[TUYA_REGION] || REGION_URLS.us; const pathUrl = "/v1.0/token?grant_type=1";
  const headers = signRequest("GET", pathUrl, "", null);
  const res = await fetch(`${base}${pathUrl}`, { headers: { ...headers, "Content-Type": "application/json" } });
  const data = await res.json(); if (!data.success) throw new Error(`Tuya token error: ${data.msg}`);
  const tokens = { access_token: data.result.access_token, refresh_token: data.result.refresh_token, expires_at: Date.now() + (data.result.expire_time * 1000), uid: data.result.uid };
  saveAuth(tokens, actorId); return tokens;
}

async function refreshToken(actorId) {
  const auth = getAuth(actorId); if (!auth?.refresh_token) return await getToken(actorId);
  const base = REGION_URLS[TUYA_REGION] || REGION_URLS.us; const pathUrl = `/v1.0/token/${auth.refresh_token}`;
  const headers = signRequest("GET", pathUrl, "", null);
  const res = await fetch(`${base}${pathUrl}`, { headers: { ...headers, "Content-Type": "application/json" } });
  const data = await res.json(); if (!data.success) return await getToken(actorId);
  const tokens = { access_token: data.result.access_token, refresh_token: data.result.refresh_token, expires_at: Date.now() + (data.result.expire_time * 1000), uid: data.result.uid || auth.uid };
  saveAuth(tokens, actorId); return tokens;
}

async function ensureToken(actorId) {
  const auth = getAuth(actorId); if (auth?.access_token && auth.expires_at > Date.now() + 60000) return auth;
  return await refreshToken(actorId);
}

async function tuyaFetch(endpoint, actorId, options = {}) {
  const auth = await ensureToken(actorId); const base = REGION_URLS[TUYA_REGION] || REGION_URLS.us;
  const method = (options.method || "GET").toUpperCase(); const body = options.body || "";
  const headers = signRequest(method, endpoint, body, auth.access_token);
  const res = await fetch(`${base}${endpoint}`, { method, headers: { ...headers, "Content-Type": "application/json" }, ...(method !== "GET" && body ? { body } : {}) });
  const data = await res.json(); if (!data.success) throw new Error(`Tuya API error: ${data.msg} (code: ${data.code})`); return data.result;
}

const CATEGORY_MAP = { dj: "Light", kg: "Switch", cz: "Plug", pc: "Power Strip", wk: "Thermostat", kt: "Air Conditioner", fs: "Fan", cl: "Curtain", mc: "Door Sensor", pir: "Motion Sensor", wsdcg: "Temp/Humidity Sensor", ywbj: "Smoke Detector", sp: "Camera", szjqr: "Robot Vacuum" };

async function refreshDevices(actorId) {
  let allDevices = [];
  try { const result = await tuyaFetch("/v1.0/iot-03/devices?page_no=1&page_size=100", actorId); if (result?.list) allDevices = result.list; else if (Array.isArray(result)) allDevices = result; }
  catch { const auth = getAuth(actorId); if (auth?.uid) { const result = await tuyaFetch(`/v1.0/users/${auth.uid}/devices`, actorId); allDevices = Array.isArray(result) ? result : []; } }
  const devices = [];
  for (const dev of allDevices) {
    const id = dev.id; const name = dev.name || dev.product_name || "Unknown Device"; const category = dev.category || ""; const typeName = CATEGORY_MAP[category] || category || "Unknown"; const online = dev.online !== false;
    db.prepare("INSERT OR REPLACE INTO devices(device_id, actor_id, device_type, friendly_name, room, capabilities_json, last_seen) VALUES(?,?,?,?,?,?,?)").run(id, actorId, typeName, name, null, JSON.stringify([category]), now());
    db.prepare("INSERT OR REPLACE INTO device_states(device_id, actor_id, state, attributes_json) VALUES(?,?,?,?)").run(id, actorId, online ? "online" : "offline", JSON.stringify({ category, product_id: dev.product_id }));
    devices.push({ id, name, type: typeName, category, online, product_id: dev.product_id });
  }
  return devices;
}

const TOOLS = [
  { name: "tuya.auth",             description: "Connect to Tuya IoT Platform",                    inputSchema: { type: "object", properties: { access_id: { type: "string" }, access_secret: { type: "string" }, region: { type: "string" }, _adas_actor: { type: "string" } } } },
  { name: "tuya.callback",         description: "Verify Tuya connection and list devices",          inputSchema: { type: "object", properties: { _adas_actor: { type: "string" } } } },
  { name: "tuya.devices",          description: "List all Tuya devices for the current user",       inputSchema: { type: "object", properties: { refresh: { type: "boolean" }, _adas_actor: { type: "string" } } } },
  { name: "tuya.state",            description: "Get current state of a Tuya device",              inputSchema: { type: "object", properties: { device_id: { type: "string" }, _adas_actor: { type: "string" } }, required: ["device_id"] } },
  { name: "tuya.command",          description: "Send a command to a Tuya device",                 inputSchema: { type: "object", properties: { device_id: { type: "string" }, commands: { type: "array", items: { type: "object", properties: { code: { type: "string" }, value: {} }, required: ["code", "value"] } }, _adas_actor: { type: "string" } }, required: ["device_id", "commands"] } },
  { name: "tuya.device_functions", description: "Get available functions for a Tuya device",       inputSchema: { type: "object", properties: { device_id: { type: "string" }, _adas_actor: { type: "string" } }, required: ["device_id"] } },
  { name: "tuya.categories",       description: "List known Tuya device categories",               inputSchema: { type: "object", properties: { _adas_actor: { type: "string" } } } },
  { name: "tuya.status",           description: "Get Tuya connection status for the current user", inputSchema: { type: "object", properties: { _adas_actor: { type: "string" } } } },
];

async function callTool(name, args) {
  const actorId = getActorId(args);
  switch (name) {
    case "tuya.auth": {
      if (!TUYA_ACCESS_ID && !args.access_id) return { error: "Tuya credentials not configured. Set TUYA_ACCESS_ID and TUYA_ACCESS_SECRET, or visit https://iot.tuya.com/" };
      try { const tokens = await getToken(actorId); const devices = await refreshDevices(actorId); return { connected: true, region: TUYA_REGION, uid: tokens.uid, devices_found: devices.length, devices }; }
      catch (e) { return { error: e.message }; }
    }
    case "tuya.callback": {
      try { const auth = await ensureToken(actorId); const devices = await refreshDevices(actorId); return { connected: true, region: TUYA_REGION, uid: auth.uid, devices_found: devices.length, devices }; }
      catch (e) { return { error: e.message }; }
    }
    case "tuya.devices": {
      await ensureToken(actorId);
      if (args.refresh !== false) { const devices = await refreshDevices(actorId); return { count: devices.length, devices }; }
      const rows = db.prepare("SELECT d.*, s.state, s.attributes_json FROM devices d LEFT JOIN device_states s ON d.device_id = s.device_id AND d.actor_id = s.actor_id WHERE d.actor_id = ?").all(actorId);
      return { count: rows.length, devices: rows.map(r => ({ id: r.device_id, type: r.device_type, name: r.friendly_name, state: r.state, ...JSON.parse(r.attributes_json || "{}") })) };
    }
    case "tuya.state": {
      if (!args.device_id) throw new Error("device_id required");
      const status = await tuyaFetch(`/v1.0/iot-03/devices/${args.device_id}/status`, actorId);
      let info = {}; try { info = await tuyaFetch(`/v1.0/iot-03/devices/${args.device_id}`, actorId); } catch {}
      return { device_id: args.device_id, name: info.name || null, online: info.online !== false, category: info.category || null, status: Array.isArray(status) ? status : [] };
    }
    case "tuya.command": {
      if (!args.device_id || !Array.isArray(args.commands)) throw new Error("device_id and commands array required");
      const result = await tuyaFetch(`/v1.0/iot-03/devices/${args.device_id}/commands`, actorId, { method: "POST", body: JSON.stringify({ commands: args.commands }) });
      return { success: true, device_id: args.device_id, result };
    }
    case "tuya.device_functions": {
      if (!args.device_id) throw new Error("device_id required");
      const fns = await tuyaFetch(`/v1.0/iot-03/devices/${args.device_id}/functions`, actorId);
      return { device_id: args.device_id, functions: (fns.functions || []).map(f => ({ code: f.code, name: f.name, type: f.type, values: f.values ? JSON.parse(f.values) : null })) };
    }
    case "tuya.categories": return Object.entries(CATEGORY_MAP).map(([code, name]) => ({ code, name }));
    case "tuya.status": {
      const auth = getAuth(actorId); if (!auth?.access_token) return { connected: false, message: "Not connected. Use tuya.auth." };
      const expired = auth.expires_at && Date.now() > auth.expires_at;
      return { connected: !expired, region: TUYA_REGION, uid: auth.uid, token_expired: expired };
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
      if (method === "initialize") { writeResult(id, { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "tuya-mcp", version: "1.1.0" } }); continue; }
      if (method === "notifications/initialized") continue;
      if (method === "tools/list") { writeResult(id, { tools: TOOLS }); continue; }
      if (method === "tools/call") { const result = await callTool(params.name, params.arguments || {}); writeResult(id, { content: [{ type: "text", text: JSON.stringify(result) }] }); continue; }
      writeError(id, `Unsupported method: ${method}`);
    } catch (err) { console.error(`[tuya] Error:`, err.message); if (id != null) writeError(id, err.message); }
  }
});
console.error("[tuya-mcp v1.1.0] Tuya connector started — multi-user actor-scoped");
