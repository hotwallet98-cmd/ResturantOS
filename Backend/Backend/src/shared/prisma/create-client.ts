import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../../generated/prisma/client.js'

/**
 * Builds a PrismaClient with the driver adapter for the configured database.
 * Local development and production both use PostgreSQL. Keep DATABASE_URL in
 * the environment; never commit database credentials.
 */
export function createPrismaClient(url = process.env.DATABASE_URL) {
  if (!url) throw new Error('DATABASE_URL is required')
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })
}
