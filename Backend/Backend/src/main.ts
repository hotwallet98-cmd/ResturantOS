import 'reflect-metadata'
import { Logger, ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { API_PREFIX, DEFAULT_API_PORT } from '@restaurantos/contracts'
import { AppModule } from './app.module.js'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.setGlobalPrefix(API_PREFIX.replace(/^\//, ''))
  const configuredOrigins = process.env.CORS_ORIGINS?.split(',').map((origin) => origin.trim()).filter(Boolean)
  app.enableCors({ origin: configuredOrigins?.length ? configuredOrigins : ['http://localhost:5173'], credentials: true })
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
  app.enableShutdownHooks()
  const port = Number(process.env.PORT) || DEFAULT_API_PORT
  await app.listen(port)
  new Logger('Bootstrap').log(`RestaurantOS API on http://localhost:${port}${API_PREFIX} (Socket.IO at /socket.io)`)
}
await bootstrap()
