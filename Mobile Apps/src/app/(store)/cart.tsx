import type { PayMethod } from '@restaurantos/contracts';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, Field, StateView, Stepper, SummaryRow } from '@/store/components/ui';
import { api, errorMessage } from '@/lib/api';
import { digitsOnly, money } from '@/store/lib/format';
import { storage } from '@/store/lib/storage';
import { colors, radius } from '@/store/lib/theme';
import { unitPrice, useCart } from '@/store/state/cart';
import { useRestaurant } from '@/store/state/restaurant';

type Pay = Extract<PayMethod, 'Cash' | 'Easypaisa'>;

const PAY_OPTIONS: { key: Pay; emoji: string; hint: string }[] = [
  { key: 'Cash', emoji: '💵', hint: 'Pay the rider' },
  { key: 'Easypaisa', emoji: '📱', hint: 'Mobile wallet' },
];

function validate(d: { name: string; phone: string; address: string }) {
  return {
    name: d.name.trim().length < 2 ? 'Please enter your name' : null,
    phone: digitsOnly(d.phone).length < 10 ? 'Enter a phone number with at least 10 digits' : null,
    address: d.address.trim().length < 6 ? 'Please enter your full delivery address' : null,
  };
}

export default function CartScreen() {
  const cart = useCart();
  const { slug, state: store, restaurant, reload: reloadRestaurant } = useRestaurant();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [pay, setPay] = useState<Pay>('Cash');
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Prefill from the last order on this phone.
  useEffect(() => {
    void storage.details().then((d) => {
      if (!d) return;
      setName((v) => v || d.name);
      setPhone((v) => v || d.phone);
      setAddress((v) => v || d.address);
    });
  }, []);

  const errors = validate({ name, phone, address });
  const valid = !errors.name && !errors.phone && !errors.address;
  const deliveryFee = restaurant?.deliveryFee ?? 0;
  const currency = restaurant?.currency;
  const total = cart.subtotal + deliveryFee;

  const placeOrder = async () => {
    setTouched(true);
    if (!valid || cart.lines.length === 0 || submitting || !restaurant?.acceptingOrders) return;
    setSubmitting(true);
    setSubmitError(null);
    const details = { name: name.trim(), phone: phone.trim(), address: address.trim() };
    try {
      // The kitchen note is the order-level note (FlowOrder.notes).
      const res = await api.store.placeOrder(slug, { ...details, pay, items: cart.toOrderItems(), notes: notes.trim() || undefined });
      await Promise.all([
        storage.addOrder({ id: res.order.id, trackingToken: res.trackingToken, order: res.order }),
        storage.saveDetails(details),
      ]);
      // Replace the cart with tracking so "back" goes to the menu.
      router.replace({ pathname: '/track/[id]', params: { id: res.order.id } });
      cart.clear();
    } catch (e) {
      setSubmitError(errorMessage(e));
      // The store may have closed in the meantime — refresh so the screen reflects it.
      void reloadRestaurant();
    } finally {
      setSubmitting(false);
    }
  };

  if (store.status === 'loading') return <StateView loading title="Opening the store…" />;
  if (!restaurant) {
    return (
      <StateView
        emoji="📡"
        title="Couldn't reach the restaurant"
        message={store.status === 'error' ? store.message : undefined}
        action={{ title: 'Try again', onPress: () => void reloadRestaurant() }}
      />
    );
  }
  if (!restaurant.acceptingOrders) {
    return (
      <StateView
        emoji="🔒"
        title={`${restaurant.name} is closed`}
        message="The restaurant isn't taking orders right now. Your cart is kept — please check back a little later."
        action={{ title: 'Check again', onPress: () => void reloadRestaurant() }}
      />
    );
  }

  if (cart.lines.length === 0) {
    return <StateView emoji="🛒" title="Your cart is empty" message="Add a few dishes from the menu to get started." action={{ title: 'Browse menu', onPress: () => router.back() }} />;
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={100}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        <Card style={{ gap: 14 }}>
          <Text style={s.section}>Your order</Text>
          {cart.lines.map((l) => (
            <View key={l.key} style={s.line}>
              <Text style={{ fontSize: 28 }}>{l.item.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.lineName}>{l.item.name}</Text>
                {l.variant ? <Text style={s.lineMeta}>{l.variant}</Text> : null}
                <Text style={s.linePrice}>{money(unitPrice(l.item, l.variant) * l.qty, currency)}</Text>
              </View>
              <Stepper label={l.item.name} qty={l.qty} onMinus={() => cart.setQty(l.key, l.qty - 1)} onPlus={() => cart.setQty(l.key, l.qty + 1)} />
            </View>
          ))}
          <View style={s.divider} />
          <SummaryRow label="Subtotal" value={money(cart.subtotal, currency)} />
          <SummaryRow label="Delivery fee" value={money(deliveryFee, currency)} />
          <SummaryRow label="Total" value={money(total, currency)} strong />
        </Card>

        <Card style={{ gap: 14 }}>
          <Text style={s.section}>Delivery details</Text>
          <Field label="Name" value={name} onChangeText={setName} placeholder="Your name" autoComplete="name" textContentType="name" error={touched ? errors.name : null} />
          <Field
            label="Phone"
            value={phone}
            onChangeText={setPhone}
            placeholder="03xx xxxxxxx"
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            hint="Our assistant will call this number to confirm your order"
            error={touched ? errors.phone : null}
          />
          <Field
            label="Delivery address"
            value={address}
            onChangeText={setAddress}
            placeholder="House, street, area, city"
            multiline
            autoComplete="street-address"
            textContentType="fullStreetAddress"
            error={touched ? errors.address : null}
          />
          <Field label="Note for the kitchen (optional)" value={notes} onChangeText={setNotes} placeholder="e.g. less spicy, no onions" />
        </Card>

        <Card style={{ gap: 12 }}>
          <Text style={s.section}>Pay on delivery</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {PAY_OPTIONS.map((p) => (
              <Pressable
                key={p.key}
                onPress={() => setPay(p.key)}
                accessibilityRole="radio"
                accessibilityState={{ selected: pay === p.key }}
                style={[s.pay, pay === p.key && s.payActive]}>
                <Text style={{ fontSize: 24 }}>{p.emoji}</Text>
                <Text style={[s.payTitle, pay === p.key && { color: colors.brand }]}>{p.key}</Text>
                <Text style={s.payHint}>{p.hint}</Text>
              </Pressable>
            ))}
          </View>
        </Card>

        <View style={s.infoBox}>
          <Text style={{ fontSize: 18 }}>📞</Text>
          <Text style={s.infoText}>After you place the order, our assistant will call you to confirm it before the kitchen starts cooking.</Text>
        </View>

        {submitError && <Text style={s.error}>⚠️ {submitError}</Text>}
      </ScrollView>
      <SafeAreaView edges={['bottom']} style={s.footer}>
        <Button title={`Place order · ${money(total, currency)}`} onPress={() => void placeOrder()} loading={submitting} disabled={touched && !valid} />
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  section: { fontSize: 16, fontWeight: '800', color: colors.ink },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  lineName: { fontSize: 14, fontWeight: '700', color: colors.ink },
  lineMeta: { fontSize: 12, color: colors.muted },
  linePrice: { fontSize: 13, color: colors.brand, fontWeight: '700', marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.line },
  pay: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 14, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.line, backgroundColor: '#fff' },
  payActive: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  payTitle: { fontSize: 15, fontWeight: '700', color: colors.ink },
  payHint: { fontSize: 11, color: colors.muted },
  infoBox: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: colors.violetSoft, borderRadius: radius.md, padding: 14, borderWidth: 1, borderColor: colors.violetRing },
  infoText: { flex: 1, fontSize: 13, color: colors.violet, lineHeight: 18 },
  error: { color: colors.red, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  footer: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.line },
});
