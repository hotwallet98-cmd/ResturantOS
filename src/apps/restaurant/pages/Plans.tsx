import { Check, Crown, Minus } from 'lucide-react'
import { Badge, Button, Card, PageHeader, useToast } from '@/shared/components/ui'
import { TierBadge } from '@/shared/components/plan/Gate'
import { useAuth } from '@/shared/context/AuthContext'
import { cn } from '@/shared/lib/cn'
import { formatNumber } from '@/shared/lib/format'
import type { Tier } from '@/shared/services/plans'
import { features, hasTier, tierInfo, TIERS } from '@/shared/services/plans'

const blurb: Record<Tier, string> = {
  Free: 'Everything in the dine-in and delivery workflows: waiter app, main counter, kitchen with voice agent, rider app and customer ordering app.',
  Pro: 'Adds back office: inventory with recipe auto-deduction and stock alerts, smart stock entry, suppliers, loyalty, online menu, HR and reports.',
  Enterprise: 'Adds AI & automation, AI Copilot, finance, compliance and multi-branch for chains.',
}

export default function Plans() {
  const notify = useToast()
  const { plan, setDemoPlan } = useAuth()
  const rows = Object.values(features)

  return (
    <div className="space-y-6">
      <PageHeader icon={Crown} title="Plans & Upgrade" description={<>You are on the <TierBadge tier={plan} /> plan.</>} />

      <div className="grid gap-4 lg:grid-cols-3">
        {TIERS.map((t) => {
          const info = tierInfo[t]
          const current = t === plan
          return (
            <Card key={t} className={cn('relative', current && 'ring-2 ring-brand-500', t === 'Pro' && !current && 'ring-1 ring-violet-200')} bodyClassName="p-6 flex h-full flex-col">
              <div className="flex items-center justify-between">
                <p className="text-lg font-semibold text-slate-900">{t}</p>
                {current ? <Badge tone="orange">Current plan</Badge> : t === 'Pro' ? <Badge tone="purple">Most popular</Badge> : null}
              </div>
              <p className="mt-1 text-sm text-slate-500">{info.tagline}</p>
              <p className="mt-4 text-slate-900">
                <span className="text-3xl font-semibold">{info.monthly === 0 ? 'Free' : `$${info.monthly}`}</span>
                {info.monthly > 0 && <span className="text-sm text-slate-500"> / month</span>}
              </p>
              <p className="mt-3 flex-1 text-sm text-slate-600">{blurb[t]}</p>
              <ul className="mt-4 space-y-1 text-sm text-slate-600">
                <li>{info.maxBranches >= 999 ? 'Unlimited branches' : `${info.maxBranches} branch${info.maxBranches > 1 ? 'es' : ''}`}</li>
                <li>{info.maxUsers >= 9999 ? 'Unlimited staff logins' : `${info.maxUsers} staff logins`}</li>
                <li>{formatNumber(info.voiceMinutes)} voice agent minutes / month</li>
              </ul>
              <Button
                className="mt-5"
                block
                variant={current ? 'outline' : t === 'Pro' ? 'ai' : 'secondary'}
                disabled={current}
                onClick={() => {
                  setDemoPlan(t)
                  notify(`Switched to ${t} (demo). Billing goes live with the payments integration.`)
                }}
              >
                {current ? 'Your plan' : hasTier(t, plan) ? `Upgrade to ${t}` : `Switch to ${t}`}
              </Button>
            </Card>
          )
        })}
      </div>

      <Card title="Compare features" flush>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left">
                <th className="px-5 py-3 font-semibold text-slate-700">Feature</th>
                {TIERS.map((t) => (
                  <th key={t} className={cn('w-28 px-4 py-3 text-center font-semibold', t === plan ? 'text-brand-700' : 'text-slate-700')}>
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map((f) => (
                <tr key={f.label}>
                  <td className="px-5 py-2.5">
                    <p className="font-medium text-slate-800">{f.label}</p>
                    <p className="text-xs text-slate-500">{f.description}</p>
                  </td>
                  {TIERS.map((t) => (
                    <td key={t} className={cn('px-4 py-2.5 text-center', t === plan && 'bg-brand-50/40')}>
                      {hasTier(t, f.tier) ? <Check size={16} className="mx-auto text-emerald-500" /> : <Minus size={16} className="mx-auto text-slate-300" />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
