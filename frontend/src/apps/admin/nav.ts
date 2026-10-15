import { Building2, CreditCard, KeyRound, LayoutDashboard, LifeBuoy, Settings2, UserCog, UserPlus } from 'lucide-react'
import type { NavSection } from '@/shared/navigation'

/** Super Admin Portal — mirrors the top half of the mind map. */
export const adminNav: NavSection[] = [
  {
    title: 'Overview',
    items: [{ label: 'Dashboard', to: '/admin', icon: LayoutDashboard }],
  },
  {
    title: 'Restaurants',
    items: [
      { label: 'Restaurants / Tenants', to: '/admin/tenants', icon: Building2 },
      { label: 'Onboarding Flow', to: '/admin/onboarding', icon: UserPlus, badge: '4' },
      { label: 'Subscriptions & Billing', to: '/admin/subscriptions', icon: CreditCard },
    ],
  },
  {
    title: 'Platform',
    items: [
      { label: 'Users & Access', to: '/admin/users', icon: UserCog },
      { label: 'Authentication', to: '/admin/security', icon: KeyRound },
      { label: 'Configuration', to: '/admin/config', icon: Settings2 },
      { label: 'Support & Monitoring', to: '/admin/support', icon: LifeBuoy, badge: '7' },
    ],
  },
]
