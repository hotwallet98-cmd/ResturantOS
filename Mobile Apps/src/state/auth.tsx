import type { SessionUser } from '@restaurantos/contracts'
import * as SecureStore from 'expo-secure-store'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Platform } from 'react-native'
import { api, ApiError, setAuthToken, setUnauthorizedHandler } from '@/lib/api'

const TOKEN_KEY = 'ros_staff_token'
const USER_KEY = 'ros_staff_user'

/** SecureStore is native-only; fall back to localStorage on web (dev convenience). */
const store = {
  get: async (k: string) => (Platform.OS === 'web' ? globalThis.localStorage?.getItem(k) ?? null : SecureStore.getItemAsync(k)),
  set: async (k: string, v: string) => (Platform.OS === 'web' ? globalThis.localStorage?.setItem(k, v) : SecureStore.setItemAsync(k, v)),
  del: async (k: string) => (Platform.OS === 'web' ? globalThis.localStorage?.removeItem(k) : SecureStore.deleteItemAsync(k)),
}

type AuthState = { status: 'loading' } | { status: 'signedOut' } | { status: 'signedIn'; token: string; user: SessionUser }

interface AuthContextValue {
  state: AuthState
  user: SessionUser | null
  token: string | null
  signIn: (token: string, user: SessionUser) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  const signOut = useCallback(async () => {
    setAuthToken(null)
    setState({ status: 'signedOut' })
    await Promise.all([store.del(TOKEN_KEY), store.del(USER_KEY)]).catch(() => {})
  }, [])

  const signIn = useCallback(async (token: string, user: SessionUser) => {
    setAuthToken(token)
    setState({ status: 'signedIn', token, user })
    await Promise.all([store.set(TOKEN_KEY, token), store.set(USER_KEY, JSON.stringify(user))]).catch(() => {})
  }, [])

  // Expired / revoked token anywhere → back to login.
  useEffect(() => {
    setUnauthorizedHandler(() => void signOut())
    return () => setUnauthorizedHandler(null)
  }, [signOut])

  // Restore the session on launch.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [token, rawUser] = await Promise.all([store.get(TOKEN_KEY), store.get(USER_KEY)])
        if (!token || !rawUser) return !cancelled && setState({ status: 'signedOut' })
        const cached = JSON.parse(rawUser) as SessionUser
        setAuthToken(token)
        if (!cancelled) setState({ status: 'signedIn', token, user: cached })
        // Refresh the profile (plan / riderId may have changed). Offline → keep the cached one.
        try {
          const fresh = await api.auth.me()
          if (!cancelled) {
            setState({ status: 'signedIn', token, user: fresh })
            await store.set(USER_KEY, JSON.stringify(fresh))
          }
        } catch (e) {
          if (e instanceof ApiError && e.status === 401 && !cancelled) await signOut()
        }
      } catch {
        if (!cancelled) setState({ status: 'signedOut' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [signOut])

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      user: state.status === 'signedIn' ? state.user : null,
      token: state.status === 'signedIn' ? state.token : null,
      signIn,
      signOut,
    }),
    [state, signIn, signOut],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
