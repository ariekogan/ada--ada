// src/coreClient.js — reach actorStore (per-(actor,"nutrition") SQLite) through
// Core's MCP tools. Pattern copied from the platform's docs-index-mcp coreClient:
// raw fetch to Core /mcp, auth via the tenant-scoped connector PAT (pins tenant
// server-side), one fresh MCP session per call. actorStore.* is a registered
// Core tool, so any connector can call it this way.
//
// Env (all injected into the connector sandbox at spawn):
//   CORE_MCP_URL        — default http://backend:4000/mcp
//   ADAS_CONNECTOR_PAT  — tenant-scoped PAT (preferred; Bearer)
//   ADAS_MCP_TOKEN      — shared-secret fallback (x-adas-token)
import { randomUUID } from "crypto";

const CORE_MCP_URL = process.env.CORE_MCP_URL || "http://backend:4000/mcp";
const ADAS_CONNECTOR_PAT = process.env.ADAS_CONNECTOR_PAT || "";
const ADAS_MCP_TOKEN = process.env.ADAS_MCP_TOKEN || "";
const SKILL = "nutrition"; // the (actor, SKILL) namespace this connector owns

function authHeaders() {
  if (ADAS_CONNECTOR_PAT) return { authorization: `Bearer ${ADAS_CONNECTOR_PAT}` };
  if (ADAS_MCP_TOKEN) return { "x-adas-token": ADAS_MCP_TOKEN, "x-adas-service": "nutrition-mcp" };
  return {};
}

async function initSession(actorId) {
  const headers = {
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream",
    "X-ADAS-ACTOR": actorId || "",
    ...authHeaders(),
  };
  const resp = await fetch(CORE_MCP_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0", id: "1", method: "initialize",
      params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "nutrition-mcp", version: "1.0.0" } },
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!resp.ok) throw new Error(`Core initialize → ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  const sessionId = resp.headers.get("mcp-session-id") || randomUUID();
  await fetch(CORE_MCP_URL, {
    method: "POST",
    headers: { ...headers, "Mcp-Session-Id": sessionId },
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    signal: AbortSignal.timeout(5000),
  }).catch(() => {});
  return { sessionId, headers };
}

async function callTool(actorId, tool, args) {
  const { sessionId, headers } = await initSession(actorId);
  const resp = await fetch(CORE_MCP_URL, {
    method: "POST",
    headers: { ...headers, "Mcp-Session-Id": sessionId },
    body: JSON.stringify({
      jsonrpc: "2.0", id: "2", method: "tools/call",
      params: { name: tool, arguments: { ...args, _adas_actor: actorId, _adas_skill: SKILL } },
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!resp.ok) throw new Error(`Core ${tool} → ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  const text = await resp.text();
  const jsonLine = text.includes("data:")
    ? text.split(/\r?\n/).find((l) => l.startsWith("data:"))?.slice(5).trim()
    : text;
  let payload;
  try {
    const parsed = JSON.parse(jsonLine || text);
    const inner = parsed?.result?.content?.[0]?.text;
    payload = inner ? JSON.parse(inner) : parsed?.result;
  } catch { payload = null; }
  if (payload && payload.ok === false) throw new Error(`actorStore ${tool}: ${payload.error || "failed"}`);
  return payload || {};
}

/** Run a write/DDL against this actor's nutrition store. */
export async function exec(actorId, sql, params = []) {
  return callTool(actorId, "actorStore.exec", { sql, params });
}

/** Run a read; returns rows[]. */
export async function query(actorId, sql, params = []) {
  const r = await callTool(actorId, "actorStore.query", { sql, params });
  return Array.isArray(r?.rows) ? r.rows : [];
}
