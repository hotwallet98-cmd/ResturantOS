import { DefaultTheme, Stack, ThemeProvider } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { setStatusBarStyle, StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { colors } from '@/lib/theme'
import { AuthProvider, useAuth } from '@/state/auth'
import { FlowProvider } from '@/state/flow'
import { ToastProvider } from '@/state/toast'
import { colors as storeColors } from '@/store/lib/theme'
import { CartProvider } from '@/store/state/cart'
import { RestaurantProvider } from '@/store/state/restaurant'

SplashScreen.preventAutoHideAsync().catch(() => {})

const theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, primary: colors.brand, background: colors.bg, card: '#fff', text: storeColors.ink },
}

/** Customer screens: light header (as in the old customer app). */
const storeHeader = {
  headerShown: true,
  headerTintColor: storeColors.ink,
  headerTitleStyle: { fontWeight: '700' as const },
  headerShadowVisible: false,
  headerBackButtonDisplayMode: 'minimal' as const,
  contentStyle: { backgroundColor: storeColors.bg },
}

/** Staff screens: dark header (as in the old staff app). */
const staffHeader = { headerShown: true, headerStyle: { backgroundColor: colors.dark }, headerTintColor: '#fff' }

/**
 * One flat root stack. Route groups only organise files:
 *  - (store)/…  the restaurant's store — the default for anyone who opens the app (no login)
 *  - (staff)/…  staff login + role screens (waiter, rider, "use the web app")
 * `index` decides where to go from the auth state.
 */
function RootStack() {
  const { state } = useAuth()
  useEffect(() => {
    if (state.status !== 'loading') SplashScreen.hideAsync().catch(() => {})
  }, [state.status])

  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}
      // Store screens have a light header (dark status bar text); staff screens are dark.
      screenListeners={({ route }) => ({
        focus: () => setStatusBarStyle(route.name.startsWith('(store)') ? 'dark' : 'light'),
      })}
    >
      <Stack.Screen name="index" />

      <Stack.Screen name="(store)/menu" options={{ headerShown: false, contentStyle: { backgroundColor: storeColors.bg } }} />
      <Stack.Screen name="(store)/cart" options={{ ...storeHeader, title: 'Your cart' }} />
      <Stack.Screen name="(store)/orders" options={{ ...storeHeader, title: 'My orders' }} />
      <Stack.Screen name="(store)/track/[id]" options={{ ...storeHeader, title: 'Track order' }} />

      <Stack.Screen name="(staff)/login" />
      <Stack.Screen name="(staff)/unsupported" />
      <Stack.Screen name="(staff)/waiter" />
      <Stack.Screen name="(staff)/rider" />
      <Stack.Screen name="(staff)/take-order/[tableId]" options={{ ...staffHeader, title: 'Take order' }} />
      <Stack.Screen name="(staff)/scan/[orderId]" options={{ ...staffHeader, title: 'Scan pickup', presentation: 'modal' }} />
      <Stack.Screen name="(staff)/collect/[orderId]" options={{ ...staffHeader, title: 'Collect payment', presentation: 'modal' }} />
    </Stack>
  )
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider value={theme}>
        <StatusBar style="dark" />
        <AuthProvider>
          <FlowProvider>
            <ToastProvider>
              <RestaurantProvider>
                <CartProvider>
                  <RootStack />
                </CartProvider>
              </RestaurantProvider>
            </ToastProvider>
          </FlowProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  )
}
