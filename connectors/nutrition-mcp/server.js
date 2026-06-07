#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as storage from "./src/storage.js";
import { lookupFood, lookupMultiple } from "./src/nutritionApi.js";

function getActorId(args) { return args?._adas_actor || "default"; }
const A = { _adas_actor: z.string().optional(), _adas_tenant: z.string().optional() };

// ── UI Plugins ──
const UI_PLUGINS = [
  { id: "nutrition-dashboard", name: "Nutrition", version: "1.0.0", description: "Visual nutrition summary with progress rings and weekly charts" },
  { id: "nutrition-camera", name: "Meal Camera", version: "1.0.0", description: "Snap a photo of your meal for instant calorie analysis" },
];
const PLUGIN_MANIFESTS = {
  "nutrition-dashboard": { id: "nutrition-dashboard", name: "Nutrition", version: "1.0.0", render: { mode: "adaptive", iframeUrl: "/ui/nutrition-dashboard/index.html", reactNative: { component: "nutrition-dashboard" } }, channels: ["command"], capabilities: { commands: [{ name: "open", description: "Open dashboard", input_schema: { type: "object", properties: {} } }] } },
  "nutrition-camera": { id: "nutrition-camera", name: "Meal Camera", version: "1.0.0", render: { mode: "adaptive", iframeUrl: "/ui/nutrition-camera/index.html", reactNative: { component: "nutrition-camera" } }, channels: ["command"], capabilities: { camera: true, commands: [{ name: "open", description: "Open camera", input_schema: { type: "object", properties: {} } }] } },
};

const server = new McpServer({ name: "nutrition-mcp", version: "1.0.0" });

// ── UI Plugin tools ──
server.tool("ui.listPlugins", "List available UI plugins", {}, async () => {
  return { content: [{ type: "text", text: JSON.stringify({ plugins: UI_PLUGINS }) }] };
});
server.tool("ui.getPlugin", "Get plugin manifest by ID", { id: z.string() }, async ({ id }) => {
  const m = PLUGIN_MANIFESTS[id];
  if (!m) return { content: [{ type: "text", text: JSON.stringify({ error: "Plugin not found" }) }], isError: true };
  return { content: [{ type: "text", text: JSON.stringify(m) }] };
});
server.tool("ui.nutrition_dashboard.open", "Open the Nutrition Dashboard with progress rings and weekly charts. Auto-fetches the latest summary data so the dashboard renders immediately on mobile.", { daily: z.any().optional(), weekly: z.any().optional(), ...A }, async (args) => {
  const actorId = getActorId(args);
  let daily = args?.daily;
  let weekly = args?.weekly;
  try {
    if (!daily) daily = await storage.getDailySummary(actorId);
    if (!weekly) weekly = await storage.getWeeklySummary(actorId);
  } catch (e) {
    console.error("[nutrition-mcp] dashboard.open auto-fetch failed:", e?.message);
  }
  return { content: [{ type: "text", text: JSON.stringify({ _ui_command: true, plugin_id: "mcp:nutrition-mcp:nutrition-dashboard", command: "open", args: { daily: daily || null, weekly: weekly || null } }) }] };
});
server.tool("ui.nutrition_camera.open", "Open the meal camera to snap and analyze a meal photo", {}, async () => {
  return { content: [{ type: "text", text: JSON.stringify({ _ui_command: true, plugin_id: "mcp:nutrition-mcp:nutrition-camera", command: "open", args: {} }) }] };
});

// ── Meal tools ──
server.tool("nutrition.logMeal", "Log a meal with food items and nutrition data", { meal_type: z.string().optional(), date: z.string().optional(), time: z.string().optional(), items: z.array(z.any()).describe("Food items"), photo_hash: z.string().optional(), photos: z.array(z.string()).optional().describe("Multiple photo artifact hashes"), notes: z.string().optional(), ...A }, async (args) => {
  const meal = await storage.logMeal(getActorId(args), args);
  return { content: [{ type: "text", text: JSON.stringify({ ok: true, meal, message: `Logged ${meal.meal_type}: ${meal.total_calories} cal, ${meal.total_protein}g protein` }) }] };
});
server.tool("nutrition.updateMeal", "Update a logged meal (items, type, notes, photos)", { meal_id: z.string(), items: z.array(z.any()).optional(), meal_type: z.string().optional(), notes: z.string().optional(), photos: z.array(z.string()).optional().describe("Replace the full photo list"), add_photo: z.string().optional().describe("Append a single photo hash"), ...A }, async (args) => {
  return { content: [{ type: "text", text: JSON.stringify(await storage.updateMeal(getActorId(args), args.meal_id, args)) }] };
});
server.tool("nutrition.deleteMeal", "Delete a meal by ID", { meal_id: z.string(), ...A }, async (args) => {
  return { content: [{ type: "text", text: JSON.stringify(await storage.deleteMeal(getActorId(args), args.meal_id)) }] };
});
server.tool("nutrition.getMeals", "List meals for a date or range", { date: z.string().optional(), from: z.string().optional(), to: z.string().optional(), meal_type: z.string().optional(), limit: z.number().optional(), ...A }, async (args) => {
  const meals = await storage.getMeals(getActorId(args), args);
  return { content: [{ type: "text", text: JSON.stringify({ ok: true, count: meals.length, meals }) }] };
});

// ── Nutrition lookup ──
server.tool("nutrition.lookupFood", "USDA nutrition lookup per 100g", { query: z.string(), limit: z.number().optional(), ...A }, async (args) => {
  const r = await lookupFood(args.query, args.limit || 3);
  return { content: [{ type: "text", text: JSON.stringify({ ok: true, query: args.query, results: r, hint: r.length ? "Values per 100g." : "No match." }) }] };
});
server.tool("nutrition.lookupMultiple", "USDA lookup for multiple foods", { foods: z.array(z.string()), ...A }, async (args) => {
  const r = await lookupMultiple(args.foods);
  return { content: [{ type: "text", text: JSON.stringify({ ok: true, results: r }) }] };
});

// ── Drink tools ──
server.tool("nutrition.logDrink", "Log a drink", { type: z.string().optional(), volume_ml: z.number().optional(), caffeine_mg: z.number().optional(), calories: z.number().optional(), notes: z.string().optional(), date: z.string().optional(), time: z.string().optional(), ...A }, async (args) => {
  if (args.caffeine_mg == null) {
    if (args.type === "coffee") args.caffeine_mg = Math.round((args.volume_ml || 250) * 0.4);
    else if (args.type === "tea") args.caffeine_mg = Math.round((args.volume_ml || 250) * 0.2);
  }
  const d = await storage.logDrink(getActorId(args), args);
  return { content: [{ type: "text", text: JSON.stringify({ ok: true, drink: d, message: `Logged ${d.type}: ${d.volume_ml}ml` }) }] };
});
server.tool("nutrition.getHydration", "Today's hydration summary", { date: z.string().optional(), ...A }, async (args) => {
  return { content: [{ type: "text", text: JSON.stringify(await storage.getHydration(getActorId(args), args.date)) }] };
});

// ── Summary tools ──
server.tool("nutrition.getDailySummary", "Full daily breakdown vs goals", { date: z.string().optional(), ...A }, async (args) => {
  return { content: [{ type: "text", text: JSON.stringify(await storage.getDailySummary(getActorId(args), args.date)) }] };
});
server.tool("nutrition.getWeeklySummary", "7-day overview", { ...A }, async (args) => {
  return { content: [{ type: "text", text: JSON.stringify(await storage.getWeeklySummary(getActorId(args))) }] };
});

// ── Goals ──
server.tool("nutrition.setGoals", "Set daily targets", { daily_calories: z.number().optional(), daily_protein: z.number().optional(), daily_carbs: z.number().optional(), daily_fat: z.number().optional(), daily_water_ml: z.number().optional(), dietary_restrictions: z.array(z.string()).optional(), ...A }, async (args) => {
  const g = await storage.setGoals(getActorId(args), args);
  return { content: [{ type: "text", text: JSON.stringify({ ok: true, goals: g, message: "Goals updated." }) }] };
});
server.tool("nutrition.getGoals", "Get current goals", { ...A }, async (args) => {
  const g = await storage.getGoals(getActorId(args));
  return { content: [{ type: "text", text: JSON.stringify({ ok: true, goals: g || { message: "No goals set." } }) }] };
});

// ── Status ──
server.tool("nutrition.status", "Quick status: calories/water progress", { ...A }, async (args) => {
  const actorId = getActorId(args);
  const s = await storage.getDailySummary(actorId);
  const g = await storage.getGoals(actorId);
  return { content: [{ type: "text", text: JSON.stringify({ ok: true, today: s.date, calories: { eaten: s.totals.calories, goal: s.goals.calories, remaining: s.remaining.calories }, protein: { eaten: s.totals.protein, goal: s.goals.protein, remaining: s.remaining.protein }, water: { ml: s.hydration.water_ml, goal: s.hydration.water_goal, pct: s.hydration.water_pct }, meals_logged: s.meal_count, has_goals: !!g }) }] };
});

// ── Admin: account deletion ──
// Apple App Store §5.1.1(v) requires in-app account deletion that erases
// user data across the whole stack. Core's account-deletion orchestrator
// (apps/backend/utils/connectorActorDeletion.js in ai-dev-assistant) calls
// this tool for stdio-transport connectors that can't expose the standard
// HTTP `DELETE /admin/actors/:id` endpoint.
//
// Token-gated so the LLM (which sees this tool on its planner-visible
// tool list) can't invoke it via tools/call — the orchestrator passes
// a secret the LLM never sees. Token source priority:
//   1. NUTRITION_ADMIN_TOKEN — explicit per-connector override.
//   2. ADAS_CONNECTOR_PAT — tenant-scoped PAT minted at spawn (round 003).
//      Always present in the sandbox env (see connectorManager.js:1500),
//      so this is the path that actually fires for sandboxed connectors.
//      The orchestrator calls getOrMintConnectorPAT(tenant) to fetch the
//      same value and pass it as _admin_token.
//   3. ADAS_MCP_TOKEN — legacy fallback for non-sandboxed deployments
//      (stripped from sandbox env per the security architecture).
const ADMIN_TOKEN = process.env.NUTRITION_ADMIN_TOKEN || process.env.ADAS_CONNECTOR_PAT || process.env.ADAS_MCP_TOKEN || "";
server.tool(
  "admin.deleteActor",
  "[Internal] Wipe ALL nutrition data for one actor (meals, drinks, goals). Requires _admin_token to match the connector's NUTRITION_ADMIN_TOKEN / ADAS_MCP_TOKEN env. Used by Core's account-deletion orchestrator. Idempotent.",
  { actorId: z.string(), _admin_token: z.string(), ...A },
  async (args) => {
    if (!ADMIN_TOKEN || args._admin_token !== ADMIN_TOKEN) {
      return { content: [{ type: "text", text: JSON.stringify({ ok: false, error: "Invalid admin token" }) }], isError: true };
    }
    if (!args.actorId) {
      return { content: [{ type: "text", text: JSON.stringify({ ok: false, error: "actorId required" }) }], isError: true };
    }
    try {
      const counts = await storage.deleteAllForActor(args.actorId);
      return { content: [{ type: "text", text: JSON.stringify({ ok: true, connector: "nutrition-mcp", actorId: args.actorId, deletedCounts: counts }) }] };
    } catch (e) {
      return { content: [{ type: "text", text: JSON.stringify({ ok: false, error: String(e?.message || e) }) }], isError: true };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
