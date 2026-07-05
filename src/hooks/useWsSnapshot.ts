import { useEffect, useState } from 'react';
import { wsGetSnapshot, wsSubscribe } from '../api/ws';
import type { WsSnapshot } from '../api/types';

/**
 * Returns the latest WsSnapshot received over the WebSocket connection.
 * Initialises from the cached snapshot on first call.
 */
export function useWsSnapshot(): WsSnapshot | null {
  const [snapshot, setSnapshot] = useState<WsSnapshot | null>(() => wsGetSnapshot());

  useEffect(() => {
    const handler = (msg: { type: string; data?: { snapshot?: WsSnapshot } }) => {
      if (msg.type === 'snapshot' && msg.data?.snapshot) {
        setSnapshot(msg.data.snapshot);
      }
    };
    return wsSubscribe(handler as Parameters<typeof wsSubscribe>[0]);
  }, []);

  return snapshot;
}
