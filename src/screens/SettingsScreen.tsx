/**
 * SettingsScreen — pairing info, connection status, dashboard health.
 *
 * v1.2.0-beta.1 — added:
 *  - Dashboard version badge (auto-detected on first /api/overview hit)
 *  - Live WS connection state (connecting / connected / reconnecting / failed)
 *  - Pairing timestamp + device name display
 */

import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle2, XCircle, RefreshCw, Wifi, WifiOff } from 'lucide-react-native';
import { useTheme } from '../theme/colors';
import { usePairing } from '../store/pairing';
import { api } from '../api/client';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { onWsStateChange, getWsState, WsState } from '../api/ws';
import type { AuthStatus } from '../api/types';

const VERSION = '1.2.0-beta.1';

export default function SettingsScreen() {
  const theme = useTheme();
  const { url, secret, pairedAt, deviceName, dashboardVersion, setDashboardVersion, clear } = usePairing();
  const [testing, setTesting] = useState(false);
  const [reachable, setReachable] = useState<boolean | null>(null);
  const [authValid, setAuthValid] = useState<boolean | null>(null);
  const [isTailscale, setIsTailscale] = useState(false);
  const [wsState, setWsState] = useState<WsState>(getWsState());

  useEffect(() => {
    return onWsStateChange((s) => setWsState(s));
  }, []);

  const confirmUnpair = () => {
    Alert.alert('Unpair?', 'You will need to set up the connection again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Unpair', style: 'destructive', onPress: () => clear() },
    ]);
  };

  const testConnection = async () => {
    if (!url || !secret) return;
    setTesting(true);
    setReachable(null);
    setAuthValid(null);
    setIsTailscale(false);

    try {
      let reach = false;
      try {
        const status = await api.authStatus();
        reach = true;
        setIsTailscale(status.peer.startsWith('100.'));
      } catch {
        /* unreachable */
      }
      setReachable(reach);

      // Authenticated check
      let auth = false;
      try {
        await api.chat.sessions();
        auth = true;
      } catch {
        /* auth failed */
      }
      setAuthValid(auth);

      // Detect dashboard version (best-effort)
      if (reach && auth) {
        try {
          const overview = await api.overview();
          if (overview?.dashboardVersion) {
            await setDashboardVersion(overview.dashboardVersion);
          }
        } catch {
          /* ignore — older dashboards may not have /api/overview */
        }
      }
    } finally {
      setTesting(false);
    }
  };

  const renderWsBadge = (state: WsState) => {
    const color =
      state.connection === 'connected'
        ? theme.success
        : state.connection === 'reconnecting' || state.connection === 'connecting'
        ? theme.warning
        : theme.error;
    const icon =
      state.connection === 'connected' ? (
        <Wifi size={14} color={color} />
      ) : (
        <WifiOff size={14} color={color} />
      );
    const label =
      state.connection === 'connected'
        ? 'Connected'
        : state.connection === 'reconnecting'
        ? `Reconnecting… (#${state.attempt})`
        : state.connection === 'connecting'
        ? 'Connecting…'
        : state.connection === 'failed'
        ? 'Failed'
        : 'Closed';
    return (
      <View style={[styles.badge, { backgroundColor: theme.surface, borderColor: color }]}>
        {icon}
        <Text style={[styles.badgeText, { color }]}>WebSocket: {label}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={[styles.title, { color: theme.text }]}>Settings</Text>

        <Card title="Connection">
          <Text style={[styles.line, { color: theme.textMuted }]}>
            Dashboard URL
          </Text>
          {url ? (
            <Text style={[styles.line, styles.url, { color: theme.text }]} numberOfLines={1}>
              {url}
            </Text>
          ) : (
            <Text style={[styles.line, { color: theme.error }]}>Not paired</Text>
          )}

          <Text style={[styles.line, { color: theme.textMuted, marginTop: 12 }]}>WebSocket</Text>
          {renderWsBadge(wsState)}

          <View style={styles.buttonRow}>
            <Button
              title={testing ? 'Testing…' : 'Test Connection'}
              onPress={testConnection}
              loading={testing}
              variant="secondary"
              style={{ flex: 1 }}
            />
          </View>

          {reachable !== null && (
            <View style={styles.testRow}>
              {reachable ? (
                <CheckCircle2 size={14} color={theme.success} />
              ) : (
                <XCircle size={14} color={theme.error} />
              )}
              <Text style={[styles.testText, { color: reachable ? theme.success : theme.error }]}>
                {reachable ? 'Reachable' : 'Not reachable'}
              </Text>
              {reachable && isTailscale && (
                <Text style={[styles.testText, { color: theme.accent }]}> · Tailscale</Text>
              )}
            </View>
          )}
          {authValid !== null && (
            <View style={styles.testRow}>
              {authValid ? (
                <CheckCircle2 size={14} color={theme.success} />
              ) : (
                <XCircle size={14} color={theme.error} />
              )}
              <Text style={[styles.testText, { color: authValid ? theme.success : theme.error }]}>
                {authValid ? 'Auth valid' : 'Auth failed'}
              </Text>
            </View>
          )}
        </Card>

        <Card title="Pairing">
          <Info label="Paired at" value={pairedAt ? new Date(pairedAt).toLocaleString() : '—'} />
          <Info label="Device" value={deviceName ?? '—'} />
          <Info
            label="Dashboard version"
            value={dashboardVersion ?? '(unknown — tap Test Connection)'}
          />
          <Button title="Unpair" variant="danger" onPress={confirmUnpair} style={{ marginTop: 12 }} />
        </Card>

        <Card title="About">
          <Info label="Build" value={VERSION} />
          <Info label="Min dashboard" value="5.6.0" />
        </Card>

        <View style={{ marginTop: 12 }}>
          <Text style={[styles.footer, { color: theme.textMuted }]}>
            v1.2.0-beta.1 — Agent-browser + Notifications + Background tabs
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { color: theme.textMuted }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: theme.text }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 12 },
  line: { fontSize: 14, marginBottom: 4 },
  url: { fontFamily: Platform.select({ android: 'monospace', ios: 'Menlo', default: 'monospace' }) },
  buttonRow: { flexDirection: 'row', marginTop: 12, gap: 8 },
  testRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 },
  testText: { fontSize: 12, fontWeight: '600' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  badgeText: { fontSize: 12, fontWeight: '600' },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  infoLabel: { fontSize: 13, flexShrink: 0 },
  infoValue: { fontSize: 13, marginLeft: 12, flexShrink: 1, textAlign: 'right' },
  footer: { fontSize: 11, textAlign: 'center' },
});
