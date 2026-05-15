/**
 * MyCoach Onboarding — React Native Plugin (guided 5-step wizard)
 * Captures answers via coach.state.captureOnboardingAnswer, sets the
 * first goal via coach.goals.add, advances phase via coach.state.advancePhase.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet, Platform, Keyboard } from 'react-native';
import { useApi } from '@adas/plugin-sdk';
import type { PluginProps } from '@adas/plugin-sdk';

// Host app's chat bar height (the "Ask Ada anything…" input) + safe area.
// The plugin can't measure this from the host, so we hard-code a generous value.
const HOST_CHAT_BAR_PX = 140;

const COACH = 'coach-mcp';

const QUESTIONS = [
  { key: 'goal', label: 'Step 1 of 5', title: "What brings you here?", helper: "Tell me what you'd want me to help with. In your own words.", placeholder: "e.g. lose some weight, feel more energetic..." },
  { key: 'typical_day', label: 'Step 2 of 5', title: "Walk me through a typical day", helper: "When do you wake up, work hours, when you eat, when you wind down.", placeholder: "e.g. wake 7am, work 9-6, lunch at 1pm..." },
  { key: 'history_what_worked', label: 'Step 3 of 5', title: "What's worked before?", helper: "Any approach, habit, or experiment that's helped you in the past.", placeholder: "e.g. tracking calories for a month..." },
  { key: 'history_what_failed', label: 'Step 4 of 5', title: "What hasn't worked?", helper: "Anything you've tried that fell flat. No judgment.", placeholder: "e.g. keto, 5am workouts..." },
];

const FINAL_STEP = QUESTIONS.length; // step 5: check-in window

interface State { phase: string; onboarding_answers?: Record<string, string>; }

const CoachOnboarding = function CoachOnboarding({ bridge, native, theme }: PluginProps) {
    const api = useApi(bridge);
    // Build theme-aware styles; falls back to host's beige/cream palette.
    const t = theme || {};
    const C = {
      bg: t.colors?.bg || '#faf6ef',
      surface: t.colors?.surface || '#ffffff',
      border: t.colors?.border || '#e8e0d2',
      text: t.colors?.text || '#1a1a1a',
      textMuted: t.colors?.textMuted || '#7a7166',
      accent: t.colors?.accent || '#e0712b',
      accentText: '#ffffff',
    };
    const S = React.useMemo(() => makeStyles(C), [C.bg, C.surface, C.border, C.text, C.textMuted, C.accent]);
    const [step, setStep] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [currentInput, setCurrentInput] = useState('');
    const [amTime, setAmTime] = useState('07:30');
    const [pmTime, setPmTime] = useState('21:30');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(false);
    const [kbHeight, setKbHeight] = useState(0);

    useEffect(() => {
      (async () => {
        await api.call('coach.state.initOnboarding', {}, COACH);
        const r = await api.call('coach.state.get', {}, COACH);
        const parsed = typeof r === 'string' ? JSON.parse(r) : r;
        const existing = parsed?.state?.onboarding_answers || {};
        setAnswers(existing);
        setLoading(false);
      })();
    }, [api]);

    // Manually track keyboard height — host app's chat bar overlay makes
    // KeyboardAvoidingView alone insufficient. We add explicit bottom
    // padding equal to keyboard + chat-bar height so the TextInput sits
    // visibly above both.
    useEffect(() => {
      const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
      const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
      const showSub = Keyboard.addListener(showEvt, (e) => {
        setKbHeight(e.endCoordinates?.height || 0);
      });
      const hideSub = Keyboard.addListener(hideEvt, () => setKbHeight(0));
      return () => { showSub.remove(); hideSub.remove(); };
    }, []);

    useEffect(() => {
      if (step < QUESTIONS.length) {
        setCurrentInput(answers[QUESTIONS[step].key] || '');
      }
    }, [step, answers]);

    const [error, setError] = useState<string | null>(null);

    const next = useCallback(async () => {
      setError(null);
      try {
        if (step < QUESTIONS.length) {
          const q = QUESTIONS[step];
          const v = currentInput.trim();
          if (!v) return;
          // Advance the visual step FIRST so the user sees progress regardless
          // of how slow / flaky the backend call is.
          setAnswers(prev => ({ ...prev, [q.key]: v }));
          setStep(step + 1);
          native?.haptics?.selection?.();
          // Persist in background — if it fails, surface the error but stay
          // on the new step (the user can keep going; the wizard is recoverable).
          try {
            await api.call('coach.state.captureOnboardingAnswer', { key: q.key, value: v }, COACH);
          } catch (err: any) {
            setError(`Save failed: ${err?.message || String(err)}`);
          }
        } else if (step === FINAL_STEP) {
          setSubmitting(true);
          setStep(step + 1);
          try {
            await api.call('coach.state.captureOnboardingAnswer', { key: 'check_in_when', value: `${amTime} / ${pmTime}` }, COACH);
            await api.call('coach.state.update', { check_in_window: { am: amTime, pm: pmTime, tz: 'local' } }, COACH);
          } catch (err: any) {
            setError(`Save failed: ${err?.message || String(err)}`);
          }
          setSubmitting(false);
        }
      } catch (err: any) {
        setError(`Next failed: ${err?.message || String(err)}`);
      }
    }, [step, currentInput, amTime, pmTime, api, native]);

    const submit = useCallback(async () => {
      setError(null);
      setSubmitting(true);
      try {
        const goalText = answers.goal || 'unstated goal';
        await api.call('coach.goals.add', { text: goalText, reason: 'initial goal from onboarding wizard' }, COACH);
        await api.call('coach.state.advancePhase', {}, COACH);
        native?.haptics?.selection?.();
        setDone(true);
      } catch (err: any) {
        setError(`Submit failed: ${err?.message || String(err)}`);
      }
      setSubmitting(false);
    }, [answers, api, native]);

    const back = () => { if (step > 0) setStep(step - 1); };
    const skip = () => setStep(step + 1);

    if (loading) {
      return <View style={S.center}><ActivityIndicator color={C.accent} /></View>;
    }

    if (done) {
      return (
        <View style={S.scroll}>
          <View style={S.content}>
            <View style={S.progressBar}><View style={[S.progressFill, { width: '100%' }]} /></View>
            <Text style={S.icon}>✨</Text>
            <Text style={[S.h1, { textAlign: 'center' }]}>Welcome aboard</Text>
            <Text style={S.doneText}>
              I'm in observing mode for the next week.{'\n'}
              Log meals or activity as you want — I won't push advice.{'\n\n'}
              At week 1, I'll share one thing I noticed.{'\n'}
              That's when the real coaching begins.
            </Text>
          </View>
        </View>
      );
    }

    const progress = Math.min(100, ((step + 1) / (QUESTIONS.length + 2)) * 100);

    // Dynamic bottom padding: clears host chat bar always, plus keyboard height
    // when keyboard is up. ScrollView will scroll to focused input automatically.
    const dynamicPadding = HOST_CHAT_BAR_PX + (kbHeight > 0 ? kbHeight - 20 : 0);

    if (step === FINAL_STEP + 1) {
      // Summary
      return (
        <ScrollView
          style={S.scroll}
          contentContainerStyle={[S.content, { paddingBottom: dynamicPadding }]}
          keyboardShouldPersistTaps="handled">
          <View style={S.progressBar}><View style={[S.progressFill, { width: '90%' }]} /></View>
          <Text style={S.icon}>🎯</Text>
          <Text style={[S.h1, { textAlign: 'center' }]}>All set!</Text>
          <Text style={S.helper}>Here's what I heard. I'll spend the next week just listening — no advice, no nagging.</Text>
          <View style={{ marginVertical: 20 }}>
            {QUESTIONS.map(q => (
              <View key={q.key} style={S.summaryRow}>
                <Text style={S.summaryKey}>{q.title.split('?')[0]}</Text>
                <Text style={S.summaryVal}>{answers[q.key] || '—'}</Text>
              </View>
            ))}
            <View style={S.summaryRow}>
              <Text style={S.summaryKey}>Check-in window</Text>
              <Text style={S.summaryVal}>{amTime} / {pmTime}</Text>
            </View>
          </View>
          <View style={S.btnRow}>
            <TouchableOpacity style={S.btn} onPress={() => setStep(0)}>
              <Text style={S.btnText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[S.btn, S.btnPrimary, submitting && S.btnDisabled]} onPress={submit} disabled={submitting}>
              <Text style={S.btnPrimaryText}>{submitting ? 'Saving…' : 'Looks good'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      );
    }

    if (step === FINAL_STEP) {
      return (
        <ScrollView
          style={S.scroll}
          contentContainerStyle={[S.content, { paddingBottom: dynamicPadding }]}
          keyboardShouldPersistTaps="handled">
          <View style={S.progressBar}><View style={[S.progressFill, { width: `${progress}%` }]} /></View>
          <Text style={S.stepLabel}>Step 5 of 5</Text>
          <Text style={S.h1}>When can I talk to you?</Text>
          <Text style={S.helper}>Morning person or night owl? I'll check in twice a day — light touch.</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={[S.muted, { marginBottom: 6 }]}>Morning</Text>
              <TextInput style={S.input} value={amTime} onChangeText={setAmTime} placeholder="07:30" placeholderTextColor={C.textMuted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[S.muted, { marginBottom: 6 }]}>Evening</Text>
              <TextInput style={S.input} value={pmTime} onChangeText={setPmTime} placeholder="21:30" placeholderTextColor={C.textMuted} />
            </View>
          </View>
          <View style={S.btnRow}>
            <TouchableOpacity style={S.btn} onPress={back}><Text style={S.btnText}>Back</Text></TouchableOpacity>
            <TouchableOpacity style={[S.btn, S.btnPrimary]} onPress={next}><Text style={S.btnPrimaryText}>Next</Text></TouchableOpacity>
          </View>
        </ScrollView>
      );
    }

    const q = QUESTIONS[step];
    return (
      <ScrollView
        style={S.scroll}
        contentContainerStyle={[S.content, { paddingBottom: dynamicPadding }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <View style={S.progressBar}><View style={[S.progressFill, { width: `${progress}%` }]} /></View>
        <Text style={S.stepLabel}>{q.label}</Text>
        <Text style={S.h1}>{q.title}</Text>
        <Text style={S.helper}>{q.helper}</Text>
        <TextInput
          style={[S.input, { minHeight: 100, textAlignVertical: 'top' }]}
          value={currentInput}
          onChangeText={setCurrentInput}
          placeholder={q.placeholder}
          placeholderTextColor={C.textMuted}
          multiline
          autoFocus
        />
        {error && <Text style={{ color: '#c43b3b', fontSize: 13, marginTop: 8 }}>{error}</Text>}
        <View style={S.btnRow}>
          {step > 0 && <TouchableOpacity style={S.btn} onPress={back}><Text style={S.btnText}>Back</Text></TouchableOpacity>}
          <TouchableOpacity style={[S.btn, S.btnPrimary, !currentInput.trim() && S.btnDisabled]} onPress={next} disabled={!currentInput.trim()}>
            <Text style={S.btnPrimaryText}>Next</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={skip} style={{ alignSelf: 'center', marginTop: 12 }}>
          <Text style={[S.muted, { fontSize: 13 }]}>Skip this</Text>
        </TouchableOpacity>
      </ScrollView>
    );
};

export default {
  id: 'coach-onboarding',
  type: 'ui',
  version: '1.0.2',
  capabilities: { haptics: true },
  Component: CoachOnboarding,
};

function makeStyles(C: any) {
  return StyleSheet.create({
    scroll: { flex: 1, backgroundColor: C.bg },
    content: { padding: 24, paddingBottom: 40 },
    center: { justifyContent: 'center', alignItems: 'center', flex: 1, backgroundColor: C.bg },
    progressBar: { height: 3, backgroundColor: C.border, borderRadius: 999, marginBottom: 32, overflow: 'hidden' },
    progressFill: { height: 3, backgroundColor: C.accent },
    stepLabel: { fontSize: 11, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1, fontWeight: '700', marginBottom: 12 },
    h1: { fontSize: 24, color: C.text, fontWeight: '600', lineHeight: 31, marginBottom: 12 },
    helper: { fontSize: 14, color: C.textMuted, lineHeight: 21, marginBottom: 24 },
    input: { backgroundColor: C.surface, borderColor: C.border, borderWidth: 1, borderRadius: 10, padding: 14, color: C.text, fontSize: 16 },
    muted: { fontSize: 12, color: C.textMuted },
    btnRow: { flexDirection: 'row', gap: 10, marginTop: 24 },
    btn: { flex: 1, paddingVertical: 14, borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, alignItems: 'center' },
    btnPrimary: { backgroundColor: C.accent, borderColor: C.accent },
    btnDisabled: { opacity: 0.4 },
    btnText: { color: C.text, fontSize: 15, fontWeight: '500' },
    btnPrimaryText: { color: C.accentText, fontSize: 15, fontWeight: '500' },
    icon: { fontSize: 64, textAlign: 'center', marginVertical: 24 },
    doneText: { fontSize: 15, color: C.text, textAlign: 'center', lineHeight: 24 },
    summaryRow: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border, gap: 12 },
    summaryKey: { color: C.textMuted, fontSize: 13, minWidth: 120 },
    summaryVal: { color: C.text, fontSize: 13, flex: 1 },
  });
}
