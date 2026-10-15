import { IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator'
import type { PayMethod, PayTableRequest } from '@restaurantos/contracts'

const PAY_METHODS: PayMethod[] = ['Cash', 'Easypaisa', 'Card']

export class PayTableDto implements PayTableRequest {
  @IsIn(PAY_METHODS)
  method: PayMethod

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  tip: number

  @IsOptional()
  @IsString()
  @MaxLength(64)
  txnId?: string
}
