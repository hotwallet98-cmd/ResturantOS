import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { canUse, features, type Feature, type Tier } from '@restaurantos/contracts'
import type { AuthUser } from '../identity/auth.types.js'
import { isPublic } from '../identity/guards.js'

/** Throws 403 when the plan does not include the feature. */
export function assertFeature(plan: Tier | undefined, feature: Feature) {
  if (!plan) throw new ForbiddenException('This account is not linked to a restaurant')
  if (!canUse(plan, feature)) {
    const f = features[feature]
    throw new ForbiddenException(`"${f.label}" needs the ${f.tier} plan or higher; this restaurant is on ${plan}. Upgrade to use it.`)
  }
}

export const FEATURES = 'features'
/** Plan features the restaurant must have (all of them). */
export const RequireFeature = (...features: Feature[]) => SetMetadata(FEATURES, features)

/** Global plan guard: checks @RequireFeature() against the signed-in user's restaurant plan with canUse(). */
@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext) {
    if (ctx.getType() !== 'http' || isPublic(this.reflector, ctx)) return true
    const needed = this.reflector.getAllAndOverride<Feature[] | undefined>(FEATURES, [ctx.getHandler(), ctx.getClass()])
    if (!needed?.length) return true
    const user: AuthUser | undefined = ctx.switchToHttp().getRequest().user
    if (!user) return true // not authenticated: JwtAuthGuard rejects the request
    for (const f of needed) assertFeature(user.plan, f)
    return true
  }
}
