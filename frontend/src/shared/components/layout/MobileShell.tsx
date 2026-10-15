import type { LucideIcon } from 'lucide-react'
import { ArrowLeft, LogOut, UtensilsCrossed } from 'lucide-react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { TierBadge } from '@/shared/components/plan/Gate'
import { useAuth } from '@/shared/context/AuthContext'
import { cn } from '@/shared/lib/cn'

export interface MobileTab<T extends string> {
  id: T
  label: string
  icon: LucideIcon
  count?: number
}

/**
 * Phone-first layout for the waiter and rider apps: sticky header, scrolling
 * body and a bottom tab bar. Centred as a device frame on desktop.
 */
export function MobileShell<T extends string>({
  title,
  subtitle,
  icon: Icon,
  tabs,
  tab,
  onTab,
  children,
}: {
  title: string
  subtitle?: ReactNode
  icon: LucideIcon
  tabs: MobileTab<T>[]
  tab: T
  onTab: (t: T) => void
  children: ReactNode
}) {
  const { user, signOut, plan } = useAuth()
  const navigate = useNavigate()
  const isAdmin = user?.role === 'restaurant_admin'
  return (
    <div className="min-h-full bg-slate-200/60 sm:py-6">
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col bg-slate-50 sm:min-h-[calc(100vh-3rem)] sm:overflow-hidden sm:rounded-[2rem] sm:shadow-2xl sm:ring-8 sm:ring-ink-900">
        <header className="sticky top-0 z-20 flex items-center gap-3 bg-ink-900 px-4 py-3 text-white">
          {isAdmin ? (
            <button type="button" onClick={() => navigate('/app')} className="rounded-lg p-1.5 hover:bg-white/10" aria-label="Back to Restaurant Operations">
              <ArrowLeft size={18} />
            </button>
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600">
              <UtensilsCrossed size={16} />
            </span>
          )}
          <div className="min-w-0 flex-1 leading-tight">
            <p className="flex items-center gap-2 font-semibold">
              <Icon size={15} className="text-brand-400" /> {title}
            </p>
            <p className="truncate text-[11px] text-slate-400">{subtitle ?? user?.name}</p>
          </div>
          <TierBadge tier={plan} className="bg-white/10 text-white" />
          {!isAdmin && (
            <button type="button" onClick={() => (signOut(), navigate('/login'))} className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10" aria-label="Sign out">
              <LogOut size={17} />
            </button>
          )}
        </header>

        <main className="flex-1 overflow-y-auto px-4 pt-4 pb-24">{children}</main>

        <nav className="sticky bottom-0 z-20 grid border-t border-slate-200 bg-white" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTab(t.id)}
              className={cn('relative flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium', tab === t.id ? 'text-brand-600' : 'text-slate-500')}
            >
              <t.icon size={20} />
              {t.label}
              {!!t.count && <span className="absolute top-1.5 left-1/2 ml-2 min-w-4 rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{t.count}</span>}
            </button>
          ))}
        </nav>
      </div>
    </div>
  )
}
