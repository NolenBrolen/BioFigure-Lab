/*
 * Table panel: the contents of the left panel when the Table tool is on.
 * A row of layout tiles (which rows and columns stand out), a row of look
 * tiles (lines and colours), and a size grid: hover to pick rows × columns,
 * click to add a table of that size to the page.
 * The arrow keys move through the size grid too. On phones a tap only
 * highlights a size (there's no hover to preview it), and `onPickSize` only
 * picks it; the editor's Place table button adds the table.
 *
 * Picked look: A (tiles and size grid), layouts on one row, with a look picker.
 */
import { useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'

import { cn } from '../../lib/cn'
import { usePhoneLayout } from '../../lib/use-media-query'
import { Tooltip } from '../tooltip/Tooltip'

export type TableLayout = 'grid' | 'header' | 'header-col' | 'striped'
export type TableLook = 'classic' | 'soft' | 'journal'

export const TABLE_LAYOUTS: { id: TableLayout; name: string }[] = [
  { id: 'grid', name: 'Plain grid' },
  { id: 'header', name: 'Header row' },
  { id: 'header-col', name: 'Header row and column' },
  { id: 'striped', name: 'Striped' },
]

export const TABLE_LOOKS: { id: TableLook; name: string }[] = [
  { id: 'classic', name: 'Classic' },
  { id: 'soft', name: 'Soft' },
  { id: 'journal', name: 'Journal' },
]

/** The biggest table the size grid offers; bigger ones grow with Tab or the row and column actions. */
export const SIZE_GRID = 8

export type TablePanelProps = {
  layout: TableLayout
  look: TableLook
  onLayoutChange: (layout: TableLayout) => void
  onLookChange: (look: TableLook) => void
  /** The size whose placing tool is on, if any. Phones: the highlighted size. */
  picked?: { rows: number; cols: number }
  onPickSize: (size: { rows: number; cols: number }) => void
  className?: string
}

/** Picture style shared with the Shapes panel: a thin line, no fill, round joins. */
const pictureProps = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.25, strokeLinejoin: 'round', strokeLinecap: 'round' } as const
/** Gridded tables get lighter, thinner lines, so they don't look heavy. */
const gridLines = { strokeOpacity: 0.7, strokeWidth: 1 } as const
/** A filled area (header, stripe), shown as a light tint so the lines stay the main thing. */
const shade = (opacity: number) => ({ fill: 'currentColor', stroke: 'none', opacity })

/** A small 3 × 4 table in a layout; the rows and columns that stand out get a heavier line. */
export function LayoutPicture({ layout, className }: { layout: TableLayout; className?: string }) {
  const [w, h, cols, rows] = [36, 28, 3, 4]
  const cw = w / cols
  const rh = h / rows
  return (
    <svg aria-hidden viewBox={`-2 -2 ${w + 4} ${h + 4}`} className={className} {...pictureProps}>
      {layout !== 'grid' && <rect width={w} height={rh} {...shade(0.35)} />}
      {layout === 'header-col' && <rect y={rh} width={cw} height={h - rh} {...shade(0.2)} />}
      {layout === 'striped' && <rect y={2 * rh} width={w} height={rh} {...shade(0.2)} />}
      <g {...gridLines}>
        <rect width={w} height={h} rx={1.5} />
        {[1, 2, 3].map((i) => <line key={`r${i}`} x2={w} y1={i * rh} y2={i * rh} />)}
        {[1, 2].map((i) => <line key={`c${i}`} x1={i * cw} x2={i * cw} y2={h} />)}
      </g>
    </svg>
  )
}

/** A small table in a look: its lines and header style, drawn as outlines. */
export function LookPicture({ look, className }: { look: TableLook; className?: string }) {
  const [w, h] = [40, 28]
  const rh = h / 4
  const text = [1, 2, 3].map((i) => [0, 1, 2].map((c) => <line key={`${i}-${c}`} x1={c * 13 + 3} x2={c * 13 + 10} y1={i * rh + rh / 2} y2={i * rh + rh / 2} />))
  return (
    <svg aria-hidden viewBox={`-2 -2 ${w + 4} ${h + 4}`} className={className} {...pictureProps}>
      {look === 'classic' && (
        <>
          <rect width={w} height={rh} {...shade(0.3)} />
          <g {...gridLines}>
            <rect width={w} height={h} rx={1.5} />
            {[1, 2, 3].map((i) => <line key={i} x2={w} y1={i * rh} y2={i * rh} />)}
            {[1, 2].map((i) => <line key={`c${i}`} x1={(i * w) / 3} x2={(i * w) / 3} y2={h} />)}
          </g>
        </>
      )}
      {look === 'soft' && (
        <>
          <rect width={w} height={rh} rx={rh / 2} className="fill-primary" stroke="none" />
          <rect y={2 * rh} width={w} height={rh} rx={rh / 2} {...shade(0.18)} />
          {text}
        </>
      )}
      {look === 'journal' && (
        <>
          <line x2={w} strokeWidth={2.5} />
          <line x2={w} y1={rh} y2={rh} />
          <line x2={w} y1={h} y2={h} strokeWidth={2.5} />
          {text}
        </>
      )}
    </svg>
  )
}

/** A row of picture tiles that work as radio buttons. `showNames` writes the name under each picture. */
function TileRow<T extends string>(props: { label: string; value: T; options: { id: T; name: string }[]; picture: (id: T) => ReactNode; showNames?: boolean; onChange: (value: T) => void }) {
  const { label, value, options, picture, showNames = false, onChange } = props
  const onKeyDown = (event: KeyboardEvent<HTMLElement>, index: number) => {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
    if (step === 0) return
    event.preventDefault()
    const next = (index + step + options.length) % options.length
    onChange(options.at(next)!.id)
    const buttons = event.currentTarget.parentElement?.parentElement?.querySelectorAll<HTMLElement>('[role=radio]')
    buttons?.[next]?.focus()
  }
  return (
    <section aria-label={label} className="pt-1">
      <h3 className="section-label flex h-7 items-center">{label}</h3>
      <div role="radiogroup" aria-label={label} className={cn('grid gap-2', options.length === 4 ? 'grid-cols-4' : 'grid-cols-3')}>
        {options.map((option, index) => {
          const picked = option.id === value
          const tile = (
            <button
              type="button"
              role="radio"
              aria-checked={picked}
              aria-label={option.name}
              tabIndex={picked ? 0 : -1}
              onClick={() => onChange(option.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                'group flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg bg-muted p-1.5 text-foreground ring-1 ring-transparent transition-colors duration-(--duration-instant) ring-inset hover:bg-accent hover:ring-border-strong',
                showNames ? 'aspect-[4/3.4]' : 'aspect-square',
                picked && 'bg-accent ring-2 ring-primary hover:ring-primary',
              )}
            >
              <span className="flex w-4/5 flex-1 items-center justify-center [&>svg]:w-full">{picture(option.id)}</span>
              {showNames && <span className="w-full truncate text-center text-xs text-muted-foreground group-hover:text-foreground">{option.name}</span>}
            </button>
          )
          return (
            <span key={option.id} className="flex min-w-0 [&>*]:w-full">
              {showNames ? tile : <Tooltip label={option.name}>{tile}</Tooltip>}
            </span>
          )
        })}
      </div>
    </section>
  )
}

/**
 * Phones: tap a square to highlight that many rows × columns; the Place table
 * button at the foot of the sheet adds it. The cells fill the panel's width
 * so they're easy to tap, and short (28 px) so all 8 rows fit in the sheet.
 * Pressing and sliding over the grid drags the highlight's corner along.
 */
function PhoneSizeGrid({ picked, onPick }: { picked?: { rows: number; cols: number }; onPick: (size: { rows: number; cols: number }) => void }) {
  const size = picked ?? { rows: 0, cols: 0 }
  const dragging = useRef(false)
  // The cell under the finger, worked out from where it is in the grid (outside the grid it sticks to the nearest edge).
  const follow = (event: ReactPointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    const at = (offset: number, length: number) => Math.min(SIZE_GRID, Math.max(1, Math.ceil((offset / length) * SIZE_GRID)))
    const next = { rows: at(event.clientY - box.top, box.height), cols: at(event.clientX - box.left, box.width) }
    if (next.rows !== size.rows || next.cols !== size.cols) onPick(next)
  }
  return (
    <section aria-label="Size" className="flex flex-col gap-2 pt-1">
      <h3 className="section-label flex h-7 items-center justify-between">
        Size
        <span className="font-normal normal-case tracking-normal text-muted-foreground" aria-live="polite">
          {size.rows > 0 && `${size.rows} rows × ${size.cols} columns`}
        </span>
      </h3>
      <div
        role="radiogroup"
        aria-label="Table size"
        // Sliding a finger over the grid moves the highlight's corner with it, instead of scrolling the sheet.
        className="grid touch-none gap-1 select-none"
        style={{ gridTemplateColumns: `repeat(${SIZE_GRID}, minmax(0, 1fr))` }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture?.(event.pointerId)
          dragging.current = true
          follow(event)
        }}
        onPointerMove={(event) => {
          if (dragging.current) follow(event)
        }}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
      >
        {Array.from({ length: SIZE_GRID * SIZE_GRID }, (_, i) => {
          const rows = Math.floor(i / SIZE_GRID) + 1
          const cols = (i % SIZE_GRID) + 1
          const on = rows <= size.rows && cols <= size.cols
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={rows === size.rows && cols === size.cols}
              aria-label={`${rows} rows by ${cols} columns`}
              onClick={() => onPick({ rows, cols })}
              className={cn(
                'h-7 rounded-[4px] border outline-none transition-colors duration-(--duration-instant) focus-visible:ring-2 focus-visible:ring-ring',
                on ? 'border-primary bg-primary/25' : 'border-border bg-muted',
              )}
            />
          )
        })}
      </div>
    </section>
  )
}

/** Hover a block of squares to pick rows × columns; click (or Enter) to pick it. */
function SizeGrid({ picked, onPick }: { picked?: { rows: number; cols: number }; onPick: (size: { rows: number; cols: number }) => void }) {
  const resting = picked ?? { rows: 0, cols: 0 }
  const [hover, setHover] = useState<{ rows: number; cols: number }>()
  const shown = hover ?? resting
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const from = hover ?? (resting.rows > 0 ? resting : { rows: 1, cols: 1 })
    const moves: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }
    const move = moves[event.key]
    if (move) {
      event.preventDefault()
      const clamp = (n: number) => Math.min(SIZE_GRID, Math.max(1, n))
      setHover({ rows: clamp(from.rows + move[0]), cols: clamp(from.cols + move[1]) })
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onPick(from)
    }
  }
  return (
    <section aria-label="Size" className="pt-1">
      <h3 className="section-label flex h-7 items-center">Size</h3>
      <div
        role="grid"
        aria-label={`Table size: ${shown.rows > 0 ? `${shown.rows} rows by ${shown.cols} columns` : 'none picked'}. Arrow keys change it, Enter picks it.`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onMouseLeave={() => setHover(undefined)}
        onBlur={() => setHover(undefined)}
        className="grid w-fit gap-0.5 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
        style={{ gridTemplateColumns: `repeat(${SIZE_GRID}, auto)` }}
      >
        {Array.from({ length: SIZE_GRID * SIZE_GRID }, (_, i) => {
          const rows = Math.floor(i / SIZE_GRID) + 1
          const cols = (i % SIZE_GRID) + 1
          const on = rows <= shown.rows && cols <= shown.cols
          return (
            <span
              key={i}
              aria-hidden
              onMouseEnter={() => setHover({ rows, cols })}
              onClick={() => onPick({ rows, cols })}
              className={cn('size-6 cursor-pointer rounded-[3px] border transition-colors duration-(--duration-instant)', on ? 'border-primary bg-primary/25' : 'border-border bg-muted')}
            />
          )
        })}
      </div>
      <p className="mt-2 text-xs text-muted-foreground" aria-hidden>
        {shown.rows > 0 ? `${shown.rows} rows × ${shown.cols} columns` : 'Click a size to add a table'}
      </p>
    </section>
  )
}

/** The row of layout tiles, also used in the table's properties. */
export function TableLayoutTiles({ value, onChange }: { value: TableLayout; onChange: (layout: TableLayout) => void }) {
  return <TileRow label="Layout" value={value} options={TABLE_LAYOUTS} picture={(id) => <LayoutPicture layout={id} />} onChange={onChange} />
}

/** The row of look tiles, also used in the table's properties. */
export function TableLookTiles({ value, onChange }: { value: TableLook; onChange: (look: TableLook) => void }) {
  return <TileRow label="Look" value={value} options={TABLE_LOOKS} picture={(id) => <LookPicture look={id} />} showNames onChange={onChange} />
}

export function TablePanel({ layout, look, onLayoutChange, onLookChange, picked, onPickSize, className }: TablePanelProps) {
  const phone = usePhoneLayout()
  return (
    <div className={cn('flex flex-col', className)}>
      <TableLayoutTiles value={layout} onChange={onLayoutChange} />
      <TableLookTiles value={look} onChange={onLookChange} />
      {phone ? <PhoneSizeGrid picked={picked} onPick={onPickSize} /> : <SizeGrid picked={picked} onPick={onPickSize} />}
    </div>
  )
}
