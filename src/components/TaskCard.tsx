import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../theme/colors';
import type { Task } from '../api/types';

type Props = { task: Task; onPress?: () => void };

const STATUS_COLOR: Record<string, string> = {
  queued: '#d29922',
  in_progress: '#58a6ff',
  blocked: '#f85149',
  done: '#3fb950',
  archived: '#8b949e',
};

export function TaskCard({ task, onPress }: Props) {
  const theme = useTheme();
  const statusColor = STATUS_COLOR[task.status || 'queued'] || theme.textMuted;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
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
        {task.status && (
          <Text style={[styles.metaText, { color: statusColor }]}>{task.status}</Text>
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
  meta: { flexDirection: 'row', marginTop: 8, marginLeft: 18, gap: 12 },
  metaText: { fontSize: 12 },
});