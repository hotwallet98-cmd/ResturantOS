import {
  Bot,
  Cpu,
  CreditCard,
  Flag,
  Gauge,
  Globe2,
  KeyRound,
  Mail,
  MessageCircle,
  MessageSquare,
  Pencil,
  Plug,
  RefreshCw,
  Save,
  Settings2,
} from 'lucide-react'
import { useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
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
  SectionTitle,
  Select,
  StatCard,
  StatusBadge,
  Tabs,
  Toggle,
  useToast,
} from '@/shared/components/ui'
import { useAsync } from '@/shared/hooks/useAsync'
import { chartAxis, chartColors, chartGrid, chartTooltip } from '@/shared/lib/chart'
import { cn } from '@/shared/lib/cn'
import { formatCurrency, formatNumber, timeAgo } from '@/shared/lib/format'
import {
  getAIModelConfigs,
  getAIUsage,
  getAIUsageLimits,
  getFeatureFlags,
  getGlobalSettings,
  getIntegrations,
  saveAIModelConfig,
  saveAIUsageLimits,
  saveGlobalSettings,
  updateFeatureFlag,
  updateIntegration,
} from '@/shared/services/admin'
import type { AIModelConfig, Integration } from '@/shared/services/admin'

type TabId = 'global' | 'payments' | 'messaging' | 'ai' | 'integrations' | 'flags' | 'usage'

const providerModels: Record<AIModelConfig['provider'], string[]> = {
  Anthropic: ['claude-opus-4-1', 'claude-sonnet-4-5', 'claude-haiku-4-5'],
  OpenAI: ['gpt-4o', 'gpt-4o-mini', 'o3-mini'],
  Google: ['gemini-2.0-flash', 'gemini-1.5-pro'],
  'Azure OpenAI': ['gpt-4o', 'gpt-4o-mini'],
}

function IntegrationCard({ i, onToggle, onConfigure }: { i: Integration; onToggle: () => void; onConfigure: () => void }) {
  const connected = i.status !== 'Disconnected'
  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-700">{i.name.slice(0, 2)}</span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-slate-900">{i.name}</p>
          <p className="text-xs text-slate-500">{i.description}</p>
        </div>
        <StatusBadge status={i.status} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
        {i.mode && <Badge tone={i.mode === 'Live' ? 'green' : 'yellow'}>{i.mode}</Badge>}
        <span>{i.tenants} restaurants</span>
        <span>Synced {timeAgo(i.lastSync)}</span>
      </div>
      {i.apiKey && <p className="mt-2 truncate font-mono text-xs text-slate-400">{i.apiKey}</p>}
      <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
        <Button size="xs" variant="outline" icon={Pencil} onClick={onConfigure}>Configure</Button>
        <Button size="xs" variant={connected ? 'ghost' : 'primary'} onClick={onToggle}>
          {connected ? 'Disconnect' : 'Connect'}
        </Button>
      </div>
    </div>
  )
}

export default function PlatformConfig() {
  const notify = useToast()
  const [tab, setTab] = useState<TabId>('global')
  const { data: settings, setData: setSettings, loading } = useAsync(getGlobalSettings)
  const { data: integrations = [], setData: setIntegrations } = useAsync(getIntegrations)
  const { data: models = [], setData: setModels } = useAsync(getAIModelConfigs)
  const { data: flags = [], setData: setFlags, loading: flagsLoading } = useAsync(getFeatureFlags)
  const { data: usage } = useAsync(getAIUsage)
  const { data: limits, setData: setLimits } = useAsync(getAIUsageLimits)
  const [configuring, setConfiguring] = useState<Integration | null>(null)
  const [keyDraft, setKeyDraft] = useState('')
  const [editingModel, setEditingModel] = useState<AIModelConfig | null>(null)
  const [saving, setSaving] = useState(false)

  if (loading || !settings) return <LoadingState label="Loading configuration…" />

  const byCat = (...cats: Integration['category'][]) => integrations.filter((i) => cats.includes(i.category))

  const toggleIntegration = async (i: Integration) => {
    const status: Integration['status'] = i.status === 'Disconnected' ? 'Connected' : 'Disconnected'
    setIntegrations((l) => l?.map((x) => (x.id === i.id ? { ...x, status, lastSync: new Date().toISOString() } : x)))
    await updateIntegration(i.id, { status })
    notify(`${i.name} ${status === 'Connected' ? 'connected' : 'disconnected'}`)
  }

  const configure = (i: Integration) => {
    setConfiguring(i)
    setKeyDraft('')
  }

  const saveSettings = async () => {
    setSaving(true)
    await saveGlobalSettings(settings)
    setSaving(false)
    notify('Global settings saved')
  }

  const integrationGrid = (list: Integration[]) => (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {list.map((i) => (
        <IntegrationCard key={i.id} i={i} onToggle={() => toggleIntegration(i)} onConfigure={() => configure(i)} />
      ))}
    </div>
  )

  const totalCost = usage?.trend.reduce((a, d) => a + d.cost, 0) ?? 0

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Settings2}
        title="Platform Configuration & Integrations"
        description="System-wide settings, payment and messaging providers, AI models, integrations and feature flags."
        actions={
          tab === 'global' && (
            <Button icon={Save} loading={saving} onClick={saveSettings}>
              Save settings
            </Button>
          )
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Connected integrations" value={`${integrations.filter((i) => i.status !== 'Disconnected').length}/${integrations.length}`} icon={Plug} tone="brand" />
        <StatCard label="Integrations with issues" value={integrations.filter((i) => i.status === 'Degraded' || i.status === 'Failed').length} icon={RefreshCw} tone="red" />
        <StatCard label="Feature flags on" value={flags.filter((f) => f.enabled).length} icon={Flag} tone="purple" hint={`of ${flags.length}`} />
        <StatCard label="AI spend (14d)" value={formatCurrency(totalCost)} icon={Cpu} tone="teal" delta={9.1} />
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'global', label: 'Global settings', icon: Globe2 },
          { id: 'payments', label: 'Payment gateways', icon: CreditCard },
          { id: 'messaging', label: 'Email / SMS / WhatsApp', icon: MessageSquare },
          { id: 'ai', label: 'AI providers & models', icon: Bot },
          { id: 'integrations', label: 'API & third-party', icon: Plug },
          { id: 'flags', label: 'Feature flags & modules', icon: Flag },
          { id: 'usage', label: 'AI usage limits', icon: Gauge },
        ]}
      />

      {tab === 'global' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Card className="xl:col-span-2" title="General">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Platform name">
                <Input value={settings.platformName} onChange={(e) => setSettings({ ...settings, platformName: e.target.value })} />
              </Field>
              <Field label="Support email">
                <Input value={settings.supportEmail} onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })} />
              </Field>
              <Field label="Default currency">
                <Select value={settings.defaultCurrency} options={['USD', 'PKR', 'AED', 'GBP', 'SAR']} onChange={(e) => setSettings({ ...settings, defaultCurrency: e.target.value })} />
              </Field>
              <Field label="Default timezone">
                <Select value={settings.defaultTimezone} options={['Asia/Karachi', 'Asia/Dubai', 'Europe/London', 'UTC']} onChange={(e) => setSettings({ ...settings, defaultTimezone: e.target.value })} />
              </Field>
              <Field label="Default language">
                <Select value={settings.defaultLanguage} options={['English', 'Urdu', 'Arabic']} onChange={(e) => setSettings({ ...settings, defaultLanguage: e.target.value })} />
              </Field>
              <Field label="Data residency region">
                <Select value={settings.dataRegion} options={['Middle East (Bahrain)', 'Europe (London)', 'Asia Pacific (Mumbai)']} onChange={(e) => setSettings({ ...settings, dataRegion: e.target.value })} />
              </Field>
              <Field label="Data retention" hint="days of order & audit history">
                <Input type="number" value={settings.dataRetentionDays} onChange={(e) => setSettings({ ...settings, dataRetentionDays: Number(e.target.value) })} />
              </Field>
            </div>
          </Card>
          <Card title="Platform behaviour">
            <div className="space-y-5">
              <Toggle checked={settings.allowSelfSignup} onChange={(v) => setSettings({ ...settings, allowSelfSignup: v })} label="Allow restaurant self sign-up" description="Applications enter the onboarding pipeline" />
              <Toggle checked={settings.requireVerification} onChange={(v) => setSettings({ ...settings, requireVerification: v })} label="Require document verification" description="Before a workspace is provisioned" />
              <Toggle checked={settings.maintenanceMode} onChange={(v) => setSettings({ ...settings, maintenanceMode: v })} label="Maintenance mode" description="Shows a banner and blocks non-admin logins" />
              {settings.maintenanceMode && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Maintenance mode will sign out restaurant staff once saved.</p>}
            </div>
          </Card>
        </div>
      )}

      {tab === 'payments' && (
        <div className="space-y-4">
          <SectionTitle>Payment gateways used for tenant billing and in-restaurant payments</SectionTitle>
          {integrationGrid(byCat('Payment'))}
        </div>
      )}

      {tab === 'messaging' && (
        <div className="space-y-6">
          {integrationGrid(byCat('Messaging'))}
          <Card title="Message templates" subtitle="Platform-level templates used by all restaurants" flush>
            <DataTable
              rowKey={(t) => t.name}
              data={[
                { name: 'welcome_owner', channel: 'Email', status: 'Approved', sent: 214 },
                { name: 'otp_login', channel: 'SMS', status: 'Approved', sent: 8921 },
                { name: 'order_ready_v3', channel: 'WhatsApp', status: 'Rejected', sent: 0 },
                { name: 'order_ready_v2', channel: 'WhatsApp', status: 'Approved', sent: 40213 },
                { name: 'renewal_reminder', channel: 'Email', status: 'Approved', sent: 79 },
                { name: 'payment_failed', channel: 'SMS', status: 'Approved', sent: 12 },
              ]}
              columns={[
                { key: 'name', header: 'Template', render: (t) => <span className="font-mono text-xs">{t.name}</span> },
                {
                  key: 'channel',
                  header: 'Channel',
                  render: (t) => (
                    <span className="flex items-center gap-1.5">
                      {t.channel === 'Email' ? <Mail size={14} /> : t.channel === 'SMS' ? <MessageSquare size={14} /> : <MessageCircle size={14} />} {t.channel}
                    </span>
                  ),
                },
                { key: 'status', header: 'Status', render: (t) => <StatusBadge status={t.status} /> },
                { key: 'sent', header: 'Sent (30d)', align: 'right', render: (t) => formatNumber(t.sent) },
              ]}
            />
          </Card>
        </div>
      )}

      {tab === 'ai' && (
        <div className="space-y-6">
          {integrationGrid(byCat('AI'))}
          <Card title="Model routing per AI feature" subtitle="Which provider and model powers each AI capability, with fallback" flush>
            <DataTable
              data={models}
              rowKey={(m) => m.id}
              columns={[
                { key: 'feature', header: 'Feature', render: (m) => <span className="font-medium whitespace-nowrap text-slate-800">{m.feature}</span> },
                { key: 'provider', header: 'Provider', render: (m) => <Badge tone="purple">{m.provider}</Badge> },
                { key: 'model', header: 'Model', render: (m) => <span className="font-mono text-xs">{m.model}</span> },
                { key: 'temperature', header: 'Temp.', align: 'center' },
                { key: 'maxTokens', header: 'Max tokens', align: 'right', render: (m) => formatNumber(m.maxTokens) },
                { key: 'fallback', header: 'Fallback', render: (m) => <span className="font-mono text-xs text-slate-500">{m.fallback}</span> },
                {
                  key: 'enabled',
                  header: 'Enabled',
                  render: (m) => (
                    <Toggle
                      checked={m.enabled}
                      onChange={async (v) => {
                        const next = { ...m, enabled: v }
                        setModels((l) => l?.map((x) => (x.id === m.id ? next : x)))
                        await saveAIModelConfig(next)
                        notify(`${m.feature} ${v ? 'enabled' : 'disabled'}`)
                      }}
                    />
                  ),
                },
                { key: 'act', header: '', align: 'right', render: (m) => <Button size="xs" variant="outline" icon={Pencil} onClick={() => setEditingModel(m)}>Edit</Button> },
              ]}
            />
          </Card>
        </div>
      )}

      {tab === 'integrations' && (
        <div className="space-y-6">
          <Card title="Platform API" subtitle="Public REST API & webhooks for partners and restaurants">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">API requests (24h)</p>
                <p className="text-xl font-semibold text-slate-900">1.24M</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Active API keys</p>
                <p className="text-xl font-semibold text-slate-900">38</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Rate limit</p>
                <p className="text-xl font-semibold text-slate-900">600 req/min/tenant</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" icon={KeyRound} onClick={() => notify('New platform API key generated', 'info')}>Generate API key</Button>
              <Button size="sm" variant="ghost" onClick={() => notify('Webhook test event sent')}>Send test webhook</Button>
            </div>
          </Card>
          {integrationGrid(byCat('Delivery', 'Accounting', 'Maps', 'Social', 'Analytics'))}
        </div>
      )}

      {tab === 'flags' && (
        <Card flush title="Feature flags & module controls" subtitle="Roll out features gradually and restrict them by plan">
          <DataTable
            data={flags}
            loading={flagsLoading}
            rowKey={(f) => f.id}
            searchKeys={['name', 'key', 'module']}
            columns={[
              { key: 'name', header: 'Feature', render: (f) => <div className="min-w-56"><p className="font-medium text-slate-800">{f.name}</p><p className="font-mono text-[11px] text-slate-400">{f.key}</p><p className="text-xs text-slate-500">{f.description}</p></div> },
              { key: 'module', header: 'Module', render: (f) => <Badge>{f.module}</Badge> },
              { key: 'plans', header: 'Plans', render: (f) => <div className="flex flex-wrap gap-1">{f.plans.map((p) => <Badge key={p} tone="purple">{p}</Badge>)}</div> },
              {
                key: 'rollout',
                header: 'Rollout',
                render: (f) => (
                  <div className="flex w-44 items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={f.rollout}
                      disabled={!f.enabled}
                      aria-label={`Rollout for ${f.name}`}
                      className="flex-1 accent-brand-600"
                      onChange={(e) => setFlags((l) => l?.map((x) => (x.id === f.id ? { ...x, rollout: Number(e.target.value) } : x)))}
                      onMouseUp={() => updateFeatureFlag(f.id, { rollout: f.rollout }).then(() => notify(`${f.name} rolled out to ${f.rollout}%`))}
                    />
                    <span className="w-9 text-right text-xs font-medium">{f.rollout}%</span>
                  </div>
                ),
              },
              {
                key: 'enabled',
                header: 'On',
                render: (f) => (
                  <Toggle
                    checked={f.enabled}
                    onChange={async (v) => {
                      setFlags((l) => l?.map((x) => (x.id === f.id ? { ...x, enabled: v, rollout: v && x.rollout === 0 ? 10 : x.rollout } : x)))
                      await updateFeatureFlag(f.id, { enabled: v })
                      notify(`${f.name} ${v ? 'enabled' : 'disabled'}`)
                    }}
                  />
                ),
              },
            ]}
          />
        </Card>
      )}

      {tab === 'usage' && usage && limits && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-2" title="AI token usage" subtitle="Daily tokens across all tenants — last 14 days">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={usage.trend} margin={{ left: -5, right: 8 }}>
                    <defs>
                      <linearGradient id="tokFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={chartColors[6]} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={chartColors[6]} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid {...chartGrid} vertical={false} />
                    <XAxis dataKey="d" {...chartAxis} />
                    <YAxis {...chartAxis} tickFormatter={(v: number) => formatNumber(v, true)} />
                    <Tooltip {...chartTooltip} />
                    <Area type="monotone" dataKey="tokens" name="Tokens" stroke={chartColors[6]} strokeWidth={2} fill="url(#tokFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card title="Usage by feature">
              <ul className="space-y-3">
                {usage.byFeature.map((f, i) => (
                  <li key={f.feature}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="flex items-center gap-2 text-slate-700">
                        <span className="h-2 w-2 rounded-full" style={{ background: chartColors[i] }} />
                        {f.feature}
                      </span>
                      <span className="font-medium">{f.share}%</span>
                    </div>
                    <ProgressBar value={f.share} max={40} tone="purple" />
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <Card
              title="AI credit limits per plan"
              actions={
                <Button size="sm" icon={Save} onClick={async () => { await saveAIUsageLimits(limits); notify('AI usage limits saved') }}>
                  Save
                </Button>
              }
            >
              <div className="space-y-3">
                {(['starter', 'growth', 'pro', 'enterprise'] as const).map((k) => (
                  <Field key={k} label={`${k[0]!.toUpperCase()}${k.slice(1)} — credits / month`}>
                    <Input type="number" value={limits[k]} onChange={(e) => setLimits({ ...limits, [k]: Number(e.target.value) })} />
                  </Field>
                ))}
                <Field label="Alert tenants at" hint="% of monthly credits">
                  <Input type="number" value={limits.alertAt} onChange={(e) => setLimits({ ...limits, alertAt: Number(e.target.value) })} />
                </Field>
                <Field label="Platform monthly AI budget (USD)">
                  <Input type="number" value={limits.monthlyBudget} onChange={(e) => setLimits({ ...limits, monthlyBudget: Number(e.target.value) })} />
                </Field>
                <Toggle checked={limits.hardStop} onChange={(v) => setLimits({ ...limits, hardStop: v })} label="Hard stop at limit" description="Otherwise overage is billed at $0.01 / credit" />
              </div>
            </Card>
            <Card className="xl:col-span-2" title="Tenant AI consumption" subtitle="Current billing period" flush>
              <DataTable
                data={usage.byTenant}
                rowKey={(t) => t.tenant}
                columns={[
                  { key: 'tenant', header: 'Restaurant', render: (t) => <span className="font-medium whitespace-nowrap text-slate-800">{t.tenant}</span> },
                  { key: 'plan', header: 'Plan', render: (t) => <Badge tone="purple">{t.plan}</Badge> },
                  {
                    key: 'used',
                    header: 'Credits used',
                    sortable: true,
                    sortValue: (t) => t.used / t.limit,
                    render: (t) => (
                      <div className="w-48">
                        <div className="mb-1 flex justify-between text-xs text-slate-500">
                          <span>{formatNumber(t.used)} / {formatNumber(t.limit)}</span>
                        </div>
                        <ProgressBar value={t.used} max={t.limit} tone={t.used >= t.limit ? 'red' : t.used / t.limit > limits.alertAt / 100 ? 'yellow' : 'green'} showLabel />
                      </div>
                    ),
                  },
                  { key: 'cost', header: 'Cost', align: 'right', sortable: true, render: (t) => formatCurrency(t.cost) },
                  { key: 'act', header: '', align: 'right', render: (t) => t.used >= t.limit && <Button size="xs" variant="outline" onClick={() => notify(`+20% temporary credits granted to ${t.tenant}`)}>Top up</Button> },
                ]}
              />
            </Card>
          </div>

          <AIInsights
            title="AI Usage Monitoring"
            subtitle="Cost & consumption anomalies"
            onAction={(i) => notify(`${i.action} — applied`)}
            insights={[
              ...((usage?.byTenant ?? []).filter((t) => t.limit > 0 && t.used >= t.limit).map((t) => ({ title: `${t.tenant} reached its AI limit`, detail: `${t.used} of ${t.limit} credits are recorded.`, severity: 'warning' as const, action: 'Review limits' }))),
              { title: 'Current AI spend', detail: `Recorded spend is ${formatCurrency(totalCost)} against a ${formatCurrency(limits.monthlyBudget)} monthly budget.`, severity: totalCost > limits.monthlyBudget && limits.monthlyBudget > 0 ? 'warning' as const : 'success' as const, metric: formatCurrency(totalCost) },
            ]}
          />
        </div>
      )}

      <Modal
        open={!!configuring}
        onClose={() => setConfiguring(null)}
        title={`Configure ${configuring?.name ?? ''}`}
        description={configuring?.description}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfiguring(null)}>Cancel</Button>
            <Button
              onClick={async () => {
                if (!configuring) return
                const patch: Partial<Integration> = { status: 'Connected', lastSync: new Date().toISOString(), ...(keyDraft ? { apiKey: `${keyDraft.slice(0, 4)}••••••••${keyDraft.slice(-4)}` } : {}) }
                setIntegrations((l) => l?.map((x) => (x.id === configuring.id ? { ...x, ...patch } : x)))
                await updateIntegration(configuring.id, patch)
                notify(`${configuring.name} configuration saved & tested`)
                setConfiguring(null)
              }}
            >
              Save & test connection
            </Button>
          </>
        }
      >
        {configuring && (
          <div className="space-y-4">
            <Field label="API key / secret" hint={configuring.apiKey ? `Current: ${configuring.apiKey}` : 'Not configured'}>
              <Input type="password" value={keyDraft} onChange={(e) => setKeyDraft(e.target.value)} placeholder="Paste a new key to rotate" />
            </Field>
            {configuring.mode && (
              <Field label="Environment">
                <Select
                  value={configuring.mode}
                  options={['Live', 'Sandbox']}
                  onChange={(e) => setConfiguring({ ...configuring, mode: e.target.value as Integration['mode'] })}
                />
              </Field>
            )}
            <Field label="Webhook URL">
              <Input readOnly value={`https://api.restaurantos.io/webhooks/${configuring.name.toLowerCase().replace(/[^a-z]+/g, '-')}`} className="font-mono text-xs" />
            </Field>
            <div className={cn('rounded-lg px-3 py-2 text-xs', configuring.status === 'Connected' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>
              Status: {configuring.status} · last sync {timeAgo(configuring.lastSync)}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!editingModel}
        onClose={() => setEditingModel(null)}
        title={`AI model — ${editingModel?.feature ?? ''}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditingModel(null)}>Cancel</Button>
            <Button
              onClick={async () => {
                if (!editingModel) return
                setModels((l) => l?.map((x) => (x.id === editingModel.id ? editingModel : x)))
                await saveAIModelConfig(editingModel)
                notify(`${editingModel.feature} now uses ${editingModel.model}`)
                setEditingModel(null)
              }}
            >
              Save
            </Button>
          </>
        }
      >
        {editingModel && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Provider">
              <Select
                value={editingModel.provider}
                options={Object.keys(providerModels)}
                onChange={(e) => {
                  const provider = e.target.value as AIModelConfig['provider']
                  setEditingModel({ ...editingModel, provider, model: providerModels[provider][0]! })
                }}
              />
            </Field>
            <Field label="Model">
              <Select value={editingModel.model} options={providerModels[editingModel.provider]} onChange={(e) => setEditingModel({ ...editingModel, model: e.target.value })} />
            </Field>
            <Field label="Temperature">
              <Input type="number" step={0.1} min={0} max={1} value={editingModel.temperature} onChange={(e) => setEditingModel({ ...editingModel, temperature: Number(e.target.value) })} />
            </Field>
            <Field label="Max tokens">
              <Input type="number" value={editingModel.maxTokens} onChange={(e) => setEditingModel({ ...editingModel, maxTokens: Number(e.target.value) })} />
            </Field>
            <Field label="Fallback model" className="sm:col-span-2">
              <Input value={editingModel.fallback} onChange={(e) => setEditingModel({ ...editingModel, fallback: e.target.value })} />
            </Field>
          </div>
        )}
      </Modal>
    </div>
  )
}
