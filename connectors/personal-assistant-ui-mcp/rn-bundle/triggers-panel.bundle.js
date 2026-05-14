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

// rn-src/triggers-panel.tsx
var triggers_panel_exports = {};
__export(triggers_panel_exports, {
  default: () => triggers_panel_default
});
module.exports = __toCommonJS(triggers_panel_exports);
var import_react = __toESM(require("react"), 1);
var import_react_native = require("react-native");
var import_plugin_sdk = require("@adas/plugin-sdk");
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
  return /* @__PURE__ */ import_react.default.createElement(import_react_native.Pressable, { onPress, hitSlop: 8, style: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: value ? accent : off,
    padding: 3,
    justifyContent: "center"
  } }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: {
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
  const api = (0, import_plugin_sdk.useApi)(bridge);
  const [triggers, setTriggers] = (0, import_react.useState)([]);
  const [loading, setLoading] = (0, import_react.useState)(true);
  const [deleteTarget, setDeleteTarget] = (0, import_react.useState)(null);
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
  const load = (0, import_react.useCallback)(() => __async(null, null, function* () {
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
  (0, import_react.useEffect)(() => {
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
    return /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [s.container, { backgroundColor: palette.bg }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.ActivityIndicator, { color: palette.accent, style: { marginTop: 60 } }));
  }
  const renderCard = (t, idx) => /* @__PURE__ */ import_react.default.createElement(
    import_react_native.View,
    {
      key: `${t.id || "trigger"}-${idx}`,
      style: [s.card, { backgroundColor: t.enabled ? palette.surface : palette.surfaceMuted }]
    },
    t.canDelete ? /* @__PURE__ */ import_react.default.createElement(
      import_react_native.Pressable,
      {
        onPress: () => {
          var _a, _b;
          (_b = (_a = native == null ? void 0 : native.haptics) == null ? void 0 : _a.selection) == null ? void 0 : _b.call(_a);
          setDeleteTarget(t);
        },
        hitSlop: 12,
        style: s.deleteCorner
      },
      /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.deleteCornerX, { color: palette.textMuted }] }, "\xD7")
    ) : null,
    /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: s.toggleAnchor, pointerEvents: "box-none" }, /* @__PURE__ */ import_react.default.createElement(
      SoftToggle,
      {
        value: t.enabled,
        onPress: () => toggle(t),
        accent: palette.accent,
        off: palette.off
      }
    )),
    /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.cardDesc, { color: t.enabled ? palette.text : palette.textSoft }], numberOfLines: 2 }, t.description),
    /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: s.metaRow }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.metaText, { color: palette.textMuted }], numberOfLines: 1 }, "\u23F1  ", t.humanSchedule, "   \xB7   ", /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: { color: t.isDynamic ? palette.accent : palette.textMuted, fontWeight: "600" } }, t.isDynamic ? "personal" : "system"))),
    !t.enabled && t.autoPausedReason ? /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [s.warnPill, { backgroundColor: palette.accentSoft }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.warnText, { color: palette.accent }], numberOfLines: 2 }, "\u26A0  ", "Auto-paused ", t.autoPausedReason === "jit_failed" ? "\u2014 kept retrying without progress" : t.autoPausedReason === "goal_failed" ? "\u2014 last 2 runs didn\u2019t reach the goal" : `(${t.autoPausedReason})`)) : null
  );
  const sectionLabel = (label) => /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.sectionLabel, { color: palette.textMuted }] }, label);
  return /* @__PURE__ */ import_react.default.createElement(import_react_native.ScrollView, { style: [s.container, { backgroundColor: palette.bg }], contentContainerStyle: { paddingBottom: 32 } }, triggers.length === 0 ? /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: s.empty }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.emptyTitle, { color: palette.textSoft }] }, "No reminders yet"), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.emptyText, { color: palette.textMuted }] }, "Try saying:", "\n", /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: { color: palette.text, fontStyle: "italic" } }, '"Remind me to call the dentist in 1 hour"'))) : /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, active.length > 0 && /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, sectionLabel(`Active \xB7 ${active.length}`), active.map((t, i) => renderCard(t, i))), paused.length > 0 && /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, sectionLabel(`Paused \xB7 ${paused.length}`), paused.map((t, i) => renderCard(t, i + active.length))), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.hint, { color: palette.textMuted }] }, "Tap \xD7 on a Personal reminder to delete it")), /* @__PURE__ */ import_react.default.createElement(import_react_native.Modal, { visible: !!deleteTarget, transparent: true, animationType: "fade" }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: s.overlay }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [s.confirmBox, { backgroundColor: palette.surface }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.confirmText, { color: palette.text }] }, "Delete this reminder?", "\n", /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: { fontWeight: "600" } }, (deleteTarget == null ? void 0 : deleteTarget.description) || "")), /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: s.confirmBtns }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Pressable, { onPress: () => setDeleteTarget(null), style: [s.cancelBtn, { backgroundColor: palette.surfaceMuted }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: { color: palette.text, fontSize: 14, fontWeight: "500" } }, "Cancel")), /* @__PURE__ */ import_react.default.createElement(import_react_native.Pressable, { onPress: doDelete, style: [s.deleteConfirmBtn, { backgroundColor: palette.accent }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: { color: "#fff", fontSize: 14, fontWeight: "600" } }, "Delete")))))));
}
var triggers_panel_default = {
  id: "triggers-panel",
  type: "ui",
  version: "1.0.0",
  Component: TriggersPanel
};
var s = import_react_native.StyleSheet.create({
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
