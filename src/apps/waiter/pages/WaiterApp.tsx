import { Armchair, Bell, CalendarCheck, ChevronLeft, ClipboardList, HandPlatter, Receipt, Send, Smartphone, Sparkles, UserPlus, Users } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Cart } from '@/shared/components/flow/flowHelpers'
import { cartCount, cartItems } from '@/shared/components/flow/flowHelpers'
import { FlowStatusBadge, ItemLines, MenuPicker } from '@/shared/components/flow/FlowBits'
import { MobileShell } from '@/shared/components/layout/MobileShell'
import { Button, Modal, useToast } from '@/shared/components/ui'
import { useAuth } from '@/shared/context/AuthContext'
import { chime } from '@/shared/lib/chime'
import { cn } from '@/shared/lib/cn'
import { formatCurrency, timeAgo } from '@/shared/lib/format'
import type { FlowOrder, FlowTable } from '@/shared/services/flow'
import { DEMO_WAITER, orderTotal, requestBill, seatTable, sendTableOrder, setOrderStatus, setTableStatus, tableOrders, useFlow } from '@/shared/services/flow'
import { FLOOR_AREAS } from '@/shared/services/operations'

type Tab = 'tables' | 'orders' | 'alerts'

const tableTone: Record<FlowTable['status'], string> = {
  Available: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  Occupied: 'bg-orange-50 text-orange-900 ring-orange-200',
  Reserved: 'bg-sky-50 text-sky-800 ring-sky-200',
  Cleaning: 'bg-slate-100 text-slate-500 ring-slate-200',
}

export default function WaiterApp() {
  const notify = useToast()
  const { user } = useAuth()
  const flow = useFlow()
  const me = user?.role === 'waiter' ? user.name : DEMO_WAITER
  const [tab, setTab] = useState<Tab>('tables')
  const [area, setArea] = useState<string>('All')
  const [openTable, setOpenTable] = useState<string | null>(null)
  const [ordering, setOrdering] = useState<string | null>(null)

  const dineIn = flow.orders.filter((o) => o.type === 'Dine-in')
  const mine = (o: FlowOrder) => o.waiter === me
  const readyAlerts = dineIn.filter((o) => o.status === 'Ready' && mine(o))
  const active = dineIn.filter((o) => mine(o) && ['Received', 'Preparing', 'Ready', 'PickedUp'].includes(o.status))

  // Ready alert: chime + toast when one of my orders becomes ready
  const seenReady = useRef(new Set(readyAlerts.map((o) => o.id)))
  useEffect(() => {
    for (const o of readyAlerts) {
      if (seenReady.current.has(o.id)) continue
      seenReady.current.add(o.id)
      chime()
      notify(`#${o.orderNo} for table ${o.table} is ready — pick up from kitchen`, 'info')
    }
  }, [readyAlerts, notify])

  if (ordering) return <TakeOrder tableId={ordering} waiter={me} onDone={() => (setOrdering(null), setTab('orders'))} onBack={() => setOrdering(null)} />

  const tables = flow.tables.filter((t) => area === 'All' || t.area === area)
  const table = flow.tables.find((t) => t.id === openTable)

  return (
    <MobileShell
      title="Waiter"
      icon={Smartphone}
      subtitle={`${me} · Floor`}
      tab={tab}
      onTab={setTab}
      tabs={[
        { id: 'tables', label: 'Tables', icon: Armchair },
        { id: 'orders', label: 'My orders', icon: ClipboardList, count: active.length },
        { id: 'alerts', label: 'Ready', icon: Bell, count: readyAlerts.length },
      ]}
    >
      {tab === 'tables' && (
        <>
          {readyAlerts.length > 0 && (
            <button type="button" onClick={() => setTab('alerts')} className="mb-3 flex w-full items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2.5 text-left text-sm font-medium text-white">
              <Bell size={16} className="animate-bounce" />
              {readyAlerts.length} order{readyAlerts.length > 1 ? 's' : ''} ready — pick up from kitchen
            </button>
          )}
          <div className="scrollbar-thin -mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1">
            {['All', ...FLOOR_AREAS].map((a) => (
              <button key={a} type="button" onClick={() => setArea(a)} className={cn('shrink-0 rounded-full px-3 py-1.5 text-xs font-medium', area === a ? 'bg-ink-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200')}>
                {a}
              </button>
            ))}
          </div>
          <div className="mb-3 flex flex-wrap gap-3 text-[11px] text-slate-500">
            {(['Available', 'Occupied', 'Reserved', 'Cleaning'] as const).map((s) => (
              <span key={s} className="flex items-center gap-1">
                <span className={cn('h-2.5 w-2.5 rounded-full ring-1', tableTone[s])} /> {s}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {tables.map((t) => {
              const orders = tableOrders(flow, t.id)
              const ready = orders.some((o) => o.status === 'Ready')
              return (
                <button key={t.id} type="button" onClick={() => setOpenTable(t.id)} className={cn('relative rounded-xl p-3 text-left ring-1', tableTone[t.status], t.server === me && 'ring-2')}>
                  {ready && <span className="absolute top-2 right-2 h-2.5 w-2.5 animate-ping rounded-full bg-emerald-500" />}
                  {t.billRequested && <Receipt size={13} className="absolute top-2 right-2 text-brand-600" />}
                  <p className="text-lg font-bold">{t.name}</p>
                  <p className="flex items-center gap-1 text-[11px] opacity-80">
                    <Users size={11} /> {t.status === 'Occupied' ? `${t.guests}/${t.seats}` : t.seats}
                  </p>
                  <p className="mt-1 truncate text-[11px] font-medium">{t.status === 'Occupied' ? (t.server === me ? 'Mine' : t.server) : t.status === 'Reserved' ? 'Reserved' : t.status === 'Cleaning' ? 'Cleaning' : 'Free'}</p>
                </button>
              )
            })}
          </div>
        </>
      )}

      {tab === 'orders' && (
        <div className="space-y-3">
          {active.length === 0 && <p className="py-10 text-center text-sm text-slate-500">No open orders. Open a table to take one.</p>}
          {active.map((o) => (
            <OrderCard key={o.id} o={o} />
          ))}
        </div>
      )}

      {tab === 'alerts' && (
        <div className="space-y-3">
          {readyAlerts.length === 0 && <p className="py-10 text-center text-sm text-slate-500">Nothing waiting at the kitchen pass.</p>}
          {readyAlerts.map((o) => (
            <OrderCard key={o.id} o={o} />
          ))}
          {active.filter((o) => o.status === 'PickedUp').map((o) => (
            <OrderCard key={o.id} o={o} />
          ))}
        </div>
      )}

      {table && <TableSheet table={table} me={me} onClose={() => setOpenTable(null)} onOrder={() => (setOpenTable(null), setOrdering(table.id))} />}
    </MobileShell>
  )
}

function OrderCard({ o }: { o: FlowOrder }) {
  const notify = useToast()
  return (
    <div className={cn('rounded-xl bg-white p-3 ring-1', o.status === 'Ready' ? 'ring-2 ring-emerald-400' : 'ring-slate-200')}>
      <div className="mb-2 flex items-center gap-2">
        <span className="font-bold text-slate-900">#{o.orderNo}</span>
        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-700">Table {o.table}</span>
        <span className="text-xs text-slate-400">{timeAgo(o.createdAt)}</span>
        <span className="ml-auto">
          <FlowStatusBadge status={o.status} />
        </span>
      </div>
      <ItemLines order={o} compact />
      {o.status === 'Ready' && (
        <Button className="mt-3" block variant="success" icon={HandPlatter} onClick={() => (setOrderStatus(o.id, 'PickedUp'), notify(`Picked up #${o.orderNo}`))}>
          Picked up from kitchen
        </Button>
      )}
      {o.status === 'PickedUp' && (
        <Button className="mt-3" block icon={HandPlatter} onClick={() => (setOrderStatus(o.id, 'Served'), notify(`#${o.orderNo} served at ${o.table}`))}>
          Mark as served
        </Button>
      )}
    </div>
  )
}

/** Table actions: seat (reservation check / walk-in), take order, serve, ask for bill. */
function TableSheet({ table, me, onClose, onOrder }: { table: FlowTable; me: string; onClose: () => void; onOrder: () => void }) {
  const notify = useToast()
  const flow = useFlow()
  const [mode, setMode] = useState<'walkin' | 'reservation'>(table.status === 'Reserved' ? 'reservation' : 'walkin')
  const [guests, setGuests] = useState(2)
  const [name, setName] = useState('')
  const [openedAt] = useState(() => Date.now())
  const upcoming = useMemo(
    () =>
      flow.reservations
        .filter((r) => ['Confirmed', 'Pending'].includes(r.status) && Math.abs(new Date(r.time).getTime() - openedAt) < 3 * 3600_000)
        .sort((a, b) => (a.table === table.id ? -1 : b.table === table.id ? 1 : a.time.localeCompare(b.time))),
    [flow.reservations, table.id, openedAt],
  )
  const [resId, setResId] = useState(upcoming[0]?.id ?? '')
  const orders = tableOrders(flow, table.id)
  const total = orders.reduce((s, o) => s + orderTotal(o), 0)

  const seat = () => {
    const r = flow.reservations.find((x) => x.id === resId)
    if (mode === 'reservation' && r) seatTable(table.id, { guests: r.party, guestName: r.guest, reservationId: r.id, waiter: me })
    else seatTable(table.id, { guests, guestName: name || 'Walk-in', waiter: me })
    notify(`Table ${table.name} seated — menu given`)
  }

  return (
    <Modal open onClose={onClose} size="sm" title={`Table ${table.name}`} description={`${table.area} · ${table.seats} seats · ${table.status}`}>
      {(table.status === 'Available' || table.status === 'Reserved') && (
        <div className="space-y-4">
          <p className="text-sm font-medium text-slate-700">Check reservation</p>
          <div className="grid grid-cols-2 gap-2">
            {(['reservation', 'walkin'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn('flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-medium', mode === m ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600')}
              >
                {m === 'reservation' ? <CalendarCheck size={15} /> : <UserPlus size={15} />}
                {m === 'reservation' ? 'Reserved' : 'Walk-in'}
              </button>
            ))}
          </div>
          {mode === 'reservation' ? (
            upcoming.length ? (
              <ul className="max-h-56 space-y-1.5 overflow-y-auto">
                {upcoming.map((r) => (
                  <li key={r.id}>
                    <label className={cn('flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm', resId === r.id ? 'border-brand-500 bg-brand-50' : 'border-slate-200')}>
                      <input type="radio" checked={resId === r.id} onChange={() => setResId(r.id)} className="accent-brand-600" />
                      <span className="flex-1">
                        <span className="font-medium text-slate-800">{r.guest}</span>
                        <span className="block text-xs text-slate-500">
                          {r.party} guests · {new Date(r.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          {r.table && ` · ${r.table}`}
                          {r.notes && ` · ${r.notes}`}
                        </span>
                      </span>
                      {r.table === table.id && <span className="text-[10px] font-semibold text-sky-700">THIS TABLE</span>}
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">No reservations in the next 3 hours. Seat as walk-in.</p>
            )
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Guests</span>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setGuests(Math.max(1, guests - 1))} className="h-9 w-9 rounded-lg bg-slate-100 text-lg font-semibold">
                    −
                  </button>
                  <span className="w-6 text-center text-lg font-semibold">{guests}</span>
                  <button type="button" onClick={() => setGuests(Math.min(table.seats + 2, guests + 1))} className="h-9 w-9 rounded-lg bg-slate-100 text-lg font-semibold">
                    +
                  </button>
                </div>
              </div>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Guest name (optional)" className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" />
            </div>
          )}
          <Button block size="lg" icon={Armchair} disabled={mode === 'reservation' && !resId} onClick={seat}>
            Seat & give menu
          </Button>
        </div>
      )}

      {table.status === 'Occupied' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
            <span>
              <span className="font-medium text-slate-800">{table.guestName}</span> · {table.guests} guests
            </span>
            <span className="text-xs text-slate-500">seated {table.seatedAt ? timeAgo(table.seatedAt) : ''}</span>
          </div>
          {orders.length === 0 ? (
            <p className="text-center text-sm text-slate-500">No order yet.</p>
          ) : (
            <ul className="space-y-2">
              {orders.map((o) => (
                <li key={o.id} className="rounded-xl border border-slate-200 p-2.5">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-semibold">#{o.orderNo}</span>
                    <FlowStatusBadge status={o.status} />
                  </div>
                  <ItemLines order={o} compact />
                  {o.status === 'Ready' && (
                    <Button size="sm" className="mt-2" variant="success" block onClick={() => setOrderStatus(o.id, 'PickedUp')}>
                      Picked up
                    </Button>
                  )}
                  {o.status === 'PickedUp' && (
                    <Button size="sm" className="mt-2" block onClick={() => setOrderStatus(o.id, 'Served')}>
                      Mark served
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Running total</span>
            <span className="font-semibold">{formatCurrency(total)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button icon={Sparkles} onClick={onOrder}>
              Take order
            </Button>
            <Button
              variant="outline"
              icon={Receipt}
              disabled={!orders.length || table.billRequested}
              onClick={() => (requestBill(table.id), notify(`Bill requested for ${table.name} — counter notified`))}
            >
              {table.billRequested ? 'Bill requested' : 'Ask for bill'}
            </Button>
          </div>
        </div>
      )}

      {table.status === 'Cleaning' && (
        <Button block size="lg" onClick={() => (setTableStatus(table.id, 'Available'), notify(`${table.name} is ready for guests`))}>
          Mark clean & available
        </Button>
      )}
    </Modal>
  )
}

/** Full-screen order taking on the waiter's device. */
function TakeOrder({ tableId, waiter, onDone, onBack }: { tableId: string; waiter: string; onDone: () => void; onBack: () => void }) {
  const notify = useToast()
  const [cart, setCart] = useState<Cart>({})
  const [note, setNote] = useState('')
  const items = cartItems(cart)
  const total = items.reduce((s, i) => s + i.qty * i.price, 0)

  const send = () => {
    const withNote = note && items.length ? items.map((i, idx) => (idx === 0 ? { ...i, notes: note } : i)) : items
    const o = sendTableOrder(tableId, withNote, waiter)
    notify(`#${o.orderNo} sent — counter logged it and kitchen has it`)
    onDone()
  }

  return (
    <div className="min-h-full bg-slate-200/60 sm:py-6">
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col bg-slate-50 sm:min-h-[calc(100vh-3rem)] sm:overflow-hidden sm:rounded-[2rem] sm:shadow-2xl sm:ring-8 sm:ring-ink-900">
        <header className="sticky top-0 z-20 flex items-center gap-2 bg-ink-900 px-3 py-3 text-white">
          <button type="button" onClick={onBack} className="rounded-lg p-1.5 hover:bg-white/10" aria-label="Back">
            <ChevronLeft size={20} />
          </button>
          <p className="font-semibold">New order · Table {tableId}</p>
        </header>
        <main className="flex-1 overflow-y-auto px-4 pt-4 pb-40">
          <MenuPicker cart={cart} setCart={setCart} dense />
        </main>
        <div className="sticky bottom-0 z-20 space-y-2 border-t border-slate-200 bg-white p-3">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Kitchen note (e.g. less spicy)" className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm" />
          <Button block size="lg" icon={Send} disabled={!items.length} onClick={send}>
            Send to kitchen · {cartCount(cart)} items · {formatCurrency(total)}
          </Button>
        </div>
      </div>
    </div>
  )
}
