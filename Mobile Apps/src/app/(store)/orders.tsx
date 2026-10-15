import { orderTotal } from '@restaurantos/contracts';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { StateView } from '@/store/components/ui';
import { api } from '@/lib/api';
import { money, timeAgo } from '@/store/lib/format';
import { customerStatus, isFinished } from '@/store/lib/status';
import { storage, type SavedOrder } from '@/store/lib/storage';
import { colors, radius, shadow } from '@/store/lib/theme';

export default function OrdersScreen() {
  const [orders, setOrders] = useState<SavedOrder[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);

  /** Show cached snapshots immediately, then refresh active orders from the track endpoint. */
  const load = useCallback(async () => {
    const saved = await storage.orders();
    setOrders(saved);
    const active = saved.filter((o) => !isFinished(o.order));
    if (active.length === 0) return;
    const results = await Promise.allSettled(active.map((o) => api.store.track(o.id, o.trackingToken)));
    let failed = false;
    for (const r of results) {
      if (r.status === 'fulfilled') await storage.updateOrder(r.value.order);
      else failed = true;
    }
    setOffline(failed);
    setOrders(await storage.orders());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (orders === null) return <StateView loading title="Loading your orders…" />;
  if (orders.length === 0) {
    return <StateView emoji="🧾" title="No orders yet" message="Orders you place from this phone will show up here." action={{ title: 'Browse menu', onPress: () => router.dismissTo('/menu') }} />;
  }

  return (
    <FlatList
      data={orders}
      keyExtractor={(o) => o.id}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={colors.brand}
          colors={[colors.brand]}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
      ListHeaderComponent={offline ? <Text style={s.offline}>⚠️ Couldn't refresh some orders — showing last known status.</Text> : null}
      renderItem={({ item: { id, order } }) => {
        const st = customerStatus(order);
        const finished = isFinished(order);
        return (
          <Pressable
            onPress={() => router.push({ pathname: '/track/[id]', params: { id } })}
            style={({ pressed }) => [s.row, pressed && { opacity: 0.85 }]}
            accessibilityRole="button">
            <View style={[s.icon, finished && { backgroundColor: '#f3f4f6' }]}>
              <Text style={{ fontSize: 22 }}>{st.emoji}</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.title}>
                #{order.orderNo} · {money(orderTotal(order))}
              </Text>
              <Text style={[s.status, { color: order.status === 'Cancelled' ? colors.red : finished ? colors.muted : colors.brand }]}>{st.title}</Text>
              <Text style={s.meta} numberOfLines={1}>
                {order.items.map((i) => `${i.qty}× ${i.name}`).join(', ')} · {timeAgo(order.createdAt)}
              </Text>
            </View>
            <Text style={s.chevron}>›</Text>
          </Pressable>
        );
      }}
    />
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: radius.lg, padding: 14, ...shadow },
  icon: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '800', color: colors.ink },
  status: { fontSize: 13, fontWeight: '700' },
  meta: { fontSize: 12, color: colors.muted },
  chevron: { fontSize: 26, color: colors.faint },
  offline: { color: colors.red, fontSize: 13, marginBottom: 6 },
});
