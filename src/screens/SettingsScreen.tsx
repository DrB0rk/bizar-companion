import { View, Text, StyleSheet, Alert, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/colors';
import { usePairing } from '../store/pairing';
import { Button } from '../components/Button';
import { Card } from '../components/Card';

export default function SettingsScreen() {
  const theme = useTheme();
  const { pairing, unpair } = usePairing();

  const confirmUnpair = () => {
    Alert.alert(
      'Unpair?',
      'You will need to scan a new QR code to reconnect to the dashboard.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Unpair', style: 'destructive', onPress: () => unpair() },
      ],
    );
  };

  if (!pairing) return null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Card title="Paired to">
          <Text style={[styles.url, { color: theme.text }]} selectable>
            {pairing.url}
          </Text>
          <Text style={[styles.sub, { color: theme.textMuted }]}>
            since {new Date(pairing.pairedAt).toLocaleString()}
          </Text>
        </Card>

        <Card title="Token">
          <Text style={[styles.token, { color: theme.textMuted }]} selectable>
            {pairing.token.slice(0, 16)}…{pairing.token.slice(-6)}
          </Text>
          <Text style={[styles.sub, { color: theme.textMuted }]}>
            Stored securely on this device (expo-secure-store).
          </Text>
        </Card>

        <Button
          title="Unpair device"
          variant="danger"
          onPress={confirmUnpair}
          style={{ marginTop: 12 }}
        />

        <Text style={[styles.footer, { color: theme.textMuted }]}>
          Bizar Companion · v1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  url: { fontSize: 16, fontWeight: '500' },
  sub: { fontSize: 12, marginTop: 6 },
  token: { fontFamily: Platform.select({ android: 'monospace', ios: 'Menlo', default: 'monospace' }), fontSize: 13 },
  footer: { textAlign: 'center', fontSize: 11, marginTop: 32 },
});