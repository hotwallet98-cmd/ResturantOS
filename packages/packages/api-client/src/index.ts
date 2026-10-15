/**
 * Typed client for the RestaurantOS API — one implementation for every app
 * (web console, storefront, staff and customer mobile apps).
 *
 * Framework-agnostic: uses `fetch` and socket.io-client (peer dependency),
 * no React, no storage. Apps inject how the auth token is read.
 */
import type {
  AssignRiderRequest,
  CreateCustomerOrderRequest,
  CreateCustomerOrderResponse,
  CreateTableOrderRequest,
  DeliverRequest,
  FlowOrder,
  FlowResponse,
  FlowRider,
  FlowState,
  FlowStatus,
  FlowTable,
  LoginRequest,
  LoginResponse,
  MenuResponse,
  PayTableRequest,
  PayTableResponse,
  PickupRequest,
  PlansResponse,
  PublicRestaurant,
  RemakeRequest,
  Reservation,
  SeatTableRequest,
  SessionUser,
  SetRiderStatusRequest,
  SonioxConfigRequest,
  SonioxConfigResponse,
  StartCallRequest,
  TableStatus,
  Tier,
  TrackOrderResponse,
  UpdateItemsRequest,
  VerifyMfaRequest,
  VerifyMfaResponse,
} from '@restaurantos/contracts'
import { API, SOCKET_EVENTS } from '@restaurantos/contracts'
import type { Socket } from 'socket.io-client'
import { io } from 'socket.io-client'

export class ApiError extends Error {
  readonly status: number
  readonly body: unknown
  constructor(status: number, message: string, body?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

export interface ApiClientOptions {
  /** e.g. http://localhost:5000/api */
  baseUrl: string
  /** Returns the staff JWT, if signed in. May be async (SecureStore). */
  getToken?: () => string | null | undefined | Promise<string | null | undefined>
  /** Called on 401 so the app can sign the user out. */
  onUnauthorized?: () => void
  fetch?: typeof fetch
}

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

/** Socket.IO lives at the server root, the REST API under /api. */
export const socketUrlFrom = (baseUrl: string) => baseUrl.replace(/\/api\/?$/, '')

export function createApiClient(opts: ApiClientOptions) {
  const doFetch = opts.fetch ?? fetch
  const base = opts.baseUrl.replace(/\/$/, '')

  async function request<T>(method: Method, path: string, body?: unknown, auth = true): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    if (auth) {
      const token = await opts.getToken?.()
      if (token) headers.Authorization = `Bearer ${token}`
    }
    let res: Response
    try {
      res = await doFetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
    } catch {
      throw new ApiError(0, `Can't reach the server at ${base}. Check your connection.`)
    }
    const text = await res.text()
    const data: unknown = text ? safeJson(text) : undefined
    if (!res.ok) {
      if (res.status === 401) opts.onUnauthorized?.()
      const msg = (data && typeof data === 'object' && 'message' in data ? (data as { message: unknown }).message : undefined) ?? res.statusText
      throw new ApiError(res.status, Array.isArray(msg) ? msg.join(', ') : String(msg), data)
    }
    return data as T
  }

  const get = <T>(path: string, auth = true) => request<T>('GET', path, undefined, auth)
  const post = <T>(path: string, body?: unknown, auth = true) => request<T>('POST', path, body ?? {}, auth)
  const patch = <T>(path: string, body: unknown) => request<T>('PATCH', path, body)

  return {
    request,
    auth: {
      login: (req: LoginRequest) => post<LoginResponse>(API.login, req, false),
      verifyMfa: (req: VerifyMfaRequest) => post<VerifyMfaResponse>(API.verifyMfa, req, false),
      me: () => get<SessionUser>(API.me),
    },
    plans: {
      list: () => get<PlansResponse>(API.plans, false),
      set: (plan: Tier) => patch<{ plan: Tier }>(API.setPlan, { plan }),
    },
    /** Public, per restaurant (customer apps). */
    store: {
      restaurant: (slug: string) => get<PublicRestaurant>(API.publicRestaurant(slug), false),
      menu: (slug: string) => get<MenuResponse>(API.publicMenu(slug), false),
      placeOrder: (slug: string, req: CreateCustomerOrderRequest) => post<CreateCustomerOrderResponse>(API.publicOrder(slug), req, false),
      track: (orderId: string, token: string) => get<TrackOrderResponse>(API.track(orderId, token), false),
    },
    /** Staff */
    menu: () => get<MenuResponse>(API.menu),
    flow: () => get<FlowResponse>(API.flow),
    orders: {
      createForTable: (req: CreateTableOrderRequest) => post<FlowOrder>(API.tableOrder, req),
      setStatus: (id: string, status: FlowStatus) => patch<FlowOrder>(API.orderStatus(id), { status }),
      updateItems: (id: string, req: UpdateItemsRequest) => patch<FlowOrder>(API.orderItems(id), req),
      remake: (id: string, req: RemakeRequest) => post<FlowOrder>(API.remake(id), req),
      startCall: (id: string, req: StartCallRequest = {}) => post<FlowOrder>(API.startCall(id), req),
      confirm: (id: string) => post<FlowOrder>(API.confirmOrder(id)),
      cancel: (id: string) => post<FlowOrder>(API.cancelOrder(id)),
      assignRider: (id: string, req: AssignRiderRequest) => post<FlowOrder>(API.assignRider(id), req),
      pickup: (id: string, req: PickupRequest = {}) => post<FlowOrder>(API.pickup(id), req),
      deliver: (id: string, req: DeliverRequest) => post<FlowOrder>(API.deliver(id), req),
    },
    tables: {
      seat: (id: string, req: SeatTableRequest) => post<FlowTable>(API.seat(id), req),
      requestBill: (id: string) => post<FlowTable>(API.billRequest(id)),
      pay: (id: string, req: PayTableRequest) => post<PayTableResponse>(API.payTable(id), req),
      setStatus: (id: string, status: TableStatus) => patch<FlowTable>(API.tableStatus(id), { status }),
    },
    riders: {
      setStatus: (id: string, req: SetRiderStatusRequest) => patch<FlowRider>(API.riderStatus(id), req),
    },
    voice: {
      sonioxConfig: (req: SonioxConfigRequest = {}) => post<SonioxConfigResponse>(API.sonioxConfig, req),
    },
  }
}

export type ApiClient = ReturnType<typeof createApiClient>

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/* ------------------------------------------------------------------ */
/* Realtime                                                            */
/* ------------------------------------------------------------------ */

export interface FlowHandlers {
  snapshot?: (state: FlowState) => void
  order?: (order: FlowOrder) => void
  table?: (table: FlowTable) => void
  rider?: (rider: FlowRider) => void
  reservation?: (reservation: Reservation) => void
  /** Connection state for an "offline / reconnecting" banner. */
  status?: (connected: boolean) => void
  error?: (message: string) => void
}

function wire(socket: Socket, h: FlowHandlers) {
  if (h.snapshot) socket.on(SOCKET_EVENTS.snapshot, h.snapshot)
  if (h.order) socket.on(SOCKET_EVENTS.order, h.order)
  if (h.table) socket.on(SOCKET_EVENTS.table, h.table)
  if (h.rider) socket.on(SOCKET_EVENTS.rider, h.rider)
  if (h.reservation) socket.on(SOCKET_EVENTS.reservation, h.reservation)
  socket.on('connect', () => h.status?.(true))
  socket.on('disconnect', () => h.status?.(false))
  socket.on('connect_error', (e: Error) => {
    h.status?.(false)
    h.error?.(e.message)
  })
  return socket
}

/** Staff feed: `flow:snapshot` on connect, then incremental updates for the restaurant. */
export function connectStaffFeed(baseUrl: string, token: string, handlers: FlowHandlers): Socket {
  return wire(io(socketUrlFrom(baseUrl), { auth: { token }, transports: ['websocket'] }), handlers)
}

/** Customer feed: `order:updated` for one order, authorised by its tracking token. */
export function connectOrderFeed(baseUrl: string, orderId: string, trackingToken: string, handlers: Pick<FlowHandlers, 'order' | 'status' | 'error'>): Socket {
  return wire(io(socketUrlFrom(baseUrl), { auth: { orderId, trackingToken }, transports: ['websocket'] }), handlers)
}

/** Apply a socket event to a FlowState immutably (shared by every client store). */
export function applyUpdate<K extends 'orders' | 'tables' | 'riders' | 'reservations'>(state: FlowState, key: K, item: FlowState[K][number]): FlowState {
  const list = state[key] as { id: string }[]
  const exists = list.some((x) => x.id === item.id)
  return { ...state, [key]: exists ? list.map((x) => (x.id === item.id ? item : x)) : [item, ...list] }
}
