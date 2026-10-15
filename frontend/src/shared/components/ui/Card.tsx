import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  /** Remove body padding (e.g. for tables that should touch the edges). */
  flush?: boolean
  bodyClassName?: string
}

export function Card({ title, subtitle, actions, flush, className, bodyClassName, children, ...rest }: CardProps) {
  return (
    <div className={cn('rounded-xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/[0.03]', className)} {...rest}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            {title && <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn(!flush && 'p-5', bodyClassName)}>{children}</div>
    </div>
  )
}
