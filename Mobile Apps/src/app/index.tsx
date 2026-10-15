import { Redirect } from 'expo-router'
import { Loading } from '@/components/ui'
import { staffHome } from '@/lib/nav'
import { useAuth } from '@/state/auth'

/**
 * Entry route. Nobody signed in → the restaurant's store (customer experience, no login).
 * A staff session (restored from SecureStore) → that role's home: waiter, rider, or "use the web app".
 */
export default function Index() {
  const { state } = useAuth()
  if (state.status === 'loading') return <Loading label="Starting…" />
  if (state.status === 'signedOut') return <Redirect href="/menu" />
  return <Redirect href={staffHome(state.user)} />
}
