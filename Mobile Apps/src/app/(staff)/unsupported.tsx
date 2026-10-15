import { Ionicons } from '@expo/vector-icons'
import { Redirect, router } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLogout } from '@/components/chrome'
import { Button } from '@/components/ui'
import { colors } from '@/lib/theme'
import { useAuth } from '@/state/auth'

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super admin',
  restaurant_admin: 'Restaurant admin',
  kitchen_staff: 'Kitchen staff',
  counter_staff: 'Counter staff',
}

/** Roles other than waiter / rider use the web app. */
export default function Unsupported() {
  const { user } = useAuth()
  const logout = useLogout()
  if (!user) return <Redirect href="/" />
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.icon}>
        <Ionicons name="desktop-outline" size={40} color={colors.brand} />
      </View>
      <Text style={styles.title}>Hi {user.name.split(' ')[0]}, please use the web app</Text>
      <Text style={styles.body}>
        The staff side of this app is for waiters and riders. As {ROLE_LABEL[user.role] ?? user.role}
        {user.restaurant ? ` at ${user.restaurant.name}` : ''}, your tools (kitchen display, counter, admin) live in the RestaurantOS web app on a tablet or
        computer.
      </Text>
      <Button title="Log out" icon="log-out-outline" variant="dark" size="lg" onPress={logout} style={{ alignSelf: 'stretch' }} />
      <Button title="Open the store" icon="storefront-outline" variant="outline" size="lg" onPress={() => router.push('/menu')} style={{ alignSelf: 'stretch' }} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  icon: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, textAlign: 'center' },
  body: { fontSize: 15, color: colors.muted, textAlign: 'center', lineHeight: 22, marginBottom: 8 },
})
