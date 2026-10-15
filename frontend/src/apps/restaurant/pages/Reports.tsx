import { BarChart3, Boxes, Building2, ChefHat, Download, FileSpreadsheet, FileText, Megaphone, Send, Sparkles, TrendingUp, Trophy } from 'lucide-react'
import type { ReactElement } from 'react'
import { useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, Tooltip, XAxis, YAxis } from 'recharts'
import type { Column } from '@/shared/components/ui'
import { AIInsights, Badge, Button, Card, DataTable, LoadingState, PageHeader, ProgressBar, Select, StatCard, Tabs, useToast } from '@/shared/components/ui'
import { ChartBox, KpiGrid } from '@/apps/restaurant/components/business'
import { useAsync } from '@/shared/hooks/useAsync'
import { chartAxis, chartColors, chartGrid, chartTooltip } from '@/shared/lib/chart'
import { cn } from '@/shared/lib/cn'
import { formatCurrency, formatNumber, formatPercent } from '@/shared/lib/format'
import type { ReportBundle } from '@/apps/restaurant/services/business'
import { exportReport, getReports } from '@/apps/restaurant/services/business'
import { askCopilot } from '@/shared/services/copilot'

type TabId = 'sales' | 'inventory' | 'staff' | 'customers' | 'branches' | 'ai'
const money = (v: unknown) => formatCurrency(Number(v))

export default function Reports() {
  const [tab, setTab] = useState<TabId>('sales')
  const [days, setDays] = useState(30)
  const notify = useToast()
  const { data, loading } = useAsync(() => getReports(days), [days])

  const doExport = async (format: 'PDF' | 'CSV' | 'Excel') => {
    notify(`Export started — ${tab} report (${format}) will download shortly`, 'info')
    await exportReport(tab, format)
  }

  const totals = data
    ? data.salesDaily.reduce((a, d) => a + d.dineIn + d.delivery + d.takeaway, 0) * (days / Math.min(days, 30))
    : 0
  const covers = data?.branches.reduce((a, b) => a + b.covers, 0) ?? 0

  return (
    <div>
      <PageHeader
        icon={BarChart3}
        title="Reports & Business Intelligence"
        description="Sales, food cost, staff, customers and branch performance — or just ask your data a question."
        actions={
          <>
            <Select className="h-10 w-40" value={String(days)} onChange={(e) => setDays(Number(e.target.value))} options={[{ value: '7', label: 'Last 7 days' }, { value: '30', label: 'Last 30 days' }, { value: '90', label: 'Last 90 days' }, { value: '365', label: 'Last 12 months' }]} />
            <Button variant="outline" icon={FileText} onClick={() => doExport('PDF')}>PDF</Button>
            <Button variant="outline" icon={FileSpreadsheet} onClick={() => doExport('Excel')}>Excel</Button>
            <Button variant="outline" icon={Download} onClick={() => doExport('CSV')}>CSV</Button>
          </>
        }
      />
      <KpiGrid>
        <StatCard label="Net sales" value={formatCurrency(totals, { compact: true })} icon={TrendingUp} tone="green" delta={7.4} />
        <StatCard label="Covers served" value={formatNumber(covers)} icon={Trophy} tone="blue" delta={4.9} />
        <StatCard label="Avg check" value={formatCurrency(covers ? totals / covers : 0)} icon={BarChart3} tone="brand" delta={2.3} />
        <StatCard label="Food cost %" value="29.6%" icon={Boxes} tone="amber" delta={1.2} invertDelta hint="target 28%" />
      </KpiGrid>

      <Tabs<TabId>
        className="mb-5"
        value={tab}
        onChange={setTab}
        items={[
          { id: 'sales', label: 'Sales & Revenue', icon: TrendingUp },
          { id: 'inventory', label: 'Inventory & Food Cost', icon: Boxes },
          { id: 'staff', label: 'Staff & Kitchen', icon: ChefHat },
          { id: 'customers', label: 'Customers & Marketing', icon: Megaphone },
          { id: 'branches', label: 'Branch Performance', icon: Building2 },
          { id: 'ai', label: 'Ask your data', icon: Sparkles },
        ]}
      />

      {loading || !data ? (
        <LoadingState label="Crunching numbers…" />
      ) : (
        <>
          {tab === 'sales' && <SalesTab r={data} />}
          {tab === 'inventory' && <InventoryTab r={data} />}
          {tab === 'staff' && <StaffTab r={data} />}
          {tab === 'customers' && <CustomersTab r={data} />}
          {tab === 'branches' && <BranchesTab r={data} />}
          {tab === 'ai' && <AskTab r={data} />}
        </>
      )}
    </div>
  )
}

/* ─────────────── Sales & revenue ─────────────── */

function SalesTab({ r }: { r: ReportBundle }) {
  return (
    <div className="space-y-6">
      <Card title="Daily sales by channel">
        <ChartBox height={300}>
          <AreaChart data={r.salesDaily}>
            <CartesianGrid {...chartGrid} vertical={false} />
            <XAxis dataKey="d" {...chartAxis} minTickGap={20} />
            <YAxis {...chartAxis} tickFormatter={(v: number) => formatCurrency(v, { compact: true })} />
            <Tooltip {...chartTooltip} formatter={money} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" stackId="1" dataKey="dineIn" name="Dine-in" stroke={chartColors[0]} fill={chartColors[0]} fillOpacity={0.5} />
            <Area type="monotone" stackId="1" dataKey="delivery" name="Delivery" stroke={chartColors[1]} fill={chartColors[1]} fillOpacity={0.5} />
            <Area type="monotone" stackId="1" dataKey="takeaway" name="Takeaway" stroke={chartColors[2]} fill={chartColors[2]} fillOpacity={0.5} />
          </AreaChart>
        </ChartBox>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Orders by hour">
          <ChartBox height={240}>
            <BarChart data={r.hourly}>
              <CartesianGrid {...chartGrid} vertical={false} />
              <XAxis dataKey="h" {...chartAxis} />
              <YAxis {...chartAxis} />
              <Tooltip {...chartTooltip} />
              <Bar dataKey="orders" name="Orders" radius={[4, 4, 0, 0]}>
                {r.hourly.map((h) => <Cell key={h.h} fill={h.orders === Math.max(...r.hourly.map((x) => x.orders)) ? chartColors[0] : '#fdba74'} />)}
              </Bar>
            </BarChart>
          </ChartBox>
        </Card>
        <Card title="Top-selling items" flush>
          <ul className="divide-y divide-slate-100">
            {r.topItems.map((t, i) => (
              <li key={t.name} className="flex items-center gap-3 px-5 py-2.5">
                <span className={cn('flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold', i < 3 ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500')}>{i + 1}</span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-800">{t.name}</p><ProgressBar value={t.revenue} max={r.topItems[0].revenue} className="mt-1" /></div>
                <div className="text-right text-sm"><p className="font-semibold">{formatCurrency(t.revenue, { compact: true })}</p><p className="text-xs text-slate-500">{formatNumber(t.qty)} sold</p></div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}

/* ─────────────── Inventory & food cost ─────────────── */

function InventoryTab({ r }: { r: ReportBundle }) {
  type FC = ReportBundle['foodCost'][number]
  const cols: Column<FC>[] = [
    { key: 'category', header: 'Category', sortable: true },
    { key: 'cost', header: 'Cost', align: 'right', sortable: true, render: (f) => formatCurrency(f.cost) },
    { key: 'target', header: 'Target %', align: 'right', render: (f) => formatPercent(f.target) },
    { key: 'actual', header: 'Actual %', align: 'right', sortable: true, render: (f) => <span className={cn('font-semibold', f.actual > f.target ? 'text-red-600' : 'text-emerald-600')}>{formatPercent(f.actual)}</span> },
    { key: 'var', header: 'Variance', align: 'right', render: (f) => <Badge tone={f.actual > f.target ? 'red' : 'green'}>{f.actual > f.target ? '+' : ''}{(f.actual - f.target).toFixed(1)} pts</Badge> },
  ]
  return (
    <div className="space-y-6">
      <Card title="Food cost by category" flush><DataTable columns={cols} data={r.foodCost} rowKey={(f) => f.category} /></Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Wastage trend (kg / day)">
          <ChartBox height={220}>
            <LineChart data={r.wastage}>
              <CartesianGrid {...chartGrid} vertical={false} />
              <XAxis dataKey="d" {...chartAxis} />
              <YAxis {...chartAxis} />
              <Tooltip {...chartTooltip} />
              <Line type="monotone" dataKey="kg" name="Waste (kg)" stroke="#ef4444" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ChartBox>
        </Card>
        <Card title="Inventory value & turnover">
          <ul className="space-y-4">
            {r.inventoryValue.map((i) => (
              <li key={i.name}>
                <div className="mb-1 flex justify-between text-sm"><span className="font-medium text-slate-800">{i.name}</span><span>{formatCurrency(i.value)} · <span className="text-slate-500">{i.turnover}× turns</span></span></div>
                <ProgressBar value={i.turnover} max={12} tone={i.turnover >= 9 ? 'green' : 'yellow'} />
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}

/* ─────────────── Staff & kitchen performance ─────────────── */

function StaffTab({ r }: { r: ReportBundle }) {
  type S = ReportBundle['staff'][number]
  const cols: Column<S>[] = [
    { key: 'name', header: 'Staff', sortable: true, render: (s) => <div><p className="font-medium text-slate-900">{s.name}</p><p className="text-xs text-slate-500">{s.role} · {s.branch}</p></div> },
    { key: 'orders', header: 'Orders', align: 'right', sortable: true },
    { key: 'avgTicket', header: 'Avg ticket', align: 'right', sortable: true, render: (s) => formatCurrency(s.avgTicket) },
    { key: 'upsell', header: 'Upsell %', align: 'right', sortable: true, render: (s) => `${s.upsell}%` },
    { key: 'rating', header: 'Guest rating', align: 'right', sortable: true, render: (s) => <span className="font-medium text-amber-600">★ {s.rating}</span> },
  ]
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card title="Staff leaderboard" flush><DataTable columns={cols} data={r.staff} rowKey={(s) => s.name} /></Card>
      <Card title="Kitchen station speed" subtitle="Average prep minutes vs target">
        <ChartBox height={280}>
          <BarChart data={r.kitchen}>
            <CartesianGrid {...chartGrid} vertical={false} />
            <XAxis dataKey="station" {...chartAxis} tick={{ fontSize: 11 }} interval={0} />
            <YAxis {...chartAxis} unit="m" />
            <Tooltip {...chartTooltip} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="avgPrep" name="Avg prep (min)" radius={[4, 4, 0, 0]}>
              {r.kitchen.map((k) => <Cell key={k.station} fill={k.avgPrep > k.target ? '#ef4444' : chartColors[2]} />)}
            </Bar>
            <Bar dataKey="target" name="Target" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartBox>
      </Card>
    </div>
  )
}

/* ─────────────── Customer & marketing insights ─────────────── */

function CustomersTab({ r }: { r: ReportBundle }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="Customer mix">
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <ChartBox height={220} className="sm:w-1/2">
            <PieChart>
              <Pie data={r.customerMix} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                {r.customerMix.map((_, i) => <Cell key={i} fill={chartColors[i + 4]} />)}
              </Pie>
              <Tooltip {...chartTooltip} formatter={(v) => `${v}%`} />
            </PieChart>
          </ChartBox>
          <ul className="w-full space-y-2 text-sm sm:w-1/2">
            {r.customerMix.map((c, i) => <li key={c.name} className="flex items-center justify-between"><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: chartColors[i + 4] }} />{c.name}</span><b>{c.value}%</b></li>)}
            <li className="border-t border-slate-100 pt-2 text-xs text-slate-500">Repeat rate 46% · NPS 58</li>
          </ul>
        </div>
      </Card>
      <Card title="Marketing ROI by channel">
        <ChartBox height={240}>
          <BarChart data={r.marketingRoi}>
            <CartesianGrid {...chartGrid} vertical={false} />
            <XAxis dataKey="channel" {...chartAxis} tick={{ fontSize: 11 }} interval={0} />
            <YAxis {...chartAxis} tickFormatter={(v: number) => formatCurrency(v, { compact: true })} />
            <Tooltip {...chartTooltip} formatter={money} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="spend" name="Spend" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
            <Bar dataKey="revenue" name="Attributed revenue" fill={chartColors[1]} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartBox>
      </Card>
    </div>
  )
}

/* ─────────────── Branch profitability ─────────────── */

function BranchesTab({ r }: { r: ReportBundle }) {
  const best = [...r.branches].sort((a, b) => b.margin - a.margin)[0]
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {r.branches.map((b) => (
          <div key={b.branch} className={cn('rounded-xl border bg-white p-5 shadow-sm', b.branch === best.branch ? 'border-brand-300 ring-2 ring-brand-100' : 'border-slate-200')}>
            <div className="flex items-center justify-between"><p className="text-lg font-semibold text-slate-900">{b.branch}</p>{b.branch === best.branch && <Badge tone="orange">🏆 Top margin</Badge>}</div>
            <p className="mt-2 text-2xl font-bold">{formatCurrency(b.revenue, { compact: true })}</p>
            <p className={cn('text-xs font-semibold', b.growth >= 0 ? 'text-emerald-600' : 'text-red-600')}>{b.growth >= 0 ? '▲' : '▼'} {Math.abs(b.growth)}% growth</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg bg-slate-50 py-2"><p className="font-semibold text-slate-900">{formatCurrency(b.profit, { compact: true })}</p><p className="text-slate-500">profit</p></div>
              <div className="rounded-lg bg-slate-50 py-2"><p className="font-semibold text-slate-900">{b.margin}%</p><p className="text-slate-500">margin</p></div>
              <div className="rounded-lg bg-slate-50 py-2"><p className="font-semibold text-slate-900">★ {b.rating}</p><p className="text-slate-500">rating</p></div>
            </div>
          </div>
        ))}
      </div>
      <Card title="Branch comparison — revenue, cost & profit">
        <ChartBox height={280}>
          <BarChart data={r.branches}>
            <CartesianGrid {...chartGrid} vertical={false} />
            <XAxis dataKey="branch" {...chartAxis} />
            <YAxis {...chartAxis} tickFormatter={(v: number) => formatCurrency(v, { compact: true })} />
            <Tooltip {...chartTooltip} formatter={money} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="revenue" name="Revenue" fill={chartColors[0]} radius={[4, 4, 0, 0]} />
            <Bar dataKey="cost" name="Cost" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
            <Bar dataKey="profit" name="Profit" fill={chartColors[2]} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartBox>
      </Card>
    </div>
  )
}

/* ─────────────── AI forecasting & natural-language reporting ─────────────── */

interface Answer {
  q: string
  text: string
  chart: ReactElement
}

function AskTab({ r }: { r: ReportBundle }) {
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [answers, setAnswers] = useState<Answer[]>([])
  const suggestions = ['How did sales trend this month?', 'Which menu dish is most profitable?', 'What inventory should I reorder?', 'Which branch delivers fastest?']

  const chartFor = (prompt: string): ReactElement => {
    if (/stock|inventory|reorder|ingredient/i.test(prompt))
      return (
        <BarChart data={[{ n: 'Basmati', v: 6, min: 40 }, { n: 'Chicken', v: 9, min: 30 }, { n: 'Cream', v: 4, min: 12 }]}>
          <XAxis dataKey="n" {...chartAxis} /><YAxis {...chartAxis} /><Tooltip {...chartTooltip} />
          <Bar dataKey="v" name="On hand" fill="#ef4444" radius={[4, 4, 0, 0]} /><Bar dataKey="min" name="Reorder level" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
        </BarChart>
      )
    if (/menu|dish|price|profit/i.test(prompt))
      return (
        <BarChart data={r.topItems.slice(0, 5)} layout="vertical">
          <XAxis type="number" {...chartAxis} hide /><YAxis type="category" dataKey="name" {...chartAxis} width={120} tick={{ fontSize: 11 }} /><Tooltip {...chartTooltip} formatter={money} />
          <Bar dataKey="revenue" name="Revenue" fill={chartColors[1]} radius={[0, 4, 4, 0]} />
        </BarChart>
      )
    if (/branch|deliver|rider/i.test(prompt))
      return (
        <BarChart data={r.branches}>
          <XAxis dataKey="branch" {...chartAxis} /><YAxis {...chartAxis} unit="%" /><Tooltip {...chartTooltip} />
          <Bar dataKey="margin" name="Margin %" fill={chartColors[2]} radius={[4, 4, 0, 0]} />
        </BarChart>
      )
    return (
      <AreaChart data={r.salesDaily.map((d) => ({ d: d.d, total: d.dineIn + d.delivery + d.takeaway }))}>
        <XAxis dataKey="d" {...chartAxis} minTickGap={24} /><YAxis {...chartAxis} tickFormatter={(v: number) => formatCurrency(v, { compact: true })} /><Tooltip {...chartTooltip} formatter={money} />
        <Area type="monotone" dataKey="total" name="Sales" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.15} strokeWidth={2} />
      </AreaChart>
    )
  }

  const ask = async (text: string) => {
    const prompt = text.trim()
    if (!prompt || busy) return
    setBusy(true)
    setQ('')
    const res = await askCopilot(prompt, 'restaurant')
    setAnswers((a) => [{ q: prompt, text: res.text, chart: chartFor(prompt) }, ...a])
    setBusy(false)
  }

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="space-y-4 xl:col-span-2">
        <div className="rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 p-5 text-white shadow-lg shadow-violet-600/20">
          <p className="flex items-center gap-2 font-semibold"><Sparkles size={18} /> Ask your data</p>
          <p className="mt-1 text-sm text-white/80">Ask any question in plain English — the AI queries sales, inventory, staff and customer data for you.</p>
          <form onSubmit={(e) => { e.preventDefault(); void ask(q) }} className="mt-4 flex gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. How did sales trend this month?" className="h-11 min-w-0 flex-1 rounded-xl border-0 bg-white/95 px-4 text-sm text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-white/60 focus:outline-none" />
            <Button type="submit" variant="secondary" size="lg" icon={Send} loading={busy} className="h-11">Ask</Button>
          </form>
          <div className="mt-3 flex flex-wrap gap-2">
            {suggestions.map((s) => <button key={s} type="button" onClick={() => ask(s)} className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium hover:bg-white/25">{s}</button>)}
          </div>
        </div>
        {busy && <LoadingState label="Analysing your data…" />}
        {answers.length === 0 && !busy && <p className="py-8 text-center text-sm text-slate-400">Your answers will appear here with an auto-generated chart.</p>}
        {answers.map((a, i) => (
          <Card key={i} title={a.q} subtitle="AI answer · generated from live data">
            <p className="text-sm leading-relaxed text-slate-700">{a.text}</p>
            <ChartBox height={200} className="mt-4">{a.chart}</ChartBox>
          </Card>
        ))}
      </div>
      <AIInsights
        title="AI Forecasts"
        subtitle="Next 7 days"
        insights={[
          { title: 'Weekend covers +38%', detail: 'Friday & Saturday dinner forecast 1.4× normal at Downtown — cricket match + payday.', severity: 'opportunity', metric: '1.4×' },
          { title: 'Airport margin below target', detail: 'High rent (27% of revenue) and low evening traffic. Consider a 24/7 grab-and-go menu.', severity: 'warning', metric: '10.4%' },
          { title: 'Seafood food cost 41%', detail: 'Prawn Masala is under-priced by ~$1.50 vs target cost.', severity: 'critical', metric: '+5.2 pts' },
          { title: 'Monthly revenue on track', detail: 'Projected to close October at $229k (+3.4% MoM).', severity: 'success', metric: '$229k' },
        ]}
      />
    </div>
  )
}
