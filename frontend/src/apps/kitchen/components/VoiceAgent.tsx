import { AlertTriangle, ChevronDown, ChevronUp, Keyboard, Mic, MicOff, Plus, RotateCcw, Send, Settings2, Check } from 'lucide-react'
import type { FormEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { AgentState } from '@/apps/kitchen/context/KitchenContext'
import { useKitchen } from '@/apps/kitchen/context/KitchenContext'
import { cn } from '@/shared/lib/cn'
import { commandHelp, orderAnnouncement } from '@/apps/kitchen/services/voice'

const stateMeta: Record<AgentState, { label: string; hint: string; dot: string }> = {
  off: { label: 'Voice agent off', hint: 'Start it to hear new orders out loud', dot: 'bg-slate-500' },
  starting: { label: 'Starting…', hint: 'Allow microphone access if the browser asks', dot: 'bg-amber-400' },
  idle: { label: 'Ready', hint: 'Waiting for orders', dot: 'bg-emerald-400' },
  listening: { label: 'Listening', hint: 'Say "confirm", "1058 ready" or "chicken khatam"', dot: 'bg-emerald-400' },
  speaking: { label: 'Speaking', hint: 'Say "bas" to stop', dot: 'bg-violet-400' },
  error: { label: 'Voice error', hint: 'Check microphone and settings', dot: 'bg-red-500' },
}

/** Animated level bars shown while the agent talks or listens. */
function VoiceBars({ active, tone }: { active: boolean; tone: 'violet' | 'emerald' }) {
  return (
    <span className="flex h-5 items-end gap-0.5" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={cn('w-1 rounded-full', tone === 'violet' ? 'bg-violet-300' : 'bg-emerald-300', active ? 'animate-voice-bar' : 'h-1 opacity-50')}
          style={active ? { animationDelay: `${i * 0.12}s` } : undefined}
        />
      ))}
    </span>
  )
}

/** Big round mic button — the one control a chef needs. */
function AgentOrb({ size = 'lg' }: { size?: 'lg' | 'sm' }) {
  const { agent } = useKitchen()
  const on = agent.state !== 'off' && agent.state !== 'error'
  const big = size === 'lg'
  return (
    <button
      type="button"
      onClick={() => void (on ? agent.stop() : agent.start())}
      aria-label={on ? 'Stop voice agent' : 'Start voice agent'}
      className={cn(
        'relative flex shrink-0 items-center justify-center rounded-full text-white transition',
        big ? 'h-16 w-16' : 'h-9 w-9',
        agent.state === 'speaking' ? 'bg-violet-600' : on ? 'bg-emerald-600' : agent.state === 'error' ? 'bg-red-600' : 'bg-ink-700 hover:bg-ink-800',
      )}
    >
      {agent.state === 'listening' && <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500/40" />}
      {agent.state === 'speaking' && <span className="absolute -inset-1 animate-pulse rounded-full ring-4 ring-violet-500/40" />}
      {on ? <Mic size={big ? 26 : 16} className="relative" /> : <MicOff size={big ? 26 : 16} className="relative" />}
    </button>
  )
}

/** Compact status shown in the kitchen portal header on every page. */
export function VoiceStatusPill() {
  const { agent } = useKitchen()
  const meta = stateMeta[agent.state]
  return (
    <div className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 pr-2.5 pl-0.5">
      <AgentOrb size="sm" />
      <span className="hidden text-left leading-tight sm:block">
        <span className="block text-xs font-semibold text-slate-800">{meta.label}</span>
        <span className="block text-[10px] text-slate-500">Voice agent</span>
      </span>
    </div>
  )
}

/** Full voice agent bar for the KDS page. */
export function VoiceAgentBar() {
  const { agent, tickets, settings, simulateOrder } = useKitchen()
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const logRef = useRef<HTMLUListElement>(null)
  const meta = stateMeta[agent.state]
  const pending = tickets.filter((t) => t.status === 'New').sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const awaiting = tickets.find((t) => t.id === agent.awaitingId && t.status === 'New')
  const lastAgent = [...agent.log].reverse().find((l) => l.who === 'agent')
  const lastChef = [...agent.log].reverse().find((l) => l.who === 'chef')

  useEffect(() => {
    if (open) logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [agent.log, open])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    agent.hear(typed.trim())
    setTyped('')
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-ink-900 text-slate-200">
      <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center">
        {/* State */}
        <div className="flex items-center gap-4 lg:w-72">
          <AgentOrb />
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-semibold text-white">
              <span className={cn('h-2 w-2 rounded-full', meta.dot)} />
              {meta.label}
              {agent.state === 'speaking' && <VoiceBars active tone="violet" />}
              {agent.state === 'listening' && <VoiceBars active={!!agent.partial} tone="emerald" />}
            </p>
            <p className="text-xs text-slate-400">{agent.error ?? meta.hint}</p>
            <p className="mt-1 flex gap-1.5 text-[10px] font-semibold tracking-wide uppercase">
              <span className="rounded bg-white/10 px-1.5 py-0.5 text-slate-300">{settings.provider === 'soniox' ? 'Soniox' : 'Browser voice'}</span>
              <span className="rounded bg-white/10 px-1.5 py-0.5 text-slate-300">{settings.lang === 'ur' ? 'Urdu' : 'English'}</span>
            </p>
          </div>
        </div>

        {/* Conversation now */}
        <div className="min-w-0 flex-1 space-y-1.5 rounded-xl bg-white/5 px-4 py-3">
          <p className="truncate text-sm text-white" title={lastAgent?.text}>
            <span className="mr-2 text-xs font-semibold text-violet-300">Agent</span>
            {lastAgent?.text ?? 'New orders will be read out here.'}
          </p>
          <p className="truncate text-sm text-slate-300">
            <span className="mr-2 text-xs font-semibold text-emerald-300">Chef</span>
            {agent.partial ? <span className="italic">{agent.partial}…</span> : (lastChef?.text ?? <span className="text-slate-500">—</span>)}
          </p>
        </div>

        {/* Awaiting confirmation */}
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {awaiting ? (
            <div className="flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 py-1.5 pr-1.5 pl-3">
              <AlertTriangle size={15} className="text-amber-300" />
              <span className="text-sm">
                <span className="font-semibold text-white">#{awaiting.orderNo}</span> <span className="text-amber-200">waiting for confirm</span>
              </span>
              <button type="button" onClick={() => agent.hear(`${awaiting.orderNo} confirm`)} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500">
                <Check size={13} /> Confirm
              </button>
              <button
                type="button"
                onClick={() => agent.say(orderAnnouncement(awaiting, settings.readItems))}
                className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10"
                aria-label="Repeat order"
                title="Repeat"
              >
                <RotateCcw size={15} />
              </button>
            </div>
          ) : (
            <span className="rounded-xl bg-white/5 px-3 py-2 text-sm text-slate-400">
              {pending.length ? `${pending.length} new order${pending.length > 1 ? 's' : ''} not started` : 'All orders confirmed'}
            </span>
          )}
          <button type="button" onClick={simulateOrder} className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/15" title="Push a demo order to the kitchen">
            <Plus size={15} /> Test order
          </button>
          <button type="button" onClick={() => setOpen(!open)} className="flex items-center gap-1 rounded-lg px-2 py-2 text-sm text-slate-300 hover:bg-white/10">
            Log {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="grid gap-4 border-t border-white/10 p-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex min-h-0 flex-col">
            <ul ref={logRef} className="scrollbar-dark max-h-64 space-y-2 overflow-y-auto pr-1">
              {agent.log.length === 0 && <li className="py-6 text-center text-sm text-slate-500">No conversation yet.</li>}
              {agent.log.map((l) => (
                <li key={l.id} className={cn('flex gap-2 text-sm', l.who === 'chef' && 'flex-row-reverse text-right')}>
                  <span
                    className={cn(
                      'max-w-[85%] rounded-xl px-3 py-2',
                      l.who === 'agent' ? 'bg-violet-500/15 text-violet-100' : l.who === 'chef' ? 'bg-emerald-500/15 text-emerald-100' : 'bg-white/5 text-xs text-slate-400',
                    )}
                  >
                    {l.text}
                  </span>
                  <span className="self-end text-[10px] text-slate-500">{new Date(l.at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                </li>
              ))}
            </ul>
            <form onSubmit={submit} className="mt-3 flex gap-2">
              <div className="relative flex-1">
                <Keyboard size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-500" />
                <input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder='Type a command, e.g. "1061 confirm" or "chicken khatam"'
                  className="h-10 w-full rounded-lg border border-white/10 bg-white/5 pr-3 pl-9 text-sm text-white placeholder:text-slate-500 focus:border-brand-400 focus:outline-none"
                />
              </div>
              <button type="submit" disabled={!typed.trim()} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-40">
                <Send size={14} /> Send
              </button>
            </form>
          </div>
          <div className="rounded-xl bg-white/5 p-3">
            <p className="mb-2 flex items-center justify-between text-xs font-semibold tracking-wide text-slate-400 uppercase">
              Voice commands
              <Link to="/kitchen/voice" className="flex items-center gap-1 text-[11px] font-medium tracking-normal text-slate-300 normal-case hover:text-white">
                <Settings2 size={12} /> Settings
              </Link>
            </p>
            <ul className="space-y-2">
              {commandHelp.map((c) => (
                <li key={c.say} className="text-sm">
                  <span className="font-medium text-white">{c.say}</span>
                  <span className="block text-xs text-slate-400">{c.does}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
