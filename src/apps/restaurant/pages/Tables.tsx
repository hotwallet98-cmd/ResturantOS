import {
  Armchair,
  ArrowRightLeft,
  BellRing,
  BrainCircuit,
  CalendarCheck,
  CalendarPlus,
  Clock,
  Hourglass,
  LayoutGrid,
  MessageSquare,
  Phone,
  Repeat,
  Sparkles,
  UserPlus,
  Users,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AIPanel } from '@/shared/components/operations/AIPanel'
import {
  Badge,
  Button,
  Card,
  DataTable,
  DescriptionList,
  Drawer,
  EmptyState,
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
import type { Column } from '@/shared/components/ui'
import { useAuth } from '@/shared/context/AuthContext'
import { useAsync } from '@/shared/hooks/useAsync'
import { chartAxis, chartColors, chartGrid, chartTooltip } from '@/shared/lib/chart'
import { cn } from '@/shared/lib/cn'
import { formatCurrency, formatDate, timeAgo } from '@/shared/lib/format'
import type { DiningTable, FloorArea, Reservation, TableStatus, WaitlistEntry } from '@/shared/services/operations'
import { FLOOR_AREAS, createReservation, getReservations, getTables, getWaitlist, turnoverByHour, updateTable } from '@/shared/services/operations'

type TabId = 'floor' | 'reservations' | 'waitlist' | 'turnover' | 'ai'

const statusStyle: Record<TableStatus, string> = {
  Available: 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100',
  Occupied: 'border-brand-300 bg-brand-50 text-brand-800 hover:bg-brand-100',
  Reserved: 'border-violet-300 bg-violet-50 text-violet-800 hover:bg-violet-100',
  Cleaning: 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100',
}
const statusDot: Record<TableStatus, string> = { Available: 'bg-emerald-500', Occupied: 'bg-brand-500', Reserved: 'bg-violet-500', Cleaning: 'bg-amber-500' }

interface Transfer {
  id: string
  from: string
  to: string
  guest: string
  at: string
  by: string
}

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

function useMinuteTick() {
  const [, setT] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setT((x) => x + 1), 30_000)
    return () => clearInterval(id)
  }, [])
}

export default function Tables() {
  useMinuteTick()
  const notify = useToast()
  const { branch } = useAuth()
  const tablesQ = useAsync(getTables)
  const resQ = useAsync(getReservations)
  const waitQ = useAsync(getWaitlist)
  const [tab, setTab] = useState<TabId>('floor')
  const [area, setArea] = useState<'All' | FloorArea>('All')
  const [selected, setSelected] = useState<DiningTable | null>(null)
  const [resOpen, setResOpen] = useState(false)
  const [waitOpen, setWaitOpen] = useState(false)
  const [transfers, setTransfers] = useState<Transfer[]>([
    { id: 'tf-1', from: 'T3', to: 'F3', guest: 'Walk-in (6)', at: new Date(Date.now() - 40 * 60000).toISOString(), by: 'Zainab Iqbal' },
    { id: 'tf-2', from: 'R2', to: 'R1', guest: 'Anam & Bilal', at: new Date(Date.now() - 24 * 60000).toISOString(), by: 'Sadia Pervez' },
  ])

  const tables = tablesQ.data ?? []
  const reservations = resQ.data ?? []
  const waitlist = waitQ.data ?? []

  const patchTable = (id: string, p: Partial<DiningTable>) => {
    const t = tables.find((x) => x.id === id)
    if (!t) return
    const next = { ...t, ...p }
    tablesQ.setData((prev) => (prev ?? []).map((x) => (x.id === id ? next : x)))
    setSelected((s) => (s?.id === id ? next : s))
    void updateTable(next)
  }

  const clearFields: Partial<DiningTable> = { guests: undefined, guestName: undefined, server: undefined, seatedAt: undefined, billTotal: undefined, reservedFor: undefined }

  const seat = (tableId: string, guestName: string, guests: number) => {
    patchTable(tableId, { ...clearFields, status: 'Occupied', guestName, guests, seatedAt: new Date().toISOString(), server: 'Hamza Riaz', billTotal: 0 })
    notify(`${guestName} seated at ${tableId}`)
  }

  const transfer = (from: DiningTable, toId: string) => {
    const to = tables.find((x) => x.id === toId)
    if (!to) return
    tablesQ.setData((prev) =>
      (prev ?? []).map((x) =>
        x.id === from.id
          ? { ...x, ...clearFields, status: 'Cleaning' as TableStatus }
          : x.id === toId
            ? { ...x, status: 'Occupied' as TableStatus, guests: from.guests, guestName: from.guestName, server: from.server, seatedAt: from.seatedAt, billTotal: from.billTotal }
            : x,
      ),
    )
    setTransfers((t) => [{ id: `tf-${Date.now()}`, from: from.id, to: toId, guest: from.guestName ?? 'Guests', at: new Date().toISOString(), by: 'Omar Siddiqui' }, ...t])
    setSelected(null)
    notify(`Moved ${from.guestName ?? 'guests'} from ${from.id} to ${toId} — open bill transferred`)
  }

  if (tablesQ.loading) return <LoadingState label="Loading floor plan…" />

  const seats = tables.reduce((s, t) => s + t.seats, 0)
  const occupiedSeats = tables.filter((t) => t.status === 'Occupied').reduce((s, t) => s + (t.guests ?? t.seats), 0)
  const counts = (s: TableStatus) => tables.filter((t) => t.status === s).length
  const upcoming = reservations.filter((r) => ['Confirmed', 'Pending'].includes(r.status))

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Armchair}
        title="Tables & Reservations"
        description={`Floor plan, bookings, waiting list & turnover · ${branch}`}
        actions={
          <>
            <Button variant="outline" icon={UserPlus} onClick={() => setWaitOpen(true)}>
              Add to waitlist
            </Button>
            <Button icon={CalendarPlus} onClick={() => setResOpen(true)}>
              New reservation
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Seat occupancy" value={`${Math.round((occupiedSeats / seats) * 100)}%`} icon={Users} tone="brand" hint={`${occupiedSeats}/${seats} seats`} />
        <StatCard label="Available tables" value={counts('Available')} icon={Armchair} tone="green" hint={`${counts('Cleaning')} being cleaned`} />
        <StatCard label="Upcoming bookings" value={upcoming.length} icon={CalendarCheck} tone="purple" hint={`${upcoming.reduce((s, r) => s + r.party, 0)} covers`} />
        <StatCard label="Waiting list" value={waitlist.length} icon={Hourglass} tone="amber" hint={`avg quote ${Math.round(waitlist.reduce((s, w) => s + w.quotedMins, 0) / Math.max(1, waitlist.length))} min`} />
      </div>

      <Tabs
        items={[
          { id: 'floor', label: 'Floor plan', icon: LayoutGrid },
          { id: 'reservations', label: 'Reservations', icon: CalendarCheck, count: upcoming.length },
          { id: 'waitlist', label: 'Waiting list & guests', icon: Hourglass, count: waitlist.length },
          { id: 'turnover', label: 'Transfers & turnover', icon: Repeat },
          { id: 'ai', label: 'AI seating', icon: BrainCircuit },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'floor' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Tabs variant="pills" items={(['All', ...FLOOR_AREAS] as const).map((a) => ({ id: a, label: a }))} value={area} onChange={setArea} />
            <div className="flex flex-wrap gap-3 text-xs text-slate-600 sm:ml-auto">
              {(['Available', 'Occupied', 'Reserved', 'Cleaning'] as TableStatus[]).map((s) => (
                <span key={s} className="flex items-center gap-1.5">
                  <span className={cn('h-2.5 w-2.5 rounded-full', statusDot[s])} />
                  {s} <span className="font-semibold">{counts(s)}</span>
                </span>
              ))}
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {FLOOR_AREAS.filter((a) => area === 'All' || a === area).map((a) => {
              const list = tables.filter((t) => t.area === a)
              const cols = Math.max(...list.map((t) => t.col))
              return (
                <Card
                  key={a}
                  title={a}
                  subtitle={`${list.length} tables · ${list.reduce((s, t) => s + t.seats, 0)} seats`}
                  className={cn(area !== 'All' && 'lg:col-span-2')}
                  actions={<Badge tone="green">{list.filter((t) => t.status === 'Available').length} free</Badge>}
                >
                  <div
                    className="grid gap-3 rounded-xl bg-[radial-gradient(circle,#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] p-3"
                    style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
                  >
                    {list.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSelected(t)}
                        style={{ gridColumn: t.col, gridRow: t.row }}
                        className={cn(
                          'relative flex min-h-24 flex-col items-center justify-center border-2 p-2 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md',
                          t.shape === 'round' ? 'mx-auto aspect-square w-full max-w-28 rounded-full' : t.shape === 'square' ? 'rounded-xl' : 'rounded-2xl',
                          statusStyle[t.status],
                        )}
                      >
                        <span className="text-base font-bold">{t.name}</span>
                        <span className="flex items-center gap-1 text-[11px] opacity-80">
                          <Users size={11} />
                          {t.status === 'Occupied' ? `${t.guests}/${t.seats}` : t.seats}
                        </span>
                        {t.status === 'Occupied' && t.seatedAt && (
                          <span className="mt-0.5 flex items-center gap-0.5 text-[10px] font-semibold">
                            <Clock size={10} /> {Math.round((Date.now() - new Date(t.seatedAt).getTime()) / 60000)}m
                          </span>
                        )}
                        {t.status === 'Reserved' && t.reservedFor && <span className="mt-0.5 line-clamp-1 text-[10px]">{t.reservedFor.split('·')[1]?.trim()}</span>}
                        {t.status === 'Cleaning' && <span className="text-[10px]">cleaning…</span>}
                      </button>
                    ))}
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {tab === 'reservations' && (
        <ReservationsTab
          reservations={reservations}
          tables={tables}
          onUpdate={(r) => resQ.setData((prev) => (prev ?? []).map((x) => (x.id === r.id ? r : x)))}
          onSeat={(r, tableId) => {
            resQ.setData((prev) => (prev ?? []).map((x) => (x.id === r.id ? { ...x, status: 'Seated', table: tableId } : x)))
            seat(tableId, r.guest, r.party)
          }}
        />
      )}

      {tab === 'waitlist' && (
        <WaitlistTab
          waitlist={waitlist}
          tables={tables}
          reservations={reservations}
          onAdd={() => setWaitOpen(true)}
          onNotify={(w) => {
            waitQ.setData((prev) => (prev ?? []).map((x) => (x.id === w.id ? { ...x, notified: true } : x)))
            notify(`SMS sent to ${w.guest}: “Your table is almost ready”`, 'info')
          }}
          onSeat={(w, tableId) => {
            waitQ.setData((prev) => (prev ?? []).filter((x) => x.id !== w.id))
            seat(tableId, w.guest, w.party)
          }}
          onRemove={(w) => waitQ.setData((prev) => (prev ?? []).filter((x) => x.id !== w.id))}
        />
      )}

      {tab === 'turnover' && <TurnoverTab tables={tables} transfers={transfers} />}

      {tab === 'ai' && (
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <Card title="No-show prediction" subtitle="Risk scored from guest history, lead time, channel & confirmation status" flush>
              <ul className="divide-y divide-slate-100">
                {[...upcoming]
                  .sort((a, b) => b.noShowRisk - a.noShowRisk)
                  .map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                      <div className="min-w-40 flex-1">
                        <p className="font-medium text-slate-800">{r.guest}</p>
                        <p className="text-xs text-slate-500">
                          {fmtTime(r.time)} · {r.party} guests · {r.source} · {r.visits} prior visits
                        </p>
                      </div>
                      <div className="w-40">
                        <ProgressBar value={r.noShowRisk * 100} tone={r.noShowRisk > 0.5 ? 'red' : r.noShowRisk > 0.3 ? 'yellow' : 'green'} showLabel />
                      </div>
                      <Button size="xs" variant="outline" icon={MessageSquare} onClick={() => notify(`WhatsApp confirmation sent to ${r.guest}`, 'info')}>
                        Remind
                      </Button>
                    </li>
                  ))}
              </ul>
            </Card>
            <Card title="Seating optimisation" subtitle="Best-fit table for each waiting party (minimises empty seats, respects upcoming bookings)" flush>
              <ul className="divide-y divide-slate-100">
                {waitlist.map((w) => {
                  const best = bestTable(tables, w.party, w.preference)
                  return (
                    <li key={w.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                      <Sparkles size={16} className="text-violet-500" />
                      <span className="flex-1">
                        <span className="font-medium text-slate-800">{w.guest}</span> ({w.party}) →{' '}
                        {best ? (
                          <span className="font-semibold text-violet-700">
                            {best.name} · {best.area} · {best.seats} seats
                          </span>
                        ) : (
                          <span className="text-slate-500">no fit now — next free in ~{w.quotedMins} min</span>
                        )}
                      </span>
                      {best && (
                        <Button
                          size="xs"
                          variant="ai"
                          onClick={() => {
                            waitQ.setData((prev) => (prev ?? []).filter((x) => x.id !== w.id))
                            seat(best.id, w.guest, w.party)
                          }}
                        >
                          Seat now
                        </Button>
                      )}
                    </li>
                  )
                })}
                {waitlist.length === 0 && <li className="px-5 py-6 text-center text-sm text-slate-400">Waiting list is empty</li>}
              </ul>
            </Card>
          </div>
          <AIPanel module="tables" title="AI no-show & seating" subtitle="Predictions refresh every 5 minutes" />
        </div>
      )}

      <TableModal key={selected?.id ?? "none"} table={selected} tables={tables} onClose={() => setSelected(null)} onPatch={patchTable} onSeat={seat} onTransfer={transfer} clearFields={clearFields} />

      <ReservationModal
        open={resOpen}
        onClose={() => setResOpen(false)}
        onSave={async (r) => {
          await createReservation(r)
          resQ.setData((prev) => [r, ...(prev ?? [])])
          setResOpen(false)
          notify(`Reservation for ${r.guest} (${r.party}) at ${fmtTime(r.time)} confirmed`)
        }}
      />
      <WaitlistModal
        open={waitOpen}
        onClose={() => setWaitOpen(false)}
        onSave={(w) => {
          waitQ.setData((prev) => [...(prev ?? []), w])
          setWaitOpen(false)
          notify(`${w.guest} added to waiting list · quoted ${w.quotedMins} min`)
        }}
      />
    </div>
  )
}

function bestTable(tables: DiningTable[], party: number, pref: FloorArea | 'Any') {
  return tables
    .filter((t) => t.status === 'Available' && t.seats >= party && (pref === 'Any' || t.area === pref || t.seats - party <= 2))
    .sort((a, b) => a.seats - party - (b.seats - party) || Number(b.area === pref) - Number(a.area === pref))[0]
}

/* ------------------------------------------------------------------ */

function TableModal({
  table,
  tables,
  onClose,
  onPatch,
  onSeat,
  onTransfer,
  clearFields,
}: {
  table: DiningTable | null
  tables: DiningTable[]
  onClose: () => void
  onPatch: (id: string, p: Partial<DiningTable>) => void
  onSeat: (id: string, name: string, guests: number) => void
  onTransfer: (from: DiningTable, to: string) => void
  clearFields: Partial<DiningTable>
}) {
  const notify = useToast()
  const [party, setParty] = useState(2)
  const [name, setName] = useState('')
  const [to, setTo] = useState('')
  if (!table) return null
  const free = tables.filter((t) => t.status === 'Available' && t.id !== table.id && t.seats >= (table.guests ?? 1))
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={
        <span className="flex items-center gap-2">
          Table {table.name} <StatusBadge status={table.status} />
        </span>
      }
      description={`${table.area} · ${table.seats} seats · ${table.shape}`}
    >
      <div className="space-y-4">
        {table.status === 'Occupied' && (
          <>
            <DescriptionList
              items={[
                { label: 'Guest', value: table.guestName ?? '—' },
                { label: 'Party', value: `${table.guests} of ${table.seats}` },
                { label: 'Server', value: table.server ?? '—' },
                { label: 'Seated', value: table.seatedAt ? timeAgo(table.seatedAt) : '—' },
                { label: 'Open bill', value: formatCurrency(table.billTotal ?? 0) },
              ]}
            />
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-slate-700">
                <ArrowRightLeft size={14} /> Transfer table
              </p>
              <div className="flex gap-2">
                <Select value={to} onChange={(e) => setTo(e.target.value)} placeholder="Move to…" options={free.map((t) => ({ value: t.id, label: `${t.name} · ${t.area} · ${t.seats}` }))} />
                <Button variant="outline" disabled={!to} onClick={() => onTransfer(table, to)}>
                  Move
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => notify(`Bill for ${table.name} printed`, 'info')}>
                Print bill
              </Button>
              <Button
                onClick={() => {
                  onPatch(table.id, { ...clearFields, status: 'Cleaning' })
                  notify(`${table.name} closed — sent to housekeeping`)
                }}
              >
                Close & clean
              </Button>
            </div>
          </>
        )}
        {table.status === 'Available' && (
          <>
            <div className="grid grid-cols-[1fr_90px] gap-2">
              <Field label="Guest name">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Walk-in" />
              </Field>
              <Field label="Party">
                <Input type="number" min={1} max={table.seats + 2} value={party} onChange={(e) => setParty(Number(e.target.value))} />
              </Field>
            </div>
            {party > table.seats && <p className="text-xs text-amber-600">Party exceeds table capacity — consider combining tables.</p>}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => (onPatch(table.id, { status: 'Reserved', reservedFor: 'Held · next booking' }), notify(`${table.name} held`))}>
                Hold / reserve
              </Button>
              <Button icon={Users} onClick={() => (onSeat(table.id, name || 'Walk-in', party), onClose())}>
                Seat walk-in
              </Button>
            </div>
          </>
        )}
        {table.status === 'Reserved' && (
          <>
            <p className="rounded-lg bg-violet-50 p-3 text-sm text-violet-800">Reserved for {table.reservedFor}</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => (onPatch(table.id, { ...clearFields, status: 'Available' }), notify(`${table.name} released`, 'info'))}>
                Release (no-show)
              </Button>
              <Button onClick={() => (onSeat(table.id, table.reservedFor?.split('·')[0]?.trim() ?? 'Reservation', table.seats), onClose())}>Guests arrived</Button>
            </div>
          </>
        )}
        {table.status === 'Cleaning' && (
          <Button block variant="success" onClick={() => (onPatch(table.id, { status: 'Available' }), notify(`${table.name} is ready for guests`))}>
            Mark clean & available
          </Button>
        )}
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */

function ReservationsTab({
  reservations,
  tables,
  onUpdate,
  onSeat,
}: {
  reservations: Reservation[]
  tables: DiningTable[]
  onUpdate: (r: Reservation) => void
  onSeat: (r: Reservation, tableId: string) => void
}) {
  const notify = useToast()
  const [status, setStatus] = useState('')
  const [source, setSource] = useState('')
  const [sel, setSel] = useState<Reservation | null>(null)
  const [tableId, setTableId] = useState('')
  const rows = reservations.filter((r) => (!status || r.status === status) && (!source || r.source === source)).sort((a, b) => a.time.localeCompare(b.time))
  const columns: Column<Reservation>[] = [
    { key: 'time', header: 'Time', sortable: true, render: (r) => <span className="font-medium">{new Date(r.time).toDateString() === new Date().toDateString() ? fmtTime(r.time) : formatDate(r.time, true)}</span> },
    {
      key: 'guest',
      header: 'Guest',
      render: (r) => (
        <div>
          <p className="font-medium text-slate-900">{r.guest}</p>
          <p className="text-xs text-slate-500">{r.phone}</p>
        </div>
      ),
    },
    { key: 'party', header: 'Party', align: 'center' },
    { key: 'table', header: 'Table / Area', render: (r) => (r.table ? <Badge tone="blue">{r.table}</Badge> : <span className="text-slate-500">{r.area}</span>) },
    { key: 'source', header: 'Source', render: (r) => <Badge tone={r.source === 'Walk-in' ? 'gray' : r.source === 'Phone' ? 'teal' : 'purple'}>{r.source}</Badge> },
    { key: 'occasion', header: 'Occasion', render: (r) => r.occasion ?? '—' },
    {
      key: 'noShowRisk',
      header: 'No-show risk',
      sortable: true,
      render: (r) =>
        ['Confirmed', 'Pending'].includes(r.status) ? (
          <span className={cn('text-xs font-semibold', r.noShowRisk > 0.5 ? 'text-red-600' : r.noShowRisk > 0.3 ? 'text-amber-600' : 'text-emerald-600')}>{Math.round(r.noShowRisk * 100)}%</span>
        ) : (
          '—'
        ),
    },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ]
  const free = sel ? tables.filter((t) => t.status === 'Available' || t.id === sel.table).filter((t) => t.seats >= sel.party) : []
  return (
    <Card title="Online & walk-in reservations" flush>
      <DataTable
        columns={columns}
        data={rows}
        rowKey={(r) => r.id}
        searchKeys={['guest', 'phone', 'table']}
        searchPlaceholder="Search guest or phone…"
        onRowClick={(r) => (setSel(r), setTableId(r.table ?? ''))}
        toolbar={
          <>
            <Select value={source} onChange={(e) => setSource(e.target.value)} options={['Online', 'Website', 'Google', 'Phone', 'Walk-in']} placeholder="All sources" className="h-9 w-36" />
            <Select value={status} onChange={(e) => setStatus(e.target.value)} options={['Confirmed', 'Pending', 'Seated', 'Cancelled', 'Completed']} placeholder="All statuses" className="h-9 w-36" />
          </>
        }
      />
      <Drawer
        open={!!sel}
        onClose={() => setSel(null)}
        title={sel?.guest}
        description={sel ? `${sel.party} guests · ${formatDate(sel.time, true)}` : ''}
        footer={
          sel &&
          ['Confirmed', 'Pending'].includes(sel.status) && (
            <>
              <Button variant="ghost" onClick={() => (onUpdate({ ...sel, status: 'Cancelled' }), setSel(null), notify('Reservation cancelled', 'info'))}>
                Cancel booking
              </Button>
              {sel.status === 'Pending' && (
                <Button variant="outline" onClick={() => (onUpdate({ ...sel, status: 'Confirmed' }), setSel({ ...sel, status: 'Confirmed' }), notify('Reservation confirmed · SMS sent'))}>
                  Confirm
                </Button>
              )}
              <Button disabled={!tableId} onClick={() => (onSeat(sel, tableId), setSel(null))}>
                Seat at {tableId || '…'}
              </Button>
            </>
          )
        }
      >
        {sel && (
          <div className="space-y-5">
            <DescriptionList
              items={[
                { label: 'Status', value: <StatusBadge status={sel.status} /> },
                { label: 'Phone', value: sel.phone },
                { label: 'Source', value: sel.source },
                { label: 'Preferred area', value: sel.area },
                { label: 'Occasion', value: sel.occasion ?? '—' },
                { label: 'Guest visits', value: `${sel.visits} previous visits` },
                { label: 'No-show risk (AI)', value: `${Math.round(sel.noShowRisk * 100)}%` },
                { label: 'Notes', value: sel.notes ?? '—' },
              ]}
            />
            {['Confirmed', 'Pending'].includes(sel.status) && (
              <Field label="Assign table" hint="Only tables that fit the party are listed">
                <Select value={tableId} onChange={(e) => setTableId(e.target.value)} placeholder="Choose a table…" options={free.map((t) => ({ value: t.id, label: `${t.name} · ${t.area} · ${t.seats} seats · ${t.status}` }))} />
              </Field>
            )}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" icon={Phone} onClick={() => notify(`Calling ${sel.phone}…`, 'info')}>
                Call
              </Button>
              <Button size="sm" variant="outline" icon={MessageSquare} onClick={() => notify('Reminder sent on WhatsApp', 'info')}>
                Send reminder
              </Button>
            </div>
          </div>
        )}
      </Drawer>
    </Card>
  )
}

function WaitlistTab({
  waitlist,
  tables,
  reservations,
  onAdd,
  onNotify,
  onSeat,
  onRemove,
}: {
  waitlist: WaitlistEntry[]
  tables: DiningTable[]
  reservations: Reservation[]
  onAdd: () => void
  onNotify: (w: WaitlistEntry) => void
  onSeat: (w: WaitlistEntry, tableId: string) => void
  onRemove: (w: WaitlistEntry) => void
}) {
  const guests = [...reservations].sort((a, b) => b.visits - a.visits).slice(0, 8)
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card title="Waiting list" subtitle="Walk-ins queued for a table" actions={<Button size="sm" icon={UserPlus} onClick={onAdd}>Add party</Button>}>
        {waitlist.length === 0 ? (
          <EmptyState icon={Hourglass} title="No one is waiting" description="Walk-ins you add will appear here with live wait timers." />
        ) : (
          <ul className="space-y-3">
            {waitlist.map((w, i) => {
              const waited = Math.round((Date.now() - new Date(w.addedAt).getTime()) / 60000)
              const best = bestTable(tables, w.party, w.preference)
              return (
                <li key={w.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 p-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">{i + 1}</span>
                  <div className="min-w-40 flex-1">
                    <p className="font-medium text-slate-900">
                      {w.guest} <span className="text-sm font-normal text-slate-500">· party of {w.party}</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {w.phone} · prefers {w.preference}
                    </p>
                  </div>
                  <div className="w-28">
                    <p className={cn('text-sm font-semibold', waited > w.quotedMins ? 'text-red-600' : 'text-slate-800')}>
                      {waited} / {w.quotedMins} min
                    </p>
                    <ProgressBar value={waited} max={w.quotedMins} tone={waited > w.quotedMins ? 'red' : 'blue'} />
                  </div>
                  <div className="flex gap-1.5">
                    <Button size="xs" variant={w.notified ? 'ghost' : 'outline'} icon={BellRing} onClick={() => onNotify(w)}>
                      {w.notified ? 'Notified' : 'Notify'}
                    </Button>
                    <Button size="xs" disabled={!best} onClick={() => best && onSeat(w, best.id)}>
                      {best ? `Seat at ${best.name}` : 'No table'}
                    </Button>
                    <Button size="xs" variant="ghost" onClick={() => onRemove(w)}>
                      Remove
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
      <Card title="Guest book" subtitle="Regulars & preferences" flush>
        <ul className="divide-y divide-slate-100">
          {guests.map((g) => (
            <li key={g.id} className="px-5 py-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-800">{g.guest}</span>
                <Badge tone={g.visits >= 10 ? 'orange' : g.visits >= 3 ? 'blue' : 'gray'}>{g.visits >= 10 ? 'VIP' : g.visits >= 3 ? 'Regular' : 'New'} · {g.visits} visits</Badge>
              </div>
              <p className="text-xs text-slate-500">{g.notes ?? g.occasion ?? `Prefers ${g.area}`}</p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

function TurnoverTab({ tables, transfers }: { tables: DiningTable[]; transfers: Transfer[] }) {
  const occupied = tables.filter((t) => t.status === 'Occupied' && t.seatedAt).sort((a, b) => a.seatedAt!.localeCompare(b.seatedAt!))
  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <Card title="Table turnover by hour" subtitle="Turns per table and average dining duration" className="xl:col-span-2">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={turnoverByHour} margin={{ left: -10, right: 8, top: 8 }}>
              <CartesianGrid {...chartGrid} vertical={false} />
              <XAxis dataKey="h" {...chartAxis} tickFormatter={(v: string) => `${v}:00`} />
              <YAxis yAxisId="t" {...chartAxis} />
              <YAxis yAxisId="m" orientation="right" {...chartAxis} />
              <Tooltip {...chartTooltip} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="t" dataKey="turns" name="Turns / table" fill={chartColors[0]} radius={[4, 4, 0, 0]} />
              <Line yAxisId="m" dataKey="avgMins" name="Avg dining (min)" stroke={chartColors[1]} strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card title="Longest-seated tables" flush>
        <ul className="divide-y divide-slate-100">
          {occupied.map((t) => {
            const mins = Math.round((Date.now() - new Date(t.seatedAt!).getTime()) / 60000)
            return (
              <li key={t.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                <span className="w-10 font-semibold">{t.name}</span>
                <span className="flex-1 truncate text-slate-500">{t.guestName}</span>
                <span className={cn('font-medium', mins > 60 ? 'text-red-600' : 'text-slate-700')}>{mins} min</span>
              </li>
            )
          })}
        </ul>
      </Card>
      <Card title="Table transfers" subtitle="Guests moved between tables today" flush className="xl:col-span-3">
        <ul className="divide-y divide-slate-100">
          {transfers.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
              <Badge tone="gray">{t.from}</Badge>
              <ArrowRightLeft size={14} className="text-slate-400" />
              <Badge tone="blue">{t.to}</Badge>
              <span className="flex-1 text-slate-700">{t.guest}</span>
              <span className="text-xs text-slate-500">
                by {t.by} · {timeAgo(t.at)}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function ReservationModal({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (r: Reservation) => void }) {
  const [f, setF] = useState({ guest: '', phone: '', party: 2, date: new Date().toISOString().slice(0, 10), time: '20:00', area: 'Main Hall' as FloorArea, source: 'Phone' as Reservation['source'], occasion: '', notes: '' })
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New reservation"
      description="Guest receives an SMS / WhatsApp confirmation automatically."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!f.guest || !f.phone}
            onClick={() =>
              onSave({
                id: `rs-${Date.now()}`,
                guest: f.guest,
                phone: f.phone,
                party: f.party,
                time: new Date(`${f.date}T${f.time}`).toISOString(),
                area: f.area,
                source: f.source,
                status: 'Confirmed',
                occasion: f.occasion || undefined,
                notes: f.notes || undefined,
                noShowRisk: f.source === 'Phone' ? 0.1 : 0.25,
                visits: 0,
              })
            }
          >
            Book table
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Guest name" required>
          <Input value={f.guest} onChange={(e) => setF({ ...f, guest: e.target.value })} />
        </Field>
        <Field label="Phone" required>
          <Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+92 3xx xxxxxxx" />
        </Field>
        <Field label="Date">
          <Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        </Field>
        <Field label="Time">
          <Input type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} />
        </Field>
        <Field label="Party size">
          <Input type="number" min={1} value={f.party} onChange={(e) => setF({ ...f, party: Number(e.target.value) })} />
        </Field>
        <Field label="Area">
          <Select value={f.area} onChange={(e) => setF({ ...f, area: e.target.value as FloorArea })} options={FLOOR_AREAS} />
        </Field>
        <Field label="Booking source">
          <Select value={f.source} onChange={(e) => setF({ ...f, source: e.target.value as Reservation['source'] })} options={['Phone', 'Online', 'Website', 'Google', 'Walk-in']} />
        </Field>
        <Field label="Occasion">
          <Input value={f.occasion} onChange={(e) => setF({ ...f, occasion: e.target.value })} placeholder="Birthday, anniversary…" />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} rows={2} placeholder="Allergies, high chair, seating preference…" />
        </Field>
      </div>
    </Modal>
  )
}

function WaitlistModal({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (w: WaitlistEntry) => void }) {
  const [f, setF] = useState({ guest: '', phone: '', party: 2, preference: 'Any' as FloorArea | 'Any' })
  const quote = 10 + f.party * 3
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Add to waiting list"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!f.guest}
            onClick={() => {
              onSave({ id: `wl-${Date.now()}`, guest: f.guest, phone: f.phone, party: f.party, preference: f.preference, addedAt: new Date().toISOString(), quotedMins: quote, notified: false })
              setF({ guest: '', phone: '', party: 2, preference: 'Any' })
            }}
          >
            Add · quote {quote} min
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Guest name" required>
          <Input value={f.guest} onChange={(e) => setF({ ...f, guest: e.target.value })} />
        </Field>
        <Field label="Phone" hint="We'll text them when the table is ready">
          <Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Party">
            <Input type="number" min={1} value={f.party} onChange={(e) => setF({ ...f, party: Number(e.target.value) })} />
          </Field>
          <Field label="Preference">
            <Select value={f.preference} onChange={(e) => setF({ ...f, preference: e.target.value as FloorArea | 'Any' })} options={['Any', ...FLOOR_AREAS]} />
          </Field>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-violet-600">
          <Sparkles size={13} /> AI-quoted wait time based on current turnover: {quote} min
        </p>
      </div>
    </Modal>
  )
}
