import { ArrowRight, PackageX, TriangleAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useKitchen } from '@/apps/kitchen/context/KitchenContext'
import { cn } from '@/shared/lib/cn'
import { alertStyle, fmtHours } from './alertStyle'

/** Out / critical stock shown above the KDS so chefs see it while cooking. */
export function StockAlertStrip() {
  const { alerts } = useKitchen()
  const urgent = alerts.filter((a) => a.level === 'out' || a.level === 'critical')
  if (!urgent.length) return null
  return (
    <div className="flex items-center gap-2 overflow-hidden rounded-xl border border-red-200 bg-white p-2">
      <span className="flex shrink-0 items-center gap-1.5 rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white">
        <TriangleAlert size={14} /> {urgent.length} stock alert{urgent.length > 1 ? 's' : ''}
      </span>
      <div className="scrollbar-thin flex min-w-0 flex-1 gap-2 overflow-x-auto">
        {urgent.map((a) => (
          <span key={a.ingredient.id} className={cn('flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs', alertStyle[a.level].chip)}>
            {a.level === 'out' ? <PackageX size={13} /> : <span>{a.ingredient.emoji}</span>}
            <span className="font-semibold">{a.ingredient.name}</span>
            <span>{a.level === 'out' ? 'khatam' : `${a.ingredient.stock} ${a.ingredient.unit} · ~${fmtHours(a.hoursLeft)}`}</span>
          </span>
        ))}
      </div>
      <Link to="/kitchen/alerts" className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100">
        View <ArrowRight size={13} />
      </Link>
    </div>
  )
}
