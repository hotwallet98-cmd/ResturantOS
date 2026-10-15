import { Injectable } from '@nestjs/common'
import { Subject } from 'rxjs'
import type { DiningTable, Reservation, Rider } from '../../../generated/prisma/client.js'
import { PrismaService } from '../prisma/prisma.service.js'
import type { OrderRow } from './rows.js'

/** Rows touched by an action; published once the action is done. */
export interface Changes {
  orders: OrderRow[]
  tables: DiningTable[]
  riders: Rider[]
  reservations: Reservation[]
}
export const noChanges = (): Changes => ({ orders: [], tables: [], riders: [], reservations: [] })

/** What a finished unit of work changed, for one restaurant. */
export interface ChangeSet {
  restaurantId: string
  changes: Changes
}

/**
 * Per-restaurant unit of work. Every flow mutation runs inside `run(restaurantId, fn)`, so concurrent
 * requests and voice-call timers for one restaurant are applied one at a time (order numbers, rider
 * assignment, call transcript). What the action changed is published on `changes$` afterwards;
 * the realtime module subscribes to it, so domain modules never depend on Socket.IO.
 */
@Injectable()
export class UnitOfWork {
  private readonly chains = new Map<string, Promise<unknown>>()
  private readonly feed = new Subject<ChangeSet>()
  readonly changes$ = this.feed.asObservable()

  constructor(private readonly prisma: PrismaService) {}

  get db() {
    return this.prisma.db
  }

  /** Run `fn` exclusively for this restaurant, then publish what it changed. */
  async run<T>(restaurantId: string, fn: () => Promise<{ result: T; changes: Changes }>): Promise<T> {
    const prev = this.chains.get(restaurantId) ?? Promise.resolve()
    const run = prev.then(fn, fn)
    const settled = run.then(
      () => undefined,
      () => undefined,
    )
    this.chains.set(restaurantId, settled)
    const { result, changes } = await run
    if (this.chains.get(restaurantId) === settled) this.chains.delete(restaurantId)
    this.feed.next({ restaurantId, changes })
    return result
  }
}
