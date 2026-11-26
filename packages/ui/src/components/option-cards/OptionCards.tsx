/*
 * Option cards: pick one of a few options that are easier to see than to
 * read, like page sizes. All options show at once as cards in a row, each
 * with a picture of what you get, the name and short facts under it. The
 * picked card turns blue with a tick.
 *
 * `compact` makes small tiles for a properties row, like the icon colour
 * modes: a bigger picture, a small name under it, no tick and no facts.
 *
 * Keyboard: Tab reaches the picked card, the arrow keys move to and pick the
 * next one. Screen readers hear a radio group named by `label`.
 *
 * Built on Base UI's RadioGroup and Radio.
 */
import { Radio } from '@base-ui/react/radio'
import { RadioGroup } from '@base-ui/react/radio-group'
import { Check } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '../../lib/cn'

export type OptionCard<Value extends string> = {
  value: Value
  label: string
  /** Short facts under the name, e.g. "85 × 60 mm". */
  detail?: string
  /** The picture: an icon or a small drawing such as `PageSizeIcon`. Screen readers skip it. */
  picture: ReactNode
  disabled?: boolean
}

export type OptionCardsProps<Value extends string> = {
  /** Read by screen readers as the name of the group, e.g. "Page size". */
  label: string
  options: readonly OptionCard<Value>[]
  value?: Value
  defaultValue?: Value
  onValueChange?: (value: Value) => void
  /** Small tiles for a properties row: picture over a small name, no tick or facts. */
  compact?: boolean
  className?: string
}

export function OptionCards<Value extends string>({ label, options, value, defaultValue, onValueChange, compact = false, className }: OptionCardsProps<Value>) {
  return (
    <RadioGroup<Value>
      aria-label={label}
      value={value}
      defaultValue={defaultValue}
      onValueChange={(next) => onValueChange?.(next)}
      // On phones the big cards go two to a row, so they keep their size.
      className={cn('grid auto-cols-fr grid-flow-col', compact ? 'gap-1.5' : 'gap-2 max-md:grid-flow-row max-md:grid-cols-2', className)}
    >
      {options.map((option) => (
        <Radio.Root
          key={option.value}
          value={option.value}
          disabled={option.disabled}
          aria-label={option.detail ? `${option.label}, ${option.detail}` : option.label}
          className={cn(
            'group relative flex cursor-default flex-col items-center text-center outline-none select-none',
            compact ? 'min-w-0 gap-0.5 rounded-md border border-input-border px-0.5 pt-1.5 pb-1' : 'justify-center gap-2 rounded-lg border p-3',
            'transition-colors duration-(--duration-instant)',
            'not-data-checked:not-data-disabled:hover:border-border-strong not-data-checked:not-data-disabled:hover:bg-accent',
            'data-checked:border-primary data-checked:bg-primary-subtle data-checked:ring-1 data-checked:ring-primary',
            'focus-visible:ring-3 focus-visible:ring-ring/40 data-checked:focus-visible:ring-3',
            'data-disabled:cursor-not-allowed data-disabled:opacity-50',
          )}
        >
          {!compact && (
            <Radio.Indicator className="absolute top-1.5 right-1.5 grid size-4 place-items-center rounded-full bg-primary text-primary-foreground">
              <Check className="size-3" strokeWidth={3} aria-hidden="true" />
            </Radio.Indicator>
          )}
          <span aria-hidden="true" className={cn(compact ? 'grid size-9 place-items-center [&>*]:max-h-full [&>*]:max-w-full' : 'grid w-12 place-items-center')}>
            {option.picture}
          </span>
          <span className="flex w-full min-w-0 flex-col">
            <span className={cn(compact ? 'truncate text-[11px] text-muted-foreground group-data-checked:font-medium group-data-checked:text-primary-subtle-foreground' : 'font-medium')}>{option.label}</span>
            {option.detail && <span className="text-xs text-muted-foreground tabular-nums">{option.detail}</span>}
          </span>
        </Radio.Root>
      ))}
    </RadioGroup>
  )
}
