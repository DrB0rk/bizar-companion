/**
 * BackgroundScreen — view running / completed background agents.
 *
 * v1.2.0-beta.1 NEW. Renamed from the old "Agents" placeholder on the
 * MoreScreen into a real first-class tab. Shows the full background-agent
 * surface:
 *  - List of all running / pending / done / failed instances
 *  - Tap to view per-instance detail (tool calls, output preview)
 *  - Pause / Resume / Steer / Kill controls
 *  - Live updates via WebSocket `background:change` + `background:status`
 *
 * This is the mobile equivalent of the dashboard's "BG-agents" panel.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Pause,
  Play,
  Send,
  XCircle,
  Terminal,
  Clock,
  Bot,
  Activity,
} from 'lucide-react-native';
import { useTheme } from '../theme/colors';
import { usePairing } from '../store/pairing';
import { api } from '../api/client';
import { useWsEvent } from '../hooks/useWsEvent';
import type { BackgroundAgent, BgStatus } from '../api/types';

function statusColor(status: BgStatus, theme: ReturnType<typeof useTheme>): string {
  switch (status) {
    case 'running':
      return theme.success;
    case 'pending':
      return theme.warning;
    case 'done':
      return theme.accent;
    case 'failed':
    case 'killed':
    case 'timed_out':
      return theme.error;
    default:
      return theme.textMuted;
  }
}

function statusLabel(status: BgStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return `${m}m ${rs}s`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h ${rm}m`;
}

export default function BackgroundScreen() {
  const theme = useTheme();
  const { isPaired } = usePairing();
  const [items, setItems] = useState<BackgroundAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'running' | 'done' | 'failed'>('all');

  // Detail modal state
  const [detail, setDetail] = useState<BackgroundAgent | null>(null);
  const [steerText, setSteerText] = useState('');
  const [actionPending, setActionPending] = useState(false);

  const load = useCallback(async () => {
    if (!isPaired) return;
    try {
      setError(null);
      const r = await api.background.list();
      setItems(r.instances ?? []);
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
  useWsEvent('background:change', () => load());
  useWsEvent('background:status', () => load());

  const filtered = items.filter((i) => {
    if (filter === 'all') return true;
    if (filter === 'running') return i.status === 'running';
    if (filter === 'done') return i.status === 'done';
    if (filter === 'failed')
      return i.status === 'failed' || i.status === 'killed' || i.status === 'timed_out';
    return true;
  });

  const handlePause = useCallback(
    async (id: string) => {
      setActionPending(true);
      try {
        await api.background.pause(id);
        await load();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        Alert.alert('Failed to pause', msg);
      } finally {
        setActionPending(false);
      }
    },
    [load],
  );

  const handleResume = useCallback(
    async (id: string) => {
      setActionPending(true);
      try {
        await api.background.resume(id);
        await load();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        Alert.alert('Failed to resume', msg);
      } finally {
        setActionPending(false);
      }
    },
    [load],
  );

  const handleSteer = useCallback(
    async (id: string) => {
      const trimmed = steerText.trim();
      if (!trimmed) return;
      setActionPending(true);
      try {
        await api.background.steer(id, trimmed);
        setSteerText('');
        await load();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        Alert.alert('Failed to steer', msg);
      } finally {
        setActionPending(false);
      }
    },
    [steerText, load],
  );

  const handleKill = useCallback(
    async (id: string) => {
      Alert.alert(
        'Kill background agent?',
        'This will terminate the run. Use sparingly.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Kill',
            style: 'destructive',
            onPress: async () => {
              setActionPending(true);
              try {
                await api.background.kill(id);
                setDetail(null);
                await load();
              } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                Alert.alert('Failed to kill', msg);
              } finally {
                setActionPending(false);
              }
            },
          },
        ],
      );
    },
    [load],
  );

  if (!isPaired) return null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Agents</Text>
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>
          {items.filter((i) => i.status === 'running').length} running of {items.length}
        </Text>
      </View>

      {/* Filter chips */}
      <View style={styles.chips}>
        {(['all', 'running', 'done', 'failed'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            style={[
              styles.chip,
              {
                backgroundColor: filter === f ? theme.accent : 'transparent',
                borderColor: filter === f ? theme.accent : theme.border,
              },
            ]}
          >
            <Text
              style={[
                styles.chipText,
                { color: filter === f ? '#fff' : theme.textMuted },
              ]}
            >
              {f}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={theme.accent} style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
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
              <Bot size={48} color={theme.textMuted} />
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                No background agents.
              </Text>
              <Text style={[styles.emptyHint, { color: theme.textMuted }]}>
                Long-running delegated work appears here.
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          renderItem={({ item }) => {
            const status = item.status;
            const color = statusColor(status, theme);
            return (
              <TouchableOpacity
                onPress={() => setDetail(item)}
                style={[
                  styles.row,
                  { backgroundColor: theme.surface, borderColor: theme.border, borderLeftColor: color },
                ]}
              >
                <View style={[styles.statusDot, { backgroundColor: color }]} />
                <View style={{ flex: 1 }}>
                  <View style={styles.rowHeader}>
                    <Text
                      style={[styles.agent, { color: theme.text }]}
                      numberOfLines={1}
                    >
                      {item.agent}
                    </Text>
                    <Text style={[styles.status, { color }]}>{statusLabel(status)}</Text>
                  </View>
                  <Text
                    style={[styles.prompt, { color: theme.textMuted }]}
                    numberOfLines={2}
                  >
                    {item.promptPreview}
                  </Text>
                  {item.resultPreview && (
                    <Text
                      style={[styles.result, { color: theme.success }]}
                      numberOfLines={1}
                    >
                      ✓ {item.resultPreview}
                    </Text>
                  )}
                  {item.error && (
                    <Text
                      style={[styles.result, { color: theme.error }]}
                      numberOfLines={1}
                    >
                      ✗ {item.error}
                    </Text>
                  )}
                  <View style={styles.metaRow}>
                    <Clock size={11} color={theme.textMuted} />
                    <Text style={[styles.meta, { color: theme.textMuted }]}>
                      {item.durationMs ? formatDuration(item.durationMs) : 'in progress'}
                    </Text>
                    <Activity size={11} color={theme.textMuted} style={{ marginLeft: 8 }} />
                    <Text style={[styles.meta, { color: theme.textMuted }]}>
                      {item.toolCallCount} tool call{item.toolCallCount === 1 ? '' : 's'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Detail modal */}
      <Modal visible={!!detail} animationType="slide" transparent onRequestClose={() => setDetail(null)}>
        {detail && (
          <View style={[styles.modalBackdrop, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
            <View
              style={[
                styles.modalCard,
                { backgroundColor: theme.bg, borderColor: theme.border },
              ]}
            >
              <ScrollView contentContainerStyle={{ padding: 16 }}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>{detail.agent}</Text>
                <Text style={[styles.meta, { color: theme.textMuted }]}>
                  ID: {detail.id}
                </Text>
                <Text
                  style={[styles.prompt, { color: theme.text, marginTop: 12 }]}
                >
                  {detail.promptPreview}
                </Text>
                {detail.resultPreview && (
                  <View style={[styles.section, { borderColor: theme.success }]}>
                    <Text style={[styles.sectionLabel, { color: theme.success }]}>RESULT</Text>
                    <Text style={{ color: theme.text }}>{detail.resultPreview}</Text>
                  </View>
                )}
                {detail.error && (
                  <View style={[styles.section, { borderColor: theme.error }]}>
                    <Text style={[styles.sectionLabel, { color: theme.error }]}>ERROR</Text>
                    <Text style={{ color: theme.text }}>{detail.error}</Text>
                  </View>
                )}

                {/* Steer input */}
                {(detail.status === 'running' || detail.status === 'pending') && (
                  <View style={{ marginTop: 16 }}>
                    <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>
                      STEER
                    </Text>
                    <View style={styles.steerRow}>
                      <TextInput
                        style={[
                          styles.steerInput,
                          { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border },
                        ]}
                        value={steerText}
                        onChangeText={setSteerText}
                        placeholder="Send a message to redirect the agent…"
                        placeholderTextColor={theme.textMuted}
                        editable={!actionPending}
                      />
                      <TouchableOpacity
                        onPress={() => handleSteer(detail.id)}
                        disabled={actionPending || !steerText.trim()}
                        style={[
                          styles.iconBtn,
                          { backgroundColor: theme.accent, opacity: steerText.trim() ? 1 : 0.4 },
                        ]}
                      >
                        <Send size={16} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Action row */}
                <View style={styles.actionRow}>
                  {detail.status === 'running' ? (
                    <TouchableOpacity
                      onPress={() => handlePause(detail.id)}
                      disabled={actionPending}
                      style={[styles.actionBtn, { backgroundColor: theme.warning }]}
                    >
                      <Pause size={16} color="#fff" />
                      <Text style={styles.actionBtnText}>Pause</Text>
                    </TouchableOpacity>
                  ) : detail.status === 'pending' ? (
                    <TouchableOpacity
                      onPress={() => handleResume(detail.id)}
                      disabled={actionPending}
                      style={[styles.actionBtn, { backgroundColor: theme.success }]}
                    >
                      <Play size={16} color="#fff" />
                      <Text style={styles.actionBtnText}>Resume</Text>
                    </TouchableOpacity>
                  ) : null}
                  {(detail.status === 'running' || detail.status === 'pending') && (
                    <TouchableOpacity
                      onPress={() => handleKill(detail.id)}
                      disabled={actionPending}
                      style={[styles.actionBtn, { backgroundColor: theme.error }]}
                    >
                      <XCircle size={16} color="#fff" />
                      <Text style={styles.actionBtnText}>Kill</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => setDetail(null)}
                    style={[styles.actionBtn, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}
                  >
                    <Terminal size={16} color={theme.text} />
                    <Text style={[styles.actionBtnText, { color: theme.text }]}>Close</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        )}
      </Modal>

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
  chips: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  chip: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  chipText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 64 },
  emptyText: { fontSize: 16, marginTop: 12, fontWeight: '600' },
  emptyHint: { fontSize: 13, marginTop: 4, textAlign: 'center', maxWidth: 280 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6, marginRight: 8 },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  agent: { fontSize: 14, fontWeight: '600', flexShrink: 1, marginRight: 8 },
  status: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  prompt: { fontSize: 13, lineHeight: 18 },
  result: { fontSize: 12, marginTop: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 4 },
  meta: { fontSize: 11 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end' },
  modalCard: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: '85%',
  },
  modalTitle: { fontSize: 20, fontWeight: '700' },
  section: { marginTop: 16, padding: 10, borderLeftWidth: 3, borderRadius: 4 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 4 },
  steerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  steerInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  iconBtn: {
    marginLeft: 8,
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionRow: { flexDirection: 'row', marginTop: 16, gap: 8 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  actionBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
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
