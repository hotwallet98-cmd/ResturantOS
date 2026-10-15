/**
 * Order verification call: the voice agent phones the customer, reads the order
 * back in Urdu and asks them to confirm (workflow 2, "Order arrives → Voice agent
 * calls → Order confirmed").
 *
 * Production: POST /voice/calls starts an outbound call on the backend
 * (telephony provider + Soniox STT/TTS); call progress comes back over the
 * order feed. Mock mode simulates the conversation with timers.
 */
import { formatCurrency } from '@/shared/lib/format'
import { api } from './api'
import { USE_MOCKS } from './client'
import type { FlowOrder } from './flow'
import { applyServerOrder, cancelOrder, confirmVerified, getFlow, orderTotal, RESTAURANT_NAME, setCall, setOrderStatus } from './flow'

export type CallOutcome = 'confirm' | 'decline' | 'no_answer'

const agentScript = (o: FlowOrder) => {
  const items = o.items.map((i) => `${i.qty} ${i.name}`).join(', ')
  return `Assalam-o-alaikum ${o.customer?.name ?? ''}! Main ${RESTAURANT_NAME} se AI assistant bol raha hoon. Aap ka order: ${items}. Total ${formatCurrency(orderTotal(o))}, ${o.payOnDelivery ?? 'Cash'} on delivery, address: ${o.customer?.address ?? '—'}. Kya main order confirm kar doon?`
}

const say = (id: string, who: 'agent' | 'customer', text: string) =>
  setCall(id, (c) => ({ ...c!, lines: [...(c?.lines ?? []), { who, text, at: Date.now() }] }))

const stateOf = (id: string) => getFlow().orders.find((o) => o.id === id)

/** Start (or retry) the verification call for a customer-app order. */
export function startVerificationCall(id: string, outcome: CallOutcome = 'confirm') {
  const order = stateOf(id)
  if (!order) return
  if (!USE_MOCKS) {
    void api.orders.startCall(id, { outcome }).then((updated) => applyServerOrder(updated as FlowOrder))
    return
  }
  setOrderStatus(id, 'Verifying')
  setCall(id, (c) => ({ state: 'dialing', lines: [], startedAt: Date.now(), attempts: (c?.attempts ?? 0) + 1 }))

  const step = (ms: number, fn: () => void) =>
    setTimeout(() => {
      // Stop if someone confirmed / cancelled manually meanwhile
      if (stateOf(id)?.status === 'Verifying') fn()
    }, ms)

  step(1500, () => setCall(id, (c) => ({ ...c!, state: 'ringing' })))
  if (outcome === 'no_answer') {
    step(9000, () => setCall(id, (c) => ({ ...c!, state: 'no_answer' })))
    return
  }
  step(4000, () => {
    setCall(id, (c) => ({ ...c!, state: 'talking' }))
    say(id, 'agent', agentScript(order))
  })
  step(9000, () => say(id, 'customer', outcome === 'confirm' ? 'Ji haan, confirm kar dein.' : 'Nahi, abhi cancel kar dein.'))
  step(11000, () => {
    if (outcome === 'confirm') {
      say(id, 'agent', `Shukriya! Aap ka order taqreeban ${order.predictedMins + 15} minute mein pohanch jayega.`)
      setCall(id, (c) => ({ ...c!, state: 'confirmed' }))
      confirmVerified(id)
    } else {
      say(id, 'agent', 'Theek hai, aap ka order cancel kar diya gaya hai. Allah Hafiz.')
      setCall(id, (c) => ({ ...c!, state: 'declined' }))
      cancelOrder(id)
    }
  })
}

/** Counter overrides when the call can't settle it. */
export function confirmManually(id: string) {
  if (!USE_MOCKS) {
    void api.orders.confirm(id).then((order) => applyServerOrder(order as FlowOrder))
    return
  }
  setCall(id, (c) => ({ state: 'confirmed', lines: c?.lines ?? [], startedAt: c?.startedAt ?? Date.now(), attempts: c?.attempts ?? 0 }))
  confirmVerified(id)
}
