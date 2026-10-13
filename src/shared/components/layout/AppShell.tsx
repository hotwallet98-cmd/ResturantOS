import {
  ArrowLeftRight,
  Bell,
  ChefHat,
  ChevronDown,
  Crown,
  ExternalLink,
  Lock,
  LogOut,
  Menu,
  MapPin,
  Search,
  Sparkles,
  UtensilsCrossed,
  Wand2,
  X,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Suspense, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Avatar, LoadingState } from '@/shared/components/ui'
import { useAuth } from '@/shared/context/AuthContext'
import { cn } from '@/shared/lib/cn'
import { demoUsers } from '@/shared/services/auth'
import type { NavSection } from '@/shared/navigation'
import type { Portal } from '@/shared/navigation'
import { portalHome, portalMeta } from '@/shared/navigation'
import { TierBadge } from '@/shared/components/plan/Gate'
import { features } from '@/shared/services/plans'
import { CopilotDrawer } from './CopilotDrawer'

const notifications: Record<Portal, { title: string; time: string; unread?: boolean }[]> = {
  admin: [
    { title: 'New restaurant application: Karachi Grill House', time: '5m', unread: true },
    { title: 'Payment failed for Urban Bites (Pro plan)', time: '32m', unread: true },
    { title: 'WhatsApp gateway latency elevated', time: '1h', unread: true },
    { title: 'Monthly platform report is ready', time: '3h' },
  ],
  restaurant: [
    { title: 'Low stock: Basmati Rice (6 kg left)', time: '2m', unread: true },
    { title: 'Order #1042 delayed in kitchen by 6 min', time: '9m', unread: true },
    { title: 'Reservation for 8 at 8:30 PM confirmed', time: '25m' },
    { title: 'Fridge #2 temperature back to normal', time: '1h' },
  ],
  kitchen: [
    { title: 'Chicken (bone-in) below reorder point', time: '4m', unread: true },
    { title: 'Fresh Farms delivery (PO-3318) arriving in 35 min', time: '12m', unread: true },
    { title: 'Remake logged on #1060 — too salty', time: '17m' },
  ],
  counter: [
    { title: 'New app order waiting for verification call', time: '1m', unread: true },
    { title: 'Table T2 asked for the bill', time: '6m', unread: true },
  ],
}

function useClickOutside(onOutside: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handler = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && onOutside()
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onOutside])
  return ref
}

function Sidebar({ nav, portal, onNavigate }: { nav: NavSection[]; portal: Portal; onNavigate?: () => void }) {
  const PortalIcon = portalMeta[portal].icon
  const { can, plan } = useAuth()
  return (
    <div className="flex h-full flex-col bg-ink-900 text-slate-300">
      <Link to={portalHome[portal]} className="flex items-center gap-3 px-5 py-5" onClick={onNavigate}>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-lg shadow-brand-600/30">
          <UtensilsCrossed size={18} />
        </span>
        <div className="leading-tight">
          <p className="font-semibold text-white">RestaurantOS</p>
          <p className="flex items-center gap-1 text-[11px] text-slate-400">
            <PortalIcon size={11} />
            {portalMeta[portal].name}
          </p>
        </div>
      </Link>

      <nav className="scrollbar-dark flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {nav.map((section) => (
          <div key={section.title}>
            <p className="px-3 pb-1.5 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">{section.title}</p>
            <ul className="space-y-0.5">
              {section.items.map(({ label, to, icon: Icon, badge, feature, external }) => {
                const locked = portal !== 'admin' && !!feature && !can(feature)
                const itemClass = (active: boolean) =>
                  cn(
                    'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                    active ? 'bg-white/10 font-medium text-white' : 'hover:bg-white/5 hover:text-white',
                    locked && !active && 'text-slate-500',
                  )
                const trailing = locked ? (
                  <span className="flex items-center gap-1">
                    <Lock size={12} className="text-slate-500" />
                    <TierBadge tier={features[feature!].tier} className="bg-white/10 text-slate-300" />
                  </span>
                ) : external ? (
                  <ExternalLink size={13} className="text-slate-500" />
                ) : (
                  badge && <span className="rounded-full bg-brand-600/90 px-1.5 py-px text-[10px] font-semibold text-white">{badge}</span>
                )
                return (
                  <li key={to}>
                    {external && !locked ? (
                      <a href={to} target="_blank" rel="noreferrer" onClick={onNavigate} className={itemClass(false)}>
                        <Icon size={17} className="text-slate-500 group-hover:text-slate-300" />
                        <span className="flex-1 truncate">{label}</span>
                        {trailing}
                      </a>
                    ) : (
                      <NavLink to={to} end={Object.values(portalHome).includes(to)} onClick={onNavigate} className={({ isActive }) => itemClass(isActive)}>
                        {({ isActive }) => (
                          <>
                            <Icon size={17} className={cn(isActive ? 'text-brand-400' : 'text-slate-500 group-hover:text-slate-300')} />
                            <span className="flex-1 truncate">{label}</span>
                            {trailing}
                          </>
                        )}
                      </NavLink>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {portal !== 'admin' && (
        <Link to={portal === 'restaurant' ? '/app/plans' : portalHome[portal]} onClick={onNavigate} className="mx-3 mt-3 flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs text-slate-300 hover:bg-white/10">
          <Crown size={13} className="text-amber-400" />
          <span className="flex-1">Plan</span>
          <TierBadge tier={plan} className="bg-white/10 text-white" />
        </Link>
      )}

      {portal === 'restaurant' && (
        <div className="m-3 rounded-xl border border-white/5 bg-white/5 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-white">
            <Wand2 size={13} className="text-violet-400" /> Setup progress
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-[86%] rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500" />
          </div>
          <Link to="/setup" onClick={onNavigate} className="mt-2 block text-xs text-slate-400 hover:text-white">
            6 of 7 steps done · Finish setup →
          </Link>
        </div>
      )}
    </div>
  )
}

/**
 * Desktop shell shared by the admin, restaurant, kitchen and counter apps.
 * Each app passes its own navigation and any extra header controls.
 */
export function AppShell({ portal, nav, headerExtra }: { portal: Portal; nav: NavSection[]; headerExtra?: ReactNode }) {
  const { user, signIn, signOut, branch, setBranch, can } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [copilotOpen, setCopilotOpen] = useState(false)
  const [menu, setMenu] = useState<'user' | 'notif' | 'branch' | null>(null)
  const menuRef = useClickOutside(() => setMenu(null))

  const branches = user?.restaurant?.branches ?? []

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  const toggle = (m: typeof menu) => setMenu((cur) => (cur === m ? null : m))

  return (
    <div className="flex h-full">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 lg:block">
        <div className="fixed inset-y-0 w-64">
          <Sidebar nav={nav} portal={portal} />
        </div>
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMobileOpen(false)} />
          <div className="animate-fade-in absolute inset-y-0 left-0 w-72">
            <Sidebar nav={nav} portal={portal} onNavigate={() => setMobileOpen(false)} />
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
              className="absolute top-5 -right-11 rounded-lg bg-white/10 p-1.5 text-white"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button type="button" aria-label="Open menu" onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden">
            <Menu size={20} />
          </button>

          <div className="relative hidden max-w-md flex-1 md:block">
            <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder={
                portal === 'admin' ? 'Search restaurants, users, tickets…' : portal === 'kitchen' ? 'Search orders, ingredients…' : 'Search orders, menu items, customers…'
              }
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 text-sm placeholder:text-slate-400 focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
            />
          </div>

          <div ref={menuRef} className="ml-auto flex items-center gap-1 sm:gap-2">
            {headerExtra}

            {portal !== 'admin' && branches.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => toggle('branch')}
                  className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <MapPin size={15} className="text-brand-600" />
                  <span className="hidden max-w-32 truncate sm:inline">{branch}</span>
                  <ChevronDown size={14} className="text-slate-400" />
                </button>
                {menu === 'branch' && (
                  <div className="animate-fade-in absolute right-0 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                    {['All branches', ...branches].map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => (setBranch(b), setMenu(null))}
                        className={cn('w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50', b === branch && 'bg-brand-50 font-medium text-brand-700')}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => (portal === 'admin' || can('copilot') ? setCopilotOpen(true) : navigate(user?.role === 'restaurant_admin' ? '/app/plans' : portalHome[portal]))}
              title={portal === 'admin' || can('copilot') ? undefined : 'AI Copilot is on the Enterprise plan'}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3 text-sm font-medium text-white shadow-sm shadow-violet-600/30 hover:from-violet-700 hover:to-fuchsia-700"
            >
              {portal === 'admin' || can('copilot') ? <Sparkles size={15} /> : <Lock size={14} />}
              <span className="hidden sm:inline">AI Copilot</span>
            </button>

            <div className="relative">
              <button type="button" aria-label="Notifications" onClick={() => toggle('notif')} className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                <Bell size={19} />
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-brand-500 ring-2 ring-white" />
              </button>
              {menu === 'notif' && (
                <div className="animate-fade-in absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-xl">
                  <p className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-800">Notifications</p>
                  <ul className="divide-y divide-slate-100">
                    {notifications[portal].map((n) => (
                      <li key={n.title} className="flex gap-3 px-4 py-3 text-sm">
                        <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.unread ? 'bg-brand-500' : 'bg-slate-200')} />
                        <span className="flex-1 text-slate-700">{n.title}</span>
                        <span className="text-xs text-slate-400">{n.time}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="relative">
              <button type="button" onClick={() => toggle('user')} className="flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-slate-100">
                <Avatar name={user?.name ?? 'User'} size="sm" />
                <span className="hidden text-left leading-tight xl:block">
                  <span className="block text-sm font-medium text-slate-800">{user?.name}</span>
                  <span className="block text-[11px] text-slate-500">{user?.restaurant?.name ?? user?.title}</span>
                </span>
                <ChevronDown size={14} className="hidden text-slate-400 sm:block" />
              </button>
              {menu === 'user' && (
                <div className="animate-fade-in absolute right-0 mt-2 w-60 rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                  <div className="px-3 py-2.5">
                    <p className="text-sm font-medium text-slate-800">{user?.name}</p>
                    <p className="text-xs text-slate-500">{user?.email}</p>
                  </div>
                  <div className="my-1 h-px bg-slate-100" />
                  {(portal === 'kitchen' || portal === 'counter') && user?.role === 'restaurant_admin' && (
                    <button
                      type="button"
                      onClick={() => navigate('/app')}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <ArrowLeftRight size={15} />
                      Back to Restaurant Operations
                    </button>
                  )}
                  {portal === 'restaurant' && (
                    <button
                      type="button"
                      onClick={() => navigate('/kitchen')}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <ChefHat size={15} />
                      Open Kitchen Portal
                    </button>
                  )}
                  {(portal === 'admin' || portal === 'restaurant') && (
                    <button
                      type="button"
                      onClick={() => {
                        // Prototype convenience: jump between the two portals as the matching demo user
                        signIn(demoUsers[portal === 'admin' ? 'restaurant_admin' : 'super_admin'])
                        navigate(portal === 'admin' ? '/app' : '/admin')
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <ArrowLeftRight size={15} />
                      Switch to {portal === 'admin' ? 'Restaurant Operations' : 'Super Admin Portal'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => (signOut(), navigate('/login'))}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <LogOut size={15} />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Suspense fallback={<LoadingState />}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      <CopilotDrawer open={copilotOpen} onClose={() => setCopilotOpen(false)} scope={portal === 'admin' ? 'admin' : 'restaurant'} />
    </div>
  )
}
