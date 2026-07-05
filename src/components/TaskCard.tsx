import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../theme/colors';
import type { Task, TaskStatus } from '../api/types';

type Props = { task: Task; onPress?: () => void };

const STATUS_COLOR: Record<TaskStatus, string> = {
  backlog: '#8b949e',
  queued: '#d29922',
  doing: '#58a6ff',
  done: '#3fb950',
  blocked: '#f85149',
  archived: '#6e7681',
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  backlog: 'Backlog',
  queued: 'Queued',
  doing: 'In progress',
  done: 'Done',
  blocked: 'Blocked',
  archived: 'Archived',
};

function formatTimeSpent(ms?: number): string | null {
  if (!ms || ms <= 0) return null;
  const totalMinutes = Math.floor(ms / 60_000);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

export function TaskCard({ task, onPress }: Props) {
  const theme = useTheme();
  const status = task.status ?? 'queued';
  const statusColor = STATUS_COLOR[status] ?? theme.textMuted;
  const progress = task.metadata?.progress;
  const timeSpent = formatTimeSpent(task.timeSpent);

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {progress !== undefined && (
        <View style={[styles.progressTrack, { backgroundColor: theme.progressTrack }]}>
          <View
            style={[
              styles.progressFill,
              { backgroundColor: statusColor, width: `${Math.min(100, Math.max(0, progress))}%` },
            ]}
          />
        </View>
      )}
      <View style={styles.row}>
        <View style={[styles.dot, { backgroundColor: statusColor }]} />
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
          {task.title}
        </Text>
      </View>
      <View style={styles.meta}>
        {task.priority && (
          <Text style={[styles.metaText, { color: theme.textMuted }]}>{task.priority}</Text>
        )}
        <Text style={[styles.statusBadge, { color: statusColor, borderColor: statusColor }]}>
          {STATUS_LABEL[status]}
        </Text>
        {timeSpent && (
          <Text style={[styles.metaText, { color: theme.textMuted }]}>{timeSpent}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  title: { flex: 1, fontSize: 15, fontWeight: '500' },
  meta: { flexDirection: 'row', marginTop: 8, marginLeft: 18, gap: 10, alignItems: 'center' },
  metaText: { fontSize: 12 },
  statusBadge: {
    fontSize: 11,
    fontWeight: '600',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  progressTrack: { height: 3, borderRadius: 2, marginBottom: 10, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
});
