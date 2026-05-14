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

// rn-src/pa-dashboard.tsx
var pa_dashboard_exports = {};
__export(pa_dashboard_exports, {
  default: () => pa_dashboard_default
});
module.exports = __toCommonJS(pa_dashboard_exports);
var import_react = __toESM(require("react"), 1);
var import_react_native = require("react-native");
var import_plugin_sdk = require("@adas/plugin-sdk");
var DEVICE = "mobile-device-mcp";
var MEMORY = "memory-mcp";
var ACCENT = "#2563eb";
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
var pa_dashboard_default = import_plugin_sdk.PluginSDK.register("pa-dashboard", {
  type: "ui",
  version: "1.0.0",
  capabilities: {},
  Component({ bridge, theme }) {
    const api = (0, import_plugin_sdk.useApi)(bridge);
    const [todayEvents, setTodayEvents] = (0, import_react.useState)([]);
    const [upcomingEvents, setUpcomingEvents] = (0, import_react.useState)([]);
    const [memories, setMemories] = (0, import_react.useState)([]);
    const [contacts, setContacts] = (0, import_react.useState)([]);
    const [loading, setLoading] = (0, import_react.useState)(true);
    const loadData = (0, import_react.useCallback)(() => __async(null, null, function* () {
      const results = yield Promise.allSettled([
        api.call("device.calendar.today", {}, DEVICE),
        api.call("device.calendar.upcoming", { days: 7 }, DEVICE),
        api.call("memory.list", {}, MEMORY),
        api.call("device.contacts.search", { query: "" }, DEVICE)
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
    if (loading) {
      return /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [s.container, s.center, { backgroundColor: colors.bg }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.ActivityIndicator, { size: "small", color: ACCENT }), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.loadingText, { color: colors.textMuted }] }, "Connecting..."));
    }
    return /* @__PURE__ */ import_react.default.createElement(import_react_native.ScrollView, { style: [s.container, { backgroundColor: colors.bg }] }, /* @__PURE__ */ import_react.default.createElement(Section, { icon: "\u{1F4C5}", title: "Today", badge: String(todayEvents.length), colors }, todayEvents.length === 0 ? /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.empty, { color: colors.textMuted }] }, "No events") : todayEvents.map((e, i) => /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { key: i, style: [s.eventRow, { backgroundColor: colors.surface, borderColor: colors.border }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.eventTime, { color: ACCENT }] }, e.start || ""), /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: s.eventBody }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.eventTitle, { color: colors.text }] }, e.title || "Untitled"), e.location ? /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.eventMeta, { color: colors.textMuted }] }, "\u{1F4CD}", " ", e.location) : null)))), /* @__PURE__ */ import_react.default.createElement(Section, { icon: "\u{1F5D3}", title: "Upcoming", colors }, upcomingEvents.length === 0 ? /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.empty, { color: colors.textMuted }] }, "No upcoming events") : upcomingEvents.slice(0, 5).map((e, i) => /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { key: i, style: [s.eventRow, { backgroundColor: colors.surface, borderColor: colors.border }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.eventTime, { color: ACCENT }] }, e.start || ""), /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: s.eventBody }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.eventTitle, { color: colors.text }] }, e.title || "Untitled"), e.location ? /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.eventMeta, { color: colors.textMuted }] }, "\u{1F4CD}", " ", e.location) : null)))), /* @__PURE__ */ import_react.default.createElement(Section, { icon: "\u{1F9E0}", title: "Memories", badge: String(memories.length), colors }, memories.length === 0 ? /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.empty, { color: colors.textMuted }] }, "No stored memories yet") : memories.map((m, i) => {
      const tc = TYPE_COLORS[m.type] || { bg: "rgba(37,99,235,0.15)", text: ACCENT };
      return /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { key: i, style: [s.memRow, { backgroundColor: colors.surface, borderColor: colors.border }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [s.memTypeBadge, { backgroundColor: tc.bg }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: { fontSize: 10, fontWeight: "700", color: tc.text, textTransform: "uppercase" } }, m.type)), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.memContent, { color: colors.text }], numberOfLines: 2 }, m.content));
    })), /* @__PURE__ */ import_react.default.createElement(Section, { icon: "\u{1F4D2}", title: "Contacts", colors }, contacts.length === 0 ? /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.empty, { color: colors.textMuted }] }, "No contacts") : contacts.map((c, i) => /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { key: i, style: [s.contactRow, { backgroundColor: colors.surface, borderColor: colors.border }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [s.avatar, { backgroundColor: colors.border }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: s.avatarText }, REL_EMOJI[c.relationship || ""] || "\u{1F464}")), /* @__PURE__ */ import_react.default.createElement(import_react_native.View, null, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.contactName, { color: colors.text }] }, c.name), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.contactRel, { color: colors.textMuted }] }, c.relationship || "", c.phone ? ` \u2022 ${c.phone}` : ""))))));
  }
});
function Section({ icon, title, badge, colors, children }) {
  return /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: s.section }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [s.sectionHeader, { borderBottomColor: colors.border }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: s.sectionIcon }, icon), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.sectionTitle, { color: colors.text }] }, title), badge ? /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: s.sectionBadge }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: s.sectionBadgeText }, badge)) : null), children);
}
var s = import_react_native.StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { justifyContent: "center", alignItems: "center" },
  loadingText: { fontSize: 13, marginTop: 8 },
  empty: { textAlign: "center", padding: 16, fontSize: 12 },
  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10, paddingBottom: 6, borderBottomWidth: 1 },
  sectionIcon: { fontSize: 16 },
  sectionTitle: { fontSize: 14, fontWeight: "600" },
  sectionBadge: { marginLeft: "auto", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: "rgba(37,99,235,0.15)" },
  sectionBadgeText: { fontSize: 11, fontWeight: "600", color: ACCENT },
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
