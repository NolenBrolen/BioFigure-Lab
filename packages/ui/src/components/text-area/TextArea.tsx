/*
 * Text area: a labelled box for a few lines of text, with an optional help
 * line and error message. Looks like the text field (same outline, same
 * focus ring), only taller. It can't be dragged bigger, so the form around
 * it keeps its shape.
 *
 * Built on Base UI's Field, which links the label, help text and error to
 * the box for screen readers.
 */
import { Field } from '@base-ui/react/field'
import type { ReactNode } from 'react'

import { cn } from '../../lib/cn'
import { inputBoxClass } from '../text-field/TextField'

export type TextAreaProps = {
  /** Always required, for screen readers. */
  label: string
  /** A help line under the box. */
  description?: ReactNode
  /** An error message. Marks the box as invalid. */
  error?: string
  placeholder?: string
  /** How many lines tall it starts. Default 3. */
  rows?: number
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  name?: string
  disabled?: boolean
  className?: string
}

export function TextArea({ label, description, error, placeholder, rows = 3, value, defaultValue, onValueChange, name, disabled, className }: TextAreaProps) {
  return (
    <Field.Root invalid={Boolean(error)} disabled={disabled} name={name} className={cn('group/field flex min-w-0 flex-col gap-1', className)}>
      <Field.Label className="text-xs font-medium text-foreground group-data-disabled/field:opacity-50">{label}</Field.Label>
      <Field.Control
        render={<textarea rows={rows} />}
        value={value}
        defaultValue={defaultValue}
        placeholder={placeholder}
        onValueChange={(next) => onValueChange?.(next)}
        className={cn(
          inputBoxClass,
          'block h-auto resize-none cursor-text py-1.5 leading-5 text-foreground outline-none placeholder:text-muted-foreground',
          'group-data-invalid/field:border-destructive',
          'group-data-disabled/field:pointer-events-none group-data-disabled/field:opacity-50',
        )}
      />
      {description && !error && <Field.Description className="text-xs text-muted-foreground">{description}</Field.Description>}
      {error && (
        <Field.Error match className="text-xs text-destructive-text">
          {error}
        </Field.Error>
      )}
    </Field.Root>
  )
}
