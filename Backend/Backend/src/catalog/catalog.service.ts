import { BadRequestException, Injectable } from '@nestjs/common'
import type { MenuItem, OrderItemInput, PriceOption } from '@restaurantos/contracts'
import type { Prisma } from '../../generated/prisma/client.js'
import { toMenuItem } from '../shared/persistence/mappers.js'
import { json, round2 } from '../shared/persistence/rows.js'
import { PrismaService } from '../shared/prisma/prisma.service.js'

export type PricedLine = Prisma.OrderItemCreateWithoutOrderInput

/** Menu of a restaurant, and pricing of order lines from it. */
@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async menu(restaurantId: string): Promise<MenuItem[]> {
    const rows = await this.prisma.db.menuItem.findMany({ where: { restaurantId }, orderBy: { position: 'asc' } })
    return rows.map(toMenuItem)
  }

  /**
   * Lines priced from the menu — client prices are never trusted. A matching variant adds its price.
   * Also returns the predicted prep time of the whole order.
   */
  async priceLines(restaurantId: string, input: OrderItemInput[]): Promise<{ items: PricedLine[]; predictedMins: number }> {
    const ids = [...new Set(input.map((i) => i.itemId))]
    const menu = new Map((await this.prisma.db.menuItem.findMany({ where: { restaurantId, id: { in: ids } } })).map((m) => [m.id, m]))
    const items = input.map((line, position): PricedLine => {
      const m = menu.get(line.itemId)
      if (!m) throw new BadRequestException(`Unknown menu item ${line.itemId}`)
      if (!m.available) throw new BadRequestException(`${m.name} is not available right now`)
      const modifiers = line.modifiers ?? []
      const variants = m.variants as unknown as PriceOption[]
      const variant = variants.find((v) => modifiers.includes(v.name))
      return {
        position,
        itemId: m.id,
        name: m.name,
        emoji: m.emoji,
        qty: line.qty,
        price: round2(m.price + (variant?.price ?? 0)),
        station: m.station,
        modifiers: json(modifiers),
        notes: line.notes?.trim() || null,
        done: false,
      }
    })
    const prep = input.map((l) => menu.get(l.itemId)!.prepMins)
    return { items, predictedMins: Math.max(8, ...prep) + Math.min(10, input.length * 2) }
  }
}
