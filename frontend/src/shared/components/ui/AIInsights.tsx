import { AlertTriangle, CheckCircle2, Info, Lightbulb, Sparkles, TrendingUp } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

export type InsightSeverity = 'info' | 'opportunity' | 'warning' | 'critical' | 'success'

export interface AIInsight {
  title: string
  detail?: string
  severity?: InsightSeverity
  /** Short figure to highlight, e.g. "+18%" or "92% confidence" */
  metric?: string
  /** Label of the suggested action button */
  action?: string
}

const severityStyle: Record<InsightSeverity, { icon: typeof Info; cls: string }> = {
  info: { icon: Info, cls: 'bg-sky-50 text-sky-600' },
  opportunity: { icon: TrendingUp, cls: 'bg-violet-50 text-violet-600' },
  warning: { icon: AlertTriangle, cls: 'bg-amber-50 text-amber-600' },
  critical: { icon: AlertTriangle, cls: 'bg-red-50 text-red-600' },
  success: { icon: CheckCircle2, cls: 'bg-emerald-50 text-emerald-600' },
}

/**
 * Panel for the AI capability attached to each module in the mind map
 * (forecasting, recommendations, anomaly detection, …).
 */
export function AIInsights({
  title = 'AI Insights',
  subtitle,
  insights,
  onAction,
  footer,
  className,
}: {
  title?: string
  subtitle?: string
  insights: AIInsight[]
  onAction?: (insight: AIInsight) => void
  footer?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('relative overflow-hidden rounded-xl border border-violet-200/70 bg-white shadow-sm', className)}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-violet-50 to-transparent" />
      <div className="relative flex items-center gap-3 px-5 pt-4 pb-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-sm shadow-violet-600/30">
          <Sparkles size={18} />
        </span>
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>
      <ul className="relative divide-y divide-slate-100 px-5">
        {insights.map((ins, i) => {
          const s = severityStyle[ins.severity ?? 'info']
          const Icon = ins.severity ? s.icon : Lightbulb
          return (
            <li key={i} className="flex gap-3 py-3">
              <span className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md', s.cls)}>
                <Icon size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <p className="text-sm font-medium text-slate-800">{ins.title}</p>
                  {ins.metric && <span className="text-xs font-semibold text-violet-600">{ins.metric}</span>}
                </div>
                {ins.detail && <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{ins.detail}</p>}
                {ins.action && (
                  <button
                    type="button"
                    onClick={() => onAction?.(ins)}
                    className="mt-1.5 text-xs font-semibold text-violet-600 hover:text-violet-800"
                  >
                    {ins.action} →
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      {footer && <div className="relative border-t border-slate-100 px-5 py-3">{footer}</div>}
    </div>
  )
}
