import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronRight, Book, Github, Bug } from 'lucide-react-native';
import { useTheme } from '../theme/colors';
import { usePairing } from '../store/pairing';
import { Card } from '../components/Card';
import { APP_VERSION } from '../config/version';

const LINKS: Array<{ title: string; desc: string; url: string; icon: 'book' | 'code' | 'bug' }> = [
  {
    title: 'BizarHarness docs',
    desc: 'Full architecture and contributor guide',
    url: 'https://github.com/DrB0rk/BizarHarness',
    icon: 'book',
  },
  {
    title: 'Report an issue',
    desc: 'GitHub issues for the Companion app',
    url: 'https://github.com/DrB0rk/bizar-companion/issues',
    icon: 'bug',
  },
  {
    title: 'Source code',
    desc: 'View the repo on GitHub',
    url: 'https://github.com/DrB0rk/bizar-companion',
    icon: 'code',
  },
];

const FEATURES_SHIPPED = [
  { name: 'Pairing', status: '✓ Shipped' },
  { name: 'Activity feed', status: '✓ Shipped' },
  { name: 'Streaming chat', status: '✓ Shipped' },
  { name: 'Task board', status: '✓ Shipped' },
  { name: 'Background agents', status: '✓ Shipped (v1.2)' },
  { name: 'Notifications', status: '✓ Shipped (v1.2)' },
  { name: 'Voice notes', status: '✓ Read-only (v1.2)' },
  { name: 'Memory search', status: '✓ Shipped (v1.2)' },
  { name: 'Artifact browser', status: '✓ Shipped (v1.2)' },
  { name: 'Push notifications', status: '— planned' },
];

const ICONS = {
  book: Book,
  code: Github,
  bug: Bug,
};

export default function MoreScreen() {
  const theme = useTheme();
  const { url } = usePairing();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <View style={{ padding: 16 }}>
        <Card title="About">
          <Text style={[styles.line, { color: theme.text }]}>
            Build: <Text style={{ color: theme.accent }}>{APP_VERSION}</Text>
          </Text>
          {url && (
            <Text style={[styles.line, { color: theme.text }]}>
              Server: <Text style={{ color: theme.textMuted }} numberOfLines={1}>{url}</Text>
            </Text>
          )}
          <Text style={[styles.line, { color: theme.textMuted, marginTop: 8, fontSize: 12 }]}>
            v1.2 adds Notifications, Background Agents, Memory search, and a typed API client.
          </Text>
        </Card>

        <Text style={[styles.heading, { color: theme.text }]}>Links</Text>
        {LINKS.map((l) => {
          const Icon = ICONS[l.icon];
          return (
            <TouchableOpacity
              key={l.title}
              onPress={() => Linking.openURL(l.url).catch(() => {})}
              style={[styles.linkRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <Icon size={20} color={theme.accent} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.linkTitle, { color: theme.text }]}>{l.title}</Text>
                <Text style={[styles.linkDesc, { color: theme.textMuted }]}>{l.desc}</Text>
              </View>
              <ChevronRight size={18} color={theme.textMuted} />
            </TouchableOpacity>
          );
        })}

        <Text style={[styles.heading, { color: theme.text, marginTop: 16 }]}>Features</Text>
        {FEATURES_SHIPPED.map((f) => (
          <View key={f.name} style={styles.featureRow}>
            <Text style={[styles.featureName, { color: theme.text }]}>{f.name}</Text>
            <Text
              style={[
                styles.featureStatus,
                { color: f.status.startsWith('✓') ? theme.success : theme.textMuted },
              ]}
            >
              {f.status}
            </Text>
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  heading: { fontSize: 20, fontWeight: '700', marginBottom: 8, marginTop: 8 },
  line: { fontSize: 14, marginBottom: 4 },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  linkTitle: { fontSize: 14, fontWeight: '600' },
  linkDesc: { fontSize: 12, marginTop: 2 },
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  featureName: { fontSize: 13 },
  featureStatus: { fontSize: 12, fontWeight: '600' },
});
