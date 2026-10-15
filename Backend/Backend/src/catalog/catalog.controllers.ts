import { Controller, Get, Param } from '@nestjs/common'
import type { MenuResponse } from '@restaurantos/contracts'
import type { AuthUser } from '../identity/auth.types.js'
import { CurrentUser, Public, restaurantOf } from '../identity/decorators.js'
import { TenancyService } from '../tenancy/tenancy.service.js'
import { CatalogService } from './catalog.service.js'

/** Staff: own restaurant's menu. */
@Controller('menu')
export class MenuController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  menu(@CurrentUser() user: AuthUser): Promise<MenuResponse> {
    return this.catalog.menu(restaurantOf(user))
  }
}

/** Storefront menu by restaurant slug. */
@Controller('public/restaurants')
export class PublicMenuController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly tenancy: TenancyService,
  ) {}

  @Public()
  @Get(':slug/menu')
  async menu(@Param('slug') slug: string): Promise<MenuResponse> {
    return this.catalog.menu((await this.tenancy.bySlug(slug)).id)
  }
}
