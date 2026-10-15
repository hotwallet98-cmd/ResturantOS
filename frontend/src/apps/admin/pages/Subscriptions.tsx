import {
  ArrowDownRight,
  ArrowUpRight,
  BellRing,
  Boxes,
  CalendarClock,
  Check,
  CreditCard,
  DollarSign,
  Download,
  Hourglass,
  Pencil,
  Plus,
  Receipt,
  RefreshCw,
  Repeat,
  Sparkles,
  TrendingDown,
  Wallet,
} from 'lucide-react'
import { useState } from 'react'
import { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  AIInsights,
  Badge,
  Button,
  Card,
  Checkbox,
  DataTable,
  Field,
  Input,
  LoadingState,
  Modal,
  PageHeader,
  ProgressBar,
  Select,
  StatCard,
  StatusBadge,
  Tabs,
  Textarea,
  Toggle,
  useToast,
} from '@/shared/components/ui'
import { useAsync } from '@/shared/hooks/useAsync'
import { chartAxis, chartColors, chartGrid, chartTooltip } from '@/shared/lib/chart'
import { cn } from '@/shared/lib/cn'
import { formatCurrency, formatDate } from '@/shared/lib/format'
import {
  createPlan,
  createPlanChange,
  getBillingData,
  getInvoices,
  getModulePrices,
  getPlanChanges,
  getPlans,
  getRenewalRules,
  getSubscriptions,
  moduleCatalog,
  planNames,
  savePlan,
  updateInvoice,
  updateModulePrice,
  updateRenewalRule,
  updateSubscription,
} from '@/shared/services/admin'
import type { Plan, PlanChange, PlanName, Subscription } from '@/shared/services/admin'

type TabId = 'plans' | 'modules' | 'subscriptions' | 'changes' | 'invoices' | 'notifications' | 'forecast'

const blankPlan = (): Plan => ({
  id: '',
  name: '',
  description: '',
  monthly: 199,
  yearly: 1990,
  trialDays: 14,
  maxBranches: 3,
  maxUsers: 25,
  aiCredits: 1500,
  modules: moduleCatalog.slice(0, 6),
  tenants: 0,
  active: true,
})

export default function Subscriptions() {
  const notify = useToast()
  const [tab, setTab] = useState<TabId>('plans')
  const { data: planList = [], setData: setPlans, loading: plansLoading } = useAsync(getPlans)
  const { data: modules = [], setData: setModules, loading: modulesLoading } = useAsync(getModulePrices)
  const { data: subs = [], setData: setSubs, loading: subsLoading } = useAsync(getSubscriptions)
  const { data: changes = [], setData: setChanges } = useAsync(getPlanChanges)
  const { data: invoices = [], setData: setInvoices, loading: invLoading } = useAsync(getInvoices)
  const { data: rules = [], setData: setRules } = useAsync(getRenewalRules)
  const { data: billing } = useAsync(getBillingData)

  const [editing, setEditing] = useState<Plan | null>(null)
  const [changeFor, setChangeFor] = useState<Subscription | null>(null)
  const [changeTo, setChangeTo] = useState<PlanName>('Pro')
  const [changeWhen, setChangeWhen] = useState('Immediately (prorated)')
  const [subFilter, setSubFilter] = useState('')
  const [invFilter, setInvFilter] = useState('')

  const mrr = subs.filter((s) => s.status === 'Active').reduce((a, s) => a + (s.cycle === 'Yearly' ? s.amount / 12 : s.amount) + s.addOns, 0)
  const trials = subs.filter((s) => s.status === 'Trial')
  const renewingSoon = subs.filter((s) => new Date(s.renewsAt).getTime() - Date.now() < 7 * 86_400_000 && s.status !== 'Cancelled')
  const outstanding = invoices.filter((i) => i.status === 'Overdue' || i.status === 'Failed' || i.status === 'Pending').reduce((a, i) => a + i.amount + i.tax, 0)

  const savePlanForm = async () => {
    if (!editing || !editing.name) return
    if (editing.id) {
      setPlans((p) => p?.map((x) => (x.id === editing.id ? editing : x)))
      await savePlan(editing)
      notify(`Plan "${editing.name}" updated`)
    } else {
      const plan = { ...editing, id: `P-${planList.length + 1}` }
      setPlans((p) => [...(p ?? []), plan])
      await createPlan(plan)
      notify(`Plan "${plan.name}" created`)
    }
    setEditing(null)
  }

  const applyChange = async () => {
    if (!changeFor) return
    const rank = (p: PlanName) => planNames.indexOf(p)
    const price = (p: PlanName) => planList.find((x) => x.name === p)?.monthly ?? 0
    const change: PlanChange = {
      id: `PC-${changes.length + 1}`,
      tenant: changeFor.tenant,
      from: changeFor.plan,
      to: changeTo,
      kind: rank(changeTo) > rank(changeFor.plan) ? 'Upgrade' : 'Downgrade',
      mrrDelta: price(changeTo) - price(changeFor.plan),
      reason: 'Changed by Super Admin',
      status: changeWhen.startsWith('Immediately') ? 'Completed' : 'Scheduled',
      at: new Date().toISOString(),
    }
    setChanges((c) => [change, ...(c ?? [])])
    if (change.status === 'Completed') {
      setSubs((s) => s?.map((x) => (x.id === changeFor.id ? { ...x, plan: changeTo, amount: x.cycle === 'Yearly' ? price(changeTo) * 10 : price(changeTo) } : x)))
      await updateSubscription(changeFor.id, { plan: changeTo })
    }
    await createPlanChange(change)
    notify(`${change.kind} ${changeFor.tenant}: ${change.from} → ${change.to} (${change.status.toLowerCase()})`)
    setChangeFor(null)
  }

  const patchSub = async (s: Subscription, p: Partial<Subscription>, msg: string) => {
    setSubs((list) => list?.map((x) => (x.id === s.id ? { ...x, ...p } : x)))
    await updateSubscription(s.id, p)
    notify(msg)
  }

  const tabs = [
    { id: 'plans' as const, label: 'Subscription plans', icon: CreditCard, count: planList.length },
    { id: 'modules' as const, label: 'Module pricing', icon: Boxes },
    { id: 'subscriptions' as const, label: 'Trials & renewals', icon: CalendarClock, count: subs.length },
    { id: 'changes' as const, label: 'Upgrades / downgrades', icon: Repeat },
    { id: 'invoices' as const, label: 'Invoices & payments', icon: Receipt },
    { id: 'notifications' as const, label: 'Renewal notifications', icon: BellRing },
    { id: 'forecast' as const, label: 'AI churn & forecast', icon: Sparkles },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        icon={CreditCard}
        title="Subscription & Billing"
        description="Plans, module pricing, trials, renewals, invoices and revenue forecasting."
        actions={
          <>
            <Button variant="outline" icon={Download} onClick={() => notify('Billing export started', 'info')}>
              Export
            </Button>
            <Button icon={Plus} onClick={() => setEditing(blankPlan())}>
              Create plan
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="MRR" value={formatCurrency(mrr)} icon={DollarSign} tone="green" delta={6.4} deltaLabel="MoM" />
        <StatCard label="Active subscriptions" value={subs.filter((s) => s.status === 'Active').length} icon={CreditCard} tone="brand" hint={`${renewingSoon.length} renew in 7 days`} />
        <StatCard label="Free trials" value={trials.length} icon={Hourglass} tone="blue" hint="38% trial → paid" />
        <StatCard label="Outstanding" value={formatCurrency(outstanding)} icon={Wallet} tone="red" hint={`${invoices.filter((i) => i.status === 'Overdue').length} overdue invoices`} />
      </div>

      <Tabs items={tabs} value={tab} onChange={setTab} />

      {tab === 'plans' &&
        (plansLoading ? (
          <LoadingState />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {planList.map((p) => (
              <div key={p.id} className={cn('relative flex flex-col rounded-xl border bg-white p-5 shadow-sm', p.popular ? 'border-brand-300 ring-2 ring-brand-500/15' : 'border-slate-200')}>
                {p.popular && <Badge tone="orange" className="absolute top-4 right-4">Most popular</Badge>}
                <p className="text-lg font-semibold text-slate-900">{p.name}</p>
                <p className="mt-1 min-h-10 text-sm text-slate-500">{p.description}</p>
                <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
                  {formatCurrency(p.monthly)}
                  <span className="text-sm font-normal text-slate-500">/mo</span>
                </p>
                <p className="text-xs text-slate-500">{formatCurrency(p.yearly)} billed yearly · {p.trialDays}-day trial</p>
                <ul className="mt-4 flex-1 space-y-1.5 text-sm text-slate-600">
                  <li className="flex gap-2"><Check size={15} className="mt-0.5 text-emerald-500" /> {p.maxBranches > 100 ? 'Unlimited' : `Up to ${p.maxBranches}`} branches</li>
                  <li className="flex gap-2"><Check size={15} className="mt-0.5 text-emerald-500" /> {p.maxUsers > 1000 ? 'Unlimited' : p.maxUsers} staff users</li>
                  <li className="flex gap-2"><Check size={15} className="mt-0.5 text-emerald-500" /> {p.aiCredits.toLocaleString()} AI credits / mo</li>
                  <li className="flex gap-2"><Check size={15} className="mt-0.5 text-emerald-500" /> {p.modules.length} modules included</li>
                </ul>
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                  <span className="text-xs text-slate-500">{p.tenants} restaurants</span>
                  <Button size="xs" variant="outline" icon={Pencil} onClick={() => setEditing(p)}>
                    Edit
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ))}

      {tab === 'modules' && (
        <Card flush title="Module-based pricing" subtitle="Add-on price when a module isn't included in the tenant's plan">
          <DataTable
            data={modules}
            loading={modulesLoading}
            rowKey={(m) => m.id}
            searchKeys={['name', 'category']}
            pageSize={15}
            columns={[
              { key: 'name', header: 'Module', sortable: true, render: (m) => <span className="font-medium text-slate-800">{m.name}</span> },
              { key: 'category', header: 'Category', render: (m) => <Badge tone={m.category === 'AI' ? 'purple' : 'gray'}>{m.category}</Badge> },
              { key: 'includedIn', header: 'Included from', render: (m) => <Badge tone="blue">{m.includedIn}</Badge> },
              {
                key: 'price',
                header: 'Add-on price',
                sortable: true,
                render: (m) => (
                  <div className="flex items-center gap-1">
                    <span className="text-slate-400">$</span>
                    <input
                      type="number"
                      className="h-8 w-20 rounded-md border border-slate-200 px-2 text-sm focus:border-brand-400 focus:outline-none"
                      value={m.price}
                      onChange={(e) => setModules((list) => list?.map((x) => (x.id === m.id ? { ...x, price: Number(e.target.value) } : x)))}
                      onBlur={() => updateModulePrice(m.id, { price: m.price }).then(() => notify(`${m.name} price saved`))}
                    />
                    <span className="text-xs whitespace-nowrap text-slate-500">/{m.perBranch ? 'branch' : 'tenant'}/mo</span>
                  </div>
                ),
              },
              { key: 'tenants', header: 'Restaurants', sortable: true, align: 'center' },
              {
                key: 'enabled',
                header: 'Available',
                render: (m) => (
                  <Toggle
                    checked={m.enabled}
                    onChange={(v) => {
                      setModules((list) => list?.map((x) => (x.id === m.id ? { ...x, enabled: v } : x)))
                      updateModulePrice(m.id, { enabled: v })
                      notify(`${m.name} ${v ? 'available for sale' : 'hidden from catalogue'}`)
                    }}
                  />
                ),
              },
            ]}
          />
        </Card>
      )}

      {tab === 'subscriptions' && (
        <Card flush>
          <DataTable
            data={subs.filter((s) => !subFilter || s.status === subFilter)}
            loading={subsLoading}
            rowKey={(s) => s.id}
            searchKeys={['tenant', 'plan', 'id']}
            toolbar={<Select className="h-9 w-40" placeholder="All statuses" options={['Active', 'Trial', 'Overdue', 'Suspended', 'Cancelled']} value={subFilter} onChange={(e) => setSubFilter(e.target.value)} />}
            columns={[
              { key: 'tenant', header: 'Restaurant', sortable: true, render: (s) => <div><p className="font-medium whitespace-nowrap text-slate-800">{s.tenant}</p><p className="text-xs text-slate-500">{s.id}</p></div> },
              { key: 'plan', header: 'Plan', sortable: true, render: (s) => <Badge tone="purple">{s.plan}</Badge> },
              { key: 'status', header: 'Status', render: (s) => <StatusBadge status={s.status} /> },
              { key: 'amount', header: 'Amount', align: 'right', sortable: true, render: (s) => <span className="whitespace-nowrap">{formatCurrency(s.amount)}<span className="text-xs text-slate-400">/{s.cycle === 'Yearly' ? 'yr' : 'mo'}</span></span> },
              {
                key: 'renewsAt',
                header: 'Renews / trial ends',
                sortable: true,
                render: (s) => (
                  <span className="whitespace-nowrap">
                    {s.trialEndsAt ? <Badge tone="blue">Trial ends {formatDate(s.trialEndsAt)}</Badge> : s.status === 'Cancelled' ? '—' : formatDate(s.renewsAt)}
                  </span>
                ),
              },
              { key: 'autoRenew', header: 'Auto-renew', render: (s) => <Toggle checked={s.autoRenew} disabled={s.status === 'Cancelled'} onChange={(v) => patchSub(s, { autoRenew: v }, `Auto-renew ${v ? 'enabled' : 'disabled'} for ${s.tenant}`)} /> },
              {
                key: 'act',
                header: '',
                align: 'right',
                render: (s) => (
                  <div className="flex justify-end gap-1">
                    {s.status === 'Trial' && (
                      <Button size="xs" variant="outline" onClick={() => patchSub(s, { trialEndsAt: new Date(new Date(s.trialEndsAt!).getTime() + 7 * 86_400_000).toISOString() }, `Trial extended 7 days for ${s.tenant}`)}>
                        Extend trial
                      </Button>
                    )}
                    {(s.status === 'Overdue' || s.status === 'Cancelled') && (
                      <Button size="xs" variant="outline" icon={RefreshCw} onClick={() => patchSub(s, { status: 'Active', autoRenew: true, renewsAt: new Date(Date.now() + 30 * 86_400_000).toISOString() }, `${s.tenant} renewed`)}>
                        Renew
                      </Button>
                    )}
                    <Button
                      size="xs"
                      variant="ghost"
                      icon={Repeat}
                      onClick={() => {
                        setChangeFor(s)
                        setChangeTo(s.plan === 'Enterprise' ? 'Pro' : planNames[planNames.indexOf(s.plan) + 1]!)
                      }}
                    >
                      Change plan
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        </Card>
      )}

      {tab === 'changes' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Upgrades (30d)" value={changes.filter((c) => c.kind === 'Upgrade').length} icon={ArrowUpRight} tone="green" />
            <StatCard label="Downgrades (30d)" value={changes.filter((c) => c.kind === 'Downgrade').length} icon={ArrowDownRight} tone="red" />
            <StatCard label="Net MRR from changes" value={formatCurrency(changes.reduce((a, c) => a + c.mrrDelta, 0))} icon={DollarSign} tone="brand" />
          </div>
          <Card flush>
            <DataTable
              data={changes}
              rowKey={(c) => c.id}
              searchKeys={['tenant']}
              columns={[
                { key: 'tenant', header: 'Restaurant', render: (c) => <span className="font-medium whitespace-nowrap text-slate-800">{c.tenant}</span> },
                { key: 'kind', header: 'Type', render: (c) => <Badge tone={c.kind === 'Upgrade' ? 'green' : 'red'} dot>{c.kind}</Badge> },
                { key: 'from', header: 'Change', render: (c) => <span className="whitespace-nowrap">{c.from} → <b>{c.to}</b></span> },
                { key: 'mrrDelta', header: 'MRR impact', align: 'right', sortable: true, render: (c) => <span className={c.mrrDelta >= 0 ? 'text-emerald-600' : 'text-red-600'}>{c.mrrDelta >= 0 ? '+' : ''}{formatCurrency(c.mrrDelta)}</span> },
                { key: 'reason', header: 'Reason', className: 'text-slate-500' },
                { key: 'status', header: 'Status', render: (c) => <StatusBadge status={c.status} /> },
                { key: 'at', header: 'Effective', sortable: true, render: (c) => <span className="whitespace-nowrap">{formatDate(c.at)}</span> },
                {
                  key: 'act',
                  header: '',
                  render: (c) =>
                    c.status === 'Pending' && (
                      <Button size="xs" variant="success" onClick={() => { setChanges((l) => l?.map((x) => (x.id === c.id ? { ...x, status: 'Completed' } : x))); notify(`${c.tenant} change approved`) }}>
                        Approve
                      </Button>
                    ),
                },
              ]}
            />
          </Card>
        </div>
      )}

      {tab === 'invoices' && (
        <Card flush>
          <DataTable
            data={invoices.filter((i) => !invFilter || i.status === invFilter)}
            loading={invLoading}
            rowKey={(i) => i.id}
            searchKeys={['id', 'tenant']}
            toolbar={
              <>
                <Select className="h-9 w-36" placeholder="All statuses" options={['Paid', 'Pending', 'Overdue', 'Failed', 'Refunded']} value={invFilter} onChange={(e) => setInvFilter(e.target.value)} />
              </>
            }
            columns={[
              { key: 'id', header: 'Invoice', render: (i) => <span className="font-mono text-xs whitespace-nowrap">{i.id}</span> },
              { key: 'tenant', header: 'Restaurant', sortable: true, render: (i) => <span className="whitespace-nowrap">{i.tenant}</span> },
              { key: 'amount', header: 'Amount', align: 'right', sortable: true, render: (i) => <span className="font-medium">{formatCurrency(i.amount + i.tax)}</span> },
              { key: 'method', header: 'Method' },
              { key: 'issuedAt', header: 'Issued', sortable: true, render: (i) => <span className="whitespace-nowrap">{formatDate(i.issuedAt)}</span> },
              { key: 'dueAt', header: 'Due', render: (i) => <span className="whitespace-nowrap">{formatDate(i.dueAt)}</span> },
              { key: 'status', header: 'Status', render: (i) => <StatusBadge status={i.status} /> },
              {
                key: 'act',
                header: '',
                align: 'right',
                render: (i) =>
                  i.status === 'Paid' || i.status === 'Refunded' ? (
                    <Button size="xs" variant="ghost" icon={Download} onClick={() => notify(`${i.id}.pdf downloaded`, 'info')}>PDF</Button>
                  ) : (
                    <div className="flex justify-end gap-1">
                      <Button size="xs" variant="outline" onClick={() => notify(`Payment reminder sent to ${i.tenant}`, 'info')}>Remind</Button>
                      <Button
                        size="xs"
                        variant="success"
                        onClick={async () => {
                          setInvoices((l) => l?.map((x) => (x.id === i.id ? { ...x, status: 'Paid', paidAt: new Date().toISOString() } : x)))
                          await updateInvoice(i.id, { status: 'Paid' })
                          notify(`${i.id} marked as paid`)
                        }}
                      >
                        Mark paid
                      </Button>
                    </div>
                  ),
              },
            ]}
          />
        </Card>
      )}

      {tab === 'notifications' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Card className="xl:col-span-2" title="Automated renewal notifications" subtitle="Reminder and dunning sequence for renewals, trials and failed payments" flush>
            <ul className="divide-y divide-slate-100">
              {rules.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800">{r.name}</p>
                    <p className="text-xs text-slate-500">{r.trigger}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {r.channels.map((c) => (
                        <Badge key={c} tone="blue">{c}</Badge>
                      ))}
                    </div>
                  </div>
                  <span className="text-xs text-slate-500">{r.sentThisMonth} sent this month</span>
                  <Toggle
                    checked={r.enabled}
                    onChange={async (v) => {
                      setRules((l) => l?.map((x) => (x.id === r.id ? { ...x, enabled: v } : x)))
                      await updateRenewalRule(r.id, { enabled: v })
                      notify(`"${r.name}" ${v ? 'enabled' : 'paused'}`)
                    }}
                  />
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Upcoming renewals" subtitle="Next 7 days">
            <ul className="space-y-3">
              {renewingSoon.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-800">{s.tenant}</p>
                    <p className="text-xs text-slate-500">{s.plan} · {formatDate(s.renewsAt)}</p>
                  </div>
                  <span className="font-medium">{formatCurrency(s.amount)}</span>
                </li>
              ))}
              {renewingSoon.length === 0 && <p className="text-sm text-slate-500">No renewals this week.</p>}
            </ul>
          </Card>
        </div>
      )}

      {tab === 'forecast' && billing && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Card className="xl:col-span-2" title="AI revenue forecast" subtitle="Actual MRR and 3-month forecast with 80% confidence band">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={billing.revenue} margin={{ left: -10, right: 8 }}>
                  <CartesianGrid {...chartGrid} vertical={false} />
                  <XAxis dataKey="m" {...chartAxis} />
                  <YAxis {...chartAxis} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip {...chartTooltip} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="high" name="Upper bound" stroke="none" fill={chartColors[6]} fillOpacity={0.12} />
                  <Area type="monotone" dataKey="low" name="Lower bound" stroke="none" fill="#ffffff" fillOpacity={1} />
                  <Line type="monotone" dataKey="actual" name="Actual MRR" stroke={chartColors[0]} strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="forecast" name="Forecast" stroke={chartColors[6]} strokeWidth={2.5} strokeDasharray="6 4" dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <AIInsights
            title="AI Churn & Revenue Forecasting"
            subtitle="Calculated from current subscription and billing records"
            onAction={(i) => notify(`${i.action} — queued`, 'info')}
            insights={[
              { title: `${subs.filter((s) => s.status === 'Active').length} active subscription${subs.filter((s) => s.status === 'Active').length === 1 ? '' : 's'}`, detail: `Current recurring value is ${formatCurrency(mrr)} from persisted subscriptions.`, severity: 'info' as const, metric: formatCurrency(mrr) },
              ...(billing.churnRisk.map((risk) => ({ title: `${risk.tenant}: churn risk`, detail: risk.reason, severity: risk.probability >= 70 ? 'critical' as const : 'warning' as const, metric: `${risk.probability}%`, action: 'Review account' }))),
              ...(!billing.churnRisk.length ? [{ title: 'No calculated churn risks', detail: 'A risk will appear when live billing or usage signals cross a configured threshold.', severity: 'success' as const }] : []),
            ]}
          />
          <Card className="xl:col-span-3" title="Churn risk by restaurant" subtitle="Probability of cancelling in the next 60 days" flush>
            <DataTable
              data={billing.churnRisk}
              rowKey={(c) => c.tenant}
              columns={[
                { key: 'tenant', header: 'Restaurant', render: (c) => <span className="font-medium whitespace-nowrap text-slate-800">{c.tenant}</span> },
                { key: 'probability', header: 'Churn probability', render: (c) => <ProgressBar className="w-40" value={c.probability} showLabel tone={c.probability > 60 ? 'red' : c.probability > 35 ? 'yellow' : 'green'} /> },
                { key: 'mrr', header: 'MRR at risk', align: 'right', render: (c) => formatCurrency(c.mrr) },
                { key: 'reason', header: 'Key drivers', className: 'text-slate-500' },
                { key: 'act', header: '', align: 'right', render: (c) => <Button size="xs" variant="ai" icon={TrendingDown} onClick={() => notify(`Retention playbook started for ${c.tenant}`)}>Retain</Button> },
              ]}
            />
          </Card>
        </div>
      )}

      {/* Plan editor */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        size="lg"
        title={editing?.id ? `Edit plan — ${editing.name}` : 'Create subscription plan'}
        description="Pricing, limits and included modules"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button disabled={!editing?.name} onClick={savePlanForm}>{editing?.id ? 'Save changes' : 'Create plan'}</Button>
          </>
        }
      >
        {editing && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Plan name" required>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="e.g. Franchise" />
              </Field>
              <Field label="Free trial (days)">
                <Input type="number" value={editing.trialDays} onChange={(e) => setEditing({ ...editing, trialDays: Number(e.target.value) })} />
              </Field>
              <Field label="Monthly price (USD)">
                <Input type="number" value={editing.monthly} onChange={(e) => setEditing({ ...editing, monthly: Number(e.target.value) })} />
              </Field>
              <Field label="Yearly price (USD)">
                <Input type="number" value={editing.yearly} onChange={(e) => setEditing({ ...editing, yearly: Number(e.target.value) })} />
              </Field>
              <Field label="Max branches">
                <Input type="number" value={editing.maxBranches} onChange={(e) => setEditing({ ...editing, maxBranches: Number(e.target.value) })} />
              </Field>
              <Field label="AI credits / month">
                <Input type="number" value={editing.aiCredits} onChange={(e) => setEditing({ ...editing, aiCredits: Number(e.target.value) })} />
              </Field>
            </div>
            <Field label="Description">
              <Textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={2} />
            </Field>
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">Included modules</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {moduleCatalog.map((m) => (
                  <Checkbox key={m} label={m} checked={editing.modules.includes(m)} onChange={(c) => setEditing({ ...editing, modules: c ? [...editing.modules, m] : editing.modules.filter((x) => x !== m) })} />
                ))}
              </div>
            </div>
            <Toggle checked={editing.popular ?? false} onChange={(v) => setEditing({ ...editing, popular: v })} label="Highlight as most popular" />
          </div>
        )}
      </Modal>

      {/* Upgrade / downgrade */}
      <Modal
        open={!!changeFor}
        onClose={() => setChangeFor(null)}
        title={`Change plan — ${changeFor?.tenant ?? ''}`}
        description={`Currently on ${changeFor?.plan ?? ''} (${changeFor?.cycle ?? ''})`}
        footer={
          <>
            <Button variant="outline" onClick={() => setChangeFor(null)}>Cancel</Button>
            <Button disabled={changeTo === changeFor?.plan} onClick={applyChange}>Confirm change</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="New plan">
            <Select value={changeTo} onChange={(e) => setChangeTo(e.target.value as PlanName)} options={planNames} />
          </Field>
          <Field label="When">
            <Select value={changeWhen} onChange={(e) => setChangeWhen(e.target.value)} options={['Immediately (prorated)', 'At next renewal']} />
          </Field>
          {changeFor && (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {planNames.indexOf(changeTo) > planNames.indexOf(changeFor.plan) ? 'Upgrade' : 'Downgrade'} · new price{' '}
              <b>{formatCurrency(planList.find((p) => p.name === changeTo)?.monthly ?? 0)}/mo</b>
            </p>
          )}
        </div>
      </Modal>
    </div>
  )
}
