import type { LucideIcon } from 'lucide-react'
import { ChefHat, ConciergeBell, ShieldCheck, UtensilsCrossed } from 'lucide-react'
import type { Feature } from '@/shared/services/plans'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  badge?: string
  /** Subscription feature this page needs; locked items show the tier badge. */
  feature?: Feature
  /** Opens in a new tab (customer-facing app). */
  external?: boolean
}

export interface NavSection {
  title: string
  items: NavItem[]
}

export const portalMeta = {
  admin: { name: 'Super Admin Portal', icon: ShieldCheck },
  restaurant: { name: 'Restaurant Operations', icon: UtensilsCrossed },
  kitchen: { name: 'Kitchen Portal', icon: ChefHat },
  counter: { name: 'Main Counter', icon: ConciergeBell },
} as const

export type Portal = keyof typeof portalMeta

export const portalHome: Record<Portal, string> = { admin: '/admin', restaurant: '/app', kitchen: '/kitchen', counter: '/counter' }
