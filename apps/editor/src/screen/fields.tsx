/*
 * Small building blocks shared by the properties in the side panels and the
 * top bar: number and length fields that apply when you press Enter or leave
 * them. The row layout of the panels is in properties-pane.tsx.
 */
import { TextField } from '@biofigure-lab/ui/components/text-field/TextField'
import { cn } from '@biofigure-lab/ui/lib/cn'
import { useExpandedControls } from '@biofigure-lab/ui/lib/expanded-controls'
import { useEffect, useState, type KeyboardEvent, type ReactNode } from 'react'

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

export type LiveFieldProps = {
  label: string
  value: string
  placeholder?: string
  /** Every change while typing. */
  onType: (text: string) => void
  /** Typing finished: the field was left or Enter pressed. */
  onDone: () => void
}

/** Keeps what is being typed while the field has focus; otherwise shows the value it is given. */
export function useTyped(value: string) {
  const [text, setText] = useState(value)
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    if (!focused) setText(value)
  }, [value, focused])
  return { text, setText, focused, setFocused }
}

/**
 * A text box that changes its object as you type. By default Enter leaves it
 * and Shift+Enter starts a new line. With `enterIsNewLine`, Enter starts a new
 * line and Ctrl or Cmd with Enter (or leaving the box) finishes. `rows` is its
 * height; longer text scrolls inside it.
 */
export function LiveTextArea({ label, value, placeholder, onType, onDone, rows = 2, enterIsNewLine = false, className }: LiveFieldProps & { rows?: number; enterIsNewLine?: boolean; className?: string }) {
  const { text, setText, setFocused } = useTyped(value)
  const expanded = useExpandedControls()
  return (
    <textarea
      aria-label={label}
      value={text}
      placeholder={placeholder}
      rows={rows}
      onFocus={() => setFocused(true)}
      onChange={(event) => {
        setText(event.target.value)
        onType(event.target.value)
      }}
      onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key !== 'Enter') return
        if (enterIsNewLine ? event.ctrlKey || event.metaKey : !event.shiftKey) {
          event.preventDefault()
          event.currentTarget.blur()
        }
      }}
      onBlur={() => {
        setFocused(false)
        onDone()
      }}
      className={cn('rounded-md border border-input-border bg-input text-sm outline-none hover:border-input-border-hover focus-visible:ring-2 focus-visible:ring-ring', enterIsNewLine ? 'resize-none overflow-y-auto' : 'resize-y', expanded ? 'w-full px-3 py-2' : 'px-2 py-1', className)}
    />
  )
}

/** A one-line text box that changes its object as you type (a panel's title). Enter or leaving it finishes. */
export function LiveTextField({ label, value, placeholder, onType, onDone, className }: LiveFieldProps & { className?: string }) {
  const { text, setText, setFocused } = useTyped(value)
  return (
    <TextField
      label={label}
      hideLabel
      value={text}
      placeholder={placeholder}
      className={className}
      onFocus={() => setFocused(true)}
      onChange={(event) => {
        setText(event.target.value)
        onType(event.target.value)
      }}
      onKeyDown={blurOnEnter}
      onBlur={() => {
        setFocused(false)
        onDone()
      }}
    />
  )
}
