import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import type { Role } from '@restaurantos/contracts'
import { AuthService } from './auth.service.js'
import type { AuthUser, JwtPayload } from './auth.types.js'
import { IS_PUBLIC, ROLES } from './decorators.js'

export const isPublic = (reflector: Reflector, ctx: ExecutionContext) => reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]) === true

/** Verifies `Authorization: Bearer <jwt>` and loads the user fresh from the DB (so plan changes apply immediately). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
  ) {}

  async canActivate(ctx: ExecutionContext) {
    if (ctx.getType() !== 'http' || isPublic(this.reflector, ctx)) return true
    const req = ctx.switchToHttp().getRequest()
    const header: string | undefined = req.headers?.authorization
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined
    if (!token) throw new UnauthorizedException('Missing bearer token')
    let payload: JwtPayload
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token)
    } catch {
      throw new UnauthorizedException('Invalid or expired token')
    }
    const user = await this.auth.loadUser(payload.sub)
    if (!user) throw new UnauthorizedException('User no longer exists')
    req.user = user
    return true
  }
}

/** Checks @Roles(). restaurant_admin may do everything a restaurant role can. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext) {
    if (ctx.getType() !== 'http' || isPublic(this.reflector, ctx)) return true
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES, [ctx.getHandler(), ctx.getClass()])
    if (!roles?.length) return true
    const user: AuthUser | undefined = ctx.switchToHttp().getRequest().user
    if (!user) throw new UnauthorizedException('Missing bearer token')
    if (user.role === 'restaurant_admin' || roles.includes(user.role)) return true
    throw new ForbiddenException(`This action needs one of these roles: ${roles.join(', ')} (you are ${user.role})`)
  }
}
