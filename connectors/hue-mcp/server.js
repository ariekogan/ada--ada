#!/usr/bin/env node
// Philips Hue MCP Connector — CLIP v2 API via local bridge
// Multi-user: auth and device state scoped per actor_id
// Transport: stdio JSON-RPC 2.0

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), ".data");
const HUE_BRIDGE_IP = process.env.HUE_BRIDGE_IP || null;
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, "hue.db"));
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
  const row = db.prepare("SELECT value_json FROM auth WHERE key = 'hue' AND actor_id = ?").get(actorId);
  return row ? JSON.parse(row.value_json) : null;
}
function saveAuth(data, actorId) {
  db.prepare("INSERT OR REPLACE INTO auth(key, actor_id, value_json, updated_at) VALUES('hue', ?, ?, ?)").run(actorId, JSON.stringify(data), now());
}

// --- Hue CLIP v2 API ---
async function hueFetch(endpoint, actorId, options = {}) {
  const auth = getAuth(actorId);
  if (!auth || !auth.bridge_ip || !auth.username) throw new Error("Hue not connected. Use hue.auth to pair with your bridge first.");
  const url = `https://${auth.bridge_ip}/clip/v2${endpoint}`;
  const res = await fetch(url, { ...options, headers: { "hue-application-key": auth.username, "Content-Type": "application/json", ...(options.headers || {}) } });
  if (!res.ok) { const txt = await res.text().catch(() => ""); throw new Error(`Hue API ${res.status}: ${txt}`); }
  return res.json();
}

async function discoverBridge() {
  if (HUE_BRIDGE_IP) return HUE_BRIDGE_IP;
  try { const res = await fetch("https://discovery.meethue.com/"); const bridges = await res.json(); if (bridges.length > 0) return bridges[0].internalipaddress; } catch {}
  return null;
}

async function pairBridge(bridgeIp) {
  const res = await fetch(`https://${bridgeIp}/api`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ devicetype: "personal-assistant#ateam", generateclientkey: true }) });
  const data = await res.json();
  if (Array.isArray(data) && data[0]?.error) return { error: data[0].error.description };
  if (Array.isArray(data) && data[0]?.success) return { username: data[0].success.username, clientkey: data[0].success.clientkey };
  return { error: "Unexpected response from bridge" };
}

async function refreshDevices(actorId) {
  const [lightsRes, roomsRes] = await Promise.all([hueFetch("/resource/light", actorId), hueFetch("/resource/room", actorId)]);
  const rooms = {};
  for (const r of roomsRes.data || []) { for (const child of r.children || []) { rooms[child.rid] = r.metadata?.name || "Unknown Room"; } }
  const devicesRes = await hueFetch("/resource/device", actorId);
  const deviceRooms = {};
  for (const dev of devicesRes.data || []) { const rid = dev.id; if (rooms[rid]) deviceRooms[rid] = rooms[rid]; for (const svc of dev.services || []) { deviceRooms[svc.rid] = rooms[rid] || null; } }
  const devices = [];
  for (const light of lightsRes.data || []) {
    const id = light.id; const name = light.metadata?.name || "Unknown Light"; const room = deviceRooms[id] || deviceRooms[light.owner?.rid] || null;
    const caps = ["turn_on", "turn_off"]; if (light.dimming) caps.push("brightness"); if (light.color) caps.push("color"); if (light.color_temperature) caps.push("color_temp");
    db.prepare("INSERT OR REPLACE INTO devices(device_id, actor_id, device_type, friendly_name, room, capabilities_json, last_seen) VALUES(?,?,?,?,?,?,?)").run(id, actorId, "light", name, room, JSON.stringify(caps), now());
    const state = light.on?.on ? "on" : "off"; const attrs = {};
    if (light.dimming) attrs.brightness = Math.round(light.dimming.brightness);
    if (light.color_temperature?.mirek) attrs.color_temp_mirek = light.color_temperature.mirek;
    if (light.color?.xy) attrs.color_xy = light.color.xy;
    db.prepare("INSERT OR REPLACE INTO device_states(device_id, actor_id, state, attributes_json) VALUES(?,?,?,?)").run(id, actorId, state, JSON.stringify(attrs));
    devices.push({ id, type: "light", name, room, state, capabilities: caps, ...attrs });
  }
  return devices;
}

const TOOLS = [
  { name: "hue.auth",          description: "Discover Hue Bridge and start pairing. Press link button first.", inputSchema: { type: "object", properties: { bridge_ip: { type: "string" }, _adas_actor: { type: "string" } } } },
  { name: "hue.callback",      description: "Complete Hue Bridge pairing after link button press",             inputSchema: { type: "object", properties: { _adas_actor: { type: "string" } } } },
  { name: "hue.devices",       description: "List all Hue lights for the current user",                        inputSchema: { type: "object", properties: { refresh: { type: "boolean" }, _adas_actor: { type: "string" } } } },
  { name: "hue.state",         description: "Get current state of a Hue light",                               inputSchema: { type: "object", properties: { device_id: { type: "string" }, _adas_actor: { type: "string" } }, required: ["device_id"] } },
  { name: "hue.command",       description: "Control a Hue light: on, off, brightness, color_temp, color",    inputSchema: { type: "object", properties: { device_id: { type: "string" }, command: { type: "string" }, params: { type: "object" }, _adas_actor: { type: "string" } }, required: ["device_id", "command"] } },
  { name: "hue.scenes",        description: "List all Hue scenes for the current user",                        inputSchema: { type: "object", properties: { _adas_actor: { type: "string" } } } },
  { name: "hue.activate_scene",description: "Activate a Hue scene",                                           inputSchema: { type: "object", properties: { scene_id: { type: "string" }, _adas_actor: { type: "string" } }, required: ["scene_id"] } },
  { name: "hue.rooms",         description: "List all Hue rooms and lights for the current user",              inputSchema: { type: "object", properties: { _adas_actor: { type: "string" } } } },
  { name: "hue.status",        description: "Get Hue Bridge connection status for the current user",           inputSchema: { type: "object", properties: { _adas_actor: { type: "string" } } } },
];

async function callTool(name, args) {
  const actorId = getActorId(args);
  switch (name) {
    case "hue.auth": {
      const ip = args.bridge_ip || await discoverBridge();
      if (!ip) return { error: "Could not discover Hue Bridge. Provide bridge_ip manually." };
      const result = await pairBridge(ip);
      if (result.username) { saveAuth({ bridge_ip: ip, username: result.username, clientkey: result.clientkey }, actorId); const devices = await refreshDevices(actorId); return { connected: true, bridge_ip: ip, devices_found: devices.length, devices }; }
      return { bridge_ip: ip, action_required: "Press the link button on your Hue Bridge, then call hue.callback", note: "You have about 30 seconds." };
    }
    case "hue.callback": {
      const auth = getAuth(actorId); const ip = auth?.bridge_ip || args.bridge_ip || await discoverBridge();
      if (!ip) return { error: "No bridge IP known. Run hue.auth first." };
      const result = await pairBridge(ip);
      if (result.error) return { error: result.error, hint: "Press the link button and try again within 30 seconds." };
      saveAuth({ bridge_ip: ip, username: result.username, clientkey: result.clientkey }, actorId);
      const devices = await refreshDevices(actorId);
      return { connected: true, bridge_ip: ip, devices_found: devices.length, devices };
    }
    case "hue.devices": {
      const auth = getAuth(actorId); if (!auth) return { error: "Hue not connected. Use hue.auth first." };
      if (args.refresh !== false) { const devices = await refreshDevices(actorId); return { count: devices.length, devices }; }
      const rows = db.prepare("SELECT d.*, s.state, s.attributes_json FROM devices d LEFT JOIN device_states s ON d.device_id = s.device_id AND d.actor_id = s.actor_id WHERE d.actor_id = ?").all(actorId);
      return { count: rows.length, devices: rows.map(r => ({ id: r.device_id, type: r.device_type, name: r.friendly_name, room: r.room, state: r.state, capabilities: JSON.parse(r.capabilities_json || "[]"), ...JSON.parse(r.attributes_json || "{}") })) };
    }
    case "hue.state": {
      if (!args.device_id) throw new Error("device_id required");
      const res = await hueFetch(`/resource/light/${args.device_id}`, actorId);
      const light = res.data?.[0]; if (!light) throw new Error(`Light ${args.device_id} not found`);
      return { id: light.id, name: light.metadata?.name, on: light.on?.on, brightness: light.dimming ? Math.round(light.dimming.brightness) : null, color_temp_mirek: light.color_temperature?.mirek || null, color_xy: light.color?.xy || null };
    }
    case "hue.command": {
      if (!args.device_id || !args.command) throw new Error("device_id and command required");
      const payload = {};
      switch (args.command) {
        case "on": payload.on = { on: true }; break;
        case "off": payload.on = { on: false }; break;
        case "brightness": { const bri = args.params?.brightness ?? args.params?.value; if (bri == null) throw new Error("brightness required"); payload.on = { on: true }; payload.dimming = { brightness: Number(bri) }; break; }
        case "color_temp": { const mirek = args.params?.mirek ?? args.params?.value; if (mirek == null) throw new Error("mirek required"); payload.on = { on: true }; payload.color_temperature = { mirek: Number(mirek) }; break; }
        case "color": { const xy = args.params?.xy || args.params; if (!xy?.x || !xy?.y) throw new Error("color xy required"); payload.on = { on: true }; payload.color = { xy: { x: Number(xy.x), y: Number(xy.y) } }; break; }
        default: throw new Error(`Unknown command: ${args.command}`);
      }
      await hueFetch(`/resource/light/${args.device_id}`, actorId, { method: "PUT", body: JSON.stringify(payload) });
      return await callTool("hue.state", args);
    }
    case "hue.scenes": { const res = await hueFetch("/resource/scene", actorId); return (res.data || []).map(s => ({ id: s.id, name: s.metadata?.name, group: s.group?.rid, status: s.status?.active })); }
    case "hue.activate_scene": { if (!args.scene_id) throw new Error("scene_id required"); await hueFetch(`/resource/scene/${args.scene_id}`, actorId, { method: "PUT", body: JSON.stringify({ recall: { action: "active" } }) }); return { activated: true, scene_id: args.scene_id }; }
    case "hue.rooms": { const res = await hueFetch("/resource/room", actorId); return (res.data || []).map(r => ({ id: r.id, name: r.metadata?.name, lights_count: (r.children || []).filter(c => c.rtype === "device").length, device_ids: (r.children || []).filter(c => c.rtype === "device").map(c => c.rid) })); }
    case "hue.status": {
      const auth = getAuth(actorId); if (!auth) return { connected: false, message: "Not connected. Use hue.auth." };
      try { const res = await hueFetch("/resource/bridge", actorId); const bridge = res.data?.[0]; return { connected: true, bridge_ip: auth.bridge_ip, bridge_id: bridge?.id, model: bridge?.product_data?.model_id }; }
      catch (e) { return { connected: false, bridge_ip: auth.bridge_ip, error: e.message }; }
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
      if (method === "initialize") { writeResult(id, { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "hue-mcp", version: "1.1.0" } }); continue; }
      if (method === "notifications/initialized") continue;
      if (method === "tools/list") { writeResult(id, { tools: TOOLS }); continue; }
      if (method === "tools/call") { const result = await callTool(params.name, params.arguments || {}); writeResult(id, { content: [{ type: "text", text: JSON.stringify(result) }] }); continue; }
      writeError(id, `Unsupported method: ${method}`);
    } catch (err) { console.error(`[hue] Error:`, err.message); if (id != null) writeError(id, err.message); }
  }
});
console.error("[hue-mcp v1.1.0] Philips Hue connector started — multi-user actor-scoped");
