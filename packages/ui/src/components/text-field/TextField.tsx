/*
 * Text field: a labelled input, with optional text or icons before and after
 * the value (like "X" and "mm"), a help line and an error message. Always
 * outlined, so fields are easy to spot in a busy panel.
 *
 * Built on Base UI's Field, which links the label, help text and error to the
 * input for screen readers. Input styles based on shadcn/ui (MIT, see
 * THIRD_PARTY_NOTICES.md).
 */
import { Field } from '@base-ui/react/field'
import { useRef, type MouseEvent, type ReactNode } from 'react'

import { cn } from '../../lib/cn'
import { useExpandedControls } from '../../lib/expanded-controls'

/** The outlined box around an input. The search field uses it too, so the two always match. */
export const inputBoxClass = cn(
  'flex h-(--control-height) min-w-0 cursor-text items-center gap-1.5 rounded-md border border-input-border bg-input px-2 text-sm',
  'transition-[border-color,box-shadow] duration-(--duration-instant) hover:border-input-border-hover',
  'focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20 focus-within:hover:border-ring',
)

export type TextFieldProps = Omit<Field.Control.Props, 'className' | 'prefix' | 'size' | 'ref'> & {
  /** Always required, for screen readers. Hide it with `hideLabel` when a prefix says enough. */
  label: string
  hideLabel?: boolean
  /** A help line under the field. */
  description?: ReactNode
  /** An error message. Marks the field as invalid. */
  error?: string
  /** Shown before the value, e.g. "X" or an icon. */
  prefix?: ReactNode
  /** Shown after the value, e.g. "mm". */
  suffix?: ReactNode
  /** Less room inside the box, for several narrow fields in a row (like R, G and B). */
  dense?: boolean
  className?: string
}

export function TextField({ label, hideLabel, description, error, prefix, suffix, dense = false, className, disabled, ...inputProps }: TextFieldProps) {
  const input = useRef<HTMLInputElement>(null)
  // A phone's sheet: tall enough to tap.
  const tall = useExpandedControls()

  // Clicking anywhere on the row (prefix, suffix, padding) puts the cursor in the input.
  // Buttons inside the row, like a colour swatch, keep their own click.
  const focusInput = (event: MouseEvent) => {
    if (event.target instanceof HTMLInputElement || (event.target as Element).closest('button, label')) return
    event.preventDefault()
    input.current?.focus()
  }

  return (
    <Field.Root invalid={Boolean(error)} disabled={disabled} className={cn('group/field flex min-w-0 flex-col gap-1', className)}>
      <Field.Label
        className={cn(hideLabel ? 'sr-only' : 'text-xs font-medium text-foreground', 'group-data-disabled/field:opacity-50')}
      >
        {label}
      </Field.Label>
      <div
        onMouseDown={focusInput}
        className={cn(
          inputBoxClass,
          dense && 'gap-1 px-1.5',
          tall && 'h-11 px-3',
          'group-data-invalid/field:border-destructive',
          'group-data-disabled/field:pointer-events-none group-data-disabled/field:opacity-50',
        )}
      >
        {prefix && <span className="flex shrink-0 text-muted-foreground [&_svg]:size-3.5">{prefix}</span>}
        <Field.Control
          ref={input}
          className="h-full w-full min-w-0 bg-transparent text-foreground tabular-nums outline-none placeholder:text-muted-foreground"
          {...inputProps}
        />
        {suffix && <span className="shrink-0 text-muted-foreground">{suffix}</span>}
      </div>
      {description && !error && <Field.Description className="text-xs text-muted-foreground">{description}</Field.Description>}
      {error && (
        <Field.Error match className="text-xs text-destructive-text">
          {error}
        </Field.Error>
      )}
    </Field.Root>
  )
}
