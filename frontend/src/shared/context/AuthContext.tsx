import type { ReactNode } from 'react'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { SessionUser } from '@/shared/services/auth'
import { getCurrentUser, logout as apiLogout } from '@/shared/services/auth'
import { AUTH_INVALIDATED_EVENT } from '@/shared/services/api'
import { USE_MOCKS } from '@/shared/services/client'
import type { Feature, Tier } from '@/shared/services/plans'
import { canUse } from '@/shared/services/plans'

const USER_KEY = 'ros.user'
const BRANCH_KEY = 'ros.branch'
/** Prototype only: lets a demo restaurant try each subscription tier. */
const PLAN_KEY = 'ros.plan'

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable */
  }
}

interface AuthState {
  user: SessionUser | null
  checkingSession: boolean
  signIn: (user: SessionUser) => void
  signOut: () => void
  /** Currently selected branch (restaurant portal). */
  branch: string
  setBranch: (branch: string) => void
  /** Subscription tier of the signed-in restaurant (Free when none). */
  plan: Tier
  setDemoPlan: (plan: Tier) => void
  can: (feature: Feature) => boolean
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(() => read<SessionUser>(USER_KEY))
  const [checkingSession, setCheckingSession] = useState(!USE_MOCKS)
  const [branch, setBranchState] = useState<string>(() => read<string>(BRANCH_KEY) ?? 'All branches')
  const [demoPlan, setDemoPlanState] = useState<Tier | null>(() => read<Tier>(PLAN_KEY))
  const plan: Tier = demoPlan ?? user?.restaurant?.plan ?? 'Free'

  useEffect(() => {
    if (USE_MOCKS) return
    let active = true
    void getCurrentUser()
      .then((current) => {
        if (!active) return
        write(USER_KEY, current)
        setUser(current)
      })
      .catch(() => {
        if (!active) return
        apiLogout()
        write(USER_KEY, null)
        setUser(null)
      })
      .finally(() => active && setCheckingSession(false))
    const invalidate = () => {
      write(USER_KEY, null)
      setUser(null)
    }
    window.addEventListener(AUTH_INVALIDATED_EVENT, invalidate)
    return () => {
      active = false
      window.removeEventListener(AUTH_INVALIDATED_EVENT, invalidate)
    }
  }, [])

  const signIn = useCallback((u: SessionUser) => {
    write(USER_KEY, u)
    setUser(u)
  }, [])

  const signOut = useCallback(() => {
    apiLogout()
    write(USER_KEY, null)
    setUser(null)
  }, [])

  const setBranch = useCallback((b: string) => {
    write(BRANCH_KEY, b)
    setBranchState(b)
  }, [])

  const setDemoPlan = useCallback((p: Tier) => {
    write(PLAN_KEY, p)
    setDemoPlanState(p)
  }, [])

  const can = useCallback((f: Feature) => canUse(plan, f), [plan])

  const value = useMemo(
    () => ({ user, checkingSession, signIn, signOut, branch, setBranch, plan, setDemoPlan, can }),
    [user, checkingSession, signIn, signOut, branch, setBranch, plan, setDemoPlan, can],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
