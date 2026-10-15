import { IsIn, IsOptional } from 'class-validator'
import type { StartCallRequest } from '@restaurantos/contracts'

export class StartCallDto implements StartCallRequest {
  @IsOptional()
  @IsIn(['confirm', 'decline', 'no_answer'])
  outcome?: 'confirm' | 'decline' | 'no_answer'
}
