// src/storage.js — coach-mcp persistence (node:sqlite built-in)
//
// PER-ACTOR DATABASE: each actor gets its own coach-<actor>.db file.
// Stronger isolation than a single DB with actor_id columns:
//   - No risk of cross-actor leak from a missing WHERE clause
//   - Easy per-user delete/export (just rm the file)
//   - Smaller files = faster queries on time-series data (checkins, nudges)
//
// Tables (per-actor file): state, goals, checkins, nudges, observations, experiments
// No actor_id column — the file IS the isolation.

import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), '.data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    phase TEXT NOT NULL DEFAULT 'onboarding',
    joined_at TEXT NOT NULL,
    trust_budget INTEGER NOT NULL DEFAULT 50,
    check_in_window_json TEXT DEFAULT '{"am":"07:30","pm":"21:30","tz":"local"}',
    off_limits_json TEXT DEFAULT '[]',
    tone TEXT DEFAULT 'warm',
    onboarding_answers_json TEXT DEFAULT '{}',
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY,
    version INTEGER NOT NULL,
    text TEXT NOT NULL,
    type TEXT,
    target_value REAL,
    target_unit TEXT,
    deadline TEXT,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    superseded_at TEXT
  );

  CREATE TABLE IF NOT EXISTS checkins (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    period TEXT NOT NULL,
    rating INTEGER,
    mood_word TEXT,
    free_text TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS nudges (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    text TEXT NOT NULL,
    context_json TEXT,
    sent_at TEXT NOT NULL,
    response TEXT,
    responded_at TEXT
  );

  CREATE TABLE IF NOT EXISTS observations (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    evidence_json TEXT,
    confidence REAL DEFAULT 0.5,
    status TEXT DEFAULT 'pending',
    surfaced_at TEXT,
    confirmed_at TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS experiments (
    id TEXT PRIMARY KEY,
    week_key TEXT NOT NULL,
    text TEXT NOT NULL,
    status TEXT DEFAULT 'proposed',
    outcome TEXT,
    created_at TEXT NOT NULL,
    closed_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_goals_version ON goals(version DESC);
  CREATE INDEX IF NOT EXISTS idx_checkins_date ON checkins(date);
  CREATE INDEX IF NOT EXISTS idx_nudges_sent ON nudges(sent_at);
  CREATE INDEX IF NOT EXISTS idx_obs_status ON observations(status);
  CREATE INDEX IF NOT EXISTS idx_exp_week ON experiments(week_key);
`;

// ── Per-actor DB cache ────────────────────────────────────────────────

const dbCache = new Map();

function sanitizeActorId(id) {
  // Defense in depth: actor_id comes from a trusted system field, but never
  // trust strings used in filesystem paths. Allow URL-safe chars only,
  // truncate to a reasonable length.
  const safe = String(id).replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 120);
  if (!safe) throw new Error('actor_id missing or invalid');
  return safe;
}

function getDb(actorId) {
  const safe = sanitizeActorId(actorId);
  let db = dbCache.get(safe);
  if (db) return db;
  db = new DatabaseSync(path.join(DATA_DIR, `coach-${safe}.db`));
  db.exec(SCHEMA);
  dbCache.set(safe, db);
  return db;
}

const nowISO = () => new Date().toISOString();
const today = () => nowISO().slice(0, 10);
const jp = (s, fb) => { try { return JSON.parse(s); } catch { return fb; } };

// ── STATE ─────────────────────────────────────────────────────────────

export function getState(actor_id) {
  const db = getDb(actor_id);
  const row = db.prepare(`SELECT * FROM state WHERE id = 1`).get();
  if (!row) return null;
  return {
    actor_id,
    phase: row.phase,
    joined_at: row.joined_at,
    trust_budget: row.trust_budget,
    check_in_window: jp(row.check_in_window_json, {}),
    off_limits: jp(row.off_limits_json, []),
    tone: row.tone,
    onboarding_answers: jp(row.onboarding_answers_json, {}),
    updated_at: row.updated_at,
    days_since_join: Math.floor((Date.now() - new Date(row.joined_at).getTime()) / 86400000),
  };
}

export function initState(actor_id, { check_in_window, off_limits, tone, onboarding_answers } = {}) {
  const db = getDb(actor_id);
  const existing = db.prepare(`SELECT id FROM state WHERE id = 1`).get();
  if (existing) return getState(actor_id);
  const now = nowISO();
  db.prepare(`
    INSERT INTO state (id, phase, joined_at, trust_budget, check_in_window_json, off_limits_json, tone, onboarding_answers_json, updated_at)
    VALUES (1, 'onboarding', ?, 50, ?, ?, ?, ?, ?)
  `).run(
    now,
    JSON.stringify(check_in_window || { am: '07:30', pm: '21:30', tz: 'local' }),
    JSON.stringify(off_limits || []),
    tone || 'warm',
    JSON.stringify(onboarding_answers || {}),
    now,
  );
  return getState(actor_id);
}

export function updateState(actor_id, patch) {
  const db = getDb(actor_id);
  const cur = getState(actor_id);
  if (!cur) return null;
  const next = {
    phase: patch.phase ?? cur.phase,
    trust_budget: patch.trust_budget ?? cur.trust_budget,
    check_in_window: patch.check_in_window ?? cur.check_in_window,
    off_limits: patch.off_limits ?? cur.off_limits,
    tone: patch.tone ?? cur.tone,
    onboarding_answers: patch.onboarding_answers ?? cur.onboarding_answers,
  };
  db.prepare(`
    UPDATE state SET phase=?, trust_budget=?, check_in_window_json=?, off_limits_json=?, tone=?, onboarding_answers_json=?, updated_at=?
    WHERE id = 1
  `).run(
    next.phase,
    Math.max(0, Math.min(100, next.trust_budget)),
    JSON.stringify(next.check_in_window),
    JSON.stringify(next.off_limits),
    next.tone,
    JSON.stringify(next.onboarding_answers),
    nowISO(),
  );
  return getState(actor_id);
}

const PHASE_ORDER = ['onboarding', 'observing', 'calibrating', 'accompanying'];

export function advancePhase(actor_id) {
  const s = getState(actor_id);
  if (!s) return null;
  const i = PHASE_ORDER.indexOf(s.phase);
  if (i < 0 || i >= PHASE_ORDER.length - 1) return s;
  return updateState(actor_id, { phase: PHASE_ORDER[i + 1] });
}

// ── GOALS ─────────────────────────────────────────────────────────────

export function listGoals(actor_id) {
  return getDb(actor_id).prepare(`SELECT * FROM goals ORDER BY version DESC`).all();
}

export function currentGoal(actor_id) {
  return getDb(actor_id).prepare(`SELECT * FROM goals WHERE status = 'active' ORDER BY version DESC LIMIT 1`).get() || null;
}

export function addGoal(actor_id, { text, type, target_value, target_unit, deadline, reason }) {
  const db = getDb(actor_id);
  const cur = currentGoal(actor_id);
  const now = nowISO();
  if (cur) {
    db.prepare(`UPDATE goals SET status='superseded', superseded_at=? WHERE id=?`).run(now, cur.id);
  }
  const id = randomUUID();
  const version = (cur?.version || 0) + 1;
  db.prepare(`
    INSERT INTO goals (id, version, text, type, target_value, target_unit, deadline, reason, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
  `).run(id, version, text, type || null, target_value ?? null, target_unit || null, deadline || null, reason || null, now);
  return db.prepare(`SELECT * FROM goals WHERE id = ?`).get(id);
}

// ── CHECK-INS ─────────────────────────────────────────────────────────

export function logCheckin(actor_id, { period, rating, mood_word, free_text, date }) {
  const db = getDb(actor_id);
  const id = randomUUID();
  const now = nowISO();
  const d = date || today();
  db.prepare(`
    INSERT INTO checkins (id, date, period, rating, mood_word, free_text, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, d, period, rating ?? null, mood_word || null, free_text || null, now);
  return db.prepare(`SELECT * FROM checkins WHERE id = ?`).get(id);
}

export function recentCheckins(actor_id, days = 7) {
  const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  return getDb(actor_id).prepare(`
    SELECT * FROM checkins WHERE date >= ? ORDER BY date DESC, period DESC
  `).all(cutoff);
}

export function todayCheckin(actor_id, period) {
  return getDb(actor_id).prepare(`SELECT * FROM checkins WHERE date = ? AND period = ? ORDER BY created_at DESC LIMIT 1`).get(today(), period) || null;
}

// ── NUDGES ────────────────────────────────────────────────────────────

export function logNudge(actor_id, { kind, text, context }) {
  const db = getDb(actor_id);
  const id = randomUUID();
  db.prepare(`
    INSERT INTO nudges (id, kind, text, context_json, sent_at) VALUES (?, ?, ?, ?, ?)
  `).run(id, kind, text, JSON.stringify(context || {}), nowISO());
  return db.prepare(`SELECT * FROM nudges WHERE id = ?`).get(id);
}

export function respondToNudge(actor_id, id, response) {
  const db = getDb(actor_id);
  const allowed = ['accepted', 'dismissed', 'acknowledged', 'ignored'];
  if (!allowed.includes(response)) throw new Error(`response must be one of ${allowed.join(', ')}`);
  db.prepare(`UPDATE nudges SET response=?, responded_at=? WHERE id=?`).run(response, nowISO(), id);
  const cur = getState(actor_id);
  if (cur) {
    const delta = response === 'accepted' ? 3 : response === 'acknowledged' ? 1 : response === 'dismissed' ? -2 : 0;
    updateState(actor_id, { trust_budget: cur.trust_budget + delta });
  }
  return db.prepare(`SELECT * FROM nudges WHERE id = ?`).get(id);
}

export function recentNudges(actor_id, days = 7) {
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();
  return getDb(actor_id).prepare(`SELECT * FROM nudges WHERE sent_at >= ? ORDER BY sent_at DESC`).all(cutoff);
}

export function nudgeEngagementStats(actor_id, days = 14) {
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();
  const rows = getDb(actor_id).prepare(`SELECT response, COUNT(*) as n FROM nudges WHERE sent_at >= ? GROUP BY response`).all(cutoff);
  const stats = { accepted: 0, dismissed: 0, acknowledged: 0, ignored: 0, no_response: 0, total: 0 };
  for (const r of rows) {
    const key = r.response || 'no_response';
    stats[key] = r.n;
    stats.total += r.n;
  }
  return stats;
}

// ── OBSERVATIONS ──────────────────────────────────────────────────────

export function addObservation(actor_id, { text, evidence, confidence }) {
  const db = getDb(actor_id);
  const id = randomUUID();
  db.prepare(`
    INSERT INTO observations (id, text, evidence_json, confidence, status, created_at)
    VALUES (?, ?, ?, ?, 'pending', ?)
  `).run(id, text, JSON.stringify(evidence || {}), confidence ?? 0.5, nowISO());
  return db.prepare(`SELECT * FROM observations WHERE id = ?`).get(id);
}

// Find an existing pending/surfaced observation with the given pattern_key
// (stored in evidence_json). Used by the miner to dedupe.
export function findObservationByPatternKey(actor_id, pattern_key) {
  const rows = getDb(actor_id)
    .prepare(`SELECT * FROM observations WHERE status IN ('pending', 'surfaced') ORDER BY created_at DESC`)
    .all();
  for (const r of rows) {
    try {
      const ev = JSON.parse(r.evidence_json || '{}');
      if (ev.pattern_key === pattern_key) return r;
    } catch {}
  }
  return null;
}

// Upsert: only insert if no pending/surfaced observation with same pattern_key exists.
// Returns { observation, action: 'created' | 'skipped_duplicate' }
export function upsertObservation(actor_id, { text, evidence, confidence }) {
  const key = evidence?.pattern_key;
  if (key) {
    const existing = findObservationByPatternKey(actor_id, key);
    if (existing) return { observation: existing, action: 'skipped_duplicate' };
  }
  const obs = addObservation(actor_id, { text, evidence, confidence });
  return { observation: obs, action: 'created' };
}

export function pendingObservations(actor_id) {
  return getDb(actor_id).prepare(`SELECT * FROM observations WHERE status IN ('pending', 'surfaced') ORDER BY confidence DESC, created_at DESC`).all();
}

export function markObservationSurfaced(actor_id, id) {
  const db = getDb(actor_id);
  db.prepare(`UPDATE observations SET status='surfaced', surfaced_at=? WHERE id=?`).run(nowISO(), id);
  return db.prepare(`SELECT * FROM observations WHERE id=?`).get(id);
}

export function confirmObservation(actor_id, id, confirmed) {
  const db = getDb(actor_id);
  const status = confirmed ? 'confirmed' : 'disconfirmed';
  db.prepare(`UPDATE observations SET status=?, confirmed_at=? WHERE id=?`).run(status, nowISO(), id);
  return db.prepare(`SELECT * FROM observations WHERE id=?`).get(id);
}

// ── EXPERIMENTS ───────────────────────────────────────────────────────

export function proposeExperiment(actor_id, { text, week_key }) {
  const db = getDb(actor_id);
  const id = randomUUID();
  db.prepare(`
    INSERT INTO experiments (id, week_key, text, status, created_at)
    VALUES (?, ?, ?, 'proposed', ?)
  `).run(id, week_key, text, nowISO());
  return db.prepare(`SELECT * FROM experiments WHERE id = ?`).get(id);
}

export function respondToExperiment(actor_id, id, picked) {
  const db = getDb(actor_id);
  const status = picked ? 'accepted' : 'declined';
  db.prepare(`UPDATE experiments SET status=? WHERE id=?`).run(status, id);
  return db.prepare(`SELECT * FROM experiments WHERE id=?`).get(id);
}

export function closeExperiment(actor_id, id, outcome) {
  const db = getDb(actor_id);
  db.prepare(`UPDATE experiments SET status='closed', outcome=?, closed_at=? WHERE id=?`).run(outcome || null, nowISO(), id);
  return db.prepare(`SELECT * FROM experiments WHERE id=?`).get(id);
}

export function listExperiments(actor_id, { week_key } = {}) {
  const db = getDb(actor_id);
  if (week_key) return db.prepare(`SELECT * FROM experiments WHERE week_key = ? ORDER BY created_at DESC`).all(week_key);
  return db.prepare(`SELECT * FROM experiments ORDER BY created_at DESC LIMIT 50`).all();
}
