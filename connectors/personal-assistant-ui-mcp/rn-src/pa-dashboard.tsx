/**
 * PA Dashboard — React Native Plugin
 *
 * At-a-glance dashboard showing today's events, upcoming events,
 * recent memories, and contacts.
 * Calls device.calendar.today, device.calendar.upcoming, memory.list,
 * device.contacts.search.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { PluginSDK, useApi } from '@adas/plugin-sdk';
import type { PluginProps } from '@adas/plugin-sdk';

// ── Types ──────────────────────────────────────────────────

interface CalendarEvent {
  title?: string;
  start?: string;
  location?: string;
  attendees?: string[];
  date?: string;
}

interface Memory {
  type: string;
  content: string;
  tags?: string[];
}

interface Contact {
  name: string;
  relationship?: string;
  phone?: string;
}

// ── Constants ──────────────────────────────────────────────

const DEVICE = 'mobile-device-mcp';
const MEMORY = 'memory-mcp';
const ACCENT = '#2563eb';

const REL_EMOJI: Record<string, string> = {
  wife: '\u{1F49C}', husband: '\u{1F49C}', boss: '\u{1F4BC}',
  mother: '\u{1F49B}', father: '\u{1F49B}', son: '\u{1F466}',
  daughter: '\u{1F467}', friend: '\u{1F91D}', colleague: '\u{1F4BB}',
};

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  preference: { bg: 'rgba(139,92,246,0.15)', text: '#8b5cf6' },
  fact: { bg: 'rgba(37,99,235,0.15)', text: '#2563eb' },
  instruction: { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b' },
  pattern: { bg: 'rgba(22,163,74,0.15)', text: '#16a34a' },
};

// ── Main Component ─────────────────────────────────────────

export default PluginSDK.register('pa-dashboard', {
  type: 'ui',
  version: '1.0.0',
  capabilities: {},

  Component({ bridge, theme }: PluginProps) {
    const api = useApi(bridge);
    const [todayEvents, setTodayEvents] = useState<CalendarEvent[]>([]);
    const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);
    const [memories, setMemories] = useState<Memory[]>([]);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
      const results = await Promise.allSettled([
        api.call('device.calendar.today', {}, DEVICE),
        api.call('device.calendar.upcoming', { days: 7 }, DEVICE),
        api.call('memory.list', {}, MEMORY),
        api.call('device.contacts.search', { query: '' }, DEVICE),
      ]);

      const parse = (r: any) => {
        if (!r || r.status !== 'fulfilled') return null;
        const v = r.value;
        return typeof v === 'string' ? JSON.parse(v) : v;
      };

      try {
        const today = parse(results[0]);
        if (today) setTodayEvents(today.events || (Array.isArray(today) ? today : []));
      } catch {}

      try {
        const upcoming = parse(results[1]);
        if (upcoming) {
          let events = upcoming.events || [];
          if (upcoming.days) {
            events = [];
            upcoming.days.forEach((d: any) => (d.events || []).forEach((e: any) => events.push({ ...e, date: d.date })));
          }
          setUpcomingEvents(events);
        }
      } catch {}

      try {
        const mem = parse(results[2]);
        if (mem) setMemories((mem.memories || []).slice(0, 5));
      } catch {}

      try {
        const cont = parse(results[3]);
        if (cont) setContacts((cont.contacts || []).slice(0, 5));
      } catch {}

      setLoading(false);
    }, [api]);

    useEffect(() => {
      const timer = setTimeout(loadData, 300);
      return () => clearTimeout(timer);
    }, [loadData]);

    // ── Render ──────────────────────────────────────────────

    const colors = theme?.colors || {
      bg: '#FAF6EE', text: '#1a1410', textMuted: '#9a8870',
      surface: '#F2EADC', border: 'rgba(26,20,16,0.08)',
    };

    if (loading) {
      return (
        <View style={[s.container, s.center, { backgroundColor: colors.bg }]}>
          <ActivityIndicator size="small" color={ACCENT} />
          <Text style={[s.loadingText, { color: colors.textMuted }]}>Connecting...</Text>
        </View>
      );
    }

    return (
      <ScrollView style={[s.container, { backgroundColor: colors.bg }]}>
        {/* Today */}
        <Section icon={'\u{1F4C5}'} title="Today" badge={String(todayEvents.length)} colors={colors}>
          {todayEvents.length === 0 ? (
            <Text style={[s.empty, { color: colors.textMuted }]}>No events</Text>
          ) : (
            todayEvents.map((e, i) => (
              <View key={i} style={[s.eventRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[s.eventTime, { color: ACCENT }]}>{e.start || ''}</Text>
                <View style={s.eventBody}>
                  <Text style={[s.eventTitle, { color: colors.text }]}>{e.title || 'Untitled'}</Text>
                  {e.location ? <Text style={[s.eventMeta, { color: colors.textMuted }]}>{'\u{1F4CD}'} {e.location}</Text> : null}
                </View>
              </View>
            ))
          )}
        </Section>

        {/* Upcoming */}
        <Section icon={'\u{1F5D3}'} title="Upcoming" colors={colors}>
          {upcomingEvents.length === 0 ? (
            <Text style={[s.empty, { color: colors.textMuted }]}>No upcoming events</Text>
          ) : (
            upcomingEvents.slice(0, 5).map((e, i) => (
              <View key={i} style={[s.eventRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[s.eventTime, { color: ACCENT }]}>{e.start || ''}</Text>
                <View style={s.eventBody}>
                  <Text style={[s.eventTitle, { color: colors.text }]}>{e.title || 'Untitled'}</Text>
                  {e.location ? <Text style={[s.eventMeta, { color: colors.textMuted }]}>{'\u{1F4CD}'} {e.location}</Text> : null}
                </View>
              </View>
            ))
          )}
        </Section>

        {/* Memories */}
        <Section icon={'\u{1F9E0}'} title="Memories" badge={String(memories.length)} colors={colors}>
          {memories.length === 0 ? (
            <Text style={[s.empty, { color: colors.textMuted }]}>No stored memories yet</Text>
          ) : (
            memories.map((m, i) => {
              const tc = TYPE_COLORS[m.type] || { bg: 'rgba(37,99,235,0.15)', text: ACCENT };
              return (
                <View key={i} style={[s.memRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={[s.memTypeBadge, { backgroundColor: tc.bg }]}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: tc.text, textTransform: 'uppercase' }}>{m.type}</Text>
                  </View>
                  <Text style={[s.memContent, { color: colors.text }]} numberOfLines={2}>{m.content}</Text>
                </View>
              );
            })
          )}
        </Section>

        {/* Contacts */}
        <Section icon={'\u{1F4D2}'} title="Contacts" colors={colors}>
          {contacts.length === 0 ? (
            <Text style={[s.empty, { color: colors.textMuted }]}>No contacts</Text>
          ) : (
            contacts.map((c, i) => (
              <View key={i} style={[s.contactRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[s.avatar, { backgroundColor: colors.border }]}>
                  <Text style={s.avatarText}>{REL_EMOJI[c.relationship || ''] || '\u{1F464}'}</Text>
                </View>
                <View>
                  <Text style={[s.contactName, { color: colors.text }]}>{c.name}</Text>
                  <Text style={[s.contactRel, { color: colors.textMuted }]}>
                    {c.relationship || ''}{c.phone ? ` \u2022 ${c.phone}` : ''}
                  </Text>
                </View>
              </View>
            ))
          )}
        </Section>
      </ScrollView>
    );
  },
});

// ── Section Component ──────────────────────────────────────

function Section({ icon, title, badge, colors, children }: {
  icon: string; title: string; badge?: string;
  colors: any; children: React.ReactNode;
}) {
  return (
    <View style={s.section}>
      <View style={[s.sectionHeader, { borderBottomColor: colors.border }]}>
        <Text style={s.sectionIcon}>{icon}</Text>
        <Text style={[s.sectionTitle, { color: colors.text }]}>{title}</Text>
        {badge ? (
          <View style={s.sectionBadge}>
            <Text style={s.sectionBadgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      {children}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 13, marginTop: 8 },
  empty: { textAlign: 'center', padding: 16, fontSize: 12 },

  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, paddingBottom: 6, borderBottomWidth: 1 },
  sectionIcon: { fontSize: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '600' },
  sectionBadge: { marginLeft: 'auto', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: 'rgba(37,99,235,0.15)' },
  sectionBadgeText: { fontSize: 11, fontWeight: '600', color: ACCENT },

  eventRow: { flexDirection: 'row', gap: 10, padding: 10, borderRadius: 10, borderWidth: 1, marginBottom: 6 },
  eventTime: { minWidth: 48, fontSize: 12, fontWeight: '600', paddingTop: 1 },
  eventBody: { flex: 1 },
  eventTitle: { fontSize: 13, fontWeight: '600' },
  eventMeta: { fontSize: 11, marginTop: 2 },

  memRow: { padding: 10, borderRadius: 10, borderWidth: 1, marginBottom: 6 },
  memTypeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start', marginBottom: 4 },
  memContent: { fontSize: 13 },

  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: 10, borderWidth: 1, marginBottom: 4 },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14 },
  contactName: { fontSize: 13, fontWeight: '600' },
  contactRel: { fontSize: 11 },
});
