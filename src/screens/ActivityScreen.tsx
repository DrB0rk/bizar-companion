/**
 * ActivityScreen — dashboard activity stream.
 *
 * v1.2.0-beta.1 — switched to typed API namespace + light client-side
 * pagination (page of 50, scroll to load more). Activity kinds are
 * coloured by category.
 */

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
import { api } from '../api/client';
import { useWsEvent } from '../hooks/useWsEvent';
import type { Activity } from '../api/types';

const PAGE_SIZE = 50;

function kindColor(kind: string, theme: ReturnType<typeof useTheme>): string {
  if (kind.startsWith('task.completed') || kind.includes('completed')) return theme.success;
  if (kind.startsWith('task.failed') || kind.includes('error')) return theme.error;
  if (kind.startsWith('agent.')) return theme.accent;
  if (kind.startsWith('chat.')) return theme.warning;
  if (kind.startsWith('pair.')) return theme.accentMuted;
  return theme.textMuted;
}

function kindLabel(kind: string): string {
  return kind
    .split('.')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

function timeAgo(ts: string): string {
  const t = new Date(ts).getTime();
  const seconds = Math.floor((Date.now() - t) / 1000);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

export default function ActivityScreen() {
  const theme = useTheme();
  const { isPaired } = usePairing();
  const [items, setItems] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const load = useCallback(async () => {
    if (!isPaired) return;
    try {
      setError(null);
      const data = await api.activity.list();
      setItems(data.items ?? []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
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
  useWsEvent('task:completed', () => load());
  useWsEvent('task:failed', () => load());
  useWsEvent('agents:change', () => load());
  useWsEvent('agent:status', () => load());
  useWsEvent('pair:change', () => load());
  useWsEvent('settings:change', () => load());
  useWsEvent('project:change', () => load());

  if (!isPaired) return null;

  const visible = items.slice(0, pageSize);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Activity</Text>
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>
          {items.length} event{items.length === 1 ? '' : 's'}
        </Text>
      </View>
      {loading ? (
        <ActivityIndicator color={theme.accent} style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item, idx) => `${item.ts}-${idx}`}
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
          onEndReached={() => {
            if (pageSize < items.length) setPageSize(pageSize + PAGE_SIZE);
          }}
          onEndReachedThreshold={0.5}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                No activity yet.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const color = kindColor(item.kind, theme);
            return (
              <View style={[styles.row, { borderLeftColor: color, backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={[styles.dot, { backgroundColor: color }]} />
                <View style={{ flex: 1 }}>
                  <View style={styles.rowHeader}>
                    <Text style={[styles.kind, { color }]} numberOfLines={1}>
                      {kindLabel(item.kind)}
                    </Text>
                    <Text style={[styles.ts, { color: theme.textMuted }]}>
                      {timeAgo(item.ts)}
                    </Text>
                  </View>
                  {item.message && (
                    <Text style={[styles.msg, { color: theme.text }]} numberOfLines={2}>
                      {item.message}
                    </Text>
                  )}
                  {item.agent && (
                    <Text style={[styles.agent, { color: theme.textMuted }]} numberOfLines={1}>
                      {item.agent}
                    </Text>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}
      {error && (
        <View style={styles.errorBar}>
          <Text style={{ color: '#fff', fontSize: 12 }}>{error}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { fontSize: 13, marginTop: 2 },
  empty: { alignItems: 'center', paddingTop: 64 },
  emptyText: { fontSize: 16, marginTop: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6, marginRight: 8 },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kind: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, flexShrink: 1 },
  ts: { fontSize: 11, marginLeft: 8 },
  msg: { fontSize: 14, marginTop: 4, lineHeight: 19 },
  agent: { fontSize: 12, marginTop: 4 },
  errorBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#f85149',
    padding: 8,
    alignItems: 'center',
  },
});
