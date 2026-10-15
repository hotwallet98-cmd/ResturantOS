import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'
import type { SeatTableRequest, SetTableStatusRequest, TableStatus } from '@restaurantos/contracts'

const TABLE_STATUSES: TableStatus[] = ['Available', 'Occupied', 'Reserved', 'Cleaning']

export class SeatTableDto implements SeatTableRequest {
  @IsInt()
  @Min(1)
  @Max(50)
  guests: number

  @IsOptional()
  @IsString()
  @MaxLength(100)
  guestName?: string

  @IsOptional()
  @IsString()
  reservationId?: string
}

export class SetTableStatusDto implements SetTableStatusRequest {
  @IsIn(TABLE_STATUSES)
  status: TableStatus
}
