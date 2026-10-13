import { ArrowLeft, Bike, Building2, ChefHat, ConciergeBell, KeyRound, Smartphone, Store, Lock, Mail, ShieldCheck, Sparkles, UtensilsCrossed } from 'lucide-react'
import type { FormEvent } from 'react'
import { useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Button, Checkbox, Field, Input } from '@/shared/components/ui'
import { useAuth } from '@/shared/context/AuthContext'
import { cn } from '@/shared/lib/cn'
import type { Role } from '@/shared/services/auth'
import { demoUsers, homeFor, login, requestPasswordReset, verifyMfa } from '@/shared/services/auth'

type Step = 'credentials' | 'mfa' | 'forgot' | 'forgot-sent'

const roles: { id: Role; label: string; description: string; icon: typeof ShieldCheck }[] = [
  { id: 'super_admin', label: 'Super Admin', description: 'Manage the whole platform', icon: ShieldCheck },
  { id: 'restaurant_admin', label: 'Restaurant', description: 'Run daily operations', icon: Building2 },
  { id: 'counter_staff', label: 'Counter', description: 'Orders, calls & bills', icon: ConciergeBell },
  { id: 'waiter', label: 'Waiter', description: 'Tables & orders', icon: Smartphone },
  { id: 'kitchen_staff', label: 'Kitchen', description: 'KDS & voice agent', icon: ChefHat },
  { id: 'rider', label: 'Rider', description: 'Pickups & delivery', icon: Bike },
]

function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const digits = value.padEnd(6, ' ').split('').slice(0, 6)
  const setAt = (i: number, d: string) => {
    const next = digits.map((c, idx) => (idx === i ? d : c)).join('').replace(/\s+$/, '')
    onChange(next.replace(/\s/g, ''))
  }
  return (
    <div className="flex justify-between gap-2">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          inputMode="numeric"
          maxLength={1}
          aria-label={`Digit ${i + 1}`}
          value={d.trim()}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '').slice(-1)
            setAt(i, v)
            if (v) refs.current[i + 1]?.focus()
          }}
          onKeyDown={(e) => e.key === 'Backspace' && !d.trim() && refs.current[i - 1]?.focus()}
          onPaste={(e) => {
            const p = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
            if (p) {
              e.preventDefault()
              onChange(p)
              refs.current[Math.min(p.length, 5)]?.focus()
            }
          }}
          className="h-12 w-full rounded-lg border border-slate-200 text-center text-lg font-semibold focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
        />
      ))}
    </div>
  )
}

export default function Login() {
  const { user, signIn } = useAuth()
  const navigate = useNavigate()
  const [role, setRole] = useState<Role>('super_admin')
  const [step, setStep] = useState<Step>('credentials')
  const [email, setEmail] = useState(demoUsers.super_admin.email)
  const [password, setPassword] = useState('demo1234')
  const [remember, setRemember] = useState(true)
  const [code, setCode] = useState('')
  const [challenge, setChallenge] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (user) return <Navigate to={homeFor(user.role)} replace />

  const pickRole = (r: Role) => {
    setRole(r)
    setEmail(demoUsers[r].email)
  }

  const submitCredentials = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await login(email, password, role)
      setChallenge(res.challengeId)
      setCode('')
      setStep('mfa')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  const submitMfa = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const u = await verifyMfa(challenge, code)
      signIn(u)
      navigate(homeFor(u.role), { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  const submitForgot = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await requestPasswordReset(email)
    setLoading(false)
    setStep('forgot-sent')
  }

  return (
    <div className="grid min-h-full lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-ink-900 p-12 text-white lg:flex lg:flex-col">
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-brand-600/30 blur-3xl" />
        <div className="absolute bottom-0 -left-20 h-80 w-80 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600">
            <UtensilsCrossed size={20} />
          </span>
          <span className="text-lg font-semibold">RestaurantOS</span>
        </div>
        <div className="relative mt-auto max-w-md">
          <h1 className="text-4xl leading-tight font-semibold tracking-tight">The operating system for modern restaurants.</h1>
          <p className="mt-4 text-slate-400">
            POS, kitchen, inventory, delivery, staff, finance and marketing in one platform, with an AI engine running across all of it.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-4">
            {[
              ['1,284', 'Restaurants'],
              ['18', 'Modules'],
              ['24/7', 'AI insights'],
            ].map(([v, l]) => (
              <div key={l} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-xl font-semibold">{v}</p>
                <p className="text-xs text-slate-400">{l}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 flex items-center gap-2 text-sm text-violet-300">
            <Sparkles size={15} /> Powered by the Central AI &amp; Automation Engine
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-white px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
              <UtensilsCrossed size={18} />
            </span>
            <span className="font-semibold">RestaurantOS</span>
          </div>

          {step === 'credentials' && (
            <form onSubmit={submitCredentials} className="animate-fade-in space-y-5">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Sign in</h2>
                <p className="mt-1 text-sm text-slate-500">Choose a portal to explore the prototype.</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {roles.map(({ id, label, description, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => pickRole(id)}
                    className={cn(
                      'rounded-xl border p-3 text-left transition-all',
                      role === id ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/20' : 'border-slate-200 hover:border-slate-300',
                    )}
                  >
                    <Icon size={18} className={role === id ? 'text-brand-600' : 'text-slate-400'} />
                    <p className="mt-2 text-sm font-semibold text-slate-800">{label}</p>
                    <p className="text-xs text-slate-500">{description}</p>
                  </button>
                ))}
              </div>
              <Field label="Email">
                <div className="relative">
                  <Mail size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
                  <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="pl-9" />
                </div>
              </Field>
              <Field label="Password">
                <div className="relative">
                  <Lock size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
                  <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="pl-9" />
                </div>
              </Field>
              <div className="flex items-center justify-between">
                <Checkbox checked={remember} onChange={setRemember} label="Remember this device" />
                <button type="button" onClick={() => setStep('forgot')} className="text-sm font-medium text-brand-600 hover:text-brand-700">
                  Forgot password?
                </button>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" block size="lg" loading={loading}>
                Continue
              </Button>
              <p className="text-center text-xs text-slate-400">Demo mode: any password works.</p>
              <a href="/order" target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700">
                <Store size={15} /> Open the customer ordering app
              </a>
            </form>
          )}

          {step === 'mfa' && (
            <form onSubmit={submitMfa} className="animate-fade-in space-y-5">
              <button type="button" onClick={() => setStep('credentials')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
                <ArrowLeft size={15} /> Back
              </button>
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <KeyRound size={22} />
              </span>
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Two-factor authentication</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Enter the 6-digit code from your authenticator app for <span className="font-medium text-slate-700">{email}</span>.
                </p>
              </div>
              <OtpInput value={code} onChange={setCode} />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" block size="lg" loading={loading} disabled={code.length !== 6}>
                Verify &amp; sign in
              </Button>
              <div className="flex items-center justify-between text-sm">
                <button type="button" onClick={() => setCode('123456')} className="font-medium text-brand-600 hover:text-brand-700">
                  Fill demo code
                </button>
                <button type="button" className="text-slate-500 hover:text-slate-800">
                  Use a backup code
                </button>
              </div>
            </form>
          )}

          {step === 'forgot' && (
            <form onSubmit={submitForgot} className="animate-fade-in space-y-5">
              <button type="button" onClick={() => setStep('credentials')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
                <ArrowLeft size={15} /> Back to sign in
              </button>
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Reset your password</h2>
                <p className="mt-1 text-sm text-slate-500">We'll email you a secure link to set a new password.</p>
              </div>
              <Field label="Email">
                <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Button type="submit" block size="lg" loading={loading}>
                Send reset link
              </Button>
            </form>
          )}

          {step === 'forgot-sent' && (
            <div className="animate-fade-in space-y-5 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <Mail size={22} />
              </span>
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Check your inbox</h2>
                <p className="mt-1 text-sm text-slate-500">
                  If an account exists for <span className="font-medium text-slate-700">{email}</span>, a reset link is on its way. It expires in 30 minutes.
                </p>
              </div>
              <Button variant="outline" block onClick={() => setStep('credentials')}>
                Back to sign in
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
