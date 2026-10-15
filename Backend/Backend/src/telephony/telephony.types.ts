/** Server-side telephony for the order verification call (delivery workflow, step 2). */

export type CallOutcome = 'confirm' | 'decline' | 'no_answer'
export type CallResult = 'confirmed' | 'declined' | 'no_answer'

/** What the voice agent says. Built from the order by call-script.ts (Roman Urdu). */
export interface CallScript {
  /** Greeting + order read-back + "shall I confirm?" */
  greeting: string
  /** Said after the customer confirms. */
  confirmed: string
  /** Said after the customer declines. */
  declined: string
}

export interface CallRequest {
  /** Unique per attempt; providers use it to cancel the right call. */
  callId: string
  orderId: string
  /** Customer phone, as entered in the customer app. */
  phone: string
  language: 'ur'
  script: CallScript
  /** Demo provider only: how the simulated customer answers. Real providers ignore it. */
  outcome?: CallOutcome
}

/** Progress callbacks. The verification service persists each one on the order and broadcasts it. */
export interface CallEvents {
  state(state: 'ringing' | 'talking'): void
  line(who: 'agent' | 'customer', text: string): void
  result(result: CallResult): void
}

export interface TelephonyProvider {
  readonly name: string
  /** Start an outbound call. Must return quickly; progress is reported through `events`. */
  startCall(req: CallRequest, events: CallEvents): Promise<void>
  /** Stop any call in progress for the order (manual confirm / cancel / retry). */
  hangup(orderId: string): void
}

export const TELEPHONY_PROVIDER = Symbol('TELEPHONY_PROVIDER')
