import type { FlowOrder, FlowState } from '@restaurantos/contracts'

export const WAITER_ACTIVE = ['Received', 'Preparing', 'Ready', 'PickedUp'] as const
export const RIDER_ACTIVE = ['Received', 'Preparing', 'Ready', 'Packed', 'PickedUp'] as const

/** Open dine-in orders on a table (same rule as the web prototype). */
export const tableOrders = (s: FlowState, tableId: string) =>
  s.orders.filter((o) => o.table === tableId && o.type === 'Dine-in' && !['Paid', 'Cancelled'].includes(o.status))

const byNewest = (a: FlowOrder, b: FlowOrder) => b.createdAt.localeCompare(a.createdAt)

/** Orders belong to a waiter by name (FlowOrder.waiter / FlowTable.server hold the waiter's name). */
export function waiterView(s: FlowState, me: string) {
  const mine = s.orders.filter((o) => o.type === 'Dine-in' && o.waiter === me)
  const active = mine.filter((o) => (WAITER_ACTIVE as readonly string[]).includes(o.status)).sort(byNewest)
  const ready = active.filter((o) => o.status === 'Ready')
  const pickedUp = active.filter((o) => o.status === 'PickedUp')
  return { active, ready, pickedUp }
}

export function riderView(s: FlowState, riderId: string | undefined) {
  const mine = riderId ? s.orders.filter((o) => o.riderId === riderId) : []
  const active = mine.filter((o) => (RIDER_ACTIVE as readonly string[]).includes(o.status)).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const delivered = mine.filter((o) => o.status === 'Delivered').sort((a, b) => (b.payment?.at ?? b.updatedAt).localeCompare(a.payment?.at ?? a.updatedAt))
  return { active, delivered, rider: s.riders.find((r) => r.id === riderId) }
}

/** Rider step: Notified → At counter → Picked up → Delivered. */
export const RIDER_STEPS = ['Notified', 'At counter', 'Picked up', 'Delivered'] as const
export const riderStep = (o: FlowOrder) => (o.status === 'Delivered' ? 3 : o.status === 'PickedUp' ? 2 : o.status === 'Ready' || o.status === 'Packed' ? 1 : 0)
