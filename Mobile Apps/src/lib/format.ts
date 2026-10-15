import type { FlowStatus, TableStatus } from '@restaurantos/contracts'

/** Same currency as the web app (USD, en-US). Hand-rolled so it does not depend on Intl support in the JS engine. */
export function formatCurrency(value: number) {
  const neg = value < 0
  const [int, dec] = Math.abs(value).toFixed(2).split('.')
  return `${neg ? '-' : ''}$${int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${dec}`
}

export function timeAgo(value: string | Date) {
  const d = typeof value === 'string' ? new Date(value) : value
  const s = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000))
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export function clockTime(value: string | Date) {
  const d = typeof value === 'string' ? new Date(value) : value
  const h = d.getHours()
  const m = d.getMinutes()
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

export const isToday = (value: string) => {
  const d = new Date(value)
  const n = new Date()
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate()
}

type Tone = { bg: string; fg: string }
const tones = {
  gray: { bg: '#eef0f3', fg: '#475467' },
  purple: { bg: '#f1ecfe', fg: '#6941c6' },
  blue: { bg: '#e8f1fd', fg: '#175cd3' },
  yellow: { bg: '#fef5d9', fg: '#a15c07' },
  green: { bg: '#e3f8ec', fg: '#067647' },
  teal: { bg: '#e0f6f6', fg: '#0e7090' },
  red: { bg: '#fdecea', fg: '#b42318' },
} satisfies Record<string, Tone>

/** Status labels as in the web prototype (FlowBits / flowHelpers). */
export const statusMeta: Record<FlowStatus, { label: string } & Tone> = {
  Placed: { label: 'Placed', ...tones.gray },
  Verifying: { label: 'Verifying call', ...tones.purple },
  Received: { label: 'Sent to kitchen', ...tones.blue },
  Preparing: { label: 'Preparing', ...tones.yellow },
  Ready: { label: 'Ready', ...tones.green },
  Packed: { label: 'Packed', ...tones.teal },
  PickedUp: { label: 'Picked up', ...tones.teal },
  Served: { label: 'Served', ...tones.gray },
  Delivered: { label: 'Delivered', ...tones.gray },
  Paid: { label: 'Paid', ...tones.gray },
  Cancelled: { label: 'Cancelled', ...tones.red },
}

export const tableTone: Record<TableStatus, { bg: string; fg: string; border: string; dot: string }> = {
  Available: { bg: '#ecfdf3', fg: '#05603a', border: '#a6f4c5', dot: '#12b76a' },
  Occupied: { bg: '#fff4ed', fg: '#7c2d12', border: '#fdba8c', dot: '#ef3f07' },
  Reserved: { bg: '#eff8ff', fg: '#175cd3', border: '#b2ddff', dot: '#2e90fa' },
  Cleaning: { bg: '#f2f4f7', fg: '#667085', border: '#d0d5dd', dot: '#98a2b3' },
}
