import { Module } from '@nestjs/common'
import { CatalogModule } from '../catalog/catalog.module.js'
import { FloorModule } from '../floor/floor.module.js'
import { TenancyModule } from '../tenancy/tenancy.module.js'
import { OrderLifecycle } from './order-lifecycle.js'
import { OrderRepository } from './order.repository.js'
import { OrdersController, PublicOrdersController } from './orders.controller.js'
import { OrdersService } from './orders.service.js'

/**
 * Ordering: order creation (waiter + storefront), status machine, kitchen line updates, remakes, tracking.
 * Exports the repository and the lifecycle (with its listener hook) to delivery, payments and verification.
 */
@Module({
  imports: [TenancyModule, CatalogModule, FloorModule],
  controllers: [OrdersController, PublicOrdersController],
  providers: [OrderRepository, OrderLifecycle, OrdersService],
  exports: [OrderRepository, OrderLifecycle],
})
export class OrderingModule {}
