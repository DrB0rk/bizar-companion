import { useEffect, useCallback } from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  Activity,
  MessageSquare,
  CheckSquare,
  Settings,
  MoreHorizontal,
  Bell,
  Bot,
} from 'lucide-react-native';
import { Alert, View, Text } from 'react-native';
import { usePairing } from '../store/pairing';
import { setPairing, onUnauthorized } from '../api/client';
import { wsConnect, wsDisconnect, onWsStateChange, getWsState, WsState } from '../api/ws';
import { useTheme } from '../theme/colors';
import PairScreen from '../screens/PairScreen';
import SecretEntryScreen from '../screens/SecretEntryScreen';
import ActivityScreen from '../screens/ActivityScreen';
import ChatScreen from '../screens/ChatScreen';
import TasksScreen from '../screens/TasksScreen';
import SettingsScreen from '../screens/SettingsScreen';
import MoreScreen from '../screens/MoreScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import BackgroundScreen from '../screens/BackgroundScreen';
import { useState } from 'react';

export type RootStackParamList = {
  Pair: undefined;
  SecretEntry: { url: string };
  Main: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

// Show a small banner above the tabs when the WS is reconnecting.
function ConnectionBanner({ state }: { state: WsState }) {
  const theme = useTheme();
  if (state.connection === 'connected') return null;
  let label = '';
  let color = theme.warning;
  if (state.connection === 'reconnecting') {
    label = `Reconnecting to dashboard… (attempt ${state.attempt})`;
  } else if (state.connection === 'connecting') {
    label = 'Connecting to dashboard…';
  } else if (state.connection === 'failed') {
    label = 'Connection lost — please check the dashboard.';
    color = theme.error;
  } else {
    return null;
  }
  return (
    <View
      style={{
        backgroundColor: color,
        paddingVertical: 6,
        paddingHorizontal: 12,
        alignItems: 'center',
      }}
    >
      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

function MainTabs() {
  const theme = useTheme();
  const [wsState, setWsState] = useState<WsState>(getWsState());

  useEffect(() => {
    return onWsStateChange((s) => setWsState(s));
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ConnectionBanner state={wsState} />
      <Tab.Navigator
        screenOptions={{
          tabBarStyle: { backgroundColor: theme.surface, borderTopColor: theme.border },
          tabBarActiveTintColor: theme.accent,
          tabBarInactiveTintColor: theme.textMuted,
          headerStyle: { backgroundColor: theme.surface },
          headerTintColor: theme.text,
          headerTitleStyle: { fontWeight: '600' },
        }}
      >
        <Tab.Screen
          name="Activity"
          component={ActivityScreen}
          options={{ tabBarIcon: ({ color }) => <Activity color={color} size={20} /> }}
        />
        <Tab.Screen
          name="Chat"
          component={ChatScreen}
          options={{ tabBarIcon: ({ color }) => <MessageSquare color={color} size={20} /> }}
        />
        <Tab.Screen
          name="Tasks"
          component={TasksScreen}
          options={{ tabBarIcon: ({ color }) => <CheckSquare color={color} size={20} /> }}
        />
        <Tab.Screen
          name="Agents"
          component={BackgroundScreen}
          options={{ tabBarIcon: ({ color }) => <Bot color={color} size={20} /> }}
        />
        <Tab.Screen
          name="Alerts"
          component={NotificationsScreen}
          options={{ tabBarIcon: ({ color }) => <Bell color={color} size={20} /> }}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ tabBarIcon: ({ color }) => <Settings color={color} size={20} /> }}
        />
        <Tab.Screen
          name="More"
          component={MoreScreen}
          options={{ tabBarIcon: ({ color }) => <MoreHorizontal color={color} size={20} /> }}
        />
      </Tab.Navigator>
    </View>
  );
}

export function RootNav() {
  const { url, secret, loading, clear } = usePairing();
  const theme = useTheme();

  // Sync api client and WS singleton whenever pairing changes
  useEffect(() => {
    setPairing(url, secret);
    if (url && secret) {
      wsConnect(url, secret);
    } else {
      wsDisconnect();
    }
  }, [url, secret]);

  // Register global 401 handler
  const onUnauth = useCallback(() => {
    Alert.alert(
      'Dashboard token rejected',
      'Please re-pair with the dashboard.',
      [
        {
          text: 'OK',
          onPress: () => {
            clear();
          },
        },
      ],
    );
  }, [clear]);

  useEffect(() => {
    const unsub = onUnauthorized(onUnauth);
    return unsub;
  }, [onUnauth]);

  if (loading) return null;

  const navTheme = {
    ...DefaultTheme,
    dark: true,
    colors: {
      ...DefaultTheme.colors,
      background: theme.bg,
      card: theme.surface,
      text: theme.text,
      border: theme.border,
      primary: theme.accent,
      notification: theme.accent,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!url ? (
          // No URL at all — show Pair screen
          <Stack.Screen name="Pair" component={PairScreen} />
        ) : !secret ? (
          // URL set, secret not yet — show SecretEntry screen
          <Stack.Screen name="SecretEntry" component={SecretEntryScreen} initialParams={{ url }} />
        ) : (
          // Both set — show Main tabs
          <Stack.Screen name="Main" component={MainTabs} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
