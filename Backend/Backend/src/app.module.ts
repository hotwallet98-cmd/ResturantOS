import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { CatalogModule } from './catalog/catalog.module.js'
import { DeliveryModule } from './delivery/delivery.module.js'
import { HealthController } from './health.controller.js'
import { FloorModule } from './floor/floor.module.js'
import { IdentityModule } from './identity/identity.module.js'
import { OrderingModule } from './ordering/ordering.module.js'
import { PaymentsModule } from './payments/payments.module.js'
import { RealtimeModule } from './realtime/realtime.module.js'
import { PersistenceModule } from './shared/persistence/persistence.module.js'
import { PrismaModule } from './shared/prisma/prisma.module.js'
import { TelephonyModule } from './telephony/telephony.module.js'
import { TenancyModule } from './tenancy/tenancy.module.js'
import { VerificationModule } from './verification/verification.module.js'
import { VoiceModule } from './voice/voice.controller.js'
import { AdminModule } from './admin/admin.module.js'

/**
 * Modular monolith. Dependencies point one way:
 *   identity ← tenancy ← catalog ← ordering ← payments ← delivery
 *                         floor ← ordering      ordering ← verification → telephony
 *   shared (prisma, unit of work, read model) ← everything; realtime only listens to the change feed.
 * Import order matters for the global guards: identity (JWT, roles) before tenancy (plan).
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    PersistenceModule,
    IdentityModule,
    TenancyModule,
    CatalogModule,
    FloorModule,
    OrderingModule,
    PaymentsModule,
    DeliveryModule,
    TelephonyModule,
    VerificationModule,
    RealtimeModule,
    VoiceModule,
    AdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
