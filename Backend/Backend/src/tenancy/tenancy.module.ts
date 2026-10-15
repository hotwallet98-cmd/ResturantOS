import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { FeatureGuard } from './entitlements.js'
import { PlansController, PublicRestaurantController } from './tenancy.controllers.js'
import { TenancyService } from './tenancy.service.js'

/** Tenancy: restaurants, public slug lookup, plans / entitlements and the global plan guard (@RequireFeature). */
@Module({
  controllers: [PlansController, PublicRestaurantController],
  providers: [TenancyService, { provide: APP_GUARD, useClass: FeatureGuard }],
  exports: [TenancyService],
})
export class TenancyModule {}
