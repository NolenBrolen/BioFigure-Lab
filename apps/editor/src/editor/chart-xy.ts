/**
 * XY charts: every point has a real numeric x and y, such as a time course,
 * a dose-response curve, a QQ plot, a scree plot or a map of sites by
 * longitude and latitude. The data is kept like every chart's (one group per
 * column, a value per row): the first column holds the x values and every
 * other column is a series of y values. One column may instead colour the
 * dots by its value, with a colour bar (chart-colour-scale, shared with the
 * heatmap). The XY settings live in `xy`.
 *
 * `xy` draws the dots; `xy-line` also joins each series' dots in order of x.
 * Both axes can be log; the grid runs both ways (group charts only have lines
 * across, on purpose); an optional y = x line helps read QQ plots.
 *
 * Drawn from the same plain shapes as the other charts (see chart-model), so
 * it stays vector in SVG and PDF export.
 */
import type { ColourScaleId } from '@biofigure-lab/ui/lib/colour-scales'
import { isXy } from '@biofigure-lab/ui/lib/graph-kinds'

import { axisShare, DASHES, frameLines, gridLines, logRange, logTicks, tickFormatter } from './chart-axis-style'
import { colourBar, colourScale, type ColourScale } from './chart-colour-scale'
import { DOT_RADIUS, fitText, groupColour, MIN_TEXT, niceTicks, yLabel, type ChartData, type ChartDrawing, type ChartText, type DotShape, type Measure, type TextRole } from './chart-model'
import { DEFAULT_FONT, fontByName, fontStack } from './fonts'

/** How one series' dots look: their shape, and filled with its colour or open (white inside, outlined). */
export type XyMarker = { shape: DotShape; filled: boolean }

export type XySettings = {
  xScale: 'linear' | 'log'
  /** The x axis range; null works it out from the data. */
  xMin: number | null
  xMax: number | null
  /** A dashed y = x line across the plot, for QQ plots and method comparisons. */
  identityLine: boolean
  /** One per y column, by its place after the x column (column 1 is series 0); missing ones take `markerFor`'s default. */
  markers: XyMarker[]
  /** The column (group index, 1 or more) whose values colour the dots, or null for each series' own colour. */
  colourBy: number | null
  /** The colour scale and its range, when colouring by a column. */
  scale: ColourScaleId
  min: number | null
  max: number | null
  centre: number
  symmetric: boolean
}

export const DOT_SHAPES: readonly DotShape[] = ['circle', 'square', 'triangle', 'diamond']

export const XY_DEFAULTS: XySettings = {
  xScale: 'linear',
  xMin: null,
  xMax: null,
  identityLine: false,
  markers: [],
  colourBy: null,
  scale: 'viridis',
  min: null,
  max: null,
  centre: 0,
  symmetric: true,
}

/** A chart's XY settings, with any it predates filled in. */
export const xySettings = (chart: Pick<ChartData, 'xy'>): XySettings => ({ ...XY_DEFAULTS, ...chart.xy })

/** A series' dot: as set, or the next shape in turn (filled), so several series start out different. */
export const markerFor = (settings: XySettings, series: number): XyMarker => settings.markers[series] ?? { shape: DOT_SHAPES[series % DOT_SHAPES.length] ?? 'circle', filled: true }

/** The colour-by column, when it is a real y column. */
export function colourColumn(chart: ChartData): number | null {
  const c = xySettings(chart).colourBy
  return c !== null && c >= 1 && c < chart.groups.length ? c : null
}

/** The numbers and names a new XY chart starts with: a response over time for two treatments. */
export function xyStart(): Pick<ChartData, 'groups' | 'xTitle' | 'yTitle' | 'legend' | 'xy'> {
  return {
    groups: [
      { name: 'Time (h)', values: [0, 1, 2, 4, 8, 12, 24] },
      { name: 'Control', values: [1.0, 1.4, 2.1, 3.0, 4.2, 4.9, 5.3] },
      { name: 'Drug A', values: [1.0, 1.1, 1.3, 1.8, 2.2, 2.5, 2.6] },
    ],
    xTitle: 'Time (h)',
    yTitle: 'Response',
    legend: true,
    xy: { ...XY_DEFAULTS, markers: [{ shape: 'circle', filled: true }, { shape: 'square', filled: false }] },
  }
}

/** The grey that marks the x column in the data table: it is not a series, so it has no colour of its own. */
const X_COLUMN = '#a1a1aa'

/** The colour over each column of the data table: an XY chart's x column is grey and each y column has its series' colour. */
export const tableColours = (chart: ChartData): string[] => (isXy(chart.kind) ? chart.groups.map((_, group) => (group === 0 ? X_COLUMN : groupColour(chart, group - 1))) : chart.colours)

/* The numbers */

export type XyPoint = { x: number; y: number; row: number }
export type XySeries = { group: number; name: string; colour: string; marker: XyMarker; points: XyPoint[] }

const finite = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v)

/** Every y column but the colour-by one, with the rows where it and x both have a number (over 0 on a log axis). */
export function xySeries(chart: ChartData): XySeries[] {
  const s = xySettings(chart)
  const xs = chart.groups[0]?.values ?? []
  const colourBy = colourColumn(chart)
  const usable = (x: number, y: number) => (s.xScale !== 'log' || x > 0) && (chart.yScale !== 'log' || y > 0)
  return chart.groups.flatMap((g, group) => {
    if (group === 0 || group === colourBy) return []
    const points: XyPoint[] = []
    g.values.forEach((y, row) => {
      const x = xs[row]
      if (finite(x) && finite(y) && usable(x, y)) points.push({ x, y, row })
    })
    return [{ group, name: g.name, colour: groupColour(chart, group - 1), marker: markerFor(s, group - 1), points }]
  })
}

/** How many points a log axis leaves out (x or y at or below 0), for the panel's note. */
export function hiddenOnXyLog(chart: ChartData): number {
  const s = xySettings(chart)
  if (s.xScale !== 'log' && chart.yScale !== 'log') return 0
  const xs = chart.groups[0]?.values ?? []
  const colourBy = colourColumn(chart)
  let hidden = 0
  chart.groups.forEach((g, group) => {
    if (group === 0 || group === colourBy) return
    g.values.forEach((y, row) => {
      const x = xs[row]
      if (finite(x) && finite(y) && ((s.xScale === 'log' && x <= 0) || (chart.yScale === 'log' && y <= 0))) hidden++
    })
  })
  return hidden
}

export type XyAxis = { min: number; max: number; ticks: number[]; log: boolean }

/** One axis's range and ticks from its values, unless typed: tidy steps on a linear axis, powers of 10 on a log one. */
function axisFor(values: number[], typedMin: number | null, typedMax: number | null, log: boolean, count: number): XyAxis {
  if (log) {
    const tMin = typedMin !== null && typedMin > 0 ? typedMin : null
    const tMax = typedMax !== null && typedMax > 0 ? typedMax : null
    const positive = values.filter((v) => v > 0)
    const lo = positive.length ? Math.min(...positive) : 1
    const hi = positive.length ? Math.max(...positive) : 10
    const auto = logRange(tMin ?? lo, tMax ?? hi)
    const min = tMin ?? auto.min
    const max = tMax ?? auto.max
    if (!(max > min)) return { min, max: min * 10, ticks: [min, min * 10], log }
    return { min, max, ticks: logTicks(min, max, count), log }
  }
  let lo = values.length ? Math.min(...values) : 0
  let hi = values.length ? Math.max(...values) : 1
  // Positive data close to zero starts the axis at zero, as on group charts; data far from it (such as latitudes) keeps its own range.
  if (lo >= 0 && lo < hi * 0.3) lo = 0
  if (!(hi > lo)) hi = lo + 1
  const auto = niceTicks(typedMin ?? lo, typedMax ?? hi, count)
  const min = typedMin ?? auto[0] ?? 0
  const max = typedMax ?? auto.at(-1) ?? 1
  if (!(max > min)) return { min, max: min + 1, ticks: [min, min + 1], log }
  return { min, max, ticks: niceTicks(min, max, count).filter((t) => t >= min - 1e-9 && t <= max + 1e-9), log }
}

/** Both axes: x from the x values of the points drawn, y from their y values and the reference lines. */
export function xyAxes(chart: ChartData, xCount = 5, yCount = 5): { x: XyAxis; y: XyAxis } {
  const s = xySettings(chart)
  const points = xySeries(chart).flatMap((series) => series.points)
  const refs = (chart.referenceLines ?? []).map((r) => r.value).filter((v) => Number.isFinite(v) && (chart.yScale !== 'log' || v > 0))
  return {
    x: axisFor(points.map((p) => p.x), s.xMin, s.xMax, s.xScale === 'log', xCount),
    y: axisFor([...points.map((p) => p.y), ...refs], chart.yMin, chart.yMax, chart.yScale === 'log', yCount),
  }
}

/** The colour scale for the colour-by column, fitted to the values of the points drawn. */
export function xyColourScale(chart: ChartData): ColourScale | undefined {
  const column = colourColumn(chart)
  if (column === null) return undefined
  const s = xySettings(chart)
  const values = chart.groups[column]?.values ?? []
  const rows = new Set(xySeries(chart).flatMap((series) => series.points.map((p) => p.row)))
  return colourScale({ scale: s.scale, min: s.min, max: s.max, centre: s.centre, symmetric: s.symmetric }, values.filter((_, row) => rows.has(row)))
}

/* Drawing */

const LINE = 1.2

/**
 * An XY chart's picture: the y axis (numbers and title) on the left, the x
 * axis under the plot, the legend and the colour bar on the right, the
 * chart's name and the text under it as in every chart. Points outside a
 * typed range are left out rather than piled on the frame.
 */
export function drawXy(chart: ChartData, measure: Measure): ChartDrawing {
  const s = xySettings(chart)
  const series = xySeries(chart)
  const scale = xyColourScale(chart)
  const colourBy = colourColumn(chart)
  const font = fontStack(fontByName(chart.fontFamily) ?? DEFAULT_FONT)
  const size = chart.fontSize
  const titleSize = size + 1
  const headSize = size + 3
  const ink = chart.axisColour
  const width = (line: string, sz: number) => measure(line, sz, font)
  const d: Omit<ChartDrawing, 'plot' | 'horizontal' | 'crowded' | 'columns'> = { rects: [], lines: [], gridLines: [], polylines: [], polygons: [], dots: [], texts: [] }
  const text = (t: Omit<ChartText, 'size' | 'colour' | 'font'> & { size?: number }) => d.texts.push({ size, colour: ink, font, ...t })
  const floor = (sz: number) => Math.min(sz, Math.max(MIN_TEXT, sz * 0.7))
  const titleDepth = (fit: { size: number; lines: string[] }) => (fit.lines.length ? fit.size * 0.6 + fit.lines.length * fit.size * LINE : 0)

  const head = fitText(chart.title.trim(), chart.width, headSize, floor(headSize), (line, sz) => measure(line, sz, font, true))
  const headBlock = head.lines.length ? headSize * 0.4 + head.lines.length * head.size * LINE : 0
  const captionSize = size - 1
  const captionLines = chart.caption.trim() ? fitText(chart.caption.trim(), chart.width, captionSize, captionSize, width).lines : []
  const captionBlock = captionLines.length ? captionLines.length * captionSize * 1.35 + captionSize * 0.4 : 0
  const top = size * 0.8 + (chart.titlePosition === 'top' ? headBlock : 0)
  const bottomExtra = (chart.titlePosition === 'bottom' ? headBlock : 0) + captionBlock
  const tickDepth = chart.tickLabels ? 6 + size * 1.25 : 6

  // The legend: each series' dot and name, down the right from the plot's top.
  const legend = chart.legend && series.length > 0
  const legendItemWidth = legend ? Math.max(0, ...series.map((sr) => width(sr.name, size))) + size * 1.6 : 0
  const legendBlock = legend ? series.length * size * 1.6 + size * 0.4 : 0

  /** The layout for a guess of the plot's size: how many numbers each axis gets, and the room their labels take. */
  const plan = (guess: { w: number; h: number }) => {
    let yCount = 5
    while (yCount > 2 && guess.h / yCount < size * 2.2) yCount--
    const xLabelRoom = (count: number) => {
      const axis = xyAxes(chart, count, yCount).x
      const format = tickFormatter(axis.ticks, axis.log)
      return Math.max(size, ...axis.ticks.map((t) => width(format(t), size))) * 1.6
    }
    let xCount = 5
    while (xCount > 2 && guess.w / xCount < xLabelRoom(xCount)) xCount--
    const axes = xyAxes(chart, xCount, yCount)
    const formatX = tickFormatter(axes.x.ticks, axes.x.log)
    const formatY = tickFormatter(axes.y.ticks, axes.y.log)
    const yTickWidth = chart.tickLabels ? Math.max(0, ...axes.y.ticks.map((t) => width(formatY(t), size))) : 0
    const xEnds = chart.tickLabels ? axes.x.ticks.map((t) => width(formatX(t), size) / 2) : [0]
    const yFit = fitText(yLabel(chart), Math.max(guess.h, 20), titleSize, floor(titleSize), width, 2)
    const xFit = fitText(chart.xTitle, Math.max(guess.w, 20), titleSize, floor(titleSize), width, 2)
    const bar = scale ? colourBar(scale, { height: Math.max(guess.h - legendBlock, 30), size, font, ink, title: chart.groups[colourBy ?? 0]?.name ?? '', measure }) : undefined
    const side = Math.max(legendItemWidth, bar?.width ?? 0)
    // The last x number reaches half its width past the plot's right end.
    const right = Math.max(side ? side + size * 1.2 : size, (xEnds.at(-1) ?? 0) + 2)
    const left = Math.max(titleDepth(yFit) + yTickWidth + 8, (xEnds[0] ?? 0) + 2)
    const w = Math.max(chart.width - left - right, 20)
    const h = Math.max(chart.height - top - tickDepth - titleDepth(xFit) - bottomExtra, 20)
    return { axes, formatX, formatY, yFit, xFit, bar, left, w, h }
  }
  let layout = plan({ w: chart.width * 0.7, h: chart.height * 0.6 })
  for (let round = 0; round < 3; round++) {
    const next = plan({ w: layout.w, h: layout.h })
    const settled = Math.abs(next.w - layout.w) < 0.5 && Math.abs(next.h - layout.h) < 0.5
    layout = next
    if (settled) break
  }
  const { axes, formatX, formatY, yFit, xFit, bar, left, w, h } = layout
  const plot = { left, top, w, h }
  const alongX = (v: number) => axisShare(v, axes.x, axes.x.log) * w
  const alongY = (v: number) => axisShare(v, axes.y, axes.y.log) * h
  const px = (v: number) => left + alongX(v)
  const py = (v: number) => top + h - alongY(v)
  const inside = (v: number, axis: XyAxis) => v >= axis.min - Math.abs(axis.min) * 1e-9 - 1e-12 && v <= axis.max + Math.abs(axis.max) * 1e-9 + 1e-12

  // Frame, the grid both ways (behind the data), and the tick marks out of or into the plot.
  d.lines.push(...frameLines(chart.frame, plot, ink))
  d.gridLines.push(...gridLines(chart, plot, axes.y.ticks, alongY, false), ...gridLines(chart, plot, axes.x.ticks, alongX, true))
  const tick = chart.ticks === 'in' ? -4 : 4
  for (const t of axes.y.ticks) {
    d.lines.push({ x1: left - tick, y1: py(t), x2: left, y2: py(t), colour: ink, width: 1 })
    if (chart.tickLabels) text({ text: formatY(t), x: left - 6, y: py(t) + size * 0.35, anchor: 'end', role: { kind: 'tick' } })
  }
  for (const t of axes.x.ticks) {
    d.lines.push({ x1: px(t), y1: top + h, x2: px(t), y2: top + h + tick, colour: ink, width: 1 })
    if (chart.tickLabels) text({ text: formatX(t), x: px(t), y: top + h + 6 + size, anchor: 'middle', role: { kind: 'tick' } })
  }

  // Axis titles: the y title standing at the left edge (placed along the axis as set), the x title under the numbers.
  yFit.lines.forEach((line, i) => {
    const along = width(line, yFit.size) / 2
    const ly = chart.yTitleAlign === 'left' ? top + h - along : chart.yTitleAlign === 'right' ? top + along : top + h / 2
    text({ text: line, x: yFit.size * (0.9 + i * LINE), y: ly, size: yFit.size, anchor: 'middle', rotate: true, role: { kind: 'yTitle' } })
  })
  xFit.lines.forEach((line, i) => text({ text: line, x: left + w / 2, y: top + h + tickDepth + xFit.size * (0.35 + (i + 1) * LINE), size: xFit.size, anchor: 'middle', role: { kind: 'xTitle' } }))

  // The y = x line, over the part of the plot where both axes reach. With one axis log and the other not, it bends, so it is drawn in short steps.
  if (s.identityLine) {
    const lo = Math.max(axes.x.min, axes.y.min)
    const hi = Math.min(axes.x.max, axes.y.max)
    if (hi > lo) {
      const steps = axes.x.log === axes.y.log ? 1 : 48
      const value = (k: number) => (axes.x.log ? lo * (hi / lo) ** (k / steps) : lo + ((hi - lo) * k) / steps)
      const points = Array.from({ length: steps + 1 }, (_, k) => ({ x: px(value(k)), y: py(value(k)) }))
      d.polylines.push({ points, colour: ink, width: 1, dash: DASHES.dashed })
    }
  }

  // Each series: its line (xy-line) in order of x, then its dots on top.
  for (const sr of series) {
    const shown = sr.points.filter((p) => inside(p.x, axes.x) && inside(p.y, axes.y))
    if (chart.kind === 'xy-line' && shown.length > 1) d.polylines.push({ points: [...shown].sort((a, b) => a.x - b.x).map((p) => ({ x: px(p.x), y: py(p.y) })), colour: sr.colour, width: 1.5 })
    const valueOf = (row: number) => (colourBy === null ? undefined : chart.groups[colourBy]?.values[row])
    for (const p of shown) {
      const colour = scale ? scale.colour(valueOf(p.row)) : sr.colour
      d.dots.push({ x: px(p.x), y: py(p.y), r: DOT_RADIUS, shape: sr.marker.shape, ...(sr.marker.filled ? { fill: colour } : { fill: '#ffffff', stroke: colour }) })
    }
  }

  // Reference lines across the plot at y values, with their labels at the right end.
  chart.referenceLines.forEach((ref, i) => {
    if (!Number.isFinite(ref.value) || !inside(ref.value, axes.y) || (axes.y.log && ref.value <= 0)) return
    const y = py(ref.value)
    d.lines.push({ x1: left, y1: y, x2: left + w, y2: y, colour: ink, width: 1, ...(ref.style === 'dashed' ? { dash: DASHES.dashed } : {}) })
    const name = ref.label.trim()
    if (name) text({ text: name, x: left + w - 2, y: y - 3, size: size - 1, anchor: 'end', role: { kind: 'reference', index: i } })
  })

  // Right of the plot: the legend from the top, the colour bar under it.
  const sideX = left + w + size * 1.2
  if (legend)
    series.forEach((sr, i) => {
      const ly = top + size * 0.6 + i * size * 1.6
      // Coloured by a value, the series are told apart by shape alone, so their legend dots are in the axis colour.
      const colour = scale ? ink : sr.colour
      d.dots.push({ x: sideX + DOT_RADIUS, y: ly, r: DOT_RADIUS, shape: sr.marker.shape, ...(sr.marker.filled ? { fill: colour } : { fill: '#ffffff', stroke: colour }) })
      text({ text: sr.name, x: sideX + size * 1.3, y: ly + size * 0.35, anchor: 'start', role: { kind: 'group', index: sr.group } })
    })
  if (bar) {
    const drawn = bar.draw({ x: sideX, y: top + legendBlock })
    d.rects.push(...drawn.rects)
    d.lines.push(...drawn.lines)
    // The bar's title is the colour column's name, so a double-click on it renames that column.
    d.texts.push(...drawn.texts.map((t): ChartText => (t.rotate && colourBy !== null ? { ...t, role: { kind: 'group', index: colourBy } satisfies TextRole } : t)))
  }

  if (head.lines.length) {
    const tx = chart.titleAlign === 'left' ? 0 : chart.titleAlign === 'right' ? chart.width : chart.width / 2
    const ty = chart.titlePosition === 'top' ? head.size : top + h + tickDepth + titleDepth(xFit) + head.size * 1.3
    const anchor = chart.titleAlign === 'left' ? 'start' : chart.titleAlign === 'right' ? 'end' : 'middle'
    head.lines.forEach((line, i) => text({ text: line, x: tx, y: ty + i * head.size * LINE, size: head.size, bold: true, anchor, role: { kind: 'title' } }))
  }
  const captionTop = chart.height - captionLines.length * captionSize * 1.35
  const captionX = chart.captionAlign === 'left' ? 0 : chart.captionAlign === 'right' ? chart.width : chart.width / 2
  const captionAnchor = chart.captionAlign === 'left' ? 'start' : chart.captionAlign === 'right' ? 'end' : 'middle'
  captionLines.forEach((line, i) => text({ text: line, x: captionX, y: captionTop + captionSize * (1 + i * 1.35), size: captionSize, anchor: captionAnchor, role: { kind: 'caption' } }))

  return { ...d, plot: { left, top, width: w, height: h, band: 0 }, horizontal: false, crowded: false, columns: [] }
}
