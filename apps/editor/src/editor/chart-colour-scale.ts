/**
 * Colour by value, for any chart: a colour scale fitted to a range of values
 * (worked out from the data, or typed), the text colour that reads on a
 * colour, and a colour bar (the scale as a strip with ticks and a title) to
 * draw beside a chart. Heatmaps use it now; XY charts colouring their dots by
 * a third value can use the same pieces.
 *
 *   const scale = colourScale({ scale: 'blue-red', min: null, max: null }, values)
 *   scale.colour(0.4)                 // a light red
 *   textColourOn(scale.colour(0.9))   // '#ffffff' on the dark red
 *   const bar = colourBar(scale, { height: 120, size: 10, font, ink: '#000', title: 'Pearson r', measure })
 *   bar.width                         // room to keep for it
 *   bar.draw({ x, y })                // rects, lines and texts, as in a ChartDrawing
 *
 * The colour stops themselves are data in packages/ui (`colour-scales`), shared
 * with the colour-scale picker.
 */
import { colourAt, colourScaleInfo, isTwoSided, type ColourScaleId } from '@biofigure-lab/ui/lib/colour-scales'

import { niceTicks, type ChartDrawing, type ChartText, type Measure } from './chart-model'

export { COLOUR_SCALES, colourAt, isTwoSided, type ColourScaleId } from '@biofigure-lab/ui/lib/colour-scales'

/** Which scale, and its range: null ends are worked out from the values. */
export type ColourScaleSpec = {
  scale: ColourScaleId
  min: number | null
  max: number | null
  /** Two-sided scales: the value at the neutral middle (0 by default). */
  centre?: number
  /** Two-sided scales: the range reaches as far below the centre as above it (on by default). */
  symmetric?: boolean
}

/** A scale fitted to its range. */
export type ColourScale = {
  id: ColourScaleId
  min: number
  max: number
  /** Two-sided scales only. */
  centre?: number
  /** A value's colour; values past the ends keep the end colour. Empty values get `EMPTY_FILL`. */
  colour: (value: number | null | undefined) => string
  /** Tidy tick values inside the range, about `count` of them. */
  ticks: (count?: number) => number[]
}

/** The neutral grey of a cell (or dot) with no value. */
export const EMPTY_FILL = '#e4e4e7'

const finite = (values: readonly (number | null | undefined)[]) => values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))

/**
 * Fits a scale to its values. Auto ends take the smallest and largest value
 * (or `auto`, when given, such as -1 and 1 for correlations). A two-sided
 * scale keeps its centre in the middle: symmetric (the default), its ends sit
 * as far from the centre on both sides, the further of the two; otherwise each
 * side runs from the centre to its own end.
 */
export function colourScale(spec: ColourScaleSpec, values: readonly (number | null | undefined)[], auto?: { min: number; max: number }): ColourScale {
  const numbers = finite(values)
  const twoSided = isTwoSided(spec.scale)
  const centre = spec.centre ?? 0
  let min = spec.min ?? auto?.min ?? (numbers.length ? Math.min(...numbers) : 0)
  let max = spec.max ?? auto?.max ?? (numbers.length ? Math.max(...numbers) : 1)
  if (min > max) [min, max] = [max, min]
  if (twoSided && spec.symmetric !== false) {
    const reach = Math.max(Math.abs(max - centre), Math.abs(min - centre)) || 1
    min = centre - reach
    max = centre + reach
  }
  if (twoSided) {
    // Both ends must lie either side of the centre for the middle to mean anything.
    min = Math.min(min, centre - 1e-9)
    max = Math.max(max, centre + 1e-9)
  }
  if (!(max > min)) max = min + 1
  const position = (value: number) => {
    if (!twoSided) return (value - min) / (max - min)
    // Each side has its own stretch, so the centre is always the middle colour.
    return value <= centre ? 0.5 * ((value - min) / (centre - min)) : 0.5 + 0.5 * ((value - centre) / (max - centre))
  }
  return {
    id: spec.scale,
    min,
    max,
    ...(twoSided ? { centre } : {}),
    colour: (value) => (typeof value === 'number' && Number.isFinite(value) ? colourAt(spec.scale, position(value)) : EMPTY_FILL),
    ticks: (count = 5) => {
      const ticks = niceTicks(min, max, count).filter((t) => t >= min - 1e-9 && t <= max + 1e-9)
      return ticks.length >= 2 ? ticks : [min, max]
    },
  }
}

/** The relative luminance of a colour (WCAG), 0 for black to 1 for white. */
function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

/** Black or white, whichever has more contrast on `fill` (a #rrggbb colour), for text in a coloured cell. */
export function textColourOn(fill: string): '#000000' | '#ffffff' {
  const l = luminance(fill)
  // Contrast with black is (l + 0.05) / 0.05, with white 1.05 / (l + 0.05).
  return (l + 0.05) / 0.05 >= 1.05 / (l + 0.05) ? '#000000' : '#ffffff'
}

/** A number for a tick or a cell: at most `decimals` places, no trailing zeros for ticks. */
export const formatValue = (value: number, decimals: number) => {
  const text = value.toFixed(Math.max(0, Math.min(decimals, 6)))
  // "-0.00" reads oddly: a value that rounds to zero is just zero.
  return /^-0(\.0+)?$/.test(text) ? text.slice(1) : text
}
const formatTick = (value: number) => String(Number(value.toPrecision(6)))

export type ColourBarStyle = {
  /** How tall the strip is, in chart pixels. */
  height: number
  /** The text size of the ticks; the title is a point larger. */
  size: number
  font: string
  /** Colour of the outline, ticks and text. */
  ink: string
  /** Stands along the bar's right, reading upward; empty for none. */
  title: string
  measure: Measure
}

/** How many slices the strip is drawn in: enough to look smooth, few enough to stay a small, plain-vector export. */
const SLICES = 48

/**
 * A vertical colour bar for a scale: the strip (high end at the top), a thin
 * outline, ticks with their numbers on its right, and its title standing
 * beside them. `width` is all the room it takes; `draw` places it with its
 * top-left corner at a point.
 */
export function colourBar(scale: ColourScale, style: ColourBarStyle): { width: number; draw: (at: { x: number; y: number }) => Pick<ChartDrawing, 'rects' | 'lines' | 'texts'> } {
  const { size, height, ink, font, measure } = style
  const strip = Math.max(size * 1.1, 6)
  const count = Math.min(Math.max(Math.floor(height / (size * 2.4)), 2), 6)
  const ticks = scale.ticks(count)
  const labelGap = 5
  const tickWidth = Math.max(0, ...ticks.map((t) => measure(formatTick(t), size, font)))
  const titleSize = size + 1
  const title = style.title.trim()
  const width = strip + labelGap + tickWidth + (title ? 4 + titleSize * 1.3 : 0)
  const draw = (at: { x: number; y: number }) => {
    const rects: ChartDrawing['rects'] = []
    const lines: ChartDrawing['lines'] = []
    const texts: ChartText[] = []
    const y = (value: number) => at.y + height - ((value - scale.min) / (scale.max - scale.min)) * height
    // Slices overlap a little, so no hairline of background shows between them on screen.
    const slice = height / SLICES
    for (let i = 0; i < SLICES; i++) {
      const value = scale.max - ((i + 0.5) / SLICES) * (scale.max - scale.min)
      rects.push({ x: at.x, y: at.y + i * slice, width: strip, height: i === SLICES - 1 ? slice : slice + 0.4, fill: scale.colour(value) })
    }
    const x2 = at.x + strip
    for (const [ax, ay, bx, by] of [[at.x, at.y, x2, at.y], [x2, at.y, x2, at.y + height], [x2, at.y + height, at.x, at.y + height], [at.x, at.y + height, at.x, at.y]] as const) lines.push({ x1: ax, y1: ay, x2: bx, y2: by, colour: ink, width: 0.5 })
    for (const t of ticks) {
      const ty = y(t)
      lines.push({ x1: x2, y1: ty, x2: x2 + 3, y2: ty, colour: ink, width: 0.75 })
      texts.push({ text: formatTick(t), x: x2 + labelGap, y: ty + size * 0.35, size, colour: ink, font, anchor: 'start', role: { kind: 'tick' } })
    }
    if (title) texts.push({ text: title, x: x2 + labelGap + tickWidth + 4 + titleSize * 0.75, y: at.y + height / 2, size: titleSize, colour: ink, font, anchor: 'middle', rotate: true, role: { kind: 'legend' } })
    return { rects, lines, texts }
  }
  return { width, draw }
}

export { colourScaleInfo }
