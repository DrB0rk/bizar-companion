import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/colors';
import { usePairing } from '../store/pairing';
import { Card } from '../components/Card';

const FUTURE = [
  { title: 'Notifications', desc: 'Push notifications when tasks complete.' },
  { title: 'Voice', desc: 'Talk to the agent from the lock screen.' },
  { title: 'Files', desc: 'Browse dashboard-stored files and mod outputs.' },
  { title: 'Agent switcher', desc: 'Route chats to any of the 13 Norse agents.' },
];

export default function MoreScreen() {
  const theme = useTheme();
  const { url } = usePairing();
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <View style={{ padding: 16 }}>
        <Card title="About">
          <Text style={[styles.line, { color: theme.text }]}>
            Build: <Text style={{ color: theme.accent }}>1.1.0-beta.1</Text>
          </Text>
          {url && (
            <Text style={[styles.line, { color: theme.text }]}>
              Server: <Text style={{ color: theme.textMuted }} numberOfLines={1}>{url}</Text>
            </Text>
          )}
        </Card>

        <Text style={[styles.heading, { color: theme.text }]}>Coming soon</Text>
        <Text style={[styles.subhead, { color: theme.textMuted }]}>
          v1.0 ships the pairing flow + Activity, Chat, Tasks, and Settings.
          The next sprints will add:
        </Text>
        {FUTURE.map((f) => (
          <Card key={f.title} title={f.title}>
            <Text style={{ color: theme.text, fontSize: 14, lineHeight: 20 }}>{f.desc}</Text>
          </Card>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  heading: { fontSize: 24, fontWeight: '700', marginBottom: 4 },
  subhead: { fontSize: 13, marginBottom: 16, lineHeight: 19 },
  line: { fontSize: 14, marginBottom: 4 },
});
