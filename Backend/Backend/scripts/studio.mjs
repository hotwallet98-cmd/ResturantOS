import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'

if (existsSync('.env')) process.loadEnvFile('.env')
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')
spawn('npx', ['prisma', 'studio', '--port', '5555', '--url', process.env.DATABASE_URL], { stdio: 'inherit', shell: true })
