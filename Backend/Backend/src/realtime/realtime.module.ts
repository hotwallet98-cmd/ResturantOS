import { Controller, Get, Module } from '@nestjs/common'
import type { FlowResponse } from '@restaurantos/contracts'
import type { AuthUser } from '../identity/auth.types.js'
import { CurrentUser, restaurantOf } from '../identity/decorators.js'
import { FlowReader } from '../shared/persistence/flow-reader.js'
import { FlowGateway } from './flow.gateway.js'
import { RealtimeService } from './realtime.service.js'

/** GET /flow — the REST twin of `flow:snapshot`; afterwards clients stay fresh from socket events. */
@Controller('flow')
export class LiveStateController {
  constructor(private readonly reader: FlowReader) {}

  @Get()
  get(@CurrentUser() user: AuthUser): Promise<FlowResponse> {
    return this.reader.state(restaurantOf(user))
  }
}

/** Realtime: Socket.IO gateway (staff + customer rooms), change broadcasting, live state snapshot. */
@Module({ controllers: [LiveStateController], providers: [RealtimeService, FlowGateway] })
export class RealtimeModule {}
