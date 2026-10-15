import type { LucideIcon } from 'lucide-react'
import { Check, Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

export function PageHeader({
  title,
  description,
  actions,
  icon: Icon,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  icon?: LucideIcon
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100 sm:flex">
            <Icon size={22} />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

const progressTones = {
  brand: 'bg-brand-500',
  green: 'bg-emerald-500',
  yellow: 'bg-amber-500',
  red: 'bg-red-500',
  blue: 'bg-sky-500',
  purple: 'bg-violet-500',
}

export function ProgressBar({
  value,
  max = 100,
  tone = 'brand',
  className,
  showLabel,
}: {
  value: number
  max?: number
  tone?: keyof typeof progressTones
  className?: string
  showLabel?: boolean
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className={cn('h-full rounded-full transition-all', progressTones[tone])} style={{ width: `${pct}%` }} />
      </div>
      {showLabel && <span className="w-10 text-right text-xs font-medium text-slate-600">{Math.round(pct)}%</span>}
    </div>
  )
}

const avatarColors = ['bg-brand-100 text-brand-700', 'bg-sky-100 text-sky-700', 'bg-emerald-100 text-emerald-700', 'bg-violet-100 text-violet-700', 'bg-amber-100 text-amber-700', 'bg-pink-100 text-pink-700', 'bg-teal-100 text-teal-700']

export function Avatar({ name, size = 'md', className }: { name: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')
  const color = avatarColors[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % avatarColors.length]
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold',
        { sm: 'h-7 w-7 text-[11px]', md: 'h-9 w-9 text-xs', lg: 'h-12 w-12 text-sm' }[size],
        color,
        className,
      )}
    >
      {initials}
    </span>
  )
}

export function EmptyState({ icon: Icon, title, description, action }: { icon?: LucideIcon; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {Icon && (
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <Icon size={22} />
        </span>
      )}
      <p className="font-medium text-slate-800">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
      <Loader2 size={18} className="animate-spin text-brand-500" />
      {label}
    </div>
  )
}

export interface Step {
  id: string
  label: string
  description?: string
}

/** Wizard progress indicator. Vertical on desktop sidebars, horizontal for headers. */
export function Stepper({
  steps,
  current,
  onStepClick,
  orientation = 'vertical',
}: {
  steps: Step[]
  current: number
  onStepClick?: (index: number) => void
  orientation?: 'vertical' | 'horizontal'
}) {
  return (
    <ol className={cn(orientation === 'horizontal' ? 'scrollbar-thin flex items-center gap-2 overflow-x-auto' : 'space-y-1')}>
      {steps.map((s, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={s.id} className={cn(orientation === 'horizontal' && 'flex shrink-0 items-center gap-2')}>
            <button
              type="button"
              disabled={!onStepClick || i > current}
              onClick={() => onStepClick?.(i)}
              className={cn(
                'flex w-full items-start gap-3 rounded-lg text-left transition-colors disabled:cursor-default',
                orientation === 'vertical' && 'px-3 py-2',
                orientation === 'vertical' && active && 'bg-brand-50',
              )}
            >
              <span
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-1',
                  done && 'bg-brand-600 text-white ring-brand-600',
                  active && 'bg-white text-brand-700 ring-2 ring-brand-500',
                  !done && !active && 'bg-white text-slate-400 ring-slate-200',
                )}
              >
                {done ? <Check size={14} /> : i + 1}
              </span>
              <span className={cn('min-w-0 pt-0.5', orientation === 'horizontal' && 'hidden md:block')}>
                <span className={cn('block text-sm font-medium', active ? 'text-brand-800' : done ? 'text-slate-800' : 'text-slate-500')}>{s.label}</span>
                {s.description && orientation === 'vertical' && <span className="block text-xs text-slate-500">{s.description}</span>}
              </span>
            </button>
            {orientation === 'horizontal' && i < steps.length - 1 && <span className={cn('h-px w-6 md:w-10', done ? 'bg-brand-400' : 'bg-slate-200')} />}
          </li>
        )
      })}
    </ol>
  )
}

/** Simple label/value grid for detail views. */
export function DescriptionList({ items, columns = 2 }: { items: { label: string; value: ReactNode }[]; columns?: 1 | 2 | 3 }) {
  return (
    <dl className={cn('grid gap-x-6 gap-y-4', { 1: 'grid-cols-1', 2: 'grid-cols-1 sm:grid-cols-2', 3: 'grid-cols-1 sm:grid-cols-3' }[columns])}>
      {items.map((it) => (
        <div key={it.label} className="min-w-0">
          <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">{it.label}</dt>
          <dd className="mt-1 text-sm break-words text-slate-800">{it.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Small section heading used inside cards / tabs. */
export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h4 className="text-sm font-semibold text-slate-800">{children}</h4>
      {action}
    </div>
  )
}
