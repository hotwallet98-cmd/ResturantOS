import { IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator'
import type { AssignRiderRequest, DeliverRequest, FlowRider, PickupRequest, SetRiderStatusRequest } from '@restaurantos/contracts'

const RIDER_STATUSES: FlowRider['status'][] = ['Available', 'On delivery', 'Offline']

export class AssignRiderDto implements AssignRiderRequest {
  @IsString()
  riderId: string
}

export class PickupDto implements PickupRequest {
  @IsOptional()
  @IsInt()
  scannedOrderNo?: number
}

export class DeliverDto implements DeliverRequest {
  @IsIn(['Cash', 'Easypaisa'])
  method: 'Cash' | 'Easypaisa'

  @IsOptional()
  @IsString()
  @MaxLength(64)
  txnId?: string
}

export class SetRiderStatusDto implements SetRiderStatusRequest {
  @IsIn(RIDER_STATUSES)
  status: FlowRider['status']
}
