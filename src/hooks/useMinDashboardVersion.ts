/**
 * src/hooks/useMinDashboardVersion.ts
 *
 * Reads the minimum supported dashboard version from `app.json:expo.extra.bizar.minSupportedDashboardVersion`
 * via expo-constants.
 *
 * expo-constants exposes `expo.extra` at runtime, so this works on-device.
 * During unit tests the value falls back to the hardcoded default.
 */

import Constants from 'expo-constants';

type BizarExtra = {
  bizar?: {
    minSupportedDashboardVersion?: string;
  };
};

const FALLBACK = '5.6.0';

function read(): string {
  try {
    const extra = (Constants.expoConfig?.extra ?? null) as BizarExtra | null;
    return extra?.bizar?.minSupportedDashboardVersion ?? FALLBACK;
  } catch {
    return FALLBACK;
  }
}

export function useMinDashboardVersion(): string {
  return read();
}
