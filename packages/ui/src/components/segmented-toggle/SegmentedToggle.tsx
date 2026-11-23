/*
 * Segmented toggle: pick one of a few options with small icon buttons that
 * read as one control, such as tiles / list in the icon library. A grey
 * track holds the icons; the chosen one sits on a raised white piece that
 * slides across when the choice changes.
 *
 * Exactly one option is always chosen. Clicking anywhere on the control
 * switches: an option picks it; the chosen option or the track around the
 * buttons moves on to the next option (with two options, a plain toggle). Tab reaches the group, arrow keys move between options and
 * Enter or Space picks one. Each option's label is its tooltip.
 *
 * An option shows a small picture instead of an icon with `picture`, e.g.
 * the icon library's styles, each shown as a tiny drawing in that style.
 *
 * `stacked` makes it taller, with each option's name under its icon, for
 * options whose names are too long to fit beside their icons.
 *
 * Built on Base UI's ToggleGroup.
 */
import { Toggle } from '@base-ui/react/toggle'
import { ToggleGroup } from '@base-ui/react/toggle-group'
import type { ComponentType, ReactNode } from 'react'

import { cn } from '../../lib/cn'
import { Tooltip } from '../tooltip/Tooltip'

/** A Lucide icon, or any small picture component that takes the same few props. */
export type SegmentedToggleIcon = ComponentType<{ className?: string; strokeWidth?: number; 'aria-hidden'?: 'true' }>

export type SegmentedToggleOption<T extends string> = {
  value: T
  /** Give each option an icon or a picture. */
  icon?: SegmentedToggleIcon
  /** A small picture in place of the icon (an <img>), shown 20 px square. */
  picture?: ReactNode
  /** What picking this option does, e.g. "Show as list". Read by screen readers and shown as the tooltip. */
  label: string
}

export type SegmentedToggleProps<T extends string> = {
  options: readonly SegmentedToggleOption<T>[]
  value: T
  onValueChange: (value: T) => void
  /** The group's name for screen readers, e.g. "View". */
  label: string
  /** Show each option's label next to its icon, e.g. Grow / Wrap / Shrink. Without it the label is only the tooltip. */
  showLabels?: boolean
  /** Taller, with each label under its icon (implies showLabels). */
  stacked?: boolean
  className?: string
}

export function SegmentedToggle<T extends string>({ options, value, onValueChange, label, showLabels: labelsOn, stacked, className }: SegmentedToggleProps<T>) {
  const showLabels = labelsOn || stacked
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  )
  const nextValue = options[(index + 1) % options.length]?.value ?? value

  return (
    <ToggleGroup
      aria-label={label}
      value={[value]}
      onValueChange={(next) => {
        const picked = next[0] as T | undefined
        // An empty choice means the chosen option was clicked again: that switches to the next one.
        onValueChange(picked ?? nextValue)
      }}
      // Clicks on the track around the buttons switch too, so the whole control is one target.
      onClick={(event) => {
        if (!(event.target as Element).closest('button')) onValueChange(nextValue)
      }}
      className={cn('relative inline-grid cursor-pointer', stacked ? 'h-11' : 'h-(--control-height)', 'auto-cols-fr grid-flow-col rounded-md bg-muted p-0.5', className)}
    >
      {/* The raised piece behind the chosen option. */}
      <span
        aria-hidden="true"
        // Width and position follow the number of options and which one is chosen (the track has 2 px padding each side).
        style={{ width: `calc((100% - 4px) / ${options.length})`, transform: `translateX(${index * 100}%)` }}
        className={cn(
          'absolute inset-y-0.5 left-0.5 rounded-[5px]',
          // In dark mode the panel colour is darker than the track, so the piece uses a lighter grey to still look raised.
          'bg-panel shadow-[0_1px_3px_var(--shadow-color),0_0_0_1px_var(--border)] dark:bg-border-strong',
          'transition-transform duration-150 ease-out motion-reduce:transition-none',
        )}
      />
      {options.map(({ value: optionValue, icon: Icon, picture, label: optionLabel }) => (
        <Tooltip key={optionValue} label={optionLabel} disabled={showLabels}>
          <Toggle
            value={optionValue}
            aria-label={showLabels ? undefined : optionLabel}
            className={cn(
              'relative z-1 rounded-[5px] text-muted-foreground select-none',
              stacked
                ? 'flex min-w-0 flex-col items-center justify-center gap-0.5 px-1 text-[11px] leading-none'
                : showLabels
                  ? 'flex min-w-0 items-center justify-center gap-1 px-1 text-xs'
                  : 'grid w-7 place-items-center',
              'transition-colors duration-(--duration-instant) hover:text-foreground data-pressed:text-foreground',
              'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
            )}
          >
            {picture !== undefined ? (
              <span aria-hidden="true" className="grid size-5 shrink-0 place-items-center [&>*]:size-full [&>*]:object-contain">
                {picture}
              </span>
            ) : (
              Icon && <Icon className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            )}
            {showLabels && <span className="truncate">{optionLabel}</span>}
          </Toggle>
        </Tooltip>
      ))}
    </ToggleGroup>
  )
}
