/**
 * Kitchen Portal services: recipe-based stock deduction, stock alerts and
 * "smart" stock entry (voice / invoice photo / purchase-order receiving).
 *
 * The parsing helpers run locally so the prototype works offline; with
 * VITE_USE_MOCKS=false the invoice parser calls the backend AI endpoint.
 */
import { minutesAgo } from '@/shared/lib/format'
import { API_BASE_URL, getToken, http, mock, request, USE_MOCKS } from '@/shared/services/client'
import type { Ingredient, KitchenTicket, MenuItem } from '@/shared/services/operations'
import { menuItems, recipes } from '@/shared/services/operations'

/* ------------------------------------------------------------------ */
/* Recipe usage                                                        */
/* ------------------------------------------------------------------ */

export interface Usage {
  ingredient: string
  qty: number
}

/**
 * Per-portion usage for menu items that don't have a full recipe card yet.
 * Full recipes (operations.recipes) always take priority.
 */
const portionUsage: Record<string, Usage[]> = {
  'mi-01': [{ ingredient: 'Chicken Fillet', qty: 0.2 }, { ingredient: 'Yoghurt', qty: 0.03 }, { ingredient: 'Charcoal', qty: 0.2 }],
  'mi-03': [{ ingredient: 'Chicken (bone-in)', qty: 0.35 }, { ingredient: 'Cooking Oil', qty: 0.06 }],
  'mi-06': [{ ingredient: 'Chicken Fillet', qty: 0.2 }, { ingredient: 'Cooking Cream', qty: 0.04 }, { ingredient: 'Charcoal', qty: 0.2 }],
  'mi-07': [{ ingredient: 'Lamb Chops', qty: 0.3 }, { ingredient: 'Charcoal', qty: 0.3 }],
  'mi-08': [{ ingredient: 'Chicken (bone-in)', qty: 0.45 }, { ingredient: 'Yoghurt', qty: 0.05 }, { ingredient: 'Charcoal', qty: 0.25 }],
  'mi-10': [{ ingredient: 'Mutton', qty: 0.5 }, { ingredient: 'Tomatoes', qty: 0.3 }, { ingredient: 'Cooking Oil', qty: 0.08 }],
  'mi-11': [{ ingredient: 'Chicken Fillet', qty: 0.2 }, { ingredient: 'Cooking Cream', qty: 0.05 }, { ingredient: 'Butter', qty: 0.03 }, { ingredient: 'Tomatoes', qty: 0.1 }],
  'mi-12': [{ ingredient: 'Butter', qty: 0.03 }, { ingredient: 'Cooking Cream', qty: 0.03 }],
  'mi-13': [{ ingredient: 'Paneer', qty: 0.12 }],
  'mi-02': [{ ingredient: 'Paneer', qty: 0.18 }, { ingredient: 'Yoghurt', qty: 0.03 }],
  'mi-15': [{ ingredient: 'Chicken (bone-in)', qty: 0.2 }, { ingredient: 'Basmati Rice', qty: 0.15 }, { ingredient: 'Yoghurt', qty: 0.04 }, { ingredient: 'Onions', qty: 0.06 }],
  'mi-16': [{ ingredient: 'Basmati Rice', qty: 0.15 }, { ingredient: 'Onions', qty: 0.05 }],
  'mi-18': [{ ingredient: 'Flour (Maida)', qty: 0.1 }, { ingredient: 'Butter', qty: 0.015 }],
  'mi-19': [{ ingredient: 'Flour (Maida)', qty: 0.11 }, { ingredient: 'Butter', qty: 0.01 }],
  'mi-21': [{ ingredient: 'Beef Mince', qty: 0.18 }, { ingredient: 'Burger Buns', qty: 1 }, { ingredient: 'Lettuce', qty: 0.02 }],
  'mi-22': [{ ingredient: 'Chicken Fillet', qty: 0.12 }, { ingredient: 'Lettuce', qty: 0.02 }],
  'mi-24': [{ ingredient: 'Chicken Fillet', qty: 0.25 }, { ingredient: 'Butter', qty: 0.02 }],
  'mi-25': [{ ingredient: 'Lettuce', qty: 0.12 }, { ingredient: 'Chicken Fillet', qty: 0.08 }],
  'mi-29': [{ ingredient: 'Mint Leaves', qty: 0.01 }],
  'mi-30': [{ ingredient: 'Yoghurt', qty: 0.15 }],
  'mi-32': [{ ingredient: 'Soft Drink Cans', qty: 1 }],
}

/** Recipe ingredient names that differ from the inventory item name. */
const recipeAliases: Record<string, string> = {
  'Burger Bun': 'Burger Buns',
}

export function usageForMenuItem(itemId: string): Usage[] {
  const recipe = recipes.find((r) => r.itemId === itemId)
  if (recipe) return recipe.ingredients.map((i) => ({ ingredient: recipeAliases[i.ingredient] ?? i.ingredient, qty: i.qty }))
  return portionUsage[itemId] ?? []
}

const menuByName = new Map(menuItems.map((m) => [m.name, m]))

/** Total ingredient usage for a kitchen ticket (all items × qty). */
export function usageForTicket(t: KitchenTicket): Usage[] {
  const total = new Map<string, number>()
  for (const it of t.items) {
    const menu = menuByName.get(it.name)
    if (!menu) continue
    for (const u of usageForMenuItem(menu.id)) total.set(u.ingredient, (total.get(u.ingredient) ?? 0) + u.qty * it.qty)
  }
  return [...total].map(([ingredient, qty]) => ({ ingredient, qty: Math.round(qty * 1000) / 1000 }))
}

/** Menu items that need this ingredient — they go unavailable when it runs out. */
export function menuItemsUsing(ingredient: string): MenuItem[] {
  return menuItems.filter((m) => usageForMenuItem(m.id).some((u) => u.ingredient === ingredient))
}

/* ------------------------------------------------------------------ */
/* Stock alerts                                                        */
/* ------------------------------------------------------------------ */

export type AlertLevel = 'out' | 'critical' | 'low' | 'expiring'

export interface StockAlert {
  ingredient: Ingredient
  level: AlertLevel
  /** Estimated service hours of stock left at today's pace. */
  hoursLeft: number
  message: string
  /** Same alert phrased for the voice agent. */
  spoken: { ur: string; en: string }
  affectedItems: MenuItem[]
  suggestedOrder: number
}

/** Kitchen is open ~12 hours a day; usagePerDay is spread across those hours. */
const SERVICE_HOURS = 12

export const hoursOfStock = (i: Ingredient) => (i.usagePerDay > 0 ? (i.stock / i.usagePerDay) * SERVICE_HOURS : Infinity)

const fmtQty = (n: number) => (n >= 10 ? Math.round(n).toString() : (Math.round(n * 10) / 10).toString())

const levelRank: Record<AlertLevel, number> = { out: 3, critical: 2, low: 1, expiring: 0 }
export const alertRank = (a: StockAlert) => levelRank[a.level]

export function stockAlerts(list: Ingredient[], now = Date.now()): StockAlert[] {
  const alerts: StockAlert[] = []
  for (const i of list) {
    const hours = hoursOfStock(i)
    const expiresInH = (new Date(i.expiry).getTime() - now) / 3_600_000
    let level: AlertLevel | null = null
    if (i.stock <= 0) level = 'out'
    else if (i.stock <= i.reorderPoint / 2 || hours < 4) level = 'critical'
    else if (i.stock <= i.reorderPoint) level = 'low'
    else if (expiresInH < 24) level = 'expiring'
    if (!level) continue

    const qty = `${fmtQty(i.stock)} ${i.unit}`
    const hrs = hours < 1 ? 'less than an hour' : `${Math.floor(hours)} hours`
    const hrsUrScript = hours < 1 ? 'ایک گھنٹے سے کم' : `${Math.floor(hours)} گھنٹے`
    const name = i.name.replace(/\s*\(.*\)/, '')

    const message =
      level === 'out'
        ? `${i.name} is out of stock`
        : level === 'expiring'
          ? `${i.name} expires within 24 hours (${qty} on hand)`
          : `${i.name}: only ${qty} left, about ${hrs} at today's pace`

    const spoken =
      level === 'out'
        ? { ur: `الرٹ! ${name} ختم ہو گیا ہے۔`, en: `Alert! ${name} is out of stock.` }
        : level === 'critical'
          ? { ur: `الرٹ! ${name} صرف ${qty} رہ گیا ہے، تقریباً ${hrsUrScript} میں ختم ہو جائے گا۔`, en: `Alert! Only ${qty} of ${name} left. It will run out in about ${hrs}.` }
          : level === 'low'
            ? { ur: `${name} کم ہو رہا ہے، ${qty} باقی ہے۔`, en: `${name} is running low, ${qty} left.` }
            : { ur: `${name} کل تک ایکسپائر ہو جائے گا۔`, en: `${name} expires within a day.` }

    alerts.push({
      ingredient: i,
      level,
      hoursLeft: hours,
      message,
      spoken,
      affectedItems: level === 'out' || level === 'critical' ? menuItemsUsing(i.name) : [],
      suggestedOrder: Math.max(0, Math.ceil(i.par - i.stock)),
    })
  }
  return alerts.sort((a, b) => alertRank(b) - alertRank(a) || a.hoursLeft - b.hoursLeft)
}

/* ------------------------------------------------------------------ */
/* Smart stock entry                                                   */
/* ------------------------------------------------------------------ */

export type EntryKind = 'Stock In' | 'Wastage' | 'Count'

export interface DraftLine {
  id: string
  /** Matched inventory item id, if any. */
  ingredientId?: string
  /** What was heard / read, before matching. */
  raw: string
  qty: number
  unit: string
  kind: EntryKind
  /** 0–1 match confidence; low values are highlighted for review. */
  confidence: number
  unitCost?: number
}

/** Spoken / colloquial names → inventory item name. Roman Urdu, Urdu script and English. */
const ingredientAliases: Record<string, string[]> = {
  'Chicken (bone-in)': ['chicken', 'murgi', 'murghi', 'chikan', 'مرغی', 'چکن'],
  'Chicken Fillet': ['fillet', 'boneless', 'chicken fillet', 'boneless chicken', 'فلے', 'بون لیس'],
  Mutton: ['mutton', 'gosht', 'bakra', 'مٹن', 'گوشت'],
  'Beef Mince': ['qeema', 'keema', 'mince', 'beef', 'قیمہ', 'بیف'],
  'Lamb Chops': ['chops', 'lamb', 'چانپ'],
  'Basmati Rice': ['rice', 'chawal', 'basmati', 'چاول'],
  'Flour (Maida)': ['flour', 'maida', 'atta', 'میدہ', 'آٹا'],
  'Cooking Oil': ['oil', 'tel', 'تیل', 'آئل'],
  Yoghurt: ['yoghurt', 'yogurt', 'dahi', 'دہی'],
  Butter: ['butter', 'makhan', 'مکھن', 'بٹر'],
  'Cooking Cream': ['cream', 'malai', 'کریم', 'ملائی'],
  Paneer: ['paneer', 'پنیر'],
  Tomatoes: ['tomato', 'tomatoes', 'tamatar', 'ٹماٹر'],
  Onions: ['onion', 'onions', 'pyaz', 'piyaz', 'پیاز'],
  'Green Chillies': ['chilli', 'chillies', 'mirch', 'hari mirch', 'مرچ'],
  Coriander: ['coriander', 'dhania', 'dhaniya', 'دھنیا'],
  Lettuce: ['lettuce', 'salad patta', 'لیٹس'],
  'Mint Leaves': ['mint', 'podina', 'pudina', 'پودینہ'],
  Saffron: ['saffron', 'zafran', 'زعفران'],
  'Karahi Masala': ['karahi masala', 'masala', 'مصالحہ'],
  Charcoal: ['charcoal', 'koyla', 'koila', 'کوئلہ'],
  'Burger Buns': ['bun', 'buns', 'بن'],
  'Soft Drink Cans': ['drink', 'drinks', 'can', 'cans', 'cold drink', 'ڈرنک'],
  'Takeaway Boxes': ['box', 'boxes', 'dabba', 'dabbay', 'ڈبے'],
}

const unitWords: Record<string, string> = {
  kg: 'kg', kilo: 'kg', kilos: 'kg', kilogram: 'kg', 'کلو': 'kg',
  g: 'g', gram: 'g', grams: 'g', 'گرام': 'g',
  l: 'L', liter: 'L', litre: 'L', liters: 'L', litres: 'L', 'لیٹر': 'L',
  pc: 'pc', pcs: 'pc', piece: 'pc', pieces: 'pc', dana: 'pc', 'دانے': 'pc', packet: 'pc', packets: 'pc',
  dozen: 'dozen', darjan: 'dozen', 'درجن': 'dozen',
}

const wastageWords = ['waste', 'wastage', 'kharab', 'zaya', 'phenk', 'spoiled', 'expired', 'خراب', 'ضائع', 'ویسٹ']
const countWords = ['count', 'gina', 'gin', 'baqi', 'bacha', 'reh gaya', 'پڑا', 'باقی', 'بچا']

const norm = (s: string) => s.toLowerCase().replace(/[،,.!?]/g, ' ').replace(/\s+/g, ' ').trim()

/** Find the inventory item mentioned in a piece of text. Longest alias wins (e.g. "chicken fillet" over "chicken"). */
export function matchIngredient(text: string, list: Ingredient[]): { ingredient?: Ingredient; confidence: number } {
  const t = ` ${norm(text)} `
  let best: { name: string; len: number } | null = null
  for (const [name, aliases] of Object.entries(ingredientAliases)) {
    for (const a of [name.toLowerCase(), ...aliases]) {
      if (t.includes(` ${a} `) || (/[؀-ۿ]/.test(a) && t.includes(a))) {
        if (!best || a.length > best.len) best = { name, len: a.length }
      }
    }
  }
  if (best) return { ingredient: list.find((i) => i.name === best.name), confidence: 0.92 }
  // Fallback: any word of an inventory name
  const hit = list.find((i) => norm(i.name).split(' ').some((w) => w.length > 3 && t.includes(` ${w} `)))
  return hit ? { ingredient: hit, confidence: 0.6 } : { confidence: 0 }
}

const urduDigits = '۰۱۲۳۴۵۶۷۸۹'
const toAsciiDigits = (s: string) => s.replace(/[۰-۹]/g, (d) => String(urduDigits.indexOf(d)))

const numberWords: Record<string, number> = {
  ek: 1, aik: 1, one: 1, do: 2, two: 2, teen: 3, three: 3, char: 4, chaar: 4, four: 4, panch: 5, paanch: 5, five: 5,
  che: 6, chay: 6, six: 6, saat: 7, seven: 7, aath: 8, eight: 8, nau: 9, nine: 9, das: 10, ten: 10,
  bees: 20, twenty: 20, tees: 30, thirty: 30, chalees: 40, forty: 40, pachas: 50, fifty: 50, sau: 100, hundred: 100,
  aadha: 0.5, adha: 0.5, half: 0.5,
}

/**
 * Turn a spoken sentence into draft stock lines.
 * "20 kg chicken aaya aur 5 kilo tamatar kharab" → Stock In 20 kg chicken, Wastage 5 kg tomatoes.
 */
export function parseSpokenStock(text: string, list: Ingredient[]): DraftLine[] {
  const clean = toAsciiDigits(text)
  const parts = clean.split(/\s+(?:aur|and|or|phir|اور|،|,)\s+|[,،;]/i).map((p) => p.trim()).filter(Boolean)
  const lines: DraftLine[] = []
  for (const part of parts) {
    const p = norm(part)
    const numMatch = p.match(/(\d+(?:\.\d+)?)/)
    let qty = numMatch ? parseFloat(numMatch[1]) : NaN
    if (Number.isNaN(qty)) {
      const w = p.split(' ').find((x) => x in numberWords)
      qty = w ? numberWords[w] : NaN
    }
    if (Number.isNaN(qty)) continue
    const { ingredient, confidence } = matchIngredient(p, list)
    const unitWord = p.split(' ').find((x) => x in unitWords)
    let unit = unitWord ? unitWords[unitWord] : ingredient?.unit ?? 'kg'
    if (unit === 'dozen') {
      qty *= 12
      unit = 'pc'
    }
    if (ingredient && unit === 'g' && ingredient.unit === 'kg') {
      qty /= 1000
      unit = 'kg'
    }
    const kind: EntryKind = wastageWords.some((w) => p.includes(w)) ? 'Wastage' : countWords.some((w) => p.includes(w)) ? 'Count' : 'Stock In'
    lines.push({ id: `dl-${Date.now()}-${lines.length}`, ingredientId: ingredient?.id, raw: part, qty, unit: ingredient?.unit ?? unit, kind, confidence, unitCost: ingredient?.costPerUnit })
  }
  return lines
}

export interface InvoiceScan {
  supplier: string
  invoiceNo: string
  date: string
  total: number
  lines: DraftLine[]
}

/**
 * Read a supplier invoice / bill photo. In mock mode returns a realistic sample;
 * with the backend it posts the image to the AI vision endpoint.
 */
export async function scanInvoice(file: File, list: Ingredient[]): Promise<InvoiceScan> {
  if (!USE_MOCKS) {
    // Multipart upload, so go through fetch directly (http() always sends JSON)
    const body = new FormData()
    body.append('image', file)
    const token = getToken()
    const res = await fetch(`${API_BASE_URL}/inventory/invoices/scan`, { method: 'POST', body, headers: token ? { Authorization: `Bearer ${token}` } : {} })
    if (!res.ok) throw new Error((await res.text()) || res.statusText)
    return (await res.json()) as InvoiceScan
  }
  const pick = (name: string) => list.find((i) => i.name === name)
  const line = (name: string, raw: string, qty: number, confidence: number): DraftLine => {
    const ing = pick(name)
    return { id: `inv-${name}`, ingredientId: ing?.id, raw, qty, unit: ing?.unit ?? 'kg', kind: 'Stock In', confidence, unitCost: ing?.costPerUnit }
  }
  return mock(
    {
      supplier: 'K&N Foods',
      invoiceNo: 'KN-48812',
      date: new Date().toISOString(),
      total: 683.4,
      lines: [
        line('Chicken (bone-in)', 'Broiler chicken w/ bone – 40 KG', 40, 0.97),
        line('Chicken Fillet', 'Chicken breast fillet – 25 KG', 25, 0.95),
        line('Burger Buns', 'Sesame bun (pack of 12) × 10', 120, 0.71),
      ],
    },
    1800,
  )
}

/* ------------------------------------------------------------------ */
/* Deliveries due today (purchase orders to receive)                   */
/* ------------------------------------------------------------------ */

export interface ExpectedDelivery {
  id: string
  po: string
  supplier: string
  eta: string
  status: 'Due' | 'Arrived' | 'Received'
  lines: { ingredient: string; qty: number; unit: string }[]
}

const expectedDeliveries: ExpectedDelivery[] = [
  {
    id: 'ed-1',
    po: 'PO-3318',
    supplier: 'Fresh Farms Co.',
    eta: minutesAgo(-35),
    status: 'Due',
    lines: [
      { ingredient: 'Tomatoes', qty: 30, unit: 'kg' },
      { ingredient: 'Onions', qty: 25, unit: 'kg' },
      { ingredient: 'Coriander', qty: 2, unit: 'kg' },
      { ingredient: 'Green Chillies', qty: 3, unit: 'kg' },
    ],
  },
  {
    id: 'ed-2',
    po: 'PO-3317',
    supplier: 'Guard Rice Mills',
    eta: minutesAgo(10),
    status: 'Arrived',
    lines: [{ ingredient: 'Basmati Rice', qty: 80, unit: 'kg' }],
  },
  {
    id: 'ed-3',
    po: 'PO-3319',
    supplier: 'Al-Madina Meats',
    eta: minutesAgo(-120),
    status: 'Due',
    lines: [
      { ingredient: 'Mutton', qty: 25, unit: 'kg' },
      { ingredient: 'Beef Mince', qty: 10, unit: 'kg' },
    ],
  },
]

export const getExpectedDeliveries = () => request<ExpectedDelivery[]>('/inventory/purchase-orders/expected', expectedDeliveries)

/* ------------------------------------------------------------------ */
/* Voice (Soniox) connection config                                    */
/* ------------------------------------------------------------------ */

export interface SonioxConfig {
  api_key: string
  region?: string
}

/**
 * Temporary Soniox key, minted by the backend (never ship the real key to the browser).
 * `usage` is 'transcribe_websocket' for listening and 'tts_rt' for speaking.
 */
export const getSonioxConfig = (usage?: string) =>
  http<SonioxConfig>('/voice/soniox-config', { method: 'POST', body: JSON.stringify({ usage }) })
