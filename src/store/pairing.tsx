import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as Application from 'expo-application';
import { Platform } from 'react-native';

export type PairingData = {
  url: string;
  secret: string;
  pairedAt: string; // ISO timestamp
  deviceName?: string;
  dashboardVersion?: string | null;
};

type PairingContextValue = {
  url: string | null;
  secret: string | null;
  pairedAt: string | null;
  deviceName: string | null;
  dashboardVersion: string | null;
  loading: boolean;
  pairUrl: (url: string) => Promise<void>;
  complete: (secret: string) => Promise<void>;
  setDashboardVersion: (version: string) => Promise<void>;
  clear: () => Promise<void>;
  isPaired: boolean;
  hasUrl: boolean;
};

const STORAGE_KEY = 'bizar-pairing-v2';

const Ctx = createContext<PairingContextValue | null>(null);

async function defaultDeviceName(): Promise<string> {
  try {
    if (Platform.OS === 'android') {
      const name = await Application.getAndroidId();
      return name ? `android-${name.slice(0, 8)}` : 'android-device';
    }
    return Platform.OS === 'ios' ? 'ios-device' : 'unknown-device';
  } catch {
    return 'unknown-device';
  }
}

export function PairingProvider({ children }: { children: ReactNode }) {
  const [url, setUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [pairedAt, setPairedAt] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [dashboardVersion, setDashboardVersion] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(STORAGE_KEY);
        if (raw) {
          const data = JSON.parse(raw) as PairingData;
          setUrl(data.url ?? null);
          setSecret(data.secret ?? null);
          setPairedAt(data.pairedAt ?? null);
          setDeviceName(data.deviceName ?? (await defaultDeviceName()));
          setDashboardVersion(data.dashboardVersion ?? null);
        }
      } catch (err) {
        console.warn('Failed to load pairing:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const persist = async (data: PairingData): Promise<void> => {
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(data));
  };

  const pairUrl = async (newUrl: string) => {
    // Partial state — secret not yet set. Persist what we have.
    const data: PairingData = {
      url: newUrl,
      secret: '',
      pairedAt: '',
      deviceName: await defaultDeviceName(),
    };
    await persist(data);
    setUrl(newUrl);
    setSecret(null);
    setPairedAt(null);
    setDeviceName(data.deviceName ?? null);
    setDashboardVersion(null);
  };

  const complete = async (newSecret: string) => {
    if (!url) throw new Error('URL not set — call pairUrl first');
    const data: PairingData = {
      url,
      secret: newSecret,
      pairedAt: new Date().toISOString(),
      deviceName: deviceName ?? (await defaultDeviceName()),
      dashboardVersion,
    };
    await persist(data);
    setSecret(newSecret);
    setPairedAt(data.pairedAt);
  };

  const updateDashboardVersion = async (version: string) => {
    if (!url || !secret) return;
    const data: PairingData = {
      url,
      secret,
      pairedAt: pairedAt ?? new Date().toISOString(),
      deviceName: deviceName ?? (await defaultDeviceName()),
      dashboardVersion: version,
    };
    await persist(data);
    setDashboardVersion(version);
  };

  const clear = async () => {
    await SecureStore.deleteItemAsync(STORAGE_KEY);
    setUrl(null);
    setSecret(null);
    setPairedAt(null);
    setDashboardVersion(null);
  };



  return (
    <Ctx.Provider
      value={{
        url,
        secret,
        pairedAt,
        deviceName,
        dashboardVersion,
        loading,
        pairUrl,
        complete,
        setDashboardVersion: updateDashboardVersion,
        clear,
        isPaired: !!(url && secret),
        hasUrl: !!url,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function usePairing(): PairingContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePairing must be used within PairingProvider');
  return ctx;
}
