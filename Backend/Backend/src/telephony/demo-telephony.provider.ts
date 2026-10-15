import { Logger } from '@nestjs/common'
import type { CallEvents, CallRequest, TelephonyProvider } from './telephony.types.js'

/**
 * Simulated call with the same timeline as the web prototype
 * (Frontend/src/shared/services/verifyCall.ts):
 *   1.5 s ringing · 4 s agent talks · 9 s customer answers · 11 s result
 *   no_answer: ringing until 9 s, then no_answer.
 * DEMO_CALL_TIME_SCALE (default 1) speeds it up or slows it down.
 */
export class DemoTelephonyProvider implements TelephonyProvider {
  readonly name = 'demo'
  private readonly log = new Logger('DemoTelephony')
  private readonly timers = new Map<string, NodeJS.Timeout[]>()

  constructor(private readonly timeScale = 1) {}

  async startCall(req: CallRequest, events: CallEvents) {
    this.hangup(req.orderId)
    const outcome = req.outcome ?? 'confirm'
    this.log.log(`Calling ${req.phone} for order ${req.orderId} (demo, outcome=${outcome})`)
    const list: NodeJS.Timeout[] = []
    this.timers.set(req.orderId, list)
    const step = (ms: number, fn: () => void) => list.push(setTimeout(fn, ms * this.timeScale))

    step(1500, () => events.state('ringing'))
    if (outcome === 'no_answer') {
      step(9000, () => {
        events.result('no_answer')
        this.timers.delete(req.orderId)
      })
      return
    }
    step(4000, () => {
      events.state('talking')
      events.line('agent', req.script.greeting)
    })
    step(9000, () => events.line('customer', outcome === 'confirm' ? 'Ji haan, confirm kar dein.' : 'Nahi, abhi cancel kar dein.'))
    step(11000, () => {
      events.line('agent', outcome === 'confirm' ? req.script.confirmed : req.script.declined)
      events.result(outcome === 'confirm' ? 'confirmed' : 'declined')
      this.timers.delete(req.orderId)
    })
  }

  hangup(orderId: string) {
    for (const t of this.timers.get(orderId) ?? []) clearTimeout(t)
    this.timers.delete(orderId)
  }
}
