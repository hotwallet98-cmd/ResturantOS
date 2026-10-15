import { router } from 'expo-router'
import { FlatList } from 'react-native'
import { RetryLoad } from '@/components/chrome'
import { Button, EmptyState, Loading, PullToRefresh } from '@/components/ui'
import { OrderCard } from '@/components/waiter'
import { waiterView } from '@/lib/selectors'
import { useAuth } from '@/state/auth'
import { useFlow } from '@/state/flow'

/** My open dine-in orders: Sent to kitchen → Preparing → Ready → Picked up. */
export default function MyOrdersScreen() {
  const { user } = useAuth()
  const { flow, loaded, loadError } = useFlow()
  if (!loaded) return loadError ? <RetryLoad /> : <Loading label="Loading orders…" />
  const { active } = waiterView(flow, user?.name ?? '')
  const tableName = (id?: string) => flow.tables.find((t) => t.id === id)?.name

  return (
    <FlatList
      data={active}
      keyExtractor={(o) => o.id}
      contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
      refreshControl={<PullToRefresh />}
      ListEmptyComponent={
        <EmptyState
          icon="receipt-outline"
          title="No open orders"
          body="Open one of your tables to take an order."
          action={<Button title="Go to tables" variant="outline" onPress={() => router.navigate('/waiter')} style={{ marginTop: 8 }} />}
        />
      }
      renderItem={({ item }) => <OrderCard o={item} tableName={tableName(item.table)} />}
    />
  )
}
