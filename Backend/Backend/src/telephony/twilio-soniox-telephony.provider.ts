import { Logger, ServiceUnavailableException } from '@nestjs/common'
import type { CallEvents, CallRequest, TelephonyProvider } from './telephony.types.js'

/**
 * TODO(telephony): real outbound verification calls. NOT IMPLEMENTED — selecting
 * TELEPHONY_PROVIDER=twilio makes POST /orders/:id/verify/call return 503.
 *
 * Intended design:
 *  1. Twilio REST `calls.create({ to: req.phone, from: TWILIO_FROM, twiml: <Connect><Stream url="wss://<api>/voice/stream/<callId>"/></Connect> })`
 *     (env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, PUBLIC_BASE_URL).
 *  2. Twilio status callbacks → events.state('ringing' | 'talking'); busy / no-answer / failed → events.result('no_answer').
 *  3. Media stream (8 kHz mu-law) → Soniox real-time STT (wss stt-rt, language hint "ur") → events.line('customer', text).
 *  4. Agent turns: speak req.script.greeting with Soniox TTS (tts_rt) back into the stream → events.line('agent', text).
 *  5. Classify the answer (haan / ji / confirm vs nahi / cancel) → say script.confirmed / script.declined → events.result(...).
 *  6. hangup(orderId): Twilio `calls(sid).update({ status: 'completed' })`.
 */
export class TwilioSonioxTelephonyProvider implements TelephonyProvider {
  readonly name = 'twilio'
  private readonly log = new Logger('TwilioSonioxTelephony')

  async startCall(req: CallRequest, _events: CallEvents): Promise<void> {
    this.log.error(`Real telephony is not implemented (order ${req.orderId})`)
    throw new ServiceUnavailableException('TELEPHONY_PROVIDER=twilio is not implemented yet. Use TELEPHONY_PROVIDER=demo, or confirm the order manually at the counter.')
  }

  hangup(_orderId: string): void {
    /* nothing to hang up until startCall is implemented */
  }
}
