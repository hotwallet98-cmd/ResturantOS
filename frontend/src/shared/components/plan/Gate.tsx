import { Check, Crown, Lock, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card } from '@/shared/components/ui'
import { useAuth } from '@/shared/context/AuthContext'
import { cn } from '@/shared/lib/cn'
import type { Feature, Tier } from '@/shared/services/plans'
import { features, tierInfo } from '@/shared/services/plans'

const tierStyle: Record<Tier, string> = {
  Free: 'bg-slate-100 text-slate-600',
  Pro: 'bg-violet-100 text-violet-700',
  Enterprise: 'bg-amber-100 text-amber-800',
}

export function TierBadge({ tier, className }: { tier: Tier; className?: string }) {
  return <span className={cn('rounded px-1.5 py-px text-[10px] font-bold tracking-wide uppercase', tierStyle[tier], className)}>{tier === 'Enterprise' ? 'Ent' : tier}</span>
}

/** Shown in place of a page the restaurant's plan doesn't include. */
export function UpgradeScreen({ feature }: { feature: Feature }) {
  const navigate = useNavigate()
  const { plan, user } = useAuth()
  const isAdmin = user?.role === 'restaurant_admin'
  const info = features[feature]
  const tier = tierInfo[info.tier]
  const unlocks = Object.values(features).filter((f) => f.tier === info.tier)
  return (
    <div className="mx-auto max-w-2xl py-10">
      <Card bodyClassName="p-8">
        <div className="flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/30">
            <Lock size={24} />
          </span>
          <p className="mt-4 flex items-center gap-2 text-sm text-slate-500">
            Available on <TierBadge tier={info.tier} /> · you are on <TierBadge tier={plan} />
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{info.label}</h1>
          <p className="mt-1 max-w-md text-slate-500">{info.description}</p>
        </div>

        <div className="mt-8 rounded-xl border border-slate-200 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="flex items-center gap-2 font-semibold text-slate-900">
              <Crown size={16} className="text-violet-600" /> {info.tier} plan
            </p>
            <p className="text-slate-900">
              <span className="text-2xl font-semibold">${tier.monthly}</span>
              <span className="text-sm text-slate-500"> / month</span>
            </p>
          </div>
          <p className="text-sm text-slate-500">{tier.tagline}</p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {unlocks.map((f) => (
              <li key={f.label} className="flex items-start gap-2 text-sm text-slate-700">
                <Check size={15} className="mt-0.5 shrink-0 text-emerald-500" />
                {f.label}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {isAdmin ? (
            <Button variant="ai" icon={Sparkles} onClick={() => navigate('/app/plans')}>
              Compare plans & upgrade
            </Button>
          ) : (
            <p className="w-full text-center text-sm text-slate-500">Ask your restaurant admin to upgrade to {info.tier}.</p>
          )}
          <Button variant="ghost" onClick={() => navigate(-1)}>
            Go back
          </Button>
        </div>
      </Card>
    </div>
  )
}

/** Renders children only when the plan includes `feature`. */
export function Gate({ feature, children }: { feature: Feature; children: ReactNode }) {
  const { can } = useAuth()
  return can(feature) ? children : <UpgradeScreen feature={feature} />
}
