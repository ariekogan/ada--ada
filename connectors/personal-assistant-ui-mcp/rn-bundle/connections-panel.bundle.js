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

// rn-src/connections-panel.tsx
var connections_panel_exports = {};
__export(connections_panel_exports, {
  default: () => connections_panel_default
});
module.exports = __toCommonJS(connections_panel_exports);
var import_react = __toESM(require("react"), 1);
var import_react_native = require("react-native");
var import_plugin_sdk = require("@adas/plugin-sdk");
var SERVICE_FLAVOR = {
  gmail: { icon: "\u{1F4E7}", why: "Tidy your inbox, surface what matters, draft replies in your voice." },
  google: { icon: "\u{1F4C5}", why: "Defend your time, plan around traffic, never miss a thing." },
  google_drive: { icon: "\u{1F4C1}", why: "Search your Drive and answer questions about your docs." },
  whatsapp: { icon: "\u{1F4AC}", why: "Catch what you missed, send messages without picking up the phone." },
  dropbox: { icon: "\u{1F4E6}", why: "Search your docs \u2014 contracts, handbooks, anything you\u2019ve filed away." },
  linkedin: { icon: "\u{1F4BC}", why: "Check reactions, post for you, reply to comments without opening the app." },
  facebook: { icon: "\u{1F465}", why: "Stay on top of mentions and messages without doom-scrolling." },
  slack: { icon: "\u{1F4AC}", why: "Get the gist of channels you\u2019re behind on, draft replies before you hit send." },
  spotify: { icon: "\u{1F3B5}", why: "Set the mood \u2014 \u201Cput on something focus-y\u201D \u2014 without the app." },
  github: { icon: "\u{1F4BB}", why: "Triage issues, summarize PRs, surface what needs your eyes." },
  notion: { icon: "\u{1F4DD}", why: "Search your workspace and answer questions across your notes." },
  microsoft: { icon: "\u{1FA9F}", why: "Plug into Microsoft 365 \u2014 calendar, mail, documents." },
  outlook: { icon: "\u{1F4E7}", why: "Inbox triage, summarize threads, draft replies." },
  discord: { icon: "\u{1F3AE}", why: "Catch up on servers and DMs without scrolling for hours." },
  booking: { icon: "\u{1F6CE}\uFE0F", why: "Pull up reservations and search for trips when you need them." }
};
function prettyName(id) {
  if (!id) return "Service";
  return id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function unwrapList(payload) {
  var _a, _b;
  if (!payload) return [];
  let data = payload;
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
  const arr = Array.isArray(data) ? data : Array.isArray(data == null ? void 0 : data.services) ? data.services : Array.isArray(data == null ? void 0 : data.items) ? data.items : Array.isArray(data == null ? void 0 : data.connections) ? data.connections : Array.isArray(data == null ? void 0 : data.results) ? data.results : [];
  return arr.map((s2, i) => {
    var _a2, _b2, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r;
    const id = String((_e = (_d = (_c = (_b2 = (_a2 = s2.service_id) != null ? _a2 : s2.id) != null ? _b2 : s2.service) != null ? _c : s2.provider) != null ? _d : s2.key) != null ? _e : `svc-${i}`);
    const acc = s2.account && typeof s2.account === "object" ? s2.account : null;
    return {
      id: id.toLowerCase(),
      name: String((_h = (_g = (_f = s2.name) != null ? _f : s2.label) != null ? _g : s2.title) != null ? _h : id),
      authed: Boolean(
        (_m = (_l = (_k = (_j = (_i = s2.authed) != null ? _i : s2.connected) != null ? _j : s2.isConnected) != null ? _k : s2.isAuthed) != null ? _l : s2.active) != null ? _m : s2.auth === true
      ),
      email: (_n = s2.email) != null ? _n : acc == null ? void 0 : acc.email,
      account: (_p = (_o = acc == null ? void 0 : acc.name) != null ? _o : s2.accountName) != null ? _p : typeof s2.account === "string" ? s2.account : void 0,
      status: (_r = (_q = s2.status) != null ? _q : s2.state) != null ? _r : s2.mode
    };
  });
}
function ConnectionsPanel({ bridge, native, theme }) {
  const api = (0, import_plugin_sdk.useApi)(bridge);
  const closeMe = () => {
    var _a;
    try {
      (_a = bridge == null ? void 0 : bridge.close) == null ? void 0 : _a.call(bridge);
    } catch (e) {
    }
  };
  const [rawServices, setRawServices] = (0, import_react.useState)([]);
  const [loading, setLoading] = (0, import_react.useState)(true);
  const [errorMsg, setErrorMsg] = (0, import_react.useState)(null);
  const [confirmTarget, setConfirmTarget] = (0, import_react.useState)(null);
  const [busyId, setBusyId] = (0, import_react.useState)(null);
  const [hintFor, setHintFor] = (0, import_react.useState)(null);
  const c = (theme == null ? void 0 : theme.colors) || {};
  const palette = {
    bg: c.bgPrimary || "#FAF6EE",
    surface: c.bgSecondary || "#F2EADC",
    surfaceMuted: c.bgTertiary || "#EDE2CF",
    border: c.border || "rgba(26,20,16,0.06)",
    text: c.textPrimary || "#1a1410",
    textSoft: c.textSecondary || "#6b5a47",
    textMuted: c.textMuted || "#9a8870",
    accent: c.accent || "#FF7A28",
    accentSoft: c.accentSoft || "rgba(255,122,40,0.10)",
    accentDeep: c.accentHover || "#E0680E",
    success: "#5A8A5C",
    danger: c.red || "#C15545"
  };
  const load = (0, import_react.useCallback)(() => __async(null, null, function* () {
    var _a;
    setLoading(true);
    setErrorMsg(null);
    try {
      const raw = yield api.call("connections.list", {}, "personal-assistant-ui-mcp");
      console.log("[connections-panel] connections.list raw:", (_a = JSON.stringify(raw)) == null ? void 0 : _a.slice(0, 600));
      const all = unwrapList(raw);
      console.log(
        "[connections-panel] connections.list parsed:",
        all.length,
        "services",
        all.filter((s2) => s2.authed).map((s2) => `${s2.id}=connected`).join(", ")
      );
      setRawServices(all);
    } catch (e) {
      console.warn("[connections-panel] load failed:", (e == null ? void 0 : e.message) || e);
      setErrorMsg("Couldn\u2019t load your connections.");
      setRawServices([]);
    } finally {
      setLoading(false);
    }
  }), [api]);
  (0, import_react.useEffect)(() => {
    load();
  }, [load]);
  const rows = (0, import_react.useMemo)(() => {
    const liveById = new Map(rawServices.map((s2) => [s2.id.toLowerCase(), s2]));
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    for (const id of Object.keys(SERVICE_FLAVOR)) {
      const f = SERVICE_FLAVOR[id];
      const live = liveById.get(id);
      seen.add(id);
      out.push({
        id,
        name: (live == null ? void 0 : live.name) && live.name !== live.id ? live.name : prettyName(id),
        icon: f.icon,
        why: f.why || void 0,
        authed: !!(live == null ? void 0 : live.authed),
        account: (live == null ? void 0 : live.email) || (live == null ? void 0 : live.account)
      });
    }
    for (const s2 of rawServices) {
      const k = s2.id.toLowerCase();
      if (seen.has(k)) continue;
      out.push({
        id: s2.id,
        name: s2.name && s2.name !== s2.id ? s2.name : prettyName(s2.id),
        icon: "\u{1F517}",
        why: void 0,
        authed: !!s2.authed,
        account: s2.email || s2.account
      });
    }
    out.sort((a, b) => {
      if (a.authed !== b.authed) return a.authed ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return out;
  }, [rawServices]);
  const askDisconnect = (row) => {
    var _a, _b;
    (_b = (_a = native == null ? void 0 : native.haptics) == null ? void 0 : _a.selection) == null ? void 0 : _b.call(_a);
    setConfirmTarget({ id: row.id, name: row.name });
  };
  const doDisconnect = () => __async(null, null, function* () {
    var _a, _b, _c, _d;
    if (!confirmTarget) return;
    const target = confirmTarget;
    setConfirmTarget(null);
    setBusyId(target.id);
    try {
      yield api.call("connections.disconnect", { service_id: target.id }, "personal-assistant-ui-mcp");
      (_b = (_a = native == null ? void 0 : native.haptics) == null ? void 0 : _a.notification) == null ? void 0 : _b.call(_a, "success");
      setRawServices((prev) => prev.map(
        (x) => x.id.toLowerCase() === target.id.toLowerCase() ? __spreadProps(__spreadValues({}, x), { authed: false }) : x
      ));
      setTimeout(() => {
        load();
      }, 600);
    } catch (e) {
      console.warn("[connections-panel] disconnect failed:", (e == null ? void 0 : e.message) || e);
      (_d = (_c = native == null ? void 0 : native.haptics) == null ? void 0 : _c.error) == null ? void 0 : _d.call(_c);
      setErrorMsg(`Couldn\u2019t disconnect ${target.name}.`);
    } finally {
      setBusyId(null);
    }
  });
  const askConnect = (row) => {
    var _a, _b;
    (_b = (_a = native == null ? void 0 : native.haptics) == null ? void 0 : _a.selection) == null ? void 0 : _b.call(_a);
    setHintFor({ id: row.id, name: row.name, prompt: `connect my ${row.name}` });
  };
  const confirmConnect = () => {
    var _a, _b, _c, _d;
    if (!hintFor) return;
    const text = hintFor.prompt;
    setHintFor(null);
    try {
      (_b = (_a = native == null ? void 0 : native.haptics) == null ? void 0 : _a.notification) == null ? void 0 : _b.call(_a, "success");
      const sender = bridge == null ? void 0 : bridge.sendMessage;
      if (typeof sender === "function") {
        sender(text);
        closeMe();
      } else {
        console.warn("[connections-panel] bridge.sendMessage not available \u2014 host SDK out of date");
      }
    } catch (e) {
      (_d = (_c = native == null ? void 0 : native.haptics) == null ? void 0 : _c.error) == null ? void 0 : _d.call(_c);
    }
  };
  const prepareConnect = () => {
    if (!hintFor) return;
    const text = hintFor.prompt;
    setHintFor(null);
    try {
      const prep = bridge == null ? void 0 : bridge.prepareMessage;
      if (typeof prep === "function") {
        prep(text);
      }
    } catch (e) {
    }
    closeMe();
  };
  if (loading) {
    return /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [s.container, { backgroundColor: palette.bg }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.ActivityIndicator, { color: palette.accent, style: { marginTop: 60 } }));
  }
  const connectedCount = rows.filter((r) => r.authed).length;
  return /* @__PURE__ */ import_react.default.createElement(import_react_native.ScrollView, { style: [s.container, { backgroundColor: palette.bg }], contentContainerStyle: { paddingBottom: 32 } }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.subtitle, { color: palette.textMuted }] }, "I'm sharper when I can see your stuff \u2728", "  ", "\xB7", "  ", /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: { color: palette.text, fontWeight: "600" } }, connectedCount, " of ", rows.length), " connected"), errorMsg ? /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.errorText, { color: palette.danger }] }, errorMsg) : null, rows.map((row) => {
    const busy = busyId === row.id;
    return /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { key: row.id, style: [s.card, { backgroundColor: palette.surface }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: s.cardRow }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: s.icon }, row.icon), /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: { flex: 1 } }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.name, { color: palette.text }] }, row.name), row.authed ? /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: s.statusRow }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [s.statusDot, { backgroundColor: palette.success }] }), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.statusText, { color: palette.success }] }, "Connected")), row.account ? /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.detail, { color: palette.textMuted }], numberOfLines: 1 }, row.account) : null) : /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, row.why ? /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.why, { color: palette.textSoft }], numberOfLines: 3 }, row.why) : null, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: s.statusRow }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [s.statusDot, { backgroundColor: palette.textMuted }] }), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.statusText, { color: palette.textMuted }] }, "Not connected")))), /* @__PURE__ */ import_react.default.createElement(
      import_react_native.Pressable,
      {
        onPress: () => row.authed ? askDisconnect(row) : askConnect(row),
        disabled: busy,
        style: [s.btn, {
          backgroundColor: row.authed ? "transparent" : palette.accent,
          borderColor: row.authed ? palette.border : palette.accent,
          opacity: busy ? 0.5 : 1
        }]
      },
      busy ? /* @__PURE__ */ import_react.default.createElement(import_react_native.ActivityIndicator, { color: row.authed ? palette.danger : "#fff", size: "small" }) : /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: {
        fontSize: 12,
        fontWeight: "600",
        color: row.authed ? palette.danger : "#fff"
      } }, row.authed ? "Disconnect" : "Connect")
    )));
  }), /* @__PURE__ */ import_react.default.createElement(import_react_native.Modal, { visible: !!hintFor, transparent: true, animationType: "fade", onRequestClose: () => setHintFor(null) }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: s.overlay }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [s.confirmBox, { backgroundColor: palette.surface }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.confirmTitle, { color: palette.text }] }, "Connect ", (hintFor == null ? void 0 : hintFor.name) || "", "?"), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.confirmBody, { color: palette.textSoft }] }, "I\u2019ll send this for you and walk you through the rest:"), /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [s.promptBox, { backgroundColor: palette.accentSoft }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.promptText, { color: palette.accentDeep }] }, "\u201C", (hintFor == null ? void 0 : hintFor.prompt) || "", "\u201D")), /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: s.threeBtnRow }, /* @__PURE__ */ import_react.default.createElement(
    import_react_native.Pressable,
    {
      onPress: () => setHintFor(null),
      style: [s.smallBtn, { backgroundColor: palette.surfaceMuted }]
    },
    /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: { color: palette.textSoft, fontSize: 13, fontWeight: "500" } }, "Cancel")
  ), /* @__PURE__ */ import_react.default.createElement(
    import_react_native.Pressable,
    {
      onPress: prepareConnect,
      style: [s.smallBtn, { backgroundColor: palette.surfaceMuted }]
    },
    /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: { color: palette.text, fontSize: 13, fontWeight: "500" } }, "Edit first")
  ), /* @__PURE__ */ import_react.default.createElement(
    import_react_native.Pressable,
    {
      onPress: confirmConnect,
      style: [s.smallBtn, { backgroundColor: palette.accent }]
    },
    /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: { color: "#fff", fontSize: 13, fontWeight: "600" } }, "Send")
  ))))), /* @__PURE__ */ import_react.default.createElement(import_react_native.Modal, { visible: !!confirmTarget, transparent: true, animationType: "fade", onRequestClose: () => setConfirmTarget(null) }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: s.overlay }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [s.confirmBox, { backgroundColor: palette.surface }] }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.confirmTitle, { color: palette.text }] }, "Disconnect?"), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [s.confirmBody, { color: palette.textMuted }] }, "I won\u2019t be able to use", " ", /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: { fontWeight: "600", color: palette.text } }, (confirmTarget == null ? void 0 : confirmTarget.name) || ""), " ", "until you reconnect."), /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: s.confirmBtns }, /* @__PURE__ */ import_react.default.createElement(
    import_react_native.Pressable,
    {
      onPress: () => setConfirmTarget(null),
      style: [s.cancelBtn, { backgroundColor: palette.surfaceMuted }]
    },
    /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: { color: palette.text, fontSize: 14, fontWeight: "500" } }, "Keep connected")
  ), /* @__PURE__ */ import_react.default.createElement(
    import_react_native.Pressable,
    {
      onPress: doDisconnect,
      style: [s.dangerBtn, { backgroundColor: palette.danger }]
    },
    /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: { color: "#fff", fontSize: 14, fontWeight: "600" } }, "Disconnect")
  ))))));
}
var connections_panel_default = {
  id: "connections-panel",
  type: "ui",
  version: "1.0.0",
  Component: ConnectionsPanel
};
var s = import_react_native.StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 4 },
  subtitle: { fontSize: 13, marginBottom: 14, marginLeft: 4, lineHeight: 18 },
  errorText: { fontSize: 13, marginBottom: 12, marginLeft: 4 },
  card: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 10 },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: { fontSize: 28, marginTop: 2 },
  name: { fontSize: 15, fontWeight: "600", letterSpacing: -0.2 },
  why: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  detail: { fontSize: 12, marginTop: 4 },
  statusRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  statusDot: { width: 7, height: 7, borderRadius: 3.5, marginRight: 6 },
  statusText: { fontSize: 11, fontWeight: "500" },
  btn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 92,
    alignItems: "center"
  },
  // Modals
  overlay: { flex: 1, backgroundColor: "rgba(26,20,16,0.55)", justifyContent: "center", alignItems: "center", padding: 24 },
  confirmBox: { borderRadius: 20, padding: 22, width: "100%", maxWidth: 360 },
  confirmTitle: { fontSize: 18, fontWeight: "600", marginBottom: 8 },
  confirmBody: { fontSize: 14, lineHeight: 20 },
  confirmBtns: { flexDirection: "row", gap: 10, marginTop: 18 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  dangerBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  fullBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  promptBox: { borderRadius: 10, padding: 14, marginTop: 12 },
  promptText: { fontSize: 15, fontWeight: "600", textAlign: "center", fontStyle: "italic" },
  threeBtnRow: { flexDirection: "row", gap: 8, marginTop: 18 },
  smallBtn: { flex: 1, paddingVertical: 11, borderRadius: 12, alignItems: "center" }
});
