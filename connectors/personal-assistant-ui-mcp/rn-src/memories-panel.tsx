/**
 * Memories Panel — featured plugin
 *
 * Shows what Ada remembers about the user. Owns the "Tell Ada something to
 * remember" add UX (was in mobile host before — moved here per host-contract).
 *
 * Data model: memory.userProfile returns { profile, preferences, facts,
 * instructions, total_memories, rules: { active } }. Add via memory.add.
 * Delete via memory.delete.
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
  TextInput,
  Platform,
} from 'react-native';
import { useApi } from '@adas/plugin-sdk';
import type { PluginProps } from '@adas/plugin-sdk';

const CONNECTOR = 'memory-mcp';

const PROFILE_LABELS: Record<string, string> = {
  name: 'Name', timezone: 'Timezone', location: 'Location',
  language: 'Language', email: 'Email', phone: 'Phone',
  birthday: 'Birthday', occupation: 'Occupation',
};

const GARBAGE_VALUES = new Set(['asking', 'unknown', 'null', 'undefined', 'none', 'n/a', '?', '']);
const GARBAGE_RE = /^(asking|detecting|checking|updating|setting|getting|fetching)/i;

interface MemoryItem {
  id: any;
  content: string;
  context?: string;
  tags?: string[];
  created_at?: string;
  confidence?: number;
}

function formatDate(d?: string): string {
  if (!d) return '';
  try {
    const date = new Date(d.replace(' ', 'T'));
    const diff = Date.now() - date.getTime();
    if (diff < 86400000) return 'Today';
    if (diff < 172800000) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return ''; }
}

function parseContent(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) {
    try {
      const p = JSON.parse(trimmed);
      if (p.description) return p.description;
      if (p.rule_name) return p.rule_name;
      if (p.name && typeof p.name === 'string') return p.name;
      if (p.field && p.value !== undefined) {
        const label = PROFILE_LABELS[p.field] || p.field.replace(/_/g, ' ');
        return `${label}: ${p.value}`;
      }
      const keys = Object.keys(p);
      if (keys.length === 1) {
        const k = keys[0];
        const v = p[k];
        if (typeof v === 'string' || typeof v === 'number') {
          const label = k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          return `${label}: ${v}`;
        }
      }
      if (keys.length <= 4 && keys.every(k => typeof p[k] === 'string' || typeof p[k] === 'number' || typeof p[k] === 'boolean')) {
        return keys
          .filter(k => !['active', 'confidence', 'source'].includes(k))
          .map(k => {
            const label = k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            return `${label}: ${p[k]}`;
          })
          .join('\n');
      }
    } catch {}
  }
  return raw;
}

function isGarbageProfileValue(value: string): boolean {
  if (!value || value.length < 2) return true;
  if (GARBAGE_VALUES.has(value.toLowerCase())) return true;
  if (GARBAGE_RE.test(value)) return true;
  return false;
}

function MemoriesPanel({ bridge, native, theme, props: engineProps }: PluginProps) {
  const api = useApi(bridge);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Record<string, string>>({});
  const [preferences, setPreferences] = useState<MemoryItem[]>([]);
  const [facts, setFacts] = useState<MemoryItem[]>([]);
  const [instructions, setInstructions] = useState<MemoryItem[]>([]);
  const [totalMemories, setTotalMemories] = useState(0);
  const [rulesCount, setRulesCount] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<MemoryItem | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>('preferences');
  // Engine props: { autoOpenAdd?: boolean, prefillText?: string }
  const initialAddOpen = !!(engineProps?.autoOpenAdd);
  const initialAddText = typeof engineProps?.prefillText === 'string' ? engineProps.prefillText : '';
  const [addOpen, setAddOpen] = useState(initialAddOpen);
  const [addText, setAddText] = useState(initialAddText);
  const [addBusy, setAddBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const c: any = theme?.colors || {
    bgPrimary: '#FAF6EE', bgSecondary: '#F2EADC',
    border: 'rgba(26,20,16,0.06)', borderHover: 'rgba(26,20,16,0.14)',
    textPrimary: '#1a1410', textSecondary: '#6b5a47', textMuted: '#9a8870',
    accent: '#FF7A28', accentSoft: 'rgba(255,122,40,0.10)', accentHover: '#E0680E',
  };
  const palette = {
    bg: c.bgPrimary || c.bg || '#FAF6EE',
    surface: c.bgSecondary || c.surface || '#F2EADC',
    border: c.border || 'rgba(26,20,16,0.06)',
    borderStrong: c.borderHover || c.border || 'rgba(26,20,16,0.14)',
    text: c.textPrimary || c.text || '#1a1410',
    textSoft: c.textSecondary || c.textMuted || '#6b5a47',
    textMuted: c.textMuted || '#9a8870',
    accent: c.accent || '#FF7A28',
    accentSoft: c.accentSoft || 'rgba(255,122,40,0.10)',
    accentDeep: c.accentHover || '#E0680E',
  };

  const load = useCallback(async () => {
    try {
      const raw = await api.call('memory.userProfile', {}, CONNECTOR);
      let data: any = raw;
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch {}
      }
      if (data?.content?.[0]?.text) {
        try { data = JSON.parse(data.content[0].text); } catch {}
      }

      const rawProfile = data?.profile || {};
      const cleanProfile: Record<string, string> = {};
      for (const [k, v] of Object.entries(rawProfile)) {
        if (typeof v === 'string' && !isGarbageProfileValue(v)) {
          cleanProfile[k] = v;
        }
      }

      setProfile(cleanProfile);
      setPreferences(data?.preferences || []);
      setFacts(data?.facts || []);
      setInstructions(data?.instructions || []);
      setTotalMemories(data?.total_memories || 0);
      setRulesCount(data?.rules?.active || 0);
    } catch (e) {
      console.warn('[memories-panel] load failed:', e);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  const doDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    try {
      await api.call('memory.delete', { id: target.id }, CONNECTOR);
      native?.haptics?.notification?.('success');
      await load();
    } catch {
      native?.haptics?.error?.();
    }
  };

  const openAdd = () => {
    native?.haptics?.selection?.();
    setAddText('');
    setErrorMsg(null);
    setAddOpen(true);
  };

  const submitAdd = async () => {
    const text = addText.trim();
    if (!text || addBusy) return;
    setAddBusy(true);
    setErrorMsg(null);
    try {
      await api.call('memory.add', { content: text }, CONNECTOR);
      native?.haptics?.notification?.('success');
      setAddOpen(false);
      setAddText('');
      await load();
    } catch (e: any) {
      const msg = e?.message || String(e);
      console.warn('[memories-panel] add failed:', msg);
      native?.haptics?.error?.();
      setErrorMsg('Couldn’t save. Try telling me in chat instead.');
    } finally {
      setAddBusy(false);
    }
  };

  const toggleSection = (section: string) => {
    native?.haptics?.selection?.();
    setExpandedSection(prev => prev === section ? null : section);
  };

  if (loading) {
    return (
      <View style={[s.container, { backgroundColor: palette.bg }]}>
        <ActivityIndicator color={palette.accent} style={{ marginTop: 60 }} />
      </View>
    );
  }

  const profileKeys = Object.keys(profile);
  const hasProfile = profileKeys.length > 0;
  const isEmpty = !hasProfile && preferences.length === 0 && facts.length === 0 && instructions.length === 0;

  const renderMemoryCard = (item: MemoryItem) => {
    const parsed = parseContent(item.content);
    return (
      <Pressable
        key={item.id}
        onLongPress={() => { native?.haptics?.selection?.(); setDeleteTarget(item); }}
        delayLongPress={500}
        style={[s.itemCard, { backgroundColor: palette.surface }]}
      >
        <Text style={[s.itemContent, { color: palette.text }]} numberOfLines={4}>{parsed}</Text>
        {item.context ? (
          <Text style={[s.itemContext, { color: palette.textMuted }]} numberOfLines={2}>{item.context}</Text>
        ) : null}
        {item.created_at ? (
          <Text style={[s.itemDate, { color: palette.textMuted }]}>{formatDate(item.created_at)}</Text>
        ) : null}
      </Pressable>
    );
  };

  const renderSection = (title: string, key: string, items: MemoryItem[]) => {
    if (items.length === 0) return null;
    const isOpen = expandedSection === key;
    return (
      <View key={key} style={{ marginBottom: 8 }}>
        <Pressable onPress={() => toggleSection(key)} style={s.sectionHeader}>
          <Text style={[s.sectionTitle, { color: palette.textMuted }]}>
            {title.toUpperCase()} · {items.length}
          </Text>
          <Text style={{ fontSize: 12, color: palette.textMuted }}>{isOpen ? '▾' : '▸'}</Text>
        </Pressable>
        {isOpen && <View style={{ gap: 8 }}>{items.map(renderMemoryCard)}</View>}
      </View>
    );
  };

  return (
    <ScrollView style={[s.container, { backgroundColor: palette.bg }]} contentContainerStyle={{ paddingBottom: 32 }}>
      {isEmpty ? (
        <View style={[s.emptyCard, { backgroundColor: palette.surface }]}>
          <Text style={[s.emptyTitle, { color: palette.textSoft }]}>I don’t know you yet</Text>
          <Text style={[s.emptyText, { color: palette.textMuted }]}>
            Tell me about yourself in chat, or tap below to teach me directly.
          </Text>
        </View>
      ) : (
        <>
          {hasProfile && (
            <View style={[s.profileCard, { backgroundColor: palette.surface }]}>
              {profile.name ? (
                <View style={s.profileHeader}>
                  <View style={[s.avatar, { backgroundColor: palette.accent }]}>
                    <Text style={s.avatarText}>{profile.name[0].toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.profileName, { color: palette.text }]}>{profile.name}</Text>
                    {profile.timezone ? (
                      <Text style={{ fontSize: 13, color: palette.textMuted }}>{profile.timezone}</Text>
                    ) : null}
                  </View>
                </View>
              ) : null}
              <View style={[s.profileFields, !profile.name && { marginTop: 0 }]}>
                {profileKeys.filter(k => profile.name ? k !== 'name' && k !== 'timezone' : true).map((k, i) => (
                  <View key={k} style={[s.profileField, i > 0 && s.profileFieldDivider, { borderTopColor: palette.border }]}>
                    <Text style={[s.profileLabel, { color: palette.textMuted }]}>
                      {PROFILE_LABELS[k] || k.replace(/_/g, ' ')}
                    </Text>
                    <Text style={[s.profileValue, { color: palette.text }]} numberOfLines={1}>
                      {profile[k]}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {renderSection('Preferences', 'preferences', preferences)}
          {renderSection('Facts', 'facts', facts)}
          {renderSection('Instructions', 'instructions', instructions)}

          {rulesCount > 0 && (
            <Text style={[s.rulesHint, { color: palette.textMuted }]}>
              {rulesCount} taught rules → see Teach panel
            </Text>
          )}
        </>
      )}

      <Pressable
        onPress={openAdd}
        style={[s.addBtn, { borderColor: palette.borderStrong }]}
      >
        <Text style={[s.addText, { color: palette.textSoft }]}>+ Tell Ada something to remember</Text>
      </Pressable>

      {/* Add memory modal */}
      <Modal visible={addOpen} transparent animationType="fade" onRequestClose={() => setAddOpen(false)}>
        <View style={s.overlay}>
          <View style={[s.addBox, { backgroundColor: palette.surface }]}>
            <Text style={[s.addTitle, { color: palette.text }]}>Tell Ada</Text>
            <Text style={[s.addSubtitle, { color: palette.textMuted }]}>
              Something to remember about you
            </Text>
            <TextInput
              autoFocus
              multiline
              value={addText}
              onChangeText={setAddText}
              placeholder="e.g. I prefer window seats"
              placeholderTextColor={palette.textMuted}
              style={[s.addInput, { color: palette.text, borderColor: palette.border, backgroundColor: palette.bg }]}
              editable={!addBusy}
            />
            {errorMsg ? (
              <Text style={[s.errorText, { color: palette.accentDeep }]}>{errorMsg}</Text>
            ) : null}
            <View style={s.addBtns}>
              <Pressable
                onPress={() => { setAddOpen(false); setErrorMsg(null); }}
                disabled={addBusy}
                style={[s.cancelBtn, { backgroundColor: palette.border }]}
              >
                <Text style={{ color: palette.text, fontSize: 14, fontWeight: '500' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={submitAdd}
                disabled={!addText.trim() || addBusy}
                style={[s.saveBtn, {
                  backgroundColor: addText.trim() && !addBusy ? palette.accent : palette.borderStrong,
                  opacity: addText.trim() && !addBusy ? 1 : 0.6,
                }]}
              >
                {addBusy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Save</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete confirm modal */}
      <Modal visible={!!deleteTarget} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={[s.confirmBox, { backgroundColor: palette.surface }]}>
            <Text style={[s.confirmText, { color: palette.text }]}>
              Forget this?{'\n'}
              <Text style={{ fontWeight: '600' }}>{parseContent(deleteTarget?.content || '')}</Text>
            </Text>
            <View style={s.addBtns}>
              <Pressable onPress={() => setDeleteTarget(null)} style={[s.cancelBtn, { backgroundColor: palette.border }]}>
                <Text style={{ color: palette.text, fontSize: 14, fontWeight: '500' }}>Keep</Text>
              </Pressable>
              <Pressable onPress={doDelete} style={[s.saveBtn, { backgroundColor: palette.accent }]}>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Forget</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

export default {
  id: 'memories-panel',
  type: 'ui',
  version: '1.0.0',
  Component: MemoriesPanel,
};

const s = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 4 },
  // Profile card
  profileCard: { borderRadius: 18, padding: 18, marginBottom: 18 },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 4 },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  profileName: { fontSize: 17, fontWeight: '600', letterSpacing: -0.2 },
  profileFields: { marginTop: 12 },
  profileField: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, gap: 12 },
  profileFieldDivider: { borderTopWidth: 1 },
  profileLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.4, width: 80 },
  profileValue: { flex: 1, fontSize: 14, fontWeight: '500', textAlign: 'right' },
  // Section
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 4, marginTop: 6,
  },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  itemCard: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  itemContent: { fontSize: 14, fontWeight: '400', lineHeight: 20 },
  itemContext: { fontSize: 12, fontStyle: 'italic', marginTop: 4, lineHeight: 17 },
  itemDate: { fontSize: 11, marginTop: 6 },
  rulesHint: { fontSize: 12, textAlign: 'center', fontStyle: 'italic', marginTop: 16, marginBottom: 4 },
  // Empty
  emptyCard: { borderRadius: 18, padding: 28, alignItems: 'center', marginTop: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '600', marginBottom: 10 },
  emptyText: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  // Add button
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, paddingHorizontal: 16, marginTop: 14,
    borderWidth: 1, borderRadius: 14, borderStyle: 'dashed',
  },
  addText: { fontSize: 14, fontWeight: '500' },
  // Modals
  overlay: { flex: 1, backgroundColor: 'rgba(26,20,16,0.55)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  addBox: { borderRadius: 20, padding: 22, width: '100%', maxWidth: 360 },
  addTitle: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
  addSubtitle: { fontSize: 13, marginBottom: 14 },
  addInput: {
    minHeight: 80, borderWidth: 1, borderRadius: 12, padding: 12,
    fontSize: 15, lineHeight: 20, marginBottom: 12,
    textAlignVertical: 'top',
  },
  errorText: { fontSize: 13, marginBottom: 12 },
  addBtns: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  saveBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  confirmBox: { borderRadius: 20, padding: 22, width: '100%', maxWidth: 340 },
  confirmText: { fontSize: 14, textAlign: 'center', marginBottom: 18, lineHeight: 20 },
});
