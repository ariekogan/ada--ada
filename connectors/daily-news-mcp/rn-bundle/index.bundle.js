// src-hash:61705a5feb1664613ed14e433eb44f08
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

// rn-src/index.tsx
var index_exports = {};
__export(index_exports, {
  NewsDashboard: () => news_dashboard_default
});
module.exports = __toCommonJS(index_exports);

// rn-src/news-dashboard.tsx
var import_react = __toESM(require("react"));
var import_react_native = require("react-native");
var import_plugin_sdk = require("@adas/plugin-sdk");
var SELF = "daily-news-mcp";
function parseResult(r) {
  if (!r) return null;
  const v = r && r.status === "fulfilled" ? r.value : r;
  try {
    return typeof v === "string" ? JSON.parse(v) : v;
  } catch (e) {
    return null;
  }
}
var NewsDashboard = function NewsDashboard2({ bridge, native, theme }) {
  var _a, _b, _c, _d, _e, _f;
  const api = (0, import_plugin_sdk.useApi)(bridge);
  const t = theme || {};
  const C = {
    bg: ((_a = t.colors) == null ? void 0 : _a.bg) || "#0f1117",
    surface: ((_b = t.colors) == null ? void 0 : _b.surface) || "#171a21",
    border: ((_c = t.colors) == null ? void 0 : _c.border) || "#252a35",
    text: ((_d = t.colors) == null ? void 0 : _d.text) || "#e8eaf0",
    textMuted: ((_e = t.colors) == null ? void 0 : _e.textMuted) || "#8b93a7",
    accent: ((_f = t.colors) == null ? void 0 : _f.accent) || "#4f8ef7"
  };
  const S = import_react.default.useMemo(() => makeStyles(C), [C.bg, C.surface, C.border, C.text, C.textMuted, C.accent]);
  const [cats, setCats] = (0, import_react.useState)([]);
  const [date, setDate] = (0, import_react.useState)("");
  const [loading, setLoading] = (0, import_react.useState)(true);
  const [err, setErr] = (0, import_react.useState)(null);
  const load = (0, import_react.useCallback)(() => __async(null, null, function* () {
    setLoading(true);
    setErr(null);
    try {
      const raw = yield api.call("news.fetch", { per_category: 4 }, SELF);
      const d = parseResult(raw);
      if (!d || d.ok === false || !Array.isArray(d.categories)) {
        setErr(d && d.error || "Could not load news.");
        setCats([]);
      } else {
        setCats(d.categories);
        setDate(d.date || "");
      }
    } catch (e) {
      setErr(String((e == null ? void 0 : e.message) || e));
    } finally {
      setLoading(false);
    }
  }), [api]);
  (0, import_react.useEffect)(() => {
    load();
  }, [load]);
  const openStory = (0, import_react.useCallback)((url) => {
    var _a2, _b2;
    if (native == null ? void 0 : native.haptics) (_b2 = (_a2 = native.haptics).selection) == null ? void 0 : _b2.call(_a2);
    if (url) import_react_native.Linking.openURL(url).catch(() => {
    });
  }, [native]);
  const prettyDate = (() => {
    try {
      const dt = date ? /* @__PURE__ */ new Date(date + "T00:00:00") : /* @__PURE__ */ new Date();
      return dt.toLocaleDateString(void 0, { weekday: "long", month: "short", day: "numeric" });
    } catch (e) {
      return date;
    }
  })();
  return /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: S.root }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: S.header }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: S.title }, "\u{1F4F0} Daily News"), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: S.subtitle }, prettyDate)), loading ? /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: S.center }, /* @__PURE__ */ import_react.default.createElement(import_react_native.ActivityIndicator, { color: C.accent }), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: S.muted }, "Fetching today's news\u2026")) : err ? /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: S.center }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: S.muted }, err), /* @__PURE__ */ import_react.default.createElement(import_react_native.TouchableOpacity, { style: S.retry, onPress: load }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: S.retryText }, "Retry"))) : /* @__PURE__ */ import_react.default.createElement(import_react_native.ScrollView, { style: S.scroll, contentContainerStyle: S.scrollContent, showsVerticalScrollIndicator: false }, cats.map((cat) => /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { key: cat.key, style: S.category }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: S.catHeader }, (cat.emoji ? cat.emoji + "  " : "") + (cat.name || cat.key)), (cat.items || []).map((s, i) => /* @__PURE__ */ import_react.default.createElement(import_react_native.TouchableOpacity, { key: i, style: S.story, activeOpacity: 0.6, onPress: () => openStory(s.url) }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: S.storyTitle }, s.title), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: S.meta }, s.points ? /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: S.pts }, "\u25B2 ", s.points) : null, s.points ? "  \xB7  " : "", s.source || ""))))), /* @__PURE__ */ import_react.default.createElement(import_react_native.TouchableOpacity, { style: S.refresh, onPress: load }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: S.refreshText }, "\u21BB Refresh"))));
};
function makeStyles(C) {
  return import_react_native.StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: C.border },
    title: { color: C.text, fontSize: 20, fontWeight: "700" },
    subtitle: { color: C.textMuted, fontSize: 13, marginTop: 2 },
    scroll: { flex: 1 },
    scrollContent: { padding: 14, paddingBottom: 28 },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 10 },
    muted: { color: C.textMuted, fontSize: 14, textAlign: "center" },
    category: { marginBottom: 18 },
    catHeader: { color: C.textMuted, fontSize: 12, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 8 },
    story: { paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: C.surface },
    storyTitle: { color: C.accent, fontSize: 14, fontWeight: "500", lineHeight: 19 },
    meta: { color: C.textMuted, fontSize: 11, marginTop: 3 },
    pts: { color: C.accent, fontWeight: "600" },
    retry: { marginTop: 6, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8, backgroundColor: C.accent },
    retryText: { color: "#fff", fontWeight: "600" },
    refresh: { alignSelf: "center", marginTop: 6, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: C.border },
    refreshText: { color: C.textMuted, fontWeight: "600", fontSize: 13 }
  });
}
var news_dashboard_default = {
  id: "news-dashboard",
  type: "ui",
  version: "1.0.0",
  capabilities: { haptics: true },
  Component: NewsDashboard
};
