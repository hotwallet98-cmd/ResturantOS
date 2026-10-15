import { Check, Copy, Download, Edit3, Globe, Megaphone, Plus, QrCode, RefreshCw, Smartphone, Sparkles, Tag, UtensilsCrossed, Wand2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts'
import type { Column } from '@/shared/components/ui'
import {
  AIInsights,
  Badge,
  Button,
  Card,
  Checkbox,
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
  Textarea,
  Toggle,
  useToast,
} from '@/shared/components/ui'
import { ChartBox, EmojiTile, KpiGrid, MockQR } from '@/apps/restaurant/components/business'
import { useAsync } from '@/shared/hooks/useAsync'
import { chartAxis, chartColors, chartGrid, chartTooltip } from '@/shared/lib/chart'
import { cn } from '@/shared/lib/cn'
import { daysFromNow, formatCurrency, formatDate, formatNumber, timeAgo } from '@/shared/lib/format'
import type { DigitalPromo, OnlineMenuItem, PublishTarget } from '@/apps/restaurant/services/business'
import {
  createDigitalPromo,
  getDigitalPromos,
  getMenuSuggestions,
  getOnlineMenu,
  getPublishTargets,
  menuChannelPerformance,
  syncChannel,
  updateOnlineMenuItem,
} from '@/apps/restaurant/services/business'

type TabId = 'editor' | 'publish' | 'sync' | 'pricing' | 'promos' | 'ai'
const CHANNELS = ['Website', 'QR Menu', 'Mobile App', 'Foodpanda', 'Careem', 'Uber Eats']

export default function OnlineMenu() {
  const [tab, setTab] = useState<TabId>('editor')
  const menu = useAsync(getOnlineMenu)
  const targets = useAsync(getPublishTargets)
  const promos = useAsync(getDigitalPromos)
  const notify = useToast()
  const [editing, setEditing] = useState<OnlineMenuItem | null>(null)

  const items = menu.data ?? []
  const save = async (item: OnlineMenuItem, msg?: string) => {
    menu.setData((d) => (d?.some((x) => x.id === item.id) ? d.map((x) => (x.id === item.id ? item : x)) : [...(d ?? []), item]))
    targets.setData((d) => d?.map((t) => (t.sync === 'Synced' ? { ...t, sync: 'Out of sync' } : t)))
    await updateOnlineMenuItem(item)
    if (msg) notify(msg)
  }

  const publishAll = async () => {
    targets.setData((d) => d?.map((t) => ({ ...t, sync: 'Syncing' })))
    await Promise.all((targets.data ?? []).map((t) => syncChannel(t.id)))
    setTimeout(() => {
      targets.setData((d) => d?.map((t) => ({ ...t, sync: 'Synced', status: 'Published', lastSync: new Date().toISOString(), items: items.filter((i) => i.channels.includes(t.name)).length })))
      notify('Menu published to all 6 channels')
    }, 900)
  }

  return (
    <div>
      <PageHeader
        icon={Globe}
        title="Online Menu"
        description="Build your digital menu once and publish it everywhere — website, QR, app and delivery platforms."
        actions={
          <>
            <Button variant="outline" icon={Plus} onClick={() => setEditing({ id: `OM-${Date.now()}`, name: '', category: 'Mains', emoji: '🍽️', description: '', price: 0, available: true, featured: false, tags: [], channels: [...CHANNELS] })}>
              Add item
            </Button>
            <Button icon={RefreshCw} onClick={publishAll}>Publish everywhere</Button>
          </>
        }
      />
      <KpiGrid>
        <StatCard label="Live menu items" value={`${items.filter((i) => i.available).length}/${items.length}`} icon={UtensilsCrossed} tone="brand" />
        <StatCard label="Channels in sync" value={`${targets.data?.filter((t) => t.sync === 'Synced').length ?? 0}/${targets.data?.length ?? 6}`} icon={RefreshCw} tone="green" />
        <StatCard label="Online orders today" value={formatNumber(targets.data?.reduce((a, t) => a + t.ordersToday, 0) ?? 0)} icon={Smartphone} tone="blue" delta={9.4} />
        <StatCard label="QR scans today" value="612" icon={QrCode} tone="purple" delta={14.2} />
      </KpiGrid>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <Tabs<TabId>
            className="mb-5"
            value={tab}
            onChange={setTab}
            items={[
              { id: 'editor', label: 'Menu Builder', icon: Edit3 },
              { id: 'publish', label: 'Website / QR / App', icon: QrCode },
              { id: 'sync', label: 'Channel Sync', icon: RefreshCw, count: targets.data?.filter((t) => t.sync !== 'Synced').length },
              { id: 'pricing', label: 'Price & Availability', icon: Tag },
              { id: 'promos', label: 'Promotions', icon: Megaphone },
              { id: 'ai', label: 'AI Content', icon: Sparkles },
            ]}
          />
          {menu.loading || targets.loading ? (
            <LoadingState />
          ) : (
            <>
              {tab === 'editor' && <EditorTab items={items} onEdit={setEditing} />}
              {tab === 'publish' && <PublishTab targets={targets.data ?? []} />}
              {tab === 'sync' && <SyncTab targets={targets.data ?? []} setTargets={targets.setData} items={items} />}
              {tab === 'pricing' && <PricingTab items={items} onSave={save} />}
              {tab === 'promos' && <PromosTab promos={promos.data ?? []} loading={promos.loading} setPromos={promos.setData} />}
              {tab === 'ai' && <AITab items={items} onApply={(it, desc) => save({ ...it, description: desc }, `AI description applied to ${it.name}`)} />}
            </>
          )}
        </div>
        <div className="xl:sticky xl:top-20 xl:self-start">
          <PhonePreview items={items} />
        </div>
      </div>

      <ItemModal item={editing} onClose={() => setEditing(null)} onSave={(it) => { save(it, `${it.name} saved`); setEditing(null) }} />
    </div>
  )
}

/* ─────────────── Phone preview ─────────────── */

function PhonePreview({ items }: { items: OnlineMenuItem[] }) {
  const cats = useMemo(() => [...new Set(items.map((i) => i.category))], [items])
  const [cat, setCat] = useState<string>('All')
  const shown = items.filter((i) => cat === 'All' || i.category === cat)
  return (
    <div className="mx-auto w-full max-w-[300px]">
      <p className="mb-2 flex items-center justify-center gap-1.5 text-xs font-medium text-slate-500"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> Live preview</p>
      <div className="rounded-[2.5rem] bg-ink-900 p-2.5 shadow-2xl shadow-slate-900/30 ring-1 ring-slate-700">
        <div className="relative h-[560px] overflow-hidden rounded-[2rem] bg-slate-50">
          <div className="absolute top-2 left-1/2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-ink-900" />
          <div className="bg-gradient-to-br from-brand-600 to-amber-500 px-4 pt-10 pb-4 text-white">
            <p className="text-[10px] tracking-widest uppercase opacity-80">Order online</p>
            <p className="text-lg font-bold">Spice Route Kitchen</p>
            <p className="text-[11px] opacity-90">⭐ 4.7 · Pakistani · 25–35 min</p>
          </div>
          <div className="scrollbar-thin flex gap-1.5 overflow-x-auto px-3 py-2">
            {['All', ...cats].map((c) => (
              <button key={c} type="button" onClick={() => setCat(c)} className={cn('shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium', cat === c ? 'bg-ink-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200')}>
                {c}
              </button>
            ))}
          </div>
          <div className="scrollbar-thin h-[400px] space-y-2 overflow-y-auto px-3 pb-6">
            {shown.map((i) => (
              <div key={i.id} className={cn('flex gap-2.5 rounded-xl bg-white p-2.5 shadow-sm', !i.available && 'opacity-50')}>
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-50 to-brand-100 text-2xl">{i.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-1">
                    <p className="truncate text-[12px] font-semibold text-slate-900">{i.name}</p>
                    {i.featured && <span className="text-[10px]">⭐</span>}
                  </div>
                  <p className="line-clamp-2 text-[10px] leading-snug text-slate-500">{i.description || 'No description yet'}</p>
                  <div className="mt-1 flex items-center justify-between">
                    <p className="text-[12px] font-bold text-brand-700">
                      {i.promoPrice ? <><span className="mr-1 text-[10px] font-normal text-slate-400 line-through">{formatCurrency(i.price)}</span>{formatCurrency(i.promoPrice)}</> : formatCurrency(i.price)}
                    </p>
                    {i.available ? <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-[12px] text-white">+</span> : <span className="text-[10px] font-medium text-red-500">Sold out</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─────────────── Digital menu creation ─────────────── */

function EditorTab({ items, onEdit }: { items: OnlineMenuItem[]; onEdit: (i: OnlineMenuItem) => void }) {
  const cats = [...new Set(items.map((i) => i.category))]
  return (
    <div className="space-y-5">
      {cats.map((c) => (
        <Card key={c} title={c} subtitle={`${items.filter((i) => i.category === c).length} items`} flush>
          <ul className="divide-y divide-slate-100">
            {items.filter((i) => i.category === c).map((i) => (
              <li key={i.id} className="flex items-center gap-3 px-5 py-3">
                <EmojiTile emoji={i.emoji} className="h-11 w-11 text-2xl" />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 font-medium text-slate-900">
                    {i.name}
                    {i.featured && <Badge tone="orange">Featured</Badge>}
                    {!i.available && <Badge tone="red">Unavailable</Badge>}
                    {i.tags.map((t) => <Badge key={t}>{t}</Badge>)}
                  </p>
                  <p className="truncate text-xs text-slate-500">{i.description}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">On {i.channels.length}/6 channels</p>
                </div>
                <p className="text-sm font-semibold text-slate-900">{formatCurrency(i.promoPrice ?? i.price)}</p>
                <Button size="xs" variant="ghost" icon={Edit3} onClick={() => onEdit(i)}>Edit</Button>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  )
}

/* ─────────────── Website / QR / app publishing ─────────────── */

function PublishTab({ targets }: { targets: PublishTarget[] }) {
  const notify = useToast()
  const [table, setTable] = useState('Table 7')
  const [branch, setBranch] = useState('Downtown')
  const owned = targets.filter((t) => t.kind === 'Owned')
  const url = `menu.restaurantos.app/spice-route/${branch.toLowerCase().replace(' ', '-')}?t=${table.split(' ')[1]}`
  return (
    <div className="space-y-6">
      <Card title="QR code menu" subtitle="Print per-table QR codes — guests scan to view the menu and order">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="mx-auto rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm sm:mx-0">
            <MockQR seed={url} size={168} />
            <p className="mt-2 text-xs font-semibold text-slate-800">Scan to order</p>
            <p className="text-[11px] text-slate-500">{branch} · {table}</p>
          </div>
          <div className="flex-1 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Branch"><Select value={branch} onChange={(e) => setBranch(e.target.value)} options={['Downtown', 'Mall Road', 'Airport']} /></Field>
              <Field label="Table"><Select value={table} onChange={(e) => setTable(e.target.value)} options={Array.from({ length: 20 }, (_, i) => `Table ${i + 1}`)} /></Field>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600"><span className="truncate font-mono">https://{url}</span></div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" icon={Copy} onClick={() => notify('Link copied', 'info')}>Copy link</Button>
              <Button size="sm" variant="outline" icon={Download} onClick={() => notify(`QR code for ${table} downloaded (PNG)`)}>Download PNG</Button>
              <Button size="sm" icon={Download} onClick={() => notify('Print sheet for all 20 tables generated (PDF)')}>Print all tables</Button>
            </div>
          </div>
        </div>
      </Card>
      <div className="grid gap-4 md:grid-cols-3">
        {owned.map((t) => (
          <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between"><span className="text-2xl">{t.emoji}</span><StatusBadge status={t.status} /></div>
            <p className="mt-2 font-semibold text-slate-900">{t.name}</p>
            <p className="truncate text-xs text-slate-500">{t.url}</p>
            <div className="mt-3 flex justify-between border-t border-slate-100 pt-3 text-xs text-slate-500"><span>{t.items} items</span><span>{t.ordersToday} orders today</span></div>
          </div>
        ))}
      </div>
      <Card title="Orders by channel today">
        <ChartBox height={220}>
          <BarChart data={menuChannelPerformance}>
            <CartesianGrid {...chartGrid} vertical={false} />
            <XAxis dataKey="channel" {...chartAxis} interval={0} tick={{ fontSize: 11 }} />
            <YAxis {...chartAxis} />
            <Tooltip {...chartTooltip} />
            <Bar dataKey="orders" name="Orders" fill={chartColors[0]} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartBox>
      </Card>
    </div>
  )
}

/* ─────────────── Multi-platform sync ─────────────── */

function SyncTab({ targets, setTargets, items }: { targets: PublishTarget[]; setTargets: (fn: (d: PublishTarget[] | undefined) => PublishTarget[] | undefined) => void; items: OnlineMenuItem[] }) {
  const notify = useToast()
  const sync = async (t: PublishTarget) => {
    setTargets((d) => d?.map((x) => (x.id === t.id ? { ...x, sync: 'Syncing' } : x)))
    await syncChannel(t.id)
    setTimeout(() => {
      setTargets((d) => d?.map((x) => (x.id === t.id ? { ...x, sync: 'Synced', status: 'Published', lastSync: new Date().toISOString(), items: items.filter((i) => i.channels.includes(t.name)).length } : x)))
      notify(`${t.name} synced — ${items.filter((i) => i.channels.includes(t.name)).length} items, prices & availability updated`)
    }, 900)
  }
  const syncTone = { Synced: 'green', 'Out of sync': 'yellow', Syncing: 'blue', Error: 'red' } as const
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {targets.map((t) => (
        <div key={t.id} className={cn('rounded-xl border bg-white p-4 shadow-sm', t.sync === 'Error' ? 'border-red-200' : 'border-slate-200')}>
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-2xl">{t.emoji}</span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900">{t.name} <span className="text-xs font-normal text-slate-400">· {t.kind}</span></p>
              <p className="truncate text-xs text-slate-500">{t.url}</p>
            </div>
            <Badge tone={syncTone[t.sync]} dot>{t.sync}</Badge>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-slate-50 py-2"><p className="text-sm font-semibold">{t.items}</p><p className="text-[11px] text-slate-500">items</p></div>
            <div className="rounded-lg bg-slate-50 py-2"><p className="text-sm font-semibold">{t.ordersToday}</p><p className="text-[11px] text-slate-500">orders</p></div>
            <div className="rounded-lg bg-slate-50 py-2"><p className="text-sm font-semibold">{timeAgo(t.lastSync)}</p><p className="text-[11px] text-slate-500">last sync</p></div>
          </div>
          {t.sync === 'Error' && <p className="mt-3 rounded-md bg-red-50 px-2 py-1.5 text-xs text-red-700">API token expired — reconnect the Careem merchant account.</p>}
          <div className="mt-4 flex justify-end">
            <Button size="sm" variant={t.sync === 'Synced' ? 'outline' : 'primary'} icon={RefreshCw} loading={t.sync === 'Syncing'} onClick={() => sync(t)}>Sync now</Button>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ─────────────── Price & availability ─────────────── */

function PricingTab({ items, onSave }: { items: OnlineMenuItem[]; onSave: (i: OnlineMenuItem, msg?: string) => void }) {
  const notify = useToast()
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [bulk, setBulk] = useState('0')
  const cols: Column<OnlineMenuItem>[] = [
    { key: 'name', header: 'Item', sortable: true, render: (i) => <span className="flex items-center gap-2"><span className="text-lg">{i.emoji}</span><span className="font-medium text-slate-900">{i.name}</span></span> },
    { key: 'category', header: 'Category', sortable: true },
    {
      key: 'price',
      header: 'Price',
      sortable: true,
      render: (i) => (
        <div className="flex items-center gap-1.5">
          <Input className="h-8 w-24" type="number" step={0.5} value={draft[i.id] ?? String(i.price)} onChange={(e) => setDraft({ ...draft, [i.id]: e.target.value })} />
          {draft[i.id] !== undefined && Number(draft[i.id]) !== i.price && (
            <Button size="xs" icon={Check} onClick={() => { onSave({ ...i, price: Number(draft[i.id]) }, `${i.name} price → ${formatCurrency(Number(draft[i.id]))} on all channels`); const n = { ...draft }; delete n[i.id]; setDraft(n) }}>Save</Button>
          )}
        </div>
      ),
    },
    { key: 'promoPrice', header: 'Promo', render: (i) => (i.promoPrice ? <Badge tone="pink">{formatCurrency(i.promoPrice)}</Badge> : <span className="text-slate-400">—</span>) },
    { key: 'available', header: 'Available', render: (i) => <Toggle checked={i.available} onChange={(v) => onSave({ ...i, available: v }, `${i.name} marked ${v ? 'available' : 'sold out'} everywhere`)} /> },
    { key: 'featured', header: 'Featured', render: (i) => <Toggle checked={i.featured} onChange={(v) => onSave({ ...i, featured: v })} /> },
  ]
  return (
    <Card flush>
      <DataTable
        columns={cols}
        data={items}
        rowKey={(i) => i.id}
        searchKeys={['name', 'category']}
        pageSize={10}
        toolbar={
          <div className="flex items-center gap-2">
            <Select className="h-9 w-36" value={bulk} onChange={(e) => setBulk(e.target.value)} options={[{ value: '0', label: 'Bulk adjust…' }, { value: '5', label: '+5% all' }, { value: '10', label: '+10% all' }, { value: '-5', label: '-5% all' }]} />
            <Button size="sm" variant="outline" disabled={bulk === '0'} onClick={() => { items.forEach((i) => onSave({ ...i, price: Math.round(i.price * (1 + Number(bulk) / 100) * 2) / 2 })); notify(`All prices adjusted ${Number(bulk) > 0 ? '+' : ''}${bulk}%`); setBulk('0') }}>Apply</Button>
          </div>
        }
      />
    </Card>
  )
}

/* ─────────────── Promotions ─────────────── */

function PromosTab({ promos, loading, setPromos }: { promos: DigitalPromo[]; loading: boolean; setPromos: (fn: (d: DigitalPromo[] | undefined) => DigitalPromo[] | undefined) => void }) {
  const notify = useToast()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ title: '', description: '', type: 'Discount' as DigitalPromo['type'], channels: ['Website', 'QR Menu', 'Mobile App'] })
  const save = async () => {
    const p: DigitalPromo = { id: `DP-${Date.now()}`, ...f, status: 'Scheduled', startsAt: daysFromNow(1), endsAt: daysFromNow(15), clicks: 0 }
    setPromos((d) => [p, ...(d ?? [])])
    await createDigitalPromo(p)
    notify(`Promotion “${p.title}” scheduled on ${p.channels.length} channels`)
    setOpen(false)
  }
  const typeEmoji = { Banner: '🖼️', Combo: '🍱', Discount: '🏷️', 'Happy hour': '⏰' }
  if (loading) return <LoadingState />
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button icon={Plus} onClick={() => setOpen(true)}>New promotion</Button></div>
      <div className="grid gap-4 md:grid-cols-2">
        {promos.map((p) => (
          <div key={p.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-3 bg-gradient-to-r from-brand-50 to-amber-50 px-4 py-3">
              <span className="text-2xl">{typeEmoji[p.type]}</span>
              <div className="min-w-0 flex-1"><p className="font-semibold text-slate-900">{p.title}</p><p className="text-xs text-slate-500">{p.type}</p></div>
              <StatusBadge status={p.status} />
            </div>
            <div className="space-y-3 p-4">
              <p className="text-sm text-slate-600">{p.description}</p>
              <div className="flex flex-wrap gap-1">{p.channels.map((c) => <Badge key={c} tone="blue">{c}</Badge>)}</div>
              <div className="flex justify-between text-xs text-slate-500"><span>{formatDate(p.startsAt)} → {formatDate(p.endsAt)}</span><span>{formatNumber(p.clicks)} clicks</span></div>
            </div>
          </div>
        ))}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="New digital promotion" footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} disabled={!f.title}>Schedule</Button></>}>
        <div className="space-y-4">
          <Field label="Title" required><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Weekend Biryani Feast" /></Field>
          <Field label="Type"><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as DigitalPromo['type'] })} options={['Discount', 'Combo', 'Banner', 'Happy hour']} /></Field>
          <Field label="Description"><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Show on</p>
            <div className="grid grid-cols-2 gap-2">
              {CHANNELS.map((c) => <Checkbox key={c} label={c} checked={f.channels.includes(c)} onChange={(v) => setF({ ...f, channels: v ? [...f.channels, c] : f.channels.filter((x) => x !== c) })} />)}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}

/* ─────────────── AI menu content & channel optimization ─────────────── */

function AITab({ items, onApply }: { items: OnlineMenuItem[]; onApply: (i: OnlineMenuItem, desc: string) => void }) {
  const { data, loading } = useAsync(getMenuSuggestions)
  const [applied, setApplied] = useState<string[]>([])
  const notify = useToast()
  if (loading || !data) return <LoadingState />
  return (
    <div className="space-y-6">
      <Card title={<span className="flex items-center gap-2"><Wand2 size={16} className="text-violet-600" /> AI-generated descriptions</span>} subtitle="Rewritten for appetite appeal and aggregator search ranking">
        <div className="space-y-4">
          {data.map((s) => {
            const item = items.find((i) => i.id === s.itemId)
            const done = applied.includes(s.id)
            return (
              <div key={s.id} className="rounded-xl border border-violet-100 bg-violet-50/30 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900">{item?.emoji} {s.item}</p>
                  <Badge tone="purple">{s.uplift}</Badge>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div><p className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Current</p><p className="mt-1 text-sm text-slate-500 line-through decoration-slate-300">{s.current}</p></div>
                  <div><p className="text-[11px] font-semibold tracking-wide text-violet-500 uppercase">Suggested</p><p className="mt-1 text-sm text-slate-800">{s.suggested}</p></div>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-slate-500">💡 {s.reason}</p>
                  {done ? <Badge tone="green">Applied</Badge> : (
                    <div className="flex gap-2">
                      <Button size="xs" variant="ghost" onClick={() => notify('Regenerating…', 'info')}>Regenerate</Button>
                      <Button size="xs" variant="ai" icon={Check} onClick={() => { if (item) onApply(item, s.suggested); setApplied([...applied, s.id]) }}>Apply</Button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </Card>
      <AIInsights
        title="AI Channel Optimization"
        subtitle="Per-channel pricing, placement & visibility"
        onAction={(i) => notify(`${i.action} — applied`)}
        insights={[
          { title: 'Raise aggregator prices 5%', detail: 'Foodpanda & Careem take 17% commission. A 5% channel uplift keeps margin parity with no measurable drop in conversion.', severity: 'opportunity', metric: '+$420/wk', action: 'Apply channel pricing' },
          { title: 'Feature Paneer Tikka on QR menu', detail: 'High margin, low visibility. QR guests convert 31% — best channel for discovery.', severity: 'opportunity', metric: '+14% orders', action: 'Feature item' },
          { title: 'Uber Eats store not live', detail: 'Store is pending verification for 6 days; competitors in Gulberg get ~60 orders/day there.', severity: 'warning', action: 'Contact Uber Eats' },
          { title: 'Hide Prawn Masala on delivery after 9 PM', detail: 'Seafood quality complaints spike for late deliveries.', severity: 'info', action: 'Create rule' },
        ]}
      />
    </div>
  )
}

/* ─────────────── Item modal ─────────────── */

function ItemModal({ item, onClose, onSave }: { item: OnlineMenuItem | null; onClose: () => void; onSave: (i: OnlineMenuItem) => void }) {
  const [f, setF] = useState<OnlineMenuItem | null>(item)
  const [prev, setPrev] = useState(item)
  if (item !== prev) {
    setPrev(item)
    setF(item)
  }
  if (!f) return null
  return (
    <Modal open={!!item} onClose={onClose} size="lg" title={f.name ? `Edit ${f.name}` : 'New menu item'} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={() => onSave(f)} disabled={!f.name}>Save item</Button></>}>
      <div className="grid gap-4 sm:grid-cols-[80px_1fr]">
        <Field label="Icon"><Input value={f.emoji} onChange={(e) => setF({ ...f, emoji: e.target.value })} className="text-center text-xl" /></Field>
        <Field label="Name" required><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Field label="Category"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} options={['Starters', 'Mains', 'Rice', 'Grill', 'Breads', 'Street Food', 'Desserts', 'Drinks']} /></Field>
        <Field label="Price ($)"><Input type="number" step={0.5} value={f.price} onChange={(e) => setF({ ...f, price: Number(e.target.value) })} /></Field>
        <Field label="Promo price ($)"><Input type="number" step={0.5} value={f.promoPrice ?? ''} onChange={(e) => setF({ ...f, promoPrice: e.target.value ? Number(e.target.value) : undefined })} /></Field>
      </div>
      <Field label="Description" className="mt-4"><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Toggle label="Available" checked={f.available} onChange={(v) => setF({ ...f, available: v })} />
        <Toggle label="Featured" checked={f.featured} onChange={(v) => setF({ ...f, featured: v })} />
      </div>
      <div className="mt-4">
        <p className="mb-2 text-sm font-medium text-slate-700">Publish to</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CHANNELS.map((c) => <Checkbox key={c} label={c} checked={f.channels.includes(c)} onChange={(v) => setF({ ...f, channels: v ? [...f.channels, c] : f.channels.filter((x) => x !== c) })} />)}
        </div>
      </div>
    </Modal>
  )
}
