/*
 * Slider: sets a number by dragging, with a number field next to it for
 * typing an exact value (opacity, stroke width). The handle moves from the
 * very first pixel of a drag and jumps to where you click the track. While
 * dragging it moves smoothly; the value always lands on an allowed step, and
 * the handle settles there when you let go.
 *
 * Keyboard: arrow keys move one step, Shift+arrow or Page Up/Down a large
 * step, Home/End to the ends. In the number field, arrow keys step too, and
 * a typed value counts once you press Enter or leave the field.
 *
 * A thin track with a round handle, label above, and the number field to
 * the right, outlined like the text field.
 *
 * `look="bar"` (phones, option C picked 2026-11-17): one fat 44 px bar that
 * fills in light blue, with a white rounded tab riding at the end of the fill
 * and showing the number, so there is no number field. Big enough for a thumb.
 *
 * Built on Base UI's Slider and Number Field.
 */
import { NumberField } from '@base-ui/react/number-field'
import { Slider as SliderPrimitive } from '@base-ui/react/slider'
import { useState, type KeyboardEvent } from 'react'

import { cn } from '../../lib/cn'
import { inputBoxClass } from '../text-field/TextField'
import { decimalsOf, fineStepOf, keyboardValue, snap } from './steps'

export type SliderProps = {
  /** What the slider sets, e.g. "Opacity". Always required, for screen readers. */
  label: string
  hideLabel?: boolean
  value?: number
  defaultValue?: number
  /** Called with every new value, already rounded to a step. */
  onValueChange?: (value: number) => void
  min?: number
  max?: number
  step?: number
  /** For Page Up/Down and Shift+arrow. Ten steps unless set. */
  largeStep?: number
  /** Written after the number, e.g. "%" or "pt". */
  unit?: string
  /** Show the number field for typing an exact value. On by default; the bar look shows the number in its tab instead. */
  showField?: boolean
  /** `line`: a thin track and round handle. `bar`: one fat bar with the number in its tab, for touch. */
  look?: 'line' | 'bar'
  disabled?: boolean
  className?: string
}

export function Slider({
  label,
  hideLabel,
  value: valueProp,
  defaultValue,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  largeStep = step * 10,
  unit,
  showField = true,
  look = 'line',
  disabled,
  className,
}: SliderProps) {
  const bar = look === 'bar'
  const steps = { min, max, step, largeStep }
  const [ownValue, setOwnValue] = useState(() => snap(defaultValue ?? min, steps))
  const value = valueProp ?? ownValue
  // Where the handle is while dragging, between steps. Empty when not dragging.
  const [dragPosition, setDragPosition] = useState<number | null>(null)
  const decimals = decimalsOf(step)
  const format = { maximumFractionDigits: decimals }

  const setValue = (next: number) => {
    if (valueProp === undefined) setOwnValue(next)
    if (next !== value) onValueChange?.(next)
  }

  return (
    <SliderPrimitive.Root
      value={dragPosition ?? value}
      min={min}
      max={max}
      step={fineStepOf(step)}
      largeStep={largeStep}
      format={format}
      disabled={disabled}
      // The bar's tab stays inside the bar at both ends.
      thumbAlignment={bar ? 'edge' : 'center'}
      onValueChange={(next, details) => {
        if (details.reason === 'keyboard') {
          setDragPosition(null)
          setValue(keyboardValue(value, next, steps))
        } else {
          setDragPosition(next)
          setValue(snap(next, steps))
        }
      }}
      // Letting go: the handle settles on the step the value already shows.
      onValueCommitted={() => setDragPosition(null)}
      className={cn('flex min-w-0 flex-col gap-1', className)}
    >
      <SliderPrimitive.Label
        className={cn(hideLabel ? 'sr-only' : 'text-xs font-medium text-foreground data-disabled:text-muted-foreground')}
      >
        {label}
      </SliderPrimitive.Label>
      <div className="flex items-center gap-3">
        {bar ? (
          <SliderPrimitive.Control
            // Marks a slider being dragged, e.g. for the editor to hide the selection frame meanwhile.
            data-slider=""
            className={cn(
              'relative flex h-11 min-w-0 flex-1 touch-none items-center overflow-hidden rounded-xl bg-muted ring-1 ring-border select-none ring-inset',
              'data-disabled:cursor-not-allowed data-disabled:opacity-50',
            )}
          >
            <SliderPrimitive.Track className="relative h-full w-full">
              <SliderPrimitive.Indicator className="h-full bg-primary-subtle" />
              <SliderPrimitive.Thumb
                getAriaValueText={(formatted) => (unit ? `${formatted} ${unit}` : formatted)}
                // A see-through box around the tab keeps 5 px between the tab and the bar's edges.
                className="group/thumb flex h-11 w-[3.75rem] p-[5px] outline-none"
              >
                <span
                  className={cn(
                    'grid flex-1 place-items-center rounded-[9px] bg-white text-[13px] font-semibold whitespace-nowrap text-zinc-900 tabular-nums shadow-[0_1px_2px_rgb(0_0_0/0.18),0_2px_6px_rgb(0_0_0/0.1)]',
                    'group-has-[:focus-visible]/thumb:ring-2 group-has-[:focus-visible]/thumb:ring-ring',
                  )}
                >
                  {value.toLocaleString(undefined, format)}
                  {unit && (unit === '%' ? unit : ` ${unit}`)}
                </span>
              </SliderPrimitive.Thumb>
            </SliderPrimitive.Track>
          </SliderPrimitive.Control>
        ) : (
        <SliderPrimitive.Control
          data-slider=""
          className={cn(
            'relative flex h-(--control-height) min-w-0 flex-1 touch-none items-center select-none',
            // When not available the track fades; the words stay readable.
            'data-disabled:cursor-not-allowed data-disabled:opacity-50',
          )}
        >
          <SliderPrimitive.Track className="relative h-1 w-full rounded-full bg-muted ring-1 ring-border ring-inset">
            <SliderPrimitive.Indicator className="h-full rounded-full bg-primary" />
            <SliderPrimitive.Thumb
              getAriaValueText={(formatted) => (unit ? `${formatted} ${unit}` : formatted)}
              className={cn(
                'size-3.5 rounded-full border border-input-border bg-white shadow-sm outline-none',
                'not-data-disabled:hover:border-input-border-hover',
                'has-[:focus-visible]:border-ring has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/30',
              )}
            />
          </SliderPrimitive.Track>
        </SliderPrimitive.Control>
        )}

        {showField && !bar && (
          <NumberField.Root
            value={value}
            min={min}
            max={max}
            step={step}
            largeStep={largeStep}
            format={format}
            disabled={disabled}
            // Arrow keys and the mouse wheel count straight away; typed text once it is committed.
            onValueChange={(next, details) => {
              if (next !== null && details.reason === 'keyboard') setValue(snap(next, steps))
            }}
            onValueCommitted={(next) => {
              if (next !== null) setValue(snap(next, steps))
            }}
          >
            <NumberField.Group className={cn(inputBoxClass, 'w-16 gap-0.5 px-1.5')}>
              <NumberField.Input
                aria-label={`${label} value`}
                onKeyDown={commitOnEnter}
                className="w-full min-w-0 bg-transparent text-foreground tabular-nums outline-none disabled:text-muted-foreground"
              />
              {unit && <span className="shrink-0 text-muted-foreground">{unit}</span>}
            </NumberField.Group>
          </NumberField.Root>
        )}
      </div>
    </SliderPrimitive.Root>
  )
}

/** Enter in the number field uses the typed value straight away, without leaving the field. */
function commitOnEnter(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key !== 'Enter') return
  const input = event.currentTarget
  input.blur()
  input.focus()
}
