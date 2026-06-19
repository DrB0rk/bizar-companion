import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';

export type PairingData = {
  url: string;        // e.g. https://borkpc.tail2cdf4d.ts.net
  token: string;      // pairing token
  pairedAt: string;   // ISO timestamp
};

type PairingContextValue = {
  pairing: PairingData | null;
  loading: boolean;
  pair: (data: PairingData) => Promise<void>;
  unpair: () => Promise<void>;
  isPaired: boolean;
};

const STORAGE_KEY = 'bizar-pairing';

const Ctx = createContext<PairingContextValue | null>(null);

export function PairingProvider({ children }: { children: ReactNode }) {
  const [pairing, setPairing] = useState<PairingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(STORAGE_KEY);
        if (raw) setPairing(JSON.parse(raw));
      } catch (err) {
        console.warn('Failed to load pairing:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const pair = async (data: PairingData) => {
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(data));
    setPairing(data);
  };

  const unpair = async () => {
    await SecureStore.deleteItemAsync(STORAGE_KEY);
    setPairing(null);
  };

  return (
    <Ctx.Provider value={{ pairing, loading, pair, unpair, isPaired: !!pairing }}>
      {children}
    </Ctx.Provider>
  );
}

export function usePairing(): PairingContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePairing must be used within PairingProvider');
  return ctx;
}