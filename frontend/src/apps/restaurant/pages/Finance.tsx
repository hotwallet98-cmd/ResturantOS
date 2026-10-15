import { AlertTriangle, ArrowDownRight, ArrowUpRight, Banknote, CheckCircle2, CreditCard, FileSpreadsheet, FileText, Landmark, LineChart as LineIcon, Plus, Receipt, RotateCcw, Scale, Sparkles, Wallet } from 'lucide-react'
import { useState } from 'react'
import { Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, Tooltip, XAxis, YAxis } from 'recharts'
import type { Column } from '@/shared/components/ui'
import {
  AIInsights,
  Badge,
  Button,
  Card,
  DataTable,
  Field,
  Input,
  LoadingState,
  Modal,
  PageHeader,
  Select,
  StatCard,
  StatusBadge,
  Tabs,
  useToast,
} from '@/shared/components/ui'
import { ChartBox, KpiGrid } from '@/apps/restaurant/components/business'
import { useAsync } from '@/shared/hooks/useAsync'
import { chartAxis, chartColors, chartGrid, chartTooltip } from '@/shared/lib/chart'
import { cn } from '@/shared/lib/cn'
import { formatCurrency, formatDate, formatPercent, timeAgo } from '@/shared/lib/format'
import type { Expense, FinanceAnomaly, Invoice, PayrollInput, Settlement, SupplierPayment, Transaction } from '@/apps/restaurant/services/business'
import {
  BRANCHES,
  createExpense,
  expenseByCategory,
  forecastSeries,
  getExpenses,
  getFinanceAnomalies,
  getInvoices,
  getPayrollInputs,
  getPnL,
  getSettlements,
  getSupplierPayments,
  getTransactions,
  issueRefund,
  paySupplier,
  revenueByChannel,
  revenueExpenseTrend,
  taxSummary,
  updateInvoice,
} from '@/apps/restaurant/services/business'

type TabId = 'overview' | 'payments' | 'payables' | 'tax' | 'pnl' | 'ai'

const money = (v: unknown) => formatCurrency(Number(v))

export default function Finance() {
  const [tab, setTab] = useState<TabId>('overview')
  const [period, setPeriod] = useState('This month')
  const notify = useToast()
  const latest = revenueExpenseTrend[revenueExpenseTrend.length - 1]
  const prev = revenueExpenseTrend[revenueExpenseTrend.length - 2]
  const pct = (a: number, b: number) => ((a - b) / b) * 100

  return (
    <div>
      <PageHeader
        icon={Landmark}
        title="Finance & Accounting"
        description="Sales, expenses, settlements, payroll inputs, tax and profit & loss — reconciled across all branches."
        actions={
          <>
            <Select className="h-10 w-36" value={period} onChange={(e) => setPeriod(e.target.value)} options={['This month', 'Last month', 'This quarter', 'YTD']} />
            <Button variant="outline" icon={FileSpreadsheet} onClick={() => notify('Export started — ledger.xlsx will download shortly', 'info')}>Export</Button>
          </>
        }
      />
      <KpiGrid>
        <StatCard label="Revenue" value={formatCurrency(latest.revenue, { compact: true })} icon={ArrowUpRight} tone="green" delta={pct(latest.revenue, prev.revenue)} />
        <StatCard label="Expenses" value={formatCurrency(latest.expenses, { compact: true })} icon={ArrowDownRight} tone="red" delta={pct(latest.expenses, prev.expenses)} invertDelta />
        <StatCard label="Net profit" value={formatCurrency(latest.revenue - latest.expenses, { compact: true })} icon={Wallet} tone="brand" delta={pct(latest.revenue - latest.expenses, prev.revenue - prev.expenses)} />
        <StatCard label="Profit margin" value={formatPercent(((latest.revenue - latest.expenses) / latest.revenue) * 100)} icon={Scale} tone="purple" hint="target 22%" />
      </KpiGrid>

      <Tabs<TabId>
        className="mb-5"
        value={tab}
        onChange={setTab}
        items={[
          { id: 'overview', label: 'Sales & Expenses', icon: LineIcon },
          { id: 'payments', label: 'Payments & Settlements', icon: CreditCard },
          { id: 'payables', label: 'Suppliers & Payroll', icon: Banknote },
          { id: 'tax', label: 'Tax & Invoices', icon: Receipt },
          { id: 'pnl', label: 'Profit & Loss', icon: FileText },
          { id: 'ai', label: 'AI Forecast', icon: Sparkles },
        ]}
      />

      {tab === 'overview' && <OverviewTab />}
      {tab === 'payments' && <PaymentsTab />}
      {tab === 'payables' && <PayablesTab />}
      {tab === 'tax' && <TaxTab />}
      {tab === 'pnl' && <PnLTab period={period} />}
      {tab === 'ai' && <AITab />}
    </div>
  )
}

/* ─────────────── Sales, revenue & expenses ─────────────── */

function OverviewTab() {
  const notify = useToast()
  const { data, setData, loading } = useAsync(getExpenses)
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ category: 'Food & Ingredients', vendor: '', branch: 'Downtown', amount: 0 })

  const save = async () => {
    const e: Expense = { id: `EX-${Date.now()}`, date: new Date().toISOString(), category: f.category, vendor: f.vendor, branch: f.branch as Expense['branch'], amount: f.amount, status: 'Pending' }
    setData((d) => [e, ...(d ?? [])])
    await createExpense(e)
    notify(`Expense of ${formatCurrency(e.amount)} recorded`)
    setOpen(false)
  }

  const cols: Column<Expense>[] = [
    { key: 'date', header: 'Date', sortable: true, render: (e) => formatDate(e.date) },
    { key: 'category', header: 'Category', render: (e) => <Badge tone="gray">{e.category}</Badge> },
    { key: 'vendor', header: 'Vendor', sortable: true },
    { key: 'branch', header: 'Branch' },
    { key: 'amount', header: 'Amount', align: 'right', sortable: true, render: (e) => <span className="font-medium">{formatCurrency(e.amount)}</span> },
    { key: 'status', header: 'Status', render: (e) => <StatusBadge status={e.status} /> },
  ]

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Revenue vs expenses" subtitle="Last 6 months, all branches" className="xl:col-span-2">
          <ChartBox height={280}>
            <BarChart data={revenueExpenseTrend}>
              <CartesianGrid {...chartGrid} vertical={false} />
              <XAxis dataKey="m" {...chartAxis} />
              <YAxis {...chartAxis} tickFormatter={(v: number) => formatCurrency(v, { compact: true })} />
              <Tooltip {...chartTooltip} formatter={money} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="revenue" name="Revenue" fill={chartColors[2]} radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill={chartColors[0]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartBox>
        </Card>
        <Card title="Revenue by channel">
          <ChartBox height={180}>
            <PieChart>
              <Pie data={revenueByChannel} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={2}>
                {revenueByChannel.map((_, i) => <Cell key={i} fill={chartColors[i]} />)}
              </Pie>
              <Tooltip {...chartTooltip} formatter={money} />
            </PieChart>
          </ChartBox>
          <ul className="mt-2 space-y-1.5 text-sm">
            {revenueByChannel.map((r, i) => (
              <li key={r.name} className="flex items-center justify-between"><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: chartColors[i] }} />{r.name}</span><span className="font-medium">{formatCurrency(r.value, { compact: true })}</span></li>
            ))}
          </ul>
        </Card>
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Expenses by category">
          <ul className="space-y-3">
            {expenseByCategory.map((e, i) => {
              const total = expenseByCategory.reduce((a, x) => a + x.value, 0)
              return (
                <li key={e.name}>
                  <div className="mb-1 flex justify-between text-sm"><span className="text-slate-600">{e.name}</span><span className="font-medium">{formatCurrency(e.value, { compact: true })} <span className="text-xs text-slate-400">{Math.round((e.value / total) * 100)}%</span></span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${(e.value / total) * 100}%`, background: chartColors[i] }} /></div>
                </li>
              )
            })}
          </ul>
        </Card>
        <Card title="Recent expenses" className="xl:col-span-2" flush>
          <DataTable columns={cols} data={data ?? []} loading={loading} rowKey={(e) => e.id} searchKeys={['vendor', 'category', 'branch']} pageSize={6} toolbar={<Button size="sm" icon={Plus} onClick={() => setOpen(true)}>Record expense</Button>} />
        </Card>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Record expense" footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} disabled={!f.vendor || !f.amount}>Save</Button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} options={['Food & Ingredients', 'Utilities', 'Rent', 'Marketing', 'Maintenance', 'Packaging', 'Cleaning', 'Software', 'Other']} /></Field>
          <Field label="Branch"><Select value={f.branch} onChange={(e) => setF({ ...f, branch: e.target.value })} options={[...BRANCHES]} /></Field>
          <Field label="Vendor" required><Input value={f.vendor} onChange={(e) => setF({ ...f, vendor: e.target.value })} /></Field>
          <Field label="Amount ($)" required><Input type="number" value={f.amount || ''} onChange={(e) => setF({ ...f, amount: Number(e.target.value) })} /></Field>
        </div>
      </Modal>
    </div>
  )
}

/* ─────────────── Payments, refunds & settlements ─────────────── */

function PaymentsTab() {
  const notify = useToast()
  const tx = useAsync(getTransactions)
  const st = useAsync(getSettlements)
  const [type, setType] = useState('')
  const [refund, setRefund] = useState<Transaction | null>(null)
  const rows = type ? (tx.data ?? []).filter((t) => t.type === type) : tx.data ?? []

  const doRefund = async () => {
    if (!refund) return
    const r: Transaction = { ...refund, id: `TX-${Date.now()}`, type: 'Refund', description: `Refund — ${refund.description}`, amount: -Math.abs(refund.amount), date: new Date().toISOString(), status: 'Completed' }
    tx.setData((d) => [r, ...(d ?? [])])
    await issueRefund(r)
    notify(`Refund of ${formatCurrency(Math.abs(r.amount))} issued to ${refund.method}`)
    setRefund(null)
  }

  const cols: Column<Transaction>[] = [
    { key: 'id', header: 'Txn', render: (t) => <div><p className="font-medium text-slate-900">{t.id}</p><p className="text-xs text-slate-500">{timeAgo(t.date)}</p></div> },
    { key: 'type', header: 'Type', render: (t) => <Badge tone={t.type === 'Sale' ? 'green' : t.type === 'Refund' ? 'red' : t.type === 'Settlement' ? 'blue' : 'gray'}>{t.type}</Badge> },
    { key: 'description', header: 'Description' },
    { key: 'method', header: 'Method' },
    { key: 'branch', header: 'Branch' },
    { key: 'amount', header: 'Amount', align: 'right', sortable: true, render: (t) => <span className={cn('font-semibold', t.amount < 0 ? 'text-red-600' : 'text-emerald-700')}>{t.amount < 0 ? '-' : '+'}{formatCurrency(Math.abs(t.amount))}</span> },
    { key: 'status', header: 'Status', render: (t) => <StatusBadge status={t.status} /> },
    { key: 'act', header: '', render: (t) => t.type === 'Sale' && t.status === 'Completed' && <Button size="xs" variant="ghost" icon={RotateCcw} onClick={() => setRefund(t)}>Refund</Button> },
  ]

  const stCols: Column<Settlement>[] = [
    { key: 'provider', header: 'Provider', render: (s) => <div><p className="font-medium text-slate-900">{s.provider}</p><p className="text-xs text-slate-500">{s.period}</p></div> },
    { key: 'gross', header: 'Gross', align: 'right', render: (s) => formatCurrency(s.gross) },
    { key: 'commission', header: 'Fees', align: 'right', render: (s) => <span className="text-red-600">-{formatCurrency(s.commission)}</span> },
    { key: 'net', header: 'Net payout', align: 'right', render: (s) => <span className="font-semibold">{formatCurrency(s.net)}</span> },
    { key: 'expectedAt', header: 'Expected', render: (s) => formatDate(s.expectedAt) },
    { key: 'status', header: 'Status', render: (s) => <StatusBadge status={s.status} /> },
  ]

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Card & wallet today" value={formatCurrency(4260)} icon={CreditCard} tone="blue" />
        <StatCard label="Refunds (7d)" value={formatCurrency(318)} icon={RotateCcw} tone="red" hint="0.6% of sales" />
        <StatCard label="Settlements pending" value={formatCurrency((st.data ?? []).filter((s) => s.status !== 'Received').reduce((a, s) => a + s.net, 0))} icon={Landmark} tone="amber" />
      </div>
      <Card title="Transactions" flush>
        <DataTable columns={cols} data={rows} loading={tx.loading} rowKey={(t) => t.id} searchKeys={['id', 'description', 'method']} toolbar={<Select className="h-9 w-36" value={type} onChange={(e) => setType(e.target.value)} options={['Sale', 'Refund', 'Settlement', 'Expense']} placeholder="All types" />} />
      </Card>
      <Card title="Aggregator & gateway settlements" flush>
        <DataTable columns={stCols} data={st.data ?? []} loading={st.loading} rowKey={(s) => s.id} />
      </Card>
      <Modal open={!!refund} onClose={() => setRefund(null)} title="Issue refund" size="sm" footer={<><Button variant="ghost" onClick={() => setRefund(null)}>Cancel</Button><Button variant="danger" onClick={doRefund}>Refund {refund && formatCurrency(refund.amount)}</Button></>}>
        {refund && <p className="text-sm text-slate-600">Refund <b>{refund.description}</b> ({refund.id}) back to <b>{refund.method}</b>? This will post a reversing entry and notify the guest.</p>}
      </Modal>
    </div>
  )
}

/* ─────────────── Supplier payments & payroll inputs ─────────────── */

function PayablesTab() {
  const notify = useToast()
  const sp = useAsync(getSupplierPayments)
  const py = useAsync(getPayrollInputs)

  const pay = async (p: SupplierPayment) => {
    const n = { ...p, status: 'Paid' as const }
    sp.setData((d) => d?.map((x) => (x.id === p.id ? n : x)))
    await paySupplier(n)
    notify(`Payment of ${formatCurrency(p.amount)} released to ${p.supplier}`)
  }

  const spCols: Column<SupplierPayment>[] = [
    { key: 'supplier', header: 'Supplier', sortable: true, render: (p) => <div><p className="font-medium text-slate-900">{p.supplier}</p><p className="text-xs text-slate-500">{p.invoice}</p></div> },
    { key: 'dueDate', header: 'Due', sortable: true, render: (p) => formatDate(p.dueDate) },
    { key: 'amount', header: 'Amount', align: 'right', render: (p) => formatCurrency(p.amount) },
    { key: 'status', header: 'Status', render: (p) => <StatusBadge status={p.status} /> },
    { key: 'act', header: '', render: (p) => p.status !== 'Paid' && <Button size="xs" variant="outline" onClick={() => pay(p)}>Pay</Button> },
  ]
  const gross = (p: PayrollInput) => p.hours * p.rate + p.overtime * p.rate * 1.5 + p.tips
  const pyCols: Column<PayrollInput>[] = [
    { key: 'employee', header: 'Employee', sortable: true, render: (p) => <div><p className="font-medium text-slate-900">{p.employee}</p><p className="text-xs text-slate-500">{p.role} · {p.branch}</p></div> },
    { key: 'hours', header: 'Hours', align: 'right' },
    { key: 'overtime', header: 'OT', align: 'right', render: (p) => <span className={p.overtime > 15 ? 'font-semibold text-amber-600' : ''}>{p.overtime}</span> },
    { key: 'tips', header: 'Tips', align: 'right', render: (p) => formatCurrency(p.tips) },
    { key: 'gross', header: 'Gross pay', align: 'right', sortable: true, sortValue: gross, render: (p) => <span className="font-medium">{formatCurrency(gross(p))}</span> },
    { key: 'status', header: 'Status', render: (p) => <StatusBadge status={p.status} /> },
  ]
  const total = (py.data ?? []).reduce((a, p) => a + gross(p), 0)

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card title="Supplier payments" subtitle="Linked to procurement GRNs" flush>
        <DataTable columns={spCols} data={sp.data ?? []} loading={sp.loading} rowKey={(p) => p.id} searchKeys={['supplier', 'invoice']} />
      </Card>
      <Card
        title="Payroll inputs — October"
        subtitle={`Hours from attendance · total ${formatCurrency(total)}`}
        flush
        actions={<Button size="sm" variant="outline" onClick={() => { py.setData((d) => d?.map((p) => ({ ...p, status: 'Approved' }))); notify('All payroll inputs approved & sent to payroll provider') }}>Approve all</Button>}
      >
        <DataTable columns={pyCols} data={py.data ?? []} loading={py.loading} rowKey={(p) => p.id} searchKeys={['employee', 'role', 'branch']} />
      </Card>
    </div>
  )
}

/* ─────────────── Tax, invoices & reconciliation ─────────────── */

function TaxTab() {
  const notify = useToast()
  const { data, setData, loading } = useAsync(getInvoices)
  const [kind, setKind] = useState('')
  const rows = kind ? (data ?? []).filter((i) => i.type === kind) : data ?? []
  const unreconciled = (data ?? []).filter((i) => !i.reconciled).length

  const reconcile = async (inv: Invoice) => {
    const n = { ...inv, reconciled: true, status: inv.status === 'Draft' ? inv.status : ('Paid' as const) }
    setData((d) => d?.map((x) => (x.id === inv.id ? n : x)))
    await updateInvoice(n)
    notify(`${inv.id} matched to bank statement`)
  }

  const cols: Column<Invoice>[] = [
    { key: 'id', header: 'Invoice', render: (i) => <div><p className="font-medium text-slate-900">{i.id}</p><p className="text-xs text-slate-500">{i.party}</p></div> },
    { key: 'type', header: 'Type', render: (i) => <Badge tone={i.type === 'Receivable' ? 'green' : 'orange'}>{i.type}</Badge> },
    { key: 'due', header: 'Due', sortable: true, render: (i) => formatDate(i.due) },
    { key: 'subtotal', header: 'Subtotal', align: 'right', render: (i) => formatCurrency(i.subtotal) },
    { key: 'tax', header: 'Tax', align: 'right', render: (i) => formatCurrency(i.tax) },
    { key: 'total', header: 'Total', align: 'right', sortable: true, sortValue: (i) => i.subtotal + i.tax, render: (i) => <span className="font-semibold">{formatCurrency(i.subtotal + i.tax)}</span> },
    { key: 'status', header: 'Status', render: (i) => <StatusBadge status={i.status} /> },
    { key: 'rec', header: 'Reconciled', render: (i) => (i.reconciled ? <span className="flex items-center gap-1 text-xs font-medium text-emerald-600"><CheckCircle2 size={14} /> Matched</span> : <Button size="xs" variant="outline" onClick={() => reconcile(i)}>Match</Button>) },
  ]

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Sales tax summary — September" className="lg:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2">
            {taxSummary.map((t, i) => (
              <div key={t.label} className={cn('rounded-xl p-4', i === taxSummary.length - 1 ? 'bg-brand-50 ring-1 ring-brand-200' : 'bg-slate-50')}>
                <p className="text-xs text-slate-500">{t.label}</p>
                <p className={cn('mt-1 text-xl font-semibold', t.value < 0 ? 'text-emerald-700' : 'text-slate-900')}>{t.value < 0 ? '-' : ''}{formatCurrency(Math.abs(t.value))}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 text-sm">
            <span className="text-slate-600">PRA return due <b>{formatDate(new Date(Date.now() + 5 * 86_400_000))}</b></span>
            <Button size="sm" onClick={() => notify('Sales-tax return drafted for FBR/PRA filing')}>Prepare return</Button>
          </div>
        </Card>
        <Card title="Bank reconciliation">
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Bank balance (HBL)</span><span className="font-semibold">{formatCurrency(84210.55)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Book balance</span><span className="font-semibold">{formatCurrency(82974.15)}</span></div>
            <div className="flex justify-between border-t border-slate-100 pt-3"><span className="text-slate-500">Difference</span><span className="font-semibold text-amber-600">{formatCurrency(1236.4)}</span></div>
            <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">{unreconciled} invoice(s) not yet matched to bank lines.</p>
            <Button block variant="outline" onClick={() => { setData((d) => d?.map((i) => ({ ...i, reconciled: true }))); notify('Auto-reconcile matched all open items') }}>Auto-reconcile</Button>
          </div>
        </Card>
      </div>
      <Card title="Invoices" flush>
        <DataTable columns={cols} data={rows} loading={loading} rowKey={(i) => i.id} searchKeys={['id', 'party']} toolbar={<Select className="h-9 w-36" value={kind} onChange={(e) => setKind(e.target.value)} options={['Receivable', 'Payable']} placeholder="All invoices" />} />
      </Card>
    </div>
  )
}

/* ─────────────── Profit & loss ─────────────── */

function PnLTab({ period }: { period: string }) {
  const notify = useToast()
  const { data, loading } = useAsync(getPnL)
  if (loading || !data) return <LoadingState />
  const revenue = data.find((l) => l.label === 'Total revenue')!
  return (
    <Card
      title={`Profit & Loss statement — ${period}`}
      subtitle="Spice Route Kitchen · consolidated (Downtown, Mall Road, Airport)"
      actions={<><Button size="sm" variant="outline" icon={FileText} onClick={() => notify('Export started — P&L.pdf', 'info')}>PDF</Button><Button size="sm" variant="outline" icon={FileSpreadsheet} onClick={() => notify('Export started — P&L.xlsx', 'info')}>Excel</Button></>}
      flush
    >
      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            <tr><th className="px-5 py-2.5 text-left">Line item</th><th className="px-5 py-2.5 text-right">Current</th><th className="px-5 py-2.5 text-right">% of rev.</th><th className="px-5 py-2.5 text-right">Previous</th><th className="px-5 py-2.5 text-right">Change</th></tr>
          </thead>
          <tbody>
            {data.map((l, i) => {
              const first = i === 0 || data[i - 1].group !== l.group
              const ch = ((l.current - l.previous) / l.previous) * 100
              const costLine = l.group === 'COGS' || l.group === 'Opex'
              const good = costLine ? ch <= 0 : ch >= 0
              return (
                <tr key={l.label} className={cn(l.bold ? 'border-y border-slate-200 bg-slate-50/70 font-semibold text-slate-900' : 'text-slate-700', l.group === 'Net' && 'bg-brand-50 text-brand-900')}>
                  <td className={cn('px-5 py-2.5', !l.bold && 'pl-9')}>
                    {first && !l.bold && <span className="mb-1 block text-[11px] font-semibold tracking-wide text-slate-400 uppercase">{{ Revenue: 'Revenue', COGS: 'Cost of goods sold', Opex: 'Operating expenses', Gross: '', Net: '' }[l.group]}</span>}
                    {l.label}
                  </td>
                  <td className="px-5 py-2.5 text-right">{costLine ? `(${formatCurrency(l.current)})` : formatCurrency(l.current)}</td>
                  <td className="px-5 py-2.5 text-right text-slate-500">{formatPercent((l.current / revenue.current) * 100)}</td>
                  <td className="px-5 py-2.5 text-right text-slate-500">{formatCurrency(l.previous)}</td>
                  <td className={cn('px-5 py-2.5 text-right text-xs font-semibold', ch === 0 ? 'text-slate-400' : good ? 'text-emerald-600' : 'text-red-600')}>{ch > 0 ? '+' : ''}{ch.toFixed(1)}%</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

/* ─────────────── AI forecasting & anomaly detection ─────────────── */

function AITab() {
  const notify = useToast()
  const { data, setData, loading } = useAsync(getFinanceAnomalies)
  const resolve = (a: FinanceAnomaly) => {
    setData((d) => d?.map((x) => (x.id === a.id ? { ...x, status: 'Resolved' } : x)))
    notify(`Anomaly “${a.title}” marked as reviewed`)
  }
  const sevTone = { critical: 'red', warning: 'yellow', info: 'blue' } as const
  return (
    <div className="space-y-6">
      <Card title={<span className="flex items-center gap-2"><Sparkles size={16} className="text-violet-600" /> Weekly revenue forecast</span>} subtitle="Shaded area = 80% confidence interval · model: Demand Forecast v3.12">
        <ChartBox height={300}>
          <ComposedChart data={forecastSeries}>
            <CartesianGrid {...chartGrid} vertical={false} />
            <XAxis dataKey="d" {...chartAxis} />
            <YAxis {...chartAxis} tickFormatter={(v: number) => formatCurrency(v, { compact: true })} domain={['dataMin - 4000', 'dataMax + 2000']} />
            <Tooltip {...chartTooltip} formatter={(v) => (Array.isArray(v) ? `${formatCurrency(Number(v[0]), { compact: true })} – ${formatCurrency(Number(v[1]), { compact: true })}` : formatCurrency(Number(v)))} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area dataKey="band" name="Confidence band" stroke="none" fill="#8b5cf6" fillOpacity={0.15} />
            <Line dataKey="actual" name="Actual" stroke={chartColors[0]} strokeWidth={2.5} dot={{ r: 3 }} />
            <Line dataKey="forecast" name="Forecast" stroke="#8b5cf6" strokeWidth={2.5} strokeDasharray="6 4" dot={{ r: 3 }} />
          </ComposedChart>
        </ChartBox>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-violet-50 p-3"><p className="text-xs text-violet-600">Next 5 weeks revenue</p><p className="text-lg font-semibold text-violet-900">{formatCurrency(289200, { compact: true })}</p></div>
          <div className="rounded-lg bg-violet-50 p-3"><p className="text-xs text-violet-600">Projected Q4 profit</p><p className="text-lg font-semibold text-violet-900">{formatCurrency(162400, { compact: true })}</p></div>
          <div className="rounded-lg bg-violet-50 p-3"><p className="text-xs text-violet-600">Cash runway</p><p className="text-lg font-semibold text-violet-900">5.8 months</p></div>
        </div>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={<span className="flex items-center gap-2"><AlertTriangle size={16} className="text-amber-500" /> Flagged anomalies</span>} flush>
          {loading || !data ? <LoadingState /> : (
            <ul className="divide-y divide-slate-100">
              {data.map((a) => (
                <li key={a.id} className={cn('flex gap-3 px-5 py-3', a.status === 'Resolved' && 'opacity-60')}>
                  <Badge tone={sevTone[a.severity]} className="mt-0.5 h-fit capitalize">{a.severity}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900">{a.title}</p>
                    <p className="text-xs text-slate-500">{a.detail}</p>
                    <p className="mt-1 text-xs text-slate-400">{formatCurrency(a.amount)} · {timeAgo(a.detectedAt)}</p>
                  </div>
                  {a.status === 'Open' ? <Button size="xs" variant="outline" onClick={() => resolve(a)}>Review</Button> : <StatusBadge status="Resolved" />}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <AIInsights
          title="AI Financial Advisor"
          subtitle="Forecasts & savings opportunities"
          onAction={(i) => notify(`${i.action} — queued`)}
          insights={[
            { title: 'Revenue forecast +6% next month', detail: 'Driven by wedding season catering and Mall Road growth. Confidence 84%.', severity: 'success', metric: '+6.2%' },
            { title: 'Food cost creeping up', detail: 'Meat cost % rose from 32% to 34.8% — chicken price +11% at Al-Fatah. Consider menu re-price of 3 dishes.', severity: 'warning', metric: '+2.8 pts', action: 'Review pricing' },
            { title: 'Negotiate aggregator commission', detail: 'Foodpanda volume qualifies for the 15% tier (currently 17%).', severity: 'opportunity', metric: '-$1.9k/yr', action: 'Draft request' },
            { title: 'Cash-flow dip expected week 43', detail: 'Rent + payroll + PRA filing fall in the same week. Delay non-urgent supplier payments 5 days.', severity: 'info', action: 'Plan payments' },
          ]}
        />
      </div>
    </div>
  )
}
