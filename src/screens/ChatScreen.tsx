import { useEffect, useState, useCallback } from 'react';
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
import { apiGet, apiPost } from '../api/client';
import type { ChatMessage } from '../api/types';

export default function ChatScreen() {
  const theme = useTheme();
  const { pairing } = usePairing();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await apiGet<ChatMessage[] | { messages?: ChatMessage[] }>(
        '/api/chat?limit=50',
      );
      setMessages(Array.isArray(data) ? data : data.messages || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load chat');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!pairing) return;
    load();
  }, [pairing, load]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await apiPost('/api/chat', { message: text });
      setInput('');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Send failed');
    } finally {
      setSending(false);
    }
  };

  if (!pairing) return null;

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
          <FlatList
            data={messages}
            keyExtractor={(_item, i) => String(i)}
            renderItem={({ item }) => {
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
                  <Text style={[styles.bubbleText, { color: theme.text }]}>
                    {item.content}
                  </Text>
                  {item.ts && (
                    <Text style={[styles.bubbleTs, { color: theme.textMuted }]}>
                      {new Date(item.ts).toLocaleTimeString()}
                    </Text>
                  )}
                </View>
              );
            }}
            contentContainerStyle={{ padding: 16, flexGrow: 1 }}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={{ color: theme.textMuted }}>
                  {error || 'No messages yet. Say something to the agent.'}
                </Text>
              </View>
            }
          />
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
});