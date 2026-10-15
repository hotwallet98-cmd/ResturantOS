import {
  Ban,
  Banknote,
  Bike,
  CheckCircle2,
  ChefHat,
  Clock,
  CreditCard,
  Flame,
  ListOrdered,
  Minus,
  MonitorSmartphone,
  Pencil,
  Percent,
  Plus,
  Printer,
  Receipt,
  RotateCcw,
  ShoppingBag,
  ShoppingCart,
  Split,
  Users,
  UtensilsCrossed,
  Wallet,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { AIPanel } from '@/shared/components/operations/AIPanel'
import {
  Badge,
  Button,
  Card,
  Checkbox,
  DataTable,
  DescriptionList,
  Drawer,
  Field,
  Input,
  LoadingState,
  Modal,
  PageHeader,
  SearchInput,
  Select,
  StatCard,
  StatusBadge,
  Tabs,
  Textarea,
  Toggle,
  useToast,
} from '@/shared/components/ui'
import type { Column } from '@/shared/components/ui'
import { useAuth } from '@/shared/context/AuthContext'
import { useAsync } from '@/shared/hooks/useAsync'
import { cn } from '@/shared/lib/cn'
import { formatCurrency, timeAgo } from '@/shared/lib/format'
import type { MenuItem, Order, OrderLine, OrderStatus, OrderType, PaymentMethod } from '@/shared/services/operations'
import {
  MENU_CATEGORIES,
  SERVICE_RATE,
  TAX_RATE,
  createOrder,
  getMenuItems,
  getOrders,
  getTables,
  payOrder,
  refundOrder,
  updateOrderStatus,
} from '@/shared/services/operations'

interface CartLine {
  key: string
  item: MenuItem
  qty: number
  variant?: string
  addons: string[]
  notes: string
}

const unitPrice = (l: Pick<CartLine, 'item' | 'variant' | 'addons'>) =>
  l.item.price +
  (l.item.variants.find((v) => v.name === l.variant)?.price ?? 0) +
  l.addons.reduce((s, a) => s + (l.item.addons.find((x) => x.name === a)?.price ?? 0), 0)

const orderTypes: { id: OrderType; icon: typeof Users }[] = [
  { id: 'Dine-in', icon: UtensilsCrossed },
  { id: 'Takeaway', icon: ShoppingBag },
  { id: 'Delivery', icon: Bike },
]

const nextStatus: Partial<Record<OrderStatus, OrderStatus>> = {
  New: 'Preparing',
  Preparing: 'Ready',
  Ready: 'Served',
  Served: 'Completed',
  'Out for delivery': 'Completed',
}

export default function Pos() {
  const { branch } = useAuth()
  const [tab, setTab] = useState<'terminal' | 'orders'>('terminal')
  const ordersQ = useAsync(getOrders)
  const orders = ordersQ.data ?? []

  const open = orders.filter((o) => ['New', 'Preparing', 'Ready', 'Out for delivery'].includes(o.status)).length
  const revenue = orders.filter((o) => o.paymentStatus === 'Paid').reduce((s, o) => s + o.total, 0)
  const refunds = orders.filter((o) => o.status === 'Refunded' || o.status === 'Cancelled')

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ShoppingCart}
        title="Orders & POS"
        description={`Dine-in, takeaway & delivery orders · ${branch}`}
        actions={
          <>
            <Badge tone="green" dot>
              Terminal POS-01 online
            </Badge>
            <Button variant="outline" icon={ListOrdered} onClick={() => setTab('orders')}>
              Order list
            </Button>
            <Button icon={Plus} onClick={() => setTab('terminal')}>
              New order
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Open orders" value={open} icon={Receipt} tone="brand" hint="across all channels" />
        <StatCard label="Collected today" value={formatCurrency(revenue)} icon={Banknote} tone="green" delta={6.8} deltaLabel="vs yesterday" />
        <StatCard label="Avg kitchen time" value="14.6 min" icon={Clock} tone="blue" delta={-4.2} invertDelta deltaLabel="vs yesterday" />
        <StatCard label="Refunds / cancels" value={refunds.length} icon={RotateCcw} tone="red" hint={formatCurrency(refunds.reduce((s, o) => s + o.total, 0))} />
      </div>

      <Tabs
        items={[
          { id: 'terminal', label: 'POS Terminal', icon: MonitorSmartphone },
          { id: 'orders', label: 'Orders', icon: ListOrdered, count: orders.length },
        ]}
        value={tab}
        onChange={setTab}
      />

      {ordersQ.loading ? (
        <LoadingState />
      ) : tab === 'terminal' ? (
        <Terminal
          nextNumber={Math.max(1000, ...orders.map((o) => o.number)) + 1}
          onCreate={(o) => ordersQ.setData((prev) => [o, ...(prev ?? [])])}
        />
      ) : (
        <OrdersTab orders={orders} setOrders={(fn) => ordersQ.setData((prev) => fn(prev ?? []))} />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Terminal                                                            */
/* ------------------------------------------------------------------ */

function Terminal({ nextNumber, onCreate }: { nextNumber: number; onCreate: (o: Order) => void }) {
  const notify = useToast()
  const { branch } = useAuth()
  const menuQ = useAsync(getMenuItems)
  const tablesQ = useAsync(getTables)
  const [category, setCategory] = useState<string>('All')
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [orderType, setOrderType] = useState<OrderType>('Dine-in')
  const [table, setTable] = useState('')
  const [customer, setCustomer] = useState('')
  const [phone, setPhone] = useState('')
  const [discountType, setDiscountType] = useState<'%' | 'flat'>('%')
  const [discountValue, setDiscountValue] = useState(0)
  const [serviceOn, setServiceOn] = useState(true)
  const [editing, setEditing] = useState<CartLine | null>(null)
  const [paying, setPaying] = useState(false)
  const [sending, setSending] = useState(false)

  const items = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (menuQ.data ?? []).filter((i) => (category === 'All' || i.category === category) && (!q || i.name.toLowerCase().includes(q)))
  }, [menuQ.data, category, query])

  const subtotal = cart.reduce((s, l) => s + unitPrice(l) * l.qty, 0)
  const discount = Math.min(subtotal, discountType === '%' ? (subtotal * discountValue) / 100 : discountValue)
  const net = subtotal - discount
  const service = orderType === 'Dine-in' && serviceOn ? net * SERVICE_RATE : 0
  const deliveryFee = orderType === 'Delivery' && cart.length ? 2.5 : 0
  const tax = net * TAX_RATE
  const total = net + service + tax + deliveryFee
  const count = cart.reduce((s, l) => s + l.qty, 0)

  const addItem = (item: MenuItem) => {
    if (!item.available) return notify(`${item.name} is unavailable (86'd)`, 'error')
    if (item.variants.length || item.addons.length) {
      setEditing({ key: '', item, qty: 1, variant: item.variants[0]?.name, addons: [], notes: '' })
      return
    }
    setCart((c) => {
      const existing = c.find((l) => l.item.id === item.id && !l.variant && !l.addons.length && !l.notes)
      return existing ? c.map((l) => (l === existing ? { ...l, qty: l.qty + 1 } : l)) : [...c, { key: crypto.randomUUID(), item, qty: 1, addons: [], notes: '' }]
    })
  }

  const saveLine = (line: CartLine) => {
    setCart((c) => (line.key ? c.map((l) => (l.key === line.key ? line : l)) : [...c, { ...line, key: crypto.randomUUID() }]))
    setEditing(null)
  }

  const changeQty = (key: string, d: number) => setCart((c) => c.flatMap((l) => (l.key !== key ? [l] : l.qty + d <= 0 ? [] : [{ ...l, qty: l.qty + d }])))

  const reset = () => {
    setCart([])
    setTable('')
    setCustomer('')
    setPhone('')
    setDiscountValue(0)
  }

  const validate = () => {
    if (!cart.length) return notify('Add at least one item', 'error'), false
    if (orderType === 'Dine-in' && !table) return notify('Pick a table for dine-in orders', 'error'), false
    if (orderType === 'Delivery' && !phone) return notify('Customer phone is required for delivery', 'error'), false
    return true
  }

  const buildOrder = (paid: PaymentMethod | null): Order => {
    const lines: OrderLine[] = cart.map((l) => ({
      itemId: l.item.id,
      name: l.item.name,
      emoji: l.item.emoji,
      qty: l.qty,
      price: +unitPrice(l).toFixed(2),
      station: l.item.station,
      modifiers: [l.variant, ...l.addons].filter((x): x is string => !!x),
      notes: l.notes || undefined,
    }))
    return {
      id: `ord-${nextNumber}`,
      number: nextNumber,
      type: orderType,
      channel: 'POS',
      table: orderType === 'Dine-in' ? table : undefined,
      customer: customer || (orderType === 'Dine-in' ? `Table ${table} guests` : 'Walk-in'),
      phone: phone || undefined,
      items: lines,
      subtotal: +subtotal.toFixed(2),
      discount: +discount.toFixed(2),
      tax: +tax.toFixed(2),
      serviceCharge: +service.toFixed(2),
      deliveryFee,
      total: +total.toFixed(2),
      status: 'New',
      paymentStatus: paid ? 'Paid' : 'Unpaid',
      paymentMethod: paid ?? undefined,
      server: 'Bilal Ahmed',
      branch: branch === 'All branches' ? 'Downtown' : (branch as Order['branch']),
      createdAt: new Date().toISOString(),
      predictedMins: Math.max(...cart.map((l) => l.item.prepMins)) + 3,
      priority: orderType === 'Delivery' ? 'High' : 'Normal',
    }
  }

  const sendToKitchen = async () => {
    if (!validate()) return
    setSending(true)
    const o = await createOrder(buildOrder(null))
    setSending(false)
    onCreate(o)
    const stations = [...new Set(o.items.map((l) => l.station))].join(', ')
    notify(`Order #${o.number} sent to kitchen → ${stations}`)
    reset()
  }

  const completePayment = async (method: PaymentMethod, payments: { method: PaymentMethod; amount: number }[]) => {
    const o = await createOrder(buildOrder(method))
    await payOrder(o.id, payments)
    onCreate(o)
    setPaying(false)
    notify(`Order #${o.number} paid · ${formatCurrency(o.total)} — ticket routed to kitchen`)
    reset()
  }

  if (menuQ.loading) return <LoadingState label="Loading menu…" />

  const tableOptions = (tablesQ.data ?? []).map((t) => ({ value: t.id, label: `${t.name} · ${t.area} · ${t.seats} seats · ${t.status}` }))

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Items */}
        <div className="min-w-0 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <SearchInput value={query} onChange={setQuery} placeholder="Search menu or scan barcode…" className="sm:w-72" />
            <p className="text-xs text-slate-500 sm:ml-auto">Tap an item to add · items with options open a modifier picker</p>
          </div>
          <Tabs variant="pills" items={['All', ...MENU_CATEGORIES].map((c) => ({ id: c, label: c }))} value={category} onChange={setCategory} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {items.map((it) => {
              const inCart = cart.filter((l) => l.item.id === it.id).reduce((s, l) => s + l.qty, 0)
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => addItem(it)}
                  className={cn(
                    'group relative flex flex-col rounded-xl border bg-white p-3 text-left shadow-sm transition active:scale-[0.98]',
                    it.available ? 'border-slate-200 hover:border-brand-300 hover:shadow-md' : 'cursor-not-allowed border-slate-200 opacity-50',
                    inCart > 0 && 'border-brand-400 ring-2 ring-brand-500/20',
                  )}
                >
                  {inCart > 0 && (
                    <span className="absolute top-2 right-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-600 px-1.5 text-xs font-bold text-white">{inCart}</span>
                  )}
                  <span className="mb-2 flex h-14 items-center justify-center rounded-lg bg-gradient-to-br from-brand-50 to-amber-50 text-3xl">{it.emoji}</span>
                  <span className="line-clamp-2 text-sm leading-snug font-medium text-slate-800">{it.name}</span>
                  <span className="mt-auto flex items-center justify-between pt-2">
                    <span className="text-sm font-semibold text-slate-900">{formatCurrency(it.price)}</span>
                    <span className="flex items-center gap-1">
                      {it.veg && <span title="Vegetarian" className="h-2.5 w-2.5 rounded-sm border border-emerald-600 bg-emerald-500" />}
                      {it.spicy >= 2 && <Flame size={13} className="text-red-500" />}
                      {!it.available && <Badge tone="red">86</Badge>}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Cart */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <Card className="flex flex-col overflow-hidden" bodyClassName="p-0">
            <div className="border-b border-slate-100 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">
                  Order #{nextNumber} <span className="text-sm font-normal text-slate-400">· {count} items</span>
                </h3>
                {cart.length > 0 && (
                  <button type="button" onClick={reset} className="text-xs font-medium text-slate-500 hover:text-red-600">
                    Clear
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
                {orderTypes.map(({ id, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setOrderType(id)}
                    className={cn(
                      'flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition',
                      orderType === id ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-800',
                    )}
                  >
                    <Icon size={14} />
                    {id}
                  </button>
                ))}
              </div>
              <div className="mt-3 grid gap-2">
                {orderType === 'Dine-in' ? (
                  <Select value={table} onChange={(e) => setTable(e.target.value)} options={tableOptions} placeholder="Select table…" />
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Customer name" value={customer} onChange={(e) => setCustomer(e.target.value)} />
                    <Input placeholder={orderType === 'Delivery' ? 'Phone *' : 'Phone'} value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                )}
              </div>
            </div>

            <div className="scrollbar-thin max-h-[22rem] min-h-40 flex-1 overflow-y-auto">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-slate-400">
                  <ShoppingCart size={28} />
                  Cart is empty
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {cart.map((l) => (
                    <li key={l.key} className="flex gap-3 px-4 py-3">
                      <span className="text-xl">{l.item.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <button type="button" onClick={() => setEditing(l)} className="text-left text-sm font-medium text-slate-800 hover:text-brand-700">
                            {l.item.name}
                          </button>
                          <span className="text-sm font-semibold whitespace-nowrap text-slate-900">{formatCurrency(unitPrice(l) * l.qty)}</span>
                        </div>
                        {(l.variant || l.addons.length > 0) && <p className="text-xs text-slate-500">{[l.variant, ...l.addons].filter(Boolean).join(' · ')}</p>}
                        {l.notes && <p className="text-xs text-amber-700 italic">“{l.notes}”</p>}
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="flex items-center rounded-lg border border-slate-200">
                            <button type="button" aria-label="Decrease" onClick={() => changeQty(l.key, -1)} className="p-1.5 text-slate-500 hover:text-slate-900">
                              <Minus size={13} />
                            </button>
                            <span className="w-6 text-center text-sm font-semibold">{l.qty}</span>
                            <button type="button" aria-label="Increase" onClick={() => changeQty(l.key, 1)} className="p-1.5 text-slate-500 hover:text-slate-900">
                              <Plus size={13} />
                            </button>
                          </div>
                          <button type="button" onClick={() => setEditing(l)} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-brand-700">
                            <Pencil size={12} /> Modify
                          </button>
                          <span className="ml-auto text-[11px] text-slate-400">{l.item.station}</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-3 border-t border-slate-100 bg-slate-50/60 p-4">
              <div className="flex items-center gap-2">
                <Percent size={15} className="text-slate-400" />
                <span className="text-sm text-slate-600">Discount</span>
                <div className="ml-auto flex items-center gap-1">
                  <div className="flex rounded-md border border-slate-200 bg-white p-0.5 text-xs">
                    {(['%', 'flat'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setDiscountType(t)}
                        className={cn('rounded px-2 py-1 font-semibold', discountType === t ? 'bg-slate-900 text-white' : 'text-slate-500')}
                      >
                        {t === '%' ? '%' : '$'}
                      </button>
                    ))}
                  </div>
                  <Input
                    type="number"
                    min={0}
                    value={discountValue || ''}
                    onChange={(e) => setDiscountValue(Math.max(0, Number(e.target.value)))}
                    className="h-8 w-20 text-right"
                    placeholder="0"
                  />
                </div>
              </div>
              {orderType === 'Dine-in' && <Toggle checked={serviceOn} onChange={setServiceOn} label={<span className="text-sm font-normal text-slate-600">Service charge (5%)</span>} />}
              <dl className="space-y-1 text-sm">
                <Row label="Subtotal" value={formatCurrency(subtotal)} />
                {discount > 0 && <Row label="Discount" value={`−${formatCurrency(discount)}`} className="text-emerald-600" />}
                {service > 0 && <Row label="Service charge" value={formatCurrency(service)} />}
                {deliveryFee > 0 && <Row label="Delivery fee" value={formatCurrency(deliveryFee)} />}
                <Row label={`Tax (GST ${TAX_RATE * 100}%)`} value={formatCurrency(tax)} />
                <div className="flex items-center justify-between border-t border-dashed border-slate-200 pt-2 text-base font-semibold text-slate-900">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </dl>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" icon={ChefHat} loading={sending} onClick={sendToKitchen}>
                  Send to kitchen
                </Button>
                <Button icon={CreditCard} onClick={() => validate() && setPaying(true)}>
                  Charge {cart.length ? formatCurrency(total) : ''}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {editing && <ModifierModal line={editing} onClose={() => setEditing(null)} onSave={saveLine} />}
      {paying && <PaymentModal total={total} lines={cart} onClose={() => setPaying(false)} onComplete={completePayment} />}
    </>
  )
}

function Row({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn('flex justify-between text-slate-600', className)}>
      <dt>{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  )
}

function ModifierModal({ line, onClose, onSave }: { line: CartLine; onClose: () => void; onSave: (l: CartLine) => void }) {
  const [draft, setDraft] = useState(line)
  const { item } = draft
  return (
    <Modal
      open
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <span className="text-2xl">{item.emoji}</span> {item.name}
        </span>
      }
      description={item.description || `${item.category} · ${item.station} station · ~${item.prepMins} min`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSave(draft)}>
            {line.key ? 'Update item' : 'Add to order'} · {formatCurrency(unitPrice(draft) * draft.qty)}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {item.variants.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Variant</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {item.variants.map((v) => (
                <button
                  key={v.name}
                  type="button"
                  onClick={() => setDraft({ ...draft, variant: v.name })}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-left text-sm transition',
                    draft.variant === v.name ? 'border-brand-500 bg-brand-50 text-brand-800 ring-2 ring-brand-500/20' : 'border-slate-200 hover:border-slate-300',
                  )}
                >
                  <span className="block font-medium">{v.name}</span>
                  <span className="text-xs text-slate-500">{v.price === 0 ? 'Included' : `${v.price > 0 ? '+' : '−'}${formatCurrency(Math.abs(v.price))}`}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {item.addons.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Add-ons</p>
            <div className="space-y-2">
              {item.addons.map((a) => (
                <div key={a.name} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                  <Checkbox
                    checked={draft.addons.includes(a.name)}
                    onChange={(c) => setDraft({ ...draft, addons: c ? [...draft.addons, a.name] : draft.addons.filter((x) => x !== a.name) })}
                    label={a.name}
                  />
                  <span className="text-sm text-slate-500">{a.price ? `+${formatCurrency(a.price)}` : 'Free'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <Field label="Kitchen notes" hint="Printed on the KDS ticket">
          <Textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="e.g. less spicy, no onion, extra crispy" />
        </Field>
        <div className="flex flex-wrap gap-1.5">
          {['Less spicy', 'Extra spicy', 'No onion', 'Well done', 'Allergy: nuts', 'Serve first'].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setDraft({ ...draft, notes: draft.notes ? `${draft.notes}, ${n.toLowerCase()}` : n })}
              className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:border-brand-300 hover:text-brand-700"
            >
              + {n}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">Quantity</span>
          <div className="flex items-center rounded-lg border border-slate-200">
            <button type="button" aria-label="Decrease" onClick={() => setDraft({ ...draft, qty: Math.max(1, draft.qty - 1) })} className="p-2 text-slate-500">
              <Minus size={15} />
            </button>
            <span className="w-8 text-center font-semibold">{draft.qty}</span>
            <button type="button" aria-label="Increase" onClick={() => setDraft({ ...draft, qty: draft.qty + 1 })} className="p-2 text-slate-500">
              <Plus size={15} />
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

const methods: { id: PaymentMethod; icon: typeof Banknote; label: string }[] = [
  { id: 'Cash', icon: Banknote, label: 'Cash' },
  { id: 'Card', icon: CreditCard, label: 'Card' },
  { id: 'Wallet', icon: Wallet, label: 'Wallet (JazzCash / Easypaisa)' },
]

function PaymentModal({
  total,
  lines,
  onClose,
  onComplete,
}: {
  total: number
  lines: CartLine[]
  onClose: () => void
  onComplete: (method: PaymentMethod, payments: { method: PaymentMethod; amount: number }[]) => Promise<void>
}) {
  const [split, setSplit] = useState<'none' | 'equal' | 'items'>('none')
  const [ways, setWays] = useState(2)
  const [assign, setAssign] = useState<Record<string, number>>(() => Object.fromEntries(lines.map((l) => [l.key, 1])))
  const [method, setMethod] = useState<PaymentMethod>('Cash')
  const [tendered, setTendered] = useState('')
  const [paid, setPaid] = useState<{ method: PaymentMethod; amount: number }[]>([])
  const [busy, setBusy] = useState(false)

  const ratio = total / Math.max(0.01, lines.reduce((s, l) => s + unitPrice(l) * l.qty, 0))
  const shares: number[] =
    split === 'none'
      ? [total]
      : split === 'equal'
        ? Array.from({ length: ways }, () => total / ways)
        : Array.from({ length: ways }, (_, g) => lines.filter((l) => (assign[l.key] ?? 1) === g + 1).reduce((s, l) => s + unitPrice(l) * l.qty * ratio, 0))

  const idx = paid.length
  const due = shares[idx] ?? 0
  const cash = Number(tendered) || 0
  const change = method === 'Cash' ? cash - due : 0
  const allPaid = idx >= shares.length

  const payShare = async () => {
    if (method === 'Cash' && cash < due - 0.001) return
    const next = [...paid, { method, amount: +due.toFixed(2) }]
    setPaid(next)
    setTendered('')
    if (next.length >= shares.length) {
      setBusy(true)
      await onComplete(next.length > 1 ? next[0]!.method : method, next)
      setBusy(false)
    }
  }

  const quick = [due, Math.ceil(due / 5) * 5, Math.ceil(due / 10) * 10, Math.ceil(due / 50) * 50].filter((v, i, a) => a.indexOf(v) === i)

  return (
    <Modal open onClose={onClose} size="lg" title="Charge order" description={`Total due ${formatCurrency(total)}`}>
      <div className="space-y-5">
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-slate-700">
            <Split size={15} /> Split bill
          </p>
          <Tabs
            variant="pills"
            items={[
              { id: 'none', label: 'Single payment' },
              { id: 'equal', label: 'Split equally' },
              { id: 'items', label: 'Split by items' },
            ]}
            value={split}
            onChange={(v) => {
              setSplit(v)
              setPaid([])
            }}
          />
          {split !== 'none' && (
            <div className="mt-3 flex items-center gap-3">
              <span className="text-sm text-slate-600">Guests</span>
              <div className="flex items-center rounded-lg border border-slate-200">
                <button type="button" aria-label="Fewer" onClick={() => (setWays(Math.max(2, ways - 1)), setPaid([]))} className="p-1.5 text-slate-500">
                  <Minus size={14} />
                </button>
                <span className="w-6 text-center font-semibold">{ways}</span>
                <button type="button" aria-label="More" onClick={() => (setWays(Math.min(8, ways + 1)), setPaid([]))} className="p-1.5 text-slate-500">
                  <Plus size={14} />
                </button>
              </div>
            </div>
          )}
          {split === 'items' && (
            <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200">
              {lines.map((l) => (
                <li key={l.key} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span>{l.item.emoji}</span>
                  <span className="min-w-0 flex-1 truncate">
                    {l.qty}× {l.item.name}
                  </span>
                  <span className="text-slate-500">{formatCurrency(unitPrice(l) * l.qty)}</span>
                  <select
                    value={assign[l.key] ?? 1}
                    onChange={(e) => (setAssign({ ...assign, [l.key]: Number(e.target.value) }), setPaid([]))}
                    className="h-8 rounded-md border border-slate-200 px-2 text-xs"
                  >
                    {Array.from({ length: ways }, (_, g) => (
                      <option key={g} value={g + 1}>
                        Guest {g + 1}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          )}
        </div>

        {shares.length > 1 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {shares.map((s, i) => (
              <div
                key={i}
                className={cn(
                  'rounded-lg border px-3 py-2 text-sm',
                  i < idx ? 'border-emerald-200 bg-emerald-50' : i === idx ? 'border-brand-400 bg-brand-50 ring-2 ring-brand-500/20' : 'border-slate-200',
                )}
              >
                <p className="text-xs text-slate-500">Guest {i + 1}</p>
                <p className="font-semibold text-slate-900">{formatCurrency(s)}</p>
                {i < idx && (
                  <p className="flex items-center gap-1 text-xs text-emerald-700">
                    <CheckCircle2 size={12} /> {paid[i]!.method}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {!allPaid && (
          <>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {methods.map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMethod(id)}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition',
                    method === id ? 'border-brand-500 bg-brand-50 text-brand-800 ring-2 ring-brand-500/20' : 'border-slate-200 text-slate-700 hover:border-slate-300',
                  )}
                >
                  <Icon size={20} />
                  {label}
                </button>
              ))}
            </div>
            {method === 'Cash' ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={`Cash received${shares.length > 1 ? ` (guest ${idx + 1})` : ''}`}>
                  <Input type="number" min={0} value={tendered} onChange={(e) => setTendered(e.target.value)} placeholder={due.toFixed(2)} autoFocus />
                </Field>
                <div className="rounded-xl bg-slate-900 p-4 text-white">
                  <p className="text-xs text-slate-400">Change due</p>
                  <p className={cn('text-2xl font-semibold', change < 0 && 'text-red-400')}>{cash ? formatCurrency(Math.max(0, change)) : '—'}</p>
                  {cash > 0 && change < 0 && <p className="text-xs text-red-300">Short by {formatCurrency(-change)}</p>}
                </div>
                <div className="flex flex-wrap gap-2 sm:col-span-2">
                  {quick.map((q) => (
                    <button key={q} type="button" onClick={() => setTendered(q.toFixed(2))} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium hover:border-brand-300">
                      {q === due ? 'Exact' : formatCurrency(q)}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
                {method === 'Card' ? 'Tap, insert or swipe card on terminal PAX-A920…' : 'Show QR to customer or send payment request to their wallet.'}
              </div>
            )}
          </>
        )}

        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="success"
            size="lg"
            icon={CheckCircle2}
            loading={busy}
            disabled={allPaid || (method === 'Cash' && cash < due - 0.001)}
            onClick={payShare}
          >
            {shares.length > 1 ? `Collect guest ${Math.min(idx + 1, shares.length)} · ${formatCurrency(due)}` : `Complete payment · ${formatCurrency(due)}`}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Orders                                                              */
/* ------------------------------------------------------------------ */

function OrdersTab({ orders, setOrders }: { orders: Order[]; setOrders: (fn: (prev: Order[]) => Order[]) => void }) {
  const notify = useToast()
  const [type, setType] = useState<'All' | OrderType>('All')
  const [status, setStatus] = useState('')
  const [selected, setSelected] = useState<Order | null>(null)
  const [action, setAction] = useState<'refund' | 'cancel' | null>(null)
  const [reason, setReason] = useState('Food quality issue')
  const [amount, setAmount] = useState('')

  const rows = orders.filter((o) => (type === 'All' || o.type === type) && (!status || o.status === status))

  const patch = (id: string, p: Partial<Order>) => {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...p } : o)))
    setSelected((s) => (s && s.id === id ? { ...s, ...p } : s))
  }

  const advance = async (o: Order) => {
    const n = o.type === 'Delivery' && o.status === 'Ready' ? 'Out for delivery' : nextStatus[o.status]
    if (!n) return
    await updateOrderStatus(o.id, n)
    patch(o.id, { status: n, ...(n === 'Completed' ? { paymentStatus: 'Paid' } : {}) })
    notify(`Order #${o.number} → ${n}`)
  }

  const confirmAction = async () => {
    if (!selected) return
    if (action === 'refund') {
      const amt = Number(amount) || selected.total
      await refundOrder(selected.id, amt, reason)
      patch(selected.id, { status: 'Refunded', paymentStatus: amt < selected.total ? 'Partial' : 'Refunded' })
      notify(`Refunded ${formatCurrency(amt)} on #${selected.number}`)
    } else {
      await updateOrderStatus(selected.id, 'Cancelled')
      patch(selected.id, { status: 'Cancelled' })
      notify(`Order #${selected.number} cancelled — kitchen notified`, 'info')
    }
    setAction(null)
  }

  const columns: Column<Order>[] = [
    { key: 'number', header: 'Order', sortable: true, render: (o) => <span className="font-semibold text-slate-900">#{o.number}</span> },
    {
      key: 'type',
      header: 'Type',
      render: (o) => (
        <span className="text-sm">
          {o.type}
          <span className="block text-xs text-slate-400">{o.channel}</span>
        </span>
      ),
    },
    { key: 'customer', header: 'Table / Customer', render: (o) => (o.table ? <Badge tone="blue">Table {o.table}</Badge> : o.customer) },
    { key: 'items', header: 'Items', render: (o) => <span className="text-slate-600">{o.items.reduce((s, l) => s + l.qty, 0)} items</span> },
    { key: 'total', header: 'Total', align: 'right', sortable: true, render: (o) => <span className="font-medium">{formatCurrency(o.total)}</span> },
    { key: 'status', header: 'Status', render: (o) => <StatusBadge status={o.status} /> },
    {
      key: 'priority',
      header: 'AI priority',
      render: (o) =>
        ['New', 'Preparing'].includes(o.status) ? (
          <span className="inline-flex items-center gap-1.5 text-xs">
            <Badge tone={o.priority === 'Rush' ? 'red' : o.priority === 'High' ? 'orange' : 'gray'}>{o.priority}</Badge>
            <span className="text-slate-500">~{o.predictedMins}m</span>
          </span>
        ) : (
          <span className="text-xs text-slate-300">—</span>
        ),
    },
    { key: 'paymentStatus', header: 'Payment', render: (o) => <StatusBadge status={o.paymentStatus} /> },
    { key: 'createdAt', header: 'Placed', sortable: true, render: (o) => <span className="text-xs text-slate-500">{timeAgo(o.createdAt)}</span> },
  ]

  const steps: OrderStatus[] = selected?.type === 'Delivery' ? ['New', 'Preparing', 'Ready', 'Out for delivery', 'Completed'] : ['New', 'Preparing', 'Ready', 'Served', 'Completed']
  const reached = selected ? steps.indexOf(selected.status) : -1

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <Card flush className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
          <Tabs
            variant="pills"
            items={(['All', 'Dine-in', 'Takeaway', 'Delivery'] as const).map((t) => ({ id: t, label: t, count: t === 'All' ? orders.length : orders.filter((o) => o.type === t).length }))}
            value={type}
            onChange={setType}
          />
        </div>
        <DataTable
          columns={columns}
          data={rows}
          rowKey={(o) => o.id}
          searchKeys={['customer', 'table', 'channel']}
          searchPlaceholder="Search customer, table, channel…"
          onRowClick={setSelected}
          pageSize={10}
          toolbar={
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              placeholder="All statuses"
              options={['New', 'Preparing', 'Ready', 'Served', 'Out for delivery', 'Completed', 'Cancelled', 'Refunded']}
              className="h-9 w-44"
            />
          }
        />
      </Card>
      <AIPanel module="pos" title="AI order predictions" subtitle="Smart prioritisation & demand for the next hour" />

      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `Order #${selected.number}` : ''}
        description={selected ? `${selected.type} · ${selected.channel} · ${timeAgo(selected.createdAt)}` : ''}
        footer={
          selected && (
            <>
              <Button variant="ghost" icon={Printer} onClick={() => notify(`Receipt for #${selected.number} sent to printer`, 'info')}>
                Print
              </Button>
              {!['Cancelled', 'Refunded', 'Completed'].includes(selected.status) && (
                <Button variant="outline" icon={Ban} onClick={() => setAction('cancel')}>
                  Cancel
                </Button>
              )}
              {selected.paymentStatus === 'Paid' && selected.status !== 'Refunded' && (
                <Button variant="danger" icon={RotateCcw} onClick={() => (setAmount(selected.total.toFixed(2)), setAction('refund'))}>
                  Refund
                </Button>
              )}
              {(nextStatus[selected.status] || (selected.type === 'Delivery' && selected.status === 'Ready')) && (
                <Button onClick={() => advance(selected)}>Mark {selected.type === 'Delivery' && selected.status === 'Ready' ? 'Out for delivery' : nextStatus[selected.status]}</Button>
              )}
            </>
          )
        }
      >
        {selected && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={selected.status} />
              <StatusBadge status={selected.paymentStatus} />
              {selected.priority !== 'Normal' && <Badge tone="red">{selected.priority} priority</Badge>}
            </div>
            <div>
              <p className="mb-3 text-sm font-semibold text-slate-800">Kitchen routing & tracking</p>
              <ol className="relative space-y-3 border-l-2 border-slate-100 pl-5">
                {steps.map((s, i) => (
                  <li key={s} className="relative">
                    <span
                      className={cn(
                        'absolute top-0.5 -left-[27px] flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-white',
                        i <= reached ? 'bg-brand-500' : 'bg-slate-200',
                      )}
                    />
                    <p className={cn('text-sm', i <= reached ? 'font-medium text-slate-800' : 'text-slate-400')}>{s}</p>
                    {s === 'Preparing' && (
                      <p className="text-xs text-slate-500">Routed to: {[...new Set(selected.items.map((l) => l.station))].join(' · ')}</p>
                    )}
                  </li>
                ))}
              </ol>
              {['Cancelled', 'Refunded'].includes(selected.status) && <p className="mt-3 text-sm font-medium text-red-600">Order {selected.status.toLowerCase()}</p>}
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-800">Items</p>
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {selected.items.map((l, i) => (
                  <li key={i} className="flex gap-3 px-3 py-2 text-sm">
                    <span>{l.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-800">
                        {l.qty}× {l.name}
                      </p>
                      {l.modifiers.length > 0 && <p className="text-xs text-slate-500">{l.modifiers.join(' · ')}</p>}
                      {l.notes && <p className="text-xs text-amber-700 italic">“{l.notes}”</p>}
                    </div>
                    <Badge>{l.station}</Badge>
                    <span className="w-16 text-right font-medium">{formatCurrency(l.price * l.qty)}</span>
                  </li>
                ))}
              </ul>
              <dl className="mt-3 space-y-1 text-sm">
                <Row label="Subtotal" value={formatCurrency(selected.subtotal)} />
                {selected.discount > 0 && <Row label="Discount" value={`−${formatCurrency(selected.discount)}`} className="text-emerald-600" />}
                {selected.serviceCharge > 0 && <Row label="Service charge" value={formatCurrency(selected.serviceCharge)} />}
                {selected.deliveryFee > 0 && <Row label="Delivery fee" value={formatCurrency(selected.deliveryFee)} />}
                <Row label="Tax" value={formatCurrency(selected.tax)} />
                <div className="flex justify-between border-t border-slate-100 pt-1 font-semibold text-slate-900">
                  <span>Total</span>
                  <span>{formatCurrency(selected.total)}</span>
                </div>
              </dl>
            </div>
            <DescriptionList
              items={[
                { label: 'Customer', value: selected.customer },
                { label: 'Phone', value: selected.phone ?? '—' },
                { label: 'Server', value: selected.server },
                { label: 'Payment', value: selected.paymentMethod ?? '—' },
                { label: 'Branch', value: selected.branch },
                { label: 'AI predicted ready', value: `${selected.predictedMins} min` },
              ]}
            />
          </div>
        )}
      </Drawer>

      <Modal
        open={!!action}
        onClose={() => setAction(null)}
        size="sm"
        title={action === 'refund' ? `Refund order #${selected?.number}` : `Cancel order #${selected?.number}`}
        description={action === 'refund' ? 'Requires manager PIN. Refund goes back to the original payment method.' : 'The kitchen will be notified and tickets voided.'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAction(null)}>
              Back
            </Button>
            <Button variant="danger" onClick={confirmAction}>
              {action === 'refund' ? 'Issue refund' : 'Cancel order'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {action === 'refund' && (
            <Field label="Refund amount" hint={`Order total ${formatCurrency(selected?.total ?? 0)} — enter less for a partial refund`}>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
          )}
          <Field label="Reason">
            <Select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              options={['Food quality issue', 'Wrong item served', 'Long wait time', 'Customer changed mind', 'Duplicate order', 'Payment error']}
            />
          </Field>
          <Field label="Manager PIN">
            <Input type="password" placeholder="••••" maxLength={4} />
          </Field>
        </div>
      </Modal>
    </div>
  )
}
