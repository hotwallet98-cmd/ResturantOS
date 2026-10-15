import type { Role, SessionUser, Tier } from '@restaurantos/contracts'

/** What the JWT guard attaches to `request.user`. */
export interface AuthUser {
  id: string
  name: string
  role: Role
  /** Undefined for platform users (super_admin). */
  restaurantId?: string
  plan?: Tier
  riderId?: string
  session: SessionUser
}

export interface JwtPayload {
  sub: string
  role: Role
  rid?: string
  jti: string
}
