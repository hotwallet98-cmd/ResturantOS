import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { orderTotal, type FlowTable, type TableStatus } from '@restaurantos/contracts'
import type { DiningTable, Reservation } from '../../generated/prisma/client.js'
import type { AuthUser } from '../identity/auth.types.js'
import { FlowReader } from '../shared/persistence/flow-reader.js'
import { toOrder, toTable } from '../shared/persistence/mappers.js'
import { round2 } from '../shared/persistence/rows.js'
import { noChanges, UnitOfWork } from '../shared/persistence/unit-of-work.js'
import type { SeatTableDto } from './dto.js'

/** Clears everything about the current party. */
const FREE_TABLE = { status: 'Available', guests: null, guestName: null, server: null, seatedAt: null, billTotal: null, billRequested: false, reservationId: null } as const

/** Floor: tables, reservations, seating and bill requests (port of seatTable / requestBill / setTableStatus). */
@Injectable()
export class FloorService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly reader: FlowReader,
  ) {}

  private get db() {
    return this.uow.db
  }

  private where(restaurantId: string, id: string) {
    return { restaurantId_id: { restaurantId, id } }
  }

  /* Used by other modules inside their unit of work ------------------------ */

  async table(restaurantId: string, id: string): Promise<DiningTable> {
    const t = await this.db.diningTable.findUnique({ where: this.where(restaurantId, id) })
    if (!t) throw new NotFoundException(`Table ${id} not found`)
    return t
  }

  /** Sum of the open dine-in orders on a table. */
  async tableBill(restaurantId: string, tableId: string) {
    const open = await this.reader.openTableOrders(restaurantId, tableId)
    return round2(open.reduce((s, o) => s + orderTotal(toOrder(o)), 0))
  }

  /** Recompute billTotal after the table's orders changed. */
  async refreshBill(restaurantId: string, tableId: string): Promise<DiningTable> {
    return this.db.diningTable.update({ where: this.where(restaurantId, tableId), data: { billTotal: await this.tableBill(restaurantId, tableId) } })
  }

  /** After payment: complete the seated reservation and free the table. */
  async release(restaurantId: string, table: DiningTable): Promise<{ table: DiningTable; reservation?: Reservation }> {
    let reservation: Reservation | undefined
    if (table.reservationId) {
      const r = await this.db.reservation.findUnique({ where: { id: table.reservationId } })
      if (r && r.status === 'Seated') reservation = await this.db.reservation.update({ where: { id: r.id }, data: { status: 'Completed' } })
    }
    const freed = await this.db.diningTable.update({ where: this.where(restaurantId, table.id), data: FREE_TABLE })
    return { table: freed, reservation }
  }

  /* Endpoints ----------------------------------------------------------------- */

  /** Seat a walk-in, or a reservation (marks it Seated). */
  seat(user: AuthUser, rid: string, tableId: string, dto: SeatTableDto): Promise<FlowTable> {
    return this.uow.run(rid, async () => {
      const table = await this.table(rid, tableId)
      const changes = noChanges()
      let guestName = dto.guestName?.trim() || 'Walk-in'
      if (dto.reservationId) {
        const r = await this.db.reservation.findUnique({ where: { id: dto.reservationId } })
        if (!r || r.restaurantId !== rid) throw new NotFoundException(`Reservation ${dto.reservationId} not found`)
        if (!['Confirmed', 'Pending'].includes(r.status)) throw new ConflictException(`Reservation for ${r.guest} is ${r.status}`)
        if (r.tableId && r.tableId !== table.id) throw new ConflictException(`Reservation for ${r.guest} is for table ${r.tableId}, not ${table.id}`)
        guestName = dto.guestName?.trim() || r.guest
        changes.reservations.push(await this.db.reservation.update({ where: { id: r.id }, data: { status: 'Seated', tableId: table.id } }))
      } else if (table.status === 'Reserved') {
        throw new ConflictException(`Table ${table.id} is reserved (${table.reservedFor ?? 'reservation'}); pass reservationId to seat that party`)
      }
      if (table.status !== 'Available' && table.status !== 'Reserved') throw new ConflictException(`Table ${table.id} is ${table.status}`)
      if (dto.guests > table.seats * 2) throw new BadRequestException(`Table ${table.id} seats ${table.seats}`)
      const updated = await this.db.diningTable.update({
        where: this.where(rid, table.id),
        data: { status: 'Occupied', guests: dto.guests, guestName, server: user.name, seatedAt: new Date(), reservedFor: null, reservationId: dto.reservationId ?? null, billRequested: false, billTotal: 0 },
      })
      changes.tables.push(updated)
      return { result: toTable(updated), changes }
    })
  }

  requestBill(rid: string, tableId: string): Promise<FlowTable> {
    return this.uow.run(rid, async () => {
      const table = await this.table(rid, tableId)
      if (table.status !== 'Occupied') throw new ConflictException(`Table ${table.id} is ${table.status}`)
      const updated = await this.db.diningTable.update({ where: this.where(rid, table.id), data: { billRequested: true, billTotal: await this.tableBill(rid, table.id) } })
      return { result: toTable(updated), changes: { ...noChanges(), tables: [updated] } }
    })
  }

  setStatus(rid: string, tableId: string, status: TableStatus): Promise<FlowTable> {
    return this.uow.run(rid, async () => {
      const table = await this.table(rid, tableId)
      const data = status === 'Available' || status === 'Cleaning' ? { ...FREE_TABLE, status } : { status }
      const updated = await this.db.diningTable.update({ where: this.where(rid, table.id), data })
      return { result: toTable(updated), changes: { ...noChanges(), tables: [updated] } }
    })
  }
}
