/*
 * Colour-scale picker: every colour scale in view at once, as a list of rows
 * under Sequential and Two-sided headings. Each row has the scale's name on
 * the left and a strip of its colours on the right, built like the chart's
 * colour templates (the palette list the other graphs use), so the two read as
 * one family. The picked row is tinted blue with a blue ring.
 *
 * Keyboard: the rows are one radio group; Tab lands on the picked row and the
 * arrow keys move through every row (across both headings) and pick it.
 *
 * Picked design: draft A, "Strip list" (BIO-70, 2026-11-24).
 */
import { useRef, type KeyboardEvent } from 'react'

import { cn } from '../../lib/cn'
import { COLOUR_SCALES, scaleGradient, type ColourScaleId } from '../../lib/colour-scales'

const GROUPS = [
  { kind: 'sequential', name: 'Sequential' },
  { kind: 'two-sided', name: 'Two-sided' },
] as const

export type ColourScalePickerProps = {
  value: ColourScaleId
  onChange: (scale: ColourScaleId) => void
  /** The group's name for screen readers. */
  label?: string
  className?: string
}

export function ColourScalePicker({ value, onChange, label = 'Colour scale', className }: ColourScalePickerProps) {
  const list = useRef<HTMLDivElement>(null)
  const order = GROUPS.flatMap((group) => COLOUR_SCALES.filter((s) => s.kind === group.kind))
  const keys = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 0
    if (step === 0) return
    event.preventDefault()
    const next = (index + step + order.length) % order.length
    const scale = order[next]
    if (!scale) return
    onChange(scale.id)
    list.current?.querySelectorAll<HTMLElement>('[role=radio]')[next]?.focus()
  }
  return (
    <div ref={list} role="radiogroup" aria-label={label} className={cn('flex w-full min-w-0 flex-col gap-3', className)}>
      {GROUPS.map((group) => (
        <div key={group.kind} role="group" aria-label={group.name} className="flex flex-col gap-1 not-first:border-t not-first:pt-3">
          <span aria-hidden="true" className="section-label flex h-6 items-center">
            {group.name}
          </span>
          {COLOUR_SCALES.filter((s) => s.kind === group.kind).map((scale) => {
            const index = order.indexOf(scale)
            const picked = scale.id === value
            return (
              <button
                key={scale.id}
                type="button"
                role="radio"
                aria-checked={picked}
                aria-description={scale.hint}
                title={scale.hint}
                tabIndex={picked ? 0 : -1}
                onClick={() => onChange(scale.id)}
                onKeyDown={(event) => keys(event, index)}
                className={cn(
                  'flex h-11 items-center justify-between gap-3 rounded-md px-3 text-left text-sm ring-1 ring-border ring-inset outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring',
                  picked && 'bg-primary-subtle text-primary-subtle-foreground ring-2 ring-primary hover:bg-primary-subtle',
                )}
              >
                <span className="truncate">{scale.name}</span>
                <span aria-hidden="true" className="h-5 w-32 shrink-0 rounded-sm ring-1 ring-border-strong ring-inset" style={{ background: scaleGradient(scale.id) }} />
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
