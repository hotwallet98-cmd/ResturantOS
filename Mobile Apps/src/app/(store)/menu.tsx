import type { MenuItem } from '@restaurantos/contracts';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StaffEntryButton } from '@/components/staff-entry';

import { Chip, StateView, Stepper } from '@/store/components/ui';
import { api, errorMessage } from '@/lib/api';
import { money } from '@/store/lib/format';
import { customerStatus, isFinished } from '@/store/lib/status';
import { storage, type SavedOrder } from '@/store/lib/storage';
import { colors, radius, shadow } from '@/store/lib/theme';
import { defaultVariant, unitPrice, useCart } from '@/store/state/cart';
import { etaText, useRestaurant } from '@/store/state/restaurant';

export default function MenuScreen() {
  const cart = useCart();
  const { slug, state: store, restaurant, reload: reloadRestaurant } = useRestaurant();
  const open = !!restaurant?.acceptingOrders;
  const currency = restaurant?.currency;
  const [menu, setMenu] = useState<MenuItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [cat, setCat] = useState('All');
  const [q, setQ] = useState('');
  const [variants, setVariants] = useState<Record<string, string>>({});
  const [myOrders, setMyOrders] = useState<SavedOrder[]>([]);

  const load = useCallback(async () => {
    try {
      setError(null);
      setMenu(await api.store.menu(slug));
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [slug]);

  // The menu is only fetched once we know the store exists and takes orders.
  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  useFocusEffect(
    useCallback(() => {
      void storage.orders().then(setMyOrders);
    }, []),
  );

  const available = useMemo(() => (menu ?? []).filter((m) => m.available), [menu]);
  const categories = useMemo(() => ['All', ...Array.from(new Set(available.map((m) => m.category)))], [available]);
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return available.filter(
      (m) =>
        (cat === 'All' || m.category === cat) &&
        (!needle || m.name.toLowerCase().includes(needle) || m.description.toLowerCase().includes(needle)),
    );
  }, [available, cat, q]);

  const activeOrder = myOrders.find((o) => !isFinished(o.order));

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([load(), reloadRestaurant()]);
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={s.header}>
        <View style={s.logo}>
          <Text style={{ fontSize: 22 }}>🍛</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.brand} numberOfLines={1}>
            {restaurant?.name ?? (store.status === 'loading' ? ' ' : 'RestaurantOS')}
          </Text>
          {restaurant ? (
            <Text style={s.sub}>
              {open ? `🛵 Delivery in ${etaText(restaurant)} · ${money(restaurant.deliveryFee, currency)} fee` : '🔒 Not taking orders right now'}
            </Text>
          ) : null}
        </View>
        {myOrders.length > 0 && (
          <Pressable onPress={() => router.push('/orders')} style={s.ordersBtn} accessibilityRole="button">
            <Text style={s.ordersBtnText}>🧾 My orders</Text>
          </Pressable>
        )}
        <StaffEntryButton />
      </View>

      {store.status === 'loading' ? (
        <StateView loading title="Opening the store…" />
      ) : store.status === 'notFound' ? (
        <StateView
          emoji="🤷"
          title="Restaurant not found"
          message={`There is no restaurant called “${slug}”. Check EXPO_PUBLIC_RESTAURANT_SLUG.`}
          action={{ title: 'Try again', onPress: () => void reloadRestaurant() }}
        />
      ) : store.status === 'error' ? (
        <StateView emoji="📡" title="Couldn't reach the restaurant" message={store.message} action={{ title: 'Try again', onPress: () => void reloadRestaurant() }} />
      ) : !open ? (
        <StateView
          emoji="🔒"
          title={`${store.restaurant.name} is closed`}
          message="The restaurant isn't taking orders right now. Please check back a little later."
          action={{ title: 'Check again', onPress: () => void reloadRestaurant() }}
        />
      ) : menu === null && !error ? (
        <StateView loading title="Loading the menu…" />
      ) : error && menu === null ? (
        <StateView emoji="📡" title="Couldn't load the menu" message={error} action={{ title: 'Try again', onPress: () => void load() }} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 16, paddingBottom: cart.count > 0 ? 120 : 32, gap: 12 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} colors={[colors.brand]} />}
          ListHeaderComponent={
            <View style={{ gap: 12 }}>
              {activeOrder && (
                <Pressable style={s.activeBanner} onPress={() => router.push({ pathname: '/track/[id]', params: { id: activeOrder.id } })}>
                  <Text style={{ fontSize: 22 }}>{customerStatus(activeOrder.order).emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.bannerTitle}>Order #{activeOrder.order.orderNo}</Text>
                    <Text style={s.bannerSub}>{customerStatus(activeOrder.order).title}</Text>
                  </View>
                  <Text style={s.bannerLink}>Track →</Text>
                </Pressable>
              )}
              <View style={s.search}>
                <Text style={{ fontSize: 15 }}>🔍</Text>
                <TextInput
                  value={q}
                  onChangeText={setQ}
                  placeholder="Search biryani, kebab, drinks…"
                  placeholderTextColor={colors.faint}
                  style={s.searchInput}
                  returnKeyType="search"
                  clearButtonMode="while-editing"
                />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginHorizontal: -16 }}>
                <View style={{ width: 8 }} />
                {categories.map((c) => (
                  <Chip key={c} label={c} active={cat === c} onPress={() => setCat(c)} />
                ))}
                <View style={{ width: 8 }} />
              </ScrollView>
              {error && <Text style={s.inlineError}>⚠️ {error}</Text>}
            </View>
          }
          ListEmptyComponent={
            <StateView
              emoji={q ? '🔎' : '🍽️'}
              title={q ? `Nothing matches “${q}”` : 'Nothing available right now'}
              message={q ? 'Try a different search or category.' : 'Please check back a little later.'}
            />
          }
          renderItem={({ item }) => {
            const variant = variants[item.id] ?? defaultVariant(item);
            const qty = cart.qtyOf(item.id, variant);
            const inCart = cart.qtyOfItem(item.id);
            return (
              <View style={[s.tile, inCart > 0 && s.tileActive]}>
                <View style={s.emojiBox}>
                  <Text style={s.emoji}>{item.emoji}</Text>
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={s.itemName} numberOfLines={2}>
                    {item.name}
                  </Text>
                  {item.description ? (
                    <Text style={s.itemDesc} numberOfLines={2}>
                      {item.description}
                    </Text>
                  ) : null}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={s.price}>{money(unitPrice(item, variant), currency)}</Text>
                    {item.veg && <Text style={s.veg}>VEG</Text>}
                  </View>
                  {item.variants.length > 0 && (
                    <View style={s.variants}>
                      {item.variants.map((v) => (
                        <Chip key={v.name} small label={v.name} active={variant === v.name} onPress={() => setVariants((cur) => ({ ...cur, [item.id]: v.name }))} />
                      ))}
                    </View>
                  )}
                </View>
                <View style={{ alignSelf: 'flex-end' }}>
                  <Stepper
                    label={item.name}
                    qty={qty}
                    onMinus={() => cart.change(item, variant, -1)}
                    onPlus={() => cart.change(item, variant, 1)}
                  />
                </View>
              </View>
            );
          }}
        />
      )}

      {cart.count > 0 && open && (
        <SafeAreaView edges={['bottom']} style={s.cartBarWrap}>
          <Pressable style={({ pressed }) => [s.cartBar, pressed && { opacity: 0.9 }]} onPress={() => router.push('/cart')} accessibilityRole="button">
            <View style={s.cartBadge}>
              <Text style={s.cartBadgeText}>{cart.count}</Text>
            </View>
            <Text style={s.cartBarText}>View cart</Text>
            <Text style={s.cartBarTotal}>{money(cart.subtotal, currency)}</Text>
          </Pressable>
        </SafeAreaView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colors.line },
  logo: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  brand: { fontSize: 18, fontWeight: '800', color: colors.ink },
  sub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  ordersBtn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.brandSoft },
  ordersBtnText: { fontSize: 12, fontWeight: '700', color: colors.brand },
  activeBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.ink, borderRadius: radius.md, padding: 14 },
  bannerTitle: { color: '#fff', fontWeight: '700', fontSize: 14 },
  bannerSub: { color: '#c7c9d1', fontSize: 12, marginTop: 2 },
  bannerLink: { color: colors.brand, fontWeight: '700', fontSize: 13 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: radius.md, paddingHorizontal: 14, height: 48, borderWidth: 1, borderColor: colors.line },
  searchInput: { flex: 1, fontSize: 15, color: colors.ink, paddingVertical: 0 },
  inlineError: { color: colors.red, fontSize: 13 },
  tile: { flexDirection: 'row', gap: 12, backgroundColor: '#fff', borderRadius: radius.lg, padding: 12, borderWidth: 1.5, borderColor: 'transparent', ...shadow },
  tileActive: { borderColor: colors.brandRing },
  emojiBox: { width: 76, height: 76, borderRadius: 16, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 42 },
  itemName: { fontSize: 15, fontWeight: '700', color: colors.ink },
  itemDesc: { fontSize: 12, color: colors.muted, lineHeight: 16 },
  price: { fontSize: 15, fontWeight: '800', color: colors.brand },
  veg: { fontSize: 9, fontWeight: '800', color: colors.green, backgroundColor: colors.greenSoft, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  variants: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  cartBarWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  cartBar: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 58, borderRadius: 18, backgroundColor: colors.brand, paddingHorizontal: 16, ...shadow, shadowOpacity: 0.2, elevation: 6 },
  cartBadge: { minWidth: 30, height: 30, borderRadius: 15, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  cartBadgeText: { color: colors.brand, fontWeight: '800', fontSize: 14 },
  cartBarText: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '700' },
  cartBarTotal: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
