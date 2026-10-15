import { Send, Sparkles, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/shared/lib/cn'
import type { CopilotMessage, CopilotScope } from '@/shared/services/copilot'
import { askCopilot, copilotSuggestions } from '@/shared/services/copilot'

export function CopilotDrawer({ open, onClose, scope }: { open: boolean; onClose: () => void; scope: CopilotScope }) {
  const [messages, setMessages] = useState<CopilotMessage[]>([])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking])

  const send = async (text: string) => {
    const prompt = text.trim()
    if (!prompt || thinking) return
    setInput('')
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'user', text: prompt }])
    setThinking(true)
    try {
      const reply = await askCopilot(prompt, scope)
      setMessages((m) => [...m, reply])
    } finally {
      setThinking(false)
    }
  }

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-900/20" onClick={onClose} />
      <aside className="animate-slide-in-right absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl">
        <header className="flex items-center gap-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-4 text-white">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">
            <Sparkles size={18} />
          </span>
          <div className="flex-1">
            <p className="font-semibold">AI Copilot</p>
            <p className="text-xs text-white/75">{scope === 'admin' ? 'Platform intelligence assistant' : 'Restaurant management assistant'}</p>
          </div>
          <button type="button" aria-label="Close copilot" onClick={onClose} className="rounded-lg p-1 hover:bg-white/15">
            <X size={18} />
          </button>
        </header>

        <div className="scrollbar-thin flex-1 space-y-3 overflow-y-auto bg-slate-50 px-4 py-4">
          {messages.length === 0 && (
            <div className="rounded-xl border border-violet-100 bg-white p-4 text-sm text-slate-600">
              <p className="font-medium text-slate-800">Hi! Ask me anything about your {scope === 'admin' ? 'platform' : 'restaurant'}.</p>
              <p className="mt-1 text-xs text-slate-500">I use live data from every module to answer and can trigger automations for you.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {copilotSuggestions[scope].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700 hover:bg-violet-100"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                  m.role === 'user' ? 'rounded-br-md bg-slate-900 text-white' : 'rounded-bl-md border border-slate-200 bg-white text-slate-700',
                )}
              >
                {m.text}
              </div>
            </div>
          ))}
          {thinking && (
            <div className="flex gap-1 px-2 py-1">
              {[0, 150, 300].map((d) => (
                <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-violet-400" style={{ animationDelay: `${d}ms` }} />
              ))}
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            send(input)
          }}
          className="flex items-center gap-2 border-t border-slate-200 p-3"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask the copilot…"
            className="h-10 flex-1 rounded-lg border border-slate-200 px-3 text-sm focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20 focus:outline-none"
          />
          <button
            type="submit"
            aria-label="Send"
            disabled={!input.trim() || thinking}
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40"
          >
            <Send size={16} />
          </button>
        </form>
      </aside>
    </div>,
    document.body,
  )
}
