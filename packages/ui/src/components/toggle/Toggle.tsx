/*
 * Toggle: switches one setting on or off straight away, like "Snap to grid"
 * or "Transparent background". Clicking the label works too, and Space
 * switches it from the keyboard. Screen readers hear it as a switch that is
 * on or off.
 *
 * A fat bar (owner's rule for desktop, 2026-11-24): an X in the off slot and a
 * tick in the on slot always show, and the white tab slides over the one that
 * holds, tinted blue when on. On desktop, with a hidden label (label-left
 * property rows) the bar fills the row's width; with a visible label it keeps
 * a fixed width at the end of the row, so the words get the room. `offIcon` and
 * `onIcon` replace the X and the tick (for example a "no text" and a "text"
 * icon); give them their own size, e.g. `size-4`.
 *
 * In a phone's sheet (`ExpandedControls`) toggles keep their own look (owner's
 * call, 2026-11-17): the same fat bar at a fixed 96 px, easy to hit with a
 * thumb; only a toggle given `variant="bar"` on purpose spans the whole width.
 *
 * The `segmented` variant shows an Off | On pair instead, for places where
 * saying the state in words helps; the side that's on gets the soft blue
 * tint, like a pressed icon button. (For picking several options from a
 * list, a checkbox is the right control, not this.)
 *
 * Built on Base UI's Switch.
 */
import { Switch } from '@base-ui/react/switch'
import { Check, X } from 'lucide-react'
import { useId, type ReactNode } from 'react'

import { cn } from '../../lib/cn'
import { useExpandedControls } from '../../lib/expanded-controls'

export type ToggleProps = {
  /** What the toggle switches, e.g. "Snap to grid". */
  label: string
  /** Only for screen readers, e.g. when a label-left row already names the setting. The switch then sits at the start. */
  hideLabel?: boolean
  /** A help line under the label. */
  description?: ReactNode
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
  /** The fat `bar` (the default), or an Off | On pair. */
  variant?: 'bar' | 'segmented'
  /** `bar` only: shown in place of the X. */
  offIcon?: ReactNode
  /** `bar` only: shown in place of the tick. */
  onIcon?: ReactNode
  disabled?: boolean
  name?: string
  className?: string
}

export function Toggle({
  label,
  hideLabel = false,
  description,
  checked,
  defaultChecked,
  onCheckedChange,
  variant: variantProp,
  offIcon,
  onIcon,
  disabled,
  name,
  className,
}: ToggleProps) {
  const id = useId()
  const variant = variantProp ?? 'bar'
  const bar = variant === 'bar'
  // In a phone's sheet toggles keep their 2026-11-17 look: a 96 px fat switch, and only an explicit `bar` fills the width.
  const phone = useExpandedControls()
  // On desktop a bar in a label-left row fills the row; next to its own words it keeps a fixed width at the end.
  const stretched = phone ? variantProp === 'bar' : bar && hideLabel
  // On a phone an explicit `bar` with a visible label stacks the label over the bar, as before.
  const stacked = phone && stretched && !hideLabel
  const off = offIcon ?? <X className="size-4" strokeWidth={2.25} />
  const on = onIcon ?? <Check className="size-4" strokeWidth={2.25} />
  const descriptionId = `${id}-description`

  return (
    <div
      className={cn(
        'flex min-w-0',
        phone ? 'gap-2' : 'gap-3',
        stacked ? 'flex-col items-stretch gap-1' : 'items-center',
        hideLabel ? (bar ? cn('h-11', !phone && 'w-full') : 'h-(--control-height)') : !stacked && 'justify-between',
        className,
      )}
    >
      <div className={cn('flex min-w-0 flex-col', hideLabel && 'sr-only')}>
        {/* When not available only the control fades; the words stay readable, so the help line can say why. */}
        <label
          htmlFor={id}
          className={cn('text-sm select-none', disabled ? 'cursor-not-allowed text-muted-foreground' : 'cursor-pointer text-foreground')}
        >
          {label}
        </label>
        {description && (
          <span id={descriptionId} className="text-xs text-muted-foreground">
            {description}
          </span>
        )}
      </div>

      <Switch.Root
        id={id}
        nativeButton
        render={<button type="button" />}
        checked={checked}
        defaultChecked={defaultChecked}
        onCheckedChange={(next) => onCheckedChange?.(next)}
        disabled={disabled}
        name={name}
        aria-describedby={description ? descriptionId : undefined}
        className={cn(
          'group/toggle relative inline-flex shrink-0 items-center select-none',
          'transition-[background-color,border-color,color] duration-(--duration-fast)',
          'data-disabled:cursor-not-allowed data-disabled:opacity-50',
          bar && (stretched ? 'w-full' : 'w-24'),
          bar && 'h-11 overflow-hidden rounded-xl bg-muted p-[5px] ring-1 ring-border ring-inset data-checked:bg-primary-subtle',
          variant === 'segmented' && 'h-6 rounded-md border border-border-strong bg-muted p-0.5 text-xs font-medium',
        )}
      >
        {bar ? (
          <>
            {/* Both slots always show their icon; the tab covers the one that holds, showing it again on white. */}
            <span aria-hidden="true" className={cn('absolute inset-y-[5px] left-[5px] grid place-items-center text-muted-foreground', stretched ? 'w-[calc(50%-5px)]' : 'w-[2.875rem]')}>
              {off}
            </span>
            <span aria-hidden="true" className={cn('absolute inset-y-[5px] right-[5px] grid place-items-center text-primary-subtle-foreground', stretched ? 'w-[calc(50%-5px)]' : 'w-[2.875rem]')}>
              {on}
            </span>
            <Switch.Thumb
              className={cn(
                'relative grid h-full place-items-center rounded-[9px] bg-white text-[rgb(24_24_27)] shadow-sm transition-transform duration-(--duration-fast) ease-standard data-checked:text-primary',
                stretched ? 'w-1/2 data-checked:translate-x-full' : 'w-[2.875rem] data-checked:translate-x-10',
              )}
            >
              <span aria-hidden="true" className="contents group-data-checked/toggle:hidden">
                {off}
              </span>
              <span aria-hidden="true" className="hidden group-data-checked/toggle:contents">
                {on}
              </span>
            </Switch.Thumb>
          </>
        ) : (
          (['Off', 'On'] as const).map((side) => (
            <span
              key={side}
              aria-hidden="true"
              className={cn(
                'flex h-full items-center rounded-sm px-2 text-muted-foreground transition-colors duration-(--duration-fast)',
                side === 'Off'
                  ? 'group-data-unchecked/toggle:bg-panel group-data-unchecked/toggle:text-foreground group-data-unchecked/toggle:shadow-sm'
                  : 'group-data-checked/toggle:bg-primary-subtle group-data-checked/toggle:text-primary-subtle-foreground group-data-checked/toggle:shadow-sm',
              )}
            >
              {side}
            </span>
          ))
        )}
      </Switch.Root>
    </div>
  )
}
