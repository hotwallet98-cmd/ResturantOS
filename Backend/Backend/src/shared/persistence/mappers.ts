/** DB rows → contract types (@restaurantos/contracts). Null columns become absent keys. */
import type { FloorArea, FlowItem, FlowOrder, FlowRider, FlowTable, MenuItem, PriceOption, Reservation, SessionUser, Station, TableStatus, Tier } from '@restaurantos/contracts'
import type { DiningTable, MenuItem as MenuRow, OrderItem, Reservation as ReservationRow, Restaurant, Rider } from '../../../generated/prisma/client.js'
import type { OrderRow } from './rows.js'

/** Drop undefined/null values so JSON payloads match the optional fields of the contract. */
function compact<T extends object>(o: T): T {
  for (const k of Object.keys(o) as (keyof T)[]) if (o[k] === null || o[k] === undefined) delete o[k]
  return o
}

export const toMenuItem = (m: MenuRow): MenuItem => ({
  id: m.id,
  name: m.name,
  emoji: m.emoji,
  category: m.category,
  description: m.description,
  price: m.price,
  station: m.station as Station,
  prepMins: m.prepMins,
  veg: m.veg,
  available: m.available,
  variants: m.variants as unknown as PriceOption[],
})

export const toItem = (i: OrderItem): FlowItem =>
  compact({
    itemId: i.itemId,
    name: i.name,
    emoji: i.emoji,
    qty: i.qty,
    price: i.price,
    station: i.station as Station,
    modifiers: i.modifiers as string[],
    notes: i.notes ?? undefined,
    done: i.done,
  })

export const toOrder = (o: OrderRow): FlowOrder =>
  compact({
    id: o.id,
    orderNo: o.orderNo,
    type: o.type as FlowOrder['type'],
    source: o.source as FlowOrder['source'],
    table: o.tableId ?? undefined,
    guests: o.guests ?? undefined,
    waiter: o.waiter ?? undefined,
    customer: (o.customer ?? undefined) as FlowOrder['customer'],
    items: [...o.items].sort((a, b) => a.position - b.position).map(toItem),
    notes: o.notes ?? undefined,
    status: o.status as FlowOrder['status'],
    priority: o.priority as FlowOrder['priority'],
    predictedMins: o.predictedMins,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
    history: o.history as FlowOrder['history'],
    call: (o.call ?? undefined) as FlowOrder['call'],
    riderId: o.riderId ?? undefined,
    payOnDelivery: (o.payOnDelivery ?? undefined) as FlowOrder['payOnDelivery'],
    payment: o.payment ? ({ ...(o.payment as object), ...(o.paymentTxnId ? { txnId: o.paymentTxnId } : {}) } as FlowOrder['payment']) : undefined,
    remake: o.remake || undefined,
  })

export const toTable = (t: DiningTable): FlowTable =>
  compact({
    id: t.id,
    name: t.name,
    area: t.area as FloorArea,
    seats: t.seats,
    shape: t.shape as FlowTable['shape'],
    status: t.status as TableStatus,
    col: t.col,
    row: t.row,
    guests: t.guests ?? undefined,
    guestName: t.guestName ?? undefined,
    server: t.server ?? undefined,
    seatedAt: t.seatedAt?.toISOString(),
    billTotal: t.billTotal ?? undefined,
    reservedFor: t.reservedFor ?? undefined,
    billRequested: t.billRequested,
    reservationId: t.reservationId ?? undefined,
  })

export const toRider = (r: Rider): FlowRider => ({ id: r.id, name: r.name, phone: r.phone, vehicle: r.vehicle, status: r.status as FlowRider['status'] })

export const toReservation = (r: ReservationRow): Reservation =>
  compact({
    id: r.id,
    guest: r.guest,
    phone: r.phone,
    party: r.party,
    time: r.time.toISOString(),
    table: r.tableId ?? undefined,
    area: r.area as FloorArea,
    source: r.source as Reservation['source'],
    status: r.status as Reservation['status'],
    occasion: r.occasion ?? undefined,
    notes: r.notes ?? undefined,
    noShowRisk: r.noShowRisk,
    visits: r.visits,
  })

export const toSessionRestaurant = (r: Restaurant): NonNullable<SessionUser['restaurant']> => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  branches: r.branches as string[],
  plan: r.plan as Tier,
})
