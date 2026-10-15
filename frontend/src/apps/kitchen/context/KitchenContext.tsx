/**
 * Shared state for the Kitchen Portal: live tickets, stock levels and the
 * voice agent. Lives above the kitchen shell so the agent keeps listening and
 * announcing while the chef moves between pages.
 *
 * Tickets are a view of the shared order flow (services/flow), so orders from
 * the waiter app and the customer app land here, and kitchen bumps reach the
 * waiter, counter and rider screens.
 *
 * Flow:
 *   new ticket → agent announces it → chef says "confirm" → ticket starts
 *   ticket bumped to Ready → recipe ingredients deducted from stock
 *   stock crosses critical / out → toast + spoken alert, out items switched off
 */
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useToast } from '@/shared/components/ui'
import { useAuth } from '@/shared/context/AuthContext'
import type { FlowItem } from '@/shared/services/flow'
import { addOrder, getFlow, lineFromMenu, setOrderStatus, ticketStatusFor, toTickets, updateOrderItems, useFlow } from '@/shared/services/flow'
import type { AlertLevel, DraftLine, StockAlert, Usage } from '@/apps/kitchen/services/kitchen'
import { matchIngredient, menuItemsUsing, stockAlerts, usageForTicket } from '@/apps/kitchen/services/kitchen'
import type { Ingredient, KitchenTicket, TicketStatus } from '@/shared/services/operations'
import { getIngredients, menuItems } from '@/shared/services/operations'
import type { Listener, Phrase, Speaker, VoiceSettings } from '@/apps/kitchen/services/voice'
import { createListener, createSpeaker, defaultVoiceSettings, orderAnnouncement, parseCommand, phrases, phraseText } from '@/apps/kitchen/services/voice'

export type AgentState = 'off' | 'starting' | 'idle' | 'speaking' | 'listening' | 'error'

export interface AgentLogEntry {
  id: string
  who: 'agent' | 'chef' | 'system'
  text: string
  at: number
}

export interface Deduction {
  id: string
  orderNo: number
  lines: Usage[]
  at: string
}

interface KitchenState {
  loading: boolean
  tickets: KitchenTicket[]
  setTickets: Dispatch<SetStateAction<KitchenTicket[]>>
  /** Move a ticket to a new status (deducts stock when it reaches Ready). */
  moveTicket: (id: string, status: TicketStatus) => void
  ingredients: Ingredient[]
  alerts: StockAlert[]
  deductions: Deduction[]
  /** Menu item names switched off because an ingredient ran out. */
  unavailable: Set<string>
  setItemAvailable: (name: string, available: boolean) => void
  markIngredientOut: (ingredientId: string) => void
  /** Apply confirmed smart-entry lines to stock. */
  applyStockLines: (lines: DraftLine[], source: string) => void

  agent: {
    state: AgentState
    error: string | null
    partial: string
    log: AgentLogEntry[]
    awaitingId: string | null
    start: () => Promise<void>
    stop: () => Promise<void>
    say: (p: Phrase) => void
    /** Feed text as if the chef said it (typing fallback / demo). */
    hear: (text: string) => void
  }
  settings: VoiceSettings
  setSettings: (s: VoiceSettings) => void
  demoStream: boolean
  setDemoStream: (on: boolean) => void
  simulateOrder: () => void
}

const KitchenContext = createContext<KitchenState | null>(null)

const SETTINGS_KEY = 'ros.voice'
const readSettings = (): VoiceSettings => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    return raw ? { ...defaultVoiceSettings, ...(JSON.parse(raw) as Partial<VoiceSettings>) } : defaultVoiceSettings
  } catch {
    return defaultVoiceSettings
  }
}

const SIM_NAMES = ['Ayesha Noor', 'Bilal Ahmed', 'Sana Malik', 'Usman Tariq', 'Hira Javed']
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)]

export function KitchenProvider({ children }: { children: ReactNode }) {
  const notify = useToast()
  const { can } = useAuth()
  const stockOn = can('stockAlerts')
  const flow = useFlow()
  const tickets = useMemo(() => toTickets(flow.orders), [flow.orders])
  const [loading, setLoading] = useState(true)
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [deductions, setDeductions] = useState<Deduction[]>([])
  const [unavailable, setUnavailable] = useState<Set<string>>(() => new Set(menuItems.filter((m) => !m.available).map((m) => m.name)))
  const [settings, setSettingsState] = useState<VoiceSettings>(readSettings)
  const [demoStream, setDemoStream] = useState(true)

  const [agentState, setAgentState] = useState<AgentState>('off')
  const [agentError, setAgentError] = useState<string | null>(null)
  const [partial, setPartial] = useState('')
  const [log, setLog] = useState<AgentLogEntry[]>([])
  const [awaitingId, setAwaitingId] = useState<string | null>(null)

  // Refs so long-lived callbacks (listener, timers) always see current state
  const ingredientsRef = useRef(ingredients)
  const settingsRef = useRef(settings)
  const awaitingRef = useRef(awaitingId)
  const onRef = useRef(false)
  const speakerRef = useRef<Speaker | null>(null)
  const listenerRef = useRef<Listener | null>(null)
  const queueRef = useRef<Promise<void>>(Promise.resolve())
  // Tickets already on the board when the portal opens are not re-announced one by one
  const [initialIds] = useState(() => toTickets(getFlow().orders))
  const announcedRef = useRef(new Set(initialIds.map((t) => t.id)))
  const remindedRef = useRef(new Set<string>())
  const deductedRef = useRef(new Set(initialIds.filter((t) => t.status !== 'New' && t.status !== 'Preparing').map((t) => t.id)))
  const alertLevelsRef = useRef(new Map<string, AlertLevel>())
  useEffect(() => {
    ingredientsRef.current = ingredients
    awaitingRef.current = awaitingId
  }, [ingredients, awaitingId])

  useEffect(() => {
    void getIngredients().then((i) => {
      stockAlerts(i).forEach((a) => alertLevelsRef.current.set(a.ingredient.id, a.level))
      setIngredients(i)
      setLoading(false)
    })
  }, [])

  const currentTickets = () => toTickets(getFlow().orders)

  const addLog = useCallback((who: AgentLogEntry['who'], text: string) => {
    setLog((l) => [...l.slice(-60), { id: `${Date.now()}-${Math.random()}`, who, text, at: Date.now() }])
  }, [])

  /* ---------------- speaking ---------------- */

  const say = useCallback(
    (p: Phrase) => {
      addLog('agent', phraseText(p, settingsRef.current.lang))
      if (!onRef.current || !speakerRef.current) return
      queueRef.current = queueRef.current.then(async () => {
        if (!onRef.current) return
        setAgentState('speaking')
        listenerRef.current?.pause()
        try {
          await speakerRef.current?.speak(p)
        } catch (e) {
          setAgentError(e instanceof Error ? e.message : 'Speech failed')
        } finally {
          if (onRef.current) {
            listenerRef.current?.resume()
            setAgentState('listening')
          }
        }
      })
    },
    [addLog],
  )

  /* ---------------- stock ---------------- */

  const adjustStock = useCallback((changes: { ingredient: string; delta: number }[]) => {
    setIngredients((prev) =>
      prev.map((i) => {
        const delta = changes.filter((c) => c.ingredient === i.name || c.ingredient === i.id).reduce((s, c) => s + c.delta, 0)
        return delta ? { ...i, stock: Math.max(0, Math.round((i.stock + delta) * 1000) / 1000), updatedAt: new Date().toISOString() } : i
      }),
    )
  }, [])

  const setItemAvailable = useCallback((name: string, available: boolean) => {
    setUnavailable((prev) => {
      const next = new Set(prev)
      if (available) next.delete(name)
      else next.add(name)
      return next
    })
  }, [])

  /** Chef reported it out: zero the stock and switch off dependent menu items (no separate spoken alert). */
  const markIngredientOut = useCallback(
    (ingredientId: string) => {
      const ing = ingredientsRef.current.find((i) => i.id === ingredientId)
      if (!ing) return
      alertLevelsRef.current.set(ingredientId, 'out')
      setIngredients((prev) => prev.map((i) => (i.id === ingredientId ? { ...i, stock: 0, updatedAt: new Date().toISOString() } : i)))
      menuItemsUsing(ing.name).forEach((m) => setItemAvailable(m.name, false))
    },
    [setItemAvailable],
  )

  const applyStockLines = useCallback(
    (lines: DraftLine[], source: string) => {
      const changes = lines
        .filter((l) => l.ingredientId)
        .map((l) => {
          const ing = ingredientsRef.current.find((i) => i.id === l.ingredientId)!
          return { ingredient: ing.id, delta: l.kind === 'Count' ? l.qty - ing.stock : l.kind === 'Wastage' ? -l.qty : l.qty }
        })
      adjustStock(changes)
      // Restocked ingredients bring their menu items back
      for (const l of lines) {
        const ing = ingredientsRef.current.find((i) => i.id === l.ingredientId)
        if (ing && l.kind !== 'Wastage') menuItemsUsing(ing.name).forEach((m) => setItemAvailable(m.name, true))
      }
      addLog('system', `Stock updated from ${source}: ${lines.length} line${lines.length === 1 ? '' : 's'}`)
    },
    [adjustStock, addLog, setItemAvailable],
  )

  /* ---------------- tickets ---------------- */

  const moveTicket = useCallback(
    (id: string, status: TicketStatus) => {
      const t = currentTickets().find((x) => x.id === id)
      const order = getFlow().orders.find((o) => o.id === id)
      if (!t || !order || t.status === status) return
      setOrderStatus(id, ticketStatusFor(order, status))
      if (awaitingRef.current === id && status !== 'New') setAwaitingId(null)

      if (status === 'Ready' && !deductedRef.current.has(id)) {
        deductedRef.current.add(id)
        const usage = usageForTicket(t)
        if (usage.length) {
          adjustStock(usage.map((u) => ({ ingredient: u.ingredient, delta: -u.qty })))
          setDeductions((d) => [{ id: `dd-${id}`, orderNo: t.orderNo, lines: usage, at: new Date().toISOString() }, ...d].slice(0, 50))
        }
      }
    },
    [adjustStock],
  )

  const announce = useCallback(
    (t: KitchenTicket, reminder = false) => {
      say(orderAnnouncement(t, settingsRef.current.readItems, reminder))
      setAwaitingId(t.id)
    },
    [say],
  )

  // Announce tickets that arrive while the agent is on
  useEffect(() => {
    for (const t of tickets) {
      if (announcedRef.current.has(t.id)) continue
      announcedRef.current.add(t.id)
      if (t.status !== 'New') continue
      notify(`New order #${t.orderNo} — ${t.table ? `Table ${t.table}` : t.type}`, 'info')
      if (onRef.current && settingsRef.current.announceOrders) announce(t)
    }
  }, [tickets, announce, notify])

  // Remind once if an announced order is still unconfirmed
  useEffect(() => {
    const secs = settings.repeatAfterSec
    if (!awaitingId || !secs || agentState === 'off') return
    const timer = setTimeout(() => {
      const t = currentTickets().find((x) => x.id === awaitingId)
      if (t?.status === 'New' && !remindedRef.current.has(t.id)) {
        remindedRef.current.add(t.id)
        announce(t, true)
      }
    }, secs * 1000)
    return () => clearTimeout(timer)
  }, [awaitingId, settings.repeatAfterSec, agentState, announce])

  /* ---------------- alerts ---------------- */

  const alerts = useMemo(() => stockAlerts(ingredients), [ingredients])

  useEffect(() => {
    if (loading) return
    const prev = alertLevelsRef.current
    const next = new Map<string, AlertLevel>()
    for (const a of alerts) {
      next.set(a.ingredient.id, a.level)
      const was = prev.get(a.ingredient.id)
      const escalated = (a.level === 'critical' && was !== 'critical' && was !== 'out') || (a.level === 'out' && was !== 'out')
      if (!escalated) continue
      notify(a.message, a.level === 'out' ? 'error' : 'info')
      addLog('system', `Stock alert: ${a.message}`)
      if (a.level === 'out') a.affectedItems.forEach((m) => setItemAvailable(m.name, false))
      if (settingsRef.current.announceAlerts && stockOn) {
        const roman = a.level === 'out' ? `Alert! ${a.ingredient.name} khatam ho gaya hai.` : `Alert! ${a.ingredient.name} sirf ${a.ingredient.stock} ${a.ingredient.unit} reh gaya hai.`
        say({ ur: a.spoken.ur, roman, en: a.spoken.en })
      }
    }
    alertLevelsRef.current = next
  }, [alerts, loading, notify, addLog, say, setItemAvailable, stockOn])

  /* ---------------- listening ---------------- */

  const hear = useCallback(
    (text: string) => {
      if (!text) return
      addLog('chef', text)
      setPartial('')
      const cmd = parseCommand(text)
      const list = currentTickets()
      const byNo = (n?: number) => (n ? list.find((t) => t.orderNo === n) : undefined)

      switch (cmd.type) {
        case 'confirm': {
          const target = byNo(cmd.orderNo) ?? list.find((t) => t.id === awaitingRef.current && t.status === 'New') ?? list.filter((t) => t.status === 'New').sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]
          if (!target || target.status !== 'New') return say(phrases.nothingPending())
          moveTicket(target.id, 'Preparing')
          return say(phrases.confirmed(target.orderNo))
        }
        case 'ready': {
          const preparing = list.filter((t) => t.status === 'Preparing')
          const target = byNo(cmd.orderNo) ?? (preparing.length === 1 ? preparing[0] : undefined)
          if (!target) return say(phrases.whichOrder())
          moveTicket(target.id, 'Ready')
          notify(`#${target.orderNo} ready — marked by voice`)
          return say(phrases.ready(target.orderNo))
        }
        case 'repeat': {
          const target = byNo(cmd.orderNo) ?? list.find((t) => t.id === awaitingRef.current)
          if (target) return say(orderAnnouncement(target, settingsRef.current.readItems))
          return say(phrases.nothingPending())
        }
        case 'out_of_stock': {
          const { ingredient } = matchIngredient(cmd.text, ingredientsRef.current)
          if (ingredient) {
            markIngredientOut(ingredient.id)
            return say(phrases.outOfStock(ingredient.name, menuItemsUsing(ingredient.name).length))
          }
          const item = menuItems.find((m) => cmd.text.toLowerCase().includes(m.name.toLowerCase()))
          if (item) {
            setItemAvailable(item.name, false)
            return say(phrases.outOfStock(item.name, 1))
          }
          return say(phrases.notUnderstood())
        }
        case 'stop':
          speakerRef.current?.cancel()
          return
        default:
          // Ignore kitchen chatter unless the agent is waiting for an answer
          if (awaitingRef.current) say(phrases.notUnderstood())
      }
    },
    [addLog, say, moveTicket, notify, markIngredientOut, setItemAvailable],
  )

  const stop = useCallback(async () => {
    onRef.current = false
    speakerRef.current?.cancel()
    await listenerRef.current?.stop().catch(() => undefined)
    listenerRef.current = null
    speakerRef.current = null
    setPartial('')
    setAgentState('off')
  }, [])

  const start = useCallback(async () => {
    if (onRef.current) return
    setAgentError(null)
    setAgentState('starting')
    const s = settingsRef.current
    speakerRef.current = createSpeaker(s)
    const listener = createListener(s, {
      onPartial: setPartial,
      onUtterance: (t) => hear(t),
      onError: (e) => {
        setAgentError(e.message)
        addLog('system', `Voice error: ${e.message}`)
      },
    })
    try {
      await listener.start()
      listenerRef.current = listener
      onRef.current = true
      setAgentState('listening')
      addLog('system', `Voice agent started (${s.provider === 'soniox' ? 'Soniox' : 'browser voice'}, ${s.lang === 'ur' ? 'Urdu' : 'English'})`)
      const pending = currentTickets().filter((t) => t.status === 'New').length
      if (pending) say(phrases.pendingSummary(pending))
    } catch (e) {
      speakerRef.current = null
      setAgentState('error')
      setAgentError(e instanceof Error ? e.message : 'Could not start the voice agent')
    }
  }, [hear, addLog, say])

  // Provider / language changes need a fresh speaker + listener
  const setSettings = useCallback(
    (s: VoiceSettings) => {
      const restart = onRef.current && (s.provider !== settingsRef.current.provider || s.lang !== settingsRef.current.lang)
      settingsRef.current = s
      setSettingsState(s)
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
      } catch {
        /* storage unavailable */
      }
      if (restart) void stop().then(start)
      else if (speakerRef.current) speakerRef.current = createSpeaker(s)
    },
    [start, stop],
  )

  useEffect(() => () => void stop(), [stop])

  /* ---------------- demo order stream ---------------- */

  const simulateOrder = useCallback(() => {
    const available = menuItems.filter((m) => !unavailable.has(m.name))
    const count = 1 + Math.floor(Math.random() * 3)
    const items: FlowItem[] = Array.from(new Set(Array.from({ length: count }, () => pick(available)))).map((m) =>
      lineFromMenu(m.id, 1 + Math.floor(Math.random() * 3), m.variants.length ? [m.variants[0].name] : []),
    )
    const occupied = getFlow().tables.filter((t) => t.status === 'Occupied')
    const dineIn = Math.random() < 0.55 && occupied.length > 0
    const table = dineIn ? pick(occupied) : undefined
    addOrder({
      type: dineIn ? 'Dine-in' : 'Delivery',
      source: dineIn ? 'Waiter' : 'Customer App',
      table: table?.id,
      guests: table?.guests,
      waiter: table?.server,
      customer: dineIn ? undefined : { name: pick(SIM_NAMES), phone: '+92 300 1234567', address: 'Flat 3, Gulberg III, Lahore' },
      items,
      status: 'Received',
      priority: Math.random() < 0.15 ? 'Rush' : 'Normal',
      predictedMins: 8 + Math.floor(Math.random() * 15),
      payOnDelivery: dineIn ? undefined : 'Cash',
    })
  }, [unavailable])

  useEffect(() => {
    if (!demoStream || loading) return
    const timer = setInterval(simulateOrder, 45_000)
    return () => clearInterval(timer)
  }, [demoStream, loading, simulateOrder])

  /** KDS edits (item checks, station moves, remakes) written back to the order flow. */
  const setTickets: Dispatch<SetStateAction<KitchenTicket[]>> = useCallback((update) => {
    const current = currentTickets()
    const next = typeof update === 'function' ? update(current) : update
    for (const t of next) {
      const order = getFlow().orders.find((o) => o.id === t.id)
      if (!order) {
        // Remake: a fresh ticket for the same table / customer (not billed again)
        const src = getFlow().orders.find((o) => o.orderNo === t.orderNo)
        addOrder({
          type: t.type,
          source: src?.source ?? 'Waiter',
          table: t.table,
          waiter: src?.waiter,
          customer: src?.customer,
          items: t.items.map((i) => {
            const m = menuItems.find((x) => x.name === i.name)
            const base: FlowItem = m ? lineFromMenu(m.id, i.qty, i.modifiers, i.notes) : { itemId: i.name, name: i.name, emoji: '🍽️', qty: i.qty, price: 0, station: i.station, modifiers: i.modifiers, notes: i.notes, done: false }
            return { ...base, price: 0 }
          }),
          status: 'Received',
          priority: t.priority,
          predictedMins: t.predictedMins,
          remake: true,
        })
        continue
      }
      const prev = current.find((x) => x.id === t.id)
      if (prev && JSON.stringify(prev.items) !== JSON.stringify(t.items)) {
        updateOrderItems(order.id, order.items.map((it, idx) => ({ ...it, done: t.items[idx]?.done ?? it.done, station: t.items[idx]?.station ?? it.station })))
      }
      if (prev && prev.status !== t.status) setOrderStatus(order.id, ticketStatusFor(order, t.status))
    }
  }, [])

  const value: KitchenState = {
    loading,
    tickets,
    setTickets,
    moveTicket,
    ingredients,
    alerts,
    deductions,
    unavailable,
    setItemAvailable,
    markIngredientOut,
    applyStockLines,
    agent: { state: agentState, error: agentError, partial, log, awaitingId, start, stop, say, hear },
    settings,
    setSettings,
    demoStream,
    setDemoStream,
    simulateOrder,
  }

  return <KitchenContext.Provider value={value}>{children}</KitchenContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useKitchen() {
  const ctx = useContext(KitchenContext)
  if (!ctx) throw new Error('useKitchen must be used inside KitchenProvider')
  return ctx
}
