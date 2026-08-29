'use client'

import * as React from 'react'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Option {
  value: string
  label: string
  hint?: string
  group?: string
}

/**
 * Compact multi-select used across the filter bar.
 *
 * Native <select multiple> is unusable at this density, so this is a listbox
 * with the accessibility wiring done by hand: labelled trigger, aria-expanded,
 * roving arrow-key focus, Escape to close, type-to-filter.
 */
export function MultiSelect({
  label,
  options,
  selected,
  onToggle,
  onClear,
  searchable = false,
  align = 'left',
  widthClass = 'w-64',
}: {
  label: string
  options: Option[]
  selected: string[]
  onToggle: (value: string) => void
  onClear: () => void
  searchable?: boolean
  align?: 'left' | 'right'
  widthClass?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [activeIndex, setActiveIndex] = React.useState(0)
  const rootRef = React.useRef<HTMLDivElement>(null)
  const listId = React.useId()

  React.useEffect(() => {
    if (!open) return
    function onDocClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const filtered = React.useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return options
    return options.filter((o) => o.label.toLowerCase().includes(term) || o.value.toLowerCase().includes(term))
  }, [options, query])

  const grouped = React.useMemo(() => {
    const map = new Map<string, Option[]>()
    for (const option of filtered) {
      const key = option.group ?? ''
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(option)
    }
    return [...map.entries()]
  }, [filtered])

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') {
      setOpen(false)
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if ((event.key === 'Enter' || event.key === ' ') && open && filtered[activeIndex]) {
      event.preventDefault()
      onToggle(filtered[activeIndex].value)
    }
  }

  const count = selected.length

  return (
    <div ref={rootRef} className="relative" onKeyDown={onKeyDown}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex h-7 max-w-56 items-center gap-1.5 rounded-md border px-2 text-[12px] font-medium transition-colors',
          count > 0
            ? 'border-brand-300 bg-brand-50 text-brand-700'
            : 'border-hairline bg-surface text-ink-soft hover:bg-slate-50',
        )}
      >
        <span className="truncate">{label}</span>
        {count > 0 ? (
          <span className="tnum rounded bg-brand-500 px-1 text-[10px] font-bold text-white">{count}</span>
        ) : null}
        <ChevronDown className="h-3 w-3 shrink-0 opacity-60" strokeWidth={2.5} aria-hidden />
      </button>

      {open ? (
        <div
          className={cn(
            'absolute z-40 mt-1 max-h-80 overflow-hidden rounded-md border border-hairline bg-surface shadow-lg',
            widthClass,
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {searchable ? (
            <div className="flex items-center gap-1.5 border-b border-hairline px-2.5 py-1.5">
              <Search className="h-3.5 w-3.5 text-ink-faint" strokeWidth={2} aria-hidden />
              <input
                autoFocus
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setActiveIndex(0)
                }}
                placeholder={`Search ${label.toLowerCase()}`}
                aria-label={`Search ${label}`}
                className="w-full bg-transparent text-[12px] outline-none placeholder:text-ink-faint"
              />
            </div>
          ) : null}

          <ul id={listId} role="listbox" aria-multiselectable className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-center text-[12px] text-ink-muted">No matches</li>
            ) : (
              grouped.map(([group, items]) => (
                <React.Fragment key={group || 'ungrouped'}>
                  {group ? (
                    <li
                      className="px-2.5 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-wider text-ink-faint"
                      aria-hidden
                    >
                      {group}
                    </li>
                  ) : null}
                  {items.map((option) => {
                    const isSelected = selected.includes(option.value)
                    const index = filtered.indexOf(option)
                    return (
                      <li key={option.value}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => onToggle(option.value)}
                          onMouseEnter={() => setActiveIndex(index)}
                          className={cn(
                            'flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px] transition-colors',
                            index === activeIndex ? 'bg-slate-50' : '',
                            isSelected ? 'font-medium text-brand-700' : 'text-ink-soft',
                          )}
                        >
                          <span
                            className={cn(
                              'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border',
                              isSelected ? 'border-brand-500 bg-brand-500' : 'border-slate-300 bg-surface',
                            )}
                            aria-hidden
                          >
                            {isSelected ? <Check className="h-2.5 w-2.5 text-white" strokeWidth={3.5} /> : null}
                          </span>
                          <span className="min-w-0 flex-1 truncate">{option.label}</span>
                          {option.hint ? (
                            <span className="tnum shrink-0 text-[10.5px] text-ink-faint">{option.hint}</span>
                          ) : null}
                        </button>
                      </li>
                    )
                  })}
                </React.Fragment>
              ))
            )}
          </ul>

          {count > 0 ? (
            <div className="border-t border-hairline px-2 py-1.5">
              <button
                type="button"
                onClick={onClear}
                className="inline-flex items-center gap-1 text-[11.5px] font-medium text-ink-muted transition-colors hover:text-bad"
              >
                <X className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                Clear {count} selected
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
