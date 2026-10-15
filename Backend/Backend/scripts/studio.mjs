// Prisma 7 Studio only accepts an absolute file:/// URL for SQLite, so build it from DATABASE_URL.
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

if (existsSync('.env')) process.loadEnvFile('.env')
const dbUrl = process.env.DATABASE_URL ?? 'file:./dev.db'
const url = dbUrl.startsWith('file:') ? pathToFileURL(resolve(dbUrl.replace(/^file:/, ''))).href : dbUrl
spawn('npx', ['prisma', 'studio', '--port', '5555', '--url', url], { stdio: 'inherit', shell: true })
