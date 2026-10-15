/** Row types and small helpers shared by every module that writes the flow tables. */
import type { Order, OrderItem, Prisma } from '../../../generated/prisma/client.js'

export type OrderRow = Order & { items: OrderItem[] }

/** `include` that loads an order with its lines in display order. */
export const includeItems = { items: { orderBy: { position: 'asc' } } } as const

/** Cast a plain value for a Json column. */
export const json = (v: unknown) => v as Prisma.InputJsonValue

/** Money is stored as Float; round to cents in code. */
export const round2 = (n: number) => Math.round(n * 100) / 100
