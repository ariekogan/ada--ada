// src/storage.js — nutrition data via actorStore (per-(actor,"nutrition") SQLite),
// reached through Core's actorStore.exec/query tools (see coreClient.js).
// Replaces the old local node:sqlite DB. Each actor's data lives in its OWN
// actorStore DB, so there is NO actor_id column or filter — actorStore scopes by
// the calling actor. All functions are async (network round-trip to Core).
import { randomUUID } from "node:crypto";
import { exec, query } from "./coreClient.js";

// Per-process cache of actors whose tables we've created this run.
const _schemaReady = new Set();
async function ensureSchema(actorId) {
  if (_schemaReady.has(actorId)) return;
  await exec(actorId, `
    CREATE TABLE IF NOT EXISTS meals(id TEXT PRIMARY KEY,date TEXT NOT NULL,time TEXT NOT NULL,meal_type TEXT NOT NULL DEFAULT 'snack',items_json TEXT NOT NULL DEFAULT '[]',total_calories REAL DEFAULT 0,total_protein REAL DEFAULT 0,total_carbs REAL DEFAULT 0,total_fat REAL DEFAULT 0,total_fiber REAL DEFAULT 0,photo_hash TEXT,photos_json TEXT,notes TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS drinks(id TEXT PRIMARY KEY,date TEXT NOT NULL,time TEXT NOT NULL,type TEXT NOT NULL DEFAULT 'water',volume_ml REAL DEFAULT 250,caffeine_mg REAL,calories REAL DEFAULT 0,notes TEXT,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS goals(id INTEGER PRIMARY KEY CHECK(id=1),daily_calories REAL DEFAULT 2000,daily_protein REAL DEFAULT 150,daily_carbs REAL DEFAULT 250,daily_fat REAL DEFAULT 65,daily_water_ml REAL DEFAULT 2500,meal_times_json TEXT DEFAULT '{"breakfast":"08:00","lunch":"12:30","dinner":"19:00"}',water_reminder_interval TEXT DEFAULT 'PT2H',restrictions_json TEXT DEFAULT '[]',updated_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_meals_date ON meals(date);
    CREATE INDEX IF NOT EXISTS idx_drinks_date ON drinks(date);
  `);
  _schemaReady.add(actorId);
}

function today() { return new Date().toISOString().slice(0, 10); }
function nowTime() { return new Date().toISOString().slice(11, 16); }
function nowISO() { return new Date().toISOString(); }
function jp(s, fb) { try { return JSON.parse(s); } catch { return fb; } }
function sumItems(items) {
  const t = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  for (const it of items || []) {
    t.calories += Number(it.calories) || 0; t.protein += Number(it.protein) || 0;
    t.carbs += Number(it.carbs) || 0; t.fat += Number(it.fat) || 0; t.fiber += Number(it.fiber) || 0;
  }
  return t;
}
function mealRow(r) {
  if (!r) return null;
  let photos = [];
  try { if (r.photos_json) photos = JSON.parse(r.photos_json) || []; } catch {}
  if (r.photo_hash && !photos.includes(r.photo_hash)) photos.unshift(r.photo_hash);
  return { ...r, items: jp(r.items_json, []), items_json: undefined, photos_json: undefined, photos };
}

export async function logMeal(actorId, { date, time, meal_type, items, photo_hash, photos, notes }) {
  await ensureSchema(actorId);
  const t = sumItems(items); const id = randomUUID();
  const arr = Array.isArray(photos) ? photos.filter(Boolean).slice() : [];
  if (photo_hash && !arr.includes(photo_hash)) arr.unshift(photo_hash);
  const firstHash = arr[0] || null; const pj = arr.length ? JSON.stringify(arr) : null;
  await exec(actorId, "INSERT INTO meals(id,date,time,meal_type,items_json,total_calories,total_protein,total_carbs,total_fat,total_fiber,photo_hash,photos_json,notes,created_at,updated_at)VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    [id, date || today(), time || nowTime(), meal_type || "snack", JSON.stringify(items || []), t.calories, t.protein, t.carbs, t.fat, t.fiber, firstHash, pj, notes || null, nowISO(), nowISO()]);
  return { id, date: date || today(), time: time || nowTime(), meal_type: meal_type || "snack", items: items || [], photos: arr, total_calories: t.calories, total_protein: t.protein, total_carbs: t.carbs, total_fat: t.fat, total_fiber: t.fiber };
}

export async function updateMeal(actorId, mealId, updates) {
  await ensureSchema(actorId);
  const rows = await query(actorId, "SELECT*FROM meals WHERE id=?", [mealId]);
  const row = rows[0];
  if (!row) return { ok: false, error: "Not found" };
  const items = updates.items || jp(row.items_json, []); const t = sumItems(items);
  let photos = [];
  try { if (row.photos_json) photos = JSON.parse(row.photos_json) || []; } catch {}
  if (row.photo_hash && !photos.includes(row.photo_hash)) photos.unshift(row.photo_hash);
  if (Array.isArray(updates.photos)) photos = updates.photos.filter(Boolean).slice();
  else if (updates.add_photo && !photos.includes(updates.add_photo)) photos.push(updates.add_photo);
  const firstHash = photos[0] || null; const pj = photos.length ? JSON.stringify(photos) : null;
  await exec(actorId, "UPDATE meals SET items_json=?,meal_type=COALESCE(?,meal_type),total_calories=?,total_protein=?,total_carbs=?,total_fat=?,total_fiber=?,notes=COALESCE(?,notes),photo_hash=?,photos_json=?,updated_at=? WHERE id=?",
    [JSON.stringify(items), updates.meal_type || null, t.calories, t.protein, t.carbs, t.fat, t.fiber, updates.notes ?? null, firstHash, pj, nowISO(), mealId]);
  return { ok: true, photos };
}

export async function deleteMeal(actorId, mealId) {
  await ensureSchema(actorId);
  const r = await exec(actorId, "DELETE FROM meals WHERE id=?", [mealId]);
  return { ok: (r.changes || 0) > 0 };
}

export async function getMeals(actorId, { date, from, to, meal_type, limit } = {}) {
  await ensureSchema(actorId);
  let sql = "SELECT*FROM meals WHERE 1=1"; const p = [];
  if (date) { sql += " AND date=?"; p.push(date); }
  else { if (from) { sql += " AND date>=?"; p.push(from); } if (to) { sql += " AND date<=?"; p.push(to); } }
  if (meal_type) { sql += " AND meal_type=?"; p.push(meal_type); }
  sql += " ORDER BY date DESC,time DESC LIMIT ?"; p.push(limit || 50);
  return (await query(actorId, sql, p)).map(mealRow);
}

export async function logDrink(actorId, { date, time, type, volume_ml, caffeine_mg, calories, notes }) {
  await ensureSchema(actorId);
  const id = randomUUID();
  await exec(actorId, "INSERT INTO drinks(id,date,time,type,volume_ml,caffeine_mg,calories,notes,created_at)VALUES(?,?,?,?,?,?,?,?,?)",
    [id, date || today(), time || nowTime(), type || "water", Number(volume_ml) || 250, caffeine_mg != null ? Number(caffeine_mg) : null, Number(calories) || 0, notes || null, nowISO()]);
  return { id, type: type || "water", volume_ml: Number(volume_ml) || 250, date: date || today(), time: time || nowTime() };
}

export async function getHydration(actorId, date) {
  await ensureSchema(actorId);
  const d = date || today();
  const drinks = await query(actorId, "SELECT*FROM drinks WHERE date=? ORDER BY time", [d]);
  const total_ml = drinks.reduce((s, r) => s + (r.volume_ml || 0), 0);
  const water_ml = drinks.filter((r) => r.type === "water").reduce((s, r) => s + (r.volume_ml || 0), 0);
  const caffeine_mg = drinks.reduce((s, r) => s + (r.caffeine_mg || 0), 0);
  const dc = drinks.reduce((s, r) => s + (r.calories || 0), 0);
  const goals = await getGoals(actorId); const wg = goals?.daily_water_ml || 2500;
  return { date: d, drinks, total_ml, water_ml, water_goal: wg, water_pct: Math.round((water_ml / wg) * 100), caffeine_mg, drink_calories: dc };
}

export async function setGoals(actorId, g) {
  await ensureSchema(actorId);
  await exec(actorId, "INSERT INTO goals(id,daily_calories,daily_protein,daily_carbs,daily_fat,daily_water_ml,meal_times_json,water_reminder_interval,restrictions_json,updated_at)VALUES(1,?,?,?,?,?,?,?,?,?)ON CONFLICT(id)DO UPDATE SET daily_calories=excluded.daily_calories,daily_protein=excluded.daily_protein,daily_carbs=excluded.daily_carbs,daily_fat=excluded.daily_fat,daily_water_ml=excluded.daily_water_ml,meal_times_json=excluded.meal_times_json,water_reminder_interval=excluded.water_reminder_interval,restrictions_json=excluded.restrictions_json,updated_at=excluded.updated_at",
    [g.daily_calories ?? 2000, g.daily_protein ?? 150, g.daily_carbs ?? 250, g.daily_fat ?? 65, g.daily_water_ml ?? 2500, JSON.stringify(g.meal_times || { breakfast: "08:00", lunch: "12:30", dinner: "19:00" }), g.water_reminder_interval || "PT2H", JSON.stringify(g.dietary_restrictions || []), nowISO()]);
  return getGoals(actorId);
}

export async function getGoals(actorId) {
  await ensureSchema(actorId);
  const rows = await query(actorId, "SELECT*FROM goals WHERE id=1", []);
  const r = rows[0];
  if (!r) return null;
  return { ...r, meal_times: jp(r.meal_times_json, {}), dietary_restrictions: jp(r.restrictions_json, []), meal_times_json: undefined, restrictions_json: undefined };
}

export async function getDailySummary(actorId, date) {
  const d = date || today();
  const meals = await getMeals(actorId, { date: d, limit: 100 });
  const hydration = await getHydration(actorId, d);
  const goals = await getGoals(actorId);
  const t = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  for (const m of meals) { t.calories += m.total_calories || 0; t.protein += m.total_protein || 0; t.carbs += m.total_carbs || 0; t.fat += m.total_fat || 0; t.fiber += m.total_fiber || 0; }
  const g = goals || { daily_calories: 2000, daily_protein: 150, daily_carbs: 250, daily_fat: 65 };
  return { date: d, meals, meal_count: meals.length, totals: t, goals: { calories: g.daily_calories, protein: g.daily_protein, carbs: g.daily_carbs, fat: g.daily_fat }, remaining: { calories: g.daily_calories - t.calories, protein: g.daily_protein - t.protein, carbs: g.daily_carbs - t.carbs, fat: g.daily_fat - t.fat }, adherence: { calories_pct: Math.round((t.calories / g.daily_calories) * 100), protein_pct: Math.round((t.protein / g.daily_protein) * 100), carbs_pct: Math.round((t.carbs / g.daily_carbs) * 100), fat_pct: Math.round((t.fat / g.daily_fat) * 100) }, hydration };
}

export async function getWeeklySummary(actorId) {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i); const ds = d.toISOString().slice(0, 10);
    const s = await getDailySummary(actorId, ds);
    days.push({ date: ds, calories: s.totals.calories, protein: s.totals.protein, carbs: s.totals.carbs, fat: s.totals.fat, water_ml: s.hydration.water_ml, meal_count: s.meal_count });
  }
  const goals = await getGoals(actorId); const g = goals || { daily_calories: 2000, daily_protein: 150 };
  const tracked = days.filter((d) => d.meal_count > 0);
  const ac = tracked.length ? Math.round(tracked.reduce((s, d) => s + d.calories, 0) / tracked.length) : 0;
  const ap = tracked.length ? Math.round(tracked.reduce((s, d) => s + d.protein, 0) / tracked.length) : 0;
  const ot = tracked.filter((d) => Math.abs(d.calories - g.daily_calories) < g.daily_calories * 0.15).length;
  return { period: `${days[0].date} to ${days[6].date}`, days, averages: { calories: ac, protein: ap }, days_on_target: ot, days_tracked: tracked.length, goals: { daily_calories: g.daily_calories, daily_protein: g.daily_protein } };
}

// Account-deletion contract. Per-actor DB → delete all rows in the three tables.
// Idempotent. Called by the admin.deleteActor MCP tool (token-gated).
export async function deleteAllForActor(actorId) {
  if (!actorId) throw new Error("actorId required");
  await ensureSchema(actorId);
  const counts = {};
  for (const t of ["meals", "drinks", "goals"]) {
    const c = await query(actorId, `SELECT COUNT(*) AS n FROM ${t}`, []);
    await exec(actorId, `DELETE FROM ${t}`, []);
    counts[t] = c[0]?.n || 0;
  }
  return counts;
}
