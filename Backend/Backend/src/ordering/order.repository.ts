import { Injectable, NotFoundException } from '@nestjs/common'
import type { Prisma } from '../../generated/prisma/client.js'
import { includeItems, type OrderRow } from '../shared/persistence/rows.js'
import { UnitOfWork } from '../shared/persistence/unit-of-work.js'

export type NewOrder = Omit<Prisma.OrderUncheckedCreateInput, 'items'> & { items: Prisma.OrderItemCreateWithoutOrderInput[] }

/** Order persistence. Call the write methods inside `UnitOfWork.run`. */
@Injectable()
export class OrderRepository {
  constructor(private readonly uow: UnitOfWork) {}

  private get db() {
    return this.uow.db
  }

  /** 404 unless the order exists (and belongs to `restaurantId`, when given). */
  async find(restaurantId: string | undefined, id: string): Promise<OrderRow> {
    const o = await this.db.order.findUnique({ where: { id }, include: includeItems })
    if (!o || (restaurantId && o.restaurantId !== restaurantId)) throw new NotFoundException(`Order ${id} not found`)
    return o
  }

  update(id: string, data: Prisma.OrderUpdateInput): Promise<OrderRow> {
    return this.db.order.update({ where: { id }, data, include: includeItems })
  }

  /** Per-line done / station, same order as `order.items`. */
  async setItemStates(order: OrderRow, states: { done: boolean; station: string }[]) {
    await this.db.$transaction(order.items.map((it, i) => this.db.orderItem.update({ where: { id: it.id }, data: { done: states[i].done, station: states[i].station } })))
  }

  async markAllDone(orderId: string) {
    await this.db.orderItem.updateMany({ where: { orderId }, data: { done: true } })
  }

  /** Allocate the next order number for the restaurant. */
  async nextOrderNo(restaurantId: string) {
    const r = await this.db.restaurant.update({ where: { id: restaurantId }, data: { nextOrderNo: { increment: 1 } } })
    return r.nextOrderNo - 1
  }

  create(data: NewOrder): Promise<OrderRow> {
    const { items, ...rest } = data
    return this.db.order.create({ data: { ...rest, items: { create: items } }, include: includeItems })
  }

  newOrderId(orderNo: number) {
    return `ord-${orderNo}-${Date.now().toString(36)}`
  }
}
