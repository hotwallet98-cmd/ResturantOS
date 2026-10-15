/**
 * API smoke test using the app's own client (src/lib/api.ts → @restaurantos/api-client).
 * Run with the backend up:  npx tsx scripts/smoke.ts [http://localhost:5000/api]
 *
 * Store (no login): restaurant + menu → place an order → track it (REST + Socket.IO order feed).
 * Staff: waiter and rider log in (MFA demo code) and load /flow; the rider is set to Available.
 * NOTE: this changes backend state — it places a real (Cash) order and sets the demo rider Available.
 */
import { connectOrderFeed, connectStaffFeed, socketUrlFrom } from '@restaurantos/api-client'
import type { MenuItem } from '@restaurantos/contracts'
import { ApiError, createAppApi, setAuthToken } from '../src/lib/api'

const base = process.argv[2] ?? process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5000/api'
const slug = process.env.EXPO_PUBLIC_RESTAURANT_SLUG ?? 'spice-route'
const api = createAppApi(base)

/** Resolves true when the socket connects within `ms`, false on error/timeout. */
function socketConnects(open: (status: (connected: boolean) => void) => { disconnect: () => unknown }, ms = 8000) {
  return new Promise<boolean>((resolve) => {
    let done = false
    const finish = (ok: boolean) => {
      if (done) return
      done = true
      clearTimeout(timer)
      socket.disconnect()
      resolve(ok)
    }
    const socket = open((connected) => connected && finish(true))
    const timer = setTimeout(() => finish(false), ms)
  })
}

async function store() {
  setAuthToken(null)
  const r = await api.store.restaurant(slug)
  console.log('store:', r.name, `(${slug})`, 'acceptingOrders', r.acceptingOrders, 'fee', r.deliveryFee, r.currency)
  const menu = await api.store.menu(slug)
  const available = menu.filter((m) => m.available)
  console.log('store menu items:', menu.length, 'available', available.length)
  if (!r.acceptingOrders) return console.log('store: closed — skipping order placement')
  const item: MenuItem | undefined = available[0]
  if (!item) throw new Error('No available menu item to order')
  const { order, trackingToken } = await api.store.placeOrder(slug, {
    name: 'Smoke Test',
    phone: '03001234567',
    address: '1 Test Street (mobile smoke test)',
    pay: 'Cash',
    items: [{ itemId: item.id, qty: 1, modifiers: item.variants[0] ? [item.variants[0].name] : [] }],
    notes: 'smoke test — please ignore',
  })
  console.log('placed order:', `#${order.orderNo}`, order.status, 'items', order.items.length)
  const tracked = await api.store.track(order.id, trackingToken)
  console.log('track:', `#${tracked.order.orderNo}`, tracked.order.status)
  const live = await socketConnects((status) => connectOrderFeed(socketUrlFrom(base), order.id, trackingToken, { status }))
  console.log('order feed socket connected:', live)
}

async function signIn(email: string) {
  const { challengeId } = await api.auth.login({ email, password: 'demo1234' })
  const { token, user } = await api.auth.verifyMfa({ challengeId, code: '123456' })
  setAuthToken(token)
  return { token, user }
}

async function staff() {
  const plans = await api.plans.list()
  console.log('plans:', plans.tiers.map((t) => t.tier).join(', '))

  const waiter = await signIn('hamza.floor@spiceroute.com')
  console.log('waiter:', waiter.user.name, waiter.user.role, waiter.user.restaurant?.plan, waiter.user.restaurant?.slug)
  const menu = await api.menu()
  console.log('waiter menu items:', menu.length)
  const flow = await api.flow()
  console.log('waiter flow:', { orders: flow.orders.length, tables: flow.tables.length, reservations: flow.reservations.length, riders: flow.riders.length })
  const live = await socketConnects((status) => connectStaffFeed(socketUrlFrom(base), waiter.token, { status }))
  console.log('staff feed socket connected:', live)

  const rider = await signIn('usman.rider@spiceroute.com')
  console.log('rider:', rider.user.name, rider.user.role, 'riderId', rider.user.riderId)
  const me = await api.auth.me()
  console.log('rider me:', me.email)
  const riderFlow = await api.flow()
  console.log('rider flow:', { orders: riderFlow.orders.length, riders: riderFlow.riders.length })
  if (rider.user.riderId) {
    const r = await api.riders.setStatus(rider.user.riderId, { status: 'Available' })
    console.log('rider status ->', (r as { status?: string })?.status ?? r)
  }
  setAuthToken(null)
}

async function main() {
  console.log('base', base)
  await store()
  await staff()
  console.log('OK')
  process.exit(0)
}

main().catch((e) => {
  console.error('SMOKE FAILED:', e instanceof ApiError ? `${e.message} (HTTP ${e.status})` : e instanceof Error ? e.message : e)
  process.exit(1)
})
