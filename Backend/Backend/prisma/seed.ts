/**
 * Seeds the demo restaurant. Re-runnable: wipes the demo restaurant's data first.
 *   npm run db:seed
 */
import { existsSync } from 'node:fs'
import type { FlowStatus } from '@restaurantos/contracts'
import type { Prisma } from '../generated/prisma/client.js'
import { createPrismaClient } from '../src/shared/prisma/create-client.js'
import { menuItems, orders, RESTAURANT, reservations, riders, tables, users } from './seed-data.js'

if (existsSync('.env')) process.loadEnvFile('.env')
const prisma = createPrismaClient()

async function main() {
  const rid = RESTAURANT.id
  await prisma.$transaction([
    prisma.orderItem.deleteMany({ where: { order: { restaurantId: rid } } }),
    prisma.order.deleteMany({ where: { restaurantId: rid } }),
    prisma.user.deleteMany({ where: { OR: [{ restaurantId: rid }, { email: { in: users.map((u) => u.email) } }] } }),
    prisma.rider.deleteMany({ where: { restaurantId: rid } }),
    prisma.reservation.deleteMany({ where: { restaurantId: rid } }),
    prisma.diningTable.deleteMany({ where: { restaurantId: rid } }),
    prisma.menuItem.deleteMany({ where: { restaurantId: rid } }),
    prisma.restaurant.deleteMany({ where: { id: rid } }),
  ])

  const nextOrderNo = Math.max(...orders.map((o) => o.orderNo)) + 1
  await prisma.restaurant.create({ data: { id: rid, slug: RESTAURANT.slug, name: RESTAURANT.name, branches: RESTAURANT.branches, plan: RESTAURANT.plan, nextOrderNo } })

  await prisma.menuItem.createMany({ data: menuItems.map((m, position) => ({ ...m, variants: m.variants as unknown as Prisma.InputJsonArray, restaurantId: rid, position })) })
  await prisma.diningTable.createMany({ data: tables.map((t, position) => ({ ...t, name: t.id, restaurantId: rid, position })) })
  await prisma.reservation.createMany({
    data: reservations.map(({ table, ...r }) => ({ ...r, tableId: table, restaurantId: rid })),
  })
  await prisma.rider.createMany({ data: riders.map((r, position) => ({ ...r, restaurantId: rid, position })) })
  for (const u of users) {
    await prisma.user.create({ data: { id: u.id, name: u.name, email: u.email, role: u.role, title: u.title, restaurantId: u.restaurant ? rid : null, riderId: u.riderId ?? null } })
  }

  const menu = new Map(menuItems.map((m) => [m.id, m]))
  for (const o of orders) {
    const items = o.items.map((l, position) => {
      const m = menu.get(l.itemId)!
      const variant = m.variants.find((v) => l.modifiers?.includes(v.name))
      return { position, itemId: m.id, name: m.name, emoji: m.emoji, qty: l.qty, price: m.price + (variant?.price ?? 0), station: m.station, modifiers: l.modifiers ?? [], notes: l.notes ?? null, done: l.done ?? false }
    })
    // Prototype: non-dine-in tickets in "Served" mean delivered
    const status: FlowStatus = o.type !== 'Dine-in' && o.status === 'Served' ? 'Delivered' : o.status
    await prisma.order.create({
      data: {
        id: o.id,
        restaurantId: rid,
        orderNo: o.orderNo,
        type: o.type,
        source: o.fromPos ? 'Waiter' : 'Customer App',
        tableId: o.table ?? null,
        waiter: o.table ? o.server : null,
        customer: o.table ? undefined : { name: o.server === 'Online' ? 'Online customer' : o.server, phone: '+92 300 0000000', ...(o.type === 'Delivery' ? { address: 'House 12, Street 4, DHA Phase 5, Lahore' } : {}) },
        status,
        priority: o.priority,
        predictedMins: o.predictedMins,
        createdAt: o.createdAt,
        history: [{ status, at: o.createdAt.toISOString() }],
        remake: o.remake ?? false,
        payOnDelivery: o.type === 'Delivery' ? 'Cash' : null,
        items: { create: items },
      },
    })
  }

  console.log(`Seeded ${RESTAURANT.name}: ${menuItems.length} menu items, ${tables.length} tables, ${reservations.length} reservations, ${riders.length} riders, ${users.length} users, ${orders.length} orders`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
