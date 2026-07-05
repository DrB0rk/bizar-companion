import { useState } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/colors';
import { usePairing } from '../store/pairing';
import { apiGet } from '../api/client';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import type { AuthStatus, ChatListResponse } from '../api/types';

const VERSION = '1.1.0-beta.1';

export default function SettingsScreen() {
  const theme = useTheme();
  const { url, secret, pairedAt, clear } = usePairing();
  const [testing, setTesting] = useState(false);
  const [reachable, setReachable] = useState<boolean | null>(null);
  const [authValid, setAuthValid] = useState<boolean | null>(null);
  const [isTailscale, setIsTailscale] = useState(false);

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
      // Unauthenticated health check
      let reach = false;
      try {
        const r = await fetch(`${url.replace(/\/$/, '')}/api/auth/status`);
        reach = r.ok;
        if (reach) {
          const status = (await r.json()) as AuthStatus;
          setIsTailscale(status.peer.startsWith('100.'));
        }
      } catch {
        /* unreachable */
      }
      setReachable(reach);

      // Authenticated check
      let auth = false;
      try {
        const r = await apiGet<ChatListResponse>('/api/chat/sessions');
        auth = true;
      } catch {
        /* auth failed */
      }
      setAuthValid(auth);
    } finally {
      setTesting(false);
    }
  };

  if (!url) return null;

  const partialSecret = secret
    ? `${secret.slice(0, 12)}…${secret.slice(-6)}`
    : '—';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Card title="Paired to">
          <Text style={[styles.url, { color: theme.text }]} selectable>
            {url}
          </Text>
          {isTailscale && (
            <View style={[styles.tailscalePill, { backgroundColor: theme.success }]}>
              <Text style={styles.tailscaleText}>Tailscale</Text>
            </View>
          )}
          {pairedAt && (
            <Text style={[styles.sub, { color: theme.textMuted }]}>
              since {new Date(pairedAt).toLocaleString()}
            </Text>
          )}
        </Card>

        <Card title="Auth token">
          <Text style={[styles.token, { color: theme.textMuted }]} selectable>
            {partialSecret}
          </Text>
          <Text style={[styles.sub, { color: theme.textMuted }]}>
            Stored securely on this device (expo-secure-store).
          </Text>
        </Card>

        <Card title="Connection test">
          {testing ? (
            <ActivityIndicator color={theme.accent} />
          ) : (
            <>
              <Text style={[styles.testLine, { color: theme.text }]}>
                Reachable:{' '}
                <Text
                  style={{
                    color:
                      reachable === true
                        ? theme.success
                        : reachable === false
                        ? theme.error
                        : theme.textMuted,
                  }}
                >
                  {reachable === null ? '—' : reachable ? 'yes' : 'no'}
                </Text>
              </Text>
              <Text style={[styles.testLine, { color: theme.text }]}>
                Auth:{' '}
                <Text
                  style={{
                    color:
                      authValid === true
                        ? theme.success
                        : authValid === false
                        ? theme.error
                        : theme.textMuted,
                  }}
                >
                  {authValid === null ? '—' : authValid ? 'valid' : 'invalid'}
                </Text>
              </Text>
            </>
          )}
        </Card>

        <Button
          title="Test connection"
          variant="secondary"
          onPress={testConnection}
          loading={testing}
          style={{ marginTop: 4 }}
        />

        <Button
          title="Unpair device"
          variant="danger"
          onPress={confirmUnpair}
          style={{ marginTop: 12 }}
        />

        <Text style={[styles.footer, { color: theme.textMuted }]}>
          Bizar Companion · v{VERSION}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  url: { fontSize: 16, fontWeight: '500' },
  sub: { fontSize: 12, marginTop: 6 },
  token: {
    fontFamily: Platform.select({ android: 'monospace', ios: 'Menlo', default: 'monospace' }),
    fontSize: 13,
  },
  tailscalePill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, marginTop: 8 },
  tailscaleText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  testLine: { fontSize: 14, marginBottom: 4 },
  footer: { textAlign: 'center', fontSize: 11, marginTop: 32 },
});
