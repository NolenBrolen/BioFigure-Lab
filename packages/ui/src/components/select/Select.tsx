/*
 * Select: pick one option from a short list, like the page size or the
 * export format. Each option can carry a detail, such as "85 mm". Opens with
 * a click, Enter, Space or the arrow keys; typing the first letters jumps to
 * an option; Escape closes it without changing anything.
 *
 * Looks like an outlined button with its label inside ("Format  PNG") and a
 * small arrow. In forms the label can sit above the button instead. The list drops down below it; the picked option is tinted
 * blue, like a pressed icon button.
 *
 * In a phone's sheet (`ExpandedControls`) there is no dropdown (it would be a
 * "more options" step): every option is listed right away, one per row, the
 * picked one ticked (owner's call, 2026-11-17).
 *
 * Built on Base UI's Select. Popup styles based on shadcn/ui (MIT, see
 * THIRD_PARTY_NOTICES.md).
 */
import { Select as SelectPrimitive } from '@base-ui/react/select'
import { Check, ChevronDown, Search } from 'lucide-react'
import { useRef, useState, type CSSProperties, type ReactNode } from 'react'

import { cn } from '../../lib/cn'
import { useCentrePicked } from '../../lib/centre-in-scroller'
import { useExpandedControls } from '../../lib/expanded-controls'

export type SelectOption<Value extends string> = {
  value: Value
  label: string
  /** Extra information shown under the label, e.g. "85 mm". */
  detail?: string
  /** Extra look for the option's name, e.g. a font weight shown in that weight. */
  style?: CSSProperties
  /** A small picture before the name, shown in the full list (not in the dropdown). */
  icon?: ReactNode
  /** In the dropdown, the options with the same group (next to each other) sit under an eyebrow title with this name. */
  group?: string
}

export type SelectProps<Value extends string> = {
  /** Shown inside the button and read by screen readers. `hideLabel` leaves it out of the button when the panel says enough. */
  label: string
  hideLabel?: boolean
  /** `above` puts the label over the button, like a text field, for forms such as dialogs. */
  labelPosition?: 'inside' | 'above'
  options: readonly SelectOption<Value>[]
  value?: Value
  defaultValue?: Value
  onValueChange?: (value: Value) => void
  /** The option being hovered or arrowed to while the list is open; `null` once it closes. For live previews. */
  onPreview?: (value: Value | null) => void
  /** Shown while nothing is picked yet. */
  placeholder?: string
  disabled?: boolean
  name?: string
  className?: string
  /** In the phone's / panel's full list: a search box above it, narrowing by name and detail. */
  searchable?: boolean
}

/** The options in runs of the same group, in order. */
function groupRuns<Value extends string>(options: readonly SelectOption<Value>[]) {
  const runs: { group?: string; options: SelectOption<Value>[] }[] = []
  for (const option of options) {
    const last = runs[runs.length - 1]
    if (last && last.group === option.group) last.options.push(option)
    else runs.push({ group: option.group, options: [option] })
  }
  return runs
}

export function Select<Value extends string>({
  label,
  hideLabel,
  labelPosition = 'inside',
  options,
  value,
  defaultValue,
  onValueChange,
  onPreview,
  placeholder = 'Choose…',
  disabled,
  name,
  className,
  searchable,
}: SelectProps<Value>) {
  const expanded = useExpandedControls()
  if (expanded) return <OptionList label={label} options={options} value={value} defaultValue={defaultValue} onValueChange={onValueChange} disabled={disabled} className={className} searchable={searchable} />
  const renderItem = (option: SelectOption<Value>) => (
    <SelectPrimitive.Item
                  key={option.value}
                  value={option.value}
                  label={option.label}
                  onMouseEnter={() => onPreview?.(option.value)}
                  onFocus={() => onPreview?.(option.value)}
                  className={cn(
                    'group/item flex min-h-7 cursor-default flex-col justify-center rounded-sm px-2 py-1 outline-none select-none',
                    'data-disabled:opacity-50 data-highlighted:bg-accent',
                    'data-selected:bg-primary-subtle data-selected:text-primary-subtle-foreground',
                  )}
                >
                  <SelectPrimitive.ItemText className="font-medium" style={option.style}>
                    {option.label}
                  </SelectPrimitive.ItemText>
                  {option.detail && (
                    <span className="text-xs text-muted-foreground group-data-selected/item:text-primary-subtle-foreground">{option.detail}</span>
                  )}
                </SelectPrimitive.Item>
  )
  return (
    <SelectPrimitive.Root<Value>
      items={options}
      value={value}
      defaultValue={defaultValue}
      onValueChange={(next) => {
        if (next !== null) onValueChange?.(next)
      }}
      onOpenChange={(open) => {
        if (!open) onPreview?.(null)
      }}
      disabled={disabled}
      name={name}
    >
      <div className={cn('flex min-w-0 flex-col gap-1', className)}>
        {/* The real label. Inside the button, screen readers get it here and the button shows a copy. */}
        <SelectPrimitive.Label className={labelPosition === 'above' && !hideLabel ? 'text-xs font-medium text-foreground' : 'sr-only'}>{label}</SelectPrimitive.Label>
        <SelectPrimitive.Trigger
          className={cn(
            'flex h-(--control-height) min-w-0 items-center gap-1.5 rounded-md px-2.5 text-sm text-foreground ring-1 ring-border-strong ring-inset select-none',
            'transition-colors duration-(--duration-instant) not-data-disabled:hover:bg-accent data-popup-open:bg-accent',
            'data-disabled:cursor-not-allowed data-disabled:opacity-50',
          )}
        >
          {!hideLabel && labelPosition === 'inside' && (
            <span aria-hidden="true" className="shrink-0 text-muted-foreground">
              {label}
            </span>
          )}
          <SelectPrimitive.Value placeholder={placeholder} className="flex-1 truncate text-left data-placeholder:text-muted-foreground" />
          <SelectPrimitive.Icon className="flex shrink-0 text-muted-foreground">
            <ChevronDown className="size-3.5" strokeWidth={2} aria-hidden="true" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
      </div>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Positioner alignItemWithTrigger={false} align="start" sideOffset={4} className="z-50 outline-none">
          <SelectPrimitive.Popup
            className={cn(
              'max-h-(--available-height) min-w-(--anchor-width) overflow-y-auto rounded-md border bg-popover p-1 text-sm text-popover-foreground shadow-md outline-none',
              'origin-(--transform-origin) transition-[opacity,scale] duration-(--duration-fast) ease-enter',
              'data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0',
            )}
          >
            <SelectPrimitive.List>
              {groupRuns(options).map((run, r) =>
                run.group ? (
                  <SelectPrimitive.Group key={r}>
                    <SelectPrimitive.GroupLabel className="px-2 pt-3.5 pb-0.5 text-[0.6875rem] text-muted-foreground/70">{run.group}</SelectPrimitive.GroupLabel>
                    {run.options.map((option) => renderItem(option))}
                  </SelectPrimitive.Group>
                ) : (
                  run.options.map((option) => renderItem(option))
                ),
              )}
            </SelectPrimitive.List>
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}

/** The phone's list: every option in a row of its own, tall enough to tap. */
function OptionList<Value extends string>({ label, options, value, defaultValue, onValueChange, disabled, className, searchable }: Pick<SelectProps<Value>, 'label' | 'options' | 'value' | 'defaultValue' | 'onValueChange' | 'disabled' | 'className' | 'searchable'>) {
  const [own, setOwn] = useState(defaultValue)
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const shown = q ? options.filter((option) => `${option.label} ${option.detail ?? ''}`.toLowerCase().includes(q)) : options
  const picked = value ?? own
  // The list scrolls with the sheet it is in, not in a box of its own (owner's call, 2026-11-17); it opens at the picked option.
  const list = useRef<HTMLDivElement>(null)
  useCentrePicked(list)
  // No box or lines round the list (owner's call, 2026-11-19): just the options, the picked one tinted.
  return (
    <div className={cn('flex w-full min-w-0 flex-col gap-2', className)}>
      {searchable && (
        <label className="flex h-9 shrink-0 items-center gap-2 rounded-md border border-input-border bg-input px-3 focus-within:border-ring">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${label.toLowerCase()}`} aria-label={`Search ${label.toLowerCase()}`} className="h-full w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
        </label>
      )}
    <div ref={list} role="radiogroup" aria-label={label} aria-disabled={disabled} className={cn('flex w-full min-w-0 flex-col gap-0.5', disabled && 'pointer-events-none opacity-50')}>
      {shown.length === 0 && <div className="px-3 py-3 text-sm text-muted-foreground">Nothing matches.</div>}
      {shown.map((option) => {
        const on = option.value === picked
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => {
              setOwn(option.value)
              onValueChange?.(option.value)
            }}
            className={cn(
              'flex min-h-11 shrink-0 items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm outline-none hover:bg-muted focus-visible:bg-accent',
              on && 'bg-primary-subtle text-primary-subtle-foreground',
            )}
          >
            {option.icon && <span className="grid size-8 shrink-0 place-items-center text-muted-foreground [&>svg]:size-6">{option.icon}</span>}
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-medium" style={option.style}>
                {option.label}
              </span>
              {option.detail && <span className={cn('text-xs', on ? 'text-primary-subtle-foreground' : 'text-muted-foreground')}>{option.detail}</span>}
            </span>
            {on && <Check className="size-4 shrink-0" aria-hidden="true" />}
          </button>
        )
      })}
    </div>
    </div>
  )
}
