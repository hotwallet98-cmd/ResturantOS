import { createParamDecorator, ExecutionContext, ForbiddenException, SetMetadata } from '@nestjs/common'
import type { Role } from '@restaurantos/contracts'
import type { AuthUser } from './auth.types.js'

export const IS_PUBLIC = 'isPublic'
export const ROLES = 'roles'

/** Skip the JWT guard (public endpoint). */
export const Public = () => SetMetadata(IS_PUBLIC, true)
/** Allowed roles. restaurant_admin always passes. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles)

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user)

/** Staff must belong to a restaurant for operational endpoints (super_admin does not). Returns the restaurant id. */
export function restaurantOf(user: AuthUser): string {
  if (!user.restaurantId) throw new ForbiddenException('This account is not linked to a restaurant')
  return user.restaurantId
}
