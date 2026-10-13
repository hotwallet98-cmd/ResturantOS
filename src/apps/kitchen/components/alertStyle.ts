import type { AlertLevel } from '@/apps/kitchen/services/kitchen'

export const alertStyle: Record<AlertLevel, { label: string; chip: string; tone: 'red' | 'orange' | 'yellow' | 'blue' }> = {
  out: { label: 'Out of stock', chip: 'border-red-200 bg-red-50 text-red-800', tone: 'red' },
  critical: { label: 'Critical', chip: 'border-orange-200 bg-orange-50 text-orange-800', tone: 'orange' },
  low: { label: 'Low', chip: 'border-amber-200 bg-amber-50 text-amber-800', tone: 'yellow' },
  expiring: { label: 'Expiring', chip: 'border-sky-200 bg-sky-50 text-sky-800', tone: 'blue' },
}

export const fmtHours = (h: number) => (!Number.isFinite(h) ? '—' : h < 1 ? `${Math.max(1, Math.round(h * 60))} min` : `${h < 10 ? h.toFixed(1) : Math.round(h)} h`)
