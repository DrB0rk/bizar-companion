import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/colors';
import { usePairing } from '../store/pairing';
import { apiGet } from '../api/client';
import type { Activity as ActivityItem } from '../api/types';

export default function ActivityScreen() {
  const theme = useTheme();
  const { pairing } = usePairing();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await apiGet<{ events?: ActivityItem[]; activity?: ActivityItem[] }>(
        '/api/activity?limit=50',
      );
      const list = data.events || data.activity || (Array.isArray(data) ? (data as ActivityItem[]) : []);
      setItems(list);
    } catch (err: any) {
      setError(err?.message || 'Failed to load activity');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!pairing) return;
    load();
  }, [pairing, load]);

  if (!pairing) return null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.accent} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(_item, idx) => String(idx)}
          renderItem={({ item }) => (
            <View
              style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <Text style={[styles.kind, { color: theme.accent }]}>{item.kind || 'event'}</Text>
              <Text style={[styles.message, { color: theme.text }]} numberOfLines={3}>
                {item.message || JSON.stringify(item)}
              </Text>
              {item.ts && (
                <Text style={[styles.ts, { color: theme.textMuted }]}>
                  {new Date(item.ts).toLocaleString()}
                </Text>
              )}
            </View>
          )}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={theme.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={{ color: theme.textMuted }}>
                {error || 'No activity yet.'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { padding: 40, alignItems: 'center' },
  row: { padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 8 },
  kind: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  message: { fontSize: 14, lineHeight: 20 },
  ts: { fontSize: 11, marginTop: 6 },
});