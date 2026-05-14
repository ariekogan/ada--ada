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

// rn-src/teach-panel.tsx
var teach_panel_exports = {};
__export(teach_panel_exports, {
  default: () => teach_panel_default
});
module.exports = __toCommonJS(teach_panel_exports);
var import_react = __toESM(require("react"), 1);
var import_react_native = require("react-native");
var import_plugin_sdk = require("@adas/plugin-sdk");
var CONNECTOR = "memory-mcp";
var NOISE_TAGS = /* @__PURE__ */ new Set(["taught", "rule", "rules", "memory", "preference", "behavior"]);
function TeachPanelComponent({ bridge, native, theme }) {
  const api = (0, import_plugin_sdk.useApi)(bridge);
  const [rules, setRules] = (0, import_react.useState)([]);
  const [counts, setCounts] = (0, import_react.useState)({ total: 0, active: 0, inactive: 0 });
  const [isLive, setIsLive] = (0, import_react.useState)(false);
  const [deleteTarget, setDeleteTarget] = (0, import_react.useState)(null);
  const loadData = (0, import_react.useCallback)(() => __async(null, null, function* () {
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
  (0, import_react.useEffect)(() => {
    const timer = setTimeout(loadData, 300);
    return () => clearTimeout(timer);
  }, [loadData]);
  const toggleRule = (0, import_react.useCallback)((rule) => __async(null, null, function* () {
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
  const doDelete = (0, import_react.useCallback)(() => __async(null, null, function* () {
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
  return /* @__PURE__ */ import_react.default.createElement(import_react_native.ScrollView, { style: [s.container, { backgroundColor: colors.bg }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: s.header }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.title, { color: colors.text }] }, "Taught Rules ", isLive && /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: s.liveBadge }, "\u25CF", " LIVE")), isLive && /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: s.statsRow }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: s.statActive }, counts.active || 0, " active"), (counts.inactive || 0) > 0 && /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: s.statInactive }, counts.inactive, " disabled"))), !isLive ? /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [s.card, { backgroundColor: colors.surface, borderColor: colors.border }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: s.center }, /* @__PURE__ */ import_react.default.createElement(import_react_native.ActivityIndicator, { size: "small", color: "#2563eb" }), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.emptyText, { color: colors.textMuted }] }, "Loading rules..."))) : rules.length === 0 ? /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [s.card, { backgroundColor: colors.surface, borderColor: colors.border }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: s.center }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.emptyTitle, { color: colors.textMuted }] }, "No rules yet"), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.emptyText, { color: colors.textMuted }] }, "Teach your assistant by saying things like:", "\n", '"When my boss calls during a meeting, always ring through"', "\n", '"Never schedule meetings before 10am"'))) : rules.map((rule) => /* @__PURE__ */ import_react.default.createElement(
    import_react_native.Pressable,
    {
      key: String(rule.id),
      onLongPress: () => {
        var _a, _b;
        (_b = (_a = native == null ? void 0 : native.haptics) == null ? void 0 : _a.selection) == null ? void 0 : _b.call(_a);
        setDeleteTarget(rule);
      },
      delayLongPress: 500,
      style: [s.ruleCard, { backgroundColor: colors.surface, borderColor: colors.border, opacity: rule.active ? 1 : 0.5 }]
    },
    /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: s.ruleTop }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.ruleDesc, { color: colors.text }] }, rule.description), /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: { alignItems: "center" } }, /* @__PURE__ */ import_react.default.createElement(
      import_react_native.Switch,
      {
        value: rule.active,
        onValueChange: () => toggleRule(rule),
        trackColor: { false: "#374151", true: "#22c55e" },
        thumbColor: "#fff"
      }
    ), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: { fontSize: 10, color: rule.active ? "#22c55e" : "#f59e0b", marginTop: 2 } }, rule.active ? "active" : "disabled"))),
    rule.tags.length > 0 && /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: s.tagRow }, rule.tags.slice(0, 3).map((t, i) => /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { key: i, style: s.tag }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.tagText, { color: colors.textMuted }] }, t))))
  )), /* @__PURE__ */ import_react.default.createElement(import_react_native.Modal, { visible: !!deleteTarget, transparent: true, animationType: "fade" }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: s.overlay }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [s.confirmBox, { backgroundColor: colors.surface, borderColor: colors.border }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.confirmText, { color: colors.text }] }, "Delete this rule?", "\n", /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: s.confirmBold }, (deleteTarget == null ? void 0 : deleteTarget.description) || "")), /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: s.confirmBtns }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Pressable, { style: [s.cancelBtn, { backgroundColor: colors.border }], onPress: () => setDeleteTarget(null) }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.cancelBtnText, { color: colors.text }] }, "Cancel")), /* @__PURE__ */ import_react.default.createElement(import_react_native.Pressable, { style: s.confirmDeleteBtn, onPress: doDelete }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: s.confirmDeleteText }, "Delete")))))));
}
var teach_panel_default = {
  id: "teach-panel",
  type: "ui",
  version: "1.0.0",
  capabilities: { haptics: true },
  Component: TeachPanelComponent
};
var s = import_react_native.StyleSheet.create({
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
