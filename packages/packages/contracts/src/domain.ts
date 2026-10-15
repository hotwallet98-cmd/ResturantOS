/**
 * Domain model shared by the web frontend, the NestJS backend and the mobile apps.
 * Pure types and functions only — no runtime dependencies.
 */
import type { Tier } from './plans'

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

export type Role = 'super_admin' | 'restaurant_admin' | 'kitchen_staff' | 'counter_staff' | 'waiter' | 'rider'

export interface SessionUser {
  id: string
  name: string
  email: string
  role: Role
  title: string
  restaurant?: { id: string; slug: string; name: string; branches: string[]; plan: Tier }
  /** Rider profile id when role === 'rider'. */
  riderId?: string
}

/* ------------------------------------------------------------------ */
/* Menu                                                                */
/* ------------------------------------------------------------------ */

export type Station = 'Grill' | 'Tandoor' | 'Wok' | 'Cold' | 'Drinks'
export const STATIONS: Station[] = ['Grill', 'Tandoor', 'Wok', 'Cold', 'Drinks']

export interface PriceOption {
  name: string
  price: number
}

export interface MenuItem {
  id: string
  name: string
  emoji: string
  category: string
  description: string
  price: number
  station: Station
  prepMins: number
  veg: boolean
  available: boolean
  variants: PriceOption[]
}

/* ------------------------------------------------------------------ */
/* Orders (the two MVP workflows)                                      */
/* ------------------------------------------------------------------ */

export type OrderType = 'Dine-in' | 'Takeaway' | 'Delivery'
export type OrderSource = 'Waiter' | 'Customer App' | 'Counter'
export type PayMethod = 'Cash' | 'Easypaisa' | 'Card'

export type FlowStatus =
  | 'Placed' // customer app, waiting for verification call
  | 'Verifying' // voice agent is calling the customer
  | 'Received' // logged at counter and forwarded to kitchen
  | 'Preparing' // kitchen confirmed / accepted
  | 'Ready' // chef marked done
  | 'Packed' // delivery: packed at counter, waiting for rider
  | 'PickedUp' // waiter picked up from kitchen / rider scanned pickup
  | 'Served' // dine-in: on the table
  | 'Delivered' // delivery: handed over, payment collected
  | 'Paid' // dine-in: bill settled
  | 'Cancelled'

export interface FlowItem {
  itemId: string
  name: string
  emoji: string
  qty: number
  /** Unit price incl. variant, set by the server from the menu. */
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
  /** Order-level note from the customer or waiter, shown to the kitchen. */
  notes?: string
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
  payment?: { method: PayMethod; amount: number; tip: number; at: string; /** Easypaisa / card reference */ txnId?: string }
  remake?: boolean
}

export type TableStatus = 'Available' | 'Occupied' | 'Reserved' | 'Cleaning'
export type FloorArea = 'Main Hall' | 'Terrace' | 'Family' | 'VIP'

export interface FlowTable {
  id: string
  name: string
  area: FloorArea
  seats: number
  shape: 'round' | 'square' | 'rect'
  status: TableStatus
  col: number
  row: number
  guests?: number
  guestName?: string
  server?: string
  seatedAt?: string
  billTotal?: number
  reservedFor?: string
  billRequested?: boolean
  reservationId?: string
}

export interface Reservation {
  id: string
  guest: string
  phone: string
  party: number
  time: string
  table?: string
  area: FloorArea
  source: 'Online' | 'Phone' | 'Walk-in' | 'Website' | 'Google'
  status: 'Confirmed' | 'Pending' | 'Seated' | 'Cancelled' | 'Completed'
  occasion?: string
  notes?: string
  noShowRisk: number
  visits: number
}

export interface FlowRider {
  id: string
  name: string
  phone: string
  vehicle: string
  status: 'Available' | 'On delivery' | 'Offline'
}

export interface FlowState {
  orders: FlowOrder[]
  tables: FlowTable[]
  reservations: Reservation[]
  riders: FlowRider[]
}

/* ------------------------------------------------------------------ */
/* Rules                                                               */
/* ------------------------------------------------------------------ */

export const DELIVERY_FEE = 2

export const itemsTotal = (items: Pick<FlowItem, 'qty' | 'price'>[]) => items.reduce((s, i) => s + i.qty * i.price, 0)
export const orderTotal = (o: Pick<FlowOrder, 'items' | 'type'>) => itemsTotal(o.items) + (o.type === 'Delivery' ? DELIVERY_FEE : 0)

export const isActiveOrder = (o: Pick<FlowOrder, 'status'>) => !['Served', 'Delivered', 'Paid', 'Cancelled'].includes(o.status)

/** Allowed status changes. Anything else is rejected by the backend. */
export const TRANSITIONS: Record<FlowStatus, FlowStatus[]> = {
  Placed: ['Verifying', 'Received', 'Cancelled'],
  Verifying: ['Verifying', 'Received', 'Cancelled'],
  Received: ['Preparing', 'Cancelled'],
  Preparing: ['Ready', 'Received'],
  Ready: ['Packed', 'PickedUp', 'Preparing'],
  Packed: ['PickedUp'],
  PickedUp: ['Served', 'Delivered'],
  Served: ['Paid'],
  Delivered: [],
  Paid: [],
  Cancelled: [],
}

export const canTransition = (from: FlowStatus, to: FlowStatus) => TRANSITIONS[from].includes(to)

/** Which staff roles may move an order into each status (restaurant_admin may do all). */
export const TRANSITION_ROLES: Record<FlowStatus, Role[]> = {
  Placed: [],
  Verifying: ['counter_staff'],
  Received: ['counter_staff', 'kitchen_staff'],
  Preparing: ['kitchen_staff'],
  Ready: ['kitchen_staff'],
  Packed: ['counter_staff', 'kitchen_staff'],
  PickedUp: ['waiter', 'rider', 'kitchen_staff'],
  Served: ['waiter'],
  Delivered: ['rider'],
  Paid: ['counter_staff'],
  Cancelled: ['counter_staff'],
}

export const roleCanSet = (role: Role, to: FlowStatus) => role === 'restaurant_admin' || TRANSITION_ROLES[to].includes(role)
