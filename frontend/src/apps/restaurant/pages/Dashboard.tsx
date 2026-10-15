import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  Armchair,
  ArrowRight,
  Bike,
  CalendarClock,
  ChefHat,
  DollarSign,
  LayoutDashboard,
  Package,
  Plus,
  Receipt,
  ShoppingCart,
  Trophy,
  Users,
  UtensilsCrossed,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Area, CartesianGrid, ComposedChart, Cell, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AIPanel } from '@/shared/components/operations/AIPanel'
import { Avatar, Badge, Button, Card, LoadingState, PageHeader, ProgressBar, StatCard, StatusBadge } from '@/shared/components/ui'
import { useAuth } from '@/shared/context/AuthContext'
import { useAsync } from '@/shared/hooks/useAsync'
import { chartAxis, chartColors, chartGrid, chartTooltip } from '@/shared/lib/chart'
import { formatCurrency, formatNumber, timeAgo } from '@/shared/lib/format'
import {
  getDashboardSummary,
  getEmployees,
  getIngredients,
  getMenuItems,
  getOrders,
  getReservations,
  getStationLoads,
} from '@/shared/services/operations'

const modules: { to: string; label: string; desc: string; icon: LucideIcon; tone: string }[] = [
  { to: '/app/pos', label: 'Orders & POS', desc: 'Take orders, bill & split', icon: ShoppingCart, tone: 'bg-brand-50 text-brand-600' },
  { to: '/kitchen', label: 'Kitchen Portal', desc: 'KDS, voice agent, stock alerts', icon: ChefHat, tone: 'bg-amber-50 text-amber-600' },
  { to: '/app/menu', label: 'Menu & Recipes', desc: 'Items, costing, pricing', icon: UtensilsCrossed, tone: 'bg-emerald-50 text-emerald-600' },
  { to: '/app/tables', label: 'Tables', desc: 'Floor plan & bookings', icon: Armchair, tone: 'bg-sky-50 text-sky-600' },
  { to: '/app/inventory', label: 'Inventory', desc: 'Stock, wastage, reorder', icon: Package, tone: 'bg-violet-50 text-violet-600' },
  { to: '/app/delivery', label: 'Delivery', desc: 'Riders, zones, aggregators', icon: Bike, tone: 'bg-pink-50 text-pink-600' },
  { to: '/app/employees', label: 'Employees & HR', desc: 'Shifts, payroll, training', icon: Users, tone: 'bg-teal-50 text-teal-600' },
]

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export default function Dashboard() {
  const { user, branch } = useAuth()
  const navigate = useNavigate()
  const summary = useAsync(() => getDashboardSummary(branch), [branch])
  const orders = useAsync(getOrders)
  const stations = useAsync(getStationLoads)
  const stock = useAsync(getIngredients)
  const menu = useAsync(getMenuItems)
  const staff = useAsync(getEmployees)
  const bookings = useAsync(getReservations)

  const s = summary.data
  const restaurant = user?.restaurant?.name ?? 'Spice Route Kitchen'
  const live = (orders.data ?? []).filter((o) => ['New', 'Preparing', 'Ready', 'Out for delivery'].includes(o.status))
  const lowStock = (stock.data ?? []).filter((i) => i.stock <= i.reorderPoint).sort((a, b) => a.stock / a.par - b.stock / b.par)
  const topItems = [...(menu.data ?? [])].sort((a, b) => b.soldWeek * b.price - a.soldWeek * a.price).slice(0, 6)
  const onShift = (staff.data ?? []).filter((e) => ['Present', 'Late'].includes(e.attendance) && (branch === 'All branches' || e.branch === branch))
  const upcoming = (bookings.data ?? []).filter((r) => ['Confirmed', 'Pending'].includes(r.status)).sort((a, b) => a.time.localeCompare(b.time)).slice(0, 5)

  return (
    <div className="space-y-6">
      <PageHeader
        icon={LayoutDashboard}
        title={`${greeting()}, ${user?.name.split(' ')[0] ?? 'there'}`}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            {restaurant} · operations overview for <Badge tone="orange" dot>{branch}</Badge>
            <span className="text-slate-400">· today, {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
          </span>
        }
        actions={
          <>
            <Button variant="outline" icon={ChefHat} onClick={() => navigate('/kitchen')}>
              Open KDS
            </Button>
            <Button icon={Plus} onClick={() => navigate('/app/pos')}>
              New order
            </Button>
          </>
        }
      />

      {!s ? (
        <LoadingState />
      ) : (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatCard label="Today's sales" value={formatCurrency(s.sales)} icon={DollarSign} tone="brand" delta={s.salesDelta} deltaLabel="vs last Friday" />
          <StatCard label="Orders" value={formatNumber(s.orders)} icon={Receipt} tone="blue" delta={s.ordersDelta} deltaLabel="vs last Friday" />
          <StatCard label="Covers" value={formatNumber(s.covers)} icon={Users} tone="green" delta={s.coversDelta} deltaLabel="vs last Friday" />
          <StatCard label="Avg ticket" value={formatCurrency(s.avgTicket)} icon={Trophy} tone="purple" delta={s.avgTicketDelta} deltaLabel="vs last Friday" />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Sales by hour" subtitle="Today vs same day last week" className="xl:col-span-2">
          <div className="h-72">
            {s && (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={s.salesByHour} margin={{ left: -10, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chartColors[0]} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={chartColors[0]} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...chartGrid} vertical={false} />
                  <XAxis dataKey="h" {...chartAxis} />
                  <YAxis {...chartAxis} tickFormatter={(v: number) => formatCurrency(v, { compact: true })} />
                  <Tooltip {...chartTooltip} formatter={(v) => formatCurrency(Number(v))} />
                  <Area type="monotone" dataKey="today" name="Today" stroke={chartColors[0]} strokeWidth={2.5} fill="url(#salesFill)" />
                  <Line type="monotone" dataKey="lastWeek" name="Last week" stroke={chartColors[7]} strokeDasharray="4 4" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
        <Card title="Order channel mix" subtitle="Share of today's orders">
          {s && (
            <div className="flex flex-col items-center gap-4 sm:flex-row xl:flex-col">
              <div className="h-44 w-44 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={s.channelMix} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2} stroke="none">
                      {s.channelMix.map((_, i) => (
                        <Cell key={i} fill={chartColors[i % chartColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip {...chartTooltip} formatter={(v) => `${v}%`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="grid w-full grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {s.channelMix.map((c, i) => (
                  <li key={c.name} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: chartColors[i % chartColors.length] }} />
                    <span className="flex-1 truncate text-slate-600">{c.name}</span>
                    <span className="font-semibold text-slate-800">{c.value}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card
          title={
            <span className="inline-flex items-center gap-2">
              Live orders <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>
            </span>
          }
          subtitle={`${live.length} in progress`}
          actions={<Link to="/app/pos" className="text-sm font-medium text-brand-600 hover:text-brand-700">POS →</Link>}
          flush
        >
          <ul className="divide-y divide-slate-100">
            {live.slice(0, 7).map((o) => (
              <li key={o.id} className="flex items-center gap-3 px-5 py-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-700">#{o.number % 1000}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{o.table ? `Table ${o.table}` : o.customer}</p>
                  <p className="text-xs text-slate-500">
                    {o.type} · {o.channel} · {timeAgo(o.createdAt)}
                  </p>
                </div>
                <div className="text-right">
                  <StatusBadge status={o.status} />
                  <p className="mt-0.5 text-xs font-medium text-slate-600">{formatCurrency(o.total)}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Kitchen load" subtitle="Station capacity right now" actions={<Link to="/kitchen" className="text-sm font-medium text-brand-600 hover:text-brand-700">KDS →</Link>}>
          <ul className="space-y-4">
            {(stations.data ?? []).map((st) => {
              const pct = (st.activeItems / st.capacity) * 100
              return (
                <li key={st.station}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">
                      {st.station} <span className="font-normal text-slate-400">· {st.chef}</span>
                    </span>
                    <span className={pct >= 90 ? 'font-semibold text-red-600' : 'text-slate-500'}>
                      {st.activeItems}/{st.capacity} · {st.avgPrepMins.toFixed(1)}m
                    </span>
                  </div>
                  <ProgressBar value={pct} tone={pct >= 90 ? 'red' : pct >= 70 ? 'yellow' : 'green'} />
                </li>
              )
            })}
          </ul>
        </Card>

        <AIPanel module="dashboard" title="Central AI engine" subtitle="Top recommendations across all modules" />
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <Card title="Low-stock alerts" actions={<Link to="/app/inventory" className="text-sm font-medium text-brand-600">Inventory →</Link>} flush>
          <ul className="divide-y divide-slate-100">
            {lowStock.slice(0, 6).map((i) => (
              <li key={i.id} className="flex items-center gap-3 px-5 py-2.5">
                <span className="text-lg">{i.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{i.name}</p>
                  <ProgressBar value={i.stock} max={i.par} tone={i.stock / i.par < 0.25 ? 'red' : 'yellow'} className="mt-1" />
                </div>
                <span className="text-xs font-semibold whitespace-nowrap text-red-600">
                  {i.stock} {i.unit}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Top items" subtitle="Revenue · last 7 days" actions={<Link to="/app/menu" className="text-sm font-medium text-brand-600">Menu →</Link>} flush>
          <ol className="divide-y divide-slate-100">
            {topItems.map((it, idx) => (
              <li key={it.id} className="flex items-center gap-3 px-5 py-2.5">
                <span className="w-4 text-xs font-bold text-slate-400">{idx + 1}</span>
                <span className="text-lg">{it.emoji}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{it.name}</span>
                <span className="text-xs font-semibold text-slate-700">{formatCurrency(it.soldWeek * it.price, { compact: true })}</span>
              </li>
            ))}
          </ol>
        </Card>

        <Card title="Staff on shift" subtitle={`${onShift.length} clocked in`} actions={<Link to="/app/employees" className="text-sm font-medium text-brand-600">HR →</Link>} flush>
          <ul className="scrollbar-thin max-h-80 divide-y divide-slate-100 overflow-y-auto">
            {onShift.slice(0, 10).map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-5 py-2">
                <Avatar name={e.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{e.name}</p>
                  <p className="truncate text-xs text-slate-500">{e.role}</p>
                </div>
                <span className="text-right text-xs text-slate-500">
                  {e.attendance === 'Late' ? <Badge tone="yellow">Late</Badge> : `In ${e.checkIn}`}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Upcoming reservations" actions={<Link to="/app/tables" className="text-sm font-medium text-brand-600">Tables →</Link>} flush>
          <ul className="divide-y divide-slate-100">
            {upcoming.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-5 py-2.5">
                <span className="flex h-9 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-sky-50 text-sky-700">
                  <CalendarClock size={12} />
                  <span className="text-[11px] font-semibold">{new Date(r.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{r.guest}</p>
                  <p className="text-xs text-slate-500">
                    {r.party} guests · {r.table ?? r.area}
                  </p>
                </div>
                {r.noShowRisk > 0.4 ? (
                  <span title="AI no-show risk" className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
                    <AlertTriangle size={12} />
                    {Math.round(r.noShowRisk * 100)}%
                  </span>
                ) : (
                  <StatusBadge status={r.status} />
                )}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase">Operations modules</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
          {modules.map(({ to, label, desc, icon: Icon, tone }) => (
            <Link
              key={to}
              to={to}
              className="group flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tone}`}>
                <Icon size={19} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-800">{label}</span>
                <span className="block truncate text-xs text-slate-500">{desc}</span>
              </span>
              <ArrowRight size={15} className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
