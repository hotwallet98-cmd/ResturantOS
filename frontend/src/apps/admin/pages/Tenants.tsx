import {
  Activity,
  BadgeCheck,
  Ban,
  Building2,
  CheckCircle2,
  CreditCard,
  FileText,
  GitBranch,
  Layers,
  Mail,
  PauseCircle,
  PlayCircle,
  Plus,
  ShieldAlert,
  Sparkles,
  Store,
  XCircle,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AIInsights,
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  DataTable,
  DescriptionList,
  Drawer,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  ProgressBar,
  SectionTitle,
  Select,
  StatCard,
  StatusBadge,
  Tabs,
  Textarea,
  useToast,
} from '@/shared/components/ui'
import type { Column } from '@/shared/components/ui'
import { useAsync } from '@/shared/hooks/useAsync'
import { cn } from '@/shared/lib/cn'
import { formatCurrency, formatDate, formatNumber, timeAgo } from '@/shared/lib/format'
import { getTenantActivity, getTenants, moduleCatalog, planNames, plans, updateTenant } from '@/shared/services/admin'
import type { PlanName, Tenant, TenantStatus } from '@/shared/services/admin'

type TabId = 'all' | 'verification' | 'subscriptions' | 'activity' | 'ai'
type LifecycleAction = { tenant: Tenant; to: TenantStatus; label: string }

const planPrice = (p: PlanName) => plans.find((x) => x.name === p)?.monthly ?? 0

export default function Tenants() {
  const navigate = useNavigate()
  const notify = useToast()
  const { data: list = [], setData, loading } = useAsync(getTenants)
  const { data: activity = [], loading: activityLoading } = useAsync(getTenantActivity)
  const [tab, setTab] = useState<TabId>('all')
  const [statusFilter, setStatusFilter] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [lifecycle, setLifecycle] = useState<LifecycleAction | null>(null)
  const [reason, setReason] = useState('')
  const [assignId, setAssignId] = useState<string | null>(null)
  const [assignPlan, setAssignPlan] = useState<PlanName>('Pro')
  const [assignModules, setAssignModules] = useState<string[]>([])
  const [activityFilter, setActivityFilter] = useState('')

  const selected = list.find((t) => t.id === selectedId) ?? null
  const assigning = list.find((t) => t.id === assignId) ?? null

  const patch = async (id: string, p: Partial<Tenant>, msg: string) => {
    setData((prev) => prev?.map((t) => (t.id === id ? { ...t, ...p } : t)))
    await updateTenant(id, p)
    notify(msg)
  }

  const filtered = useMemo(
    () => list.filter((t) => (!statusFilter || t.status === statusFilter) && (!cityFilter || t.city === cityFilter)),
    [list, statusFilter, cityFilter],
  )
  const verificationQueue = list.filter((t) => t.verification !== 'Verified')
  const cities = [...new Set(list.map((t) => t.city))]

  const openAssign = (t: Tenant) => {
    setAssignId(t.id)
    setAssignPlan(t.plan)
    setAssignModules(t.modules)
  }

  const confirmLifecycle = async () => {
    if (!lifecycle) return
    await patch(lifecycle.tenant.id, { status: lifecycle.to }, `${lifecycle.tenant.name} ${lifecycle.label.toLowerCase()}d`)
    setLifecycle(null)
    setReason('')
  }

  const columns: Column<Tenant>[] = [
    {
      key: 'name',
      header: 'Restaurant',
      sortable: true,
      render: (t) => (
        <div className="flex items-center gap-3">
          <Avatar name={t.name} size="sm" />
          <div className="min-w-0">
            <p className="font-medium whitespace-nowrap text-slate-800">{t.name}</p>
            <p className="text-xs text-slate-500">
              {t.id} · {t.type}
            </p>
          </div>
        </div>
      ),
    },
    { key: 'city', header: 'Location', sortable: true, render: (t) => <span className="whitespace-nowrap">{t.city}, {t.country}</span> },
    { key: 'branches', header: 'Branches', sortable: true, align: 'center' },
    { key: 'plan', header: 'Plan', sortable: true, render: (t) => <Badge tone="purple">{t.plan}</Badge> },
    { key: 'status', header: 'Status', sortable: true, render: (t) => <StatusBadge status={t.status} /> },
    { key: 'verification', header: 'Verification', render: (t) => <StatusBadge status={t.verification} /> },
    { key: 'mrr', header: 'MRR', sortable: true, align: 'right', render: (t) => <span className="font-medium">{formatCurrency(t.mrr)}</span> },
    { key: 'lastActive', header: 'Last active', sortable: true, sortValue: (t) => -new Date(t.lastActive).getTime(), render: (t) => <span className="text-xs whitespace-nowrap text-slate-500">{timeAgo(t.lastActive)}</span> },
  ]

  const tabs = [
    { id: 'all' as const, label: 'View & manage', icon: Store, count: list.length },
    { id: 'verification' as const, label: 'Verification & approval', icon: BadgeCheck, count: verificationQueue.length },
    { id: 'subscriptions' as const, label: 'Subscription & modules', icon: Layers },
    { id: 'activity' as const, label: 'Activity monitoring', icon: Activity },
    { id: 'ai' as const, label: 'AI risk & usage', icon: Sparkles },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Building2}
        title="Restaurant / Tenant Management"
        description="Create, verify, configure and monitor every restaurant workspace on the platform."
        actions={
          <Button icon={Plus} onClick={() => navigate('/admin/onboarding')}>
            Create & onboard restaurant
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Restaurants" value={list.length} icon={Building2} tone="brand" hint={`${list.reduce((a, t) => a + t.branches, 0)} branches`} />
        <StatCard label="Active" value={list.filter((t) => t.status === 'Active').length} icon={CheckCircle2} tone="green" delta={5.3} />
        <StatCard label="Awaiting approval" value={verificationQueue.length} icon={BadgeCheck} tone="amber" hint="documents to review" />
        <StatCard label="Suspended / inactive" value={list.filter((t) => t.status === 'Suspended' || t.status === 'Inactive').length} icon={PauseCircle} tone="red" />
      </div>

      <Tabs items={tabs} value={tab} onChange={setTab} />

      {tab === 'all' && (
        <Card flush>
          <DataTable
            columns={columns}
            data={filtered}
            rowKey={(t) => t.id}
            loading={loading}
            searchKeys={['name', 'owner', 'city', 'id', 'email']}
            searchPlaceholder="Search restaurants, owners, IDs…"
            onRowClick={(t) => setSelectedId(t.id)}
            pageSize={10}
            toolbar={
              <>
                <Select className="h-9 w-36" placeholder="All statuses" options={['Active', 'Trial', 'Pending', 'Suspended', 'Inactive']} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} />
                <Select className="h-9 w-36" placeholder="All cities" options={cities} value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} />
              </>
            }
          />
        </Card>
      )}

      {tab === 'verification' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {verificationQueue.length === 0 && (
            <Card className="lg:col-span-2">
              <EmptyState icon={BadgeCheck} title="Verification queue is empty" description="All restaurants have been verified." />
            </Card>
          )}
          {verificationQueue.map((t) => (
            <Card
              key={t.id}
              title={t.name}
              subtitle={`${t.type} · ${t.city} · submitted ${formatDate(t.createdAt)}`}
              actions={<StatusBadge status={t.verification} />}
            >
              <ul className="space-y-2">
                {t.documents.map((d) => (
                  <li key={d.name} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2">
                    <span className="flex min-w-0 items-center gap-2 text-sm text-slate-700">
                      <FileText size={15} className="shrink-0 text-slate-400" />
                      <span className="truncate">{d.name}</span>
                    </span>
                    <StatusBadge status={d.status} />
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="success"
                  icon={CheckCircle2}
                  onClick={() =>
                    patch(
                      t.id,
                      { verification: 'Verified', status: t.status === 'Pending' ? 'Trial' : t.status, documents: t.documents.map((d) => ({ ...d, status: 'Verified' })) },
                      `${t.name} verified & approved`,
                    )
                  }
                >
                  Approve
                </Button>
                <Button size="sm" variant="outline" icon={XCircle} onClick={() => patch(t.id, { verification: 'Rejected' }, `${t.name} rejected — owner notified`)}>
                  Reject
                </Button>
                <Button size="sm" variant="ghost" icon={Mail} onClick={() => notify(`Requested missing documents from ${t.owner}`, 'info')}>
                  Request documents
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'subscriptions' && (
        <Card flush title="Assign subscription & modules" subtitle="Plan and enabled modules for each restaurant">
          <DataTable
            data={list}
            rowKey={(t) => t.id}
            loading={loading}
            searchKeys={['name', 'plan']}
            columns={[
              { key: 'name', header: 'Restaurant', sortable: true, render: (t) => <span className="font-medium whitespace-nowrap text-slate-800">{t.name}</span> },
              { key: 'plan', header: 'Plan', sortable: true, render: (t) => <Badge tone="purple">{t.plan}</Badge> },
              {
                key: 'modules',
                header: 'Modules',
                render: (t) => (
                  <div className="flex max-w-md flex-wrap gap-1">
                    {t.modules.slice(0, 4).map((m) => (
                      <Badge key={m}>{m}</Badge>
                    ))}
                    {t.modules.length > 4 && <Badge tone="blue">+{t.modules.length - 4}</Badge>}
                  </div>
                ),
              },
              { key: 'usagePct', header: 'Plan usage', render: (t) => <ProgressBar className="w-32" value={t.usagePct} showLabel tone={t.usagePct > 90 ? 'red' : t.usagePct > 75 ? 'yellow' : 'green'} /> },
              {
                key: 'act',
                header: '',
                align: 'right',
                render: (t) => (
                  <Button size="xs" variant="outline" icon={CreditCard} onClick={() => openAssign(t)}>
                    Assign
                  </Button>
                ),
              },
            ]}
          />
        </Card>
      )}

      {tab === 'activity' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Card
            className="xl:col-span-2"
            title="Restaurant activity feed"
            subtitle="Configuration, billing, user and security events across tenants"
            actions={<Select className="h-9 w-40" placeholder="All categories" options={['Billing', 'Configuration', 'Users', 'Orders', 'Security', 'Lifecycle']} value={activityFilter} onChange={(e) => setActivityFilter(e.target.value)} />}
            flush
          >
            <ul className="divide-y divide-slate-100">
              {(activityLoading ? [] : activity.filter((a) => !activityFilter || a.category === activityFilter)).map((a) => (
                <li key={a.id} className="flex items-start gap-3 px-5 py-3">
                  <Avatar name={a.tenant} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-800">
                      <span className="font-medium">{a.tenant}</span> — {a.event}
                    </p>
                    <p className="text-xs text-slate-500">
                      {a.actor} · {timeAgo(a.at)}
                    </p>
                  </div>
                  <Badge tone={a.category === 'Security' ? 'red' : a.category === 'Billing' ? 'green' : a.category === 'Lifecycle' ? 'orange' : 'gray'}>{a.category}</Badge>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Engagement by restaurant" subtitle="Orders this month & last activity">
            <ul className="space-y-3">
              {[...list]
                .filter((t) => t.ordersMonth > 0)
                .sort((a, b) => b.ordersMonth - a.ordersMonth)
                .slice(0, 9)
                .map((t) => (
                  <li key={t.id}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="truncate text-slate-700">{t.name}</span>
                      <span className="font-medium text-slate-900">{formatNumber(t.ordersMonth, true)}</span>
                    </div>
                    <ProgressBar value={t.ordersMonth} max={61200} />
                  </li>
                ))}
            </ul>
          </Card>
        </div>
      )}

      {tab === 'ai' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <AIInsights
            className="xl:col-span-1"
            title="AI Tenant Risk & Usage Insights"
            subtitle="Calculated from current persisted tenant scores"
            onAction={(i) => notify(`${i.action} — started`, 'info')}
            insights={[
              ...(list.filter((t) => t.riskScore >= 60).map((t) => ({ title: `${t.name}: elevated risk`, detail: `Persisted risk ${t.riskScore}, health ${t.healthScore}, usage ${t.usagePct}%.`, severity: 'warning' as const, metric: `Risk ${t.riskScore}`, action: 'Review tenant' }))),
              ...(list.filter((t) => t.usagePct >= 90).map((t) => ({ title: `${t.name} is near its plan limit`, detail: `Current measured usage is ${t.usagePct}% on ${t.plan}.`, severity: 'opportunity' as const, metric: `${t.usagePct}%`, action: 'Review plan' }))),
              ...(!list.some((t) => t.riskScore >= 60 || t.usagePct >= 90) ? [{ title: 'No tenant risk alerts', detail: 'No current tenant crosses the configured risk or usage thresholds.', severity: 'success' as const }] : []),
            ]}
          />
          <Card className="xl:col-span-2" title="Tenant risk & health scores" subtitle="Higher risk = higher probability of churn or abuse" flush>
            <DataTable
              data={[...list].sort((a, b) => b.riskScore - a.riskScore)}
              rowKey={(t) => t.id}
              pageSize={8}
              columns={[
                { key: 'name', header: 'Restaurant', render: (t) => <span className="font-medium whitespace-nowrap text-slate-800">{t.name}</span> },
                {
                  key: 'riskScore',
                  header: 'Risk',
                  sortable: true,
                  render: (t) => (
                    <Badge tone={t.riskScore >= 60 ? 'red' : t.riskScore >= 30 ? 'yellow' : 'green'} dot>
                      {t.riskScore >= 60 ? 'High' : t.riskScore >= 30 ? 'Medium' : 'Low'} · {t.riskScore}
                    </Badge>
                  ),
                },
                { key: 'healthScore', header: 'Health', sortable: true, render: (t) => <ProgressBar className="w-28" value={t.healthScore} showLabel tone={t.healthScore >= 80 ? 'green' : t.healthScore >= 50 ? 'yellow' : 'red'} /> },
                { key: 'usagePct', header: 'Usage', sortable: true, align: 'right', render: (t) => `${t.usagePct}%` },
                { key: 'status', header: 'Status', render: (t) => <StatusBadge status={t.status} /> },
              ]}
            />
          </Card>
        </div>
      )}

      {/* Detail drawer */}
      <Drawer
        open={!!selected}
        onClose={() => setSelectedId(null)}
        title={selected?.name}
        description={selected ? `${selected.id} · ${selected.legalName}` : undefined}
        width="max-w-xl"
        footer={
          selected && (
            <>
              {selected.status !== 'Active' && (
                <Button variant="success" icon={PlayCircle} onClick={() => setLifecycle({ tenant: selected, to: 'Active', label: 'Activate' })}>
                  Activate
                </Button>
              )}
              {selected.status !== 'Suspended' && (
                <Button variant="outline" icon={PauseCircle} onClick={() => setLifecycle({ tenant: selected, to: 'Suspended', label: 'Suspend' })}>
                  Suspend
                </Button>
              )}
              {selected.status !== 'Inactive' && (
                <Button variant="danger" icon={Ban} onClick={() => setLifecycle({ tenant: selected, to: 'Inactive', label: 'Deactivate' })}>
                  Deactivate
                </Button>
              )}
            </>
          )
        }
      >
        {selected && (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={selected.status} />
              <StatusBadge status={selected.verification} />
              <Badge tone="purple">{selected.plan}</Badge>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                ['MRR', formatCurrency(selected.mrr)],
                ['Orders / mo', formatNumber(selected.ordersMonth, true)],
                ['Users', String(selected.users)],
              ].map(([l, v]) => (
                <div key={l} className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">{l}</p>
                  <p className="text-base font-semibold text-slate-900">{v}</p>
                </div>
              ))}
            </div>
            <div>
              <SectionTitle>Business details</SectionTitle>
              <DescriptionList
                items={[
                  { label: 'Owner', value: selected.owner },
                  { label: 'Email', value: selected.email },
                  { label: 'Phone', value: selected.phone },
                  { label: 'Type', value: selected.type },
                  { label: 'Location', value: `${selected.city}, ${selected.country}` },
                  { label: 'Branches', value: <span className="inline-flex items-center gap-1"><GitBranch size={13} /> {selected.branches}</span> },
                  { label: 'Customer since', value: formatDate(selected.createdAt) },
                  { label: 'Last active', value: timeAgo(selected.lastActive) },
                ]}
              />
            </div>
            <div>
              <SectionTitle action={<Button size="xs" variant="outline" onClick={() => openAssign(selected)}>Change</Button>}>Subscription & modules</SectionTitle>
              <div className="flex flex-wrap gap-1.5">
                {selected.modules.map((m) => (
                  <Badge key={m} tone="blue">{m}</Badge>
                ))}
              </div>
            </div>
            <div>
              <SectionTitle>Health & risk</SectionTitle>
              <div className="space-y-3">
                <div>
                  <div className="mb-1 flex justify-between text-xs text-slate-500"><span>Health score</span><span>{selected.healthScore}/100</span></div>
                  <ProgressBar value={selected.healthScore} tone={selected.healthScore >= 80 ? 'green' : selected.healthScore >= 50 ? 'yellow' : 'red'} />
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-xs text-slate-500"><span>Plan usage</span><span>{selected.usagePct}%</span></div>
                  <ProgressBar value={selected.usagePct} tone="blue" />
                </div>
                {selected.riskScore >= 60 && (
                  <p className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                    <ShieldAlert size={14} /> AI flagged this tenant as high risk ({selected.riskScore}/100).
                  </p>
                )}
              </div>
            </div>
            <div>
              <SectionTitle>Verification documents</SectionTitle>
              <ul className="space-y-1.5">
                {selected.documents.map((d) => (
                  <li key={d.name} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">{d.name}</span>
                    <StatusBadge status={d.status} />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Drawer>

      {/* Lifecycle confirm */}
      <Modal
        open={!!lifecycle}
        onClose={() => setLifecycle(null)}
        size="sm"
        title={lifecycle ? `${lifecycle.label} ${lifecycle.tenant.name}?` : ''}
        description={
          lifecycle?.to === 'Active'
            ? 'Staff will regain access immediately and billing resumes.'
            : lifecycle?.to === 'Suspended'
              ? 'All staff will be signed out; data is kept and the restaurant can be reactivated.'
              : 'The workspace is archived and the subscription is cancelled at period end.'
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setLifecycle(null)}>Cancel</Button>
            <Button variant={lifecycle?.to === 'Active' ? 'success' : 'danger'} onClick={confirmLifecycle}>
              {lifecycle?.label}
            </Button>
          </>
        }
      >
        <Field label="Reason (shared with the restaurant owner)">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Outstanding invoice INV-2026-0915" />
        </Field>
      </Modal>

      {/* Assign subscription */}
      <Modal
        open={!!assigning}
        onClose={() => setAssignId(null)}
        size="lg"
        title={`Assign subscription — ${assigning?.name ?? ''}`}
        description="Choose a plan and fine-tune the modules enabled for this restaurant."
        footer={
          <>
            <Button variant="outline" onClick={() => setAssignId(null)}>Cancel</Button>
            <Button
              onClick={async () => {
                if (!assigning) return
                await patch(assigning.id, { plan: assignPlan, modules: assignModules, mrr: assigning.status === 'Active' ? planPrice(assignPlan) : assigning.mrr }, `${assigning.name} moved to ${assignPlan}`)
                setAssignId(null)
              }}
            >
              Save assignment
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {planNames.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setAssignPlan(p)
                setAssignModules(plans.find((x) => x.name === p)?.modules ?? [])
              }}
              className={cn('rounded-lg border p-3 text-left transition', assignPlan === p ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/20' : 'border-slate-200 hover:border-slate-300')}
            >
              <p className="text-sm font-semibold text-slate-800">{p}</p>
              <p className="text-xs text-slate-500">{formatCurrency(planPrice(p))}/mo</p>
            </button>
          ))}
        </div>
        <p className="mt-5 mb-2 text-sm font-medium text-slate-700">Modules ({assignModules.length})</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {moduleCatalog.map((m) => (
            <Checkbox
              key={m}
              label={m}
              checked={assignModules.includes(m)}
              onChange={(c) => setAssignModules((prev) => (c ? [...prev, m] : prev.filter((x) => x !== m)))}
            />
          ))}
        </div>
      </Modal>
    </div>
  )
}
