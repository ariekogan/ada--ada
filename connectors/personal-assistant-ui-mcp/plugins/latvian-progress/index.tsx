/**
 * Latvian Progress — React Native Plugin
 * Language-learning dashboard for the latvian-tutor skill.
 * Reads from memory-mcp under the `latvian` tag.
 *
 * Memory schema (written by latvian-tutor):
 *   tags: ['latvian','vocab']     — { word_lv, word_he, ease, due_at, mistake_count, learned_at, last_reviewed }
 *   tags: ['latvian','grammar']   — { topic, mastery: 'new'|'shaky'|'solid', explained_at, notes }
 *   tags: ['latvian','mistake']   — { kind, detail, ts }
 *   tags: ['latvian','state']     — singletons keyed by `kind`: level | streak | preferences | xp | badges
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  useApi,
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from '../../plugin-sdk';
import type { PluginProps } from '../../plugin-sdk/types';

const MEMORY = 'memory-mcp';

const CEFR = ['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const LV_CASES = ['nominatīvs', 'ģenitīvs', 'datīvs', 'akuzatīvs', 'instrumentālis', 'lokatīvs'];

const BADGE_CATALOG = [
  { id: 'first_word',     emoji: '🌱', label: 'מילה ראשונה',         cond: (s: Stats) => s.vocab.total >= 1 },
  { id: 'ten_words',      emoji: '📚', label: '10 מילים',             cond: (s: Stats) => s.vocab.total >= 10 },
  { id: 'fifty_words',    emoji: '🎒', label: '50 מילים',             cond: (s: Stats) => s.vocab.total >= 50 },
  { id: 'hundred_words',  emoji: '🏅', label: '100 מילים',            cond: (s: Stats) => s.vocab.total >= 100 },
  { id: 'first_mastered', emoji: '✨', label: 'מילה ראשונה בשליטה',   cond: (s: Stats) => s.vocab.mastered >= 1 },
  { id: 'first_case',     emoji: '🎓', label: 'יחסה ראשונה',          cond: (s: Stats) => s.grammar.casesTouched >= 1 },
  { id: 'all_cases',      emoji: '🏛️', label: 'כל 6 היחסות',          cond: (s: Stats) => s.grammar.casesTouched >= 6 },
  { id: 'streak_3',       emoji: '🔥', label: 'רצף 3 ימים',           cond: (s: Stats) => s.streak.current >= 3 },
  { id: 'streak_7',       emoji: '🔥', label: 'רצף שבוע',             cond: (s: Stats) => s.streak.current >= 7 },
  { id: 'streak_30',      emoji: '🔥', label: 'רצף חודש',             cond: (s: Stats) => s.streak.current >= 30 },
  { id: 'level_a2',       emoji: '🚀', label: 'הגעת ל-A2',            cond: (s: Stats) => cefrIndex(s.level) >= 2 },
  { id: 'level_b1',       emoji: '🛫', label: 'הגעת ל-B1',            cond: (s: Stats) => cefrIndex(s.level) >= 3 },
];

interface Stats {
  level: string;
  levelProgress: number;
  streak: { current: number; longest: number };
  xp: number;
  dailyGoal: { done: number; target: number };
  vocab: { total: number; mastered: number; learning: number; new: number; dueNow: number };
  grammar: { topicsTotal: number; solid: number; shaky: number; casesTouched: number };
  pronunciation: { practiced: number; total: number };
  conversation: { turns: number; correctedTurns: number };
  mistakes: Array<{ kind: string; detail: string; count: number }>;
}

function cefrIndex(level: string): number {
  const i = CEFR.indexOf(level);
  return i < 0 ? 0 : i;
}

function unwrap(raw: any): any {
  if (raw?.content?.[0]?.type === 'text') {
    try { return JSON.parse(raw.content[0].text); } catch { return raw; }
  }
  return typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return raw; } })() : raw;
}

function parseContent(m: any): any {
  if (m?.content && typeof m.content === 'string') {
    const t = m.content.trim();
    if (t.startsWith('{') || t.startsWith('[')) {
      try { return JSON.parse(t); } catch { return {}; }
    }
  }
  return m?.content && typeof m.content === 'object' ? m.content : {};
}

const TAG_ALIASES: Record<string, string[]> = {
  vocab:   ['vocab', 'vocabulary', 'words', 'word', 'lesson'],
  grammar: ['grammar', 'gramatika', 'rule'],
  mistake: ['mistake', 'mistakes', 'error', 'correction'],
  state:   ['state', 'level', 'streak', 'xp', 'preferences', 'pronunciation', 'conversation'],
};

function bucketFor(tags: string[]): string | null {
  for (const [bucket, aliases] of Object.entries(TAG_ALIASES)) {
    if (aliases.some((a) => tags.includes(a))) return bucket;
  }
  return null;
}

function buildStats(memories: any[]): Stats {
  const now = Date.now();
  const byTagBucket: Record<string, any[]> = { vocab: [], grammar: [], mistake: [], state: [] };
  for (const m of memories) {
    const tags: string[] = Array.isArray(m.tags) ? m.tags : (typeof m.tags === 'string' ? m.tags.split(',') : []);
    if (!tags.includes('latvian')) continue;
    const bucket = bucketFor(tags);
    if (bucket) byTagBucket[bucket].push(m);
  }

  const stateByKind: Record<string, any> = {};
  for (const m of byTagBucket.state) {
    const p = parseContent(m);
    const kind = p.kind || m.kind || (Array.isArray(m.tags) ? m.tags.find((t: string) => !['latvian', 'state'].includes(t)) : null);
    if (kind) stateByKind[kind] = p;
  }
  const level = stateByKind.level?.value || stateByKind.level?.level || 'A0';
  const levelProgress = Math.max(0, Math.min(1, Number(stateByKind.level?.progress) || 0));
  const streak = {
    current: Number(stateByKind.streak?.current) || 0,
    longest: Number(stateByKind.streak?.longest) || 0,
  };
  const xp = Number(stateByKind.xp?.value) || 0;
  const dailyTarget = Number(stateByKind.preferences?.daily_goal) || 5;
  const lessonsTodayKey = new Date().toISOString().slice(0, 10);
  const dailyDone = Number(stateByKind.streak?.lessons_today?.[lessonsTodayKey]) ||
                    Number(stateByKind.streak?.today_count) || 0;

  let mastered = 0, learning = 0, fresh = 0, dueNow = 0;
  for (const m of byTagBucket.vocab) {
    const p = parseContent(m);
    const ease = Number(p.ease) || 1.3;
    const dueAt = Number(p.due_at) || 0;
    const lastRev = Number(p.last_reviewed) || 0;
    if (ease >= 2.5 && lastRev > 0) mastered++;
    else if (lastRev > 0) learning++;
    else fresh++;
    if (dueAt && dueAt <= now) dueNow++;
  }

  let solid = 0, shaky = 0;
  const casesSeen = new Set<string>();
  for (const m of byTagBucket.grammar) {
    const p = parseContent(m);
    const mastery = p.mastery || 'new';
    if (mastery === 'solid') solid++;
    else if (mastery === 'shaky') shaky++;
    const topic = (p.topic || '').toLowerCase();
    for (const c of LV_CASES) if (topic.includes(c)) casesSeen.add(c);
  }

  const pronPracticed = Number(stateByKind.pronunciation?.practiced) || 0;
  const pronTotal     = Number(stateByKind.pronunciation?.total)     || 33;
  const convTurns     = Number(stateByKind.conversation?.turns)      || 0;
  const convCorrected = Number(stateByKind.conversation?.corrected)  || 0;

  const mistakeMap = new Map<string, { kind: string; detail: string; count: number }>();
  for (const m of byTagBucket.mistake) {
    const p = parseContent(m);
    const k = (p.kind || 'other') + '|' + (p.detail || '');
    const cur = mistakeMap.get(k) || { kind: p.kind || 'other', detail: p.detail || '', count: 0 };
    cur.count++;
    mistakeMap.set(k, cur);
  }
  const mistakes = [...mistakeMap.values()].sort((a, b) => b.count - a.count).slice(0, 3);

  return {
    level,
    levelProgress,
    streak,
    xp,
    dailyGoal: { done: dailyDone, target: dailyTarget },
    vocab: { total: byTagBucket.vocab.length, mastered, learning, new: fresh, dueNow },
    grammar: { topicsTotal: byTagBucket.grammar.length, solid, shaky, casesTouched: casesSeen.size },
    pronunciation: { practiced: pronPracticed, total: pronTotal },
    conversation: { turns: convTurns, correctedTurns: convCorrected },
    mistakes,
  };
}

function LatvianProgress({ bridge, native, theme }: PluginProps) {
  const api = useApi(bridge);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const raw = await api(MEMORY, 'memory.list', { tags: ['latvian'], limit: 1000 });
      const parsed = unwrap(raw);
      const memories: any[] = parsed?.memories || parsed?.items || [];
      setStats(buildStats(memories));
      setLoadError(null);
      setIsLive(true);
    } catch (err: any) {
      console.error('[latvian-progress] loadData error:', err);
      setStats(buildStats([]));
      setLoadError(err?.message || 'Failed to load progress');
      setIsLive(true);
    }
  }, [api]);

  useEffect(() => {
    const t = setTimeout(loadData, 200);
    return () => clearTimeout(t);
  }, [loadData]);

  const startReview = useCallback(async () => {
    native?.haptics?.selection?.();
    try {
      await bridge.send?.({ type: 'message', text: 'בוא נתחיל חזרה יומית של מילים' });
    } catch {}
  }, [bridge, native]);

  const earnedBadges = useMemo(() => {
    if (!stats) return new Set<string>();
    const s = new Set<string>();
    for (const b of BADGE_CATALOG) if (b.cond(stats)) s.add(b.id);
    return s;
  }, [stats]);

  const colors = theme?.colors || {
    bg: '#0a0e14', text: '#e8ecf1', textMuted: '#8b95a5',
    surface: '#111820', border: '#1e2a3a', accent: '#7c3aed',
    success: '#22c55e', error: '#ef4444',
  };
  const accent = colors.accent || '#7c3aed';

  if (!isLive || !stats) {
    return (
      <View style={[s.fullCenter, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="small" color={accent} />
        <Text style={[s.muted, { color: colors.textMuted }]}>טוען התקדמות…</Text>
      </View>
    );
  }

  const levelIdx = cefrIndex(stats.level);
  const nextLevel = CEFR[Math.min(levelIdx + 1, CEFR.length - 1)];
  const dailyPct = stats.dailyGoal.target > 0
    ? Math.min(1, stats.dailyGoal.done / stats.dailyGoal.target) : 0;

  return (
    <ScrollView style={[s.container, { backgroundColor: colors.bg }]} contentContainerStyle={s.containerInner}>
      <View style={s.heroRow}>
        <View style={[s.heroBig, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[s.heroTitle, { color: colors.text }]}>לטבית 🇱🇻</Text>
          <View style={s.levelRow}>
            <Text style={[s.levelBadge, { color: accent, borderColor: accent }]}>{stats.level}</Text>
            <View style={[s.levelBar, { backgroundColor: colors.border }]}>
              <View style={[s.levelBarFill, { width: `${Math.round(stats.levelProgress * 100)}%`, backgroundColor: accent }]} />
            </View>
            <Text style={[s.levelNext, { color: colors.textMuted }]}>{nextLevel}</Text>
          </View>
          <Text style={[s.levelHint, { color: colors.textMuted }]}>
            {Math.round(stats.levelProgress * 100)}% בדרך ל-{nextLevel}
          </Text>
        </View>
      </View>

      <View style={s.statsRow}>
        <View style={[s.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={s.statEmoji}>🔥</Text>
          <Text style={[s.statBig, { color: colors.text }]}>{stats.streak.current}</Text>
          <Text style={[s.statLabel, { color: colors.textMuted }]}>רצף ימים</Text>
        </View>
        <View style={[s.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={s.statEmoji}>⭐</Text>
          <Text style={[s.statBig, { color: colors.text }]}>{stats.xp}</Text>
          <Text style={[s.statLabel, { color: colors.textMuted }]}>נק' XP</Text>
        </View>
        <View style={[s.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={s.statEmoji}>🎯</Text>
          <Text style={[s.statBig, { color: colors.text }]}>
            {stats.dailyGoal.done}/{stats.dailyGoal.target}
          </Text>
          <View style={[s.miniBar, { backgroundColor: colors.border }]}>
            <View style={[s.miniBarFill, { width: `${Math.round(dailyPct * 100)}%`, backgroundColor: dailyPct >= 1 ? (colors.success || '#22c55e') : accent }]} />
          </View>
          <Text style={[s.statLabel, { color: colors.textMuted }]}>יעד יומי</Text>
        </View>
      </View>

      <View style={s.gridRow}>
        <CategoryCard
          colors={colors} accent={accent}
          emoji="📚" title="אוצר מילים" subtitle={`${stats.vocab.total} מילים`}
          progress={stats.vocab.total === 0 ? 0 : stats.vocab.mastered / stats.vocab.total}
          breakdown={[
            { label: 'בשליטה', value: stats.vocab.mastered, color: colors.success || '#22c55e' },
            { label: 'בלימוד', value: stats.vocab.learning,  color: accent },
            { label: 'חדשות',  value: stats.vocab.new,       color: colors.textMuted || '#8b95a5' },
          ]}
        />
        <CategoryCard
          colors={colors} accent={accent}
          emoji="🧱" title="דקדוק" subtitle={`${stats.grammar.casesTouched}/6 יחסות`}
          progress={stats.grammar.casesTouched / 6}
          breakdown={[
            { label: 'בשליטה', value: stats.grammar.solid, color: colors.success || '#22c55e' },
            { label: 'רעוע',   value: stats.grammar.shaky, color: colors.error   || '#ef4444' },
          ]}
        />
      </View>
      <View style={s.gridRow}>
        <CategoryCard
          colors={colors} accent={accent}
          emoji="🗣️" title="הגייה" subtitle={`${stats.pronunciation.practiced}/${stats.pronunciation.total} צלילים`}
          progress={stats.pronunciation.total === 0 ? 0 : stats.pronunciation.practiced / stats.pronunciation.total}
          breakdown={[]}
        />
        <CategoryCard
          colors={colors} accent={accent}
          emoji="💬" title="שיחה" subtitle={`${stats.conversation.turns} סבבים`}
          progress={stats.conversation.turns === 0 ? 0 : stats.conversation.correctedTurns / Math.max(1, stats.conversation.turns)}
          breakdown={[
            { label: 'תוקנו', value: stats.conversation.correctedTurns, color: colors.error || '#ef4444' },
          ]}
        />
      </View>

      <View style={[s.ctaCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={s.ctaRow}>
          <View style={{ flex: 1 }}>
            <Text style={[s.ctaTitle, { color: colors.text }]}>
              🔁 לחזרה עכשיו: {stats.vocab.dueNow} מילים
            </Text>
            <Text style={[s.ctaHint, { color: colors.textMuted }]}>
              {stats.vocab.dueNow === 0 ? 'אין כרגע כרטיסים שמחכים — נצל את הזמן ללמוד מילה חדשה' : 'חזרה קצרה תשמור את הזיכרון חי'}
            </Text>
          </View>
          <Pressable onPress={startReview} style={[s.ctaBtn, { backgroundColor: accent }]}>
            <Text style={s.ctaBtnText}>התחל</Text>
          </Pressable>
        </View>
      </View>

      <View style={s.section}>
        <Text style={[s.sectionTitle, { color: colors.text }]}>🏆 הישגים</Text>
        <View style={s.badgesRow}>
          {BADGE_CATALOG.map((b) => {
            const earned = earnedBadges.has(b.id);
            return (
              <View
                key={b.id}
                style={[
                  s.badge,
                  { backgroundColor: colors.surface, borderColor: earned ? accent : colors.border, opacity: earned ? 1 : 0.45 },
                ]}
              >
                <Text style={s.badgeEmoji}>{earned ? b.emoji : '🔒'}</Text>
                <Text style={[s.badgeLabel, { color: earned ? colors.text : colors.textMuted }]} numberOfLines={2}>
                  {b.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {stats.mistakes.length > 0 && (
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: colors.text }]}>💡 לחזק השבוע</Text>
          {stats.mistakes.map((m, i) => (
            <View key={i} style={[s.weakRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[s.weakKind, { color: colors.error || '#ef4444' }]}>{m.kind}</Text>
              <Text style={[s.weakDetail, { color: colors.text }]} numberOfLines={2}>{m.detail || '—'}</Text>
              <Text style={[s.weakCount, { color: colors.textMuted }]}>×{m.count}</Text>
            </View>
          ))}
        </View>
      )}

      {loadError && (
        <Text style={[s.errorFoot, { color: colors.error || '#ef4444' }]}>
          לא הצלחתי להגיע לזיכרון: {loadError}
        </Text>
      )}
      {stats.vocab.total === 0 && stats.grammar.topicsTotal === 0 && (
        <Text style={[s.muted, { color: colors.textMuted, marginTop: 16, textAlign: 'center' }]}>
          עוד אין נתונים. בוא נתחיל שיעור עם המורה ללטבית כדי לבנות את הלוח.
        </Text>
      )}
    </ScrollView>
  );
}

function CategoryCard({
  colors, accent, emoji, title, subtitle, progress, breakdown,
}: {
  colors: any; accent: string; emoji: string; title: string; subtitle: string;
  progress: number; breakdown: Array<{ label: string; value: number; color: string }>;
}) {
  const pct = Math.max(0, Math.min(1, progress || 0));
  return (
    <View style={[s.catCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={s.catTop}>
        <Text style={s.catEmoji}>{emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[s.catTitle, { color: colors.text }]}>{title}</Text>
          <Text style={[s.catSub, { color: colors.textMuted }]}>{subtitle}</Text>
        </View>
      </View>
      <View style={[s.catBar, { backgroundColor: colors.border }]}>
        <View style={[s.catBarFill, { width: `${Math.round(pct * 100)}%`, backgroundColor: accent }]} />
      </View>
      {breakdown.filter((b) => b.value > 0).length > 0 && (
        <View style={s.catBreakdown}>
          {breakdown.filter((b) => b.value > 0).map((b, i) => (
            <View key={i} style={s.catBreakItem}>
              <View style={[s.catDot, { backgroundColor: b.color }]} />
              <Text style={[s.catBreakText, { color: colors.textMuted }]}>{b.label} {b.value}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export default {
  id: 'latvian-progress',
  type: 'ui',
  version: '1.0.0',
  capabilities: { haptics: true },
  Component: LatvianProgress,
};

const s = StyleSheet.create({
  container: { flex: 1 },
  containerInner: { padding: 14, paddingBottom: 32 },
  fullCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  muted: { fontSize: 13 },

  heroRow: { marginBottom: 10 },
  heroBig: { borderRadius: 14, borderWidth: 1, padding: 16 },
  heroTitle: { fontSize: 22, fontWeight: '700', marginBottom: 10, textAlign: 'right' },
  levelRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  levelBadge: { fontSize: 14, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, minWidth: 44, textAlign: 'center' },
  levelBar: { flex: 1, height: 10, borderRadius: 5, overflow: 'hidden' },
  levelBarFill: { height: '100%', borderRadius: 5 },
  levelNext: { fontSize: 12, fontWeight: '600' },
  levelHint: { fontSize: 11, marginTop: 8, textAlign: 'right' },

  statsRow: { flexDirection: 'row-reverse', gap: 8, marginBottom: 12 },
  statCard: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 12, alignItems: 'center' },
  statEmoji: { fontSize: 22, marginBottom: 4 },
  statBig: { fontSize: 20, fontWeight: '700' },
  statLabel: { fontSize: 11, marginTop: 4 },
  miniBar: { width: '100%', height: 4, borderRadius: 2, marginTop: 6, overflow: 'hidden' },
  miniBarFill: { height: '100%', borderRadius: 2 },

  gridRow: { flexDirection: 'row-reverse', gap: 8, marginBottom: 8 },
  catCard: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 12 },
  catTop: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginBottom: 8 },
  catEmoji: { fontSize: 22 },
  catTitle: { fontSize: 14, fontWeight: '600', textAlign: 'right' },
  catSub: { fontSize: 11, marginTop: 1, textAlign: 'right' },
  catBar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  catBarFill: { height: '100%', borderRadius: 3 },
  catBreakdown: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  catBreakItem: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  catDot: { width: 6, height: 6, borderRadius: 3 },
  catBreakText: { fontSize: 10 },

  ctaCard: { borderRadius: 12, borderWidth: 1, padding: 14, marginTop: 6, marginBottom: 12 },
  ctaRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  ctaTitle: { fontSize: 14, fontWeight: '600', textAlign: 'right' },
  ctaHint: { fontSize: 11, marginTop: 4, textAlign: 'right' },
  ctaBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999 },
  ctaBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  section: { marginTop: 6, marginBottom: 4 },
  sectionTitle: { fontSize: 14, fontWeight: '600', marginBottom: 8, textAlign: 'right' },

  badgesRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  badge: { width: '23%', minWidth: 70, aspectRatio: 1, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', padding: 6 },
  badgeEmoji: { fontSize: 22, marginBottom: 4 },
  badgeLabel: { fontSize: 10, textAlign: 'center', lineHeight: 12 },

  weakRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, borderRadius: 10, borderWidth: 1, padding: 10, marginBottom: 6 },
  weakKind: { fontSize: 11, fontWeight: '700', minWidth: 60, textAlign: 'right' },
  weakDetail: { flex: 1, fontSize: 12, textAlign: 'right' },
  weakCount: { fontSize: 11, fontWeight: '600' },

  errorFoot: { fontSize: 11, textAlign: 'center', marginTop: 8 },
});
