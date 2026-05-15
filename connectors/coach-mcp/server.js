#!/usr/bin/env node
/**
 * coach-mcp — Personal AI Coach intelligence layer (stdio JSON-RPC 2.0)
 *
 * Storage: node:sqlite (DatabaseSync) — zero npm dependencies.
 * Owns: state machine, goals (versioned), check-ins, nudges (with engagement),
 *       observations, experiments. The mycoach skill orchestrates reads
 *       from nutrition-mcp + mobile-device-mcp and passes data into snapshot.
 *
 * Phase progression: onboarding → observing → calibrating → accompanying.
 * Trust budget is the meter that gates how proactive the coach can be.
 */

import * as s from './src/storage.js';

const PROTOCOL_VERSION = '2024-11-05';

function getActorId(args) {
  const id = args?._adas_actor;
  if (!id) throw new Error('coach-mcp: no actor context — _adas_actor missing.');
  return id;
}

const ok = (id, result) => ({ jsonrpc: '2.0', id, result });
const err = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });
const toText = (data) => ({ content: [{ type: 'text', text: JSON.stringify(data) }] });

// ── UI plugin manifest ───────────────────────────────────────────────

const PLUGINS = [
  {
    id: 'coach-dashboard',
    name: 'MyCoach',
    version: '1.0.2',
    description: 'Phase, goal, today\'s snapshot (calories/protein/steps rings), gaps, recent check-ins, pending observations',
    // surface = how the mobile host should present this plugin. Without a
    // surface block the host falls back to the legacy "render inline behind
    // the chat input" path, which is what caused the wizard / dashboard to
    // appear stuck under the "Ask Ada anything…" bar after the migration.
    surface: {
      type: 'drawer',
      visibility: 'user',
      icon: '🎯',
      title: 'MyCoach',
      subtitle: 'Today\'s snapshot, goals, observations',
    },
  },
  {
    id: 'coach-onboarding',
    name: 'Coach Onboarding',
    version: '1.0.3',
    description: 'Guided 5-question wizard to onboard a new user into MyCoach',
    // fullscreen so the wizard's text fields aren't overlapped by the host
    // chat-input bar (the original bug). fullscreen takes the whole screen
    // and the host hides its chat composer while the surface is mounted.
    surface: {
      type: 'fullscreen',
      visibility: 'user',
      icon: '✨',
      title: 'Welcome to MyCoach',
      subtitle: 'Quick 5-question setup',
    },
  },
];

// ── Snapshot / gap analysis (pure functions over passed-in data) ──────

function todayStr() { return new Date().toISOString().slice(0, 10); }
function weekKey(d = new Date()) {
  const date = new Date(d);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const wk = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(wk).padStart(2, '0')}`;
}

function computeGaps({ nutrition, activity, goals }) {
  const gaps = [];
  if (nutrition?.goals && nutrition?.totals) {
    const g = nutrition.goals; const t = nutrition.totals;
    if (g.protein && t.protein < g.protein) gaps.push({ metric: 'protein', target: g.protein, current: t.protein, delta: g.protein - t.protein, unit: 'g', priority: 1 });
    if (g.water_ml && nutrition.hydration?.water_ml < g.water_ml) gaps.push({ metric: 'water', target: g.water_ml, current: nutrition.hydration.water_ml, delta: g.water_ml - nutrition.hydration.water_ml, unit: 'ml', priority: 2 });
    if (g.calories && t.calories > g.calories) gaps.push({ metric: 'calories_over', target: g.calories, current: t.calories, delta: t.calories - g.calories, unit: 'kcal', priority: 1 });
  }
  if (activity?.steps != null) {
    const stepGoal = goals?.daily_steps || 8000;
    if (activity.steps < stepGoal) gaps.push({ metric: 'steps', target: stepGoal, current: activity.steps, delta: stepGoal - activity.steps, unit: 'steps', priority: 2 });
  }
  return gaps.sort((a, b) => a.priority - b.priority);
}

function computeAdherence({ nutrition, activity, goals }) {
  let score = 0; let weight = 0;
  if (nutrition?.goals?.calories && nutrition?.totals?.calories != null) {
    const ratio = Math.min(nutrition.totals.calories / nutrition.goals.calories, 1.5);
    const sub = ratio <= 1 ? 100 * ratio : Math.max(0, 100 - (ratio - 1) * 200);
    score += sub * 0.3; weight += 0.3;
  }
  if (nutrition?.goals?.protein && nutrition?.totals?.protein != null) {
    score += Math.min(100, (nutrition.totals.protein / nutrition.goals.protein) * 100) * 0.3; weight += 0.3;
  }
  if (activity?.steps != null) {
    const stepGoal = goals?.daily_steps || 8000;
    score += Math.min(100, (activity.steps / stepGoal) * 100) * 0.4; weight += 0.4;
  }
  if (weight === 0) return null;
  return Math.round(score / weight);
}

// ── Pattern miner heuristics ─────────────────────────────────────────
//
// Pure functions that scan recent data and emit observation candidates.
// Each returns null (no signal) or { text, evidence, confidence } where
// evidence.pattern_key is the dedup key.

const TIRED_WORDS = ['tired', 'exhausted', 'sleepy', 'wiped', 'drained', 'fatigued', 'low'];
const STRESSED_WORDS = ['stressed', 'anxious', 'overwhelmed', 'tense', 'burnt', 'burned'];

function avgMorningMood(checkins) {
  const ams = checkins.filter(c => c.period === 'am' && c.rating != null).slice(0, 7);
  if (ams.length < 4) return null;
  const avg = ams.reduce((a, c) => a + c.rating, 0) / ams.length;
  if (avg >= 5.5) return null;
  return {
    text: `Your mornings have been rough — average ${avg.toFixed(1)}/10 over the last ${ams.length} days.`,
    evidence: { pattern_key: 'low_morning_mood_7d', avg, count: ams.length },
    confidence: Math.min(1, 0.4 + ams.length * 0.1),
  };
}

function tiredWordFrequency(checkins) {
  const recent = checkins.slice(0, 14);
  let count = 0;
  for (const c of recent) {
    const word = (c.mood_word || '').toLowerCase();
    if (TIRED_WORDS.some(w => word.includes(w))) count++;
  }
  if (count < 3) return null;
  return {
    text: `You've mentioned feeling tired ${count} times in the last 2 weeks — comes up often.`,
    evidence: { pattern_key: 'tired_word_frequent_14d', count },
    confidence: Math.min(1, 0.4 + count * 0.1),
  };
}

function stressWordFrequency(checkins) {
  const recent = checkins.slice(0, 14);
  let count = 0;
  for (const c of recent) {
    const word = (c.mood_word || '').toLowerCase();
    if (STRESSED_WORDS.some(w => word.includes(w))) count++;
  }
  if (count < 3) return null;
  return {
    text: `Stress is showing up — you mentioned feeling stressed/anxious ${count} times recently.`,
    evidence: { pattern_key: 'stress_word_frequent_14d', count },
    confidence: Math.min(1, 0.4 + count * 0.1),
  };
}

function loggingConsistency(nutrition_history) {
  if (!Array.isArray(nutrition_history) || nutrition_history.length === 0) return null;
  // nutrition_history is a flat array of meals across days; group by date
  const datesWithLogs = new Set();
  for (const m of nutrition_history) {
    if (m?.date) datesWithLogs.add(m.date);
  }
  const days = datesWithLogs.size;
  if (days < 1 || days >= 6) return null;
  return {
    text: `You logged meals on ${days} of the last 7 days — patchy. Want help making it stickier?`,
    evidence: { pattern_key: 'irregular_meal_logging_7d', days_with_logs: days },
    confidence: 0.5 + (5 - days) * 0.05,
  };
}

function proteinGap(nutrition_daily) {
  if (!Array.isArray(nutrition_daily) || nutrition_daily.length < 4) return null;
  const daysWithGoals = nutrition_daily.filter(d => d?.goals?.protein > 0 && d?.totals?.protein != null);
  if (daysWithGoals.length < 4) return null;
  const ratios = daysWithGoals.map(d => d.totals.protein / d.goals.protein);
  const avgRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  if (avgRatio >= 0.7) return null;
  const avgGap = daysWithGoals.reduce((a, d) => a + (d.goals.protein - d.totals.protein), 0) / daysWithGoals.length;
  return {
    text: `Protein's been short most days — averaging ${Math.round(avgRatio * 100)}% of target (about ${Math.round(avgGap)}g short).`,
    evidence: { pattern_key: 'protein_gap_7d', avg_ratio: avgRatio, avg_gap_g: avgGap, days: daysWithGoals.length },
    confidence: Math.min(1, 0.5 + daysWithGoals.length * 0.07),
  };
}

function stepGap(activity_history) {
  if (!Array.isArray(activity_history) || activity_history.length < 5) return null;
  const recent = activity_history.slice(0, 7).filter(d => d?.steps != null);
  if (recent.length < 5) return null;
  const stepGoal = 8000;
  const avg = recent.reduce((a, d) => a + d.steps, 0) / recent.length;
  if (avg >= stepGoal * 0.7) return null;
  return {
    text: `Step count's been low — averaging ${Math.round(avg).toLocaleString()} over the last ${recent.length} days vs ${stepGoal.toLocaleString()} target.`,
    evidence: { pattern_key: 'step_gap_7d', avg_steps: avg, target: stepGoal, days: recent.length },
    confidence: Math.min(1, 0.5 + recent.length * 0.05),
  };
}

function nudgeDismissalPattern(nudgeStats) {
  if (nudgeStats.dismissed < 3) return null;
  const total = nudgeStats.total || 1;
  const dismissRate = nudgeStats.dismissed / total;
  if (dismissRate < 0.3) return null;
  return {
    text: `My check-ins haven't been landing — you've dismissed ${nudgeStats.dismissed} of ${total} recent ones. Should I change tone or timing?`,
    evidence: { pattern_key: 'high_nudge_dismissal_14d', dismissed: nudgeStats.dismissed, total, dismiss_rate: dismissRate },
    confidence: Math.min(1, 0.5 + dismissRate * 0.5),
  };
}

function runMiner({ checkins, nudge_stats, nutrition_meals, nutrition_daily, activity_history }) {
  const candidates = [
    avgMorningMood(checkins),
    tiredWordFrequency(checkins),
    stressWordFrequency(checkins),
    loggingConsistency(nutrition_meals),
    proteinGap(nutrition_daily),
    stepGap(activity_history),
    nudgeDismissalPattern(nudge_stats || {}),
  ].filter(Boolean);
  return candidates;
}

function nextPhaseCriteria(state, checkinsCount, nudgeStats) {
  if (state.phase === 'onboarding') {
    return { ready: !!(state.onboarding_answers && Object.keys(state.onboarding_answers).length >= 3), reason: 'needs ≥3 onboarding answers' };
  }
  if (state.phase === 'observing') {
    return { ready: state.days_since_join >= 7 && checkinsCount >= 5, reason: 'needs ≥7 days + ≥5 check-ins' };
  }
  if (state.phase === 'calibrating') {
    const engagement_rate = nudgeStats.total > 0 ? (nudgeStats.accepted + nudgeStats.acknowledged) / nudgeStats.total : 0;
    return { ready: state.days_since_join >= 28 && engagement_rate >= 0.4, reason: 'needs ≥28 days + ≥40% nudge engagement' };
  }
  return { ready: false, reason: 'already at final phase' };
}

// ── Tool schemas ──────────────────────────────────────────────────────

function toolSchemas() {
  const actor = { _adas_actor: { type: 'string' }, _adas_tenant: { type: 'string' } };
  return [
    // ── State machine ──
    { name: 'coach.state.get', description: 'Get full coach state: phase, joined_at, trust_budget, check_in_window, off_limits, tone, onboarding_answers, days_since_join. ALWAYS call at start of every interaction to know what phase the user is in and adapt behavior accordingly.', inputSchema: { type: 'object', properties: { ...actor } } },
    { name: 'coach.state.initOnboarding', description: 'Initialize coach state when a NEW user first interacts. Idempotent — if state exists, returns existing state. Call this on the very first turn with that user. Sets phase=onboarding.', inputSchema: { type: 'object', properties: { check_in_window: { type: 'object', properties: { am: { type: 'string' }, pm: { type: 'string' }, tz: { type: 'string' } } }, off_limits: { type: 'array', items: { type: 'string' } }, tone: { type: 'string', enum: ['warm', 'data', 'challenger'] }, ...actor } } },
    { name: 'coach.state.captureOnboardingAnswer', description: 'Save one onboarding answer (key/value). Keys: goal, typical_day, history_what_worked, history_what_failed, check_in_when, off_limits. Call once per Q&A pair during the onboarding conversation.', inputSchema: { type: 'object', properties: { key: { type: 'string' }, value: { type: 'string' }, ...actor }, required: ['key', 'value'] } },
    { name: 'coach.state.advancePhase', description: 'Advance to next phase (onboarding→observing→calibrating→accompanying). Check coach.state.canAdvance first. Use ONLY when criteria are met.', inputSchema: { type: 'object', properties: { ...actor } } },
    { name: 'coach.state.canAdvance', description: 'Check if user is ready to advance to next phase. Returns { ready, reason, current_phase, next_phase }.', inputSchema: { type: 'object', properties: { ...actor } } },
    { name: 'coach.state.update', description: 'Update specific state fields (tone, check_in_window, off_limits). Use when user explicitly tells the coach to change something.', inputSchema: { type: 'object', properties: { tone: { type: 'string' }, check_in_window: { type: 'object' }, off_limits: { type: 'array' }, ...actor } } },

    // ── Goals ──
    { name: 'coach.goals.current', description: "Get the user's current active goal (with version, type, target, deadline, reason).", inputSchema: { type: 'object', properties: { ...actor } } },
    { name: 'coach.goals.list', description: 'List ALL goal versions (current + historical) — useful to show evolution.', inputSchema: { type: 'object', properties: { ...actor } } },
    { name: 'coach.goals.add', description: 'Add a new goal version. Supersedes the previous active goal. ALWAYS include reason (why goal changed).', inputSchema: { type: 'object', properties: { text: { type: 'string' }, type: { type: 'string', description: 'weight|protein|steps|calories|sleep|habit|other' }, target_value: { type: 'number' }, target_unit: { type: 'string' }, deadline: { type: 'string' }, reason: { type: 'string' }, ...actor }, required: ['text'] } },

    // ── Check-ins ──
    { name: 'coach.checkin.log', description: 'Log a daily check-in. period=am|pm. rating=1-10 (optional). mood_word=1-2 words. free_text=optional longer text. Use during scheduled AM/PM check-ins.', inputSchema: { type: 'object', properties: { period: { type: 'string', enum: ['am', 'pm'] }, rating: { type: 'number' }, mood_word: { type: 'string' }, free_text: { type: 'string' }, date: { type: 'string' }, ...actor }, required: ['period'] } },
    { name: 'coach.checkin.recent', description: 'Get recent check-ins (default 7 days).', inputSchema: { type: 'object', properties: { days: { type: 'number' }, ...actor } } },
    { name: 'coach.checkin.todayStatus', description: "Check if today's AM/PM check-ins have happened. Returns { am: checkin|null, pm: checkin|null }.", inputSchema: { type: 'object', properties: { ...actor } } },

    // ── Snapshot ──
    { name: 'coach.snapshot.today', description: "Build today's unified snapshot. Pass in pre-fetched nutrition (from nutrition.getDailySummary) and activity (from device.health.today). Returns { date, phase, goal, nutrition, activity, checkin, gaps[], adherence_score }.", inputSchema: { type: 'object', properties: { nutrition: { type: 'object', description: 'Result from nutrition.getDailySummary' }, activity: { type: 'object', description: 'Result from device.health.today' }, ...actor } } },

    // ── Nudges (engagement learning) ──
    { name: 'coach.nudge.log', description: "Log a nudge that the coach is about to send. kind: 'morning'|'evening'|'pre_lunch'|'activity'|'pattern'|'experiment'|'observation'|'other'. Returns nudge with id — use id later when user responds.", inputSchema: { type: 'object', properties: { kind: { type: 'string' }, text: { type: 'string' }, context: { type: 'object' }, ...actor }, required: ['kind', 'text'] } },
    { name: 'coach.nudge.respond', description: "Record user's response to a previously-sent nudge. response: 'accepted'|'dismissed'|'acknowledged'|'ignored'. Adjusts trust_budget automatically.", inputSchema: { type: 'object', properties: { nudge_id: { type: 'string' }, response: { type: 'string', enum: ['accepted', 'dismissed', 'acknowledged', 'ignored'] }, ...actor }, required: ['nudge_id', 'response'] } },
    { name: 'coach.nudge.engagement', description: 'Get nudge engagement stats over last N days (default 14): accepted/dismissed/acknowledged/ignored counts.', inputSchema: { type: 'object', properties: { days: { type: 'number' }, ...actor } } },

    // ── Observations (patterns) ──
    { name: 'coach.observations.add', description: "Record a pattern the coach has noticed but NOT yet surfaced to the user. confidence 0-1. Example text: 'User mentions tiredness ~11am four times this week.'", inputSchema: { type: 'object', properties: { text: { type: 'string' }, evidence: { type: 'object' }, confidence: { type: 'number' }, ...actor }, required: ['text'] } },
    { name: 'coach.observations.pending', description: 'List observations not yet confirmed/disconfirmed by the user. Use to find candidates for the "first reflection" moment.', inputSchema: { type: 'object', properties: { ...actor } } },
    { name: 'coach.observations.markSurfaced', description: 'Mark that the coach surfaced this observation to the user (asked them to confirm). Use right after presenting it.', inputSchema: { type: 'object', properties: { observation_id: { type: 'string' }, ...actor }, required: ['observation_id'] } },
    { name: 'coach.observations.confirm', description: "Record user's response to a surfaced observation. confirmed=true if user agreed, false if disagreed.", inputSchema: { type: 'object', properties: { observation_id: { type: 'string' }, confirmed: { type: 'boolean' }, ...actor }, required: ['observation_id', 'confirmed'] } },

    // ── Experiments (weekly micro-bets) ──
    { name: 'coach.experiment.propose', description: 'Propose a one-week micro-experiment to the user. week_key like 2026-W19 (ISO week). One per week.', inputSchema: { type: 'object', properties: { text: { type: 'string' }, week_key: { type: 'string' }, ...actor }, required: ['text'] } },
    { name: 'coach.experiment.respond', description: 'Record whether user accepted (picked=true) or declined an experiment.', inputSchema: { type: 'object', properties: { experiment_id: { type: 'string' }, picked: { type: 'boolean' }, ...actor }, required: ['experiment_id', 'picked'] } },
    { name: 'coach.experiment.close', description: 'Close out an experiment at end-of-week with outcome notes.', inputSchema: { type: 'object', properties: { experiment_id: { type: 'string' }, outcome: { type: 'string' }, ...actor }, required: ['experiment_id'] } },
    { name: 'coach.experiment.list', description: 'List recent experiments (optionally filter by week_key).', inputSchema: { type: 'object', properties: { week_key: { type: 'string' }, ...actor } } },
    { name: 'coach.experiment.activeForWeek', description: 'Returns the most recent non-closed experiment for a given ISO week (defaults to current). Use by the weekly proposer to avoid double-proposing.', inputSchema: { type: 'object', properties: { week_key: { type: 'string' }, ...actor } } },
    { name: 'coach.experiment.currentWeekKey', description: 'Returns the ISO week_key for now (e.g. 2026-W20). Pure helper — no actor state.', inputSchema: { type: 'object', properties: {} } },

    // ── Pattern miner ──
    { name: 'coach.miner.run', description: "Run the pattern miner against the actor's data. Heuristics: low morning mood, frequent tired/stress words, irregular meal logging, protein gap, step gap, nudge-dismissal pattern. Each candidate gets a confidence score and is upserted (deduped by pattern_key). Designed to run silently from a daily cron — emits observations to coach.observations table that the PM-reflection trigger can later surface. Pass in pre-fetched nutrition.getMeals (last 14d, flat array), nutrition daily summaries (last 7d), and device.health.history. Returns { candidates_evaluated, created, skipped_duplicate }.", inputSchema: { type: 'object', properties: { nutrition_meals: { type: 'array', description: 'Flat array of meal records from nutrition.getMeals (last 14 days)' }, nutrition_daily: { type: 'array', description: 'Array of daily summaries (last 7 days), each with totals + goals' }, activity_history: { type: 'array', description: 'Array of daily health metrics from device.health.history (last 7-14 days)' }, ...actor } } },

    // ── UI plugins ──
    { name: 'ui.listPlugins', description: 'List available UI plugins served by coach-mcp.', inputSchema: { type: 'object', properties: {} } },
    { name: 'ui.getPlugin', description: 'Get UI plugin manifest by id.', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
    { name: 'ui.coach_dashboard.open', description: 'Open the MyCoach dashboard. MOBILE CRITICAL: pass pre-fetched data as args so the iframe can render on mobile. Required: { state, goal, snapshot, checkins, observations }. snapshot should come from coach.snapshot.today (with nutrition + activity pre-passed). checkins from coach.checkin.recent(7). observations from coach.observations.pending.', inputSchema: { type: 'object', properties: { state: { type: 'object' }, goal: { type: 'object' }, snapshot: { type: 'object' }, checkins: { type: 'array' }, observations: { type: 'array' } } } },
    { name: 'ui.coach_onboarding.open', description: 'Open the guided onboarding wizard. Use when the user prefers a structured form over chat-based onboarding. The wizard captures answers via coach.state.captureOnboardingAnswer, sets the first goal, and advances phase on completion.', inputSchema: { type: 'object', properties: {} } },
  ];
}

// ── Request handler ───────────────────────────────────────────────────

async function handle(req) {
  const { id, method, params } = req || {};

  if (method === 'initialize') {
    return ok(id, { protocolVersion: PROTOCOL_VERSION, serverInfo: { name: 'coach-mcp', version: '1.0.0' }, capabilities: { tools: {} } });
  }

  if (method === 'tools/list') return ok(id, { tools: toolSchemas() });

  if (method === 'tools/call') {
    const name = params?.name;
    const args = params?.arguments || {};

    try {
      const actorId = getActorId(args);

      // ── State ──
      if (name === 'coach.state.get') {
        const state = s.getState(actorId);
        return ok(id, toText({ ok: true, state: state || { phase: 'new', message: 'No state yet — call coach.state.initOnboarding to start.' } }));
      }
      if (name === 'coach.state.initOnboarding') {
        const state = s.initState(actorId, args);
        return ok(id, toText({ ok: true, state, message: state.days_since_join === 0 ? 'Welcome! Onboarding started.' : 'State exists already.' }));
      }
      if (name === 'coach.state.captureOnboardingAnswer') {
        // Auto-init state if not present — make the API idempotent so the
        // LLM doesn't have to remember to call initOnboarding first.
        let cur = s.getState(actorId);
        if (!cur) cur = s.initState(actorId);
        const answers = { ...cur.onboarding_answers, [args.key]: args.value };
        const state = s.updateState(actorId, { onboarding_answers: answers });
        return ok(id, toText({ ok: true, state, captured: { key: args.key, value: args.value }, answers_count: Object.keys(answers).length }));
      }
      if (name === 'coach.state.canAdvance') {
        const state = s.getState(actorId);
        if (!state) return ok(id, toText({ ok: false, error: 'No state.' }));
        const checkins = s.recentCheckins(actorId, 14);
        const stats = s.nudgeEngagementStats(actorId, 14);
        const verdict = nextPhaseCriteria(state, checkins.length, stats);
        const order = ['onboarding', 'observing', 'calibrating', 'accompanying'];
        const next = order[order.indexOf(state.phase) + 1] || null;
        return ok(id, toText({ ok: true, current_phase: state.phase, next_phase: next, ...verdict }));
      }
      if (name === 'coach.state.advancePhase') {
        const state = s.advancePhase(actorId);
        return ok(id, toText({ ok: true, state, message: `Advanced to ${state.phase}.` }));
      }
      if (name === 'coach.state.update') {
        const state = s.updateState(actorId, args);
        return ok(id, toText({ ok: true, state }));
      }

      // ── Goals ──
      if (name === 'coach.goals.current') return ok(id, toText({ ok: true, goal: s.currentGoal(actorId) }));
      if (name === 'coach.goals.list') return ok(id, toText({ ok: true, goals: s.listGoals(actorId) }));
      if (name === 'coach.goals.add') {
        if (!s.getState(actorId)) s.initState(actorId);
        const goal = s.addGoal(actorId, args);
        return ok(id, toText({ ok: true, goal, message: `Goal v${goal.version} set.` }));
      }

      // ── Check-ins ──
      if (name === 'coach.checkin.log') {
        if (!s.getState(actorId)) s.initState(actorId);
        const c = s.logCheckin(actorId, args);
        return ok(id, toText({ ok: true, checkin: c }));
      }
      if (name === 'coach.checkin.recent') return ok(id, toText({ ok: true, checkins: s.recentCheckins(actorId, args.days || 7) }));
      if (name === 'coach.checkin.todayStatus') {
        return ok(id, toText({ ok: true, am: s.todayCheckin(actorId, 'am'), pm: s.todayCheckin(actorId, 'pm') }));
      }

      // ── Snapshot ──
      if (name === 'coach.snapshot.today') {
        const state = s.getState(actorId);
        const goal = s.currentGoal(actorId);
        const am = s.todayCheckin(actorId, 'am');
        const pm = s.todayCheckin(actorId, 'pm');
        const nutrition = args.nutrition || null;
        const activity = args.activity || null;
        const goalCtx = goal ? { type: goal.type, target: goal.target_value, unit: goal.target_unit, deadline: goal.deadline } : null;
        const gaps = computeGaps({ nutrition, activity, goals: goalCtx });
        const adherence = computeAdherence({ nutrition, activity, goals: goalCtx });
        return ok(id, toText({
          ok: true,
          date: todayStr(),
          phase: state?.phase || 'new',
          trust_budget: state?.trust_budget ?? null,
          goal,
          nutrition,
          activity,
          checkin: { am, pm },
          gaps,
          adherence_score: adherence,
        }));
      }

      // ── Nudges ──
      if (name === 'coach.nudge.log') return ok(id, toText({ ok: true, nudge: s.logNudge(actorId, args) }));
      if (name === 'coach.nudge.respond') return ok(id, toText({ ok: true, nudge: s.respondToNudge(actorId, args.nudge_id, args.response), state: s.getState(actorId) }));
      if (name === 'coach.nudge.engagement') return ok(id, toText({ ok: true, stats: s.nudgeEngagementStats(actorId, args.days || 14) }));

      // ── Observations ──
      if (name === 'coach.observations.add') return ok(id, toText({ ok: true, observation: s.addObservation(actorId, args) }));
      if (name === 'coach.observations.pending') return ok(id, toText({ ok: true, observations: s.pendingObservations(actorId) }));
      if (name === 'coach.observations.markSurfaced') return ok(id, toText({ ok: true, observation: s.markObservationSurfaced(actorId, args.observation_id) }));
      if (name === 'coach.observations.confirm') return ok(id, toText({ ok: true, observation: s.confirmObservation(actorId, args.observation_id, args.confirmed) }));

      // ── Experiments ──
      if (name === 'coach.experiment.propose') {
        const wk = args.week_key || weekKey();
        return ok(id, toText({ ok: true, experiment: s.proposeExperiment(actorId, { text: args.text, week_key: wk }) }));
      }
      if (name === 'coach.experiment.respond') return ok(id, toText({ ok: true, experiment: s.respondToExperiment(actorId, args.experiment_id, args.picked) }));
      if (name === 'coach.experiment.close') return ok(id, toText({ ok: true, experiment: s.closeExperiment(actorId, args.experiment_id, args.outcome) }));
      if (name === 'coach.experiment.list') return ok(id, toText({ ok: true, experiments: s.listExperiments(actorId, { week_key: args.week_key }) }));
      if (name === 'coach.experiment.activeForWeek') {
        const wk = args.week_key || weekKey();
        const exp = s.getActiveExperimentForWeek(actorId, wk);
        return ok(id, toText({ ok: true, week_key: wk, experiment: exp, hasActive: !!exp }));
      }
      if (name === 'coach.experiment.currentWeekKey') {
        return ok(id, toText({ ok: true, week_key: weekKey() }));
      }

      // ── Pattern miner ──
      if (name === 'coach.miner.run') {
        const checkins = s.recentCheckins(actorId, 14);
        const nudge_stats = s.nudgeEngagementStats(actorId, 14);
        const candidates = runMiner({
          checkins,
          nudge_stats,
          nutrition_meals: args.nutrition_meals || [],
          nutrition_daily: args.nutrition_daily || [],
          activity_history: args.activity_history || [],
        });
        const results = candidates.map(c => s.upsertObservation(actorId, c));
        const created = results.filter(r => r.action === 'created').length;
        const dup = results.filter(r => r.action === 'skipped_duplicate').length;
        return ok(id, toText({
          ok: true,
          candidates_evaluated: candidates.length,
          created,
          skipped_duplicate: dup,
          observations: results.map(r => ({ id: r.observation.id, text: r.observation.text, confidence: r.observation.confidence, status: r.observation.status, action: r.action })),
        }));
      }

      // ── UI plugins ──
      if (name === 'ui.listPlugins') return ok(id, toText({ plugins: PLUGINS }));
      if (name === 'ui.getPlugin') {
        const p = PLUGINS.find(pl => pl.id === args.id);
        if (!p) return ok(id, toText({ error: 'Plugin not found' }));
        return ok(id, toText({
          ...p,
          render: {
            mode: 'adaptive',
            iframeUrl: `/ui/${p.id}/index.html`,
            // No explicit bundleUrl — the host derives the default route from
            // the plugin id, which is what Core actually serves. Hard-coding
            // a URL here previously pointed at a path Core didn't route, so
            // the bundle fetch 404'd and the host flipped `bundleMissing=true`
            // and rendered the EmbeddedPluginWebView (iframe) as a fallback.
            reactNative: { component: p.id },
          },
          channels: ['command'],
          capabilities: { commands: [{ name: 'open', description: `Open ${p.name}`, input_schema: { type: 'object', properties: {} } }] },
        }));
      }
      if (name === 'ui.coach_dashboard.open') return ok(id, toText({ _ui_command: true, plugin_id: 'mcp:coach-mcp:coach-dashboard', command: 'open', args: args || {} }));
      if (name === 'ui.coach_onboarding.open') return ok(id, toText({ _ui_command: true, plugin_id: 'mcp:coach-mcp:coach-onboarding', command: 'open', args: {} }));

      return err(id, -32601, `Unknown tool: ${name}`);
    } catch (e) {
      return err(id, -32000, String(e?.message || e));
    }
  }

  if (typeof method === 'string' && method.startsWith('notifications/')) return null;
  return err(id, -32601, `Unknown method: ${method}`);
}

// ── stdio loop ────────────────────────────────────────────────────────

let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', async (chunk) => {
  buf += chunk;
  const lines = buf.split('\n');
  buf = lines.pop() || '';
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let msg;
    try { msg = JSON.parse(trimmed); } catch { continue; }
    const resp = await handle(msg);
    if (resp) process.stdout.write(JSON.stringify(resp) + '\n');
  }
});
process.stdin.on('end', () => process.exit(0));

console.error('[coach-mcp] Server started (stdio)');
