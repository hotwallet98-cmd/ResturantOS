import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '../../../generated/prisma/client.js'

/**
 * Builds a PrismaClient with the driver adapter for the configured database.
 * Dev: SQLite via better-sqlite3 (DATABASE_URL="file:./dev.db", relative to the process cwd = Backend/api).
 * To run on PostgreSQL see README ("Switching to PostgreSQL"): change the datasource provider,
 * install @prisma/adapter-pg + pg and return `new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })` here.
 */
export function createPrismaClient(url = process.env.DATABASE_URL ?? 'file:./dev.db') {
  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) })
}
