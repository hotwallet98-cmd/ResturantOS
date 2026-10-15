import { Body, Controller, HttpCode, Param, Patch, Post } from '@nestjs/common'
import type { FlowTable } from '@restaurantos/contracts'
import type { AuthUser } from '../identity/auth.types.js'
import { CurrentUser, restaurantOf, Roles } from '../identity/decorators.js'
import { RequireFeature } from '../tenancy/entitlements.js'
import { SeatTableDto, SetTableStatusDto } from './dto.js'
import { FloorService } from './floor.service.js'

/** /tables/* except /tables/:id/pay (payments module). */
@Controller('tables')
export class TablesController {
  constructor(private readonly floor: FloorService) {}

  @Post(':id/seat')
  @HttpCode(200)
  @Roles('waiter')
  @RequireFeature('waiterApp', 'tables')
  seat(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SeatTableDto): Promise<FlowTable> {
    return this.floor.seat(user, restaurantOf(user), id, dto)
  }

  @Post(':id/bill-request')
  @HttpCode(200)
  @Roles('waiter')
  @RequireFeature('waiterApp')
  billRequest(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<FlowTable> {
    return this.floor.requestBill(restaurantOf(user), id)
  }

  @Patch(':id/status')
  @Roles('waiter', 'counter_staff')
  @RequireFeature('tables')
  setStatus(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SetTableStatusDto): Promise<FlowTable> {
    return this.floor.setStatus(restaurantOf(user), id, dto.status)
  }
}
