import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import type { CreateCustomerOrderResponse, FlowOrder, FlowStatus, Tier, TrackOrderResponse } from '@restaurantos/contracts'
import { randomBytes } from 'node:crypto'
import { CatalogService } from '../catalog/catalog.service.js'
import { FloorService } from '../floor/floor.service.js'
import type { AuthUser } from '../identity/auth.types.js'
import { FlowReader } from '../shared/persistence/flow-reader.js'
import { toOrder, toRider } from '../shared/persistence/mappers.js'
import { json } from '../shared/persistence/rows.js'
import { noChanges, UnitOfWork } from '../shared/persistence/unit-of-work.js'
import { assertFeature } from '../tenancy/entitlements.js'
import { TenancyService } from '../tenancy/tenancy.service.js'
import type { CreateCustomerOrderDto, CreateTableOrderDto, RemakeDto, UpdateItemsDto } from './dto.js'
import { OrderLifecycle, staff } from './order-lifecycle.js'
import { OrderRepository } from './order.repository.js'

const firstHistory = (status: FlowStatus, at: Date) => json([{ status, at: at.toISOString() }])
const note = (s?: string) => s?.trim() || null

/** Order creation and the generic order actions of both workflows (port of the action half of flow.ts). */
@Injectable()
export class OrdersService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly orders: OrderRepository,
    private readonly lifecycle: OrderLifecycle,
    private readonly catalog: CatalogService,
    private readonly floor: FloorService,
    private readonly tenancy: TenancyService,
    private readonly reader: FlowReader,
  ) {}

  /* Dine-in --------------------------------------------------------------- */

  /** Waiter device → counter logs it and forwards to the kitchen in one step (status Received). */
  createTableOrder(user: AuthUser, rid: string, dto: CreateTableOrderDto): Promise<FlowOrder> {
    return this.uow.run(rid, async () => {
      const table = await this.floor.table(rid, dto.tableId)
      if (table.status !== 'Occupied') throw new ConflictException(`Table ${table.id} is ${table.status}; seat the guests first`)
      const { items, predictedMins } = await this.catalog.priceLines(rid, dto.items)
      const orderNo = await this.orders.nextOrderNo(rid)
      const at = new Date()
      const order = await this.orders.create({
        id: this.orders.newOrderId(orderNo),
        restaurantId: rid,
        orderNo,
        type: 'Dine-in',
        source: 'Waiter',
        tableId: table.id,
        guests: table.guests,
        waiter: user.name,
        notes: note(dto.notes),
        status: 'Received',
        priority: 'Normal',
        predictedMins,
        createdAt: at,
        history: firstHistory('Received', at),
        items,
      })
      const updatedTable = await this.floor.refreshBill(rid, table.id)
      return { result: toOrder(order), changes: { ...noChanges(), orders: [order], tables: [updatedTable] } }
    })
  }

  /* Delivery: customer app (storefront) ----------------------------------------- */

  /** Customer app order (Placed); listeners then start the verification call (Verifying). */
  async createCustomerOrder(slug: string, dto: CreateCustomerOrderDto): Promise<CreateCustomerOrderResponse> {
    const restaurant = await this.tenancy.bySlug(slug)
    const rid = restaurant.id
    assertFeature(restaurant.plan as Tier, 'customerApp')
    assertFeature(restaurant.plan as Tier, 'delivery')
    const trackingToken = randomBytes(18).toString('base64url')
    const created = await this.uow.run(rid, async () => {
      const { items, predictedMins } = await this.catalog.priceLines(rid, dto.items)
      const orderNo = await this.orders.nextOrderNo(rid)
      const at = new Date()
      const order = await this.orders.create({
        id: this.orders.newOrderId(orderNo),
        restaurantId: rid,
        orderNo,
        type: 'Delivery',
        source: 'Customer App',
        customer: json({ name: dto.name.trim(), phone: dto.phone.trim(), address: dto.address.trim() }),
        notes: note(dto.notes),
        status: 'Placed',
        priority: 'Normal',
        predictedMins,
        createdAt: at,
        history: firstHistory('Placed', at),
        payOnDelivery: dto.pay,
        trackingToken,
        items,
      })
      return { result: order, changes: { ...noChanges(), orders: [order] } }
    })
    await this.lifecycle.customerOrderPlaced(created)
    return { order: toOrder(await this.orders.find(rid, created.id)), trackingToken }
  }

  async track(orderId: string, token: string): Promise<TrackOrderResponse> {
    const order = await this.reader.orderByTrackingToken(orderId, token)
    if (!order) throw new NotFoundException('Order not found')
    const res: TrackOrderResponse = { order: toOrder(order) }
    if (order.rider) {
      const { name, phone, vehicle } = toRider(order.rider)
      res.rider = { name, phone, vehicle }
    }
    return res
  }

  /* Generic status change ---------------------------------------------------- */

  setStatus(user: AuthUser, rid: string, orderId: string, status: FlowStatus): Promise<FlowOrder> {
    // Settling money has its own endpoints so a payment is always recorded
    if (status === 'Paid') throw new BadRequestException('Use POST /tables/:id/pay to settle a dine-in bill')
    if (status === 'Delivered') throw new BadRequestException('Use POST /orders/:id/deliver to complete a delivery')
    return this.uow.run(rid, async () => {
      const order = await this.orders.find(rid, orderId)
      const changes = await this.lifecycle.transition(order, status, staff(user))
      return { result: toOrder(changes.orders[changes.orders.length - 1]), changes }
    })
  }

  cancel(user: AuthUser, rid: string, orderId: string): Promise<FlowOrder> {
    return this.setStatus(user, rid, orderId, 'Cancelled')
  }

  /* Kitchen ---------------------------------------------------------------- */

  updateItems(rid: string, orderId: string, dto: UpdateItemsDto): Promise<FlowOrder> {
    return this.uow.run(rid, async () => {
      const order = await this.orders.find(rid, orderId)
      if (dto.items.length !== order.items.length) throw new BadRequestException(`Expected ${order.items.length} items (same order as order.items), got ${dto.items.length}`)
      await this.orders.setItemStates(order, dto.items)
      const updated = await this.orders.update(order.id, {})
      return { result: toOrder(updated), changes: { ...noChanges(), orders: [updated] } }
    })
  }

  /** New Rush ticket (status Received, price 0) for the same table / customer. */
  remake(rid: string, orderId: string, dto: RemakeDto): Promise<FlowOrder> {
    return this.uow.run(rid, async () => {
      const original = await this.orders.find(rid, orderId)
      const bad = dto.itemIndexes.filter((i) => i >= original.items.length)
      if (bad.length) throw new BadRequestException(`Item index out of range: ${bad.join(', ')}`)
      const lines = [...new Set(dto.itemIndexes)].map((i) => original.items[i])
      const orderNo = await this.orders.nextOrderNo(rid)
      const at = new Date()
      const order = await this.orders.create({
        id: this.orders.newOrderId(orderNo),
        restaurantId: rid,
        orderNo,
        type: original.type,
        source: original.source,
        tableId: original.tableId,
        guests: original.guests,
        waiter: original.waiter,
        customer: original.customer ?? undefined,
        status: 'Received',
        priority: 'Rush',
        predictedMins: original.predictedMins,
        createdAt: at,
        history: firstHistory('Received', at),
        riderId: original.riderId,
        payOnDelivery: original.payOnDelivery,
        remake: true,
        items: lines.map((l, position) => ({
          position,
          itemId: l.itemId,
          name: l.name,
          emoji: l.emoji,
          qty: l.qty,
          price: 0,
          station: l.station,
          modifiers: json(l.modifiers),
          notes: `Remake – ${dto.reason}`,
          done: false,
        })),
      })
      return { result: toOrder(order), changes: { ...noChanges(), orders: [order] } }
    })
  }
}
