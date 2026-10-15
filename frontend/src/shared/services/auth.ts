import { mock, setToken, USE_MOCKS, http } from './client'
import type { Tier } from './plans'

export type Role = 'super_admin' | 'restaurant_admin' | 'kitchen_staff' | 'counter_staff' | 'waiter' | 'rider'

export interface SessionUser {
  id: string
  name: string
  email: string
  role: Role
  title: string
  restaurant?: { id: string; name: string; branches: string[]; plan: Tier }
}

const spiceRoute = { id: 'r-001', name: 'Spice Route Kitchen', branches: ['Downtown', 'Mall Road', 'Airport'], plan: 'Free' as Tier }

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
  if (!USE_MOCKS) return http<LoginResult>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password: _password }) })
  return mock({ mfaRequired: true, challengeId: `${role}:${email}` }, 500)
}

export async function verifyMfa(challengeId: string, code: string): Promise<SessionUser> {
  if (!USE_MOCKS) {
    const res = await http<{ token: string; user: SessionUser }>('/auth/mfa/verify', { method: 'POST', body: JSON.stringify({ challengeId, code }) })
    setToken(res.token)
    return res.user
  }
  if (!/^\d{6}$/.test(code)) throw new Error('Enter the 6-digit code')
  const role = challengeId.split(':')[0] as Role
  setToken('demo-token')
  return mock(demoUsers[role], 400)
}

export async function requestPasswordReset(email: string): Promise<{ sent: boolean }> {
  if (!USE_MOCKS) return http('/auth/password/forgot', { method: 'POST', body: JSON.stringify({ email }) })
  return mock({ sent: true }, 500)
}

export function logout() {
  setToken(null)
}
