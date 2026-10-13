import { AudioLines, ChefHat, PackagePlus, TriangleAlert } from 'lucide-react'
import type { NavSection } from '@/shared/navigation'

/** Kitchen Portal — chefs and kitchen managers (restaurant admins can open it too). */
export const kitchenNav: NavSection[] = [
  {
    title: 'Kitchen',
    items: [
      { label: 'Live Orders (KDS)', to: '/kitchen', icon: ChefHat, feature: 'kitchen' },
      { label: 'Stock Alerts', to: '/kitchen/alerts', icon: TriangleAlert, feature: 'stockAlerts' },
      { label: 'Smart Stock Entry', to: '/kitchen/stock', icon: PackagePlus, feature: 'smartStock' },
    ],
  },
  {
    title: 'Voice Agent',
    items: [{ label: 'Voice Settings', to: '/kitchen/voice', icon: AudioLines, feature: 'kitchenVoice' }],
  },
]
