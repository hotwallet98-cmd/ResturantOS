import { Injectable } from '@nestjs/common'
import type { FlowState, FlowStatus } from '@restaurantos/contracts'
import { PrismaService } from '../prisma/prisma.service.js'
import { toOrder, toReservation, toRider, toTable } from './mappers.js'
import { includeItems, type OrderRow } from './rows.js'

const TERMINAL: FlowStatus[] = ['Served', 'Delivered', 'Paid', 'Cancelled']

/** Read model shared across modules: the live flow snapshot and cross-context lookups. */
@Injectable()
export class FlowReader {
  constructor(private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.db
  }

  /** Live state: every active order plus the last 24 h of finished ones. */
  async state(restaurantId: string): Promise<FlowState> {
    const since = new Date(Date.now() - 24 * 3600_000)
    const [orders, tables, reservations, riders] = await Promise.all([
      this.db.order.findMany({
        where: { restaurantId, OR: [{ status: { notIn: TERMINAL } }, { updatedAt: { gte: since } }] },
        include: includeItems,
        orderBy: { createdAt: 'desc' },
      }),
      this.db.diningTable.findMany({ where: { restaurantId }, orderBy: { position: 'asc' } }),
      this.db.reservation.findMany({ where: { restaurantId }, orderBy: { time: 'asc' } }),
      this.db.rider.findMany({ where: { restaurantId }, orderBy: { position: 'asc' } }),
    ])
    return { orders: orders.map(toOrder), tables: tables.map(toTable), reservations: reservations.map(toReservation), riders: riders.map(toRider) }
  }

  /** Open (unpaid, not cancelled) dine-in orders on a table, oldest first. */
  openTableOrders(restaurantId: string, tableId: string): Promise<OrderRow[]> {
    return this.db.order.findMany({
      where: { restaurantId, tableId, type: 'Dine-in', status: { notIn: ['Paid', 'Cancelled'] } },
      include: includeItems,
      orderBy: { createdAt: 'asc' },
    })
  }

  /** Customer-tracked order, only when the tracking token matches. */
  async orderByTrackingToken(orderId: string, token: string) {
    if (!orderId || !token) return null
    const order = await this.db.order.findUnique({ where: { id: orderId }, include: { ...includeItems, rider: true } })
    if (!order?.trackingToken || order.trackingToken !== token) return null
    return order
  }
}
