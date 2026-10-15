import { Body, Controller, HttpCode, Module, Param, Post } from '@nestjs/common'
import type { FlowOrder } from '@restaurantos/contracts'
import type { AuthUser } from '../identity/auth.types.js'
import { CurrentUser, restaurantOf, Roles } from '../identity/decorators.js'
import { OrderingModule } from '../ordering/ordering.module.js'
import { staff } from '../ordering/order-lifecycle.js'
import { RequireFeature } from '../tenancy/entitlements.js'
import { TenancyModule } from '../tenancy/tenancy.module.js'
import { StartCallDto } from './dto.js'
import { VerificationService } from './verification.service.js'

/** /orders/:id/verify/* (counter). */
@Controller('orders')
export class VerificationController {
  constructor(private readonly verification: VerificationService) {}

  /** (Re)start the verification call. `outcome` only matters in demo telephony mode. */
  @Post(':id/verify/call')
  @HttpCode(200)
  @Roles('counter_staff')
  @RequireFeature('counter', 'verifyCall')
  startCall(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: StartCallDto): Promise<FlowOrder> {
    return this.verification.start(restaurantOf(user), id, staff(user), dto.outcome)
  }

  /** Confirm without a call → Received. */
  @Post(':id/verify/confirm')
  @HttpCode(200)
  @Roles('counter_staff')
  @RequireFeature('counter')
  confirm(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<FlowOrder> {
    return this.verification.confirm(user, restaurantOf(user), id)
  }
}

/** Verification: order verification call through the TelephonyProvider (telephony module, global). */
@Module({
  imports: [OrderingModule, TenancyModule],
  controllers: [VerificationController],
  providers: [VerificationService],
})
export class VerificationModule {}
