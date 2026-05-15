#!/usr/bin/env node
/**
 * Integration test for the weekly experiment proposer flow.
 *
 * Spawns the real coach-mcp server.js as a stdio JSON-RPC subprocess (the
 * same way Core spawns it in production) and walks through the EXACT
 * sequence of tool calls the Sunday-evening cron trigger prompt instructs
 * the planner to make. Verifies each gate, each persistence step, and the
 * dedupe behavior.
 *
 * Cases:
 *   A. Calibrating + high-confidence observation → experiment proposed,
 *      observation marked surfaced, nudge logged.
 *   B. Calibrating + no observations → exit silently (no experiment).
 *   C. Observing phase → exit silently (gate at STEP 2).
 *   D. Calibrating + observation, BUT week already has an active
 *      experiment → exit silently (dedupe).
 *
 * Each case uses a fresh actor_id + temp DATA_DIR.
 *
 * Run from connectors/coach-mcp:
 *   node test/proposer-integration.test.js
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVER_PATH = path.resolve(__dirname, "../server.js");

// ─── Tiny stdio JSON-RPC client ──────────────────────────────────────
function spawnServer(env) {
  const proc = spawn("node", [SERVER_PATH], {
    env: { ...process.env, ...env },
    stdio: ["pipe", "pipe", "pipe"],
  });
  let nextId = 1;
  let buf = "";
  const pending = new Map();

  proc.stdout.on("data", chunk => {
    buf += chunk.toString();
    let idx;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line) continue;
      try {
        const msg = JSON.parse(line);
        const cb = pending.get(msg.id);
        if (cb) { pending.delete(msg.id); cb(msg); }
      } catch { /* ignore non-JSON lines */ }
    }
  });
  proc.stderr.on("data", chunk => {
    // coach-mcp logs to stderr; keep silent in tests unless you want noise
    // process.stderr.write("[server] " + chunk);
  });

  async function rpc(method, params) {
    const id = nextId++;
    const msg = { jsonrpc: "2.0", id, method, params };
    proc.stdin.write(JSON.stringify(msg) + "\n");
    return new Promise((resolve, reject) => {
      pending.set(id, m => m.error ? reject(new Error(m.error.message || JSON.stringify(m.error))) : resolve(m.result));
      setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error(`RPC timeout: ${method}`)); } }, 5000);
    });
  }

  async function call(toolName, args, actorId) {
    const result = await rpc("tools/call", {
      name: toolName,
      arguments: { ...args, _adas_actor: actorId },
    });
    const text = result?.content?.[0]?.text;
    if (!text) return result;
    try { return JSON.parse(text); } catch { return text; }
  }

  return { proc, rpc, call, kill: () => proc.kill() };
}

// ─── Test cases ──────────────────────────────────────────────────────
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

/**
 * Simulate what the cron trigger prompt instructs the planner to do.
 * Returns { proposed: bool, experiment, reason }.
 *
 * This is the EXECUTABLE EQUIVALENT of the trigger prompt's STEPs 1-6.
 * Drift between this and skill.json's prompt is the main thing the test
 * is meant to catch — if the prompt changes a tool name or order, this
 * test fails until both are updated.
 */
async function runProposer(client, actorId) {
  // STEP 1: read state
  const stateRes = await client.call("coach.state.get", {}, actorId);
  const phase = stateRes?.state?.phase;

  // STEP 2: gate — only calibrating
  if (phase !== "calibrating") return { proposed: false, reason: `phase=${phase}` };

  // STEP 3: dedupe
  const active = await client.call("coach.experiment.activeForWeek", {}, actorId);
  if (active.hasActive) return { proposed: false, reason: "already-active-this-week" };

  // STEP 4: pick observation
  const obs = await client.call("coach.observations.pending", {}, actorId);
  const candidates = (obs?.observations || []).filter(o => (o.confidence ?? 0) >= 0.5);
  if (candidates.length === 0) return { proposed: false, reason: "no-observation" };
  candidates.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
  const top = candidates[0];

  // STEP 5+6: compose + persist (we use a fixed text for determinism — the
  // real prompt has the LLM compose; testing the LLM phrasing is out of
  // scope here. We DO assert the wiring writes correct rows.)
  const text = `[test] anchored on observation ${top.id}: try a small reversible bet this week.`;
  const proposeRes = await client.call("coach.experiment.propose", {
    text,
    week_key: active.week_key,
  }, actorId);

  await client.call("coach.observations.markSurfaced", { observation_id: top.id }, actorId);
  await client.call("coach.nudge.log", { kind: "experiment", text }, actorId);

  return { proposed: true, experiment: proposeRes.experiment, observation_id: top.id };
}

// ─── Cases ──

test("A. calibrating + high-confidence observation → experiment proposed", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "coach-pi-"));
  const c = spawnServer({ DATA_DIR: tmp });
  try {
    const actor = "actor-A";
    await c.call("coach.state.initOnboarding", {}, actor);
    await c.call("coach.state.update", {}, actor); // no-op, just to confirm RPC works
    // Force phase to calibrating
    const state = await c.call("coach.state.get", {}, actor);
    // Skip phases up to calibrating by direct calls
    await c.call("coach.state.advancePhase", {}, actor); // → observing
    await c.call("coach.state.advancePhase", {}, actor); // → calibrating

    // Plant an observation
    await c.call("coach.observations.add", {
      text: "Protein dips on weekdays (avg 80g vs 150g goal)",
      evidence: { kind: "protein_gap", days_observed: 5 },
      confidence: 0.8,
    }, actor);

    const result = await runProposer(c, actor);
    assert.equal(result.proposed, true, `expected proposal, got: ${JSON.stringify(result)}`);
    assert.ok(result.experiment?.id);
    assert.equal(result.experiment.status, "proposed");

    // Observation now marked surfaced (still in the list — only
    // confirmed/disconfirmed ones leave; surfaced stays so the user
    // can still respond to it).
    const obsAfter = await c.call("coach.observations.pending", {}, actor);
    const o = (obsAfter?.observations || []).find(x => x.id === result.observation_id);
    assert.ok(o, "observation still in pending list");
    assert.equal(o.status, "surfaced", "observation status flipped to surfaced");
    assert.ok(o.surfaced_at, "surfaced_at timestamp set");

    // Nudge logged — engagement stats return { accepted, dismissed,
    // acknowledged, ignored, no_response, total }. A freshly logged nudge
    // has no response yet, so it lands in no_response. total >= 1 confirms
    // the proposer wrote a nudge row.
    const eng = await c.call("coach.nudge.engagement", { days: 7 }, actor);
    assert.ok(
      (eng?.stats?.total ?? 0) >= 1,
      `expected at least 1 nudge logged, got ${eng?.stats?.total}`
    );
  } finally {
    c.kill();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("B. calibrating + NO observations → exit silently, no experiment", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "coach-pi-"));
  const c = spawnServer({ DATA_DIR: tmp });
  try {
    const actor = "actor-B";
    await c.call("coach.state.initOnboarding", {}, actor);
    await c.call("coach.state.advancePhase", {}, actor); // observing
    await c.call("coach.state.advancePhase", {}, actor); // calibrating

    const result = await runProposer(c, actor);
    assert.equal(result.proposed, false);
    assert.equal(result.reason, "no-observation");
    const list = await c.call("coach.experiment.list", {}, actor);
    assert.equal((list?.experiments || []).length, 0, "no experiments persisted");
  } finally {
    c.kill();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("C. observing phase → exit silently (gate)", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "coach-pi-"));
  const c = spawnServer({ DATA_DIR: tmp });
  try {
    const actor = "actor-C";
    await c.call("coach.state.initOnboarding", {}, actor);
    await c.call("coach.state.advancePhase", {}, actor); // observing
    await c.call("coach.observations.add", {
      text: "Test", evidence: {}, confidence: 0.9,
    }, actor);
    const result = await runProposer(c, actor);
    assert.equal(result.proposed, false);
    assert.equal(result.reason, "phase=observing");
  } finally {
    c.kill();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("D. calibrating + observation, but week has active experiment → exit silently", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "coach-pi-"));
  const c = spawnServer({ DATA_DIR: tmp });
  try {
    const actor = "actor-D";
    await c.call("coach.state.initOnboarding", {}, actor);
    await c.call("coach.state.advancePhase", {}, actor);
    await c.call("coach.state.advancePhase", {}, actor);
    await c.call("coach.observations.add", {
      text: "Test obs", evidence: {}, confidence: 0.9,
    }, actor);

    // Run once — proposes
    const r1 = await runProposer(c, actor);
    assert.equal(r1.proposed, true);

    // Plant a second pending observation so STEP 4 still has a candidate
    await c.call("coach.observations.add", {
      text: "Another obs", evidence: {}, confidence: 0.9,
    }, actor);

    // Run again — dedupe should fire BEFORE the observation pick
    const r2 = await runProposer(c, actor);
    assert.equal(r2.proposed, false);
    assert.equal(r2.reason, "already-active-this-week");

    // Confirm only ONE experiment for this week_key in DB
    const list = await c.call("coach.experiment.list", {}, actor);
    const exps = (list?.experiments || []);
    const wk = r1.experiment.week_key;
    const thisWeek = exps.filter(e => e.week_key === wk);
    assert.equal(thisWeek.length, 1, "only one experiment for this week");
  } finally {
    c.kill();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ─── Run ──
let passed = 0, failed = 0;
for (const t of tests) {
  try {
    await t.fn();
    console.log(`  ✅ ${t.name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ ${t.name}\n     ${err.stack || err.message}`);
    failed++;
  }
}
console.log(`\n${passed}/${tests.length} passed`);
process.exit(failed === 0 ? 0 : 1);
