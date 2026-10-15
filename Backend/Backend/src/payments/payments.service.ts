import { ConflictException, Injectable } from '@nestjs/common'
import { orderTotal, type PayMethod, type PayTableResponse } from '@restaurantos/contracts'
import type { Prisma } from '../../generated/prisma/client.js'
import { FloorService } from '../floor/floor.service.js'
import { OrderRepository } from '../ordering/order.repository.js'
import { FlowReader } from '../shared/persistence/flow-reader.js'
import { toOrder, toTable } from '../shared/persistence/mappers.js'
import { json, round2, type OrderRow } from '../shared/persistence/rows.js'
import { noChanges, UnitOfWork } from '../shared/persistence/unit-of-work.js'
import type { PayTableDto } from './dto.js'

/** Payments: settling dine-in bills (tip split) and capturing delivery payments. */
@Injectable()
export class PaymentsService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly reader: FlowReader,
    private readonly orders: OrderRepository,
    private readonly floor: FloorService,
  ) {}

  /** Order update that records a payment (`payment` JSON + `paymentTxnId`, merged as payment.txnId by the mapper). */
  record(method: PayMethod, amount: number, tip: number, at: Date, txnId?: string): Prisma.OrderUpdateInput {
    return { payment: json({ method, amount: round2(amount), tip: round2(tip), at: at.toISOString() }), paymentTxnId: txnId?.trim() || null }
  }

  /** Delivery: the rider collects the full order total (incl. delivery fee). */
  captureDelivery(order: OrderRow, method: PayMethod, txnId?: string): Prisma.OrderUpdateInput {
    return this.record(method, orderTotal(toOrder(order)), 0, new Date(), txnId)
  }

  /**
   * Pay every open dine-in order on the table (tip split by order total), mark them Paid and free the table.
   * Like the prototype this settles orders in any open status, not only Served.
   */
  payTable(rid: string, tableId: string, dto: PayTableDto): Promise<PayTableResponse> {
    return this.uow.run(rid, async () => {
      const table = await this.floor.table(rid, tableId)
      if (table.status !== 'Occupied') throw new ConflictException(`Table ${table.id} is ${table.status}; nothing to pay`)
      const open = await this.reader.openTableOrders(rid, table.id)
      const totals = open.map((o) => round2(orderTotal(toOrder(o))))
      const total = totals.reduce((s, t) => s + t, 0)
      const at = new Date()
      const changes = noChanges()
      let tipLeft = round2(dto.tip)
      const paid: OrderRow[] = []
      for (const [i, o] of open.entries()) {
        // Last order takes the rounding remainder so the tips add up exactly
        const share = i === open.length - 1 ? tipLeft : total ? round2((dto.tip * totals[i]) / total) : 0
        tipLeft = round2(tipLeft - share)
        const history = [...toOrder(o).history, { status: 'Paid', at: at.toISOString() }]
        paid.push(await this.orders.update(o.id, { status: 'Paid', history: json(history), ...this.record(dto.method, totals[i], share, at, dto.txnId) }))
      }
      changes.orders.push(...paid)
      const released = await this.floor.release(rid, table)
      if (released.reservation) changes.reservations.push(released.reservation)
      changes.tables.push(released.table)
      return { result: { table: toTable(released.table), orders: paid.map(toOrder) }, changes }
    })
  }
}
