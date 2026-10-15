import type { ReactElement, ReactNode } from 'react'
import { ResponsiveContainer } from 'recharts'
import { cn } from '@/shared/lib/cn'

/** Fixed-height wrapper for a recharts chart. */
export function ChartBox({ height = 260, children, className }: { height?: number; children: ReactElement; className?: string }) {
  return (
    <div className={cn('w-full min-w-0', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  )
}

/** Tiny inline SVG sparkline; optional min/max band shown as dashed guides. */
export function Sparkline({
  values,
  min,
  max,
  stroke = '#fe5a11',
  width = 160,
  height = 40,
  className,
}: {
  values: number[]
  min?: number
  max?: number
  stroke?: string
  width?: number
  height?: number
  className?: string
}) {
  if (values.length < 2) return null
  const lo = Math.min(...values, min ?? Infinity) - 0.5
  const hi = Math.max(...values, max ?? -Infinity) + 0.5
  const y = (v: number) => height - ((v - lo) / (hi - lo || 1)) * height
  const x = (i: number) => (i / (values.length - 1)) * width
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className={cn('h-10 w-full', className)} aria-hidden>
      {min !== undefined && <line x1={0} x2={width} y1={y(min)} y2={y(min)} stroke="#94a3b8" strokeDasharray="3 3" strokeWidth={1} />}
      {max !== undefined && <line x1={0} x2={width} y1={y(max)} y2={y(max)} stroke="#94a3b8" strokeDasharray="3 3" strokeWidth={1} />}
      <path d={d} fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r={2.5} fill={stroke} />
    </svg>
  )
}

/** Deterministic mock QR code drawn with an SVG grid (not scannable). */
export function MockQR({ seed = 'spice-route', size = 168, className }: { seed?: string; size?: number; className?: string }) {
  const n = 25
  let h = [...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)
  const rand = () => {
    h ^= h << 13
    h ^= h >>> 17
    h ^= h << 5
    return ((h >>> 0) % 1000) / 1000
  }
  const finder = (r: number, c: number) => {
    const inBox = (br: number, bc: number) => r >= br && r < br + 7 && c >= bc && c < bc + 7
    return inBox(0, 0) || inBox(0, n - 7) || inBox(n - 7, 0)
  }
  const cells: ReactNode[] = []
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      if (finder(r, c)) continue
      if ((r > 9 && r < 15 && c > 9 && c < 15) || rand() < 0.48) continue
      cells.push(<rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} />)
    }
  const eye = (x: number, y: number) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width={7} height={7} rx={1.2} fill="#16181e" />
      <rect x={x + 1} y={y + 1} width={5} height={5} rx={0.8} fill="#fff" />
      <rect x={x + 2} y={y + 2} width={3} height={3} rx={0.6} fill="#16181e" />
    </g>
  )
  return (
    <svg viewBox={`-1 -1 ${n + 2} ${n + 2}`} width={size} height={size} className={cn('rounded-lg bg-white', className)} shapeRendering="crispEdges">
      <rect x={-1} y={-1} width={n + 2} height={n + 2} fill="#fff" />
      <g fill="#16181e">{cells}</g>
      {eye(0, 0)}
      {eye(n - 7, 0)}
      {eye(0, n - 7)}
      <rect x={10} y={10} width={5} height={5} rx={1.2} fill="#fe5a11" />
      <text x={12.5} y={13.6} textAnchor="middle" fontSize={3} fontWeight={700} fill="#fff">
        S
      </text>
    </svg>
  )
}

/** Rounded emoji tile used for suppliers, channels, menu items. */
export function EmojiTile({ emoji, className }: { emoji: string; className?: string }) {
  return <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-lg', className)}>{emoji}</span>
}

/** Star rating display. */
export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-px text-sm', className)} aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= Math.round(value) ? 'text-amber-400' : 'text-slate-200'}>
          ★
        </span>
      ))}
    </span>
  )
}

/** Wraps a grid of StatCards responsively. */
export function KpiGrid({ children, cols = 4 }: { children: ReactNode; cols?: 3 | 4 | 5 }) {
  return (
    <div
      className={cn(
        'mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2',
        cols === 3 && 'lg:grid-cols-3',
        cols === 4 && 'lg:grid-cols-4',
        cols === 5 && 'lg:grid-cols-3 xl:grid-cols-5',
      )}
    >
      {children}
    </div>
  )
}
