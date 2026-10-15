import { CircleSlash, Hourglass, PackageX, PackagePlus, Power, Send, TriangleAlert, Utensils, Volume2, Zap } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { alertStyle, fmtHours } from '@/apps/kitchen/components/alertStyle'
import { Badge, Button, Card, DataTable, EmptyState, LoadingState, PageHeader, ProgressBar, StatCard, Tabs, useToast } from '@/shared/components/ui'
import type { Column } from '@/shared/components/ui'
import { useKitchen } from '@/apps/kitchen/context/KitchenContext'
import { cn } from '@/shared/lib/cn'
import { timeAgo } from '@/shared/lib/format'
import type { AlertLevel, StockAlert } from '@/apps/kitchen/services/kitchen'
import { hoursOfStock } from '@/apps/kitchen/services/kitchen'
import type { Ingredient } from '@/shared/services/operations'
import { createPurchaseOrder } from '@/shared/services/operations'

type Filter = 'all' | AlertLevel

export default function StockAlerts() {
  const notify = useToast()
  const navigate = useNavigate()
  const { loading, alerts, ingredients, unavailable, setItemAvailable, markIngredientOut, deductions, agent } = useKitchen()
  const [filter, setFilter] = useState<Filter>('all')
  const [requested, setRequested] = useState<Set<string>>(new Set())

  if (loading) return <LoadingState label="Loading stock levels…" />

  const count = (l: AlertLevel) => alerts.filter((a) => a.level === l).length
  const shown = alerts.filter((a) => filter === 'all' || a.level === filter)

  const requestRestock = async (a: StockAlert) => {
    await createPurchaseOrder({ supplier: a.ingredient.supplier, lines: [{ ingredient: a.ingredient.name, qty: a.suggestedOrder }] })
    setRequested((s) => new Set(s).add(a.ingredient.id))
    notify(`Restock request sent to manager: ${a.suggestedOrder} ${a.ingredient.unit} ${a.ingredient.name} from ${a.ingredient.supplier}`)
  }

  const columns: Column<Ingredient>[] = [
    {
      key: 'name',
      header: 'Ingredient',
      sortable: true,
      render: (i) => (
        <span className="flex items-center gap-2 font-medium text-slate-800">
          <span>{i.emoji}</span>
          {i.name}
        </span>
      ),
    },
    { key: 'storage', header: 'Storage', render: (i) => <span className="text-slate-500">{i.storage}</span> },
    {
      key: 'stock',
      header: 'On hand',
      sortable: true,
      render: (i) => (
        <div className="w-40">
          <p className="text-sm font-semibold text-slate-800">
            {i.stock} <span className="font-normal text-slate-500">/ {i.par} {i.unit}</span>
          </p>
          <ProgressBar value={i.stock} max={i.par} tone={i.stock <= i.reorderPoint / 2 ? 'red' : i.stock <= i.reorderPoint ? 'yellow' : 'green'} className="mt-1" />
        </div>
      ),
    },
    {
      key: 'hours',
      header: 'Lasts',
      sortable: true,
      sortValue: (i) => hoursOfStock(i),
      render: (i) => {
        const h = hoursOfStock(i)
        return <span className={cn('text-sm', h < 4 ? 'font-semibold text-red-600' : h < 12 ? 'text-amber-700' : 'text-slate-600')}>~{fmtHours(h)}</span>
      },
    },
    { key: 'usage', header: 'Use / day', render: (i) => <span className="text-slate-600">{i.usagePerDay} {i.unit}</span> },
    { key: 'updatedAt', header: 'Updated', render: (i) => <span className="text-xs text-slate-500">{timeAgo(i.updatedAt)}</span> },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        icon={TriangleAlert}
        title="Stock Alerts"
        description="Stock drops automatically from recipes each time an order is marked ready, so there is nothing to type in."
        actions={
          <Button icon={PackagePlus} onClick={() => navigate('/kitchen/stock')}>
            Add stock
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Out of stock" value={count('out')} icon={PackageX} tone={count('out') ? 'red' : 'green'} hint="menu items auto switched off" />
        <StatCard label="Critical" value={count('critical')} icon={Hourglass} tone="amber" hint="runs out in under 4 hours" />
        <StatCard label="Low" value={count('low')} icon={TriangleAlert} tone="blue" hint="below reorder point" />
        <StatCard label="Menu items off" value={unavailable.size} icon={CircleSlash} tone="slate" hint="hidden from POS & online" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card
          title="Live alerts"
          subtitle="Sorted by urgency, with run-out time based on today's pace"
          flush
          actions={
            <Tabs
              variant="pills"
              value={filter}
              onChange={setFilter}
              items={[
                { id: 'all', label: 'All', count: alerts.length },
                { id: 'out', label: 'Out', count: count('out') },
                { id: 'critical', label: 'Critical', count: count('critical') },
                { id: 'low', label: 'Low', count: count('low') },
                { id: 'expiring', label: 'Expiring', count: count('expiring') },
              ]}
            />
          }
        >
          {shown.length === 0 ? (
            <EmptyState icon={TriangleAlert} title="No alerts here" description="Everything in this group is stocked." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {shown.map((a) => {
                const st = alertStyle[a.level]
                const i = a.ingredient
                return (
                  <li key={i.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                    <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-xl', st.chip)}>{i.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900">{i.name}</span>
                        <Badge tone={st.tone} dot>
                          {st.label}
                        </Badge>
                        {a.level !== 'out' && a.level !== 'expiring' && <span className="text-xs text-slate-500">runs out in ~{fmtHours(a.hoursLeft)}</span>}
                      </p>
                      <p className="mt-0.5 text-sm text-slate-600">{a.message}</p>
                      <div className="mt-2 flex items-center gap-3">
                        <ProgressBar value={i.stock} max={i.par} tone={a.level === 'out' || a.level === 'critical' ? 'red' : 'yellow'} className="max-w-56 flex-1" />
                        <span className="text-xs text-slate-500">
                          {i.stock}/{i.par} {i.unit}
                        </span>
                      </div>
                      {a.affectedItems.length > 0 && (
                        <p className="mt-2 flex flex-wrap items-center gap-1 text-xs text-slate-500">
                          <Utensils size={12} /> Affects:
                          {a.affectedItems.map((m) => (
                            <span key={m.id} className={cn('rounded-md px-1.5 py-0.5', unavailable.has(m.name) ? 'bg-slate-100 text-slate-400 line-through' : 'bg-slate-100 text-slate-700')}>
                              {m.emoji} {m.name}
                            </span>
                          ))}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-stretch">
                      <Button
                        size="sm"
                        variant={requested.has(i.id) ? 'ghost' : 'primary'}
                        icon={Send}
                        disabled={requested.has(i.id) || a.level === 'expiring'}
                        onClick={() => void requestRestock(a)}
                      >
                        {requested.has(i.id) ? 'Requested' : `Request ${a.suggestedOrder} ${i.unit}`}
                      </Button>
                      <div className="flex gap-2">
                        {a.level !== 'out' && (
                          <Button size="sm" variant="outline" icon={PackageX} onClick={() => (markIngredientOut(i.id), notify(`${i.name} marked out — dependent menu items switched off`, 'info'))}>
                            Mark out
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={Volume2}
                          aria-label="Announce"
                          title={agent.state === 'off' ? 'Start the voice agent to hear this' : 'Announce in kitchen'}
                          onClick={() => agent.say({ ur: a.spoken.ur, roman: a.message, en: a.spoken.en })}
                        />
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          <Card title="Switched-off menu items" subtitle="Turned off automatically when an ingredient runs out" flush>
            {unavailable.size === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-slate-500">All menu items are available.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {[...unavailable].map((name) => (
                  <li key={name} className="flex items-center gap-2 px-5 py-2.5 text-sm">
                    <CircleSlash size={14} className="text-red-500" />
                    <span className="flex-1 text-slate-700">{name}</span>
                    <Button size="xs" variant="outline" icon={Power} onClick={() => (setItemAvailable(name, true), notify(`${name} is back on the menu`))}>
                      Turn on
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Auto-deducted from orders" subtitle="Recipe usage taken off stock when tickets are marked ready" flush>
            {deductions.length === 0 ? (
              <p className="flex flex-col items-center gap-2 px-5 py-6 text-center text-sm text-slate-500">
                <Zap size={18} className="text-violet-500" />
                Mark an order ready on the KDS (or say "1058 ready") and its ingredients come off stock here.
              </p>
            ) : (
              <ul className="scrollbar-thin max-h-80 divide-y divide-slate-100 overflow-y-auto">
                {deductions.map((d) => (
                  <li key={d.id} className="px-5 py-3 text-sm">
                    <p className="flex justify-between">
                      <span className="font-semibold text-slate-800">Order #{d.orderNo}</span>
                      <span className="text-xs text-slate-400">{timeAgo(d.at)}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">{d.lines.map((l) => `${l.ingredient} −${l.qty}`).join(' · ')}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <Card title="All stock levels" subtitle="Updated live as orders are cooked and stock is received" flush>
        <DataTable columns={columns} data={ingredients} rowKey={(i) => i.id} searchKeys={['name']} searchPlaceholder="Search ingredient…" pageSize={10} />
      </Card>
    </div>
  )
}
