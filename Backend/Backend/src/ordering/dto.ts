/** Request validation for the ordering endpoints. Each class implements its contract type. */
import { Type } from 'class-transformer'
import { ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator'
import {
  STATIONS,
  type CreateCustomerOrderRequest,
  type CreateTableOrderRequest,
  type FlowStatus,
  type OrderItemInput,
  type RemakeRequest,
  type SetStatusRequest,
  type Station,
  type UpdateItemsRequest,
} from '@restaurantos/contracts'

const FLOW_STATUSES: FlowStatus[] = ['Placed', 'Verifying', 'Received', 'Preparing', 'Ready', 'Packed', 'PickedUp', 'Served', 'Delivered', 'Paid', 'Cancelled']

export class OrderItemDto implements OrderItemInput {
  @IsString()
  itemId: string

  @IsInt()
  @Min(1)
  @Max(99)
  qty: number

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  modifiers?: string[]

  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string
}

export class CreateTableOrderDto implements CreateTableOrderRequest {
  @IsString()
  tableId: string

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[]

  /** Order-level note for the kitchen. Not in CreateTableOrderRequest yet (backend extension). */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string
}

export class CreateCustomerOrderDto implements CreateCustomerOrderRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string

  @IsString()
  @MinLength(5)
  @MaxLength(30)
  phone: string

  @IsString()
  @MinLength(3)
  @MaxLength(300)
  address: string

  @IsIn(['Cash', 'Easypaisa'])
  pay: 'Cash' | 'Easypaisa'

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[]

  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string
}

export class SetStatusDto implements SetStatusRequest {
  @IsIn(FLOW_STATUSES)
  status: FlowStatus
}

export class ItemStateDto {
  @IsBoolean()
  done: boolean

  @IsIn(STATIONS)
  station: Station
}

export class UpdateItemsDto implements UpdateItemsRequest {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemStateDto)
  items: ItemStateDto[]
}

export class RemakeDto implements RemakeRequest {
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Min(0, { each: true })
  itemIndexes: number[]

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  reason: string
}
