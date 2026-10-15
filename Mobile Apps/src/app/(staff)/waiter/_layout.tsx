import { Ionicons } from '@expo/vector-icons'
import { Redirect } from 'expo-router'
import { Tabs } from 'expo-router/js-tabs'
import { View } from 'react-native'
import { AppHeader, PlanGate } from '@/components/chrome'
import { buzz, useNewArrivals } from '@/lib/alerts'
import { waiterView } from '@/lib/selectors'
import { colors } from '@/lib/theme'
import { useAuth } from '@/state/auth'
import { useFlow } from '@/state/flow'
import { useToast } from '@/state/toast'

export default function WaiterLayout() {
  const { user } = useAuth()
  if (!user) return <Redirect href="/" />
  if (user.role !== 'waiter') return <Redirect href="/" />
  return (
    <PlanGate feature="waiterApp">
      <WaiterTabs name={user.name} restaurant={user.restaurant?.name} />
    </PlanGate>
  )
}

function WaiterTabs({ name, restaurant }: { name: string; restaurant?: string }) {
  const { flow, loaded } = useFlow()
  const notify = useToast()
  const { active, ready } = waiterView(flow, name)

  // Ready alert: vibrate + toast when one of my orders becomes Ready.
  useNewArrivals(ready, loaded, (o) => {
    buzz()
    notify(`#${o.orderNo} for table ${o.table ?? ''} is ready — pick up from kitchen`, 'info')
  })

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppHeader title="Waiter" subtitle={`${name} · ${restaurant ?? 'Floor'}`} />
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
        <Tabs.Screen name="index" options={{ title: 'Tables', tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" color={color} size={size} /> }} />
        <Tabs.Screen
          name="orders"
          options={{
            title: 'My orders',
            tabBarBadge: active.length || undefined,
            tabBarBadgeStyle: { backgroundColor: colors.dark },
            tabBarIcon: ({ color, size }) => <Ionicons name="receipt-outline" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="ready"
          options={{
            title: 'Ready',
            tabBarBadge: ready.length || undefined,
            tabBarBadgeStyle: { backgroundColor: colors.success },
            tabBarIcon: ({ color, size }) => <Ionicons name="notifications-outline" color={color} size={size} />,
          }}
        />
      </Tabs>
    </View>
  )
}
