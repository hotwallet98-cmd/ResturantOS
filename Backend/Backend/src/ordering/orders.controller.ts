import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common'
import type { CreateCustomerOrderResponse, FlowOrder, TrackOrderResponse } from '@restaurantos/contracts'
import type { AuthUser } from '../identity/auth.types.js'
import { CurrentUser, Public, restaurantOf, Roles } from '../identity/decorators.js'
import { RequireFeature } from '../tenancy/entitlements.js'
import { CreateCustomerOrderDto, CreateTableOrderDto, RemakeDto, SetStatusDto, UpdateItemsDto } from './dto.js'
import { OrdersService } from './orders.service.js'

/**
 * Order lifecycle endpoints. Verification (/verify/*) and delivery (/assign, /pickup, /deliver)
 * actions on /orders/:id live in their own modules.
 */
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post('table')
  @Roles('waiter')
  @RequireFeature('waiterApp')
  createTableOrder(@CurrentUser() user: AuthUser, @Body() dto: CreateTableOrderDto): Promise<FlowOrder> {
    return this.orders.createTableOrder(user, restaurantOf(user), dto)
  }

  @Public()
  @Get(':id/track')
  track(@Param('id') id: string, @Query('token') token: string): Promise<TrackOrderResponse> {
    return this.orders.track(id, token ?? '')
  }

  /** Validated with TRANSITIONS + TRANSITION_ROLES; the plan feature depends on the target status. Paid / Delivered → 400. */
  @Patch(':id/status')
  @Roles('counter_staff', 'kitchen_staff', 'waiter', 'rider')
  setStatus(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SetStatusDto): Promise<FlowOrder> {
    return this.orders.setStatus(user, restaurantOf(user), id, dto.status)
  }

  @Patch(':id/items')
  @Roles('kitchen_staff')
  @RequireFeature('kitchen')
  updateItems(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateItemsDto): Promise<FlowOrder> {
    return this.orders.updateItems(restaurantOf(user), id, dto)
  }

  @Post(':id/remake')
  @Roles('kitchen_staff')
  @RequireFeature('kitchen')
  remake(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: RemakeDto): Promise<FlowOrder> {
    return this.orders.remake(restaurantOf(user), id, dto)
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @Roles('counter_staff')
  @RequireFeature('counter')
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<FlowOrder> {
    return this.orders.cancel(user, restaurantOf(user), id)
  }
}

/** Storefront ordering by restaurant slug. */
@Controller('public/restaurants')
export class PublicOrdersController {
  constructor(private readonly orders: OrdersService) {}

  /** Customer app order → Placed, then the verification call starts (Verifying). 404 for an unknown slug. */
  @Public()
  @Post(':slug/orders')
  createCustomerOrder(@Param('slug') slug: string, @Body() dto: CreateCustomerOrderDto): Promise<CreateCustomerOrderResponse> {
    return this.orders.createCustomerOrder(slug, dto)
  }
}
