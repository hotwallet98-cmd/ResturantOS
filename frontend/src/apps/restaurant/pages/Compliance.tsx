import { AlertOctagon, BatteryLow, CalendarClock, CheckCircle2, ClipboardCheck, FileBadge, Plus, ShieldCheck, Snowflake, Sparkles, SprayCan, Thermometer, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts'
import type { Column } from '@/shared/components/ui'
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
  useToast,
} from '@/shared/components/ui'
import { ChartBox, KpiGrid, Sparkline } from '@/apps/restaurant/components/business'
import { useAsync } from '@/shared/hooks/useAsync'
import { chartAxis, chartGrid, chartTooltip } from '@/shared/lib/chart'
import { cn } from '@/shared/lib/cn'
import { formatDate, timeAgo } from '@/shared/lib/format'
import type { CleaningRecord, Incident, License, SafetyChecklist, TempSensor } from '@/apps/restaurant/services/business'
import {
  BRANCHES,
  createCleaningRecord,
  createIncident,
  getChecklists,
  getCleaningRecords,
  getExpiryItems,
  getIncidents,
  getInspections,
  getLicenses,
  getSensors,
  updateChecklist,
} from '@/apps/restaurant/services/business'

type TabId = 'checks' | 'temps' | 'cleaning' | 'incidents' | 'audits' | 'ai'

const daysLeft = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
const inRange = (s: TempSensor) => s.current >= s.min && s.current <= s.max

export default function Compliance() {
  const [tab, setTab] = useState<TabId>('checks')
  const sensors = useAsync(getSensors)
  const lic = useAsync(getLicenses)
  const inc = useAsync(getIncidents)
  const checks = useAsync(getChecklists)
  const [incOpen, setIncOpen] = useState(false)

  const allItems = checks.data?.flatMap((c) => c.items) ?? []
  const pct = allItems.length ? Math.round((allItems.filter((i) => i.done).length / allItems.length) * 100) : 0
  const breaches = sensors.data?.filter((s) => !inRange(s)).length ?? 0
  const expiring = lic.data?.filter((l) => daysLeft(l.expires) <= 30).length ?? 0

  return (
    <div>
      <PageHeader
        icon={ShieldCheck}
        title="Quality, Safety & Compliance"
        description="Food-safety checks, live temperature monitoring, cleaning logs, incidents and license tracking for every branch."
        actions={
          <>
            <Button variant="outline" icon={ClipboardCheck} onClick={() => setTab('checks')}>Today's checklists</Button>
            <Button variant="danger" icon={AlertOctagon} onClick={() => setIncOpen(true)}>Report incident</Button>
          </>
        }
      />
      <KpiGrid>
        <StatCard label="Compliance score" value="92 / 100" icon={ShieldCheck} tone="green" delta={3.1} deltaLabel="vs last audit" />
        <StatCard label="Checklist completion" value={`${pct}%`} icon={ClipboardCheck} tone="blue" hint="today, all branches" />
        <StatCard label="Temperature alerts" value={breaches} icon={Thermometer} tone={breaches ? 'red' : 'green'} hint={breaches ? 'sensors out of range' : 'all in range'} />
        <StatCard label="Licenses expiring" value={expiring} icon={FileBadge} tone="amber" hint="within 30 days or expired" />
      </KpiGrid>

      <Tabs<TabId>
        className="mb-5"
        value={tab}
        onChange={setTab}
        items={[
          { id: 'checks', label: 'Food Safety Checks', icon: ClipboardCheck },
          { id: 'temps', label: 'Temperature & Expiry', icon: Thermometer, count: breaches || undefined },
          { id: 'cleaning', label: 'Cleaning & Inspections', icon: SprayCan },
          { id: 'incidents', label: 'Incidents & Recalls', icon: TriangleAlert, count: inc.data?.filter((i) => i.status !== 'Resolved').length },
          { id: 'audits', label: 'Audits & Licenses', icon: FileBadge },
          { id: 'ai', label: 'AI Risk Detection', icon: Sparkles },
        ]}
      />

      {tab === 'checks' && (checks.data ? <ChecklistsTab data={checks.data} setData={checks.setData} /> : <LoadingState />)}
      {tab === 'temps' && (sensors.data ? <TempsTab sensors={sensors.data} setSensors={sensors.setData} /> : <LoadingState />)}
      {tab === 'cleaning' && <CleaningTab />}
      {tab === 'incidents' && (inc.data ? <IncidentsTab data={inc.data} setData={inc.setData} onNew={() => setIncOpen(true)} /> : <LoadingState />)}
      {tab === 'audits' && (lic.data ? <AuditsTab licenses={lic.data} /> : <LoadingState />)}
      {tab === 'ai' && <AITab />}

      <IncidentModal
        open={incOpen}
        onClose={() => setIncOpen(false)}
        onCreate={(i) => {
          inc.setData((d) => [i, ...(d ?? [])])
          setTab('incidents')
        }}
      />
    </div>
  )
}

/* ─────────────── Food safety & hygiene checks ─────────────── */

function ChecklistsTab({ data, setData }: { data: SafetyChecklist[]; setData: (fn: (d: SafetyChecklist[] | undefined) => SafetyChecklist[] | undefined) => void }) {
  const notify = useToast()
  const toggle = (cl: SafetyChecklist, itemId: string, done: boolean) => {
    const next = { ...cl, items: cl.items.map((i) => (i.id === itemId ? { ...i, done } : i)) }
    setData((d) => d?.map((x) => (x.id === cl.id ? next : x)))
    void updateChecklist(next)
    if (next.items.every((i) => i.done)) notify(`${cl.name} completed & signed off ✅`)
  }
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {data.map((cl) => {
        const done = cl.items.filter((i) => i.done).length
        const complete = done === cl.items.length
        return (
          <Card
            key={cl.id}
            title={cl.name}
            subtitle={`${cl.branch} · ${cl.shift} · ${cl.owner}`}
            actions={complete ? <Badge tone="green">Signed off</Badge> : <Badge tone="yellow">{done}/{cl.items.length}</Badge>}
          >
            <ProgressBar value={done} max={cl.items.length} tone={complete ? 'green' : 'brand'} showLabel className="mb-4" />
            <ul className="space-y-2.5">
              {cl.items.map((i) => (
                <li key={i.id} className={cn('flex items-start justify-between gap-2 rounded-lg px-2 py-1.5', i.done ? 'bg-emerald-50/50' : i.critical ? 'bg-red-50/50' : '')}>
                  <Checkbox checked={i.done} onChange={(v) => toggle(cl, i.id, v)} label={<span className={cn(i.done && 'text-slate-400 line-through')}>{i.label}</span>} className="items-start" />
                  {i.critical && !i.done && <Badge tone="red">Critical</Badge>}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-slate-400">Due {formatDate(cl.dueAt, true)}</p>
          </Card>
        )
      })}
    </div>
  )
}

/* ─────────────── Temperature & expiry monitoring ─────────────── */

function TempsTab({ sensors, setSensors }: { sensors: TempSensor[]; setSensors: (fn: (d: TempSensor[] | undefined) => TempSensor[] | undefined) => void }) {
  const notify = useToast()
  const { data: expiry } = useAsync(getExpiryItems)
  const [branch, setBranch] = useState('')

  // simulate live readings every 5 s
  useEffect(() => {
    const t = setInterval(() => {
      setSensors((d) =>
        d?.map((s) => {
          const jitter = (Math.random() - 0.5) * (s.type === 'Hot holding' ? 1.2 : 0.4)
          const current = Math.round((s.current + jitter) * 10) / 10
          return { ...s, current, history: [...s.history.slice(1), current], lastReading: new Date().toISOString() }
        }),
      )
    }, 5000)
    return () => clearInterval(t)
  }, [setSensors])

  const shown = branch ? sensors.filter((s) => s.branch === branch) : sensors
  const icon = (s: TempSensor) => (s.type === 'Freezer' ? Snowflake : Thermometer)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm text-slate-500"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> Live IoT feed · updates every 5 s</p>
        <Select className="h-9 w-40" value={branch} onChange={(e) => setBranch(e.target.value)} options={[...BRANCHES]} placeholder="All branches" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {shown.map((s) => {
          const ok = inRange(s)
          const Icon = icon(s)
          return (
            <div key={s.id} className={cn('rounded-xl border bg-white p-4 shadow-sm transition-colors', ok ? 'border-slate-200' : 'border-red-300 bg-red-50/60 ring-2 ring-red-200')}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{s.name}</p>
                  <p className="text-xs text-slate-500">{s.branch} · {s.type}</p>
                </div>
                <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', ok ? 'bg-sky-50 text-sky-600' : 'bg-red-100 text-red-600')}><Icon size={16} /></span>
              </div>
              <div className="mt-3 flex items-end justify-between">
                <p className={cn('text-3xl font-bold tracking-tight', ok ? 'text-slate-900' : 'text-red-600')}>{s.current.toFixed(1)}°C</p>
                <span className="text-xs text-slate-500">range {s.min}° to {s.max}°</span>
              </div>
              <Sparkline values={s.history} min={s.min} max={s.max} stroke={ok ? '#0ea5e9' : '#ef4444'} className="mt-2" />
              <div className="mt-2 flex items-center justify-between text-xs">
                {ok ? <span className="font-medium text-emerald-600">In range</span> : <span className="font-semibold text-red-600">Out of range!</span>}
                <span className={cn('flex items-center gap-1', s.battery < 25 ? 'text-amber-600' : 'text-slate-400')}>{s.battery < 25 && <BatteryLow size={13} />}{s.battery}% · {timeAgo(s.lastReading)}</span>
              </div>
              {!ok && <Button size="xs" variant="danger" block className="mt-3" onClick={() => notify(`Corrective action logged for ${s.name}; manager notified`)}>Log corrective action</Button>}
            </div>
          )
        })}
      </div>
      <Card title="Expiry monitoring" subtitle="Batches expiring within 72 hours are highlighted" flush>
        {!expiry ? <LoadingState /> : (
          <ul className="divide-y divide-slate-100">
            {[...expiry].sort((a, b) => +new Date(a.expiresAt) - +new Date(b.expiresAt)).map((e) => {
              const h = Math.round((new Date(e.expiresAt).getTime() - Date.now()) / 3_600_000)
              const status = h < 0 ? 'Expired' : h <= 72 ? 'Expiring soon' : 'OK'
              return (
                <li key={e.id} className={cn('flex flex-wrap items-center gap-3 px-5 py-3', h < 0 && 'bg-red-50/50')}>
                  <CalendarClock size={18} className={h < 0 ? 'text-red-500' : h <= 72 ? 'text-amber-500' : 'text-slate-400'} />
                  <div className="min-w-[160px] flex-1"><p className="font-medium text-slate-900">{e.item} <span className="text-xs font-normal text-slate-400">#{e.batch}</span></p><p className="text-xs text-slate-500">{e.branch} · {e.location} · {e.qty}</p></div>
                  <p className="text-sm text-slate-600">{h < 0 ? `${Math.abs(h)}h ago` : h < 48 ? `in ${h}h` : `in ${Math.round(h / 24)}d`}</p>
                  <StatusBadge status={status === 'OK' ? 'Healthy' : status} />
                  {h <= 72 && <Button size="xs" variant="outline" onClick={() => notify(`${e.item} (${e.batch}) ${h < 0 ? 'discarded & logged as waste' : 'flagged for use-first'}`)}>{h < 0 ? 'Discard' : 'Use first'}</Button>}
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}

/* ─────────────── Cleaning & inspection records ─────────────── */

function CleaningTab() {
  const notify = useToast()
  const cr = useAsync(getCleaningRecords)
  const ins = useAsync(getInspections)
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ area: '', task: '', branch: 'Downtown', frequency: 'Daily' as CleaningRecord['frequency'] })

  const save = async () => {
    const r: CleaningRecord = { id: `CR-${Date.now()}`, ...f, branch: f.branch as CleaningRecord['branch'], doneBy: 'You', at: new Date().toISOString(), status: 'Completed' }
    cr.setData((d) => [r, ...(d ?? [])])
    await createCleaningRecord(r)
    notify('Cleaning record logged')
    setOpen(false)
  }
  const verify = (r: CleaningRecord) => {
    cr.setData((d) => d?.map((x) => (x.id === r.id ? { ...x, status: 'Completed', verifiedBy: 'You' } : x)))
    notify(`${r.area} verified`)
  }

  const cols: Column<CleaningRecord>[] = [
    { key: 'area', header: 'Area', sortable: true, render: (r) => <div><p className="font-medium text-slate-900">{r.area}</p><p className="text-xs text-slate-500">{r.task}</p></div> },
    { key: 'branch', header: 'Branch' },
    { key: 'frequency', header: 'Frequency', render: (r) => <Badge>{r.frequency}</Badge> },
    { key: 'doneBy', header: 'Done by' },
    { key: 'verifiedBy', header: 'Verified by', render: (r) => r.verifiedBy ?? <span className="text-slate-400">—</span> },
    { key: 'at', header: 'When', sortable: true, render: (r) => timeAgo(r.at) },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'act', header: '', render: (r) => !r.verifiedBy && <Button size="xs" variant="outline" onClick={() => verify(r)}>Verify</Button> },
  ]

  return (
    <div className="space-y-6">
      <Card title="Cleaning log" flush>
        <DataTable columns={cols} data={cr.data ?? []} loading={cr.loading} rowKey={(r) => r.id} searchKeys={['area', 'task', 'doneBy']} toolbar={<Button size="sm" icon={Plus} onClick={() => setOpen(true)}>Log cleaning</Button>} />
      </Card>
      <Card title="Inspection records">
        {ins.loading ? <LoadingState /> : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {ins.data?.map((i) => (
              <div key={i.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-2"><div><p className="font-semibold text-slate-900">{i.type}</p><p className="text-xs text-slate-500">{i.branch} · {i.inspector}</p></div><StatusBadge status={i.status} /></div>
                {i.status === 'Scheduled' ? (
                  <p className="mt-4 text-sm text-slate-600">Scheduled for <b>{formatDate(i.date)}</b></p>
                ) : (
                  <div className="mt-3 flex items-end justify-between">
                    <p className={cn('text-3xl font-bold', i.score >= 85 ? 'text-emerald-600' : i.score >= 75 ? 'text-amber-600' : 'text-red-600')}>{i.score}<span className="text-sm font-medium text-slate-400">/100</span></p>
                    <p className="text-xs text-slate-500">{i.findings} findings · {formatDate(i.date)}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
      <Modal open={open} onClose={() => setOpen(false)} title="Log cleaning task" footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} disabled={!f.area || !f.task}>Save</Button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Area" required><Input value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} placeholder="e.g. Fryer station" /></Field>
          <Field label="Branch"><Select value={f.branch} onChange={(e) => setF({ ...f, branch: e.target.value })} options={[...BRANCHES]} /></Field>
          <Field label="Task" required className="sm:col-span-2"><Input value={f.task} onChange={(e) => setF({ ...f, task: e.target.value })} /></Field>
          <Field label="Frequency"><Select value={f.frequency} onChange={(e) => setF({ ...f, frequency: e.target.value as CleaningRecord['frequency'] })} options={['Hourly', 'Daily', 'Weekly', 'Monthly']} /></Field>
        </div>
      </Modal>
    </div>
  )
}

/* ─────────────── Incident & recall management ─────────────── */

const sevTone = { Low: 'gray', Medium: 'yellow', High: 'orange', Critical: 'red' } as const

function IncidentsTab({ data, setData, onNew }: { data: Incident[]; setData: (fn: (d: Incident[] | undefined) => Incident[] | undefined) => void; onNew: () => void }) {
  const notify = useToast()
  const [status, setStatus] = useState('')
  const rows = status ? data.filter((i) => i.status === status) : data
  const advance = (i: Incident) => {
    const next = i.status === 'Open' ? 'In Progress' : 'Resolved'
    setData((d) => d?.map((x) => (x.id === i.id ? { ...x, status: next } : x)))
    notify(`${i.id} → ${next}`)
  }
  const cols: Column<Incident>[] = [
    { key: 'title', header: 'Incident', className: 'min-w-[240px]', render: (i) => <div><p className="font-medium text-slate-900">{i.title}</p><p className="text-xs text-slate-500">{i.id} · {i.actions}</p></div> },
    { key: 'type', header: 'Type', render: (i) => <Badge tone={i.type === 'Recall' ? 'purple' : 'gray'}>{i.type}</Badge> },
    { key: 'branch', header: 'Branch' },
    { key: 'severity', header: 'Severity', render: (i) => <Badge tone={sevTone[i.severity]} dot>{i.severity}</Badge> },
    { key: 'reportedAt', header: 'Reported', sortable: true, render: (i) => <div><p>{timeAgo(i.reportedAt)}</p><p className="text-xs text-slate-500">{i.reportedBy}</p></div> },
    { key: 'status', header: 'Status', render: (i) => <StatusBadge status={i.status} /> },
    { key: 'act', header: '', render: (i) => i.status !== 'Resolved' && <Button size="xs" variant="outline" onClick={() => advance(i)}>{i.status === 'Open' ? 'Start' : 'Resolve'}</Button> },
  ]
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl border border-purple-200 bg-violet-50 px-4 py-3 text-sm text-violet-800">
        <AlertOctagon size={18} className="mt-0.5 shrink-0" />
        <p><b>Active supplier recall feed:</b> no open recalls affecting your stock. Last recall (Dairy Fresh DF-0987) was quarantined and closed.</p>
      </div>
      <Card flush>
        <DataTable columns={cols} data={rows} rowKey={(i) => i.id} searchKeys={['title', 'type', 'branch']} toolbar={<><Select className="h-9 w-36" value={status} onChange={(e) => setStatus(e.target.value)} options={['Open', 'In Progress', 'Resolved']} placeholder="All statuses" /><Button size="sm" variant="danger" icon={Plus} onClick={onNew}>Report</Button></>} />
      </Card>
    </div>
  )
}

/* ─────────────── Compliance audits & alerts ─────────────── */

function AuditsTab({ licenses }: { licenses: License[] }) {
  const notify = useToast()
  const sorted = [...licenses].sort((a, b) => +new Date(a.expires) - +new Date(b.expires))
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {sorted.map((l) => {
          const d = daysLeft(l.expires)
          const status = d < 0 ? 'Expired' : d <= 30 ? 'Expiring soon' : 'Active'
          const total = Math.max(1, (new Date(l.expires).getTime() - new Date(l.issued).getTime()) / 86_400_000)
          return (
            <div key={l.id} className={cn('rounded-xl border bg-white p-4 shadow-sm', d < 0 ? 'border-red-300' : d <= 30 ? 'border-amber-300' : 'border-slate-200')}>
              <div className="flex items-start justify-between gap-2"><FileBadge size={20} className={d < 0 ? 'text-red-500' : d <= 30 ? 'text-amber-500' : 'text-emerald-500'} /><StatusBadge status={status} /></div>
              <p className="mt-2 font-semibold text-slate-900">{l.name}</p>
              <p className="text-xs text-slate-500">{l.authority} · {l.branch === 'All' ? 'All branches' : l.branch} · {l.number}</p>
              <ProgressBar value={Math.max(0, d)} max={total} tone={d < 0 ? 'red' : d <= 30 ? 'yellow' : 'green'} className="mt-3" />
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className={cn('font-medium', d < 0 ? 'text-red-600' : d <= 30 ? 'text-amber-600' : 'text-slate-600')}>{d < 0 ? `Expired ${Math.abs(d)}d ago` : `${d} days left`}</span>
                {d <= 30 && <button type="button" className="font-semibold text-brand-600 hover:underline" onClick={() => notify(`Renewal application started for ${l.name}`)}>Renew</button>}
              </div>
            </div>
          )
        })}
      </div>
      <Card title="Audit readiness by branch">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { b: 'Downtown', s: 94, items: ['License valid', 'Last PFA 94/100', '2 minor findings closed'] },
            { b: 'Mall Road', s: 86, items: ['Prep fridge breach open', 'Internal audit 81/100', 'PFA visit in 14 days'] },
            { b: 'Airport', s: 71, items: ['PFA license expired', 'Fire cert expiring', 'Pest incident open'] },
          ].map((x) => (
            <div key={x.b}>
              <div className="mb-1 flex justify-between text-sm"><span className="font-medium text-slate-800">{x.b}</span><span className="font-semibold">{x.s}%</span></div>
              <ProgressBar value={x.s} tone={x.s >= 90 ? 'green' : x.s >= 80 ? 'yellow' : 'red'} />
              <ul className="mt-3 space-y-1 text-xs text-slate-600">{x.items.map((i) => <li key={i} className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-slate-400" />{i}</li>)}</ul>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

/* ─────────────── AI safety risk & pattern detection ─────────────── */

function AITab() {
  const notify = useToast()
  const heat = [
    { area: 'Cold storage', Downtown: 22, 'Mall Road': 68, Airport: 31 },
    { area: 'Hygiene', Downtown: 18, 'Mall Road': 34, Airport: 52 },
    { area: 'Allergens', Downtown: 12, 'Mall Road': 47, Airport: 20 },
    { area: 'Pest', Downtown: 9, 'Mall Road': 14, Airport: 61 },
    { area: 'Licensing', Downtown: 15, 'Mall Road': 10, Airport: 88 },
  ]
  const color = (v: number) => (v >= 60 ? 'bg-red-500 text-white' : v >= 40 ? 'bg-amber-400 text-white' : v >= 25 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800')
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="space-y-6">
        <Card title="Risk heatmap" subtitle="AI risk score (0–100) by area & branch">
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full min-w-[360px] text-sm">
              <thead><tr className="text-xs text-slate-500"><th className="py-2 text-left font-medium">Area</th>{BRANCHES.map((b) => <th key={b} className="py-2 font-medium">{b}</th>)}</tr></thead>
              <tbody>
                {heat.map((r) => (
                  <tr key={r.area}>
                    <td className="py-1.5 pr-3 text-slate-700">{r.area}</td>
                    {BRANCHES.map((b) => <td key={b} className="p-1"><div className={cn('rounded-md py-2 text-center text-xs font-semibold', color(r[b]))}>{r[b]}</div></td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Temperature breaches by hour (30 days)">
          <ChartBox height={200}>
            <BarChart data={['6', '8', '10', '12', '14', '16', '18', '20', '22'].map((h, i) => ({ h: `${h}:00`, n: [1, 0, 2, 3, 2, 1, 7, 9, 4][i] }))}>
              <CartesianGrid {...chartGrid} vertical={false} />
              <XAxis dataKey="h" {...chartAxis} />
              <YAxis {...chartAxis} allowDecimals={false} />
              <Tooltip {...chartTooltip} />
              <Bar dataKey="n" name="Breaches" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartBox>
        </Card>
      </div>
      <AIInsights
        title="AI Safety Risk & Pattern Detection"
        subtitle="Correlates sensors, checklists, incidents & audits"
        onAction={(i) => notify(`${i.action} — scheduled`)}
        insights={[
          { title: 'Prep fridge failing during dinner rush', detail: 'Mall Road prep fridge exceeds 5°C on 9 of the last 12 evenings between 6–9 PM — door-open frequency + compressor wear. Failure likely within 10 days.', severity: 'critical', metric: '87% conf.', action: 'Book technician' },
          { title: 'Airport PFA license expired', detail: 'Operating without a valid license risks sealing of premises. Renewal takes ~7 working days.', severity: 'critical', action: 'Start renewal' },
          { title: 'Closing checklists skipped on Sundays', detail: 'Airport closing checklist completion drops to 54% on Sundays — correlates with 2 pest sightings.', severity: 'warning', metric: '54%', action: 'Assign owner' },
          { title: 'Allergen incidents linked to new staff', detail: 'Both allergen events in 90 days involved staff with < 3 weeks tenure.', severity: 'warning', action: 'Schedule training' },
          { title: 'Downtown audit-ready', detail: 'All checks green for 21 consecutive days.', severity: 'success', metric: '94/100' },
        ]}
      />
    </div>
  )
}

/* ─────────────── Incident modal ─────────────── */

function IncidentModal({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (i: Incident) => void }) {
  const notify = useToast()
  const [f, setF] = useState({ title: '', type: 'Equipment' as Incident['type'], branch: 'Downtown', severity: 'Medium' as Incident['severity'], actions: '' })
  const save = async () => {
    const i: Incident = { id: `INC-${42 + Math.floor(Math.random() * 50)}`, ...f, branch: f.branch as Incident['branch'], reportedBy: 'You', reportedAt: new Date().toISOString(), status: 'Open', actions: f.actions || 'Awaiting investigation' }
    onCreate(i)
    await createIncident(i)
    notify(`Incident ${i.id} reported — ${f.severity === 'Critical' || f.severity === 'High' ? 'owner & branch manager alerted' : 'branch manager notified'}`)
    onClose()
    setF({ ...f, title: '', actions: '' })
  }
  return (
    <Modal open={open} onClose={onClose} title="Report incident" description="Food safety, injury, allergen, pest, recall or equipment." footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="danger" onClick={save} disabled={!f.title}>Submit report</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="What happened?" required className="sm:col-span-2"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Type"><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as Incident['type'] })} options={['Foodborne illness', 'Injury', 'Allergen', 'Pest', 'Recall', 'Equipment']} /></Field>
        <Field label="Severity"><Select value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value as Incident['severity'] })} options={['Low', 'Medium', 'High', 'Critical']} /></Field>
        <Field label="Branch" className="sm:col-span-2"><Select value={f.branch} onChange={(e) => setF({ ...f, branch: e.target.value })} options={[...BRANCHES]} /></Field>
        <Field label="Immediate actions taken" className="sm:col-span-2"><Textarea value={f.actions} onChange={(e) => setF({ ...f, actions: e.target.value })} /></Field>
      </div>
    </Modal>
  )
}
