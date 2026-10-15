/**
 * Kitchen voice agent engine.
 *
 * Two interchangeable providers:
 * - `soniox`  — Soniox real-time STT (stt-rt-v5, Urdu + English code-switching)
 *               and Soniox TTS. Needs the backend to mint temporary keys
 *               (POST /voice/soniox-config), so it only runs with VITE_USE_MOCKS=false.
 * - `browser` — Web Speech API fallback (Chrome / Edge). Free, works in the prototype.
 *
 * Pages never talk to a provider directly; they use createSpeaker / createListener.
 */
import type { Recording } from '@soniox/client'
import { SonioxClient } from '@soniox/client'
import { USE_MOCKS } from '@/shared/services/client'
import { getSonioxConfig } from './kitchen'
import type { KitchenTicket } from '@/shared/services/operations'
import { menuItems } from '@/shared/services/operations'

export type VoiceProvider = 'soniox' | 'browser'
export type VoiceLang = 'ur' | 'en'

export interface VoiceSettings {
  provider: VoiceProvider
  lang: VoiceLang
  /** Soniox TTS voice name or cloned-voice id. */
  sonioxVoice: string
  speed: number
  announceOrders: boolean
  announceAlerts: boolean
  /** Read every item on the ticket, or only the order summary. */
  readItems: boolean
  /** Re-announce an order that hasn't been confirmed after this many seconds (0 = never). */
  repeatAfterSec: number
}

export const defaultVoiceSettings: VoiceSettings = {
  provider: USE_MOCKS ? 'browser' : 'soniox',
  lang: 'ur',
  sonioxVoice: import.meta.env.VITE_SONIOX_TTS_VOICE ?? 'Adrian',
  speed: 1,
  announceOrders: true,
  announceAlerts: true,
  readItems: true,
  repeatAfterSec: 30,
}

/** Something the agent says. `ur` is Urdu script (for TTS), `roman` is shown on screen. */
export interface Phrase {
  ur: string
  roman: string
  en: string
}

export const phraseText = (p: Phrase, lang: VoiceLang) => (lang === 'ur' ? p.roman : p.en)

/* ------------------------------------------------------------------ */
/* Phrases                                                             */
/* ------------------------------------------------------------------ */

const typeUr: Record<KitchenTicket['type'], { ur: string; roman: string }> = {
  'Dine-in': { ur: 'ڈائن ان', roman: 'Dine-in' },
  Takeaway: { ur: 'ٹیک اوے', roman: 'Takeaway' },
  Delivery: { ur: 'ڈیلیوری', roman: 'Delivery' },
}

export function orderAnnouncement(t: KitchenTicket, readItems: boolean, reminder = false): Phrase {
  const where = t.table
    ? { ur: `ٹیبل ${t.table}`, roman: `Table ${t.table}`, en: `table ${t.table}` }
    : { ur: `${typeUr[t.type].ur}، ${t.channel}`, roman: `${typeUr[t.type].roman}, ${t.channel}`, en: `${t.type.toLowerCase()}, ${t.channel}` }
  const rush = t.priority === 'Rush' ? { ur: 'ارجنٹ! ', roman: 'Urgent! ', en: 'Rush! ' } : { ur: '', roman: '', en: '' }
  const head = reminder
    ? { ur: `یاد دہانی: آرڈر ${t.orderNo} ابھی کنفرم نہیں ہوا۔`, roman: `Yaad-dihani: order ${t.orderNo} abhi confirm nahi hua.`, en: `Reminder: order ${t.orderNo} is not confirmed yet.` }
    : { ur: `${rush.ur}نیا آرڈر آیا ہے۔ نمبر ${t.orderNo}، ${where.ur}۔`, roman: `${rush.roman}Naya order aaya hai. Number ${t.orderNo}, ${where.roman}.`, en: `${rush.en}New order. Number ${t.orderNo}, ${where.en}.` }

  const items = readItems
    ? t.items.map((i) => {
        const mods = i.modifiers.length ? `، ${i.modifiers.join('، ')}` : ''
        const note = i.notes ? `، نوٹ: ${i.notes}` : ''
        return {
          ur: `${i.qty} ${i.name}${mods}${note}۔`,
          roman: `${i.qty} ${i.name}${i.modifiers.length ? ` (${i.modifiers.join(', ')})` : ''}${i.notes ? `, note: ${i.notes}` : ''}.`,
          en: `${i.qty} ${i.name}${i.modifiers.length ? `, ${i.modifiers.join(', ')}` : ''}${i.notes ? `, note: ${i.notes}` : ''}.`,
        }
      })
    : [{ ur: `کل ${t.items.reduce((s, i) => s + i.qty, 0)} آئٹمز۔`, roman: `Total ${t.items.reduce((s, i) => s + i.qty, 0)} items.`, en: `${t.items.reduce((s, i) => s + i.qty, 0)} items.` }]

  const tail = { ur: 'کنفرم کرنے کے لیے "کنفرم" بولیں۔', roman: 'Confirm karne ke liye "confirm" bolein.', en: 'Say "confirm" to accept.' }
  const join = (k: keyof Phrase) => [head[k], ...items.map((i) => i[k]), tail[k]].join(' ')
  return { ur: join('ur'), roman: join('roman'), en: join('en') }
}

export const phrases = {
  confirmed: (n: number): Phrase => ({ ur: `ٹھیک ہے، آرڈر ${n} کنفرم۔ تیاری شروع۔`, roman: `Theek hai, order ${n} confirm. Tayyari shuru.`, en: `Got it, order ${n} confirmed.` }),
  ready: (n: number): Phrase => ({ ur: `آرڈر ${n} تیار، ویٹر کو بتا دیا گیا۔`, roman: `Order ${n} tayyar, waiter ko bata diya gaya.`, en: `Order ${n} is ready, server notified.` }),
  nothingPending: (): Phrase => ({ ur: 'کوئی آرڈر کنفرم کے لیے باقی نہیں۔', roman: 'Koi order confirm ke liye baqi nahi.', en: 'No order is waiting for confirmation.' }),
  whichOrder: (): Phrase => ({ ur: 'کون سا آرڈر نمبر؟', roman: 'Kaunsa order number?', en: 'Which order number?' }),
  notUnderstood: (): Phrase => ({ ur: 'معاف کیجیے، سمجھ نہیں آیا۔ دوبارہ بولیں۔', roman: 'Maaf kijiye, samajh nahi aaya. Dobara bolein.', en: "Sorry, I didn't catch that." }),
  outOfStock: (name: string, items: number): Phrase => ({
    ur: `${name} ختم مارک کر دیا۔ ${items} مینو آئٹمز بند کر دیے گئے۔`,
    roman: `${name} khatam mark kar diya. ${items} menu items band kar diye gaye.`,
    en: `${name} marked out of stock. ${items} menu items switched off.`,
  }),
  pendingSummary: (n: number): Phrase => ({ ur: `وائس ایجنٹ آن ہے۔ ${n} آرڈر کنفرم کے منتظر ہیں۔`, roman: `Voice agent on hai. ${n} order confirm ke muntazir hain.`, en: `Voice agent is on. ${n} orders are waiting for confirmation.` }),
  test: (): Phrase => ({ ur: 'السلام علیکم! میں کچن وائس ایجنٹ ہوں۔ نیا آرڈر آئے گا تو میں بتاؤں گا۔', roman: 'Assalam-o-alaikum! Main kitchen voice agent hoon. Naya order aayega to main bataunga.', en: "Hello! I'm the kitchen voice agent. I'll call out new orders." }),
}

/* ------------------------------------------------------------------ */
/* Command parsing                                                     */
/* ------------------------------------------------------------------ */

export type VoiceCommand =
  | { type: 'confirm'; orderNo?: number }
  | { type: 'ready'; orderNo?: number }
  | { type: 'repeat'; orderNo?: number }
  | { type: 'out_of_stock'; text: string }
  | { type: 'stop' }
  | { type: 'unknown' }

const has = (t: string, words: string[]) => words.some((w) => (/[؀-ۿ]/.test(w) ? t.includes(w) : new RegExp(`\\b${w}\\b`).test(t)))

const KW = {
  outOfStock: ['khatam', 'khatm', 'out of stock', 'finish', 'finished', 'nahi bacha', 'ختم', 'آؤٹ آف اسٹاک'],
  ready: ['ready', 'tayyar', 'taiyar', 'tayar', 'done', 'ریڈی', 'تیار'],
  repeat: ['repeat', 'dobara', 'dubara', 'phir se', 'again', 'kya kaha', 'دوبارہ', 'پھر سے', 'ریپیٹ'],
  confirm: ['confirm', 'confirmed', 'theek', 'thik', 'ok', 'okay', 'haan', 'han', 'ji', 'jee', 'accept', 'shuru', 'chalo', 'کنفرم', 'ٹھیک', 'ہاں', 'جی', 'اوکے', 'شروع'],
  stop: ['stop', 'chup', 'bas', 'band karo', 'خاموش', 'بس', 'چپ'],
}

export function parseCommand(raw: string): VoiceCommand {
  const t = raw.toLowerCase().replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
  const num = t.match(/\b(\d{3,5})\b/)
  const orderNo = num ? Number(num[1]) : undefined
  if (has(t, KW.outOfStock)) return { type: 'out_of_stock', text: raw }
  if (has(t, KW.ready)) return { type: 'ready', orderNo }
  if (has(t, KW.repeat)) return { type: 'repeat', orderNo }
  if (has(t, KW.confirm)) return { type: 'confirm', orderNo }
  if (has(t, KW.stop)) return { type: 'stop' }
  return { type: 'unknown' }
}

/** Example commands shown to chefs. */
export const commandHelp: { say: string; does: string }[] = [
  { say: '"Confirm" / "Theek hai" / "Haan"', does: 'Accepts the order just announced and starts it' },
  { say: '"1058 confirm"', does: 'Confirms a specific order' },
  { say: '"1058 ready" / "1058 tayyar"', does: 'Marks the order ready; the waiter or rider is notified' },
  { say: '"Dobara bolo" / "Repeat"', does: 'Reads the last order again' },
  { say: '"Chicken khatam ho gaya"', does: 'Marks the ingredient out and switches off its menu items' },
  { say: '"Bas" / "Stop"', does: 'Stops the agent mid-sentence' },
]

/* ------------------------------------------------------------------ */
/* Providers                                                           */
/* ------------------------------------------------------------------ */

export interface Speaker {
  speak: (p: Phrase) => Promise<void>
  cancel: () => void
}

export interface ListenerHandlers {
  onPartial: (text: string) => void
  onUtterance: (text: string) => void
  onError: (err: Error) => void
}

export interface Listener {
  start: () => Promise<void>
  stop: () => Promise<void>
  /** Mute while the agent is talking so it doesn't hear itself. */
  pause: () => void
  resume: () => void
}

let soniox: SonioxClient | null = null
const sonioxClient = () =>
  (soniox ??= new SonioxClient({
    config: async (ctx) => getSonioxConfig(ctx?.usage),
  }))

/** Menu and command words passed to Soniox as context to boost recognition. */
const sttTerms = () => [...menuItems.map((m) => m.name), 'confirm', 'ready', 'khatam', 'tayyar', 'dobara']

function createSonioxSpeaker(s: VoiceSettings): Speaker {
  let audio: HTMLAudioElement | null = null
  let abort: AbortController | null = null
  return {
    async speak(p) {
      abort = new AbortController()
      const bytes = await sonioxClient().tts.generate({
        text: s.lang === 'ur' ? p.ur : p.en,
        language: s.lang,
        voice: s.sonioxVoice,
        audio_format: 'mp3',
        speed: s.speed,
        signal: abort.signal,
      })
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'audio/mpeg' }))
      audio = new Audio(url)
      await new Promise<void>((resolve) => {
        audio!.onended = audio!.onerror = audio!.onpause = () => resolve()
        void audio!.play().catch(() => resolve())
      })
      URL.revokeObjectURL(url)
    },
    cancel() {
      abort?.abort()
      audio?.pause()
    },
  }
}

function createSonioxListener(s: VoiceSettings, h: ListenerHandlers): Listener {
  let rec: Recording | null = null
  let finalText = ''
  return {
    async start() {
      rec = sonioxClient().realtime.record({
        model: 'stt-rt-v5',
        language_hints: s.lang === 'ur' ? ['ur', 'en'] : ['en', 'ur'],
        enable_endpoint_detection: true,
        max_endpoint_delay_ms: 1000,
        context: { terms: sttTerms() },
      })
      rec.on('result', (r) => {
        let partial = ''
        for (const tok of r.tokens) {
          if (tok.text === '<end>') {
            const said = finalText.trim()
            finalText = ''
            if (said) h.onUtterance(said)
          } else if (tok.is_final) finalText += tok.text
          else partial += tok.text
        }
        h.onPartial((finalText + partial).trim())
      })
      rec.on('error', h.onError)
    },
    async stop() {
      await rec?.stop()
      rec = null
    },
    pause: () => rec?.pause(),
    resume: () => rec?.resume(),
  }
}

/* Web Speech API (not in TS's DOM lib) */
interface SpeechRecognitionResultLike {
  isFinal: boolean
  0: { transcript: string }
}
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: { resultIndex: number; results: ArrayLike<SpeechRecognitionResultLike> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

const recognitionCtor = (): SpeechRecognitionCtor | undefined => {
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

const voicesFor = (prefix: string) => (typeof speechSynthesis === 'undefined' ? [] : speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith(prefix)))

export function browserVoiceSupport() {
  return {
    tts: typeof speechSynthesis !== 'undefined',
    stt: !!recognitionCtor(),
    urduVoice: voicesFor('ur').length > 0,
  }
}

function createBrowserSpeaker(s: VoiceSettings): Speaker {
  return {
    speak(p) {
      return new Promise((resolve) => {
        if (typeof speechSynthesis === 'undefined') return resolve()
        // Urdu script needs an Urdu voice; otherwise read the Roman Urdu with an Indian/Pakistani English voice.
        const ur = voicesFor('ur')[0]
        const fallback = voicesFor('en-in')[0] ?? voicesFor('en')[0]
        const u = new SpeechSynthesisUtterance(s.lang === 'en' ? p.en : ur ? p.ur : p.roman)
        u.voice = s.lang === 'ur' && ur ? ur : fallback ?? null
        u.lang = u.voice?.lang ?? (s.lang === 'ur' ? 'ur-PK' : 'en-US')
        u.rate = s.speed
        u.onend = u.onerror = () => resolve()
        speechSynthesis.speak(u)
      })
    },
    cancel: () => typeof speechSynthesis !== 'undefined' && speechSynthesis.cancel(),
  }
}

function createBrowserListener(s: VoiceSettings, h: ListenerHandlers): Listener {
  const Ctor = recognitionCtor()
  let rec: SpeechRecognitionLike | null = null
  let active = false
  let paused = false
  const begin = () => {
    if (!Ctor || !active || paused) return
    rec = new Ctor()
    rec.lang = s.lang === 'ur' ? 'ur-PK' : 'en-IN'
    rec.continuous = true
    rec.interimResults = true
    rec.onresult = (e) => {
      let partial = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) h.onUtterance(r[0].transcript.trim())
        else partial += r[0].transcript
      }
      h.onPartial(partial.trim())
    }
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        active = false
        h.onError(new Error('Microphone permission denied'))
      }
    }
    // Chrome ends recognition after silence; keep it alive while the agent is on.
    rec.onend = () => active && !paused && begin()
    rec.start()
  }
  return {
    async start() {
      if (!Ctor) throw new Error('Speech recognition is not supported in this browser. Use Chrome or Edge.')
      active = true
      paused = false
      begin()
    },
    async stop() {
      active = false
      rec?.abort()
      rec = null
    },
    pause() {
      paused = true
      rec?.abort()
    },
    resume() {
      if (!paused) return
      paused = false
      begin()
    },
  }
}

export const createSpeaker = (s: VoiceSettings): Speaker => (s.provider === 'soniox' ? createSonioxSpeaker(s) : createBrowserSpeaker(s))
export const createListener = (s: VoiceSettings, h: ListenerHandlers): Listener =>
  s.provider === 'soniox' ? createSonioxListener(s, h) : createBrowserListener(s, h)
