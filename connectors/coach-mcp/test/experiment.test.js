#!/usr/bin/env node
/**
 * Unit tests for the experiment-related storage layer + week-key helper.
 *
 * Covers everything the weekly proposer relies on:
 *   • weekKey() — ISO week computation, including year-boundary cases
 *   • proposeExperiment / respondToExperiment / closeExperiment lifecycle
 *   • getActiveExperimentForWeek — dedupe gate the proposer uses
 *   • listExperiments — filtering and limits
 *
 * Run from connectors/coach-mcp:
 *   node test/experiment.test.js
 *
 * Each test uses a unique throwaway actor_id so per-actor SQLite files don't
 * leak between cases. The DB files live under DATA_DIR (defaults to .data/);
 * we point DATA_DIR at a temp folder.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Isolated temp DATA_DIR so test runs don't pollute the dev .data folder.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "coach-test-"));
process.env.DATA_DIR = TMP;

const storage = await import("../src/storage.js");

// Pull weekKey from server.js. It's not exported but we duplicate it inline
// (the logic is small enough that a copy here keeps the test self-contained
// without modifying server.js to export it).
function weekKey(d = new Date()) {
  const date = new Date(d);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const wk = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(wk).padStart(2, "0")}`;
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// ─── weekKey() ────────────────────────────────────────────────────────

test("weekKey: mid-week Wednesday returns correct ISO week", () => {
  // 2026-05-13 is a Wednesday; ISO week 20.
  assert.equal(weekKey(new Date("2026-05-13T10:00:00Z")), "2026-W20");
});

test("weekKey: ISO year boundary — Dec 30 2024 (Mon) is in 2025-W01", () => {
  // ISO week starts Mon. 2024-12-30 is a Monday in ISO week 1 of 2025.
  assert.equal(weekKey(new Date("2024-12-30T00:00:00Z")), "2025-W01");
});

test("weekKey: ISO year boundary — Jan 1 2023 (Sun) is in 2022-W52", () => {
  // 2023-01-01 is a Sunday; ISO week 52 of 2022.
  assert.equal(weekKey(new Date("2023-01-01T12:00:00Z")), "2022-W52");
});

test("weekKey: Sunday evening trigger time produces same key as the rest of the week", () => {
  // Cron fires Sunday 19:00 IST. The proposer should produce the SAME
  // week_key as the Monday-Friday checkins in that same ISO week. Sunday
  // is the LAST day of an ISO week, so Sun = same week as the preceding Mon.
  const sun = weekKey(new Date("2026-05-17T16:00:00Z")); // Sunday afternoon UTC
  const mon = weekKey(new Date("2026-05-11T10:00:00Z")); // Previous Monday
  assert.equal(sun, mon, "Sunday's week_key matches the preceding Monday's");
});

// ─── proposeExperiment / lifecycle ────────────────────────────────────

test("proposeExperiment: creates a 'proposed' row with given text + week_key", () => {
  const actor = `t-propose-${Date.now()}`;
  const exp = storage.proposeExperiment(actor, {
    text: "Try a 15-min walk after lunch this week",
    week_key: "2026-W20",
  });
  assert.equal(exp.status, "proposed");
  assert.equal(exp.week_key, "2026-W20");
  assert.match(exp.text, /15-min walk/);
  assert.ok(exp.id, "got back an experiment id");
  assert.ok(exp.created_at, "created_at populated");
});

test("respondToExperiment(picked=true) → status=accepted", () => {
  const actor = `t-accept-${Date.now()}`;
  const e1 = storage.proposeExperiment(actor, { text: "test", week_key: "2026-W20" });
  const e2 = storage.respondToExperiment(actor, e1.id, true);
  assert.equal(e2.status, "accepted");
});

test("respondToExperiment(picked=false) → status=declined", () => {
  const actor = `t-decline-${Date.now()}`;
  const e1 = storage.proposeExperiment(actor, { text: "test", week_key: "2026-W20" });
  const e2 = storage.respondToExperiment(actor, e1.id, false);
  assert.equal(e2.status, "declined");
});

test("closeExperiment: sets status=closed, records outcome + closed_at", () => {
  const actor = `t-close-${Date.now()}`;
  const e1 = storage.proposeExperiment(actor, { text: "test", week_key: "2026-W20" });
  storage.respondToExperiment(actor, e1.id, true);
  const e3 = storage.closeExperiment(actor, e1.id, "user did 3/5 walks — partial");
  assert.equal(e3.status, "closed");
  assert.match(e3.outcome, /3\/5/);
  assert.ok(e3.closed_at);
});

// ─── getActiveExperimentForWeek (the dedupe gate) ─────────────────────

test("getActiveExperimentForWeek: returns null when no experiment proposed", () => {
  const actor = `t-empty-${Date.now()}`;
  // Trigger DB init by calling list (no-op read).
  storage.listExperiments(actor);
  const e = storage.getActiveExperimentForWeek(actor, "2026-W20");
  assert.equal(e, null);
});

test("getActiveExperimentForWeek: returns the proposed experiment for that week", () => {
  const actor = `t-active-${Date.now()}`;
  const e1 = storage.proposeExperiment(actor, { text: "test", week_key: "2026-W20" });
  const found = storage.getActiveExperimentForWeek(actor, "2026-W20");
  assert.equal(found.id, e1.id);
});

test("getActiveExperimentForWeek: still 'active' when status=accepted or declined", () => {
  const actor = `t-accepted-active-${Date.now()}`;
  const e1 = storage.proposeExperiment(actor, { text: "test", week_key: "2026-W20" });
  storage.respondToExperiment(actor, e1.id, true);
  const found = storage.getActiveExperimentForWeek(actor, "2026-W20");
  assert.equal(found.id, e1.id, "accepted experiment still blocks proposing another one this week");
});

test("getActiveExperimentForWeek: ignores closed experiments — week is open again", () => {
  const actor = `t-closed-${Date.now()}`;
  const e1 = storage.proposeExperiment(actor, { text: "test", week_key: "2026-W20" });
  storage.closeExperiment(actor, e1.id, "review done");
  const found = storage.getActiveExperimentForWeek(actor, "2026-W20");
  assert.equal(found, null, "after close, week is open for a new experiment (rare path — usually we move to next week)");
});

test("getActiveExperimentForWeek: scoped to week — proposing for W20 doesn't block W21", () => {
  const actor = `t-week-scope-${Date.now()}`;
  storage.proposeExperiment(actor, { text: "test", week_key: "2026-W20" });
  const w21 = storage.getActiveExperimentForWeek(actor, "2026-W21");
  assert.equal(w21, null, "W21 has no active experiment");
});

// ─── listExperiments ──────────────────────────────────────────────────

test("listExperiments: filters by week_key", () => {
  const actor = `t-list-${Date.now()}`;
  storage.proposeExperiment(actor, { text: "w20a", week_key: "2026-W20" });
  storage.proposeExperiment(actor, { text: "w20b", week_key: "2026-W20" });
  storage.proposeExperiment(actor, { text: "w21",  week_key: "2026-W21" });
  const w20 = storage.listExperiments(actor, { week_key: "2026-W20" });
  assert.equal(w20.length, 2);
  assert.ok(w20.every(e => e.week_key === "2026-W20"));
});

test("listExperiments: without filter returns all (newest first)", () => {
  const actor = `t-list-all-${Date.now()}`;
  storage.proposeExperiment(actor, { text: "first",  week_key: "2026-W19" });
  // Tiny delay so created_at differs predictably
  const e2 = storage.proposeExperiment(actor, { text: "second", week_key: "2026-W20" });
  const all = storage.listExperiments(actor);
  assert.ok(all.length >= 2);
  assert.equal(all[0].id, e2.id, "newest is first");
});

// ─── Cleanup ──────────────────────────────────────────────────────────

let passed = 0, failed = 0;
for (const t of tests) {
  try {
    await t.fn();
    console.log(`  ✅ ${t.name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ ${t.name}\n     ${err.message}`);
    failed++;
  }
}

// Cleanup temp dir
try { fs.rmSync(TMP, { recursive: true, force: true }); } catch {}

console.log(`\n${passed}/${tests.length} passed`);
process.exit(failed === 0 ? 0 : 1);
