import { Ionicons } from '@expo/vector-icons'
import type { SessionUser } from '@restaurantos/contracts'
import { Redirect } from 'expo-router'
import { Tabs } from 'expo-router/js-tabs'
import { ActivityIndicator, StyleSheet, Switch, Text, View } from 'react-native'
import { AppHeader, PlanGate, useAction } from '@/components/chrome'
import { buzz, useNewArrivals } from '@/lib/alerts'
import { api } from '@/lib/api'
import { riderView } from '@/lib/selectors'
import { colors } from '@/lib/theme'
import { useAuth } from '@/state/auth'
import { useFlow } from '@/state/flow'
import { useToast } from '@/state/toast'

export default function RiderLayout() {
  const { user } = useAuth()
  if (!user) return <Redirect href="/" />
  if (user.role !== 'rider') return <Redirect href="/" />
  return (
    <PlanGate feature="riderApp">
      <RiderTabs user={user} />
    </PlanGate>
  )
}

function RiderTabs({ user }: { user: SessionUser }) {
  const { flow, loaded } = useFlow()
  const notify = useToast()
  const { active, rider } = riderView(flow, user.riderId)

  // "Rider notified — phone + address": buzz on every new assignment.
  useNewArrivals(active, loaded, (o) => {
    buzz()
    notify(`New delivery #${o.orderNo} — ${o.customer?.address ?? ''}`, 'info')
  })

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppHeader title="Rider" subtitle={rider ? `${rider.name} · ${rider.vehicle}` : user.name} />
      <OnlineToggle riderId={user.riderId} activeCount={active.length} />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.brand,
          tabBarInactiveTintColor: colors.muted,
          tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
          tabBarStyle: { minHeight: 60 },
          sceneStyle: { backgroundColor: colors.bg },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Deliveries',
            tabBarBadge: active.length || undefined,
            tabBarIcon: ({ color, size }) => <Ionicons name="bicycle" color={color} size={size} />,
          }}
        />
        <Tabs.Screen name="today" options={{ title: 'Today', tabBarIcon: ({ color, size }) => <Ionicons name="wallet-outline" color={color} size={size} /> }} />
      </Tabs>
    </View>
  )
}

function OnlineToggle({ riderId, activeCount }: { riderId?: string; activeCount: number }) {
  const { flow, applyRider } = useFlow()
  const { busy, run } = useAction()
  const rider = flow.riders.find((r) => r.id === riderId)

  if (!riderId)
    return (
      <View style={[styles.bar, { backgroundColor: colors.dangerSoft }]}>
        <Ionicons name="warning-outline" size={18} color={colors.danger} />
        <Text style={[styles.sub, { color: colors.danger, flex: 1 }]}>This account has no rider profile. Ask the counter to link one.</Text>
      </View>
    )
  if (!rider) return null

  const online = rider.status !== 'Offline'
  const label = rider.status === 'Offline' ? 'You are offline' : rider.status === 'Available' ? 'Online — waiting for orders' : 'On delivery'
  return (
    <View style={styles.bar}>
      <View style={[styles.dot, { backgroundColor: online ? colors.success : colors.faint }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{label}</Text>
        <Text style={styles.sub}>New deliveries are assigned to online riders</Text>
      </View>
      {busy ? <ActivityIndicator color={colors.brand} /> : null}
      <Switch
        value={online}
        disabled={!!busy}
        accessibilityLabel="Online"
        trackColor={{ true: colors.success, false: colors.border }}
        thumbColor="#fff"
        onValueChange={(on) =>
          void run('status', () => api.riders.setStatus(rider.id, { status: on ? (activeCount ? 'On delivery' : 'Available') : 'Offline' }).then(applyRider), {
            success: on ? 'You are online' : 'You are offline',
          })
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border, minHeight: 60 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  sub: { fontSize: 12, color: colors.muted },
})
