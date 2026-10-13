import { Banknote, Bike, CheckCircle2, History, MapPin, Navigation, PackageCheck, Phone, ScanLine, Smartphone, Wallet } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { FlowStatusBadge, ItemLines } from '@/shared/components/flow/FlowBits'
import { MobileShell } from '@/shared/components/layout/MobileShell'
import { Button, Modal, Toggle, useToast } from '@/shared/components/ui'
import { useAuth } from '@/shared/context/AuthContext'
import { chime } from '@/shared/lib/chime'
import { cn } from '@/shared/lib/cn'
import { formatCurrency, timeAgo } from '@/shared/lib/format'
import type { FlowOrder, PayMethod } from '@/shared/services/flow'
import { DEMO_RIDER_ID, deliverOrder, orderTotal, riderPickup, setRiderStatus, useFlow } from '@/shared/services/flow'

type Tab = 'active' | 'history'

const ACTIVE = ['Received', 'Preparing', 'Ready', 'Packed', 'PickedUp']

export default function RiderApp() {
  const notify = useToast()
  const { user } = useAuth()
  const flow = useFlow()
  const riderId = user?.role === 'rider' ? user.id : DEMO_RIDER_ID
  const rider = flow.riders.find((r) => r.id === riderId)
  const [tab, setTab] = useState<Tab>('active')
  const [scanFor, setScanFor] = useState<FlowOrder | null>(null)
  const [payFor, setPayFor] = useState<FlowOrder | null>(null)

  const mine = flow.orders.filter((o) => o.riderId === riderId)
  const active = mine.filter((o) => ACTIVE.includes(o.status))
  const done = mine.filter((o) => o.status === 'Delivered')
  const cash = done.filter((o) => o.payment?.method === 'Cash').reduce((s, o) => s + (o.payment?.amount ?? 0), 0)
  const easypaisa = done.filter((o) => o.payment?.method === 'Easypaisa').reduce((s, o) => s + (o.payment?.amount ?? 0), 0)

  // "Rider notified — phone + address"
  const seen = useRef(new Set(active.map((o) => o.id)))
  useEffect(() => {
    for (const o of active) {
      if (seen.current.has(o.id)) continue
      seen.current.add(o.id)
      chime()
      notify(`New delivery #${o.orderNo} — ${o.customer?.address ?? ''}`, 'info')
    }
  }, [active, notify])

  return (
    <MobileShell
      title="Rider"
      icon={Bike}
      subtitle={rider ? `${rider.name} · ${rider.vehicle}` : 'Rider'}
      tab={tab}
      onTab={setTab}
      tabs={[
        { id: 'active', label: 'Deliveries', icon: Bike, count: active.length },
        { id: 'history', label: 'Today', icon: History },
      ]}
    >
      {rider && (
        <div className="mb-4 rounded-xl bg-white p-3 ring-1 ring-slate-200">
          <Toggle
            checked={rider.status !== 'Offline'}
            onChange={(on) => setRiderStatus(rider.id, on ? (active.length ? 'On delivery' : 'Available') : 'Offline')}
            label={rider.status === 'Offline' ? 'You are offline' : rider.status === 'Available' ? 'Online — waiting for orders' : 'On delivery'}
            description="New deliveries are assigned to online riders"
          />
        </div>
      )}

      {tab === 'active' && (
        <div className="space-y-3">
          {active.length === 0 && (
            <div className="py-12 text-center">
              <Bike size={32} className="mx-auto text-slate-300" />
              <p className="mt-2 text-sm text-slate-500">No deliveries right now. You'll be notified when the kitchen accepts one.</p>
            </div>
          )}
          {active.map((o) => (
            <DeliveryCard key={o.id} o={o} onScan={() => setScanFor(o)} onPay={() => setPayFor(o)} />
          ))}
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Delivered" value={String(done.length)} />
            <Stat label="Cash in hand" value={formatCurrency(cash)} />
            <Stat label="Easypaisa" value={formatCurrency(easypaisa)} />
          </div>
          {done.map((o) => (
            <div key={o.id} className="flex items-center gap-3 rounded-xl bg-white p-3 text-sm ring-1 ring-slate-200">
              <CheckCircle2 size={18} className="text-emerald-500" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-800">#{o.orderNo} · {o.customer?.name}</p>
                <p className="truncate text-xs text-slate-500">{o.customer?.address}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{formatCurrency(o.payment?.amount ?? 0)}</p>
                <p className="text-[11px] text-slate-500">{o.payment?.method} · {o.payment ? timeAgo(o.payment.at) : ''}</p>
              </div>
            </div>
          ))}
          {done.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No deliveries completed yet today.</p>}
        </div>
      )}

      {scanFor && <ScanModal order={scanFor} onClose={() => setScanFor(null)} />}
      {payFor && <PayModal order={payFor} onClose={() => setPayFor(null)} />}
    </MobileShell>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white p-3 text-center ring-1 ring-slate-200">
      <p className="text-base font-semibold text-slate-900">{value}</p>
      <p className="text-[11px] text-slate-500">{label}</p>
    </div>
  )
}

const steps = ['Notified', 'At counter', 'Picked up', 'Delivered'] as const
const stepOf = (o: FlowOrder) => (o.status === 'PickedUp' ? 2 : o.status === 'Ready' || o.status === 'Packed' ? 1 : 0)

function DeliveryCard({ o, onScan, onPay }: { o: FlowOrder; onScan: () => void; onPay: () => void }) {
  const step = stepOf(o)
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(o.customer?.address ?? '')}`
  return (
    <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
        <span className="text-lg font-bold text-slate-900">#{o.orderNo}</span>
        <FlowStatusBadge status={o.status} />
        <span className="ml-auto text-sm font-semibold text-slate-900">{formatCurrency(orderTotal(o))}</span>
      </div>

      <ol className="flex px-4 pt-3">
        {steps.map((s, i) => (
          <li key={s} className="flex flex-1 flex-col items-center gap-1 text-center">
            <span className={cn('h-2 w-full rounded-full', i <= step ? 'bg-brand-500' : 'bg-slate-200')} />
            <span className={cn('text-[10px]', i <= step ? 'font-semibold text-brand-700' : 'text-slate-400')}>{s}</span>
          </li>
        ))}
      </ol>

      <div className="space-y-2 px-4 py-3 text-sm">
        <p className="font-semibold text-slate-900">{o.customer?.name}</p>
        <a href={`tel:${o.customer?.phone}`} className="flex items-center gap-2 text-brand-700">
          <Phone size={14} /> {o.customer?.phone}
        </a>
        <p className="flex items-start gap-2 text-slate-700">
          <MapPin size={14} className="mt-0.5 shrink-0 text-slate-400" /> {o.customer?.address}
        </p>
        <p className="flex items-center gap-2 text-slate-700">
          <Wallet size={14} className="text-slate-400" /> Collect by <span className="font-semibold">{o.payOnDelivery ?? 'Cash'}</span>
        </p>
        <details className="rounded-lg bg-slate-50 px-3 py-2">
          <summary className="cursor-pointer text-xs font-medium text-slate-600">{o.items.reduce((s, i) => s + i.qty, 0)} items</summary>
          <div className="mt-2">
            <ItemLines order={o} compact />
          </div>
        </details>
      </div>

      <div className="border-t border-slate-100 p-3">
        {step === 0 && <p className="text-center text-sm text-slate-500">Kitchen is preparing — head to the counter (~{Math.max(1, o.predictedMins - 2)} min).</p>}
        {step === 1 && (
          <Button block size="lg" icon={ScanLine} onClick={onScan}>
            {o.status === 'Packed' ? 'Scan to pick up' : 'Ready at counter — scan to pick up'}
          </Button>
        )}
        {step === 2 && (
          <div className="grid grid-cols-2 gap-2">
            <a href={mapsUrl} target="_blank" rel="noreferrer" className="flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <Navigation size={16} /> Navigate
            </a>
            <Button size="lg" variant="success" icon={Banknote} onClick={onPay}>
              Collect payment
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

/** Pickup scan. Camera scanning comes with the native app; the demo accepts the order number. */
function ScanModal({ order, onClose }: { order: FlowOrder; onClose: () => void }) {
  const notify = useToast()
  const [code, setCode] = useState('')
  const [scanning, setScanning] = useState(false)
  const ok = code.trim() === String(order.orderNo)

  const pickup = () => {
    riderPickup(order.id)
    notify(`#${order.orderNo} picked up — counter updated`)
    onClose()
  }

  return (
    <Modal open onClose={onClose} size="sm" title="Scan order at counter" description={`Scan the QR on the bag for #${order.orderNo}`}>
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => {
            setScanning(true)
            setTimeout(() => (setScanning(false), setCode(String(order.orderNo))), 1200)
          }}
          className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl bg-ink-900 text-slate-400"
        >
          <span className="absolute inset-10 rounded-xl border-2 border-dashed border-white/30" />
          {scanning ? <span className="absolute inset-x-10 top-1/2 h-0.5 animate-pulse bg-brand-500" /> : null}
          <span className="relative flex flex-col items-center gap-2 text-sm">
            <ScanLine size={32} className="text-white" />
            {scanning ? 'Scanning…' : ok ? 'Bag matched' : 'Tap to scan'}
          </span>
        </button>
        <div>
          <p className="mb-1 text-xs text-slate-500">Or enter the order number</p>
          <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder={String(order.orderNo)} className="h-11 w-full rounded-lg border border-slate-200 px-3 text-center text-lg font-semibold tracking-widest" />
          {code && !ok && <p className="mt-1 text-xs text-red-600">This bag is not #{order.orderNo}</p>}
        </div>
        <Button block size="lg" icon={PackageCheck} disabled={!ok} onClick={pickup}>
          Confirm pickup
        </Button>
      </div>
    </Modal>
  )
}

function PayModal({ order, onClose }: { order: FlowOrder; onClose: () => void }) {
  const notify = useToast()
  const [method, setMethod] = useState<PayMethod>(order.payOnDelivery ?? 'Cash')
  const [txn, setTxn] = useState('')
  const total = orderTotal(order)

  const finish = () => {
    deliverOrder(order.id, method)
    notify(`#${order.orderNo} delivered · ${formatCurrency(total)} by ${method}`)
    onClose()
  }

  return (
    <Modal open onClose={onClose} size="sm" title="Collect payment" description={`${order.customer?.name} · #${order.orderNo}`}>
      <div className="space-y-4">
        <p className="text-center text-3xl font-semibold text-slate-900">{formatCurrency(total)}</p>
        <div className="grid grid-cols-2 gap-2">
          {(['Cash', 'Easypaisa'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              className={cn('flex flex-col items-center gap-1 rounded-xl border px-3 py-3 text-sm font-medium', method === m ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600')}
            >
              {m === 'Cash' ? <Banknote size={20} /> : <Smartphone size={20} />}
              {m}
            </button>
          ))}
        </div>
        {method === 'Easypaisa' && (
          <div className="space-y-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
            <p>
              Ask the customer to send <span className="font-semibold">{formatCurrency(total)}</span> to Easypaisa <span className="font-semibold">0345-1234567</span> (Spice Route Kitchen).
            </p>
            <input value={txn} onChange={(e) => setTxn(e.target.value)} placeholder="Transaction ID (optional)" className="h-10 w-full rounded-lg border border-emerald-200 bg-white px-3 text-sm" />
          </div>
        )}
        <Button block size="lg" variant="success" icon={CheckCircle2} onClick={finish}>
          {method === 'Cash' ? 'Cash received — delivered' : 'Payment received — delivered'}
        </Button>
      </div>
    </Modal>
  )
}
