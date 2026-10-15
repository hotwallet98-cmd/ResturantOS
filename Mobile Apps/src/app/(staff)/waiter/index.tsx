import { Ionicons } from '@expo/vector-icons'
import type { FloorArea, TableStatus } from '@restaurantos/contracts'
import { router } from 'expo-router'
import { useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { RetryLoad } from '@/components/chrome'
import { Chip, ChipRow, EmptyState, Loading, PullToRefresh } from '@/components/ui'
import { TableSheet } from '@/components/waiter'
import { tableTone } from '@/lib/format'
import { tableOrders, waiterView } from '@/lib/selectors'
import { colors, radius } from '@/lib/theme'
import { useAuth } from '@/state/auth'
import { useFlow } from '@/state/flow'

const AREAS: ('All' | FloorArea)[] = ['All', 'Main Hall', 'Terrace', 'Family', 'VIP']
const STATUSES: TableStatus[] = ['Available', 'Occupied', 'Reserved', 'Cleaning']

export default function TablesScreen() {
  const { user } = useAuth()
  const me = user?.name ?? ''
  const { flow, loaded, loadError } = useFlow()
  const [area, setArea] = useState<(typeof AREAS)[number]>('All')
  const [openId, setOpenId] = useState<string | null>(null)
  const { width } = useWindowDimensions()
  const cols = width >= 600 ? 5 : 3

  if (!loaded) return loadError ? <RetryLoad /> : <Loading label="Loading tables…" />

  const { ready } = waiterView(flow, me)
  const tables = flow.tables.filter((t) => area === 'All' || t.area === area)
  const open = flow.tables.find((t) => t.id === openId)
  const tileWidth = (width - 32 - (cols - 1) * 10) / cols

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        key={cols}
        data={tables}
        numColumns={cols}
        keyExtractor={(t) => t.id}
        columnWrapperStyle={{ gap: 10, paddingHorizontal: 16 }}
        contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
        refreshControl={<PullToRefresh />}
        ListHeaderComponent={
          <View style={{ gap: 12, paddingTop: 12, marginBottom: 2 }}>
            {ready.length > 0 && (
              <Pressable onPress={() => router.navigate('/waiter/ready')} style={styles.readyBanner}>
                <Ionicons name="notifications" size={20} color="#fff" />
                <Text style={styles.readyText}>
                  {ready.length} order{ready.length > 1 ? 's' : ''} ready — pick up from kitchen
                </Text>
                <Ionicons name="chevron-forward" size={18} color="#fff" />
              </Pressable>
            )}
            <ChipRow>
              {AREAS.map((a) => (
                <Chip key={a} label={a} active={area === a} onPress={() => setArea(a)} />
              ))}
            </ChipRow>
            <View style={styles.legend}>
              {STATUSES.map((s) => (
                <View key={s} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: tableTone[s].dot }]} />
                  <Text style={styles.legendText}>{s}</Text>
                </View>
              ))}
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: 'transparent', borderWidth: 2, borderColor: colors.dark }]} />
                <Text style={styles.legendText}>Mine</Text>
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={<EmptyState icon="grid-outline" title="No tables here" body={area === 'All' ? 'No tables are set up for this branch yet.' : `No tables in ${area}.`} />}
        renderItem={({ item: t }) => {
          const tone = tableTone[t.status]
          const mine = t.server === me
          const isReady = tableOrders(flow, t.id).some((o) => o.status === 'Ready')
          return (
            <Pressable
              onPress={() => setOpenId(t.id)}
              accessibilityRole="button"
              accessibilityLabel={`Table ${t.name}, ${t.status}${mine ? ', your table' : ''}${isReady ? ', order ready' : ''}${t.billRequested ? ', bill requested' : ''}`}
              style={({ pressed }) => [
                styles.tile,
                { width: tileWidth, backgroundColor: tone.bg, borderColor: mine ? colors.dark : tone.border, borderWidth: mine ? 2.5 : 1 },
                pressed && { opacity: 0.8 },
              ]}
            >
              <View style={styles.tileIcons}>
                {t.billRequested && <Ionicons name="document-text" size={16} color={colors.brand} />}
                {isReady && <View style={styles.readyDot} />}
              </View>
              <Text style={[styles.tileName, { color: tone.fg }]}>{t.name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="people-outline" size={13} color={tone.fg} />
                <Text style={[styles.tileMeta, { color: tone.fg }]}>{t.status === 'Occupied' ? `${t.guests ?? '?'}/${t.seats}` : t.seats}</Text>
              </View>
              <Text style={[styles.tileStatus, { color: tone.fg }]} numberOfLines={1}>
                {t.status === 'Occupied' ? (mine ? 'Mine' : (t.server ?? 'Occupied')) : t.status === 'Available' ? 'Free' : t.status}
              </Text>
            </Pressable>
          )
        }}
      />
      {open && <TableSheet table={open} me={me} onClose={() => setOpenId(null)} />}
    </View>
  )
}

const styles = StyleSheet.create({
  readyBanner: {
    marginHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.success,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    minHeight: 50,
  },
  readyText: { flex: 1, color: '#fff', fontWeight: '700', fontSize: 15 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 11, height: 11, borderRadius: 6 },
  legendText: { fontSize: 12, color: colors.muted },
  tile: { borderRadius: radius.md, padding: 12, minHeight: 96, justifyContent: 'space-between' },
  tileIcons: { position: 'absolute', top: 8, right: 8, flexDirection: 'row', gap: 4, alignItems: 'center' },
  readyDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#12b76a', borderWidth: 2, borderColor: '#fff' },
  tileName: { fontSize: 22, fontWeight: '800' },
  tileMeta: { fontSize: 13, fontWeight: '600' },
  tileStatus: { fontSize: 12, fontWeight: '700', marginTop: 2 },
})
