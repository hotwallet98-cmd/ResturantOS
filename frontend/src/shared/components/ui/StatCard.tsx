import type { LucideIcon } from 'lucide-react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

export type StatTone = 'brand' | 'blue' | 'green' | 'purple' | 'amber' | 'red' | 'slate' | 'pink' | 'teal'

const toneClasses: Record<StatTone, string> = {
  brand: 'bg-brand-50 text-brand-600',
  blue: 'bg-sky-50 text-sky-600',
  green: 'bg-emerald-50 text-emerald-600',
  purple: 'bg-violet-50 text-violet-600',
  amber: 'bg-amber-50 text-amber-600',
  red: 'bg-red-50 text-red-600',
  slate: 'bg-slate-100 text-slate-600',
  pink: 'bg-pink-50 text-pink-600',
  teal: 'bg-teal-50 text-teal-600',
}

export interface StatCardProps {
  label: string
  value: ReactNode
  icon?: LucideIcon
  tone?: StatTone
  /** Percentage change vs previous period, e.g. 12.5 or -3 */
  delta?: number
  deltaLabel?: string
  /** When true a negative delta is good (e.g. costs, wastage). */
  invertDelta?: boolean
  hint?: ReactNode
  className?: string
}

export function StatCard({ label, value, icon: Icon, tone = 'brand', delta, deltaLabel = 'vs last period', invertDelta, hint, className }: StatCardProps) {
  const good = delta === undefined ? true : invertDelta ? delta <= 0 : delta >= 0
  return (
    <div className={cn('rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-900/[0.03]', className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        {Icon && (
          <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', toneClasses[tone])}>
            <Icon size={18} />
          </span>
        )}
      </div>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
      {(delta !== undefined || hint) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
          {delta !== undefined && (
            <span className={cn('inline-flex items-center gap-0.5 font-semibold', good ? 'text-emerald-600' : 'text-red-600')}>
              {delta >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              {Math.abs(delta).toFixed(1)}%
            </span>
          )}
          {delta !== undefined && <span className="text-slate-400">{deltaLabel}</span>}
          {hint && <span className="text-slate-500">{hint}</span>}
        </div>
      )}
    </div>
  )
}
