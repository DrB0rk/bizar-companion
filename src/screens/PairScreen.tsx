import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { usePairing } from '../store/pairing';
import { useTheme } from '../theme/colors';
import { Button } from '../components/Button';
import type { PairVerifyResponse } from '../api/types';

type RootStackParamList = {
  Pair: undefined;
  SecretEntry: { url: string };
  Main: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function PairScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { pairUrl } = usePairing();

  const [tab, setTab] = useState<'scan' | 'manual'>('scan');
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Manual URL state
  const [manualUrl, setManualUrl] = useState('');
  const [manualLoading, setManualLoading] = useState(false);

  // ---- Camera flow ----
  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || verifying) return;
    setScanned(true);

    let serverUrl: string | null = null;
    let token: string | null = null;

    try {
      const candidate = data.startsWith('bizar://')
        ? data
        : `bizar://${data.replace(/^[a-z]+:\/\//i, '')}`;
      const url = new URL(candidate);
      if (url.protocol !== 'bizar:' || url.hostname !== 'pair') {
        throw new Error('Not a Bizar QR code');
      }
      serverUrl = url.searchParams.get('url');
      token = url.searchParams.get('token');
      if (!serverUrl || !token) throw new Error('QR is missing url or token');
    } catch (err: any) {
      Alert.alert('Invalid QR code', err?.message || 'Could not parse code');
      setScanned(false);
      return;
    }

    setVerifying(true);
    try {
      const verifyUrl = `${serverUrl.replace(/\/$/, '')}/api/pair/verify`;
      const r = await fetch(verifyUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) {
        const text = await r.text().catch(() => '');
        throw new Error(text || `Server returned ${r.status}`);
      }
      const data = (await r.json()) as PairVerifyResponse;
      if (!data.valid) throw new Error('Pair token is not valid');

      // Discard the pair token — we only need the URL.
      // Secret will be collected on the next screen.
      await pairUrl(serverUrl!);
      navigation.navigate('SecretEntry', { url: serverUrl! });
    } catch (err: any) {
      Alert.alert('Pairing failed', err?.message || 'Could not verify token');
      setScanned(false);
    } finally {
      setVerifying(false);
    }
  };

  // ---- Manual URL flow ----
  const handleManualContinue = async () => {
    const trimmed = manualUrl.trim();
    if (!trimmed) return;
    // Basic URL validation
    try {
      new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    } catch {
      Alert.alert('Invalid URL', 'Please enter a valid dashboard URL.');
      return;
    }
    setManualLoading(true);
    try {
      const normalized =
        trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
      await pairUrl(normalized);
      navigation.navigate('SecretEntry', { url: normalized });
    } finally {
      setManualLoading(false);
    }
  };

  // ---- Permission states ----
  if (!permission) {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>Bizar Companion</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            Camera permission needed to scan QR codes
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.accent }]}
          onPress={requestPermission}
        >
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Tab switcher */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, tab === 'scan' && { borderBottomColor: theme.accent, borderBottomWidth: 2 }]}
            onPress={() => setTab('scan')}
          >
            <Text style={[styles.tabText, { color: tab === 'scan' ? theme.accent : theme.textMuted }]}>
              Scan QR
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'manual' && { borderBottomColor: theme.accent, borderBottomWidth: 2 }]}
            onPress={() => setTab('manual')}
          >
            <Text style={[styles.tabText, { color: tab === 'manual' ? theme.accent : theme.textMuted }]}>
              Manual
            </Text>
          </TouchableOpacity>
        </View>

        {tab === 'scan' ? (
          <>
            <SafeAreaView style={styles.safe} edges={['top']}>
              <Text style={[styles.title, { color: theme.text }]}>Scan QR Code</Text>
              <Text style={[styles.subtitle, { color: theme.textMuted }]}>
                Open Bizar dashboard → Settings → Pair Device
              </Text>
            </SafeAreaView>
            <View style={styles.cameraWrap}>
              <CameraView
                style={styles.camera}
                facing="back"
                onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              />
              {verifying && (
                <View style={styles.verifyingOverlay}>
                  <ActivityIndicator color="#fff" size="large" />
                  <Text style={styles.verifyingText}>Verifying…</Text>
                </View>
              )}
            </View>
            <SafeAreaView style={styles.safe} edges={['bottom']}>
              <Text style={[styles.hint, { color: theme.textMuted }]}>
                Align the QR within the frame.
              </Text>
            </SafeAreaView>
          </>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.manualContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={[styles.title, { color: theme.text }]}>Enter URL manually</Text>
            <Text style={[styles.subtitle, { color: theme.textMuted }]}>
              Open the Bizar dashboard and copy the URL from your browser's address bar.
            </Text>
            <TextInput
              style={[
                styles.urlInput,
                { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border },
              ]}
              value={manualUrl}
              onChangeText={setManualUrl}
              placeholder="https://your-dashboard.example.com"
              placeholderTextColor={theme.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <Button
              title="Continue"
              onPress={handleManualContinue}
              loading={manualLoading}
              disabled={!manualUrl.trim()}
              style={{ marginTop: 12 }}
            />
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { paddingHorizontal: 20, paddingTop: 16 },
  header: { paddingTop: 24, paddingHorizontal: 20 },
  title: { fontSize: 26, fontWeight: '700' },
  subtitle: { fontSize: 14, marginTop: 8, lineHeight: 20 },
  tabRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabText: { fontSize: 15, fontWeight: '600' },
  cameraWrap: { flex: 1, marginVertical: 16, marginHorizontal: 20, borderRadius: 16, overflow: 'hidden' },
  camera: { flex: 1 },
  verifyingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyingText: { color: '#fff', marginTop: 12, fontSize: 14 },
  button: { padding: 14, borderRadius: 10, alignItems: 'center', marginHorizontal: 20, marginTop: 16 },
  buttonText: { color: 'white', fontWeight: '600', fontSize: 15 },
  hint: { fontSize: 12, textAlign: 'center', marginBottom: 12 },
  manualContent: { padding: 20, flexGrow: 1 },
  urlInput: {
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 16,
  },
});
