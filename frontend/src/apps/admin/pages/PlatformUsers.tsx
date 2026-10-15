import {
  Ban,
  CheckCircle2,
  Eye,
  FileClock,
  KeyRound,
  Link2,
  Lock,
  Mail,
  PlayCircle,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import {
  AIInsights,
  Avatar,
  Badge,
  Button,
  Card,
  DataTable,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  StatCard,
  StatusBadge,
  Tabs,
  useToast,
} from '@/shared/components/ui'
import { useAsync } from '@/shared/hooks/useAsync'
import { cn } from '@/shared/lib/cn'
import { formatDate, timeAgo } from '@/shared/lib/format'
import {
  getAccessLogs,
  getAdminAssignments,
  getPlatformRoles,
  getPlatformUsers,
  getSuspiciousActivity,
  inviteUser,
  permissionCatalog,
  platformRoleNames,
  saveAdminAssignment,
  savePlatformRole,
  updatePlatformUser,
  updateSuspiciousActivity,
} from '@/shared/services/admin'
import type { AdminAssignment, PlatformRoleName, PlatformUser, SuspiciousActivity } from '@/shared/services/admin'

type TabId = 'team' | 'roles' | 'assignments' | 'status' | 'logs' | 'ai'

const teams: PlatformUser['team'][] = ['Leadership', 'Operations', 'Finance', 'Support', 'Customer Success', 'Compliance']
const managers = ['Sara Ahmed', 'Hamza Iqbal', 'Daniel Brooks', 'Rizwan Haider']

export default function PlatformUsers() {
  const notify = useToast()
  const [tab, setTab] = useState<TabId>('team')
  const { data: users = [], setData: setUsers, loading } = useAsync(getPlatformUsers)
  const { data: roles = [], setData: setRoles } = useAsync(getPlatformRoles)
  const { data: assignments = [], setData: setAssignments, loading: asLoading } = useAsync(getAdminAssignments)
  const { data: logs = [], loading: logsLoading } = useAsync(getAccessLogs)
  const { data: suspicious = [], setData: setSuspicious } = useAsync(getSuspiciousActivity)

  const [inviteOpen, setInviteOpen] = useState(false)
  const [invite, setInvite] = useState({ name: '', email: '', role: 'Support Agent' as PlatformRoleName, team: 'Support' as PlatformUser['team'] })
  const [editAssign, setEditAssign] = useState<AdminAssignment | null>(null)
  const [roleFilter, setRoleFilter] = useState('')
  const [logFilter, setLogFilter] = useState('')

  const patchUser = async (u: PlatformUser, p: Partial<PlatformUser>, msg: string) => {
    setUsers((l) => l?.map((x) => (x.id === u.id ? { ...x, ...p } : x)))
    await updatePlatformUser(u.id, p)
    notify(msg)
  }

  const sendInvite = async () => {
    const u: PlatformUser = { id: `U-${String(users.length + 1).padStart(3, '0')}`, ...invite, status: 'Invited', mfa: false, lastLogin: new Date().toISOString(), tenantsManaged: 0 }
    setUsers((l) => [...(l ?? []), u])
    await inviteUser(u)
    notify(`Invitation sent to ${u.email}`)
    setInviteOpen(false)
    setInvite({ name: '', email: '', role: 'Support Agent', team: 'Support' })
  }

  const togglePerm = async (roleId: string, perm: string) => {
    const role = roles.find((r) => r.id === roleId)
    if (!role || role.name === 'Super Admin') return
    const next = { ...role, permissions: role.permissions.includes(perm) ? role.permissions.filter((p) => p !== perm) : [...role.permissions, perm] }
    setRoles((l) => l?.map((r) => (r.id === roleId ? next : r)))
    await savePlatformRole(next)
    notify(`${role.name} permissions updated`)
  }

  const resolveSuspicious = async (s: SuspiciousActivity, status: SuspiciousActivity['status']) => {
    setSuspicious((l) => l?.map((x) => (x.id === s.id ? { ...x, status } : x)))
    await updateSuspiciousActivity(s.id, { status })
    notify(`${s.pattern} on ${s.subject}: ${status.toLowerCase()}`)
  }

  const tabs = [
    { id: 'team' as const, label: 'Super admin team', icon: Users, count: users.length },
    { id: 'roles' as const, label: 'Roles & permissions', icon: KeyRound },
    { id: 'assignments' as const, label: 'Restaurant admin assignment', icon: Link2 },
    { id: 'status' as const, label: 'Account status', icon: UserCheck },
    { id: 'logs' as const, label: 'Access & security logs', icon: FileClock },
    { id: 'ai' as const, label: 'AI suspicious activity', icon: Sparkles, count: suspicious.filter((s) => s.status === 'Open' || s.status === 'Investigating').length },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        icon={UserCog}
        title="Platform Users & Access"
        description="Manage the super admin team, roles, restaurant admin assignments and access security."
        actions={
          <Button icon={UserPlus} onClick={() => setInviteOpen(true)}>
            Invite team member
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Platform users" value={users.length} icon={Users} tone="brand" hint={`${users.filter((u) => u.status === 'Invited').length} pending invites`} />
        <StatCard label="Active" value={users.filter((u) => u.status === 'Active').length} icon={CheckCircle2} tone="green" />
        <StatCard label="MFA coverage" value={`${Math.round((users.filter((u) => u.mfa).length / Math.max(1, users.length)) * 100)}%`} icon={ShieldCheck} tone="blue" hint="target 100%" />
        <StatCard label="Open security flags" value={suspicious.filter((s) => s.status === 'Open' || s.status === 'Investigating').length} icon={ShieldAlert} tone="red" />
      </div>

      <Tabs items={tabs} value={tab} onChange={setTab} />

      {tab === 'team' && (
        <Card flush>
          <DataTable
            data={users.filter((u) => !roleFilter || u.role === roleFilter)}
            loading={loading}
            rowKey={(u) => u.id}
            searchKeys={['name', 'email', 'team']}
            toolbar={<Select className="h-9 w-48" placeholder="All roles" options={platformRoleNames} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} />}
            columns={[
              {
                key: 'name',
                header: 'Member',
                sortable: true,
                render: (u) => (
                  <div className="flex items-center gap-3">
                    <Avatar name={u.name} size="sm" />
                    <div>
                      <p className="font-medium whitespace-nowrap text-slate-800">{u.name}</p>
                      <p className="text-xs text-slate-500">{u.email}</p>
                    </div>
                  </div>
                ),
              },
              {
                key: 'role',
                header: 'Role',
                render: (u) => (
                  <Select
                    className="h-8 w-48 text-xs"
                    value={u.role}
                    options={platformRoleNames}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => patchUser(u, { role: e.target.value as PlatformRoleName }, `${u.name} is now ${e.target.value}`)}
                  />
                ),
              },
              { key: 'team', header: 'Team', sortable: true },
              { key: 'mfa', header: 'MFA', render: (u) => (u.mfa ? <Badge tone="green" dot>Enabled</Badge> : <Badge tone="red" dot>Off</Badge>) },
              { key: 'tenantsManaged', header: 'Restaurants', align: 'center', sortable: true },
              { key: 'status', header: 'Status', render: (u) => <StatusBadge status={u.status} /> },
              { key: 'lastLogin', header: 'Last login', sortable: true, render: (u) => <span className="text-xs whitespace-nowrap text-slate-500">{u.status === 'Invited' ? '—' : timeAgo(u.lastLogin)}</span> },
            ]}
          />
        </Card>
      )}

      {tab === 'roles' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {roles.map((r) => (
              <Card key={r.id} bodyClassName="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{r.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{r.description}</p>
                  </div>
                  {r.system ? <Badge tone="gray"><Lock size={11} /> System</Badge> : <Badge tone="blue">Custom</Badge>}
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                  <span>{r.permissions.length} / {permissionCatalog.length} permissions</span>
                  <span>{users.filter((u) => u.role === r.name).length} members</span>
                </div>
              </Card>
            ))}
          </div>
          <Card title="Permission matrix" subtitle="Click a cell to grant or revoke. Super Admin always has full access." flush>
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    <th className="px-4 py-2.5 text-left">Permission</th>
                    {roles.map((r) => (
                      <th key={r.id} className="px-2 py-2.5 text-center whitespace-nowrap">{r.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {permissionCatalog.map((p, i) => (
                    <tr key={p.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-2.5">
                        {(i === 0 || permissionCatalog[i - 1]!.group !== p.group) && <p className="text-[10px] font-semibold tracking-wider text-brand-600 uppercase">{p.group}</p>}
                        <p className="text-slate-700">{p.label}</p>
                      </td>
                      {roles.map((r) => {
                        const on = r.permissions.includes(p.id)
                        return (
                          <td key={r.id} className="px-2 py-2.5 text-center">
                            <button
                              type="button"
                              aria-label={`${on ? 'Revoke' : 'Grant'} ${p.label} for ${r.name}`}
                              disabled={r.name === 'Super Admin'}
                              onClick={() => togglePerm(r.id, p.id)}
                              className={cn(
                                'inline-flex h-6 w-6 items-center justify-center rounded-md transition',
                                on ? 'bg-brand-600 text-white' : 'bg-slate-100 text-transparent hover:bg-slate-200',
                                r.name === 'Super Admin' && 'opacity-60',
                              )}
                            >
                              <CheckCircle2 size={14} />
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {tab === 'assignments' && (
        <Card flush title="Restaurant admin assignment" subtitle="Primary restaurant admin and the platform account manager responsible for each tenant">
          <DataTable
            data={assignments}
            loading={asLoading}
            rowKey={(a) => a.id}
            searchKeys={['tenant', 'admin', 'email', 'accountManager']}
            columns={[
              { key: 'tenant', header: 'Restaurant', sortable: true, render: (a) => <span className="font-medium whitespace-nowrap text-slate-800">{a.tenant}</span> },
              { key: 'admin', header: 'Restaurant admin', render: (a) => <div><p className="whitespace-nowrap">{a.admin}</p><p className="text-xs text-slate-500">{a.email}</p></div> },
              { key: 'accountManager', header: 'Account manager', sortable: true, render: (a) => <span className="flex items-center gap-2 whitespace-nowrap"><Avatar name={a.accountManager} size="sm" /> {a.accountManager}</span> },
              { key: 'status', header: 'Status', render: (a) => <StatusBadge status={a.status} /> },
              { key: 'assignedAt', header: 'Assigned', render: (a) => <span className="whitespace-nowrap">{formatDate(a.assignedAt)}</span> },
              {
                key: 'act',
                header: '',
                align: 'right',
                render: (a) => (
                  <div className="flex justify-end gap-1">
                    {a.status === 'Invited' && <Button size="xs" variant="ghost" icon={Mail} onClick={() => notify(`Invitation re-sent to ${a.email}`, 'info')}>Resend</Button>}
                    <Button size="xs" variant="outline" onClick={() => setEditAssign(a)}>Reassign</Button>
                  </div>
                ),
              },
            ]}
          />
        </Card>
      )}

      {tab === 'status' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {users.map((u) => (
            <Card key={u.id} bodyClassName="p-4">
              <div className="flex items-center gap-3">
                <Avatar name={u.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-800">{u.name}</p>
                  <p className="truncate text-xs text-slate-500">{u.role} · {u.team}</p>
                </div>
                <StatusBadge status={u.status} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {u.status === 'Active' ? (
                  <Button size="xs" variant="outline" icon={Ban} onClick={() => patchUser(u, { status: 'Suspended' }, `${u.name} suspended — sessions revoked`)} disabled={u.id === 'U-001'}>
                    Suspend
                  </Button>
                ) : u.status === 'Invited' ? (
                  <Button size="xs" variant="outline" icon={Mail} onClick={() => notify(`Invitation re-sent to ${u.email}`, 'info')}>Resend invite</Button>
                ) : (
                  <Button size="xs" variant="success" icon={PlayCircle} onClick={() => patchUser(u, { status: 'Active' }, `${u.name} reactivated`)}>
                    Reactivate
                  </Button>
                )}
                {u.status !== 'Inactive' && u.id !== 'U-001' && (
                  <Button size="xs" variant="ghost" onClick={() => patchUser(u, { status: 'Inactive' }, `${u.name} deactivated`)}>Deactivate</Button>
                )}
                <Button size="xs" variant="ghost" icon={KeyRound} onClick={() => patchUser(u, { mfa: false }, `MFA reset for ${u.name} — re-enrolment required`)}>
                  Reset MFA
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'logs' && (
        <Card flush>
          <DataTable
            data={logs.filter((l) => !logFilter || l.result === logFilter)}
            loading={logsLoading}
            rowKey={(l) => l.id}
            searchKeys={['user', 'action', 'ip', 'location']}
            pageSize={10}
            toolbar={<Select className="h-9 w-36" placeholder="All results" options={['Success', 'Failed', 'Blocked']} value={logFilter} onChange={(e) => setLogFilter(e.target.value)} />}
            columns={[
              { key: 'at', header: 'Time', sortable: true, render: (l) => <span className="text-xs whitespace-nowrap">{formatDate(l.at, true)}</span> },
              { key: 'user', header: 'User', render: (l) => <span className="whitespace-nowrap">{l.user}</span> },
              { key: 'action', header: 'Action' },
              { key: 'ip', header: 'IP', render: (l) => <span className="font-mono text-xs">{l.ip}</span> },
              { key: 'location', header: 'Location', render: (l) => <span className="whitespace-nowrap">{l.location}</span> },
              { key: 'device', header: 'Device', render: (l) => <span className="text-xs whitespace-nowrap text-slate-500">{l.device}</span> },
              { key: 'result', header: 'Result', render: (l) => <Badge tone={l.result === 'Success' ? 'green' : l.result === 'Failed' ? 'yellow' : 'red'} dot>{l.result}</Badge> },
            ]}
          />
        </Card>
      )}

      {tab === 'ai' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <AIInsights
            title="AI Suspicious Activity Detection"
            subtitle="Current persisted security and MFA signals"
            onAction={(i) => notify(`${i.action} — done`)}
            insights={[
              ...(suspicious.map((s) => ({ title: `${s.pattern}: ${s.subject}`, detail: s.detail, severity: s.risk === 'Critical' ? 'critical' as const : 'warning' as const, metric: `${s.confidence}%`, action: 'Review event' }))),
              ...(users.filter((u) => !u.mfa).length ? [{ title: `${users.filter((u) => !u.mfa).length} platform user(s) without MFA`, detail: users.filter((u) => !u.mfa).map((u) => u.name).join(', '), severity: 'warning' as const, action: 'Review users' }] : []),
              ...(!suspicious.length && users.every((u) => u.mfa) ? [{ title: 'No current access alerts', detail: 'All stored platform users have MFA and no suspicious-activity records are open.', severity: 'success' as const }] : []),
            ]}
          />
          <div className="space-y-3 xl:col-span-2">
            {suspicious.map((s) => (
              <Card key={s.id} bodyClassName="p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg', s.risk === 'Critical' ? 'bg-red-50 text-red-600' : s.risk === 'High' ? 'bg-brand-50 text-brand-600' : 'bg-amber-50 text-amber-600')}>
                    <ShieldAlert size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-800">{s.pattern}</p>
                      <StatusBadge status={s.risk} />
                      <Badge tone="gray">{s.scope}</Badge>
                    </div>
                    <p className="mt-0.5 text-sm text-slate-600">
                      <b>{s.subject}</b> — {s.detail}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Confidence {s.confidence}% · {timeAgo(s.at)}
                    </p>
                  </div>
                  <StatusBadge status={s.status} />
                </div>
                {(s.status === 'Open' || s.status === 'Investigating') && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                    {s.status === 'Open' && <Button size="xs" variant="outline" icon={Eye} onClick={() => resolveSuspicious(s, 'Investigating')}>Investigate</Button>}
                    <Button size="xs" variant="danger" icon={Ban} onClick={() => resolveSuspicious(s, 'Resolved')}>Block & resolve</Button>
                    <Button size="xs" variant="ghost" onClick={() => resolveSuspicious(s, 'Dismissed')}>Dismiss</Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite team member"
        description="They'll receive an email to set a password and enrol MFA."
        footer={
          <>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button icon={Mail} disabled={!invite.name || !/\S+@\S+/.test(invite.email)} onClick={sendInvite}>Send invitation</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Full name" required>
            <Input value={invite.name} onChange={(e) => setInvite({ ...invite, name: e.target.value })} />
          </Field>
          <Field label="Work email" required>
            <Input type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} placeholder="name@restaurantos.io" />
          </Field>
          <Field label="Role">
            <Select value={invite.role} options={platformRoleNames} onChange={(e) => setInvite({ ...invite, role: e.target.value as PlatformRoleName })} />
          </Field>
          <Field label="Team">
            <Select value={invite.team} options={teams} onChange={(e) => setInvite({ ...invite, team: e.target.value as PlatformUser['team'] })} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={!!editAssign}
        onClose={() => setEditAssign(null)}
        title={`Reassign — ${editAssign?.tenant ?? ''}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditAssign(null)}>Cancel</Button>
            <Button
              onClick={async () => {
                if (!editAssign) return
                setAssignments((l) => l?.map((x) => (x.id === editAssign.id ? editAssign : x)))
                await saveAdminAssignment(editAssign)
                notify(`Assignment updated for ${editAssign.tenant}`)
                setEditAssign(null)
              }}
            >
              Save
            </Button>
          </>
        }
      >
        {editAssign && (
          <div className="space-y-4">
            <Field label="Restaurant admin name">
              <Input value={editAssign.admin} onChange={(e) => setEditAssign({ ...editAssign, admin: e.target.value })} />
            </Field>
            <Field label="Restaurant admin email" hint="A new invitation is sent if the email changes">
              <Input value={editAssign.email} onChange={(e) => setEditAssign({ ...editAssign, email: e.target.value })} />
            </Field>
            <Field label="Platform account manager">
              <Select value={editAssign.accountManager} options={managers} onChange={(e) => setEditAssign({ ...editAssign, accountManager: e.target.value })} />
            </Field>
          </div>
        )}
      </Modal>
    </div>
  )
}
