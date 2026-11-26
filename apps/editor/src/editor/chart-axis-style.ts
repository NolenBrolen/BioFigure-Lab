/**
 * How a chart's plot area is framed and ruled: the frame round it, grid lines
 * along the values, reference lines at typed values, which way the tick marks
 * point, and a log scale for the value axis. Every setting defaults to the look
 * charts had before they existed, so saved figures don't change.
 *
 * The value axis is the y axis of an upright graph and the bottom axis of one
 * lying down; the grid and reference lines always run across it.
 */
import type { ChartGroup } from './chart-model'

/** Open: the left and bottom axis lines. Box: all four sides of the plot. None: no lines (ticks and labels stay). */
export type ChartFrame = 'open' | 'box' | 'none'
export type GridStyle = 'solid' | 'dotted' | 'dashed'
/** A line across the plot at a value, such as y = 1 for "no change" or a cut-off, with an optional short label at its end. */
export type ReferenceLine = { value: number; style: 'solid' | 'dashed'; label: string }

export type AxisStyle = {
  frame: ChartFrame
  /** Lines across the plot at each number on the value axis, behind the data. */
  grid: 'none' | 'lines'
  gridStyle: GridStyle
  gridColour: string
  /** Whether the tick marks point out of the plot or into it. */
  ticks: 'out' | 'in'
  /** Log: ticks at powers of 10; values at or below 0 can't be shown and are left out. */
  yScale: 'linear' | 'log'
  referenceLines: ReferenceLine[]
}

/** A light grey that still shows when printed. */
export const GRID_GREY = '#d4d4d4'

export const AXIS_STYLE_DEFAULTS: AxisStyle = {
  frame: 'open',
  grid: 'none',
  gridStyle: 'solid',
  gridColour: GRID_GREY,
  ticks: 'out',
  yScale: 'linear',
  referenceLines: [],
}

/** A straight line on the chart; `dash` is its dash pattern (on, off, ... in px), none for a solid line. */
export type ChartLine = { x1: number; y1: number; x2: number; y2: number; colour: string; width: number; dash?: number[] }

export const DASHES: Record<GridStyle, number[] | undefined> = { solid: undefined, dotted: [1, 2], dashed: [4, 3] }

/**
 * What picking a frame changes: a box also turns the tick marks inward, as
 * boxed plots usually have them (one change, so one undo step). Open and None
 * leave the ticks as they are, and the ticks can still be set back to out.
 */
export const framePatch = (frame: ChartFrame): Partial<AxisStyle> => (frame === 'box' ? { frame, ticks: 'in' } : { frame })

/* Log scale */

const exponent = (value: number) => Math.floor(Math.log10(value) + 1e-9)
const clean = (value: number) => Number(value.toPrecision(12))

/** The log axis's range round the data: from the power of 10 at or under `lo` to the one at or over `hi`. */
export function logRange(lo: number, hi: number): { min: number; max: number } {
  const min = 10 ** exponent(lo)
  const top = Math.ceil(Math.log10(hi) - 1e-9)
  return { min: clean(min), max: clean(10 ** Math.max(top, exponent(lo) + 1)) }
}

/**
 * Ticks on a log axis from `min` to `max`: each power of 10, with 2 and 5
 * between when the range spans two decades or fewer. A wide range gets every
 * second (third...) power, about `count` of them, so they never crowd.
 */
export function logTicks(min: number, max: number, count = 5): number[] {
  const lo = exponent(min)
  const hi = Math.ceil(Math.log10(max) - 1e-9)
  const decades = hi - lo
  const step = Math.max(1, Math.ceil(decades / Math.max(count, 2)))
  const between = decades <= 2 && count >= 4 ? [1, 2, 5] : [1]
  const ticks: number[] = []
  for (let e = lo; e <= hi; e += step) for (const m of between) ticks.push(clean(m * 10 ** e))
  const inside = ticks.filter((t) => t >= min * (1 - 1e-9) && t <= max * (1 + 1e-9))
  return inside.length >= 2 ? inside : [clean(min), clean(max)]
}

const SUPERSCRIPT: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' }
const power = (e: number) => `10${String(e).replace(/./g, (c) => SUPERSCRIPT[c] ?? c)}`

/**
 * How the numbers on a value axis read. Linear: plain numbers. Log: plain
 * decimals (0.01, 0.1, 1, 10) while they stay short, or powers (10⁻³, 10², 2×10⁴)
 * once the axis reaches past 0.001 or 10 000.
 */
export function tickFormatter(ticks: number[], log: boolean): (value: number) => string {
  const plain = (value: number) => String(Number(value.toPrecision(6)))
  if (!log) return plain
  const exponents = ticks.filter((t) => t > 0).map(exponent)
  const wide = Math.min(...exponents) < -3 || Math.max(...exponents) > 4
  if (!wide) return plain
  return (value) => {
    const e = exponent(value)
    const m = Number((value / 10 ** e).toPrecision(3))
    return m === 1 ? power(e) : `${m}×${power(e)}`
  }
}

/** Where a value sits along an axis from min to max, as a share of its length (0 at min); values outside are held at its ends. */
export function axisShare(value: number, axis: { min: number; max: number }, log: boolean): number {
  const v = Math.min(Math.max(value, axis.min), axis.max)
  if (!log) return (v - axis.min) / (axis.max - axis.min)
  return (Math.log10(v) - Math.log10(axis.min)) / (Math.log10(axis.max) - Math.log10(axis.min))
}

/** The groups with every value a log axis can't show (at or below 0) left empty. */
export const positiveOnly = (groups: ChartGroup[]): ChartGroup[] => groups.map((g) => ({ ...g, values: g.values.map((v) => (v !== null && v > 0 ? v : null)) }))

/** How many values a log axis leaves out, for the panel's note. */
export const hiddenOnLog = (chart: { yScale?: AxisStyle['yScale']; groups: ChartGroup[] }): number =>
  chart.yScale === 'log' ? chart.groups.reduce((n, g) => n + g.values.filter((v) => v !== null && Number.isFinite(v) && v <= 0).length, 0) : 0

/* Lines round and across the plot */

type Plot = { left: number; top: number; w: number; h: number }

/** The frame's lines round the plot: open draws the left and bottom sides, a box all four, none nothing. */
export function frameLines(frame: ChartFrame, p: Plot, colour: string): ChartLine[] {
  if (frame === 'none') return []
  const open: ChartLine[] = [
    { x1: p.left, y1: p.top, x2: p.left, y2: p.top + p.h, colour, width: 1 },
    { x1: p.left, y1: p.top + p.h, x2: p.left + p.w, y2: p.top + p.h, colour, width: 1 },
  ]
  if (frame === 'open') return open
  return [...open, { x1: p.left, y1: p.top, x2: p.left + p.w, y2: p.top, colour, width: 1 }, { x1: p.left + p.w, y1: p.top, x2: p.left + p.w, y2: p.top + p.h, colour, width: 1 }]
}

/**
 * Grid lines at the value axis's ticks, across the plot: level on an upright
 * graph, standing on one lying down. `at` gives a tick's place along the
 * values (0 at the axis's low end, growing away from it). None sits on a
 * frame line, where it would only thicken it.
 */
export function gridLines(style: AxisStyle, p: Plot, ticks: number[], at: (value: number) => number, horizontal: boolean): ChartLine[] {
  if (style.grid === 'none') return []
  const length = horizontal ? p.w : p.h
  const dash = DASHES[style.gridStyle]
  return ticks.flatMap((t) => {
    const along = at(t)
    if ((style.frame !== 'none' && along < 0.5) || (style.frame === 'box' && along > length - 0.5)) return []
    const line: ChartLine = horizontal
      ? { x1: p.left + along, y1: p.top, x2: p.left + along, y2: p.top + p.h, colour: style.gridColour, width: 0.75 }
      : { x1: p.left, y1: p.top + p.h - along, x2: p.left + p.w, y2: p.top + p.h - along, colour: style.gridColour, width: 0.75 }
    return [dash ? { ...line, dash } : line]
  })
}
