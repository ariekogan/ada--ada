// src-hash:67dd723afd3f6d0cd880add74a0125a6
var __create = Object.create;
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
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

// rn-src/index.tsx
var index_exports = {};
__export(index_exports, {
  HomeLayoutPanel: () => home_layout_panel_default,
  MemoriesPanel: () => memories_panel_default,
  PaDashboard: () => pa_dashboard_default,
  SchedulePanel: () => schedule_panel_default,
  TeachPanel: () => teach_panel_default,
  TriggersPanel: () => triggers_panel_default
});
module.exports = __toCommonJS(index_exports);

// rn-src/schedule-panel.tsx
var import_react = __toESM(require("react"));
var import_react_native = require("react-native");
var import_plugin_sdk = require("@adas/plugin-sdk");
var DEVICE = "mobile-device-mcp";
var ACCENT = "#2563eb";
var schedule_panel_default = import_plugin_sdk.PluginSDK.register("schedule-panel", {
  type: "ui",
  version: "1.0.0",
  capabilities: {},
  Component({ bridge, theme }) {
    const api = (0, import_plugin_sdk.useApi)(bridge);
    const [tab, setTab] = (0, import_react.useState)("today");
    const [todayEvents, setTodayEvents] = (0, import_react.useState)([]);
    const [upcomingEvents, setUpcomingEvents] = (0, import_react.useState)([]);
    const [weather, setWeather] = (0, import_react.useState)(null);
    const [isLive, setIsLive] = (0, import_react.useState)(false);
    const loadData = (0, import_react.useCallback)(() => __async(null, null, function* () {
      try {
        const [todayRes, upcomingRes, weatherRes] = yield Promise.all([
          api.call("device.calendar.today", {}, DEVICE).catch(() => null),
          api.call("device.calendar.upcoming", { days: 3 }, DEVICE).catch(() => null),
          api.call("device.weather.current", {}, DEVICE).catch(() => null)
        ]);
        if (todayRes) {
          const d = typeof todayRes === "string" ? JSON.parse(todayRes) : todayRes;
          setTodayEvents(d.events || (Array.isArray(d) ? d : []));
        }
        if (upcomingRes) {
          const d = typeof upcomingRes === "string" ? JSON.parse(upcomingRes) : upcomingRes;
          let events2 = d.events || (Array.isArray(d) ? d : []);
          if (d.days) {
            events2 = [];
            d.days.forEach((day) => {
              (day.events || []).forEach((e) => events2.push(__spreadProps(__spreadValues({}, e), { _date: day.date })));
            });
          }
          setUpcomingEvents(events2);
        }
        if (weatherRes) {
          setWeather(typeof weatherRes === "string" ? JSON.parse(weatherRes) : weatherRes);
        }
        setIsLive(true);
      } catch (e) {
      }
    }), [api]);
    (0, import_react.useEffect)(() => {
      const timer = setTimeout(loadData, 300);
      return () => clearTimeout(timer);
    }, [loadData]);
    const colors = (theme == null ? void 0 : theme.colors) || {
      bg: "#FAF6EE",
      text: "#1a1410",
      textMuted: "#9a8870",
      surface: "#F2EADC",
      border: "rgba(26,20,16,0.08)"
    };
    const events = tab === "today" ? todayEvents : upcomingEvents;
    const today = (/* @__PURE__ */ new Date()).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    return /* @__PURE__ */ import_react.default.createElement(import_react_native.ScrollView, { style: [s.container, { backgroundColor: colors.bg }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [s.header, { borderBottomColor: colors.border }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.title, { color: colors.text }] }, "Schedule ", isLive && /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: s.liveBadge }, "\u25CF", " LIVE")), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.dateLabel, { color: colors.textMuted }] }, today)), weather && /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [s.weatherStrip, { backgroundColor: colors.surface, borderColor: colors.border }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.weatherTemp, { color: colors.text }] }, String(weather.temperature || weather.temp || "")), /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: s.weatherInfo }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.weatherCond, { color: colors.text }] }, weather.conditions || weather.description || ""), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.weatherDetail, { color: colors.textMuted }] }, weather.humidity ? `Humidity: ${weather.humidity}` : "", weather.wind ? ` \xB7 Wind: ${weather.wind}` : ""))), /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: s.tabs }, ["today", "upcoming"].map((t) => /* @__PURE__ */ import_react.default.createElement(
      import_react_native.Pressable,
      {
        key: t,
        style: [s.tabBtn, tab === t && s.tabActive, { borderColor: colors.border }],
        onPress: () => setTab(t)
      },
      /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.tabText, tab === t && s.tabTextActive, { color: tab === t ? "#fff" : colors.textMuted }] }, t === "today" ? `Today (${todayEvents.length})` : `Upcoming (${upcomingEvents.length})`)
    ))), !isLive ? /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [s.card, { backgroundColor: colors.surface, borderColor: colors.border }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: s.center }, /* @__PURE__ */ import_react.default.createElement(import_react_native.ActivityIndicator, { size: "small", color: ACCENT }), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.emptyText, { color: colors.textMuted }] }, "Loading schedule..."))) : events.length === 0 ? /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [s.card, { backgroundColor: colors.surface, borderColor: colors.border }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: s.center }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.emptyTitle, { color: colors.textMuted }] }, "No events ", tab === "today" ? "today" : "upcoming"), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.emptyText, { color: colors.textMuted }] }, "Your calendar is clear!"))) : events.map((ev, i) => {
      var _a;
      return /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { key: i, style: [s.eventCard, { backgroundColor: colors.surface, borderColor: colors.border }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: s.eventTime }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.eventStart, { color: colors.text }] }, ev.start_time || ev.start || ""), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.eventEnd, { color: colors.textMuted }] }, ev.end_time || ev.end || "")), /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: s.eventDetails }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.eventTitle, { color: colors.text }] }, ev.title || ev.name || "Untitled"), ev.location ? /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: s.eventLocation }, ev.location) : null, ((_a = ev.attendees) == null ? void 0 : _a.length) ? /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.eventAttendees, { color: colors.textMuted }] }, ev.attendees.join(", ")) : null));
    }));
  }
});
var s = import_react_native.StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14, paddingBottom: 12, borderBottomWidth: 1 },
  title: { fontSize: 18, fontWeight: "600" },
  liveBadge: { fontSize: 10, color: "#22c55e" },
  dateLabel: { fontSize: 13 },
  weatherStrip: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 14 },
  weatherTemp: { fontSize: 22, fontWeight: "600" },
  weatherInfo: { flex: 1 },
  weatherCond: { fontSize: 13 },
  weatherDetail: { fontSize: 11 },
  tabs: { flexDirection: "row", gap: 6, marginBottom: 14 },
  tabBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16, borderWidth: 1 },
  tabActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  tabText: { fontSize: 12 },
  tabTextActive: { color: "#fff" },
  card: { borderRadius: 10, borderWidth: 1, padding: 20, marginBottom: 10 },
  center: { alignItems: "center", paddingVertical: 12 },
  emptyTitle: { fontSize: 16, fontWeight: "500", marginBottom: 8 },
  emptyText: { fontSize: 13, marginTop: 4 },
  eventCard: { flexDirection: "row", gap: 14, borderRadius: 10, borderWidth: 1, padding: 14, marginBottom: 10 },
  eventTime: { minWidth: 60 },
  eventStart: { fontSize: 14, fontWeight: "600" },
  eventEnd: { fontSize: 12 },
  eventDetails: { flex: 1 },
  eventTitle: { fontSize: 14, fontWeight: "500", marginBottom: 4 },
  eventLocation: { fontSize: 12, color: "#818cf8", marginBottom: 2 },
  eventAttendees: { fontSize: 11 }
});

// rn-src/teach-panel.tsx
var import_react2 = __toESM(require("react"));
var import_react_native2 = require("react-native");
var import_plugin_sdk2 = require("@adas/plugin-sdk");
var CONNECTOR = "memory-mcp";
var NOISE_TAGS = /* @__PURE__ */ new Set(["taught", "rule", "rules", "memory", "preference", "behavior"]);
function TeachPanelComponent({ bridge, native, theme }) {
  const api = (0, import_plugin_sdk2.useApi)(bridge);
  const [rules, setRules] = (0, import_react2.useState)([]);
  const [counts, setCounts] = (0, import_react2.useState)({ total: 0, active: 0, inactive: 0 });
  const [isLive, setIsLive] = (0, import_react2.useState)(false);
  const [deleteTarget, setDeleteTarget] = (0, import_react2.useState)(null);
  const loadData = (0, import_react2.useCallback)(() => __async(null, null, function* () {
    try {
      const listRes = yield api.call("memory.list", { limit: 200 }, CONNECTOR);
      const list = typeof listRes === "string" ? JSON.parse(listRes) : listRes;
      const allMemories = (list == null ? void 0 : list.memories) || [];
      const ruleMemories = allMemories.filter((m) => m.type === "rule");
      const parsed = ruleMemories.map((m) => {
        let p = {};
        if (typeof m.content === "string" && m.content.trim().startsWith("{")) {
          try {
            p = JSON.parse(m.content);
          } catch (e) {
          }
        }
        const description = p.description || p.rule_name || p.name || (typeof m.content === "string" ? m.content : "") || m.context || "";
        const rawTags = Array.isArray(m.tags) ? m.tags : m.tags ? String(m.tags).split(",") : [];
        const cleanTags = rawTags.map((t) => t.trim().toLowerCase()).filter((t) => t && !NOISE_TAGS.has(t));
        return {
          id: m.id,
          description,
          active: m.active !== false,
          tags: cleanTags,
          raw: m
        };
      });
      const activeCount = parsed.filter((r) => r.active).length;
      setCounts({ total: parsed.length, active: activeCount, inactive: parsed.length - activeCount });
      setRules(parsed);
      setIsLive(true);
    } catch (e) {
      setIsLive(true);
    }
  }), [api]);
  (0, import_react2.useEffect)(() => {
    const timer = setTimeout(loadData, 300);
    return () => clearTimeout(timer);
  }, [loadData]);
  const toggleRule = (0, import_react2.useCallback)((rule) => __async(null, null, function* () {
    var _a, _b, _c, _d;
    setRules((prev) => prev.map((r) => r.id === rule.id ? __spreadProps(__spreadValues({}, r), { active: !r.active }) : r));
    setCounts((prev) => __spreadProps(__spreadValues({}, prev), {
      active: prev.active + (rule.active ? -1 : 1),
      inactive: prev.inactive + (rule.active ? 1 : -1)
    }));
    try {
      yield api.call("memory.update", { id: rule.id, active: !rule.active }, CONNECTOR);
      (_b = (_a = native == null ? void 0 : native.haptics) == null ? void 0 : _a.selection) == null ? void 0 : _b.call(_a);
    } catch (e) {
      setRules((prev) => prev.map((r) => r.id === rule.id ? __spreadProps(__spreadValues({}, r), { active: rule.active }) : r));
      setCounts((prev) => __spreadProps(__spreadValues({}, prev), {
        active: prev.active + (rule.active ? 1 : -1),
        inactive: prev.inactive + (rule.active ? -1 : 1)
      }));
      (_d = (_c = native == null ? void 0 : native.haptics) == null ? void 0 : _c.error) == null ? void 0 : _d.call(_c);
    }
  }), [api, native]);
  const doDelete = (0, import_react2.useCallback)(() => __async(null, null, function* () {
    var _a, _b, _c, _d;
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    setRules((prev) => prev.filter((r) => r.id !== target.id));
    setCounts((prev) => __spreadProps(__spreadValues({}, prev), {
      total: prev.total - 1,
      active: prev.active - (target.active ? 1 : 0),
      inactive: prev.inactive - (target.active ? 0 : 1)
    }));
    try {
      yield api.call("memory.delete", { id: target.id }, CONNECTOR);
      (_b = (_a = native == null ? void 0 : native.haptics) == null ? void 0 : _a.notification) == null ? void 0 : _b.call(_a, "success");
    } catch (e) {
      (_d = (_c = native == null ? void 0 : native.haptics) == null ? void 0 : _c.error) == null ? void 0 : _d.call(_c);
      yield loadData();
    }
  }), [deleteTarget, api, native, loadData]);
  const colors = (theme == null ? void 0 : theme.colors) || {
    bg: "#FAF6EE",
    text: "#1a1410",
    textMuted: "#9a8870",
    surface: "#F2EADC",
    border: "rgba(26,20,16,0.08)",
    error: "#C15545",
    success: "#5A8A5C"
  };
  return /* @__PURE__ */ import_react2.default.createElement(import_react_native2.ScrollView, { style: [s2.container, { backgroundColor: colors.bg }] }, /* @__PURE__ */ import_react2.default.createElement(import_react_native2.View, { style: s2.header }, /* @__PURE__ */ import_react2.default.createElement(import_react_native2.Text, { style: [s2.title, { color: colors.text }] }, "Taught Rules ", isLive && /* @__PURE__ */ import_react2.default.createElement(import_react_native2.Text, { style: s2.liveBadge }, "\u25CF", " LIVE")), isLive && /* @__PURE__ */ import_react2.default.createElement(import_react_native2.View, { style: s2.statsRow }, /* @__PURE__ */ import_react2.default.createElement(import_react_native2.Text, { style: s2.statActive }, counts.active || 0, " active"), (counts.inactive || 0) > 0 && /* @__PURE__ */ import_react2.default.createElement(import_react_native2.Text, { style: s2.statInactive }, counts.inactive, " disabled"))), !isLive ? /* @__PURE__ */ import_react2.default.createElement(import_react_native2.View, { style: [s2.card, { backgroundColor: colors.surface, borderColor: colors.border }] }, /* @__PURE__ */ import_react2.default.createElement(import_react_native2.View, { style: s2.center }, /* @__PURE__ */ import_react2.default.createElement(import_react_native2.ActivityIndicator, { size: "small", color: "#2563eb" }), /* @__PURE__ */ import_react2.default.createElement(import_react_native2.Text, { style: [s2.emptyText, { color: colors.textMuted }] }, "Loading rules..."))) : rules.length === 0 ? /* @__PURE__ */ import_react2.default.createElement(import_react_native2.View, { style: [s2.card, { backgroundColor: colors.surface, borderColor: colors.border }] }, /* @__PURE__ */ import_react2.default.createElement(import_react_native2.View, { style: s2.center }, /* @__PURE__ */ import_react2.default.createElement(import_react_native2.Text, { style: [s2.emptyTitle, { color: colors.textMuted }] }, "No rules yet"), /* @__PURE__ */ import_react2.default.createElement(import_react_native2.Text, { style: [s2.emptyText, { color: colors.textMuted }] }, "Teach your assistant by saying things like:", "\n", '"When my boss calls during a meeting, always ring through"', "\n", '"Never schedule meetings before 10am"'))) : rules.map((rule) => /* @__PURE__ */ import_react2.default.createElement(
    import_react_native2.Pressable,
    {
      key: String(rule.id),
      onLongPress: () => {
        var _a, _b;
        (_b = (_a = native == null ? void 0 : native.haptics) == null ? void 0 : _a.selection) == null ? void 0 : _b.call(_a);
        setDeleteTarget(rule);
      },
      delayLongPress: 500,
      style: [s2.ruleCard, { backgroundColor: colors.surface, borderColor: colors.border, opacity: rule.active ? 1 : 0.5 }]
    },
    /* @__PURE__ */ import_react2.default.createElement(import_react_native2.View, { style: s2.ruleTop }, /* @__PURE__ */ import_react2.default.createElement(import_react_native2.Text, { style: [s2.ruleDesc, { color: colors.text }] }, rule.description), /* @__PURE__ */ import_react2.default.createElement(import_react_native2.View, { style: { alignItems: "center" } }, /* @__PURE__ */ import_react2.default.createElement(
      import_react_native2.Switch,
      {
        value: rule.active,
        onValueChange: () => toggleRule(rule),
        trackColor: { false: "#374151", true: "#22c55e" },
        thumbColor: "#fff"
      }
    ), /* @__PURE__ */ import_react2.default.createElement(import_react_native2.Text, { style: { fontSize: 10, color: rule.active ? "#22c55e" : "#f59e0b", marginTop: 2 } }, rule.active ? "active" : "disabled"))),
    rule.tags.length > 0 && /* @__PURE__ */ import_react2.default.createElement(import_react_native2.View, { style: s2.tagRow }, rule.tags.slice(0, 3).map((t, i) => /* @__PURE__ */ import_react2.default.createElement(import_react_native2.View, { key: i, style: s2.tag }, /* @__PURE__ */ import_react2.default.createElement(import_react_native2.Text, { style: [s2.tagText, { color: colors.textMuted }] }, t))))
  )), /* @__PURE__ */ import_react2.default.createElement(import_react_native2.Modal, { visible: !!deleteTarget, transparent: true, animationType: "fade" }, /* @__PURE__ */ import_react2.default.createElement(import_react_native2.View, { style: s2.overlay }, /* @__PURE__ */ import_react2.default.createElement(import_react_native2.View, { style: [s2.confirmBox, { backgroundColor: colors.surface, borderColor: colors.border }] }, /* @__PURE__ */ import_react2.default.createElement(import_react_native2.Text, { style: [s2.confirmText, { color: colors.text }] }, "Delete this rule?", "\n", /* @__PURE__ */ import_react2.default.createElement(import_react_native2.Text, { style: s2.confirmBold }, (deleteTarget == null ? void 0 : deleteTarget.description) || "")), /* @__PURE__ */ import_react2.default.createElement(import_react_native2.View, { style: s2.confirmBtns }, /* @__PURE__ */ import_react2.default.createElement(import_react_native2.Pressable, { style: [s2.cancelBtn, { backgroundColor: colors.border }], onPress: () => setDeleteTarget(null) }, /* @__PURE__ */ import_react2.default.createElement(import_react_native2.Text, { style: [s2.cancelBtnText, { color: colors.text }] }, "Cancel")), /* @__PURE__ */ import_react2.default.createElement(import_react_native2.Pressable, { style: s2.confirmDeleteBtn, onPress: doDelete }, /* @__PURE__ */ import_react2.default.createElement(import_react_native2.Text, { style: s2.confirmDeleteText }, "Delete")))))));
}
var teach_panel_default = {
  id: "teach-panel",
  type: "ui",
  version: "1.0.0",
  capabilities: { haptics: true },
  Component: TeachPanelComponent
};
var s2 = import_react_native2.StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title: { fontSize: 18, fontWeight: "600" },
  liveBadge: { fontSize: 10, color: "#22c55e" },
  statsRow: { flexDirection: "row", gap: 12 },
  statActive: { fontSize: 13, color: "#22c55e" },
  statInactive: { fontSize: 13, color: "#f59e0b" },
  card: { borderRadius: 10, borderWidth: 1, padding: 20, marginBottom: 10 },
  center: { alignItems: "center", paddingVertical: 16 },
  emptyTitle: { fontSize: 16, fontWeight: "500", marginBottom: 8 },
  emptyText: { fontSize: 13, textAlign: "center", lineHeight: 20, marginTop: 4 },
  ruleCard: { borderRadius: 10, borderWidth: 1, padding: 14, marginBottom: 10 },
  ruleTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  ruleDesc: { fontSize: 13, flex: 1, marginRight: 12 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  tag: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, backgroundColor: "transparent" },
  tagText: { fontSize: 11 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center" },
  confirmBox: { borderRadius: 12, borderWidth: 1, padding: 20, width: 300 },
  confirmText: { fontSize: 14, textAlign: "center", marginBottom: 16 },
  confirmBold: { fontWeight: "600" },
  confirmBtns: { flexDirection: "row", gap: 8, justifyContent: "center" },
  cancelBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 6 },
  cancelBtnText: { fontSize: 13, fontWeight: "500" },
  confirmDeleteBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 6, backgroundColor: "#ef4444" },
  confirmDeleteText: { fontSize: 13, fontWeight: "500", color: "#fff" }
});

// rn-src/memories-panel.tsx
var import_react3 = __toESM(require("react"));
var import_react_native3 = require("react-native");
var import_plugin_sdk3 = require("@adas/plugin-sdk");
var CONNECTOR2 = "memory-mcp";
var PROFILE_LABELS = {
  name: "Name",
  timezone: "Timezone",
  location: "Location",
  language: "Language",
  email: "Email",
  phone: "Phone",
  birthday: "Birthday",
  occupation: "Occupation"
};
var GARBAGE_VALUES = /* @__PURE__ */ new Set(["asking", "unknown", "null", "undefined", "none", "n/a", "?", ""]);
var GARBAGE_RE = /^(asking|detecting|checking|updating|setting|getting|fetching)/i;
function formatDate(d) {
  if (!d) return "";
  try {
    const date = new Date(d.replace(" ", "T"));
    const diff = Date.now() - date.getTime();
    if (diff < 864e5) return "Today";
    if (diff < 1728e5) return "Yesterday";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch (e) {
    return "";
  }
}
function parseContent(raw) {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) {
    try {
      const p = JSON.parse(trimmed);
      if (p.description) return p.description;
      if (p.rule_name) return p.rule_name;
      if (p.name && typeof p.name === "string") return p.name;
      if (p.field && p.value !== void 0) {
        const label = PROFILE_LABELS[p.field] || p.field.replace(/_/g, " ");
        return `${label}: ${p.value}`;
      }
      const keys = Object.keys(p);
      if (keys.length === 1) {
        const k = keys[0];
        const v = p[k];
        if (typeof v === "string" || typeof v === "number") {
          const label = k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
          return `${label}: ${v}`;
        }
      }
      if (keys.length <= 4 && keys.every((k) => typeof p[k] === "string" || typeof p[k] === "number" || typeof p[k] === "boolean")) {
        return keys.filter((k) => !["active", "confidence", "source"].includes(k)).map((k) => {
          const label = k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
          return `${label}: ${p[k]}`;
        }).join("\n");
      }
    } catch (e) {
    }
  }
  return raw;
}
function isGarbageProfileValue(value) {
  if (!value || value.length < 2) return true;
  if (GARBAGE_VALUES.has(value.toLowerCase())) return true;
  if (GARBAGE_RE.test(value)) return true;
  return false;
}
function MemoriesPanel({ bridge, native, theme, props: engineProps }) {
  const api = (0, import_plugin_sdk3.useApi)(bridge);
  const [loading, setLoading] = (0, import_react3.useState)(true);
  const [profile, setProfile] = (0, import_react3.useState)({});
  const [preferences, setPreferences] = (0, import_react3.useState)([]);
  const [facts, setFacts] = (0, import_react3.useState)([]);
  const [instructions, setInstructions] = (0, import_react3.useState)([]);
  const [totalMemories, setTotalMemories] = (0, import_react3.useState)(0);
  const [rulesCount, setRulesCount] = (0, import_react3.useState)(0);
  const [deleteTarget, setDeleteTarget] = (0, import_react3.useState)(null);
  const [expandedSection, setExpandedSection] = (0, import_react3.useState)("preferences");
  const initialAddOpen = !!(engineProps == null ? void 0 : engineProps.autoOpenAdd);
  const initialAddText = typeof (engineProps == null ? void 0 : engineProps.prefillText) === "string" ? engineProps.prefillText : "";
  const [addOpen, setAddOpen] = (0, import_react3.useState)(initialAddOpen);
  const [addText, setAddText] = (0, import_react3.useState)(initialAddText);
  const [addBusy, setAddBusy] = (0, import_react3.useState)(false);
  const [errorMsg, setErrorMsg] = (0, import_react3.useState)(null);
  const c = (theme == null ? void 0 : theme.colors) || {
    bgPrimary: "#FAF6EE",
    bgSecondary: "#F2EADC",
    border: "rgba(26,20,16,0.06)",
    borderHover: "rgba(26,20,16,0.14)",
    textPrimary: "#1a1410",
    textSecondary: "#6b5a47",
    textMuted: "#9a8870",
    accent: "#FF7A28",
    accentSoft: "rgba(255,122,40,0.10)",
    accentHover: "#E0680E"
  };
  const palette = {
    bg: c.bgPrimary || c.bg || "#FAF6EE",
    surface: c.bgSecondary || c.surface || "#F2EADC",
    border: c.border || "rgba(26,20,16,0.06)",
    borderStrong: c.borderHover || c.border || "rgba(26,20,16,0.14)",
    text: c.textPrimary || c.text || "#1a1410",
    textSoft: c.textSecondary || c.textMuted || "#6b5a47",
    textMuted: c.textMuted || "#9a8870",
    accent: c.accent || "#FF7A28",
    accentSoft: c.accentSoft || "rgba(255,122,40,0.10)",
    accentDeep: c.accentHover || "#E0680E"
  };
  const load = (0, import_react3.useCallback)(() => __async(null, null, function* () {
    var _a, _b, _c;
    try {
      const raw = yield api.call("memory.userProfile", {}, CONNECTOR2);
      let data = raw;
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch (e) {
        }
      }
      if ((_b = (_a = data == null ? void 0 : data.content) == null ? void 0 : _a[0]) == null ? void 0 : _b.text) {
        try {
          data = JSON.parse(data.content[0].text);
        } catch (e) {
        }
      }
      const rawProfile = (data == null ? void 0 : data.profile) || {};
      const cleanProfile = {};
      for (const [k, v] of Object.entries(rawProfile)) {
        if (typeof v === "string" && !isGarbageProfileValue(v)) {
          cleanProfile[k] = v;
        }
      }
      setProfile(cleanProfile);
      setPreferences((data == null ? void 0 : data.preferences) || []);
      setFacts((data == null ? void 0 : data.facts) || []);
      setInstructions((data == null ? void 0 : data.instructions) || []);
      setTotalMemories((data == null ? void 0 : data.total_memories) || 0);
      setRulesCount(((_c = data == null ? void 0 : data.rules) == null ? void 0 : _c.active) || 0);
    } catch (e) {
      console.warn("[memories-panel] load failed:", e);
    } finally {
      setLoading(false);
    }
  }), [api]);
  (0, import_react3.useEffect)(() => {
    load();
  }, [load]);
  const doDelete = () => __async(null, null, function* () {
    var _a, _b, _c, _d;
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    try {
      yield api.call("memory.delete", { id: target.id }, CONNECTOR2);
      (_b = (_a = native == null ? void 0 : native.haptics) == null ? void 0 : _a.notification) == null ? void 0 : _b.call(_a, "success");
      yield load();
    } catch (e) {
      (_d = (_c = native == null ? void 0 : native.haptics) == null ? void 0 : _c.error) == null ? void 0 : _d.call(_c);
    }
  });
  const openAdd = () => {
    var _a, _b;
    (_b = (_a = native == null ? void 0 : native.haptics) == null ? void 0 : _a.selection) == null ? void 0 : _b.call(_a);
    setAddText("");
    setErrorMsg(null);
    setAddOpen(true);
  };
  const submitAdd = () => __async(null, null, function* () {
    var _a, _b, _c, _d;
    const text = addText.trim();
    if (!text || addBusy) return;
    setAddBusy(true);
    setErrorMsg(null);
    try {
      yield api.call("memory.add", { content: text }, CONNECTOR2);
      (_b = (_a = native == null ? void 0 : native.haptics) == null ? void 0 : _a.notification) == null ? void 0 : _b.call(_a, "success");
      setAddOpen(false);
      setAddText("");
      yield load();
    } catch (e) {
      const msg = (e == null ? void 0 : e.message) || String(e);
      console.warn("[memories-panel] add failed:", msg);
      (_d = (_c = native == null ? void 0 : native.haptics) == null ? void 0 : _c.error) == null ? void 0 : _d.call(_c);
      setErrorMsg("Couldn\u2019t save. Try telling me in chat instead.");
    } finally {
      setAddBusy(false);
    }
  });
  const toggleSection = (section) => {
    var _a, _b;
    (_b = (_a = native == null ? void 0 : native.haptics) == null ? void 0 : _a.selection) == null ? void 0 : _b.call(_a);
    setExpandedSection((prev) => prev === section ? null : section);
  };
  if (loading) {
    return /* @__PURE__ */ import_react3.default.createElement(import_react_native3.View, { style: [s3.container, { backgroundColor: palette.bg }] }, /* @__PURE__ */ import_react3.default.createElement(import_react_native3.ActivityIndicator, { color: palette.accent, style: { marginTop: 60 } }));
  }
  const profileKeys = Object.keys(profile);
  const hasProfile = profileKeys.length > 0;
  const isEmpty = !hasProfile && preferences.length === 0 && facts.length === 0 && instructions.length === 0;
  const renderMemoryCard = (item) => {
    const parsed = parseContent(item.content);
    return /* @__PURE__ */ import_react3.default.createElement(
      import_react_native3.Pressable,
      {
        key: item.id,
        onLongPress: () => {
          var _a, _b;
          (_b = (_a = native == null ? void 0 : native.haptics) == null ? void 0 : _a.selection) == null ? void 0 : _b.call(_a);
          setDeleteTarget(item);
        },
        delayLongPress: 500,
        style: [s3.itemCard, { backgroundColor: palette.surface }]
      },
      /* @__PURE__ */ import_react3.default.createElement(import_react_native3.Text, { style: [s3.itemContent, { color: palette.text }], numberOfLines: 4 }, parsed),
      item.context ? /* @__PURE__ */ import_react3.default.createElement(import_react_native3.Text, { style: [s3.itemContext, { color: palette.textMuted }], numberOfLines: 2 }, item.context) : null,
      item.created_at ? /* @__PURE__ */ import_react3.default.createElement(import_react_native3.Text, { style: [s3.itemDate, { color: palette.textMuted }] }, formatDate(item.created_at)) : null
    );
  };
  const renderSection = (title, key, items) => {
    if (items.length === 0) return null;
    const isOpen = expandedSection === key;
    return /* @__PURE__ */ import_react3.default.createElement(import_react_native3.View, { key, style: { marginBottom: 8 } }, /* @__PURE__ */ import_react3.default.createElement(import_react_native3.Pressable, { onPress: () => toggleSection(key), style: s3.sectionHeader }, /* @__PURE__ */ import_react3.default.createElement(import_react_native3.Text, { style: [s3.sectionTitle, { color: palette.textMuted }] }, title.toUpperCase(), " \xB7 ", items.length), /* @__PURE__ */ import_react3.default.createElement(import_react_native3.Text, { style: { fontSize: 12, color: palette.textMuted } }, isOpen ? "\u25BE" : "\u25B8")), isOpen && /* @__PURE__ */ import_react3.default.createElement(import_react_native3.View, { style: { gap: 8 } }, items.map(renderMemoryCard)));
  };
  return /* @__PURE__ */ import_react3.default.createElement(import_react_native3.ScrollView, { style: [s3.container, { backgroundColor: palette.bg }], contentContainerStyle: { paddingBottom: 32 } }, isEmpty ? /* @__PURE__ */ import_react3.default.createElement(import_react_native3.View, { style: [s3.emptyCard, { backgroundColor: palette.surface }] }, /* @__PURE__ */ import_react3.default.createElement(import_react_native3.Text, { style: [s3.emptyTitle, { color: palette.textSoft }] }, "I don\u2019t know you yet"), /* @__PURE__ */ import_react3.default.createElement(import_react_native3.Text, { style: [s3.emptyText, { color: palette.textMuted }] }, "Tell me about yourself in chat, or tap below to teach me directly.")) : /* @__PURE__ */ import_react3.default.createElement(import_react3.default.Fragment, null, hasProfile && /* @__PURE__ */ import_react3.default.createElement(import_react_native3.View, { style: [s3.profileCard, { backgroundColor: palette.surface }] }, profile.name ? /* @__PURE__ */ import_react3.default.createElement(import_react_native3.View, { style: s3.profileHeader }, /* @__PURE__ */ import_react3.default.createElement(import_react_native3.View, { style: [s3.avatar, { backgroundColor: palette.accent }] }, /* @__PURE__ */ import_react3.default.createElement(import_react_native3.Text, { style: s3.avatarText }, profile.name[0].toUpperCase())), /* @__PURE__ */ import_react3.default.createElement(import_react_native3.View, { style: { flex: 1 } }, /* @__PURE__ */ import_react3.default.createElement(import_react_native3.Text, { style: [s3.profileName, { color: palette.text }] }, profile.name), profile.timezone ? /* @__PURE__ */ import_react3.default.createElement(import_react_native3.Text, { style: { fontSize: 13, color: palette.textMuted } }, profile.timezone) : null)) : null, /* @__PURE__ */ import_react3.default.createElement(import_react_native3.View, { style: [s3.profileFields, !profile.name && { marginTop: 0 }] }, profileKeys.filter((k) => profile.name ? k !== "name" && k !== "timezone" : true).map((k, i) => /* @__PURE__ */ import_react3.default.createElement(import_react_native3.View, { key: k, style: [s3.profileField, i > 0 && s3.profileFieldDivider, { borderTopColor: palette.border }] }, /* @__PURE__ */ import_react3.default.createElement(import_react_native3.Text, { style: [s3.profileLabel, { color: palette.textMuted }] }, PROFILE_LABELS[k] || k.replace(/_/g, " ")), /* @__PURE__ */ import_react3.default.createElement(import_react_native3.Text, { style: [s3.profileValue, { color: palette.text }], numberOfLines: 1 }, profile[k]))))), renderSection("Preferences", "preferences", preferences), renderSection("Facts", "facts", facts), renderSection("Instructions", "instructions", instructions), rulesCount > 0 && /* @__PURE__ */ import_react3.default.createElement(import_react_native3.Text, { style: [s3.rulesHint, { color: palette.textMuted }] }, rulesCount, " taught rules \u2192 see Teach panel")), /* @__PURE__ */ import_react3.default.createElement(
    import_react_native3.Pressable,
    {
      onPress: openAdd,
      style: [s3.addBtn, { borderColor: palette.borderStrong }]
    },
    /* @__PURE__ */ import_react3.default.createElement(import_react_native3.Text, { style: [s3.addText, { color: palette.textSoft }] }, "+ Tell Ada something to remember")
  ), /* @__PURE__ */ import_react3.default.createElement(import_react_native3.Modal, { visible: addOpen, transparent: true, animationType: "fade", onRequestClose: () => setAddOpen(false) }, /* @__PURE__ */ import_react3.default.createElement(import_react_native3.View, { style: s3.overlay }, /* @__PURE__ */ import_react3.default.createElement(import_react_native3.View, { style: [s3.addBox, { backgroundColor: palette.surface }] }, /* @__PURE__ */ import_react3.default.createElement(import_react_native3.Text, { style: [s3.addTitle, { color: palette.text }] }, "Tell Ada"), /* @__PURE__ */ import_react3.default.createElement(import_react_native3.Text, { style: [s3.addSubtitle, { color: palette.textMuted }] }, "Something to remember about you"), /* @__PURE__ */ import_react3.default.createElement(
    import_react_native3.TextInput,
    {
      autoFocus: true,
      multiline: true,
      value: addText,
      onChangeText: setAddText,
      placeholder: "e.g. I prefer window seats",
      placeholderTextColor: palette.textMuted,
      style: [s3.addInput, { color: palette.text, borderColor: palette.border, backgroundColor: palette.bg }],
      editable: !addBusy
    }
  ), errorMsg ? /* @__PURE__ */ import_react3.default.createElement(import_react_native3.Text, { style: [s3.errorText, { color: palette.accentDeep }] }, errorMsg) : null, /* @__PURE__ */ import_react3.default.createElement(import_react_native3.View, { style: s3.addBtns }, /* @__PURE__ */ import_react3.default.createElement(
    import_react_native3.Pressable,
    {
      onPress: () => {
        setAddOpen(false);
        setErrorMsg(null);
      },
      disabled: addBusy,
      style: [s3.cancelBtn, { backgroundColor: palette.border }]
    },
    /* @__PURE__ */ import_react3.default.createElement(import_react_native3.Text, { style: { color: palette.text, fontSize: 14, fontWeight: "500" } }, "Cancel")
  ), /* @__PURE__ */ import_react3.default.createElement(
    import_react_native3.Pressable,
    {
      onPress: submitAdd,
      disabled: !addText.trim() || addBusy,
      style: [s3.saveBtn, {
        backgroundColor: addText.trim() && !addBusy ? palette.accent : palette.borderStrong,
        opacity: addText.trim() && !addBusy ? 1 : 0.6
      }]
    },
    addBusy ? /* @__PURE__ */ import_react3.default.createElement(import_react_native3.ActivityIndicator, { color: "#fff" }) : /* @__PURE__ */ import_react3.default.createElement(import_react_native3.Text, { style: { color: "#fff", fontSize: 14, fontWeight: "600" } }, "Save")
  ))))), /* @__PURE__ */ import_react3.default.createElement(import_react_native3.Modal, { visible: !!deleteTarget, transparent: true, animationType: "fade" }, /* @__PURE__ */ import_react3.default.createElement(import_react_native3.View, { style: s3.overlay }, /* @__PURE__ */ import_react3.default.createElement(import_react_native3.View, { style: [s3.confirmBox, { backgroundColor: palette.surface }] }, /* @__PURE__ */ import_react3.default.createElement(import_react_native3.Text, { style: [s3.confirmText, { color: palette.text }] }, "Forget this?", "\n", /* @__PURE__ */ import_react3.default.createElement(import_react_native3.Text, { style: { fontWeight: "600" } }, parseContent((deleteTarget == null ? void 0 : deleteTarget.content) || ""))), /* @__PURE__ */ import_react3.default.createElement(import_react_native3.View, { style: s3.addBtns }, /* @__PURE__ */ import_react3.default.createElement(import_react_native3.Pressable, { onPress: () => setDeleteTarget(null), style: [s3.cancelBtn, { backgroundColor: palette.border }] }, /* @__PURE__ */ import_react3.default.createElement(import_react_native3.Text, { style: { color: palette.text, fontSize: 14, fontWeight: "500" } }, "Keep")), /* @__PURE__ */ import_react3.default.createElement(import_react_native3.Pressable, { onPress: doDelete, style: [s3.saveBtn, { backgroundColor: palette.accent }] }, /* @__PURE__ */ import_react3.default.createElement(import_react_native3.Text, { style: { color: "#fff", fontSize: 14, fontWeight: "600" } }, "Forget")))))));
}
var memories_panel_default = {
  id: "memories-panel",
  type: "ui",
  version: "1.0.0",
  Component: MemoriesPanel
};
var s3 = import_react_native3.StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 4 },
  // Profile card
  profileCard: { borderRadius: 18, padding: 18, marginBottom: 18 },
  profileHeader: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 4 },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 18, fontWeight: "600" },
  profileName: { fontSize: 17, fontWeight: "600", letterSpacing: -0.2 },
  profileFields: { marginTop: 12 },
  profileField: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, gap: 12 },
  profileFieldDivider: { borderTopWidth: 1 },
  profileLabel: { fontSize: 12, fontWeight: "600", letterSpacing: 0.4, width: 80 },
  profileValue: { flex: 1, fontSize: 14, fontWeight: "500", textAlign: "right" },
  // Section
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginTop: 6
  },
  sectionTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 1.2 },
  itemCard: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  itemContent: { fontSize: 14, fontWeight: "400", lineHeight: 20 },
  itemContext: { fontSize: 12, fontStyle: "italic", marginTop: 4, lineHeight: 17 },
  itemDate: { fontSize: 11, marginTop: 6 },
  rulesHint: { fontSize: 12, textAlign: "center", fontStyle: "italic", marginTop: 16, marginBottom: 4 },
  // Empty
  emptyCard: { borderRadius: 18, padding: 28, alignItems: "center", marginTop: 16 },
  emptyTitle: { fontSize: 16, fontWeight: "600", marginBottom: 10 },
  emptyText: { fontSize: 13, textAlign: "center", lineHeight: 20 },
  // Add button
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 14,
    borderStyle: "dashed"
  },
  addText: { fontSize: 14, fontWeight: "500" },
  // Modals
  overlay: { flex: 1, backgroundColor: "rgba(26,20,16,0.55)", justifyContent: "center", alignItems: "center", padding: 24 },
  addBox: { borderRadius: 20, padding: 22, width: "100%", maxWidth: 360 },
  addTitle: { fontSize: 18, fontWeight: "600", marginBottom: 4 },
  addSubtitle: { fontSize: 13, marginBottom: 14 },
  addInput: {
    minHeight: 80,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 12,
    textAlignVertical: "top"
  },
  errorText: { fontSize: 13, marginBottom: 12 },
  addBtns: { flexDirection: "row", gap: 10 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  saveBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  confirmBox: { borderRadius: 20, padding: 22, width: "100%", maxWidth: 340 },
  confirmText: { fontSize: 14, textAlign: "center", marginBottom: 18, lineHeight: 20 }
});

// rn-src/pa-dashboard.tsx
var import_react4 = __toESM(require("react"));
var import_react_native4 = require("react-native");
var import_plugin_sdk4 = require("@adas/plugin-sdk");
var DEVICE2 = "mobile-device-mcp";
var MEMORY = "memory-mcp";
var ACCENT2 = "#2563eb";
var REL_EMOJI = {
  wife: "\u{1F49C}",
  husband: "\u{1F49C}",
  boss: "\u{1F4BC}",
  mother: "\u{1F49B}",
  father: "\u{1F49B}",
  son: "\u{1F466}",
  daughter: "\u{1F467}",
  friend: "\u{1F91D}",
  colleague: "\u{1F4BB}"
};
var TYPE_COLORS = {
  preference: { bg: "rgba(139,92,246,0.15)", text: "#8b5cf6" },
  fact: { bg: "rgba(37,99,235,0.15)", text: "#2563eb" },
  instruction: { bg: "rgba(245,158,11,0.15)", text: "#f59e0b" },
  pattern: { bg: "rgba(22,163,74,0.15)", text: "#16a34a" }
};
var pa_dashboard_default = import_plugin_sdk4.PluginSDK.register("pa-dashboard", {
  type: "ui",
  version: "1.0.0",
  capabilities: {},
  Component({ bridge, theme }) {
    const api = (0, import_plugin_sdk4.useApi)(bridge);
    const [todayEvents, setTodayEvents] = (0, import_react4.useState)([]);
    const [upcomingEvents, setUpcomingEvents] = (0, import_react4.useState)([]);
    const [memories, setMemories] = (0, import_react4.useState)([]);
    const [contacts, setContacts] = (0, import_react4.useState)([]);
    const [loading, setLoading] = (0, import_react4.useState)(true);
    const loadData = (0, import_react4.useCallback)(() => __async(null, null, function* () {
      const results = yield Promise.allSettled([
        api.call("device.calendar.today", {}, DEVICE2),
        api.call("device.calendar.upcoming", { days: 7 }, DEVICE2),
        api.call("memory.list", {}, MEMORY),
        api.call("device.contacts.search", { query: "" }, DEVICE2)
      ]);
      const parse = (r) => {
        if (!r || r.status !== "fulfilled") return null;
        const v = r.value;
        return typeof v === "string" ? JSON.parse(v) : v;
      };
      try {
        const today = parse(results[0]);
        if (today) setTodayEvents(today.events || (Array.isArray(today) ? today : []));
      } catch (e) {
      }
      try {
        const upcoming = parse(results[1]);
        if (upcoming) {
          let events = upcoming.events || [];
          if (upcoming.days) {
            events = [];
            upcoming.days.forEach((d) => (d.events || []).forEach((e) => events.push(__spreadProps(__spreadValues({}, e), { date: d.date }))));
          }
          setUpcomingEvents(events);
        }
      } catch (e) {
      }
      try {
        const mem = parse(results[2]);
        if (mem) setMemories((mem.memories || []).slice(0, 5));
      } catch (e) {
      }
      try {
        const cont = parse(results[3]);
        if (cont) setContacts((cont.contacts || []).slice(0, 5));
      } catch (e) {
      }
      setLoading(false);
    }), [api]);
    (0, import_react4.useEffect)(() => {
      const timer = setTimeout(loadData, 300);
      return () => clearTimeout(timer);
    }, [loadData]);
    const colors = (theme == null ? void 0 : theme.colors) || {
      bg: "#FAF6EE",
      text: "#1a1410",
      textMuted: "#9a8870",
      surface: "#F2EADC",
      border: "rgba(26,20,16,0.08)"
    };
    if (loading) {
      return /* @__PURE__ */ import_react4.default.createElement(import_react_native4.View, { style: [s4.container, s4.center, { backgroundColor: colors.bg }] }, /* @__PURE__ */ import_react4.default.createElement(import_react_native4.ActivityIndicator, { size: "small", color: ACCENT2 }), /* @__PURE__ */ import_react4.default.createElement(import_react_native4.Text, { style: [s4.loadingText, { color: colors.textMuted }] }, "Connecting..."));
    }
    return /* @__PURE__ */ import_react4.default.createElement(import_react_native4.ScrollView, { style: [s4.container, { backgroundColor: colors.bg }] }, /* @__PURE__ */ import_react4.default.createElement(Section, { icon: "\u{1F4C5}", title: "Today", badge: String(todayEvents.length), colors }, todayEvents.length === 0 ? /* @__PURE__ */ import_react4.default.createElement(import_react_native4.Text, { style: [s4.empty, { color: colors.textMuted }] }, "No events") : todayEvents.map((e, i) => /* @__PURE__ */ import_react4.default.createElement(import_react_native4.View, { key: i, style: [s4.eventRow, { backgroundColor: colors.surface, borderColor: colors.border }] }, /* @__PURE__ */ import_react4.default.createElement(import_react_native4.Text, { style: [s4.eventTime, { color: ACCENT2 }] }, e.start || ""), /* @__PURE__ */ import_react4.default.createElement(import_react_native4.View, { style: s4.eventBody }, /* @__PURE__ */ import_react4.default.createElement(import_react_native4.Text, { style: [s4.eventTitle, { color: colors.text }] }, e.title || "Untitled"), e.location ? /* @__PURE__ */ import_react4.default.createElement(import_react_native4.Text, { style: [s4.eventMeta, { color: colors.textMuted }] }, "\u{1F4CD}", " ", e.location) : null)))), /* @__PURE__ */ import_react4.default.createElement(Section, { icon: "\u{1F5D3}", title: "Upcoming", colors }, upcomingEvents.length === 0 ? /* @__PURE__ */ import_react4.default.createElement(import_react_native4.Text, { style: [s4.empty, { color: colors.textMuted }] }, "No upcoming events") : upcomingEvents.slice(0, 5).map((e, i) => /* @__PURE__ */ import_react4.default.createElement(import_react_native4.View, { key: i, style: [s4.eventRow, { backgroundColor: colors.surface, borderColor: colors.border }] }, /* @__PURE__ */ import_react4.default.createElement(import_react_native4.Text, { style: [s4.eventTime, { color: ACCENT2 }] }, e.start || ""), /* @__PURE__ */ import_react4.default.createElement(import_react_native4.View, { style: s4.eventBody }, /* @__PURE__ */ import_react4.default.createElement(import_react_native4.Text, { style: [s4.eventTitle, { color: colors.text }] }, e.title || "Untitled"), e.location ? /* @__PURE__ */ import_react4.default.createElement(import_react_native4.Text, { style: [s4.eventMeta, { color: colors.textMuted }] }, "\u{1F4CD}", " ", e.location) : null)))), /* @__PURE__ */ import_react4.default.createElement(Section, { icon: "\u{1F9E0}", title: "Memories", badge: String(memories.length), colors }, memories.length === 0 ? /* @__PURE__ */ import_react4.default.createElement(import_react_native4.Text, { style: [s4.empty, { color: colors.textMuted }] }, "No stored memories yet") : memories.map((m, i) => {
      const tc = TYPE_COLORS[m.type] || { bg: "rgba(37,99,235,0.15)", text: ACCENT2 };
      return /* @__PURE__ */ import_react4.default.createElement(import_react_native4.View, { key: i, style: [s4.memRow, { backgroundColor: colors.surface, borderColor: colors.border }] }, /* @__PURE__ */ import_react4.default.createElement(import_react_native4.View, { style: [s4.memTypeBadge, { backgroundColor: tc.bg }] }, /* @__PURE__ */ import_react4.default.createElement(import_react_native4.Text, { style: { fontSize: 10, fontWeight: "700", color: tc.text, textTransform: "uppercase" } }, m.type)), /* @__PURE__ */ import_react4.default.createElement(import_react_native4.Text, { style: [s4.memContent, { color: colors.text }], numberOfLines: 2 }, m.content));
    })), /* @__PURE__ */ import_react4.default.createElement(Section, { icon: "\u{1F4D2}", title: "Contacts", colors }, contacts.length === 0 ? /* @__PURE__ */ import_react4.default.createElement(import_react_native4.Text, { style: [s4.empty, { color: colors.textMuted }] }, "No contacts") : contacts.map((c, i) => /* @__PURE__ */ import_react4.default.createElement(import_react_native4.View, { key: i, style: [s4.contactRow, { backgroundColor: colors.surface, borderColor: colors.border }] }, /* @__PURE__ */ import_react4.default.createElement(import_react_native4.View, { style: [s4.avatar, { backgroundColor: colors.border }] }, /* @__PURE__ */ import_react4.default.createElement(import_react_native4.Text, { style: s4.avatarText }, REL_EMOJI[c.relationship || ""] || "\u{1F464}")), /* @__PURE__ */ import_react4.default.createElement(import_react_native4.View, null, /* @__PURE__ */ import_react4.default.createElement(import_react_native4.Text, { style: [s4.contactName, { color: colors.text }] }, c.name), /* @__PURE__ */ import_react4.default.createElement(import_react_native4.Text, { style: [s4.contactRel, { color: colors.textMuted }] }, c.relationship || "", c.phone ? ` \u2022 ${c.phone}` : ""))))));
  }
});
function Section({ icon, title, badge, colors, children }) {
  return /* @__PURE__ */ import_react4.default.createElement(import_react_native4.View, { style: s4.section }, /* @__PURE__ */ import_react4.default.createElement(import_react_native4.View, { style: [s4.sectionHeader, { borderBottomColor: colors.border }] }, /* @__PURE__ */ import_react4.default.createElement(import_react_native4.Text, { style: s4.sectionIcon }, icon), /* @__PURE__ */ import_react4.default.createElement(import_react_native4.Text, { style: [s4.sectionTitle, { color: colors.text }] }, title), badge ? /* @__PURE__ */ import_react4.default.createElement(import_react_native4.View, { style: s4.sectionBadge }, /* @__PURE__ */ import_react4.default.createElement(import_react_native4.Text, { style: s4.sectionBadgeText }, badge)) : null), children);
}
var s4 = import_react_native4.StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { justifyContent: "center", alignItems: "center" },
  loadingText: { fontSize: 13, marginTop: 8 },
  empty: { textAlign: "center", padding: 16, fontSize: 12 },
  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10, paddingBottom: 6, borderBottomWidth: 1 },
  sectionIcon: { fontSize: 16 },
  sectionTitle: { fontSize: 14, fontWeight: "600" },
  sectionBadge: { marginLeft: "auto", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: "rgba(37,99,235,0.15)" },
  sectionBadgeText: { fontSize: 11, fontWeight: "600", color: ACCENT2 },
  eventRow: { flexDirection: "row", gap: 10, padding: 10, borderRadius: 10, borderWidth: 1, marginBottom: 6 },
  eventTime: { minWidth: 48, fontSize: 12, fontWeight: "600", paddingTop: 1 },
  eventBody: { flex: 1 },
  eventTitle: { fontSize: 13, fontWeight: "600" },
  eventMeta: { fontSize: 11, marginTop: 2 },
  memRow: { padding: 10, borderRadius: 10, borderWidth: 1, marginBottom: 6 },
  memTypeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: "flex-start", marginBottom: 4 },
  memContent: { fontSize: 13 },
  contactRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 8, borderRadius: 10, borderWidth: 1, marginBottom: 4 },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 14 },
  contactName: { fontSize: 13, fontWeight: "600" },
  contactRel: { fontSize: 11 }
});

// rn-src/triggers-panel.tsx
var import_react5 = __toESM(require("react"));
var import_react_native5 = require("react-native");
var import_plugin_sdk5 = require("@adas/plugin-sdk");
function fmtTime(h, m) {
  const mm = m.toString().padStart(2, "0");
  const period = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${period}` : `${h12}:${mm}${period}`;
}
function humanizeSchedule(raw, cron) {
  if (!raw && !cron) return "On demand";
  if (raw) {
    const m = raw.match(/^PT?(\d+)([SMHDW])$/i);
    if (m) {
      const n = parseInt(m[1]);
      const unit = m[2].toUpperCase();
      const isTimeUnit = raw.startsWith("PT");
      if (unit === "S") return `Every ${n}s`;
      if (unit === "M" && isTimeUnit) return n === 1 ? "Every minute" : `Every ${n} min`;
      if (unit === "H") return n === 1 ? "Every hour" : `Every ${n} hours`;
      if (unit === "D") return n === 1 ? "Once a day" : `Every ${n} days`;
      if (unit === "M" && !isTimeUnit) return n === 1 ? "Once a month" : `Every ${n} months`;
      if (unit === "W") return n === 1 ? "Once a week" : `Every ${n} weeks`;
    }
  }
  if (cron) {
    const parts = cron.trim().split(/\s+/);
    if (parts.length === 5) {
      const [min, hour, dom, , dow] = parts;
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      if (dom !== "*" && hour !== "*" && min !== "*" && !isNaN(+hour) && !isNaN(+min)) {
        return `On day ${dom} at ${fmtTime(+hour, +min)}`;
      }
      if (dow !== "*" && hour !== "*" && min !== "*" && !isNaN(+hour) && !isNaN(+min)) {
        const dayName = days[parseInt(dow)] || dow;
        return `${dayName} at ${fmtTime(+hour, +min)}`;
      }
      if (hour !== "*" && min !== "*" && !isNaN(+hour) && !isNaN(+min)) {
        return `Once a day at ${fmtTime(+hour, +min)}`;
      }
      if (hour.includes(",") && min !== "*" && !isNaN(+min)) {
        const hours = hour.split(",").map((h) => h.trim()).filter((h) => !isNaN(+h)).map((h) => +h);
        if (hours.length >= 2) {
          return `Daily at ${hours.map((h) => fmtTime(h, +min)).join(" & ")}`;
        }
      }
      if (min.startsWith("*/")) return `Every ${min.slice(2)} min`;
      if (hour.startsWith("*/")) {
        const h = hour.slice(2);
        return `Every ${h} hour${h === "1" ? "" : "s"}`;
      }
    }
    return cron;
  }
  return raw || "On demand";
}
function humanizeOneTime(isoStr) {
  try {
    const d = new Date(isoStr);
    const now = /* @__PURE__ */ new Date();
    const diffMs = d.getTime() - now.getTime();
    if (diffMs < 0) return "Fired";
    const diffMin = Math.round(diffMs / 6e4);
    if (diffMin < 1) return "In a moment";
    if (diffMin < 60) return `In ${diffMin} min`;
    const t = fmtTime(d.getHours(), d.getMinutes());
    if (d.toDateString() === now.toDateString()) return `Today at ${t}`;
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow at ${t}`;
    const diffDays = Math.round(diffMs / 864e5);
    if (diffDays > 0 && diffDays < 7) {
      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      return `${days[d.getDay()]} at ${t}`;
    }
    const dd = d.getDate().toString().padStart(2, "0");
    const mm = (d.getMonth() + 1).toString().padStart(2, "0");
    const yy = d.getFullYear();
    return `On ${dd}/${mm}/${yy} at ${t}`;
  } catch (e) {
    return "Scheduled";
  }
}
function SoftToggle({ value, onPress, accent, off }) {
  return /* @__PURE__ */ import_react5.default.createElement(import_react_native5.Pressable, { onPress, hitSlop: 8, style: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: value ? accent : off,
    padding: 3,
    justifyContent: "center"
  } }, /* @__PURE__ */ import_react5.default.createElement(import_react_native5.View, { style: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#fff",
    alignSelf: value ? "flex-end" : "flex-start",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 }
  } }));
}
function TriggersPanel({ bridge, native, theme }) {
  const api = (0, import_plugin_sdk5.useApi)(bridge);
  const [triggers, setTriggers] = (0, import_react5.useState)([]);
  const [loading, setLoading] = (0, import_react5.useState)(true);
  const [deleteTarget, setDeleteTarget] = (0, import_react5.useState)(null);
  const c = (theme == null ? void 0 : theme.colors) || {
    bgPrimary: "#FAF6EE",
    bgSecondary: "#F2EADC",
    bgTertiary: "#EDE2CF",
    border: "rgba(26,20,16,0.06)",
    textPrimary: "#1a1410",
    textSecondary: "#6b5a47",
    textMuted: "#9a8870",
    accent: "#FF7A28",
    accentSoft: "rgba(255,122,40,0.10)"
  };
  const palette = {
    bg: c.bgPrimary || c.bg || "#FAF6EE",
    surface: c.bgSecondary || c.surface || "#F2EADC",
    surfaceMuted: c.bgTertiary || c.bgSecondary || "#EDE2CF",
    text: c.textPrimary || c.text || "#1a1410",
    textSoft: c.textSecondary || c.textMuted || "#6b5a47",
    textMuted: c.textMuted || "#9a8870",
    accent: c.accent || "#FF7A28",
    accentSoft: c.accentSoft || "rgba(255,122,40,0.10)",
    off: "rgba(26,20,16,0.10)"
  };
  const load = (0, import_react5.useCallback)(() => __async(null, null, function* () {
    try {
      const res = yield api.call("triggers.list", {});
      const allRaw = [...(res == null ? void 0 : res.static) || [], ...(res == null ? void 0 : res.dynamic) || []];
      const mapped = allRaw.map((t) => {
        var _a;
        const isDynamic = t.isDynamic === true;
        const scheduleType = t.scheduleType || null;
        const scheduleValue = t.scheduleValue || null;
        const isOneTime = scheduleType === "once";
        const fired = isOneTime && scheduleValue ? new Date(scheduleValue).getTime() < Date.now() : false;
        let humanSched;
        if (isOneTime && scheduleValue) {
          humanSched = humanizeOneTime(scheduleValue);
        } else {
          const everyVal = t.every || (scheduleType === "every" ? scheduleValue : null);
          const cronVal = t.cron || (scheduleType === "cron" ? scheduleValue : null);
          humanSched = humanizeSchedule(everyVal, cronVal);
        }
        const triggerId = String(t.triggerId || t._id || t.id || "");
        const skillSlug = t.skillSlug || t.skill || "";
        const uiKey = t.key || (skillSlug && triggerId ? `${skillSlug}:${triggerId}` : triggerId);
        const paused2 = !!t.paused;
        const enabled = t.enabled !== false && !paused2;
        return {
          id: uiKey,
          triggerId,
          description: t.description || t.name || ((_a = t.prompt) == null ? void 0 : _a.substring(0, 80)) || "Unnamed",
          humanSchedule: humanSched,
          skillSlug,
          enabled,
          paused: paused2,
          autoPausedReason: t.autoPausedReason || null,
          isDynamic,
          canDelete: isDynamic,
          prompt: t.prompt || "",
          scheduleType,
          scheduleValue,
          fired
        };
      });
      const visible = mapped.filter((t) => !t.fired);
      visible.sort((a, b) => a.enabled === b.enabled ? 0 : a.enabled ? -1 : 1);
      setTriggers(visible);
    } catch (e) {
      console.warn("[triggers-panel] load failed:", e);
    } finally {
      setLoading(false);
    }
  }), [api]);
  (0, import_react5.useEffect)(() => {
    load();
  }, [load]);
  const toggle = (t) => __async(null, null, function* () {
    var _a, _b, _c, _d;
    const next = !t.enabled;
    setTriggers((prev) => prev.map((x) => x.id === t.id ? __spreadProps(__spreadValues({}, x), { enabled: next }) : x));
    try {
      yield api.call("triggers.toggle", { skillSlug: t.skillSlug, triggerId: t.triggerId });
      (_b = (_a = native == null ? void 0 : native.haptics) == null ? void 0 : _a.selection) == null ? void 0 : _b.call(_a);
      setTimeout(() => {
        load();
      }, 600);
    } catch (e) {
      setTriggers((prev) => prev.map((x) => x.id === t.id ? __spreadProps(__spreadValues({}, x), { enabled: t.enabled }) : x));
      (_d = (_c = native == null ? void 0 : native.haptics) == null ? void 0 : _c.error) == null ? void 0 : _d.call(_c);
    }
  });
  const doDelete = () => __async(null, null, function* () {
    var _a, _b, _c, _d;
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    setTriggers((prev) => prev.filter((x) => x.id !== target.id));
    try {
      yield api.call("triggers.deleteDynamic", { triggerId: target.triggerId });
      (_b = (_a = native == null ? void 0 : native.haptics) == null ? void 0 : _a.selection) == null ? void 0 : _b.call(_a);
    } catch (e) {
      (_d = (_c = native == null ? void 0 : native.haptics) == null ? void 0 : _c.error) == null ? void 0 : _d.call(_c);
      load();
    }
  });
  const active = triggers.filter((t) => t.enabled);
  const paused = triggers.filter((t) => !t.enabled);
  if (loading) {
    return /* @__PURE__ */ import_react5.default.createElement(import_react_native5.View, { style: [s5.container, { backgroundColor: palette.bg }] }, /* @__PURE__ */ import_react5.default.createElement(import_react_native5.ActivityIndicator, { color: palette.accent, style: { marginTop: 60 } }));
  }
  const renderCard = (t, idx) => /* @__PURE__ */ import_react5.default.createElement(
    import_react_native5.View,
    {
      key: `${t.id || "trigger"}-${idx}`,
      style: [s5.card, { backgroundColor: t.enabled ? palette.surface : palette.surfaceMuted }]
    },
    t.canDelete ? /* @__PURE__ */ import_react5.default.createElement(
      import_react_native5.Pressable,
      {
        onPress: () => {
          var _a, _b;
          (_b = (_a = native == null ? void 0 : native.haptics) == null ? void 0 : _a.selection) == null ? void 0 : _b.call(_a);
          setDeleteTarget(t);
        },
        hitSlop: 12,
        style: s5.deleteCorner
      },
      /* @__PURE__ */ import_react5.default.createElement(import_react_native5.Text, { style: [s5.deleteCornerX, { color: palette.textMuted }] }, "\xD7")
    ) : null,
    /* @__PURE__ */ import_react5.default.createElement(import_react_native5.View, { style: s5.toggleAnchor, pointerEvents: "box-none" }, /* @__PURE__ */ import_react5.default.createElement(
      SoftToggle,
      {
        value: t.enabled,
        onPress: () => toggle(t),
        accent: palette.accent,
        off: palette.off
      }
    )),
    /* @__PURE__ */ import_react5.default.createElement(import_react_native5.Text, { style: [s5.cardDesc, { color: t.enabled ? palette.text : palette.textSoft }], numberOfLines: 2 }, t.description),
    /* @__PURE__ */ import_react5.default.createElement(import_react_native5.View, { style: s5.metaRow }, /* @__PURE__ */ import_react5.default.createElement(import_react_native5.Text, { style: [s5.metaText, { color: palette.textMuted }], numberOfLines: 1 }, "\u23F1  ", t.humanSchedule, "   \xB7   ", /* @__PURE__ */ import_react5.default.createElement(import_react_native5.Text, { style: { color: t.isDynamic ? palette.accent : palette.textMuted, fontWeight: "600" } }, t.isDynamic ? "personal" : "system"))),
    !t.enabled && t.autoPausedReason ? /* @__PURE__ */ import_react5.default.createElement(import_react_native5.View, { style: [s5.warnPill, { backgroundColor: palette.accentSoft }] }, /* @__PURE__ */ import_react5.default.createElement(import_react_native5.Text, { style: [s5.warnText, { color: palette.accent }], numberOfLines: 2 }, "\u26A0  ", "Auto-paused ", t.autoPausedReason === "jit_failed" ? "\u2014 kept retrying without progress" : t.autoPausedReason === "goal_failed" ? "\u2014 last 2 runs didn\u2019t reach the goal" : `(${t.autoPausedReason})`)) : null
  );
  const sectionLabel = (label) => /* @__PURE__ */ import_react5.default.createElement(import_react_native5.Text, { style: [s5.sectionLabel, { color: palette.textMuted }] }, label);
  return /* @__PURE__ */ import_react5.default.createElement(import_react_native5.ScrollView, { style: [s5.container, { backgroundColor: palette.bg }], contentContainerStyle: { paddingBottom: 32 } }, triggers.length === 0 ? /* @__PURE__ */ import_react5.default.createElement(import_react_native5.View, { style: s5.empty }, /* @__PURE__ */ import_react5.default.createElement(import_react_native5.Text, { style: [s5.emptyTitle, { color: palette.textSoft }] }, "No reminders yet"), /* @__PURE__ */ import_react5.default.createElement(import_react_native5.Text, { style: [s5.emptyText, { color: palette.textMuted }] }, "Try saying:", "\n", /* @__PURE__ */ import_react5.default.createElement(import_react_native5.Text, { style: { color: palette.text, fontStyle: "italic" } }, '"Remind me to call the dentist in 1 hour"'))) : /* @__PURE__ */ import_react5.default.createElement(import_react5.default.Fragment, null, active.length > 0 && /* @__PURE__ */ import_react5.default.createElement(import_react5.default.Fragment, null, sectionLabel(`Active \xB7 ${active.length}`), active.map((t, i) => renderCard(t, i))), paused.length > 0 && /* @__PURE__ */ import_react5.default.createElement(import_react5.default.Fragment, null, sectionLabel(`Paused \xB7 ${paused.length}`), paused.map((t, i) => renderCard(t, i + active.length))), /* @__PURE__ */ import_react5.default.createElement(import_react_native5.Text, { style: [s5.hint, { color: palette.textMuted }] }, "Tap \xD7 on a Personal reminder to delete it")), /* @__PURE__ */ import_react5.default.createElement(import_react_native5.Modal, { visible: !!deleteTarget, transparent: true, animationType: "fade" }, /* @__PURE__ */ import_react5.default.createElement(import_react_native5.View, { style: s5.overlay }, /* @__PURE__ */ import_react5.default.createElement(import_react_native5.View, { style: [s5.confirmBox, { backgroundColor: palette.surface }] }, /* @__PURE__ */ import_react5.default.createElement(import_react_native5.Text, { style: [s5.confirmText, { color: palette.text }] }, "Delete this reminder?", "\n", /* @__PURE__ */ import_react5.default.createElement(import_react_native5.Text, { style: { fontWeight: "600" } }, (deleteTarget == null ? void 0 : deleteTarget.description) || "")), /* @__PURE__ */ import_react5.default.createElement(import_react_native5.View, { style: s5.confirmBtns }, /* @__PURE__ */ import_react5.default.createElement(import_react_native5.Pressable, { onPress: () => setDeleteTarget(null), style: [s5.cancelBtn, { backgroundColor: palette.surfaceMuted }] }, /* @__PURE__ */ import_react5.default.createElement(import_react_native5.Text, { style: { color: palette.text, fontSize: 14, fontWeight: "500" } }, "Cancel")), /* @__PURE__ */ import_react5.default.createElement(import_react_native5.Pressable, { onPress: doDelete, style: [s5.deleteConfirmBtn, { backgroundColor: palette.accent }] }, /* @__PURE__ */ import_react5.default.createElement(import_react_native5.Text, { style: { color: "#fff", fontSize: 14, fontWeight: "600" } }, "Delete")))))));
}
var triggers_panel_default = {
  id: "triggers-panel",
  type: "ui",
  version: "1.0.0",
  Component: TriggersPanel
};
var s5 = import_react_native5.StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 4 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginTop: 18,
    marginBottom: 10,
    marginLeft: 4
  },
  card: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingLeft: 16,
    paddingRight: 64,
    // reserve right column for toggle/delete
    marginBottom: 8,
    position: "relative"
  },
  cardDesc: { fontSize: 15, fontWeight: "500", lineHeight: 20 },
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  metaText: { fontSize: 12, fontWeight: "400" },
  // Fixed top-right corner — Personal cards only
  deleteCorner: {
    position: "absolute",
    top: 6,
    right: 8,
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2
  },
  deleteCornerX: { fontSize: 18, lineHeight: 20, fontWeight: "400" },
  // Fixed right-center — every card
  toggleAnchor: {
    position: "absolute",
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    zIndex: 1
  },
  warnPill: {
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: "flex-start",
    maxWidth: "100%"
  },
  warnText: { fontSize: 11, fontWeight: "600", lineHeight: 15 },
  hint: { fontSize: 11, textAlign: "center", marginTop: 24, fontStyle: "italic" },
  empty: { alignItems: "center", paddingTop: 80, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 16, fontWeight: "500", marginBottom: 12 },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 22 },
  overlay: { flex: 1, backgroundColor: "rgba(26,20,16,0.55)", justifyContent: "center", alignItems: "center", padding: 32 },
  confirmBox: { borderRadius: 18, padding: 24, width: "100%", maxWidth: 320 },
  confirmText: { fontSize: 14, textAlign: "center", marginBottom: 20, lineHeight: 20 },
  confirmBtns: { flexDirection: "row", gap: 10 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  deleteConfirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center" }
});

// rn-src/home-layout-panel.tsx
var import_react6 = __toESM(require("react"));
var import_react_native6 = require("react-native");
var import_plugin_sdk6 = require("@adas/plugin-sdk");
var DOMAIN_ICONS = {
  light: "\u{1F4A1}",
  switch: "\u{1F50C}",
  climate: "\u{1F321}\uFE0F",
  lock: "\u{1F512}",
  cover: "\u{1F6AA}",
  media_player: "\u{1F4FA}",
  sensor: "\u{1F4CA}",
  fan: "\u{1F32C}\uFE0F",
  vacuum: "\u{1F9F9}",
  camera: "\u{1F4F7}"
};
function getDomain(eid) {
  return eid.split(".")[0];
}
function getIcon(eid) {
  return DOMAIN_ICONS[getDomain(eid)] || "\u2B55";
}
function isOn(eid, state) {
  const d = getDomain(eid);
  if (d === "lock") return state === "locked";
  if (d === "cover") return state === "open";
  if (d === "sensor" || d === "binary_sensor") return state !== "unavailable";
  return state !== "off" && state !== "unknown" && state !== "unavailable";
}
function stateLabel(eid, state) {
  const d = getDomain(eid);
  if (d === "lock") return state === "locked" ? "Locked" : "Unlocked";
  if (d === "cover") return state === "closed" ? "Closed" : "Open";
  if (d === "sensor") return state || "--";
  if (state === "on") return "On";
  if (state === "off") return "Off";
  return state ? state.charAt(0).toUpperCase() + state.slice(1) : "Unknown";
}
function isQuickControl(eid) {
  return ["light", "switch", "media_player", "fan", "climate"].includes(getDomain(eid));
}
function isClimate(eid) {
  const d = getDomain(eid);
  return d === "sensor" && (eid.includes("temperature") || eid.includes("humidity"));
}
function isSecurity(eid) {
  const d = getDomain(eid);
  return d === "lock" || d === "cover";
}
function haptic(native, type) {
  var _a, _b;
  try {
    (_b = (_a = native == null ? void 0 : native.haptics) == null ? void 0 : _a[type]) == null ? void 0 : _b.call(_a);
  } catch (e) {
  }
}
function HomeLayoutPanel({ bridge, native, theme }) {
  var _a;
  const api = (0, import_plugin_sdk6.useApi)(bridge);
  const [rooms, setRooms] = (0, import_react6.useState)([]);
  const [states, setStates] = (0, import_react6.useState)({});
  const [loading, setLoading] = (0, import_react6.useState)(true);
  const [refreshing, setRefreshing] = (0, import_react6.useState)(false);
  const [error, setError] = (0, import_react6.useState)(null);
  const [expandedRooms, setExpandedRooms] = (0, import_react6.useState)(/* @__PURE__ */ new Set([0, 1]));
  const [providers, setProviders] = (0, import_react6.useState)({ HA: true });
  const c = theme.colors;
  const loadData = (0, import_react6.useCallback)((isRefresh = false) => __async(null, null, function* () {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const roomData = yield api.call("rooms.list", {});
      const roomList = roomData.rooms || [];
      setRooms(roomList);
      const entityIds = roomList.flatMap((r) => (r.devices || []).map((d) => d.entity_id));
      const stateResults = yield Promise.all(
        entityIds.map(
          (eid) => api.call("entity.state", { entity_id: eid }).then((s7) => [eid, { state: s7.state || "unknown", attrs: s7.attributes || {} }]).catch(() => [eid, { state: "unknown", attrs: {} }])
        )
      );
      const stateMap = {};
      for (const [eid, s7] of stateResults) stateMap[eid] = s7;
      setStates(stateMap);
      const prov = { HA: true };
      try {
        const hue = yield api.call("hue.status", {});
        prov.Hue = (hue == null ? void 0 : hue.connected) === true;
      } catch (e) {
        prov.Hue = false;
      }
      try {
        const tuya = yield api.call("tuya.status", {});
        prov.Tuya = (tuya == null ? void 0 : tuya.connected) === true;
      } catch (e) {
        prov.Tuya = false;
      }
      try {
        const goog = yield api.call("google.status", {});
        prov.Nest = (goog == null ? void 0 : goog.connected) === true;
      } catch (e) {
        prov.Nest = false;
      }
      setProviders(prov);
      setError(null);
    } catch (err) {
      setError(err.message || "Failed to load");
      haptic(native, "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }), [api, native]);
  (0, import_react6.useEffect)(() => {
    loadData();
  }, []);
  const toggleDevice = (0, import_react6.useCallback)((eid) => __async(null, null, function* () {
    var _a2;
    const domain = getDomain(eid);
    if (!["light", "switch", "fan", "media_player", "climate"].includes(domain)) return;
    haptic(native, "selection");
    const currentState = (_a2 = states[eid]) == null ? void 0 : _a2.state;
    const turnOn = !isOn(eid, currentState);
    const newState = turnOn ? "on" : "off";
    setStates((prev) => __spreadProps(__spreadValues({}, prev), { [eid]: __spreadProps(__spreadValues({}, prev[eid]), { state: newState }) }));
    try {
      yield api.call("services.call", {
        domain,
        service: turnOn ? "turn_on" : "turn_off",
        entity_id: eid
      });
      try {
        const fresh = yield api.call("entity.state", { entity_id: eid });
        setStates((prev) => __spreadProps(__spreadValues({}, prev), { [eid]: { state: fresh.state || newState, attrs: fresh.attributes || {} } }));
      } catch (e) {
      }
    } catch (e) {
      setStates((prev) => __spreadProps(__spreadValues({}, prev), { [eid]: __spreadProps(__spreadValues({}, prev[eid]), { state: currentState || "unknown" }) }));
      haptic(native, "error");
    }
  }), [api, states, native]);
  const toggleRoom = (idx) => {
    setExpandedRooms((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };
  const quickDevices = rooms.flatMap(
    (r) => (r.devices || []).filter((d) => isQuickControl(d.entity_id)).map((d) => __spreadProps(__spreadValues({}, d), { room: r.name, provider: "HA" }))
  ).slice(0, 8);
  const climateDevices = rooms.flatMap(
    (r) => (r.devices || []).filter((d) => isClimate(d.entity_id)).map((d) => __spreadProps(__spreadValues({}, d), { room: r.name }))
  );
  const securityDevices = rooms.flatMap(
    (r) => (r.devices || []).filter((d) => isSecurity(d.entity_id)).map((d) => __spreadProps(__spreadValues({}, d), { room: r.name }))
  );
  const onCount = Object.entries(states).filter(([eid, s7]) => isOn(eid, s7.state) && !eid.startsWith("sensor.")).length;
  if (loading) {
    return /* @__PURE__ */ import_react6.default.createElement(import_react_native6.View, { style: [s6.center, { backgroundColor: c.bg }] }, /* @__PURE__ */ import_react6.default.createElement(import_react_native6.ActivityIndicator, { size: "large", color: c.accent }), /* @__PURE__ */ import_react6.default.createElement(import_react_native6.Text, { style: [s6.loadingText, { color: c.textMuted }] }, "Loading home..."));
  }
  if (error && rooms.length === 0) {
    return /* @__PURE__ */ import_react6.default.createElement(import_react_native6.View, { style: [s6.center, { backgroundColor: c.bg }] }, /* @__PURE__ */ import_react6.default.createElement(import_react_native6.Text, { style: { color: c.error, fontSize: 16 } }, "\u26A0 ", error), /* @__PURE__ */ import_react6.default.createElement(import_react_native6.Pressable, { style: [s6.retryBtn, { borderColor: c.accent }], onPress: () => loadData() }, /* @__PURE__ */ import_react6.default.createElement(import_react_native6.Text, { style: { color: c.accent } }, "Retry")));
  }
  return /* @__PURE__ */ import_react6.default.createElement(
    import_react_native6.ScrollView,
    {
      style: { flex: 1, backgroundColor: c.bg },
      refreshControl: /* @__PURE__ */ import_react6.default.createElement(import_react_native6.RefreshControl, { refreshing, onRefresh: () => loadData(true), tintColor: c.accent })
    },
    /* @__PURE__ */ import_react6.default.createElement(import_react_native6.ScrollView, { horizontal: true, showsHorizontalScrollIndicator: false, style: s6.statusBar, contentContainerStyle: s6.statusBarContent }, /* @__PURE__ */ import_react6.default.createElement(import_react_native6.View, { style: [s6.chip, { backgroundColor: c.surface }] }, /* @__PURE__ */ import_react6.default.createElement(import_react_native6.Text, { style: { color: c.text } }, "\u{1F4A1} ", /* @__PURE__ */ import_react6.default.createElement(import_react_native6.Text, { style: { fontWeight: "700" } }, onCount), " ", /* @__PURE__ */ import_react6.default.createElement(import_react_native6.Text, { style: { color: c.textMuted } }, "on"))), climateDevices.find((d) => d.entity_id.includes("temperature")) && /* @__PURE__ */ import_react6.default.createElement(import_react_native6.View, { style: [s6.chip, { backgroundColor: c.surface }] }, /* @__PURE__ */ import_react6.default.createElement(import_react_native6.Text, { style: { color: c.text } }, "\u{1F321}\uFE0F ", /* @__PURE__ */ import_react6.default.createElement(import_react_native6.Text, { style: { fontWeight: "700" } }, ((_a = states[climateDevices.find((d) => d.entity_id.includes("temperature")).entity_id]) == null ? void 0 : _a.state) || "--", "\xB0"))), securityDevices.filter((d) => d.entity_id.startsWith("lock.")).length > 0 && /* @__PURE__ */ import_react6.default.createElement(import_react_native6.View, { style: [s6.chip, { backgroundColor: c.surface }] }, /* @__PURE__ */ import_react6.default.createElement(import_react_native6.Text, { style: { color: c.text } }, securityDevices.filter((d) => d.entity_id.startsWith("lock.")).every((d) => {
      var _a2;
      return ((_a2 = states[d.entity_id]) == null ? void 0 : _a2.state) === "locked";
    }) ? "\u{1F512} Locked" : "\u{1F513} Unlocked"))),
    quickDevices.length > 0 && /* @__PURE__ */ import_react6.default.createElement(import_react_native6.View, { style: s6.section }, /* @__PURE__ */ import_react6.default.createElement(import_react_native6.Text, { style: [s6.sectionTitle, { color: c.textMuted }] }, "QUICK CONTROLS"), /* @__PURE__ */ import_react6.default.createElement(import_react_native6.View, { style: s6.controlsGrid }, quickDevices.map((dev) => {
      var _a2;
      const st = ((_a2 = states[dev.entity_id]) == null ? void 0 : _a2.state) || dev.state || "unknown";
      const on = isOn(dev.entity_id, st);
      return /* @__PURE__ */ import_react6.default.createElement(
        import_react_native6.Pressable,
        {
          key: dev.entity_id,
          style: [s6.tile, { backgroundColor: on ? "#1c2a1f" : c.surface, borderColor: on ? "#22c55e40" : c.border }],
          onPress: () => toggleDevice(dev.entity_id)
        },
        /* @__PURE__ */ import_react6.default.createElement(import_react_native6.View, { style: s6.tileTop }, /* @__PURE__ */ import_react6.default.createElement(import_react_native6.Text, { style: s6.tileIcon }, getIcon(dev.entity_id)), /* @__PURE__ */ import_react6.default.createElement(import_react_native6.View, { style: [s6.toggle, on && s6.toggleOn] }, /* @__PURE__ */ import_react6.default.createElement(import_react_native6.View, { style: [s6.toggleKnob, on && s6.toggleKnobOn] }))),
        /* @__PURE__ */ import_react6.default.createElement(import_react_native6.Text, { style: [s6.tileName, { color: c.text }], numberOfLines: 1 }, dev.name || dev.entity_id),
        /* @__PURE__ */ import_react6.default.createElement(import_react_native6.Text, { style: [s6.tileState, { color: c.textMuted }] }, stateLabel(dev.entity_id, st))
      );
    }))),
    rooms.length > 0 && /* @__PURE__ */ import_react6.default.createElement(import_react_native6.View, { style: s6.section }, /* @__PURE__ */ import_react6.default.createElement(import_react_native6.Text, { style: [s6.sectionTitle, { color: c.textMuted }] }, "ROOMS"), rooms.map((room, i) => {
      const devices = room.devices || [];
      const roomOnCount = devices.filter((d) => {
        var _a2;
        return isOn(d.entity_id, (_a2 = states[d.entity_id]) == null ? void 0 : _a2.state);
      }).length;
      const expanded = expandedRooms.has(i);
      return /* @__PURE__ */ import_react6.default.createElement(import_react_native6.Pressable, { key: room.name, style: [s6.roomCard, { backgroundColor: c.surface, borderColor: c.border }], onPress: () => toggleRoom(i) }, /* @__PURE__ */ import_react6.default.createElement(import_react_native6.View, { style: s6.roomHeader }, /* @__PURE__ */ import_react6.default.createElement(import_react_native6.Text, { style: [s6.roomName, { color: c.text }] }, room.name), /* @__PURE__ */ import_react6.default.createElement(import_react_native6.Text, { style: [s6.roomBadge, roomOnCount > 0 ? { backgroundColor: "#22c55e20", color: "#22c55e" } : { backgroundColor: c.border, color: c.textMuted }] }, roomOnCount > 0 ? `${roomOnCount} on` : `${devices.length} devices`), /* @__PURE__ */ import_react6.default.createElement(import_react_native6.Text, { style: [s6.chevron, { color: c.textMuted }, expanded && s6.chevronExpanded] }, "\u25B6")), expanded && devices.map((dev) => {
        var _a2;
        const st = ((_a2 = states[dev.entity_id]) == null ? void 0 : _a2.state) || "unknown";
        const on = isOn(dev.entity_id, st);
        return /* @__PURE__ */ import_react6.default.createElement(import_react_native6.Pressable, { key: dev.entity_id, style: [s6.deviceRow, { borderTopColor: c.border }], onPress: () => toggleDevice(dev.entity_id) }, /* @__PURE__ */ import_react6.default.createElement(import_react_native6.View, { style: [s6.dot, { backgroundColor: on ? "#22c55e" : c.textMuted }] }), /* @__PURE__ */ import_react6.default.createElement(import_react_native6.Text, { style: [s6.deviceName, { color: c.text }], numberOfLines: 1 }, dev.name || dev.entity_id), /* @__PURE__ */ import_react6.default.createElement(import_react_native6.Text, { style: [s6.deviceState, { color: c.textMuted }] }, stateLabel(dev.entity_id, st)));
      }));
    })),
    climateDevices.length > 0 && /* @__PURE__ */ import_react6.default.createElement(import_react_native6.View, { style: s6.section }, /* @__PURE__ */ import_react6.default.createElement(import_react_native6.Text, { style: [s6.sectionTitle, { color: c.textMuted }] }, "CLIMATE"), /* @__PURE__ */ import_react6.default.createElement(import_react_native6.View, { style: s6.climateGrid }, climateDevices.map((dev) => {
      var _a2;
      const val = ((_a2 = states[dev.entity_id]) == null ? void 0 : _a2.state) || dev.state || "--";
      const isTemp = dev.entity_id.includes("temperature");
      return /* @__PURE__ */ import_react6.default.createElement(import_react_native6.View, { key: dev.entity_id, style: [s6.climateCard, { backgroundColor: c.surface, borderColor: c.border }] }, /* @__PURE__ */ import_react6.default.createElement(import_react_native6.Text, { style: [s6.climateLabel, { color: c.textMuted }] }, dev.room), /* @__PURE__ */ import_react6.default.createElement(import_react_native6.Text, { style: [s6.climateValue, { color: c.text }] }, val, /* @__PURE__ */ import_react6.default.createElement(import_react_native6.Text, { style: s6.climateUnit }, isTemp ? "\xB0C" : "%")), /* @__PURE__ */ import_react6.default.createElement(import_react_native6.Text, { style: [s6.climateSub, { color: c.textMuted }] }, dev.name));
    }))),
    securityDevices.length > 0 && /* @__PURE__ */ import_react6.default.createElement(import_react_native6.View, { style: s6.section }, /* @__PURE__ */ import_react6.default.createElement(import_react_native6.Text, { style: [s6.sectionTitle, { color: c.textMuted }] }, "SECURITY"), securityDevices.map((dev) => {
      var _a2;
      const st = ((_a2 = states[dev.entity_id]) == null ? void 0 : _a2.state) || "unknown";
      const safe = dev.entity_id.startsWith("lock.") && st === "locked" || dev.entity_id.startsWith("cover.") && st === "closed";
      return /* @__PURE__ */ import_react6.default.createElement(import_react_native6.View, { key: dev.entity_id, style: [s6.securityRow, { backgroundColor: c.surface, borderColor: c.border }] }, /* @__PURE__ */ import_react6.default.createElement(import_react_native6.Text, { style: s6.securityIcon }, dev.entity_id.startsWith("lock.") ? "\u{1F512}" : "\u{1F6AA}"), /* @__PURE__ */ import_react6.default.createElement(import_react_native6.View, { style: { flex: 1 } }, /* @__PURE__ */ import_react6.default.createElement(import_react_native6.Text, { style: [s6.securityName, { color: c.text }] }, dev.name || dev.entity_id), /* @__PURE__ */ import_react6.default.createElement(import_react_native6.Text, { style: { fontSize: 12, color: safe ? c.success : "#f59e0b" } }, stateLabel(dev.entity_id, st))));
    })),
    /* @__PURE__ */ import_react6.default.createElement(import_react_native6.View, { style: [s6.section, { paddingBottom: 32 }] }, /* @__PURE__ */ import_react6.default.createElement(import_react_native6.Text, { style: [s6.sectionTitle, { color: c.textMuted }] }, "PROVIDERS"), /* @__PURE__ */ import_react6.default.createElement(import_react_native6.View, { style: s6.providerRow }, Object.entries(providers).map(([name, connected]) => /* @__PURE__ */ import_react6.default.createElement(import_react_native6.View, { key: name, style: [s6.providerChip, { backgroundColor: c.surface, borderColor: c.border }] }, /* @__PURE__ */ import_react6.default.createElement(import_react_native6.View, { style: [s6.providerDot, { backgroundColor: connected ? "#22c55e" : c.textMuted }] }), /* @__PURE__ */ import_react6.default.createElement(import_react_native6.Text, { style: { color: c.text, fontSize: 12 } }, name)))))
  );
}
var home_layout_panel_default = {
  id: "home-layout-panel",
  type: "ui",
  version: "1.0.0",
  capabilities: { haptics: true },
  Component: HomeLayoutPanel
};
var s6 = import_react_native6.StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText: { marginTop: 8, fontSize: 14 },
  retryBtn: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  statusBar: { paddingVertical: 12 },
  statusBarContent: { paddingHorizontal: 16, gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  section: { paddingHorizontal: 16, marginBottom: 8 },
  sectionTitle: { fontSize: 13, fontWeight: "600", letterSpacing: 0.5, paddingVertical: 12 },
  controlsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: { width: "48%", borderRadius: 14, padding: 14, borderWidth: 1, gap: 8, minHeight: 80 },
  tileTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  tileIcon: { fontSize: 22 },
  toggle: { width: 36, height: 20, borderRadius: 10, backgroundColor: "#3f3f46", justifyContent: "center", paddingHorizontal: 2 },
  toggleOn: { backgroundColor: "#22c55e" },
  toggleKnob: { width: 16, height: 16, borderRadius: 8, backgroundColor: "#fff" },
  toggleKnobOn: { alignSelf: "flex-end" },
  tileName: { fontSize: 13, fontWeight: "500" },
  tileState: { fontSize: 11 },
  roomCard: { borderRadius: 14, borderWidth: 1, marginBottom: 10, overflow: "hidden" },
  roomHeader: { flexDirection: "row", alignItems: "center", padding: 14 },
  roomName: { flex: 1, fontSize: 15, fontWeight: "600" },
  roomBadge: { fontSize: 11, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginRight: 8, overflow: "hidden" },
  chevron: { fontSize: 12 },
  chevronExpanded: { transform: [{ rotate: "90deg" }] },
  deviceRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, minHeight: 44 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  deviceName: { flex: 1, fontSize: 13 },
  deviceState: { fontSize: 12 },
  climateGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  climateCard: { width: "48%", borderRadius: 14, padding: 14, borderWidth: 1 },
  climateLabel: { fontSize: 11, marginBottom: 4 },
  climateValue: { fontSize: 22, fontWeight: "700" },
  climateUnit: { fontSize: 13, fontWeight: "400" },
  climateSub: { fontSize: 11, marginTop: 4 },
  securityRow: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 14, padding: 14, borderWidth: 1, marginBottom: 10 },
  securityIcon: { fontSize: 20 },
  securityName: { fontSize: 14, fontWeight: "500" },
  providerRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  providerChip: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1 },
  providerDot: { width: 6, height: 6, borderRadius: 3 }
});
