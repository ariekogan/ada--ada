import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Linking, StyleSheet } from 'react-native';
import { useApi } from '@adas/plugin-sdk';
import type { PluginProps } from '@adas/plugin-sdk';

const SELF = 'daily-news-mcp';

function parseResult(r: any) {
  if (!r) return null;
  const v = r && r.status === 'fulfilled' ? r.value : r;
  try { return typeof v === 'string' ? JSON.parse(v) : v; } catch { return null; }
}

const NewsDashboard = function NewsDashboard({ bridge, native, theme }: PluginProps) {
  const api = useApi(bridge);
  const t: any = theme || {};
  const C = {
    bg:        t.colors?.bg        || '#0f1117',
    surface:   t.colors?.surface   || '#171a21',
    border:    t.colors?.border    || '#252a35',
    text:      t.colors?.text      || '#e8eaf0',
    textMuted: t.colors?.textMuted || '#8b93a7',
    accent:    t.colors?.accent    || '#4f8ef7',
  };
  const S = React.useMemo(() => makeStyles(C), [C.bg, C.surface, C.border, C.text, C.textMuted, C.accent]);

  const [cats, setCats] = useState<any[]>([]);
  const [date, setDate] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const raw = await api.call('news.fetch', { per_category: 4 }, SELF);
      const d = parseResult(raw);
      if (!d || d.ok === false || !Array.isArray(d.categories)) {
        setErr((d && d.error) || 'Could not load news.');
        setCats([]);
      } else {
        setCats(d.categories);
        setDate(d.date || '');
      }
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  const openStory = useCallback((url: string) => {
    if (native?.haptics) native.haptics.selection?.();
    if (url) Linking.openURL(url).catch(() => {});
  }, [native]);

  const prettyDate = (() => {
    try {
      const dt = date ? new Date(date + 'T00:00:00') : new Date();
      return dt.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    } catch { return date; }
  })();

  return (
    <View style={S.root}>
      <View style={S.header}>
        <Text style={S.title}>📰 Daily News</Text>
        <Text style={S.subtitle}>{prettyDate}</Text>
      </View>

      {loading ? (
        <View style={S.center}><ActivityIndicator color={C.accent} /><Text style={S.muted}>Fetching today's news…</Text></View>
      ) : err ? (
        <View style={S.center}>
          <Text style={S.muted}>{err}</Text>
          <TouchableOpacity style={S.retry} onPress={load}><Text style={S.retryText}>Retry</Text></TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={S.scroll} contentContainerStyle={S.scrollContent} showsVerticalScrollIndicator={false}>
          {cats.map((cat) => (
            <View key={cat.key} style={S.category}>
              <Text style={S.catHeader}>{(cat.emoji ? cat.emoji + '  ' : '') + (cat.name || cat.key)}</Text>
              {(cat.items || []).map((s: any, i: number) => (
                <TouchableOpacity key={i} style={S.story} activeOpacity={0.6} onPress={() => openStory(s.url)}>
                  <Text style={S.storyTitle}>{s.title}</Text>
                  <Text style={S.meta}>
                    {s.points ? <Text style={S.pts}>▲ {s.points}</Text> : null}
                    {s.points ? '  ·  ' : ''}{s.source || ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
          <TouchableOpacity style={S.refresh} onPress={load}><Text style={S.refreshText}>↻ Refresh</Text></TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
};

function makeStyles(C: any) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: C.border },
    title: { color: C.text, fontSize: 20, fontWeight: '700' },
    subtitle: { color: C.textMuted, fontSize: 13, marginTop: 2 },
    scroll: { flex: 1 },
    scrollContent: { padding: 14, paddingBottom: 28 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
    muted: { color: C.textMuted, fontSize: 14, textAlign: 'center' },
    category: { marginBottom: 18 },
    catHeader: { color: C.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 },
    story: { paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: C.surface },
    storyTitle: { color: C.accent, fontSize: 14, fontWeight: '500', lineHeight: 19 },
    meta: { color: C.textMuted, fontSize: 11, marginTop: 3 },
    pts: { color: C.accent, fontWeight: '600' },
    retry: { marginTop: 6, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8, backgroundColor: C.accent },
    retryText: { color: '#fff', fontWeight: '600' },
    refresh: { alignSelf: 'center', marginTop: 6, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: C.border },
    refreshText: { color: C.textMuted, fontWeight: '600', fontSize: 13 },
  });
}

export default {
  id: 'news-dashboard',
  type: 'ui',
  version: '1.0.0',
  capabilities: { haptics: true },
  Component: NewsDashboard,
};
