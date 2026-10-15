import {
  Bike,
  BrainCircuit,
  CheckCircle2,
  Clock,
  Link2,
  MapPin,
  MapPinned,
  MessageSquare,
  Navigation,
  Pencil,
  Plug,
  Plus,
  Route,
  ShoppingBag,
  Sparkles,
  Timer,
  Truck,
  Unplug,
  Wand2,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AIPanel } from '@/shared/components/operations/AIPanel'
import {
  Avatar,
  Badge,
  Button,
  Card,
  DataTable,
  DescriptionList,
  Drawer,
  Field,
  Input,
  LoadingState,
  Modal,
  PageHeader,
  Select,
  StatCard,
  StatusBadge,
  Tabs,
  Toggle,
  useToast,
} from '@/shared/components/ui'
import type { Column } from '@/shared/components/ui'
import { useAuth } from '@/shared/context/AuthContext'
import { useAsync } from '@/shared/hooks/useAsync'
import { chartAxis, chartColors, chartGrid, chartTooltip } from '@/shared/lib/chart'
import { cn } from '@/shared/lib/cn'
import { formatCurrency, timeAgo } from '@/shared/lib/format'
import type { DeliveryIntegration, DeliveryOrder, DeliveryStatus, DeliveryZone, Rider } from '@/shared/services/operations'
import {
  assignRider,
  deliveryPerformance,
  getDeliveryOrders,
  getDeliveryZones,
  getIntegrations,
  getRiders,
  saveDeliveryZone,
  updateIntegration,
} from '@/shared/services/operations'

type TabId = 'dispatch' | 'tracking' | 'zones' | 'partners' | 'ai'
const ACTIVE: DeliveryStatus[] = ['New', 'Preparing', 'Ready', 'Assigned', 'Picked up', 'Out for delivery']
const HQ = { x: 50, y: 50 }
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)

const channelTone: Record<string, 'pink' | 'green' | 'teal' | 'blue' | 'orange' | 'gray'> = {
  Foodpanda: 'pink',
  Careem: 'green',
  'Uber Eats': 'green',
  Deliveroo: 'teal',
  Website: 'blue',
  'Mobile App': 'orange',
}

export default function Delivery() {
  const notify = useToast()
  const { branch } = useAuth()
  const ordersQ = useAsync(getDeliveryOrders)
  const ridersQ = useAsync(getRiders)
  const zonesQ = useAsync(getDeliveryZones)
  const intQ = useAsync(getIntegrations)
  const [tab, setTab] = useState<TabId>('dispatch')
  const [selected, setSelected] = useState<DeliveryOrder | null>(null)
  const [zoneEdit, setZoneEdit] = useState<DeliveryZone | null>(null)

  const orders = ordersQ.data ?? []
  const riders = ridersQ.data ?? []
  const setRiders = ridersQ.setData

  // Move riders toward their destination for the live tracking view.
  useEffect(() => {
    const id = setInterval(() => {
      const targets = new Map((ordersQ.data ?? []).filter((o) => o.rider && ['Out for delivery', 'Picked up'].includes(o.status)).map((o) => [o.rider!, o]))
      setRiders((prev) =>
        (prev ?? []).map((r) => {
          const t = targets.get(r.name) ?? (r.status === 'Returning' ? HQ : null)
          if (!t) return r
          const d = dist(r, t)
          if (d < 1.2) return r
          const step = Math.min(1.4, d)
          return { ...r, x: r.x + ((t.x - r.x) / d) * step, y: r.y + ((t.y - r.y) / d) * step }
        }),
      )
    }, 1500)
    return () => clearInterval(id)
  }, [ordersQ.data, setRiders])

  const patchOrder = (id: string, p: Partial<DeliveryOrder>) => {
    ordersQ.setData((prev) => (prev ?? []).map((o) => (o.id === id ? { ...o, ...p } : o)))
    setSelected((s) => (s?.id === id ? { ...s, ...p } : s))
  }
  const patchRider = (name: string, p: Partial<Rider>) => ridersQ.setData((prev) => (prev ?? []).map((r) => (r.name === name ? { ...r, ...p } : r)))

  const assign = async (o: DeliveryOrder, r: Rider) => {
    await assignRider(o.id, r.id)
    patchOrder(o.id, { rider: r.name, status: o.status === 'Ready' ? 'Assigned' : o.status })
    patchRider(r.name, { status: 'On delivery', activeOrder: o.orderNo })
    notify(`${r.name} assigned to #${o.orderNo} · customer notified`)
  }

  const nearestRider = (o: DeliveryOrder) => riders.filter((r) => r.status === 'Available').sort((a, b) => dist(a, o) - dist(b, o))[0]

  const autoDispatch = () => {
    const pending = orders.filter((o) => o.mode === 'Delivery' && !o.rider && ['Ready', 'Preparing'].includes(o.status))
    const free = riders.filter((r) => r.status === 'Available')
    if (!pending.length || !free.length) return notify(pending.length ? 'No riders available right now' : 'Nothing to dispatch', 'info')
    const used = new Set<string>()
    let n = 0
    pending.forEach((o) => {
      const r = free.filter((x) => !used.has(x.id)).sort((a, b) => dist(a, o) - dist(b, o))[0]
      if (!r) return
      used.add(r.id)
      n++
      void assign(o, r)
    })
    notify(`AI dispatch assigned ${n} order${n === 1 ? '' : 's'} by distance & ETA`)
  }

  const advance = (o: DeliveryOrder) => {
    const flow: Partial<Record<DeliveryStatus, DeliveryStatus>> =
      o.mode === 'Pickup' ? { New: 'Preparing', Preparing: 'Ready', Ready: 'Delivered' } : { New: 'Preparing', Preparing: 'Ready', Ready: 'Picked up', Assigned: 'Picked up', 'Picked up': 'Out for delivery', 'Out for delivery': 'Delivered' }
    const next = flow[o.status]
    if (!next) return
    patchOrder(o.id, { status: next })
    if (next === 'Delivered' && o.rider) patchRider(o.rider, { status: 'Returning', activeOrder: undefined, deliveriesToday: (riders.find((r) => r.name === o.rider)?.deliveriesToday ?? 0) + 1 })
    notify(`#${o.orderNo} → ${next === 'Delivered' && o.mode === 'Pickup' ? 'Collected' : next}${['Out for delivery', 'Ready'].includes(next) ? ' · SMS sent to customer' : ''}`)
  }

  if (ordersQ.loading || ridersQ.loading) return <LoadingState label="Loading dispatch board…" />

  const active = orders.filter((o) => ACTIVE.includes(o.status))
  const delivered = orders.filter((o) => o.status === 'Delivered')

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Bike}
        title="Delivery & Takeaway"
        description={`Online orders, pickups, riders & aggregator partners · ${branch}`}
        actions={
          <>
            <Button variant="outline" icon={MapPinned} onClick={() => setTab('tracking')}>
              Live map
            </Button>
            <Button variant="ai" icon={Wand2} onClick={autoDispatch}>
              AI auto-dispatch
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Active orders" value={active.length} icon={ShoppingBag} tone="brand" hint={`${active.filter((o) => o.mode === 'Pickup').length} pickups`} />
        <StatCard label="Avg delivery time" value="31 min" icon={Timer} tone="blue" delta={-6.1} invertDelta deltaLabel="vs last week" />
        <StatCard label="On-time rate" value="88%" icon={CheckCircle2} tone="green" delta={2.4} hint={`${delivered.length} delivered`} />
        <StatCard label="Riders available" value={`${riders.filter((r) => r.status === 'Available').length}/${riders.filter((r) => r.status !== 'Offline').length}`} icon={Bike} tone="purple" hint="on shift" />
      </div>

      <Tabs
        items={[
          { id: 'dispatch', label: 'Orders & dispatch', icon: Route, count: active.length },
          { id: 'tracking', label: 'Live tracking', icon: Navigation },
          { id: 'zones', label: 'Zones & charges', icon: MapPin },
          { id: 'partners', label: 'Third-party partners', icon: Plug },
          { id: 'ai', label: 'AI ETA & dispatch', icon: BrainCircuit },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'dispatch' && <DispatchTab orders={orders} riders={riders} onOpen={setSelected} />}
      {tab === 'tracking' && <TrackingTab orders={active} riders={riders} zones={zonesQ.data ?? []} onOpen={setSelected} />}
      {tab === 'zones' && (
        <ZonesTab
          zones={zonesQ.data ?? []}
          onEdit={setZoneEdit}
          onToggle={(z) => {
            zonesQ.setData((prev) => (prev ?? []).map((x) => (x.id === z.id ? { ...x, active: !x.active } : x)))
            notify(`${z.name} ${z.active ? 'paused' : 'activated'}`, 'info')
          }}
        />
      )}
      {tab === 'partners' && (
        <PartnersTab
          partners={intQ.data ?? []}
          onChange={async (p) => {
            await updateIntegration(p)
            intQ.setData((prev) => (prev ?? []).map((x) => (x.id === p.id ? p : x)))
          }}
        />
      )}
      {tab === 'ai' && (
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <Card title="Promised vs AI-predicted ETA" subtitle="Live traffic, prep queue and rider location" flush>
              <ul className="divide-y divide-slate-100">
                {active
                  .filter((o) => o.mode === 'Delivery')
                  .map((o) => {
                    const diff = o.aiEtaMins - o.etaMins
                    return (
                      <li key={o.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                        <span className="w-14 font-semibold">#{o.orderNo}</span>
                        <span className="min-w-32 flex-1 text-slate-600">
                          {o.customer} · {o.distanceKm} km
                        </span>
                        <span className="text-slate-500">Promised {o.etaMins}m</span>
                        <Badge tone={diff > 2 ? 'red' : diff > 0 ? 'yellow' : 'green'}>AI {o.aiEtaMins}m</Badge>
                        {diff > 2 && (
                          <Button size="xs" variant="outline" icon={MessageSquare} onClick={() => notify(`Updated ETA sent to ${o.customer}`, 'info')}>
                            Notify
                          </Button>
                        )}
                      </li>
                    )
                  })}
              </ul>
            </Card>
            <Card title="Delivery volume & on-time performance" subtitle="Today by hour">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deliveryPerformance} margin={{ left: -10, right: 8, top: 8 }}>
                    <CartesianGrid {...chartGrid} vertical={false} />
                    <XAxis dataKey="h" {...chartAxis} tickFormatter={(v: string) => `${v}:00`} />
                    <YAxis {...chartAxis} />
                    <Tooltip {...chartTooltip} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="orders" name="Orders" fill={chartColors[4]} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="onTime" name="On time" fill={chartColors[2]} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
          <AIPanel
            module="delivery"
            title="AI ETA & dispatch optimisation"
            subtitle="Batching, rider allocation & demand"
            onAction={(ins) => (ins.action === 'Batch orders' ? autoDispatch() : notify(`${ins.action} — done`, 'info'))}
          />
        </div>
      )}

      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `#${selected.orderNo} · ${selected.customer}` : ''}
        description={selected ? `${selected.mode} · ${selected.channel} · placed ${timeAgo(selected.placedAt)}` : ''}
        footer={
          selected &&
          ACTIVE.includes(selected.status) && (
            <>
              <Button variant="ghost" onClick={() => (patchOrder(selected.id, { status: 'Cancelled' }), notify(`#${selected.orderNo} cancelled`, 'info'))}>
                Cancel
              </Button>
              <Button variant="outline" icon={MessageSquare} onClick={() => notify(`SMS sent to ${selected.phone}`, 'info')}>
                Notify
              </Button>
              {!(selected.mode === 'Delivery' && selected.status === 'Ready' && !selected.rider) && <Button onClick={() => advance(selected)}>Advance status</Button>}
            </>
          )
        }
      >
        {selected && (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={selected.status} />
              <Badge tone={channelTone[selected.channel] ?? 'gray'}>{selected.channel}</Badge>
              <Badge>{selected.payment}</Badge>
            </div>
            <DescriptionList
              items={[
                { label: 'Items', value: selected.summary },
                { label: 'Total', value: formatCurrency(selected.total) },
                { label: 'Address', value: selected.address },
                { label: 'Zone', value: selected.zone },
                { label: 'Phone', value: selected.phone },
                { label: 'Distance', value: selected.distanceKm ? `${selected.distanceKm} km` : 'Pickup' },
                { label: 'Promised ETA', value: `${selected.etaMins} min` },
                { label: 'AI ETA', value: `${selected.aiEtaMins} min` },
              ]}
            />
            {selected.mode === 'Delivery' && (
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-800">Rider assignment</p>
                {selected.rider ? (
                  <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                    <Avatar name={selected.rider} />
                    <div className="flex-1">
                      <p className="font-medium text-slate-800">{selected.rider}</p>
                      <p className="text-xs text-slate-500">{riders.find((r) => r.name === selected.rider)?.vehicle}</p>
                    </div>
                    <StatusBadge status="Assigned" />
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {riders
                      .filter((r) => r.status === 'Available')
                      .sort((a, b) => dist(a, selected) - dist(b, selected))
                      .map((r, i) => (
                        <li key={r.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-2.5">
                          <Avatar name={r.name} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-800">
                              {r.name} {i === 0 && <Badge tone="purple">AI pick</Badge>}
                            </p>
                            <p className="text-xs text-slate-500">
                              {(dist(r, selected) / 10).toFixed(1)} km away · ★ {r.rating} · {r.deliveriesToday} today
                            </p>
                          </div>
                          <Button size="xs" onClick={() => assign(selected, r)}>
                            Assign
                          </Button>
                        </li>
                      ))}
                    {!nearestRider(selected) && <p className="text-sm text-slate-500">No riders available — order will queue for next free rider.</p>}
                  </ul>
                )}
              </div>
            )}
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-800">Customer notifications</p>
              <ol className="space-y-2 text-sm">
                {(selected.mode === 'Pickup' ? ['Order confirmed', 'Being prepared', 'Ready for pickup'] : ['Order confirmed', 'Being prepared', 'Rider assigned', 'Out for delivery', 'Delivered']).map((s, i) => {
                  const idx = ['New', 'Preparing', selected.mode === 'Pickup' ? 'Ready' : 'Assigned', 'Out for delivery', 'Delivered'].indexOf(selected.status === 'Picked up' ? 'Assigned' : selected.status === 'Ready' && selected.mode === 'Delivery' ? 'Preparing' : selected.status)
                  const done = i <= idx
                  return (
                    <li key={s} className={cn('flex items-center gap-2', done ? 'text-slate-800' : 'text-slate-400')}>
                      <CheckCircle2 size={15} className={done ? 'text-emerald-500' : 'text-slate-300'} />
                      {s} {done && <span className="text-xs text-slate-400">· SMS + push sent</span>}
                    </li>
                  )
                })}
              </ol>
            </div>
          </div>
        )}
      </Drawer>

      <ZoneModal key={zoneEdit?.id ?? 'none'}
        zone={zoneEdit}
        onClose={() => setZoneEdit(null)}
        onSave={async (z) => {
          await saveDeliveryZone(z)
          zonesQ.setData((prev) => ((prev ?? []).some((x) => x.id === z.id) ? (prev ?? []).map((x) => (x.id === z.id ? z : x)) : [...(prev ?? []), z]))
          setZoneEdit(null)
          notify(`${z.name} saved`)
        }}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */

function DispatchTab({ orders, riders, onOpen }: { orders: DeliveryOrder[]; riders: Rider[]; onOpen: (o: DeliveryOrder) => void }) {
  const [mode, setMode] = useState<'All' | 'Delivery' | 'Pickup'>('All')
  const [channel, setChannel] = useState('')
  const [showDone, setShowDone] = useState(false)
  const rows = orders.filter((o) => (mode === 'All' || o.mode === mode) && (!channel || o.channel === channel) && (showDone || ACTIVE.includes(o.status)))
  const columns: Column<DeliveryOrder>[] = [
    { key: 'orderNo', header: 'Order', sortable: true, render: (o) => <span className="font-semibold">#{o.orderNo}</span> },
    {
      key: 'customer',
      header: 'Customer',
      render: (o) => (
        <div className="max-w-56">
          <p className="font-medium text-slate-800">{o.customer}</p>
          <p className="truncate text-xs text-slate-500">{o.address}</p>
        </div>
      ),
    },
    { key: 'channel', header: 'Source', render: (o) => <Badge tone={channelTone[o.channel] ?? 'gray'}>{o.channel}</Badge> },
    { key: 'mode', header: 'Mode', render: (o) => (o.mode === 'Pickup' ? <Badge tone="yellow">Pickup</Badge> : <span className="text-slate-600">Delivery · {o.zone}</span>) },
    { key: 'total', header: 'Total', align: 'right', render: (o) => formatCurrency(o.total) },
    { key: 'status', header: 'Status', render: (o) => <StatusBadge status={o.mode === 'Pickup' && o.status === 'Ready' ? 'Ready' : o.status} /> },
    { key: 'rider', header: 'Rider', render: (o) => (o.rider ? <span className="flex items-center gap-2"><Avatar name={o.rider} size="sm" />{o.rider.split(' ')[0]}</span> : o.mode === 'Delivery' && ACTIVE.includes(o.status) ? <Badge tone="red">Unassigned</Badge> : '—') },
    { key: 'eta', header: 'ETA', render: (o) => (ACTIVE.includes(o.status) ? <span className="text-xs"><span className="font-semibold">{o.aiEtaMins}m</span> <span className="text-slate-400">AI</span></span> : '—') },
    { key: 'placedAt', header: 'Placed', render: (o) => <span className="text-xs text-slate-500">{timeAgo(o.placedAt)}</span> },
  ]
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Card flush className="min-w-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3">
          <Tabs variant="pills" items={(['All', 'Delivery', 'Pickup'] as const).map((m) => ({ id: m, label: m }))} value={mode} onChange={setMode} />
          <div className="ml-auto">
            <Toggle checked={showDone} onChange={setShowDone} label={<span className="text-sm font-normal text-slate-600">Show completed</span>} />
          </div>
        </div>
        <DataTable
          columns={columns}
          data={rows}
          rowKey={(o) => o.id}
          searchKeys={['customer', 'address', 'phone']}
          searchPlaceholder="Search customer, address, phone…"
          onRowClick={onOpen}
          toolbar={<Select value={channel} onChange={(e) => setChannel(e.target.value)} options={['Website', 'Mobile App', 'Foodpanda', 'Careem', 'Uber Eats', 'Deliveroo']} placeholder="All sources" className="h-9 w-40" />}
        />
      </Card>
      <Card title="Riders" subtitle="Fleet status & cash in hand" flush>
        <ul className="divide-y divide-slate-100">
          {riders.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-5 py-3">
              <Avatar name={r.name} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800">{r.name}</p>
                <p className="truncate text-xs text-slate-500">
                  {r.activeOrder ? `On #${r.activeOrder}` : r.vehicle} · {r.deliveriesToday} today · {formatCurrency(r.cashInHand)} cash
                </p>
              </div>
              <StatusBadge status={r.status === 'On delivery' ? 'Out for delivery' : r.status === 'Returning' ? 'In progress' : r.status} />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

function TrackingTab({ orders, riders, zones, onOpen }: { orders: DeliveryOrder[]; riders: Rider[]; zones: DeliveryZone[]; onOpen: (o: DeliveryOrder) => void }) {
  const deliveries = orders.filter((o) => o.mode === 'Delivery')
  const maxR = Math.max(...zones.map((z) => z.radiusKm), 1)
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <Card title="Live delivery map" subtitle="Rider GPS positions update every few seconds" bodyClassName="p-3" className="min-w-0">
        <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-[#eef2e6] sm:aspect-[16/10]">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
            {/* parks & water */}
            <rect x="6" y="64" width="16" height="14" rx="2" fill="#d4e7c5" />
            <rect x="72" y="8" width="18" height="12" rx="2" fill="#d4e7c5" />
            <path d="M0 88 Q 30 80 55 92 T 100 86 V100 H0Z" fill="#cfe3f3" />
            {/* streets */}
            {[12, 28, 44, 60, 76, 92].map((v) => (
              <g key={v}>
                <line x1={v} y1="0" x2={v} y2="100" stroke="#fff" strokeWidth="1.4" />
                <line x1="0" y1={v} x2="100" y2={v} stroke="#fff" strokeWidth="1.4" />
              </g>
            ))}
            <line x1="0" y1="20" x2="100" y2="80" stroke="#fde68a" strokeWidth="2.4" />
            <line x1="30" y1="0" x2="70" y2="100" stroke="#fde68a" strokeWidth="2" />
            {/* zones */}
            {[...zones].reverse().map((z) => (
              <ellipse key={z.id} cx={HQ.x} cy={HQ.y} rx={(z.radiusKm / maxR) * 46} ry={(z.radiusKm / maxR) * 46} fill={z.color} fillOpacity={z.active ? 0.07 : 0.02} stroke={z.color} strokeOpacity={z.active ? 0.6 : 0.2} strokeDasharray="1.5 1" strokeWidth="0.35" />
            ))}
            {/* routes */}
            {deliveries
              .filter((o) => o.rider)
              .map((o) => {
                const r = riders.find((x) => x.name === o.rider)
                if (!r) return null
                return <line key={o.id} x1={r.x} y1={r.y} x2={o.x} y2={o.y} stroke="#6366f1" strokeWidth="0.6" strokeDasharray="1.5 1" />
              })}
          </svg>
          {/* restaurant */}
          <Pin x={HQ.x} y={HQ.y}>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg ring-4 ring-brand-600/25">🍛</span>
          </Pin>
          {deliveries.map((o) => (
            <Pin key={o.id} x={o.x} y={o.y}>
              <button type="button" onClick={() => onOpen(o)} className="group flex flex-col items-center" title={`#${o.orderNo} ${o.customer}`}>
                <MapPin size={22} className={cn('drop-shadow', o.rider ? 'fill-violet-500 text-violet-700' : 'fill-red-500 text-red-700')} />
                <span className="rounded bg-white/90 px-1 text-[10px] font-semibold text-slate-700 shadow-sm">#{o.orderNo}</span>
              </button>
            </Pin>
          ))}
          {riders
            .filter((r) => r.status !== 'Offline')
            .map((r) => (
              <Pin key={r.id} x={r.x} y={r.y} className="transition-all duration-[1400ms] ease-linear">
                <span
                  className={cn(
                    'flex items-center gap-1 rounded-full py-0.5 pr-2 pl-0.5 text-[10px] font-semibold text-white shadow-md',
                    r.status === 'Available' ? 'bg-emerald-600' : r.status === 'Returning' ? 'bg-amber-500' : 'bg-indigo-600',
                  )}
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/25">
                    <Bike size={11} />
                  </span>
                  {r.name.split(' ')[0]}
                </span>
              </Pin>
            ))}
          <div className="absolute bottom-2 left-2 flex flex-wrap gap-2 rounded-lg bg-white/90 px-2 py-1.5 text-[10px] text-slate-600 shadow-sm">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-indigo-600" />On delivery</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-600" />Available</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" />Returning</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" />Unassigned drop</span>
          </div>
        </div>
      </Card>
      <Card title="In transit" subtitle="Tap a pin or row for details" flush>
        <ul className="divide-y divide-slate-100">
          {deliveries.map((o) => {
            const r = riders.find((x) => x.name === o.rider)
            const remaining = r ? Math.max(1, Math.round(dist(r, o) * 0.9)) : o.aiEtaMins
            return (
              <li key={o.id}>
                <button type="button" onClick={() => onOpen(o)} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-slate-50">
                  <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg', o.rider ? 'bg-indigo-50 text-indigo-600' : 'bg-red-50 text-red-600')}>
                    {o.rider ? <Truck size={16} /> : <Clock size={16} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800">
                      #{o.orderNo} · {o.customer}
                    </p>
                    <p className="truncate text-xs text-slate-500">{o.rider ? `${o.rider} · ${o.status}` : `${o.status} · awaiting rider`}</p>
                  </div>
                  <span className="text-right text-xs">
                    <span className="block font-semibold text-slate-800">{remaining} min</span>
                    <span className="text-slate-400">{o.distanceKm} km</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </Card>
    </div>
  )
}

function Pin({ x, y, children, className }: { x: number; y: number; children: ReactNode; className?: string }) {
  return (
    <div className={cn('absolute -translate-x-1/2 -translate-y-1/2', className)} style={{ left: `${x}%`, top: `${y}%` }}>
      {children}
    </div>
  )
}

function ZonesTab({ zones, onEdit, onToggle }: { zones: DeliveryZone[]; onEdit: (z: DeliveryZone) => void; onToggle: (z: DeliveryZone) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          icon={Plus}
          onClick={() => onEdit({ id: `z-${Date.now()}`, name: '', radiusKm: 5, fee: 2, minOrder: 15, etaMins: 35, active: true, ordersToday: 0, color: chartColors[zones.length % chartColors.length]! })}
        >
          Add zone
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {zones.map((z) => (
          <Card key={z.id} bodyClassName="p-5" className={cn(!z.active && 'opacity-70')}>
            <div className="flex items-start justify-between gap-2">
              <span className="h-3 w-3 rounded-full" style={{ background: z.color }} />
              <Toggle checked={z.active} onChange={() => onToggle(z)} />
            </div>
            <p className="mt-2 font-semibold text-slate-900">{z.name}</p>
            <dl className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-slate-500">Radius</dt>
              <dd className="text-right font-medium">{z.radiusKm} km</dd>
              <dt className="text-slate-500">Delivery fee</dt>
              <dd className="text-right font-medium">{formatCurrency(z.fee)}</dd>
              <dt className="text-slate-500">Min order</dt>
              <dd className="text-right font-medium">{formatCurrency(z.minOrder)}</dd>
              <dt className="text-slate-500">Target ETA</dt>
              <dd className="text-right font-medium">{z.etaMins} min</dd>
              <dt className="text-slate-500">Orders today</dt>
              <dd className="text-right font-medium">{z.ordersToday}</dd>
            </dl>
            <Button size="sm" variant="outline" icon={Pencil} block className="mt-4" onClick={() => onEdit(z)}>
              Edit zone
            </Button>
          </Card>
        ))}
      </div>
      <Card title="Charge rules">
        <ul className="grid gap-3 text-sm sm:grid-cols-3">
          <li className="rounded-lg bg-slate-50 p-3">
            <p className="font-medium text-slate-800">Free delivery threshold</p>
            <p className="text-slate-500">Orders above {formatCurrency(25)} in Zones A–B</p>
          </li>
          <li className="rounded-lg bg-slate-50 p-3">
            <p className="font-medium text-slate-800">Surge pricing</p>
            <p className="text-slate-500">+{formatCurrency(1)} when &gt; 20 orders/hour or rain</p>
          </li>
          <li className="rounded-lg bg-slate-50 p-3">
            <p className="font-medium text-slate-800">Packaging charge</p>
            <p className="text-slate-500">{formatCurrency(0.3)} per takeaway order</p>
          </li>
        </ul>
      </Card>
    </div>
  )
}

function ZoneModal({ zone, onClose, onSave }: { zone: DeliveryZone | null; onClose: () => void; onSave: (z: DeliveryZone) => void }) {
  const [d, setD] = useState<DeliveryZone | null>(zone)
  if (!d) return null
  return (
    <Modal
      open={!!zone}
      onClose={onClose}
      title={zone?.name ? `Edit ${zone.name}` : 'New delivery zone'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!d.name} onClick={() => onSave(d)}>
            Save zone
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Zone name" required className="sm:col-span-2">
          <Input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="Zone E – Bahria Town" />
        </Field>
        <Field label="Radius (km)">
          <Input type="number" value={d.radiusKm} onChange={(e) => setD({ ...d, radiusKm: Number(e.target.value) })} />
        </Field>
        <Field label="Delivery fee ($)">
          <Input type="number" step="0.5" value={d.fee} onChange={(e) => setD({ ...d, fee: Number(e.target.value) })} />
        </Field>
        <Field label="Minimum order ($)">
          <Input type="number" value={d.minOrder} onChange={(e) => setD({ ...d, minOrder: Number(e.target.value) })} />
        </Field>
        <Field label="Target ETA (min)">
          <Input type="number" value={d.etaMins} onChange={(e) => setD({ ...d, etaMins: Number(e.target.value) })} />
        </Field>
      </div>
    </Modal>
  )
}

function PartnersTab({ partners, onChange }: { partners: DeliveryIntegration[]; onChange: (p: DeliveryIntegration) => Promise<void> }) {
  const notify = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  const connected = partners.filter((p) => p.connected)
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {partners.map((p) => (
          <Card key={p.id} bodyClassName="p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm" style={{ background: p.color }}>
                {p.initials}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">{p.name}</p>
                <p className="text-xs text-slate-500">{p.connected ? `Synced ${timeAgo(p.lastSync)}` : 'Not connected'}</p>
              </div>
              <StatusBadge status={p.connected ? 'Connected' : 'Disconnected'} />
            </div>
            {p.connected ? (
              <>
                <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-slate-50 py-2">
                    <dd className="font-semibold text-slate-900">{p.ordersToday}</dd>
                    <dt className="text-[11px] text-slate-500">Orders</dt>
                  </div>
                  <div className="rounded-lg bg-slate-50 py-2">
                    <dd className="font-semibold text-slate-900">{formatCurrency(p.revenueToday, { compact: true })}</dd>
                    <dt className="text-[11px] text-slate-500">Revenue</dt>
                  </div>
                  <div className="rounded-lg bg-slate-50 py-2">
                    <dd className="font-semibold text-slate-900">{p.commission}%</dd>
                    <dt className="text-[11px] text-slate-500">Commission</dt>
                  </div>
                </dl>
                <div className="mt-4 space-y-3">
                  <Toggle checked={p.menuSync} onChange={(v) => (onChange({ ...p, menuSync: v }), notify(`${p.name} menu sync ${v ? 'on' : 'off'}`, 'info'))} label="Menu & price sync" description="Push availability and prices" />
                  <Toggle checked={p.autoAccept} onChange={(v) => onChange({ ...p, autoAccept: v })} label="Auto-accept orders" description="Send straight to KDS" />
                </div>
              </>
            ) : (
              <p className="mt-4 text-sm text-slate-500">Receive {p.name} orders directly in your POS & KDS, with automatic menu sync. Commission {p.commission}%.</p>
            )}
            <Button
              block
              className="mt-4"
              size="sm"
              variant={p.connected ? 'outline' : 'primary'}
              icon={p.connected ? Unplug : Link2}
              loading={busy === p.id}
              onClick={async () => {
                setBusy(p.id)
                await onChange({ ...p, connected: !p.connected, lastSync: new Date().toISOString(), menuSync: !p.connected, autoAccept: !p.connected && p.autoAccept })
                setBusy(null)
                notify(p.connected ? `${p.name} disconnected` : `${p.name} connected — menu synced`)
              }}
            >
              {p.connected ? 'Disconnect' : 'Connect'}
            </Button>
          </Card>
        ))}
      </div>
      <Card title="Aggregator orders today" subtitle="Orders and net revenue after commission">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={connected.map((p) => ({ name: p.name, gross: p.revenueToday, net: Math.round(p.revenueToday * (1 - p.commission / 100)) }))} margin={{ left: -4, right: 8, top: 8 }}>
              <CartesianGrid {...chartGrid} vertical={false} />
              <XAxis dataKey="name" {...chartAxis} />
              <YAxis {...chartAxis} tickFormatter={(v: number) => formatCurrency(v, { compact: true })} />
              <Tooltip {...chartTooltip} formatter={(v) => formatCurrency(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="gross" name="Gross" fill={chartColors[0]} radius={[4, 4, 0, 0]} />
              <Bar dataKey="net" name="Net of commission" fill={chartColors[2]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-violet-600">
          <Sparkles size={13} /> Tip: own-channel orders save ~{connected.length ? Math.round(connected.reduce((s, p) => s + p.commission, 0) / connected.length) : 25}% commission — promote your online menu.
        </p>
      </Card>
    </div>
  )
}
