import {
  Activity,
  AlertOctagon,
  ArrowUpCircle,
  Bug,
  CheckCircle2,
  Clock,
  HeartPulse,
  Inbox,
  LifeBuoy,
  MessageSquareWarning,
  Plus,
  Send,
  Siren,
  Sparkles,
  Store,
} from 'lucide-react'
import { useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
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
  Modal,
  PageHeader,
  SectionTitle,
  Select,
  StatCard,
  StatusBadge,
  Tabs,
  Textarea,
  useToast,
} from '@/shared/components/ui'
import type { Column } from '@/shared/components/ui'
import { useAsync } from '@/shared/hooks/useAsync'
import { chartAxis, chartColors, chartGrid, chartTooltip } from '@/shared/lib/chart'
import { cn } from '@/shared/lib/cn'
import { formatDate, formatNumber, timeAgo } from '@/shared/lib/format'
import {
  getIncidents,
  getPlatformUsers,
  getLatencySeries,
  getServiceStatuses,
  getSystemErrors,
  getTickets,
  saveIncident,
  updateSystemError,
  updateTicket,
} from '@/shared/services/admin'
import type { Incident, Ticket, TicketStatus } from '@/shared/services/admin'

type TabId = 'tickets' | 'requests' | 'health' | 'errors' | 'incidents' | 'ai'

export default function Support() {
  const notify = useToast()
  const [tab, setTab] = useState<TabId>('tickets')
  const { data: tickets = [], setData: setTickets, loading } = useAsync(getTickets)
  const { data: services = [] } = useAsync(getServiceStatuses)
  const { data: latency = [] } = useAsync(getLatencySeries)
  const { data: errors = [], setData: setErrors } = useAsync(getSystemErrors)
  const { data: incidents = [], setData: setIncidents } = useAsync(getIncidents)
  const { data: users = [] } = useAsync(getPlatformUsers)
  const agents = users.filter((u) => u.status === 'Active').map((u) => u.name)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reply, setReply] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [incidentOpen, setIncidentOpen] = useState(false)
  const [newIncident, setNewIncident] = useState({ title: '', severity: 'SEV-2' as Incident['severity'], commander: '' })
  const [noteFor, setNoteFor] = useState<string | null>(null)
  const [note, setNote] = useState('')

  const selected = tickets.find((t) => t.id === selectedId) ?? null
  const openTickets = tickets.filter((t) => !['Resolved', 'Closed'].includes(t.status))
  const complaints = tickets.filter((t) => t.kind === 'Complaint')
  const requests = tickets.filter((t) => t.kind === 'Support request')

  const patchTicket = async (t: Ticket, p: Partial<Ticket>, msg: string) => {
    setTickets((l) => l?.map((x) => (x.id === t.id ? { ...x, ...p, updatedAt: new Date().toISOString() } : x)))
    await updateTicket(t.id, p)
    notify(msg)
  }

  const patchIncident = async (inc: Incident, p: Partial<Incident>, msg: string) => {
    const next = { ...inc, ...p }
    setIncidents((l) => l?.map((x) => (x.id === inc.id ? next : x)))
    await saveIncident(next)
    notify(msg)
  }

  const ticketColumns: Column<Ticket>[] = [
    { key: 'id', header: 'Ticket', render: (t) => <span className="font-mono text-xs whitespace-nowrap">{t.id}</span> },
    {
      key: 'subject',
      header: 'Subject',
      render: (t) => (
        <div className="min-w-56">
          <p className="font-medium text-slate-800">{t.subject}</p>
          <p className="text-xs text-slate-500">
            {t.tenant} · {t.requester}
          </p>
        </div>
      ),
    },
    { key: 'kind', header: 'Type', render: (t) => <Badge tone={t.kind === 'Complaint' ? 'pink' : 'blue'}>{t.kind}</Badge> },
    { key: 'priority', header: 'Priority', sortable: true, sortValue: (t) => ['Urgent', 'High', 'Medium', 'Low'].indexOf(t.priority), render: (t) => <StatusBadge status={t.priority} /> },
    { key: 'status', header: 'Status', render: (t) => <StatusBadge status={t.status} /> },
    { key: 'assignee', header: 'Assignee', render: (t) => <span className="flex items-center gap-2 whitespace-nowrap"><Avatar name={t.assignee} size="sm" />{t.assignee}</span> },
    {
      key: 'slaHoursLeft',
      header: 'SLA',
      sortable: true,
      render: (t) =>
        ['Resolved', 'Closed'].includes(t.status) ? (
          <span className="text-xs text-slate-400">Met</span>
        ) : (
          <span className={cn('text-xs font-medium whitespace-nowrap', t.slaHoursLeft <= 1 ? 'text-red-600' : t.slaHoursLeft <= 4 ? 'text-amber-600' : 'text-slate-600')}>
            {t.slaHoursLeft === 0 ? 'Breached' : `${t.slaHoursLeft}h left`}
          </span>
        ),
    },
    { key: 'updatedAt', header: 'Updated', sortable: true, render: (t) => <span className="text-xs whitespace-nowrap text-slate-500">{timeAgo(t.updatedAt)}</span> },
  ]

  const filterTickets = (list: Ticket[]) => list.filter((t) => (!statusFilter || t.status === statusFilter) && (!priorityFilter || t.priority === priorityFilter))
  const ticketToolbar = (
    <>
      <Select className="h-9 w-36" placeholder="All statuses" options={['Open', 'In Progress', 'Pending', 'Escalated', 'Resolved', 'Closed']} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} />
      <Select className="h-9 w-32" placeholder="All priorities" options={['Urgent', 'High', 'Medium', 'Low']} value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} />
    </>
  )

  const healthy = services.filter((s) => s.status === 'Operational').length

  return (
    <div className="space-y-6">
      <PageHeader
        icon={LifeBuoy}
        title="Platform Support & Monitoring"
        description="Tickets and complaints, restaurant requests, platform health, errors and incidents."
        actions={
          <Button variant="danger" icon={Siren} onClick={() => setIncidentOpen(true)}>
            Declare incident
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Open tickets" value={openTickets.length} icon={Inbox} tone="brand" hint={`${complaints.filter((c) => !['Resolved', 'Closed'].includes(c.status)).length} complaints`} />
        <StatCard label="Avg first response" value="18 min" icon={Clock} tone="blue" delta={-22} invertDelta />
        <StatCard label="Services operational" value={`${healthy}/${services.length}`} icon={HeartPulse} tone={healthy === services.length ? 'green' : 'amber'} />
        <StatCard label="Active incidents" value={incidents.filter((i) => i.status !== 'Resolved').length} icon={AlertOctagon} tone="red" />
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'tickets', label: 'Tickets & complaints', icon: MessageSquareWarning, count: openTickets.length },
          { id: 'requests', label: 'Restaurant requests', icon: Store, count: requests.length },
          { id: 'health', label: 'Platform health', icon: HeartPulse },
          { id: 'errors', label: 'Errors & integration failures', icon: Bug, count: errors.filter((e) => e.status !== 'Resolved').length },
          { id: 'incidents', label: 'Incidents & escalation', icon: Siren },
          { id: 'ai', label: 'AI classification', icon: Sparkles },
        ]}
      />

      {tab === 'tickets' && (
        <Card flush>
          <DataTable data={filterTickets(tickets)} loading={loading} rowKey={(t) => t.id} columns={ticketColumns} searchKeys={['subject', 'tenant', 'requester', 'id']} toolbar={ticketToolbar} onRowClick={(t) => setSelectedId(t.id)} pageSize={10} />
        </Card>
      )}

      {tab === 'requests' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Card className="xl:col-span-2" flush title="Restaurant support requests" subtitle="How-to, configuration and access requests raised by restaurant admins">
            <DataTable data={filterTickets(requests)} loading={loading} rowKey={(t) => t.id} columns={ticketColumns.filter((c) => c.key !== 'kind')} searchKeys={['subject', 'tenant']} onRowClick={(t) => setSelectedId(t.id)} />
          </Card>
          <Card title="Requests by restaurant">
            <ul className="space-y-2.5">
              {Object.entries(
                tickets.reduce<Record<string, number>>((acc, t) => ({ ...acc, [t.tenant]: (acc[t.tenant] ?? 0) + 1 }), {}),
              )
                .sort((a, b) => b[1] - a[1])
                .map(([tenant, n]) => (
                  <li key={tenant} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-slate-700"><Avatar name={tenant} size="sm" />{tenant}</span>
                    <Badge>{n}</Badge>
                  </li>
                ))}
            </ul>
          </Card>
        </div>
      )}

      {tab === 'health' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {services.map((s) => (
              <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-800">{s.name}</p>
                    <p className="text-xs text-slate-500">{s.group}</p>
                  </div>
                  <StatusBadge status={s.status} />
                </div>
                <div className="mt-3 flex gap-[2px]" aria-label="30-day uptime history">
                  {s.history.map((h, i) => (
                    <span key={i} title={`Day ${i + 1}: ${h}`} className={cn('h-6 flex-1 rounded-[2px]', h === 'ok' ? 'bg-emerald-400' : h === 'warn' ? 'bg-amber-400' : 'bg-red-500')} />
                  ))}
                </div>
                <div className="mt-2 flex justify-between text-xs text-slate-500">
                  <span>{s.uptime.toFixed(2)}% uptime</span>
                  <span>{s.status === 'Down' ? '—' : `${formatNumber(s.latency)} ms`}</span>
                </div>
              </div>
            ))}
          </div>
          <Card title="API latency & error rate" subtitle="Last 24 hours — p50 / p95 in ms, errors in %">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={latency} margin={{ left: -10, right: 8 }}>
                  <CartesianGrid {...chartGrid} vertical={false} />
                  <XAxis dataKey="h" {...chartAxis} interval={2} />
                  <YAxis yAxisId="ms" {...chartAxis} />
                  <YAxis yAxisId="err" orientation="right" {...chartAxis} tickFormatter={(v: number) => `${v}%`} />
                  <Tooltip {...chartTooltip} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Line yAxisId="ms" type="monotone" dataKey="p50" name="p50 latency" stroke={chartColors[1]} strokeWidth={2} dot={false} />
                  <Line yAxisId="ms" type="monotone" dataKey="p95" name="p95 latency" stroke={chartColors[0]} strokeWidth={2} dot={false} />
                  <Line yAxisId="err" type="monotone" dataKey="errors" name="Error rate" stroke={chartColors[5]} strokeWidth={2} strokeDasharray="4 3" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      {tab === 'errors' && (
        <Card flush>
          <DataTable
            data={errors}
            rowKey={(e) => e.id}
            searchKeys={['source', 'message', 'tenant']}
            columns={[
              { key: 'severity', header: 'Severity', sortable: true, sortValue: (e) => ['Critical', 'High', 'Medium', 'Low'].indexOf(e.severity), render: (e) => <StatusBadge status={e.severity} /> },
              { key: 'source', header: 'Source', render: (e) => <div><p className="font-medium whitespace-nowrap text-slate-800">{e.source}</p><p className="text-xs text-slate-500">{e.type}</p></div> },
              { key: 'message', header: 'Message', render: (e) => <span className="font-mono text-xs text-slate-600">{e.message}</span> },
              { key: 'tenant', header: 'Affected', render: (e) => <span className="whitespace-nowrap">{e.tenant}</span> },
              { key: 'count', header: 'Events', align: 'right', sortable: true, render: (e) => formatNumber(e.count) },
              { key: 'lastSeen', header: 'Last seen', render: (e) => <span className="text-xs whitespace-nowrap">{timeAgo(e.lastSeen)}</span> },
              { key: 'status', header: 'Status', render: (e) => <StatusBadge status={e.status} /> },
              {
                key: 'act',
                header: '',
                align: 'right',
                render: (e) =>
                  e.status !== 'Resolved' && (
                    <div className="flex justify-end gap-1">
                      <Button size="xs" variant="ghost" onClick={() => notify(`Retrying failed ${e.source} jobs…`, 'info')}>Retry</Button>
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={async () => {
                          setErrors((l) => l?.map((x) => (x.id === e.id ? { ...x, status: 'Resolved' } : x)))
                          await updateSystemError(e.id, { status: 'Resolved' })
                          notify(`${e.source} error resolved`)
                        }}
                      >
                        Resolve
                      </Button>
                    </div>
                  ),
              },
            ]}
          />
        </Card>
      )}

      {tab === 'incidents' && (
        <div className="space-y-4">
          <Card bodyClassName="p-4">
            <SectionTitle>Escalation policy</SectionTitle>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                ['L1', 'On-call support engineer', 'Respond within 15 min'],
                ['L2', 'Platform admin + vendor support', 'If unresolved after 30 min'],
                ['L3', 'Super admin & CTO', 'SEV-1 > 60 min or data risk'],
              ].map(([l, who, when]) => (
                <div key={l} className="flex items-start gap-3 rounded-lg border border-slate-100 p-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">{l}</span>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{who}</p>
                    <p className="text-xs text-slate-500">{when}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          {incidents.map((inc) => (
            <Card
              key={inc.id}
              title={
                <span className="flex flex-wrap items-center gap-2">
                  <Badge tone={inc.severity === 'SEV-1' ? 'red' : inc.severity === 'SEV-2' ? 'orange' : 'yellow'}>{inc.severity}</Badge>
                  {inc.title}
                </span>
              }
              subtitle={`${inc.id} · commander ${inc.commander} · started ${timeAgo(inc.startedAt)} · escalation L${inc.escalationLevel}`}
              actions={<StatusBadge status={inc.status === 'Resolved' ? 'Resolved' : inc.status === 'Monitoring' ? 'In Progress' : 'Critical'} />}
            >
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                <div>
                  <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Affected</p>
                  <div className="flex flex-wrap gap-1.5">
                    {inc.affected.map((a) => (
                      <Badge key={a}>{a}</Badge>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-slate-500">Status: <b className="text-slate-700">{inc.status}</b></p>
                </div>
                <ol className="relative space-y-3 border-l border-slate-200 pl-4 lg:col-span-2">
                  {inc.timeline.map((t, i) => (
                    <li key={i} className="relative">
                      <span className="absolute top-1.5 -left-[21px] h-2.5 w-2.5 rounded-full bg-brand-500 ring-4 ring-white" />
                      <p className="text-sm text-slate-700">{t.note}</p>
                      <p className="text-[11px] text-slate-400">{formatDate(t.at, true)}</p>
                    </li>
                  ))}
                </ol>
              </div>
              {inc.status !== 'Resolved' && (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                  <Button size="xs" variant="outline" icon={Plus} onClick={() => { setNoteFor(inc.id); setNote('') }}>Add update</Button>
                  {inc.escalationLevel < 3 && (
                    <Button
                      size="xs"
                      variant="outline"
                      icon={ArrowUpCircle}
                      onClick={() =>
                        patchIncident(
                          inc,
                          { escalationLevel: (inc.escalationLevel + 1) as Incident['escalationLevel'], timeline: [...inc.timeline, { at: new Date().toISOString(), note: `Escalated to L${inc.escalationLevel + 1}.` }] },
                          `${inc.id} escalated to L${inc.escalationLevel + 1}`,
                        )
                      }
                    >
                      Escalate
                    </Button>
                  )}
                  {inc.status !== 'Monitoring' && (
                    <Button size="xs" variant="ghost" icon={Activity} onClick={() => patchIncident(inc, { status: 'Monitoring', timeline: [...inc.timeline, { at: new Date().toISOString(), note: 'Fix deployed; monitoring.' }] }, `${inc.id} moved to monitoring`)}>
                      Monitoring
                    </Button>
                  )}
                  <Button size="xs" variant="success" icon={CheckCircle2} onClick={() => patchIncident(inc, { status: 'Resolved', resolvedAt: new Date().toISOString(), timeline: [...inc.timeline, { at: new Date().toISOString(), note: 'Incident resolved.' }] }, `${inc.id} resolved`)}>
                    Resolve
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {tab === 'ai' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <AIInsights
            title="AI Issue Classification & Alerts"
            subtitle="Every ticket and error is auto-triaged by the support model"
            onAction={(i) => notify(`${i.action} — done`)}
            insights={[
              ...(errors.filter((e) => e.status !== 'Resolved').map((e) => ({ title: `${e.source}: ${e.type}`, detail: e.message, severity: e.severity === 'Critical' ? 'critical' as const : 'warning' as const, metric: `${e.count} events`, action: 'Review error' }))),
              ...(tickets.filter((t) => t.status !== 'Resolved' && t.status !== 'Closed').slice(0, 3).map((t) => ({ title: `${t.priority} ticket: ${t.subject}`, detail: `${t.tenant} · ${t.category} · ${t.sentiment} sentiment`, severity: t.priority === 'Urgent' ? 'critical' as const : 'warning' as const, action: 'Open ticket' }))),
              ...(!errors.length && !tickets.length ? [{ title: 'No support or error records', detail: 'Live tickets and monitoring errors will appear here when they are created.', severity: 'success' as const }] : []),
            ]}
          />
          <Card className="xl:col-span-2" flush title="AI triage results" subtitle="Predicted category, sentiment and confidence">
            <DataTable
              data={tickets}
              rowKey={(t) => t.id}
              onRowClick={(t) => setSelectedId(t.id)}
              columns={[
                { key: 'subject', header: 'Ticket', render: (t) => <div className="min-w-48"><p className="font-medium text-slate-800">{t.subject}</p><p className="text-xs text-slate-500">{t.id} · {t.tenant}</p></div> },
                { key: 'aiCategory', header: 'AI category', render: (t) => <Badge tone="purple">{t.aiCategory}</Badge> },
                { key: 'sentiment', header: 'Sentiment', render: (t) => <Badge tone={t.sentiment === 'Negative' ? 'red' : t.sentiment === 'Positive' ? 'green' : 'gray'} dot>{t.sentiment}</Badge> },
                { key: 'priority', header: 'Suggested priority', render: (t) => <StatusBadge status={t.priority} /> },
                { key: 'aiConfidence', header: 'Confidence', align: 'right', sortable: true, render: (t) => `${t.aiConfidence}%` },
              ]}
            />
          </Card>
        </div>
      )}

      {/* Ticket drawer */}
      <Drawer
        open={!!selected}
        onClose={() => setSelectedId(null)}
        title={selected?.subject}
        description={selected ? `${selected.id} · ${selected.tenant}` : undefined}
        footer={
          selected && (
            <>
              {selected.status !== 'Escalated' && <Button variant="outline" icon={ArrowUpCircle} onClick={() => patchTicket(selected, { status: 'Escalated', priority: 'Urgent' }, `${selected.id} escalated`)}>Escalate</Button>}
              <Button variant="success" icon={CheckCircle2} onClick={() => patchTicket(selected, { status: 'Resolved' }, `${selected.id} resolved`)}>Resolve</Button>
            </>
          )
        }
      >
        {selected && (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={selected.status} />
              <StatusBadge status={selected.priority} />
              <Badge tone={selected.kind === 'Complaint' ? 'pink' : 'blue'}>{selected.kind}</Badge>
              <Badge tone="purple"><Sparkles size={11} /> {selected.aiCategory} · {selected.aiConfidence}%</Badge>
            </div>
            <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{selected.description}</p>
            <DescriptionList
              items={[
                { label: 'Requester', value: selected.requester },
                { label: 'Channel', value: selected.channel },
                { label: 'Created', value: formatDate(selected.createdAt, true) },
                { label: 'Sentiment', value: selected.sentiment },
              ]}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Status">
                <Select value={selected.status} options={['Open', 'In Progress', 'Pending', 'Escalated', 'Resolved', 'Closed']} onChange={(e) => patchTicket(selected, { status: e.target.value as TicketStatus }, `Status → ${e.target.value}`)} />
              </Field>
              <Field label="Assignee">
                <Select value={selected.assignee} options={agents} onChange={(e) => patchTicket(selected, { assignee: e.target.value }, `Assigned to ${e.target.value}`)} />
              </Field>
            </div>
            <div>
              <SectionTitle action={<Button size="xs" variant="ai" icon={Sparkles} onClick={() => setReply(`Hi ${selected.requester.split(' ')[0]}, thanks for reaching out. We've identified the cause of "${selected.subject.toLowerCase()}" and our team is applying a fix now. We'll update you within the hour.`)}>AI draft</Button>}>Reply</SectionTitle>
              <Textarea rows={4} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write a reply to the restaurant…" />
              <div className="mt-2 flex justify-end">
                <Button size="sm" icon={Send} disabled={!reply.trim()} onClick={() => { patchTicket(selected, { status: selected.status === 'Open' ? 'In Progress' : selected.status }, `Reply sent to ${selected.requester}`); setReply('') }}>
                  Send reply
                </Button>
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* Declare incident */}
      <Modal
        open={incidentOpen}
        onClose={() => setIncidentOpen(false)}
        title="Declare incident"
        description="Opens an incident, pages the commander and posts to the status page."
        footer={
          <>
            <Button variant="outline" onClick={() => setIncidentOpen(false)}>Cancel</Button>
            <Button
              variant="danger"
              disabled={!newIncident.title}
              onClick={async () => {
                const inc: Incident = {
                  id: `INC-${119 + incidents.length - 4}`,
                  title: newIncident.title,
                  severity: newIncident.severity,
                  status: 'Investigating',
                  commander: newIncident.commander || agents[0] || 'Unassigned',
                  affected: [],
                  escalationLevel: 1,
                  startedAt: new Date().toISOString(),
                  timeline: [{ at: new Date().toISOString(), note: `Incident declared; ${newIncident.commander || agents[0] || 'On-call'} paged.` }],
                }
                setIncidents((l) => [inc, ...(l ?? [])])
                await saveIncident(inc)
                notify(`${inc.id} declared — ${inc.commander} paged`)
                setIncidentOpen(false)
                setNewIncident({ title: '', severity: 'SEV-2', commander: '' })
                setTab('incidents')
              }}
            >
              Declare
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Title" required>
            <Input value={newIncident.title} onChange={(e) => setNewIncident({ ...newIncident, title: e.target.value })} placeholder="e.g. KDS screens not receiving tickets" />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Severity">
              <Select value={newIncident.severity} options={['SEV-1', 'SEV-2', 'SEV-3']} onChange={(e) => setNewIncident({ ...newIncident, severity: e.target.value as Incident['severity'] })} />
            </Field>
            <Field label="Incident commander">
              <Select value={newIncident.commander || agents[0] || ''} options={agents} onChange={(e) => setNewIncident({ ...newIncident, commander: e.target.value })} />
            </Field>
          </div>
        </div>
      </Modal>

      {/* Incident update */}
      <Modal
        open={!!noteFor}
        onClose={() => setNoteFor(null)}
        size="sm"
        title="Post incident update"
        footer={
          <>
            <Button variant="outline" onClick={() => setNoteFor(null)}>Cancel</Button>
            <Button
              disabled={!note.trim()}
              onClick={() => {
                const inc = incidents.find((i) => i.id === noteFor)
                if (inc) patchIncident(inc, { timeline: [...inc.timeline, { at: new Date().toISOString(), note }] }, 'Update posted')
                setNoteFor(null)
              }}
            >
              Post
            </Button>
          </>
        }
      >
        <Textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What changed?" />
      </Modal>
    </div>
  )
}
