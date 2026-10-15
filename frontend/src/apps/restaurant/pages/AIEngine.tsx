import { Activity, ArrowRight, Bot, BrainCircuit, Check, Cpu, Database, History, Pause, Play, Plus, RefreshCw, Send, ShieldCheck, Sparkles, Workflow, X, Zap } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Column } from '@/shared/components/ui'
import {
  AIInsights,
  Badge,
  Button,
  Card,
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
  Toggle,
  useToast,
} from '@/shared/components/ui'
import { KpiGrid } from '@/apps/restaurant/components/business'
import { useAsync } from '@/shared/hooks/useAsync'
import { cn } from '@/shared/lib/cn'
import { formatNumber, timeAgo } from '@/shared/lib/format'
import type { AIModel, AuditLog, AutomationRule, DataSource, LiveEvent, PendingAction } from '@/apps/restaurant/services/business'
import {
  createAutomationRule,
  decideAction,
  getAIModels,
  getAuditLogs,
  getAutomationRules,
  getDataSources,
  getLiveEvents,
  getPendingActions,
  liveEventTemplates,
  retrainModel,
  updateAutomationRule,
} from '@/apps/restaurant/services/business'
import type { CopilotMessage } from '@/shared/services/copilot'
import { askCopilot, copilotSuggestions } from '@/shared/services/copilot'

type TabId = 'integration' | 'models' | 'automations' | 'monitoring' | 'copilot' | 'approvals'

export default function AIEngine() {
  const [tab, setTab] = useState<TabId>('integration')
  const pending = useAsync(getPendingActions)
  const audit = useAsync(getAuditLogs)
  const rules = useAsync(getAutomationRules)
  const models = useAsync(getAIModels)

  return (
    <div>
      <PageHeader
        icon={BrainCircuit}
        title="Central AI & Automation Engine"
        description="One brain across every department — predictions, automated workflows, live alerts and a management copilot."
        actions={
          <>
            <Button variant="outline" icon={ShieldCheck} onClick={() => setTab('approvals')}>Approvals ({pending.data?.length ?? 0})</Button>
            <Button variant="ai" icon={Bot} onClick={() => setTab('copilot')}>Ask Copilot</Button>
          </>
        }
      />
      <KpiGrid>
        <StatCard label="Data sources connected" value="12 / 12" icon={Database} tone="blue" hint="1 degraded" />
        <StatCard label="Active AI models" value={models.data?.filter((m) => m.status !== 'Degraded').length ?? '—'} icon={Cpu} tone="purple" hint={`${formatNumber(models.data?.reduce((a, m) => a + m.predictionsToday, 0) ?? 0, true)} predictions today`} />
        <StatCard label="Automations run (24h)" value={rules.data?.filter((r) => r.enabled).reduce((a, r) => a + Math.round(r.runs / 10), 0) ?? '—'} icon={Zap} tone="amber" delta={12.6} />
        <StatCard label="Hours saved this month" value="146 h" icon={Sparkles} tone="green" hint="≈ $1,820 labour" />
      </KpiGrid>

      <Tabs<TabId>
        className="mb-5"
        value={tab}
        onChange={setTab}
        items={[
          { id: 'integration', label: 'Data Integration', icon: Database },
          { id: 'models', label: 'Predictions & Models', icon: Cpu },
          { id: 'automations', label: 'Workflows & Triggers', icon: Workflow },
          { id: 'monitoring', label: 'Live Monitoring', icon: Activity },
          { id: 'copilot', label: 'AI Copilot', icon: Bot },
          { id: 'approvals', label: 'Approvals & Audit', icon: ShieldCheck, count: pending.data?.length },
        ]}
      />

      {tab === 'integration' && <IntegrationTab />}
      {tab === 'models' && (models.data ? <ModelsTab models={models.data} setModels={models.setData} /> : <LoadingState />)}
      {tab === 'automations' && (rules.data ? <AutomationsTab rules={rules.data} setRules={rules.setData} /> : <LoadingState />)}
      {tab === 'monitoring' && <MonitoringTab />}
      {tab === 'copilot' && <CopilotPanel />}
      {tab === 'approvals' &&
        (pending.data && audit.data ? (
          <ApprovalsTab pending={pending.data} setPending={pending.setData} audit={audit.data} setAudit={audit.setData} />
        ) : (
          <LoadingState />
        ))}
    </div>
  )
}

/* ─────────────── Cross-department data integration ─────────────── */

function IntegrationTab() {
  const { data, loading } = useAsync(getDataSources)
  if (loading || !data) return <LoadingState />
  const left = data.slice(0, 6)
  const right = data.slice(6)
  const Node = ({ s }: { s: DataSource }) => (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-lg">{s.emoji}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">{s.module}</p>
        <p className="text-[11px] text-slate-500">{formatNumber(s.records, true)} records · {s.freshness}</p>
      </div>
      <span className={cn('h-2 w-2 shrink-0 rounded-full', s.status === 'Connected' ? 'animate-pulse bg-emerald-500' : 'bg-amber-500')} title={s.status} />
    </div>
  )
  return (
    <div className="space-y-6">
      <Card title="Unified data layer" subtitle="Every module streams into the engine; models and automations read from one consistent graph">
        <div className="grid items-center gap-6 lg:grid-cols-[1fr_auto_1fr]">
          <div className="space-y-2">{left.map((s) => <Node key={s.module} s={s} />)}</div>
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="hidden items-center gap-1 text-violet-300 lg:flex"><ArrowRight size={18} /><ArrowRight size={18} /></div>
            <div className="relative flex h-44 w-44 flex-col items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 text-center text-white shadow-2xl shadow-violet-600/40">
              <span className="absolute inset-0 animate-ping rounded-full bg-violet-500/20" />
              <BrainCircuit size={40} />
              <p className="mt-2 text-sm font-semibold">RestaurantOS AI</p>
              <p className="text-[11px] text-white/80">Spice Route Kitchen</p>
            </div>
            <div className="flex flex-wrap justify-center gap-1.5">
              {['Predict', 'Recommend', 'Automate', 'Alert'].map((x) => <Badge key={x} tone="purple">{x}</Badge>)}
            </div>
            <div className="hidden items-center gap-1 text-violet-300 lg:flex"><ArrowRight size={18} className="rotate-180" /><ArrowRight size={18} className="rotate-180" /></div>
          </div>
          <div className="space-y-2">{right.map((s) => <Node key={s.module} s={s} />)}</div>
        </div>
      </Card>
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { t: 'Events ingested today', v: formatNumber(1_284_220), d: 'POS, KDS, IoT, delivery GPS' },
          { t: 'Average data latency', v: '1.8 s', d: 'p95 4.2 s across all sources' },
          { t: 'Cross-module joins', v: '38', d: 'e.g. sales × weather × reservations' },
        ].map((x) => (
          <div key={x.t} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{x.t}</p><p className="mt-1 text-2xl font-semibold">{x.v}</p><p className="mt-1 text-xs text-slate-400">{x.d}</p></div>
        ))}
      </div>
    </div>
  )
}

/* ─────────────── Prediction & recommendation engine ─────────────── */

function ModelsTab({ models, setModels }: { models: AIModel[]; setModels: (fn: (d: AIModel[] | undefined) => AIModel[] | undefined) => void }) {
  const notify = useToast()
  const retrain = async (m: AIModel) => {
    setModels((d) => d?.map((x) => (x.id === m.id ? { ...x, status: 'Training' } : x)))
    notify(`Retraining ${m.name} on the latest 18 months of data…`, 'info')
    await retrainModel(m.id)
    setTimeout(() => {
      setModels((d) => d?.map((x) => (x.id === m.id ? { ...x, status: 'Active', lastTrained: new Date().toISOString(), accuracy: Math.min(97, Math.round((x.accuracy + 1.4) * 10) / 10) } : x)))
      notify(`${m.name} retrained — accuracy improved`)
    }, 2200)
  }
  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="grid gap-4 sm:grid-cols-2 xl:col-span-2">
        {models.map((m) => (
          <div key={m.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-50 to-fuchsia-50 text-2xl ring-1 ring-violet-100">{m.icon}</span>
              <div className="min-w-0 flex-1"><p className="font-semibold text-slate-900">{m.name}</p><p className="text-xs text-slate-500">{m.purpose}</p></div>
              <StatusBadge status={m.status} />
            </div>
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-xs"><span className="text-slate-500">Accuracy</span><span className="font-semibold text-slate-900">{m.accuracy}%</span></div>
              <ProgressBar value={m.accuracy} tone={m.accuracy >= 90 ? 'green' : m.accuracy >= 82 ? 'purple' : 'yellow'} />
            </div>
            <div className="mt-3 flex flex-wrap gap-1">{m.sources.map((s) => <Badge key={s}>{s}</Badge>)}</div>
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
              <span>Trained {timeAgo(m.lastTrained)} · {formatNumber(m.predictionsToday, true)} preds today</span>
              <Button size="xs" variant="ghost" icon={RefreshCw} loading={m.status === 'Training'} onClick={() => retrain(m)}>Retrain</Button>
            </div>
          </div>
        ))}
      </div>
      <AIInsights
        title="Top recommendations now"
        subtitle="Generated by the prediction engine"
        onAction={(i) => notify(`${i.action} — sent to approvals`)}
        insights={[
          { title: 'Prep 40% more biryani for Friday', detail: 'Demand Forecast: 312 portions vs 220 normal.', severity: 'opportunity', metric: '93% acc.', action: 'Update prep list' },
          { title: '3 tables likely no-show at 8 PM', detail: 'No-show model flags reservations R-881, R-884, R-890.', severity: 'warning', metric: '>65% risk', action: 'Send confirmations' },
          { title: 'Fresh cream spoilage risk', detail: 'Spoilage model: 4 L at Downtown at high risk within 7h.', severity: 'critical', action: 'Use in specials' },
          { title: 'Pricing model needs retraining', detail: 'Accuracy drifted to 79.8% after competitor menu changes.', severity: 'info', action: 'Retrain' },
        ]}
      />
    </div>
  )
}

/* ─────────────── Automated workflows & triggers ─────────────── */

const TRIGGERS = ['Inventory level changes', 'Reservation created', 'Order placed', 'Sensor reading', 'New review', 'Demand forecast updated', 'Item 86’d in kitchen', 'Refund issued', 'Nightly churn scoring']
const ACTIONS = ['Create purchase request to preferred supplier', 'Send WhatsApp message to guest', 'Alert branch manager', 'Disable item on all menu channels', 'Send offer via SMS', 'Suggest extra shifts to manager', 'Create incident', 'Draft AI reply for approval']
const MODULES = ['Procurement', 'Tables', 'Customers', 'Compliance', 'Online Menu', 'Finance', 'Social', 'Employees', 'Kitchen', 'Delivery']

function AutomationsTab({ rules, setRules }: { rules: AutomationRule[]; setRules: (fn: (d: AutomationRule[] | undefined) => AutomationRule[] | undefined) => void }) {
  const notify = useToast()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ name: '', trigger: TRIGGERS[0], condition: '', action: ACTIONS[0], module: MODULES[0], requiresApproval: true })

  const toggle = async (r: AutomationRule, enabled: boolean) => {
    const next = { ...r, enabled }
    setRules((d) => d?.map((x) => (x.id === r.id ? next : x)))
    await updateAutomationRule(next)
    notify(`“${r.name}” ${enabled ? 'enabled' : 'paused'}`, enabled ? 'success' : 'info')
  }
  const save = async () => {
    const r: AutomationRule = { id: `R-${Date.now()}`, ...f, condition: f.condition || 'Always', enabled: true, runs: 0 }
    setRules((d) => [r, ...(d ?? [])])
    await createAutomationRule(r)
    notify(`Automation “${r.name}” created and live`)
    setOpen(false)
    setF({ ...f, name: '', condition: '' })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">{rules.filter((r) => r.enabled).length} of {rules.length} automations active</p>
        <Button icon={Plus} onClick={() => setOpen(true)}>Create automation</Button>
      </div>
      <div className="space-y-3">
        {rules.map((r) => (
          <div key={r.id} className={cn('rounded-xl border bg-white p-4 shadow-sm transition-opacity', r.enabled ? 'border-slate-200' : 'border-dashed border-slate-200 opacity-70')}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">{r.name} <Badge tone="blue">{r.module}</Badge>{r.requiresApproval && <Badge tone="yellow">Needs approval</Badge>}</p>
                <p className="mt-0.5 text-xs text-slate-500">{r.runs} runs{r.lastRun && ` · last ${timeAgo(r.lastRun)}`}</p>
              </div>
              <Toggle checked={r.enabled} onChange={(v) => toggle(r, v)} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-lg bg-sky-50 px-2.5 py-1 text-sky-800"><b className="mr-1 text-[11px] tracking-wide uppercase">When</b>{r.trigger}</span>
              <ArrowRight size={14} className="text-slate-300" />
              <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-amber-800"><b className="mr-1 text-[11px] tracking-wide uppercase">If</b>{r.condition}</span>
              <ArrowRight size={14} className="text-slate-300" />
              <span className="rounded-lg bg-violet-50 px-2.5 py-1 text-violet-800"><b className="mr-1 text-[11px] tracking-wide uppercase">Then</b>{r.action}</span>
            </div>
          </div>
        ))}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} size="lg" title="Create automation" description="Build a “When → If → Then” rule that runs across modules." footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} disabled={!f.name}>Create & activate</Button></>}>
        <div className="space-y-4">
          <Field label="Name" required><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Alert manager on 1★ reviews" /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="When (trigger)"><Select value={f.trigger} onChange={(e) => setF({ ...f, trigger: e.target.value })} options={TRIGGERS} /></Field>
            <Field label="Module"><Select value={f.module} onChange={(e) => setF({ ...f, module: e.target.value })} options={MODULES} /></Field>
          </div>
          <Field label="If (condition)" hint="Optional — e.g. Rating ≤ 2, Stock < reorder level"><Input value={f.condition} onChange={(e) => setF({ ...f, condition: e.target.value })} /></Field>
          <Field label="Then (action)"><Select value={f.action} onChange={(e) => setF({ ...f, action: e.target.value })} options={ACTIONS} /></Field>
          <Toggle label="Require human approval" description="Actions go to the approval queue before executing" checked={f.requiresApproval} onChange={(v) => setF({ ...f, requiresApproval: v })} />
          <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-3 text-sm text-violet-900">
            <b>Preview:</b> When <i>{f.trigger.toLowerCase()}</i>{f.condition && <> and <i>{f.condition}</i></>}, then <i>{f.action.toLowerCase()}</i>{f.requiresApproval && ' (after approval)'}.
          </div>
        </div>
      </Modal>
    </div>
  )
}

/* ─────────────── Real-time monitoring & smart alerts ─────────────── */

function MonitoringTab() {
  const { data, setData, loading } = useAsync(getLiveEvents)
  const [paused, setPaused] = useState(false)
  const [filter, setFilter] = useState('')
  const idx = useRef(0)

  useEffect(() => {
    if (paused) return
    const t = setInterval(() => {
      const tpl = liveEventTemplates[idx.current++ % liveEventTemplates.length]
      setData((d) => [{ ...tpl, id: `E-${Date.now()}`, at: new Date().toISOString() }, ...(d ?? [])].slice(0, 40))
    }, 4000)
    return () => clearInterval(t)
  }, [paused, setData])

  if (loading || !data) return <LoadingState />
  const rows = filter ? data.filter((e) => e.severity === filter) : data
  const sevStyle: Record<LiveEvent['severity'], string> = { info: 'bg-sky-500', success: 'bg-emerald-500', warning: 'bg-amber-500', critical: 'bg-red-500' }
  const counts = (['critical', 'warning', 'info', 'success'] as const).map((s) => ({ s, n: data.filter((e) => e.severity === s).length }))

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <Card
        className="xl:col-span-2"
        title={<span className="flex items-center gap-2">{!paused && <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />}Live event stream</span>}
        actions={
          <>
            <Select className="h-8 w-32" value={filter} onChange={(e) => setFilter(e.target.value)} options={['critical', 'warning', 'info', 'success']} placeholder="All events" />
            <Button size="sm" variant="outline" icon={paused ? Play : Pause} onClick={() => setPaused(!paused)}>{paused ? 'Resume' : 'Pause'}</Button>
          </>
        }
        flush
      >
        <ul className="scrollbar-thin max-h-[520px] divide-y divide-slate-100 overflow-y-auto">
          {rows.map((e) => (
            <li key={e.id} className="animate-fade-in flex items-start gap-3 px-5 py-3">
              <span className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', sevStyle[e.severity])} />
              <div className="min-w-0 flex-1"><p className="text-sm text-slate-800">{e.message}</p><p className="text-xs text-slate-400">{e.module} · {timeAgo(e.at)}</p></div>
              {e.severity === 'critical' && <Badge tone="red">Alert sent</Badge>}
            </li>
          ))}
        </ul>
      </Card>
      <div className="space-y-6">
        <Card title="Alert summary (session)">
          <div className="grid grid-cols-2 gap-3">
            {counts.map((c) => (
              <div key={c.s} className="rounded-lg bg-slate-50 p-3"><p className="flex items-center gap-1.5 text-xs text-slate-500 capitalize"><span className={cn('h-2 w-2 rounded-full', sevStyle[c.s])} />{c.s}</p><p className="mt-1 text-xl font-semibold">{c.n}</p></div>
            ))}
          </div>
        </Card>
        <Card title="Smart alert routing">
          <ul className="space-y-3 text-sm">
            {[
              ['Critical', 'Owner + branch manager · push & SMS'],
              ['Warning', 'Branch manager · push'],
              ['Info', 'Daily digest email'],
              ['Quiet hours', '1 AM – 7 AM (critical only)'],
            ].map(([a, b]) => <li key={a} className="flex justify-between gap-3"><span className="font-medium text-slate-800">{a}</span><span className="text-right text-xs text-slate-500">{b}</span></li>)}
          </ul>
        </Card>
      </div>
    </div>
  )
}

/* ─────────────── AI restaurant management copilot ─────────────── */

function CopilotPanel() {
  const [messages, setMessages] = useState<CopilotMessage[]>([
    { id: 'hello', role: 'assistant', text: 'Hi Ahmed 👋 I’m connected to all 12 modules across Downtown, Mall Road and Airport. Ask me about sales, stock, staffing, menu, reservations or delivery — I can also trigger automations for you.' },
  ])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages, thinking])

  const send = async (text: string) => {
    const prompt = text.trim()
    if (!prompt || thinking) return
    setInput('')
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'user', text: prompt }])
    setThinking(true)
    try {
      const reply = await askCopilot(prompt, 'restaurant')
      setMessages((m) => [...m, reply])
    } finally {
      setThinking(false)
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="flex h-[600px] flex-col overflow-hidden rounded-xl border border-violet-200 bg-white shadow-sm xl:col-span-2">
        <header className="flex items-center gap-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-3.5 text-white">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15"><Sparkles size={18} /></span>
          <div className="flex-1"><p className="font-semibold">Restaurant Management Copilot</p><p className="text-xs text-white/75">Grounded in live data from all modules</p></div>
          <Badge tone="green" dot>Online</Badge>
        </header>
        <div className="scrollbar-thin flex-1 space-y-3 overflow-y-auto bg-slate-50 px-4 py-4">
          {messages.map((m) => (
            <div key={m.id} className={cn('flex gap-2', m.role === 'user' ? 'justify-end' : 'justify-start')}>
              {m.role === 'assistant' && <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white"><Bot size={14} /></span>}
              <div className={cn('max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed', m.role === 'user' ? 'rounded-br-md bg-slate-900 text-white' : 'rounded-bl-md border border-slate-200 bg-white text-slate-700')}>{m.text}</div>
            </div>
          ))}
          {thinking && (
            <div className="flex gap-1 px-10 py-1">
              {[0, 150, 300].map((d) => <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-violet-400" style={{ animationDelay: `${d}ms` }} />)}
            </div>
          )}
          <div ref={endRef} />
        </div>
        <div className="border-t border-slate-200 p-3">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {copilotSuggestions.restaurant.map((s) => (
              <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700 hover:bg-violet-100">{s}</button>
            ))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); void send(input) }} className="flex items-center gap-2">
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask the copilot anything…" className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-sm focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20 focus:outline-none" />
            <button type="submit" aria-label="Send" disabled={!input.trim() || thinking} className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40"><Send size={16} /></button>
          </form>
        </div>
      </div>
      <AIInsights
        title="Copilot can also…"
        subtitle="Try asking"
        insights={[
          { title: 'Draft purchase orders', detail: '“Reorder everything below par from the cheapest reliable supplier.”', severity: 'info' },
          { title: 'Explain a KPI change', detail: '“Why did Mall Road food cost go up last week?”', severity: 'info' },
          { title: 'Plan staffing', detail: '“Build next week’s rota for Downtown within $4,200.”', severity: 'opportunity' },
          { title: 'Run a campaign', detail: '“Send a win-back offer to lapsed Gold members.”', severity: 'opportunity' },
        ]}
      />
    </div>
  )
}

/* ─────────────── Automation approvals & audit logs ─────────────── */

function ApprovalsTab({
  pending,
  setPending,
  audit,
  setAudit,
}: {
  pending: PendingAction[]
  setPending: (fn: (d: PendingAction[] | undefined) => PendingAction[] | undefined) => void
  audit: AuditLog[]
  setAudit: (fn: (d: AuditLog[] | undefined) => AuditLog[] | undefined) => void
}) {
  const notify = useToast()
  const decide = async (a: PendingAction, approve: boolean) => {
    setPending((d) => d?.filter((x) => x.id !== a.id))
    setAudit((d) => [{ id: `AL-${Date.now()}`, at: new Date().toISOString(), actor: 'You', action: `${approve ? 'Approved' : 'Rejected'}: ${a.title}`, module: a.module, outcome: approve ? 'Approved' : 'Rejected' }, ...(d ?? [])])
    await decideAction(a.id, approve ? 'approve' : 'reject')
    notify(approve ? `Approved — ${a.title}` : 'Action rejected and logged', approve ? 'success' : 'info')
  }
  const outcomeTone = { Approved: 'green', Executed: 'blue', Rejected: 'red', Failed: 'red' } as const
  const cols: Column<AuditLog>[] = [
    { key: 'at', header: 'Time', sortable: true, render: (l) => <span className="whitespace-nowrap">{timeAgo(l.at)}</span> },
    { key: 'actor', header: 'Actor', render: (l) => <span className="flex items-center gap-1.5">{l.actor === 'AI Engine' ? <Bot size={14} className="text-violet-600" /> : <History size={14} className="text-slate-400" />}{l.actor}</span> },
    { key: 'action', header: 'Action', className: 'min-w-[260px]' },
    { key: 'module', header: 'Module', render: (l) => <Badge>{l.module}</Badge> },
    { key: 'outcome', header: 'Outcome', render: (l) => <Badge tone={outcomeTone[l.outcome]} dot>{l.outcome}</Badge> },
  ]
  return (
    <div className="space-y-6">
      <Card title="Pending AI actions" subtitle="The engine proposes; you decide. Approved actions execute immediately.">
        {pending.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">All caught up — no actions awaiting approval 🎉</p>
        ) : (
          <div className="space-y-3">
            {pending.map((a) => (
              <div key={a.id} className="flex flex-col gap-3 rounded-xl border border-violet-100 bg-violet-50/30 p-4 sm:flex-row sm:items-center">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white"><Sparkles size={18} /></span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">{a.title}</p>
                  <p className="text-xs text-slate-600">{a.detail}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                    <Badge tone="blue">{a.module}</Badge>
                    <Badge tone="purple">{a.model} · {a.confidence}% conf.</Badge>
                    <Badge tone="green">{a.impact}</Badge>
                    <span className="text-slate-400">{timeAgo(a.createdAt)}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" icon={X} onClick={() => decide(a, false)}>Reject</Button>
                  <Button size="sm" variant="success" icon={Check} onClick={() => decide(a, true)}>Approve</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      <Card title="Audit log" subtitle="Every AI and human action is recorded" flush>
        <DataTable columns={cols} data={audit} rowKey={(l) => l.id} searchKeys={['actor', 'action', 'module']} pageSize={8} />
      </Card>
    </div>
  )
}
