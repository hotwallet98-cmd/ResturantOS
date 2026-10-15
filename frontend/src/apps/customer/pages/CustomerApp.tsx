import { Banknote, Bike, Check, ChefHat, ChevronLeft, MapPin, PhoneCall, Receipt, ShoppingBag, Smartphone, Store, UtensilsCrossed, X } from 'lucide-react'
import type { FormEvent } from 'react'
import { useState } from 'react'
import type { Cart } from '@/shared/components/flow/flowHelpers'
import { cartCount, cartItems } from '@/shared/components/flow/flowHelpers'
import { ItemLines, MenuPicker } from '@/shared/components/flow/FlowBits'
import { Button, Field, Input, Textarea } from '@/shared/components/ui'
import { cn } from '@/shared/lib/cn'
import { formatCurrency, timeAgo } from '@/shared/lib/format'
import type { FlowOrder, PayMethod } from '@/shared/services/flow'
import { DELIVERY_FEE, orderTotal, placeCustomerOrder, RESTAURANT_NAME, useFlow } from '@/shared/services/flow'
import { startVerificationCall } from '@/shared/services/verifyCall'

type Screen = 'menu' | 'checkout' | 'track' | 'orders'

const MY_ORDERS_KEY = 'ros.customer.orders'
const readMine = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(MY_ORDERS_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

/** Public customer ordering app (no staff login). */
export default function CustomerApp() {
  const flow = useFlow()
  const [screen, setScreen] = useState<Screen>('menu')
  const [cart, setCart] = useState<Cart>({})
  const [mine, setMine] = useState<string[]>(readMine)
  const [trackId, setTrackId] = useState<string | null>(mine[0] ?? null)
  const items = cartItems(cart)
  const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0)
  const myOrders = mine.map((id) => flow.orders.find((o) => o.id === id)).filter((o): o is FlowOrder => !!o)
  const tracking = flow.orders.find((o) => o.id === trackId)

  const onPlaced = (o: FlowOrder) => {
    const next = [o.id, ...mine]
    setMine(next)
    try {
      localStorage.setItem(MY_ORDERS_KEY, JSON.stringify(next))
    } catch {
      /* storage unavailable */
    }
    setCart({})
    setTrackId(o.id)
    setScreen('track')
  }

  return (
    <div className="min-h-full bg-slate-200/60 sm:py-6">
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col bg-slate-50 sm:min-h-[calc(100vh-3rem)] sm:overflow-hidden sm:rounded-[2rem] sm:shadow-2xl sm:ring-8 sm:ring-ink-900">
        <header className="sticky top-0 z-20 bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            {screen !== 'menu' ? (
              <button type="button" onClick={() => setScreen('menu')} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100" aria-label="Back to menu">
                <ChevronLeft size={20} />
              </button>
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
                <UtensilsCrossed size={18} />
              </span>
            )}
            <div className="min-w-0 flex-1 leading-tight">
              <p className="font-semibold text-slate-900">{RESTAURANT_NAME}</p>
              <p className="flex items-center gap-1 text-[11px] text-slate-500">
                <Bike size={11} /> Delivery in 30–40 min · {formatCurrency(DELIVERY_FEE)} fee
              </p>
            </div>
            {myOrders.length > 0 && (
              <button type="button" onClick={() => setScreen('orders')} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50">
                <Receipt size={15} /> My orders
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 pt-4 pb-28">
          {screen === 'menu' && (
            <>
              {tracking && !['Delivered', 'Cancelled'].includes(tracking.status) && (
                <button type="button" onClick={() => setScreen('track')} className="mb-3 flex w-full items-center gap-2 rounded-xl bg-ink-900 px-3 py-2.5 text-left text-sm text-white">
                  <ShoppingBag size={16} className="text-brand-400" />
                  Order #{tracking.orderNo}: {customerStatus(tracking).title}
                  <span className="ml-auto text-xs text-slate-400">Track →</span>
                </button>
              )}
              <MenuPicker cart={cart} setCart={setCart} dense />
            </>
          )}
          {screen === 'checkout' && <Checkout items={items} subtotal={subtotal} onPlaced={onPlaced} />}
          {screen === 'track' && tracking && <Tracking o={tracking} />}
          {screen === 'orders' && (
            <ul className="space-y-2">
              {myOrders.map((o) => (
                <li key={o.id}>
                  <button type="button" onClick={() => (setTrackId(o.id), setScreen('track'))} className="flex w-full items-center gap-3 rounded-xl bg-white p-3 text-left ring-1 ring-slate-200">
                    <ShoppingBag size={18} className="text-brand-600" />
                    <span className="flex-1">
                      <span className="block text-sm font-semibold text-slate-900">#{o.orderNo} · {formatCurrency(orderTotal(o))}</span>
                      <span className="text-xs text-slate-500">{customerStatus(o).title} · {timeAgo(o.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </main>

        {screen === 'menu' && items.length > 0 && (
          <div className="sticky bottom-0 z-20 border-t border-slate-200 bg-white p-3">
            <Button block size="lg" icon={ShoppingBag} onClick={() => setScreen('checkout')}>
              View cart · {cartCount(cart)} items · {formatCurrency(subtotal)}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

function Checkout({ items, subtotal, onPlaced }: { items: ReturnType<typeof cartItems>; subtotal: number; onPlaced: (o: FlowOrder) => void }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [pay, setPay] = useState<PayMethod>('Cash')
  const valid = name.trim() && /^\+?[\d\s-]{10,}$/.test(phone.trim()) && address.trim().length > 8 && items.length > 0

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!valid) return
    const o = placeCustomerOrder({ name: name.trim(), phone: phone.trim(), address: address.trim(), items: notes ? items.map((i, idx) => (idx === 0 ? { ...i, notes } : i)) : items, pay })
    // Voice agent rings the customer straight away to verify the order
    startVerificationCall(o.id)
    onPlaced(o)
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        <p className="mb-2 text-sm font-semibold text-slate-900">Your order</p>
        <ItemLines order={{ items }} />
        <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm">
          <p className="flex justify-between text-slate-600">
            <span>Subtotal</span> {formatCurrency(subtotal)}
          </p>
          <p className="flex justify-between text-slate-600">
            <span>Delivery</span> {formatCurrency(DELIVERY_FEE)}
          </p>
          <p className="flex justify-between font-semibold text-slate-900">
            <span>Total</span> {formatCurrency(subtotal + DELIVERY_FEE)}
          </p>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        <Field label="Name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </Field>
        <Field label="Phone" required hint="Our assistant will call this number to confirm your order">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" placeholder="03xx xxxxxxx" autoComplete="tel" />
        </Field>
        <Field label="Delivery address" required>
          <Textarea rows={2} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="House, street, area, city" autoComplete="street-address" />
        </Field>
        <Field label="Note for the kitchen">
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. less spicy" />
        </Field>
      </div>

      <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        <p className="mb-2 text-sm font-semibold text-slate-900">Pay on delivery</p>
        <div className="grid grid-cols-2 gap-2">
          {(['Cash', 'Easypaisa'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setPay(m)}
              className={cn('flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium', pay === m ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600')}
            >
              {m === 'Cash' ? <Banknote size={17} /> : <Smartphone size={17} />}
              {m}
            </button>
          ))}
        </div>
      </div>

      <Button type="submit" block size="lg" disabled={!valid}>
        Place order · {formatCurrency(subtotal + DELIVERY_FEE)}
      </Button>
    </form>
  )
}

function customerStatus(o: FlowOrder): { title: string; step: number } {
  switch (o.status) {
    case 'Placed':
    case 'Verifying':
      return { title: 'Confirming your order', step: 0 }
    case 'Received':
      return { title: 'Confirmed — sent to kitchen', step: 1 }
    case 'Preparing':
      return { title: 'Being prepared', step: 2 }
    case 'Ready':
    case 'Packed':
      return { title: 'Packed, rider on the way to pick up', step: 3 }
    case 'PickedUp':
      return { title: 'On the way', step: 4 }
    case 'Delivered':
      return { title: 'Delivered', step: 5 }
    case 'Cancelled':
      return { title: 'Cancelled', step: -1 }
    default:
      return { title: o.status, step: 1 }
  }
}

const trackSteps = [
  { label: 'Order placed', icon: Receipt },
  { label: 'Confirmed by call', icon: PhoneCall },
  { label: 'Preparing', icon: ChefHat },
  { label: 'Ready & packed', icon: Store },
  { label: 'On the way', icon: Bike },
  { label: 'Delivered', icon: Check },
]

function Tracking({ o }: { o: FlowOrder }) {
  const flow = useFlow()
  const { title, step } = customerStatus(o)
  const rider = flow.riders.find((r) => r.id === o.riderId)
  const call = o.call
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-ink-900 p-5 text-white">
        <p className="text-xs text-slate-400">Order #{o.orderNo}</p>
        <p className="mt-1 text-xl font-semibold">{title}</p>
        {step >= 1 && step < 5 && <p className="mt-1 text-sm text-slate-300">Arriving in about {o.predictedMins + 15} min</p>}
      </div>

      {(o.status === 'Placed' || o.status === 'Verifying') && (
        <div className="flex items-center gap-3 rounded-2xl bg-violet-50 p-4 text-sm text-violet-900 ring-1 ring-violet-200">
          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white">
            <span className="absolute inset-0 animate-ping rounded-full bg-violet-500/50" />
            <PhoneCall size={18} className="relative" />
          </span>
          <span>
            {call?.state === 'talking' ? 'Our assistant is on the line with you.' : call?.state === 'no_answer' ? "We couldn't reach you — we'll try again shortly." : `Our assistant is calling ${o.customer?.phone} to confirm your order.`}
          </span>
        </div>
      )}

      {o.status === 'Cancelled' ? (
        <div className="flex items-center gap-3 rounded-2xl bg-red-50 p-4 text-sm text-red-800 ring-1 ring-red-200">
          <X size={18} /> This order was cancelled.
        </div>
      ) : (
        <ol className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          {trackSteps.map((s, i) => {
            const done = i <= step
            return (
              <li key={s.label} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className={cn('flex h-8 w-8 items-center justify-center rounded-full', done ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-400', i === step && 'ring-4 ring-brand-100')}>
                    <s.icon size={15} />
                  </span>
                  {i < trackSteps.length - 1 && <span className={cn('my-1 h-6 w-0.5', i < step ? 'bg-brand-500' : 'bg-slate-200')} />}
                </div>
                <p className={cn('pt-1.5 text-sm', done ? 'font-semibold text-slate-900' : 'text-slate-400')}>{s.label}</p>
              </li>
            )
          })}
        </ol>
      )}

      {rider && step >= 2 && step < 5 && (
        <div className="flex items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <Bike size={18} />
          </span>
          <div className="flex-1 text-sm">
            <p className="font-semibold text-slate-900">{rider.name}</p>
            <p className="text-xs text-slate-500">{rider.vehicle}</p>
          </div>
          <a href={`tel:${rider.phone}`} className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white">
            Call rider
          </a>
        </div>
      )}

      <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        <ItemLines order={o} />
        <p className="mt-3 flex justify-between border-t border-slate-100 pt-3 text-sm font-semibold">
          <span>Total · {o.payOnDelivery} on delivery</span> {formatCurrency(orderTotal(o))}
        </p>
        <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-500">
          <MapPin size={13} className="mt-0.5 shrink-0" /> {o.customer?.address}
        </p>
      </div>
    </div>
  )
}
