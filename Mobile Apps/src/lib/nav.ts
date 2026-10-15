import type { SessionUser } from '@restaurantos/contracts'
import { router, type Href } from 'expo-router'

/** Where a signed-in staff member lands: their role home, or the "use the web app" screen. */
export function staffHome(user: SessionUser): Href {
  if (user.role === 'waiter') return '/waiter'
  if (user.role === 'rider') return '/rider'
  return '/unsupported'
}

/**
 * Clear the navigation history and go to `href` (default: the entry route, which picks the store or
 * the staff role home). Used after sign-in / sign-out so Back never returns to the other experience.
 */
export function resetTo(href: Href = '/') {
  if (router.canDismiss()) router.dismissAll()
  router.replace(href)
}
