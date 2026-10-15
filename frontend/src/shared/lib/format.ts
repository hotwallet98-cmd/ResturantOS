export const APP_CURRENCY = 'USD'
export const APP_LOCALE = 'en-US'

export function formatCurrency(value: number, opts: { compact?: boolean; currency?: string } = {}) {
  return new Intl.NumberFormat(APP_LOCALE, {
    style: 'currency',
    currency: opts.currency ?? APP_CURRENCY,
    notation: opts.compact ? 'compact' : 'standard',
    maximumFractionDigits: opts.compact ? 1 : 2,
  }).format(value)
}

export function formatNumber(value: number, compact = false) {
  return new Intl.NumberFormat(APP_LOCALE, { notation: compact ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value)
}

export function formatPercent(value: number, digits = 1) {
  return `${value.toFixed(digits)}%`
}

export function formatDate(value: string | Date, withTime = false) {
  const d = typeof value === 'string' ? new Date(value) : value
  return d.toLocaleString(APP_LOCALE, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}

export function timeAgo(value: string | Date) {
  const d = typeof value === 'string' ? new Date(value) : value
  const s = Math.round((Date.now() - d.getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

/** ISO timestamp `minutes` ago — handy for building mock data. */
export function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60_000).toISOString()
}

/** ISO date `days` from today (negative = past). */
export function daysFromNow(days: number) {
  return new Date(Date.now() + days * 86_400_000).toISOString()
}
