import { Ionicons } from '@expo/vector-icons'
import { orderTotal, type FlowOrder, type FlowTable, type Reservation } from '@restaurantos/contracts'
import { router } from 'expo-router'
import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { api } from '@/lib/api'
import { clockTime, formatCurrency, timeAgo } from '@/lib/format'
import { tableOrders } from '@/lib/selectors'
import { colors, radius } from '@/lib/theme'
import { useFlow } from '@/state/flow'
import { useAction } from './chrome'
import { Button, Card, ItemLines, OrderNote, Pill, SectionLabel, Sheet, StatusBadge, Stepper } from './ui'

/** Picked up → Served actions for one dine-in order. */
export function OrderActions({ o, size = 'md' }: { o: FlowOrder; size?: 'sm' | 'md' }) {
  const { applyOrder } = useFlow()
  const { busy, run } = useAction()
  const alertOnError = size === 'sm' // small buttons live inside the table sheet (a Modal)
  if (o.status === 'Ready')
    return (
      <Button
        title="Picked up from kitchen"
        icon="hand-left-outline"
        variant="success"
        size={size}
        loading={busy === 'pick'}
        onPress={() => void run('pick', () => api.orders.setStatus(o.id, 'PickedUp').then(applyOrder), { success: `Picked up #${o.orderNo}`, alertOnError })}
      />
    )
  if (o.status === 'PickedUp')
    return (
      <Button
        title="Mark as served"
        icon="restaurant-outline"
        size={size}
        loading={busy === 'serve'}
        onPress={() => void run('serve', () => api.orders.setStatus(o.id, 'Served').then(applyOrder), { success: `#${o.orderNo} served at table ${o.table ?? ''}`, alertOnError })}
      />
    )
  return null
}

export function OrderCard({ o, tableName }: { o: FlowOrder; tableName?: string }) {
  return (
    <Card highlight={o.status === 'Ready' ? '#47cd89' : undefined} style={{ gap: 10 }}>
      <View style={styles.row}>
        <Text style={styles.orderNo}>#{o.orderNo}</Text>
        <Pill text={`Table ${tableName ?? o.table ?? '—'}`} />
        <Text style={styles.muted}>{timeAgo(o.createdAt)}</Text>
        <View style={{ marginLeft: 'auto' }}>
          <StatusBadge status={o.status} />
        </View>
      </View>
      <ItemLines order={o} />
      <OrderNote order={o} />
      <OrderActions o={o} />
    </Card>
  )
}

/** Table actions: seat (reservation check / walk-in), take order, picked up / served, ask for bill, mark clean. */
export function TableSheet({ table, me, onClose }: { table: FlowTable; me: string; onClose: () => void }) {
  const { flow, applyTable } = useFlow()
  const { busy, run } = useAction()
  const orders = tableOrders(flow, table.id)
  const total = orders.reduce((s, o) => s + orderTotal(o), 0)
  const subtitle = `${table.area} · ${table.seats} seats · ${table.status}${table.server ? ` · ${table.server === me ? 'your table' : table.server}` : ''}`

  const takeOrder = () => {
    onClose()
    router.push({ pathname: '/take-order/[tableId]', params: { tableId: table.id } })
  }

  return (
    <Sheet visible onClose={onClose} title={`Table ${table.name}`} subtitle={subtitle}>
      {(table.status === 'Available' || table.status === 'Reserved') && <SeatForm table={table} />}

      {table.status === 'Occupied' && (
        <>
          <View style={styles.guestBox}>
            <Ionicons name="people-outline" size={18} color={colors.muted} />
            <Text style={{ flex: 1, fontSize: 15, color: colors.text }}>
              <Text style={{ fontWeight: '700' }}>{table.guestName || 'Guests'}</Text> · {table.guests ?? '?'} guests
            </Text>
            {!!table.seatedAt && <Text style={styles.muted}>seated {timeAgo(table.seatedAt)}</Text>}
          </View>
          {orders.length === 0 ? (
            <Text style={[styles.muted, { textAlign: 'center', paddingVertical: 8 }]}>No order yet — tap Take order.</Text>
          ) : (
            orders.map((o) => (
              <View key={o.id} style={styles.sheetOrder}>
                <View style={styles.row}>
                  <Text style={styles.orderNo}>#{o.orderNo}</Text>
                  <View style={{ marginLeft: 'auto' }}>
                    <StatusBadge status={o.status} />
                  </View>
                </View>
                <ItemLines order={o} />
                <OrderNote order={o} />
                <OrderActions o={o} size="sm" />
              </View>
            ))
          )}
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <Text style={styles.muted}>Running total</Text>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{formatCurrency(total)}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title="Take order" icon="add-circle-outline" onPress={takeOrder} style={{ flex: 1 }} />
            <Button
              title={table.billRequested ? 'Bill requested' : 'Ask for bill'}
              icon="document-text-outline"
              variant="outline"
              disabled={!orders.length || table.billRequested}
              loading={busy === 'bill'}
              style={{ flex: 1 }}
              onPress={() =>
                void run('bill', () => api.tables.requestBill(table.id).then(applyTable), { success: `Bill requested for ${table.name} — counter notified`, alertOnError: true }).then((ok) => ok && onClose())
              }
            />
          </View>
        </>
      )}

      {table.status === 'Cleaning' && (
        <>
          <Text style={styles.muted}>Guests have left. Once the table is wiped and reset, mark it available.</Text>
          <Button
            title="Mark clean & available"
            icon="sparkles-outline"
            size="lg"
            loading={busy === 'clean'}
            onPress={() =>
              void run('clean', () => api.tables.setStatus(table.id, 'Available').then(applyTable), { success: `${table.name} is ready for guests`, alertOnError: true }).then((ok) => ok && onClose())
            }
          />
        </>
      )}
    </Sheet>
  )
}

function SeatForm({ table }: { table: FlowTable }) {
  const { flow, applyTable } = useFlow()
  const { busy, run } = useAction()
  const [openedAt] = useState(() => Date.now())
  // Upcoming reservations (±3h), the ones for this table first.
  const upcoming = useMemo<Reservation[]>(
    () =>
      flow.reservations
        .filter((r) => (r.status === 'Confirmed' || r.status === 'Pending') && Math.abs(new Date(r.time).getTime() - openedAt) < 3 * 3600_000)
        .sort((a, b) => (a.table === table.id ? -1 : b.table === table.id ? 1 : a.time.localeCompare(b.time))),
    [flow.reservations, table.id, openedAt],
  )
  const forThisTable = upcoming.find((r) => r.table === table.id || r.id === table.reservationId)
  const [mode, setMode] = useState<'reservation' | 'walkin'>(table.status === 'Reserved' || forThisTable ? 'reservation' : 'walkin')
  const [resId, setResId] = useState(forThisTable?.id ?? upcoming[0]?.id ?? '')
  const [guests, setGuests] = useState(Math.min(2, table.seats))
  const [name, setName] = useState('')

  const seat = () => {
    const r = upcoming.find((x) => x.id === resId)
    const body = mode === 'reservation' && r ? { guests: r.party, guestName: r.guest, reservationId: r.id } : { guests, guestName: name.trim() || 'Walk-in' }
    void run('seat', () => api.tables.seat(table.id, body).then(applyTable), { success: `Table ${table.name} seated — menu given`, alertOnError: true })
  }

  return (
    <>
      <SectionLabel>Check reservation</SectionLabel>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {(['reservation', 'walkin'] as const).map((m) => (
          <Pressable key={m} onPress={() => setMode(m)} style={[styles.modeBtn, mode === m && styles.modeBtnActive]} accessibilityState={{ selected: mode === m }}>
            <Ionicons name={m === 'reservation' ? 'calendar-outline' : 'person-add-outline'} size={20} color={mode === m ? colors.brand : colors.muted} />
            <Text style={[styles.modeText, mode === m && { color: colors.brand }]}>{m === 'reservation' ? 'Reserved' : 'Walk-in'}</Text>
          </Pressable>
        ))}
      </View>

      {mode === 'reservation' ? (
        upcoming.length ? (
          <View style={{ gap: 8 }}>
            {upcoming.map((r) => {
              const sel = resId === r.id
              return (
                <Pressable key={r.id} onPress={() => setResId(r.id)} style={[styles.resRow, sel && styles.modeBtnActive]} accessibilityRole="radio" accessibilityState={{ checked: sel }}>
                  <Ionicons name={sel ? 'radio-button-on' : 'radio-button-off'} size={22} color={sel ? colors.brand : colors.faint} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{r.guest}</Text>
                    <Text style={styles.muted}>
                      {r.party} guests · {clockTime(r.time)}
                      {r.table ? ` · ${r.table}` : ''}
                      {r.occasion ? ` · ${r.occasion}` : ''}
                      {r.notes ? ` · ${r.notes}` : ''}
                    </Text>
                  </View>
                  {r.table === table.id && <Pill text="THIS TABLE" bg={colors.infoSoft} fg={colors.info} />}
                </Pressable>
              )
            })}
          </View>
        ) : (
          <Text style={styles.emptyBox}>No reservations in the next 3 hours. Seat as walk-in.</Text>
        )
      ) : (
        <View style={{ gap: 12 }}>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <Text style={{ fontSize: 16, color: colors.text, fontWeight: '600' }}>Guests</Text>
            <Stepper value={guests} onChange={setGuests} min={1} max={table.seats + 2} />
          </View>
          <TextInput value={name} onChangeText={setName} placeholder="Guest name (optional)" placeholderTextColor={colors.faint} style={styles.input} />
        </View>
      )}
      <Button title="Seat & give menu" icon="checkmark-circle-outline" size="lg" disabled={mode === 'reservation' && !resId} loading={busy === 'seat'} onPress={seat} />
    </>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  orderNo: { fontSize: 17, fontWeight: '800', color: colors.text },
  muted: { fontSize: 13, color: colors.muted },
  guestBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.bg, borderRadius: radius.md, padding: 12 },
  sheetOrder: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, gap: 8 },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modeBtnActive: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  modeText: { fontSize: 15, fontWeight: '700', color: colors.muted },
  resRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, minHeight: 56 },
  emptyBox: { backgroundColor: colors.bg, borderRadius: radius.md, padding: 16, textAlign: 'center', color: colors.muted, fontSize: 14 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, minHeight: 50, paddingHorizontal: 14, fontSize: 16, color: colors.text },
})
