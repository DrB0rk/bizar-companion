import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { usePairing } from '../store/pairing';
import { apiGet } from '../api/client';
import { useTheme } from '../theme/colors';
import { Button } from '../components/Button';
import type { AuthStatus, ChatListResponse } from '../api/types';

type RootStackParamList = {
  Pair: undefined;
  SecretEntry: { url: string };
  Main: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type SecretEntryRouteProp = RouteProp<RootStackParamList, 'SecretEntry'>;

export default function SecretEntryScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<SecretEntryRouteProp>();
  const { complete } = usePairing();

  const [secret, setSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const url = route.params.url;

  const handleConnect = async () => {
    if (!secret.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      // Step 1: Confirm URL is reachable (unauthenticated endpoint)
      let reachable = false;
      try {
        const statusRes = await fetch(`${url.replace(/\/$/, '')}/api/auth/status`);
        reachable = statusRes.ok;
      } catch {
        // network error
      }
      if (!reachable) {
        setError('Cannot reach the dashboard at this URL. Check the URL and your connection.');
        setLoading(false);
        return;
      }

      // Step 2: Confirm the secret works (authenticated endpoint)
      let authValid = false;
      try {
        const sessionsRes = await fetch(`${url.replace(/\/$/, '')}/api/chat/sessions`, {
          headers: { Authorization: `Bearer ${secret.trim()}` },
        });
        authValid = sessionsRes.ok;
      } catch {
        // network error
      }
      if (!authValid) {
        setError('The token was rejected. Make sure you pasted the correct secret from Dashboard → Settings → API.');
        setLoading(false);
        return;
      }

      // Step 3: Persist the pairing
      await complete(secret.trim());

      // Step 4: Navigate to Main (RootNav will detect isPaired = true and switch)
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } catch (err: any) {
      setError(err?.message || 'Connection failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.title, { color: theme.text }]}>Connect to Dashboard</Text>
          <Text style={[styles.connectedTo, { color: theme.textMuted }]}>
            Server:{' '}
            <Text style={{ color: theme.accent }} selectable>
              {url}
            </Text>
          </Text>

          <Text style={[styles.label, { color: theme.text }]}>
            Paste the dashboard auth token
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.surface,
                color: theme.text,
                borderColor: error ? theme.error : theme.border,
              },
            ]}
            value={secret}
            onChangeText={(t) => {
              setSecret(t);
              if (error) setError(null);
            }}
            placeholder="Bearer token from Settings → API"
            placeholderTextColor={theme.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
          {error && (
            <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
          )}

          <TouchableOpacity
            style={styles.helpLink}
            onPress={() =>
              Linking.openURL('https://github.com/polderlabs/bizar-companion#finding-your-auth-token')
            }
          >
            <Text style={[styles.helpText, { color: theme.accent }]}>
              Where do I find this token?
            </Text>
          </TouchableOpacity>

          <Button
            title="Connect"
            onPress={handleConnect}
            loading={loading}
            disabled={!secret.trim()}
            style={{ marginTop: 24 }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, flexGrow: 1 },
  title: { fontSize: 26, fontWeight: '700', marginBottom: 4 },
  connectedTo: { fontSize: 13, marginBottom: 32 },
  label: { fontSize: 15, fontWeight: '600', marginBottom: 10 },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 15,
  },
  errorText: { fontSize: 13, marginTop: 8 },
  helpLink: { marginTop: 12 },
  helpText: { fontSize: 13, textDecorationLine: 'underline' },
});
