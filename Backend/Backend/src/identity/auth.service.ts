import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import type { LoginResponse, Role, SessionUser, Tier, VerifyMfaResponse } from '@restaurantos/contracts'
import { randomUUID } from 'node:crypto'
import { toSessionRestaurant } from '../shared/persistence/mappers.js'
import { PrismaService } from '../shared/prisma/prisma.service.js'
import type { AuthUser, JwtPayload } from './auth.types.js'

const CHALLENGE_TTL_MS = 5 * 60_000

/**
 * Demo auth: any password, then any 6-digit MFA code.
 * TODO(prod): real password hashes, TOTP/SMS codes and a persistent challenge store.
 */
@Injectable()
export class AuthService {
  private readonly challenges = new Map<string, { userId: string; expires: number }>()

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string): Promise<LoginResponse> {
    const user = await this.prisma.db.user.findUnique({ where: { email: email.trim().toLowerCase() } })
    if (!user) throw new UnauthorizedException('Unknown email or password')
    const challengeId = randomUUID()
    this.challenges.set(challengeId, { userId: user.id, expires: Date.now() + CHALLENGE_TTL_MS })
    return { mfaRequired: true, challengeId }
  }

  async verifyMfa(challengeId: string, _code: string): Promise<VerifyMfaResponse> {
    const c = this.challenges.get(challengeId)
    if (!c || c.expires < Date.now()) {
      this.challenges.delete(challengeId)
      throw new UnauthorizedException('Sign-in challenge expired, log in again')
    }
    this.challenges.delete(challengeId)
    const user = await this.loadUser(c.userId)
    if (!user) throw new UnauthorizedException('User no longer exists')
    const sessionId = randomUUID()
    const expiresAt = new Date(Date.now() + 12 * 60 * 60_000)
    await this.prisma.db.$transaction([
      this.prisma.db.authSession.create({ data: { id: sessionId, userId: user.id, expiresAt } }),
      this.prisma.db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
      this.prisma.db.adminResource.create({
        data: {
          kind: 'login_event',
          key: randomUUID(),
          data: { user: user.session.email, event: 'Login success', method: 'Password + MFA', ip: 'Local', location: 'Local development', at: new Date().toISOString() },
        },
      }),
    ])
    const payload: JwtPayload = { sub: user.id, role: user.role, rid: user.restaurantId, jti: sessionId }
    return { token: await this.jwt.signAsync(payload), user: user.session }
  }

  async touchSession(id: string, userId: string) {
    if (!id) return false
    const session = await this.prisma.db.authSession.findFirst({ where: { id, userId, revokedAt: null, expiresAt: { gt: new Date() } } })
    if (!session) return false
    if (Date.now() - session.lastSeenAt.getTime() > 60_000) {
      await this.prisma.db.authSession.update({ where: { id }, data: { lastSeenAt: new Date() } })
    }
    return true
  }

  async loadUser(id: string): Promise<AuthUser | null> {
    const u = await this.prisma.db.user.findUnique({ where: { id }, include: { restaurant: true } })
    if (!u) return null
    const plan = u.restaurant?.plan as Tier | undefined
    const session: SessionUser = {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role as Role,
      title: u.title,
      ...(u.restaurant ? { restaurant: toSessionRestaurant(u.restaurant) } : {}),
      ...(u.riderId ? { riderId: u.riderId } : {}),
    }
    return { id: u.id, name: u.name, role: u.role as Role, restaurantId: u.restaurantId ?? undefined, plan, riderId: u.riderId ?? undefined, session }
  }
}
