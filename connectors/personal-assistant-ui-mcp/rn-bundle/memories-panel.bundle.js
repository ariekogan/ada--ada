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

// rn-src/memories-panel.tsx
var memories_panel_exports = {};
__export(memories_panel_exports, {
  default: () => memories_panel_default
});
module.exports = __toCommonJS(memories_panel_exports);
var import_react = __toESM(require("react"), 1);
var import_react_native = require("react-native");
var import_plugin_sdk = require("@adas/plugin-sdk");
var CONNECTOR = "memory-mcp";
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
  const api = (0, import_plugin_sdk.useApi)(bridge);
  const [loading, setLoading] = (0, import_react.useState)(true);
  const [profile, setProfile] = (0, import_react.useState)({});
  const [preferences, setPreferences] = (0, import_react.useState)([]);
  const [facts, setFacts] = (0, import_react.useState)([]);
  const [instructions, setInstructions] = (0, import_react.useState)([]);
  const [totalMemories, setTotalMemories] = (0, import_react.useState)(0);
  const [rulesCount, setRulesCount] = (0, import_react.useState)(0);
  const [deleteTarget, setDeleteTarget] = (0, import_react.useState)(null);
  const [expandedSection, setExpandedSection] = (0, import_react.useState)("preferences");
  const initialAddOpen = !!(engineProps == null ? void 0 : engineProps.autoOpenAdd);
  const initialAddText = typeof (engineProps == null ? void 0 : engineProps.prefillText) === "string" ? engineProps.prefillText : "";
  const [addOpen, setAddOpen] = (0, import_react.useState)(initialAddOpen);
  const [addText, setAddText] = (0, import_react.useState)(initialAddText);
  const [addBusy, setAddBusy] = (0, import_react.useState)(false);
  const [errorMsg, setErrorMsg] = (0, import_react.useState)(null);
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
  const load = (0, import_react.useCallback)(() => __async(null, null, function* () {
    var _a, _b, _c;
    try {
      const raw = yield api.call("memory.userProfile", {}, CONNECTOR);
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
  (0, import_react.useEffect)(() => {
    load();
  }, [load]);
  const doDelete = () => __async(null, null, function* () {
    var _a, _b, _c, _d;
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    try {
      yield api.call("memory.delete", { id: target.id }, CONNECTOR);
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
      yield api.call("memory.add", { content: text }, CONNECTOR);
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
    return /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [s.container, { backgroundColor: palette.bg }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.ActivityIndicator, { color: palette.accent, style: { marginTop: 60 } }));
  }
  const profileKeys = Object.keys(profile);
  const hasProfile = profileKeys.length > 0;
  const isEmpty = !hasProfile && preferences.length === 0 && facts.length === 0 && instructions.length === 0;
  const renderMemoryCard = (item) => {
    const parsed = parseContent(item.content);
    return /* @__PURE__ */ import_react.default.createElement(
      import_react_native.Pressable,
      {
        key: item.id,
        onLongPress: () => {
          var _a, _b;
          (_b = (_a = native == null ? void 0 : native.haptics) == null ? void 0 : _a.selection) == null ? void 0 : _b.call(_a);
          setDeleteTarget(item);
        },
        delayLongPress: 500,
        style: [s.itemCard, { backgroundColor: palette.surface }]
      },
      /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.itemContent, { color: palette.text }], numberOfLines: 4 }, parsed),
      item.context ? /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.itemContext, { color: palette.textMuted }], numberOfLines: 2 }, item.context) : null,
      item.created_at ? /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.itemDate, { color: palette.textMuted }] }, formatDate(item.created_at)) : null
    );
  };
  const renderSection = (title, key, items) => {
    if (items.length === 0) return null;
    const isOpen = expandedSection === key;
    return /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { key, style: { marginBottom: 8 } }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Pressable, { onPress: () => toggleSection(key), style: s.sectionHeader }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.sectionTitle, { color: palette.textMuted }] }, title.toUpperCase(), " \xB7 ", items.length), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: { fontSize: 12, color: palette.textMuted } }, isOpen ? "\u25BE" : "\u25B8")), isOpen && /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: { gap: 8 } }, items.map(renderMemoryCard)));
  };
  return /* @__PURE__ */ import_react.default.createElement(import_react_native.ScrollView, { style: [s.container, { backgroundColor: palette.bg }], contentContainerStyle: { paddingBottom: 32 } }, isEmpty ? /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [s.emptyCard, { backgroundColor: palette.surface }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.emptyTitle, { color: palette.textSoft }] }, "I don\u2019t know you yet"), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.emptyText, { color: palette.textMuted }] }, "Tell me about yourself in chat, or tap below to teach me directly.")) : /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, hasProfile && /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [s.profileCard, { backgroundColor: palette.surface }] }, profile.name ? /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: s.profileHeader }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [s.avatar, { backgroundColor: palette.accent }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: s.avatarText }, profile.name[0].toUpperCase())), /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: { flex: 1 } }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.profileName, { color: palette.text }] }, profile.name), profile.timezone ? /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: { fontSize: 13, color: palette.textMuted } }, profile.timezone) : null)) : null, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [s.profileFields, !profile.name && { marginTop: 0 }] }, profileKeys.filter((k) => profile.name ? k !== "name" && k !== "timezone" : true).map((k, i) => /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { key: k, style: [s.profileField, i > 0 && s.profileFieldDivider, { borderTopColor: palette.border }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.profileLabel, { color: palette.textMuted }] }, PROFILE_LABELS[k] || k.replace(/_/g, " ")), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.profileValue, { color: palette.text }], numberOfLines: 1 }, profile[k]))))), renderSection("Preferences", "preferences", preferences), renderSection("Facts", "facts", facts), renderSection("Instructions", "instructions", instructions), rulesCount > 0 && /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.rulesHint, { color: palette.textMuted }] }, rulesCount, " taught rules \u2192 see Teach panel")), /* @__PURE__ */ import_react.default.createElement(
    import_react_native.Pressable,
    {
      onPress: openAdd,
      style: [s.addBtn, { borderColor: palette.borderStrong }]
    },
    /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.addText, { color: palette.textSoft }] }, "+ Tell Ada something to remember")
  ), /* @__PURE__ */ import_react.default.createElement(import_react_native.Modal, { visible: addOpen, transparent: true, animationType: "fade", onRequestClose: () => setAddOpen(false) }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: s.overlay }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [s.addBox, { backgroundColor: palette.surface }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.addTitle, { color: palette.text }] }, "Tell Ada"), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.addSubtitle, { color: palette.textMuted }] }, "Something to remember about you"), /* @__PURE__ */ import_react.default.createElement(
    import_react_native.TextInput,
    {
      autoFocus: true,
      multiline: true,
      value: addText,
      onChangeText: setAddText,
      placeholder: "e.g. I prefer window seats",
      placeholderTextColor: palette.textMuted,
      style: [s.addInput, { color: palette.text, borderColor: palette.border, backgroundColor: palette.bg }],
      editable: !addBusy
    }
  ), errorMsg ? /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.errorText, { color: palette.accentDeep }] }, errorMsg) : null, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: s.addBtns }, /* @__PURE__ */ import_react.default.createElement(
    import_react_native.Pressable,
    {
      onPress: () => {
        setAddOpen(false);
        setErrorMsg(null);
      },
      disabled: addBusy,
      style: [s.cancelBtn, { backgroundColor: palette.border }]
    },
    /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: { color: palette.text, fontSize: 14, fontWeight: "500" } }, "Cancel")
  ), /* @__PURE__ */ import_react.default.createElement(
    import_react_native.Pressable,
    {
      onPress: submitAdd,
      disabled: !addText.trim() || addBusy,
      style: [s.saveBtn, {
        backgroundColor: addText.trim() && !addBusy ? palette.accent : palette.borderStrong,
        opacity: addText.trim() && !addBusy ? 1 : 0.6
      }]
    },
    addBusy ? /* @__PURE__ */ import_react.default.createElement(import_react_native.ActivityIndicator, { color: "#fff" }) : /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: { color: "#fff", fontSize: 14, fontWeight: "600" } }, "Save")
  ))))), /* @__PURE__ */ import_react.default.createElement(import_react_native.Modal, { visible: !!deleteTarget, transparent: true, animationType: "fade" }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: s.overlay }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [s.confirmBox, { backgroundColor: palette.surface }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.confirmText, { color: palette.text }] }, "Forget this?", "\n", /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: { fontWeight: "600" } }, parseContent((deleteTarget == null ? void 0 : deleteTarget.content) || ""))), /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: s.addBtns }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Pressable, { onPress: () => setDeleteTarget(null), style: [s.cancelBtn, { backgroundColor: palette.border }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: { color: palette.text, fontSize: 14, fontWeight: "500" } }, "Keep")), /* @__PURE__ */ import_react.default.createElement(import_react_native.Pressable, { onPress: doDelete, style: [s.saveBtn, { backgroundColor: palette.accent }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: { color: "#fff", fontSize: 14, fontWeight: "600" } }, "Forget")))))));
}
var memories_panel_default = {
  id: "memories-panel",
  type: "ui",
  version: "1.0.0",
  Component: MemoriesPanel
};
var s = import_react_native.StyleSheet.create({
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
