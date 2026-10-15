import { Module } from '@nestjs/common'
import { OrderingModule } from '../ordering/ordering.module.js'
import { PaymentsModule } from '../payments/payments.module.js'
import { DeliveryOrdersController, RidersController } from './delivery.controllers.js'
import { DeliveryService } from './delivery.service.js'

/** Delivery: riders, assignment (auto-assign on Preparing), pickup scan, deliver, rider status. */
@Module({
  imports: [OrderingModule, PaymentsModule],
  controllers: [DeliveryOrdersController, RidersController],
  providers: [DeliveryService],
})
export class DeliveryModule {}
