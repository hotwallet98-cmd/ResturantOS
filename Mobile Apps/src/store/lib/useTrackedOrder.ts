import { connectOrderFeed } from '@restaurantos/api-client';
import type { FlowOrder, TrackOrderResponse } from '@restaurantos/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { api, ApiError, errorMessage } from '@/lib/api';
import { POLL_MS, SOCKET_URL } from '@/lib/config';
import { isFinished } from './status';
import { storage } from './storage';

type Rider = TrackOrderResponse['rider'];

export interface TrackedOrder {
  order: FlowOrder | null;
  rider: Rider;
  /** True until we have shown at least a cached or fetched order (or failed). */
  loading: boolean;
  error: string | null;
  /** Socket connected — live updates. When false we poll every 15s. */
  live: boolean;
  /** Order not found on this phone (no tracking token). */
  unknown: boolean;
  refresh: () => Promise<void>;
}

/**
 * Live view of one customer order: cached snapshot from storage, then the track
 * endpoint, then Socket.IO `order:updated` pushes. Falls back to polling the
 * track endpoint every 15s whenever the socket is not connected.
 */
export function useTrackedOrder(id: string | undefined): TrackedOrder {
  const [order, setOrder] = useState<FlowOrder | null>(null);
  const [rider, setRider] = useState<Rider>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [unknown, setUnknown] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const orderRef = useRef<FlowOrder | null>(null);

  const apply = useCallback((next: FlowOrder) => {
    orderRef.current = next;
    setOrder(next);
    void storage.updateOrder(next);
  }, []);

  // 1. Cached snapshot + token from storage.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setUnknown(false);
    setOrder(null);
    setRider(undefined);
    setToken(null);
    if (!id) return;
    void storage.getOrder(id).then((saved) => {
      if (cancelled) return;
      if (!saved) {
        setUnknown(true);
        setLoading(false);
        return;
      }
      orderRef.current = saved.order;
      setOrder(saved.order);
      setToken(saved.trackingToken);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const refresh = useCallback(async () => {
    if (!id || !token) return;
    try {
      const res = await api.store.track(id, token);
      apply(res.order);
      setRider(res.rider);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError && e.status === 404 ? 'This order could not be found.' : errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [id, token, apply]);

  // 2. Fetch from the track endpoint once the token is known.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // 3. Socket.IO live updates for this order only.
  const finished = order ? isFinished(order) : false;
  useEffect(() => {
    if (!id || !token || finished) return;
    // SOCKET_URL has no /api suffix, so the client uses it as-is (honours EXPO_PUBLIC_SOCKET_URL).
    const socket = connectOrderFeed(SOCKET_URL, id, token, {
      status: (connected) => {
        setLive(connected);
        // Catch up on anything missed while disconnected.
        if (connected) void refresh();
      },
      order: (next) => {
        if (next.id !== id) return;
        const prev = orderRef.current;
        apply(next);
        // The push carries no rider details — fetch them when a rider gets assigned.
        if (next.riderId && next.riderId !== prev?.riderId) void refresh();
      },
    });
    socket.io.reconnectionDelay(2000).reconnectionDelayMax(15000);
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      setLive(false);
    };
  }, [id, token, finished, refresh, apply]);

  // 4. Fallback poll while the socket is down (and the order still active).
  useEffect(() => {
    if (!token || live || finished) return;
    const t = setInterval(() => {
      if (AppState.currentState === 'active') void refresh();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [token, live, finished, refresh]);

  return { order, rider, loading: loading && !order, error, live, unknown, refresh };
}
