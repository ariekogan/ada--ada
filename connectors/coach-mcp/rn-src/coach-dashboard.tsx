/**
 * MyCoach Dashboard — React Native Plugin
 * Mirrors the iframe coach-dashboard. Fetches state, goal, snapshot,
 * check-ins, and pending observations; renders phase badge, goal card,
 * progress rings (calories/protein/steps), gaps, recent check-ins, and
 * a confirm/deny prompt for the top pending observation.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { PluginSDK, useApi } from '@adas/plugin-sdk';
import type { PluginProps } from '@adas/plugin-sdk';

const COACH = 'coach-mcp';
const NUTR = 'nutrition-mcp';
const DEVICE = 'mobile-device-mcp';

interface State { phase: string; days_since_join?: number; trust_budget?: number; joined_at?: string; }
interface Goal { text: string; version: number; deadline?: string; reason?: string; }
interface Snapshot {
  nutrition?: { totals?: { calories?: number; protein?: number }; goals?: { calories?: number; protein?: number } };
  activity?: { steps?: number };
  gaps?: Array<{ metric: string; delta: number; unit: string }>;
  adherence_score?: number;
}
interface Checkin { date: string; period: string; rating?: number; mood_word?: string; }
interface Observation { id: string; text: string; confidence: number; status: string; }

const PHASE_COLOR: Record<string, string> = {
  onboarding: '#7c9eff', observing: '#b48ce6', calibrating: '#5fd576', accompanying: '#ffb84d',
};

function parseResult(r: any) {
  if (!r) return null;
  const v = r.status === 'fulfilled' ? r.value : r;
  try { return typeof v === 'string' ? JSON.parse(v) : v; } catch { return null; }
}

function Ring({ pct, color, trackColor }: { pct: number; color: string; trackColor: string }) {
  // Simplified ring: bar instead of SVG circle (RN doesn't have native SVG)
  return (
    <View style={{ height: 6, backgroundColor: trackColor, borderRadius: 3, overflow: 'hidden', marginTop: 6 }}>
      <View style={{ height: 6, width: `${Math.min(100, pct)}%`, backgroundColor: color, borderRadius: 3 }} />
    </View>
  );
}

const CoachDashboard = function CoachDashboard({ bridge, native, theme }: PluginProps) {
    const api = useApi(bridge);
    // Theme-aware palette — match the host (light/beige on the consumer app,
    // falls back to a cream default if theme isn't provided).
    const t = theme || {};
    const C = {
      bg:        t.colors?.bg        || '#faf6ef',
      surface:   t.colors?.surface   || '#ffffff',
      surface2:  t.colors?.surface2  || '#f3ede0',
      border:    t.colors?.border    || '#e8e0d2',
      text:      t.colors?.text      || '#1a1a1a',
      textMuted: t.colors?.textMuted || '#7a7166',
      accent:    t.colors?.accent    || '#e0712b',
      success:   t.colors?.success   || '#5fd576',
      warn:      t.colors?.warn      || '#ffb84d',
    };
    const S = React.useMemo(() => makeStyles(C), [C.bg, C.surface, C.border, C.text, C.textMuted, C.accent]);
    const [state, setState] = useState<State | null>(null);
    const [goal, setGoal] = useState<Goal | null>(null);
    const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
    const [checkins, setCheckins] = useState<Checkin[]>([]);
    const [observation, setObservation] = useState<Observation | null>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
      const [s1, g1, n1, a1, c1, o1] = await Promise.allSettled([
        api.call('coach.state.get', {}, COACH),
        api.call('coach.goals.current', {}, COACH),
        api.call('nutrition.getDailySummary', {}, NUTR),
        api.call('device.health.today', {}, DEVICE),
        api.call('coach.checkin.recent', { days: 7 }, COACH),
        api.call('coach.observations.pending', {}, COACH),
      ]);
      const stateRes = parseResult(s1);
      const goalRes = parseResult(g1);
      const nutr = parseResult(n1);
      const act = parseResult(a1);
      const ck = parseResult(c1);
      const obs = parseResult(o1);

      if (stateRes?.state) setState(stateRes.state);
      if (goalRes?.goal) setGoal(goalRes.goal);
      if (ck?.checkins) setCheckins(ck.checkins.slice(0, 5));
      if (obs?.observations) {
        const pending = obs.observations.filter((o: any) => o.status === 'pending' || o.status === 'surfaced');
        if (pending.length > 0) setObservation(pending[0]);
      }

      const snapRes = await api.call('coach.snapshot.today', {
        nutrition: nutr || {},
        activity: act?.today || act || {},
      }, COACH);
      const snap = parseResult({ status: 'fulfilled', value: snapRes });
      if (snap) setSnapshot(snap);
      setLoading(false);
    }, [api]);

    useEffect(() => { load(); }, [load]);

    const confirmObs = async (confirmed: boolean) => {
      if (!observation) return;
      if (native?.haptics) {
        confirmed ? native.haptics.selection?.() : native.haptics.selection?.();
      }
      await api.call('coach.observations.confirm', { observation_id: observation.id, confirmed }, COACH);
      setObservation(null);
    };

    if (loading) {
      return <View style={S.center}><ActivityIndicator color={C.accent} /></View>;
    }

    const phase = state?.phase || 'new';
    const phaseColor = PHASE_COLOR[phase] || C.textMuted;
    const trust = state?.trust_budget ?? 0;
    const calNow = snapshot?.nutrition?.totals?.calories ?? 0;
    const calGoal = snapshot?.nutrition?.goals?.calories ?? 2000;
    const proNow = snapshot?.nutrition?.totals?.protein ?? 0;
    const proGoal = snapshot?.nutrition?.goals?.protein ?? 150;
    // Distinguish "0 steps because HealthKit not synced" from "0 steps measured".
    // snapshot.activity is undefined when device.health.today returned no data.
    const stepsKnown = snapshot?.activity != null && snapshot.activity.steps != null;
    const steps = stepsKnown ? (snapshot!.activity!.steps as number) : 0;
    const stepGoal = 8000;

    return (
      <ScrollView style={S.scroll} contentContainerStyle={S.content}>
        <View style={S.header}>
          <View>
            <Text style={S.h1}>MyCoach</Text>
            <Text style={S.muted}>Day {state?.days_since_join ?? 0} · trust {trust}/100</Text>
          </View>
          <View style={[S.badge, { borderColor: phaseColor, backgroundColor: phaseColor + '22' }]}>
            <Text style={[S.badgeText, { color: phaseColor }]}>{phase.toUpperCase()}</Text>
          </View>
        </View>

        <Text style={S.section}>GOAL</Text>
        <View style={S.card}>
          <Text style={S.goalText}>{goal?.text || 'No goal set yet.'}</Text>
          {goal && <Text style={S.muted}>v{goal.version}{goal.reason ? ` · ${goal.reason}` : ''}</Text>}
        </View>

        <Text style={S.section}>TODAY</Text>
        <View style={S.card}>
          <View style={S.row}>
            <Text style={S.metricLabel}>Calories</Text>
            <Text style={S.metricVal}>{calNow.toFixed(0)} / {calGoal}</Text>
          </View>
          <Ring pct={(calNow / calGoal) * 100} color={C.accent} trackColor={C.border} />
          <View style={[S.row, { marginTop: 14 }]}>
            <Text style={S.metricLabel}>Protein</Text>
            <Text style={S.metricVal}>{proNow.toFixed(0)}g / {proGoal}g</Text>
          </View>
          <Ring pct={(proNow / proGoal) * 100} color={C.success} trackColor={C.border} />
          <View style={[S.row, { marginTop: 14 }]}>
            <Text style={S.metricLabel}>Steps</Text>
            {stepsKnown ? (
              <Text style={S.metricVal}>{steps.toLocaleString()} / {stepGoal.toLocaleString()}</Text>
            ) : (
              <Text style={[S.metricVal, { color: C.textMuted, fontStyle: 'italic' }]}>Connect Health</Text>
            )}
          </View>
          <Ring pct={stepsKnown ? (steps / stepGoal) * 100 : 0} color={C.warn} trackColor={C.border} />
          {!stepsKnown && (
            <Text style={[S.muted, { marginTop: 4, fontSize: 11 }]}>
              No step data — make sure Health is connected in iPhone Settings → Privacy → Health.
            </Text>
          )}
        </View>

        {snapshot?.adherence_score != null && (
          <View style={[S.card, S.center, { marginTop: 10 }]}>
            <Text style={S.adherence}>{snapshot.adherence_score}</Text>
            <Text style={S.muted}>Today's adherence</Text>
          </View>
        )}

        <Text style={S.section}>GAPS</Text>
        <View style={S.card}>
          {(snapshot?.gaps || []).length === 0 ? (
            <Text style={[S.muted, { textAlign: 'center' }]}>No gaps today 🎯</Text>
          ) : (
            (snapshot?.gaps || []).map((g, i) => (
              <View key={i} style={S.row}>
                <Text style={S.metricLabel}>{g.metric.replace('_', ' ')}</Text>
                <Text style={S.gapDelta}>{g.delta.toFixed(0)} {g.unit} short</Text>
              </View>
            ))
          )}
        </View>

        <Text style={S.section}>RECENT CHECK-INS</Text>
        <View style={S.card}>
          {checkins.length === 0 ? (
            <Text style={[S.muted, { textAlign: 'center' }]}>No check-ins yet</Text>
          ) : (
            checkins.map((c, i) => (
              <View key={i} style={S.row}>
                <Text style={S.muted}>{c.date} {c.period.toUpperCase()}</Text>
                <Text style={S.metricVal}>{c.rating != null ? `${c.rating}/10` : '—'}{c.mood_word ? ` · ${c.mood_word}` : ''}</Text>
              </View>
            ))
          )}
        </View>

        {observation && (
          <>
            <Text style={S.section}>SOMETHING I NOTICED</Text>
            <View style={S.card}>
              <Text style={S.obsText}>{observation.text}</Text>
              <View style={S.btnRow}>
                <TouchableOpacity style={[S.btn, S.btnPrimary]} onPress={() => confirmObs(true)}>
                  <Text style={S.btnPrimaryText}>Yes, matches</Text>
                </TouchableOpacity>
                <TouchableOpacity style={S.btn} onPress={() => confirmObs(false)}>
                  <Text style={S.btnText}>Not really</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    );
};

export default PluginSDK.register('coach-dashboard', {
  type: 'ui',
  version: '1.0.1',
  capabilities: { haptics: true },
  Component: CoachDashboard,
});

function makeStyles(C: any) {
  return StyleSheet.create({
    scroll: { flex: 1, backgroundColor: C.bg },
    content: { padding: 16, paddingBottom: 40 },
    center: { justifyContent: 'center', alignItems: 'center', flex: 1, backgroundColor: C.bg },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
    h1: { fontSize: 22, color: C.text, fontWeight: '600' },
    muted: { fontSize: 12, color: C.textMuted },
    badge: { borderWidth: 1, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
    badgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
    section: { fontSize: 11, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1, fontWeight: '700', marginTop: 20, marginBottom: 8 },
    card: { backgroundColor: C.surface, borderColor: C.border, borderWidth: 1, borderRadius: 12, padding: 14 },
    goalText: { fontSize: 15, color: C.text, fontWeight: '500', lineHeight: 21 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
    metricLabel: { fontSize: 13, color: C.text, textTransform: 'capitalize' },
    metricVal: { fontSize: 13, color: C.text, fontWeight: '600' },
    gapDelta: { fontSize: 13, color: C.warn, fontWeight: '500' },
    adherence: { fontSize: 32, color: C.text, fontWeight: '700' },
    obsText: { fontSize: 14, color: C.text, lineHeight: 20, marginBottom: 12 },
    btnRow: { flexDirection: 'row', gap: 8 },
    btn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, alignItems: 'center' },
    btnPrimary: { backgroundColor: C.accent, borderColor: C.accent },
    btnText: { color: C.text, fontSize: 13, fontWeight: '500' },
    btnPrimaryText: { color: '#fff', fontSize: 13, fontWeight: '500' },
  });
}

