import { useEffect, useRef } from 'react';
import { wsSubscribe } from '../api/ws';
import type { WsEvent } from '../api/types';

/**
 * Subscribe to a specific WsEvent type.
 * Unsubscribes on unmount automatically.
 */
export function useWsEvent<T extends WsEvent['type']>(
  type: T,
  handler: (msg: Extract<WsEvent, { type: T }>) => void,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const wrapped = (msg: WsEvent) => {
      if (msg.type === type) {
        handlerRef.current(msg as Extract<WsEvent, { type: T }>);
      }
    };
    return wsSubscribe(wrapped);
  }, [type]);
}
