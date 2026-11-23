/*
 * Small building blocks shared by the properties in the side panels and the
 * top bar: number and length fields that apply when you press Enter or leave
 * them. The row layout of the panels is in properties-pane.tsx.
 */
import { TextField } from '@biofigure-lab/ui/components/text-field/TextField'
import type { KeyboardEvent, ReactNode } from 'react'

import { formatMm, mmToPx } from '../editor/units'

/** Blur on Enter, so typing a value and pressing Enter applies it. */
export const blurOnEnter = (event: KeyboardEvent<HTMLInputElement>) => {
  if (event.key === 'Enter') event.currentTarget.blur()
}

/** A length typed in mm and kept in px. Applies when you press Enter or leave the field. */
export function MmField({ label, showLabel, prefix, px, onCommit, className, hideUnit = false }: { label: string; showLabel?: boolean; prefix?: string; px: number; onCommit: (px: number) => void; className?: string; hideUnit?: boolean }) {
  const shown = formatMm(px)
  return (
    <TextField
      // A new key resets the field whenever the object moves.
      key={shown}
      label={label}
      hideLabel={!showLabel}
      prefix={prefix}
      suffix={hideUnit ? undefined : 'mm'}
      inputMode="decimal"
      defaultValue={shown}
      className={className}
      onKeyDown={blurOnEnter}
      onBlur={(event) => {
        const mm = Number.parseFloat(event.target.value.replace(',', '.'))
        if (Number.isFinite(mm) && event.target.value !== shown) onCommit(mmToPx(mm))
        else event.target.value = shown
      }}
    />
  )
}

type NumberFieldProps = {
  label: string
  /** Show the label above the field instead of only to screen readers. */
  showLabel?: boolean
  value: number
  /** Shown before the value, e.g. an icon. */
  prefix?: ReactNode
  suffix?: string
  min: number
  max: number
  onCommit: (value: number) => void
  /** Less room inside the box, for several narrow fields in a row. */
  dense?: boolean
  className?: string
}

export function NumberField({ label, showLabel, value, prefix, suffix, min, max, onCommit, dense, className }: NumberFieldProps) {
  const shown = String(Math.round(value * 10) / 10)
  return (
    <TextField
      key={shown}
      label={label}
      hideLabel={!showLabel}
      prefix={prefix}
      suffix={suffix}
      dense={dense}
      inputMode="decimal"
      defaultValue={shown}
      className={className}
      onKeyDown={blurOnEnter}
      onBlur={(event) => {
        const next = Number.parseFloat(event.target.value.replace(',', '.'))
        if (Number.isFinite(next) && event.target.value !== shown) onCommit(Math.min(max, Math.max(min, next)))
        else event.target.value = shown
      }}
    />
  )
}
