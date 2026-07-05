import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';

export type PairingData = {
  url: string;
  secret: string;
  pairedAt: string; // ISO timestamp
};

type PairingContextValue = {
  url: string | null;
  secret: string | null;
  pairedAt: string | null;
  loading: boolean;
  pairUrl: (url: string) => Promise<void>;
  complete: (secret: string) => Promise<void>;
  clear: () => Promise<void>;
  isPaired: boolean;
  hasUrl: boolean;
};

const STORAGE_KEY = 'bizar-pairing';

const Ctx = createContext<PairingContextValue | null>(null);

export function PairingProvider({ children }: { children: ReactNode }) {
  const [url, setUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [pairedAt, setPairedAt] = useState<string | null>(null);
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
        }
      } catch (err) {
        console.warn('Failed to load pairing:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const pairUrl = async (newUrl: string) => {
    // Partial state — secret not yet set. Persist what we have.
    const data: PairingData = { url: newUrl, secret: '', pairedAt: '' };
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(data));
    setUrl(newUrl);
    setSecret(null);
    setPairedAt(null);
  };

  const complete = async (newSecret: string) => {
    if (!url) throw new Error('URL not set — call pairUrl first');
    const data: PairingData = {
      url,
      secret: newSecret,
      pairedAt: new Date().toISOString(),
    };
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(data));
    setSecret(newSecret);
    setPairedAt(data.pairedAt);
  };

  const clear = async () => {
    await SecureStore.deleteItemAsync(STORAGE_KEY);
    setUrl(null);
    setSecret(null);
    setPairedAt(null);
  };

  return (
    <Ctx.Provider
      value={{
        url,
        secret,
        pairedAt,
        loading,
        pairUrl,
        complete,
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
