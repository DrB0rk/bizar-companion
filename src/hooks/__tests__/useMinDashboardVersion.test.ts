/**
 * Tests for useMinDashboardVersion hook.
 *
 * Verifies the fallback path is used when expo-constants is unavailable
 * (e.g. during unit tests).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('useMinDashboardVersion', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('returns the fallback when expo-constants has no extra.bizar', async () => {
    vi.doMock('expo-constants', () => ({
      default: { expoConfig: { extra: {} } },
    }));
    const { useMinDashboardVersion } = await import('../useMinDashboardVersion');
    expect(useMinDashboardVersion()).toBe('5.6.0');
  });

  it('returns the configured version when present', async () => {
    vi.doMock('expo-constants', () => ({
      default: {
        expoConfig: {
          extra: {
            bizar: { minSupportedDashboardVersion: '6.0.0' },
          },
        },
      },
    }));
    const { useMinDashboardVersion } = await import('../useMinDashboardVersion');
    expect(useMinDashboardVersion()).toBe('6.0.0');
  });

  it('returns the fallback when expoConfig access throws', async () => {
    vi.doMock('expo-constants', () => ({
      default: {
        get expoConfig() {
          throw new Error('boom');
        },
      },
    }));
    const { useMinDashboardVersion } = await import('../useMinDashboardVersion');
    expect(useMinDashboardVersion()).toBe('5.6.0');
  });
});
