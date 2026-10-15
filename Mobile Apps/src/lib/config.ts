/**
 * Backend location. Set EXPO_PUBLIC_API_URL (e.g. in .env) to point the app at your backend:
 *  - iOS simulator / web:     http://localhost:5000/api   (default)
 *  - Android emulator:        http://10.0.2.2:5000/api
 *  - Real phone (Expo Go):    http://<your PC's LAN IP>:5000/api   e.g. http://192.168.1.20:5000/api
 */
const DEFAULT_API_URL = 'http://localhost:5000/api'
const trimSlash = (s: string) => s.replace(/\/+$/, '')

export const API_URL = trimSlash(process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL)

/** Socket.IO lives at the server root (path /socket.io). Used by both the staff feed and order tracking. */
export const SOCKET_URL = trimSlash(process.env.EXPO_PUBLIC_SOCKET_URL || API_URL.replace(/\/api$/, ''))

/** Restaurant whose store the app opens on (`/public/restaurants/:slug`). */
export const RESTAURANT_SLUG = (process.env.EXPO_PUBLIC_RESTAURANT_SLUG || 'spice-route').trim()

/** Fallback poll interval for the order-track endpoint while the socket is down. */
export const POLL_MS = 15_000

export const DEMO_MFA_CODE = '123456'

export const DEMO_ACCOUNTS = [
  { label: 'Waiter', name: 'Hamza (floor)', email: 'hamza.floor@spiceroute.com' },
  { label: 'Rider', name: 'Usman (delivery)', email: 'usman.rider@spiceroute.com' },
] as const

export const DEMO_PASSWORD = 'demo1234'

/** Easypaisa account riders ask customers to pay into (matches the web prototype). */
export const EASYPAISA_ACCOUNT = { number: '0345-1234567', title: 'Spice Route Kitchen' }
