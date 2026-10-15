import { Ionicons } from '@expo/vector-icons'
import { orderTotal, type FlowOrder } from '@restaurantos/contracts'
import { router } from 'expo-router'
import { useState, type ComponentProps } from 'react'
import { FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { RetryLoad } from '@/components/chrome'
import { Button, Card, EmptyState, ItemLines, Loading, OrderNote, PullToRefresh, StatusBadge } from '@/components/ui'
import { formatCurrency, timeAgo } from '@/lib/format'
import { RIDER_STEPS, riderStep, riderView } from '@/lib/selectors'
import { colors, radius } from '@/lib/theme'
import { useAuth } from '@/state/auth'
import { useFlow } from '@/state/flow'
import { useToast } from '@/state/toast'

export default function DeliveriesScreen() {
  const { user } = useAuth()
  const { flow, loaded, loadError } = useFlow()
  if (!loaded) return loadError ? <RetryLoad /> : <Loading label="Loading deliveries…" />
  const { active } = riderView(flow, user?.riderId)

  return (
    <FlatList
      data={active}
      keyExtractor={(o) => o.id}
      contentContainerStyle={{ padding: 16, gap: 14, flexGrow: 1 }}
      refreshControl={<PullToRefresh />}
      ListEmptyComponent={<EmptyState icon="bicycle" title="No deliveries right now" body="Stay online — your phone will buzz when the counter assigns you one." />}
      renderItem={({ item }) => <DeliveryCard o={item} />}
    />
  )
}

function DeliveryCard({ o }: { o: FlowOrder }) {
  const notify = useToast()
  const [showItems, setShowItems] = useState(false)
  const step = riderStep(o)
  const address = o.customer?.address ?? ''
  const phone = o.customer?.phone ?? ''
  const itemCount = o.items.reduce((s, i) => s + i.qty, 0)

  const open = (url: string, what: string) => Linking.openURL(url).catch(() => notify(`Could not open ${what} on this device`, 'error'))
  const call = () => phone && void open(`tel:${phone.replace(/[^\d+]/g, '')}`, 'the phone app')
  const navigate = () => address && void open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}&travelmode=driving`, 'maps')

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <View style={styles.head}>
        <Text style={styles.orderNo}>#{o.orderNo}</Text>
        <StatusBadge status={o.status} />
        <Text style={styles.total}>{formatCurrency(orderTotal(o))}</Text>
      </View>

      <View style={styles.steps}>
        {RIDER_STEPS.map((s, i) => (
          <View key={s} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <View style={[styles.stepBar, { backgroundColor: i <= step ? colors.brand : colors.border }]} />
            <Text style={[styles.stepText, i <= step && { color: colors.brand, fontWeight: '700' }]}>{s}</Text>
          </View>
        ))}
      </View>

      <View style={{ padding: 16, gap: 10 }}>
        <Text style={styles.customer}>{o.customer?.name ?? 'Customer'}</Text>
        <Row icon="location-outline" text={address || 'No address'} />
        <Row icon="call-outline" text={phone || 'No phone'} />
        <Row icon="wallet-outline" text={`Collect by ${o.payOnDelivery ?? 'Cash'}`} bold />
        <Row icon="time-outline" text={`Ordered ${timeAgo(o.createdAt)}`} />
        <Pressable onPress={() => setShowItems((v) => !v)} style={styles.itemsToggle}>
          <Text style={styles.itemsToggleText}>{itemCount} items</Text>
          <Ionicons name={showItems ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
        </Pressable>
        <OrderNote order={o} />
        {showItems && <ItemLines order={o} showPrices />}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button title="Call" icon="call" variant="outline" disabled={!phone} onPress={call} style={{ flex: 1 }} />
          <Button title="Navigate" icon="navigate" variant="outline" disabled={!address} onPress={navigate} style={{ flex: 1 }} />
        </View>
      </View>

      <View style={styles.foot}>
        {step === 0 && <Text style={styles.wait}>Kitchen is preparing — head to the counter (~{Math.max(1, o.predictedMins - 2)} min).</Text>}
        {step === 1 && (
          <Button
            title={o.status === 'Packed' ? 'Scan to pick up' : 'Ready at counter — scan to pick up'}
            icon="qr-code-outline"
            size="lg"
            onPress={() => router.push({ pathname: '/scan/[orderId]', params: { orderId: o.id } })}
          />
        )}
        {step === 2 && <Button title="Collect payment" icon="cash-outline" variant="success" size="lg" onPress={() => router.push({ pathname: '/collect/[orderId]', params: { orderId: o.id } })} />}
      </View>
    </Card>
  )
}

function Row({ icon, text, bold }: { icon: ComponentProps<typeof Ionicons>['name']; text: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      <Ionicons name={icon} size={18} color={colors.faint} style={{ marginTop: 1 }} />
      <Text style={{ flex: 1, fontSize: 15, color: colors.text, fontWeight: bold ? '700' : '400' }}>{text}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  orderNo: { fontSize: 20, fontWeight: '800', color: colors.text },
  total: { marginLeft: 'auto', fontSize: 17, fontWeight: '800', color: colors.text },
  steps: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingTop: 14 },
  stepBar: { height: 6, alignSelf: 'stretch', borderRadius: 3 },
  stepText: { fontSize: 11, color: colors.faint, textAlign: 'center' },
  customer: { fontSize: 17, fontWeight: '800', color: colors.text },
  itemsToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.bg, borderRadius: radius.sm, paddingHorizontal: 12, minHeight: 44 },
  itemsToggleText: { fontSize: 14, fontWeight: '700', color: colors.muted },
  foot: { borderTopWidth: 1, borderTopColor: colors.border, padding: 12 },
  wait: { textAlign: 'center', color: colors.muted, fontSize: 14, paddingVertical: 8 },
})
