/*
 * Font picker: a dropdown of fonts, grouped (Sans serif, Serif, Monospace),
 * each name written in its own font. A search box at the top of the list
 * narrows it as you type, by name or group ("serif" finds every serif font);
 * arrow keys and Enter pick, Escape closes. Hovering (or arrowing to) a
 * font reports it through `onPreview`, so the page can show it; closing
 * without a pick reports `null`, to put the old font back.
 *
 * Built on Base UI's Combobox with the input inside the popup.
 *
 * In a phone's sheet (`ExpandedControls`) there is no dropdown: a search box
 * and one scrolling list of every font, one per row, each in its own font
 * (no group headings; the owner's call 2026-11-17).
 */
import { Combobox } from '@base-ui/react/combobox'
import { Check, ChevronDown, Search } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'

import { cn } from '../../lib/cn'
import { useCentrePicked } from '../../lib/centre-in-scroller'
import { useExpandedControls } from '../../lib/expanded-controls'

export type FontOption = {
  name: string
  /** The group it's listed under, e.g. "Serif". */
  category: string
  /** The CSS font-family to show its name in. */
  family: string
}

export type FontPickerProps = {
  fonts: readonly FontOption[]
  /** The picked font's name. */
  value: string
  onValueChange: (name: string) => void
  /** The font being hovered or arrowed to while the list is open; `null` once it closes. */
  onPreview?: (name: string | null) => void
  label?: string
  className?: string
}

type Group = { value: string; items: string[] }

export function FontPicker({ fonts, value, onValueChange, onPreview, label = 'Font', className }: FontPickerProps) {
  const groups = useMemo<Group[]>(() => {
    const byCategory = new Map<string, string[]>()
    for (const font of fonts) byCategory.set(font.category, [...(byCategory.get(font.category) ?? []), font.name])
    return [...byCategory].map(([category, items]) => ({ value: category, items }))
  }, [fonts])
  const familyOf = (name: string) => fonts.find((font) => font.name === name)?.family
  const expanded = useExpandedControls()
  if (expanded) return <FontList fonts={fonts} value={value} onValueChange={onValueChange} label={label} className={className} />
  const matches = (name: string, query: string) => {
    const font = fonts.find((f) => f.name === name)
    const q = query.trim().toLowerCase()
    return !q || `${name} ${font?.category ?? ''}`.toLowerCase().includes(q)
  }

  return (
    <Combobox.Root<string>
      items={groups}
      value={value}
      filter={matches}
      onItemHighlighted={(name) => {
        if (name) onPreview?.(name)
      }}
      onOpenChange={(open) => {
        if (!open) onPreview?.(null)
      }}
      onValueChange={(next) => {
        if (next) onValueChange(next)
      }}
    >
      <Combobox.Trigger
        aria-label={`${label}: ${value}`}
        className={cn(
          'flex h-(--control-height) w-full min-w-0 items-center gap-1.5 rounded-md px-2.5 text-sm text-foreground ring-1 ring-border-strong ring-inset select-none',
          'transition-colors duration-(--duration-instant) hover:bg-accent data-popup-open:bg-accent',
          className,
        )}
      >
        <span className="flex-1 truncate text-left" style={{ fontFamily: familyOf(value) }}>
          {value}
        </span>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={2} aria-hidden="true" />
      </Combobox.Trigger>
      <Combobox.Portal>
        <Combobox.Positioner align="start" sideOffset={4} className="z-50 outline-none">
          <Combobox.Popup
            aria-label={label}
            className={cn(
              'flex max-h-[min(24rem,var(--available-height))] w-(--anchor-width) min-w-56 flex-col rounded-md border bg-popover p-1 text-sm text-popover-foreground shadow-md outline-none',
              'origin-(--transform-origin) transition-[opacity,scale] duration-(--duration-fast) ease-enter',
              'data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0',
            )}
          >
            <label className="mb-1 flex h-8 shrink-0 items-center gap-2 rounded-md border border-input-border bg-input px-2 focus-within:border-ring">
              <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <Combobox.Input placeholder="Search fonts" aria-label="Search fonts" className="h-full w-full min-w-0 bg-transparent outline-none placeholder:text-muted-foreground" />
            </label>
            <Combobox.Empty>
              <div className="px-2 py-3 text-muted-foreground">No fonts match.</div>
            </Combobox.Empty>
            <Combobox.List className="min-h-0 overflow-y-auto overscroll-contain">
              {(group: Group) => (
                <Combobox.Group key={group.value} items={group.items} className="pb-1 last:pb-0">
                  <Combobox.GroupLabel className="px-2 pt-1.5 pb-0.5 text-xs text-muted-foreground select-none">{group.value}</Combobox.GroupLabel>
                  <Combobox.Collection>
                    {(name: string) => (
                      <Combobox.Item
                        key={name}
                        value={name}
                        className={cn(
                          'flex h-8 cursor-default items-center justify-between gap-2 rounded-sm px-2 outline-none select-none',
                          'data-highlighted:bg-accent data-selected:bg-primary-subtle data-selected:text-primary-subtle-foreground',
                        )}
                      >
                        <span className="truncate text-[0.9375rem]" style={{ fontFamily: familyOf(name) }}>
                          {name}
                        </span>
                        <Combobox.ItemIndicator>
                          <Check className="size-3.5" aria-hidden="true" />
                        </Combobox.ItemIndicator>
                      </Combobox.Item>
                    )}
                  </Combobox.Collection>
                </Combobox.Group>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}

/** The phone's font list: a search box over one scrolling list, a row per font. */
function FontList({ fonts, value, onValueChange, label = 'Font', className }: Omit<FontPickerProps, 'onPreview'>) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const shown = fonts.filter((font) => !q || `${font.name} ${font.category}`.toLowerCase().includes(q))
  // The list scrolls with the sheet, not in a box of its own (owner's call, 2026-11-17); it opens at the picked font.
  const list = useRef<HTMLDivElement>(null)
  useCentrePicked(list)
  return (
    <div className={cn('flex w-full min-w-0 flex-col gap-2', className)}>
      <label className="flex h-11 shrink-0 items-center gap-2 rounded-md border border-input-border bg-input px-3 focus-within:border-ring">
        <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search fonts" aria-label="Search fonts" className="h-full w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
      </label>
      <div ref={list} role="radiogroup" aria-label={label} className="flex flex-col gap-0.5">
        {shown.length === 0 && <div className="px-3 py-3 text-sm text-muted-foreground">No fonts match.</div>}
        {shown.map((font) => {
          const picked = font.name === value
          return (
            <button
              key={font.name}
              type="button"
              role="radio"
              aria-checked={picked}
              onClick={() => onValueChange(font.name)}
              className={cn(
                'flex h-11 shrink-0 items-center justify-between gap-2 rounded-md px-3 text-left text-[0.9375rem] outline-none',
                'hover:bg-muted focus-visible:bg-accent',
                picked && 'bg-primary-subtle text-primary-subtle-foreground',
              )}
            >
              <span className="truncate" style={{ fontFamily: font.family }}>
                {font.name}
              </span>
              {picked && <Check className="size-4 shrink-0" aria-hidden="true" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
