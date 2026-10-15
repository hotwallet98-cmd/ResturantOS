/** App chrome shared by both roles: header, connection banner, plan gate. */
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { canUse, features, type Feature } from '@restaurantos/contracts'
import { useState, type ReactNode } from 'react'
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { errorMessage } from '@/lib/api'
import { resetTo } from '@/lib/nav'
import { colors } from '@/lib/theme'
import { useAuth } from '@/state/auth'
import { useFlow } from '@/state/flow'
import { useToast } from '@/state/toast'
import { Button, EmptyState } from './ui'

/** Log out and return to the customer store, with a fresh navigation history. */
export function useLogout() {
  const { signOut } = useAuth()
  return () => {
    resetTo('/menu')
    void signOut()
  }
}

export function AppHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  const insets = useSafeAreaInsets()
  const logout = useLogout()
  const confirmLogout = () =>
    Alert.alert('Log out?', 'You will stop receiving live updates on this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: logout },
    ])
  return (
    <View style={{ backgroundColor: colors.dark }}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>R</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          {!!subtitle && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
        {right}
        <Pressable onPress={() => router.push('/menu')} hitSlop={8} style={styles.iconBtn} accessibilityLabel="Open the store">
          <Ionicons name="storefront-outline" size={22} color={colors.white} />
        </Pressable>
        <Pressable onPress={confirmLogout} hitSlop={8} style={styles.iconBtn} accessibilityLabel="Log out">
          <Ionicons name="log-out-outline" size={22} color={colors.white} />
        </Pressable>
      </View>
      <ConnectionBanner />
    </View>
  )
}

export function ConnectionBanner() {
  const { connection, loadError, loaded } = useFlow()
  if (connection === 'online' && !loadError) return null
  if (connection === 'connecting' && !loadError) return null
  const offline = connection === 'offline' || (!loaded && !!loadError)
  return (
    <View style={[styles.banner, { backgroundColor: offline ? colors.danger : '#b54708' }]}>
      {offline ? <Ionicons name="cloud-offline-outline" size={16} color="#fff" /> : <ActivityIndicator size="small" color="#fff" />}
      <Text style={styles.bannerText} numberOfLines={2}>
        {offline ? 'Offline — cannot reach the server. Retrying…' : 'Reconnecting… live updates paused'}
      </Text>
    </View>
  )
}

/** Shows an upgrade notice instead of the app when the restaurant plan lacks the feature. */
export function PlanGate({ feature, children }: { feature: Feature; children: ReactNode }) {
  const { user } = useAuth()
  const plan = user?.restaurant?.plan ?? 'Free'
  if (canUse(plan, feature)) return <>{children}</>
  const f = features[feature]
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppHeader title={f.label} subtitle={user?.restaurant?.name} />
      <EmptyState
        icon="lock-closed-outline"
        title={`${f.label} needs the ${f.tier} plan`}
        body={`${user?.restaurant?.name ?? 'Your restaurant'} is on the ${plan} plan. Ask your restaurant admin to upgrade to ${f.tier} to unlock: ${f.description.toLowerCase()}.`}
      />
    </View>
  )
}

/** Runs an API action with a busy flag and shows success / error feedback. Resolves true on success. */
export function useAction() {
  const notify = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  const run = async <T,>(key: string, fn: () => Promise<T>, opts: { success?: string | ((r: T) => string); alertOnError?: boolean } = {}): Promise<boolean> => {
    if (busy) return false
    setBusy(key)
    try {
      const r = await fn()
      if (opts.success) notify(typeof opts.success === 'function' ? opts.success(r) : opts.success)
      return true
    } catch (e) {
      // Toasts render under RN Modals, so errors raised from a sheet use a native alert.
      if (opts.alertOnError) Alert.alert('Could not complete', errorMessage(e))
      else notify(errorMessage(e), 'error')
      return false
    } finally {
      setBusy(null)
    }
  }
  return { busy, run }
}

export function RetryLoad() {
  const { loadError, refresh } = useFlow()
  return (
    <EmptyState
      icon="cloud-offline-outline"
      title="Could not load live data"
      body={loadError ?? undefined}
      action={<Button title="Try again" icon="refresh" onPress={() => void refresh()} style={{ marginTop: 8, alignSelf: 'stretch' }} />}
    />
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 14 },
  logo: { width: 38, height: 38, borderRadius: 10, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#fff', fontWeight: '900', fontSize: 20 },
  title: { color: '#fff', fontSize: 18, fontWeight: '800' },
  subtitle: { color: '#c4c8d0', fontSize: 13, marginTop: 1 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.dark2 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  bannerText: { color: '#fff', fontSize: 13, fontWeight: '600', flex: 1 },
})
