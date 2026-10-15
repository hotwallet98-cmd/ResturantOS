/**
 * Live operations store: GET /flow once, then kept fresh by Socket.IO events.
 * React context + reducer (no Redux).
 */
import { connectStaffFeed } from '@restaurantos/api-client'
import type { FlowOrder, FlowRider, FlowState, FlowTable, Reservation } from '@restaurantos/contracts'
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react'
import { AppState } from 'react-native'
import { api, ApiError, errorMessage } from '@/lib/api'
import { SOCKET_URL } from '@/lib/config'
import { useAuth } from './auth'

export type Connection = 'connecting' | 'online' | 'reconnecting' | 'offline'

type Action =
  | { type: 'snapshot'; state: FlowState }
  | { type: 'order'; order: FlowOrder }
  | { type: 'table'; table: FlowTable }
  | { type: 'rider'; rider: FlowRider }
  | { type: 'reservation'; reservation: Reservation }
  | { type: 'reset' }

const EMPTY: FlowState = { orders: [], tables: [], reservations: [], riders: [] }

function upsert<T extends { id: string }>(list: T[], item: T, isNewer: (a: T, b: T) => boolean = () => true): T[] {
  const i = list.findIndex((x) => x.id === item.id)
  if (i === -1) return [...list, item]
  if (!isNewer(item, list[i])) return list
  const next = list.slice()
  next[i] = item
  return next
}

/** Don't let a late REST response overwrite a newer socket update (or vice versa). */
const newerOrder = (a: FlowOrder, b: FlowOrder) => !a.updatedAt || !b.updatedAt || a.updatedAt >= b.updatedAt

function reducer(state: FlowState, action: Action): FlowState {
  switch (action.type) {
    case 'snapshot':
      return {
        orders: action.state.orders ?? [],
        tables: action.state.tables ?? [],
        reservations: action.state.reservations ?? [],
        riders: action.state.riders ?? [],
      }
    case 'order':
      return { ...state, orders: upsert(state.orders, action.order, newerOrder) }
    case 'table':
      return { ...state, tables: upsert(state.tables, action.table) }
    case 'rider':
      return { ...state, riders: upsert(state.riders, action.rider) }
    case 'reservation':
      return { ...state, reservations: upsert(state.reservations, action.reservation) }
    case 'reset':
      return EMPTY
  }
}

interface FlowContextValue {
  flow: FlowState
  loaded: boolean
  loadError: string | null
  connection: Connection
  refresh: () => Promise<void>
  applyOrder: (o: FlowOrder | undefined) => void
  applyTable: (t: FlowTable | undefined) => void
  applyRider: (r: FlowRider | undefined) => void
}

const FlowContext = createContext<FlowContextValue | null>(null)

export function FlowProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth()
  const [flow, dispatch] = useReducer(reducer, EMPTY)
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [connection, setConnection] = useState<Connection>('connecting')

  const refresh = useCallback(async () => {
    try {
      const state = await api.flow()
      dispatch({ type: 'snapshot', state })
      setLoaded(true)
      setLoadError(null)
    } catch (e) {
      setLoadError(errorMessage(e))
    }
  }, [])

  useEffect(() => {
    if (!token) {
      dispatch({ type: 'reset' })
      setLoaded(false)
      setLoadError(null)
      return
    }
    let disposed = false
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    setConnection('connecting')
    void refresh()

    // Data events come from the shared feed; connection handling below stays app-specific.
    const socket = connectStaffFeed(SOCKET_URL, token, {
      snapshot: (state) => {
        dispatch({ type: 'snapshot', state })
        setLoaded(true)
        setLoadError(null)
      },
      order: (order) => dispatch({ type: 'order', order }),
      table: (table) => dispatch({ type: 'table', table }),
      rider: (rider) => dispatch({ type: 'rider', rider }),
      reservation: (reservation) => dispatch({ type: 'reservation', reservation }),
    })
    socket.io.reconnectionDelay(1000).reconnectionDelayMax(10_000).timeout(10_000)

    socket.on('connect', () => setConnection('online'))
    socket.on('disconnect', (reason) => {
      if (disposed) return
      setConnection('reconnecting')
      // The server kicked us: socket.io won't retry by itself.
      if (reason === 'io server disconnect') retryTimer = setTimeout(() => socket.connect(), 2000)
    })
    socket.on('connect_error', () => {
      if (disposed) return
      setConnection((c) => (c === 'online' || c === 'reconnecting' ? 'reconnecting' : 'offline'))
      if (!socket.active) {
        // Rejected by the server's auth middleware. If the token is really dead /auth/me 401s → signOut.
        api.auth
          .me()
          .then(() => {
            if (!disposed) retryTimer = setTimeout(() => socket.connect(), 5000)
          })
          .catch((e) => {
            if (!disposed && !(e instanceof ApiError && e.status === 401)) retryTimer = setTimeout(() => socket.connect(), 5000)
          })
      }
    })
    socket.io.on('reconnect_attempt', () => !disposed && setConnection('reconnecting'))

    // Back from background: make sure we're connected and catch up.
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return
      if (!socket.connected) socket.connect()
      void refresh()
    })

    return () => {
      disposed = true
      clearTimeout(retryTimer)
      sub.remove()
      socket.removeAllListeners()
      socket.io.removeAllListeners()
      socket.disconnect()
    }
  }, [token, refresh])

  const value = useMemo<FlowContextValue>(
    () => ({
      flow,
      loaded,
      loadError,
      connection,
      refresh,
      // REST responses are applied too (guarded: the contract doesn't promise every endpoint returns the entity).
      applyOrder: (order) => order?.id && dispatch({ type: 'order', order }),
      applyTable: (table) => table?.id && dispatch({ type: 'table', table }),
      applyRider: (rider) => rider?.id && dispatch({ type: 'rider', rider }),
    }),
    [flow, loaded, loadError, connection, refresh],
  )
  return <FlowContext.Provider value={value}>{children}</FlowContext.Provider>
}

export function useFlow() {
  const ctx = useContext(FlowContext)
  if (!ctx) throw new Error('useFlow must be used inside <FlowProvider>')
  return ctx
}
