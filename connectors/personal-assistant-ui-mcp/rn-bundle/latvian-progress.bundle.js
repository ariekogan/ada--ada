var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// rn-src/latvian-progress.tsx
var latvian_progress_exports = {};
__export(latvian_progress_exports, {
  default: () => latvian_progress_default
});
module.exports = __toCommonJS(latvian_progress_exports);
var import_react = __toESM(require("react"), 1);
var import_react_native = require("react-native");
var import_plugin_sdk = require("@adas/plugin-sdk");
var MEMORY = "memory-mcp";
var CEFR = ["A0", "A1", "A2", "B1", "B2", "C1", "C2"];
var LV_CASES = ["nominat\u012Bvs", "\u0123enit\u012Bvs", "dat\u012Bvs", "akuzat\u012Bvs", "instrument\u0101lis", "lokat\u012Bvs"];
function cefrIndex(level) {
  const i = CEFR.indexOf(level);
  return i < 0 ? 0 : i;
}
var BADGE_CATALOG = [
  { id: "first_word", emoji: "\u{1F331}", label: "\u05DE\u05D9\u05DC\u05D4 \u05E8\u05D0\u05E9\u05D5\u05E0\u05D4", cond: (s2) => s2.vocab.total >= 1 },
  { id: "ten_words", emoji: "\u{1F4DA}", label: "10 \u05DE\u05D9\u05DC\u05D9\u05DD", cond: (s2) => s2.vocab.total >= 10 },
  { id: "fifty_words", emoji: "\u{1F392}", label: "50 \u05DE\u05D9\u05DC\u05D9\u05DD", cond: (s2) => s2.vocab.total >= 50 },
  { id: "hundred_words", emoji: "\u{1F3C5}", label: "100 \u05DE\u05D9\u05DC\u05D9\u05DD", cond: (s2) => s2.vocab.total >= 100 },
  { id: "first_mastered", emoji: "\u2728", label: "\u05DE\u05D9\u05DC\u05D4 \u05D1\u05E9\u05DC\u05D9\u05D8\u05D4", cond: (s2) => s2.vocab.mastered >= 1 },
  { id: "first_case", emoji: "\u{1F393}", label: "\u05D9\u05D7\u05E1\u05D4 \u05E8\u05D0\u05E9\u05D5\u05E0\u05D4", cond: (s2) => s2.grammar.casesTouched >= 1 },
  { id: "all_cases", emoji: "\u{1F3DB}\uFE0F", label: "\u05DB\u05DC 6 \u05D4\u05D9\u05D7\u05E1\u05D5\u05EA", cond: (s2) => s2.grammar.casesTouched >= 6 },
  { id: "streak_3", emoji: "\u{1F525}", label: "\u05E8\u05E6\u05E3 3 \u05D9\u05DE\u05D9\u05DD", cond: (s2) => s2.streak.current >= 3 },
  { id: "streak_7", emoji: "\u{1F525}", label: "\u05E8\u05E6\u05E3 \u05E9\u05D1\u05D5\u05E2", cond: (s2) => s2.streak.current >= 7 },
  { id: "streak_30", emoji: "\u{1F525}", label: "\u05E8\u05E6\u05E3 \u05D7\u05D5\u05D3\u05E9", cond: (s2) => s2.streak.current >= 30 },
  { id: "level_a2", emoji: "\u{1F680}", label: "\u05D4\u05D2\u05E2\u05EA \u05DC-A2", cond: (s2) => cefrIndex(s2.level) >= 2 },
  { id: "level_b1", emoji: "\u{1F6EB}", label: "\u05D4\u05D2\u05E2\u05EA \u05DC-B1", cond: (s2) => cefrIndex(s2.level) >= 3 }
];
var TAG_ALIASES = {
  vocab: ["vocab", "vocabulary", "words", "word", "lesson"],
  grammar: ["grammar", "gramatika", "rule"],
  mistake: ["mistake", "mistakes", "error", "correction"],
  state: ["state", "level", "streak", "xp", "preferences", "pronunciation", "conversation"]
};
function bucketFor(tags) {
  for (const [bucket, aliases] of Object.entries(TAG_ALIASES)) {
    if (aliases.some((a) => tags.includes(a))) return bucket;
  }
  return null;
}
function parseContent(m) {
  if ((m == null ? void 0 : m.content) && typeof m.content === "string") {
    const t = m.content.trim();
    if (t.startsWith("{") || t.startsWith("[")) {
      try {
        return JSON.parse(t);
      } catch (e) {
        return {};
      }
    }
  }
  return (m == null ? void 0 : m.content) && typeof m.content === "object" ? m.content : {};
}
function buildStats(memories) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n;
  const now = Date.now();
  const buckets = { vocab: [], grammar: [], mistake: [], state: [] };
  for (const m of memories) {
    const tags = Array.isArray(m.tags) ? m.tags : typeof m.tags === "string" ? m.tags.split(",") : [];
    if (!tags.includes("latvian")) continue;
    const b = bucketFor(tags);
    if (b) buckets[b].push(m);
  }
  const stateByKind = {};
  for (const m of buckets.state) {
    const p = parseContent(m);
    const tags = Array.isArray(m.tags) ? m.tags : [];
    const kind = p.kind || m.kind || tags.find((t) => !["latvian", "state"].includes(t));
    if (kind) stateByKind[kind] = p;
  }
  const level = ((_a = stateByKind.level) == null ? void 0 : _a.value) || ((_b = stateByKind.level) == null ? void 0 : _b.level) || "A0";
  const levelProgress = Math.max(0, Math.min(1, Number((_c = stateByKind.level) == null ? void 0 : _c.progress) || 0));
  const streak = {
    current: Number((_d = stateByKind.streak) == null ? void 0 : _d.current) || 0,
    longest: Number((_e = stateByKind.streak) == null ? void 0 : _e.longest) || 0
  };
  const xp = Number((_f = stateByKind.xp) == null ? void 0 : _f.value) || 0;
  const dailyTarget = Number((_g = stateByKind.preferences) == null ? void 0 : _g.daily_goal) || 5;
  const lessonsTodayKey = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const dailyDone = Number((_i = (_h = stateByKind.streak) == null ? void 0 : _h.lessons_today) == null ? void 0 : _i[lessonsTodayKey]) || Number((_j = stateByKind.streak) == null ? void 0 : _j.today_count) || 0;
  let mastered = 0, learning = 0, fresh = 0, dueNow = 0;
  for (const m of buckets.vocab) {
    const p = parseContent(m);
    const ease = Number(p.ease) || 1.3;
    const dueAt = Number(p.due_at) || 0;
    const lastRev = Number(p.last_reviewed) || 0;
    if (ease >= 2.5 && lastRev > 0) mastered++;
    else if (lastRev > 0) learning++;
    else fresh++;
    if (dueAt && dueAt <= now) dueNow++;
  }
  let solid = 0, shaky = 0;
  const casesSeen = /* @__PURE__ */ new Set();
  for (const m of buckets.grammar) {
    const p = parseContent(m);
    if (p.mastery === "solid") solid++;
    else if (p.mastery === "shaky") shaky++;
    const topic = (p.topic || "").toLowerCase();
    for (const c of LV_CASES) if (topic.includes(c)) casesSeen.add(c);
  }
  const pronPracticed = Number((_k = stateByKind.pronunciation) == null ? void 0 : _k.practiced) || 0;
  const pronTotal = Number((_l = stateByKind.pronunciation) == null ? void 0 : _l.total) || 33;
  const convTurns = Number((_m = stateByKind.conversation) == null ? void 0 : _m.turns) || 0;
  const convCorrected = Number((_n = stateByKind.conversation) == null ? void 0 : _n.corrected) || 0;
  const mistakeMap = /* @__PURE__ */ new Map();
  for (const m of buckets.mistake) {
    const p = parseContent(m);
    const k = (p.kind || "other") + "|" + (p.detail || "");
    const cur = mistakeMap.get(k) || { kind: p.kind || "other", detail: p.detail || "", count: 0 };
    cur.count++;
    mistakeMap.set(k, cur);
  }
  const mistakes = [...mistakeMap.values()].sort((a, b) => b.count - a.count).slice(0, 3);
  return {
    level,
    levelProgress,
    streak,
    xp,
    dailyGoal: { done: dailyDone, target: dailyTarget },
    vocab: { total: buckets.vocab.length, mastered, learning, new: fresh, dueNow },
    grammar: { topicsTotal: buckets.grammar.length, solid, shaky, casesTouched: casesSeen.size },
    pronunciation: { practiced: pronPracticed, total: pronTotal },
    conversation: { turns: convTurns, correctedTurns: convCorrected },
    mistakes
  };
}
function unwrap(raw) {
  var _a, _b;
  if (((_b = (_a = raw == null ? void 0 : raw.content) == null ? void 0 : _a[0]) == null ? void 0 : _b.type) === "text") {
    try {
      return JSON.parse(raw.content[0].text);
    } catch (e) {
      return raw;
    }
  }
  return typeof raw === "string" ? (() => {
    try {
      return JSON.parse(raw);
    } catch (e) {
      return raw;
    }
  })() : raw;
}
function LatvianProgressComponent({ bridge, native, theme }) {
  const api = (0, import_plugin_sdk.useApi)(bridge);
  const [stats, setStats] = (0, import_react.useState)(null);
  const [isLive, setIsLive] = (0, import_react.useState)(false);
  const [loadError, setLoadError] = (0, import_react.useState)(null);
  const loadData = (0, import_react.useCallback)(() => __async(null, null, function* () {
    try {
      const raw = yield api.call("memory.list", { tags: ["latvian"], limit: 1e3 }, MEMORY);
      const parsed = unwrap(raw);
      const memories = (parsed == null ? void 0 : parsed.memories) || (parsed == null ? void 0 : parsed.items) || [];
      setStats(buildStats(memories));
      setLoadError(null);
      setIsLive(true);
    } catch (err) {
      setStats(buildStats([]));
      setLoadError((err == null ? void 0 : err.message) || "Failed to load progress");
      setIsLive(true);
    }
  }), [api]);
  (0, import_react.useEffect)(() => {
    const t = setTimeout(loadData, 200);
    return () => clearTimeout(t);
  }, [loadData]);
  const startReview = (0, import_react.useCallback)(() => {
    var _a, _b, _c;
    (_b = (_a = native == null ? void 0 : native.haptics) == null ? void 0 : _a.selection) == null ? void 0 : _b.call(_a);
    try {
      (_c = bridge == null ? void 0 : bridge.send) == null ? void 0 : _c.call(bridge, { type: "message", text: "\u05D1\u05D5\u05D0 \u05E0\u05EA\u05D7\u05D9\u05DC \u05D7\u05D6\u05E8\u05D4 \u05D9\u05D5\u05DE\u05D9\u05EA \u05E9\u05DC \u05DE\u05D9\u05DC\u05D9\u05DD" });
    } catch (e) {
    }
  }, [bridge, native]);
  const earnedBadges = (0, import_react.useMemo)(() => {
    if (!stats) return /* @__PURE__ */ new Set();
    const s2 = /* @__PURE__ */ new Set();
    for (const b of BADGE_CATALOG) if (b.cond(stats)) s2.add(b.id);
    return s2;
  }, [stats]);
  const colors = (theme == null ? void 0 : theme.colors) || {
    bg: "#FAF6EE",
    text: "#1a1410",
    textMuted: "#9a8870",
    surface: "#F2EADC",
    border: "rgba(26,20,16,0.08)",
    accent: "#FF7A28",
    success: "#5A8A5C",
    error: "#C15545"
  };
  const accent = colors.accent || "#FF7A28";
  if (!isLive || !stats) {
    return /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [s.fullCenter, { backgroundColor: colors.bg }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.ActivityIndicator, { size: "small", color: accent }), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.muted, { color: colors.textMuted }] }, "\u05D8\u05D5\u05E2\u05DF \u05D4\u05EA\u05E7\u05D3\u05DE\u05D5\u05EA\u2026"));
  }
  const levelIdx = cefrIndex(stats.level);
  const nextLevel = CEFR[Math.min(levelIdx + 1, CEFR.length - 1)];
  const dailyPct = stats.dailyGoal.target > 0 ? Math.min(1, stats.dailyGoal.done / stats.dailyGoal.target) : 0;
  return /* @__PURE__ */ import_react.default.createElement(import_react_native.ScrollView, { style: [s.container, { backgroundColor: colors.bg }], contentContainerStyle: s.containerInner }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [s.heroBig, { backgroundColor: colors.surface, borderColor: colors.border }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.heroTitle, { color: colors.text }] }, "\u05DC\u05D8\u05D1\u05D9\u05EA \u{1F1F1}\u{1F1FB}"), /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: s.levelRow }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.levelBadge, { color: accent, borderColor: accent }] }, stats.level), /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [s.levelBar, { backgroundColor: colors.border }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [s.levelBarFill, { width: `${Math.round(stats.levelProgress * 100)}%`, backgroundColor: accent }] })), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.levelNext, { color: colors.textMuted }] }, nextLevel)), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.levelHint, { color: colors.textMuted }] }, Math.round(stats.levelProgress * 100), "% \u05D1\u05D3\u05E8\u05DA \u05DC-", nextLevel)), /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: s.statsRow }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [s.statCard, { backgroundColor: colors.surface, borderColor: colors.border }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: s.statEmoji }, "\u{1F525}"), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.statBig, { color: colors.text }] }, stats.streak.current), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.statLabel, { color: colors.textMuted }] }, "\u05E8\u05E6\u05E3 \u05D9\u05DE\u05D9\u05DD")), /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [s.statCard, { backgroundColor: colors.surface, borderColor: colors.border }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: s.statEmoji }, "\u2B50"), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.statBig, { color: colors.text }] }, stats.xp), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.statLabel, { color: colors.textMuted }] }, "\u05E0\u05E7' XP")), /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [s.statCard, { backgroundColor: colors.surface, borderColor: colors.border }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: s.statEmoji }, "\u{1F3AF}"), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.statBig, { color: colors.text }] }, stats.dailyGoal.done, "/", stats.dailyGoal.target), /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [s.miniBar, { backgroundColor: colors.border }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [s.miniBarFill, { width: `${Math.round(dailyPct * 100)}%`, backgroundColor: dailyPct >= 1 ? colors.success || "#5A8A5C" : accent }] })), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.statLabel, { color: colors.textMuted }] }, "\u05D9\u05E2\u05D3 \u05D9\u05D5\u05DE\u05D9"))), /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: s.gridRow }, /* @__PURE__ */ import_react.default.createElement(
    CategoryCard,
    {
      colors,
      accent,
      emoji: "\u{1F4DA}",
      title: "\u05D0\u05D5\u05E6\u05E8 \u05DE\u05D9\u05DC\u05D9\u05DD",
      subtitle: `${stats.vocab.total} \u05DE\u05D9\u05DC\u05D9\u05DD`,
      progress: stats.vocab.total === 0 ? 0 : stats.vocab.mastered / stats.vocab.total,
      breakdown: [
        { label: "\u05D1\u05E9\u05DC\u05D9\u05D8\u05D4", value: stats.vocab.mastered, color: colors.success || "#5A8A5C" },
        { label: "\u05D1\u05DC\u05D9\u05DE\u05D5\u05D3", value: stats.vocab.learning, color: accent },
        { label: "\u05D7\u05D3\u05E9\u05D5\u05EA", value: stats.vocab.new, color: colors.textMuted }
      ]
    }
  ), /* @__PURE__ */ import_react.default.createElement(
    CategoryCard,
    {
      colors,
      accent,
      emoji: "\u{1F9F1}",
      title: "\u05D3\u05E7\u05D3\u05D5\u05E7",
      subtitle: `${stats.grammar.casesTouched}/6 \u05D9\u05D7\u05E1\u05D5\u05EA`,
      progress: stats.grammar.casesTouched / 6,
      breakdown: [
        { label: "\u05D1\u05E9\u05DC\u05D9\u05D8\u05D4", value: stats.grammar.solid, color: colors.success || "#5A8A5C" },
        { label: "\u05E8\u05E2\u05D5\u05E2", value: stats.grammar.shaky, color: colors.error || "#C15545" }
      ]
    }
  )), /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: s.gridRow }, /* @__PURE__ */ import_react.default.createElement(
    CategoryCard,
    {
      colors,
      accent,
      emoji: "\u{1F5E3}\uFE0F",
      title: "\u05D4\u05D2\u05D9\u05D9\u05D4",
      subtitle: `${stats.pronunciation.practiced}/${stats.pronunciation.total} \u05E6\u05DC\u05D9\u05DC\u05D9\u05DD`,
      progress: stats.pronunciation.total === 0 ? 0 : stats.pronunciation.practiced / stats.pronunciation.total,
      breakdown: []
    }
  ), /* @__PURE__ */ import_react.default.createElement(
    CategoryCard,
    {
      colors,
      accent,
      emoji: "\u{1F4AC}",
      title: "\u05E9\u05D9\u05D7\u05D4",
      subtitle: `${stats.conversation.turns} \u05E1\u05D1\u05D1\u05D9\u05DD`,
      progress: stats.conversation.turns === 0 ? 0 : stats.conversation.correctedTurns / Math.max(1, stats.conversation.turns),
      breakdown: [
        { label: "\u05EA\u05D5\u05E7\u05E0\u05D5", value: stats.conversation.correctedTurns, color: colors.error || "#C15545" }
      ]
    }
  )), /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [s.ctaCard, { backgroundColor: colors.surface, borderColor: colors.border }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: s.ctaRow }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: { flex: 1 } }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.ctaTitle, { color: colors.text }] }, "\u{1F501} \u05DC\u05D7\u05D6\u05E8\u05D4 \u05E2\u05DB\u05E9\u05D9\u05D5: ", stats.vocab.dueNow, " \u05DE\u05D9\u05DC\u05D9\u05DD"), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.ctaHint, { color: colors.textMuted }] }, stats.vocab.dueNow === 0 ? "\u05D0\u05D9\u05DF \u05DB\u05E8\u05D2\u05E2 \u05DB\u05E8\u05D8\u05D9\u05E1\u05D9\u05DD \u05E9\u05DE\u05D7\u05DB\u05D9\u05DD \u2014 \u05E0\u05E6\u05DC \u05D0\u05EA \u05D4\u05D6\u05DE\u05DF \u05DC\u05DC\u05DE\u05D5\u05D3 \u05DE\u05D9\u05DC\u05D4 \u05D7\u05D3\u05E9\u05D4" : "\u05D7\u05D6\u05E8\u05D4 \u05E7\u05E6\u05E8\u05D4 \u05EA\u05E9\u05DE\u05D5\u05E8 \u05D0\u05EA \u05D4\u05D6\u05D9\u05DB\u05E8\u05D5\u05DF \u05D7\u05D9")), /* @__PURE__ */ import_react.default.createElement(import_react_native.Pressable, { onPress: startReview, style: [s.ctaBtn, { backgroundColor: accent }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: s.ctaBtnText }, "\u05D4\u05EA\u05D7\u05DC")))), /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: s.section }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.sectionTitle, { color: colors.text }] }, "\u{1F3C6} \u05D4\u05D9\u05E9\u05D2\u05D9\u05DD"), /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: s.badgesRow }, BADGE_CATALOG.map((b) => {
    const earned = earnedBadges.has(b.id);
    return /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { key: b.id, style: [s.badge, { backgroundColor: colors.surface, borderColor: earned ? accent : colors.border, opacity: earned ? 1 : 0.45 }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: s.badgeEmoji }, earned ? b.emoji : "\u{1F512}"), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.badgeLabel, { color: earned ? colors.text : colors.textMuted }], numberOfLines: 2 }, b.label));
  }))), stats.mistakes.length > 0 && /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: s.section }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.sectionTitle, { color: colors.text }] }, "\u{1F4A1} \u05DC\u05D7\u05D6\u05E7 \u05D4\u05E9\u05D1\u05D5\u05E2"), stats.mistakes.map((m, i) => /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { key: i, style: [s.weakRow, { backgroundColor: colors.surface, borderColor: colors.border }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.weakKind, { color: colors.error || "#C15545" }] }, m.kind), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.weakDetail, { color: colors.text }], numberOfLines: 2 }, m.detail || "\u2014"), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.weakCount, { color: colors.textMuted }] }, "\xD7", m.count)))), loadError && /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.errorFoot, { color: colors.error || "#C15545" }] }, "\u05DC\u05D0 \u05D4\u05E6\u05DC\u05D7\u05EA\u05D9 \u05DC\u05D4\u05D2\u05D9\u05E2 \u05DC\u05D6\u05D9\u05DB\u05E8\u05D5\u05DF: ", loadError), stats.vocab.total === 0 && stats.grammar.topicsTotal === 0 && /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.muted, { color: colors.textMuted, marginTop: 16, textAlign: "center" }] }, "\u05E2\u05D5\u05D3 \u05D0\u05D9\u05DF \u05E0\u05EA\u05D5\u05E0\u05D9\u05DD. \u05D1\u05D5\u05D0 \u05E0\u05EA\u05D7\u05D9\u05DC \u05E9\u05D9\u05E2\u05D5\u05E8 \u05E2\u05DD \u05D4\u05DE\u05D5\u05E8\u05D4 \u05DC\u05DC\u05D8\u05D1\u05D9\u05EA \u05DB\u05D3\u05D9 \u05DC\u05D1\u05E0\u05D5\u05EA \u05D0\u05EA \u05D4\u05DC\u05D5\u05D7."));
}
function CategoryCard({
  colors,
  accent,
  emoji,
  title,
  subtitle,
  progress,
  breakdown
}) {
  const pct = Math.max(0, Math.min(1, progress || 0));
  return /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [s.catCard, { backgroundColor: colors.surface, borderColor: colors.border }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: s.catTop }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: s.catEmoji }, emoji), /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: { flex: 1 } }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.catTitle, { color: colors.text }] }, title), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.catSub, { color: colors.textMuted }] }, subtitle))), /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [s.catBar, { backgroundColor: colors.border }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [s.catBarFill, { width: `${Math.round(pct * 100)}%`, backgroundColor: accent }] })), breakdown.filter((b) => b.value > 0).length > 0 && /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: s.catBreakdown }, breakdown.filter((b) => b.value > 0).map((b, i) => /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { key: i, style: s.catBreakItem }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [s.catDot, { backgroundColor: b.color }] }), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.catBreakText, { color: colors.textMuted }] }, b.label, " ", b.value)))));
}
var latvian_progress_default = {
  id: "latvian-progress",
  type: "ui",
  version: "1.0.0",
  capabilities: { haptics: true },
  Component: LatvianProgressComponent
};
var s = import_react_native.StyleSheet.create({
  container: { flex: 1 },
  containerInner: { padding: 14, paddingBottom: 32 },
  fullCenter: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  muted: { fontSize: 13 },
  heroBig: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 10 },
  heroTitle: { fontSize: 22, fontWeight: "700", marginBottom: 10, textAlign: "right" },
  levelRow: { flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  levelBadge: { fontSize: 14, fontWeight: "700", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, minWidth: 44, textAlign: "center" },
  levelBar: { flex: 1, height: 10, borderRadius: 5, overflow: "hidden" },
  levelBarFill: { height: "100%", borderRadius: 5 },
  levelNext: { fontSize: 12, fontWeight: "600" },
  levelHint: { fontSize: 11, marginTop: 8, textAlign: "right" },
  statsRow: { flexDirection: "row-reverse", gap: 8, marginBottom: 12 },
  statCard: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 12, alignItems: "center" },
  statEmoji: { fontSize: 22, marginBottom: 4 },
  statBig: { fontSize: 20, fontWeight: "700" },
  statLabel: { fontSize: 11, marginTop: 4 },
  miniBar: { width: "100%", height: 4, borderRadius: 2, marginTop: 6, overflow: "hidden" },
  miniBarFill: { height: "100%", borderRadius: 2 },
  gridRow: { flexDirection: "row-reverse", gap: 8, marginBottom: 8 },
  catCard: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 12 },
  catTop: { flexDirection: "row-reverse", alignItems: "center", gap: 8, marginBottom: 8 },
  catEmoji: { fontSize: 22 },
  catTitle: { fontSize: 14, fontWeight: "600", textAlign: "right" },
  catSub: { fontSize: 11, marginTop: 1, textAlign: "right" },
  catBar: { height: 6, borderRadius: 3, overflow: "hidden" },
  catBarFill: { height: "100%", borderRadius: 3 },
  catBreakdown: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginTop: 8 },
  catBreakItem: { flexDirection: "row-reverse", alignItems: "center", gap: 4 },
  catDot: { width: 6, height: 6, borderRadius: 3 },
  catBreakText: { fontSize: 10 },
  ctaCard: { borderRadius: 12, borderWidth: 1, padding: 14, marginTop: 6, marginBottom: 12 },
  ctaRow: { flexDirection: "row-reverse", alignItems: "center", gap: 12 },
  ctaTitle: { fontSize: 14, fontWeight: "600", textAlign: "right" },
  ctaHint: { fontSize: 11, marginTop: 4, textAlign: "right" },
  ctaBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999 },
  ctaBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  section: { marginTop: 6, marginBottom: 4 },
  sectionTitle: { fontSize: 14, fontWeight: "600", marginBottom: 8, textAlign: "right" },
  badgesRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  badge: { width: "23%", minWidth: 70, aspectRatio: 1, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center", padding: 6 },
  badgeEmoji: { fontSize: 22, marginBottom: 4 },
  badgeLabel: { fontSize: 10, textAlign: "center", lineHeight: 12 },
  weakRow: { flexDirection: "row-reverse", alignItems: "center", gap: 10, borderRadius: 10, borderWidth: 1, padding: 10, marginBottom: 6 },
  weakKind: { fontSize: 11, fontWeight: "700", minWidth: 60, textAlign: "right" },
  weakDetail: { flex: 1, fontSize: 12, textAlign: "right" },
  weakCount: { fontSize: 11, fontWeight: "600" },
  errorFoot: { fontSize: 11, textAlign: "center", marginTop: 8 }
});
