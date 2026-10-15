/**
 * MVP order flow — the two Free-tier workflows end to end.
 *
 * Dine-in:   waiter seats table → takes order → counter logs & forwards → kitchen
 *            prepares → ready alert (waiter + counter) → waiter picks up & serves
 *            → bill + tip at counter → table freed.
 * Delivery:  customer app order → voice agent verification call → counter
 *            forwards → kitchen voice alert + staff confirm → rider notified →
 *            ready → packed at counter → rider scans pickup → delivers → collects
 *            Cash / Easypaisa.
 *
 * In mock mode the state lives in localStorage and syncs across browser tabs, so
 * the waiter, counter, kitchen, rider and customer screens can run side by side.
 * Each action also calls its REST endpoint so the backend contract is in one place;
 * with a real backend, replace the local store with a websocket feed.
 */
import { applyUpdate, connectOrderFeed, connectStaffFeed } from '@restaurantos/api-client'
import type { FlowState as ApiFlowState } from '@restaurantos/contracts'
import type { Socket } from 'socket.io-client'
import { useEffect, useSyncExternalStore } from 'react'
import { api } from './api'
import { API_BASE_URL, getToken, mutate, USE_MOCKS } from './client'
import type { DiningTable, KitchenTicket, OrderType, Reservation, Station, TicketStatus } from './operations'
import { diningTables, kitchenTickets, menuItems, reservations, riders } from './operations'

export type FlowStatus =
  | 'Placed' // customer app, waiting for verification call
  | 'Verifying' // voice agent is calling the customer
  | 'Received' // logged at counter and forwarded to kitchen
  | 'Preparing' // kitchen confirmed / accepted
  | 'Ready' // chef marked done
  | 'Packed' // delivery: packed at counter, waiting for rider
  | 'PickedUp' // waiter picked up from kitchen / rider scanned pickup
  | 'Served' // dine-in: on the table
  | 'Delivered' // delivery: handed to customer, payment collected
  | 'Paid' // dine-in: bill settled
  | 'Cancelled'

export type OrderSource = 'Waiter' | 'Customer App' | 'Counter'
export type PayMethod = 'Cash' | 'Easypaisa' | 'Card'

export interface FlowItem {
  itemId: string
  name: string
  emoji: string
  qty: number
  price: number
  station: Station
  modifiers: string[]
  notes?: string
  done: boolean
}

export type CallState = 'dialing' | 'ringing' | 'talking' | 'confirmed' | 'declined' | 'no_answer'

export interface VerificationCall {
  state: CallState
  lines: { who: 'agent' | 'customer'; text: string; at: number }[]
  startedAt: number
  attempts: number
}

export interface FlowOrder {
  id: string
  orderNo: number
  type: OrderType
  source: OrderSource
  table?: string
  guests?: number
  waiter?: string
  customer?: { name: string; phone: string; address?: string }
  items: FlowItem[]
  status: FlowStatus
  priority: 'Normal' | 'High' | 'Rush'
  predictedMins: number
  createdAt: string
  updatedAt: string
  history: { status: FlowStatus; at: string }[]
  call?: VerificationCall
  riderId?: string
  /** Delivery payment chosen in the customer app; collected by the rider. */
  payOnDelivery?: PayMethod
  payment?: { method: PayMethod; amount: number; tip: number; at: string }
  remake?: boolean
}

export interface FlowTable extends DiningTable {
  billRequested?: boolean
  reservationId?: string
}

export interface FlowRider {
  id: string
  name: string
  phone: string
  vehicle: string
  status: 'Available' | 'On delivery' | 'Offline'
}

export interface FlowState {
  version: number
  orders: FlowOrder[]
  tables: FlowTable[]
  reservations: Reservation[]
  riders: FlowRider[]
  nextOrderNo: number
}

export const DELIVERY_FEE = 2
export const orderTotal = (o: Pick<FlowOrder, 'items' | 'type'>) => o.items.reduce((s, i) => s + i.qty * i.price, 0) + (o.type === 'Delivery' ? DELIVERY_FEE : 0)

/** Demo identities for the role apps. */
export const DEMO_WAITER = 'Hamza Riaz'
export const DEMO_RIDER_ID = 'rd-4'
export const RESTAURANT_NAME = 'Spice Route Kitchen'

/* ------------------------------------------------------------------ */
/* Seed                                                                */
/* ------------------------------------------------------------------ */

const menuByName = new Map(menuItems.map((m) => [m.name, m]))

export function lineFromMenu(itemId: string, qty: number, modifiers: string[] = [], notes?: string): FlowItem {
  const m = menuItems.find((x) => x.id === itemId)!
  const variant = m.variants.find((v) => modifiers.includes(v.name))
  return { itemId: m.id, name: m.name, emoji: m.emoji, qty, price: m.price + (variant?.price ?? 0), station: m.station, modifiers, notes, done: false }
}

const ticketStatusToFlow: Record<TicketStatus, FlowStatus> = { New: 'Received', Preparing: 'Preparing', Ready: 'Ready', Served: 'Served' }

function seed(): FlowState {
  const orders: FlowOrder[] = kitchenTickets.map((t) => {
    const status = t.type !== 'Dine-in' && t.status === 'Served' ? 'Delivered' : ticketStatusToFlow[t.status]
    return {
      id: t.id,
      orderNo: t.orderNo,
      type: t.type,
      source: t.channel === 'POS' ? 'Waiter' : 'Customer App',
      table: t.table,
      waiter: t.table ? t.server : undefined,
      customer: t.table ? undefined : { name: t.server === 'Online' ? 'Online customer' : t.server, phone: '+92 300 0000000', address: t.type === 'Delivery' ? 'House 12, Street 4, DHA Phase 5, Lahore' : undefined },
      items: t.items.map((i) => {
        const m = menuByName.get(i.name)
        return { itemId: m?.id ?? i.name, name: i.name, emoji: m?.emoji ?? '🍽️', qty: i.qty, price: m?.price ?? 0, station: i.station, modifiers: i.modifiers, notes: i.notes, done: i.done }
      }),
      status,
      priority: t.priority,
      predictedMins: t.predictedMins,
      createdAt: t.createdAt,
      updatedAt: t.createdAt,
      history: [{ status, at: t.createdAt }],
      remake: t.remake,
      payOnDelivery: t.type === 'Delivery' ? 'Cash' : undefined,
    }
  })
  const tables: FlowTable[] = diningTables.map((t) => ({ ...t }))
  return {
    version: 1,
    orders,
    tables,
    reservations: reservations.map((r) => ({ ...r })),
    riders: riders.map((r) => ({ id: r.id, name: r.name, phone: r.phone, vehicle: r.vehicle, status: r.status === 'Available' ? 'Available' : r.status === 'Offline' ? 'Offline' : 'On delivery' })),
    nextOrderNo: Math.max(...orders.map((o) => o.orderNo)) + 1,
  }
}

/* ------------------------------------------------------------------ */
/* Store (localStorage + cross-tab sync)                               */
/* ------------------------------------------------------------------ */

const KEY = 'ros.flow.v1'
const listeners = new Set<() => void>()

function load(): FlowState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as FlowState
  } catch {
    /* storage unavailable or corrupt */
  }
  return seed()
}

let state: FlowState = load()

const emit = () => listeners.forEach((l) => l())

function save() {
  if (!USE_MOCKS) return
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* storage unavailable: state stays in memory */
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return
    state = e.newValue ? (JSON.parse(e.newValue) as FlowState) : seed()
    emit()
  })
}

export function getFlow() {
  return state
}

export function updateFlow(fn: (s: FlowState) => FlowState) {
  state = fn(state)
  save()
  emit()
}

function fromApi(next: ApiFlowState): FlowState {
  return {
    ...next,
    version: state.version + 1,
    nextOrderNo: Math.max(1001, ...next.orders.map((order) => order.orderNo + 1)),
  } as FlowState
}

export function applyServerOrder(order: FlowOrder) {
  updateFlow((current) => ({
    ...current,
    version: current.version + 1,
    orders: current.orders.some((item) => item.id === order.id) ? current.orders.map((item) => (item.id === order.id ? order : item)) : [order, ...current.orders],
  }))
}

function applyServerState(next: ApiFlowState) {
  state = fromApi(next)
  emit()
}

let staffSocket: Socket | null = null
let staffSocketToken: string | null = null
let loadingLiveState = false
const orderSockets = new Map<string, Socket>()
const TRACKING_TOKENS_KEY = 'ros.customer.tracking-tokens'

function trackingTokens(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(TRACKING_TOKENS_KEY) ?? '{}') as Record<string, string>
  } catch {
    return {}
  }
}

function rememberTrackingToken(orderId: string, token: string) {
  try {
    localStorage.setItem(TRACKING_TOKENS_KEY, JSON.stringify({ ...trackingTokens(), [orderId]: token }))
  } catch {
    /* storage unavailable */
  }
}

function trackPublicOrder(orderId: string, token: string) {
  if (orderSockets.has(orderId)) return
  void api.store.track(orderId, token).then(({ order }) => applyServerOrder(order as FlowOrder)).catch(() => undefined)
  orderSockets.set(
    orderId,
    connectOrderFeed(API_BASE_URL, orderId, token, {
      order: (order) => applyServerOrder(order as FlowOrder),
    }),
  )
}

async function ensureLiveConnections() {
  if (USE_MOCKS) return
  const token = getToken()
  if (staffSocket && staffSocketToken !== token) {
    staffSocket.disconnect()
    staffSocket = null
    staffSocketToken = null
  }
  if (token && !staffSocket) {
    staffSocketToken = token
    if (!loadingLiveState) {
      loadingLiveState = true
      void api.flow().then(applyServerState).finally(() => {
        loadingLiveState = false
      })
    }
    staffSocket = connectStaffFeed(API_BASE_URL, token, {
      snapshot: applyServerState,
      order: (order) => applyServerOrder(order as FlowOrder),
      table: (table) => applyServerState(applyUpdate(state, 'tables', table) as ApiFlowState),
      rider: (rider) => applyServerState(applyUpdate(state, 'riders', rider) as ApiFlowState),
      reservation: (reservation) => applyServerState(applyUpdate(state, 'reservations', reservation) as ApiFlowState),
    })
  }
  for (const [orderId, trackingToken] of Object.entries(trackingTokens())) trackPublicOrder(orderId, trackingToken)
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useFlow(): FlowState {
  useEffect(() => {
    void ensureLiveConnections()
  }, [])
  return useSyncExternalStore(subscribe, getFlow)
}

export function resetFlow() {
  if (!USE_MOCKS) {
    void api.flow().then(applyServerState)
    return
  }
  state = seed()
  save()
  emit()
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

const now = () => new Date().toISOString()

function patchOrder(id: string, fn: (o: FlowOrder) => FlowOrder) {
  updateFlow((s) => ({ ...s, orders: s.orders.map((o) => (o.id === id ? { ...fn(o), updatedAt: now() } : o)) }))
}

function patchTable(id: string, fn: (t: FlowTable) => FlowTable) {
  updateFlow((s) => ({ ...s, tables: s.tables.map((t) => (t.id === id ? fn(t) : t)) }))
}

export function setOrderStatus(id: string, status: FlowStatus) {
  const o = state.orders.find((x) => x.id === id)
  if (!o || o.status === status) return
  patchOrder(id, (x) => ({
    ...x,
    status,
    items: status === 'Ready' ? x.items.map((i) => ({ ...i, done: true })) : x.items,
    history: [...x.history, { status, at: now() }],
  }))
  if (USE_MOCKS) void mutate(`/orders/${id}/status`, 'PATCH', { id, status })
  else void api.orders.setStatus(id, status).then((order) => applyServerOrder(order as FlowOrder))

  // Rider is notified as soon as the kitchen accepts a delivery (phone + address)
  if (status === 'Preparing' && o.type === 'Delivery' && !o.riderId) {
    const rider = state.riders.find((r) => r.status === 'Available')
    if (rider) assignRider(id, rider.id)
  }
}

export function updateOrderItems(id: string, items: FlowItem[]) {
  patchOrder(id, (o) => ({ ...o, items }))
  if (!USE_MOCKS) void api.orders.updateItems(id, { items: items.map(({ done, station }) => ({ done, station })) }).then((order) => applyServerOrder(order as FlowOrder))
}

function newOrder(partial: Omit<FlowOrder, 'id' | 'orderNo' | 'createdAt' | 'updatedAt' | 'history'>): FlowOrder {
  const orderNo = state.nextOrderNo
  const at = now()
  const order: FlowOrder = { ...partial, id: `ord-${orderNo}-${Date.now().toString(36)}`, orderNo, createdAt: at, updatedAt: at, history: [{ status: partial.status, at }] }
  updateFlow((s) => ({ ...s, nextOrderNo: s.nextOrderNo + 1, orders: [order, ...s.orders] }))
  void mutate('/orders', 'POST', order)
  return order
}

/** Kitchen remakes and demo orders enter straight at the counter / kitchen. */
export function addOrder(partial: Omit<FlowOrder, 'id' | 'orderNo' | 'createdAt' | 'updatedAt' | 'history'>) {
  return newOrder(partial)
}

const prepMins = (items: FlowItem[]) => Math.max(8, ...items.map((i) => menuItems.find((m) => m.id === i.itemId)?.prepMins ?? 10)) + Math.min(10, items.length * 2)

/* Customer app */

export async function placeCustomerOrder(input: { name: string; phone: string; address: string; items: FlowItem[]; pay: PayMethod; notes?: string }): Promise<FlowOrder> {
  if (!USE_MOCKS) {
    const result = await api.store.placeOrder('spice-route', {
      name: input.name,
      phone: input.phone,
      address: input.address,
      pay: input.pay === 'Easypaisa' ? 'Easypaisa' : 'Cash',
      items: input.items.map(({ itemId, qty, modifiers, notes }) => ({ itemId, qty, modifiers, notes })),
      notes: input.notes,
    })
    const order = result.order as FlowOrder
    rememberTrackingToken(order.id, result.trackingToken)
    applyServerOrder(order)
    trackPublicOrder(order.id, result.trackingToken)
    return order
  }
  return newOrder({
    type: 'Delivery',
    source: 'Customer App',
    customer: { name: input.name, phone: input.phone, address: input.address },
    items: input.items.map((i) => ({ ...i, notes: i.notes ?? undefined })),
    status: 'Placed',
    priority: 'Normal',
    predictedMins: prepMins(input.items),
    payOnDelivery: input.pay,
  })
}

/* Verification call (voice agent → customer) */

export function setCall(id: string, fn: (c: VerificationCall | undefined) => VerificationCall) {
  patchOrder(id, (o) => ({ ...o, call: fn(o.call) }))
}

/** Forward a verified customer order to the kitchen. */
export function confirmVerified(id: string) {
  if (USE_MOCKS) setOrderStatus(id, 'Received')
  else void api.orders.confirm(id).then((order) => applyServerOrder(order as FlowOrder))
}

export function cancelOrder(id: string) {
  if (USE_MOCKS) setOrderStatus(id, 'Cancelled')
  else void api.orders.cancel(id).then((order) => applyServerOrder(order as FlowOrder))
}

/* Waiter */

export function seatTable(tableId: string, input: { guests: number; guestName: string; reservationId?: string; waiter: string }) {
  patchTable(tableId, (t) => ({
    ...t,
    status: 'Occupied',
    guests: input.guests,
    guestName: input.guestName,
    server: input.waiter,
    seatedAt: now(),
    reservedFor: undefined,
    reservationId: input.reservationId,
    billRequested: false,
    billTotal: 0,
  }))
  if (input.reservationId) {
    updateFlow((s) => ({ ...s, reservations: s.reservations.map((r) => (r.id === input.reservationId ? { ...r, status: 'Seated', table: tableId } : r)) }))
  }
  if (USE_MOCKS) void mutate(`/tables/${tableId}/seat`, 'POST', { tableId, ...input })
  else void api.tables.seat(tableId, { guests: input.guests, guestName: input.guestName, reservationId: input.reservationId })
}

export async function sendTableOrder(tableId: string, items: FlowItem[], waiter: string): Promise<FlowOrder> {
  if (!USE_MOCKS) {
    const order = await api.orders.createForTable({
      tableId,
      items: items.map(({ itemId, qty, modifiers, notes }) => ({ itemId, qty, modifiers, notes })),
      notes: items.find((item) => item.notes)?.notes,
    })
    applyServerOrder(order as FlowOrder)
    return order as FlowOrder
  }
  const table = state.tables.find((t) => t.id === tableId)
  // Waiter device → counter logs it and forwards to the kitchen in one step
  return newOrder({ type: 'Dine-in', source: 'Waiter', table: tableId, guests: table?.guests, waiter, items, status: 'Received', priority: 'Normal', predictedMins: prepMins(items) })
}

export function setTableStatus(tableId: string, status: FlowTable['status']) {
  patchTable(tableId, (t) => ({ ...t, status }))
  if (!USE_MOCKS) void api.tables.setStatus(tableId, status)
}

export function requestBill(tableId: string) {
  patchTable(tableId, (t) => ({ ...t, billRequested: true }))
  if (!USE_MOCKS) void api.tables.requestBill(tableId)
}

export const tableOrders = (s: FlowState, tableId: string) => s.orders.filter((o) => o.table === tableId && o.type === 'Dine-in' && !['Paid', 'Cancelled'].includes(o.status))

export function payTable(tableId: string, method: PayMethod, tip: number) {
  const open = tableOrders(state, tableId)
  const total = open.reduce((s, o) => s + orderTotal(o), 0)
  const at = now()
  updateFlow((s) => ({
    ...s,
    orders: s.orders.map((o) =>
      open.some((x) => x.id === o.id)
        ? { ...o, status: 'Paid', updatedAt: at, history: [...o.history, { status: 'Paid', at }], payment: { method, amount: orderTotal(o), tip: total ? (tip * orderTotal(o)) / total : 0, at } }
        : o,
    ),
    // Table freed after payment
    tables: s.tables.map((t) =>
      t.id === tableId ? { ...t, status: 'Available', guests: undefined, guestName: undefined, server: undefined, seatedAt: undefined, billTotal: undefined, billRequested: false, reservationId: undefined } : t,
    ),
  }))
  if (USE_MOCKS) void mutate(`/tables/${tableId}/pay`, 'POST', { tableId, method, tip, total })
  else void api.tables.pay(tableId, { method, tip }).then(({ table, orders }) => {
    applyServerState({ ...state, tables: state.tables.map((item) => (item.id === table.id ? table : item)), orders: state.orders.map((item) => orders.find((order) => order.id === item.id) ?? item) } as ApiFlowState)
  })
}

/* Rider */

export function assignRider(orderId: string, riderId: string) {
  updateFlow((s) => ({
    ...s,
    orders: s.orders.map((o) => (o.id === orderId ? { ...o, riderId, updatedAt: now() } : o)),
    riders: s.riders.map((r) => (r.id === riderId ? { ...r, status: 'On delivery' } : r)),
  }))
  if (USE_MOCKS) void mutate(`/orders/${orderId}/assign`, 'POST', { riderId })
  else void api.orders.assignRider(orderId, { riderId }).then((order) => applyServerOrder(order as FlowOrder))
}

export function setRiderStatus(riderId: string, status: FlowRider['status']) {
  updateFlow((s) => ({ ...s, riders: s.riders.map((r) => (r.id === riderId ? { ...r, status } : r)) }))
  if (!USE_MOCKS) void api.riders.setStatus(riderId, { status })
}

export function riderPickup(orderId: string) {
  if (USE_MOCKS) setOrderStatus(orderId, 'PickedUp')
  else void api.orders.pickup(orderId).then((order) => applyServerOrder(order as FlowOrder))
}

export function deliverOrder(orderId: string, method: PayMethod) {
  const o = state.orders.find((x) => x.id === orderId)
  if (!o) return
  const at = now()
  updateFlow((s) => ({
    ...s,
    orders: s.orders.map((x) =>
      x.id === orderId ? { ...x, status: 'Delivered', updatedAt: at, history: [...x.history, { status: 'Delivered', at }], payment: { method, amount: orderTotal(x), tip: 0, at } } : x,
    ),
    riders: s.riders.map((r) => (r.id === o.riderId && !s.orders.some((y) => y.id !== orderId && y.riderId === r.id && ['Preparing', 'Ready', 'Packed', 'PickedUp'].includes(y.status)) ? { ...r, status: 'Available' } : r)),
  }))
  if (USE_MOCKS) void mutate(`/orders/${orderId}/deliver`, 'POST', { method })
  else void api.orders.deliver(orderId, { method: method === 'Easypaisa' ? 'Easypaisa' : 'Cash' }).then((order) => applyServerOrder(order as FlowOrder))
}

/* ------------------------------------------------------------------ */
/* Kitchen view of the flow                                            */
/* ------------------------------------------------------------------ */

const flowToTicket: Partial<Record<FlowStatus, TicketStatus>> = {
  Received: 'New',
  Preparing: 'Preparing',
  Ready: 'Ready',
  Packed: 'Served',
  PickedUp: 'Served',
  Served: 'Served',
  Delivered: 'Served',
  Paid: 'Served',
}

/** Orders the kitchen sees (verified and not cancelled), as KDS tickets. */
export function toTickets(orders: FlowOrder[]): KitchenTicket[] {
  return orders
    .filter((o) => flowToTicket[o.status])
    .map((o) => ({
      id: o.id,
      orderNo: o.orderNo,
      type: o.type,
      table: o.table,
      channel: o.source === 'Customer App' ? 'Mobile App' : 'POS',
      server: o.waiter ?? 'Online',
      items: o.items.map((i) => ({ name: i.name, qty: i.qty, station: i.station, modifiers: i.modifiers, notes: i.notes, done: i.done })),
      status: flowToTicket[o.status]!,
      priority: o.priority,
      createdAt: o.createdAt,
      predictedMins: o.predictedMins,
      remake: o.remake,
    }))
}

/** KDS bump → flow status. "Handed over" means picked up (dine-in) or packed (delivery). */
export function ticketStatusFor(o: FlowOrder, t: TicketStatus): FlowStatus {
  if (t === 'Served') return o.type === 'Dine-in' ? 'PickedUp' : 'Packed'
  return ticketStatusToFlow[t]
}

export const isActive = (o: FlowOrder) => !['Served', 'Delivered', 'Paid', 'Cancelled'].includes(o.status)

export const ageMins = (iso: string) => (Date.now() - new Date(iso).getTime()) / 60000
