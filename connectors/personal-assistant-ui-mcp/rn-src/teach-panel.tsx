/**
 * Teach Panel — React Native Plugin
 * Lists taught rules from memory-mcp (PLATFORM connector) with toggle + delete.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Switch,
  ActivityIndicator,
  Modal,
  StyleSheet,
} from 'react-native';
import { useApi } from '@adas/plugin-sdk';
import type { PluginProps } from '@adas/plugin-sdk';

interface Rule {
  id: any;
  description: string;
  active: boolean;
  tags: string[];
  raw: any;
}

const CONNECTOR = 'memory-mcp';

const NOISE_TAGS = new Set(['taught', 'rule', 'rules', 'memory', 'preference', 'behavior']);

function TeachPanelComponent({ bridge, native, theme }: PluginProps) {
  const api = useApi(bridge);
  const [rules, setRules] = useState<Rule[]>([]);
  const [counts, setCounts] = useState({ total: 0, active: 0, inactive: 0 });
  const [isLive, setIsLive] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Rule | null>(null);

  const loadData = useCallback(async () => {
    try {
      const listRes = await api.call('memory.list', { limit: 200 }, CONNECTOR);
      const list = typeof listRes === 'string' ? JSON.parse(listRes) : listRes;
      const allMemories = list?.memories || [];
      const ruleMemories = allMemories.filter((m: any) => m.type === 'rule');

      const parsed: Rule[] = ruleMemories.map((m: any) => {
        let p: any = {};
        if (typeof m.content === 'string' && m.content.trim().startsWith('{')) {
          try { p = JSON.parse(m.content); } catch {}
        }
        const description =
          p.description || p.rule_name || p.name ||
          (typeof m.content === 'string' ? m.content : '') ||
          m.context || '';

        const rawTags = Array.isArray(m.tags) ? m.tags : (m.tags ? String(m.tags).split(',') : []);
        const cleanTags = rawTags
          .map((t: string) => t.trim().toLowerCase())
          .filter((t: string) => t && !NOISE_TAGS.has(t));

        return {
          id: m.id,
          description,
          active: m.active !== false,
          tags: cleanTags,
          raw: m,
        };
      });

      const activeCount = parsed.filter(r => r.active).length;
      setCounts({ total: parsed.length, active: activeCount, inactive: parsed.length - activeCount });
      setRules(parsed);
      setIsLive(true);
    } catch {
      setIsLive(true);
    }
  }, [api]);

  useEffect(() => {
    const timer = setTimeout(loadData, 300);
    return () => clearTimeout(timer);
  }, [loadData]);

  const toggleRule = useCallback(async (rule: Rule) => {
    setRules(prev => prev.map(r => r.id === rule.id ? { ...r, active: !r.active } : r));
    setCounts(prev => ({
      ...prev,
      active: prev.active + (rule.active ? -1 : 1),
      inactive: prev.inactive + (rule.active ? 1 : -1),
    }));
    try {
      await api.call('memory.update', { id: rule.id, active: !rule.active }, CONNECTOR);
      native?.haptics?.selection?.();
    } catch {
      setRules(prev => prev.map(r => r.id === rule.id ? { ...r, active: rule.active } : r));
      setCounts(prev => ({
        ...prev,
        active: prev.active + (rule.active ? 1 : -1),
        inactive: prev.inactive + (rule.active ? -1 : 1),
      }));
      native?.haptics?.error?.();
    }
  }, [api, native]);

  const doDelete = useCallback(async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    setRules(prev => prev.filter(r => r.id !== target.id));
    setCounts(prev => ({
      ...prev,
      total: prev.total - 1,
      active: prev.active - (target.active ? 1 : 0),
      inactive: prev.inactive - (target.active ? 0 : 1),
    }));
    try {
      await api.call('memory.delete', { id: target.id }, CONNECTOR);
      native?.haptics?.notification?.('success');
    } catch {
      native?.haptics?.error?.();
      await loadData();
    }
  }, [deleteTarget, api, native, loadData]);

  const colors = theme?.colors || {
    bg: '#FAF6EE', text: '#1a1410', textMuted: '#9a8870',
    surface: '#F2EADC', border: 'rgba(26,20,16,0.08)', error: '#C15545',
    success: '#5A8A5C',
  };

  return (
    <ScrollView style={[s.container, { backgroundColor: colors.bg }]}>
      <View style={s.header}>
        <Text style={[s.title, { color: colors.text }]}>
          Taught Rules {isLive && <Text style={s.liveBadge}>{'\u25CF'} LIVE</Text>}
        </Text>
        {isLive && (
          <View style={s.statsRow}>
            <Text style={s.statActive}>{counts.active || 0} active</Text>
            {(counts.inactive || 0) > 0 && <Text style={s.statInactive}>{counts.inactive} disabled</Text>}
          </View>
        )}
      </View>

      {!isLive ? (
        <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={s.center}>
            <ActivityIndicator size="small" color="#2563eb" />
            <Text style={[s.emptyText, { color: colors.textMuted }]}>Loading rules...</Text>
          </View>
        </View>
      ) : rules.length === 0 ? (
        <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={s.center}>
            <Text style={[s.emptyTitle, { color: colors.textMuted }]}>No rules yet</Text>
            <Text style={[s.emptyText, { color: colors.textMuted }]}>
              Teach your assistant by saying things like:{'\n'}
              "When my boss calls during a meeting, always ring through"{'\n'}
              "Never schedule meetings before 10am"
            </Text>
          </View>
        </View>
      ) : (
        rules.map((rule) => (
          <Pressable
            key={String(rule.id)}
            onLongPress={() => { native?.haptics?.selection?.(); setDeleteTarget(rule); }}
            delayLongPress={500}
            style={[s.ruleCard, { backgroundColor: colors.surface, borderColor: colors.border, opacity: rule.active ? 1 : 0.5 }]}
          >
            <View style={s.ruleTop}>
              <Text style={[s.ruleDesc, { color: colors.text }]}>{rule.description}</Text>
              <View style={{ alignItems: 'center' }}>
                <Switch
                  value={rule.active}
                  onValueChange={() => toggleRule(rule)}
                  trackColor={{ false: '#374151', true: '#22c55e' }}
                  thumbColor="#fff"
                />
                <Text style={{ fontSize: 10, color: rule.active ? '#22c55e' : '#f59e0b', marginTop: 2 }}>
                  {rule.active ? 'active' : 'disabled'}
                </Text>
              </View>
            </View>
            {rule.tags.length > 0 && (
              <View style={s.tagRow}>
                {rule.tags.slice(0, 3).map((t, i) => (
                  <View key={i} style={s.tag}><Text style={[s.tagText, { color: colors.textMuted }]}>{t}</Text></View>
                ))}
              </View>
            )}
          </Pressable>
        ))
      )}

      <Modal visible={!!deleteTarget} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={[s.confirmBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[s.confirmText, { color: colors.text }]}>
              Delete this rule?{'\n'}
              <Text style={s.confirmBold}>{deleteTarget?.description || ''}</Text>
            </Text>
            <View style={s.confirmBtns}>
              <Pressable style={[s.cancelBtn, { backgroundColor: colors.border }]} onPress={() => setDeleteTarget(null)}>
                <Text style={[s.cancelBtnText, { color: colors.text }]}>Cancel</Text>
              </Pressable>
              <Pressable style={s.confirmDeleteBtn} onPress={doDelete}>
                <Text style={s.confirmDeleteText}>Delete</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

export default {
  id: 'teach-panel',
  type: 'ui',
  version: '1.0.0',
  capabilities: { haptics: true },
  Component: TeachPanelComponent,
};

const s = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '600' },
  liveBadge: { fontSize: 10, color: '#22c55e' },
  statsRow: { flexDirection: 'row', gap: 12 },
  statActive: { fontSize: 13, color: '#22c55e' },
  statInactive: { fontSize: 13, color: '#f59e0b' },
  card: { borderRadius: 10, borderWidth: 1, padding: 20, marginBottom: 10 },
  center: { alignItems: 'center', paddingVertical: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '500', marginBottom: 8 },
  emptyText: { fontSize: 13, textAlign: 'center', lineHeight: 20, marginTop: 4 },
  ruleCard: { borderRadius: 10, borderWidth: 1, padding: 14, marginBottom: 10 },
  ruleTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  ruleDesc: { fontSize: 13, flex: 1, marginRight: 12 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tag: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, backgroundColor: 'transparent' },
  tagText: { fontSize: 11 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  confirmBox: { borderRadius: 12, borderWidth: 1, padding: 20, width: 300 },
  confirmText: { fontSize: 14, textAlign: 'center', marginBottom: 16 },
  confirmBold: { fontWeight: '600' },
  confirmBtns: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  cancelBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 6 },
  cancelBtnText: { fontSize: 13, fontWeight: '500' },
  confirmDeleteBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 6, backgroundColor: '#ef4444' },
  confirmDeleteText: { fontSize: 13, fontWeight: '500', color: '#fff' },
});
