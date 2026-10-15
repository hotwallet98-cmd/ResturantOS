import type { LucideIcon } from 'lucide-react'
import { cn } from '@/shared/lib/cn'

export interface TabItem<T extends string = string> {
  id: T
  label: string
  icon?: LucideIcon
  count?: number
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  variant = 'underline',
  className,
}: {
  items: TabItem<T>[]
  value: T
  onChange: (id: T) => void
  variant?: 'underline' | 'pills'
  className?: string
}) {
  return (
    <div
      role="tablist"
      className={cn(
        'scrollbar-thin flex gap-1 overflow-x-auto',
        variant === 'underline' ? 'border-b border-slate-200' : 'w-fit max-w-full rounded-xl bg-slate-100 p-1',
        className,
      )}
    >
      {items.map(({ id, label, icon: Icon, count }) => {
        const active = id === value
        return (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(id)}
            className={cn(
              'inline-flex shrink-0 items-center gap-2 text-sm font-medium whitespace-nowrap transition-colors',
              variant === 'underline'
                ? cn('-mb-px border-b-2 px-3 py-2.5', active ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800')
                : cn('rounded-lg px-3 py-1.5', active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'),
            )}
          >
            {Icon && <Icon size={16} />}
            {label}
            {count !== undefined && (
              <span className={cn('rounded-full px-1.5 py-px text-[11px] font-semibold', active ? 'bg-brand-100 text-brand-700' : 'bg-slate-200/70 text-slate-500')}>
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
