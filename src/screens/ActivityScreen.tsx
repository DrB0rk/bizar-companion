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
import { useWsEvent } from '../hooks/useWsEvent';
import type { Activity, ActivityListResponse } from '../api/types';

export default function ActivityScreen() {
  const theme = useTheme();
  const { isPaired } = usePairing();
  const [items, setItems] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isPaired) return;
    try {
      setError(null);
      const data = await apiGet<ActivityListResponse>('/api/activity');
      setItems(data.items ?? []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load activity');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isPaired]);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh on relevant WS events
  useWsEvent('tasks:change', () => load());
  useWsEvent('pair:change', () => load());
  useWsEvent('settings:change', () => load());

  if (!isPaired) return null;

  const renderItem = ({ item }: { item: Activity }) => {
    const progress = (item as { metadata?: { progress?: number } }).metadata?.progress;
    return (
      <View
        style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}
      >
        <Text style={[styles.kind, { color: theme.accent }]}>{item.kind}</Text>
        <Text style={[styles.message, { color: theme.text }]} numberOfLines={3}>
          {item.message || JSON.stringify(item)}
        </Text>
        {item.ts && (
          <Text style={[styles.ts, { color: theme.textMuted }]}>
            {new Date(item.ts).toLocaleString()}
          </Text>
        )}
        {progress !== undefined && (
          <View style={[styles.progressTrack, { backgroundColor: theme.progressTrack }]}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: theme.accent,
                  width: `${Math.min(100, Math.max(0, progress))}%`,
                },
              ]}
            />
          </View>
        )}
      </View>
    );
  };

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
          renderItem={renderItem}
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
  progressTrack: { height: 3, borderRadius: 2, marginTop: 8, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
});
