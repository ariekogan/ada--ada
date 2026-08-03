/**
 * Connections Panel — placement: "menu"
 *
 * Unified list of every service we know about. Each row shows:
 *   icon · name · why-or-account · status pill · Connect/Disconnect button.
 *
 * Tools (skill-routed via /mcp on pa-orchestrator):
 *   - platform.auth.listServices  → { services: [{ service_id, connected, account, mode }] }
 *   - platform.auth.disconnect    → ({ service_id }) ⇒ revoke
 *
 * Connect flow: tap "Connect" → tip card slides in with the exact phrase to
 * say in chat. We don't trigger OAuth from here directly — the orchestrator's
 * existing handlers know how to kick that off when the user sends the message.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
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

interface RawService {
  id: string;
  name: string;
  authed: boolean;
  email?: string;
  account?: string;
  status?: string;
}

/** Per-service flavor — icon + why-copy for services Ada knows about.
 *  This is *solution-side* UX copy, not a service registry. The actual list
 *  of services rendered comes from `platform.auth.listServices` — anything
 *  the platform returns gets shown, with this map providing nicer copy when
 *  we have it and a sensible fallback when we don't. */
const SERVICE_FLAVOR: Record<string, { icon: string; why: string }> = {
  gmail:        { icon: '📧', why: 'Tidy your inbox, surface what matters, draft replies in your voice.' },
  google:       { icon: '📅', why: 'Defend your time, plan around traffic, never miss a thing.' },
  google_drive: { icon: '📁', why: 'Search your Drive and answer questions about your docs.' },
  whatsapp:     { icon: '💬', why: 'Catch what you missed, send messages without picking up the phone.' },
  dropbox:      { icon: '📦', why: 'Search your docs — contracts, handbooks, anything you’ve filed away.' },
  linkedin:     { icon: '💼', why: 'Check reactions, post for you, reply to comments without opening the app.' },
  facebook:     { icon: '👥', why: 'Stay on top of mentions and messages without doom-scrolling.' },
  slack:        { icon: '💬', why: 'Get the gist of channels you’re behind on, draft replies before you hit send.' },
  spotify:      { icon: '🎵', why: 'Set the mood — “put on something focus-y” — without the app.' },
  github:       { icon: '💻', why: 'Triage issues, summarize PRs, surface what needs your eyes.' },
  notion:       { icon: '📝', why: 'Search your workspace and answer questions across your notes.' },
  microsoft:    { icon: '🪟', why: 'Plug into Microsoft 365 — calendar, mail, documents.' },
  outlook:      { icon: '📧', why: 'Inbox triage, summarize threads, draft replies.' },
  discord:      { icon: '🎮', why: 'Catch up on servers and DMs without scrolling for hours.' },
  booking:      { icon: '🛎️', why: 'Pull up reservations and search for trips when you need them.' },
};

const FALLBACK_FLAVOR = { icon: '🔗', why: '' };

function flavorFor(id: string): { icon: string; why: string } {
  const k = (id || '').toLowerCase();
  if (SERVICE_FLAVOR[k]) return SERVICE_FLAVOR[k];
  // Try keyword match (e.g. "google_drive" → "google" if no exact)
  for (const key of Object.keys(SERVICE_FLAVOR)) {
    if (k.includes(key)) return SERVICE_FLAVOR[key];
  }
  return FALLBACK_FLAVOR;
}

function prettyName(id: string): string {
  if (!id) return 'Service';
  return id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function unwrapList(payload: any): RawService[] {
  if (!payload) return [];
  let data = payload;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch {}
  }
  if (data?.content?.[0]?.text) {
    try { data = JSON.parse(data.content[0].text); } catch {}
  }
  const arr =
    Array.isArray(data) ? data :
    Array.isArray(data?.services) ? data.services :
    Array.isArray(data?.items) ? data.items :
    Array.isArray(data?.connections) ? data.connections :
    Array.isArray(data?.results) ? data.results :
    [];
  return arr.map((s: any, i: number) => {
    const id = String(s.service_id ?? s.id ?? s.service ?? s.provider ?? s.key ?? `svc-${i}`);
    const acc = s.account && typeof s.account === 'object' ? s.account : null;
    return {
      id: id.toLowerCase(),
      name: String(s.name ?? s.label ?? s.title ?? id),
      authed: Boolean(
        s.authed ?? s.connected ?? s.isConnected ?? s.isAuthed ?? s.active ?? s.auth === true
      ),
      email: s.email ?? acc?.email,
      account: acc?.name ?? s.accountName ?? (typeof s.account === 'string' ? s.account : undefined),
      status: s.status ?? s.state ?? s.mode,
    };
  });
}

function ConnectionsPanel({ bridge, native, theme }: PluginProps) {
  const api = useApi(bridge);
  const closeMe = () => { try { bridge?.close?.(); } catch {} };
  const [rawServices, setRawServices] = useState<RawService[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; name: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [hintFor, setHintFor] = useState<{ id: string; name: string; prompt: string } | null>(null);

  const c: any = theme?.colors || {};
  const palette = {
    bg: c.bgPrimary || '#FAF6EE',
    surface: c.bgSecondary || '#F2EADC',
    surfaceMuted: c.bgTertiary || '#EDE2CF',
    border: c.border || 'rgba(26,20,16,0.06)',
    text: c.textPrimary || '#1a1410',
    textSoft: c.textSecondary || '#6b5a47',
    textMuted: c.textMuted || '#9a8870',
    accent: c.accent || '#FF7A28',
    accentSoft: c.accentSoft || 'rgba(255,122,40,0.10)',
    accentDeep: c.accentHover || '#E0680E',
    success: '#5A8A5C',
    danger: c.red || '#C15545',
  };

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // Use the connector wrapper (connections.list) not platform.auth.listServices
      // directly — /mcp doesn't expose platform.auth.*, but the connector that hosts
      // this plugin does (it imports the platform tool registry in-process).
      const raw = await api.call('connections.list', {}, 'personal-assistant-ui-mcp');
      console.log('[connections-panel] connections.list raw:', JSON.stringify(raw)?.slice(0, 600));
      const all = unwrapList(raw);
      console.log('[connections-panel] connections.list parsed:', all.length, 'services',
        all.filter(s => s.authed).map(s => `${s.id}=connected`).join(', '));
      setRawServices(all);
    } catch (e: any) {
      console.warn('[connections-panel] load failed:', e?.message || e);
      setErrorMsg('Couldn’t load your connections.');
      setRawServices([]);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  /** Rows = the curated SERVICE_FLAVOR list (so the user always sees what
   *  they CAN connect, even when the platform reports zero services for
   *  this tenant), with live state from `platform.auth.listServices`
   *  overlaid by id. Anything the platform reports but isn't in our
   *  flavor map gets appended at the bottom — nothing hidden. Connected
   *  services bubble to the top so they're easy to manage. */
  const rows = useMemo(() => {
    const liveById = new Map(rawServices.map(s => [s.id.toLowerCase(), s]));
    const out: Array<{
      id: string;
      name: string;
      icon: string;
      why?: string;
      authed: boolean;
      account?: string;
    }> = [];
    const seen = new Set<string>();
    for (const id of Object.keys(SERVICE_FLAVOR)) {
      const f = SERVICE_FLAVOR[id];
      const live = liveById.get(id);
      seen.add(id);
      out.push({
        id,
        name: live?.name && live.name !== live.id ? live.name : prettyName(id),
        icon: f.icon,
        why: f.why || undefined,
        authed: !!live?.authed,
        account: live?.email || live?.account,
      });
    }
    // Append any platform-reported services we didn't have flavor for,
    // so nothing the user has connected is hidden.
    for (const s of rawServices) {
      const k = s.id.toLowerCase();
      if (seen.has(k)) continue;
      out.push({
        id: s.id,
        name: s.name && s.name !== s.id ? s.name : prettyName(s.id),
        icon: '🔗',
        why: undefined,
        authed: !!s.authed,
        account: s.email || s.account,
      });
    }
    out.sort((a, b) => {
      if (a.authed !== b.authed) return a.authed ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return out;
  }, [rawServices]);

  const askDisconnect = (row: { id: string; name: string }) => {
    native?.haptics?.selection?.();
    setConfirmTarget({ id: row.id, name: row.name });
  };

  const doDisconnect = async () => {
    if (!confirmTarget) return;
    const target = confirmTarget;
    setConfirmTarget(null);
    setBusyId(target.id);
    try {
      await api.call('connections.disconnect', { service_id: target.id }, 'personal-assistant-ui-mcp');
      native?.haptics?.notification?.('success');
      // Optimistic flip; backend confirms on next refresh.
      setRawServices(prev => prev.map(x =>
        x.id.toLowerCase() === target.id.toLowerCase() ? { ...x, authed: false } : x
      ));
      setTimeout(() => { load(); }, 600);
    } catch (e: any) {
      console.warn('[connections-panel] disconnect failed:', e?.message || e);
      native?.haptics?.error?.();
      setErrorMsg(`Couldn’t disconnect ${target.name}.`);
    } finally {
      setBusyId(null);
    }
  };

  // Connect = approval modal → on confirm, host sends the chat message and
  // dismisses this surface. The orchestrator's existing handlers pick it up.
  const askConnect = (row: { id: string; name: string }) => {
    native?.haptics?.selection?.();
    setHintFor({ id: row.id, name: row.name, prompt: `connect my ${row.name}` });
  };

  const confirmConnect = () => {
    if (!hintFor) return;
    const text = hintFor.prompt;
    setHintFor(null);
    try {
      native?.haptics?.notification?.('success');
      // Use bridge.sendMessage (host shell control) — same channel as bridge.close().
      const sender = (bridge as any)?.sendMessage;
      if (typeof sender === 'function') {
        sender(text);
        closeMe(); // back to the chat screen so the user sees Ada working
      } else {
        console.warn('[connections-panel] bridge.sendMessage not available — host SDK out of date');
      }
    } catch (e) {
      native?.haptics?.error?.();
    }
  };

  // "Edit before sending" — pre-fills the chat composer instead of sending.
  const prepareConnect = () => {
    if (!hintFor) return;
    const text = hintFor.prompt;
    setHintFor(null);
    try {
      const prep = (bridge as any)?.prepareMessage;
      if (typeof prep === 'function') {
        prep(text);
      }
    } catch {}
    closeMe();
  };

  if (loading) {
    return (
      <View style={[s.container, { backgroundColor: palette.bg }]}>
        <ActivityIndicator color={palette.accent} style={{ marginTop: 60 }} />
      </View>
    );
  }

  const connectedCount = rows.filter(r => r.authed).length;

  return (
    <ScrollView style={[s.container, { backgroundColor: palette.bg }]} contentContainerStyle={{ paddingBottom: 32 }}>
      <Text style={[s.subtitle, { color: palette.textMuted }]}>
        I'm sharper when I can see your stuff ✨{'  '}·{'  '}
        <Text style={{ color: palette.text, fontWeight: '600' }}>
          {connectedCount} of {rows.length}
        </Text>
        {' connected'}
      </Text>

      {errorMsg ? (
        <Text style={[s.errorText, { color: palette.danger }]}>{errorMsg}</Text>
      ) : null}

      {rows.map(row => {
        const busy = busyId === row.id;
        return (
          <View key={row.id} style={[s.card, { backgroundColor: palette.surface }]}>
            <View style={s.cardRow}>
              <Text style={s.icon}>{row.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[s.name, { color: palette.text }]}>{row.name}</Text>
                {row.authed ? (
                  <>
                    <View style={s.statusRow}>
                      <View style={[s.statusDot, { backgroundColor: palette.success }]} />
                      <Text style={[s.statusText, { color: palette.success }]}>Connected</Text>
                    </View>
                    {row.account ? (
                      <Text style={[s.detail, { color: palette.textMuted }]} numberOfLines={1}>
                        {row.account}
                      </Text>
                    ) : null}
                  </>
                ) : (
                  <>
                    {row.why ? (
                      <Text style={[s.why, { color: palette.textSoft }]} numberOfLines={3}>
                        {row.why}
                      </Text>
                    ) : null}
                    <View style={s.statusRow}>
                      <View style={[s.statusDot, { backgroundColor: palette.textMuted }]} />
                      <Text style={[s.statusText, { color: palette.textMuted }]}>Not connected</Text>
                    </View>
                  </>
                )}
              </View>
              <Pressable
                onPress={() => row.authed ? askDisconnect(row) : askConnect(row)}
                disabled={busy}
                style={[s.btn, {
                  backgroundColor: row.authed ? 'transparent' : palette.accent,
                  borderColor: row.authed ? palette.border : palette.accent,
                  opacity: busy ? 0.5 : 1,
                }]}
              >
                {busy ? (
                  <ActivityIndicator color={row.authed ? palette.danger : '#fff'} size="small" />
                ) : (
                  <Text style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: row.authed ? palette.danger : '#fff',
                  }}>
                    {row.authed ? 'Disconnect' : 'Connect'}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        );
      })}

      {/* Connect approval modal: send the message OR edit it first. */}
      <Modal visible={!!hintFor} transparent animationType="fade" onRequestClose={() => setHintFor(null)}>
        <View style={s.overlay}>
          <View style={[s.confirmBox, { backgroundColor: palette.surface }]}>
            <Text style={[s.confirmTitle, { color: palette.text }]}>
              Connect {hintFor?.name || ''}?
            </Text>
            <Text style={[s.confirmBody, { color: palette.textSoft }]}>
              I’ll send this for you and walk you through the rest:
            </Text>
            <View style={[s.promptBox, { backgroundColor: palette.accentSoft }]}>
              <Text style={[s.promptText, { color: palette.accentDeep }]}>
                “{hintFor?.prompt || ''}”
              </Text>
            </View>
            <View style={s.threeBtnRow}>
              <Pressable
                onPress={() => setHintFor(null)}
                style={[s.smallBtn, { backgroundColor: palette.surfaceMuted }]}
              >
                <Text style={{ color: palette.textSoft, fontSize: 13, fontWeight: '500' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={prepareConnect}
                style={[s.smallBtn, { backgroundColor: palette.surfaceMuted }]}
              >
                <Text style={{ color: palette.text, fontSize: 13, fontWeight: '500' }}>Edit first</Text>
              </Pressable>
              <Pressable
                onPress={confirmConnect}
                style={[s.smallBtn, { backgroundColor: palette.accent }]}
              >
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>Send</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Disconnect confirm modal */}
      <Modal visible={!!confirmTarget} transparent animationType="fade" onRequestClose={() => setConfirmTarget(null)}>
        <View style={s.overlay}>
          <View style={[s.confirmBox, { backgroundColor: palette.surface }]}>
            <Text style={[s.confirmTitle, { color: palette.text }]}>Disconnect?</Text>
            <Text style={[s.confirmBody, { color: palette.textMuted }]}>
              I won’t be able to use{' '}
              <Text style={{ fontWeight: '600', color: palette.text }}>
                {confirmTarget?.name || ''}
              </Text>
              {' '}until you reconnect.
            </Text>
            <View style={s.confirmBtns}>
              <Pressable
                onPress={() => setConfirmTarget(null)}
                style={[s.cancelBtn, { backgroundColor: palette.surfaceMuted }]}
              >
                <Text style={{ color: palette.text, fontSize: 14, fontWeight: '500' }}>Keep connected</Text>
              </Pressable>
              <Pressable
                onPress={doDisconnect}
                style={[s.dangerBtn, { backgroundColor: palette.danger }]}
              >
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Disconnect</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

export default {
  id: 'connections-panel',
  type: 'ui',
  version: '1.0.0',
  Component: ConnectionsPanel,
};

const s = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 4 },
  subtitle: { fontSize: 13, marginBottom: 14, marginLeft: 4, lineHeight: 18 },
  errorText: { fontSize: 13, marginBottom: 12, marginLeft: 4 },
  card: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 10 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { fontSize: 28, marginTop: 2 },
  name: { fontSize: 15, fontWeight: '600', letterSpacing: -0.2 },
  why: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  detail: { fontSize: 12, marginTop: 4 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  statusDot: { width: 7, height: 7, borderRadius: 3.5, marginRight: 6 },
  statusText: { fontSize: 11, fontWeight: '500' },
  btn: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, borderWidth: 1,
    minWidth: 92, alignItems: 'center',
  },
  // Modals
  overlay: { flex: 1, backgroundColor: 'rgba(26,20,16,0.55)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  confirmBox: { borderRadius: 20, padding: 22, width: '100%', maxWidth: 360 },
  confirmTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  confirmBody: { fontSize: 14, lineHeight: 20 },
  confirmBtns: { flexDirection: 'row', gap: 10, marginTop: 18 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  dangerBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  fullBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  promptBox: { borderRadius: 10, padding: 14, marginTop: 12 },
  promptText: { fontSize: 15, fontWeight: '600', textAlign: 'center', fontStyle: 'italic' },
  threeBtnRow: { flexDirection: 'row', gap: 8, marginTop: 18 },
  smallBtn: { flex: 1, paddingVertical: 11, borderRadius: 12, alignItems: 'center' },
});
