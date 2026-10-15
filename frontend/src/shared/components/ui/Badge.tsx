import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

export type Tone = 'gray' | 'green' | 'yellow' | 'red' | 'blue' | 'purple' | 'orange' | 'pink' | 'teal'

const tones: Record<Tone, string> = {
  gray: 'bg-slate-100 text-slate-700 ring-slate-200',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  yellow: 'bg-amber-50 text-amber-700 ring-amber-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  blue: 'bg-sky-50 text-sky-700 ring-sky-200',
  purple: 'bg-violet-50 text-violet-700 ring-violet-200',
  orange: 'bg-brand-50 text-brand-700 ring-brand-200',
  pink: 'bg-pink-50 text-pink-700 ring-pink-200',
  teal: 'bg-teal-50 text-teal-700 ring-teal-200',
}

const dots: Record<Tone, string> = {
  gray: 'bg-slate-400',
  green: 'bg-emerald-500',
  yellow: 'bg-amber-500',
  red: 'bg-red-500',
  blue: 'bg-sky-500',
  purple: 'bg-violet-500',
  orange: 'bg-brand-500',
  pink: 'bg-pink-500',
  teal: 'bg-teal-500',
}

export function Badge({ tone = 'gray', dot, children, className }: { tone?: Tone; dot?: boolean; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset',
        tones[tone],
        className,
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dots[tone])} />}
      {children}
    </span>
  )
}

const statusMap: Record<string, Tone> = {
  active: 'green', approved: 'green', paid: 'green', completed: 'green', delivered: 'green', ready: 'green', live: 'green',
  available: 'green', resolved: 'green', passed: 'green', published: 'green', 'in stock': 'green', healthy: 'green', verified: 'green',
  success: 'green', online: 'green', connected: 'green', present: 'green', operational: 'green', received: 'green',
  seated: 'teal', served: 'teal',
  pending: 'yellow', 'in review': 'yellow', review: 'yellow', 'low stock': 'yellow', warning: 'yellow', late: 'yellow', due: 'yellow',
  degraded: 'yellow', partial: 'yellow', cleaning: 'yellow', medium: 'yellow', 'expiring soon': 'yellow',
  trial: 'blue', 'in progress': 'blue', preparing: 'blue', open: 'blue', scheduled: 'blue', sent: 'blue', confirmed: 'blue',
  reserved: 'purple', 'on leave': 'purple', 'out for delivery': 'purple', 'picked up': 'purple', assigned: 'purple',
  new: 'orange', occupied: 'orange', escalated: 'orange',
  suspended: 'red', rejected: 'red', overdue: 'red', failed: 'red', cancelled: 'red', critical: 'red', expired: 'red',
  'out of stock': 'red', absent: 'red', high: 'red', urgent: 'red', down: 'red',
  draft: 'gray', inactive: 'gray', closed: 'gray', disabled: 'gray', offline: 'gray', archived: 'gray', low: 'gray',
}

export function statusTone(status: string): Tone {
  return statusMap[status.toLowerCase()] ?? 'gray'
}

/** Badge whose colour is derived from common status words (Active, Pending, Overdue, …). */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge tone={statusTone(status)} dot className={className}>
      {status}
    </Badge>
  )
}
