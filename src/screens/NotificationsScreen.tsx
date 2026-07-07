/**
 * NotificationsScreen — view + dismiss dashboard notifications.
 *
 * v1.2.0-beta.1 NEW.
 *
 * Shows:
 *  - A list of all notifications (most recent first)
 *  - Read / unread state with a small badge
 *  - A "Mark all read" button in the header
 *  - Per-row swipe (or tap) to mark as read / dismiss
 *
 * Subscribes to the `notifications:change` WebSocket event for live updates
 * and to `notification:new` to flash the new item.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle2, Circle, Trash2, Bell } from 'lucide-react-native';
import { useTheme } from '../theme/colors';
import { usePairing } from '../store/pairing';
import { api } from '../api/client';
import { useWsEvent } from '../hooks/useWsEvent';
import type { Notification, NotificationListResponse } from '../api/types';

function timeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function kindLabel(kind: string): string {
  // Convert 'task.completed' -> 'Task completed'
  return kind
    .split('.')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

function kindColor(kind: string, theme: ReturnType<typeof useTheme>): string {
  if (kind.startsWith('task.failed') || kind.startsWith('agent.error')) return theme.error;
  if (kind.startsWith('agent.stuck')) return theme.warning;
  if (kind.startsWith('task.completed') || kind.startsWith('chat.response')) return theme.success;
  return theme.accent;
}

export default function NotificationsScreen() {
  const theme = useTheme();
  const { isPaired } = usePairing();
  const [items, setItems] = useState<Notification[]>([]);
  const [stats, setStats] = useState<{ total: number; unread: number }>({ total: 0, unread: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isPaired) return;
    try {
      setError(null);
      const data = await api.notifications.list();
      setItems(data.notifications ?? []);
      setStats(data.stats ?? { total: 0, unread: 0 });
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

  // Live updates
  useWsEvent('notifications:change', () => load());
  useWsEvent('notification:new', () => load());

  const handleMarkRead = useCallback(
    async (id: string) => {
      try {
        await api.notifications.markRead(id);
        setItems((prev) =>
          prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
        );
        setStats((prev) => ({ ...prev, unread: Math.max(0, prev.unread - 1) }));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        Alert.alert('Failed to mark read', msg);
      }
    },
    [],
  );

  const handleDismiss = useCallback(
    async (id: string) => {
      try {
        await api.notifications.dismiss(id);
        setItems((prev) => prev.filter((n) => n.id !== id));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        Alert.alert('Failed to dismiss', msg);
      }
    },
    [],
  );

  const handleMarkAllRead = useCallback(async () => {
    try {
      const r = await api.notifications.markAllRead();
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      setStats({ total: stats.total, unread: 0 });
      Alert.alert('Done', `${r.marked} notifications marked as read`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert('Failed to mark all read', msg);
    }
  }, [stats.total]);

  if (!isPaired) return null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: theme.text }]}>Notifications</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            {stats.unread > 0 ? `${stats.unread} unread of ${stats.total}` : `${stats.total} total`}
          </Text>
        </View>
        {stats.unread > 0 && (
          <TouchableOpacity
            onPress={handleMarkAllRead}
            style={[styles.markAllBtn, { backgroundColor: theme.accent }]}
          >
            <Text style={styles.markAllBtnText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator color={theme.accent} style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
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
            <View style={styles.empty}>
              <Bell size={48} color={theme.textMuted} />
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                No notifications yet.
              </Text>
              <Text style={[styles.emptyHint, { color: theme.textMuted }]}>
                Task completions and agent events will appear here.
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          renderItem={({ item }) => {
            const dotColor = kindColor(item.kind, theme);
            return (
              <TouchableOpacity
                onPress={() => !item.read && handleMarkRead(item.id)}
                onLongPress={() =>
                  Alert.alert(
                    'Dismiss notification?',
                    item.message,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Dismiss',
                        style: 'destructive',
                        onPress: () => handleDismiss(item.id),
                      },
                    ],
                  )
                }
                style={[
                  styles.row,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                    borderLeftColor: dotColor,
                    opacity: item.read ? 0.6 : 1,
                  },
                ]}
              >
                <View style={{ marginRight: 8 }}>
                  {item.read ? (
                    <CheckCircle2 size={18} color={theme.textMuted} />
                  ) : (
                    <Circle size={18} color={dotColor} fill={dotColor} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.kind, { color: dotColor }]}>
                    {kindLabel(item.kind)}
                  </Text>
                  <Text
                    style={[styles.message, { color: theme.text }]}
                    numberOfLines={3}
                  >
                    {item.message}
                  </Text>
                  <View style={styles.metaRow}>
                    <Text style={[styles.meta, { color: theme.textMuted }]}>
                      {timeAgo(item.ts)}
                    </Text>
                    {item.agent && (
                      <Text
                        style={[styles.meta, { color: theme.textMuted }]}
                        numberOfLines={1}
                      >
                        {' · '}
                        {item.agent}
                      </Text>
                    )}
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => handleDismiss(item.id)}
                  style={styles.dismissBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Trash2 size={16} color={theme.textMuted} />
                </TouchableOpacity>
              </TouchableOpacity>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { fontSize: 13, marginTop: 2 },
  markAllBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  markAllBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 64,
  },
  emptyText: { fontSize: 16, marginTop: 12, fontWeight: '600' },
  emptyHint: { fontSize: 13, marginTop: 4, textAlign: 'center', maxWidth: 280 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  kind: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  message: { fontSize: 14, marginTop: 2, lineHeight: 19 },
  metaRow: { flexDirection: 'row', marginTop: 4, flexWrap: 'wrap' },
  meta: { fontSize: 12 },
  dismissBtn: { padding: 4 },
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
