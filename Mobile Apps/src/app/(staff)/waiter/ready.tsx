import { SectionList, Text } from 'react-native'
import { RetryLoad } from '@/components/chrome'
import { EmptyState, Loading, PullToRefresh, styles as ui } from '@/components/ui'
import { OrderCard } from '@/components/waiter'
import { waiterView } from '@/lib/selectors'
import { useAuth } from '@/state/auth'
import { useFlow } from '@/state/flow'

/** Ready at the kitchen pass → Picked up → Served. */
export default function ReadyScreen() {
  const { user } = useAuth()
  const { flow, loaded, loadError } = useFlow()
  if (!loaded) return loadError ? <RetryLoad /> : <Loading />
  const { ready, pickedUp } = waiterView(flow, user?.name ?? '')
  const tableName = (id?: string) => flow.tables.find((t) => t.id === id)?.name
  const sections = [
    { title: `Ready at kitchen (${ready.length})`, data: ready },
    { title: `Picked up — serve now (${pickedUp.length})`, data: pickedUp },
  ].filter((s) => s.data.length)

  return (
    <SectionList
      sections={sections}
      keyExtractor={(o) => o.id}
      stickySectionHeadersEnabled={false}
      contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
      refreshControl={<PullToRefresh />}
      renderSectionHeader={({ section }) => <Text style={[ui.section, { marginTop: 4 }]}>{section.title}</Text>}
      ListEmptyComponent={<EmptyState icon="notifications-off-outline" title="Nothing waiting at the kitchen pass" body="Your phone will buzz when one of your orders is ready." />}
      renderItem={({ item }) => <OrderCard o={item} tableName={tableName(item.table)} />}
    />
  )
}
