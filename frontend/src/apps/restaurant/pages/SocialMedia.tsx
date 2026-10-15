import { BarChart3, CalendarDays, Check, ChevronLeft, ChevronRight, Eye, Heart, Link2, Megaphone, MessageCircle, PenSquare, Plus, Send, Share2, Sparkles, Users, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from 'recharts'
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
  ProgressBar,
  Select,
  StatCard,
  StatusBadge,
  Tabs,
  Textarea,
  Toggle,
  useToast,
} from '@/shared/components/ui'
import { ChartBox, KpiGrid } from '@/apps/restaurant/components/business'
import { useAsync } from '@/shared/hooks/useAsync'
import { chartAxis, chartColors, chartGrid, chartTooltip } from '@/shared/lib/chart'
import { cn } from '@/shared/lib/cn'
import { daysFromNow, formatCurrency, formatDate, formatNumber, timeAgo } from '@/shared/lib/format'
import type { Campaign, SocialAccount, SocialPlatform, SocialPost } from '@/apps/restaurant/services/business'
import {
  SOCIAL_PLATFORMS,
  connectSocialAccount,
  createCampaign,
  createSocialPost,
  engagementTrend,
  generateCaption,
  getCampaigns,
  getSocialAccounts,
  getSocialPosts,
  updateSocialPost,
} from '@/apps/restaurant/services/business'

type TabId = 'accounts' | 'campaigns' | 'composer' | 'calendar' | 'analytics' | 'ai'

function PlatformIcon({ platform, size = 'md' }: { platform: SocialPlatform; size?: 'sm' | 'md' | 'lg' }) {
  const p = SOCIAL_PLATFORMS.find((x) => x.id === platform)!
  return (
    <span
      title={platform}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br font-bold text-white',
        p.gradient,
        { sm: 'h-5 w-5 rounded-md text-[10px]', md: 'h-8 w-8 text-sm', lg: 'h-11 w-11 text-lg' }[size],
      )}
    >
      {p.glyph}
    </span>
  )
}

export default function SocialMedia() {
  const [tab, setTab] = useState<TabId>('composer')
  const accounts = useAsync(getSocialAccounts)
  const posts = useAsync(getSocialPosts)
  const campaigns = useAsync(getCampaigns)

  const followers = accounts.data?.filter((a) => a.connected).reduce((s, a) => s + a.followers, 0) ?? 0
  const published = posts.data?.filter((p) => p.status === 'Published') ?? []
  const reach = published.reduce((s, p) => s + p.reach, 0)
  const engagement = published.reduce((s, p) => s + p.likes + p.comments + p.shares, 0)

  return (
    <div>
      <PageHeader
        icon={Megaphone}
        title="Social Media & Marketing"
        description="Connect your channels, plan campaigns, publish everywhere at once and let AI write your captions."
        actions={
          <>
            <Button variant="outline" icon={CalendarDays} onClick={() => setTab('calendar')}>Content calendar</Button>
            <Button icon={PenSquare} onClick={() => setTab('composer')}>Create post</Button>
          </>
        }
      />
      <KpiGrid>
        <StatCard label="Total followers" value={formatNumber(followers, true)} icon={Users} tone="pink" delta={6.9} />
        <StatCard label="Reach (7 days)" value={formatNumber(reach, true)} icon={Eye} tone="blue" delta={22.4} />
        <StatCard label="Engagements" value={formatNumber(engagement, true)} icon={Heart} tone="red" delta={11.8} hint={reach ? `${((engagement / reach) * 100).toFixed(1)}% rate` : undefined} />
        <StatCard label="Awaiting approval" value={posts.data?.filter((p) => p.status === 'Pending').length ?? 0} icon={Check} tone="amber" hint="scheduled posts" />
      </KpiGrid>

      <Tabs<TabId>
        className="mb-5"
        value={tab}
        onChange={setTab}
        items={[
          { id: 'accounts', label: 'Accounts', icon: Link2 },
          { id: 'campaigns', label: 'Campaigns', icon: Megaphone },
          { id: 'composer', label: 'Publish Post', icon: PenSquare },
          { id: 'calendar', label: 'Schedule & Approvals', icon: CalendarDays, count: posts.data?.filter((p) => p.status === 'Pending').length },
          { id: 'analytics', label: 'Analytics', icon: BarChart3 },
          { id: 'ai', label: 'AI Studio', icon: Sparkles },
        ]}
      />

      {accounts.loading || posts.loading ? (
        <LoadingState />
      ) : (
        <>
          {tab === 'accounts' && <AccountsTab accounts={accounts.data ?? []} setAccounts={accounts.setData} />}
          {tab === 'campaigns' && <CampaignsTab campaigns={campaigns.data ?? []} loading={campaigns.loading} setCampaigns={campaigns.setData} />}
          {tab === 'composer' && (
            <Composer
              accounts={accounts.data ?? []}
              onCreate={(p) => {
                posts.setData((d) => [p, ...(d ?? [])])
                setTab('calendar')
              }}
            />
          )}
          {tab === 'calendar' && <CalendarTab posts={posts.data ?? []} setPosts={posts.setData} />}
          {tab === 'analytics' && <AnalyticsTab posts={posts.data ?? []} campaigns={campaigns.data ?? []} />}
          {tab === 'ai' && <AIStudio />}
        </>
      )}
    </div>
  )
}

/* ─────────────── Account integration ─────────────── */

function AccountsTab({ accounts, setAccounts }: { accounts: SocialAccount[]; setAccounts: (fn: (d: SocialAccount[] | undefined) => SocialAccount[] | undefined) => void }) {
  const notify = useToast()
  const toggle = async (a: SocialAccount) => {
    const next = { ...a, connected: !a.connected }
    setAccounts((d) => d?.map((x) => (x.platform === a.platform ? next : x)))
    await connectSocialAccount(next)
    notify(next.connected ? `${a.platform} connected via OAuth` : `${a.platform} disconnected`, next.connected ? 'success' : 'info')
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {accounts.map((a) => (
        <div key={a.platform} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <PlatformIcon platform={a.platform} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900">{a.platform}</p>
              <p className="truncate text-xs text-slate-500">{a.handle}</p>
            </div>
            <StatusBadge status={a.connected ? 'Connected' : 'Disconnected'} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-slate-50 p-3"><p className="text-lg font-semibold">{formatNumber(a.followers, true)}</p><p className="text-xs text-slate-500">followers</p></div>
            <div className="rounded-lg bg-slate-50 p-3"><p className={cn('text-lg font-semibold', a.growth >= 0 ? 'text-emerald-600' : 'text-red-600')}>{a.growth >= 0 ? '+' : ''}{a.growth}%</p><p className="text-xs text-slate-500">30-day growth</p></div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-slate-500">{a.lastPost ? `Last post ${timeAgo(a.lastPost)}` : 'No posts yet'}</p>
            <Button size="sm" variant={a.connected ? 'outline' : 'primary'} onClick={() => toggle(a)}>{a.connected ? 'Disconnect' : 'Connect'}</Button>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ─────────────── Content & campaign management ─────────────── */

function CampaignsTab({ campaigns, loading, setCampaigns }: { campaigns: Campaign[]; loading: boolean; setCampaigns: (fn: (d: Campaign[] | undefined) => Campaign[] | undefined) => void }) {
  const notify = useToast()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ name: '', objective: 'Orders' as Campaign['objective'], budget: 500, days: 14 })
  const save = async () => {
    const c: Campaign = { id: `CMP-${Date.now()}`, name: f.name, objective: f.objective, platforms: ['Instagram', 'Facebook'], budget: f.budget, spent: 0, reach: 0, clicks: 0, conversions: 0, status: 'Scheduled', startsAt: daysFromNow(1), endsAt: daysFromNow(f.days) }
    setCampaigns((d) => [c, ...(d ?? [])])
    await createCampaign(c)
    notify(`Campaign “${c.name}” created`)
    setOpen(false)
  }
  const cols: Column<Campaign>[] = [
    { key: 'name', header: 'Campaign', sortable: true, render: (c) => <div><p className="font-medium text-slate-900">{c.name}</p><p className="text-xs text-slate-500">{formatDate(c.startsAt)} – {formatDate(c.endsAt)}</p></div> },
    { key: 'objective', header: 'Objective', render: (c) => <Badge tone="blue">{c.objective}</Badge> },
    { key: 'platforms', header: 'Platforms', render: (c) => <div className="flex gap-1">{c.platforms.map((p) => <PlatformIcon key={p} platform={p} size="sm" />)}</div> },
    { key: 'budget', header: 'Budget used', render: (c) => <div className="w-32"><p className="mb-1 text-xs text-slate-600">{formatCurrency(c.spent)} / {formatCurrency(c.budget)}</p><ProgressBar value={c.spent} max={c.budget} tone={c.spent / c.budget > 0.9 ? 'red' : 'brand'} /></div> },
    { key: 'reach', header: 'Reach', align: 'right', sortable: true, render: (c) => formatNumber(c.reach, true) },
    { key: 'conversions', header: 'Conversions', align: 'right', sortable: true, render: (c) => formatNumber(c.conversions) },
    { key: 'cpa', header: 'Cost / conv.', align: 'right', render: (c) => (c.conversions ? formatCurrency(c.spent / c.conversions) : '—') },
    { key: 'status', header: 'Status', render: (c) => <StatusBadge status={c.status} /> },
  ]
  return (
    <>
      <Card flush>
        <DataTable columns={cols} data={campaigns} loading={loading} rowKey={(c) => c.id} searchKeys={['name', 'objective']} toolbar={<Button size="sm" icon={Plus} onClick={() => setOpen(true)}>New campaign</Button>} />
      </Card>
      <Modal open={open} onClose={() => setOpen(false)} title="New campaign" footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} disabled={!f.name}>Create</Button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Campaign name" required className="sm:col-span-2"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Winter Soup Season" /></Field>
          <Field label="Objective"><Select value={f.objective} onChange={(e) => setF({ ...f, objective: e.target.value as Campaign['objective'] })} options={['Awareness', 'Engagement', 'Orders', 'Footfall']} /></Field>
          <Field label="Budget ($)"><Input type="number" value={f.budget} onChange={(e) => setF({ ...f, budget: Number(e.target.value) })} /></Field>
          <Field label="Duration (days)"><Input type="number" value={f.days} onChange={(e) => setF({ ...f, days: Number(e.target.value) })} /></Field>
        </div>
      </Modal>
    </>
  )
}

/* ─────────────── Multi-platform composer ─────────────── */

const MEDIA = ['🍲', '🍛', '🍢', '🫓', '🥭', '👨‍🍳', '🎉', '🌯']

function Composer({ accounts, onCreate }: { accounts: SocialAccount[]; onCreate: (p: SocialPost) => void }) {
  const notify = useToast()
  const connected = accounts.filter((a) => a.connected).map((a) => a.platform)
  const [platforms, setPlatforms] = useState<SocialPlatform[]>(['Instagram', 'Facebook'])
  const [caption, setCaption] = useState('')
  const [media, setMedia] = useState('🍲')
  const [when, setWhen] = useState<'now' | 'schedule'>('schedule')
  const [date, setDate] = useState(() => new Date(Date.now() + 86_400_000).toISOString().slice(0, 16))
  const [needsApproval, setNeedsApproval] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [previewOn, setPreviewOn] = useState<SocialPlatform>('Instagram')

  const gen = async () => {
    setGenerating(true)
    setCaption(await generateCaption(caption))
    setGenerating(false)
  }

  const submit = async () => {
    const status: SocialPost['status'] = when === 'now' ? 'Published' : needsApproval ? 'Pending' : 'Scheduled'
    const p: SocialPost = { id: `SP-${Date.now()}`, caption, platforms, media, status, scheduledAt: when === 'now' ? new Date().toISOString() : new Date(date).toISOString(), author: 'You', likes: 0, comments: 0, shares: 0, reach: 0 }
    onCreate(p)
    await createSocialPost(p)
    notify(status === 'Published' ? `Published to ${platforms.join(', ')}` : status === 'Pending' ? 'Post sent for approval' : `Scheduled for ${formatDate(p.scheduledAt, true)}`)
    setCaption('')
  }

  const limit = platforms.includes('X') ? 280 : 2200

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card title="Compose" subtitle="One post, every platform">
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Publish to</p>
            <div className="flex flex-wrap gap-2">
              {SOCIAL_PLATFORMS.map((p) => {
                const on = platforms.includes(p.id)
                const disabled = !connected.includes(p.id)
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => setPlatforms(on ? platforms.filter((x) => x !== p.id) : [...platforms, p.id])}
                    className={cn('flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm transition-colors', on ? 'border-brand-300 bg-brand-50 text-brand-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50', disabled && 'cursor-not-allowed opacity-40')}
                    title={disabled ? 'Not connected' : undefined}
                  >
                    <PlatformIcon platform={p.id} size="sm" />
                    {p.id}
                    {on && <Check size={14} />}
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Caption</span>
              <Button size="xs" variant="ai" icon={Sparkles} loading={generating} onClick={gen}>{generating ? 'Writing…' : 'Generate caption'}</Button>
            </div>
            <Textarea rows={5} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="What's cooking? Describe the post or let AI write it for you…" />
            <p className={cn('mt-1 text-right text-xs', caption.length > limit ? 'text-red-600' : 'text-slate-400')}>{caption.length}/{limit}</p>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Media</p>
            <div className="flex flex-wrap gap-2">
              {MEDIA.map((m) => (
                <button key={m} type="button" onClick={() => setMedia(m)} className={cn('flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-amber-50 to-brand-100 text-2xl ring-2', media === m ? 'ring-brand-500' : 'ring-transparent')}>{m}</button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="When">
              <Select value={when} onChange={(e) => setWhen(e.target.value as 'now' | 'schedule')} options={[{ value: 'schedule', label: 'Schedule' }, { value: 'now', label: 'Publish now' }]} />
            </Field>
            {when === 'schedule' && <Field label="Date & time"><Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} /></Field>}
          </div>
          {when === 'schedule' && <Toggle label="Require manager approval" description="Post goes to the approval queue before it is scheduled" checked={needsApproval} onChange={setNeedsApproval} />}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button variant="ghost" onClick={() => notify('Draft saved', 'info')}>Save draft</Button>
            <Button icon={Send} disabled={!caption.trim() || platforms.length === 0 || caption.length > limit} onClick={submit}>{when === 'now' ? 'Publish now' : needsApproval ? 'Submit for approval' : 'Schedule'}</Button>
          </div>
        </div>
      </Card>

      <div>
        <div className="mb-3 flex flex-wrap gap-1">
          {platforms.map((p) => (
            <button key={p} type="button" onClick={() => setPreviewOn(p)} className={cn('rounded-full px-2.5 py-1 text-xs font-medium', previewOn === p ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600')}>{p}</button>
          ))}
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 px-3 py-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-amber-500 text-xs font-bold text-white">SR</span>
            <div className="flex-1"><p className="text-sm font-semibold">spiceroutekitchen</p><p className="text-[11px] text-slate-500">{platforms.includes(previewOn) ? previewOn : platforms[0] ?? 'Preview'} · Sponsored</p></div>
          </div>
          <div className={cn('flex items-center justify-center bg-gradient-to-br from-amber-100 via-brand-100 to-rose-100', previewOn === 'TikTok' ? 'aspect-[9/12]' : previewOn === 'X' ? 'aspect-video' : 'aspect-square')}>
            <span className="text-8xl drop-shadow-sm">{media}</span>
          </div>
          <div className="space-y-2 px-3 py-3">
            <div className="flex gap-3 text-slate-700"><Heart size={18} /><MessageCircle size={18} /><Share2 size={18} /></div>
            <p className="text-sm whitespace-pre-wrap text-slate-800"><b>spiceroutekitchen</b> {caption || <span className="text-slate-400">Your caption will appear here…</span>}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─────────────── Scheduling & approvals ─────────────── */

function CalendarTab({ posts, setPosts }: { posts: SocialPost[]; setPosts: (fn: (d: SocialPost[] | undefined) => SocialPost[] | undefined) => void }) {
  const notify = useToast()
  const [view, setView] = useState<'week' | 'month'>('week')
  const [offset, setOffset] = useState(0)

  const days = useMemo(() => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    if (view === 'week') {
      start.setDate(start.getDate() - ((start.getDay() + 6) % 7) + offset * 7)
      return Array.from({ length: 7 }, (_, i) => new Date(start.getTime() + i * 86_400_000))
    }
    start.setDate(1)
    start.setMonth(start.getMonth() + offset)
    const lead = (start.getDay() + 6) % 7
    const first = new Date(start.getTime() - lead * 86_400_000)
    return Array.from({ length: 35 }, (_, i) => new Date(first.getTime() + i * 86_400_000))
  }, [view, offset])

  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  const pending = posts.filter((p) => p.status === 'Pending')
  const decide = async (p: SocialPost, approve: boolean) => {
    const next = { ...p, status: (approve ? 'Scheduled' : 'Rejected') as SocialPost['status'] }
    setPosts((d) => d?.map((x) => (x.id === p.id ? next : x)))
    await updateSocialPost(next)
    notify(approve ? 'Post approved & scheduled' : 'Post rejected — author notified', approve ? 'success' : 'info')
  }
  const statusColor: Record<SocialPost['status'], string> = { Published: 'border-emerald-300 bg-emerald-50', Scheduled: 'border-sky-300 bg-sky-50', Pending: 'border-amber-300 bg-amber-50', Draft: 'border-slate-200 bg-slate-50', Rejected: 'border-red-200 bg-red-50 line-through opacity-60' }
  const month = days[view === 'month' ? 10 : 0]

  return (
    <div className="space-y-6">
      {pending.length > 0 && (
        <Card title="Awaiting approval" subtitle="Posts need a manager's OK before going live">
          <div className="grid gap-3 md:grid-cols-2">
            {pending.map((p) => (
              <div key={p.id} className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50/40 p-3">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-white text-3xl">{p.media}</span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm text-slate-800">{p.caption}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">{p.platforms.map((pl) => <PlatformIcon key={pl} platform={pl} size="sm" />)} · {formatDate(p.scheduledAt, true)} · {p.author}</div>
                  <div className="mt-2 flex gap-2"><Button size="xs" variant="success" icon={Check} onClick={() => decide(p, true)}>Approve</Button><Button size="xs" variant="outline" icon={X} onClick={() => decide(p, false)}>Reject</Button></div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
      <Card
        title={view === 'week' ? `Week of ${formatDate(days[0])}` : month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        actions={
          <>
            <Tabs variant="pills" value={view} onChange={(v) => { setView(v); setOffset(0) }} items={[{ id: 'week', label: 'Week' }, { id: 'month', label: 'Month' }]} />
            <div className="flex">
              <Button size="sm" variant="ghost" icon={ChevronLeft} onClick={() => setOffset(offset - 1)} aria-label="Previous" />
              <Button size="sm" variant="ghost" onClick={() => setOffset(0)}>Today</Button>
              <Button size="sm" variant="ghost" icon={ChevronRight} onClick={() => setOffset(offset + 1)} aria-label="Next" />
            </div>
          </>
        }
      >
        <div className="scrollbar-thin overflow-x-auto">
          <div className="grid min-w-[720px] grid-cols-7 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="bg-slate-50 px-2 py-1.5 text-xs font-semibold text-slate-500">{d}</div>)}
            {days.map((d) => {
              const dayPosts = posts.filter((p) => sameDay(new Date(p.scheduledAt), d))
              const today = sameDay(d, new Date())
              const outside = view === 'month' && d.getMonth() !== month.getMonth()
              return (
                <div key={d.toISOString()} className={cn('bg-white p-1.5', view === 'week' ? 'min-h-[180px]' : 'min-h-[96px]', outside && 'bg-slate-50/70')}>
                  <p className={cn('mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs', today ? 'bg-brand-600 font-semibold text-white' : outside ? 'text-slate-300' : 'text-slate-600')}>{d.getDate()}</p>
                  <div className="space-y-1">
                    {dayPosts.map((p) => (
                      <div key={p.id} className={cn('rounded-md border-l-2 px-1.5 py-1 text-[11px] leading-tight', statusColor[p.status])} title={p.caption}>
                        <p className="font-medium text-slate-700">{new Date(p.scheduledAt).toLocaleTimeString('en-US', { hour: 'numeric' })} {p.media}</p>
                        {view === 'week' && <p className="line-clamp-2 text-slate-600">{p.caption}</p>}
                        <div className="mt-0.5 flex gap-0.5">{p.platforms.map((pl) => <span key={pl} className="text-[9px] font-semibold text-slate-400">{SOCIAL_PLATFORMS.find((x) => x.id === pl)?.short}</span>)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
          {(['Published', 'Scheduled', 'Pending', 'Draft', 'Rejected'] as const).map((s) => <span key={s} className="flex items-center gap-1"><span className={cn('h-2.5 w-2.5 rounded-sm border', statusColor[s])} />{s}</span>)}
        </div>
      </Card>
    </div>
  )
}

/* ─────────────── Engagement & campaign analytics ─────────────── */

function AnalyticsTab({ posts, campaigns }: { posts: SocialPost[]; campaigns: Campaign[] }) {
  const top = posts.filter((p) => p.status === 'Published').sort((a, b) => b.reach - a.reach)
  const camp = campaigns.filter((c) => c.spent > 0).map((c) => ({ name: c.name, roi: Math.round((c.conversions * 18) / c.spent * 10) / 10, conversions: c.conversions }))
  return (
    <div className="space-y-6">
      <Card title="Engagement by platform" subtitle="Last 14 days (likes + comments + shares)">
        <ChartBox height={280}>
          <AreaChart data={engagementTrend}>
            <defs>
              {['Instagram', 'Facebook', 'TikTok'].map((k, i) => (
                <linearGradient key={k} id={`g-${k}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={[chartColors[5], chartColors[1], chartColors[7]][i]} stopOpacity={0.3} /><stop offset="100%" stopColor={[chartColors[5], chartColors[1], chartColors[7]][i]} stopOpacity={0} /></linearGradient>
              ))}
            </defs>
            <CartesianGrid {...chartGrid} vertical={false} />
            <XAxis dataKey="d" {...chartAxis} />
            <YAxis {...chartAxis} tickFormatter={(v: number) => formatNumber(v, true)} />
            <Tooltip {...chartTooltip} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="Instagram" stroke={chartColors[5]} fill="url(#g-Instagram)" strokeWidth={2} />
            <Area type="monotone" dataKey="Facebook" stroke={chartColors[1]} fill="url(#g-Facebook)" strokeWidth={2} />
            <Area type="monotone" dataKey="TikTok" stroke={chartColors[7]} fill="url(#g-TikTok)" strokeWidth={2} />
          </AreaChart>
        </ChartBox>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Campaign return (est. revenue per $1)">
          <ChartBox height={240}>
            <BarChart data={camp} layout="vertical">
              <CartesianGrid {...chartGrid} horizontal={false} />
              <XAxis type="number" {...chartAxis} />
              <YAxis type="category" dataKey="name" {...chartAxis} width={130} tick={{ fontSize: 11 }} />
              <Tooltip {...chartTooltip} />
              <Bar dataKey="roi" name="ROAS" fill={chartColors[2]} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ChartBox>
        </Card>
        <Card title="Top posts" flush>
          <ul className="divide-y divide-slate-100">
            {top.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-2xl">{p.media}</span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm text-slate-800">{p.caption}</p><p className="flex items-center gap-1 text-xs text-slate-500">{p.platforms.map((pl) => <PlatformIcon key={pl} platform={pl} size="sm" />)} {timeAgo(p.scheduledAt)}</p></div>
                <div className="text-right text-xs"><p className="font-semibold text-slate-900">{formatNumber(p.reach, true)} reach</p><p className="text-slate-500">❤ {formatNumber(p.likes, true)} · 💬 {p.comments}</p></div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}

/* ─────────────── AI content generation & optimization ─────────────── */

function AIStudio() {
  const notify = useToast()
  const [topic, setTopic] = useState('Weekend biryani special')
  const [tone, setTone] = useState('Playful')
  const [results, setResults] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const run = async () => {
    setLoading(true)
    const a = await generateCaption(topic)
    const b = await generateCaption(topic)
    setResults([a, b])
    setLoading(false)
  }
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title={<span className="flex items-center gap-2"><Sparkles size={16} className="text-violet-600" /> AI Content Studio</span>} subtitle="Generate captions, hashtags and post ideas in your brand voice">
        <div className="space-y-4">
          <Field label="What's the post about?"><Input value={topic} onChange={(e) => setTopic(e.target.value)} /></Field>
          <Field label="Tone"><Select value={tone} onChange={(e) => setTone(e.target.value)} options={['Playful', 'Premium', 'Urgent / FOMO', 'Warm & family', 'Informative']} /></Field>
          <Button variant="ai" icon={Sparkles} loading={loading} onClick={run} block>{loading ? 'Generating…' : 'Generate 2 variations'}</Button>
          {results.map((r, i) => (
            <div key={i} className="rounded-xl border border-violet-100 bg-violet-50/40 p-3">
              <p className="text-[11px] font-semibold tracking-wide text-violet-500 uppercase">Variation {i + 1} · {tone}</p>
              <p className="mt-1 text-sm text-slate-800">{r}</p>
              <div className="mt-2 flex justify-end gap-2"><Button size="xs" variant="ghost" onClick={() => notify('Copied to clipboard', 'info')}>Copy</Button><Button size="xs" variant="ai" onClick={() => notify('Sent to composer as draft')}>Use in post</Button></div>
            </div>
          ))}
        </div>
      </Card>
      <AIInsights
        title="AI Campaign Optimization"
        subtitle="Learned from 6 months of your engagement data"
        onAction={(i) => notify(`${i.action} — done`)}
        insights={[
          { title: 'Best time to post: Fri 7–8 PM', detail: 'Instagram posts in this slot get 2.3× more saves. 3 scheduled posts could be moved there.', severity: 'opportunity', metric: '2.3× saves', action: 'Reschedule posts' },
          { title: 'TikTok behind-the-scenes outperform', detail: 'Kitchen process videos average 128k reach vs 26k for food stills. Plan 2 per week.', severity: 'opportunity', metric: '4.9× reach', action: 'Add to calendar' },
          { title: 'Shift $200 from Facebook to TikTok', detail: 'Facebook cost per conversion is $3.10 vs $1.40 on TikTok for Karahi Fridays.', severity: 'warning', metric: '-55% CPA', action: 'Rebalance budget' },
          { title: 'Respond to 4 unanswered DMs', detail: 'Two are catering enquiries worth an estimated $1,800.', severity: 'critical', action: 'Open inbox' },
          { title: 'Hashtag #LahoreEats trending', detail: 'Add to posts this week — +18% discovery from non-followers.', severity: 'info', metric: '+18%' },
        ]}
      />
    </div>
  )
}
