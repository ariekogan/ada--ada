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

// rn-src/coach-onboarding.tsx
var coach_onboarding_exports = {};
__export(coach_onboarding_exports, {
  default: () => coach_onboarding_default
});
module.exports = __toCommonJS(coach_onboarding_exports);
var import_react = __toESM(require("react"), 1);
var import_react_native = require("react-native");
var import_plugin_sdk = require("@adas/plugin-sdk");
var HOST_CHAT_BAR_PX = 140;
var COACH = "coach-mcp";
var QUESTIONS = [
  { key: "goal", label: "Step 1 of 5", title: "What brings you here?", helper: "Tell me what you'd want me to help with. In your own words.", placeholder: "e.g. lose some weight, feel more energetic..." },
  { key: "typical_day", label: "Step 2 of 5", title: "Walk me through a typical day", helper: "When do you wake up, work hours, when you eat, when you wind down.", placeholder: "e.g. wake 7am, work 9-6, lunch at 1pm..." },
  { key: "history_what_worked", label: "Step 3 of 5", title: "What's worked before?", helper: "Any approach, habit, or experiment that's helped you in the past.", placeholder: "e.g. tracking calories for a month..." },
  { key: "history_what_failed", label: "Step 4 of 5", title: "What hasn't worked?", helper: "Anything you've tried that fell flat. No judgment.", placeholder: "e.g. keto, 5am workouts..." }
];
var FINAL_STEP = QUESTIONS.length;
var CoachOnboarding = function CoachOnboarding2({ bridge, native, theme }) {
  var _a, _b, _c, _d, _e, _f;
  const api = (0, import_plugin_sdk.useApi)(bridge);
  const t = theme || {};
  const C = {
    bg: ((_a = t.colors) == null ? void 0 : _a.bg) || "#faf6ef",
    surface: ((_b = t.colors) == null ? void 0 : _b.surface) || "#ffffff",
    border: ((_c = t.colors) == null ? void 0 : _c.border) || "#e8e0d2",
    text: ((_d = t.colors) == null ? void 0 : _d.text) || "#1a1a1a",
    textMuted: ((_e = t.colors) == null ? void 0 : _e.textMuted) || "#7a7166",
    accent: ((_f = t.colors) == null ? void 0 : _f.accent) || "#e0712b",
    accentText: "#ffffff"
  };
  const S = import_react.default.useMemo(() => makeStyles(C), [C.bg, C.surface, C.border, C.text, C.textMuted, C.accent]);
  const [step, setStep] = (0, import_react.useState)(0);
  const [answers, setAnswers] = (0, import_react.useState)({});
  const [currentInput, setCurrentInput] = (0, import_react.useState)("");
  const [amTime, setAmTime] = (0, import_react.useState)("07:30");
  const [pmTime, setPmTime] = (0, import_react.useState)("21:30");
  const [loading, setLoading] = (0, import_react.useState)(true);
  const [submitting, setSubmitting] = (0, import_react.useState)(false);
  const [done, setDone] = (0, import_react.useState)(false);
  const [kbHeight, setKbHeight] = (0, import_react.useState)(0);
  (0, import_react.useEffect)(() => {
    (() => __async(null, null, function* () {
      var _a2;
      yield api.call("coach.state.initOnboarding", {}, COACH);
      const r = yield api.call("coach.state.get", {}, COACH);
      const parsed = typeof r === "string" ? JSON.parse(r) : r;
      const existing = ((_a2 = parsed == null ? void 0 : parsed.state) == null ? void 0 : _a2.onboarding_answers) || {};
      setAnswers(existing);
      setLoading(false);
    }))();
  }, [api]);
  (0, import_react.useEffect)(() => {
    const showEvt = import_react_native.Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = import_react_native.Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = import_react_native.Keyboard.addListener(showEvt, (e) => {
      var _a2;
      setKbHeight(((_a2 = e.endCoordinates) == null ? void 0 : _a2.height) || 0);
    });
    const hideSub = import_react_native.Keyboard.addListener(hideEvt, () => setKbHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);
  (0, import_react.useEffect)(() => {
    if (step < QUESTIONS.length) {
      setCurrentInput(answers[QUESTIONS[step].key] || "");
    }
  }, [step, answers]);
  const [error, setError] = (0, import_react.useState)(null);
  const next = (0, import_react.useCallback)(() => __async(null, null, function* () {
    var _a2, _b2;
    setError(null);
    try {
      if (step < QUESTIONS.length) {
        const q2 = QUESTIONS[step];
        const v = currentInput.trim();
        if (!v) return;
        setAnswers((prev) => __spreadProps(__spreadValues({}, prev), { [q2.key]: v }));
        setStep(step + 1);
        (_b2 = (_a2 = native == null ? void 0 : native.haptics) == null ? void 0 : _a2.selection) == null ? void 0 : _b2.call(_a2);
        try {
          yield api.call("coach.state.captureOnboardingAnswer", { key: q2.key, value: v }, COACH);
        } catch (err) {
          setError(`Save failed: ${(err == null ? void 0 : err.message) || String(err)}`);
        }
      } else if (step === FINAL_STEP) {
        setSubmitting(true);
        setStep(step + 1);
        try {
          yield api.call("coach.state.captureOnboardingAnswer", { key: "check_in_when", value: `${amTime} / ${pmTime}` }, COACH);
          yield api.call("coach.state.update", { check_in_window: { am: amTime, pm: pmTime, tz: "local" } }, COACH);
        } catch (err) {
          setError(`Save failed: ${(err == null ? void 0 : err.message) || String(err)}`);
        }
        setSubmitting(false);
      }
    } catch (err) {
      setError(`Next failed: ${(err == null ? void 0 : err.message) || String(err)}`);
    }
  }), [step, currentInput, amTime, pmTime, api, native]);
  const submit = (0, import_react.useCallback)(() => __async(null, null, function* () {
    var _a2, _b2;
    setError(null);
    setSubmitting(true);
    try {
      const goalText = answers.goal || "unstated goal";
      yield api.call("coach.goals.add", { text: goalText, reason: "initial goal from onboarding wizard" }, COACH);
      yield api.call("coach.state.advancePhase", {}, COACH);
      (_b2 = (_a2 = native == null ? void 0 : native.haptics) == null ? void 0 : _a2.selection) == null ? void 0 : _b2.call(_a2);
      setDone(true);
    } catch (err) {
      setError(`Submit failed: ${(err == null ? void 0 : err.message) || String(err)}`);
    }
    setSubmitting(false);
  }), [answers, api, native]);
  const back = () => {
    if (step > 0) setStep(step - 1);
  };
  const skip = () => setStep(step + 1);
  if (loading) {
    return /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: S.center }, /* @__PURE__ */ import_react.default.createElement(import_react_native.ActivityIndicator, { color: C.accent }));
  }
  if (done) {
    return /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: S.scroll }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: S.content }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: S.progressBar }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [S.progressFill, { width: "100%" }] })), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: S.icon }, "\u2728"), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [S.h1, { textAlign: "center" }] }, "Welcome aboard"), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: S.doneText }, "I'm in observing mode for the next week.", "\n", "Log meals or activity as you want \u2014 I won't push advice.", "\n\n", "At week 1, I'll share one thing I noticed.", "\n", "That's when the real coaching begins.")));
  }
  const progress = Math.min(100, (step + 1) / (QUESTIONS.length + 2) * 100);
  const dynamicPadding = HOST_CHAT_BAR_PX + (kbHeight > 0 ? kbHeight - 20 : 0);
  if (step === FINAL_STEP + 1) {
    return /* @__PURE__ */ import_react.default.createElement(
      import_react_native.ScrollView,
      {
        style: S.scroll,
        contentContainerStyle: [S.content, { paddingBottom: dynamicPadding }],
        keyboardShouldPersistTaps: "handled"
      },
      /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: S.progressBar }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [S.progressFill, { width: "90%" }] })),
      /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: S.icon }, "\u{1F3AF}"),
      /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [S.h1, { textAlign: "center" }] }, "All set!"),
      /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: S.helper }, "Here's what I heard. I'll spend the next week just listening \u2014 no advice, no nagging."),
      /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: { marginVertical: 20 } }, QUESTIONS.map((q2) => /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { key: q2.key, style: S.summaryRow }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: S.summaryKey }, q2.title.split("?")[0]), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: S.summaryVal }, answers[q2.key] || "\u2014"))), /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: S.summaryRow }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: S.summaryKey }, "Check-in window"), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: S.summaryVal }, amTime, " / ", pmTime))),
      /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: S.btnRow }, /* @__PURE__ */ import_react.default.createElement(import_react_native.TouchableOpacity, { style: S.btn, onPress: () => setStep(0) }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: S.btnText }, "Edit")), /* @__PURE__ */ import_react.default.createElement(import_react_native.TouchableOpacity, { style: [S.btn, S.btnPrimary, submitting && S.btnDisabled], onPress: submit, disabled: submitting }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: S.btnPrimaryText }, submitting ? "Saving\u2026" : "Looks good")))
    );
  }
  if (step === FINAL_STEP) {
    return /* @__PURE__ */ import_react.default.createElement(
      import_react_native.ScrollView,
      {
        style: S.scroll,
        contentContainerStyle: [S.content, { paddingBottom: dynamicPadding }],
        keyboardShouldPersistTaps: "handled"
      },
      /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: S.progressBar }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [S.progressFill, { width: `${progress}%` }] })),
      /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: S.stepLabel }, "Step 5 of 5"),
      /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: S.h1 }, "When can I talk to you?"),
      /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: S.helper }, "Morning person or night owl? I'll check in twice a day \u2014 light touch."),
      /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: { flexDirection: "row", gap: 10, marginTop: 8 } }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: { flex: 1 } }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [S.muted, { marginBottom: 6 }] }, "Morning"), /* @__PURE__ */ import_react.default.createElement(import_react_native.TextInput, { style: S.input, value: amTime, onChangeText: setAmTime, placeholder: "07:30", placeholderTextColor: C.textMuted })), /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: { flex: 1 } }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [S.muted, { marginBottom: 6 }] }, "Evening"), /* @__PURE__ */ import_react.default.createElement(import_react_native.TextInput, { style: S.input, value: pmTime, onChangeText: setPmTime, placeholder: "21:30", placeholderTextColor: C.textMuted }))),
      /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: S.btnRow }, /* @__PURE__ */ import_react.default.createElement(import_react_native.TouchableOpacity, { style: S.btn, onPress: back }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: S.btnText }, "Back")), /* @__PURE__ */ import_react.default.createElement(import_react_native.TouchableOpacity, { style: [S.btn, S.btnPrimary], onPress: next }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: S.btnPrimaryText }, "Next")))
    );
  }
  const q = QUESTIONS[step];
  return /* @__PURE__ */ import_react.default.createElement(
    import_react_native.ScrollView,
    {
      style: S.scroll,
      contentContainerStyle: [S.content, { paddingBottom: dynamicPadding }],
      keyboardShouldPersistTaps: "handled",
      keyboardDismissMode: "interactive"
    },
    /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: S.progressBar }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: [S.progressFill, { width: `${progress}%` }] })),
    /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: S.stepLabel }, q.label),
    /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: S.h1 }, q.title),
    /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: S.helper }, q.helper),
    /* @__PURE__ */ import_react.default.createElement(
      import_react_native.TextInput,
      {
        style: [S.input, { minHeight: 100, textAlignVertical: "top" }],
        value: currentInput,
        onChangeText: setCurrentInput,
        placeholder: q.placeholder,
        placeholderTextColor: C.textMuted,
        multiline: true,
        autoFocus: true
      }
    ),
    error && /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: { color: "#c43b3b", fontSize: 13, marginTop: 8 } }, error),
    /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: S.btnRow }, step > 0 && /* @__PURE__ */ import_react.default.createElement(import_react_native.TouchableOpacity, { style: S.btn, onPress: back }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: S.btnText }, "Back")), /* @__PURE__ */ import_react.default.createElement(import_react_native.TouchableOpacity, { style: [S.btn, S.btnPrimary, !currentInput.trim() && S.btnDisabled], onPress: next, disabled: !currentInput.trim() }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: S.btnPrimaryText }, "Next"))),
    /* @__PURE__ */ import_react.default.createElement(import_react_native.TouchableOpacity, { onPress: skip, style: { alignSelf: "center", marginTop: 12 } }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: [S.muted, { fontSize: 13 }] }, "Skip this"))
  );
};
var coach_onboarding_default = import_plugin_sdk.PluginSDK.register("coach-onboarding", {
  type: "ui",
  version: "1.0.2",
  capabilities: { haptics: true },
  Component: CoachOnboarding
});
function makeStyles(C) {
  return import_react_native.StyleSheet.create({
    scroll: { flex: 1, backgroundColor: C.bg },
    content: { padding: 24, paddingBottom: 40 },
    center: { justifyContent: "center", alignItems: "center", flex: 1, backgroundColor: C.bg },
    progressBar: { height: 3, backgroundColor: C.border, borderRadius: 999, marginBottom: 32, overflow: "hidden" },
    progressFill: { height: 3, backgroundColor: C.accent },
    stepLabel: { fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, fontWeight: "700", marginBottom: 12 },
    h1: { fontSize: 24, color: C.text, fontWeight: "600", lineHeight: 31, marginBottom: 12 },
    helper: { fontSize: 14, color: C.textMuted, lineHeight: 21, marginBottom: 24 },
    input: { backgroundColor: C.surface, borderColor: C.border, borderWidth: 1, borderRadius: 10, padding: 14, color: C.text, fontSize: 16 },
    muted: { fontSize: 12, color: C.textMuted },
    btnRow: { flexDirection: "row", gap: 10, marginTop: 24 },
    btn: { flex: 1, paddingVertical: 14, borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, alignItems: "center" },
    btnPrimary: { backgroundColor: C.accent, borderColor: C.accent },
    btnDisabled: { opacity: 0.4 },
    btnText: { color: C.text, fontSize: 15, fontWeight: "500" },
    btnPrimaryText: { color: C.accentText, fontSize: 15, fontWeight: "500" },
    icon: { fontSize: 64, textAlign: "center", marginVertical: 24 },
    doneText: { fontSize: 15, color: C.text, textAlign: "center", lineHeight: 24 },
    summaryRow: { flexDirection: "row", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border, gap: 12 },
    summaryKey: { color: C.textMuted, fontSize: 13, minWidth: 120 },
    summaryVal: { color: C.text, fontSize: 13, flex: 1 }
  });
}
