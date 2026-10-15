import { Controller, Get } from '@nestjs/common'
import { Public } from './identity/decorators.js'
import { PrismaService } from './shared/prisma/prisma.service.js'

/** API root: a quick "is it up?" answer instead of a 404 when someone opens /api in a browser. */
@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  info() {
    return {
      name: 'RestaurantOS API',
      status: 'ok',
      docs: 'packages/contracts/src/api.ts',
      health: '/api/health',
      examples: ['/api/plans', '/api/public/restaurants/spice-route', '/api/public/restaurants/spice-route/menu'],
    }
  }

  @Public()
  @Get('health')
  async health() {
    const started = Date.now()
    await this.prisma.db.$queryRawUnsafe('SELECT 1')
    return { status: 'ok', database: 'ok', dbLatencyMs: Date.now() - started, uptimeSec: Math.round(process.uptime()), time: new Date().toISOString() }
  }
}
