/**
 * Memories Panel — React Native Plugin
 *
 * Browse all memories with type filters, search, and pagination.
 * Calls memory.list, memory.recall via memory-mcp.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  PluginSDK,
  useApi,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from '../../plugin-sdk';
import type { PluginProps } from '../../plugin-sdk/types';

interface Memory {
  id: number;
  content: string;
  type: string;
  context?: string;
  tags?: string[];
  created_at?: string;
}

type MemoryType = 'preference' | 'fact' | 'instruction' | 'pattern' | 'rule' | 'user_model';

const CONNECTOR = 'memory-mcp';
const PAGE_SIZE = 20;
const TYPES: { key: MemoryType | null; label: string }[] = [
  { key: null, label: 'All' },
  { key: 'preference', label: 'Preferences' },
  { key: 'fact', label: 'Facts' },
  { key: 'instruction', label: 'Instructions' },
  { key: 'pattern', label: 'Patterns' },
  { key: 'rule', label: 'Rules' },
  { key: 'user_model', label: 'User Model' },
];

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  preference: { bg: '#1a1f2e', text: '#818cf8' },
  fact: { bg: '#1a2e1f', text: '#4ade80' },
  instruction: { bg: '#2e2a1a', text: '#fbbf24' },
  pattern: { bg: '#2e1a2a', text: '#f472b6' },
  rule: { bg: '#1a2e2e', text: '#22d3ee' },
  user_model: { bg: '#2e1a1a', text: '#fb923c' },
};

export default PluginSDK.register('memories-panel', {
  type: 'ui',
  version: '1.0.0',
  capabilities: {},

  Component({ bridge, theme }: PluginProps) {
    const api = useApi(bridge);
    const [memories, setMemories] = useState<Memory[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [typeCounts, setTypeCounts] = useState<Record<string, number>>({});
    const [activeFilter, setActiveFilter] = useState<MemoryType | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLive, setIsLive] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [offset, setOffset] = useState(0);
    const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const loadData = useCallback(async (filter?: MemoryType | null, off = 0) => {
      try {
        const args: any = { limit: PAGE_SIZE, offset: off };
        if (filter) args.type = filter;
        const res = await api(CONNECTOR, 'memory.list', args);
        const data = typeof res === 'string' ? JSON.parse(res) : res;
        setMemories(data?.memories || []);
        setTotalCount(data?.total || 0);
        if (Object.keys(typeCounts).length === 0) {
          // Load type counts in parallel with individual error handling
          const counts: Record<string, number> = {};
          const countResults = await Promise.allSettled(
            TYPES.filter(t => t.key).map(async (t) => {
              const r = await api(CONNECTOR, 'memory.list', { type: t.key, limit: 1 });
              const d = typeof r === 'string' ? JSON.parse(r) : r;
              return { key: t.key!, total: d?.total || 0 };
            })
          );
          for (const result of countResults) {
            if (result.status === 'fulfilled') {
              counts[result.value.key] = result.value.total;
            }
          }
          setTypeCounts(counts);
        }
        setLoadError(null);
        setIsLive(true);
      } catch (err: any) {
        console.error('[memories-panel] loadData error:', err);
        setLoadError(err?.message || 'Failed to load memories');
        setIsLive(true); // Show error state instead of infinite loading
      }
    }, [api, typeCounts]);

    useEffect(() => {
      const timer = setTimeout(() => loadData(activeFilter, 0), 300);
      return () => clearTimeout(timer);
    }, []);

    const onFilterChange = useCallback((type: MemoryType | null) => {
      setActiveFilter(type);
      setOffset(0);
      setSearchQuery('');
      loadData(type, 0);
    }, [loadData]);

    const onSearch = useCallback((query: string) => {
      setSearchQuery(query);
      if (searchTimer.current) clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(async () => {
        if (!query.trim()) { loadData(activeFilter, 0); return; }
        try {
          const args: any = { query: query.trim(), limit: PAGE_SIZE };
          if (activeFilter) args.type = activeFilter;
          const res = await api(CONNECTOR, 'memory.recall', args);
          const data = typeof res === 'string' ? JSON.parse(res) : res;
          setMemories(data?.memories || []);
          setTotalCount(data?.memories?.length || 0);
          setOffset(0);
        } catch (err: any) {
          console.warn('[memories-panel] search error:', err?.message);
        }
      }, 400);
    }, [api, activeFilter, loadData]);

    const loadPage = useCallback((newOffset: number) => {
      setOffset(newOffset);
      loadData(activeFilter, newOffset);
    }, [activeFilter, loadData]);

    const colors = theme?.colors || {
      bg: '#0a0e14', text: '#e8ecf1', textMuted: '#8b95a5',
      surface: '#111820', border: '#1e2a3a', input: '#111820',
    };
    const allCount = Object.values(typeCounts).reduce((a, b) => a + b, 0);

    const formatDate = (d?: string) => {
      if (!d) return '';
      try {
        const date = new Date(d.replace(' ', 'T'));
        const diff = Date.now() - date.getTime();
        if (diff < 86400000) return 'Today';
        if (diff < 172800000) return 'Yesterday';
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } catch { return ''; }
    };

    return (
      <ScrollView style={[s.container, { backgroundColor: colors.bg }]}>
        <View style={[s.header, { borderBottomColor: colors.border }]}>
          <Text style={[s.title, { color: colors.text }]}>
            Memories {isLive && <Text style={s.liveBadge}>{'\u25CF'} LIVE</Text>}
          </Text>
          <Text style={[s.totalCount, { color: colors.textMuted }]}>{allCount} total</Text>
        </View>
        {isLive && !loadError && (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterScroll}>
              <View style={s.filters}>
                {TYPES.filter(t => t.key === null || (typeCounts[t.key!] || 0) > 0).map((t) => (
                  <Pressable key={t.key || 'all'} style={[s.filterBtn, activeFilter === t.key && s.filterActive, { borderColor: colors.border }]} onPress={() => onFilterChange(t.key)}>
                    <Text style={[s.filterText, activeFilter === t.key && s.filterTextActive, { color: activeFilter === t.key ? '#fff' : colors.textMuted }]}>
                      {t.label} {t.key ? typeCounts[t.key] || 0 : allCount}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
            <TextInput
              style={[s.searchBar, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
              placeholder="Search memories..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={onSearch}
            />
          </>
        )}
        {!isLive ? (
          <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={s.center}>
              <ActivityIndicator size="small" color="#2563eb" />
              <Text style={[s.emptyText, { color: colors.textMuted }]}>Loading memories...</Text>
            </View>
          </View>
        ) : loadError ? (
          <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={s.center}>
              <Text style={[s.emptyTitle, { color: '#ef4444' }]}>Error loading memories</Text>
              <Text style={[s.emptyText, { color: colors.textMuted }]}>{loadError}</Text>
              <Pressable style={[s.retryBtn, { borderColor: colors.border }]} onPress={() => loadData(activeFilter, 0)}>
                <Text style={[s.retryBtnText, { color: colors.textMuted }]}>Retry</Text>
              </Pressable>
            </View>
          </View>
        ) : memories.length === 0 ? (
          <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={s.center}>
              <Text style={[s.emptyTitle, { color: colors.textMuted }]}>{activeFilter ? `No ${activeFilter} memories` : 'No memories yet'}</Text>
              <Text style={[s.emptyText, { color: colors.textMuted }]}>
                Tell your assistant to remember things like:{'\n'}"Remember I prefer window seats"
              </Text>
            </View>
          </View>
        ) : (
          memories.map((m) => {
            const tc = TYPE_COLORS[m.type] || { bg: '#1a2332', text: '#6b7a8d' };
            const tags = Array.isArray(m.tags) ? m.tags : (m.tags ? String(m.tags).split(',') : []);
            return (
              <View key={m.id} style={[s.memCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={s.memTop}>
                  <Text style={[s.memContent, { color: colors.text }]} numberOfLines={4}>{m.content}</Text>
                  <View style={[s.memType, { backgroundColor: tc.bg }]}>
                    <Text style={{ fontSize: 11, color: tc.text, fontWeight: '500' }}>{m.type}</Text>
                  </View>
                </View>
                {m.context ? <Text style={[s.memContext, { color: colors.textMuted }]} numberOfLines={2}>{m.context}</Text> : null}
                <View style={s.memMeta}>
                  {tags.filter(t => t.trim()).slice(0, 6).map((t, i) => (
                    <View key={i} style={[s.memTag, { backgroundColor: colors.border }]}>
                      <Text style={[s.memTagText, { color: colors.textMuted }]}>{t.trim()}</Text>
                    </View>
                  ))}
                  {m.created_at ? <Text style={[s.memDate, { color: colors.textMuted }]}>{formatDate(m.created_at)}</Text> : null}
                </View>
              </View>
            );
          })
        )}
        {(totalCount > offset + PAGE_SIZE || offset > 0) && (
          <View style={s.pagination}>
            <Pressable style={[s.pageBtn, { borderColor: colors.border, opacity: offset > 0 ? 1 : 0.3 }]} onPress={() => offset > 0 && loadPage(offset - PAGE_SIZE)} disabled={offset <= 0}>
              <Text style={[s.pageBtnText, { color: colors.textMuted }]}>{'\u2190'} Prev</Text>
            </Pressable>
            <Pressable style={[s.pageBtn, { borderColor: colors.border, opacity: totalCount > offset + PAGE_SIZE ? 1 : 0.3 }]} onPress={() => totalCount > offset + PAGE_SIZE && loadPage(offset + PAGE_SIZE)} disabled={totalCount <= offset + PAGE_SIZE}>
              <Text style={[s.pageBtnText, { color: colors.textMuted }]}>Next {'\u2192'}</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    );
  },
});

const s = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1 },
  title: { fontSize: 18, fontWeight: '600' },
  liveBadge: { fontSize: 10, color: '#22c55e' },
  totalCount: { fontSize: 13 },
  filterScroll: { marginBottom: 10 },
  filters: { flexDirection: 'row', gap: 6 },
  filterBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16, borderWidth: 1 },
  filterActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  filterText: { fontSize: 12 },
  filterTextActive: { color: '#fff' },
  searchBar: { height: 36, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, fontSize: 13, marginBottom: 14 },
  card: { borderRadius: 10, borderWidth: 1, padding: 20, marginBottom: 10 },
  center: { alignItems: 'center', paddingVertical: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '500', marginBottom: 8 },
  emptyText: { fontSize: 13, textAlign: 'center', lineHeight: 20, marginTop: 4 },
  retryBtn: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 6, borderWidth: 1 },
  retryBtnText: { fontSize: 12 },
  memCard: { borderRadius: 10, borderWidth: 1, padding: 14, marginBottom: 10 },
  memTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  memContent: { fontSize: 13, lineHeight: 20, flex: 1 },
  memType: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  memContext: { fontSize: 12, fontStyle: 'italic', marginTop: 6 },
  memMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, alignItems: 'center' },
  memTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  memTagText: { fontSize: 11 },
  memDate: { fontSize: 11, marginLeft: 'auto' },
  pagination: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 14, paddingBottom: 20 },
  pageBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6, borderWidth: 1 },
  pageBtnText: { fontSize: 12 },
});