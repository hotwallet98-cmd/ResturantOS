import { Logger } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { OnGatewayConnection, OnGatewayInit, WebSocketGateway, WebSocketServer } from '@nestjs/websockets'
import { SOCKET_EVENTS, type ServerToClientEvents } from '@restaurantos/contracts'
import type { Server, Socket } from 'socket.io'
import { AuthService } from '../identity/auth.service.js'
import type { JwtPayload } from '../identity/auth.types.js'
import { FlowReader } from '../shared/persistence/flow-reader.js'
import { toOrder } from '../shared/persistence/mappers.js'
import { orderRoom, RealtimeService, restaurantRoom } from './realtime.service.js'

type IoServer = Server<Record<string, never>, ServerToClientEvents>
type IoSocket = Socket<Record<string, never>, ServerToClientEvents>

/**
 * Socket.IO on the HTTP server, default path /socket.io.
 *  - Staff: `auth: { token }` → room restaurant:<id>, `flow:snapshot` on connect, then incremental events.
 *  - Customer: `auth: { orderId, trackingToken }` → room order:<id>, only `order:updated` for that order.
 */
@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class FlowGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly log = new Logger('Realtime')

  @WebSocketServer()
  server: IoServer

  constructor(
    private readonly realtime: RealtimeService,
    private readonly reader: FlowReader,
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
  ) {}

  afterInit(server: IoServer) {
    this.realtime.attach(server)
  }

  async handleConnection(client: IoSocket) {
    const a = (client.handshake.auth ?? {}) as { token?: string; orderId?: string; trackingToken?: string }
    try {
      if (a.token) {
        const payload = await this.jwt.verifyAsync<JwtPayload>(a.token)
        const user = await this.auth.loadUser(payload.sub)
        if (!user?.restaurantId) throw new Error('not a restaurant staff account')
        await client.join(restaurantRoom(user.restaurantId))
        client.emit(SOCKET_EVENTS.snapshot, await this.reader.state(user.restaurantId))
        this.log.debug(`staff ${user.name} (${user.role}) connected`)
        return
      }
      if (a.orderId && a.trackingToken) {
        const order = await this.reader.orderByTrackingToken(a.orderId, a.trackingToken)
        if (!order) throw new Error('unknown order or token')
        await client.join(orderRoom(order.id))
        client.emit(SOCKET_EVENTS.order, toOrder(order))
        return
      }
      throw new Error('missing auth (token, or orderId + trackingToken)')
    } catch (e) {
      this.log.warn(`socket rejected: ${e instanceof Error ? e.message : e}`)
      client.disconnect(true)
    }
  }
}
