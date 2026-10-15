import { ConflictException, ForbiddenException, Injectable, Logger } from '@nestjs/common'
import { canTransition, roleCanSet, TRANSITIONS, type Feature, type FlowStatus, type Tier } from '@restaurantos/contracts'
import type { Prisma } from '../../generated/prisma/client.js'
import type { AuthUser } from '../identity/auth.types.js'
import { toOrder } from '../shared/persistence/mappers.js'
import { json, type OrderRow } from '../shared/persistence/rows.js'
import { noChanges, type Changes } from '../shared/persistence/unit-of-work.js'
import { assertFeature } from '../tenancy/entitlements.js'
import { TenancyService } from '../tenancy/tenancy.service.js'
import { OrderRepository } from './order.repository.js'

/** Who is changing an order: a signed-in staff member, or the server itself (voice agent, automation). */
export type Actor = { kind: 'staff'; user: AuthUser } | { kind: 'system'; reason: string }
export const system = (reason: string): Actor => ({ kind: 'system', reason })
export const staff = (user: AuthUser): Actor => ({ kind: 'staff', user })

/** A status change in progress. Listeners may replace `order` and add to `changes`. */
export interface TransitionContext {
  order: OrderRow
  from: FlowStatus
  to: FlowStatus
  actor: Actor
  plan: Tier
  changes: Changes
}

/**
 * Extension point for other modules (delivery: rider auto-assign / release; verification: hang up the call).
 * Ordering never imports those modules; they register themselves on init.
 */
export interface OrderLifecycleListener {
  /** Runs inside the restaurant's unit of work, right after the status was saved. */
  afterTransition?(ctx: TransitionContext): Promise<void> | void
  /** Runs after a customer-app order was stored (status Placed), outside the unit of work. */
  afterCustomerOrderPlaced?(order: OrderRow): Promise<void>
}

/** Plan feature that moving an order into `to` belongs to. */
export function statusFeature(order: Pick<OrderRow, 'type' | 'status'>, to: FlowStatus): Feature {
  switch (to) {
    case 'Verifying':
      return 'verifyCall'
    case 'Received':
      return order.status === 'Preparing' ? 'kitchen' : 'counter'
    case 'Preparing':
    case 'Ready':
      return 'kitchen'
    case 'Packed':
    case 'Cancelled':
      return 'counter'
    case 'PickedUp':
      return order.type === 'Delivery' ? 'riderApp' : 'waiterApp'
    case 'Served':
      return 'waiterApp'
    case 'Delivered':
      return 'riderApp'
    case 'Paid':
      return 'pos'
    default:
      return 'counter'
  }
}

/** Order status machine (port of Frontend/src/shared/services/flow.ts transition rules). */
@Injectable()
export class OrderLifecycle {
  private readonly log = new Logger('Ordering')
  private readonly listeners: OrderLifecycleListener[] = []

  constructor(
    private readonly orders: OrderRepository,
    private readonly tenancy: TenancyService,
  ) {}

  register(listener: OrderLifecycleListener) {
    this.listeners.push(listener)
  }

  /**
   * Move an order to `to` (call inside `UnitOfWork.run`), enforcing TRANSITIONS, TRANSITION_ROLES (roleCanSet)
   * and the plan. Ready marks every line done; listeners add their side effects.
   * Paid / Delivered callers must pass the payment in `extra` (payments / delivery modules).
   */
  async transition(order: OrderRow, to: FlowStatus, actor: Actor, extra: Prisma.OrderUpdateInput = {}): Promise<Changes> {
    const plan = await this.tenancy.plan(order.restaurantId)
    if (actor.kind === 'staff') {
      const u = actor.user
      if (!roleCanSet(u.role, to)) throw new ForbiddenException(`A ${u.role} cannot move an order to ${to}`)
      if (u.role === 'rider' && order.riderId !== u.riderId) throw new ForbiddenException(`Order #${order.orderNo} is not assigned to you`)
    }
    assertFeature(plan, statusFeature(order, to))
    const from = order.status as FlowStatus
    if (!canTransition(from, to)) {
      const allowed = TRANSITIONS[from]
      throw new ConflictException(`Order #${order.orderNo} is ${from}; it cannot move to ${to}${allowed.length ? ` (allowed: ${allowed.join(', ')})` : ' (final status)'}`)
    }

    const history = [...toOrder(order).history, { status: to, at: new Date().toISOString() }]
    if (to === 'Ready') await this.orders.markAllDone(order.id)
    const ctx: TransitionContext = { order: await this.orders.update(order.id, { status: to, history: json(history), ...extra }), from, to, actor, plan, changes: noChanges() }
    for (const l of this.listeners) await l.afterTransition?.(ctx)
    ctx.changes.orders.push(ctx.order)
    this.log.log(`#${order.orderNo} ${from} → ${to} by ${actor.kind === 'staff' ? `${actor.user.name} (${actor.user.role})` : `system: ${actor.reason}`}`)
    return ctx.changes
  }

  async customerOrderPlaced(order: OrderRow) {
    for (const l of this.listeners) await l.afterCustomerOrderPlaced?.(order)
  }
}
