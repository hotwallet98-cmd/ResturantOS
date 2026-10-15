import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FlowOrder } from '@restaurantos/contracts';

const ORDERS_KEY = 'ros.customer.orders.v1';
const DETAILS_KEY = 'ros.customer.details.v1';

/** What we keep locally for each order placed from this phone. */
export interface SavedOrder {
  id: string;
  trackingToken: string;
  /** Last known snapshot, refreshed from the track endpoint / socket. */
  order: FlowOrder;
}

export interface SavedDetails {
  name: string;
  phone: string;
  address: string;
}

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function writeJson(key: string, value: unknown) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — non-fatal */
  }
}

export const storage = {
  orders: () => readJson<SavedOrder[]>(ORDERS_KEY, []),
  getOrder: async (id: string) => (await storage.orders()).find((o) => o.id === id),
  async addOrder(entry: SavedOrder) {
    const list = await storage.orders();
    await writeJson(ORDERS_KEY, [entry, ...list.filter((o) => o.id !== entry.id)].slice(0, 50));
  },
  async updateOrder(order: FlowOrder) {
    const list = await storage.orders();
    if (!list.some((o) => o.id === order.id)) return;
    await writeJson(
      ORDERS_KEY,
      list.map((o) => (o.id === order.id ? { ...o, order } : o)),
    );
  },
  details: () => readJson<SavedDetails | null>(DETAILS_KEY, null),
  saveDetails: (d: SavedDetails) => writeJson(DETAILS_KEY, d),
};
