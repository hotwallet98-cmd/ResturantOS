import { Camera, CheckCircle2, FileText, ImageUp, Loader2, Mic, PackageCheck, PackagePlus, ScanLine, Square, Trash2, Truck, Wand2 } from 'lucide-react'
import type { ChangeEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Badge, Button, Card, EmptyState, LoadingState, PageHeader, Tabs, Textarea, useToast } from '@/shared/components/ui'
import { useKitchen } from '@/apps/kitchen/context/KitchenContext'
import { useAsync } from '@/shared/hooks/useAsync'
import { cn } from '@/shared/lib/cn'
import { formatCurrency, timeAgo } from '@/shared/lib/format'
import type { DraftLine, EntryKind, ExpectedDelivery, InvoiceScan } from '@/apps/kitchen/services/kitchen'
import { getExpectedDeliveries, parseSpokenStock, scanInvoice } from '@/apps/kitchen/services/kitchen'
import type { Ingredient } from '@/shared/services/operations'
import type { Listener } from '@/apps/kitchen/services/voice'
import { createListener } from '@/apps/kitchen/services/voice'

type Method = 'voice' | 'invoice' | 'delivery'

interface EntryRecord {
  id: string
  source: string
  lines: DraftLine[]
  at: string
}

const kindTone: Record<EntryKind, 'green' | 'red' | 'blue'> = { 'Stock In': 'green', Wastage: 'red', Count: 'blue' }

const examples = ['20 kg chicken aaya aur 10 kilo pyaz', '3 kg tamatar kharab ho gaye', 'chawal 12 kg baqi hai', '5 dozen buns aaye']

export default function StockEntry() {
  const notify = useToast()
  const { loading, ingredients, applyStockLines } = useKitchen()
  const [method, setMethod] = useState<Method>('voice')
  const [history, setHistory] = useState<EntryRecord[]>([])

  if (loading) return <LoadingState />

  const commit = (lines: DraftLine[], source: string) => {
    const ok = lines.filter((l) => l.ingredientId && l.qty > 0)
    if (!ok.length) return notify('Nothing to save: match each line to an ingredient first', 'error')
    applyStockLines(ok, source)
    setHistory((h) => [{ id: `en-${Date.now()}`, source, lines: ok, at: new Date().toISOString() }, ...h])
    notify(`Stock updated: ${ok.length} item${ok.length > 1 ? 's' : ''}`)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={PackagePlus}
        title="Smart Stock Entry"
        description="Speak it, snap the bill, or tap to receive a delivery. AI fills in the lines and you just confirm."
      />

      <Tabs
        items={[
          { id: 'voice', label: 'Speak', icon: Mic },
          { id: 'invoice', label: 'Scan bill / invoice', icon: ScanLine },
          { id: 'delivery', label: 'Receive delivery', icon: Truck },
        ]}
        value={method}
        onChange={setMethod}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          {method === 'voice' && <VoiceEntry ingredients={ingredients} onCommit={(l) => commit(l, 'voice entry')} />}
          {method === 'invoice' && <InvoiceEntry ingredients={ingredients} onCommit={(l, s) => commit(l, `invoice ${s}`)} />}
          {method === 'delivery' && <DeliveryEntry ingredients={ingredients} onCommit={(l, po) => commit(l, po)} />}
        </div>

        <Card title="Saved today" subtitle="Every entry is logged as a stock movement" flush>
          {history.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">No entries yet in this session.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {history.map((h) => (
                <li key={h.id} className="px-5 py-3 text-sm">
                  <p className="flex justify-between">
                    <span className="font-medium text-slate-800 capitalize">{h.source}</span>
                    <span className="text-xs text-slate-400">{timeAgo(h.at)}</span>
                  </p>
                  <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
                    {h.lines.map((l) => (
                      <li key={l.id}>
                        <Badge tone={kindTone[l.kind]}>{l.kind}</Badge> {l.qty} {l.unit} {ingredients.find((i) => i.id === l.ingredientId)?.name}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Draft review table (shared by all methods)                          */
/* ------------------------------------------------------------------ */

function DraftTable({ lines, setLines, ingredients }: { lines: DraftLine[]; setLines: (l: DraftLine[]) => void; ingredients: Ingredient[] }) {
  const update = (id: string, patch: Partial<DraftLine>) => setLines(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
            <th className="px-4 py-2.5">Read as</th>
            <th className="px-4 py-2.5">Ingredient</th>
            <th className="px-4 py-2.5">Type</th>
            <th className="px-4 py-2.5">Qty</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {lines.map((l) => {
            const ing = ingredients.find((i) => i.id === l.ingredientId)
            const unsure = !ing || l.confidence < 0.8
            return (
              <tr key={l.id} className={cn(unsure && 'bg-amber-50/60')}>
                <td className="max-w-48 px-4 py-2 text-xs text-slate-500">
                  <span className="line-clamp-2">“{l.raw}”</span>
                  {unsure && <span className="font-semibold text-amber-700">Please check</span>}
                </td>
                <td className="px-4 py-2">
                  <select
                    value={l.ingredientId ?? ''}
                    onChange={(e) => {
                      const next = ingredients.find((i) => i.id === e.target.value)
                      update(l.id, { ingredientId: next?.id, unit: next?.unit ?? l.unit, confidence: 1 })
                    }}
                    className={cn('h-9 w-48 rounded-lg border bg-white px-2 text-sm', !ing ? 'border-amber-400' : 'border-slate-200')}
                  >
                    <option value="">Select ingredient…</option>
                    {ingredients.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.emoji} {i.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2">
                  <select value={l.kind} onChange={(e) => update(l.id, { kind: e.target.value as EntryKind })} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm">
                    <option>Stock In</option>
                    <option>Wastage</option>
                    <option value="Count">Count (set to)</option>
                  </select>
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={l.qty}
                      onChange={(e) => update(l.id, { qty: Number(e.target.value) })}
                      className="h-9 w-20 rounded-lg border border-slate-200 px-2 text-right text-sm"
                    />
                    <span className="text-xs text-slate-500">{ing?.unit ?? l.unit}</span>
                  </div>
                </td>
                <td className="px-4 py-2 text-right">
                  <button type="button" onClick={() => setLines(lines.filter((x) => x.id !== l.id))} className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove line">
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Speak                                                               */
/* ------------------------------------------------------------------ */

function VoiceEntry({ ingredients, onCommit }: { ingredients: Ingredient[]; onCommit: (l: DraftLine[]) => void }) {
  const { settings, agent } = useKitchen()
  const [text, setText] = useState('')
  const [partial, setPartial] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([])
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState('')
  const listenerRef = useRef<Listener | null>(null)
  const resumeAgentRef = useRef(false)

  useEffect(() => () => void listenerRef.current?.stop(), [])

  const addText = (t: string) => {
    setText((prev) => (prev ? `${prev} aur ${t}` : t))
    setLines((prev) => [...prev, ...parseSpokenStock(t, ingredients)])
  }

  const startDictation = async () => {
    setError('')
    // Only one thing can use the mic: pause the kitchen agent while dictating
    resumeAgentRef.current = agent.state !== 'off' && agent.state !== 'error'
    if (resumeAgentRef.current) await agent.stop()
    const l = createListener(settings, { onPartial: setPartial, onUtterance: (t) => (setPartial(''), addText(t)), onError: (e) => setError(e.message) })
    try {
      await l.start()
      listenerRef.current = l
      setRecording(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Microphone unavailable')
    }
  }

  const stopDictation = async () => {
    await listenerRef.current?.stop()
    listenerRef.current = null
    setRecording(false)
    setPartial('')
    if (resumeAgentRef.current) void agent.start()
  }

  return (
    <Card>
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <button
          type="button"
          onClick={() => void (recording ? stopDictation() : startDictation())}
          className={cn('relative flex h-20 w-20 items-center justify-center rounded-full text-white shadow-lg transition', recording ? 'bg-red-600' : 'bg-brand-600 hover:bg-brand-700')}
          aria-label={recording ? 'Stop' : 'Start speaking'}
        >
          {recording && <span className="absolute inset-0 animate-ping rounded-full bg-red-500/40" />}
          {recording ? <Square size={26} className="relative" /> : <Mic size={30} />}
        </button>
        <p className="font-medium text-slate-800">{recording ? 'Listening… say what came in or what was wasted' : 'Tap and speak in Urdu or English'}</p>
        <p className="min-h-5 text-sm text-slate-500 italic">{partial || (recording ? '' : '"20 kg chicken aaya aur 5 kilo tamatar kharab"')}</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <div className="space-y-2 border-t border-slate-100 pt-4">
        <p className="text-sm font-medium text-slate-700">Or type it</p>
        <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. 40 kg chicken aaya, 2 kg dhania kharab" />
        <div className="flex flex-wrap items-center gap-2">
          {examples.map((ex) => (
            <button key={ex} type="button" onClick={() => setText(ex)} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-200">
              {ex}
            </button>
          ))}
          <Button size="sm" variant="ai" icon={Wand2} className="ml-auto" disabled={!text.trim()} onClick={() => setLines(parseSpokenStock(text, ingredients))}>
            Read it
          </Button>
        </div>
      </div>

      {lines.length > 0 && (
        <div className="-mx-5 mt-5 border-t border-slate-100">
          <DraftTable lines={lines} setLines={setLines} ingredients={ingredients} />
          <div className="flex justify-end gap-2 px-5 pt-4">
            <Button variant="ghost" onClick={() => (setLines([]), setText(''))}>
              Clear
            </Button>
            <Button icon={CheckCircle2} onClick={() => (onCommit(lines), setLines([]), setText(''))}>
              Confirm & update stock
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Invoice photo                                                       */
/* ------------------------------------------------------------------ */

function InvoiceEntry({ ingredients, onCommit }: { ingredients: Ingredient[]; onCommit: (l: DraftLine[], invoiceNo: string) => void }) {
  const [preview, setPreview] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scan, setScan] = useState<InvoiceScan | null>(null)
  const [lines, setLines] = useState<DraftLine[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview])

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPreview(URL.createObjectURL(file))
    setScan(null)
    setScanning(true)
    try {
      const res = await scanInvoice(file, ingredients)
      setScan(res)
      setLines(res.lines)
    } finally {
      setScanning(false)
    }
  }

  const reset = () => (setPreview(null), setScan(null), setLines([]))

  return (
    <Card flush>
      <input ref={fileRef} type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={(e) => void onFile(e)} />
      {!preview ? (
        <div className="p-5">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed border-slate-200 px-6 py-12 text-center hover:border-brand-300 hover:bg-brand-50/40"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <Camera size={26} />
            </span>
            <span className="font-medium text-slate-800">Take a photo of the supplier bill</span>
            <span className="max-w-sm text-sm text-slate-500">AI reads the supplier, items and quantities and matches them to your inventory. Works with printed and handwritten parchis.</span>
            <span className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white">
              <ImageUp size={15} /> Upload or capture
            </span>
          </button>
        </div>
      ) : (
        <div className="grid gap-0 lg:grid-cols-[240px_minmax(0,1fr)]">
          <div className="relative border-b border-slate-100 bg-slate-50 p-4 lg:border-r lg:border-b-0">
            <img src={preview} alt="Invoice" className="max-h-72 w-full rounded-lg object-contain" />
            {scanning && (
              <div className="absolute inset-4 flex flex-col items-center justify-center gap-2 rounded-lg bg-white/80 text-sm font-medium text-violet-700 backdrop-blur-sm">
                <Loader2 size={22} className="animate-spin" />
                Reading invoice…
              </div>
            )}
            <Button size="sm" variant="ghost" className="mt-3" onClick={reset} block>
              Use another photo
            </Button>
          </div>
          <div className="min-w-0">
            {scan ? (
              <>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-slate-100 px-5 py-4 text-sm">
                  <span className="flex items-center gap-1.5 font-semibold text-slate-900">
                    <FileText size={15} className="text-slate-400" /> {scan.supplier}
                  </span>
                  <span className="text-slate-500">Invoice {scan.invoiceNo}</span>
                  <span className="text-slate-500">Total {formatCurrency(scan.total)}</span>
                  <Badge tone="purple">AI read · {lines.filter((l) => l.confidence >= 0.8).length}/{lines.length} sure</Badge>
                </div>
                <DraftTable lines={lines} setLines={setLines} ingredients={ingredients} />
                <div className="flex justify-end gap-2 p-5">
                  <Button variant="ghost" onClick={reset}>
                    Discard
                  </Button>
                  <Button icon={CheckCircle2} onClick={() => (onCommit(lines, scan.invoiceNo), reset())}>
                    Confirm & add to stock
                  </Button>
                </div>
              </>
            ) : (
              <EmptyState icon={ScanLine} title="Scanning…" description="Matching invoice lines to your ingredients." />
            )}
          </div>
        </div>
      )}
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Receive purchase order                                              */
/* ------------------------------------------------------------------ */

function DeliveryEntry({ ingredients, onCommit }: { ingredients: Ingredient[]; onCommit: (l: DraftLine[], po: string) => void }) {
  const q = useAsync(getExpectedDeliveries)
  const [qty, setQty] = useState<Record<string, number>>({})

  if (q.loading) return <LoadingState />
  const deliveries = q.data ?? []

  const receive = (d: ExpectedDelivery) => {
    const lines: DraftLine[] = d.lines.map((l, idx) => {
      const ing = ingredients.find((i) => i.name === l.ingredient)
      return { id: `${d.id}-${idx}`, ingredientId: ing?.id, raw: l.ingredient, qty: qty[`${d.id}-${idx}`] ?? l.qty, unit: l.unit, kind: 'Stock In', confidence: 1 }
    })
    onCommit(lines, d.po)
    q.setData((prev) => (prev ?? []).map((x) => (x.id === d.id ? { ...x, status: 'Received' } : x)))
  }

  return (
    <div className="space-y-4">
      {deliveries.map((d) => {
        const received = d.status === 'Received'
        return (
          <Card
            key={d.id}
            className={cn(received && 'opacity-60')}
            title={
              <span className="flex items-center gap-2">
                {d.supplier} <span className="text-sm font-normal text-slate-500">· {d.po}</span>
              </span>
            }
            subtitle={received ? 'Received and added to stock' : d.status === 'Arrived' ? `Arrived ${timeAgo(d.eta)}, waiting at the back door` : `Expected ${new Date(d.eta).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
            actions={
              received ? (
                <Badge tone="green" dot>
                  Received
                </Badge>
              ) : (
                <Button size="sm" icon={PackageCheck} variant={d.status === 'Arrived' ? 'primary' : 'outline'} onClick={() => receive(d)}>
                  Receive all
                </Button>
              )
            }
            flush
          >
            <ul className="divide-y divide-slate-50">
              {d.lines.map((l, idx) => {
                const key = `${d.id}-${idx}`
                const ing = ingredients.find((i) => i.name === l.ingredient)
                return (
                  <li key={key} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                    <span>{ing?.emoji}</span>
                    <span className="flex-1 text-slate-700">{l.ingredient}</span>
                    <span className="text-xs text-slate-400">ordered {l.qty} {l.unit}</span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      disabled={received}
                      value={qty[key] ?? l.qty}
                      onChange={(e) => setQty((s) => ({ ...s, [key]: Number(e.target.value) }))}
                      className="h-8 w-20 rounded-lg border border-slate-200 px-2 text-right text-sm disabled:bg-slate-50"
                      aria-label={`Received ${l.ingredient}`}
                    />
                    <span className="w-6 text-xs text-slate-500">{l.unit}</span>
                  </li>
                )
              })}
            </ul>
          </Card>
        )
      })}
      <p className="text-center text-xs text-slate-500">Change a quantity before receiving if the supplier delivered short.</p>
    </div>
  )
}
