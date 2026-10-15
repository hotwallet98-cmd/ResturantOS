import {
  BookOpen,
  BrainCircuit,
  CalendarClock,
  DollarSign,
  Flame,
  Gift,
  LayoutList,
  Percent,
  Plus,
  Save,
  Sparkles,
  Tag,
  UtensilsCrossed,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts'
import { AIPanel } from '@/shared/components/operations/AIPanel'
import {
  Badge,
  Button,
  Card,
  DataTable,
  Drawer,
  EmptyState,
  Field,
  Input,
  LoadingState,
  Modal,
  PageHeader,
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
import { chartAxis, chartGrid, chartTooltip } from '@/shared/lib/chart'
import { cn } from '@/shared/lib/cn'
import { formatCurrency, formatDate, formatPercent } from '@/shared/lib/format'
import type { Combo, DayPart, MenuCategory, MenuItem, Promotion, Station } from '@/shared/services/operations'
import {
  DAY_PARTS,
  MENU_CATEGORIES,
  STATIONS,
  createMenuItem,
  getCombos,
  getMenuItems,
  getPromotions,
  getRecipes,
  saveMenuItem,
  savePromotion,
} from '@/shared/services/operations'

type TabId = 'items' | 'recipes' | 'pricing' | 'combos' | 'availability' | 'ai'
type Quadrant = 'Star' | 'Plowhorse' | 'Puzzle' | 'Dog'

const margin = (i: MenuItem) => (i.price - i.cost) / i.price
const quadColors: Record<Quadrant, string> = { Star: '#10b981', Plowhorse: '#0ea5e9', Puzzle: '#8b5cf6', Dog: '#ef4444' }
const quadInfo: Record<Quadrant, { emoji: string; desc: string; action: string }> = {
  Star: { emoji: '⭐', desc: 'High popularity · high profit', action: 'Keep visible, protect quality' },
  Plowhorse: { emoji: '🐎', desc: 'High popularity · low profit', action: 'Re-engineer cost or nudge price' },
  Puzzle: { emoji: '🧩', desc: 'Low popularity · high profit', action: 'Promote, reposition on menu' },
  Dog: { emoji: '🐕', desc: 'Low popularity · low profit', action: 'Remove or rework' },
}

const blankItem = (): MenuItem => ({
  id: `mi-${Date.now()}`,
  name: '',
  emoji: '🍽️',
  category: 'Starters',
  description: '',
  price: 0,
  cost: 0,
  station: 'Grill',
  prepMins: 10,
  veg: false,
  spicy: 1,
  available: true,
  variants: [],
  addons: [],
  dayParts: ['Lunch', 'Dinner'],
  soldWeek: 0,
  rating: 0,
})

export default function Menu() {
  const notify = useToast()
  const { branch } = useAuth()
  const itemsQ = useAsync(getMenuItems)
  const recipesQ = useAsync(getRecipes)
  const combosQ = useAsync(getCombos)
  const promosQ = useAsync(getPromotions)
  const [tab, setTab] = useState<TabId>('items')
  const [editing, setEditing] = useState<MenuItem | null>(null)
  const [recipeFor, setRecipeFor] = useState<MenuItem | null>(null)

  const items = itemsQ.data ?? []

  const upsert = async (it: MenuItem) => {
    const exists = items.some((x) => x.id === it.id)
    await (exists ? saveMenuItem(it) : createMenuItem(it))
    itemsQ.setData((prev) => (exists ? (prev ?? []).map((x) => (x.id === it.id ? it : x)) : [...(prev ?? []), it]))
    notify(exists ? `${it.name} updated` : `${it.name} added to menu`)
  }

  const patchItem = (id: string, p: Partial<MenuItem>) => {
    itemsQ.setData((prev) => (prev ?? []).map((x) => (x.id === id ? { ...x, ...p } : x)))
  }

  if (itemsQ.loading) return <LoadingState label="Loading menu…" />

  const avgFoodCost = items.reduce((s, i) => s + i.cost / i.price, 0) / items.length
  const activePromos = (promosQ.data ?? []).filter((p) => p.status === 'Active').length

  return (
    <div className="space-y-6">
      <PageHeader
        icon={UtensilsCrossed}
        title="Menu & Recipes"
        description={`Items, recipes, costing, pricing & promotions · ${branch}`}
        actions={
          <>
            <Button variant="ai" icon={Sparkles} onClick={() => setTab('ai')}>
              Optimise menu
            </Button>
            <Button icon={Plus} onClick={() => setEditing(blankItem())}>
              Add item
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Menu items" value={items.length} icon={LayoutList} tone="brand" hint={`${items.filter((i) => !i.available).length} unavailable`} />
        <StatCard label="Avg food cost" value={formatPercent(avgFoodCost * 100)} icon={Percent} tone="amber" delta={1.2} invertDelta deltaLabel="vs last month" />
        <StatCard label="Avg gross margin" value={formatPercent((1 - avgFoodCost) * 100)} icon={DollarSign} tone="green" />
        <StatCard label="Active offers" value={activePromos} icon={Gift} tone="purple" hint={`${(combosQ.data ?? []).filter((c) => c.active).length} combos live`} />
      </div>

      <Tabs
        items={[
          { id: 'items', label: 'Items & Categories', icon: LayoutList, count: items.length },
          { id: 'recipes', label: 'Recipes & Costing', icon: BookOpen },
          { id: 'pricing', label: 'Pricing, Variants & Add-ons', icon: Tag },
          { id: 'combos', label: 'Combos & Offers', icon: Gift },
          { id: 'availability', label: 'Availability & Scheduling', icon: CalendarClock },
          { id: 'ai', label: 'AI Menu Optimization', icon: BrainCircuit },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'items' && <ItemsTab items={items} onEdit={setEditing} onToggle={(i) => (patchItem(i.id, { available: !i.available }), notify(`${i.name} marked ${i.available ? 'unavailable' : 'available'}`, 'info'))} />}
      {tab === 'recipes' && <RecipesTab items={items} recipeIds={new Set((recipesQ.data ?? []).map((r) => r.itemId))} onOpen={setRecipeFor} />}
      {tab === 'pricing' && <PricingTab items={items} onSave={(changed) => (changed.forEach((c) => patchItem(c.id, { price: c.price })), notify(`${changed.length} prices updated across POS & online menu`))} />}
      {tab === 'combos' && (
        <CombosTab
          combos={combosQ.data ?? []}
          promos={promosQ.data ?? []}
          onToggleCombo={(c) => combosQ.setData((prev) => (prev ?? []).map((x) => (x.id === c.id ? { ...x, active: !x.active } : x)))}
          onAddPromo={async (p) => {
            await savePromotion(p)
            promosQ.setData((prev) => [p, ...(prev ?? [])])
            notify(`Promotion “${p.name}” created`)
          }}
        />
      )}
      {tab === 'availability' && <AvailabilityTab items={items} patch={patchItem} />}
      {tab === 'ai' && <AiTab items={items} />}

      {editing && <ItemModal item={editing} onClose={() => setEditing(null)} onSave={(it) => (upsert(it), setEditing(null))} />}

      <RecipeDrawer item={recipeFor} recipe={(recipesQ.data ?? []).find((r) => r.itemId === recipeFor?.id)} onClose={() => setRecipeFor(null)} />
    </div>
  )
}

/* ------------------------------------------------------------------ */

function ItemsTab({ items, onEdit, onToggle }: { items: MenuItem[]; onEdit: (i: MenuItem) => void; onToggle: (i: MenuItem) => void }) {
  const [cat, setCat] = useState<string>('All')
  const [veg, setVeg] = useState('')
  const rows = items.filter((i) => (cat === 'All' || i.category === cat) && (!veg || (veg === 'Veg' ? i.veg : !i.veg)))
  const columns: Column<MenuItem>[] = [
    {
      key: 'name',
      header: 'Item',
      sortable: true,
      render: (i) => (
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-50 to-amber-50 text-xl">{i.emoji}</span>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-medium text-slate-900">
              {i.name}
              {i.veg && <span title="Vegetarian" className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />}
              {i.spicy >= 2 && <Flame size={13} className="text-red-500" />}
            </p>
            <p className="max-w-64 truncate text-xs text-slate-500">{i.description || `${i.station} station · ${i.prepMins} min`}</p>
          </div>
        </div>
      ),
    },
    { key: 'category', header: 'Category', sortable: true, render: (i) => <Badge>{i.category}</Badge> },
    { key: 'price', header: 'Price', align: 'right', sortable: true, render: (i) => <span className="font-medium">{formatCurrency(i.price)}</span> },
    { key: 'cost', header: 'Food cost', align: 'right', render: (i) => <span className="text-slate-500">{formatCurrency(i.cost)}</span> },
    {
      key: 'margin',
      header: 'Margin',
      align: 'right',
      sortable: true,
      sortValue: margin,
      render: (i) => <span className={cn('font-semibold', margin(i) >= 0.65 ? 'text-emerald-600' : margin(i) >= 0.55 ? 'text-amber-600' : 'text-red-600')}>{formatPercent(margin(i) * 100, 0)}</span>,
    },
    { key: 'station', header: 'Station' },
    { key: 'soldWeek', header: 'Sold / wk', align: 'right', sortable: true },
    { key: 'rating', header: 'Rating', align: 'right', render: (i) => (i.rating ? `★ ${i.rating.toFixed(1)}` : '—') },
    {
      key: 'available',
      header: 'Available',
      render: (i) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Toggle checked={i.available} onChange={() => onToggle(i)} />
        </div>
      ),
    },
  ]
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-10">
        {(['All', ...MENU_CATEGORIES] as string[]).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCat(c)}
            className={cn(
              'rounded-xl border px-3 py-2.5 text-left transition',
              cat === c ? 'border-brand-400 bg-brand-50 ring-2 ring-brand-500/20' : 'border-slate-200 bg-white hover:border-slate-300',
            )}
          >
            <p className="truncate text-sm font-medium text-slate-800">{c}</p>
            <p className="text-xs text-slate-500">{c === 'All' ? items.length : items.filter((i) => i.category === c).length} items</p>
          </button>
        ))}
      </div>
      <Card flush>
        <DataTable
          columns={columns}
          data={rows}
          rowKey={(i) => i.id}
          searchKeys={['name', 'category', 'description']}
          searchPlaceholder="Search items…"
          onRowClick={onEdit}
          pageSize={10}
          toolbar={<Select value={veg} onChange={(e) => setVeg(e.target.value)} options={['Veg', 'Non-veg']} placeholder="Veg & non-veg" className="h-9 w-40" />}
        />
      </Card>
    </div>
  )
}

function ItemModal({ item, onClose, onSave }: { item: MenuItem; onClose: () => void; onSave: (i: MenuItem) => void }) {
  const [d, setD] = useState(item)
  const isNew = !item.name
  const set = <K extends keyof MenuItem>(k: K, v: MenuItem[K]) => setD((x) => ({ ...x, [k]: v }))
  const valid = d.name.trim() && d.price > 0
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={isNew ? 'Add menu item' : `Edit ${item.name}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button icon={Save} disabled={!valid} onClick={() => onSave(d)}>
            Save item
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-[80px_1fr]">
        <Field label="Icon">
          <Input value={d.emoji} onChange={(e) => set('emoji', e.target.value)} className="text-center text-2xl" maxLength={4} />
        </Field>
        <Field label="Item name" required>
          <Input value={d.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Chicken Karahi" />
        </Field>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Field label="Category">
          <Select value={d.category} onChange={(e) => set('category', e.target.value as MenuCategory)} options={[...MENU_CATEGORIES]} />
        </Field>
        <Field label="Kitchen station" hint="Used for KDS routing">
          <Select value={d.station} onChange={(e) => set('station', e.target.value as Station)} options={STATIONS} />
        </Field>
        <Field label="Prep time (min)">
          <Input type="number" value={d.prepMins} onChange={(e) => set('prepMins', Number(e.target.value))} />
        </Field>
        <Field label="Price" required>
          <Input type="number" step="0.1" value={d.price || ''} onChange={(e) => set('price', Number(e.target.value))} />
        </Field>
        <Field label="Food cost" hint={d.price ? `Margin ${formatPercent(((d.price - d.cost) / d.price) * 100, 0)}` : undefined}>
          <Input type="number" step="0.1" value={d.cost || ''} onChange={(e) => set('cost', Number(e.target.value))} />
        </Field>
        <Field label="Spice level">
          <Select value={String(d.spicy)} onChange={(e) => set('spicy', Number(e.target.value) as MenuItem['spicy'])} options={[{ value: '0', label: 'Mild' }, { value: '1', label: 'Medium' }, { value: '2', label: 'Hot' }, { value: '3', label: 'Extra hot' }]} />
        </Field>
      </div>
      <Field label="Description" className="mt-4">
        <Textarea value={d.description} onChange={(e) => set('description', e.target.value)} rows={2} />
      </Field>
      <Field label="Variants" hint="Comma-separated name:price-delta, e.g. Half:0, Full:12" className="mt-4">
        <Input
          defaultValue={d.variants.map((v) => `${v.name}:${v.price}`).join(', ')}
          onBlur={(e) => set('variants', parseOptions(e.target.value))}
        />
      </Field>
      <Field label="Add-ons" hint="Comma-separated name:price, e.g. Extra butter:1, Raita:1" className="mt-4">
        <Input defaultValue={d.addons.map((v) => `${v.name}:${v.price}`).join(', ')} onBlur={(e) => set('addons', parseOptions(e.target.value))} />
      </Field>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Toggle checked={d.veg} onChange={(v) => set('veg', v)} label="Vegetarian" />
        <Toggle checked={d.available} onChange={(v) => set('available', v)} label="Available for sale" />
      </div>
    </Modal>
  )
}

function parseOptions(s: string) {
  return s
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const [name, price] = p.split(':')
      return { name: name!.trim(), price: Number(price) || 0 }
    })
}

/* ------------------------------------------------------------------ */

function RecipesTab({ items, recipeIds, onOpen }: { items: MenuItem[]; recipeIds: Set<string>; onOpen: (i: MenuItem) => void }) {
  const sorted = [...items].sort((a, b) => Number(recipeIds.has(b.id)) - Number(recipeIds.has(a.id)))
  const columns: Column<MenuItem>[] = [
    { key: 'name', header: 'Item', render: (i) => <span className="font-medium text-slate-900">{i.emoji} {i.name}</span> },
    { key: 'category', header: 'Category' },
    { key: 'recipe', header: 'Recipe', render: (i) => (recipeIds.has(i.id) ? <StatusBadge status="Verified" /> : <Badge tone="yellow">Not mapped</Badge>) },
    { key: 'cost', header: 'Plate cost', align: 'right', render: (i) => formatCurrency(i.cost) },
    { key: 'price', header: 'Price', align: 'right', render: (i) => formatCurrency(i.price) },
    { key: 'fc', header: 'Food cost %', align: 'right', sortable: true, sortValue: (i) => i.cost / i.price, render: (i) => formatPercent((i.cost / i.price) * 100) },
    { key: 'cm', header: 'Contribution', align: 'right', sortable: true, sortValue: (i) => i.price - i.cost, render: (i) => <span className="font-semibold text-emerald-700">{formatCurrency(i.price - i.cost)}</span> },
  ]
  return (
    <Card title="Recipes & ingredient mapping" subtitle="Click an item to view its recipe card, ingredient quantities and costing" flush>
      <DataTable columns={columns} data={sorted} rowKey={(i) => i.id} searchKeys={['name', 'category']} onRowClick={onOpen} pageSize={10} />
    </Card>
  )
}

function RecipeDrawer({ item, recipe, onClose }: { item: MenuItem | null; recipe?: { yield: string; steps: string[]; ingredients: { ingredient: string; qty: number; unit: string; cost: number }[] }; onClose: () => void }) {
  const notify = useToast()
  const cost = recipe ? recipe.ingredients.reduce((s, i) => s + i.cost, 0) : item?.cost ?? 0
  return (
    <Drawer open={!!item} onClose={onClose} title={item ? `${item.emoji} ${item.name}` : ''} description={recipe ? `Recipe card · yield ${recipe.yield}` : 'Recipe not mapped yet'} width="max-w-xl">
      {item && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Plate cost</p>
              <p className="text-lg font-semibold">{formatCurrency(cost)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Menu price</p>
              <p className="text-lg font-semibold">{formatCurrency(item.price)}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3">
              <p className="text-xs text-emerald-700">Margin</p>
              <p className="text-lg font-semibold text-emerald-700">{formatPercent(((item.price - cost) / item.price) * 100, 0)}</p>
            </div>
          </div>
          {recipe ? (
            <>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs text-slate-500 uppercase">
                    <tr>
                      <th className="px-3 py-2">Ingredient</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Cost</th>
                      <th className="px-3 py-2 text-right">Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recipe.ingredients.map((g) => (
                      <tr key={g.ingredient}>
                        <td className="px-3 py-2 font-medium text-slate-800">{g.ingredient}</td>
                        <td className="px-3 py-2 text-right text-slate-600">
                          {g.qty} {g.unit}
                        </td>
                        <td className="px-3 py-2 text-right">{formatCurrency(g.cost)}</td>
                        <td className="px-3 py-2 text-right text-slate-500">{formatPercent((g.cost / cost) * 100, 0)}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 font-semibold">
                      <td className="px-3 py-2">Total</td>
                      <td />
                      <td className="px-3 py-2 text-right">{formatCurrency(cost)}</td>
                      <td className="px-3 py-2 text-right">100%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-800">Method</p>
                <ol className="space-y-2">
                  {recipe.steps.map((s, i) => (
                    <li key={i} className="flex gap-3 text-sm text-slate-600">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">{i + 1}</span>
                      {s}
                    </li>
                  ))}
                </ol>
              </div>
              <p className="rounded-lg bg-violet-50 p-3 text-xs text-violet-700">
                Inventory auto-deducts these quantities on every sale. Variance vs. actual stock usage is tracked in Inventory → Consumption.
              </p>
            </>
          ) : (
            <EmptyState
              icon={BookOpen}
              title="No ingredients mapped"
              description="Map ingredients to enable automatic stock deduction and live costing."
              action={<Button icon={Plus} onClick={() => notify('Recipe builder opened', 'info')}>Map ingredients</Button>}
            />
          )}
        </div>
      )}
    </Drawer>
  )
}

/* ------------------------------------------------------------------ */

function PricingTab({ items, onSave }: { items: MenuItem[]; onSave: (changed: { id: string; price: number }[]) => void }) {
  const [draft, setDraft] = useState<Record<string, number>>({})
  const changed = Object.entries(draft)
    .filter(([id, p]) => items.find((i) => i.id === id)?.price !== p)
    .map(([id, price]) => ({ id, price }))
  const columns: Column<MenuItem>[] = [
    { key: 'name', header: 'Item', render: (i) => <span className="font-medium text-slate-900">{i.emoji} {i.name}</span> },
    {
      key: 'price',
      header: 'Base price',
      render: (i) => (
        <Input
          type="number"
          step="0.1"
          value={draft[i.id] ?? i.price}
          onChange={(e) => setDraft({ ...draft, [i.id]: Number(e.target.value) })}
          className={cn('h-8 w-24', draft[i.id] !== undefined && draft[i.id] !== i.price && 'border-brand-400 bg-brand-50')}
        />
      ),
    },
    {
      key: 'margin',
      header: 'Margin',
      render: (i) => {
        const p = draft[i.id] ?? i.price
        return <span className="text-sm text-slate-600">{formatPercent(((p - i.cost) / p) * 100, 0)}</span>
      },
    },
    {
      key: 'variants',
      header: 'Variants',
      render: (i) =>
        i.variants.length ? (
          <div className="flex flex-wrap gap-1">
            {i.variants.map((v) => (
              <Badge key={v.name} tone="blue">
                {v.name} {formatCurrency((draft[i.id] ?? i.price) + v.price)}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-xs text-slate-300">—</span>
        ),
    },
    {
      key: 'addons',
      header: 'Add-ons',
      render: (i) =>
        i.addons.length ? (
          <div className="flex flex-wrap gap-1">
            {i.addons.map((a) => (
              <Badge key={a.name} tone="purple">
                {a.name} +{formatCurrency(a.price)}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-xs text-slate-300">—</span>
        ),
    },
  ]
  return (
    <Card
      title="Pricing, variants & add-ons"
      subtitle="Edit prices inline — changes publish to POS, online menu and delivery partners"
      flush
      actions={
        <Button
          icon={Save}
          disabled={!changed.length}
          onClick={() => {
            onSave(changed)
            setDraft({})
          }}
        >
          Publish {changed.length || ''} change{changed.length === 1 ? '' : 's'}
        </Button>
      }
    >
      <DataTable columns={columns} data={items} rowKey={(i) => i.id} searchKeys={['name', 'category']} pageSize={10} />
    </Card>
  )
}

/* ------------------------------------------------------------------ */

function CombosTab({
  combos,
  promos,
  onToggleCombo,
  onAddPromo,
}: {
  combos: Combo[]
  promos: Promotion[]
  onToggleCombo: (c: Combo) => void
  onAddPromo: (p: Promotion) => void
}) {
  const [open, setOpen] = useState(false)
  const [p, setP] = useState({ name: '', type: 'Percentage' as Promotion['type'], value: 10, code: '', channel: 'All' as Promotion['channel'], days: 14 })
  const columns: Column<Promotion>[] = [
    { key: 'name', header: 'Promotion', render: (x) => <span className="font-medium text-slate-900">{x.name}</span> },
    { key: 'code', header: 'Code', render: (x) => <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold">{x.code}</code> },
    { key: 'type', header: 'Type', render: (x) => `${x.type} · ${x.type === 'Flat' ? formatCurrency(x.value) : `${x.value}%`}` },
    { key: 'channel', header: 'Channel' },
    { key: 'period', header: 'Period', render: (x) => <span className="text-xs text-slate-500">{formatDate(x.startsAt)} – {formatDate(x.endsAt)}</span> },
    { key: 'redemptions', header: 'Redeemed', align: 'right', sortable: true },
    { key: 'status', header: 'Status', render: (x) => <StatusBadge status={x.status} /> },
  ]
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {combos.map((c) => (
          <Card key={c.id} bodyClassName="p-4" className={cn(!c.active && 'opacity-70')}>
            <div className="flex items-start justify-between">
              <span className="text-3xl">{c.emoji}</span>
              <Toggle checked={c.active} onChange={() => onToggleCombo(c)} />
            </div>
            <p className="mt-2 font-semibold text-slate-900">{c.name}</p>
            <ul className="mt-1 space-y-0.5 text-xs text-slate-500">
              {c.items.map((i) => (
                <li key={i}>• {i}</li>
              ))}
            </ul>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-lg font-semibold text-slate-900">{formatCurrency(c.price)}</span>
              <span className="text-xs text-slate-400 line-through">{formatCurrency(c.originalPrice)}</span>
              <Badge tone="green" className="ml-auto">
                −{Math.round((1 - c.price / c.originalPrice) * 100)}%
              </Badge>
            </div>
            <p className="mt-1 text-xs text-slate-500">{c.soldWeek} sold this week</p>
          </Card>
        ))}
      </div>
      <Card title="Offers & promotions" subtitle="Discount codes, BOGO and happy-hour rules" flush actions={<Button size="sm" icon={Plus} onClick={() => setOpen(true)}>New promotion</Button>}>
        <DataTable columns={columns} data={promos} rowKey={(x) => x.id} searchKeys={['name', 'code']} />
      </Card>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New promotion"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!p.name || !p.code}
              onClick={() => {
                onAddPromo({
                  id: `pr-${Date.now()}`,
                  name: p.name,
                  type: p.type,
                  value: p.value,
                  code: p.code.toUpperCase(),
                  channel: p.channel,
                  startsAt: new Date().toISOString(),
                  endsAt: new Date(Date.now() + p.days * 86_400_000).toISOString(),
                  status: 'Active',
                  redemptions: 0,
                })
                setOpen(false)
              }}
            >
              Launch promotion
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" required className="sm:col-span-2">
            <Input value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} placeholder="e.g. Ramadan Iftar Deal" />
          </Field>
          <Field label="Promo code" required>
            <Input value={p.code} onChange={(e) => setP({ ...p, code: e.target.value })} placeholder="IFTAR20" />
          </Field>
          <Field label="Type">
            <Select value={p.type} onChange={(e) => setP({ ...p, type: e.target.value as Promotion['type'] })} options={['Percentage', 'Flat', 'BOGO', 'Happy Hour']} />
          </Field>
          <Field label={p.type === 'Flat' ? 'Amount ($)' : 'Value (%)'}>
            <Input type="number" value={p.value} onChange={(e) => setP({ ...p, value: Number(e.target.value) })} />
          </Field>
          <Field label="Channel">
            <Select value={p.channel} onChange={(e) => setP({ ...p, channel: e.target.value as Promotion['channel'] })} options={['All', 'Dine-in', 'Online', 'Delivery']} />
          </Field>
          <Field label="Duration (days)">
            <Input type="number" value={p.days} onChange={(e) => setP({ ...p, days: Number(e.target.value) })} />
          </Field>
        </div>
      </Modal>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function AvailabilityTab({ items, patch }: { items: MenuItem[]; patch: (id: string, p: Partial<MenuItem>) => void }) {
  const notify = useToast()
  const out = items.filter((i) => !i.available)
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
      <Card title="Item availability & day-part scheduling" subtitle="Toggle stock status and choose when each item is sold" flush>
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs font-semibold text-slate-500 uppercase">
                <th className="px-4 py-2.5">Item</th>
                <th className="px-4 py-2.5">Available</th>
                {DAY_PARTS.map((d) => (
                  <th key={d} className="px-2 py-2.5 text-center">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {MENU_CATEGORIES.map((cat) => (
                <CategoryRows key={cat} cat={cat} items={items.filter((i) => i.category === cat)} patch={patch} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="space-y-6">
        <Card title="86 board" subtitle="Items currently unavailable">
          {out.length === 0 ? (
            <p className="text-sm text-slate-500">Everything is available 🎉</p>
          ) : (
            <ul className="space-y-2">
              {out.map((i) => (
                <li key={i.id} className="flex items-center gap-2 text-sm">
                  <span>{i.emoji}</span>
                  <span className="flex-1">{i.name}</span>
                  <Button size="xs" variant="outline" onClick={() => (patch(i.id, { available: true }), notify(`${i.name} back on menu`))}>
                    Restore
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Day-part hours">
          <ul className="space-y-2 text-sm">
            {[
              ['Breakfast', '07:00 – 11:00'],
              ['Lunch', '12:00 – 16:00'],
              ['Hi-Tea', '16:00 – 19:00'],
              ['Dinner', '19:00 – 23:30'],
              ['Late Night', '23:30 – 02:00'],
            ].map(([d, h]) => (
              <li key={d} className="flex justify-between">
                <span className="text-slate-600">{d}</span>
                <span className="font-medium text-slate-800">{h}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}

function CategoryRows({ cat, items, patch }: { cat: string; items: MenuItem[]; patch: (id: string, p: Partial<MenuItem>) => void }) {
  const toggleDp = (i: MenuItem, d: DayPart) => patch(i.id, { dayParts: i.dayParts.includes(d) ? i.dayParts.filter((x) => x !== d) : [...i.dayParts, d] })
  return (
    <>
      <tr className="bg-slate-50/40">
        <td colSpan={2 + DAY_PARTS.length} className="px-4 py-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
          {cat}
        </td>
      </tr>
      {items.map((i) => (
        <tr key={i.id} className={cn(!i.available && 'bg-red-50/30')}>
          <td className="px-4 py-2 font-medium text-slate-800">
            {i.emoji} {i.name}
          </td>
          <td className="px-4 py-2">
            <Toggle checked={i.available} onChange={(v) => patch(i.id, { available: v })} />
          </td>
          {DAY_PARTS.map((d) => (
            <td key={d} className="px-2 py-2 text-center">
              <button
                type="button"
                onClick={() => toggleDp(i, d)}
                aria-label={`${d} for ${i.name}`}
                className={cn(
                  'h-6 w-10 rounded-md text-[10px] font-semibold transition',
                  i.dayParts.includes(d) ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200',
                )}
              >
                {i.dayParts.includes(d) ? 'ON' : 'OFF'}
              </button>
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

/* ------------------------------------------------------------------ */

function AiTab({ items }: { items: MenuItem[] }) {
  const { avgPop, avgCm, points } = useMemo(() => {
    const avgPop = items.reduce((s, i) => s + i.soldWeek, 0) / items.length
    const avgCm = items.reduce((s, i) => s + (i.price - i.cost), 0) / items.length
    const points = items.map((i) => {
      const cm = +(i.price - i.cost).toFixed(2)
      const q: Quadrant = i.soldWeek >= avgPop ? (cm >= avgCm ? 'Star' : 'Plowhorse') : cm >= avgCm ? 'Puzzle' : 'Dog'
      return { name: i.name, emoji: i.emoji, pop: i.soldWeek, cm, q, revenue: i.soldWeek * i.price }
    })
    return { avgPop, avgCm, points }
  }, [items])

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Menu-engineering matrix" subtitle="Popularity (units/week) vs contribution margin ($/plate)" className="xl:col-span-2">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ left: -10, right: 16, top: 8, bottom: 8 }}>
                <CartesianGrid {...chartGrid} />
                <XAxis type="number" dataKey="pop" name="Sold / wk" {...chartAxis} />
                <YAxis type="number" dataKey="cm" name="Margin $" {...chartAxis} tickFormatter={(v: number) => `$${v}`} />
                <ZAxis type="number" dataKey="revenue" range={[40, 400]} />
                <ReferenceLine x={avgPop} stroke="#94a3b8" strokeDasharray="4 4" />
                <ReferenceLine y={avgCm} stroke="#94a3b8" strokeDasharray="4 4" />
                <Tooltip
                  {...chartTooltip}
                  content={({ payload }) => {
                    const pt = payload?.[0]?.payload as (typeof points)[number] | undefined
                    if (!pt) return null
                    return (
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
                        <p className="font-semibold text-slate-800">
                          {pt.emoji} {pt.name}
                        </p>
                        <p className="text-slate-500">
                          {pt.pop}/wk · {formatCurrency(pt.cm)} margin · {quadInfo[pt.q].emoji} {pt.q}
                        </p>
                      </div>
                    )
                  }}
                />
                <Scatter data={points}>
                  {points.map((p) => (
                    <Cell key={p.name} fill={quadColors[p.q]} fillOpacity={0.75} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
            {(Object.keys(quadColors) as Quadrant[]).map((q) => (
              <span key={q} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: quadColors[q] }} />
                {q}s
              </span>
            ))}
          </div>
        </Card>
        <AIPanel module="menu" title="AI menu & pricing recommendations" subtitle="Based on 90 days of sales, costs and competitor prices" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(Object.keys(quadInfo) as Quadrant[]).map((q) => {
          const list = points.filter((p) => p.q === q).sort((a, b) => b.revenue - a.revenue)
          return (
            <Card key={q} bodyClassName="p-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{quadInfo[q].emoji}</span>
                <div>
                  <p className="font-semibold" style={{ color: quadColors[q] }}>
                    {q}s <span className="text-slate-400">({list.length})</span>
                  </p>
                  <p className="text-xs text-slate-500">{quadInfo[q].desc}</p>
                </div>
              </div>
              <p className="mt-2 rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600">→ {quadInfo[q].action}</p>
              <ul className="mt-3 space-y-1 text-sm">
                {list.slice(0, 6).map((p) => (
                  <li key={p.name} className="flex justify-between gap-2">
                    <span className="truncate text-slate-700">
                      {p.emoji} {p.name}
                    </span>
                    <span className="text-xs text-slate-400">{p.pop}/wk</span>
                  </li>
                ))}
              </ul>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
