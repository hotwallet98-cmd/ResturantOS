import { Ionicons } from '@expo/vector-icons'
import { orderTotal } from '@restaurantos/contracts'
import { Redirect, router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAction } from '@/components/chrome'
import { Button, EmptyState, ItemLines, Loading } from '@/components/ui'
import { api } from '@/lib/api'
import { EASYPAISA_ACCOUNT } from '@/lib/config'
import { formatCurrency } from '@/lib/format'
import { colors, radius } from '@/lib/theme'
import { useAuth } from '@/state/auth'
import { useFlow } from '@/state/flow'

type Method = 'Cash' | 'Easypaisa'

/** Collect payment at the door: Cash or Easypaisa (+ optional transaction id) → Delivered. */
export default function CollectPaymentScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>()
  const { user } = useAuth()
  const { flow, loaded, applyOrder } = useFlow()
  const insets = useSafeAreaInsets()
  const { busy, run } = useAction()
  const order = flow.orders.find((o) => o.id === orderId)
  const [method, setMethod] = useState<Method>(order?.payOnDelivery === 'Easypaisa' ? 'Easypaisa' : 'Cash')
  const [txn, setTxn] = useState('')

  if (!user || user.role !== 'rider') return <Redirect href="/" />
  if (!order) return loaded ? <EmptyState icon="alert-circle-outline" title="Order not found" /> : <Loading />
  const total = orderTotal(order)

  const finish = () =>
    void run(
      'deliver',
      async () => {
        applyOrder(await api.orders.deliver(order.id, { method, ...(method === 'Easypaisa' && txn.trim() ? { txnId: txn.trim() } : {}) }))
        router.back()
      },
      { success: `#${order.orderNo} delivered · ${formatCurrency(total)} by ${method}`, alertOnError: true },
    )

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
        <View style={styles.amountBox}>
          <Text style={styles.amountLabel}>
            #{order.orderNo} · {order.customer?.name ?? 'Customer'}
          </Text>
          <Text style={styles.amount}>{formatCurrency(total)}</Text>
          {order.payOnDelivery && <Text style={styles.amountLabel}>Customer chose {order.payOnDelivery}</Text>}
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          {(['Cash', 'Easypaisa'] as const).map((m) => {
            const on = method === m
            return (
              <Pressable key={m} onPress={() => setMethod(m)} style={[styles.method, on && styles.methodOn]} accessibilityRole="radio" accessibilityState={{ checked: on }}>
                <Ionicons name={m === 'Cash' ? 'cash-outline' : 'phone-portrait-outline'} size={28} color={on ? colors.brand : colors.muted} />
                <Text style={[styles.methodText, on && { color: colors.brand }]}>{m}</Text>
              </Pressable>
            )
          })}
        </View>

        {method === 'Easypaisa' ? (
          <View style={styles.easy}>
            <Text style={styles.easyText}>
              Ask the customer to send <Text style={{ fontWeight: '800' }}>{formatCurrency(total)}</Text> to Easypaisa{' '}
              <Text style={{ fontWeight: '800' }}>{EASYPAISA_ACCOUNT.number}</Text> ({EASYPAISA_ACCOUNT.title}).
            </Text>
            <TextInput value={txn} onChangeText={setTxn} placeholder="Transaction ID (optional)" placeholderTextColor={colors.faint} autoCapitalize="characters" style={styles.input} />
          </View>
        ) : (
          <Text style={styles.cashHint}>Count the cash before handing over the order. It is added to your cash in hand.</Text>
        )}

        <View style={styles.items}>
          <ItemLines order={order} showPrices />
        </View>

        <Button
          title={method === 'Cash' ? 'Cash received — delivered' : 'Payment received — delivered'}
          icon="checkmark-circle"
          variant="success"
          size="lg"
          loading={busy === 'deliver'}
          disabled={order.status !== 'PickedUp'}
          onPress={finish}
        />
        {order.status !== 'PickedUp' && <Text style={styles.cashHint}>Scan the bag at the counter before collecting payment.</Text>}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  amountBox: { backgroundColor: colors.dark, borderRadius: radius.xl, padding: 20, alignItems: 'center', gap: 4 },
  amountLabel: { color: '#c4c8d0', fontSize: 14 },
  amount: { color: '#fff', fontSize: 40, fontWeight: '900' },
  method: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 18, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border, backgroundColor: '#fff' },
  methodOn: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  methodText: { fontSize: 16, fontWeight: '800', color: colors.muted },
  easy: { backgroundColor: colors.successSoft, borderRadius: radius.lg, padding: 14, gap: 12 },
  easyText: { color: '#054f31', fontSize: 15, lineHeight: 21 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#a6f4c5', borderRadius: radius.md, minHeight: 50, paddingHorizontal: 14, fontSize: 16, color: colors.text },
  cashHint: { color: colors.muted, fontSize: 14, textAlign: 'center' },
  items: { backgroundColor: '#fff', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 14 },
})
