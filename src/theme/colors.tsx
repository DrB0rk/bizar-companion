import { createContext, useContext, ReactNode } from 'react';

export type Theme = {
  bg: string;
  surface: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  accentMuted: string;
  success: string;
  warning: string;
  error: string;
  userBubble: string;
  agentBubble: string;
  progressTrack: string;
  danger: string;
};

export const darkTheme: Theme = {
  bg: '#0d1117',
  surface: '#161b22',
  border: '#30363d',
  text: '#c9d1d9',
  textMuted: '#8b949e',
  accent: '#8b5cf6',
  accentMuted: '#6d28d9',
  success: '#3fb950',
  warning: '#d29922',
  error: '#f85149',
  userBubble: '#8b5cf6',
  agentBubble: '#161b22',
  progressTrack: '#21262d',
  danger: '#f85149',
};

const Ctx = createContext<Theme>(darkTheme);

export function ThemeProvider({ children }: { children: ReactNode }) {
  return <Ctx.Provider value={darkTheme}>{children}</Ctx.Provider>;
}

export function useTheme(): Theme {
  return useContext(Ctx);
}