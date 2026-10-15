/**
 * End-to-end smoke test against a running API (npm run start) on a freshly seeded DB.
 *   npm run smoke            (API_URL defaults to http://localhost:5000)
 * Runs both MVP workflows over HTTP while Socket.IO listeners (staff + customer) record events.
 */
import {
  API,
  API_PREFIX,
  DELIVERY_FEE,
  SOCKET_EVENTS,
  type CreateCustomerOrderResponse,
  type FlowOrder,
  type FlowRider,
  type FlowState,
  type FlowTable,
  type LoginResponse,
  type MenuItem,
  type PayTableResponse,
  type PublicRestaurant,
  type SessionUser,
  type TrackOrderResponse,
  type VerifyMfaResponse,
} from '@restaurantos/contracts'
import { io, type Socket } from 'socket.io-client'

const ORIGIN = process.env.API_URL ?? 'http://localhost:5000'
const BASE = ORIGIN + API_PREFIX
const CALL_WAIT_MS = Number(process.env.SMOKE_CALL_WAIT_MS ?? 12_500)
const SLUG = process.env.SMOKE_SLUG ?? 'spice-route'

/* Tiny test harness ------------------------------------------------------ */

const results: { name: string; ok: boolean; detail?: string }[] = []
async function step(name: string, fn: () => Promise<string | void>) {
  try {
    const detail = await fn()
    results.push({ name, ok: true, detail: detail || undefined })
    console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ''}`)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    results.push({ name, ok: false, detail: msg })
    console.log(`  FAIL  ${name} — ${msg}`)
  }
}
function expect(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}
const eq = <T>(actual: T, expected: T, what: string) => expect(actual === expected, `${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: { message?: string | string[] },
  ) {
    super(`HTTP ${status}: ${JSON.stringify(body.message ?? body)}`)
  }
}

async function http<T>(method: string, path: string, body?: unknown, token?: string): Promise<T> {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : undefined
  if (!res.ok) throw new HttpError(res.status, data ?? {})
  return data as T
}
async function expectStatus(status: number | ((s: number) => boolean), p: Promise<unknown>): Promise<string> {
  try {
    await p
  } catch (e) {
    if (e instanceof HttpError) {
      const ok = typeof status === 'number' ? e.status === status : status(e.status)
      expect(ok, `expected HTTP ${status}, got ${e.status} ${JSON.stringify(e.body.message)}`)
      return `${e.status} "${Array.isArray(e.body.message) ? e.body.message.join('; ') : e.body.message}"`
    }
    throw e
  }
  throw new Error(`expected HTTP ${status}, but the request succeeded`)
}

async function login(email: string) {
  const { challengeId, mfaRequired } = await http<LoginResponse>('POST', API.login, { email, password: 'anything' })
  expect(mfaRequired, 'mfaRequired should be true')
  const res = await http<VerifyMfaResponse>('POST', API.verifyMfa, { challengeId, code: '123456' })
  return res
}

/** Collects socket events so tests can assert on them. */
function listen(socket: Socket) {
  const log: { event: string; data: any }[] = []
  for (const ev of Object.values(SOCKET_EVENTS)) socket.on(ev, (data: unknown) => log.push({ event: ev, data }))
  const connected = new Promise<void>((resolve, reject) => {
    socket.on('connect', () => resolve())
    socket.on('connect_error', reject)
    setTimeout(() => reject(new Error('socket connect timeout')), 5000)
  })
  return { log, connected }
}
const orderStatuses = (log: { event: string; data: any }[], id: string) =>
  log.filter((e) => e.event === SOCKET_EVENTS.order && e.data.id === id).map((e) => (e.data as FlowOrder).status)
const uniqSeq = (xs: string[]) => xs.filter((x, i) => x !== xs[i - 1])

/* Run --------------------------------------------------------------------- */

async function main() {
  console.log(`RestaurantOS smoke test → ${BASE}\n`)
  const tokens: Record<string, string> = {}
  let riderId = ''

  console.log('Auth')
  await step('demo login + MFA for every role', async () => {
    const users = {
      admin: 'omar@spiceroute.com',
      kitchen: 'imran.kitchen@spiceroute.com',
      counter: 'sadia.counter@spiceroute.com',
      waiter: 'hamza.floor@spiceroute.com',
      rider: 'usman.rider@spiceroute.com',
      superadmin: 'ayesha@restaurantos.io',
    }
    for (const [k, email] of Object.entries(users)) {
      const r = await login(email)
      tokens[k] = r.token
      if (k === 'rider') riderId = r.user.riderId ?? ''
    }
    eq(riderId, 'rd-4', 'rider SessionUser.riderId')
    return `6 roles, rider.riderId=${riderId}`
  })
  await step('GET /auth/me', async () => {
    const me = await http<SessionUser>('GET', API.me, undefined, tokens.waiter)
    eq(me.role, 'waiter', 'role')
    eq(me.restaurant?.plan, 'Free', 'plan')
    eq(me.restaurant?.slug, SLUG, 'restaurant.slug')
    return `${me.restaurant?.name} (${me.restaurant?.slug}) · plan ${me.restaurant?.plan}`
  })
  await step('MFA rejects a non-6-digit code (400)', async () => {
    const { challengeId } = await http<LoginResponse>('POST', API.login, { email: 'omar@spiceroute.com', password: 'x' })
    return expectStatus(400, http('POST', API.verifyMfa, { challengeId, code: '12ab' }))
  })
  await step('GET /flow without token → 401', () => expectStatus(401, http('GET', API.flow)))
  await step('super_admin (no restaurant) GET /flow → 403', () => expectStatus(403, http('GET', API.flow, undefined, tokens.superadmin)))

  // Staff socket (counter screen)
  const staffSock = io(ORIGIN, { auth: { token: tokens.counter }, transports: ['websocket'] })
  const staff = listen(staffSock)
  let snapshot: FlowState | undefined
  await step('staff socket connects and receives flow:snapshot', async () => {
    await staff.connected
    for (let i = 0; i < 20 && !snapshot; i++) {
      snapshot = staff.log.find((e) => e.event === SOCKET_EVENTS.snapshot)?.data
      if (!snapshot) await sleep(100)
    }
    expect(snapshot, 'no flow:snapshot')
    return `${snapshot.orders.length} orders, ${snapshot.tables.length} tables, ${snapshot.riders.length} riders`
  })
  await step('bad socket auth is disconnected', async () => {
    const s = io(ORIGIN, { auth: { token: 'nope' }, transports: ['websocket'], reconnection: false })
    const disconnected = await new Promise<boolean>((resolve) => {
      s.on('disconnect', () => resolve(true))
      setTimeout(() => resolve(false), 3000)
    })
    s.close()
    expect(disconnected, 'socket with a bad token stayed connected')
  })

  /* ---------------------------------------------------------------- Storefront */
  console.log('\nStorefront (public, by slug)')
  await step(`GET /public/restaurants/${SLUG}`, async () => {
    const r = await http<PublicRestaurant>('GET', API.publicRestaurant(SLUG))
    eq(r.slug, SLUG, 'slug')
    eq(r.name, 'Spice Route Kitchen', 'name')
    eq(r.acceptingOrders, true, 'acceptingOrders (Free plan includes customerApp)')
    eq(r.deliveryFee, DELIVERY_FEE, 'deliveryFee')
    eq(r.currency, 'USD', 'currency')
    expect(Array.isArray(r.deliveryEtaMins) && r.deliveryEtaMins.length === 2 && r.deliveryEtaMins[0] < r.deliveryEtaMins[1], 'deliveryEtaMins [min, max]')
    return `${r.id} · ${r.name} · fee ${r.deliveryFee} ${r.currency} · ${r.deliveryEtaMins.join('-')} min`
  })
  await step(`GET /public/restaurants/${SLUG}/menu`, async () => {
    const menu = await http<MenuItem[]>('GET', API.publicMenu(SLUG))
    expect(menu.length > 0, 'menu is empty')
    return `${menu.length} items`
  })
  await step('unknown slug → 404 (restaurant, menu, order)', async () => {
    const a = await expectStatus(404, http('GET', API.publicRestaurant('no-such-place')))
    await expectStatus(404, http('GET', API.publicMenu('no-such-place')))
    await expectStatus(404, http('POST', API.publicOrder('no-such-place'), { name: 'X', phone: '+92 300 0000000', address: 'Somewhere 1', pay: 'Cash', items: [{ itemId: 'mi-14', qty: 1 }] }))
    return a
  })
  await step('old POST /orders/customer is gone (404); GET /menu needs a token (401)', async () => {
    await expectStatus(404, http('POST', '/orders/customer', { name: 'X' }))
    return expectStatus(401, http('GET', `${API.menu}?restaurantId=r-001`))
  })
  await step('staff GET /menu (own restaurant)', async () => {
    const menu = await http<MenuItem[]>('GET', API.menu, undefined, tokens.waiter)
    expect(menu.length > 0, 'menu is empty')
    return `${menu.length} items`
  })

  /* ---------------------------------------------------------------- Dine-in */
  console.log('\nWorkflow 1 — dine-in')
  const flow0 = await http<FlowState>('GET', API.flow, undefined, tokens.counter)
  const table = flow0.tables.find((t) => t.status === 'Available' && t.seats >= 2)!
  const reservation = flow0.reservations.find((r) => r.status === 'Confirmed' && !r.table && r.party <= table.seats)
  let dineOrder: FlowOrder | undefined
  const maxOrderNo = Math.max(...flow0.orders.map((o) => o.orderNo))

  await step(`waiter seats ${table.id} (${reservation ? `reservation ${reservation.id} ${reservation.guest}` : 'walk-in'})`, async () => {
    const t = await http<FlowTable>('POST', API.seat(table.id), { guests: 2, reservationId: reservation?.id }, tokens.waiter)
    eq(t.status, 'Occupied', 'table status')
    eq(t.server, 'Hamza Riaz', 'server')
    if (reservation) {
      const f = await http<FlowState>('GET', API.flow, undefined, tokens.counter)
      eq(f.reservations.find((r) => r.id === reservation.id)?.status, 'Seated', 'reservation status')
    }
    return `Occupied by ${t.guestName}`
  })
  await step('seating an occupied table → 409', () => expectStatus(409, http('POST', API.seat(table.id), { guests: 2 }, tokens.waiter)))
  await step('waiter sends order → Received; server prices from menu (client price ignored)', async () => {
    dineOrder = await http<FlowOrder>(
      'POST',
      API.tableOrder,
      { tableId: table.id, notes: 'Birthday table, bring candles', items: [{ itemId: 'mi-09', qty: 1, modifiers: ['Full'], notes: 'Less oil', price: 0.01 }, { itemId: 'mi-17', qty: 2 }] },
      tokens.waiter,
    )
    eq(dineOrder.status, 'Received', 'status')
    eq(dineOrder.items[0].price, 28.5, 'Chicken Karahi Full unit price (16.5 + 12)')
    eq(dineOrder.items[0].station, 'Wok', 'station from menu')
    eq(dineOrder.items[0].emoji, '🍲', 'emoji from menu')
    eq(dineOrder.orderNo, maxOrderNo + 1, 'order number increments')
    eq(dineOrder.notes, 'Birthday table, bring candles', 'order-level notes')
    eq(dineOrder.items[0].notes, 'Less oil', 'line notes')
    eq(dineOrder.items[1].notes, undefined, 'line 2 notes')
    return `#${dineOrder.orderNo}, items ${dineOrder.items.map((i) => `${i.qty}x${i.name}@${i.price}`).join(', ')}`
  })
  const dineId = () => dineOrder!.id
  await step('forbidden transition Received → Served → 409', () => expectStatus(409, http('PATCH', API.orderStatus(dineId()), { status: 'Served' }, tokens.waiter)))
  await step('wrong role: waiter sets Preparing → 403', () => expectStatus(403, http('PATCH', API.orderStatus(dineId()), { status: 'Preparing' }, tokens.waiter)))
  await step('invalid status value → 400', () => expectStatus(400, http('PATCH', API.orderStatus(dineId()), { status: 'Eaten' }, tokens.kitchen)))
  await step('kitchen accepts → Preparing', async () => eq((await http<FlowOrder>('PATCH', API.orderStatus(dineId()), { status: 'Preparing' }, tokens.kitchen)).status, 'Preparing', 'status'))
  await step('kitchen ticks line 1 done (PATCH items)', async () => {
    const o = await http<FlowOrder>('PATCH', API.orderItems(dineId()), { items: [{ done: true, station: 'Wok' }, { done: false, station: 'Tandoor' }] }, tokens.kitchen)
    eq(o.items[0].done, true, 'line 1 done')
    eq(o.items[1].done, false, 'line 2 done')
  })
  await step('chef marks Ready (all lines done)', async () => {
    const o = await http<FlowOrder>('PATCH', API.orderStatus(dineId()), { status: 'Ready' }, tokens.kitchen)
    eq(o.status, 'Ready', 'status')
    expect(o.items.every((i) => i.done), 'all items should be done')
  })
  await step('waiter picks up → PickedUp', async () => eq((await http<FlowOrder>('PATCH', API.orderStatus(dineId()), { status: 'PickedUp' }, tokens.waiter)).status, 'PickedUp', 'status'))
  await step('PATCH status Paid / Delivered → 400 (use pay / deliver)', async () => {
    await expectStatus(400, http('PATCH', API.orderStatus(dineId()), { status: 'Paid' }, tokens.counter))
    return expectStatus(400, http('PATCH', API.orderStatus(dineId()), { status: 'Delivered' }, tokens.admin))
  })
  await step('waiter serves → Served', async () => eq((await http<FlowOrder>('PATCH', API.orderStatus(dineId()), { status: 'Served' }, tokens.waiter)).status, 'Served', 'status'))
  await step('waiter requests the bill', async () => {
    const t = await http<FlowTable>('POST', API.billRequest(table.id), undefined, tokens.waiter)
    eq(t.billRequested, true, 'billRequested')
    eq(t.billTotal, 33.5, 'billTotal')
    return `bill ${t.billTotal}`
  })
  await step('waiter cannot take payment → 403', () => expectStatus(403, http('POST', API.payTable(table.id), { method: 'Cash', tip: 1 }, tokens.waiter)))
  await step('counter takes bill + tip → Paid, table freed (Available)', async () => {
    const r = await http<PayTableResponse>('POST', API.payTable(table.id), { method: 'Card', tip: 5, txnId: 'CARD-4242' }, tokens.counter)
    expect(r.table && Array.isArray(r.orders) && Object.keys(r).sort().join() === 'orders,table', `PayTableResponse shape: ${Object.keys(r).join()}`)
    eq(r.table.status, 'Available', 'table status')
    eq(r.table.guests, undefined, 'guests cleared')
    eq(r.orders.length, 1, 'paid orders')
    eq(r.orders[0].status, 'Paid', 'order status')
    eq(r.orders[0].payment?.amount, 33.5, 'payment amount')
    eq(r.orders[0].payment?.tip, 5, 'tip')
    eq(r.orders[0].payment?.method, 'Card', 'method')
    eq(r.orders[0].payment?.txnId, 'CARD-4242', 'payment.txnId')
    eq(r.orders[0].notes, 'Birthday table, bring candles', 'notes kept')
    if (reservation) {
      const f = await http<FlowState>('GET', API.flow, undefined, tokens.counter)
      eq(f.reservations.find((x) => x.id === reservation.id)?.status, 'Completed', 'reservation status')
    }
    return `paid 33.5 + tip 5 (txn ${r.orders[0].payment?.txnId}), ${table.id} Available`
  })
  await step('staff socket saw the whole dine-in sequence + table updates', async () => {
    await sleep(300)
    const seq = uniqSeq(orderStatuses(staff.log, dineId()))
    eq(seq.join('>'), 'Received>Preparing>Ready>PickedUp>Served>Paid', 'order:updated sequence')
    const tableEvents = staff.log.filter((e) => e.event === SOCKET_EVENTS.table && e.data.id === table.id).map((e) => (e.data as FlowTable).status)
    eq(tableEvents.at(-1), 'Available', 'last table:updated status')
    expect(staff.log.some((e) => e.event === SOCKET_EVENTS.reservation) || !reservation, 'reservation:updated not received')
    return seq.join(' → ')
  })

  /* ---------------------------------------------------------------- Delivery */
  console.log('\nWorkflow 2 — delivery')
  let orderA: CreateCustomerOrderResponse | undefined
  let orderB: CreateCustomerOrderResponse | undefined
  const customer = { name: 'Bilal Ahmed', phone: '+92 300 5550101', address: 'House 7, Street 9, Gulberg III, Lahore', pay: 'Easypaisa' as const }
  await step('customer app places order → Placed, verification call starts (Verifying)', async () => {
    orderA = await http<CreateCustomerOrderResponse>('POST', API.publicOrder(SLUG), {
      ...customer,
      notes: 'Ring the bell twice',
      items: [{ itemId: 'mi-14', qty: 2 }, { itemId: 'mi-32', qty: 2, modifiers: ['1.5L'] }],
    })
    expect(orderA.trackingToken, 'no trackingToken')
    eq(orderA.order.history[0].status, 'Placed', 'first history status')
    eq(orderA.order.status, 'Verifying', 'status')
    eq(orderA.order.call?.state, 'dialing', 'call state')
    eq(orderA.order.items[1].price, 3.5, 'Soft Drink 1.5L unit price (1.8 + 1.7)')
    eq(orderA.order.notes, 'Ring the bell twice', 'FlowOrder.notes')
    eq(orderA.order.items[0].notes, undefined, 'note not stuffed into the first item')
    return `#${orderA.order.orderNo}, total ${2 * 13.9 + 2 * 3.5} + fee ${DELIVERY_FEE}`
  })
  const customerSock = io(ORIGIN, { auth: { orderId: orderA?.order.id, trackingToken: orderA?.trackingToken }, transports: ['websocket'] })
  const cust = listen(customerSock)
  await step('customer socket connects with orderId + trackingToken', async () => {
    await cust.connected
  })
  await step('second customer order; counter restarts its call with outcome=decline', async () => {
    orderB = await http<CreateCustomerOrderResponse>('POST', API.publicOrder(SLUG), { ...customer, name: 'Sana Tariq', pay: 'Cash', items: [{ itemId: 'mi-20', qty: 1 }] })
    const o = await http<FlowOrder>('POST', API.startCall(orderB.order.id), { outcome: 'decline' }, tokens.counter)
    eq(o.status, 'Verifying', 'status')
    eq(o.call?.attempts, 2, 'call attempts')
  })
  await step('a waiter cannot start a verification call → 403', () => expectStatus(403, http('POST', API.startCall(orderB!.order.id), {}, tokens.waiter)))
  console.log(`  ...waiting ${CALL_WAIT_MS / 1000}s for the demo call timeline`)
  await sleep(CALL_WAIT_MS)
  await step('call confirmed → Received (agent script in Roman Urdu)', async () => {
    const t = await http<TrackOrderResponse>('GET', API.track(orderA!.order.id, orderA!.trackingToken))
    eq(t.order.status, 'Received', 'status')
    eq(t.order.call?.state, 'confirmed', 'call state')
    const lines = t.order.call?.lines ?? []
    eq(lines.length, 3, 'transcript lines')
    expect(lines[0].text.startsWith('Assalam-o-alaikum Bilal Ahmed'), 'agent greeting')
    eq(lines[1].who, 'customer', 'second speaker')
    return `"${lines[1].text}"`
  })
  await step('declined call → Cancelled', async () => {
    const t = await http<TrackOrderResponse>('GET', API.track(orderB!.order.id, orderB!.trackingToken))
    eq(t.order.status, 'Cancelled', 'status')
    eq(t.order.call?.state, 'declined', 'call state')
  })
  await step('tracking with a wrong token → 404', () => expectStatus(404, http('GET', API.track(orderA!.order.id, 'wrong'))))

  const idA = () => orderA!.order.id
  const before = await http<FlowState>('GET', API.flow, undefined, tokens.counter)
  const expectedRider = before.riders.find((r) => r.status === 'Available')
  await step(`kitchen accepts → Preparing; first Available rider auto-assigned`, async () => {
    expect(expectedRider, 'no Available rider in the seed')
    const o = await http<FlowOrder>('PATCH', API.orderStatus(idA()), { status: 'Preparing' }, tokens.kitchen)
    eq(o.status, 'Preparing', 'status')
    eq(o.riderId, expectedRider!.id, 'assigned rider')
    const f = await http<FlowState>('GET', API.flow, undefined, tokens.counter)
    eq(f.riders.find((r) => r.id === expectedRider!.id)?.status, 'On delivery', 'rider status')
    await sleep(200)
    expect(staff.log.some((e) => e.event === SOCKET_EVENTS.rider && (e.data as FlowRider).id === expectedRider!.id && e.data.status === 'On delivery'), 'no rider:updated event')
    return `${expectedRider!.name} (${expectedRider!.phone}) → On delivery`
  })
  // The demo rider login is rd-4; it is the first Available rider on a fresh seed.
  const riderToken = expectedRider?.id === riderId ? tokens.rider : tokens.admin
  await step('rider cannot pick up before Ready → 409', () => expectStatus(409, http('POST', API.pickup(idA()), {}, riderToken)))
  await step('chef marks Ready', async () => eq((await http<FlowOrder>('PATCH', API.orderStatus(idA()), { status: 'Ready' }, tokens.kitchen)).status, 'Ready', 'status'))
  await step('counter packs → Packed', async () => eq((await http<FlowOrder>('PATCH', API.orderStatus(idA()), { status: 'Packed' }, tokens.counter)).status, 'Packed', 'status'))
  await step('rider scans the wrong bag → 409', () => expectStatus(409, http('POST', API.pickup(idA()), { scannedOrderNo: orderA!.order.orderNo + 1000 }, riderToken)))
  await step('rider scans the bag → PickedUp', async () => {
    const o = await http<FlowOrder>('POST', API.pickup(idA()), { scannedOrderNo: orderA!.order.orderNo }, riderToken)
    eq(o.status, 'PickedUp', 'status')
  })
  await step('tracking shows the rider', async () => {
    const t = await http<TrackOrderResponse>('GET', API.track(idA(), orderA!.trackingToken))
    eq(t.rider?.name, expectedRider!.name, 'rider name')
    return `${t.rider?.name} · ${t.rider?.vehicle}`
  })
  await step('rider delivers, collects Easypaisa → Delivered, rider Available again', async () => {
    const o = await http<FlowOrder>('POST', API.deliver(idA()), { method: 'Easypaisa', txnId: 'EP-998877' }, riderToken)
    eq(o.status, 'Delivered', 'status')
    eq(o.payment?.method, 'Easypaisa', 'payment method')
    eq(o.payment?.amount, 2 * 13.9 + 2 * 3.5 + DELIVERY_FEE, 'amount incl. delivery fee')
    eq(o.payment?.txnId, 'EP-998877', 'payment.txnId')
    const f = await http<FlowState>('GET', API.flow, undefined, tokens.counter)
    eq(f.riders.find((r) => r.id === expectedRider!.id)?.status, 'Available', 'rider status')
    return `collected ${o.payment?.amount} (txn ${o.payment?.txnId})`
  })
  await step('Delivered is final: further change → 409', () => expectStatus(409, http('PATCH', API.orderStatus(idA()), { status: 'Cancelled' }, tokens.counter)))
  await step('customer socket got only its own order, through Delivered', async () => {
    await sleep(300)
    const seq = uniqSeq(orderStatuses(cust.log, idA()))
    eq(seq.join('>'), 'Verifying>Received>Preparing>Ready>Packed>PickedUp>Delivered', 'customer order:updated sequence')
    expect(!cust.log.some((e) => e.event !== SOCKET_EVENTS.order), 'customer received non-order events')
    expect(!cust.log.some((e) => e.data?.id && e.data.id !== idA()), 'customer received another order')
    return seq.join(' → ')
  })
  await step('staff socket saw the call transcript arrive live', async () => {
    const calls = staff.log.filter((e) => e.event === SOCKET_EVENTS.order && e.data.id === idA()).map((e) => (e.data as FlowOrder).call?.state)
    for (const s of ['dialing', 'ringing', 'talking', 'confirmed']) expect(calls.includes(s as never), `missing call state ${s}`)
    return uniqSeq(calls.filter(Boolean) as string[]).join(' → ')
  })

  /* ---------------------------------------------------------------- Misc */
  console.log('\nRules, plans & voice')
  await step('rider cannot change another rider’s status → 403', () => expectStatus(403, http('PATCH', API.riderStatus('rd-1'), { status: 'Offline' }, tokens.rider)))
  await step('Pro-only capability on Free plan', async () => {
    // Every endpoint in the MVP contract maps to a Free feature, so there is no Pro-only route to call.
    return 'SKIPPED — contract exposes no Pro-only endpoint'
  })
  await step('POST /voice/soniox-config without SONIOX_API_KEY → 503 (or 200 when configured)', async () => {
    try {
      const r = await http<{ api_key: string }>('POST', API.sonioxConfig, { usage: 'transcribe_websocket' }, tokens.kitchen)
      expect(r.api_key, 'no api_key')
      return 'key configured: got a temporary key'
    } catch (e) {
      if (e instanceof HttpError && e.status === 503) return `503 "${e.body.message}"`
      throw e
    }
  })
  await step('GET /plans (public)', async () => {
    const plans = await http<{ tiers: unknown[] }>('GET', API.plans)
    eq(plans.tiers.length, 3, 'tiers')
    return `${plans.tiers.length} tiers`
  })
  await step('PATCH /restaurant/plan returns the restaurant with slug', async () => {
    const r = await http<NonNullable<SessionUser['restaurant']>>('PATCH', API.setPlan, { plan: 'Free' }, tokens.admin)
    eq(r.slug, SLUG, 'slug')
    eq(r.plan, 'Free', 'plan')
    return `${r.name} on ${r.plan}`
  })
  await step('plan without customerApp → acceptingOrders false', async () => {
    // Every tier includes customerApp (a Free feature), so no plan can switch the storefront off yet.
    return 'SKIPPED — customerApp is a Free feature'
  })

  staffSock.close()
  customerSock.close()

  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} passed${failed.length ? `, ${failed.length} FAILED:` : ''}`)
  for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`)
  process.exit(failed.length ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
