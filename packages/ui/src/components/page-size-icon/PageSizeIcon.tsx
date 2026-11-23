/*
 * Page size icon: a small journal page (A4, two text columns) with the figure
 * drawn on it to scale, so you can see what a size means before you pick it:
 * a single column figure sits in one column with text beside it, a double
 * column figure spans the page. Text lines flow around the figure.
 *
 * Used as the picture on the page size cards in the New figure dialog.
 */
import { cn } from '../../lib/cn'

export type PageSizeIconProps = {
  /** The figure's size in mm. */
  width: number
  height: number
  /** Dashed outline, for "Custom" before a size is typed. */
  dashed?: boolean
  className?: string
}

// The icon's page, in its own units: A4 with 6-unit margins.
const PAGE = { width: 64, height: 90 }
const MARGIN = 6
const TEXT = { x: MARGIN, y: MARGIN, width: PAGE.width - MARGIN * 2, height: PAGE.height - MARGIN * 2 }
/** A journal's full text width (double column) is about 174 mm. */
const SCALE = TEXT.width / 174
const GUTTER = 2
const COLUMN = (TEXT.width - GUTTER) / 2
const LINE_GAP = 3.6

export function PageSizeIcon({ width, height, dashed, className }: PageSizeIconProps) {
  const figure = {
    x: TEXT.x,
    y: TEXT.y,
    width: Math.min(TEXT.width, Math.max(2, width * SCALE)),
    height: Math.min(TEXT.height, Math.max(2, height * SCALE)),
  }
  const clear = 2 // Space kept free around the figure.

  // Text lines in both columns, cut where they would run into the figure.
  const lines: { x: number; y: number; width: number }[] = []
  for (let y = TEXT.y + 1; y < TEXT.y + TEXT.height - 1; y += LINE_GAP) {
    for (const start of [TEXT.x, TEXT.x + COLUMN + GUTTER]) {
      const end = start + COLUMN
      const blocked = y > figure.y - clear && y < figure.y + figure.height + clear
      const segments = blocked ? [[Math.max(start, figure.x + figure.width + clear), end]] : [[start, end]]
      for (const [from = 0, to = 0] of segments) if (to - from >= 4) lines.push({ x: from, y, width: to - from })
    }
  }

  return (
    <svg viewBox={`0 0 ${PAGE.width} ${PAGE.height}`} aria-hidden="true" className={cn('h-auto w-full', className)}>
      <rect x={0.5} y={0.5} width={PAGE.width - 1} height={PAGE.height - 1} rx={1.5} className="fill-white stroke-border-strong" />
      {lines.map((line) => (
        <rect key={`${line.x}-${line.y}`} x={line.x} y={line.y} width={line.width} height={0.9} rx={0.45} fill="#d4d4d8" />
      ))}
      <rect
        x={figure.x}
        y={figure.y}
        width={figure.width}
        height={figure.height}
        rx={1}
        strokeDasharray={dashed ? '2 1.5' : undefined}
        className={cn('stroke-primary', dashed ? 'fill-transparent' : 'fill-primary/20')}
      />
    </svg>
  )
}
