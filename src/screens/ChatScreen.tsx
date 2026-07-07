import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/colors';
import { usePairing } from '../store/pairing';
import { api } from '../api/client';
import { useWsEvent } from '../hooks/useWsEvent';
import type { ChatMessage, ChatListResponse, ChatSession } from '../api/types';

const MAX_MESSAGES = 200;

export default function ChatScreen() {
  const theme = useTheme();
  const { isPaired } = usePairing();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [streamingId, setStreamingId] = useState<string | null>(null);

  // Streaming accumulation: messageId -> accumulated text
  const streamingText = useRef<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!isPaired) return;
    try {
      setError(null);
      const data = await api.chat.list();
      setMessages((data.messages ?? []).slice(-MAX_MESSAGES));
      setSessions(data.sessions ?? []);
    } catch (err: unknown) {
      setError((err instanceof Error ? err.message : String(err)) || 'Failed to load chat');
    } finally {
      setLoading(false);
    }
  }, [isPaired]);

  useEffect(() => {
    load();
  }, [load]);

  // WS subscriptions
  useWsEvent('chat:message', (msg) => {
    const incoming = msg.data.message;
    setMessages((prev) => {
      // Dedup by id if present
      if (incoming.id && prev.some((m) => m.id === incoming.id)) return prev;
      return [...prev, incoming].slice(-MAX_MESSAGES);
    });
  });

  useWsEvent('chat:delta', (msg) => {
    const { messageId, delta } = msg.data;
    streamingText.current[messageId] = (streamingText.current[messageId] ?? '') + delta;
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === messageId);
      if (idx === -1) {
        // Create a provisional assistant message
        return [
          ...prev,
          { id: messageId, role: 'assistant', content: streamingText.current[messageId] },
        ].slice(-MAX_MESSAGES);
      }
      const updated = [...prev];
      updated[idx] = { ...updated[idx], content: streamingText.current[messageId] };
      return updated;
    });
  });

  useWsEvent('chat:error', (msg) => {
    setError(msg.data.error);
    setSending(false);
  });

  useWsEvent('chat:session:create', () => load());

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    setInput('');

    // Optimistically append user message
    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [...prev, { id: tempId, role: 'user', content: text }].slice(-MAX_MESSAGES));

    try {
      await api.chat.send(text);
      // Let WS deltas drive the assistant response; reload after a short window
    } catch (err: unknown) {
      setError((err instanceof Error ? err.message : String(err)) || 'Send failed');
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setSending(false);
    }
  };

  if (!isPaired) return null;

  const renderItem = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    return (
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: isUser ? theme.userBubble : theme.agentBubble,
            borderColor: isUser ? theme.userBubble : theme.border,
            alignSelf: isUser ? 'flex-end' : 'flex-start',
          },
        ]}
      >
        {item.agent && !isUser && (
          <Text style={[styles.agentLabel, { color: theme.accent }]}>{item.agent}</Text>
        )}
        <Text style={[styles.bubbleText, { color: theme.text }]}>{item.content}</Text>
        {item.ts && (
          <Text style={[styles.bubbleTs, { color: theme.textMuted }]}>
            {new Date(item.ts).toLocaleTimeString()}
          </Text>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.accent} />
          </View>
        ) : (
          <>
            {error && (
              <View style={[styles.errorBanner, { backgroundColor: theme.error }]}>
                <Text style={styles.errorBannerText}>{error}</Text>
              </View>
            )}
            <FlatList
              data={messages}
              keyExtractor={(_item, i) => String(i)}
              renderItem={renderItem}
              contentContainerStyle={{ padding: 16, flexGrow: 1 }}
              ListEmptyComponent={
                <View style={styles.center}>
                  <Text style={{ color: theme.textMuted }}>
                    Say something to the agent.
                  </Text>
                </View>
              }
            />
          </>
        )}
        <View style={[styles.inputRow, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
          <TextInput
            style={[styles.input, { backgroundColor: theme.bg, color: theme.text }]}
            value={input}
            onChangeText={setInput}
            placeholder="Send a message..."
            placeholderTextColor={theme.textMuted}
            multiline
            editable={!sending}
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: theme.accent, opacity: sending ? 0.5 : 1 }]}
            onPress={send}
            disabled={sending}
          >
            {sending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.sendBtnText}>→</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { padding: 40, alignItems: 'center' },
  bubble: { padding: 12, borderRadius: 14, marginVertical: 4, maxWidth: '85%', borderWidth: 1 },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  bubbleTs: { fontSize: 11, marginTop: 6 },
  agentLabel: { fontSize: 11, fontWeight: '700', marginBottom: 4 },
  inputRow: { flexDirection: 'row', padding: 8, gap: 8, borderTopWidth: 1, alignItems: 'flex-end' },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 120,
    fontSize: 15,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnText: { color: 'white', fontSize: 20, fontWeight: '700' },
  errorBanner: { padding: 8, alignItems: 'center' },
  errorBannerText: { color: '#fff', fontSize: 13 },
});
