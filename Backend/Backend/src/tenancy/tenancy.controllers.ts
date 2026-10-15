import { Body, Controller, Get, Param, Patch } from '@nestjs/common'
import { IsIn } from 'class-validator'
import { features, tierInfo, TIERS, type PlansResponse, type PublicRestaurant, type SessionUser, type SetPlanRequest, type Tier } from '@restaurantos/contracts'
import type { AuthUser } from '../identity/auth.types.js'
import { CurrentUser, Public, restaurantOf, Roles } from '../identity/decorators.js'
import { TenancyService } from './tenancy.service.js'

class SetPlanDto implements SetPlanRequest {
  @IsIn(TIERS)
  plan: Tier
}

@Controller()
export class PlansController {
  constructor(private readonly tenancy: TenancyService) {}

  @Public()
  @Get('plans')
  plans(): PlansResponse {
    return { tiers: TIERS.map((t) => tierInfo[t]), features }
  }

  /** Demo plan switch until billing exists (restaurant_admin). */
  @Patch('restaurant/plan')
  @Roles('restaurant_admin')
  setPlan(@CurrentUser() user: AuthUser, @Body() dto: SetPlanDto): Promise<NonNullable<SessionUser['restaurant']>> {
    return this.tenancy.setPlan(restaurantOf(user), dto.plan)
  }
}

/** Storefront: what a customer app needs to render a restaurant. */
@Controller('public/restaurants')
export class PublicRestaurantController {
  constructor(private readonly tenancy: TenancyService) {}

  @Public()
  @Get(':slug')
  restaurant(@Param('slug') slug: string): Promise<PublicRestaurant> {
    return this.tenancy.publicRestaurant(slug)
  }
}
