import { itemsTotal, orderTotal } from '@restaurantos/contracts';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Card, ItemLines, StateView, SummaryRow } from '@/store/components/ui';
import { money } from '@/store/lib/format';
import { customerStatus, isFinished, TRACK_STEPS } from '@/store/lib/status';
import { colors, radius } from '@/store/lib/theme';
import { useTrackedOrder } from '@/store/lib/useTrackedOrder';

export default function TrackScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { order, rider, loading, error, live, unknown, refresh } = useTrackedOrder(id);
  const [refreshing, setRefreshing] = useState(false);

  if (unknown) {
    return <StateView emoji="🤔" title="Order not found" message="This order wasn't placed from this phone." action={{ title: 'Back to menu', onPress: () => router.dismissTo('/menu') }} />;
  }
  if (loading || !order) {
    return error ? (
      <StateView emoji="📡" title="Couldn't load your order" message={error} action={{ title: 'Try again', onPress: () => void refresh() }} />
    ) : (
      <StateView loading title="Loading your order…" />
    );
  }

  const status = customerStatus(order);
  const verifying = order.status === 'Placed' || order.status === 'Verifying';
  const cancelled = order.status === 'Cancelled';
  const done = isFinished(order);
  const subtotal = itemsTotal(order.items);

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 32 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={colors.brand}
          colors={[colors.brand]}
          onRefresh={async () => {
            setRefreshing(true);
            await refresh();
            setRefreshing(false);
          }}
        />
      }>
      <View style={[s.hero, cancelled && { backgroundColor: colors.red }]}>
        <View style={s.heroTop}>
          <Text style={s.heroOrder}>Order #{order.orderNo}</Text>
          {!done && (
            <View style={s.livePill}>
              <View style={[s.liveDot, { backgroundColor: live ? '#22c55e' : '#f59e0b' }]} />
              <Text style={s.liveText}>{live ? 'Live' : 'Updating every 15s'}</Text>
            </View>
          )}
        </View>
        <Text style={s.heroEmoji}>{status.emoji}</Text>
        <Text style={s.heroTitle}>{status.title}</Text>
        <Text style={s.heroSub}>{status.subtitle}</Text>
        {status.step >= 1 && status.step < 5 && <Text style={s.heroEta}>Arriving in about {order.predictedMins + 15} min</Text>}
      </View>

      {error && <Text style={s.inlineError}>⚠️ {error}</Text>}

      {verifying && <CallCard state={order.call?.state} phone={order.customer?.phone} attempts={order.call?.attempts} />}

      {cancelled ? (
        <View style={s.cancelBox}>
          <Text style={{ fontSize: 22 }}>🚫</Text>
          <Text style={s.cancelText}>This order was cancelled. If you think this is a mistake, please place a new order or call the restaurant.</Text>
        </View>
      ) : (
        <Card>
          {TRACK_STEPS.map((step, i) => {
            const reached = i <= status.step;
            const current = i === status.step;
            return (
              <View key={step.label} style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ alignItems: 'center' }}>
                  <View style={[s.dot, reached ? s.dotDone : s.dotTodo, current && s.dotCurrent]}>
                    <Text style={{ fontSize: 15, opacity: reached ? 1 : 0.45 }}>{step.emoji}</Text>
                  </View>
                  {i < TRACK_STEPS.length - 1 && <View style={[s.rail, { backgroundColor: i < status.step ? colors.brand : colors.line }]} />}
                </View>
                <View style={{ paddingTop: 8, flex: 1 }}>
                  <Text style={[s.stepLabel, reached ? s.stepDone : s.stepTodo]}>{step.label}</Text>
                  {current && !done && <Text style={s.stepNow}>Now</Text>}
                </View>
              </View>
            );
          })}
        </Card>
      )}

      {rider && !done && (
        <Card style={s.riderCard}>
          <View style={s.riderAvatar}>
            <Text style={{ fontSize: 24 }}>🛵</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.riderName}>{rider.name}</Text>
            <Text style={s.riderMeta}>Your rider · {rider.vehicle}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Call ${rider.name}`}
            style={({ pressed }) => [s.callBtn, pressed && { opacity: 0.85 }]}
            onPress={() => void Linking.openURL(`tel:${rider.phone.replace(/[^\d+]/g, '')}`).catch(() => undefined)}>
            <Text style={s.callBtnText}>📞 Call</Text>
          </Pressable>
        </Card>
      )}

      <Card style={{ gap: 12 }}>
        <Text style={s.section}>Your items</Text>
        <ItemLines items={order.items} />
        <View style={{ height: 1, backgroundColor: colors.line }} />
        <SummaryRow label="Subtotal" value={money(subtotal)} />
        <SummaryRow label="Delivery fee" value={money(orderTotal(order) - subtotal)} />
        <SummaryRow label="Total" value={money(orderTotal(order))} strong />
        <Text style={s.meta}>💳 {order.payOnDelivery ?? 'Cash'} on delivery</Text>
        {order.customer?.address ? <Text style={s.meta}>📍 {order.customer.address}</Text> : null}
      </Card>

      {done && (
        <Pressable onPress={() => router.dismissTo('/menu')} style={s.again}>
          <Text style={s.againText}>Order something else →</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

function CallCard({ state, phone, attempts }: { state?: string; phone?: string; attempts?: number }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const noAnswer = state === 'no_answer';
  useEffect(() => {
    if (noAnswer) return;
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1400, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [noAnswer, pulse]);

  const text =
    state === 'talking'
      ? 'Our assistant is on the line with you now.'
      : state === 'confirmed'
        ? 'Thanks — your order is confirmed!'
        : state === 'declined'
          ? 'You declined the order on the call.'
          : noAnswer
            ? `We couldn't reach you on ${phone ?? 'your phone'}. We'll try again shortly — please keep your phone nearby.`
            : `Our assistant is calling ${phone ?? 'you'} to confirm your order.`;

  return (
    <View style={[s.callCard, noAnswer && { backgroundColor: '#fff7ed', borderColor: '#fed7aa' }]}>
      <View style={s.callIconWrap}>
        {!noAnswer && (
          <Animated.View
            style={[
              s.callPulse,
              { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] }) }] },
            ]}
          />
        )}
        <View style={[s.callIcon, noAnswer && { backgroundColor: '#ea580c' }]}>
          <Text style={{ fontSize: 18 }}>{noAnswer ? '📵' : '📞'}</Text>
        </View>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.callText, noAnswer && { color: '#9a3412' }]}>{text}</Text>
        {attempts && attempts > 1 ? <Text style={s.callMeta}>Attempt {attempts}</Text> : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  hero: { backgroundColor: colors.ink, borderRadius: radius.lg, padding: 20, gap: 4 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroOrder: { color: '#9ca3af', fontSize: 13, fontWeight: '600' },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  liveText: { color: '#e5e7eb', fontSize: 11, fontWeight: '600' },
  heroEmoji: { fontSize: 44, marginTop: 8 },
  heroTitle: { color: '#fff', fontSize: 26, fontWeight: '800' },
  heroSub: { color: '#d1d5db', fontSize: 14 },
  heroEta: { color: colors.brand, fontSize: 14, fontWeight: '700', marginTop: 6 },
  inlineError: { color: colors.red, fontSize: 13 },
  callCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.violetSoft, borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: colors.violetRing },
  callIconWrap: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  callPulse: { position: 'absolute', width: 46, height: 46, borderRadius: 23, backgroundColor: colors.violet },
  callIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.violet, alignItems: 'center', justifyContent: 'center' },
  callText: { fontSize: 14, color: '#4c1d95', lineHeight: 20, fontWeight: '500' },
  callMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  cancelBox: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: colors.redSoft, borderColor: colors.redRing, borderWidth: 1, borderRadius: radius.lg, padding: 16 },
  cancelText: { flex: 1, color: colors.red, fontSize: 14, lineHeight: 20 },
  dot: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dotDone: { backgroundColor: colors.brandSoft, borderWidth: 2, borderColor: colors.brand },
  dotTodo: { backgroundColor: '#f3f4f6', borderWidth: 2, borderColor: '#f3f4f6' },
  dotCurrent: { borderWidth: 3, borderColor: colors.brand, backgroundColor: '#fff' },
  rail: { width: 3, height: 22, marginVertical: 3, borderRadius: 2 },
  stepLabel: { fontSize: 15 },
  stepDone: { color: colors.ink, fontWeight: '700' },
  stepTodo: { color: colors.faint },
  stepNow: { fontSize: 12, color: colors.brand, fontWeight: '700' },
  riderCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  riderAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  riderName: { fontSize: 16, fontWeight: '800', color: colors.ink },
  riderMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  callBtn: { backgroundColor: colors.brand, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  callBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  section: { fontSize: 16, fontWeight: '800', color: colors.ink },
  meta: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  again: { alignItems: 'center', padding: 12 },
  againText: { color: colors.brand, fontWeight: '700', fontSize: 15 },
});
