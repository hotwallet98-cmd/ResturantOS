import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  ClipboardList,
  Copy,
  FileUp,
  GitBranch,
  KanbanSquare,
  List,
  Loader2,
  Mail,
  Plus,
  Rocket,
  Send,
  Trash2,
  UserPlus,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  AIInsights,
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  DataTable,
  DescriptionList,
  Field,
  Input,
  PageHeader,
  ProgressBar,
  SectionTitle,
  Select,
  StatCard,
  StatusBadge,
  Stepper,
  Tabs,
  Toggle,
  useToast,
} from '@/shared/components/ui'
import { useAsync } from '@/shared/hooks/useAsync'
import { cn } from '@/shared/lib/cn'
import { formatCurrency, timeAgo } from '@/shared/lib/format'
import {
  getOnboardingApplications,
  moduleCatalog,
  onboardingStages,
  plans,
  restaurantTypes,
  serviceModels,
  submitOnboarding,
  updateOnboardingApplication,
} from '@/shared/services/admin'
import type { OnboardingApplication, OnboardingStage, PlanName } from '@/shared/services/admin'

const steps = [
  { id: 'business', label: 'Business registration', description: 'Legal entity & verification' },
  { id: 'type', label: 'Restaurant type & service', description: 'Concept and service model' },
  { id: 'owner', label: 'Owner & contact', description: 'Primary owner details' },
  { id: 'branches', label: 'Single / multi-branch', description: 'Register locations' },
  { id: 'subscription', label: 'Subscription & modules', description: 'Plan and add-ons' },
  { id: 'admin', label: 'Restaurant admin account', description: 'First admin user' },
  { id: 'provision', label: 'Workspace provisioning', description: 'Tenant infrastructure' },
  { id: 'activate', label: 'Activation & invitation', description: 'Go live & invite' },
]

interface BranchDraft {
  name: string
  city: string
  address: string
}

interface WizardState {
  legalName: string
  tradeName: string
  regNumber: string
  taxId: string
  country: string
  docs: { registration: boolean; tax: boolean; foodLicence: boolean }
  type: string
  cuisine: string
  services: string[]
  seats: string
  ownerName: string
  ownerEmail: string
  ownerPhone: string
  ownerCnic: string
  multiBranch: boolean
  branches: BranchDraft[]
  plan: PlanName
  cycle: 'Monthly' | 'Yearly'
  modules: string[]
  trial: boolean
  adminName: string
  adminEmail: string
  adminPhone: string
  sameAsOwner: boolean
  requireMfa: boolean
  subdomain: string
  sendWelcome: boolean
  notifyWhatsApp: boolean
}

const emptyWizard = (): WizardState => ({
  legalName: '',
  tradeName: '',
  regNumber: '',
  taxId: '',
  country: 'Pakistan',
  docs: { registration: false, tax: false, foodLicence: false },
  type: 'Casual Dining',
  cuisine: '',
  services: ['Dine-in', 'Takeaway'],
  seats: '60',
  ownerName: '',
  ownerEmail: '',
  ownerPhone: '',
  ownerCnic: '',
  multiBranch: false,
  branches: [{ name: 'Main branch', city: 'Karachi', address: '' }],
  plan: 'Pro',
  cycle: 'Monthly',
  modules: plans[1]!.modules,
  trial: true,
  adminName: '',
  adminEmail: '',
  adminPhone: '',
  sameAsOwner: true,
  requireMfa: true,
  subdomain: '',
  sendWelcome: true,
  notifyWhatsApp: true,
})

const provisioningTasks = [
  'Creating isolated tenant database schema',
  'Applying default chart of accounts & tax rules',
  'Seeding menu categories and sample items',
  'Configuring branches, tables and printers',
  'Enabling subscribed modules',
  'Issuing SSL certificate for workspace subdomain',
  'Creating restaurant admin account',
  'Running health checks',
]

const stageTone: Record<OnboardingStage, string> = {
  Submitted: 'border-t-slate-400',
  Verification: 'border-t-amber-400',
  Configuration: 'border-t-sky-400',
  Provisioning: 'border-t-violet-400',
  Invited: 'border-t-brand-400',
  Live: 'border-t-emerald-500',
}

const nextStage = (s: OnboardingStage): OnboardingStage => onboardingStages[Math.min(onboardingStages.indexOf(s) + 1, onboardingStages.length - 1)]!

export default function TenantOnboarding() {
  const notify = useToast()
  const { data: apps = [], setData, loading } = useAsync(getOnboardingApplications)
  const [mode, setMode] = useState<'pipeline' | 'wizard'>('pipeline')
  const [view, setView] = useState<'board' | 'list'>('board')
  const [step, setStep] = useState(0)
  const [w, setW] = useState<WizardState>(emptyWizard)
  const [provisioned, setProvisioned] = useState(0)
  const [activated, setActivated] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const set = <K extends keyof WizardState>(k: K, v: WizardState[K]) => setW((p) => ({ ...p, [k]: v }))

  // Animated provisioning checklist
  useEffect(() => {
    if (mode !== 'wizard' || step !== 6 || provisioned >= provisioningTasks.length) return
    const t = setTimeout(() => setProvisioned((n) => n + 1), 650)
    return () => clearTimeout(t)
  }, [mode, step, provisioned])

  const advance = async (app: OnboardingApplication) => {
    const stage = nextStage(app.stage)
    const progress = Math.min(100, Math.round(((onboardingStages.indexOf(stage) + 1) / onboardingStages.length) * 100))
    setData((prev) => prev?.map((a) => (a.id === app.id ? { ...a, stage, progress, blocker: undefined } : a)))
    await updateOnboardingApplication(app.id, { stage, progress })
    notify(`${app.restaurant} moved to ${stage}`)
  }

  const startWizard = () => {
    setW(emptyWizard())
    setStep(0)
    setProvisioned(0)
    setActivated(false)
    setMode('wizard')
  }

  const name = w.tradeName || w.legalName || 'New restaurant'
  const subdomain = w.subdomain || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const selectedPlan = plans.find((p) => p.name === w.plan)!

  const canNext = (() => {
    if (step === 0) return !!w.legalName && !!w.regNumber
    if (step === 2) return !!w.ownerName && /\S+@\S+/.test(w.ownerEmail)
    if (step === 5) return w.sameAsOwner || /\S+@\S+/.test(w.adminEmail)
    if (step === 6) return provisioned >= provisioningTasks.length
    return true
  })()

  const activate = async () => {
    setSubmitting(true)
    await submitOnboarding({ ...w, subdomain })
    const app: OnboardingApplication = {
      id: `APP-${2042 + apps.length}`,
      restaurant: name,
      owner: w.ownerName,
      email: w.ownerEmail,
      city: w.branches[0]?.city ?? 'Karachi',
      type: w.type,
      plan: w.plan,
      branches: w.branches.length,
      stage: 'Invited',
      progress: 90,
      assignee: 'Ayesha Khan',
      submittedAt: new Date().toISOString(),
    }
    setData((prev) => [app, ...(prev ?? [])])
    setSubmitting(false)
    setActivated(true)
    notify(`${name} activated — invitation sent to ${w.sameAsOwner ? w.ownerEmail : w.adminEmail}`)
  }

  if (mode === 'wizard') {
    return (
      <div className="space-y-6">
        <PageHeader
          icon={UserPlus}
          title="Onboard new restaurant"
          description="Register, verify, configure and provision a restaurant workspace in 8 steps."
          actions={
            <Button variant="outline" icon={ArrowLeft} onClick={() => setMode('pipeline')}>
              Back to pipeline
            </Button>
          }
        />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
          <Card className="hidden h-fit lg:block" bodyClassName="p-3">
            <Stepper steps={steps} current={step} onStepClick={(i) => !activated && setStep(i)} />
          </Card>
          <div className="lg:hidden">
            <Stepper steps={steps} current={step} orientation="horizontal" />
            <p className="mt-2 text-sm font-medium text-slate-700">
              Step {step + 1} of {steps.length}: {steps[step]!.label}
            </p>
          </div>

          <Card title={steps[step]!.label} subtitle={steps[step]!.description}>
            {step === 0 && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Legal business name" required>
                    <Input value={w.legalName} onChange={(e) => set('legalName', e.target.value)} placeholder="Spice Route Foods (Pvt) Ltd" />
                  </Field>
                  <Field label="Trading name">
                    <Input value={w.tradeName} onChange={(e) => set('tradeName', e.target.value)} placeholder="Spice Route Kitchen" />
                  </Field>
                  <Field label="Registration number" required hint="SECP / trade licence / Companies House number">
                    <Input value={w.regNumber} onChange={(e) => set('regNumber', e.target.value)} placeholder="0123456" />
                  </Field>
                  <Field label="Tax ID (NTN / TRN / VAT)">
                    <Input value={w.taxId} onChange={(e) => set('taxId', e.target.value)} placeholder="1234567-8" />
                  </Field>
                  <Field label="Country of registration">
                    <Select value={w.country} onChange={(e) => set('country', e.target.value)} options={['Pakistan', 'UAE', 'United Kingdom', 'Saudi Arabia']} />
                  </Field>
                </div>
                <div>
                  <SectionTitle>Verification documents</SectionTitle>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {(
                      [
                        ['registration', 'Business registration'],
                        ['tax', 'Tax certificate'],
                        ['foodLicence', 'Food safety licence'],
                      ] as const
                    ).map(([k, label]) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => set('docs', { ...w.docs, [k]: !w.docs[k] })}
                        className={cn(
                          'flex flex-col items-center gap-2 rounded-lg border-2 border-dashed p-4 text-center text-sm transition',
                          w.docs[k] ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500 hover:border-brand-300',
                        )}
                      >
                        {w.docs[k] ? <CheckCircle2 size={20} /> : <FileUp size={20} />}
                        <span className="font-medium">{label}</span>
                        <span className="text-xs">{w.docs[k] ? 'Uploaded · auto-verified' : 'Click to upload PDF / JPG'}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <SectionTitle>Restaurant type</SectionTitle>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {restaurantTypes.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => set('type', t)}
                        className={cn('rounded-lg border px-3 py-3 text-sm font-medium transition', w.type === t ? 'border-brand-500 bg-brand-50 text-brand-800 ring-2 ring-brand-500/20' : 'border-slate-200 text-slate-600 hover:border-slate-300')}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <SectionTitle>Service model</SectionTitle>
                  <div className="flex flex-wrap gap-4">
                    {serviceModels.map((s) => (
                      <Checkbox key={s} label={s} checked={w.services.includes(s)} onChange={(c) => set('services', c ? [...w.services, s] : w.services.filter((x) => x !== s))} />
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Cuisine">
                    <Input value={w.cuisine} onChange={(e) => set('cuisine', e.target.value)} placeholder="Pakistani, BBQ" />
                  </Field>
                  <Field label="Seating capacity">
                    <Input type="number" value={w.seats} onChange={(e) => set('seats', e.target.value)} />
                  </Field>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Owner full name" required>
                  <Input value={w.ownerName} onChange={(e) => set('ownerName', e.target.value)} placeholder="Omar Siddiqui" />
                </Field>
                <Field label="Email" required>
                  <Input type="email" value={w.ownerEmail} onChange={(e) => set('ownerEmail', e.target.value)} placeholder="owner@restaurant.com" />
                </Field>
                <Field label="Mobile / WhatsApp">
                  <Input value={w.ownerPhone} onChange={(e) => set('ownerPhone', e.target.value)} placeholder="+92 300 1234567" />
                </Field>
                <Field label="National ID / Passport" hint="Used for KYC verification only">
                  <Input value={w.ownerCnic} onChange={(e) => set('ownerCnic', e.target.value)} placeholder="42101-1234567-1" />
                </Field>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {[
                    { multi: false, title: 'Single branch', desc: 'One location, one menu.' },
                    { multi: true, title: 'Multi-branch', desc: 'Central menu, per-branch stock, staff and reports.' },
                  ].map((o) => (
                    <button
                      key={o.title}
                      type="button"
                      onClick={() => {
                        set('multiBranch', o.multi)
                        if (!o.multi) set('branches', w.branches.slice(0, 1))
                      }}
                      className={cn('flex items-start gap-3 rounded-lg border p-4 text-left transition', w.multiBranch === o.multi ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/20' : 'border-slate-200 hover:border-slate-300')}
                    >
                      <GitBranch size={18} className="mt-0.5 text-brand-600" />
                      <span>
                        <span className="block text-sm font-semibold text-slate-800">{o.title}</span>
                        <span className="block text-xs text-slate-500">{o.desc}</span>
                      </span>
                    </button>
                  ))}
                </div>
                <div className="space-y-3">
                  {w.branches.map((b, i) => (
                    <div key={i} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-100 p-3 sm:grid-cols-[1fr_160px_1.4fr_auto]">
                      <Input value={b.name} placeholder="Branch name" onChange={(e) => set('branches', w.branches.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                      <Select value={b.city} options={['Karachi', 'Lahore', 'Islamabad', 'Dubai', 'London']} onChange={(e) => set('branches', w.branches.map((x, j) => (j === i ? { ...x, city: e.target.value } : x)))} />
                      <Input value={b.address} placeholder="Street address" onChange={(e) => set('branches', w.branches.map((x, j) => (j === i ? { ...x, address: e.target.value } : x)))} />
                      <Button variant="ghost" size="sm" icon={Trash2} aria-label="Remove branch" disabled={w.branches.length === 1} onClick={() => set('branches', w.branches.filter((_, j) => j !== i))} />
                    </div>
                  ))}
                  {w.multiBranch && (
                    <Button variant="outline" size="sm" icon={Plus} onClick={() => set('branches', [...w.branches, { name: `Branch ${w.branches.length + 1}`, city: 'Lahore', address: '' }])}>
                      Add branch
                    </Button>
                  )}
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {plans.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setW((s) => ({ ...s, plan: p.name as PlanName, modules: p.modules }))}
                      className={cn('relative rounded-xl border p-4 text-left transition', w.plan === p.name ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/20' : 'border-slate-200 hover:border-slate-300')}
                    >
                      {p.popular && <Badge tone="orange" className="absolute top-3 right-3">Popular</Badge>}
                      <p className="font-semibold text-slate-900">{p.name}</p>
                      <p className="mt-1 text-xl font-semibold text-slate-900">
                        {formatCurrency(w.cycle === 'Yearly' ? p.yearly / 12 : p.monthly)}
                        <span className="text-xs font-normal text-slate-500">/mo</span>
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Up to {p.maxBranches > 100 ? 'unlimited' : p.maxBranches} branches · {p.modules.length} modules
                      </p>
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-6">
                  <div className="flex rounded-lg bg-slate-100 p-1 text-sm">
                    {(['Monthly', 'Yearly'] as const).map((c) => (
                      <button key={c} type="button" onClick={() => set('cycle', c)} className={cn('rounded-md px-3 py-1', w.cycle === c ? 'bg-white shadow-sm' : 'text-slate-500')}>
                        {c} {c === 'Yearly' && <span className="text-emerald-600">−17%</span>}
                      </button>
                    ))}
                  </div>
                  <Toggle checked={w.trial} onChange={(v) => set('trial', v)} label={`Start with ${selectedPlan.trialDays}-day free trial`} />
                </div>
                <div>
                  <SectionTitle>Modules ({w.modules.length})</SectionTitle>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {moduleCatalog.map((m) => (
                      <Checkbox key={m} label={m} checked={w.modules.includes(m)} onChange={(c) => set('modules', c ? [...w.modules, m] : w.modules.filter((x) => x !== m))} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-5">
                <Toggle checked={w.sameAsOwner} onChange={(v) => set('sameAsOwner', v)} label="Owner is the restaurant admin" description={w.ownerEmail ? `Admin login will be ${w.ownerEmail}` : 'Use the owner contact as the first admin user'} />
                {!w.sameAsOwner && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Field label="Admin name">
                      <Input value={w.adminName} onChange={(e) => set('adminName', e.target.value)} />
                    </Field>
                    <Field label="Admin email" required>
                      <Input type="email" value={w.adminEmail} onChange={(e) => set('adminEmail', e.target.value)} />
                    </Field>
                    <Field label="Mobile">
                      <Input value={w.adminPhone} onChange={(e) => set('adminPhone', e.target.value)} />
                    </Field>
                  </div>
                )}
                <Toggle checked={w.requireMfa} onChange={(v) => set('requireMfa', v)} label="Require MFA on first login" description="Admin must enrol an authenticator app or SMS OTP" />
                <Field label="Workspace subdomain" hint={`${subdomain || 'restaurant'}.restaurantos.app`}>
                  <Input value={w.subdomain} onChange={(e) => set('subdomain', e.target.value)} placeholder={subdomain} />
                </Field>
                <div className="rounded-lg bg-slate-50 p-4">
                  <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Admin role permissions</p>
                  <p className="mt-1 text-sm text-slate-600">Restaurant Admin — full access to all subscribed modules, branches, staff, billing and settings for this tenant.</p>
                </div>
              </div>
            )}

            {step === 6 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <ProgressBar className="flex-1" value={provisioned} max={provisioningTasks.length} showLabel tone={provisioned >= provisioningTasks.length ? 'green' : 'brand'} />
                </div>
                <ul className="space-y-2">
                  {provisioningTasks.map((t, i) => {
                    const done = i < provisioned
                    const running = i === provisioned
                    return (
                      <li key={t} className={cn('flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition', done ? 'border-emerald-100 bg-emerald-50/50 text-slate-700' : running ? 'border-brand-200 bg-brand-50/50 text-slate-800' : 'border-slate-100 text-slate-400')}>
                        {done ? <CheckCircle2 size={17} className="text-emerald-500" /> : running ? <Loader2 size={17} className="animate-spin text-brand-500" /> : <span className="h-4 w-4 rounded-full border-2 border-slate-200" />}
                        {t}
                      </li>
                    )
                  })}
                </ul>
                {provisioned >= provisioningTasks.length && (
                  <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                    Workspace <b>{subdomain}.restaurantos.app</b> is ready.
                  </p>
                )}
              </div>
            )}

            {step === 7 && (
              <div className="space-y-5">
                {activated ? (
                  <div className="flex flex-col items-center py-6 text-center">
                    <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                      <Rocket size={30} />
                    </span>
                    <h3 className="mt-4 text-lg font-semibold text-slate-900">{name} is activated!</h3>
                    <p className="mt-1 max-w-md text-sm text-slate-500">
                      An invitation has been sent to {w.sameAsOwner ? w.ownerEmail : w.adminEmail}. The restaurant admin will complete their setup at <b>/setup</b>.
                    </p>
                    <div className="mt-5 flex flex-wrap justify-center gap-2">
                      <Button variant="outline" icon={Copy} onClick={() => notify('Invitation link copied', 'info')}>Copy invite link</Button>
                      <Button onClick={() => setMode('pipeline')}>Back to pipeline</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <DescriptionList
                      items={[
                        { label: 'Restaurant', value: name },
                        { label: 'Legal entity', value: w.legalName || '—' },
                        { label: 'Type', value: `${w.type} · ${w.services.join(', ')}` },
                        { label: 'Owner', value: `${w.ownerName || '—'} (${w.ownerEmail || '—'})` },
                        { label: 'Branches', value: w.branches.map((b) => `${b.name} (${b.city})`).join(', ') },
                        { label: 'Subscription', value: `${w.plan} · ${w.cycle}${w.trial ? ` · ${selectedPlan.trialDays}-day trial` : ''}` },
                        { label: 'Modules', value: `${w.modules.length} enabled` },
                        { label: 'Workspace', value: `${subdomain}.restaurantos.app` },
                      ]}
                    />
                    <div className="space-y-3 rounded-lg border border-slate-100 p-4">
                      <Toggle checked={w.sendWelcome} onChange={(v) => set('sendWelcome', v)} label="Send welcome email with activation link" />
                      <Toggle checked={w.notifyWhatsApp} onChange={(v) => set('notifyWhatsApp', v)} label="Also notify owner on WhatsApp" />
                    </div>
                  </>
                )}
              </div>
            )}

            {!activated && (
              <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                <Button variant="ghost" icon={ArrowLeft} disabled={step === 0} onClick={() => setStep(step - 1)}>
                  Back
                </Button>
                {step < steps.length - 1 ? (
                  <Button iconRight={ArrowRight} disabled={!canNext} onClick={() => setStep(step + 1)}>
                    {step === 5 ? 'Provision workspace' : 'Continue'}
                  </Button>
                ) : (
                  <Button variant="success" icon={Send} loading={submitting} onClick={activate}>
                    Activate & send invitation
                  </Button>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    )
  }

  const byStage = (s: OnboardingStage) => apps.filter((a) => a.stage === s)

  return (
    <div className="space-y-6">
      <PageHeader
        icon={UserPlus}
        title="Restaurant Onboarding"
        description="Track applications from registration to go-live, and onboard new restaurants."
        actions={
          <Button icon={Plus} onClick={startWizard}>
            Onboard new restaurant
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="In pipeline" value={apps.filter((a) => a.stage !== 'Live').length} icon={ClipboardList} tone="brand" />
        <StatCard label="Awaiting verification" value={byStage('Verification').length} icon={Building2} tone="amber" />
        <StatCard label="Invited / activating" value={byStage('Invited').length + byStage('Provisioning').length} icon={Mail} tone="purple" />
        <StatCard label="Median time to live" value="4.2 days" icon={Rocket} tone="green" delta={-38} invertDelta deltaLabel="vs Q2" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          variant="pills"
          value={view}
          onChange={setView}
          items={[
            { id: 'board', label: 'Pipeline', icon: KanbanSquare },
            { id: 'list', label: 'List', icon: List },
          ]}
        />
        <p className="text-xs text-slate-500">Steps: Registration → Verification → Configuration → Provisioning → Invitation → Live</p>
      </div>

      {view === 'board' ? (
        <div className="scrollbar-thin -mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          <div className="grid min-w-[1100px] grid-cols-6 gap-4">
            {onboardingStages.map((s) => (
              <div key={s} className={cn('rounded-xl border border-t-4 border-slate-200 bg-slate-50/70 p-3', stageTone[s])}>
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-800">{s}</p>
                  <Badge>{byStage(s).length}</Badge>
                </div>
                <div className="space-y-2">
                  {loading && <div className="h-24 animate-pulse rounded-lg bg-white" />}
                  {byStage(s).map((a) => (
                    <div key={a.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                      <div className="flex items-start gap-2">
                        <Avatar name={a.restaurant} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-800">{a.restaurant}</p>
                          <p className="truncate text-xs text-slate-500">
                            {a.city} · {a.plan} · {a.branches} br.
                          </p>
                        </div>
                      </div>
                      {a.blocker && <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-700">{a.blocker}</p>}
                      <ProgressBar className="mt-2" value={a.progress} />
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">{timeAgo(a.submittedAt)}</span>
                        {s !== 'Live' && (
                          <button type="button" onClick={() => advance(a)} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700">
                            <Check size={12} /> Advance
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <Card flush>
          <DataTable
            data={apps}
            loading={loading}
            rowKey={(a) => a.id}
            searchKeys={['restaurant', 'owner', 'city', 'id']}
            columns={[
              { key: 'id', header: 'Application', render: (a) => <span className="font-mono text-xs">{a.id}</span> },
              { key: 'restaurant', header: 'Restaurant', sortable: true, render: (a) => <span className="font-medium whitespace-nowrap text-slate-800">{a.restaurant}</span> },
              { key: 'owner', header: 'Owner' },
              { key: 'city', header: 'City', sortable: true },
              { key: 'plan', header: 'Plan', render: (a) => <Badge tone="purple">{a.plan}</Badge> },
              { key: 'stage', header: 'Stage', sortable: true, sortValue: (a) => onboardingStages.indexOf(a.stage), render: (a) => <StatusBadge status={a.stage === 'Verification' ? 'In Review' : a.stage === 'Live' ? 'Live' : a.stage} /> },
              { key: 'progress', header: 'Progress', render: (a) => <ProgressBar className="w-28" value={a.progress} showLabel /> },
              { key: 'assignee', header: 'Specialist' },
              {
                key: 'act',
                header: '',
                align: 'right',
                render: (a) =>
                  a.stage !== 'Live' && (
                    <Button size="xs" variant="outline" onClick={() => advance(a)}>
                      Advance
                    </Button>
                  ),
              },
            ]}
          />
        </Card>
      )}

      <AIInsights
        title="AI Onboarding Assistant"
        subtitle="Document checks and bottleneck detection"
        onAction={(i) => notify(`${i.action} — done`, 'info')}
        insights={[
          ...(apps.filter((app) => app.blocker).map((app) => ({ title: `${app.restaurant} is blocked`, detail: app.blocker!, severity: 'warning' as const, metric: `${app.progress}%`, action: 'Review application' }))),
          ...(apps.filter((app) => app.progress >= 90 && app.stage !== 'Live').map((app) => ({ title: `${app.restaurant} is ready for the final step`, detail: `The application is ${app.progress}% complete at the ${app.stage} stage.`, severity: 'opportunity' as const, action: 'Review application' }))),
          ...(!apps.length ? [{ title: 'No onboarding applications', detail: 'New submissions will appear here from the PostgreSQL onboarding queue.', severity: 'info' as const }] : []),
        ]}
      />
    </div>
  )
}
