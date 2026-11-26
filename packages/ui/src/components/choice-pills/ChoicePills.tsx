/*
 * Choice pills: a row of small rounded buttons where you can pick any number,
 * like the reasons in "What's wrong with this icon?". A picked pill gets a
 * tick and a blue tint; click it again to take it back.
 *
 * Keyboard: Tab reaches the group, the arrow keys move between the pills and
 * Space or Enter switches the one you're on. Screen readers hear a named
 * group of buttons that are pressed or not.
 *
 * Built on Base UI's ToggleGroup, in its "pick several" mode.
 */
import { Toggle } from '@base-ui/react/toggle'
import { ToggleGroup } from '@base-ui/react/toggle-group'
import { Check } from 'lucide-react'
import { useId } from 'react'

import { cn } from '../../lib/cn'

export type ChoicePill<Value extends string> = {
  value: Value
  label: string
}

export type ChoicePillsProps<Value extends string> = {
  /** The group's name, shown above the pills and read by screen readers, e.g. "What's wrong?". */
  label: string
  /** A small note next to the label, e.g. "pick any". */
  hint?: string
  options: readonly ChoicePill<Value>[]
  value?: readonly Value[]
  defaultValue?: readonly Value[]
  onValueChange?: (value: Value[]) => void
  className?: string
}

export function ChoicePills<Value extends string>({ label, hint, options, value, defaultValue, onValueChange, className }: ChoicePillsProps<Value>) {
  const labelId = useId()
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <span id={labelId} className="flex items-baseline gap-1.5 text-xs font-medium text-foreground">
        {label}
        {hint && <span className="font-normal text-muted-foreground">{hint}</span>}
      </span>
      <ToggleGroup<Value>
        multiple
        aria-labelledby={labelId}
        value={value}
        defaultValue={defaultValue}
        onValueChange={(next) => onValueChange?.(next)}
        className="flex flex-wrap gap-1.5"
      >
        {options.map((option) => (
          <Toggle
            key={option.value}
            value={option.value}
            className={cn(
              'group flex h-7 items-center gap-1 rounded-full border px-3 text-xs select-none',
              'transition-colors duration-(--duration-instant)',
              'text-foreground hover:bg-accent',
              'data-pressed:border-primary/60 data-pressed:bg-primary-subtle data-pressed:font-medium data-pressed:text-primary-subtle-foreground data-pressed:hover:bg-primary-subtle-hover',
              'focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none',
            )}
          >
            {/* The tick shows only when picked, and pulls the text back so the pill keeps its width. */}
            <Check className="-ml-1 hidden size-3 group-data-pressed:block" strokeWidth={3} aria-hidden="true" />
            {option.label}
          </Toggle>
        ))}
      </ToggleGroup>
    </div>
  )
}
