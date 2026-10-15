import type { Tone } from '@/shared/components/ui'
import type { FlowItem, FlowStatus } from '@/shared/services/flow'
import { lineFromMenu } from '@/shared/services/flow'

export const statusMeta: Record<FlowStatus, { label: string; tone: Tone }> = {
  Placed: { label: 'Placed', tone: 'gray' },
  Verifying: { label: 'Verifying call', tone: 'purple' },
  Received: { label: 'Sent to kitchen', tone: 'blue' },
  Preparing: { label: 'Preparing', tone: 'yellow' },
  Ready: { label: 'Ready', tone: 'green' },
  Packed: { label: 'Packed', tone: 'teal' },
  PickedUp: { label: 'Picked up', tone: 'teal' },
  Served: { label: 'Served', tone: 'gray' },
  Delivered: { label: 'Delivered', tone: 'gray' },
  Paid: { label: 'Paid', tone: 'gray' },
  Cancelled: { label: 'Cancelled', tone: 'red' },
}

/** Cart keyed by item id + variant. */
export type Cart = Record<string, { itemId: string; variant?: string; qty: number }>

export const cartItems = (cart: Cart): FlowItem[] => Object.values(cart).filter((c) => c.qty > 0).map((c) => lineFromMenu(c.itemId, c.qty, c.variant ? [c.variant] : []))
export const cartCount = (cart: Cart) => Object.values(cart).reduce((s, c) => s + c.qty, 0)
