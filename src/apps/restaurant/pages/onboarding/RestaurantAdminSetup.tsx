import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bike,
  Check,
  CheckCircle2,
  ChefHat,
  Circle,
  Clock,
  Eye,
  EyeOff,
  ImagePlus,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Mail,
  Package,
  PartyPopper,
  Plus,
  Rocket,
  ShieldCheck,
  ShoppingCart,
  Trash2,
  UserPlus,
  Users,
  UtensilsCrossed,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Card, Checkbox, Field, Input, LoadingState, ProgressBar, SectionTitle, Select, Stepper, Toggle, useToast } from '@/shared/components/ui'
import { useAuth } from '@/shared/context/AuthContext'
import { useAsync } from '@/shared/hooks/useAsync'
import { cn } from '@/shared/lib/cn'
import { getSetupRoles, goLive, saveSetup, serviceModels, setupPermissionCatalog } from '@/shared/services/admin'
import type { SetupRole } from '@/shared/services/admin'

const steps = [
  { id: 'activate', label: 'Account activation', description: 'Accept invite & set password' },
  { id: 'login', label: 'Admin login', description: 'Sign in & verify MFA' },
  { id: 'profile', label: 'Profile & branches', description: 'Brand, contact, locations' },
  { id: 'ops', label: 'Operational setup', description: 'Hours, taxes, charges, order types' },
  { id: 'roles', label: 'Employee roles', description: 'Roles, permissions & invites' },
  { id: 'dashboard', label: 'Dashboard access', description: 'Your workspace & modules' },
  { id: 'golive', label: 'Activation & go-live', description: 'Final checks' },
]

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

interface Branch {
  name: string
  city: string
  address: string
  phone: string
}

interface Hours {
  open: boolean
  from: string
  to: string
}

const confettiColors = ['#fe5a11', '#6366f1', '#10b981', '#f59e0b', '#0ea5e9', '#ec4899']

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        left: (i * 37) % 100,
        delay: (i % 14) * 0.12,
        duration: 2.4 + (i % 5) * 0.35,
        color: confettiColors[i % confettiColors.length],
        rotate: (i * 47) % 360,
        size: 6 + (i % 3) * 3,
      })),
    [],
  )
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden>
      <style>{`@keyframes ros-confetti { 0% { transform: translateY(-10vh) rotate(0deg); opacity: 1 } 100% { transform: translateY(110vh) rotate(720deg); opacity: 0.2 } }`}</style>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute top-0 rounded-sm"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 1.6,
            background: p.color,
            transform: `rotate(${p.rotate}deg)`,
            animation: `ros-confetti ${p.duration}s ease-in ${p.delay}s forwards`,
          }}
        />
      ))}
    </div>
  )
}

export default function RestaurantAdminSetup() {
  const navigate = useNavigate()
  const notify = useToast()
  const { user, signOut } = useAuth()
  const { data: loadedRoles, setData: setRoles, loading: rolesLoading } = useAsync(getSetupRoles)
  const restaurantName = user?.restaurant?.name ?? 'Spice Route Kitchen'

  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)

  // 1. Activation
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [terms, setTerms] = useState(false)
  // 2. Login
  const [loginEmail, setLoginEmail] = useState(user?.email ?? 'omar@spiceroute.com')
  const [loginPw, setLoginPw] = useState('')
  const [otp, setOtp] = useState('')
  const [loggedIn, setLoggedIn] = useState(false)
  // 3. Profile
  const [profile, setProfile] = useState({ name: restaurantName, tagline: 'Modern Pakistani kitchen', cuisine: 'Pakistani, BBQ', phone: '+92 21 3456 7890', email: 'hello@spiceroute.com', website: 'spiceroute.com', logo: false })
  const [branches, setBranches] = useState<Branch[]>(
    (user?.restaurant?.branches ?? ['Downtown', 'Mall Road', 'Airport']).map((b, i) => ({ name: b, city: 'Karachi', address: ['Shahrah-e-Faisal', 'Dolmen Mall, Clifton', 'Jinnah Terminal, Departures'][i] ?? '', phone: `+92 21 3456 78${90 + i}` })),
  )
  // 4. Ops
  const [hours, setHours] = useState<Hours[]>(days.map((_, i) => ({ open: true, from: '12:00', to: i >= 4 ? '01:00' : '23:30' })))
  const [currency, setCurrency] = useState('PKR')
  const [taxName, setTaxName] = useState('Sindh Sales Tax')
  const [taxRate, setTaxRate] = useState('13')
  const [taxInclusive, setTaxInclusive] = useState(false)
  const [cardTax, setCardTax] = useState('8')
  const [serviceCharge, setServiceCharge] = useState('5')
  const [serviceDineInOnly, setServiceDineInOnly] = useState(true)
  const [orderTypes, setOrderTypes] = useState<string[]>(['Dine-in', 'Takeaway', 'Delivery'])
  // 5. Roles
  const [invites, setInvites] = useState<{ email: string; role: string }[]>([
    { email: 'sana.manager@spiceroute.com', role: 'Branch Manager' },
    { email: 'cashier.downtown@spiceroute.com', role: 'Cashier' },
  ])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('Waiter')
  // 6. Dashboard
  const [landing, setLanding] = useState('Dashboard')
  const [tour, setTour] = useState(true)
  // 7. Go live
  const [live, setLive] = useState(false)

  const roles: SetupRole[] = loadedRoles ?? []

  const pwChecks = [
    { label: 'At least 10 characters', ok: password.length >= 10 },
    { label: 'Upper & lower case', ok: /[a-z]/.test(password) && /[A-Z]/.test(password) },
    { label: 'A number', ok: /\d/.test(password) },
    { label: 'Passwords match', ok: !!password && password === confirm },
  ]

  const checklist = [
    { label: 'Admin account activated', done: step > 0 || pwChecks.every((c) => c.ok) },
    { label: 'Signed in with MFA', done: loggedIn },
    { label: 'Restaurant profile completed', done: !!profile.name && !!profile.phone },
    { label: `${branches.length} branch${branches.length === 1 ? '' : 'es'} configured`, done: branches.length > 0 && branches.every((b) => b.name) },
    { label: 'Opening hours, taxes & currency set', done: !!taxRate && !!currency },
    { label: `${orderTypes.length} order types enabled`, done: orderTypes.length > 0 },
    { label: `${roles.length} roles & ${invites.length} staff invitations`, done: roles.length > 0 },
    { label: 'Menu imported (optional — can be done later)', done: false, optional: true },
  ]
  const required = checklist.filter((c) => !c.optional)
  const readyCount = required.filter((c) => c.done).length

  const canNext = (() => {
    if (step === 0) return pwChecks.every((c) => c.ok) && terms
    if (step === 1) return loggedIn
    if (step === 2) return !!profile.name && branches.length > 0
    if (step === 3) return orderTypes.length > 0
    return true
  })()

  const next = async () => {
    setBusy(true)
    await saveSetup(steps[step]!.id, { step })
    setBusy(false)
    if (step === 0) notify('Account activated — please sign in')
    setStep((s) => Math.min(s + 1, steps.length - 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const doLogin = async () => {
    setBusy(true)
    await saveSetup('login', { email: loginEmail })
    setBusy(false)
    setLoggedIn(true)
    notify('Signed in securely')
  }

  const launch = async () => {
    setBusy(true)
    await goLive()
    setBusy(false)
    setLive(true)
    notify(`${profile.name} is live! 🎉`)
  }

  const togglePerm = (roleId: string, perm: string) =>
    setRoles((list) => list?.map((r) => (r.id === roleId ? { ...r, permissions: r.permissions.includes(perm) ? r.permissions.filter((p) => p !== perm) : [...r.permissions, perm] } : r)))

  return (
    <div className="min-h-full bg-slate-50">
      {live && <Confetti />}
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-lg shadow-brand-600/30">
              <UtensilsCrossed size={18} />
            </span>
            <div className="leading-tight">
              <p className="font-semibold text-slate-900">RestaurantOS</p>
              <p className="text-[11px] text-slate-500">Restaurant Admin Setup</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden w-48 sm:block">
              <ProgressBar value={live ? steps.length : step} max={steps.length} showLabel />
            </div>
            <Button size="sm" variant="ghost" icon={LogOut} onClick={() => { signOut(); navigate('/login') }}>
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[300px_1fr] lg:py-10">
        {/* Stepper sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-4">
            <div className="rounded-xl bg-ink-900 p-5 text-white">
              <p className="text-xs text-slate-400">Setting up</p>
              <p className="mt-0.5 text-lg font-semibold">{profile.name}</p>
              <p className="mt-2 text-xs text-slate-400">Takes about 10 minutes. Progress is saved automatically.</p>
            </div>
            <Card bodyClassName="p-3">
              <Stepper steps={steps} current={live ? steps.length : step} onStepClick={(i) => !live && setStep(i)} />
            </Card>
          </div>
        </aside>
        <div className="lg:hidden">
          <Stepper steps={steps} current={step} orientation="horizontal" />
          <p className="mt-2 text-sm font-medium text-slate-700">
            Step {step + 1} of {steps.length}: {steps[step]!.label}
          </p>
        </div>

        <main className="min-w-0">
          <Card>
            <div className="mb-6">
              <p className="text-xs font-semibold tracking-wider text-brand-600 uppercase">Step {step + 1} of {steps.length}</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{steps[step]!.label}</h1>
              <p className="mt-1 text-sm text-slate-500">{steps[step]!.description}</p>
            </div>

            {/* 1. Account activation */}
            {step === 0 && (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <div className="rounded-lg border border-brand-100 bg-brand-50 p-4 text-sm">
                    <p className="flex items-center gap-2 font-medium text-brand-800">
                      <Mail size={16} /> You've been invited by RestaurantOS
                    </p>
                    <p className="mt-1 text-brand-900/70">
                      Ayesha Khan (Platform Super Admin) created a workspace for <b>{restaurantName}</b> on the <b>Pro</b> plan.
                    </p>
                  </div>
                  <Field label="Email">
                    <Input value={loginEmail} disabled />
                  </Field>
                  <Field label="Create password" required>
                    <div className="relative">
                      <Input type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="pr-10" />
                      <button type="button" aria-label="Toggle password visibility" onClick={() => setShowPw(!showPw)} className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400">
                        {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </Field>
                  <Field label="Confirm password" required>
                    <Input type={showPw ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                  </Field>
                  <Checkbox checked={terms} onChange={setTerms} label="I accept the Terms of Service and Data Processing Agreement" />
                  <button type="button" className="text-xs font-medium text-brand-600 hover:text-brand-700" onClick={() => { setPassword('SpiceRoute2026'); setConfirm('SpiceRoute2026'); setTerms(true) }}>
                    Fill demo password
                  </button>
                </div>
                <div className="rounded-xl bg-slate-50 p-5">
                  <SectionTitle>Password requirements</SectionTitle>
                  <ul className="space-y-2">
                    {pwChecks.map((c) => (
                      <li key={c.label} className={cn('flex items-center gap-2 text-sm', c.ok ? 'text-emerald-700' : 'text-slate-500')}>
                        {c.ok ? <CheckCircle2 size={16} /> : <Circle size={16} />} {c.label}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* 2. Login */}
            {step === 1 && (
              <div className="mx-auto max-w-md">
                {loggedIn ? (
                  <div className="flex flex-col items-center py-6 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                      <ShieldCheck size={28} />
                    </span>
                    <p className="mt-3 font-semibold text-slate-900">Signed in as {loginEmail}</p>
                    <p className="text-sm text-slate-500">MFA verified · this device is trusted for 14 days</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Field label="Email">
                      <Input value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
                    </Field>
                    <Field label="Password">
                      <Input type="password" value={loginPw} onChange={(e) => setLoginPw(e.target.value)} placeholder="The password you just created" />
                    </Field>
                    <Field label="Authenticator code" hint="Scan the QR code in your authenticator app, then enter the 6-digit code">
                      <div className="flex gap-3">
                        <div className="grid h-20 w-20 shrink-0 grid-cols-5 gap-0.5 rounded-md border border-slate-200 bg-white p-1.5" aria-label="MFA QR code">
                          {Array.from({ length: 25 }, (_, i) => (
                            <span key={i} className={cn('rounded-[1px]', [0, 1, 3, 5, 6, 8, 12, 14, 16, 18, 19, 20, 22, 24].includes(i) ? 'bg-slate-900' : 'bg-transparent')} />
                          ))}
                        </div>
                        <Input inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} placeholder="123456" className="h-20 text-center text-2xl tracking-[0.4em]" />
                      </div>
                    </Field>
                    <Button block icon={KeyRound} loading={busy} disabled={!loginPw || otp.length !== 6} onClick={doLogin}>
                      Sign in
                    </Button>
                    <button type="button" className="text-xs font-medium text-brand-600" onClick={() => { setLoginPw(password || 'demo'); setOtp('123456') }}>
                      Use demo credentials
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 3. Profile & branches */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="flex flex-col gap-5 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => setProfile({ ...profile, logo: !profile.logo })}
                    className={cn('flex h-28 w-28 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-xs', profile.logo ? 'border-brand-300 bg-brand-600 text-white' : 'border-slate-200 text-slate-500 hover:border-brand-300')}
                  >
                    {profile.logo ? <UtensilsCrossed size={30} /> : <ImagePlus size={22} />}
                    {profile.logo ? 'Change logo' : 'Upload logo'}
                  </button>
                  <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Restaurant name" required>
                      <Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
                    </Field>
                    <Field label="Tagline">
                      <Input value={profile.tagline} onChange={(e) => setProfile({ ...profile, tagline: e.target.value })} />
                    </Field>
                    <Field label="Cuisine">
                      <Input value={profile.cuisine} onChange={(e) => setProfile({ ...profile, cuisine: e.target.value })} />
                    </Field>
                    <Field label="Public phone">
                      <Input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
                    </Field>
                    <Field label="Public email">
                      <Input value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
                    </Field>
                    <Field label="Website">
                      <Input value={profile.website} onChange={(e) => setProfile({ ...profile, website: e.target.value })} />
                    </Field>
                  </div>
                </div>
                <div>
                  <SectionTitle action={<Button size="xs" variant="outline" icon={Plus} onClick={() => setBranches([...branches, { name: '', city: 'Karachi', address: '', phone: '' }])}>Add branch</Button>}>
                    Branches ({branches.length})
                  </SectionTitle>
                  <div className="space-y-3">
                    {branches.map((b, i) => (
                      <div key={i} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-2 xl:grid-cols-[1fr_140px_1.5fr_1fr_auto]">
                        <Input placeholder="Branch name" value={b.name} onChange={(e) => setBranches(branches.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                        <Select value={b.city} options={['Karachi', 'Lahore', 'Islamabad', 'Dubai', 'London']} onChange={(e) => setBranches(branches.map((x, j) => (j === i ? { ...x, city: e.target.value } : x)))} />
                        <Input placeholder="Address" value={b.address} onChange={(e) => setBranches(branches.map((x, j) => (j === i ? { ...x, address: e.target.value } : x)))} />
                        <Input placeholder="Phone" value={b.phone} onChange={(e) => setBranches(branches.map((x, j) => (j === i ? { ...x, phone: e.target.value } : x)))} />
                        <Button variant="ghost" size="sm" icon={Trash2} aria-label="Remove branch" disabled={branches.length === 1} onClick={() => setBranches(branches.filter((_, j) => j !== i))} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 4. Operational configuration */}
            {step === 3 && (
              <div className="space-y-8">
                <div>
                  <SectionTitle>
                    <span className="flex items-center gap-2"><Clock size={15} /> Opening hours</span>
                  </SectionTitle>
                  <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                    {days.map((d, i) => (
                      <div key={d} className="flex flex-wrap items-center gap-3 px-3 py-2">
                        <span className="w-24 text-sm font-medium text-slate-700">{d}</span>
                        <Toggle checked={hours[i]!.open} onChange={(v) => setHours(hours.map((h, j) => (j === i ? { ...h, open: v } : h)))} />
                        {hours[i]!.open ? (
                          <div className="flex items-center gap-2">
                            <Input type="time" className="h-9 w-28" value={hours[i]!.from} onChange={(e) => setHours(hours.map((h, j) => (j === i ? { ...h, from: e.target.value } : h)))} />
                            <span className="text-slate-400">–</span>
                            <Input type="time" className="h-9 w-28" value={hours[i]!.to} onChange={(e) => setHours(hours.map((h, j) => (j === i ? { ...h, to: e.target.value } : h)))} />
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">Closed</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <button type="button" className="mt-2 text-xs font-medium text-brand-600" onClick={() => { setHours(hours.map(() => ({ ...hours[0]! }))); notify('Monday hours copied to all days', 'info') }}>
                    Copy Monday to all days
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <SectionTitle>Currency & taxes</SectionTitle>
                    <Field label="Currency">
                      <Select value={currency} options={[{ value: 'PKR', label: 'PKR — Pakistani Rupee' }, { value: 'AED', label: 'AED — UAE Dirham' }, { value: 'GBP', label: 'GBP — British Pound' }, { value: 'USD', label: 'USD — US Dollar' }]} onChange={(e) => setCurrency(e.target.value)} />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Tax name">
                        <Input value={taxName} onChange={(e) => setTaxName(e.target.value)} />
                      </Field>
                      <Field label="Rate (%) — cash">
                        <Input type="number" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
                      </Field>
                    </div>
                    <Field label="Rate (%) — card payments" hint="Reduced provincial rate for card / digital payments">
                      <Input type="number" value={cardTax} onChange={(e) => setCardTax(e.target.value)} />
                    </Field>
                    <Toggle checked={taxInclusive} onChange={setTaxInclusive} label="Menu prices include tax" />
                  </div>
                  <div className="space-y-4">
                    <SectionTitle>Service charges</SectionTitle>
                    <Field label="Service charge (%)">
                      <Input type="number" value={serviceCharge} onChange={(e) => setServiceCharge(e.target.value)} />
                    </Field>
                    <Toggle checked={serviceDineInOnly} onChange={setServiceDineInOnly} label="Apply to dine-in orders only" />
                    <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                      Example bill for {currency} 2,000 (dine-in, cash): subtotal 2,000 · service {serviceCharge}% = {Math.round(2000 * Number(serviceCharge || 0) / 100)} · {taxName} {taxRate}% = {Math.round(2000 * Number(taxRate || 0) / 100)} ·{' '}
                      <b>total {(2000 + Math.round(2000 * Number(serviceCharge || 0) / 100) + (taxInclusive ? 0 : Math.round(2000 * Number(taxRate || 0) / 100))).toLocaleString()}</b>
                    </div>
                  </div>
                </div>

                <div>
                  <SectionTitle>Order types</SectionTitle>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {serviceModels.map((t) => {
                      const on = orderTypes.includes(t)
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setOrderTypes(on ? orderTypes.filter((x) => x !== t) : [...orderTypes, t])}
                          className={cn('flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm font-medium transition', on ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-slate-200 text-slate-600 hover:border-slate-300')}
                        >
                          {t}
                          {on && <Check size={15} />}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 5. Roles & permissions */}
            {step === 4 &&
              (rolesLoading ? (
                <LoadingState />
              ) : (
                <div className="space-y-6">
                  <div className="scrollbar-thin overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full min-w-[720px] text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                          <th className="px-3 py-2.5 text-left">Role</th>
                          {setupPermissionCatalog.map((p) => (
                            <th key={p} className="px-2 py-2.5 text-center font-semibold normal-case">{p}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {roles.map((r) => (
                          <tr key={r.id}>
                            <td className="px-3 py-2.5">
                              <p className="font-medium whitespace-nowrap text-slate-800">{r.name}</p>
                              <p className="text-xs text-slate-500">{r.members} staff</p>
                            </td>
                            {setupPermissionCatalog.map((p) => {
                              const on = r.permissions.includes(p)
                              return (
                                <td key={p} className="px-2 py-2.5 text-center">
                                  <button
                                    type="button"
                                    aria-label={`${p} for ${r.name}`}
                                    onClick={() => togglePerm(r.id, p)}
                                    className={cn('inline-flex h-6 w-6 items-center justify-center rounded-md', on ? 'bg-brand-600 text-white' : 'bg-slate-100 text-transparent hover:bg-slate-200')}
                                  >
                                    <Check size={13} />
                                  </button>
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div>
                    <SectionTitle>Invite staff</SectionTitle>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input placeholder="staff@restaurant.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
                      <Select className="sm:w-48" value={inviteRole} options={roles.map((r) => r.name)} onChange={(e) => setInviteRole(e.target.value)} />
                      <Button
                        icon={UserPlus}
                        disabled={!/\S+@\S+/.test(inviteEmail)}
                        onClick={() => {
                          setInvites([...invites, { email: inviteEmail, role: inviteRole }])
                          notify(`Invitation queued for ${inviteEmail}`)
                          setInviteEmail('')
                        }}
                      >
                        Invite
                      </Button>
                    </div>
                    <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200">
                      {invites.map((inv, i) => (
                        <li key={inv.email} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                          <span className="truncate text-slate-700">{inv.email}</span>
                          <span className="flex items-center gap-2">
                            <Badge tone="purple">{inv.role}</Badge>
                            <button type="button" aria-label="Remove invite" className="text-slate-400 hover:text-red-600" onClick={() => setInvites(invites.filter((_, j) => j !== i))}>
                              <Trash2 size={14} />
                            </button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}

            {/* 6. Dashboard access */}
            {step === 5 && (
              <div className="space-y-6">
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="flex">
                    <div className="hidden w-40 shrink-0 space-y-1 bg-ink-900 p-3 sm:block">
                      {['Dashboard', 'Orders & POS', 'Kitchen', 'Menu', 'Inventory', 'Employees', 'Reports'].map((l, i) => (
                        <div key={l} className={cn('rounded-md px-2 py-1.5 text-[11px]', i === 0 ? 'bg-brand-600 text-white' : 'text-slate-400')}>{l}</div>
                      ))}
                    </div>
                    <div className="flex-1 space-y-3 bg-slate-50 p-4">
                      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                        {[['Sales today', 'PKR 412k'], ['Orders', '386'], ['Avg ticket', 'PKR 1,067'], ['Tables busy', '18/32']].map(([l, v]) => (
                          <div key={l} className="rounded-lg bg-white p-2.5 shadow-sm">
                            <p className="text-[10px] text-slate-500">{l}</p>
                            <p className="text-sm font-semibold text-slate-900">{v}</p>
                          </div>
                        ))}
                      </div>
                      <div className="flex h-24 items-end gap-1.5 rounded-lg bg-white p-3 shadow-sm">
                        {[30, 45, 38, 60, 72, 55, 80, 92, 68, 75, 88, 64].map((h, i) => (
                          <span key={i} className="flex-1 rounded-t bg-brand-400" style={{ height: `${h}%` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <SectionTitle>Modules available on your Pro plan</SectionTitle>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                    {[
                      [ShoppingCart, 'Orders & POS'],
                      [ChefHat, 'Kitchen Display'],
                      [UtensilsCrossed, 'Menu & Recipes'],
                      [Package, 'Inventory'],
                      [Bike, 'Delivery & Takeaway'],
                      [Users, 'Customers & Loyalty'],
                      [BarChart3, 'Reports & BI'],
                      [LayoutDashboard, 'Finance'],
                    ].map(([Icon, label]) => {
                      const I = Icon as typeof ShoppingCart
                      return (
                        <div key={label as string} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                          <I size={15} className="text-brand-600" /> {label as string}
                        </div>
                      )
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="Default landing page after login">
                    <Select value={landing} options={['Dashboard', 'Orders & POS', 'Kitchen Display', 'Reports & BI']} onChange={(e) => setLanding(e.target.value)} />
                  </Field>
                  <div className="pt-6">
                    <Toggle checked={tour} onChange={setTour} label="Show a guided tour on first visit" />
                  </div>
                </div>
              </div>
            )}

            {/* 7. Go live */}
            {step === 6 && (
              <div className="space-y-6">
                {live ? (
                  <div className="flex flex-col items-center py-8 text-center">
                    <span className="flex h-20 w-20 animate-bounce items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-pink-500 text-white shadow-lg shadow-brand-600/30">
                      <PartyPopper size={36} />
                    </span>
                    <h2 className="mt-5 text-2xl font-semibold text-slate-900">{profile.name} is live!</h2>
                    <p className="mt-2 max-w-md text-sm text-slate-500">
                      Your {branches.length} branch{branches.length === 1 ? '' : 'es'} can now take orders. {invites.length} staff invitations have been sent.
                    </p>
                    <Button size="lg" className="mt-6" iconRight={ArrowRight} onClick={() => navigate('/app')}>
                      Go to dashboard
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-4">
                      <ProgressBar className="flex-1" value={readyCount} max={required.length} showLabel tone={readyCount === required.length ? 'green' : 'brand'} />
                      <span className="text-sm text-slate-500">{readyCount}/{required.length} required</span>
                    </div>
                    <ul className="space-y-2">
                      {checklist.map((c) => (
                        <li key={c.label} className={cn('flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm', c.done ? 'border-emerald-100 bg-emerald-50/50 text-slate-700' : 'border-slate-200 text-slate-500')}>
                          {c.done ? <CheckCircle2 size={18} className="text-emerald-500" /> : <Circle size={18} className="text-slate-300" />}
                          <span className="flex-1">{c.label}</span>
                          {c.optional && <Badge>Optional</Badge>}
                        </li>
                      ))}
                    </ul>
                    <div className="flex flex-col items-center gap-3 rounded-xl bg-gradient-to-br from-ink-900 to-ink-700 p-6 text-center text-white">
                      <Rocket size={28} className="text-brand-400" />
                      <p className="text-lg font-semibold">Ready to go live?</p>
                      <p className="max-w-md text-sm text-slate-300">Going live opens your POS, online menu and staff apps. You can keep refining settings afterwards.</p>
                      <Button size="lg" icon={Rocket} loading={busy} disabled={readyCount < required.length} onClick={launch}>
                        Activate & go live
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Footer nav */}
            {!(step === 6 && live) && (
              <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-4">
                <Button variant="ghost" icon={ArrowLeft} disabled={step === 0} onClick={() => setStep(step - 1)}>
                  Back
                </Button>
                {step < steps.length - 1 && (
                  <Button iconRight={ArrowRight} loading={busy && step !== 1} disabled={!canNext} onClick={next}>
                    {step === 0 ? 'Activate account' : 'Save & continue'}
                  </Button>
                )}
              </div>
            )}
          </Card>
        </main>
      </div>
    </div>
  )
}
