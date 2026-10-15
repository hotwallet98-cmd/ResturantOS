import { BadRequestException, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common'
import type { FlowOrder, FlowStatus, VerificationCall } from '@restaurantos/contracts'
import { Prisma } from '../../generated/prisma/client.js'
import type { AuthUser } from '../identity/auth.types.js'
import { OrderLifecycle, staff, system, type Actor, type OrderLifecycleListener, type TransitionContext } from '../ordering/order-lifecycle.js'
import { OrderRepository } from '../ordering/order.repository.js'
import { toOrder } from '../shared/persistence/mappers.js'
import { json, type OrderRow } from '../shared/persistence/rows.js'
import { noChanges, UnitOfWork, type Changes } from '../shared/persistence/unit-of-work.js'
import { verificationScript } from '../telephony/call-script.js'
import { TELEPHONY_PROVIDER, type CallEvents, type CallOutcome, type CallResult, type TelephonyProvider } from '../telephony/telephony.types.js'
import { TenancyService } from '../tenancy/tenancy.service.js'

/** A staff move into one of these settles any call in progress. */
const HANG_UP_ON: FlowStatus[] = ['Verifying', 'Received', 'Cancelled']

/**
 * Order verification call (port of Frontend/src/shared/services/verifyCall.ts).
 * Sets the order to Verifying, asks the TelephonyProvider to call the customer and
 * persists every progress event on `order.call`; the result moves the order to
 * Received (confirmed) or Cancelled (declined). no_answer leaves it Verifying for the counter.
 * New customer-app orders are called automatically (lifecycle hook) when the plan includes verifyCall.
 */
@Injectable()
export class VerificationService implements OnModuleInit, OrderLifecycleListener {
  private readonly log = new Logger('VerificationCall')

  constructor(
    private readonly uow: UnitOfWork,
    private readonly orders: OrderRepository,
    private readonly lifecycle: OrderLifecycle,
    private readonly tenancy: TenancyService,
    @Inject(TELEPHONY_PROVIDER) private readonly telephony: TelephonyProvider,
  ) {}

  onModuleInit() {
    this.lifecycle.register(this)
  }

  /* Lifecycle hooks ------------------------------------------------------------- */

  async afterCustomerOrderPlaced(order: OrderRow) {
    if (await this.tenancy.can(order.restaurantId, 'verifyCall')) await this.start(order.restaurantId, order.id, system('new customer order'))
  }

  /** A manual Received / Cancelled (or a bare Verifying) by staff settles any call in progress. */
  afterTransition(ctx: TransitionContext) {
    if (ctx.actor.kind === 'staff' && HANG_UP_ON.includes(ctx.to)) this.hangup(ctx.order.id)
  }

  /* Actions ----------------------------------------------------------------------- */

  /** Confirm without (or despite) the call → Received. */
  confirm(user: AuthUser, rid: string, orderId: string): Promise<FlowOrder> {
    return this.uow.run(rid, async () => {
      const order = await this.orders.find(rid, orderId)
      const call = order.call as VerificationCall | null
      const confirmed: VerificationCall = { state: 'confirmed', lines: call?.lines ?? [], startedAt: call?.startedAt ?? Date.now(), attempts: call?.attempts ?? 0 }
      const changes = await this.lifecycle.transition(order, 'Received', staff(user), order.source === 'Customer App' ? { call: json(confirmed) } : {})
      return { result: toOrder(changes.orders[changes.orders.length - 1]), changes }
    })
  }

  /** Start (or retry) the call. Call inside nothing — this takes the restaurant lock itself. */
  start(restaurantId: string, orderId: string, actor: Actor, outcome?: CallOutcome): Promise<FlowOrder> {
    return this.uow.run(restaurantId, async () => {
      const order = await this.orders.find(restaurantId, orderId)
      if (order.type !== 'Delivery' || order.source !== 'Customer App' || !order.customer) {
        throw new BadRequestException('Only customer-app delivery orders get a verification call')
      }
      const previous = (order.call ?? null) as VerificationCall | null
      const attempts = (previous?.attempts ?? 0) + 1
      const call: VerificationCall = { state: 'dialing', lines: [], startedAt: Date.now(), attempts }
      const changes = await this.lifecycle.transition(order, 'Verifying', actor, { call: json(call) })
      const updated = changes.orders[changes.orders.length - 1]
      const flow = toOrder(updated)
      const restaurant = await this.tenancy.byId(restaurantId)
      try {
        await this.telephony.startCall(
          { callId: `${order.id}:${attempts}`, orderId: order.id, phone: flow.customer!.phone, language: 'ur', script: verificationScript(flow, restaurant.name), outcome },
          this.events(restaurantId, order.id, attempts),
        )
      } catch (e) {
        // Provider could not place the call: put the order back as it was
        await this.orders.update(order.id, { status: order.status, history: json(order.history), call: previous ? json(previous) : Prisma.DbNull })
        throw e
      }
      return { result: flow, changes }
    })
  }

  /** Stop the call for an order (manual confirm / cancel). */
  hangup(orderId: string) {
    this.telephony.hangup(orderId)
  }

  private events(restaurantId: string, orderId: string, attempt: number): CallEvents {
    /** Apply a call event only while this attempt is still the live one and the order is still Verifying. */
    const apply = (label: string, fn: (order: OrderRow, call: VerificationCall) => Promise<Changes>) => {
      this.uow
        .run(restaurantId, async () => {
          const order = await this.orders.find(restaurantId, orderId)
          const call = order.call as VerificationCall | null
          if (order.status !== 'Verifying' || !call || call.attempts !== attempt) return { result: undefined, changes: noChanges() }
          return { result: undefined, changes: await fn(order, call) }
        })
        .catch((e) => this.log.error(`Call event "${label}" for ${orderId} failed: ${e instanceof Error ? e.message : e}`))
    }
    const saveCall = async (order: OrderRow, call: VerificationCall) => ({ ...noChanges(), orders: [await this.orders.update(order.id, { call: json(call) })] })

    return {
      state: (state) => apply(state, (order, call) => saveCall(order, { ...call, state })),
      line: (who, text) => apply('line', (order, call) => saveCall(order, { ...call, lines: [...call.lines, { who, text, at: Date.now() }] })),
      result: (result: CallResult) =>
        apply(result, async (order, call) => {
          const next: VerificationCall = { ...call, state: result }
          this.log.log(`Order #${order.orderNo}: call ${result}`)
          if (result === 'confirmed') return this.lifecycle.transition(order, 'Received', system('verification call confirmed'), { call: json(next) })
          if (result === 'declined') return this.lifecycle.transition(order, 'Cancelled', system('customer declined on the verification call'), { call: json(next) })
          return saveCall(order, next)
        }),
    }
  }
}
