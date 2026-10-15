import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/shared/context/AuthContext'
import { LoadingState } from '@/shared/components/ui'
import type { Role } from '@/shared/services/auth'
import { homeFor } from '@/shared/services/auth'

/** Signed-in guard; with `roles`, other roles are sent to their own app. */
export function RequireAuth({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const { user, checkingSession } = useAuth()
  if (checkingSession) return <LoadingState />
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />
  return children
}

export function RootRedirect() {
  const { user, checkingSession } = useAuth()
  if (checkingSession) return <LoadingState />
  return <Navigate to={user ? homeFor(user.role) : '/login'} replace />
}
