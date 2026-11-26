/*
 * Reference lines: the list editor for lines across a chart's plot at a typed
 * value (y = 1 for "no change", a cut-off...), each solid or dashed, with an
 * optional short label at its end. Design A of three drafts (a compact table),
 * picked by the owner for BIO-68.
 *
 * One row per line, every setting in view: the value (applied when the field
 * is left or Enter is pressed; something unreadable goes back to what it
 * was), solid or dashed, the label (changes the chart as you type), and a
 * remove button. Removing happens at once: the caller offers Undo (a toast),
 * not an "Are you sure?". Adding a line puts the cursor in its value, so it
 * can be typed straight away; after a remove, focus moves to the next row's
 * remove button, or to Add line.
 *
 * With no lines only Add line shows; the header row (At, Line, Label) comes
 * with the first line. The rows keep one height, so adding or removing a line
 * moves only what is under the list.
 */
import { Plus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { cn } from '../../lib/cn'
import { Button } from '../button/Button'
import { IconButton } from '../icon-button/IconButton'
import { SegmentedToggle } from '../segmented-toggle/SegmentedToggle'
import { TextField } from '../text-field/TextField'

export type ReferenceLineStyle = 'solid' | 'dashed'
export type ReferenceLine = { value: number; style: ReferenceLineStyle; label: string }

export type ReferenceLinesProps = {
  lines: readonly ReferenceLine[]
  /** The new list. `typing` is set while a label is being typed; `onTypingDone` follows when the field is left. */
  onChange: (lines: ReferenceLine[], typing?: boolean) => void
  /** Typing in a label ended, e.g. to save it as one undo step. */
  onTypingDone?: () => void
  /** Line `index` was removed by its × button (already left out of `onChange`'s list): offer Undo here. */
  onRemove?: (index: number, line: ReferenceLine) => void
  /** Where a new line starts. */
  newValue?: number
  /** Reads a typed value; null when it can't be read. Defaults to plain numbers, with a comma or a point as the decimal mark. */
  parseValue?: (text: string) => number | null
  className?: string
}

const plainNumber = (text: string) => {
  const t = text.trim().replace(',', '.').replace(/^[−–]/, '-')
  if (!t) return null
  const value = Number(t)
  return Number.isFinite(value) ? value : null
}
const shown = (value: number) => String(Number(value.toPrecision(6)))

/** A short drawn sample of a solid or dashed line, as the toggle's icons. */
function lineIcon(dash?: string) {
  return function LineIcon({ className, strokeWidth = 2 }: { className?: string; strokeWidth?: number }) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap={dash ? 'butt' : 'round'} aria-hidden="true">
        <path d="M2 12h20" strokeDasharray={dash} />
      </svg>
    )
  }
}
const SolidLineIcon = lineIcon()
const DashedLineIcon = lineIcon('5 3')

const COLUMNS = 'grid grid-cols-[4rem_auto_minmax(0,1fr)_auto] items-center gap-1'

/** The value field: keeps what is typed until it is left or Enter is pressed. */
function ValueField({ index, value, onCommit, parse }: { index: number; value: number; onCommit: (value: number) => void; parse: (text: string) => number | null }) {
  const [text, setText] = useState(shown(value))
  // A change from outside (undo, another view) shows up in the field.
  useEffect(() => setText(shown(value)), [value])
  const commit = () => {
    const next = parse(text)
    if (next === null) setText(shown(value))
    else if (next !== value) onCommit(next)
  }
  return (
    <TextField
      label={`Line ${index + 1}: value`}
      hideLabel
      dense
      inputMode="decimal"
      value={text}
      onChange={(event) => setText(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commit()
        if (event.key === 'Escape') setText(shown(value))
      }}
      onBlur={commit}
    />
  )
}

export function ReferenceLines({ lines, onChange, onTypingDone, onRemove, newValue = 0, parseValue = plainNumber, className }: ReferenceLinesProps) {
  const list = useRef<HTMLUListElement>(null)
  const addButton = useRef<HTMLDivElement>(null)
  /** Where focus goes once the list has re-rendered: a row's value (after adding) or remove button (after removing). */
  const [focusNext, setFocusNext] = useState<{ kind: 'value' | 'remove'; index: number } | null>(null)
  useEffect(() => {
    if (!focusNext) return
    const row = list.current?.children[focusNext.index]
    const target = (focusNext.kind === 'value' ? row?.querySelector('input') : row?.querySelector('[data-remove]')) ?? addButton.current?.querySelector('button')
    if (target instanceof HTMLElement) target.focus()
    if (target instanceof HTMLInputElement) target.select()
    setFocusNext(null)
  }, [focusNext, lines.length])

  const change = (index: number, patch: Partial<ReferenceLine>, typing?: boolean) => onChange(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)), typing)
  const remove = (index: number) => {
    const line = lines[index]
    if (!line) return
    onChange(lines.filter((_, i) => i !== index))
    onRemove?.(index, line)
    setFocusNext({ kind: 'remove', index: Math.min(index, lines.length - 2) })
  }
  const add = () => {
    onChange([...lines, { value: newValue, style: 'dashed', label: '' }])
    setFocusNext({ kind: 'value', index: lines.length })
  }

  return (
    <div className={cn('flex w-full min-w-0 flex-col gap-1', className)}>
      {lines.length > 0 && (
        <>
          <div aria-hidden="true" className={cn(COLUMNS, 'px-0.5 text-[11px] text-muted-foreground')}>
            <span>At</span>
            <span className="w-[3.75rem]">Line</span>
            <span>Label</span>
            <span className="w-6" />
          </div>
          <ul ref={list} aria-label="Reference lines" className="flex flex-col gap-1">
            {lines.map((line, i) => (
              <li key={i} className={COLUMNS}>
                <ValueField index={i} value={line.value} parse={parseValue} onCommit={(value) => change(i, { value })} />
                <SegmentedToggle
                  label={`Line ${i + 1}: style`}
                  value={line.style}
                  options={[
                    { value: 'solid', label: 'Solid line', icon: SolidLineIcon },
                    { value: 'dashed', label: 'Dashed line', icon: DashedLineIcon },
                  ]}
                  onValueChange={(style) => change(i, { style })}
                />
                <TextField
                  label={`Line ${i + 1}: label`}
                  hideLabel
                  dense
                  placeholder="None"
                  value={line.label}
                  onChange={(event) => change(i, { label: event.target.value }, true)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') event.currentTarget.blur()
                  }}
                  onBlur={() => onTypingDone?.()}
                />
                <IconButton data-remove icon={X} size="sm" label={`Remove line ${i + 1} (at ${shown(line.value)})`} onClick={() => remove(i)} />
              </li>
            ))}
          </ul>
        </>
      )}
      <div ref={addButton} className="self-start">
        <Button variant="secondary" size="sm" onClick={add}>
          <Plus aria-hidden="true" /> Add line
        </Button>
      </div>
    </div>
  )
}
