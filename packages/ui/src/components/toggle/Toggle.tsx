/*
 * Toggle: switches one setting on or off straight away, like "Snap to grid"
 * or "Transparent background". Clicking the label works too, and Space
 * switches it from the keyboard. Screen readers hear it as a switch that is
 * on or off.
 *
 * Normally a small sliding switch at the end of the row, blue when on. The
 * `segmented` variant shows an Off | On pair instead, for places where
 * saying the state in words helps; the side that's on gets the soft blue
 * tint, like a pressed icon button. (For picking several options from a
 * list, a checkbox is the right control, not this.)
 *
 * In a phone's sheet (`ExpandedControls`) the switch is a fat bar, like the
 * phone's sliders, easy to hit with a thumb: an X in the off slot and a tick in
 * the on slot always show, and the white tab slides over the one that holds
 * (owner's call, 2026-11-17).
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
  /** `switch` (the default) or an Off | On pair. */
  variant?: 'switch' | 'segmented'
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
  variant = 'switch',
  disabled,
  name,
  className,
}: ToggleProps) {
  const id = useId()
  const fat = useExpandedControls() && variant === 'switch'
  const descriptionId = `${id}-description`

  return (
    <div className={cn('flex min-w-0 items-center gap-2', hideLabel ? (fat ? 'h-11' : 'h-(--control-height)') : 'justify-between', className)}>
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
          fat && 'h-11 w-24 overflow-hidden rounded-xl bg-muted p-[5px] ring-1 ring-border ring-inset data-checked:bg-primary-subtle',
          variant === 'switch' && !fat && [
            'h-4 w-7 rounded-full border border-input-border bg-muted p-px',
            'data-checked:border-primary data-checked:bg-primary not-data-disabled:hover:border-input-border-hover',
          ],
          variant === 'segmented' && 'h-6 rounded-md border border-border-strong bg-muted p-0.5 text-xs font-medium',
        )}
      >
        {fat ? (
          <>
            {/* Both slots always show their icon; the tab covers the one that holds, showing it again on white. */}
            <span aria-hidden="true" className="absolute inset-y-[5px] left-[5px] grid w-[2.875rem] place-items-center text-muted-foreground">
              <X className="size-4" strokeWidth={2.25} />
            </span>
            <span aria-hidden="true" className="absolute inset-y-[5px] right-[5px] grid w-[2.875rem] place-items-center text-primary-subtle-foreground">
              <Check className="size-4" strokeWidth={2.25} />
            </span>
            <Switch.Thumb className="relative grid h-full w-[2.875rem] place-items-center rounded-[9px] bg-white text-[rgb(24_24_27)] shadow-sm transition-transform duration-(--duration-fast) ease-standard data-checked:translate-x-10 data-checked:text-primary">
              <X aria-hidden="true" className="size-4 group-data-checked/toggle:hidden" strokeWidth={2.25} />
              <Check aria-hidden="true" className="hidden size-4 group-data-checked/toggle:block" strokeWidth={2.25} />
            </Switch.Thumb>
          </>
        ) : variant === 'switch' ? (
          <Switch.Thumb
            className={cn(
              'size-3 rounded-full bg-panel shadow-sm ring-1 ring-border-strong',
              'transition-transform duration-(--duration-fast) ease-standard data-checked:translate-x-3 data-checked:ring-0',
            )}
          />
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
