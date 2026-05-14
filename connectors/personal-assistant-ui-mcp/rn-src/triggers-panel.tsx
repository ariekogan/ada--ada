/**
 * Triggers Panel — React Native Plugin
 *
 * Reminders & triggers shown as paper cards. Soft toggle, humanized
 * schedule strings, system/personal source label. Personal (user-created)
 * triggers show a small delete icon; system (solution-level) triggers
 * cannot be deleted.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Modal,
  StyleSheet,
} from 'react-native';
import { useApi } from '@adas/plugin-sdk';
import type { PluginProps } from '@adas/plugin-sdk';

interface Trigger {
  /** UI-only key, unique across the list (used as React key). May be
   *  `${skillSlug}:${triggerId}` so duplicate triggerIds across skills don't
   *  collide. NEVER pass this to a tool — use `triggerId` instead. */
  id: string;
  /** The actual trigger id the platform expects in toggle/delete calls.
   *  For static triggers: the trigger's logical id from the skill spec.
   *  For dynamic triggers: the MongoDB _id of the doc. */
  triggerId: string;
  description: string;
  humanSchedule: string;
  skillSlug: string;
  enabled: boolean;
  paused: boolean;
  autoPausedReason: string | null;
  isDynamic: boolean;
  canDelete: boolean;
  prompt: string;
  scheduleType: string | null;
  scheduleValue: string | null;
  fired: boolean;
}

function fmtTime(h: number, m: number): string {
  const mm = m.toString().padStart(2, '0');
  const period = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${period}` : `${h12}:${mm}${period}`;
}

function humanizeSchedule(raw?: string | null, cron?: string | null): string {
  if (!raw && !cron) return 'On demand';
  if (raw) {
    const m = raw.match(/^PT?(\d+)([SMHDW])$/i);
    if (m) {
      const n = parseInt(m[1]);
      const unit = m[2].toUpperCase();
      const isTimeUnit = raw.startsWith('PT');
      if (unit === 'S') return `Every ${n}s`;
      if (unit === 'M' && isTimeUnit) return n === 1 ? 'Every minute' : `Every ${n} min`;
      if (unit === 'H') return n === 1 ? 'Every hour' : `Every ${n} hours`;
      if (unit === 'D') return n === 1 ? 'Once a day' : `Every ${n} days`;
      if (unit === 'M' && !isTimeUnit) return n === 1 ? 'Once a month' : `Every ${n} months`;
      if (unit === 'W') return n === 1 ? 'Once a week' : `Every ${n} weeks`;
    }
  }
  if (cron) {
    const parts = cron.trim().split(/\s+/);
    if (parts.length === 5) {
      const [min, hour, dom, , dow] = parts;
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      if (dom !== '*' && hour !== '*' && min !== '*' && !isNaN(+hour) && !isNaN(+min)) {
        return `On day ${dom} at ${fmtTime(+hour, +min)}`;
      }
      if (dow !== '*' && hour !== '*' && min !== '*' && !isNaN(+hour) && !isNaN(+min)) {
        const dayName = days[parseInt(dow)] || dow;
        return `${dayName} at ${fmtTime(+hour, +min)}`;
      }
      if (hour !== '*' && min !== '*' && !isNaN(+hour) && !isNaN(+min)) {
        return `Once a day at ${fmtTime(+hour, +min)}`;
      }
      // Multi-hour cron like "4,16" → "Daily at 4am & 4pm"
      if (hour.includes(',') && min !== '*' && !isNaN(+min)) {
        const hours = hour.split(',').map(h => h.trim()).filter(h => !isNaN(+h)).map(h => +h);
        if (hours.length >= 2) {
          return `Daily at ${hours.map(h => fmtTime(h, +min)).join(' & ')}`;
        }
      }
      if (min.startsWith('*/')) return `Every ${min.slice(2)} min`;
      if (hour.startsWith('*/')) {
        const h = hour.slice(2);
        return `Every ${h} hour${h === '1' ? '' : 's'}`;
      }
    }
    return cron;
  }
  return raw || 'On demand';
}

function humanizeOneTime(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    const now = new Date();
    const diffMs = d.getTime() - now.getTime();
    if (diffMs < 0) return 'Fired';
    const diffMin = Math.round(diffMs / 60000);
    if (diffMin < 1) return 'In a moment';
    if (diffMin < 60) return `In ${diffMin} min`;
    const t = fmtTime(d.getHours(), d.getMinutes());
    if (d.toDateString() === now.toDateString()) return `Today at ${t}`;
    const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
    if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow at ${t}`;
    const diffDays = Math.round(diffMs / 86400000);
    if (diffDays > 0 && diffDays < 7) {
      const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      return `${days[d.getDay()]} at ${t}`;
    }
    const dd = d.getDate().toString().padStart(2, '0');
    const mm = (d.getMonth() + 1).toString().padStart(2, '0');
    const yy = d.getFullYear();
    return `On ${dd}/${mm}/${yy} at ${t}`;
  } catch {
    return 'Scheduled';
  }
}

/** Soft pill toggle — paper feel, no native iOS Switch. */
function SoftToggle({ value, onPress, accent, off }: { value: boolean; onPress: () => void; accent: string; off: string }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={{
      width: 44, height: 26, borderRadius: 13,
      backgroundColor: value ? accent : off,
      padding: 3, justifyContent: 'center',
    }}>
      <View style={{
        width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff',
        alignSelf: value ? 'flex-end' : 'flex-start',
        shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 2, shadowOffset: { width: 0, height: 1 },
      }} />
    </Pressable>
  );
}

function TriggersPanel({ bridge, native, theme }: PluginProps) {
  const api = useApi(bridge);
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Trigger | null>(null);

  const c = theme?.colors || {
    bgPrimary: '#FAF6EE', bgSecondary: '#F2EADC', bgTertiary: '#EDE2CF',
    border: 'rgba(26,20,16,0.06)',
    textPrimary: '#1a1410', textSecondary: '#6b5a47', textMuted: '#9a8870',
    accent: '#FF7A28', accentSoft: 'rgba(255,122,40,0.10)',
  };
  // Backward compat for plugins that still receive legacy color keys
  const palette = {
    bg: (c as any).bgPrimary || (c as any).bg || '#FAF6EE',
    surface: (c as any).bgSecondary || (c as any).surface || '#F2EADC',
    surfaceMuted: (c as any).bgTertiary || (c as any).bgSecondary || '#EDE2CF',
    text: (c as any).textPrimary || (c as any).text || '#1a1410',
    textSoft: (c as any).textSecondary || (c as any).textMuted || '#6b5a47',
    textMuted: (c as any).textMuted || '#9a8870',
    accent: (c as any).accent || '#FF7A28',
    accentSoft: (c as any).accentSoft || 'rgba(255,122,40,0.10)',
    off: 'rgba(26,20,16,0.10)',
  };

  const load = useCallback(async () => {
    try {
      const res = await api.call('triggers.list', {});
      const allRaw = [...(res?.static || []), ...(res?.dynamic || [])];

      const mapped: Trigger[] = allRaw.map((t: any) => {
        const isDynamic = t.isDynamic === true;
        const scheduleType = t.scheduleType || null;
        const scheduleValue = t.scheduleValue || null;
        const isOneTime = scheduleType === 'once';
        const fired = isOneTime && scheduleValue ? new Date(scheduleValue).getTime() < Date.now() : false;

        let humanSched: string;
        if (isOneTime && scheduleValue) {
          humanSched = humanizeOneTime(scheduleValue);
        } else {
          const everyVal = t.every || (scheduleType === 'every' ? scheduleValue : null);
          const cronVal = t.cron || (scheduleType === 'cron' ? scheduleValue : null);
          humanSched = humanizeSchedule(everyVal, cronVal);
        }

        // The platform-facing id (toggle/delete tools want this). For static
        // triggers it's the logical trigger id; for dynamic it's the doc _id.
        const triggerId = String(t.triggerId || t._id || t.id || '');
        const skillSlug = t.skillSlug || t.skill || '';
        // UI key — unique across skills.
        const uiKey = t.key || (skillSlug && triggerId ? `${skillSlug}:${triggerId}` : triggerId);

        const paused = !!t.paused;
        const enabled = t.enabled !== false && !paused;

        return {
          id: uiKey,
          triggerId,
          description: t.description || t.name || t.prompt?.substring(0, 80) || 'Unnamed',
          humanSchedule: humanSched,
          skillSlug,
          enabled,
          paused,
          autoPausedReason: t.autoPausedReason || null,
          isDynamic,
          canDelete: isDynamic,
          prompt: t.prompt || '',
          scheduleType,
          scheduleValue,
          fired,
        };
      });

      const visible = mapped.filter(t => !t.fired);
      visible.sort((a, b) => (a.enabled === b.enabled ? 0 : a.enabled ? -1 : 1));
      setTriggers(visible);
    } catch (e) {
      console.warn('[triggers-panel] load failed:', e);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (t: Trigger) => {
    const next = !t.enabled;
    setTriggers(prev => prev.map(x => x.id === t.id ? { ...x, enabled: next } : x));
    try {
      // IMPORTANT: pass `triggerId` (logical id), NOT `t.id` (UI key, which may
      // be `${skillSlug}:${triggerId}`). Earlier bug: toggle wrote state under
      // the wrong key, so the next list refresh showed the trigger flipping back.
      await api.call('triggers.toggle', { skillSlug: t.skillSlug, triggerId: t.triggerId });
      native?.haptics?.selection?.();
      // Refresh shortly after so the user sees the persisted state — and so the
      // platform's circuit breaker pause (if it just fired) shows up promptly.
      setTimeout(() => { load(); }, 600);
    } catch (e) {
      setTriggers(prev => prev.map(x => x.id === t.id ? { ...x, enabled: t.enabled } : x));
      native?.haptics?.error?.();
    }
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    setTriggers(prev => prev.filter(x => x.id !== target.id));
    try {
      await api.call('triggers.deleteDynamic', { triggerId: target.triggerId });
      native?.haptics?.selection?.();
    } catch (e) {
      native?.haptics?.error?.();
      load();
    }
  };

  const active = triggers.filter(t => t.enabled);
  const paused = triggers.filter(t => !t.enabled);

  if (loading) {
    return (
      <View style={[s.container, { backgroundColor: palette.bg }]}>
        <ActivityIndicator color={palette.accent} style={{ marginTop: 60 }} />
      </View>
    );
  }

  const renderCard = (t: Trigger, idx: number) => (
    <View
      key={`${t.id || 'trigger'}-${idx}`}
      style={[s.card, { backgroundColor: t.enabled ? palette.surface : palette.surfaceMuted }]}
    >
      {/* Top-right ✕ — Personal only, fixed corner position */}
      {t.canDelete ? (
        <Pressable
          onPress={() => { native?.haptics?.selection?.(); setDeleteTarget(t); }}
          hitSlop={12}
          style={s.deleteCorner}
        >
          <Text style={[s.deleteCornerX, { color: palette.textMuted }]}>×</Text>
        </Pressable>
      ) : null}

      {/* Right-center toggle — fixed position regardless of card height */}
      <View style={s.toggleAnchor} pointerEvents="box-none">
        <SoftToggle
          value={t.enabled}
          onPress={() => toggle(t)}
          accent={palette.accent}
          off={palette.off}
        />
      </View>

      {/* Content (left column) */}
      <Text style={[s.cardDesc, { color: t.enabled ? palette.text : palette.textSoft }]} numberOfLines={2}>
        {t.description}
      </Text>
      <View style={s.metaRow}>
        <Text style={[s.metaText, { color: palette.textMuted }]} numberOfLines={1}>
          {'⏱  '}{t.humanSchedule}
          {'   ·   '}
          <Text style={{ color: t.isDynamic ? palette.accent : palette.textMuted, fontWeight: '600' }}>
            {t.isDynamic ? 'personal' : 'system'}
          </Text>
        </Text>
      </View>
      {(!t.enabled && t.autoPausedReason) ? (
        <View style={[s.warnPill, { backgroundColor: palette.accentSoft }]}>
          <Text style={[s.warnText, { color: palette.accent }]} numberOfLines={2}>
            {'⚠  '}Auto-paused {t.autoPausedReason === 'jit_failed' ? '— kept retrying without progress' : t.autoPausedReason === 'goal_failed' ? '— last 2 runs didn’t reach the goal' : `(${t.autoPausedReason})`}
          </Text>
        </View>
      ) : null}
    </View>
  );

  const sectionLabel = (label: string) => (
    <Text style={[s.sectionLabel, { color: palette.textMuted }]}>{label}</Text>
  );

  return (
    <ScrollView style={[s.container, { backgroundColor: palette.bg }]} contentContainerStyle={{ paddingBottom: 32 }}>
      {triggers.length === 0 ? (
        <View style={s.empty}>
          <Text style={[s.emptyTitle, { color: palette.textSoft }]}>No reminders yet</Text>
          <Text style={[s.emptyText, { color: palette.textMuted }]}>
            Try saying:{'\n'}
            <Text style={{ color: palette.text, fontStyle: 'italic' }}>"Remind me to call the dentist in 1 hour"</Text>
          </Text>
        </View>
      ) : (
        <>
          {active.length > 0 && (
            <>
              {sectionLabel(`Active · ${active.length}`)}
              {active.map((t, i) => renderCard(t, i))}
            </>
          )}
          {paused.length > 0 && (
            <>
              {sectionLabel(`Paused · ${paused.length}`)}
              {paused.map((t, i) => renderCard(t, i + active.length))}
            </>
          )}
          <Text style={[s.hint, { color: palette.textMuted }]}>
            Tap × on a Personal reminder to delete it
          </Text>
        </>
      )}

      <Modal visible={!!deleteTarget} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={[s.confirmBox, { backgroundColor: palette.surface }]}>
            <Text style={[s.confirmText, { color: palette.text }]}>
              Delete this reminder?{'\n'}
              <Text style={{ fontWeight: '600' }}>{deleteTarget?.description || ''}</Text>
            </Text>
            <View style={s.confirmBtns}>
              <Pressable onPress={() => setDeleteTarget(null)} style={[s.cancelBtn, { backgroundColor: palette.surfaceMuted }]}>
                <Text style={{ color: palette.text, fontSize: 14, fontWeight: '500' }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={doDelete} style={[s.deleteConfirmBtn, { backgroundColor: palette.accent }]}>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Delete</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

export default {
  id: 'triggers-panel',
  type: 'ui',
  version: '1.0.0',
  Component: TriggersPanel,
};

const s = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 4 },
  sectionLabel: {
    fontSize: 11, fontWeight: '600', textTransform: 'uppercase',
    letterSpacing: 1.2, marginTop: 18, marginBottom: 10, marginLeft: 4,
  },
  card: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingLeft: 16,
    paddingRight: 64, // reserve right column for toggle/delete
    marginBottom: 8,
    position: 'relative',
  },
  cardDesc: { fontSize: 15, fontWeight: '500', lineHeight: 20 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  metaText: { fontSize: 12, fontWeight: '400' },
  // Fixed top-right corner — Personal cards only
  deleteCorner: {
    position: 'absolute',
    top: 6,
    right: 8,
    width: 26, height: 26,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 2,
  },
  deleteCornerX: { fontSize: 18, lineHeight: 20, fontWeight: '400' },
  // Fixed right-center — every card
  toggleAnchor: {
    position: 'absolute',
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    zIndex: 1,
  },
  warnPill: {
    marginTop: 8, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    alignSelf: 'flex-start', maxWidth: '100%',
  },
  warnText: { fontSize: 11, fontWeight: '600', lineHeight: 15 },
  hint: { fontSize: 11, textAlign: 'center', marginTop: 24, fontStyle: 'italic' },
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 16, fontWeight: '500', marginBottom: 12 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  overlay: { flex: 1, backgroundColor: 'rgba(26,20,16,0.55)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  confirmBox: { borderRadius: 18, padding: 24, width: '100%', maxWidth: 320 },
  confirmText: { fontSize: 14, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  confirmBtns: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  deleteConfirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
});
