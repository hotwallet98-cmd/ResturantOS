import { AudioLines, CheckCircle2, Globe, Mic, Play, Server, Volume2, XCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Badge, Button, Card, Field, Input, PageHeader, Select, Toggle } from '@/shared/components/ui'
import { useKitchen } from '@/apps/kitchen/context/KitchenContext'
import { cn } from '@/shared/lib/cn'
import { USE_MOCKS } from '@/shared/services/client'
import type { VoiceLang, VoiceProvider } from '@/apps/kitchen/services/voice'
import { browserVoiceSupport, commandHelp, createSpeaker, phrases, phraseText } from '@/apps/kitchen/services/voice'

function Choice({ active, onClick, title, description, badge, icon: Icon }: { active: boolean; onClick: () => void; title: string; description: string; badge?: ReactNode; icon: typeof Mic }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('flex w-full gap-3 rounded-xl border p-4 text-left transition', active ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/20' : 'border-slate-200 hover:border-slate-300')}
    >
      <Icon size={20} className={active ? 'text-brand-600' : 'text-slate-400'} />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-800">
          {title} {badge}
        </span>
        <span className="mt-0.5 block text-xs text-slate-500">{description}</span>
      </span>
    </button>
  )
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      {ok ? <CheckCircle2 size={16} className="text-emerald-500" /> : <XCircle size={16} className="text-slate-300" />}
      <span className={ok ? 'text-slate-700' : 'text-slate-400'}>{label}</span>
    </li>
  )
}

export default function VoiceSettings() {
  const { settings, setSettings, demoStream, setDemoStream, agent } = useKitchen()
  const [testing, setTesting] = useState(false)
  const [testError, setTestError] = useState('')
  const [support, setSupport] = useState(browserVoiceSupport)

  // Browsers load voices asynchronously
  useEffect(() => {
    if (typeof speechSynthesis === 'undefined') return
    const update = () => setSupport(browserVoiceSupport())
    speechSynthesis.addEventListener('voiceschanged', update)
    return () => speechSynthesis.removeEventListener('voiceschanged', update)
  }, [])

  const set = <K extends keyof typeof settings>(k: K, v: (typeof settings)[K]) => setSettings({ ...settings, [k]: v })

  const test = async () => {
    setTesting(true)
    setTestError('')
    try {
      await createSpeaker(settings).speak(phrases.test())
    } catch (e) {
      setTestError(e instanceof Error ? e.message : 'Could not play the voice')
    } finally {
      setTesting(false)
    }
  }

  const providers: { id: VoiceProvider; title: string; description: string; badge?: ReactNode }[] = [
    {
      id: 'soniox',
      title: 'Soniox AI voice',
      description: 'Real-time Urdu + English speech recognition (handles mixed "order ready hai") and natural text-to-speech. Holds up in a noisy kitchen.',
      badge: USE_MOCKS ? <Badge tone="yellow">Needs backend</Badge> : <Badge tone="green">Recommended</Badge>,
    },
    {
      id: 'browser',
      title: 'Browser voice',
      description: 'Built-in Chrome / Edge speech. Free and works offline from the backend, but more robotic and weaker in noise.',
      badge: <Badge>Fallback</Badge>,
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader icon={AudioLines} title="Voice Agent Settings" description="How the kitchen agent talks, what it announces and how it listens." />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card title="Voice engine">
            <div className="grid gap-3 md:grid-cols-2">
              {providers.map((p) => (
                <Choice key={p.id} active={settings.provider === p.id} onClick={() => set('provider', p.id)} icon={p.id === 'soniox' ? Server : Globe} {...p} />
              ))}
            </div>
            {settings.provider === 'soniox' && USE_MOCKS && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Soniox needs the backend to issue temporary keys (<code className="text-xs">POST /api/voice/soniox-config</code>). In demo mode, switch to Browser voice to try the flow.
              </p>
            )}
          </Card>

          <Card title="Language & voice">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Agent speaks">
                <Select
                  value={settings.lang}
                  onChange={(e) => set('lang', e.target.value as VoiceLang)}
                  options={[
                    { value: 'ur', label: 'Urdu (Roman Urdu on screen)' },
                    { value: 'en', label: 'English' },
                  ]}
                />
              </Field>
              <Field label={`Speaking speed · ${settings.speed.toFixed(1)}×`}>
                <input type="range" min={0.7} max={1.3} step={0.1} value={settings.speed} onChange={(e) => set('speed', Number(e.target.value))} className="mt-3 w-full accent-brand-600" />
              </Field>
              {settings.provider === 'soniox' && (
                <Field label="Soniox voice" hint="Voice name from your Soniox console, or a cloned-voice id">
                  <Input value={settings.sonioxVoice} onChange={(e) => set('sonioxVoice', e.target.value)} />
                </Field>
              )}
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-4">
              <Button variant="outline" icon={Play} loading={testing} onClick={() => void test()}>
                Test voice
              </Button>
              <p className="min-w-0 flex-1 text-sm text-slate-600 italic">“{phraseText(phrases.test(), settings.lang)}”</p>
              {testError && <p className="w-full text-sm text-red-600">{testError}</p>}
            </div>
          </Card>

          <Card title="What the agent announces">
            <div className="space-y-4">
              <Toggle checked={settings.announceOrders} onChange={(v) => set('announceOrders', v)} label="New orders" description="Reads each new ticket out loud and waits for the chef to say “confirm”" />
              <Toggle checked={settings.readItems} onChange={(v) => set('readItems', v)} label="Read every item" description="Off = only the order number, table and item count" />
              <Toggle checked={settings.announceAlerts} onChange={(v) => set('announceAlerts', v)} label="Stock alerts" description="e.g. “Alert! Chicken sirf 3 kg reh gaya hai”" />
              <Field label="Remind if not confirmed after">
                <Select
                  value={String(settings.repeatAfterSec)}
                  onChange={(e) => set('repeatAfterSec', Number(e.target.value))}
                  options={[
                    { value: '0', label: 'Never' },
                    { value: '20', label: '20 seconds' },
                    { value: '30', label: '30 seconds' },
                    { value: '60', label: '1 minute' },
                  ]}
                  className="max-w-48"
                />
              </Field>
            </div>
          </Card>

          <Card title="Demo">
            <Toggle checked={demoStream} onChange={setDemoStream} label="Send a test order every 45 seconds" description="Simulates incoming POS and delivery orders so you can try the voice flow" />
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Status">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm text-slate-600">Agent</span>
              <Button size="sm" icon={agent.state === 'off' ? Mic : Volume2} variant={agent.state === 'off' ? 'primary' : 'outline'} onClick={() => void (agent.state === 'off' ? agent.start() : agent.stop())}>
                {agent.state === 'off' ? 'Start agent' : 'Stop agent'}
              </Button>
            </div>
            <ul className="space-y-2">
              <Check ok={support.tts} label="Browser can speak" />
              <Check ok={support.stt} label="Browser can listen (Chrome / Edge)" />
              <Check ok={support.urduVoice} label="Urdu voice installed on this device" />
              <Check ok={!USE_MOCKS} label="Backend connected (needed for Soniox)" />
            </ul>
            {!support.urduVoice && settings.provider === 'browser' && settings.lang === 'ur' && (
              <p className="mt-3 text-xs text-slate-500">No Urdu voice on this device, so Roman Urdu is read with an English voice. Soniox gives proper Urdu pronunciation.</p>
            )}
            {agent.error && <p className="mt-3 text-sm text-red-600">{agent.error}</p>}
          </Card>

          <Card title="Voice commands" subtitle="Urdu, Roman Urdu or English all work">
            <ul className="space-y-3">
              {commandHelp.map((c) => (
                <li key={c.say} className="text-sm">
                  <span className="font-medium text-slate-800">{c.say}</span>
                  <span className="block text-xs text-slate-500">{c.does}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )
}
