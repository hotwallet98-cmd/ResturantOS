import { Injectable, NotFoundException } from '@nestjs/common'
import { canUse, DELIVERY_FEE, type Feature, type PublicRestaurant, type SessionUser, type Tier } from '@restaurantos/contracts'
import { toSessionRestaurant } from '../shared/persistence/mappers.js'
import { PrismaService } from '../shared/prisma/prisma.service.js'
import { assertFeature } from './entitlements.js'

/** Shown on the storefront as "Delivery in 30–40 min". TODO: per-restaurant setting. */
const DELIVERY_ETA_MINS: [number, number] = [30, 40]
const CURRENCY = 'USD'

/** Restaurants (tenants): lookup by id / public slug, plan and entitlements. */
@Injectable()
export class TenancyService {
  constructor(private readonly prisma: PrismaService) {}

  async byId(restaurantId: string) {
    const r = await this.prisma.db.restaurant.findUnique({ where: { id: restaurantId } })
    if (!r) throw new NotFoundException(`Restaurant ${restaurantId} not found`)
    return r
  }

  /** 404 for an unknown slug. */
  async bySlug(slug: string) {
    const r = await this.prisma.db.restaurant.findUnique({ where: { slug } })
    if (!r) throw new NotFoundException(`Restaurant "${slug}" not found`)
    return r
  }

  async plan(restaurantId: string): Promise<Tier> {
    return (await this.byId(restaurantId)).plan as Tier
  }

  async assertPlan(restaurantId: string, feature: Feature) {
    assertFeature(await this.plan(restaurantId), feature)
  }

  async can(restaurantId: string, feature: Feature) {
    return canUse(await this.plan(restaurantId), feature)
  }

  async publicRestaurant(slug: string): Promise<PublicRestaurant> {
    const r = await this.bySlug(slug)
    return {
      id: r.id,
      slug: r.slug,
      name: r.name,
      acceptingOrders: canUse(r.plan as Tier, 'customerApp'),
      deliveryFee: DELIVERY_FEE,
      currency: CURRENCY,
      deliveryEtaMins: DELIVERY_ETA_MINS,
    }
  }

  /** Demo plan switch until billing exists. */
  async setPlan(restaurantId: string, plan: Tier): Promise<NonNullable<SessionUser['restaurant']>> {
    await this.byId(restaurantId)
    return toSessionRestaurant(await this.prisma.db.restaurant.update({ where: { id: restaurantId }, data: { plan } }))
  }
}
