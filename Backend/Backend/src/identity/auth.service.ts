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
    const payload: JwtPayload = { sub: user.id, role: user.role, rid: user.restaurantId }
    return { token: await this.jwt.signAsync(payload), user: user.session }
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
