import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Inbox } from 'lucide-react'
import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { cn } from '@/shared/lib/cn'
import { SearchInput } from './Form'

export interface Column<T> {
  key: string
  header: ReactNode
  /** Custom cell renderer. Defaults to row[key]. */
  render?: (row: T) => ReactNode
  /** Value used for sorting; defaults to row[key]. */
  sortValue?: (row: T) => string | number
  sortable?: boolean
  align?: 'left' | 'right' | 'center'
  className?: string
}

export interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  rowKey: (row: T) => string | number
  /** Enables the search box; rows are matched on these fields. */
  searchKeys?: (keyof T)[]
  searchPlaceholder?: string
  /** Extra controls rendered next to the search box (filters, buttons). */
  toolbar?: ReactNode
  onRowClick?: (row: T) => void
  emptyText?: string
  pageSize?: number
  loading?: boolean
  className?: string
}

export function DataTable<T>({
  columns,
  data,
  rowKey,
  searchKeys,
  searchPlaceholder = 'Search…',
  toolbar,
  onRowClick,
  emptyText = 'No records found',
  pageSize = 8,
  loading,
  className,
}: DataTableProps<T>) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null)
  const [page, setPage] = useState(0)

  const rows = useMemo(() => {
    let out = data
    const q = query.trim().toLowerCase()
    if (q && searchKeys?.length) {
      out = out.filter((r) => searchKeys.some((k) => String(r[k] ?? '').toLowerCase().includes(q)))
    }
    if (sort) {
      const col = columns.find((c) => c.key === sort.key)
      const get = col?.sortValue ?? ((r: T) => (r as Record<string, unknown>)[sort.key] as string | number)
      out = [...out].sort((a, b) => (get(a) > get(b) ? sort.dir : get(a) < get(b) ? -sort.dir : 0))
    }
    return out
  }, [data, query, searchKeys, sort, columns])

  const pages = Math.max(1, Math.ceil(rows.length / pageSize))
  const current = Math.min(page, pages - 1)
  const visible = rows.slice(current * pageSize, current * pageSize + pageSize)

  const toggleSort = (key: string) =>
    setSort((s) => (s?.key === key ? (s.dir === 1 ? { key, dir: -1 } : null) : { key, dir: 1 }))

  return (
    <div className={cn('min-w-0', className)}>
      {(searchKeys || toolbar) && (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
          {searchKeys && (
            <SearchInput
              value={query}
              onChange={(v) => {
                setQuery(v)
                setPage(0)
              }}
              placeholder={searchPlaceholder}
              className="w-full sm:w-72"
            />
          )}
          {toolbar && <div className="flex flex-wrap items-center gap-2 sm:ml-auto">{toolbar}</div>}
        </div>
      )}
      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    'px-4 py-2.5 whitespace-nowrap',
                    c.align === 'right' && 'text-right',
                    c.align === 'center' && 'text-center',
                    c.sortable && 'cursor-pointer select-none hover:text-slate-800',
                  )}
                  onClick={c.sortable ? () => toggleSort(c.key) : undefined}
                >
                  <span className="inline-flex items-center gap-1">
                    {c.header}
                    {c.sortable && sort?.key === c.key && (sort.dir === 1 ? <ChevronUp size={13} /> : <ChevronDown size={13} />)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    {columns.map((c) => (
                      <td key={c.key} className="px-4 py-3.5">
                        <div className="h-3.5 w-3/4 animate-pulse rounded bg-slate-100" />
                      </td>
                    ))}
                  </tr>
                ))
              : visible.map((row) => (
                  <tr
                    key={rowKey(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn('transition-colors hover:bg-slate-50/80', onRowClick && 'cursor-pointer')}
                  >
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className={cn(
                          'px-4 py-3 text-slate-700',
                          c.align === 'right' && 'text-right',
                          c.align === 'center' && 'text-center',
                          c.className,
                        )}
                      >
                        {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
        {!loading && rows.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-sm text-slate-400">
            <Inbox size={28} />
            {emptyText}
          </div>
        )}
      </div>
      {!loading && rows.length > pageSize && (
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">
          <span>
            {current * pageSize + 1}–{Math.min(rows.length, (current + 1) * pageSize)} of {rows.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous page"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
              className="rounded-md p-1 hover:bg-slate-100 disabled:opacity-40"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="px-1">
              Page {current + 1} / {pages}
            </span>
            <button
              type="button"
              aria-label="Next page"
              disabled={current >= pages - 1}
              onClick={() => setPage(current + 1)}
              className="rounded-md p-1 hover:bg-slate-100 disabled:opacity-40"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
