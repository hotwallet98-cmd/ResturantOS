import type { PublicRestaurant } from '@restaurantos/contracts';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { api, ApiError, errorMessage } from '@/lib/api';
import { RESTAURANT_SLUG } from '@/lib/config';

/** The restaurant this app orders from, loaded from `GET /public/restaurants/:slug`. */
export type RestaurantState =
  | { status: 'loading' }
  | { status: 'notFound' }
  | { status: 'error'; message: string }
  | { status: 'ready'; restaurant: PublicRestaurant };

interface RestaurantContextValue {
  slug: string;
  state: RestaurantState;
  /** Set once loaded (also kept while a reload is in flight). */
  restaurant: PublicRestaurant | null;
  reload: () => Promise<void>;
}

const RestaurantContext = createContext<RestaurantContextValue | null>(null);

export function RestaurantProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RestaurantState>({ status: 'loading' });

  const reload = useCallback(async () => {
    try {
      const restaurant = await api.store.restaurant(RESTAURANT_SLUG);
      setState({ status: 'ready', restaurant });
    } catch (e) {
      setState(e instanceof ApiError && e.status === 404 ? { status: 'notFound' } : { status: 'error', message: errorMessage(e) });
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const value = useMemo<RestaurantContextValue>(
    () => ({ slug: RESTAURANT_SLUG, state, restaurant: state.status === 'ready' ? state.restaurant : null, reload }),
    [state, reload],
  );
  return <RestaurantContext.Provider value={value}>{children}</RestaurantContext.Provider>;
}

export function useRestaurant() {
  const ctx = useContext(RestaurantContext);
  if (!ctx) throw new Error('useRestaurant must be used inside <RestaurantProvider>');
  return ctx;
}

/** "Delivery in 30–40 min" */
export const etaText = (r: PublicRestaurant) => `${r.deliveryEtaMins[0]}–${r.deliveryEtaMins[1]} min`;
