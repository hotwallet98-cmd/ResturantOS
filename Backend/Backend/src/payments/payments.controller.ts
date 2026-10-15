import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common'
import type { PayTableResponse } from '@restaurantos/contracts'
import type { AuthUser } from '../identity/auth.types.js'
import { CurrentUser, restaurantOf, Roles } from '../identity/decorators.js'
import { RequireFeature } from '../tenancy/entitlements.js'
import { PayTableDto } from './dto.js'
import { PaymentsService } from './payments.service.js'

@Controller('tables')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /** The only way to mark dine-in orders Paid. Returns the freed table and the orders just paid. */
  @Post(':id/pay')
  @HttpCode(200)
  @Roles('counter_staff')
  @RequireFeature('pos', 'counter')
  pay(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: PayTableDto): Promise<PayTableResponse> {
    return this.payments.payTable(restaurantOf(user), id, dto)
  }
}
