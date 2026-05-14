/**
 * Teach Panel — React Native Plugin
 * Lists taught rules from memory-mcp (PLATFORM connector) with toggle + delete.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  useApi,
  View,
  Text,
  Pressable,
  ScrollView,
  Switch,
  ActivityIndicator,
  Modal,
  StyleSheet,
} from '../../plugin-sdk';
import type { PluginProps } from '../../plugin-sdk/types';

interface Rule {
  id: any;
  description: string;
  trigger_type: string;
  action_type: string;
  active: boolean;
  created_from: string;
  tags: string[];
  raw: any;
}

const CONNECTOR = 'memory-mcp';

function TeachPanel({ bridge, native, theme }: PluginProps) {
  const api = useApi(bridge);
  const [rules, setRules] = useState<Rule[]>([]);
  const [counts, setCounts] = useState({ total: 0, active: 0, inactive: 0 });
  const [isLive, setIsLive] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Rule | null>(null);

  const loadData = useCallback(async () => {
    try {
      const results = await Promise.allSettled([
        api(CONNECTOR, 'memory.list', { type: 'rule', limit: 100 }),
        api(CONNECTOR, 'memory.rules.count'),
      ]);

      const listRes = results[0].status === 'fulfilled' ? results[0].value : null;
      const countRes = results[1].status === 'fulfilled' ? results[1].value : null;

      const list = listRes ? (typeof listRes === 'string' ? JSON.parse(listRes) : listRes) : null;
      const count = countRes ? (typeof countRes === 'string' ? JSON.parse(countRes) : countRes) : null;

      setCounts(count || { total: 0, active: 0, inactive: 0 });

      const parsed: Rule[] = (list?.memories || []).map((m: any) => {
        // Content may be plain text OR a JSON-encoded rule object (legacy).
        let p: any = {};
        if (typeof m.content === 'string' && m.content.trim().startsWith('{')) {
          try { p = JSON.parse(m.content); } catch {}
        }
        const description =
          p.description || p.rule_name || p.name ||
          (typeof m.content === 'string' ? m.content : '') ||
          m.context || '';

        // Tag fallbacks: prefer parsed structure, else infer from memory tags / kind
        const triggerType =
          p.trigger?.type || p.trigger_type ||
          (Array.isArray(m.tags) && m.tags.length ? m.tags[0] : 'rule');
        const actionType =
          p.action?.type || p.action_type ||
          (p.actions ? 'multi-action' :
           (Array.isArray(m.tags) && m.tags.length > 1 ? m.tags[1] : 'action'));
        const createdFrom = p.created_from || m.source || 'user';

        // active is a TOP-LEVEL DB field — never look inside content.
        const active = m.active !== false;

        return {
          id: m.id,
          description,
          trigger_type: triggerType,
          action_type: actionType,
          active,
          created_from: createdFrom,
          tags: Array.isArray(m.tags) ? m.tags : (m.tags ? String(m.tags).split(',') : []),
          raw: m,
        };
      });

      setRules(parsed);
      setLoadError(null);
      setIsLive(true);
    } catch (err: any) {
      console.error('[teach-panel] loadData error:', err);
      setLoadError(err?.message || 'Failed to load rules');
      setIsLive(true);
    }
  }, [api]);

  useEffect(() => {
    const timer = setTimeout(loadData, 300);
    return () => clearTimeout(timer);
  }, [loadData]);

  const toggleRule = useCallback(async (rule: Rule) => {
    try {
      // Toggle the top-level `active` field — DO NOT rewrite content.
      await api(CONNECTOR, 'memory.update', { id: rule.id, active: !rule.active });
      native?.haptics?.selection();
      await loadData();
    } catch (err) {
      console.warn('[teach-panel] toggle failed:', err);
    }
  }, [api, native, loadData]);

  const doDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await api(CONNECTOR, 'memory.delete', { id: deleteTarget.id });
      native?.haptics?.notification?.('success');
      setDeleteTarget(null);
      await loadData();
    } catch { setDeleteTarget(null); }
  }, [deleteTarget, api, native, loadData]);

  const colors = theme?.colors || {
    bg: '#0a0e14', text: '#e8ecf1', textMuted: '#8b95a5',
    surface: '#111820', border: '#1e2a3a', error: '#ef4444',
  };

  return (
    <ScrollView style={[s.container, { backgroundColor: colors.bg }]}>
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <Text style={[s.title, { color: colors.text }]}>
          Taught Rules {isLive && <Text style={s.liveBadge}>{'\u25CF'} LIVE</Text>}
        </Text>
        {isLive && (
          <View style={s.statsRow}>
            <Text style={s.statActive}>{counts.active || 0} active</Text>
            <Text style={s.statInactive}>{counts.inactive || 0} inactive</Text>
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
      ) : loadError ? (
        <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={s.center}>
            <Text style={[s.emptyTitle, { color: colors.error || '#ef4444' }]}>Error loading rules</Text>
            <Text style={[s.emptyText, { color: colors.textMuted }]}>{loadError}</Text>
            <Pressable style={[s.retryBtn, { borderColor: colors.border }]} onPress={loadData}>
              <Text style={[s.retryText, { color: colors.textMuted }]}>Retry</Text>
            </Pressable>
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
          <View key={String(rule.id)} style={[s.ruleCard, { backgroundColor: colors.surface, borderColor: colors.border, opacity: rule.active ? 1 : 0.5 }]}>
            <View style={s.ruleTop}>
              <Text style={[s.ruleDesc, { color: colors.text }]}>{rule.description}</Text>
              <View style={s.ruleActions}>
                <Switch value={rule.active} onValueChange={() => toggleRule(rule)} trackColor={{ false: '#374151', true: '#22c55e' }} thumbColor="#fff" />
                <Pressable style={[s.deleteBtn, { borderColor: colors.border }]} onPress={() => { setDeleteTarget(rule); native?.haptics?.selection(); }}>
                  <Text style={[s.deleteBtnText, { color: colors.textMuted }]}>{'\u2715'}</Text>
                </Pressable>
              </View>
            </View>
            <View style={s.tagRow}>
              {rule.tags.filter(t => t && t.trim()).slice(0, 4).map((t, i) => (
                <View key={i} style={[s.tag, s.tagSource]}><Text style={s.tagSourceText}>{t.trim()}</Text></View>
              ))}
            </View>
          </View>
        ))
      )}
      <Modal visible={!!deleteTarget} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={[s.confirmBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[s.confirmText, { color: colors.text }]}>
              Delete this rule?{'\n'}<Text style={s.confirmBold}>{deleteTarget?.description || ''}</Text>
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

// Plain object export — required by mobile bundle validator.
// Do NOT use PluginSDK.register() — pollutes shared registry.
export default {
  id: 'teach-panel',
  type: 'ui',
  version: '1.0.1',
  capabilities: { haptics: true },
  Component: TeachPanel,
};

const s = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1 },
  title: { fontSize: 18, fontWeight: '600' },
  liveBadge: { fontSize: 10, color: '#22c55e' },
  statsRow: { flexDirection: 'row', gap: 12 },
  statActive: { fontSize: 13, color: '#22c55e' },
  statInactive: { fontSize: 13, color: '#f59e0b' },
  card: { borderRadius: 10, borderWidth: 1, padding: 20, marginBottom: 10 },
  center: { alignItems: 'center', paddingVertical: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '500', marginBottom: 8 },
  emptyText: { fontSize: 13, textAlign: 'center', lineHeight: 20, marginTop: 4 },
  retryBtn: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 6, borderWidth: 1 },
  retryText: { fontSize: 12 },
  ruleCard: { borderRadius: 10, borderWidth: 1, padding: 14, marginBottom: 10 },
  ruleTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  ruleDesc: { fontSize: 14, fontWeight: '500', flex: 1, marginRight: 12 },
  ruleActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  deleteBtn: { width: 28, height: 20, borderRadius: 4, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  deleteBtnText: { fontSize: 12 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  tagSource: { backgroundColor: '#1a2332' },
  tagSourceText: { fontSize: 11, color: '#6b7a8d' },
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
