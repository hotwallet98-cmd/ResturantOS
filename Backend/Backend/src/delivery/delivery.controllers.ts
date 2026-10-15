import { Body, Controller, HttpCode, Param, Patch, Post } from '@nestjs/common'
import type { FlowOrder, FlowRider } from '@restaurantos/contracts'
import type { AuthUser } from '../identity/auth.types.js'
import { CurrentUser, restaurantOf, Roles } from '../identity/decorators.js'
import { RequireFeature } from '../tenancy/entitlements.js'
import { DeliveryService } from './delivery.service.js'
import { AssignRiderDto, DeliverDto, PickupDto, SetRiderStatusDto } from './dto.js'

/** /orders/:id/assign | pickup | deliver */
@Controller('orders')
export class DeliveryOrdersController {
  constructor(private readonly delivery: DeliveryService) {}

  @Post(':id/assign')
  @HttpCode(200)
  @Roles('counter_staff')
  @RequireFeature('counter', 'delivery')
  assign(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AssignRiderDto): Promise<FlowOrder> {
    return this.delivery.assignRider(restaurantOf(user), id, dto.riderId)
  }

  @Post(':id/pickup')
  @HttpCode(200)
  @Roles('rider')
  @RequireFeature('riderApp')
  pickup(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: PickupDto): Promise<FlowOrder> {
    return this.delivery.pickup(user, restaurantOf(user), id, dto?.scannedOrderNo)
  }

  @Post(':id/deliver')
  @HttpCode(200)
  @Roles('rider')
  @RequireFeature('riderApp', 'delivery')
  deliver(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: DeliverDto): Promise<FlowOrder> {
    return this.delivery.deliver(user, restaurantOf(user), id, dto)
  }
}

@Controller('riders')
export class RidersController {
  constructor(private readonly delivery: DeliveryService) {}

  /** Rider (own profile only), counter, admin. */
  @Patch(':id/status')
  @Roles('rider', 'counter_staff')
  @RequireFeature('delivery')
  setStatus(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SetRiderStatusDto): Promise<FlowRider> {
    return this.delivery.setRiderStatus(user, restaurantOf(user), id, dto.status)
  }
}
