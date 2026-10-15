import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { SOCKET_EVENTS, type FlowOrder, type FlowRider, type FlowTable, type Reservation, type ServerToClientEvents } from '@restaurantos/contracts'
import type { Subscription } from 'rxjs'
import type { Server } from 'socket.io'
import { toOrder, toReservation, toRider, toTable } from '../shared/persistence/mappers.js'
import { UnitOfWork, type ChangeSet } from '../shared/persistence/unit-of-work.js'

export const restaurantRoom = (restaurantId: string) => `restaurant:${restaurantId}`
export const orderRoom = (orderId: string) => `order:${orderId}`

/**
 * Broadcasts flow changes: subscribes to the unit-of-work change feed and emits to the Socket.IO rooms.
 * The gateway hands it the Socket.IO server on init.
 */
@Injectable()
export class RealtimeService implements OnModuleInit, OnModuleDestroy {
  private server?: Server<Record<string, never>, ServerToClientEvents>
  private sub?: Subscription

  constructor(private readonly uow: UnitOfWork) {}

  onModuleInit() {
    this.sub = this.uow.changes$.subscribe((c) => this.publish(c))
  }

  onModuleDestroy() {
    this.sub?.unsubscribe()
  }

  /** Latest row wins when the same entity changed twice in one action. */
  private publish({ restaurantId, changes: c }: ChangeSet) {
    const latest = <T>(rows: T[], key: (r: T) => string) => [...new Map(rows.map((r) => [key(r), r])).values()]
    for (const r of latest(c.riders, (r) => r.id)) this.rider(restaurantId, toRider(r))
    for (const r of latest(c.reservations, (r) => r.id)) this.reservation(restaurantId, toReservation(r))
    for (const t of latest(c.tables, (t) => t.id)) this.table(restaurantId, toTable(t))
    for (const o of latest(c.orders, (o) => o.id)) this.order(restaurantId, toOrder(o))
  }

  attach(server: Server<Record<string, never>, ServerToClientEvents>) {
    this.server = server
  }

  /** Staff of the restaurant + the customer tracking this order. */
  order(restaurantId: string, order: FlowOrder) {
    this.server?.to([restaurantRoom(restaurantId), orderRoom(order.id)]).emit(SOCKET_EVENTS.order, order)
  }

  table(restaurantId: string, table: FlowTable) {
    this.server?.to(restaurantRoom(restaurantId)).emit(SOCKET_EVENTS.table, table)
  }

  rider(restaurantId: string, rider: FlowRider) {
    this.server?.to(restaurantRoom(restaurantId)).emit(SOCKET_EVENTS.rider, rider)
  }

  reservation(restaurantId: string, reservation: Reservation) {
    this.server?.to(restaurantRoom(restaurantId)).emit(SOCKET_EVENTS.reservation, reservation)
  }
}
