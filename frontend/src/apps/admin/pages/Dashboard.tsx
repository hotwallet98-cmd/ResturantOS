import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  Building2,
  CheckCircle2,
  CreditCard,
  DollarSign,
  Download,
  GitBranch,
  Hourglass,
  LayoutDashboard,
  PauseCircle,
  Plus,
  XCircle,
} from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AIInsights, Badge, Button, Card, LoadingState, PageHeader, ProgressBar, StatCard, StatusBadge, useToast } from '@/shared/components/ui'
import type { Tone } from '@/shared/components/ui'
import { useAsync } from '@/shared/hooks/useAsync'
import { chartAxis, chartColors, chartGrid, chartTooltip } from '@/shared/lib/chart'
import { cn } from '@/shared/lib/cn'
import { formatCurrency, formatNumber, timeAgo } from '@/shared/lib/format'
import { getDashboard, getOnboardingApplications, getSubscriptions, getTenants, onboardingStages } from '@/shared/services/admin'
import type { PlatformAlert } from '@/shared/services/admin'

const severityTone: Record<PlatformAlert['severity'], Tone> = { Critical: 'red', High: 'orange', Medium: 'yellow', Low: 'gray' }

export default function AdminDashboard() {
  const navigate = useNavigate()
  const notify = useToast()
  const { data: dash, setData: setDash, loading } = useAsync(getDashboard)
  const { data: tenants = [] } = useAsync(getTenants)
  const { data: subs = [] } = useAsync(getSubscriptions)
  const { data: apps = [] } = useAsync(getOnboardingApplications)

  const kpi = useMemo(() => {
    const count = (s: string) => tenants.filter((t) => t.status === s).length
    return {
      restaurants: tenants.length,
      branches: tenants.reduce((a, t) => a + t.branches, 0),
      active: count('Active'),
      pending: count('Pending'),
      suspended: count('Suspended'),
      trial: count('Trial'),
      subs: subs.filter((s) => s.status === 'Active' || s.status === 'Trial').length,
      mrr: tenants.reduce((a, t) => a + t.mrr, 0),
    }
  }, [tenants, subs])

  if (loading || !dash) return <LoadingState label="Loading platform overview…" />

  const statusBreakdown = [
    { label: 'Active', value: kpi.active, icon: CheckCircle2, cls: 'text-emerald-600 bg-emerald-50' },
    { label: 'Trial', value: kpi.trial, icon: Hourglass, cls: 'text-sky-600 bg-sky-50' },
    { label: 'Pending', value: kpi.pending, icon: Hourglass, cls: 'text-amber-600 bg-amber-50' },
    { label: 'Suspended', value: kpi.suspended, icon: PauseCircle, cls: 'text-red-600 bg-red-50' },
    { label: 'Inactive', value: tenants.filter((t) => t.status === 'Inactive').length, icon: XCircle, cls: 'text-slate-500 bg-slate-100' },
  ]

  const ack = (id: string) => {
    setDash({ ...dash, alerts: dash.alerts.filter((a) => a.id !== id) })
    notify('Alert acknowledged')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={LayoutDashboard}
        title="Super Admin Dashboard"
        description="Platform-wide health of every restaurant, subscription and service on RestaurantOS."
        actions={
          <>
            <Button variant="outline" icon={Download} onClick={() => notify('Platform report exported', 'info')}>
              Export
            </Button>
            <Button icon={Plus} onClick={() => navigate('/admin/onboarding')}>
              Onboard restaurant
            </Button>
          </>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total restaurants" value={kpi.restaurants} icon={Building2} tone="brand" delta={11.8} deltaLabel="vs last month" />
        <StatCard label="Total branches" value={kpi.branches} icon={GitBranch} tone="blue" delta={8.2} deltaLabel="vs last month" />
        <StatCard label="Active subscriptions" value={kpi.subs} icon={CreditCard} tone="purple" hint={`${kpi.trial} on free trial`} />
        <StatCard label="Monthly recurring revenue" value={formatCurrency(kpi.mrr)} icon={DollarSign} tone="green" delta={6.4} deltaLabel="MoM" hint={`ARR ${formatCurrency(kpi.mrr * 12, { compact: true })}`} />
      </div>

      {/* Restaurant status */}
      <Card title="Active / Pending / Suspended restaurants" subtitle="Lifecycle status across all tenants" actions={<Link to="/admin/tenants" className="text-sm font-medium text-brand-600 hover:text-brand-700">Manage restaurants →</Link>}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {statusBreakdown.map(({ label, value, icon: Icon, cls }) => (
            <div key={label} className="flex items-center gap-3 rounded-lg border border-slate-100 p-3">
              <span className={cn('flex h-10 w-10 items-center justify-center rounded-lg', cls)}>
                <Icon size={18} />
              </span>
              <div>
                <p className="text-xl font-semibold text-slate-900">{value}</p>
                <p className="text-xs text-slate-500">{label}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-slate-100">
          {[
            ['bg-emerald-500', kpi.active],
            ['bg-sky-500', kpi.trial],
            ['bg-amber-500', kpi.pending],
            ['bg-red-500', kpi.suspended],
          ].map(([cls, v]) => (
            <div key={cls as string} className={cls as string} style={{ width: `${((v as number) / Math.max(1, kpi.restaurants)) * 100}%` }} />
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Revenue */}
        <Card className="xl:col-span-2" title="Subscriptions & revenue" subtitle="MRR, new and churned MRR over the last 12 months">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dash.revenueTrend} margin={{ left: -10, right: 8 }}>
                <defs>
                  <linearGradient id="mrrFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartColors[0]} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={chartColors[0]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...chartGrid} vertical={false} />
                <XAxis dataKey="m" {...chartAxis} />
                <YAxis {...chartAxis} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip {...chartTooltip} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="mrr" name="MRR" stroke={chartColors[0]} strokeWidth={2} fill="url(#mrrFill)" />
                <Area type="monotone" dataKey="newMrr" name="New MRR" stroke={chartColors[2]} strokeWidth={2} fill="transparent" />
                <Area type="monotone" dataKey="churned" name="Churned MRR" stroke={chartColors[5]} strokeWidth={2} fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Plan mix */}
        <Card title="Subscriptions by plan" subtitle={`${kpi.subs} active / trial subscriptions`}>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={dash.planMix} dataKey="value" nameKey="name" innerRadius={50} outerRadius={78} paddingAngle={3}>
                  {dash.planMix.map((p, i) => (
                    <Cell key={p.name} fill={chartColors[i]} />
                  ))}
                </Pie>
                <Tooltip {...chartTooltip} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 space-y-2">
            {dash.planMix.map((p, i) => (
              <li key={p.name} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: chartColors[i] }} />
                  {p.name}
                </span>
                <span className="font-medium text-slate-800">{p.value} restaurants</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Onboarding status */}
        <Card title="Restaurant onboarding status" subtitle="Applications in the pipeline" actions={<Button size="sm" variant="ghost" iconRight={ArrowRight} onClick={() => navigate('/admin/onboarding')}>Pipeline</Button>}>
          <div className="space-y-3">
            {onboardingStages.map((stage) => {
              const n = apps.filter((a) => a.stage === stage).length
              return (
                <div key={stage}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-slate-600">{stage}</span>
                    <span className="font-medium text-slate-900">{n}</span>
                  </div>
                  <ProgressBar value={n} max={Math.max(1, apps.length)} tone={stage === 'Live' ? 'green' : stage === 'Verification' ? 'yellow' : 'brand'} />
                </div>
              )
            })}
          </div>
          <div className="mt-5 border-t border-slate-100 pt-4">
            <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Conversion funnel (90 days)</p>
            <div className="flex items-end gap-2">
              {dash.onboardingFunnel.map((f, i) => (
                <div key={f.stage} className="flex-1 text-center">
                  <div className="mx-auto rounded-t-md bg-brand-500" style={{ height: `${(f.count / dash.onboardingFunnel[0]!.count) * 64}px`, opacity: 1 - i * 0.14 }} />
                  <p className="mt-1 text-sm font-semibold text-slate-800">{f.count}</p>
                  <p className="truncate text-[10px] text-slate-500">{f.stage}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Usage & performance */}
        <Card className="xl:col-span-2" title="Platform usage & performance" subtitle="Orders processed and active users — last 7 days">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dash.usage} margin={{ left: -10, right: 8 }}>
                <CartesianGrid {...chartGrid} vertical={false} />
                <XAxis dataKey="d" {...chartAxis} />
                <YAxis {...chartAxis} tickFormatter={(v: number) => formatNumber(v, true)} />
                <Tooltip {...chartTooltip} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="orders" name="Orders" fill={chartColors[0]} radius={[4, 4, 0, 0]} />
                <Bar dataKey="activeUsers" name="Active users" fill={chartColors[1]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {dash.performance.map((p) => (
              <div key={p.label} className="rounded-lg border border-slate-100 p-3">
                <p className="text-xs text-slate-500">{p.label}</p>
                <p className={cn('mt-0.5 text-lg font-semibold', p.ok ? 'text-slate-900' : 'text-amber-600')}>{p.value}</p>
                <p className="text-[11px] text-slate-400">Target {p.target}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Alerts */}
        <Card
          title={
            <span className="flex items-center gap-2">
              <Bell size={16} className="text-brand-600" /> Critical alerts & notifications
            </span>
          }
          subtitle={`${dash.alerts.length} unacknowledged`}
          actions={<Button size="sm" variant="ghost" iconRight={ArrowRight} onClick={() => navigate('/admin/support')}>Monitoring</Button>}
          flush
        >
          {dash.alerts.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-sm text-slate-500">
              <CheckCircle2 className="text-emerald-500" /> All clear — no open alerts.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {dash.alerts.map((a) => (
                <li key={a.id} className="flex gap-3 px-5 py-3.5">
                  <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', a.severity === 'Critical' ? 'bg-red-50 text-red-600' : a.severity === 'High' ? 'bg-brand-50 text-brand-600' : 'bg-amber-50 text-amber-600')}>
                    {a.severity === 'Low' ? <Activity size={16} /> : <AlertTriangle size={16} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-slate-800">{a.title}</p>
                      <Badge tone={severityTone[a.severity]}>{a.severity}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">{a.detail}</p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      {a.source} · {timeAgo(a.at)}
                    </p>
                  </div>
                  <Button size="xs" variant="outline" onClick={() => ack(a.id)}>
                    Acknowledge
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <AIInsights
          title="Platform Insights"
          subtitle="Calculated from the current tenant, subscription and onboarding records"
          onAction={(i) => notify(`${i.action}: queued`, 'info')}
          insights={[
            { title: `${tenants.length} restaurant${tenants.length === 1 ? '' : 's'} in PostgreSQL`, detail: `${kpi.active} active, ${kpi.pending} pending and ${kpi.suspended} suspended.`, severity: 'info' as const, metric: formatCurrency(kpi.mrr) },
            ...(tenants.filter((t) => t.riskScore >= 60).map((t) => ({ title: `${t.name} needs attention`, detail: `Current persisted risk score is ${t.riskScore}; health score is ${t.healthScore}.`, severity: 'warning' as const, metric: `Risk ${t.riskScore}`, action: 'Review tenant' }))),
            { title: `${apps.length} onboarding application${apps.length === 1 ? '' : 's'}`, detail: apps.length ? 'Applications are shown by their current persisted workflow stage.' : 'No onboarding applications have been submitted yet.', severity: apps.length ? 'opportunity' as const : 'success' as const },
          ]}
        />
      </div>

      {/* Recently active */}
      <Card title="Top restaurants this month" subtitle="By order volume" flush>
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                <th className="px-4 py-2.5">Restaurant</th>
                <th className="px-4 py-2.5">City</th>
                <th className="px-4 py-2.5">Plan</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Orders</th>
                <th className="px-4 py-2.5 text-right">MRR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...tenants]
                .sort((a, b) => b.ordersMonth - a.ordersMonth)
                .slice(0, 6)
                .map((t) => (
                  <tr key={t.id} className="cursor-pointer hover:bg-slate-50/80" onClick={() => navigate('/admin/tenants')}>
                    <td className="px-4 py-3 font-medium whitespace-nowrap text-slate-800">{t.name}</td>
                    <td className="px-4 py-3 text-slate-600">{t.city}</td>
                    <td className="px-4 py-3">
                      <Badge tone="purple">{t.plan}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">{formatNumber(t.ordersMonth)}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-800">{formatCurrency(t.mrr)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
