import { Ionicons } from '@expo/vector-icons'
import { orderTotal } from '@restaurantos/contracts'
import type { ComponentProps } from 'react'
import { FlatList, StyleSheet, Text, View } from 'react-native'
import { RetryLoad } from '@/components/chrome'
import { Card, EmptyState, Loading, PullToRefresh, styles as ui } from '@/components/ui'
import { clockTime, formatCurrency, isToday } from '@/lib/format'
import { riderView } from '@/lib/selectors'
import { colors } from '@/lib/theme'
import { useAuth } from '@/state/auth'
import { useFlow } from '@/state/flow'

/** Today's completed deliveries + cash in hand / Easypaisa totals. */
export default function TodayScreen() {
  const { user } = useAuth()
  const { flow, loaded, loadError } = useFlow()
  if (!loaded) return loadError ? <RetryLoad /> : <Loading />
  const done = riderView(flow, user?.riderId).delivered.filter((o) => isToday(o.payment?.at ?? o.updatedAt))
  const amount = (method: string) => done.filter((o) => o.payment?.method === method).reduce((s, o) => s + (o.payment?.amount ?? orderTotal(o)), 0)
  const cash = amount('Cash')
  const easypaisa = amount('Easypaisa')

  return (
    <FlatList
      data={done}
      keyExtractor={(o) => o.id}
      contentContainerStyle={{ padding: 16, gap: 10, flexGrow: 1 }}
      refreshControl={<PullToRefresh />}
      ListHeaderComponent={
        <View style={{ gap: 14, marginBottom: 4 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Stat label="Delivered" value={String(done.length)} icon="checkmark-done" />
            <Stat label="Cash in hand" value={formatCurrency(cash)} icon="cash-outline" highlight />
            <Stat label="Easypaisa" value={formatCurrency(easypaisa)} icon="phone-portrait-outline" />
          </View>
          {cash > 0 && <Text style={styles.hint}>Hand {formatCurrency(cash)} cash to the counter at the end of your shift.</Text>}
          {done.length > 0 && <Text style={ui.section}>Completed today</Text>}
        </View>
      }
      ListEmptyComponent={<EmptyState icon="receipt-outline" title="No deliveries completed yet today" body="Completed deliveries and collected payments show up here." />}
      renderItem={({ item: o }) => (
        <Card style={styles.row}>
          <Ionicons name="checkmark-circle" size={24} color={colors.success} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>
              #{o.orderNo} · {o.customer?.name ?? 'Customer'}
            </Text>
            <Text style={styles.sub} numberOfLines={1}>
              {o.customer?.address}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.title}>{formatCurrency(o.payment?.amount ?? orderTotal(o))}</Text>
            <Text style={styles.sub}>
              {o.payment?.method ?? '—'}
              {o.payment ? ` · ${clockTime(o.payment.at)}` : ''}
            </Text>
          </View>
        </Card>
      )}
    />
  )
}

function Stat({ label, value, icon, highlight }: { label: string; value: string; icon: ComponentProps<typeof Ionicons>['name']; highlight?: boolean }) {
  return (
    <View style={[styles.stat, highlight && { backgroundColor: colors.dark, borderColor: colors.dark }]}>
      <Ionicons name={icon} size={20} color={highlight ? colors.brand : colors.muted} />
      <Text style={[styles.statValue, highlight && { color: '#fff' }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[styles.statLabel, highlight && { color: '#c4c8d0' }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  stat: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 12, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 18, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 12, color: colors.muted },
  hint: { fontSize: 13, color: colors.muted, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  sub: { fontSize: 13, color: colors.muted },
})
