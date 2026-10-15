import { Module } from '@nestjs/common'
import { TenancyModule } from '../tenancy/tenancy.module.js'
import { MenuController, PublicMenuController } from './catalog.controllers.js'
import { CatalogService } from './catalog.service.js'

/** Catalog: menu for staff and the storefront, and menu-based pricing of order lines. */
@Module({
  imports: [TenancyModule],
  controllers: [MenuController, PublicMenuController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
