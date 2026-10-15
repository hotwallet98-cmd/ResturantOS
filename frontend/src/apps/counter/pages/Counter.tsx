import {
  Banknote,
  Bike,
  ChefHat,
  CheckCircle2,
  ConciergeBell,
  CreditCard,
  HandPlatter,
  PackageCheck,
  Phone,
  PhoneCall,
  PhoneMissed,
  PhoneOff,
  Receipt,
  RotateCcw,
  Smartphone,
  Store,
  Timer,
  Utensils,
  XCircle,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { FlowStatusBadge, ItemLines } from '@/shared/components/flow/FlowBits'
import { Badge, Button, Card, EmptyState, PageHeader, Select, StatCard, useToast } from '@/shared/components/ui'
import { chime } from '@/shared/lib/chime'
import { cn } from '@/shared/lib/cn'
import { formatCurrency, timeAgo } from '@/shared/lib/format'
import type { CallState, FlowOrder, FlowState, PayMethod } from '@/shared/services/flow'
import { assignRider, cancelOrder, orderTotal, payTable, resetFlow, setOrderStatus, tableOrders, useFlow } from '@/shared/services/flow'
import type { CallOutcome } from '@/shared/services/verifyCall'
import { confirmManually, startVerificationCall } from '@/shared/services/verifyCall'

export type CounterView = 'live' | 'billing' | 'deliveries'

const callMeta: Record<CallState, { label: string; icon: typeof Phone; tone: string }> = {
  dialing: { label: 'Dialing…', icon: PhoneCall, tone: 'text-violet-600' },
  ringing: { label: 'Ringing…', icon: PhoneCall, tone: 'text-violet-600' },
  talking: { label: 'On call', icon: Phone, tone: 'text-emerald-600' },
  confirmed: { label: 'Customer confirmed', icon: CheckCircle2, tone: 'text-emerald-600' },
  declined: { label: 'Customer declined', icon: PhoneOff, tone: 'text-red-600' },
  no_answer: { label: 'No answer', icon: PhoneMissed, tone: 'text-amber-600' },
}

function TypeIcon({ o }: { o: FlowOrder }) {
  const Icon = o.type === 'Dine-in' ? Utensils : o.type === 'Delivery' ? Bike : Store
  return <Icon size={15} className="text-slate-400" />
}
const who = (o: FlowOrder) => (o.table ? `Table ${o.table}` : (o.customer?.name ?? o.type))

export default function Counter({ view }: { view: CounterView }) {
  const flow = useFlow()
  const notify = useToast()

  // Counter hears about every new order and every ready order
  const seen = useRef(new Set(flow.orders.map((o) => `${o.id}:${o.status}`)))
  useEffect(() => {
    for (const o of flow.orders) {
      const key = `${o.id}:${o.status}`
      if (seen.current.has(key)) continue
      seen.current.add(key)
      if (o.status === 'Placed') {
        chime()
        notify(`New app order #${o.orderNo} from ${o.customer?.name} — verification call starting`, 'info')
      }
      if (o.status === 'Received' && o.source === 'Waiter') notify(`#${o.orderNo} from ${o.waiter} (Table ${o.table}) logged & forwarded to kitchen`, 'info')
      if (o.status === 'Ready') {
        chime()
        notify(`#${o.orderNo} ready — ${o.type === 'Dine-in' ? `waiter ${o.waiter} alerted` : 'pack it for the rider'}`)
      }
    }
  }, [flow.orders, notify])

  const verifying = flow.orders.filter((o) => o.status === 'Placed' || o.status === 'Verifying')
  const inKitchen = flow.orders.filter((o) => o.status === 'Received' || o.status === 'Preparing')
  const ready = flow.orders.filter((o) => o.status === 'Ready')
  const bills = flow.tables.filter((t) => t.billRequested)

  const titles: Record<CounterView, [string, string]> = {
    live: ['Main Counter', 'Orders from waiters and the customer app, logged and forwarded to the kitchen'],
    billing: ['Table Billing', 'Settle dine-in bills with tip, then free the table'],
    deliveries: ['Deliveries & Riders', 'Packing, rider assignment and pickups'],
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={view === 'billing' ? Receipt : view === 'deliveries' ? Bike : ConciergeBell}
        title={titles[view][0]}
        description={titles[view][1]}
        actions={
          <Button variant="ghost" size="sm" icon={RotateCcw} onClick={() => (resetFlow(), notify('Demo data reset', 'info'))}>
            Reset demo
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Verifying by call" value={verifying.length} icon={PhoneCall} tone="purple" hint="customer app orders" />
        <StatCard label="In kitchen" value={inKitchen.length} icon={ChefHat} tone="amber" />
        <StatCard label="Ready" value={ready.length} icon={HandPlatter} tone="green" hint="waiting for waiter / packing" />
        <StatCard label="Bills requested" value={bills.length} icon={Receipt} tone="brand" />
      </div>

      {view === 'live' && <LiveView flow={flow} verifying={verifying} />}
      {view === 'billing' && <BillingView flow={flow} />}
      {view === 'deliveries' && <DeliveriesView flow={flow} />}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Live orders                                                         */
/* ------------------------------------------------------------------ */

function LiveView({ flow, verifying }: { flow: FlowState; verifying: FlowOrder[] }) {
  const cols: { title: string; hint: string; statuses: FlowOrder['status'][]; accent: string }[] = [
    { title: 'Sent to kitchen', hint: 'Logged + forwarded', statuses: ['Received', 'Preparing'], accent: 'bg-sky-500' },
    { title: 'Ready', hint: 'Waiter alerted / pack for rider', statuses: ['Ready'], accent: 'bg-emerald-500' },
    { title: 'Packed / picked up', hint: 'Waiting for rider or on the table', statuses: ['Packed', 'PickedUp'], accent: 'bg-teal-500' },
  ]
  const log = [...flow.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 12)

  return (
    <>
      <Card title="Verification calls" subtitle="The voice agent calls every customer-app order before it goes to the kitchen" flush>
        {verifying.length === 0 ? (
          <EmptyState icon={PhoneCall} title="No orders waiting for a call" description="New customer-app orders appear here while the agent confirms them by phone." />
        ) : (
          <div className="grid gap-4 p-4 lg:grid-cols-2">
            {verifying.map((o) => (
              <CallCard key={o.id} o={o} />
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        {cols.map((c) => {
          const list = flow.orders.filter((o) => c.statuses.includes(o.status))
          return (
            <div key={c.title} className="rounded-xl bg-slate-100/80 p-3">
              <div className="mb-3 flex items-center gap-2 px-1">
                <span className={cn('h-2.5 w-2.5 rounded-full', c.accent)} />
                <span className="text-sm font-semibold text-slate-800">{c.title}</span>
                <span className="text-xs text-slate-500">{c.hint}</span>
                <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-600">{list.length}</span>
              </div>
              <div className="space-y-2">
                {list.map((o) => (
                  <OrderTile key={o.id} o={o} />
                ))}
                {list.length === 0 && <p className="py-6 text-center text-xs text-slate-400">Nothing here</p>}
              </div>
            </div>
          )
        })}
      </div>

      <Card title="Order log" subtitle="Every order the counter received today" flush>
        <ul className="divide-y divide-slate-100">
          {log.map((o) => {
            return (
              <li key={o.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                <TypeIcon o={o} />
                <span className="w-14 font-semibold text-slate-900">#{o.orderNo}</span>
                <span className="w-32 truncate text-slate-600">{who(o)}</span>
                <span className="hidden w-28 text-xs text-slate-500 sm:block">{o.source}</span>
                <span className="flex-1 text-xs text-slate-400">{timeAgo(o.createdAt)}</span>
                <span className="hidden text-slate-700 sm:block">{formatCurrency(orderTotal(o))}</span>
                <FlowStatusBadge status={o.status} />
              </li>
            )
          })}
        </ul>
      </Card>
    </>
  )
}

function CallCard({ o }: { o: FlowOrder }) {
  const notify = useToast()
  const [outcome, setOutcome] = useState<CallOutcome>('confirm')
  const call = o.call
  const meta = call ? callMeta[call.state] : null
  const live = call && ['dialing', 'ringing', 'talking'].includes(call.state)
  return (
    <div className="flex flex-col rounded-xl border border-violet-200 bg-violet-50/40">
      <div className="flex items-start gap-3 border-b border-violet-100 px-4 py-3">
        <span className={cn('relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-violet-200', meta?.tone)}>
          {live && <span className="absolute inset-0 animate-ping rounded-full bg-violet-400/30" />}
          {meta ? <meta.icon size={18} className="relative" /> : <PhoneCall size={18} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-semibold text-slate-900">
            #{o.orderNo} · {o.customer?.name}
            <Badge tone="purple">{meta?.label ?? 'Queued'}</Badge>
          </p>
          <p className="text-xs text-slate-500">
            {o.customer?.phone} · {o.customer?.address}
          </p>
        </div>
        <span className="text-sm font-semibold text-slate-900">{formatCurrency(orderTotal(o))}</span>
      </div>
      <div className="flex-1 space-y-2 px-4 py-3">
        <ItemLines order={o} compact />
        {call && call.lines.length > 0 && (
          <ul className="space-y-1.5 rounded-lg bg-white p-2.5 text-xs">
            {call.lines.map((l, i) => (
              <li key={i} className={cn(l.who === 'customer' && 'text-right')}>
                <span className={cn('inline-block max-w-[90%] rounded-lg px-2 py-1', l.who === 'agent' ? 'bg-violet-100 text-violet-900' : 'bg-emerald-100 text-emerald-900')}>
                  <span className="font-semibold">{l.who === 'agent' ? 'Agent' : 'Customer'}: </span>
                  {l.text}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-violet-100 px-4 py-2.5">
        {!live && (
          <>
            <Select
              value={outcome}
              onChange={(e) => setOutcome(e.target.value as CallOutcome)}
              className="h-8 w-40 text-xs"
              aria-label="Demo outcome"
              options={[
                { value: 'confirm', label: 'Demo: says yes' },
                { value: 'decline', label: 'Demo: says no' },
                { value: 'no_answer', label: 'Demo: no answer' },
              ]}
            />
            <Button size="sm" variant="outline" icon={PhoneCall} onClick={() => startVerificationCall(o.id, outcome)}>
              {call ? 'Call again' : 'Call now'}
            </Button>
          </>
        )}
        <Button size="sm" variant="success" icon={CheckCircle2} className="ml-auto" onClick={() => (confirmManually(o.id), notify(`#${o.orderNo} confirmed manually and sent to kitchen`))}>
          Confirm
        </Button>
        <Button size="sm" variant="ghost" icon={XCircle} onClick={() => (cancelOrder(o.id), notify(`#${o.orderNo} cancelled`, 'info'))}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

function OrderTile({ o, children }: { o: FlowOrder; children?: ReactNode }) {
  const notify = useToast()
  const flow = useFlow()
  const rider = flow.riders.find((r) => r.id === o.riderId)
  return (
    <div className="rounded-lg bg-white p-3 shadow-sm ring-1 ring-slate-200">
      <div className="mb-1.5 flex items-center gap-2">
        <TypeIcon o={o} />
        <span className="font-bold text-slate-900">#{o.orderNo}</span>
        <span className="truncate text-xs text-slate-600">{who(o)}</span>
        <span className="ml-auto flex items-center gap-1 text-[11px] text-slate-400">
          <Timer size={11} /> {timeAgo(o.createdAt)}
        </span>
      </div>
      <ItemLines order={o} compact />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <FlowStatusBadge status={o.status} />
        {o.type === 'Dine-in' && o.status === 'Ready' && <span className="text-[11px] text-emerald-700">Waiter {o.waiter} alerted</span>}
        {o.type === 'Delivery' && rider && <span className="text-[11px] text-slate-500">Rider {rider.name}</span>}
        {o.type === 'Delivery' && o.status === 'Ready' && (
          <Button size="xs" className="ml-auto" icon={PackageCheck} onClick={() => (setOrderStatus(o.id, 'Packed'), notify(`#${o.orderNo} packed — waiting for rider`))}>
            Mark packed
          </Button>
        )}
        {children}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Billing                                                             */
/* ------------------------------------------------------------------ */

function BillingView({ flow }: { flow: FlowState }) {
  const notify = useToast()
  const occupied = flow.tables.filter((t) => t.status === 'Occupied').sort((a, b) => Number(!!b.billRequested) - Number(!!a.billRequested))
  const [sel, setSel] = useState<string | null>(occupied.find((t) => t.billRequested)?.id ?? occupied[0]?.id ?? null)
  const [tipPct, setTipPct] = useState<number | null>(0)
  const [tipCustom, setTipCustom] = useState('')
  const [method, setMethod] = useState<PayMethod>('Cash')
  const table = flow.tables.find((t) => t.id === sel && t.status === 'Occupied')
  const orders = table ? tableOrders(flow, table.id) : []
  const subtotal = orders.reduce((s, o) => s + orderTotal(o), 0)
  const tip = tipPct === null ? Number(tipCustom) || 0 : Math.round(subtotal * tipPct) / 100
  const unserved = orders.some((o) => !['Served'].includes(o.status))

  const pay = () => {
    if (!table) return
    payTable(table.id, method, tip)
    notify(`${table.name} paid ${formatCurrency(subtotal + tip)} by ${method} — table freed`)
    setSel(null)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      <Card title="Occupied tables" flush>
        {occupied.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">No occupied tables.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {occupied.map((t) => {
              const total = tableOrders(flow, t.id).reduce((s, o) => s + orderTotal(o), 0)
              return (
                <li key={t.id}>
                  <button type="button" onClick={() => setSel(t.id)} className={cn('flex w-full items-center gap-3 px-5 py-3 text-left text-sm hover:bg-slate-50', sel === t.id && 'bg-brand-50')}>
                    <span className="w-10 font-bold text-slate-900">{t.name}</span>
                    <span className="flex-1 truncate text-slate-600">
                      {t.guestName} · {t.guests}
                    </span>
                    {t.billRequested && <Badge tone="orange">Bill</Badge>}
                    <span className="font-medium">{formatCurrency(total)}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      {table ? (
        <Card title={`Bill · Table ${table.name}`} subtitle={`${table.guestName} · ${table.guests} guests · waiter ${table.server}`}>
          {orders.length === 0 ? (
            <p className="text-sm text-slate-500">No orders on this table yet.</p>
          ) : (
            <div className="space-y-4">
              {orders.map((o) => (
                <div key={o.id} className="rounded-lg border border-slate-100 p-3">
                  <p className="mb-1 flex items-center justify-between text-xs text-slate-500">
                    <span>#{o.orderNo}</span> <FlowStatusBadge status={o.status} />
                  </p>
                  <ItemLines order={o} />
                </div>
              ))}
              {unserved && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Some items are not served yet — check with the waiter before closing.</p>}

              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">Add tip</p>
                <div className="flex flex-wrap gap-2">
                  {[0, 5, 10, 15].map((p) => (
                    <button key={p} type="button" onClick={() => setTipPct(p)} className={cn('rounded-lg border px-3 py-1.5 text-sm', tipPct === p ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200')}>
                      {p === 0 ? 'No tip' : `${p}%`}
                    </button>
                  ))}
                  <input
                    value={tipCustom}
                    onChange={(e) => (setTipPct(null), setTipCustom(e.target.value.replace(/[^\d.]/g, '')))}
                    placeholder="Custom"
                    className={cn('h-9 w-24 rounded-lg border px-2 text-sm', tipPct === null ? 'border-brand-500' : 'border-slate-200')}
                  />
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">Payment</p>
                <div className="grid grid-cols-3 gap-2">
                  {(['Cash', 'Card', 'Easypaisa'] as const).map((m) => {
                    const I = m === 'Cash' ? Banknote : m === 'Card' ? CreditCard : Smartphone
                    return (
                      <button key={m} type="button" onClick={() => setMethod(m)} className={cn('flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium', method === m ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600')}>
                        <I size={16} /> {m}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="space-y-1 border-t border-slate-100 pt-3 text-sm">
                <p className="flex justify-between text-slate-600">
                  <span>Subtotal</span> {formatCurrency(subtotal)}
                </p>
                <p className="flex justify-between text-slate-600">
                  <span>Tip</span> {formatCurrency(tip)}
                </p>
                <p className="flex justify-between text-lg font-semibold text-slate-900">
                  <span>Total</span> {formatCurrency(subtotal + tip)}
                </p>
              </div>
              <Button block size="lg" icon={CheckCircle2} onClick={pay}>
                Receive {formatCurrency(subtotal + tip)} & free table
              </Button>
            </div>
          )}
        </Card>
      ) : (
        <Card>
          <EmptyState icon={Receipt} title="Select a table" description="Tables that asked for the bill are listed first." />
        </Card>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Deliveries                                                          */
/* ------------------------------------------------------------------ */

function DeliveriesView({ flow }: { flow: FlowState }) {
  const notify = useToast()
  const deliveries = flow.orders.filter((o) => o.type === 'Delivery' && ['Received', 'Preparing', 'Ready', 'Packed', 'PickedUp'].includes(o.status))
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Card title="Active deliveries" flush>
        {deliveries.length === 0 ? (
          <EmptyState icon={Bike} title="No active deliveries" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {deliveries.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                <span className="w-14 font-bold text-slate-900">#{o.orderNo}</span>
                <span className="min-w-40 flex-1">
                  <span className="block font-medium text-slate-800">{o.customer?.name}</span>
                  <span className="block truncate text-xs text-slate-500">{o.customer?.address}</span>
                </span>
                <FlowStatusBadge status={o.status} />
                <Select
                  value={o.riderId ?? ''}
                  onChange={(e) => (assignRider(o.id, e.target.value), notify(`Rider assigned to #${o.orderNo} — notified with phone & address`))}
                  placeholder="Assign rider…"
                  className="h-9 w-44"
                  disabled={o.status === 'PickedUp'}
                  options={flow.riders.filter((r) => r.status !== 'Offline' || r.id === o.riderId).map((r) => ({ value: r.id, label: `${r.name} · ${r.status}` }))}
                />
                {o.status === 'Ready' && (
                  <Button size="sm" icon={PackageCheck} onClick={() => setOrderStatus(o.id, 'Packed')}>
                    Packed
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Riders" flush>
        <ul className="divide-y divide-slate-100">
          {flow.riders.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
              <span className={cn('h-2 w-2 rounded-full', r.status === 'Available' ? 'bg-emerald-500' : r.status === 'Offline' ? 'bg-slate-300' : 'bg-amber-500')} />
              <span className="flex-1">
                <span className="block font-medium text-slate-800">{r.name}</span>
                <span className="text-xs text-slate-500">{r.phone}</span>
              </span>
              <span className="text-xs text-slate-500">{r.status}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
