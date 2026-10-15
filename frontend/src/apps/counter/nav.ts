import { Bike, ConciergeBell, Receipt } from 'lucide-react'
import type { NavSection } from '@/shared/navigation'

/** Main counter — cashier / order desk. */
export const counterNav: NavSection[] = [
  {
    title: 'Counter',
    items: [
      { label: 'Live Orders', to: '/counter', icon: ConciergeBell, feature: 'counter' },
      { label: 'Table Billing', to: '/counter/billing', icon: Receipt, feature: 'pos' },
      { label: 'Deliveries & Riders', to: '/counter/deliveries', icon: Bike, feature: 'delivery' },
    ],
  },
]
