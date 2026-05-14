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

// rn-src/schedule-panel.tsx
var schedule_panel_exports = {};
__export(schedule_panel_exports, {
  default: () => schedule_panel_default
});
module.exports = __toCommonJS(schedule_panel_exports);
var import_react = __toESM(require("react"), 1);
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
