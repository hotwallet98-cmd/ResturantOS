import { AIInsights, LoadingState, useToast } from '@/shared/components/ui'
import type { AIInsight } from '@/shared/components/ui'
import { useAsync } from '@/shared/hooks/useAsync'
import type { AIModule } from '@/shared/services/operations'
import { getAIInsights } from '@/shared/services/operations'

/** Loads the Central AI engine's insights for a module and renders them. */
export function AIPanel({
  module,
  title,
  subtitle = 'Central AI engine · updated just now',
  className,
  onAction,
}: {
  module: AIModule
  title: string
  subtitle?: string
  className?: string
  onAction?: (insight: AIInsight) => void
}) {
  const notify = useToast()
  const { data, loading } = useAsync(() => getAIInsights(module), [module])
  if (loading || !data)
    return (
      <div className="rounded-xl border border-violet-200/70 bg-white">
        <LoadingState label="Asking the AI engine…" />
      </div>
    )
  return (
    <AIInsights
      title={title}
      subtitle={subtitle}
      insights={data}
      className={className}
      onAction={(ins) => (onAction ? onAction(ins) : notify(`${ins.action}: queued by AI engine`, 'info'))}
    />
  )
}
