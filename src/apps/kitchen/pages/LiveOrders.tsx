import {
  AlarmClock,
  BrainCircuit,
  Check,
  ChefHat,
  ClipboardCheck,
  Flame,
  HandPlatter,
  LayoutGrid,
  ListChecks,
  Maximize2,
  Minimize2,
  Play,
  Plus,
  RefreshCcw,
  Timer,
  Undo2,
  Volume2,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { StockAlertStrip } from '@/apps/kitchen/components/StockAlertStrip'
import { VoiceAgentBar } from '@/apps/kitchen/components/VoiceAgent'
import { AIPanel } from '@/shared/components/operations/AIPanel'
import {
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
  useToast,
} from '@/shared/components/ui'
import type { Column } from '@/shared/components/ui'
import { useAuth } from '@/shared/context/AuthContext'
import { useKitchen } from '@/apps/kitchen/context/KitchenContext'
import { useAsync } from '@/shared/hooks/useAsync'
import { chartAxis, chartColors, chartGrid, chartTooltip } from '@/shared/lib/chart'
import { cn } from '@/shared/lib/cn'
import { timeAgo } from '@/shared/lib/format'
import type { KitchenTicket, QualityCheck, Station, TicketStatus } from '@/shared/services/operations'
import { STATIONS, getQualityChecks, getStationLoads, prepTimeTrend } from '@/shared/services/operations'

const COLUMNS: { status: TicketStatus; label: string; accent: string; bump?: string }[] = [
  { status: 'New', label: 'New', accent: 'bg-sky-500', bump: 'Start' },
  { status: 'Preparing', label: 'Preparing', accent: 'bg-amber-500', bump: 'Ready' },
  { status: 'Ready', label: 'Ready for handover', accent: 'bg-emerald-500', bump: 'Handed over' },
  { status: 'Served', label: 'Served', accent: 'bg-slate-400' },
]
const FLOW: TicketStatus[] = ['New', 'Preparing', 'Ready', 'Served']

const stationColor: Record<Station, string> = {
  Grill: 'bg-red-100 text-red-700',
  Tandoor: 'bg-amber-100 text-amber-700',
  Wok: 'bg-orange-100 text-orange-700',
  Cold: 'bg-sky-100 text-sky-700',
  Drinks: 'bg-emerald-100 text-emerald-700',
}

function useNow(interval = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), interval)
    return () => clearInterval(t)
  }, [interval])
  return now
}

const elapsedMin = (t: KitchenTicket, now: number) => (now - new Date(t.createdAt).getTime()) / 60000
const fmtClock = (mins: number) => {
  const s = Math.max(0, Math.floor(mins * 60))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export default function LiveOrders() {
  const notify = useToast()
  const { branch, can } = useAuth()
  const now = useNow()
  const { tickets, setTickets, moveTicket, loading, agent } = useKitchen()
  const qcQ = useAsync(getQualityChecks)
  const loadsQ = useAsync(getStationLoads)
  const [tab, setTab] = useState<'kds' | 'queue' | 'quality' | 'ai'>('kds')
  const [station, setStation] = useState<'All' | Station>('All')
  const [fullscreen, setFullscreen] = useState(false)
  const [qcOpen, setQcOpen] = useState(false)

  const active = tickets.filter((t) => t.status !== 'Served')
  const late = active.filter((t) => t.status !== 'Ready' && elapsedMin(t, now) > t.predictedMins)
  const remakes = (qcQ.data ?? []).filter((q) => q.result === 'Remake').length

  const setTicket = (id: string, fn: (t: KitchenTicket) => KitchenTicket) => {
    setTickets((prev) => prev.map((t) => (t.id === id ? fn(t) : t)))
  }

  const bump = (t: KitchenTicket, dir: 1 | -1 = 1) => {
    const next = FLOW[FLOW.indexOf(t.status) + dir]
    if (!next) return
    moveTicket(t.id, next)
    if (next === 'Ready') notify(`#${t.orderNo} ready — ${t.table ? `server ${t.server} notified` : t.type === 'Delivery' ? 'rider notified' : 'customer notified via SMS'}`)
    else if (next === 'Served') notify(`#${t.orderNo} handed over`, 'info')
  }

  const toggleItem = (t: KitchenTicket, idx: number) => {
    const items = t.items.map((it, i) => (i === idx ? { ...it, done: !it.done } : it))
    const status: TicketStatus = t.status === 'New' ? 'Preparing' : t.status
    setTicket(t.id, () => ({ ...t, items, status }))
    if (items.every((i) => i.done) && status === 'Preparing') notify(`All items done on #${t.orderNo} — bump to Ready`, 'info')
  }

  const remake = (t: KitchenTicket, reason: string, item: string) => {
    const copy: KitchenTicket = {
      ...t,
      id: `kt-${Date.now()}`,
      status: 'New',
      priority: 'Rush',
      remake: true,
      createdAt: new Date().toISOString(),
      items: t.items.filter((i) => i.name === item || !item).map((i) => ({ ...i, done: false, notes: `Remake – ${reason}` })),
    }
    setTickets((prev) => [copy, ...prev])
  }

  if (loading) return <LoadingState label="Connecting to kitchen display…" />

  const board = (
    <div className={cn('rounded-2xl bg-ink-900 p-3 sm:p-4', fullscreen && 'fixed inset-0 z-40 overflow-y-auto rounded-none')}>
      {fullscreen && (
        <div className="mb-3 rounded-2xl ring-1 ring-white/10">
          <VoiceAgentBar />
        </div>
      )}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="scrollbar-dark flex gap-1 overflow-x-auto">
          {(['All', ...STATIONS] as const).map((s) => {
            const n = active.filter((t) => s === 'All' || t.items.some((i) => i.station === s)).length
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStation(s)}
                className={cn(
                  'shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition',
                  station === s ? 'bg-brand-600 text-white' : 'bg-ink-800 text-slate-300 hover:bg-ink-700',
                )}
              >
                {s} <span className="ml-1 text-xs opacity-70">{n}</span>
              </button>
            )
          })}
        </div>
        <div className="ml-auto flex items-center gap-3 text-xs text-slate-400">
          <span className="hidden items-center gap-1 sm:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-400" /> on time
          </span>
          <span className="hidden items-center gap-1 sm:flex">
            <span className="h-2 w-2 rounded-full bg-amber-400" /> &gt;75%
          </span>
          <span className="hidden items-center gap-1 sm:flex">
            <span className="h-2 w-2 rounded-full bg-red-500" /> late
          </span>
          <span className="font-mono text-sm text-white">{new Date(now).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          <button type="button" onClick={() => setFullscreen(!fullscreen)} className="rounded-md p-1.5 text-slate-300 hover:bg-ink-700" aria-label="Toggle full screen">
            {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const list = tickets
            .filter((t) => t.status === col.status && (station === 'All' || t.items.some((i) => i.station === station)))
            .sort((a, b) => (col.status === 'Served' ? b.createdAt.localeCompare(a.createdAt) : prioRank(b) - prioRank(a) || a.createdAt.localeCompare(b.createdAt)))
          return (
            <div key={col.status} className="flex min-h-40 flex-col rounded-xl bg-ink-800/70 p-2">
              <div className="mb-2 flex items-center gap-2 px-1.5 pt-1">
                <span className={cn('h-2.5 w-2.5 rounded-full', col.accent)} />
                <span className="text-sm font-semibold text-white">{col.label}</span>
                <span className="ml-auto rounded-full bg-ink-700 px-2 py-0.5 text-xs font-semibold text-slate-300">{list.length}</span>
              </div>
              <div className="space-y-2">
                {(col.status === 'Served' ? list.slice(0, 4) : list).map((t) => (
                  <TicketCard key={t.id} t={t} now={now} awaiting={t.id === agent.awaitingId && t.status === 'New'} station={station} bumpLabel={col.bump} onBump={() => bump(t)} onRecall={() => bump(t, -1)} onToggle={(i) => toggleItem(t, i)} />
                ))}
                {list.length === 0 && <p className="py-6 text-center text-xs text-slate-500">No tickets</p>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ChefHat}
        title="Live Orders"
        description={`Kitchen Display System with voice agent · ${branch}`}
        actions={
          <>
            <Button variant="outline" icon={ClipboardCheck} onClick={() => setQcOpen(true)}>
              Log quality check
            </Button>
            <Button icon={Maximize2} onClick={() => (setTab('kds'), setFullscreen(true))}>
              Full-screen KDS
            </Button>
          </>
        }
      />

      {can('stockAlerts') && <StockAlertStrip />}
      <VoiceAgentBar />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Active tickets" value={active.length} icon={ListChecks} tone="brand" hint={`${active.filter((t) => t.status === 'New').length} waiting to start`} />
        <StatCard label="Avg ticket time" value="14.6 min" icon={Timer} tone="blue" delta={-4.2} invertDelta deltaLabel="vs last Fri" />
        <StatCard label="Running late" value={late.length} icon={AlarmClock} tone={late.length ? 'red' : 'green'} hint="past AI predicted time" />
        <StatCard label="Remakes today" value={remakes} icon={RefreshCcw} tone="amber" hint="4.1% of plates" />
      </div>

      <Tabs
        items={[
          { id: 'kds', label: 'KDS board', icon: LayoutGrid, count: active.length },
          { id: 'queue', label: 'Queue & stations', icon: Flame },
          { id: 'quality', label: 'Quality & remakes', icon: ClipboardCheck },
          { id: 'ai', label: 'AI predictions', icon: BrainCircuit },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'kds' && board}

      {tab === 'queue' && (
        <QueueTab
          tickets={active}
          now={now}
          loads={loadsQ.data ?? []}
          onReassign={(tid, idx, s) => {
            setTicket(tid, (t) => ({ ...t, items: t.items.map((it, i) => (i === idx ? { ...it, station: s } : it)) }))
            notify(`Item moved to ${s} station`)
          }}
          onToggle={(t, idx) => toggleItem(t, idx)}
        />
      )}

      {tab === 'quality' && (
        <QualityTab
          checks={qcQ.data ?? []}
          onAdd={() => setQcOpen(true)}
        />
      )}

      {tab === 'ai' && (
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <Card title="Prep time: actual vs AI predicted" subtitle="Minutes per ticket · bars show tickets per hour (incl. forecast)">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={prepTimeTrend} margin={{ left: -10, right: 8, top: 8 }}>
                    <CartesianGrid {...chartGrid} vertical={false} />
                    <XAxis dataKey="h" {...chartAxis} />
                    <YAxis yAxisId="m" {...chartAxis} />
                    <YAxis yAxisId="o" orientation="right" {...chartAxis} />
                    <Tooltip {...chartTooltip} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar yAxisId="o" dataKey="orders" name="Tickets / hour" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
                    <Line yAxisId="m" type="monotone" dataKey="actual" name="Actual prep (min)" stroke={chartColors[0]} strokeWidth={2.5} dot={false} />
                    <Line yAxisId="m" type="monotone" dataKey="predicted" name="AI predicted (min)" stroke={chartColors[1]} strokeWidth={2} strokeDasharray="5 4" dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card title="Delay predictions for open tickets" flush>
              <ul className="divide-y divide-slate-100">
                {active
                  .filter((t) => t.status !== 'Ready')
                  .map((t) => {
                    const el = elapsedMin(t, now)
                    const risk = Math.min(99, Math.round((el / t.predictedMins) * 70 + (t.priority === 'Rush' ? 10 : 0)))
                    return (
                      <li key={t.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                        <span className="w-14 font-semibold text-slate-900">#{t.orderNo}</span>
                        <span className="w-28 text-slate-500">{t.table ? `Table ${t.table}` : t.type}</span>
                        <span className="flex-1 text-slate-600">
                          Predicted {t.predictedMins} min · elapsed {Math.floor(el)} min
                        </span>
                        <div className="w-40">
                          <ProgressBar value={risk} tone={risk > 80 ? 'red' : risk > 55 ? 'yellow' : 'green'} showLabel />
                        </div>
                      </li>
                    )
                  })}
              </ul>
            </Card>
          </div>
          <AIPanel module="kitchen" title="AI prep time & workload" subtitle="Delay predictions and station balancing" />
        </div>
      )}

      <QcModal
        open={qcOpen}
        onClose={() => setQcOpen(false)}
        tickets={tickets}
        onSave={(qc, t) => {
          qcQ.setData((prev) => [qc, ...(prev ?? [])])
          if (qc.result === 'Remake' && t) {
            remake(t, qc.reason ?? 'quality', qc.item)
            notify(`Remake ticket created for #${qc.orderNo} (Rush)`, 'info')
          } else notify(`QC logged: ${qc.item} – ${qc.result}`)
          setQcOpen(false)
        }}
      />
    </div>
  )
}

const prioRank = (t: KitchenTicket) => (t.priority === 'Rush' ? 2 : t.priority === 'High' ? 1 : 0)

function TicketCard({
  t,
  now,
  awaiting,
  station,
  bumpLabel,
  onBump,
  onRecall,
  onToggle,
}: {
  t: KitchenTicket
  now: number
  awaiting?: boolean
  station: 'All' | Station
  bumpLabel?: string
  onBump: () => void
  onRecall: () => void
  onToggle: (idx: number) => void
}) {
  const el = elapsedMin(t, now)
  const ratio = el / t.predictedMins
  const live = t.status === 'New' || t.status === 'Preparing'
  const header = !live ? (t.status === 'Ready' ? 'bg-emerald-600' : 'bg-slate-600') : ratio > 1 ? 'bg-red-600 animate-pulse' : ratio > 0.75 ? 'bg-amber-500' : 'bg-emerald-600'
  const done = t.items.filter((i) => i.done).length
  return (
    <div className={cn('overflow-hidden rounded-lg bg-white shadow-lg', t.status === 'Served' && 'opacity-60', awaiting && 'ring-4 ring-violet-400')}>
      <div className={cn('flex items-center gap-2 px-3 py-2 text-white', header)}>
        <span className="text-lg font-bold">#{t.orderNo}</span>
        <span className="text-xs font-medium opacity-90">{t.table ? `Table ${t.table}` : t.type}</span>
        <span className="ml-auto flex items-center gap-1 font-mono text-sm font-semibold">
          <Timer size={13} /> {fmtClock(el)}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 px-3 py-1.5 text-[11px] text-slate-500">
        <span>{t.channel}</span>·<span>{t.server}</span>
        {t.priority !== 'Normal' && <Badge tone={t.priority === 'Rush' ? 'red' : 'orange'}>{t.priority}</Badge>}
        {t.remake && <Badge tone="pink">Remake</Badge>}
        {awaiting && (
          <Badge tone="purple">
            <Volume2 size={11} /> Awaiting confirm
          </Badge>
        )}
        {live && <span className="ml-auto text-violet-600">AI ETA {Math.max(0, Math.ceil(t.predictedMins - el))}m</span>}
      </div>
      <ul className="divide-y divide-slate-50 px-1 py-1">
        {t.items.map((it, i) => {
          const dim = station !== 'All' && it.station !== station
          return (
            <li key={i}>
              <button
                type="button"
                disabled={!live}
                onClick={() => onToggle(i)}
                className={cn('flex w-full items-start gap-2 rounded px-2 py-1.5 text-left hover:bg-slate-50 disabled:hover:bg-transparent', dim && 'opacity-35')}
              >
                <span className={cn('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border', it.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300')}>
                  {it.done && <Check size={11} strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-sm font-semibold text-slate-800', it.done && 'text-slate-400 line-through')}>
                    {it.qty}× {it.name}
                  </span>
                  {it.modifiers.length > 0 && <span className="block text-xs text-slate-500">{it.modifiers.join(', ')}</span>}
                  {it.notes && <span className="block text-xs font-semibold text-red-600">⚠ {it.notes}</span>}
                </span>
                <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold', stationColor[it.station])}>{it.station}</span>
              </button>
            </li>
          )
        })}
      </ul>
      <div className="flex items-center gap-2 border-t border-slate-100 px-3 py-2">
        <span className="text-xs text-slate-400">
          {done}/{t.items.length} done
        </span>
        {t.status !== 'New' && (
          <button type="button" onClick={onRecall} className="ml-auto rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Recall" title="Recall to previous column">
            <Undo2 size={15} />
          </button>
        )}
        {bumpLabel && (
          <Button
            size="sm"
            variant={t.status === 'New' ? 'secondary' : t.status === 'Preparing' ? 'success' : 'primary'}
            icon={t.status === 'New' ? Play : t.status === 'Preparing' ? Check : HandPlatter}
            onClick={onBump}
            className={cn(t.status === 'New' && 'ml-auto')}
          >
            {bumpLabel}
          </Button>
        )}
      </div>
    </div>
  )
}

interface QueueRow {
  key: string
  ticket: KitchenTicket
  idx: number
  name: string
  qty: number
  station: Station
  done: boolean
  elapsed: number
}

function QueueTab({
  tickets,
  now,
  loads,
  onReassign,
  onToggle,
}: {
  tickets: KitchenTicket[]
  now: number
  loads: { station: Station; chef: string; activeItems: number; capacity: number; avgPrepMins: number; targetMins: number }[]
  onReassign: (ticketId: string, idx: number, s: Station) => void
  onToggle: (t: KitchenTicket, idx: number) => void
}) {
  const [stationFilter, setStationFilter] = useState('')
  const rows: QueueRow[] = useMemo(
    () =>
      tickets
        .filter((t) => t.status !== 'Ready')
        .flatMap((t) => t.items.map((it, idx) => ({ key: `${t.id}-${idx}`, ticket: t, idx, name: it.name, qty: it.qty, station: it.station, done: it.done, elapsed: elapsedMin(t, now) })))
        .filter((r) => !stationFilter || r.station === stationFilter),
    [tickets, now, stationFilter],
  )

  const columns: Column<QueueRow>[] = [
    { key: 'order', header: 'Ticket', render: (r) => <span className="font-semibold">#{r.ticket.orderNo}</span>, sortValue: (r) => r.ticket.orderNo, sortable: true },
    { key: 'name', header: 'Item', render: (r) => <span className={cn(r.done && 'text-slate-400 line-through')}>{r.qty}× {r.name}</span> },
    {
      key: 'station',
      header: 'Station',
      render: (r) => (
        <select
          value={r.station}
          onChange={(e) => onReassign(r.ticket.id, r.idx, e.target.value as Station)}
          className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs"
        >
          {STATIONS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      ),
    },
    { key: 'priority', header: 'Priority', render: (r) => <Badge tone={r.ticket.priority === 'Rush' ? 'red' : r.ticket.priority === 'High' ? 'orange' : 'gray'}>{r.ticket.priority}</Badge> },
    {
      key: 'elapsed',
      header: 'Elapsed',
      sortable: true,
      render: (r) => <span className={cn('font-mono text-xs', r.elapsed > r.ticket.predictedMins ? 'font-semibold text-red-600' : 'text-slate-600')}>{fmtClock(r.elapsed)}</span>,
    },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.done ? 'Ready' : r.ticket.status === 'New' ? 'New' : 'Preparing'} /> },
    {
      key: 'act',
      header: '',
      align: 'right',
      render: (r) => (
        <Button size="xs" variant={r.done ? 'ghost' : 'outline'} onClick={() => onToggle(r.ticket, r.idx)}>
          {r.done ? 'Undo' : 'Mark done'}
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {loads.map((l) => {
          const pct = (l.activeItems / l.capacity) * 100
          return (
            <Card key={l.station} bodyClassName="p-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-slate-900">{l.station}</p>
                <Badge tone={pct >= 90 ? 'red' : pct >= 70 ? 'yellow' : 'green'}>{Math.round(pct)}%</Badge>
              </div>
              <p className="text-xs text-slate-500">Chef: {l.chef}</p>
              <ProgressBar value={pct} tone={pct >= 90 ? 'red' : pct >= 70 ? 'yellow' : 'green'} className="mt-3" />
              <div className="mt-3 flex justify-between text-xs text-slate-500">
                <span>
                  {l.activeItems}/{l.capacity} items
                </span>
                <span className={l.avgPrepMins > l.targetMins ? 'font-semibold text-red-600' : ''}>
                  {l.avgPrepMins.toFixed(1)}m / {l.targetMins}m target
                </span>
              </div>
            </Card>
          )
        })}
      </div>
      <Card title="Order queue & station assignment" subtitle="Food preparation tracking per item — reassign items to balance stations" flush>
        <DataTable
          columns={columns}
          data={rows}
          rowKey={(r) => r.key}
          searchKeys={['name']}
          searchPlaceholder="Search item…"
          pageSize={12}
          toolbar={<Select value={stationFilter} onChange={(e) => setStationFilter(e.target.value)} options={STATIONS} placeholder="All stations" className="h-9 w-40" />}
        />
      </Card>
    </div>
  )
}

function QualityTab({ checks, onAdd }: { checks: QualityCheck[]; onAdd: () => void }) {
  const passRate = checks.length ? (checks.filter((c) => c.result === 'Passed').length / checks.length) * 100 : 100
  const columns: Column<QualityCheck>[] = [
    { key: 'time', header: 'Time', sortable: true, render: (c) => <span className="text-xs text-slate-500">{timeAgo(c.time)}</span> },
    { key: 'orderNo', header: 'Ticket', render: (c) => <span className="font-semibold">#{c.orderNo}</span> },
    { key: 'item', header: 'Item' },
    { key: 'station', header: 'Station', render: (c) => <Badge>{c.station}</Badge> },
    { key: 'chef', header: 'Chef' },
    { key: 'result', header: 'Result', render: (c) => <Badge tone={c.result === 'Passed' ? 'green' : c.result === 'Remake' ? 'red' : 'yellow'} dot>{c.result}</Badge> },
    { key: 'reason', header: 'Notes', render: (c) => <span className="text-slate-500">{c.reason ?? '—'}</span> },
  ]
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
      <Card title="Quality checks & remakes" subtitle="Every plate checked at the pass before handover" flush actions={<Button size="sm" icon={Plus} onClick={onAdd}>Log check</Button>}>
        <DataTable columns={columns} data={checks} rowKey={(c) => c.id} searchKeys={['item', 'chef']} pageSize={8} />
      </Card>
      <Card title="Pass-rate today">
        <p className="text-4xl font-semibold text-slate-900">{passRate.toFixed(0)}%</p>
        <p className="mb-4 text-sm text-slate-500">Target 97%</p>
        <ProgressBar value={passRate} tone={passRate >= 95 ? 'green' : passRate >= 85 ? 'yellow' : 'red'} />
        <ul className="mt-5 space-y-2 text-sm">
          {(['Passed', 'Warning', 'Remake'] as const).map((r) => (
            <li key={r} className="flex justify-between">
              <span className="text-slate-600">{r}</span>
              <span className="font-semibold">{checks.filter((c) => c.result === r).length}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

function QcModal({
  open,
  onClose,
  tickets,
  onSave,
}: {
  open: boolean
  onClose: () => void
  tickets: KitchenTicket[]
  onSave: (qc: QualityCheck, t?: KitchenTicket) => void
}) {
  const [ticketId, setTicketId] = useState('')
  const [item, setItem] = useState('')
  const [result, setResult] = useState<QualityCheck['result']>('Passed')
  const [reason, setReason] = useState('')
  const t = tickets.find((x) => x.id === ticketId)
  const save = () => {
    if (!t || !item) return
    const it = t.items.find((i) => i.name === item)
    onSave(
      { id: `qc-${Date.now()}`, orderNo: t.orderNo, item, chef: 'Imran Butt', station: it?.station ?? 'Wok', result, reason: reason || undefined, time: new Date().toISOString() },
      t,
    )
    setTicketId('')
    setItem('')
    setReason('')
    setResult('Passed')
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Log quality check"
      description="Remake results create a new Rush ticket on the KDS."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!t || !item} variant={result === 'Remake' ? 'danger' : 'primary'}>
            {result === 'Remake' ? 'Send for remake' : 'Save check'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Ticket" required>
          <Select
            value={ticketId}
            onChange={(e) => (setTicketId(e.target.value), setItem(''))}
            placeholder="Select ticket…"
            options={tickets.map((x) => ({ value: x.id, label: `#${x.orderNo} · ${x.table ? `Table ${x.table}` : x.type} · ${x.status}` }))}
          />
        </Field>
        <Field label="Item" required>
          <Select value={item} onChange={(e) => setItem(e.target.value)} placeholder="Select item…" options={(t?.items ?? []).map((i) => i.name)} disabled={!t} />
        </Field>
        <div>
          <p className="mb-1.5 text-sm font-medium text-slate-700">Result</p>
          <Tabs variant="pills" items={(['Passed', 'Warning', 'Remake'] as const).map((r) => ({ id: r, label: r }))} value={result} onChange={setResult} />
        </div>
        {result !== 'Passed' && (
          <Field label="Reason">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. undercooked, wrong garnish, too salty" />
          </Field>
        )}
      </div>
    </Modal>
  )
}
