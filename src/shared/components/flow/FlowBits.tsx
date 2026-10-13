import { Minus, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge } from '@/shared/components/ui'
import { cn } from '@/shared/lib/cn'
import { formatCurrency } from '@/shared/lib/format'
import type { FlowOrder, FlowStatus } from '@/shared/services/flow'
import type { Cart } from './flowHelpers'
import { statusMeta } from './flowHelpers'
import { MENU_CATEGORIES, menuItems } from '@/shared/services/operations'

export function FlowStatusBadge({ status }: { status: FlowStatus }) {
  return (
    <Badge tone={statusMeta[status].tone} dot>
      {statusMeta[status].label}
    </Badge>
  )
}

export function ItemLines({ order, compact }: { order: Pick<FlowOrder, 'items'>; compact?: boolean }) {
  return (
    <ul className={cn('space-y-0.5', compact ? 'text-xs' : 'text-sm')}>
      {order.items.map((i, idx) => (
        <li key={idx} className="flex gap-2 text-slate-700">
          <span className="font-semibold">{i.qty}×</span>
          <span className="flex-1">
            {i.name}
            {i.modifiers.length > 0 && <span className="text-slate-500"> · {i.modifiers.join(', ')}</span>}
            {i.notes && <span className="block text-xs text-red-600">{i.notes}</span>}
          </span>
          {!compact && <span className="text-slate-500">{formatCurrency(i.qty * i.price)}</span>}
        </li>
      ))}
    </ul>
  )
}

/** Menu browser with quantity steppers — used by the waiter and customer apps. */
export function MenuPicker({ cart, setCart, dense }: { cart: Cart; setCart: (c: Cart) => void; dense?: boolean }) {
  const [cat, setCat] = useState<string>('All')
  const [q, setQ] = useState('')
  const [variants, setVariants] = useState<Record<string, string>>({})
  const list = useMemo(
    () => menuItems.filter((m) => m.available && (cat === 'All' || m.category === cat) && (!q || m.name.toLowerCase().includes(q.toLowerCase()))),
    [cat, q],
  )
  const keyOf = (id: string) => `${id}|${variants[id] ?? menuItems.find((m) => m.id === id)?.variants[0]?.name ?? ''}`
  const change = (id: string, d: number) => {
    const k = keyOf(id)
    const variant = k.split('|')[1] || undefined
    const cur = cart[k]?.qty ?? 0
    setCart({ ...cart, [k]: { itemId: id, variant, qty: Math.max(0, cur + d) } })
  }

  return (
    <div>
      <div className="relative">
        <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search menu…" className="h-10 w-full rounded-xl border border-slate-200 bg-white pr-3 pl-9 text-sm focus:border-brand-400 focus:outline-none" />
      </div>
      <div className="scrollbar-thin -mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {['All', ...MENU_CATEGORIES].map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCat(c)}
            className={cn('shrink-0 rounded-full px-3 py-1.5 text-xs font-medium', cat === c ? 'bg-ink-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200')}
          >
            {c}
          </button>
        ))}
      </div>
      <ul className={cn('mt-3 grid gap-2', !dense && 'sm:grid-cols-2')}>
        {list.map((m) => {
          const qty = Object.values(cart).filter((c) => c.itemId === m.id).reduce((s, c) => s + c.qty, 0)
          return (
            <li key={m.id} className={cn('flex gap-3 rounded-xl bg-white p-3 ring-1', qty ? 'ring-brand-300' : 'ring-slate-200')}>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-2xl">{m.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{m.name}</p>
                <p className="text-xs text-slate-500">{formatCurrency(m.price + (m.variants.find((v) => v.name === (variants[m.id] ?? m.variants[0]?.name))?.price ?? 0))}</p>
                {m.variants.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {m.variants.map((v) => (
                      <button
                        key={v.name}
                        type="button"
                        onClick={() => setVariants((s) => ({ ...s, [m.id]: v.name }))}
                        className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-medium', (variants[m.id] ?? m.variants[0].name) === v.name ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500')}
                      >
                        {v.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5 self-center">
                {qty > 0 && (
                  <>
                    <button type="button" onClick={() => change(m.id, -1)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700" aria-label={`Remove ${m.name}`}>
                      <Minus size={14} />
                    </button>
                    <span className="w-5 text-center text-sm font-semibold">{qty}</span>
                  </>
                )}
                <button type="button" onClick={() => change(m.id, 1)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white" aria-label={`Add ${m.name}`}>
                  <Plus size={14} />
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
