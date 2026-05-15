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

// rn-src/coach-dashboard.tsx
var coach_dashboard_exports = {};
__export(coach_dashboard_exports, {
  default: () => coach_dashboard_default
});
module.exports = __toCommonJS(coach_dashboard_exports);
var import_react = __toESM(require("react"), 1);
var import_react_native = require("react-native");
var import_plugin_sdk = require("@adas/plugin-sdk");
var COACH = "coach-mcp";
var NUTR = "nutrition-mcp";
var DEVICE = "mobile-device-mcp";
var PHASE_COLOR = {
  onboarding: "#7c9eff",
  observing: "#b48ce6",
  calibrating: "#5fd576",
  accompanying: "#ffb84d"
};
function parseResult(r) {
  if (!r) return null;
  const v = r.status === "fulfilled" ? r.value : r;
  try {
    return typeof v === "string" ? JSON.parse(v) : v;
  } catch (e) {
    return null;
  }
}
function Ring({ pct, color, trackColor }) {
  return /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: { height: 6, backgroundColor: trackColor, borderRadius: 3, overflow: "hidden", marginTop: 6 } }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: { height: 6, width: `${Math.min(100, pct)}%`, backgroundColor: color, borderRadius: 3 } }));
}
var CoachDashboard = function CoachDashboard2({ bridge, native, theme }) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v, _w;
  const api = (0, import_plugin_sdk.useApi)(bridge);
  const t = theme || {};
  const C = {
    bg: ((_a = t.colors) == null ? void 0 : _a.bg) || "#faf6ef",
    surface: ((_b = t.colors) == null ? void 0 : _b.surface) || "#ffffff",
    surface2: ((_c = t.colors) == null ? void 0 : _c.surface2) || "#f3ede0",
    border: ((_d = t.colors) == null ? void 0 : _d.border) || "#e8e0d2",
    text: ((_e = t.colors) == null ? void 0 : _e.text) || "#1a1a1a",
    textMuted: ((_f = t.colors) == null ? void 0 : _f.textMuted) || "#7a7166",
    accent: ((_g = t.colors) == null ? void 0 : _g.accent) || "#e0712b",
    success: ((_h = t.colors) == null ? void 0 : _h.success) || "#5fd576",
    warn: ((_i = t.colors) == null ? void 0 : _i.warn) || "#ffb84d"
  };
  const S = import_react.default.useMemo(() => makeStyles(C), [C.bg, C.surface, C.border, C.text, C.textMuted, C.accent]);
  const [state, setState] = (0, import_react.useState)(null);
  const [goal, setGoal] = (0, import_react.useState)(null);
  const [snapshot, setSnapshot] = (0, import_react.useState)(null);
  const [checkins, setCheckins] = (0, import_react.useState)([]);
  const [observation, setObservation] = (0, import_react.useState)(null);
  const [loading, setLoading] = (0, import_react.useState)(true);
  const load = (0, import_react.useCallback)(() => __async(null, null, function* () {
    const [s1, g1, n1, a1, c1, o1] = yield Promise.allSettled([
      api.call("coach.state.get", {}, COACH),
      api.call("coach.goals.current", {}, COACH),
      api.call("nutrition.getDailySummary", {}, NUTR),
      api.call("device.health.today", {}, DEVICE),
      api.call("coach.checkin.recent", { days: 7 }, COACH),
      api.call("coach.observations.pending", {}, COACH)
    ]);
    const stateRes = parseResult(s1);
    const goalRes = parseResult(g1);
    const nutr = parseResult(n1);
    const act = parseResult(a1);
    const ck = parseResult(c1);
    const obs = parseResult(o1);
    if (stateRes == null ? void 0 : stateRes.state) setState(stateRes.state);
    if (goalRes == null ? void 0 : goalRes.goal) setGoal(goalRes.goal);
    if (ck == null ? void 0 : ck.checkins) setCheckins(ck.checkins.slice(0, 5));
    if (obs == null ? void 0 : obs.observations) {
      const pending = obs.observations.filter((o) => o.status === "pending" || o.status === "surfaced");
      if (pending.length > 0) setObservation(pending[0]);
    }
    const snapRes = yield api.call("coach.snapshot.today", {
      nutrition: nutr || {},
      activity: (act == null ? void 0 : act.today) || act || {}
    }, COACH);
    const snap = parseResult({ status: "fulfilled", value: snapRes });
    if (snap) setSnapshot(snap);
    setLoading(false);
  }), [api]);
  (0, import_react.useEffect)(() => {
    load();
  }, [load]);
  const confirmObs = (confirmed) => __async(null, null, function* () {
    var _a2, _b2, _c2, _d2;
    if (!observation) return;
    if (native == null ? void 0 : native.haptics) {
      confirmed ? (_b2 = (_a2 = native.haptics).selection) == null ? void 0 : _b2.call(_a2) : (_d2 = (_c2 = native.haptics).selection) == null ? void 0 : _d2.call(_c2);
    }
    yield api.call("coach.observations.confirm", { observation_id: observation.id, confirmed }, COACH);
    setObservation(null);
  });
  if (loading) {
    return /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: S.center }, /* @__PURE__ */ import_react.default.createElement(import_react_native.ActivityIndicator, { color: C.accent }));
  }
  const phase = (state == null ? void 0 : state.phase) || "new";
  const phaseColor = PHASE_COLOR[phase] || C.textMuted;
  const trust = (_j = state == null ? void 0 : state.trust_budget) != null ? _j : 0;
  const calNow = (_m = (_l = (_k = snapshot == null ? void 0 : snapshot.nutrition) == null ? void 0 : _k.totals) == null ? void 0 : _l.calories) != null ? _m : 0;
  const calGoal = (_p = (_o = (_n = snapshot == null ? void 0 : snapshot.nutrition) == null ? void 0 : _n.goals) == null ? void 0 : _o.calories) != null ? _p : 2e3;
  const proNow = (_s = (_r = (_q = snapshot == null ? void 0 : snapshot.nutrition) == null ? void 0 : _q.totals) == null ? void 0 : _r.protein) != null ? _s : 0;
  const proGoal = (_v = (_u = (_t = snapshot == null ? void 0 : snapshot.nutrition) == null ? void 0 : _t.goals) == null ? void 0 : _u.protein) != null ? _v : 150;
  const stepsKnown = (snapshot == null ? void 0 : snapshot.activity) != null && snapshot.activity.steps != null;
  const steps = stepsKnown ? snapshot.activity.steps : 0;
  const stepGoal = 8e3;
  return /* @__PURE__ */ import_react.default.createElement(import_react_native.ScrollView, { style: S.scroll, contentContainerStyle: S.content }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: S.header }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, null, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: S.h1 }, "MyCoach"), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: S.muted }, "Day ", (_w = state == null ? void 0 : state.days_since_join) != null ? _w : 0, " \xB7 trust ", trust, "/100")), /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [S.badge, { borderColor: phaseColor, backgroundColor: phaseColor + "22" }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [S.badgeText, { color: phaseColor }] }, phase.toUpperCase()))), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: S.section }, "GOAL"), /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: S.card }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: S.goalText }, (goal == null ? void 0 : goal.text) || "No goal set yet."), goal && /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: S.muted }, "v", goal.version, goal.reason ? ` \xB7 ${goal.reason}` : "")), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: S.section }, "TODAY"), /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: S.card }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: S.row }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: S.metricLabel }, "Calories"), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: S.metricVal }, calNow.toFixed(0), " / ", calGoal)), /* @__PURE__ */ import_react.default.createElement(Ring, { pct: calNow / calGoal * 100, color: C.accent, trackColor: C.border }), /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [S.row, { marginTop: 14 }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: S.metricLabel }, "Protein"), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: S.metricVal }, proNow.toFixed(0), "g / ", proGoal, "g")), /* @__PURE__ */ import_react.default.createElement(Ring, { pct: proNow / proGoal * 100, color: C.success, trackColor: C.border }), /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [S.row, { marginTop: 14 }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: S.metricLabel }, "Steps"), stepsKnown ? /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: S.metricVal }, steps.toLocaleString(), " / ", stepGoal.toLocaleString()) : /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [S.metricVal, { color: C.textMuted, fontStyle: "italic" }] }, "Connect Health")), /* @__PURE__ */ import_react.default.createElement(Ring, { pct: stepsKnown ? steps / stepGoal * 100 : 0, color: C.warn, trackColor: C.border }), !stepsKnown && /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [S.muted, { marginTop: 4, fontSize: 11 }] }, "No step data \u2014 make sure Health is connected in iPhone Settings \u2192 Privacy \u2192 Health.")), (snapshot == null ? void 0 : snapshot.adherence_score) != null && /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [S.card, S.center, { marginTop: 10 }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: S.adherence }, snapshot.adherence_score), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: S.muted }, "Today's adherence")), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: S.section }, "GAPS"), /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: S.card }, ((snapshot == null ? void 0 : snapshot.gaps) || []).length === 0 ? /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [S.muted, { textAlign: "center" }] }, "No gaps today \u{1F3AF}") : ((snapshot == null ? void 0 : snapshot.gaps) || []).map((g, i) => /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { key: i, style: S.row }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: S.metricLabel }, g.metric.replace("_", " ")), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: S.gapDelta }, g.delta.toFixed(0), " ", g.unit, " short")))), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: S.section }, "RECENT CHECK-INS"), /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: S.card }, checkins.length === 0 ? /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [S.muted, { textAlign: "center" }] }, "No check-ins yet") : checkins.map((c, i) => /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { key: i, style: S.row }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: S.muted }, c.date, " ", c.period.toUpperCase()), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: S.metricVal }, c.rating != null ? `${c.rating}/10` : "\u2014", c.mood_word ? ` \xB7 ${c.mood_word}` : "")))), observation && /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: S.section }, "SOMETHING I NOTICED"), /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: S.card }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: S.obsText }, observation.text), /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: S.btnRow }, /* @__PURE__ */ import_react.default.createElement(import_react_native.TouchableOpacity, { style: [S.btn, S.btnPrimary], onPress: () => confirmObs(true) }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: S.btnPrimaryText }, "Yes, matches")), /* @__PURE__ */ import_react.default.createElement(import_react_native.TouchableOpacity, { style: S.btn, onPress: () => confirmObs(false) }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: S.btnText }, "Not really"))))));
};
var coach_dashboard_default = {
  id: "coach-dashboard",
  type: "ui",
  version: "1.0.1",
  capabilities: { haptics: true },
  Component: CoachDashboard
};
function makeStyles(C) {
  return import_react_native.StyleSheet.create({
    scroll: { flex: 1, backgroundColor: C.bg },
    content: { padding: 16, paddingBottom: 40 },
    center: { justifyContent: "center", alignItems: "center", flex: 1, backgroundColor: C.bg },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
    h1: { fontSize: 22, color: C.text, fontWeight: "600" },
    muted: { fontSize: 12, color: C.textMuted },
    badge: { borderWidth: 1, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
    badgeText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6 },
    section: { fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, fontWeight: "700", marginTop: 20, marginBottom: 8 },
    card: { backgroundColor: C.surface, borderColor: C.border, borderWidth: 1, borderRadius: 12, padding: 14 },
    goalText: { fontSize: 15, color: C.text, fontWeight: "500", lineHeight: 21 },
    row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
    metricLabel: { fontSize: 13, color: C.text, textTransform: "capitalize" },
    metricVal: { fontSize: 13, color: C.text, fontWeight: "600" },
    gapDelta: { fontSize: 13, color: C.warn, fontWeight: "500" },
    adherence: { fontSize: 32, color: C.text, fontWeight: "700" },
    obsText: { fontSize: 14, color: C.text, lineHeight: 20, marginBottom: 12 },
    btnRow: { flexDirection: "row", gap: 8 },
    btn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, alignItems: "center" },
    btnPrimary: { backgroundColor: C.accent, borderColor: C.accent },
    btnText: { color: C.text, fontSize: 13, fontWeight: "500" },
    btnPrimaryText: { color: "#fff", fontSize: 13, fontWeight: "500" }
  });
}
