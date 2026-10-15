import { Module } from '@nestjs/common'
import { FloorModule } from '../floor/floor.module.js'
import { OrderingModule } from '../ordering/ordering.module.js'
import { PaymentsController } from './payments.controller.js'
import { PaymentsService } from './payments.service.js'

/** Payments: table pay with tip split, delivery payment capture (payment.txnId). */
@Module({
  imports: [OrderingModule, FloorModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
