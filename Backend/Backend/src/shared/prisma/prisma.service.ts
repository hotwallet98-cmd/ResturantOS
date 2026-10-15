import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaClient } from '../../../generated/prisma/client.js'
import { createPrismaClient } from './create-client.js'

/** Single PrismaClient for the app. Use `prisma.db` for queries. */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  readonly db: PrismaClient

  constructor(config: ConfigService) {
    this.db = createPrismaClient(config.get<string>('DATABASE_URL'))
  }

  async onModuleInit() {
    await this.db.$connect()
  }

  async onModuleDestroy() {
    await this.db.$disconnect()
  }
}
