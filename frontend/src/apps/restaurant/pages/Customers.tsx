import { Award, Gift, Heart, MessageSquareWarning, Plus, Send, Sparkles, Star, Target, TrendingDown, UserPlus, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, Tooltip, XAxis, YAxis } from 'recharts'
import type { Column } from '@/shared/components/ui'
import {
  AIInsights,
  Avatar,
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
  SectionTitle,
  Select,
  StatCard,
  StatusBadge,
  Tabs,
  Toggle,
  useToast,
} from '@/shared/components/ui'
import { ChartBox, KpiGrid, Stars } from '@/apps/restaurant/components/business'
import { useAsync } from '@/shared/hooks/useAsync'
import { chartAxis, chartColors, chartGrid, chartTooltip } from '@/shared/lib/chart'
import { cn } from '@/shared/lib/cn'
import { daysFromNow, formatCurrency, formatDate, formatNumber, timeAgo } from '@/shared/lib/format'
import type { Customer, Feedback, GiftCard, LoyaltyTier, Offer } from '@/apps/restaurant/services/business'
import {
  BRANCHES,
  TIERS,
  adjustPoints,
  createCustomer,
  createOffer,
  getCustomers,
  getFeedback,
  getGiftCards,
  getMemberships,
  getOffers,
  getRewards,
  getSegments,
  issueGiftCard,
  updateFeedback,
} from '@/apps/restaurant/services/business'

type TabId = 'profiles' | 'loyalty' | 'memberships' | 'feedback' | 'segments' | 'ai'

const tierTone: Record<LoyaltyTier, 'orange' | 'gray' | 'yellow' | 'purple'> = { Bronze: 'orange', Silver: 'gray', Gold: 'yellow', Platinum: 'purple' }

function TierBadge({ tier }: { tier: LoyaltyTier }) {
  return <Badge tone={tierTone[tier]}>{TIERS.find((t) => t.tier === tier)?.emoji} {tier}</Badge>
}

export default function Customers() {
  const [tab, setTab] = useState<TabId>('profiles')
  const cust = useAsync(getCustomers)
  const fb = useAsync(getFeedback)
  const [addOpen, setAddOpen] = useState(false)
  const [offerOpen, setOfferOpen] = useState(false)
  const offers = useAsync(getOffers)

  const c = cust.data ?? []
  const avgRating = fb.data ? fb.data.reduce((a, f) => a + f.rating, 0) / fb.data.length : 0

  return (
    <div>
      <PageHeader
        icon={Heart}
        title="Customers & Loyalty"
        description="Guest profiles, loyalty tiers, memberships, feedback and AI-driven retention."
        actions={
          <>
            <Button variant="outline" icon={Target} onClick={() => setOfferOpen(true)}>New offer</Button>
            <Button icon={UserPlus} onClick={() => setAddOpen(true)}>Add customer</Button>
          </>
        }
      />
      <KpiGrid>
        <StatCard label="Total customers" value={formatNumber(4180 + c.length)} icon={Users} tone="blue" delta={5.6} deltaLabel="this month" />
        <StatCard label="Loyalty members" value="2,964" icon={Award} tone="purple" delta={8.1} hint={`${c.filter((x) => x.tier === 'Platinum').length} Platinum in list`} />
        <StatCard label="Avg rating" value={avgRating ? `${avgRating.toFixed(1)} ★` : '—'} icon={Star} tone="amber" delta={2.4} />
        <StatCard label="At churn risk" value={c.filter((x) => x.churnRisk >= 60).length} icon={TrendingDown} tone="red" hint="high risk (≥ 60%)" />
      </KpiGrid>

      <Tabs<TabId>
        className="mb-5"
        value={tab}
        onChange={setTab}
        items={[
          { id: 'profiles', label: 'Profiles & History', icon: Users },
          { id: 'loyalty', label: 'Loyalty & Rewards', icon: Award },
          { id: 'memberships', label: 'Memberships & Gift Cards', icon: Gift },
          { id: 'feedback', label: 'Feedback & Complaints', icon: MessageSquareWarning, count: fb.data?.filter((f) => f.status === 'New').length },
          { id: 'segments', label: 'Segments & Offers', icon: Target },
          { id: 'ai', label: 'AI Retention', icon: Sparkles },
        ]}
      />

      {cust.loading || !cust.data ? (
        <LoadingState />
      ) : (
        <>
          {tab === 'profiles' && <ProfilesTab customers={cust.data} setCustomers={cust.setData} />}
          {tab === 'loyalty' && <LoyaltyTab customers={cust.data} />}
          {tab === 'memberships' && <MembershipsTab />}
          {tab === 'feedback' && (fb.data ? <FeedbackTab data={fb.data} setData={fb.setData} /> : <LoadingState />)}
          {tab === 'segments' && <SegmentsTab offers={offers.data ?? []} onNew={() => setOfferOpen(true)} />}
          {tab === 'ai' && <AITab customers={cust.data} />}
        </>
      )}

      <AddCustomerModal open={addOpen} onClose={() => setAddOpen(false)} onCreate={(x) => cust.setData((d) => [x, ...(d ?? [])])} />
      <OfferModal open={offerOpen} onClose={() => setOfferOpen(false)} onCreate={(o) => { offers.setData((d) => [o, ...(d ?? [])]); setTab('segments') }} />
    </div>
  )
}

/* ─────────────── Profiles & order history ─────────────── */

function ProfilesTab({ customers, setCustomers }: { customers: Customer[]; setCustomers: (fn: (d: Customer[] | undefined) => Customer[] | undefined) => void }) {
  const notify = useToast()
  const [tier, setTier] = useState('')
  const [selected, setSelected] = useState<Customer | null>(null)
  const rows = tier ? customers.filter((c) => c.tier === tier) : customers

  const give = async (c: Customer, delta: number) => {
    const next = { ...c, points: c.points + delta }
    setCustomers((d) => d?.map((x) => (x.id === c.id ? next : x)))
    setSelected(next)
    await adjustPoints(c.id, delta)
    notify(`${delta > 0 ? 'Added' : 'Redeemed'} ${Math.abs(delta)} points for ${c.name}`)
  }

  const columns: Column<Customer>[] = [
    { key: 'name', header: 'Customer', sortable: true, render: (c) => <div className="flex items-center gap-3"><Avatar name={c.name} /><div className="min-w-0"><p className="font-medium text-slate-900">{c.name}</p><p className="text-xs text-slate-500">{c.phone}</p></div></div> },
    { key: 'tier', header: 'Tier', render: (c) => <TierBadge tier={c.tier} /> },
    { key: 'points', header: 'Points', sortable: true, align: 'right', render: (c) => formatNumber(c.points) },
    { key: 'visits', header: 'Visits', sortable: true, align: 'right' },
    { key: 'totalSpend', header: 'Lifetime spend', sortable: true, align: 'right', render: (c) => formatCurrency(c.totalSpend) },
    { key: 'favourite', header: 'Favourite' },
    { key: 'lastVisit', header: 'Last visit', sortable: true, render: (c) => timeAgo(c.lastVisit) },
    { key: 'segment', header: 'Segment', render: (c) => <Badge tone={c.segment === 'At-risk' ? 'red' : 'blue'}>{c.segment}</Badge> },
  ]

  return (
    <>
      <Card flush>
        <DataTable columns={columns} data={rows} rowKey={(c) => c.id} searchKeys={['name', 'phone', 'email', 'favourite']} searchPlaceholder="Search by name, phone, email…" onRowClick={setSelected} pageSize={10} toolbar={<Select className="h-9 w-40" value={tier} onChange={(e) => setTier(e.target.value)} options={TIERS.map((t) => t.tier)} placeholder="All tiers" />} />
      </Card>
      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.name}
        description={selected ? `${selected.id} · member since ${formatDate(selected.joined)}` : ''}
        width="max-w-xl"
        footer={selected && <><Button variant="outline" onClick={() => give(selected, -150)} disabled={selected.points < 150}>Redeem 150 pts</Button><Button icon={Plus} onClick={() => give(selected, 100)}>Add 100 pts</Button></>}
      >
        {selected && (
          <div className="space-y-6">
            <div className={cn('rounded-2xl bg-gradient-to-br p-5 text-white shadow-lg', TIERS.find((t) => t.tier === selected.tier)?.gradient)}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold tracking-widest uppercase opacity-80">Spice Club · {selected.tier}</p>
                <span className="text-2xl">{TIERS.find((t) => t.tier === selected.tier)?.emoji}</span>
              </div>
              <p className="mt-4 text-3xl font-bold">{formatNumber(selected.points)} <span className="text-base font-medium opacity-80">pts</span></p>
              <p className="mt-1 text-sm opacity-90">{selected.name}</p>
              {(() => {
                const next = TIERS.find((t) => t.min > selected.points)
                return next ? <p className="mt-3 text-xs opacity-90">{formatNumber(next.min - selected.points)} pts to {next.tier}</p> : <p className="mt-3 text-xs opacity-90">Top tier reached 🎉</p>
              })()}
            </div>
            <DescriptionList
              items={[
                { label: 'Email', value: selected.email },
                { label: 'Phone', value: selected.phone },
                { label: 'Home branch', value: selected.branch },
                { label: 'Membership', value: selected.membership ?? '—' },
                { label: 'Visits', value: selected.visits },
                { label: 'Average order', value: formatCurrency(selected.avgOrder) },
                { label: 'Favourite dish', value: selected.favourite },
                { label: 'Churn risk', value: <span className={selected.churnRisk >= 60 ? 'font-semibold text-red-600' : 'text-slate-800'}>{selected.churnRisk}%</span> },
              ]}
            />
            <div className="flex flex-wrap gap-1.5">{selected.tags.map((t) => <Badge key={t} tone="blue">{t}</Badge>)}</div>
            <div>
              <SectionTitle>Order history</SectionTitle>
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {selected.orders.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                    <div className="min-w-0"><p className="font-medium text-slate-800">{o.id} · <span className="font-normal text-slate-500">{o.channel}</span></p><p className="truncate text-xs text-slate-500">{o.items} · {o.branch}</p></div>
                    <div className="text-right"><p className="font-medium">{formatCurrency(o.total)}</p><p className="text-xs text-slate-400">{formatDate(o.date)}</p></div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Drawer>
    </>
  )
}

/* ─────────────── Loyalty points & rewards ─────────────── */

function LoyaltyTab({ customers }: { customers: Customer[] }) {
  const notify = useToast()
  const { data: rewards, setData } = useAsync(getRewards)
  const tierCounts = TIERS.map((t) => ({ ...t, count: customers.filter((c) => c.tier === t.tier).length * 148 }))

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tierCounts.map((t) => (
          <div key={t.tier} className={cn('rounded-xl bg-gradient-to-br p-5 text-white shadow-sm', t.gradient)}>
            <div className="flex items-center justify-between"><p className="text-lg font-semibold">{t.tier}</p><span className="text-2xl">{t.emoji}</span></div>
            <p className="mt-2 text-3xl font-bold">{formatNumber(t.count)}</p>
            <p className="text-xs opacity-90">members · from {formatNumber(t.min)} pts</p>
            <p className="mt-3 text-xs leading-relaxed opacity-95">{t.perks}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Rewards catalog" subtitle="Members redeem points in-store, in-app and on the QR menu" className="lg:col-span-2" actions={<Button size="sm" variant="outline" icon={Plus} onClick={() => notify('Reward builder opened', 'info')}>Add reward</Button>}>
          {!rewards ? (
            <LoadingState />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {rewards.map((r) => (
                <div key={r.id} className={cn('flex items-center gap-3 rounded-xl border p-3', r.active ? 'border-slate-200' : 'border-dashed border-slate-200 opacity-60')}>
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-2xl">{r.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900">{r.name}</p>
                    <p className="text-xs text-slate-500">{formatNumber(r.cost)} pts · {r.redeemed} redeemed</p>
                  </div>
                  <Toggle checked={r.active} onChange={(v) => { setData((d) => d?.map((x) => (x.id === r.id ? { ...x, active: v } : x))); notify(`${r.name} ${v ? 'enabled' : 'disabled'}`) }} />
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card title="Points economy (30 days)">
          <div className="space-y-4">
            {[
              { l: 'Points issued', v: 184200, tone: 'brand' as const },
              { l: 'Points redeemed', v: 96400, tone: 'green' as const },
              { l: 'Points expired', v: 8100, tone: 'red' as const },
            ].map((m) => (
              <div key={m.l}><div className="mb-1 flex justify-between text-sm"><span className="text-slate-600">{m.l}</span><span className="font-semibold">{formatNumber(m.v)}</span></div><ProgressBar value={m.v} max={184200} tone={m.tone} /></div>
            ))}
            <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">Redemption rate <b>52%</b> · Liability <b>{formatCurrency(4380)}</b> (1 pt = $0.0125)</p>
          </div>
        </Card>
      </div>
    </div>
  )
}

/* ─────────────── Memberships & gift cards ─────────────── */

function MembershipsTab() {
  const notify = useToast()
  const plans = useAsync(getMemberships)
  const cards = useAsync(getGiftCards)
  const [open, setOpen] = useState(false)
  const [gf, setGf] = useState({ holder: '', amount: 50 })

  const issue = async () => {
    const code = `SRK-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
    const g: GiftCard = { id: `GC-${Date.now()}`, code, holder: gf.holder, initial: gf.amount, balance: gf.amount, issued: new Date().toISOString(), expires: daysFromNow(365), status: 'Active' }
    cards.setData((d) => [g, ...(d ?? [])])
    await issueGiftCard(g)
    notify(`Gift card ${code} issued to ${gf.holder}`)
    setOpen(false)
  }

  const cols: Column<GiftCard>[] = [
    { key: 'code', header: 'Card', render: (g) => <span className="font-mono text-xs font-semibold text-slate-800">{g.code}</span> },
    { key: 'holder', header: 'Holder', sortable: true },
    { key: 'balance', header: 'Balance', align: 'right', sortable: true, render: (g) => <div className="w-32 text-right"><p className="font-medium">{formatCurrency(g.balance)} <span className="text-xs text-slate-400">/ {formatCurrency(g.initial)}</span></p><ProgressBar value={g.balance} max={g.initial} tone="green" className="mt-1" /></div> },
    { key: 'issued', header: 'Issued', render: (g) => formatDate(g.issued) },
    { key: 'expires', header: 'Expires', render: (g) => formatDate(g.expires) },
    { key: 'status', header: 'Status', render: (g) => <StatusBadge status={g.status} /> },
  ]

  return (
    <div className="space-y-6">
      {plans.loading ? <LoadingState /> : (
        <div className="grid gap-4 md:grid-cols-3">
          {plans.data?.map((p) => (
            <div key={p.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className={cn('bg-gradient-to-r p-4 text-white', p.color)}>
                <p className="font-semibold">{p.name}</p>
                <p className="mt-1 text-2xl font-bold">{formatCurrency(p.price)}<span className="text-sm font-medium opacity-80">/{p.period}</span></p>
              </div>
              <div className="p-4">
                <ul className="space-y-1.5 text-sm text-slate-600">{p.benefits.map((b) => <li key={b}>✓ {b}</li>)}</ul>
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-sm"><span className="text-slate-500">Active members</span><span className="font-semibold text-slate-900">{p.members}</span></div>
              </div>
            </div>
          ))}
        </div>
      )}
      <Card title="Gift cards" subtitle="Digital & physical gift cards redeemable at all branches" flush actions={<Button size="sm" icon={Gift} onClick={() => setOpen(true)}>Issue gift card</Button>}>
        <DataTable columns={cols} data={cards.data ?? []} loading={cards.loading} rowKey={(g) => g.id} searchKeys={['code', 'holder']} />
      </Card>
      <Modal open={open} onClose={() => setOpen(false)} title="Issue gift card" size="sm" footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={issue} disabled={!gf.holder}>Issue</Button></>}>
        <div className="space-y-4">
          <Field label="Recipient" required><Input value={gf.holder} onChange={(e) => setGf({ ...gf, holder: e.target.value })} placeholder="Customer or company name" /></Field>
          <Field label="Amount"><Select value={String(gf.amount)} onChange={(e) => setGf({ ...gf, amount: Number(e.target.value) })} options={['25', '50', '100', '250', '500'].map((v) => ({ value: v, label: formatCurrency(Number(v)) }))} /></Field>
          <div className="rounded-xl bg-gradient-to-br from-ink-900 to-brand-700 p-5 text-white">
            <p className="text-xs tracking-widest uppercase opacity-70">Spice Route Kitchen · Gift card</p>
            <p className="mt-4 text-3xl font-bold">{formatCurrency(gf.amount)}</p>
            <p className="mt-1 text-sm opacity-80">{gf.holder || 'Recipient name'}</p>
          </div>
        </div>
      </Modal>
    </div>
  )
}

/* ─────────────── Feedback & complaints ─────────────── */

const sentimentTone = { Positive: 'green', Neutral: 'gray', Negative: 'red' } as const

function FeedbackTab({ data, setData }: { data: Feedback[]; setData: (fn: (d: Feedback[] | undefined) => Feedback[] | undefined) => void }) {
  const notify = useToast()
  const [sentiment, setSentiment] = useState('')
  const rows = sentiment ? data.filter((f) => f.sentiment === sentiment) : data
  const dist = [5, 4, 3, 2, 1].map((r) => ({ r: `${r}★`, n: data.filter((f) => f.rating === r).length }))
  const pie = (['Positive', 'Neutral', 'Negative'] as const).map((s) => ({ name: s, value: data.filter((f) => f.sentiment === s).length }))

  const setStatus = async (f: Feedback, status: Feedback['status']) => {
    const next = { ...f, status }
    setData((d) => d?.map((x) => (x.id === f.id ? next : x)))
    await updateFeedback(next)
    notify(status === 'Resolved' ? `Complaint ${f.id} resolved — apology & voucher sent` : `${f.id} assigned to branch manager`)
  }

  const cols: Column<Feedback>[] = [
    { key: 'customer', header: 'Guest', render: (f) => <div className="flex items-center gap-2"><Avatar name={f.customer} size="sm" /><div><p className="font-medium text-slate-900">{f.customer}</p><p className="text-xs text-slate-500">{f.channel} · {f.branch}</p></div></div> },
    { key: 'rating', header: 'Rating', sortable: true, render: (f) => <Stars value={f.rating} /> },
    { key: 'comment', header: 'Comment', className: 'min-w-[240px]', render: (f) => <div><p className="text-sm text-slate-700">“{f.comment}”</p><p className="mt-0.5 text-xs text-slate-400">{f.topic} · {timeAgo(f.createdAt)}</p></div> },
    { key: 'sentiment', header: 'Sentiment', render: (f) => <Badge tone={sentimentTone[f.sentiment]} dot>{f.sentiment}</Badge> },
    { key: 'status', header: 'Status', render: (f) => <StatusBadge status={f.status} /> },
    { key: 'act', header: '', render: (f) => f.status !== 'Resolved' && <div className="flex gap-1">{f.status === 'New' && <Button size="xs" variant="outline" onClick={() => setStatus(f, 'In Progress')}>Assign</Button>}<Button size="xs" variant="success" onClick={() => setStatus(f, 'Resolved')}>Resolve</Button></div> },
  ]

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Rating distribution">
          <ChartBox height={200}>
            <BarChart data={dist} layout="vertical" margin={{ left: 0 }}>
              <CartesianGrid {...chartGrid} horizontal={false} />
              <XAxis type="number" {...chartAxis} allowDecimals={false} />
              <YAxis type="category" dataKey="r" {...chartAxis} width={36} />
              <Tooltip {...chartTooltip} />
              <Bar dataKey="n" name="Reviews" fill={chartColors[3]} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ChartBox>
        </Card>
        <Card title="Sentiment (AI-classified)">
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <ChartBox height={200} className="sm:w-1/2">
              <PieChart>
                <Pie data={pie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3}>
                  {pie.map((p) => <Cell key={p.name} fill={p.name === 'Positive' ? '#10b981' : p.name === 'Neutral' ? '#94a3b8' : '#ef4444'} />)}
                </Pie>
                <Tooltip {...chartTooltip} />
              </PieChart>
            </ChartBox>
            <ul className="w-full space-y-2 text-sm sm:w-1/2">
              {pie.map((p) => <li key={p.name} className="flex justify-between"><Badge tone={sentimentTone[p.name]} dot>{p.name}</Badge><span className="font-semibold">{Math.round((p.value / data.length) * 100)}%</span></li>)}
              <li className="pt-2 text-xs text-slate-500">Top complaint topics: Delivery time, Billing, Portion size</li>
            </ul>
          </div>
        </Card>
      </div>
      <Card flush>
        <DataTable columns={cols} data={rows} rowKey={(f) => f.id} searchKeys={['customer', 'comment', 'topic']} toolbar={<Select className="h-9 w-40" value={sentiment} onChange={(e) => setSentiment(e.target.value)} options={['Positive', 'Neutral', 'Negative']} placeholder="All sentiment" />} />
      </Card>
    </div>
  )
}

/* ─────────────── Segmentation & offers ─────────────── */

function SegmentsTab({ offers, onNew }: { offers: Offer[]; onNew: () => void }) {
  const notify = useToast()
  const { data: segments } = useAsync(getSegments)
  const offerCols: Column<Offer>[] = [
    { key: 'name', header: 'Offer', render: (o) => <span className="font-medium text-slate-900">{o.name}</span> },
    { key: 'segment', header: 'Segment' },
    { key: 'discount', header: 'Discount' },
    { key: 'channel', header: 'Channel' },
    { key: 'redemptions', header: 'Redemptions', align: 'right', sortable: true, render: (o) => formatNumber(o.redemptions) },
    { key: 'endsAt', header: 'Ends', render: (o) => formatDate(o.endsAt) },
    { key: 'status', header: 'Status', render: (o) => <StatusBadge status={o.status} /> },
  ]
  return (
    <div className="space-y-6">
      {!segments ? <LoadingState /> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {segments.map((s) => (
            <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} /><p className="font-semibold text-slate-900">{s.name}</p></div>
              <p className="mt-1 text-xs text-slate-500">{s.description}</p>
              <div className="mt-3 flex items-end justify-between">
                <div><p className="text-2xl font-semibold">{formatNumber(s.size)}</p><p className="text-xs text-slate-500">guests · avg {formatCurrency(s.avgSpend)}</p></div>
                <Button size="xs" variant="outline" icon={Send} onClick={() => notify(`Campaign queued for ${s.name} (${s.size} guests)`)}>Target</Button>
              </div>
              {s.offer && <p className="mt-3 rounded-md bg-brand-50 px-2 py-1 text-xs text-brand-700">Current offer: {s.offer}</p>}
            </div>
          ))}
        </div>
      )}
      <Card title="Offers" flush actions={<Button size="sm" icon={Plus} onClick={onNew}>New offer</Button>}>
        <DataTable columns={offerCols} data={offers} rowKey={(o) => o.id} searchKeys={['name', 'segment']} />
      </Card>
    </div>
  )
}

/* ─────────────── AI personalization & retention ─────────────── */

function AITab({ customers }: { customers: Customer[] }) {
  const notify = useToast()
  const atRisk = useMemo(() => [...customers].sort((a, b) => b.churnRisk - a.churnRisk).slice(0, 8), [customers])
  const [sent, setSent] = useState<string[]>([])

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <Card title="Churn-risk watchlist" subtitle="Predicted probability of not returning in 60 days" className="xl:col-span-2" flush actions={<Button size="sm" variant="ai" icon={Sparkles} onClick={() => { setSent(atRisk.filter((c) => c.churnRisk >= 60).map((c) => c.id)); notify('Personalised win-back offers sent to high-risk guests') }}>Win back all high-risk</Button>}>
        <ul className="divide-y divide-slate-100">
          {atRisk.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <Avatar name={c.name} />
              <div className="min-w-[140px] flex-1">
                <p className="font-medium text-slate-900">{c.name} <TierBadge tier={c.tier} /></p>
                <p className="text-xs text-slate-500">Last visit {timeAgo(c.lastVisit)} · loves {c.favourite}</p>
              </div>
              <div className="w-36">
                <div className="mb-1 flex justify-between text-xs"><span className="text-slate-500">Risk</span><span className={cn('font-semibold', c.churnRisk >= 60 ? 'text-red-600' : c.churnRisk >= 30 ? 'text-amber-600' : 'text-emerald-600')}>{c.churnRisk}%</span></div>
                <ProgressBar value={c.churnRisk} tone={c.churnRisk >= 60 ? 'red' : c.churnRisk >= 30 ? 'yellow' : 'green'} />
              </div>
              {sent.includes(c.id) ? <Badge tone="green">Offer sent</Badge> : <Button size="xs" variant="outline" onClick={() => { setSent((s) => [...s, c.id]); notify(`Sent “Free ${c.favourite} on your next visit” to ${c.name}`) }}>Send offer</Button>}
            </li>
          ))}
        </ul>
      </Card>
      <div className="space-y-6">
        <AIInsights
          title="AI Personalization"
          subtitle="Sentiment, retention & next-best-offer"
          onAction={(i) => notify(`${i.action}: queued`, 'success')}
          insights={[
            { title: 'Delivery complaints driving churn', detail: '62% of negative reviews this week mention delivery time at Downtown. Guests who complain about delivery are 3.1× more likely to churn.', severity: 'warning', metric: '3.1× risk', action: 'Alert delivery team' },
            { title: 'Personalised dish recommendations', detail: '1,240 guests who order Butter Chicken also love Garlic Naan + Mango Lassi. Show as a bundle in-app.', severity: 'opportunity', metric: '+$2.1 AOV', action: 'Create bundle' },
            { title: '18 Gold members near Platinum', detail: 'A “double points weekend” nudge would push 11 of them over the threshold.', severity: 'opportunity', metric: '11 upgrades', action: 'Schedule nudge' },
            { title: 'Retention improved', detail: '90-day repeat rate is 46% (+4 pts) since loyalty app launch.', severity: 'success', metric: '46%' },
          ]}
        />
        <Card title="Predicted lifetime value">
          <ul className="space-y-3 text-sm">
            {customers.slice(0, 5).map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3"><span className="flex items-center gap-2"><Avatar name={c.name} size="sm" />{c.name}</span><span className="font-semibold text-violet-700">{formatCurrency(c.totalSpend * 1.8 * (1 - c.churnRisk / 100) + c.totalSpend)}</span></li>
            ))}
          </ul>
        </Card>
      </div>
      <Card title="Sentiment trend" subtitle="Share of positive reviews by week" className="xl:col-span-3">
        <ChartBox height={200}>
          <BarChart data={['W35', 'W36', 'W37', 'W38', 'W39', 'W40', 'W41'].map((w, i) => ({ w, pos: [64, 68, 66, 71, 69, 74, 72][i], neg: [18, 15, 17, 12, 14, 10, 13][i] }))}>
            <CartesianGrid {...chartGrid} vertical={false} />
            <XAxis dataKey="w" {...chartAxis} />
            <YAxis {...chartAxis} unit="%" />
            <Tooltip {...chartTooltip} />
            <Bar dataKey="pos" name="Positive %" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="neg" name="Negative %" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartBox>
      </Card>
    </div>
  )
}

/* ─────────────── Modals ─────────────── */

function AddCustomerModal({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (c: Customer) => void }) {
  const notify = useToast()
  const [f, setF] = useState({ name: '', phone: '', email: '', branch: 'Downtown' })
  const save = async () => {
    const c: Customer = {
      id: `CUS-${2000 + Math.floor(Math.random() * 900)}`, name: f.name, phone: f.phone, email: f.email, tier: 'Bronze', points: 100, visits: 0, totalSpend: 0, avgOrder: 0,
      lastVisit: new Date().toISOString(), favourite: '—', segment: 'New', churnRisk: 20, joined: new Date().toISOString(), branch: f.branch as Customer['branch'], tags: ['New'], orders: [],
    }
    onCreate(c)
    await createCustomer(c)
    notify(`${c.name} enrolled in Spice Club with 100 welcome points`)
    onClose()
    setF({ name: '', phone: '', email: '', branch: 'Downtown' })
  }
  return (
    <Modal open={open} onClose={onClose} title="Add customer" description="Customers are auto-enrolled in Spice Club (Bronze)." footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={!f.name || !f.phone}>Add customer</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" required className="sm:col-span-2"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Phone" required><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+92 3xx xxx xxxx" /></Field>
        <Field label="Email"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Home branch" className="sm:col-span-2"><Select value={f.branch} onChange={(e) => setF({ ...f, branch: e.target.value })} options={[...BRANCHES]} /></Field>
      </div>
    </Modal>
  )
}

function OfferModal({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (o: Offer) => void }) {
  const notify = useToast()
  const [f, setF] = useState({ name: '', segment: 'At-risk', discount: '15%', channel: 'SMS + WhatsApp', days: 14 })
  const save = async () => {
    const o: Offer = { id: `OF-${Date.now()}`, name: f.name, segment: f.segment, discount: f.discount, channel: f.channel, redemptions: 0, status: 'Scheduled', endsAt: daysFromNow(f.days) }
    onCreate(o)
    await createOffer(o)
    notify(`Offer “${o.name}” scheduled for ${o.segment}`)
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title="Create targeted offer" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={!f.name}>Create offer</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Offer name" required className="sm:col-span-2"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Free dessert on your birthday" /></Field>
        <Field label="Segment"><Select value={f.segment} onChange={(e) => setF({ ...f, segment: e.target.value })} options={['VIP Regulars', 'Family Diners', 'Lunch Office Crowd', 'Delivery Lovers', 'Weekend Feasters', 'Expats & Tourists', 'At-risk', 'All members']} /></Field>
        <Field label="Discount"><Select value={f.discount} onChange={(e) => setF({ ...f, discount: e.target.value })} options={['10%', '15%', '20%', '25%', '$5 off', 'Free item', '2× points']} /></Field>
        <Field label="Channel"><Select value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value })} options={['SMS + WhatsApp', 'Email', 'App push', 'App + Email', 'Social']} /></Field>
        <Field label="Duration (days)"><Input type="number" min={1} value={f.days} onChange={(e) => setF({ ...f, days: Number(e.target.value) })} /></Field>
      </div>
    </Modal>
  )
}
