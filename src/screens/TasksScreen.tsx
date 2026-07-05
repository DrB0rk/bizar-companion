import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/colors';
import { usePairing } from '../store/pairing';
import { apiGet, apiPost } from '../api/client';
import { useWsEvent } from '../hooks/useWsEvent';
import { useWsSnapshot } from '../hooks/useWsSnapshot';
import { TaskCard } from '../components/TaskCard';
import type { Task, Project, ProjectListResponse, TaskStatus } from '../api/types';

const STATUS_ORDER: Record<TaskStatus, number> = {
  doing: 0,
  queued: 1,
  backlog: 2,
  done: 3,
  blocked: 4,
  archived: 5,
};

export default function TasksScreen() {
  const theme = useTheme();
  const { isPaired } = usePairing();
  const wsSnapshot = useWsSnapshot();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activating, setActivating] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    if (!isPaired) return;
    try {
      setError(null);
      const data = await apiGet<Task[] | { tasks?: Task[] }>('/api/tasks');
      const list = Array.isArray(data) ? data : data.tasks ?? [];
      // Sort by status order
      setTasks(list.sort((a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99)));
    } catch (err: any) {
      setError(err?.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isPaired]);

  const loadProjects = useCallback(async () => {
    if (!isPaired) return;
    try {
      const data = await apiGet<ProjectListResponse>('/api/projects');
      setProjects(data.projects ?? []);
      setActiveProjectId(data.active ?? null);
    } catch {
      /* non-fatal — projects are nice-to-have */
    }
  }, [isPaired]);

  useEffect(() => {
    if (!isPaired) return;
    loadProjects();
    loadTasks();
  }, [isPaired, loadTasks, loadProjects]);

  // Hydrate from WS snapshot if available
  useEffect(() => {
    if (wsSnapshot?.tasks) {
      setTasks(
        wsSnapshot.tasks.sort(
          (a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99),
        ),
      );
    }
    if (wsSnapshot?.projects) {
      setProjects(wsSnapshot.projects);
    }
    if (wsSnapshot?.activeProject) {
      setActiveProjectId(wsSnapshot.activeProject);
    }
  }, [wsSnapshot]);

  // WS subscriptions
  useWsEvent('tasks:change', (msg) => {
    setTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === msg.data.task.id);
      if (idx === -1) return [...prev, msg.data.task];
      const updated = [...prev];
      updated[idx] = msg.data.task;
      return updated.sort((a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99));
    });
  });

  useWsEvent('tasks:delete', (msg) => {
    setTasks((prev) => prev.filter((t) => t.id !== msg.data.id));
  });

  useWsEvent('task:progress', (msg) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === msg.data.id
          ? { ...t, metadata: { ...t.metadata, progress: msg.data.progress, currentStep: msg.data.step } }
          : t,
      ),
    );
  });

  const switchProject = async (projectId: string) => {
    if (projectId === activeProjectId || activating) return;
    setActivating(projectId);
    try {
      await apiPost(`/api/projects/${projectId}/activate`);
      setActiveProjectId(projectId);
      await loadTasks();
    } catch (err: any) {
      setError(err?.message || 'Failed to switch project');
    } finally {
      setActivating(null);
    }
  };

  if (!isPaired) return null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      {/* Project switcher */}
      {projects.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.projectScroll}
          contentContainerStyle={styles.projectRow}
        >
          {projects.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[
                styles.projectPill,
                {
                  backgroundColor: p.id === activeProjectId ? theme.accent : theme.surface,
                  borderColor: p.id === activeProjectId ? theme.accent : theme.border,
                },
              ]}
              onPress={() => switchProject(p.id)}
              disabled={!!activating}
            >
              <Text
                style={{
                  color: p.id === activeProjectId ? '#fff' : theme.text,
                  fontSize: 13,
                  fontWeight: '600',
                }}
              >
                {p.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.accent} />
        </View>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <TaskCard task={item} />}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadTasks();
              }}
              tintColor={theme.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={{ color: theme.textMuted }}>
                {error || 'No tasks yet.'}
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
  projectScroll: { maxHeight: 50 },
  projectRow: { paddingHorizontal: 16, paddingVertical: 8, gap: 8, flexDirection: 'row' },
  projectPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
});
