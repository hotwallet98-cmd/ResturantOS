import type { Role, SessionUser } from '@restaurantos/contracts'
import { api } from './api'
import { getToken, mock, setToken, USE_MOCKS } from './client'
import type { Tier } from './plans'

export type { Role, SessionUser }

const spiceRoute = { id: 'r-001', slug: 'spice-route', name: 'Spice Route Kitchen', branches: ['Downtown', 'Mall Road', 'Airport'], plan: 'Free' as Tier }

export const demoUsers: Record<Role, SessionUser> = {
  super_admin: {
    id: 'u-001',
    name: 'Ayesha Khan',
    email: 'ayesha@restaurantos.io',
    role: 'super_admin',
    title: 'Platform Super Admin',
  },
  restaurant_admin: {
    id: 'u-101',
    name: 'Omar Siddiqui',
    email: 'omar@spiceroute.com',
    role: 'restaurant_admin',
    title: 'Restaurant Admin',
    restaurant: spiceRoute,
  },
  kitchen_staff: {
    id: 'u-201',
    name: 'Imran Butt',
    email: 'imran.kitchen@spiceroute.com',
    role: 'kitchen_staff',
    title: 'Head Chef',
    restaurant: spiceRoute,
  },
  counter_staff: {
    id: 'u-301',
    name: 'Sadia Pervez',
    email: 'sadia.counter@spiceroute.com',
    role: 'counter_staff',
    title: 'Counter / Cashier',
    restaurant: spiceRoute,
  },
  waiter: {
    id: 'u-401',
    name: 'Hamza Riaz',
    email: 'hamza.floor@spiceroute.com',
    role: 'waiter',
    title: 'Waiter',
    restaurant: spiceRoute,
  },
  rider: {
    id: 'rd-4',
    name: 'Usman Ghani',
    email: 'usman.rider@spiceroute.com',
    role: 'rider',
    title: 'Delivery Rider',
    restaurant: spiceRoute,
  },
}

/** Landing page for each role after sign-in. */
const homes: Record<Role, string> = {
  super_admin: '/admin',
  restaurant_admin: '/app',
  kitchen_staff: '/kitchen',
  counter_staff: '/counter',
  waiter: '/waiter',
  rider: '/rider',
}
export const homeFor = (role: Role) => homes[role]

export interface LoginResult {
  mfaRequired: boolean
  challengeId: string
}

export async function login(email: string, _password: string, role: Role): Promise<LoginResult> {
  if (!USE_MOCKS) return api.auth.login({ email, password: _password })
  return mock({ mfaRequired: true, challengeId: `${role}:${email}` }, 500)
}

export async function verifyMfa(challengeId: string, code: string): Promise<SessionUser> {
  if (!USE_MOCKS) {
    const res = await api.auth.verifyMfa({ challengeId, code })
    setToken(res.token)
    return res.user
  }
  if (!/^\d{6}$/.test(code)) throw new Error('Enter the 6-digit code')
  const role = challengeId.split(':')[0] as Role
  setToken('demo-token')
  return mock(demoUsers[role], 400)
}

export async function requestPasswordReset(_email: string): Promise<{ sent: boolean }> {
  if (!USE_MOCKS) throw new Error('Password reset is not implemented by the API yet.')
  return mock({ sent: true }, 500)
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  if (!getToken()) return null
  if (USE_MOCKS) return null
  return api.auth.me()
}

export function logout() {
  setToken(null)
}
