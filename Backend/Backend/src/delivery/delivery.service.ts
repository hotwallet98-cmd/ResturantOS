import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common'
import { canUse, type FlowOrder, type FlowRider, type FlowStatus } from '@restaurantos/contracts'
import type { Rider } from '../../generated/prisma/client.js'
import type { AuthUser } from '../identity/auth.types.js'
import { OrderLifecycle, staff, type OrderLifecycleListener, type TransitionContext } from '../ordering/order-lifecycle.js'
import { OrderRepository } from '../ordering/order.repository.js'
import { PaymentsService } from '../payments/payments.service.js'
import { toOrder, toRider } from '../shared/persistence/mappers.js'
import { includeItems, type OrderRow } from '../shared/persistence/rows.js'
import { noChanges, UnitOfWork } from '../shared/persistence/unit-of-work.js'
import type { DeliverDto } from './dto.js'

/** Statuses during which an assigned rider is busy with the order. */
const RIDER_BUSY: FlowStatus[] = ['Preparing', 'Ready', 'Packed', 'PickedUp']

/**
 * Delivery: riders, assignment (auto-assign when the kitchen accepts), pickup scan, deliver, rider status.
 * Hooks into the order lifecycle to assign / release riders on status changes.
 */
@Injectable()
export class DeliveryService implements OnModuleInit, OrderLifecycleListener {
  private readonly log = new Logger('Delivery')

  constructor(
    private readonly uow: UnitOfWork,
    private readonly orders: OrderRepository,
    private readonly lifecycle: OrderLifecycle,
    private readonly payments: PaymentsService,
  ) {}

  private get db() {
    return this.uow.db
  }

  onModuleInit() {
    this.lifecycle.register(this)
  }

  /* Lifecycle hook ------------------------------------------------------------ */

  async afterTransition(ctx: TransitionContext) {
    const { order, to } = ctx
    // Rider is notified as soon as the kitchen accepts a delivery (phone + address)
    if (to === 'Preparing' && order.type === 'Delivery' && !order.riderId && canUse(ctx.plan, 'delivery')) {
      const assigned = await this.autoAssign(order)
      if (assigned) {
        ctx.order = assigned.order
        ctx.changes.riders.push(assigned.rider)
      }
    }
    if ((to === 'Delivered' || to === 'Cancelled') && order.riderId) {
      const freed = await this.release(order.riderId, order.id)
      if (freed) ctx.changes.riders.push(freed)
    }
  }

  /* Riders --------------------------------------------------------------------- */

  async rider(restaurantId: string, id: string): Promise<Rider> {
    const r = await this.db.rider.findUnique({ where: { id } })
    if (!r || r.restaurantId !== restaurantId) throw new NotFoundException(`Rider ${id} not found`)
    return r
  }

  /** First Available rider (seed order) takes the order. */
  private async autoAssign(order: OrderRow): Promise<{ order: OrderRow; rider: Rider } | null> {
    const rider = await this.db.rider.findFirst({ where: { restaurantId: order.restaurantId, status: 'Available' }, orderBy: { position: 'asc' } })
    if (!rider) {
      this.log.warn(`#${order.orderNo}: no Available rider to assign`)
      return null
    }
    return this.assign(order, rider)
  }

  private async assign(order: OrderRow, rider: Rider): Promise<{ order: OrderRow; rider: Rider; previous?: Rider }> {
    const [updatedOrder, updatedRider] = await this.db.$transaction([
      this.db.order.update({ where: { id: order.id }, data: { riderId: rider.id }, include: includeItems }),
      this.db.rider.update({ where: { id: rider.id }, data: { status: 'On delivery' } }),
    ])
    let previous: Rider | undefined
    if (order.riderId && order.riderId !== rider.id) previous = (await this.release(order.riderId, order.id)) ?? undefined
    this.log.log(`#${order.orderNo}: rider ${rider.name} (${rider.phone}) assigned`)
    return { order: updatedOrder, rider: updatedRider, previous }
  }

  /** Rider back to Available when no other order keeps them busy. Returns the rider if it changed. */
  private async release(riderId: string, exceptOrderId: string): Promise<Rider | null> {
    const busy = await this.db.order.count({ where: { riderId, id: { not: exceptOrderId }, status: { in: RIDER_BUSY } } })
    if (busy) return null
    const rider = await this.db.rider.findUnique({ where: { id: riderId } })
    if (!rider || rider.status !== 'On delivery') return null
    return this.db.rider.update({ where: { id: riderId }, data: { status: 'Available' } })
  }

  /* Endpoints ------------------------------------------------------------------ */

  /** Counter assigns (or reassigns) a rider. */
  assignRider(rid: string, orderId: string, riderId: string): Promise<FlowOrder> {
    return this.uow.run(rid, async () => {
      const order = await this.orders.find(rid, orderId)
      if (order.type !== 'Delivery') throw new BadRequestException('Only delivery orders get a rider')
      if (['Delivered', 'Cancelled'].includes(order.status)) throw new ConflictException(`Order #${order.orderNo} is ${order.status}`)
      const rider = await this.rider(rid, riderId)
      if (rider.status === 'Offline') throw new ConflictException(`${rider.name} is offline`)
      const { order: updated, rider: r, previous } = await this.assign(order, rider)
      return { result: toOrder(updated), changes: { ...noChanges(), orders: [updated], riders: previous ? [r, previous] : [r] } }
    })
  }

  /** Rider scans the bag QR → PickedUp. */
  pickup(user: AuthUser, rid: string, orderId: string, scannedOrderNo?: number): Promise<FlowOrder> {
    return this.uow.run(rid, async () => {
      const order = await this.orders.find(rid, orderId)
      if (scannedOrderNo !== undefined && scannedOrderNo !== order.orderNo) {
        throw new ConflictException(`Scanned bag is order #${scannedOrderNo}, but this is order #${order.orderNo}`)
      }
      if (order.type === 'Delivery' && user.role === 'rider' && !order.riderId) throw new ForbiddenException(`Order #${order.orderNo} has no rider assigned`)
      const changes = await this.lifecycle.transition(order, 'PickedUp', staff(user))
      return { result: toOrder(changes.orders[changes.orders.length - 1]), changes }
    })
  }

  /** The only way to mark a delivery Delivered: records the collected payment (payment.txnId). */
  deliver(user: AuthUser, rid: string, orderId: string, dto: DeliverDto): Promise<FlowOrder> {
    return this.uow.run(rid, async () => {
      const order = await this.orders.find(rid, orderId)
      if (order.type !== 'Delivery') throw new BadRequestException('Only delivery orders are delivered')
      const changes = await this.lifecycle.transition(order, 'Delivered', staff(user), this.payments.captureDelivery(order, dto.method, dto.txnId))
      return { result: toOrder(changes.orders[changes.orders.length - 1]), changes }
    })
  }

  setRiderStatus(user: AuthUser, rid: string, riderId: string, status: FlowRider['status']): Promise<FlowRider> {
    if (user.role === 'rider' && user.riderId !== riderId) throw new ForbiddenException('Riders can only change their own status')
    return this.uow.run(rid, async () => {
      const rider = await this.rider(rid, riderId)
      if (status !== 'On delivery') {
        const busy = await this.db.order.count({ where: { riderId, status: { in: RIDER_BUSY } } })
        if (busy) throw new ConflictException(`${rider.name} still has ${busy} active deliver${busy === 1 ? 'y' : 'ies'}`)
      }
      const updated = await this.db.rider.update({ where: { id: rider.id }, data: { status } })
      return { result: toRider(updated), changes: { ...noChanges(), riders: [updated] } }
    })
  }
}
