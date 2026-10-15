import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  BrainCircuit,
  Boxes,
  CalendarX,
  ClipboardList,
  DollarSign,
  Package,
  PackagePlus,
  ShoppingBag,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
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
  ProgressBar,
  Select,
  StatCard,
  StatusBadge,
  Tabs,
  useToast,
} from '@/shared/components/ui'
import type { Column } from '@/shared/components/ui'
import { useAuth } from '@/shared/context/AuthContext'
import { useAsync } from '@/shared/hooks/useAsync'
import { chartAxis, chartColors, chartGrid, chartTooltip } from '@/shared/lib/chart'
import { cn } from '@/shared/lib/cn'
import { formatCurrency, formatDate, formatNumber, timeAgo } from '@/shared/lib/format'
import type { Ingredient, MovementType, StockMovement, WastageEntry } from '@/shared/services/operations'
import {
  BRANCHES,
  consumptionTrend,
  createPurchaseOrder,
  createStockMovement,
  demandForecast,
  getIngredients,
  getStockMovements,
  getWastageLog,
} from '@/shared/services/operations'

type TabId = 'stock' | 'movements' | 'waste' | 'reorder' | 'ai'

const daysTo = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
const stockStatus = (i: Ingredient) => (i.stock <= 0 ? 'Out of stock' : i.stock <= i.reorderPoint ? 'Low stock' : daysTo(i.expiry) <= 2 ? 'Expiring soon' : 'In stock')
const CATEGORIES: Ingredient['category'][] = ['Meat & Poultry', 'Dairy', 'Produce', 'Dry Goods', 'Spices', 'Beverages', 'Packaging']
const round = (n: number) => Math.round(n * 100) / 100

export default function Inventory() {
  const notify = useToast()
  const { branch } = useAuth()
  const ingQ = useAsync(getIngredients)
  const movQ = useAsync(getStockMovements)
  const wasteQ = useAsync(getWastageLog)
  const [tab, setTab] = useState<TabId>('stock')
  const [moveOpen, setMoveOpen] = useState<MovementType | null>(null)
  const [selected, setSelected] = useState<Ingredient | null>(null)
  const [live, setLive] = useState(true)
  const setIng = ingQ.setData

  // Real-time tracking: simulate POS sales depleting stock via recipe mapping.
  useEffect(() => {
    if (!live) return
    const id = setInterval(() => {
      setIng((prev) => {
        if (!prev) return prev
        const picks = new Set([Math.floor(Math.random() * prev.length), Math.floor(Math.random() * prev.length)])
        return prev.map((x, i) => (picks.has(i) ? { ...x, stock: Math.max(0, round(x.stock - x.usagePerDay / 120)), updatedAt: new Date().toISOString() } : x))
      })
    }, 6000)
    return () => clearInterval(id)
  }, [live, setIng])

  const ingredients = ingQ.data ?? []
  const movements = movQ.data ?? []
  const wastage = wasteQ.data ?? []

  const record = async (m: StockMovement, wasteReason?: WastageEntry['reason']) => {
    await createStockMovement(m)
    movQ.setData((prev) => [m, ...(prev ?? [])])
    const here = branch === 'All branches' ? 'Downtown' : branch
    const delta = m.type === 'Stock In' || (m.type === 'Transfer' && m.to === here) ? m.qty : -Math.abs(m.qty)
    if (m.type !== 'Adjustment') ingQ.setData((prev) => (prev ?? []).map((i) => (i.name === m.ingredient ? { ...i, stock: Math.max(0, round(i.stock + delta)), updatedAt: new Date().toISOString() } : i)))
    if (m.type === 'Wastage') {
      wasteQ.setData((prev) => [{ id: `ws-${Date.now()}`, date: m.date, ingredient: m.ingredient, qty: m.qty, unit: m.unit, reason: wasteReason ?? 'Spoiled', cost: m.value, by: m.by }, ...(prev ?? [])])
    }
    notify(`${m.type}: ${m.qty} ${m.unit} ${m.ingredient}${m.type === 'Transfer' ? ` (${m.from} → ${m.to})` : ''}`)
  }

  if (ingQ.loading) return <LoadingState label="Loading inventory…" />

  const value = ingredients.reduce((s, i) => s + i.stock * i.costPerUnit, 0)
  const low = ingredients.filter((i) => i.stock <= i.reorderPoint)
  const expiring = ingredients.filter((i) => daysTo(i.expiry) <= 3)
  const wasteCost = wastage.reduce((s, w) => s + w.cost, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Package}
        title="Inventory"
        description={`Ingredients, stock movements, wastage & reordering · ${branch}`}
        actions={
          <>
            <Button variant="outline" icon={ArrowLeftRight} onClick={() => setMoveOpen('Transfer')}>
              Transfer
            </Button>
            <Button variant="outline" icon={ArrowUpFromLine} onClick={() => setMoveOpen('Stock Out')}>
              Stock out
            </Button>
            <Button icon={ArrowDownToLine} onClick={() => setMoveOpen('Stock In')}>
              Stock in
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Stock value" value={formatCurrency(value)} icon={DollarSign} tone="brand" hint={`${ingredients.length} SKUs`} />
        <StatCard label="Low-stock items" value={low.length} icon={AlertTriangle} tone="red" hint="at or below reorder point" />
        <StatCard label="Expiring ≤ 3 days" value={expiring.length} icon={CalendarX} tone="amber" />
        <StatCard label="Wastage this week" value={formatCurrency(wasteCost)} icon={Trash2} tone="slate" delta={-12.4} invertDelta deltaLabel="vs last week" />
      </div>

      <Tabs
        items={[
          { id: 'stock', label: 'Ingredients & stock', icon: Boxes },
          { id: 'movements', label: 'Stock in/out & transfers', icon: ArrowLeftRight },
          { id: 'waste', label: 'Expiry, wastage & consumption', icon: Trash2 },
          { id: 'reorder', label: 'Low stock & reordering', icon: ShoppingBag, count: low.length },
          { id: 'ai', label: 'AI forecasting', icon: BrainCircuit },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'stock' && <StockTab ingredients={ingredients} live={live} setLive={setLive} onOpen={setSelected} />}
      {tab === 'movements' && <MovementsTab movements={movements} onNew={setMoveOpen} />}
      {tab === 'waste' && (
        <WasteTab
          ingredients={ingredients}
          wastage={wastage}
          onDiscard={(i) =>
            record(
              { id: `sm-${Date.now()}`, date: new Date().toISOString(), type: 'Wastage', ingredient: i.name, qty: i.stock, unit: i.unit, from: i.storage, reference: `WST-${Math.floor(Math.random() * 900 + 100)}`, by: 'Tariq Mehmood', value: round(i.stock * i.costPerUnit) },
              'Expired',
            )
          }
          onLog={() => setMoveOpen('Wastage')}
        />
      )}
      {tab === 'reorder' && <ReorderTab ingredients={ingredients} />}
      {tab === 'ai' && <AiTab ingredients={ingredients} />}

      <MovementModal key={moveOpen ?? 'closed'} type={moveOpen} ingredients={ingredients} branch={branch} onClose={() => setMoveOpen(null)} onSave={(m, r) => (record(m, r), setMoveOpen(null))} />

      <Drawer open={!!selected} onClose={() => setSelected(null)} title={selected ? `${selected.emoji} ${selected.name}` : ''} description={selected ? `${selected.category} · ${selected.storage}` : ''}>
        {selected && (
          <IngredientDetail
            ing={ingredients.find((i) => i.id === selected.id) ?? selected}
            movements={movements.filter((m) => m.ingredient === selected.name)}
            onCount={(n) => {
              const cur = ingredients.find((i) => i.id === selected.id) ?? selected
              void record({ id: `sm-${Date.now()}`, date: new Date().toISOString(), type: 'Adjustment', ingredient: cur.name, qty: round(cur.stock - n), unit: cur.unit, reference: `CNT-${Date.now() % 1000}`, by: 'Omar Siddiqui', value: round((n - cur.stock) * cur.costPerUnit) })
              ingQ.setData((prev) => (prev ?? []).map((i) => (i.id === cur.id ? { ...i, stock: n } : i)))
            }}
          />
        )}
      </Drawer>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function StockTab({ ingredients, live, setLive, onOpen }: { ingredients: Ingredient[]; live: boolean; setLive: (v: boolean) => void; onOpen: (i: Ingredient) => void }) {
  const [cat, setCat] = useState('')
  const [status, setStatus] = useState('')
  const rows = ingredients.filter((i) => (!cat || i.category === cat) && (!status || stockStatus(i) === status))
  const columns: Column<Ingredient>[] = [
    {
      key: 'name',
      header: 'Ingredient',
      sortable: true,
      render: (i) => (
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-lg">{i.emoji}</span>
          <div>
            <p className="font-medium text-slate-900">{i.name}</p>
            <p className="text-xs text-slate-500">{i.category}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'stock',
      header: 'On hand',
      sortable: true,
      sortValue: (i) => i.stock / i.par,
      render: (i) => (
        <div className="w-40">
          <div className="flex justify-between text-xs">
            <span className="font-semibold text-slate-800">
              {formatNumber(i.stock)} {i.unit}
            </span>
            <span className="text-slate-400">par {i.par}</span>
          </div>
          <ProgressBar value={i.stock} max={i.par} tone={i.stock <= i.reorderPoint ? 'red' : i.stock / i.par < 0.6 ? 'yellow' : 'green'} className="mt-1" />
        </div>
      ),
    },
    { key: 'cover', header: 'Days cover', align: 'right', sortable: true, sortValue: (i) => i.stock / i.usagePerDay, render: (i) => <span className={cn(i.stock / i.usagePerDay < 1 && 'font-semibold text-red-600')}>{(i.stock / i.usagePerDay).toFixed(1)}</span> },
    { key: 'costPerUnit', header: 'Unit cost', align: 'right', render: (i) => `${formatCurrency(i.costPerUnit)}/${i.unit}` },
    { key: 'value', header: 'Value', align: 'right', sortable: true, sortValue: (i) => i.stock * i.costPerUnit, render: (i) => formatCurrency(i.stock * i.costPerUnit) },
    { key: 'supplier', header: 'Supplier' },
    { key: 'expiry', header: 'Expiry', sortable: true, render: (i) => { const d = daysTo(i.expiry); return d > 365 ? <span className="text-slate-400">—</span> : <span className={cn(d <= 2 ? 'font-semibold text-red-600' : d <= 5 ? 'text-amber-600' : 'text-slate-600')}>{d <= 0 ? 'Today' : `${d}d`}</span> } },
    { key: 'status', header: 'Status', render: (i) => <StatusBadge status={stockStatus(i)} /> },
    { key: 'updatedAt', header: 'Updated', render: (i) => <span className="text-xs text-slate-500">{timeAgo(i.updatedAt)}</span> },
  ]
  return (
    <Card
      flush
      title={
        <span className="flex items-center gap-2">
          Real-time stock levels
          {live && (
            <Badge tone="green" dot>
              Live
            </Badge>
          )}
        </span>
      }
      subtitle="Auto-deducted from POS sales via recipe mapping"
      actions={
        <Button size="sm" variant="outline" onClick={() => setLive(!live)}>
          {live ? 'Pause live feed' : 'Resume live feed'}
        </Button>
      }
    >
      <DataTable
        columns={columns}
        data={rows}
        rowKey={(i) => i.id}
        searchKeys={['name', 'supplier', 'category']}
        searchPlaceholder="Search ingredients or suppliers…"
        onRowClick={onOpen}
        pageSize={10}
        toolbar={
          <>
            <Select value={cat} onChange={(e) => setCat(e.target.value)} options={CATEGORIES} placeholder="All categories" className="h-9 w-40" />
            <Select value={status} onChange={(e) => setStatus(e.target.value)} options={['In stock', 'Low stock', 'Expiring soon', 'Out of stock']} placeholder="All statuses" className="h-9 w-36" />
          </>
        }
      />
    </Card>
  )
}

function IngredientDetail({ ing, movements, onCount }: { ing: Ingredient; movements: StockMovement[]; onCount: (n: number) => void }) {
  const [count, setCount] = useState(String(ing.stock))
  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-slate-50 p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-3xl font-semibold text-slate-900">
            {formatNumber(ing.stock)} <span className="text-base text-slate-500">{ing.unit}</span>
          </p>
          <StatusBadge status={stockStatus(ing)} />
        </div>
        <ProgressBar value={ing.stock} max={ing.par} tone={ing.stock <= ing.reorderPoint ? 'red' : 'green'} className="mt-3" showLabel />
        <p className="mt-1 text-xs text-slate-500">
          Reorder point {ing.reorderPoint} {ing.unit} · par {ing.par} {ing.unit}
        </p>
      </div>
      <DescriptionList
        items={[
          { label: 'Supplier', value: ing.supplier },
          { label: 'Storage', value: ing.storage },
          { label: 'Unit cost', value: formatCurrency(ing.costPerUnit) },
          { label: 'Avg daily use', value: `${ing.usagePerDay} ${ing.unit}` },
          { label: 'Expiry', value: daysTo(ing.expiry) > 365 ? 'Non-perishable' : formatDate(ing.expiry) },
          { label: 'Branch', value: ing.branch },
        ]}
      />
      <div>
        <p className="mb-2 text-sm font-semibold text-slate-800">Physical count</p>
        <div className="flex gap-2">
          <Input type="number" value={count} onChange={(e) => setCount(e.target.value)} />
          <Button variant="outline" onClick={() => onCount(Number(count))}>
            Save count
          </Button>
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold text-slate-800">Recent movements</p>
        {movements.length === 0 ? (
          <p className="text-sm text-slate-400">No movements recorded</p>
        ) : (
          <ul className="space-y-2">
            {movements.map((m) => (
              <li key={m.id} className="flex items-center justify-between text-sm">
                <span>
                  <StatusBadge status={m.type} /> <span className="ml-1 text-slate-600">{m.reference}</span>
                </span>
                <span className="text-slate-500">
                  {m.qty} {m.unit} · {timeAgo(m.date)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

const moveTone: Record<MovementType, 'green' | 'blue' | 'purple' | 'red' | 'gray'> = { 'Stock In': 'green', 'Stock Out': 'blue', Transfer: 'purple', Wastage: 'red', Adjustment: 'gray' }

function MovementsTab({ movements, onNew }: { movements: StockMovement[]; onNew: (t: MovementType) => void }) {
  const [type, setType] = useState('')
  const rows = movements.filter((m) => !type || m.type === type)
  const columns: Column<StockMovement>[] = [
    { key: 'date', header: 'When', sortable: true, render: (m) => <span className="text-xs text-slate-500">{formatDate(m.date, true)}</span> },
    { key: 'type', header: 'Type', render: (m) => <Badge tone={moveTone[m.type]}>{m.type}</Badge> },
    { key: 'ingredient', header: 'Ingredient', render: (m) => <span className="font-medium text-slate-800">{m.ingredient}</span> },
    { key: 'qty', header: 'Qty', align: 'right', render: (m) => `${m.qty} ${m.unit}` },
    { key: 'route', header: 'From → To', render: (m) => <span className="text-slate-600">{[m.from, m.to].filter(Boolean).join(' → ') || '—'}</span> },
    { key: 'reference', header: 'Ref' },
    { key: 'value', header: 'Value', align: 'right', render: (m) => formatCurrency(m.value) },
    { key: 'by', header: 'By' },
  ]
  const transfers = movements.filter((m) => m.type === 'Transfer')
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {BRANCHES.map((b) => {
          const out = transfers.filter((t) => t.from === b).reduce((s, t) => s + t.value, 0)
          const inn = transfers.filter((t) => t.to === b).reduce((s, t) => s + t.value, 0)
          return (
            <Card key={b} bodyClassName="p-4">
              <p className="font-semibold text-slate-900">{b}</p>
              <div className="mt-2 flex justify-between text-sm">
                <span className="text-emerald-600">↓ In {formatCurrency(inn)}</span>
                <span className="text-red-600">↑ Out {formatCurrency(out)}</span>
              </div>
            </Card>
          )
        })}
      </div>
      <Card
        title="Stock movements"
        subtitle="Goods received, issues to kitchen, inter-branch transfers & adjustments"
        flush
        actions={
          <>
            <Button size="sm" variant="outline" icon={ArrowLeftRight} onClick={() => onNew('Transfer')}>
              Transfer
            </Button>
            <Button size="sm" icon={PackagePlus} onClick={() => onNew('Stock In')}>
              Receive stock
            </Button>
          </>
        }
      >
        <DataTable
          columns={columns}
          data={rows}
          rowKey={(m) => m.id}
          searchKeys={['ingredient', 'reference', 'by']}
          pageSize={10}
          toolbar={<Select value={type} onChange={(e) => setType(e.target.value)} options={['Stock In', 'Stock Out', 'Transfer', 'Wastage', 'Adjustment']} placeholder="All types" className="h-9 w-36" />}
        />
      </Card>
    </div>
  )
}

function MovementModal({
  type,
  ingredients,
  branch,
  onClose,
  onSave,
}: {
  type: MovementType | null
  ingredients: Ingredient[]
  branch: string
  onClose: () => void
  onSave: (m: StockMovement, reason?: WastageEntry['reason']) => void
}) {
  const here = branch === 'All branches' ? 'Downtown' : branch
  const [t, setT] = useState<MovementType>(type ?? 'Stock In')
  const [ingId, setIngId] = useState('')
  const [qty, setQty] = useState('')
  const [from, setFrom] = useState(here)
  const [to, setTo] = useState<string>(BRANCHES.find((b) => b !== here) ?? 'Mall Road')
  const [reason, setReason] = useState<WastageEntry['reason']>('Spoiled')
  const [ref, setRef] = useState('')
  const ing = ingredients.find((i) => i.id === ingId)
  const n = Number(qty)
  const save = () => {
    if (!ing || !n) return
    onSave(
      {
        id: `sm-${Date.now()}`,
        date: new Date().toISOString(),
        type: t,
        ingredient: ing.name,
        qty: n,
        unit: ing.unit,
        from: t === 'Stock In' ? ing.supplier : t === 'Transfer' ? from : ing.storage,
        to: t === 'Stock In' ? here : t === 'Transfer' ? to : t === 'Stock Out' ? 'Kitchen' : undefined,
        reference: ref || `${{ 'Stock In': 'GRN', 'Stock Out': 'REQ', Transfer: 'TRF', Wastage: 'WST', Adjustment: 'ADJ' }[t]}-${Math.floor(Math.random() * 9000 + 1000)}`,
        by: 'Omar Siddiqui',
        value: round(n * ing.costPerUnit),
      },
      t === 'Wastage' ? reason : undefined,
    )
    setIngId('')
    setQty('')
    setRef('')
  }
  return (
    <Modal
      open={!!type}
      onClose={onClose}
      title="Record stock movement"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!ing || !n || (t === 'Transfer' && from === to)} onClick={save} variant={t === 'Wastage' ? 'danger' : 'primary'}>
            Record {t.toLowerCase()}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Tabs variant="pills" items={(['Stock In', 'Stock Out', 'Transfer', 'Wastage'] as MovementType[]).map((x) => ({ id: x, label: x }))} value={t} onChange={setT} />
        <Field label="Ingredient" required>
          <Select value={ingId} onChange={(e) => setIngId(e.target.value)} placeholder="Select ingredient…" options={ingredients.map((i) => ({ value: i.id, label: `${i.emoji} ${i.name} (${i.stock} ${i.unit} on hand)` }))} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`Quantity${ing ? ` (${ing.unit})` : ''}`} required hint={ing && n ? `Value ${formatCurrency(n * ing.costPerUnit)}` : undefined}>
            <Input type="number" min={0} value={qty} onChange={(e) => setQty(e.target.value)} />
          </Field>
          <Field label="Reference" hint="GRN / invoice / requisition no.">
            <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Auto" />
          </Field>
        </div>
        {t === 'Transfer' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="From branch">
              <Select value={from} onChange={(e) => setFrom(e.target.value)} options={[...BRANCHES]} />
            </Field>
            <Field label="To branch" error={from === to ? 'Choose a different branch' : undefined}>
              <Select value={to} onChange={(e) => setTo(e.target.value)} options={[...BRANCHES]} />
            </Field>
          </div>
        )}
        {t === 'Wastage' && (
          <Field label="Reason">
            <Select value={reason} onChange={(e) => setReason(e.target.value as WastageEntry['reason'])} options={['Expired', 'Spoiled', 'Over-production', 'Kitchen error', 'Customer return', 'Damaged']} />
          </Field>
        )}
        {t === 'Stock In' && ing && <p className="text-xs text-slate-500">Supplier: {ing.supplier}</p>}
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */

function WasteTab({ ingredients, wastage, onDiscard, onLog }: { ingredients: Ingredient[]; wastage: WastageEntry[]; onDiscard: (i: Ingredient) => void; onLog: () => void }) {
  const expiring = ingredients.filter((i) => daysTo(i.expiry) <= 5).sort((a, b) => a.expiry.localeCompare(b.expiry))
  const byReason = Object.entries(
    wastage.reduce<Record<string, number>>((acc, w) => ((acc[w.reason] = (acc[w.reason] ?? 0) + w.cost), acc), {}),
  ).map(([reason, cost]) => ({ reason, cost: round(cost) }))
  const columns: Column<WastageEntry>[] = [
    { key: 'date', header: 'When', sortable: true, render: (w) => <span className="text-xs text-slate-500">{timeAgo(w.date)}</span> },
    { key: 'ingredient', header: 'Item', render: (w) => <span className="font-medium">{w.ingredient}</span> },
    { key: 'qty', header: 'Qty', render: (w) => `${w.qty} ${w.unit}` },
    { key: 'reason', header: 'Reason', render: (w) => <Badge tone={w.reason === 'Expired' || w.reason === 'Spoiled' ? 'red' : 'yellow'}>{w.reason}</Badge> },
    { key: 'cost', header: 'Cost', align: 'right', sortable: true, render: (w) => formatCurrency(w.cost) },
    { key: 'by', header: 'Logged by' },
  ]
  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Expiring soon" subtitle="FIFO — use these first" flush>
          <ul className="divide-y divide-slate-100">
            {expiring.map((i) => {
              const d = daysTo(i.expiry)
              return (
                <li key={i.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                  <span className="text-lg">{i.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-800">{i.name}</p>
                    <p className="text-xs text-slate-500">
                      {i.stock} {i.unit} · {formatCurrency(i.stock * i.costPerUnit)}
                    </p>
                  </div>
                  <Badge tone={d <= 1 ? 'red' : d <= 3 ? 'yellow' : 'gray'}>{d <= 0 ? 'Today' : `${d}d`}</Badge>
                  <Button size="xs" variant="ghost" onClick={() => onDiscard(i)}>
                    Discard
                  </Button>
                </li>
              )
            })}
          </ul>
        </Card>
        <Card title="Consumption vs wastage" subtitle="Food cost $, last 7 days" className="xl:col-span-2">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={consumptionTrend} margin={{ left: -10, right: 8, top: 8 }}>
                <CartesianGrid {...chartGrid} vertical={false} />
                <XAxis dataKey="day" {...chartAxis} />
                <YAxis yAxisId="c" {...chartAxis} />
                <YAxis yAxisId="w" orientation="right" {...chartAxis} />
                <Tooltip {...chartTooltip} formatter={(v) => formatCurrency(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="c" dataKey="consumption" name="Consumption" fill={chartColors[4]} radius={[4, 4, 0, 0]} />
                <Line yAxisId="w" dataKey="wastage" name="Wastage" stroke="#ef4444" strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Wastage log" flush className="xl:col-span-2" actions={<Button size="sm" variant="outline" icon={Trash2} onClick={onLog}>Log wastage</Button>}>
          <DataTable columns={columns} data={wastage} rowKey={(w) => w.id} searchKeys={['ingredient', 'reason']} pageSize={8} />
        </Card>
        <Card title="Wastage by reason">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byReason} layout="vertical" margin={{ left: 20, right: 8 }}>
                <XAxis type="number" {...chartAxis} />
                <YAxis type="category" dataKey="reason" {...chartAxis} width={90} />
                <Tooltip {...chartTooltip} formatter={(v) => formatCurrency(Number(v))} />
                <Bar dataKey="cost" fill="#ef4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function ReorderTab({ ingredients }: { ingredients: Ingredient[] }) {
  const notify = useToast()
  const low = useMemo(() => ingredients.filter((i) => i.stock <= i.reorderPoint * 1.3).sort((a, b) => a.stock / a.usagePerDay - b.stock / b.usagePerDay), [ingredients])
  const [picked, setPicked] = useState<Record<string, boolean>>(() => Object.fromEntries(low.filter((i) => i.stock <= i.reorderPoint).map((i) => [i.id, true])))
  const [qty, setQty] = useState<Record<string, number>>({})
  const [busy, setBusy] = useState(false)
  const suggest = (i: Ingredient) => Math.ceil(i.par - i.stock + i.usagePerDay * 2)
  const chosen = low.filter((i) => picked[i.id])
  const bySupplier = chosen.reduce<Record<string, Ingredient[]>>((acc, i) => ((acc[i.supplier] ??= []).push(i), acc), {})
  const total = chosen.reduce((s, i) => s + (qty[i.id] ?? suggest(i)) * i.costPerUnit, 0)

  const createPOs = async () => {
    setBusy(true)
    for (const [supplier, list] of Object.entries(bySupplier)) {
      await createPurchaseOrder({ supplier, lines: list.map((i) => ({ ingredient: i.name, qty: qty[i.id] ?? suggest(i) })) })
    }
    setBusy(false)
    notify(`${Object.keys(bySupplier).length} purchase orders sent to suppliers · ${formatCurrency(total)}`)
    setPicked({})
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <Card title="Low-stock alerts & reorder suggestions" subtitle="Suggested qty = par − on hand + 2 days lead-time usage" flush>
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs font-semibold text-slate-500 uppercase">
                <th className="w-10 px-4 py-2.5" />
                <th className="px-4 py-2.5">Ingredient</th>
                <th className="px-4 py-2.5">On hand</th>
                <th className="px-4 py-2.5">Runs out in</th>
                <th className="px-4 py-2.5">Supplier</th>
                <th className="px-4 py-2.5">Order qty</th>
                <th className="px-4 py-2.5 text-right">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {low.map((i) => {
                const hrs = (i.stock / i.usagePerDay) * 24
                const q = qty[i.id] ?? suggest(i)
                return (
                  <tr key={i.id} className={cn(picked[i.id] && 'bg-brand-50/40')}>
                    <td className="px-4 py-2.5">
                      <Checkbox checked={!!picked[i.id]} onChange={(c) => setPicked({ ...picked, [i.id]: c })} />
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-800">
                      {i.emoji} {i.name}
                    </td>
                    <td className="px-4 py-2.5">
                      {i.stock} {i.unit} <span className="text-xs text-slate-400">/ ROP {i.reorderPoint}</span>
                    </td>
                    <td className={cn('px-4 py-2.5 font-medium', hrs < 24 ? 'text-red-600' : hrs < 48 ? 'text-amber-600' : 'text-slate-600')}>{hrs < 24 ? `${Math.round(hrs)} h` : `${(hrs / 24).toFixed(1)} days`}</td>
                    <td className="px-4 py-2.5 text-slate-600">{i.supplier}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1">
                        <Input type="number" value={q} onChange={(e) => setQty({ ...qty, [i.id]: Number(e.target.value) })} className="h-8 w-20" />
                        <span className="text-xs text-slate-500">{i.unit}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right">{formatCurrency(q * i.costPerUnit)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="Purchase order summary" subtitle={`${chosen.length} items · ${Object.keys(bySupplier).length} suppliers`}>
        {chosen.length === 0 ? (
          <p className="text-sm text-slate-500">Select items to build purchase orders.</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(bySupplier).map(([s, list]) => (
              <div key={s} className="rounded-lg border border-slate-200 p-3">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                  <ClipboardList size={14} /> {s}
                </p>
                <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
                  {list.map((i) => (
                    <li key={i.id} className="flex justify-between">
                      <span>{i.name}</span>
                      <span>
                        {qty[i.id] ?? suggest(i)} {i.unit}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="flex justify-between border-t border-slate-100 pt-3 font-semibold">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
            <Button block icon={ShoppingBag} loading={busy} onClick={createPOs}>
              Create & send POs
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function AiTab({ ingredients }: { ingredients: Ingredient[] }) {
  const options = ingredients.filter((i) => ['Meat & Poultry', 'Dry Goods', 'Produce', 'Dairy'].includes(i.category))
  const [ingId, setIngId] = useState(options[0]?.id ?? '')
  const ing = ingredients.find((i) => i.id === ingId) ?? ingredients[0]!
  const k = ing.usagePerDay / 32
  const data = demandForecast.map((d) => ({
    day: d.day,
    actual: d.actual !== undefined ? round(d.actual * k) : undefined,
    forecast: round(d.forecast * k),
    band: d.lower !== undefined && d.upper !== undefined ? [round(d.lower * k), round(d.upper * k)] : undefined,
  }))
  const spoilage = ingredients
    .map((i) => {
      const d = Math.max(0.5, daysTo(i.expiry))
      const leftover = i.stock - i.usagePerDay * d
      return { i, d, risk: leftover > 0 ? Math.min(0.95, leftover / i.stock + 0.15) : 0.05 }
    })
    .filter((x) => x.d < 30 && x.risk > 0.1)
    .sort((a, b) => b.risk - a.risk)
  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="space-y-6 xl:col-span-2">
        <Card
          title="AI demand forecast"
          subtitle={`Daily usage of ${ing.name} (${ing.unit}) — actual vs forecast with 80% confidence band`}
          actions={<Select value={ingId} onChange={(e) => setIngId(e.target.value)} options={options.map((o) => ({ value: o.id, label: o.name }))} className="h-9 w-48" />}
        >
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ left: -10, right: 8, top: 8 }}>
                <CartesianGrid {...chartGrid} vertical={false} />
                <XAxis dataKey="day" {...chartAxis} />
                <YAxis {...chartAxis} />
                <Tooltip {...chartTooltip} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area dataKey="band" name="Confidence" fill={chartColors[1]} fillOpacity={0.12} stroke="none" />
                <Line dataKey="actual" name="Actual" stroke={chartColors[0]} strokeWidth={2.5} dot={{ r: 3 }} />
                <Line dataKey="forecast" name="Forecast" stroke={chartColors[1]} strokeWidth={2} strokeDasharray="5 4" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Next 7 days forecast: <span className="font-semibold text-slate-800">{formatNumber(data.slice(7).reduce((s, d) => s + d.forecast, 0))} {ing.unit}</span> · on hand {ing.stock} {ing.unit}
          </p>
        </Card>
        <Card title="Spoilage predictions" subtitle="Probability stock will expire before it is consumed" flush>
          <ul className="divide-y divide-slate-100">
            {spoilage.map(({ i, d, risk }) => (
              <li key={i.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                <span className="text-lg">{i.emoji}</span>
                <span className="min-w-36 flex-1">
                  <span className="font-medium text-slate-800">{i.name}</span>
                  <span className="block text-xs text-slate-500">
                    {i.stock} {i.unit} · expires in {Math.ceil(d)}d · uses {i.usagePerDay}/day
                  </span>
                </span>
                <div className="w-40">
                  <ProgressBar value={risk * 100} tone={risk > 0.6 ? 'red' : risk > 0.3 ? 'yellow' : 'green'} showLabel />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <AIPanel module="inventory" title="AI demand & spoilage" subtitle="Forecasts from sales, weather, events & holidays" />
    </div>
  )
}
