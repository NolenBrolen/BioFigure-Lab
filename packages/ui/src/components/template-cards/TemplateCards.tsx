/*
 * Template cards: pick one finished figure to start from. A grid of cards,
 * each with a picture of the figure, its name and a line about it. The
 * picked card turns blue with a tick.
 *
 * Keyboard: Tab reaches the picked card, the arrow keys move to and pick the
 * next one. Screen readers hear a radio group named by `label`.
 *
 * Built on Base UI's RadioGroup and Radio, like OptionCards.
 */
import { Radio } from '@base-ui/react/radio'
import { RadioGroup } from '@base-ui/react/radio-group'
import { Check } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '../../lib/cn'

export type TemplateCard = {
  value: string
  label: string
  /** One line under the name. */
  detail?: string
  /** The picture of the figure, e.g. an `<img>`. Screen readers skip it. */
  picture: ReactNode
}

export type TemplateCardsProps = {
  /** Read by screen readers as the name of the group. */
  label: string
  options: readonly TemplateCard[]
  value?: string
  onValueChange?: (value: string) => void
  className?: string
}

export function TemplateCards({ label, options, value, onValueChange, className }: TemplateCardsProps) {
  return (
    <RadioGroup aria-label={label} value={value} onValueChange={(next) => onValueChange?.(next)} className={cn('grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-3', className)}>
      {options.map((option) => (
        <Radio.Root
          key={option.value}
          value={option.value}
          aria-label={option.detail ? `${option.label}, ${option.detail}` : option.label}
          className={cn(
            'relative flex cursor-default flex-col gap-2 rounded-lg border border-transparent p-2.5 text-left outline-none select-none',
            'transition-colors duration-(--duration-instant)',
            // The card's frame only shows when pointed at or picked.
            'not-data-checked:hover:border-border-strong not-data-checked:hover:bg-accent',
            'data-checked:border-primary data-checked:bg-primary-subtle data-checked:ring-1 data-checked:ring-primary',
            'focus-visible:ring-3 focus-visible:ring-ring/40 data-checked:focus-visible:ring-3',
          )}
        >
          <Radio.Indicator className="absolute top-4.5 right-4.5 z-10 grid size-4 place-items-center rounded-full bg-primary text-primary-foreground">
            <Check className="size-3" strokeWidth={3} aria-hidden="true" />
          </Radio.Indicator>
          <span
            aria-hidden="true"
            className={cn(
              'block aspect-[16/9] overflow-hidden rounded-md border bg-white [&>*]:size-full [&>*]:object-contain',
            )}
          >
            {option.picture}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-base font-medium">{option.label}</span>
            {option.detail && <span className="truncate text-sm text-muted-foreground">{option.detail}</span>}
          </span>
        </Radio.Root>
      ))}
    </RadioGroup>
  )
}
