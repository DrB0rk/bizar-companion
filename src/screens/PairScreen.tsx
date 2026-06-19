import { useState } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePairing } from '../store/pairing';
import { useTheme } from '../theme/colors';

export default function PairScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const { pair } = usePairing();
  const [scanned, setScanned] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const theme = useTheme();

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

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || verifying) return;
    setScanned(true);

    let serverUrl: string | null = null;
    let token: string | null = null;

    try {
      // Accept either a `bizar://pair?url=...&token=...` URI or a plain URL
      // containing those query params (some QR scanners strip the scheme).
      const candidate = data.startsWith('bizar://') ? data : `bizar://${data.replace(/^[a-z]+:\/\//i, '')}`;
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

    // Verify the token before committing to secure storage.
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
      await pair({
        url: serverUrl,
        token,
        pairedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      Alert.alert('Pairing failed', err?.message || 'Could not verify token');
      setScanned(false);
      setVerifying(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
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
          Align the QR within the frame. Token is stored securely on this device.
        </Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { paddingHorizontal: 20 },
  header: { paddingTop: 24 },
  title: { fontSize: 26, fontWeight: '700' },
  subtitle: { fontSize: 14, marginTop: 8, lineHeight: 20 },
  cameraWrap: { flex: 1, marginVertical: 16, marginHorizontal: 20, borderRadius: 16, overflow: 'hidden' },
  camera: { flex: 1 },
  verifyingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyingText: { color: '#fff', marginTop: 12, fontSize: 14 },
  button: { padding: 14, borderRadius: 10, alignItems: 'center', marginHorizontal: 20 },
  buttonText: { color: 'white', fontWeight: '600', fontSize: 15 },
  hint: { fontSize: 12, textAlign: 'center', marginBottom: 12 },
});