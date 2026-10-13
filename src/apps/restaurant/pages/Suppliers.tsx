import {
  BadgeCheck,
  Building2,
  Check,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileText,
  PackageCheck,
  Plus,
  RotateCcw,
  Sparkles,
  Truck,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from 'recharts'
import type { Column } from '@/shared/components/ui'
import {
  AIInsights,
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
  ProgressBar,
  Select,
  StatCard,
  StatusBadge,
  Tabs,
  Textarea,
  useToast,
} from '@/shared/components/ui'
import { ChartBox, EmojiTile, KpiGrid, Stars } from '@/apps/restaurant/components/business'
import { useAsync } from '@/shared/hooks/useAsync'
import { chartAxis, chartColors, chartGrid, chartTooltip } from '@/shared/lib/chart'
import { cn } from '@/shared/lib/cn'
import { daysFromNow, formatCurrency, formatDate, timeAgo } from '@/shared/lib/format'
import type { Branch, GoodsReceipt, POStatus, PurchaseOrder, PurchaseRequest, Supplier, SupplierPayment, SupplierReturn } from '@/apps/restaurant/services/business'
import {
  BRANCHES,
  PO_STAGES,
  createGoodsReceipt,
  createPurchaseOrder,
  createSupplier,
  createSupplierReturn,
  getGoodsReceipts,
  getPurchaseOrders,
  getPurchaseRequests,
  getSupplierPayments,
  getSupplierReturns,
  getSuppliers,
  paySupplier,
  supplierSpendTrend,
  updatePurchaseOrder,
  updatePurchaseRequest,
} from '@/apps/restaurant/services/business'

type TabId = 'suppliers' | 'requests' | 'orders' | 'receiving' | 'payments' | 'ai'

export default function Suppliers() {
  const [tab, setTab] = useState<TabId>('suppliers')
  const sup = useAsync(getSuppliers)
  const prs = useAsync(getPurchaseRequests)
  const pos = useAsync(getPurchaseOrders)
  const grns = useAsync(getGoodsReceipts)
  const pays = useAsync(getSupplierPayments)
  const rtns = useAsync(getSupplierReturns)
  const [newSupplier, setNewSupplier] = useState(false)
  const [newPO, setNewPO] = useState(false)

  const loading = sup.loading || prs.loading || pos.loading
  const pendingPR = prs.data?.filter((p) => p.status === 'Pending').length ?? 0
  const openPO = pos.data?.filter((p) => !['Received', 'Cancelled'].includes(p.status)).length ?? 0
  const due = pays.data?.filter((p) => p.status !== 'Paid').reduce((a, p) => a + p.amount, 0) ?? 0

  return (
    <div>
      <PageHeader
        icon={Truck}
        title="Suppliers & Procurement"
        description="Manage vendors, approve purchase requests, track orders, receive goods and settle supplier bills."
        actions={
          <>
            <Button variant="outline" icon={Building2} onClick={() => setNewSupplier(true)}>
              Add supplier
            </Button>
            <Button icon={Plus} onClick={() => setNewPO(true)}>
              New purchase order
            </Button>
          </>
        }
      />

      <KpiGrid>
        <StatCard label="Active suppliers" value={sup.data?.filter((s) => s.status === 'Active').length ?? '—'} icon={Building2} tone="blue" hint={`${sup.data?.filter((s) => s.status === 'Pending').length ?? 0} pending verification`} />
        <StatCard label="Pending approvals" value={pendingPR} icon={ClipboardList} tone="amber" hint="purchase requests" />
        <StatCard label="Open purchase orders" value={openPO} icon={Truck} tone="brand" delta={8.2} deltaLabel="vs last week" />
        <StatCard label="Payables due" value={formatCurrency(due)} icon={CreditCard} tone="red" invertDelta delta={-4.1} />
      </KpiGrid>

      <Tabs<TabId>
        className="mb-5"
        value={tab}
        onChange={setTab}
        items={[
          { id: 'suppliers', label: 'Suppliers', icon: Building2, count: sup.data?.length },
          { id: 'requests', label: 'Purchase Requests', icon: ClipboardList, count: pendingPR },
          { id: 'orders', label: 'Purchase Orders', icon: Truck, count: openPO },
          { id: 'receiving', label: 'Goods Receiving', icon: PackageCheck },
          { id: 'payments', label: 'Payments & Returns', icon: CreditCard },
          { id: 'ai', label: 'AI Optimization', icon: Sparkles },
        ]}
      />

      {loading ? (
        <LoadingState />
      ) : (
        <>
          {tab === 'suppliers' && sup.data && <SuppliersTab suppliers={sup.data} />}
          {tab === 'requests' && prs.data && <RequestsTab data={prs.data} setData={prs.setData} onConvert={() => setNewPO(true)} />}
          {tab === 'orders' && pos.data && <OrdersTab data={pos.data} setData={pos.setData} />}
          {tab === 'receiving' && grns.data && pos.data && <ReceivingTab data={grns.data} setData={grns.setData} orders={pos.data} />}
          {tab === 'payments' && pays.data && rtns.data && (
            <PaymentsTab payments={pays.data} setPayments={pays.setData} returns={rtns.data} setReturns={rtns.setData} suppliers={sup.data ?? []} />
          )}
          {tab === 'ai' && sup.data && <AITab suppliers={sup.data} onDraft={() => setNewPO(true)} />}
        </>
      )}

      <NewSupplierModal open={newSupplier} onClose={() => setNewSupplier(false)} onCreate={(s) => sup.setData((d) => [s, ...(d ?? [])])} />
      <NewPOModal
        open={newPO}
        onClose={() => setNewPO(false)}
        suppliers={sup.data ?? []}
        onCreate={(po) => {
          pos.setData((d) => [po, ...(d ?? [])])
          setTab('orders')
        }}
      />
    </div>
  )
}

/* ─────────────── Supplier registration & management ─────────────── */

function SuppliersTab({ suppliers }: { suppliers: Supplier[] }) {
  const [category, setCategory] = useState('')
  const [selected, setSelected] = useState<Supplier | null>(null)
  const categories = [...new Set(suppliers.map((s) => s.category))]
  const rows = category ? suppliers.filter((s) => s.category === category) : suppliers

  const columns: Column<Supplier>[] = [
    {
      key: 'name',
      header: 'Supplier',
      sortable: true,
      render: (s) => (
        <div className="flex items-center gap-3">
          <EmojiTile emoji={s.emoji} />
          <div className="min-w-0">
            <p className="font-medium text-slate-900">{s.name}</p>
            <p className="text-xs text-slate-500">{s.id} · {s.city}</p>
          </div>
        </div>
      ),
    },
    { key: 'category', header: 'Category', sortable: true },
    { key: 'contact', header: 'Contact', render: (s) => <div><p>{s.contact}</p><p className="text-xs text-slate-500">{s.phone}</p></div> },
    { key: 'paymentTerms', header: 'Terms' },
    { key: 'rating', header: 'Rating', sortable: true, render: (s) => (s.rating ? <span className="flex items-center gap-1"><Stars value={s.rating} /> <span className="text-xs text-slate-500">{s.rating}</span></span> : <span className="text-xs text-slate-400">New</span>) },
    { key: 'spendYtd', header: 'Spend YTD', align: 'right', sortable: true, render: (s) => formatCurrency(s.spendYtd) },
    { key: 'status', header: 'Status', render: (s) => <StatusBadge status={s.status} /> },
  ]

  return (
    <>
      <Card flush>
        <DataTable
          columns={columns}
          data={rows}
          rowKey={(s) => s.id}
          searchKeys={['name', 'category', 'contact', 'city']}
          searchPlaceholder="Search suppliers…"
          onRowClick={setSelected}
          toolbar={<Select className="h-9 w-48" value={category} onChange={(e) => setCategory(e.target.value)} options={categories} placeholder="All categories" />}
        />
      </Card>
      <Drawer open={!!selected} onClose={() => setSelected(null)} title={selected?.name} description={selected?.category}>
        {selected && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 rounded-xl bg-slate-50 p-4">
              <EmojiTile emoji={selected.emoji} className="h-14 w-14 text-3xl" />
              <div>
                <StatusBadge status={selected.status} />
                <p className="mt-1 text-sm text-slate-600">Lead time {selected.leadTimeDays} day(s) · {selected.paymentTerms}</p>
              </div>
            </div>
            <DescriptionList
              items={[
                { label: 'Contact', value: selected.contact },
                { label: 'Phone', value: selected.phone },
                { label: 'Email', value: selected.email },
                { label: 'City', value: selected.city },
                { label: 'Spend YTD', value: formatCurrency(selected.spendYtd) },
                { label: 'Balance due', value: formatCurrency(selected.balanceDue) },
              ]}
            />
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-800">Performance scorecard</p>
              {[
                { l: 'On-time delivery', v: selected.onTimePct, tone: 'green' as const },
                { l: 'Quality acceptance', v: selected.qualityScore, tone: 'blue' as const },
                { l: 'Price competitiveness', v: Math.max(0, 200 - selected.priceIndex - 50), tone: 'purple' as const },
              ].map((m) => (
                <div key={m.l}>
                  <div className="mb-1 flex justify-between text-xs text-slate-600"><span>{m.l}</span><span className="font-medium">{m.v}%</span></div>
                  <ProgressBar value={m.v} tone={m.tone} />
                </div>
              ))}
            </div>
          </div>
        )}
      </Drawer>
    </>
  )
}

/* ─────────────── Purchase requests & approvals ─────────────── */

const priorityTone = { Low: 'gray', Medium: 'blue', High: 'orange', Urgent: 'red' } as const

function RequestsTab({ data, setData, onConvert }: { data: PurchaseRequest[]; setData: (fn: (d: PurchaseRequest[] | undefined) => PurchaseRequest[] | undefined) => void; onConvert: () => void }) {
  const notify = useToast()
  const [status, setStatus] = useState<'All' | PurchaseRequest['status']>('Pending')
  const rows = status === 'All' ? data : data.filter((p) => p.status === status)

  const decide = async (pr: PurchaseRequest, s: 'Approved' | 'Rejected') => {
    const next = { ...pr, status: s }
    setData((d) => d?.map((x) => (x.id === pr.id ? next : x)))
    await updatePurchaseRequest(next)
    notify(`${pr.id} ${s.toLowerCase()}`, s === 'Approved' ? 'success' : 'info')
  }

  const columns: Column<PurchaseRequest>[] = [
    { key: 'id', header: 'Request', render: (p) => <div><p className="font-medium text-slate-900">{p.id}</p><p className="text-xs text-slate-500">{timeAgo(p.createdAt)}</p></div> },
    {
      key: 'item',
      header: 'Item',
      render: (p) => (
        <div>
          <p className="flex items-center gap-1.5 font-medium text-slate-800">
            {p.item}
            {p.aiGenerated && <Badge tone="purple"><Sparkles size={11} /> AI</Badge>}
          </p>
          <p className="text-xs text-slate-500">{p.reason}</p>
        </div>
      ),
    },
    { key: 'qty', header: 'Qty', render: (p) => `${p.qty} ${p.unit}` },
    { key: 'branch', header: 'Branch' },
    { key: 'requestedBy', header: 'Requested by' },
    { key: 'priority', header: 'Priority', render: (p) => <Badge tone={priorityTone[p.priority]}>{p.priority}</Badge> },
    { key: 'estCost', header: 'Est. cost', align: 'right', sortable: true, render: (p) => formatCurrency(p.estCost) },
    {
      key: 'actions',
      header: 'Status / Action',
      render: (p) =>
        p.status === 'Pending' ? (
          <div className="flex gap-1.5">
            <Button size="xs" variant="success" icon={Check} onClick={() => decide(p, 'Approved')}>Approve</Button>
            <Button size="xs" variant="outline" icon={X} onClick={() => decide(p, 'Rejected')}>Reject</Button>
          </div>
        ) : p.status === 'Approved' ? (
          <div className="flex items-center gap-2"><StatusBadge status={p.status} /><button type="button" className="text-xs font-semibold text-brand-600 hover:underline" onClick={onConvert}>Create PO</button></div>
        ) : (
          <StatusBadge status={p.status} />
        ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <b>Approval workflow:</b> Requests under {formatCurrency(250)} are auto-approved for branch managers. Higher amounts require Procurement Manager sign-off.
      </div>
      <Card flush>
        <DataTable
          columns={columns}
          data={rows}
          rowKey={(p) => p.id}
          searchKeys={['id', 'item', 'requestedBy', 'branch']}
          toolbar={<Tabs variant="pills" value={status} onChange={setStatus} items={(['Pending', 'Approved', 'Rejected', 'All'] as const).map((s) => ({ id: s, label: s }))} />}
        />
      </Card>
    </div>
  )
}

/* ─────────────── Purchase orders & tracking ─────────────── */

function POTimeline({ po }: { po: PurchaseOrder }) {
  const idx = po.status === 'Cancelled' ? -1 : PO_STAGES.indexOf(po.status)
  return (
    <ol className="relative space-y-4 border-l-2 border-slate-100 pl-6">
      {PO_STAGES.map((s, i) => {
        const h = po.history.find((x) => x.status === s)
        const done = i <= idx
        return (
          <li key={s} className="relative">
            <span className={cn('absolute top-0.5 -left-[33px] flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-white', done ? 'bg-brand-600 text-white' : 'bg-slate-200')}>
              {done && <Check size={12} />}
            </span>
            <p className={cn('text-sm font-medium', done ? 'text-slate-900' : 'text-slate-400')}>{s}</p>
            <p className="text-xs text-slate-500">{h ? `${formatDate(h.at, true)} · ${h.by}` : i === idx + 1 ? 'Next step' : '—'}</p>
          </li>
        )
      })}
      {po.status === 'Cancelled' && <li className="text-sm font-medium text-red-600">Order cancelled</li>}
    </ol>
  )
}

function OrdersTab({ data, setData }: { data: PurchaseOrder[]; setData: (fn: (d: PurchaseOrder[] | undefined) => PurchaseOrder[] | undefined) => void }) {
  const notify = useToast()
  const [selected, setSelected] = useState<PurchaseOrder | null>(null)
  const [status, setStatus] = useState('')
  const rows = status ? data.filter((p) => p.status === status) : data

  const advance = async (po: PurchaseOrder) => {
    const i = PO_STAGES.indexOf(po.status)
    const nextStatus = PO_STAGES[i + 1] as POStatus | undefined
    if (!nextStatus) return
    const next: PurchaseOrder = { ...po, status: nextStatus, history: [...po.history, { status: nextStatus, at: new Date().toISOString(), by: 'You' }] }
    setData((d) => d?.map((x) => (x.id === po.id ? next : x)))
    setSelected(next)
    await updatePurchaseOrder(next)
    notify(`${po.id} marked as ${nextStatus}`)
  }

  const columns: Column<PurchaseOrder>[] = [
    { key: 'id', header: 'PO #', sortable: true, render: (p) => <span className="font-medium text-slate-900">{p.id}</span> },
    { key: 'supplier', header: 'Supplier', sortable: true },
    { key: 'branch', header: 'Branch' },
    { key: 'lines', header: 'Items', render: (p) => <span className="text-xs text-slate-600">{p.lines.map((l) => l.item).join(', ')}</span> },
    { key: 'expectedAt', header: 'Expected', sortable: true, render: (p) => formatDate(p.expectedAt) },
    {
      key: 'progress',
      header: 'Progress',
      render: (p) => (
        <div className="flex w-28 gap-0.5">
          {PO_STAGES.map((s, i) => (
            <span key={s} className={cn('h-1.5 flex-1 rounded-full', p.status === 'Cancelled' ? 'bg-red-200' : i <= PO_STAGES.indexOf(p.status) ? 'bg-brand-500' : 'bg-slate-200')} />
          ))}
        </div>
      ),
    },
    { key: 'total', header: 'Total', align: 'right', sortable: true, render: (p) => formatCurrency(p.total) },
    { key: 'status', header: 'Status', render: (p) => <StatusBadge status={p.status} /> },
  ]

  return (
    <>
      <Card flush>
        <DataTable
          columns={columns}
          data={rows}
          rowKey={(p) => p.id}
          searchKeys={['id', 'supplier', 'branch']}
          onRowClick={setSelected}
          toolbar={<Select className="h-9 w-40" value={status} onChange={(e) => setStatus(e.target.value)} options={[...PO_STAGES, 'Cancelled']} placeholder="All statuses" />}
        />
      </Card>
      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `${selected.id} · ${selected.supplier}` : ''}
        description={selected ? `${selected.branch} branch · created ${formatDate(selected.createdAt)}` : ''}
        footer={
          selected && !['Received', 'Cancelled'].includes(selected.status) ? (
            <>
              <Button variant="outline" onClick={() => notify('PO sent to supplier via email & WhatsApp', 'info')} icon={FileText}>Resend PO</Button>
              <Button onClick={() => advance(selected)}>Mark as {PO_STAGES[PO_STAGES.indexOf(selected.status) + 1]}</Button>
            </>
          ) : undefined
        }
      >
        {selected && (
          <div className="space-y-6">
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500 uppercase"><tr><th className="px-3 py-2">Item</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Unit</th><th className="px-3 py-2 text-right">Amount</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {selected.lines.map((l) => (
                    <tr key={l.item}><td className="px-3 py-2">{l.item}</td><td className="px-3 py-2 text-right">{l.qty} {l.unit}</td><td className="px-3 py-2 text-right">{formatCurrency(l.unitPrice)}</td><td className="px-3 py-2 text-right font-medium">{formatCurrency(l.qty * l.unitPrice)}</td></tr>
                  ))}
                  <tr className="bg-slate-50 font-semibold"><td className="px-3 py-2" colSpan={3}>Total</td><td className="px-3 py-2 text-right">{formatCurrency(selected.total)}</td></tr>
                </tbody>
              </table>
            </div>
            <div>
              <p className="mb-3 text-sm font-semibold text-slate-800">Tracking timeline</p>
              <POTimeline po={selected} />
            </div>
          </div>
        )}
      </Drawer>
    </>
  )
}

/* ─────────────── Goods receiving & inspection ─────────────── */

function ReceivingTab({ data, setData, orders }: { data: GoodsReceipt[]; setData: (fn: (d: GoodsReceipt[] | undefined) => GoodsReceipt[] | undefined) => void; orders: PurchaseOrder[] }) {
  const notify = useToast()
  const [open, setOpen] = useState(false)
  const inbound = orders.filter((o) => o.status === 'In Transit' || o.status === 'Confirmed')
  const [form, setForm] = useState({ poId: '', item: '', ordered: 0, accepted: 0, tempOk: true, notes: '' })
  const po = inbound.find((o) => o.id === form.poId)

  const totals = useMemo(() => {
    const acc = data.reduce((a, g) => a + g.acceptedQty, 0)
    const rej = data.reduce((a, g) => a + g.rejectedQty, 0)
    return { acc, rej, rate: acc + rej ? (acc / (acc + rej)) * 100 : 100 }
  }, [data])

  const submit = async () => {
    if (!po || !form.item) return
    const rejected = Math.max(0, form.ordered - form.accepted)
    const g: GoodsReceipt = {
      id: `GRN-${3311 + data.length}`,
      poId: po.id,
      supplier: po.supplier,
      branch: po.branch,
      item: form.item,
      orderedQty: form.ordered,
      acceptedQty: form.accepted,
      rejectedQty: rejected,
      unit: po.lines.find((l) => l.item === form.item)?.unit ?? 'kg',
      tempOk: form.tempOk,
      inspector: 'You',
      notes: form.notes || 'Inspected on receipt',
      status: !form.tempOk || form.accepted === 0 ? 'Failed' : rejected > 0 ? 'Partial' : 'Passed',
      receivedAt: new Date().toISOString(),
    }
    setData((d) => [g, ...(d ?? [])])
    await createGoodsReceipt(g)
    notify(`${g.id} recorded — ${g.acceptedQty} accepted, ${g.rejectedQty} rejected`)
    setOpen(false)
  }

  const columns: Column<GoodsReceipt>[] = [
    { key: 'id', header: 'GRN', render: (g) => <div><p className="font-medium text-slate-900">{g.id}</p><p className="text-xs text-slate-500">{g.poId}</p></div> },
    { key: 'supplier', header: 'Supplier', sortable: true },
    { key: 'item', header: 'Item' },
    { key: 'branch', header: 'Branch' },
    {
      key: 'qty',
      header: 'Accepted / Rejected',
      render: (g) => (
        <div className="w-40">
          <div className="mb-1 flex justify-between text-xs"><span className="font-medium text-emerald-700">{g.acceptedQty} ✓</span><span className={g.rejectedQty ? 'font-medium text-red-600' : 'text-slate-400'}>{g.rejectedQty} ✗</span><span className="text-slate-400">of {g.orderedQty} {g.unit}</span></div>
          <div className="flex h-1.5 overflow-hidden rounded-full bg-slate-100">
            <span className="bg-emerald-500" style={{ width: `${(g.acceptedQty / (g.orderedQty || 1)) * 100}%` }} />
            <span className="bg-red-400" style={{ width: `${(g.rejectedQty / (g.orderedQty || 1)) * 100}%` }} />
          </div>
        </div>
      ),
    },
    { key: 'tempOk', header: 'Temp check', render: (g) => (g.tempOk ? <Badge tone="green">OK</Badge> : <Badge tone="red">Breach</Badge>) },
    { key: 'notes', header: 'Inspection notes', render: (g) => <span className="text-xs text-slate-600">{g.notes}</span> },
    { key: 'status', header: 'Result', render: (g) => <StatusBadge status={g.status} /> },
  ]

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Acceptance rate (30d)" value={`${totals.rate.toFixed(1)}%`} icon={BadgeCheck} tone="green" />
        <StatCard label="Units rejected" value={totals.rej} icon={X} tone="red" hint="returned to suppliers" />
        <StatCard label="Inbound today" value={inbound.length} icon={Truck} tone="blue" hint="POs awaiting receipt" />
      </div>
      <Card flush>
        <DataTable columns={columns} data={data} rowKey={(g) => g.id} searchKeys={['id', 'poId', 'supplier', 'item']} toolbar={<Button size="sm" icon={ClipboardCheck} onClick={() => setOpen(true)}>Receive goods</Button>} />
      </Card>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Goods Received Note"
        description="Inspect the delivery and record accepted vs rejected quantity."
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={submit} disabled={!po || !form.item}>Save GRN</Button></>}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Purchase order" required className="sm:col-span-2">
            <Select value={form.poId} onChange={(e) => setForm({ ...form, poId: e.target.value, item: '' })} options={inbound.map((o) => ({ value: o.id, label: `${o.id} — ${o.supplier} (${o.branch})` }))} placeholder="Select inbound PO" />
          </Field>
          <Field label="Item" required className="sm:col-span-2">
            <Select
              value={form.item}
              onChange={(e) => {
                const l = po?.lines.find((x) => x.item === e.target.value)
                setForm({ ...form, item: e.target.value, ordered: l?.qty ?? 0, accepted: l?.qty ?? 0 })
              }}
              options={po?.lines.map((l) => l.item) ?? []}
              placeholder="Select line item"
            />
          </Field>
          <Field label="Ordered qty"><Input type="number" value={form.ordered} readOnly /></Field>
          <Field label="Accepted qty" hint={`Rejected: ${Math.max(0, form.ordered - form.accepted)}`}>
            <Input type="number" min={0} max={form.ordered} value={form.accepted} onChange={(e) => setForm({ ...form, accepted: Math.min(form.ordered, Number(e.target.value)) })} />
          </Field>
          <Field label="Temperature on arrival" className="sm:col-span-2">
            <Select value={form.tempOk ? 'ok' : 'bad'} onChange={(e) => setForm({ ...form, tempOk: e.target.value === 'ok' })} options={[{ value: 'ok', label: 'Within range (chilled ≤ 5°C / frozen ≤ -18°C)' }, { value: 'bad', label: 'Out of range — reject' }]} />
          </Field>
          <Field label="Inspection notes" className="sm:col-span-2"><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Packaging, freshness, labelling…" /></Field>
        </div>
      </Modal>
    </div>
  )
}

/* ─────────────── Supplier payments & returns ─────────────── */

function PaymentsTab({
  payments,
  setPayments,
  returns,
  setReturns,
  suppliers,
}: {
  payments: SupplierPayment[]
  setPayments: (fn: (d: SupplierPayment[] | undefined) => SupplierPayment[] | undefined) => void
  returns: SupplierReturn[]
  setReturns: (fn: (d: SupplierReturn[] | undefined) => SupplierReturn[] | undefined) => void
  suppliers: Supplier[]
}) {
  const notify = useToast()
  const [rtnOpen, setRtnOpen] = useState(false)
  const [rf, setRf] = useState({ supplier: '', item: '', qty: 1, reason: '' })

  const pay = async (p: SupplierPayment) => {
    const next = { ...p, status: 'Paid' as const }
    setPayments((d) => d?.map((x) => (x.id === p.id ? next : x)))
    await paySupplier(next)
    notify(`Paid ${formatCurrency(p.amount)} to ${p.supplier}`)
  }

  const payCols: Column<SupplierPayment>[] = [
    { key: 'supplier', header: 'Supplier', sortable: true, render: (p) => <div><p className="font-medium text-slate-900">{p.supplier}</p><p className="text-xs text-slate-500">{p.invoice}</p></div> },
    { key: 'dueDate', header: 'Due', sortable: true, render: (p) => formatDate(p.dueDate) },
    { key: 'method', header: 'Method' },
    { key: 'amount', header: 'Amount', align: 'right', sortable: true, render: (p) => <span className="font-medium">{formatCurrency(p.amount)}</span> },
    { key: 'status', header: 'Status', render: (p) => <StatusBadge status={p.status} /> },
    { key: 'act', header: '', align: 'right', render: (p) => (p.status !== 'Paid' ? <Button size="xs" variant="outline" onClick={() => pay(p)}>Pay now</Button> : null) },
  ]

  const rtnCols: Column<SupplierReturn>[] = [
    { key: 'id', header: 'Return', render: (r) => <div><p className="font-medium text-slate-900">{r.id}</p><p className="text-xs text-slate-500">{timeAgo(r.createdAt)}</p></div> },
    { key: 'supplier', header: 'Supplier' },
    { key: 'item', header: 'Item', render: (r) => `${r.item} · ${r.qty} ${r.unit}` },
    { key: 'reason', header: 'Reason', render: (r) => <span className="text-xs text-slate-600">{r.reason}</span> },
    { key: 'credit', header: 'Credit note', align: 'right', render: (r) => formatCurrency(r.credit) },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ]

  const submitReturn = async () => {
    const r: SupplierReturn = { id: `RTN-${506 + returns.length}`, supplier: rf.supplier, item: rf.item, qty: rf.qty, unit: 'kg', reason: rf.reason || 'Quality issue', credit: rf.qty * 2.5, status: 'Pending', createdAt: new Date().toISOString() }
    setReturns((d) => [r, ...(d ?? [])])
    await createSupplierReturn(r)
    notify(`Return ${r.id} raised with ${r.supplier}`)
    setRtnOpen(false)
  }

  const overdue = payments.filter((p) => p.status === 'Overdue')

  return (
    <div className="space-y-6">
      {overdue.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {overdue.length} overdue bill(s) totalling <b>{formatCurrency(overdue.reduce((a, p) => a + p.amount, 0))}</b> — late fees may apply.
        </div>
      )}
      <Card title="Supplier payments" subtitle="Bills from received purchase orders" flush>
        <DataTable columns={payCols} data={payments} rowKey={(p) => p.id} searchKeys={['supplier', 'invoice']} />
      </Card>
      <Card title="Returns & credit notes" flush actions={<Button size="sm" variant="outline" icon={RotateCcw} onClick={() => setRtnOpen(true)}>Raise return</Button>}>
        <DataTable columns={rtnCols} data={returns} rowKey={(r) => r.id} />
      </Card>
      <Modal open={rtnOpen} onClose={() => setRtnOpen(false)} title="Raise supplier return" footer={<><Button variant="ghost" onClick={() => setRtnOpen(false)}>Cancel</Button><Button onClick={submitReturn} disabled={!rf.supplier || !rf.item}>Submit return</Button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Supplier" required className="sm:col-span-2"><Select value={rf.supplier} onChange={(e) => setRf({ ...rf, supplier: e.target.value })} options={suppliers.map((s) => s.name)} placeholder="Select supplier" /></Field>
          <Field label="Item" required><Input value={rf.item} onChange={(e) => setRf({ ...rf, item: e.target.value })} placeholder="e.g. Tomatoes" /></Field>
          <Field label="Quantity (kg)"><Input type="number" min={1} value={rf.qty} onChange={(e) => setRf({ ...rf, qty: Number(e.target.value) })} /></Field>
          <Field label="Reason" className="sm:col-span-2"><Textarea value={rf.reason} onChange={(e) => setRf({ ...rf, reason: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  )
}

/* ─────────────── AI reordering & supplier optimization ─────────────── */

function AITab({ suppliers, onDraft }: { suppliers: Supplier[]; onDraft: () => void }) {
  const notify = useToast()
  const scored = suppliers
    .filter((s) => s.status === 'Active')
    .map((s) => ({ ...s, score: Math.round(s.onTimePct * 0.35 + s.qualityScore * 0.4 + (200 - s.priceIndex - 100) * 0.25) }))
    .sort((a, b) => b.score - a.score)

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="space-y-6 xl:col-span-2">
        <Card title="Supplier scorecard" subtitle="AI composite score — 40% quality · 35% on-time · 25% price" flush>
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/60 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                <tr><th className="px-4 py-2.5">#</th><th className="px-4 py-2.5">Supplier</th><th className="px-4 py-2.5">Price index</th><th className="px-4 py-2.5">On-time</th><th className="px-4 py-2.5">Quality</th><th className="px-4 py-2.5 text-right">Score</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {scored.map((s, i) => (
                  <tr key={s.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-semibold text-slate-400">{i + 1}</td>
                    <td className="px-4 py-3"><div className="flex items-center gap-2"><span className="text-lg">{s.emoji}</span><div><p className="font-medium text-slate-900">{s.name}</p><p className="text-xs text-slate-500">{s.category}</p></div></div></td>
                    <td className="px-4 py-3"><span className={cn('font-medium', s.priceIndex <= 97 ? 'text-emerald-600' : s.priceIndex >= 103 ? 'text-red-600' : 'text-slate-700')}>{s.priceIndex}</span><span className="text-xs text-slate-400"> /100 mkt</span></td>
                    <td className="px-4 py-3 w-32"><ProgressBar value={s.onTimePct} tone={s.onTimePct >= 90 ? 'green' : s.onTimePct >= 80 ? 'yellow' : 'red'} showLabel /></td>
                    <td className="px-4 py-3 w-32"><ProgressBar value={s.qualityScore} tone="blue" showLabel /></td>
                    <td className="px-4 py-3 text-right"><span className={cn('inline-flex h-8 w-11 items-center justify-center rounded-lg text-sm font-bold', s.score >= 92 ? 'bg-emerald-50 text-emerald-700' : s.score >= 85 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700')}>{s.score}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Procurement spend & AI savings">
          <ChartBox height={240}>
            <BarChart data={supplierSpendTrend}>
              <CartesianGrid {...chartGrid} vertical={false} />
              <XAxis dataKey="m" {...chartAxis} />
              <YAxis {...chartAxis} tickFormatter={(v: number) => formatCurrency(v, { compact: true })} />
              <Tooltip {...chartTooltip} formatter={(v) => formatCurrency(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="spend" name="Spend" fill={chartColors[0]} radius={[4, 4, 0, 0]} />
              <Bar dataKey="savings" name="AI savings" fill={chartColors[6]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartBox>
        </Card>
      </div>
      <div className="space-y-6">
        <AIInsights
          title="AI Reordering"
          subtitle="Based on demand forecast, stock levels & lead times"
          onAction={(i) => (i.action?.startsWith('Draft') ? onDraft() : notify(`${i.action} — done`, 'success'))}
          insights={[
            { title: 'Reorder 100 kg Basmati Rice', detail: 'Runs out Saturday 8 PM at Downtown. Metro Foods can deliver by Friday.', severity: 'critical', metric: '94% conf.', action: 'Draft PO' },
            { title: 'Consolidate dairy orders', detail: 'Combine 3 branch orders to Dairy Fresh into one drop to unlock 5% volume discount.', severity: 'opportunity', metric: '-$118/mo', action: 'Apply' },
            { title: 'Switch seafood supplier', detail: 'Ocean Catch on-time rate fell to 78% and 1 cold-chain failure. Karachi Fish Co. quotes 6% cheaper.', severity: 'warning', metric: '78% on-time', action: 'Request quote' },
            { title: 'Lock Golden Oil price', detail: 'Edible oil prices forecast +9% next month. Pre-buy 2 months at current rate.', severity: 'info', metric: '+9% forecast', action: 'Negotiate' },
          ]}
        />
        <Card title="Next-delivery recommendations">
          <ul className="space-y-3 text-sm">
            {[
              ['Al-Fatah Meats', 'Chicken thigh 60 kg', daysFromNow(1)],
              ['Green Valley Produce', 'Tomatoes 90 kg, onions 120 kg', daysFromNow(1)],
              ['Dairy Fresh', 'Cream 40 L, yogurt 60 kg', daysFromNow(2)],
            ].map(([s, items, d]) => (
              <li key={s} className="flex items-start justify-between gap-3">
                <div><p className="font-medium text-slate-800">{s}</p><p className="text-xs text-slate-500">{items}</p></div>
                <Badge tone="purple">{formatDate(d)}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}

/* ─────────────── Modals ─────────────── */

function NewSupplierModal({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (s: Supplier) => void }) {
  const notify = useToast()
  const [f, setF] = useState({ name: '', category: 'Fruits & Vegetables', contact: '', phone: '', email: '', city: 'Lahore', paymentTerms: 'Net 15' })
  const save = async () => {
    const s: Supplier = { id: `SUP-${113 + Math.floor(Math.random() * 800)}`, emoji: '🏷️', ...f, status: 'Pending', rating: 0, onTimePct: 0, qualityScore: 0, priceIndex: 100, spendYtd: 0, balanceDue: 0, leadTimeDays: 2 }
    onCreate(s)
    await createSupplier(s)
    notify(`${s.name} registered — pending verification`)
    onClose()
    setF({ ...f, name: '', contact: '', phone: '', email: '' })
  }
  return (
    <Modal open={open} onClose={onClose} title="Register supplier" description="New suppliers are verified (NTN, food license) before first PO." footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={!f.name}>Register</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Company name" required className="sm:col-span-2"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Karachi Fish Co." /></Field>
        <Field label="Category"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} options={['Fruits & Vegetables', 'Meat & Poultry', 'Dairy & Eggs', 'Seafood', 'Dry Goods & Grocery', 'Spices & Masalas', 'Beverages', 'Packaging', 'Cleaning Supplies']} /></Field>
        <Field label="Payment terms"><Select value={f.paymentTerms} onChange={(e) => setF({ ...f, paymentTerms: e.target.value })} options={['Cash on delivery', 'Net 7', 'Net 15', 'Net 30']} /></Field>
        <Field label="Contact person"><Input value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} /></Field>
        <Field label="Phone"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+92 3xx xxx xxxx" /></Field>
        <Field label="Email"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="City"><Input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></Field>
      </div>
    </Modal>
  )
}

function NewPOModal({ open, onClose, suppliers, onCreate }: { open: boolean; onClose: () => void; suppliers: Supplier[]; onCreate: (po: PurchaseOrder) => void }) {
  const notify = useToast()
  const [supplierId, setSupplierId] = useState('')
  const [branch, setBranch] = useState<Branch>('Downtown')
  const [lines, setLines] = useState([{ item: '', qty: 1, unit: 'kg', unitPrice: 0 }])
  const total = lines.reduce((a, l) => a + l.qty * l.unitPrice, 0)
  const sup = suppliers.find((s) => s.id === supplierId)

  const save = async () => {
    if (!sup) return
    const now = new Date().toISOString()
    const po: PurchaseOrder = { id: `PO-${7822 + Math.floor(Math.random() * 100)}`, supplierId: sup.id, supplier: sup.name, branch, lines: lines.filter((l) => l.item), total, status: 'Sent', createdAt: now, expectedAt: daysFromNow(sup.leadTimeDays), history: [{ status: 'Draft', at: now, by: 'You' }, { status: 'Sent', at: now, by: 'You' }] }
    onCreate(po)
    await createPurchaseOrder(po)
    notify(`${po.id} sent to ${sup.name}`)
    onClose()
    setLines([{ item: '', qty: 1, unit: 'kg', unitPrice: 0 }])
  }

  return (
    <Modal open={open} onClose={onClose} size="lg" title="New purchase order" footer={<><span className="mr-auto self-center text-sm text-slate-600">Total <b className="text-slate-900">{formatCurrency(total)}</b></span><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={!sup || !lines.some((l) => l.item)}>Send PO</Button></>}>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Supplier" required><Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} options={suppliers.filter((s) => s.status === 'Active').map((s) => ({ value: s.id, label: `${s.emoji} ${s.name}` }))} placeholder="Select supplier" /></Field>
          <Field label="Deliver to"><Select value={branch} onChange={(e) => setBranch(e.target.value as Branch)} options={[...BRANCHES]} /></Field>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">Line items</p>
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_80px_80px_100px]">
              <Input className="col-span-2 sm:col-span-1" placeholder="Item" value={l.item} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, item: e.target.value } : x)))} />
              <Input type="number" min={1} value={l.qty} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, qty: Number(e.target.value) } : x)))} />
              <Select value={l.unit} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)))} options={['kg', 'L', 'pcs', 'case', 'bunch']} />
              <Input type="number" min={0} step={0.1} placeholder="Unit $" value={l.unitPrice || ''} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, unitPrice: Number(e.target.value) } : x)))} />
            </div>
          ))}
          <Button size="sm" variant="ghost" icon={Plus} onClick={() => setLines([...lines, { item: '', qty: 1, unit: 'kg', unitPrice: 0 }])}>Add line</Button>
        </div>
      </div>
    </Modal>
  )
}
