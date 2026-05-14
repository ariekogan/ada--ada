/**
 * Schedule Panel — React Native Plugin
 *
 * Shows today's events, upcoming events (tabbed), and weather strip.
 * Calls device.calendar.today, device.calendar.upcoming, device.weather.current
 * via mobile-device-mcp.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  PluginSDK,
  useApi,
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from '../../plugin-sdk';
import type { PluginProps } from '../../plugin-sdk/types';

interface CalendarEvent {
  title?: string;
  name?: string;
  start_time?: string;
  start?: string;
  end_time?: string;
  end?: string;
  location?: string;
  attendees?: string[];
  _date?: string;
}

interface WeatherData {
  temperature?: string | number;
  temp?: string | number;
  conditions?: string;
  description?: string;
  humidity?: string;
  wind?: string;
}

type Tab = 'today' | 'upcoming';

const DEVICE = 'mobile-device-mcp';
const ACCENT = '#2563eb';

export default PluginSDK.register('schedule-panel', {
  type: 'ui',
  version: '1.0.0',
  capabilities: {},

  Component({ bridge, theme }: PluginProps) {
    const api = useApi(bridge);
    const [tab, setTab] = useState<Tab>('today');
    const [todayEvents, setTodayEvents] = useState<CalendarEvent[]>([]);
    const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);
    const [weather, setWeather] = useState<WeatherData | null>(null);
    const [isLive, setIsLive] = useState(false);

    const loadData = useCallback(async () => {
      try {
        const [todayRes, upcomingRes, weatherRes] = await Promise.all([
          api(DEVICE, 'device.calendar.today').catch(() => null),
          api(DEVICE, 'device.calendar.upcoming', { days: 3 }).catch(() => null),
          api(DEVICE, 'device.weather.current').catch(() => null),
        ]);
        if (todayRes) {
          const d = typeof todayRes === 'string' ? JSON.parse(todayRes) : todayRes;
          setTodayEvents(d.events || (Array.isArray(d) ? d : []));
        }
        if (upcomingRes) {
          const d = typeof upcomingRes === 'string' ? JSON.parse(upcomingRes) : upcomingRes;
          let events = d.events || (Array.isArray(d) ? d : []);
          if (d.days) {
            events = [];
            d.days.forEach((day: any) => {
              (day.events || []).forEach((e: any) => events.push({ ...e, _date: day.date }));
            });
          }
          setUpcomingEvents(events);
        }
        if (weatherRes) {
          setWeather(typeof weatherRes === 'string' ? JSON.parse(weatherRes) : weatherRes);
        }
        setIsLive(true);
      } catch {}
    }, [api]);

    useEffect(() => {
      const timer = setTimeout(loadData, 300);
      return () => clearTimeout(timer);
    }, [loadData]);

    const colors = theme?.colors || {
      bg: '#0a0e14', text: '#e8ecf1', textMuted: '#8b95a5',
      surface: '#111820', border: '#1e2a3a',
    };
    const events = tab === 'today' ? todayEvents : upcomingEvents;
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    return (
      <ScrollView style={[s.container, { backgroundColor: colors.bg }]}>
        <View style={[s.header, { borderBottomColor: colors.border }]}>
          <Text style={[s.title, { color: colors.text }]}>
            Schedule {isLive && <Text style={s.liveBadge}>{'\u25CF'} LIVE</Text>}
          </Text>
          <Text style={[s.dateLabel, { color: colors.textMuted }]}>{today}</Text>
        </View>
        {weather && (
          <View style={[s.weatherStrip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[s.weatherTemp, { color: colors.text }]}>{String(weather.temperature || weather.temp || '')}</Text>
            <View style={s.weatherInfo}>
              <Text style={[s.weatherCond, { color: colors.text }]}>{weather.conditions || weather.description || ''}</Text>
              <Text style={[s.weatherDetail, { color: colors.textMuted }]}>
                {weather.humidity ? `Humidity: ${weather.humidity}` : ''}{weather.wind ? ` · Wind: ${weather.wind}` : ''}
              </Text>
            </View>
          </View>
        )}
        <View style={s.tabs}>
          {(['today', 'upcoming'] as Tab[]).map((t) => (
            <Pressable key={t} style={[s.tabBtn, tab === t && s.tabActive, { borderColor: colors.border }]} onPress={() => setTab(t)}>
              <Text style={[s.tabText, tab === t && s.tabTextActive, { color: tab === t ? '#fff' : colors.textMuted }]}>
                {t === 'today' ? `Today (${todayEvents.length})` : `Upcoming (${upcomingEvents.length})`}
              </Text>
            </Pressable>
          ))}
        </View>
        {!isLive ? (
          <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={s.center}>
              <ActivityIndicator size="small" color={ACCENT} />
              <Text style={[s.emptyText, { color: colors.textMuted }]}>Loading schedule...</Text>
            </View>
          </View>
        ) : events.length === 0 ? (
          <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={s.center}>
              <Text style={[s.emptyTitle, { color: colors.textMuted }]}>No events {tab === 'today' ? 'today' : 'upcoming'}</Text>
              <Text style={[s.emptyText, { color: colors.textMuted }]}>Your calendar is clear!</Text>
            </View>
          </View>
        ) : (
          events.map((ev, i) => (
            <View key={i} style={[s.eventCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={s.eventTime}>
                <Text style={[s.eventStart, { color: colors.text }]}>{ev.start_time || ev.start || ''}</Text>
                <Text style={[s.eventEnd, { color: colors.textMuted }]}>{ev.end_time || ev.end || ''}</Text>
              </View>
              <View style={s.eventDetails}>
                <Text style={[s.eventTitle, { color: colors.text }]}>{ev.title || ev.name || 'Untitled'}</Text>
                {ev.location ? <Text style={s.eventLocation}>{ev.location}</Text> : null}
                {ev.attendees?.length ? <Text style={[s.eventAttendees, { color: colors.textMuted }]}>{ev.attendees.join(', ')}</Text> : null}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    );
  },
});

const s = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingBottom: 12, borderBottomWidth: 1 },
  title: { fontSize: 18, fontWeight: '600' },
  liveBadge: { fontSize: 10, color: '#22c55e' },
  dateLabel: { fontSize: 13 },
  weatherStrip: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 14 },
  weatherTemp: { fontSize: 22, fontWeight: '600' },
  weatherInfo: { flex: 1 },
  weatherCond: { fontSize: 13 },
  weatherDetail: { fontSize: 11 },
  tabs: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  tabBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16, borderWidth: 1 },
  tabActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  tabText: { fontSize: 12 },
  tabTextActive: { color: '#fff' },
  card: { borderRadius: 10, borderWidth: 1, padding: 20, marginBottom: 10 },
  center: { alignItems: 'center', paddingVertical: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '500', marginBottom: 8 },
  emptyText: { fontSize: 13, marginTop: 4 },
  eventCard: { flexDirection: 'row', gap: 14, borderRadius: 10, borderWidth: 1, padding: 14, marginBottom: 10 },
  eventTime: { minWidth: 60 },
  eventStart: { fontSize: 14, fontWeight: '600' },
  eventEnd: { fontSize: 12 },
  eventDetails: { flex: 1 },
  eventTitle: { fontSize: 14, fontWeight: '500', marginBottom: 4 },
  eventLocation: { fontSize: 12, color: '#818cf8', marginBottom: 2 },
  eventAttendees: { fontSize: 11 },
});
