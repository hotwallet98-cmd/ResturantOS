import {
  Check,
  FileClock,
  Fingerprint,
  KeyRound,
  Laptop,
  LogOut,
  Mail,
  MessageSquare,
  Minus,
  MonitorSmartphone,
  RotateCcw,
  Save,
  ShieldCheck,
  Smartphone,
  Usb,
  UserX,
} from 'lucide-react'
import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  Badge,
  Button,
  Card,
  DataTable,
  Field,
  Input,
  LoadingState,
  Modal,
  PageHeader,
  SectionTitle,
  Select,
  StatCard,
  StatusBadge,
  Tabs,
  Textarea,
  Toggle,
  useToast,
} from '@/shared/components/ui'
import { useAsync } from '@/shared/hooks/useAsync'
import { chartAxis, chartColors, chartGrid, chartTooltip } from '@/shared/lib/chart'
import { cn } from '@/shared/lib/cn'
import { formatDate, timeAgo } from '@/shared/lib/format'
import {
  getActiveSessions,
  getAuditLogs,
  getLoginActivity,
  getPlatformRoles,
  getResetRequests,
  getSecurityPolicy,
  loginTrend,
  permissionCatalog,
  revokeSession,
  saveSecurityPolicy,
} from '@/shared/services/admin'
import type { ActiveSession, SecurityPolicy } from '@/shared/services/admin'

type TabId = 'mfa' | 'password' | 'rbac' | 'sessions' | 'activity'

export default function Authentication() {
  const notify = useToast()
  const [tab, setTab] = useState<TabId>('mfa')
  const { data: policy, setData: setPolicy, loading } = useAsync(getSecurityPolicy)
  const { data: resets = [] } = useAsync(getResetRequests)
  const { data: roles = [] } = useAsync(getPlatformRoles)
  const { data: sessions = [], setData: setSessions, loading: sLoading } = useAsync(getActiveSessions)
  const { data: logins = [], loading: lLoading } = useAsync(getLoginActivity)
  const { data: audits = [] } = useAsync(getAuditLogs)
  const [saving, setSaving] = useState(false)
  const [revoking, setRevoking] = useState<ActiveSession | 'all' | null>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [auditFilter, setAuditFilter] = useState('')

  if (loading || !policy) return <LoadingState label="Loading security settings…" />

  const set = <K extends keyof SecurityPolicy>(k: K, v: SecurityPolicy[K]) => setPolicy({ ...policy, [k]: v })
  const save = async () => {
    setSaving(true)
    await saveSecurityPolicy(policy)
    setSaving(false)
    notify('Security policy saved')
  }

  const doRevoke = async () => {
    if (!revoking) return
    if (revoking === 'all') {
      setSessions((l) => l?.filter((s) => s.current))
      notify('All other sessions revoked')
    } else {
      setSessions((l) => l?.filter((s) => s.id !== revoking.id))
      await revokeSession(revoking.id)
      notify(`Session revoked for ${revoking.user}`)
    }
    setRevoking(null)
  }

  const failed = logins.filter((l) => l.event.includes('failed') || l.event === 'Account locked').length

  const mfaMethods: { key: keyof SecurityPolicy['mfaMethods']; label: string; desc: string; icon: typeof Smartphone }[] = [
    { key: 'authenticator', label: 'Authenticator app', desc: 'TOTP — Google / Microsoft Authenticator, 1Password', icon: Smartphone },
    { key: 'securityKey', label: 'Security key / passkey', desc: 'FIDO2 / WebAuthn hardware keys and passkeys', icon: Usb },
    { key: 'sms', label: 'SMS one-time code', desc: '6-digit code via Twilio SMS', icon: MessageSquare },
    { key: 'email', label: 'Email one-time code', desc: 'Least secure — not recommended for admins', icon: Mail },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        icon={KeyRound}
        title="Super Admin Authentication"
        description="Login security, MFA, password recovery, access control and session management."
        actions={
          <Button icon={Save} loading={saving} onClick={save}>
            Save policy
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="MFA enforcement" value={policy.mfaRequired ? 'Required' : 'Optional'} icon={Fingerprint} tone={policy.mfaRequired ? 'green' : 'amber'} hint={`${Object.values(policy.mfaMethods).filter(Boolean).length} methods enabled`} />
        <StatCard label="Active sessions" value={sessions.length} icon={MonitorSmartphone} tone="blue" />
        <StatCard label="Failed logins (24h)" value={failed} icon={UserX} tone="red" delta={-12} invertDelta />
        <StatCard label="Password resets (7d)" value={resets.length} icon={RotateCcw} tone="purple" />
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'mfa', label: 'Secure login & MFA', icon: Fingerprint },
          { id: 'password', label: 'Password recovery', icon: RotateCcw },
          { id: 'rbac', label: 'Role-based access', icon: ShieldCheck },
          { id: 'sessions', label: 'Session management', icon: MonitorSmartphone, count: sessions.length },
          { id: 'activity', label: 'Login activity & audit', icon: FileClock },
        ]}
      />

      {tab === 'mfa' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Card className="xl:col-span-2" title="Multi-factor authentication" subtitle="Applies to all super admin and platform staff accounts">
            <div className="space-y-5">
              <Toggle checked={policy.mfaRequired} onChange={(v) => set('mfaRequired', v)} label="Require MFA for every platform user" description="Users without MFA are forced to enrol at next login" />
              <div>
                <SectionTitle>Allowed methods</SectionTitle>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {mfaMethods.map(({ key, label, desc, icon: Icon }) => {
                    const on = policy.mfaMethods[key]
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => set('mfaMethods', { ...policy.mfaMethods, [key]: !on })}
                        className={cn('flex items-start gap-3 rounded-lg border p-3 text-left transition', on ? 'border-brand-400 bg-brand-50/60' : 'border-slate-200 hover:border-slate-300')}
                      >
                        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', on ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500')}>
                          <Icon size={17} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-slate-800">{label}</span>
                          <span className="block text-xs text-slate-500">{desc}</span>
                        </span>
                        {on && <Check size={16} className="text-brand-600" />}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Enrolment grace period" hint="days">
                  <Input type="number" value={policy.mfaGraceDays} onChange={(e) => set('mfaGraceDays', Number(e.target.value))} />
                </Field>
                <Field label="Remember trusted device" hint="days (0 = never)">
                  <Input type="number" value={policy.rememberDeviceDays} onChange={(e) => set('rememberDeviceDays', Number(e.target.value))} />
                </Field>
                <Field label="Lock account after" hint="failed attempts">
                  <Input type="number" value={policy.lockoutAttempts} onChange={(e) => set('lockoutAttempts', Number(e.target.value))} />
                </Field>
              </div>
            </div>
          </Card>
          <Card title="Login restrictions">
            <div className="space-y-4">
              <Field label="IP allowlist (CIDR, one per line)" hint="Leave empty to allow any IP">
                <Textarea rows={4} className="font-mono text-xs" value={policy.ipAllowlist} onChange={(e) => set('ipAllowlist', e.target.value)} />
              </Field>
              <Toggle checked={policy.singleSession} onChange={(v) => set('singleSession', v)} label="Single active session per user" description="New login signs out other devices" />
              <div className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">
                <p className="font-semibold">Security score: {policy.mfaRequired && policy.mfaMethods.securityKey ? 'A' : policy.mfaRequired ? 'B' : 'C'}</p>
                <p className="mt-0.5">MFA {policy.mfaRequired ? 'enforced' : 'optional'}, lockout after {policy.lockoutAttempts} attempts, {policy.ipAllowlist.trim() ? 'IP allowlist on' : 'no IP allowlist'}.</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {tab === 'password' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Card title="Password policy">
            <div className="space-y-4">
              <Field label="Minimum length">
                <Input type="number" value={policy.passwordMinLength} onChange={(e) => set('passwordMinLength', Number(e.target.value))} />
              </Field>
              <Toggle checked={policy.passwordRequireMixedCase} onChange={(v) => set('passwordRequireMixedCase', v)} label="Upper & lower case" />
              <Toggle checked={policy.passwordRequireNumbers} onChange={(v) => set('passwordRequireNumbers', v)} label="At least one number" />
              <Toggle checked={policy.passwordRequireSymbols} onChange={(v) => set('passwordRequireSymbols', v)} label="At least one symbol" />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Expires after" hint="days">
                  <Input type="number" value={policy.passwordExpiryDays} onChange={(e) => set('passwordExpiryDays', Number(e.target.value))} />
                </Field>
                <Field label="Prevent reuse of last">
                  <Input type="number" value={policy.passwordHistory} onChange={(e) => set('passwordHistory', Number(e.target.value))} />
                </Field>
              </div>
              <Field label="Reset link valid for" hint="minutes">
                <Input type="number" value={policy.resetLinkMinutes} onChange={(e) => set('resetLinkMinutes', Number(e.target.value))} />
              </Field>
            </div>
          </Card>
          <Card
            className="xl:col-span-2"
            title="Password reset requests"
            subtitle="Self-service and admin-initiated resets"
            actions={<Button size="sm" variant="outline" icon={RotateCcw} onClick={() => setResetOpen(true)}>Send reset link</Button>}
            flush
          >
            <DataTable
              data={resets}
              rowKey={(r) => r.id}
              searchKeys={['user', 'email']}
              columns={[
                { key: 'user', header: 'User', render: (r) => <div><p className="font-medium whitespace-nowrap text-slate-800">{r.user}</p><p className="text-xs text-slate-500">{r.email}</p></div> },
                { key: 'channel', header: 'Channel' },
                { key: 'ip', header: 'IP', render: (r) => <span className="font-mono text-xs">{r.ip}</span> },
                { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
                { key: 'at', header: 'Requested', render: (r) => <span className="text-xs whitespace-nowrap text-slate-500">{timeAgo(r.at)}</span> },
              ]}
            />
          </Card>
        </div>
      )}

      {tab === 'rbac' && (
        <Card title="Role → permission matrix" subtitle="Effective access for each platform role. Edit roles under Users & Access." flush>
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
                {permissionCatalog.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2.5">
                      <span className="text-slate-700">{p.label}</span> <Badge className="ml-1">{p.group}</Badge>
                    </td>
                    {roles.map((r) => (
                      <td key={r.id} className="px-2 py-2.5 text-center">
                        {r.permissions.includes(p.id) ? <Check size={16} className="mx-auto text-emerald-600" /> : <Minus size={16} className="mx-auto text-slate-300" />}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'sessions' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card title="Session timeouts" className="md:col-span-2">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Idle timeout" hint="minutes of inactivity">
                  <Select value={String(policy.sessionIdleMinutes)} options={['15', '30', '60', '120']} onChange={(e) => set('sessionIdleMinutes', Number(e.target.value))} />
                </Field>
                <Field label="Maximum session length" hint="hours, then re-authenticate">
                  <Select value={String(policy.sessionMaxHours)} options={['4', '8', '12', '24']} onChange={(e) => set('sessionMaxHours', Number(e.target.value))} />
                </Field>
              </div>
            </Card>
            <Card title="Emergency">
              <p className="mb-3 text-sm text-slate-500">Sign out every platform user except your current session.</p>
              <Button variant="danger" icon={LogOut} block onClick={() => setRevoking('all')}>Revoke all sessions</Button>
            </Card>
          </div>
          <Card flush title="Active sessions">
            <DataTable
              data={sessions}
              loading={sLoading}
              rowKey={(s) => s.id}
              searchKeys={['user', 'ip', 'location', 'device']}
              columns={[
                { key: 'user', header: 'User', render: (s) => <div><p className="font-medium whitespace-nowrap text-slate-800">{s.user} {s.current && <Badge tone="green">This device</Badge>}</p><p className="text-xs text-slate-500">{s.role}</p></div> },
                { key: 'device', header: 'Device', render: (s) => <span className="flex items-center gap-2 whitespace-nowrap"><Laptop size={14} className="text-slate-400" /> {s.device} · {s.browser}</span> },
                { key: 'ip', header: 'IP', render: (s) => <span className="font-mono text-xs">{s.ip}</span> },
                { key: 'location', header: 'Location', render: (s) => <span className="whitespace-nowrap">{s.location}</span> },
                { key: 'startedAt', header: 'Signed in', render: (s) => <span className="text-xs whitespace-nowrap">{timeAgo(s.startedAt)}</span> },
                { key: 'lastSeen', header: 'Last seen', render: (s) => <span className="text-xs whitespace-nowrap">{s.current ? 'Now' : timeAgo(s.lastSeen)}</span> },
                { key: 'act', header: '', align: 'right', render: (s) => !s.current && <Button size="xs" variant="outline" icon={LogOut} onClick={() => setRevoking(s)}>Revoke</Button> },
              ]}
            />
          </Card>
        </div>
      )}

      {tab === 'activity' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-2" title="Login attempts" subtitle="Successful vs failed — last 7 days">
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={loginTrend} margin={{ left: -20, right: 8 }}>
                    <CartesianGrid {...chartGrid} vertical={false} />
                    <XAxis dataKey="d" {...chartAxis} />
                    <YAxis {...chartAxis} />
                    <Tooltip {...chartTooltip} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="success" name="Successful" stackId="a" fill={chartColors[2]} />
                    <Bar dataKey="failed" name="Failed" stackId="a" fill={chartColors[5]} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card title="Recent login events" flush>
              <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
                {(lLoading ? [] : logins).map((l) => (
                  <li key={l.id} className="px-5 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <Badge tone={l.event.includes('failed') || l.event === 'Account locked' ? 'red' : l.event === 'Logout' ? 'gray' : 'green'} dot>{l.event}</Badge>
                      <span className="text-[11px] text-slate-400">{timeAgo(l.at)}</span>
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-600">{l.user}</p>
                    <p className="text-[11px] text-slate-400">{l.method} · {l.ip} · {l.location}</p>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
          <Card flush title="Audit log" subtitle="Immutable record of privileged actions">
            <DataTable
              data={audits.filter((a) => !auditFilter || a.category === auditFilter)}
              rowKey={(a) => a.id}
              searchKeys={['actor', 'action', 'target']}
              toolbar={
                <>
                  <Select className="h-9 w-36" placeholder="All categories" options={['Security', 'Tenant', 'Billing', 'Config', 'User']} value={auditFilter} onChange={(e) => setAuditFilter(e.target.value)} />
                  <Button size="sm" variant="outline" onClick={() => notify('Audit log exported (CSV)', 'info')}>Export</Button>
                </>
              }
              columns={[
                { key: 'at', header: 'Time', sortable: true, render: (a) => <span className="text-xs whitespace-nowrap">{formatDate(a.at, true)}</span> },
                { key: 'actor', header: 'Actor', render: (a) => <span className="whitespace-nowrap">{a.actor}</span> },
                { key: 'action', header: 'Action', render: (a) => <span className="font-medium text-slate-800">{a.action}</span> },
                { key: 'target', header: 'Target' },
                { key: 'category', header: 'Category', render: (a) => <Badge tone={a.category === 'Security' ? 'red' : a.category === 'Billing' ? 'green' : a.category === 'Tenant' ? 'orange' : 'blue'}>{a.category}</Badge> },
                { key: 'ip', header: 'IP', render: (a) => <span className="font-mono text-xs">{a.ip}</span> },
              ]}
            />
          </Card>
        </div>
      )}

      <Modal
        open={!!revoking}
        onClose={() => setRevoking(null)}
        size="sm"
        title={revoking === 'all' ? 'Revoke all sessions?' : 'Revoke session?'}
        description={revoking === 'all' ? 'Every other platform user will be signed out immediately.' : revoking ? `${revoking.user} on ${revoking.device} (${revoking.location}) will be signed out.` : ''}
        footer={
          <>
            <Button variant="outline" onClick={() => setRevoking(null)}>Cancel</Button>
            <Button variant="danger" onClick={doRevoke}>Revoke</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">This action is recorded in the audit log.</p>
      </Modal>

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        size="sm"
        title="Send password reset link"
        footer={
          <>
            <Button variant="outline" onClick={() => setResetOpen(false)}>Cancel</Button>
            <Button
              disabled={!/\S+@\S+/.test(resetEmail)}
              onClick={() => {
                notify(`Reset link sent to ${resetEmail} (valid ${policy.resetLinkMinutes} min)`)
                setResetOpen(false)
                setResetEmail('')
              }}
            >
              Send link
            </Button>
          </>
        }
      >
        <Field label="User email">
          <Input type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} placeholder="name@restaurantos.io" />
        </Field>
      </Modal>
    </div>
  )
}
