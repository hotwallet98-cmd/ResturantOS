import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { createContext, useCallback, useContext, useState } from 'react'
import { cn } from '@/shared/lib/cn'

type ToastType = 'success' | 'error' | 'info'
interface ToastItem {
  id: number
  message: ReactNode
  type: ToastType
}

const ToastContext = createContext<(message: ReactNode, type?: ToastType) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const notify = useCallback(
    (message: ReactNode, type: ToastType = 'success') => {
      const id = Date.now() + Math.random()
      setToasts((t) => [...t, { id, message, type }])
      setTimeout(() => dismiss(id), 3500)
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">
        {toasts.map((t) => {
          const Icon = t.type === 'success' ? CheckCircle2 : t.type === 'error' ? XCircle : Info
          return (
            <div
              key={t.id}
              className="animate-fade-in pointer-events-auto flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-lg"
            >
              <Icon
                size={18}
                className={cn('mt-px shrink-0', t.type === 'success' ? 'text-emerald-500' : t.type === 'error' ? 'text-red-500' : 'text-sky-500')}
              />
              <div className="flex-1">{t.message}</div>
              <button type="button" aria-label="Dismiss" onClick={() => dismiss(t.id)} className="text-slate-400 hover:text-slate-700">
                <X size={15} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

/** `const notify = useToast(); notify('Saved')` */
// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  return useContext(ToastContext)
}
