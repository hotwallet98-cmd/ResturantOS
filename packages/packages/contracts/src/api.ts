/**
 * REST + realtime contract between the backend (Backend/) and its clients
 * (Frontend/, MobileApps/staff, MobileApps/customer).
 *
 * All paths are relative to the API base URL, e.g. http://localhost:5000/api.
 * Staff endpoints need `Authorization: Bearer <token>` from /auth/mfa/verify.
 * Errors: non-2xx with JSON `{ statusCode, message }`.
 */
import type { FlowOrder, FlowRider, FlowState, FlowStatus, FlowTable, MenuItem, PayMethod, Reservation, SessionUser, Station, TableStatus } from './domain'
import type { Feature, Tier, TierInfo } from './plans'

export const API_PREFIX = '/api'
export const DEFAULT_API_PORT = 5000

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

/** POST /auth/login — demo: any password; every account has MFA. */
export interface LoginRequest {
  email: string
  password: string
}
export interface LoginResponse {
  mfaRequired: boolean
  challengeId: string
}

/** POST /auth/mfa/verify — demo: any 6-digit code. */
export interface VerifyMfaRequest {
  challengeId: string
  code: string
}
export interface VerifyMfaResponse {
  token: string
  user: SessionUser
}

/** GET /auth/me → SessionUser */

/* ------------------------------------------------------------------ */
/* Plans                                                               */
/* ------------------------------------------------------------------ */

/** GET /plans (public) */
export interface PlansResponse {
  tiers: TierInfo[]
  features: Record<Feature, { label: string; tier: Tier; description: string }>
}

/** PATCH /restaurant/plan (restaurant_admin) — demo plan switch until billing exists. */
export interface SetPlanRequest {
  plan: Tier
}

/* ------------------------------------------------------------------ */
/* Storefront (public, per restaurant slug)                            */
/* ------------------------------------------------------------------ */

/** GET /public/restaurants/:slug — what a customer app needs to render the store. */
export interface PublicRestaurant {
  id: string
  slug: string
  name: string
  /** Orders are accepted (plan includes customerApp and the store is open). */
  acceptingOrders: boolean
  deliveryFee: number
  currency: string
  /** Shown as "Delivery in 30–40 min". */
  deliveryEtaMins: [number, number]
}

/** GET /public/restaurants/:slug/menu → MenuItem[] (also GET /menu for staff, own restaurant). */
export type MenuResponse = MenuItem[]

/* ------------------------------------------------------------------ */
/* Live operations                                                     */
/* ------------------------------------------------------------------ */

/** GET /flow (staff) — full live state; afterwards keep it fresh from socket events. */
export type FlowResponse = FlowState

/** Line as sent by a client. The server looks up name / price / station from the menu. */
export interface OrderItemInput {
  itemId: string
  qty: number
  /** Variant name(s), e.g. ["Full"]. */
  modifiers?: string[]
  notes?: string
}

/** POST /orders/table (waiter) — waiter device order; logged at counter and forwarded to kitchen (status Received). */
export interface CreateTableOrderRequest {
  tableId: string
  items: OrderItemInput[]
  /** Order-level note for the kitchen; lands on FlowOrder.notes. */
  notes?: string
}

/**
 * POST /public/restaurants/:slug/orders — customer app order (status Placed).
 * The server immediately starts the verification call (status Verifying).
 * `notes` lands on FlowOrder.notes.
 */
export interface CreateCustomerOrderRequest {
  name: string
  phone: string
  address: string
  pay: Extract<PayMethod, 'Cash' | 'Easypaisa'>
  items: OrderItemInput[]
  notes?: string
}
export interface CreateCustomerOrderResponse {
  order: FlowOrder
  /** Needed to track the order without a login. */
  trackingToken: string
}

/** GET /orders/:id/track?token=… (public) */
export interface TrackOrderResponse {
  order: FlowOrder
  rider?: Pick<FlowRider, 'name' | 'phone' | 'vehicle'>
}

/**
 * PATCH /orders/:id/status (staff) — validated with TRANSITIONS + TRANSITION_ROLES. Returns FlowOrder.
 * Paid and Delivered are rejected here (400): use /tables/:id/pay and /orders/:id/deliver.
 */
export interface SetStatusRequest {
  status: FlowStatus
}

/** PATCH /orders/:id/items (kitchen) — per-line done / station, same order as order.items. Returns FlowOrder. */
export interface UpdateItemsRequest {
  items: { done: boolean; station: Station }[]
}

/** POST /orders/:id/remake (kitchen) — new Rush ticket (status Received, price 0) for the same table/customer. */
export interface RemakeRequest {
  itemIndexes: number[]
  reason: string
}

/** POST /orders/:id/verify/call (counter) — (re)start the verification call. `outcome` only matters in demo telephony mode. */
export interface StartCallRequest {
  outcome?: 'confirm' | 'decline' | 'no_answer'
}
/** POST /orders/:id/verify/confirm (counter) — confirm without a call → Received. */
/** POST /orders/:id/cancel (counter) */

/** POST /orders/:id/assign (counter) */
export interface AssignRiderRequest {
  riderId: string
}

/** POST /orders/:id/pickup (rider) — after scanning the bag; body optional. */
export interface PickupRequest {
  /** Order number read from the bag QR, checked against the order. */
  scannedOrderNo?: number
}

/** POST /orders/:id/deliver (rider) — the only way to mark a delivery Delivered; txnId lands on payment.txnId. */
export interface DeliverRequest {
  method: Extract<PayMethod, 'Cash' | 'Easypaisa'>
  txnId?: string
}

/** POST /tables/:id/seat (waiter) */
export interface SeatTableRequest {
  guests: number
  guestName?: string
  reservationId?: string
}
/** POST /tables/:id/bill-request (waiter) */
/**
 * POST /tables/:id/pay (counter) — the only way to mark dine-in orders Paid.
 * Settles every open order on the table (tip split by order total), then frees it.
 */
export interface PayTableRequest {
  method: PayMethod
  tip: number
  txnId?: string
}
export interface PayTableResponse {
  table: FlowTable
  orders: FlowOrder[]
}
/** PATCH /tables/:id/status (waiter, counter) */
export interface SetTableStatusRequest {
  status: TableStatus
}

/** PATCH /riders/:id/status (rider for self, counter, admin) */
export interface SetRiderStatusRequest {
  status: FlowRider['status']
}

/* ------------------------------------------------------------------ */
/* Voice                                                               */
/* ------------------------------------------------------------------ */

/**
 * POST /voice/soniox-config (staff) — temporary Soniox key for the browser / app.
 * 503 when SONIOX_API_KEY is not configured on the server.
 */
export interface SonioxConfigRequest {
  usage?: 'transcribe_websocket' | 'tts_rt'
}
export interface SonioxConfigResponse {
  api_key: string
  region?: string
}

/* ------------------------------------------------------------------ */
/* Realtime (Socket.IO at the server root, path /socket.io)            */
/* ------------------------------------------------------------------ */

/**
 * Staff connect with `auth: { token }` and get `flow:snapshot` on connect,
 * then incremental events. A customer connects with
 * `auth: { orderId, trackingToken }` and only gets `order:updated` for that order.
 */
export const SOCKET_EVENTS = {
  snapshot: 'flow:snapshot',
  order: 'order:updated',
  table: 'table:updated',
  rider: 'rider:updated',
  reservation: 'reservation:updated',
} as const

export interface ServerToClientEvents {
  'flow:snapshot': (state: FlowState) => void
  'order:updated': (order: FlowOrder) => void
  'table:updated': (table: FlowTable) => void
  'rider:updated': (rider: FlowRider) => void
  'reservation:updated': (reservation: Reservation) => void
}

/** Endpoint paths, so clients don't hand-type them. */
export const API = {
  login: '/auth/login',
  verifyMfa: '/auth/mfa/verify',
  me: '/auth/me',
  plans: '/plans',
  setPlan: '/restaurant/plan',
  /** Staff: own restaurant's menu. */
  menu: '/menu',
  publicRestaurant: (slug: string) => `/public/restaurants/${encodeURIComponent(slug)}`,
  publicMenu: (slug: string) => `/public/restaurants/${encodeURIComponent(slug)}/menu`,
  publicOrder: (slug: string) => `/public/restaurants/${encodeURIComponent(slug)}/orders`,
  flow: '/flow',
  tableOrder: '/orders/table',
  track: (id: string, token: string) => `/orders/${id}/track?token=${encodeURIComponent(token)}`,
  orderStatus: (id: string) => `/orders/${id}/status`,
  orderItems: (id: string) => `/orders/${id}/items`,
  remake: (id: string) => `/orders/${id}/remake`,
  startCall: (id: string) => `/orders/${id}/verify/call`,
  confirmOrder: (id: string) => `/orders/${id}/verify/confirm`,
  cancelOrder: (id: string) => `/orders/${id}/cancel`,
  assignRider: (id: string) => `/orders/${id}/assign`,
  pickup: (id: string) => `/orders/${id}/pickup`,
  deliver: (id: string) => `/orders/${id}/deliver`,
  seat: (id: string) => `/tables/${id}/seat`,
  billRequest: (id: string) => `/tables/${id}/bill-request`,
  payTable: (id: string) => `/tables/${id}/pay`,
  tableStatus: (id: string) => `/tables/${id}/status`,
  riderStatus: (id: string) => `/riders/${id}/status`,
  sonioxConfig: '/voice/soniox-config',
} as const
