/**
 * A chart as plain data, and everything you can do to it: read a block pasted
 * from a spreadsheet, work out means and error bars, and draw it (on the
 * canvas and as SVG). Every change returns a new chart, so undo can keep the
 * old one as it is. Sizes are in page pixels; the chart's own space starts at
 * its top-left corner.
 *
 * Drawn by our own code rather than a charting library: three chart kinds
 * need only a few lines, rectangles, dots and labels, and drawing them
 * ourselves keeps them sharp on the canvas and vector in SVG and PDF export.
 */
import type { ErrorBars } from '@biofigure-lab/ui/components/graph-panel/GraphPanel'
import { isHeatmap, isHorizontal, isXy, startsAtZero, uprightKind, usesErrorBars, usesSpread, type ChartKind } from '@biofigure-lab/ui/lib/graph-kinds'
import { jStat } from 'jstat'

import { AXIS_STYLE_DEFAULTS, axisShare, DASHES, frameLines, gridLines, logRange, logTicks, positiveOnly, tickFormatter, type AxisStyle, type ChartLine } from './chart-axis-style'
import { comboOf, comboStart, isCombo, lineChart, lineLabel, type ComboLine } from './chart-combo'
import { beeswarm, boxStats, quantile, tint, violinProfile } from './chart-distribution'
import { drawHeatmap, heatmapStart, type HeatmapSettings } from './chart-heatmap'
import { runTest, stars, type Correction, type StatTest } from './chart-stats'
import { markChartScripts, scriptMeasure, scriptSpans, type ChartTextStyles, type ScriptRun } from './chart-text'
import { drawXy, xyStart, type XySettings } from './chart-xy'
import { DEFAULT_FONT, fontByName, fontStack } from './fonts'
import { mmToPx, PAGE_MARGIN_MM } from './units'

export type { ChartKind, ErrorBars, StatTest }
export type TextAlign = 'left' | 'center' | 'right'

/** One group (a column in the data table): its name and its replicate values. Empty cells are null. */
export type ChartGroup = {
  name: string
  values: (number | null)[]
  /** Sub- and superscript in the name (see chart-text.ts); groups without have none. */
  nameStyles?: ScriptRun[]
  /** Bar + line charts: the line's values for this group (its second measure). Other charts have none. */
  line?: (number | null)[]
}

/** The frame, grid, reference lines, tick direction and value scale are in `AxisStyle` (chart-axis-style.ts). */
export type ChartData = AxisStyle & {
  kind: ChartKind
  errorBars: ErrorBars
  groups: ChartGroup[]
  width: number
  height: number
  xTitle: string
  yTitle: string
  yUnit: string
  /** The y axis range; null works it out from the data. */
  yMin: number | null
  yMax: number | null
  /** Whether the numbers along the y axis and the group names along the x axis are shown. */
  tickLabels: boolean
  legend: boolean
  /** One colour per group, used in turn. */
  colours: string[]
  /** The font's name, as in the text tool. */
  fontFamily: string
  fontSize: number
  axisColour: string
  /** A name for the chart, shown above or below it. */
  title: string
  titlePosition: 'top' | 'bottom'
  titleAlign: TextAlign
  /** Where the y axis title sits along the axis: left is its low end. */
  yTitleAlign: TextAlign
  /** A line of context under the chart, such as the primers used. */
  caption: string
  captionAlign: TextAlign
  /** Bar charts: the error bar also runs down into the bar, not just up from its top. */
  errorInside: boolean
  /** How wide each bar (or its group of dots) is, as a share of its slot: the rest is space. */
  barWidth: number
  /** The significance test, drawn as stars over brackets. */
  test: StatTest
  /** Whether pairs that aren't significant get a bracket marked "ns". */
  showNs: boolean
  /** Whether the line saying which test was used is shown under the chart. */
  testNote: boolean
  /** Unpaired t-test: Welch's version, for groups that spread differently. */
  welch: boolean
  /** How p values are corrected when several comparisons are made. Missing means the test's usual one (`defaultCorrection`); a figure that saved a choice keeps it. */
  correction?: Correction
  /** One-sample tests: the value each group is tested against. */
  testValue: number
  /** Add effect sizes (Cohen's d, η²) to the line saying which test was used. */
  effectSize: boolean
  /** A dot in each group's colour at the feet of its significance brackets. */
  colouredBrackets: boolean
  /** The saved data set the numbers came from (Your data), if any. The chart keeps its own copy of the numbers. Charts made before this have none. */
  source?: { id: string; name: string; importedAt: number }
  /**
   * Set while the chart is taller than its own size because it grew to fit
   * its brackets: its own height and where its top was, and where its top was
   * left after growing (to tell whether it was moved since). It shrinks back
   * when the brackets need less room; resizing it by hand forgets this.
   */
  grown?: { height: number; top: number; grownTop: number }
  /** Heatmaps: the rows' names (a row without one is numbered) and the heatmap's own settings (see chart-heatmap). Other charts have none. */
  rowNames?: string[]
  heatmap?: HeatmapSettings
  /** XY charts: their own settings (see chart-xy). Other charts have none. */
  xy?: XySettings
  /** Sub- and superscript in the name, axis titles and caption, as the Text tool's style runs (see chart-text.ts). Charts without have plain text. */
  textStyles?: ChartTextStyles
  /** Bar + line charts: the line's title, unit, axis and colour (see chart-combo.ts). Other charts have none. */
  combo?: ComboLine
}

/** Okabe-Ito: colours most people with colour blindness can still tell apart. */
export const COLOUR_BLIND_SAFE = ['#0072B2', '#E69F00', '#009E73', '#CC79A7', '#56B4E9', '#D55E00', '#F0E442', '#000000']

export const DEFAULT_CHART_SIZE = { width: 320, height: 240 }

/**
 * The size a chart placed by a click starts at on a page of this size (both in
 * page pixels), in the shape of the area inside the page margins (4 mm in from
 * each edge), so scaling it up fills them exactly. On an empty page it fills
 * that area, its edges on the margin snap lines: the chart is the figure. On a
 * page that already has something, it starts at half the page width (at most
 * 85 mm) so it leaves room (owner's call, 2026-11-25). The text stays the same
 * size, so it reads the same in print on every page size.
 */
export function chartSizeForPage(page: { width: number; height: number }, emptyPage = true): { width: number; height: number } {
  const margin = mmToPx(PAGE_MARGIN_MM)
  const area = { width: Math.max(page.width - 2 * margin, page.width / 2), height: Math.max(page.height - 2 * margin, page.height / 2) }
  if (emptyPage) return area
  const width = Math.min(DEFAULT_CHART_SIZE.width, page.width / 2)
  return { width, height: (width * area.height) / area.width }
}

export function createChart(kind: ChartKind, errorBars: ErrorBars, size = DEFAULT_CHART_SIZE, title = 'Chart'): ChartData {
  return {
    kind,
    errorBars,
    groups: [
      { name: 'Control', values: [1.0, 1.2, 0.9, 1.1] },
      { name: 'Drug A', values: [2.1, 2.5, 1.8, 2.3] },
      { name: 'Drug B', values: [1.6, 1.4, 1.9, 1.7] },
    ],
    width: Math.max(size.width, 120),
    height: Math.max(size.height, 90),
    xTitle: '',
    yTitle: 'Fold change',
    yUnit: '',
    yMin: null,
    yMax: null,
    tickLabels: true,
    legend: false,
    colours: [...COLOUR_BLIND_SAFE],
    fontFamily: DEFAULT_FONT.name,
    fontSize: 10,
    axisColour: '#000000',
    ...CHART_DEFAULTS,
    ...(isHeatmap(kind) ? heatmapStart() : {}),
    ...(isCombo(kind) ? comboStart() : {}),
    ...(isXy(kind) ? xyStart() : {}),
    title,
  }
}

/** Settings charts made before they existed get. */
const CHART_DEFAULTS = {
  title: '',
  titlePosition: 'top',
  titleAlign: 'left',
  yTitleAlign: 'center',
  caption: '',
  captionAlign: 'left',
  errorInside: false,
  barWidth: 0.6,
  test: 'none',
  showNs: false,
  testNote: true,
  welch: true,
  testValue: 0,
  effectSize: false,
  colouredBrackets: true,
  ...AXIS_STYLE_DEFAULTS,
} satisfies Partial<ChartData>

/** A saved chart with any settings it predates filled in. */
export const withDefaults = (chart: ChartData): ChartData => ({ ...CHART_DEFAULTS, ...chart })

/** Move a group (with its colour) to another place, as when dragging it in the data editor. */
export function moveGroup(chart: ChartData, from: number, to: number): ChartData {
  if (from === to || !chart.groups[from]) return chart
  const colours = chart.groups.map((_, i) => groupColour(chart, i))
  const move = <T>(list: T[]) => {
    const next = [...list]
    const [item] = next.splice(from, 1)
    if (item !== undefined) next.splice(Math.min(Math.max(to, 0), next.length), 0, item)
    return next
  }
  return { ...chart, groups: move(chart.groups), colours: [...move(colours), ...chart.colours.slice(chart.groups.length)] }
}

export const groupColour = (chart: ChartData, index: number) => chart.colours[index % chart.colours.length] ?? '#000000'

/* Numbers */

const numbersOf = (values: (number | null)[]) => values.filter((v): v is number => v !== null && Number.isFinite(v))

export function stats(values: (number | null)[]): { mean: number; sd: number; sem: number; n: number } | undefined {
  const v = numbersOf(values)
  if (v.length === 0) return undefined
  const mean = v.reduce((a, b) => a + b, 0) / v.length
  const sd = v.length < 2 ? 0 : Math.sqrt(v.reduce((a, x) => a + (x - mean) ** 2, 0) / (v.length - 1))
  return { mean, sd, sem: sd / Math.sqrt(v.length), n: v.length }
}

const CONFIDENCE: Partial<Record<ErrorBars, number>> = { ci90: 0.9, ci95: 0.95, ci99: 0.99 }

/**
 * Where a group's error bar whisker ends (top and bottom, as values), or none.
 * SD, SEM and the confidence intervals are the mean plus and minus a distance;
 * a confidence interval's distance is the t quantile for n - 1 degrees of
 * freedom times the SEM, so it is wide for few replicates. Range, IQR and MAD
 * are not centred on the mean: the whisker keeps the mean as the bar's top but
 * runs from the smallest to the largest value (range), from the lower to the
 * upper quartile (IQR), or the median minus to plus the median absolute
 * deviation (MAD), so its two sides can differ.
 */
export function errorBounds(chart: ChartData, values: number[], s: { mean: number; sd: number; sem: number; n: number }): { low: number; high: number } | undefined {
  if (!usesErrorBars(chart.kind) || values.length === 0) return undefined
  const around = (distance: number) => ({ low: s.mean - distance, high: s.mean + distance })
  const level = CONFIDENCE[chart.errorBars]
  if (level !== undefined) return s.n < 2 ? around(0) : around(jStat.studentt.inv(1 - (1 - level) / 2, s.n - 1) * s.sem)
  switch (chart.errorBars) {
    case 'sd':
      return around(s.sd)
    case 'sem':
      return around(s.sem)
    case 'sd2':
      return around(2 * s.sd)
    case 'sem2':
      return around(2 * s.sem)
    case 'range': {
      const box = boxStats(values)!
      return { low: box.min, high: box.max }
    }
    case 'iqr': {
      const box = boxStats(values)!
      return { low: box.q1, high: box.q3 }
    }
    case 'mad': {
      const median = boxStats(values)!.median
      const mad = quantile([...values.map((v) => Math.abs(v - median))].sort((a, b) => a - b), 0.5)
      return { low: median - mad, high: median + mad }
    }
    default:
      return undefined
  }
}

/**
 * A number typed or pasted into a cell, or null for an empty or unreadable
 * one. With a point and a comma, the last one is the decimal mark and the
 * other a thousands separator ("1.234,5" and "1,234.5" are both 1234.5). A
 * lone comma is the decimal mark, as spreadsheets in many countries write
 * "1,5". A leading minus may be the real minus sign (U+2212) or a dash.
 */
export function parseNumber(text: string): number | null {
  const t = text.trim().replace(/\s/g, '').replace(/^[−‒–﹣]/, '-')
  if (!t) return null
  const comma = t.lastIndexOf(',')
  const point = t.lastIndexOf('.')
  const plain = comma >= 0 && point >= 0 ? (comma > point ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '')) : t.replace(',', '.')
  const value = Number(plain)
  return Number.isFinite(value) ? value : null
}

/**
 * Groups from a block copied out of Excel or Google Sheets (tab between
 * cells, a line per row): one group per column. A first row with any text
 * that isn't a number gives the group names.
 */
export function parsePasted(text: string): ChartGroup[] {
  const rows = text
    .replace(/\r/g, '')
    .split('\n')
    .filter((row, i, all) => row.trim() !== '' || i < all.length - 1)
  const cells = rows.map((row) => row.split(row.includes('\t') ? '\t' : /;|,(?=\D)|\s{2,}/))
  const cols = Math.max(0, ...cells.map((row) => row.length))
  const header = cells[0]?.some((cell) => cell.trim() !== '' && parseNumber(cell) === null) ?? false
  const body = header ? cells.slice(1) : cells
  return Array.from({ length: cols }, (_, c) => ({
    name: header ? (cells[0]?.[c] ?? '').trim() || `Group ${c + 1}` : `Group ${c + 1}`,
    values: body.map((row) => parseNumber(row[c] ?? '')),
  }))
}

/** Put a pasted block into the chart at a cell (row r of the values, column c), growing it as needed. */
export function pasteInto(chart: ChartData, text: string, at: { r: number; c: number } = { r: 0, c: 0 }): ChartData {
  const pasted = parsePasted(text)
  if (pasted.length === 0) return chart
  const hasNames = pasted.some((g) => !/^Group \d+$/.test(g.name))
  // A block with names pasted at the top replaces the whole table.
  if (hasNames && at.r === 0 && at.c === 0) return { ...chart, groups: pasted }
  const groups = chart.groups.map((g) => ({ ...g, values: [...g.values] }))
  pasted.forEach((p, i) => {
    const c = at.c + i
    const group = (groups[c] ??= { name: hasNames ? p.name : `Group ${c + 1}`, values: [] })
    if (hasNames) group.name = p.name
    p.values.forEach((value, j) => (group.values[at.r + j] = value))
  })
  return { ...chart, groups: evenRows(groups) }
}

/** Every group gets the same number of rows, the empty ones null. */
export function evenRows(groups: ChartGroup[]): ChartGroup[] {
  const rows = Math.max(0, ...groups.map((g) => g.values.length))
  return groups.map((g) => ({ ...g, values: Array.from({ length: rows }, (_, i) => g.values[i] ?? null) }))
}

export const rowCount = (chart: ChartData) => Math.max(0, ...chart.groups.map((g) => g.values.length))

export function setValue(chart: ChartData, c: number, r: number, text: string): ChartData {
  const groups = chart.groups.map((g, i) => (i === c ? { ...g, values: [...g.values] } : g))
  const group = groups[c]
  if (!group) return chart
  group.values[r] = parseNumber(text)
  return { ...chart, groups: evenRows(groups) }
}

export const renameGroup = (chart: ChartData, c: number, name: string): ChartData => ({ ...chart, groups: chart.groups.map((g, i) => (i === c ? { ...g, name } : g)) })

export const addGroup = (chart: ChartData): ChartData => ({
  ...chart,
  groups: [...chart.groups, { name: `Group ${chart.groups.length + 1}`, values: Array.from({ length: rowCount(chart) }, () => null) }],
})

export const removeGroup = (chart: ChartData, c: number): ChartData => ({ ...chart, groups: chart.groups.filter((_, i) => i !== c) })

export const addRow = (chart: ChartData): ChartData => ({ ...chart, groups: chart.groups.map((g) => ({ ...g, values: [...g.values, null] })) })

/** Takes row `r` out of every group; the rows under it move up. */
export const removeRow = (chart: ChartData, r: number): ChartData => ({
  ...chart,
  groups: chart.groups.map((g) => ({ ...g, values: g.values.filter((_, i) => i !== r) })),
  ...(chart.rowNames && { rowNames: chart.rowNames.filter((_, i) => i !== r) }),
})

/** Bar charts draw the error bar only outward from the bar's end, unless it is also drawn inside the bar. */
const barEndsOutward = (chart: ChartData) => ['bar', 'dots-bars', 'bar-line'].includes(uprightKind(chart.kind)) && !chart.errorInside

/** Tidy steps for an axis from lo to hi: 1, 2, 2.5 or 5 times a power of ten, about five of them. */
export function niceTicks(lo: number, hi: number, count = 5): number[] {
  if (!(hi > lo)) hi = lo + 1
  const raw = (hi - lo) / count
  const power = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? power * 10
  const first = Math.floor(lo / step + 1e-9) * step
  const last = Math.ceil(hi / step - 1e-9) * step
  const ticks: number[] = []
  for (let t = first; t <= last + step / 2; t += step) ticks.push(Number(t.toPrecision(12)))
  return ticks
}

/** The y axis's range and tick marks, from the settings or else the data (a bar chart always starts at 0). */
export function yAxis(source: ChartData, count = 5): { min: number; max: number; ticks: number[] } {
  const log = source.yScale === 'log'
  // A log axis can't show values at or below 0: they are left out, and so is any part of an error bar below 0.
  const chart = log ? { ...source, groups: positiveOnly(source.groups) } : source
  const spans = valueSpans(chart)
  // A bar + line chart whose line shares the bars' axis: the axis reaches the line's values too.
  if (isCombo(chart.kind) && !comboOf(chart).rightAxis) {
    const line = lineChart(source)
    spans.push(...valueSpans(log ? { ...line, groups: positiveOnly(line.groups) } : line))
  }
  // Reference lines stretch the range so they are always on the plot.
  spans.push(...(chart.referenceLines ?? []).map((r) => r.value).filter((value) => Number.isFinite(value)))
  if (log) return logAxis(chart, spans.filter((value) => value > 0), count)
  const fromZero = startsAtZero(chart.kind)
  let lo = Math.min(...spans, fromZero ? 0 : Infinity)
  let hi = Math.max(...spans, fromZero ? 0 : -Infinity)
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) [lo, hi] = [0, 1]
  if (lo >= 0 && !fromZero && lo < hi * 0.3) lo = 0
  const auto = niceTicks(chart.yMin ?? lo, chart.yMax ?? hi, count)
  const min = chart.yMin ?? auto[0] ?? 0
  const max = chart.yMax ?? auto.at(-1) ?? 1
  if (!(max > min)) return { min, max: min + 1, ticks: [min, min + 1] }
  return { min, max, ticks: niceTicks(min, max, count).filter((t) => t >= min - 1e-9 && t <= max + 1e-9) }
}

/** The values a chart's axis has to reach: each group's mean and error bar ends, and every value for graphs that show them. */
function valueSpans(chart: ChartData): number[] {
  return chart.groups.flatMap((g) => {
    const s = stats(g.values)
    if (!s) return []
    const bounds = errorBounds(chart, numbersOf(g.values), s)
    // A bar's whisker only goes out from the bar's end (away from zero), so only that end counts, unless it is drawn inside too.
    const ends = bounds ? (barEndsOutward(chart) ? [s.mean >= 0 ? bounds.high : bounds.low] : [bounds.low, bounds.high]) : [s.mean]
    return [...ends, s.mean, ...(usesSpread(chart.kind) ? numbersOf(g.values) : [])]
  })
}

/** A log axis's range and ticks: powers of 10 round the data, unless the range is typed (only numbers over 0 count). */
function logAxis(chart: ChartData, spans: number[], count: number): { min: number; max: number; ticks: number[] } {
  const typedMin = chart.yMin !== null && chart.yMin > 0 ? chart.yMin : null
  const typedMax = chart.yMax !== null && chart.yMax > 0 ? chart.yMax : null
  let lo = Math.min(...spans)
  let hi = Math.max(...spans)
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) [lo, hi] = [1, 10]
  const auto = logRange(typedMin ?? lo, typedMax ?? hi)
  const min = typedMin ?? auto.min
  const max = typedMax ?? auto.max
  if (!(max > min)) return { min, max: min * 10, ticks: [min, min * 10] }
  return { min, max, ticks: logTicks(min, max, count) }
}

/* Drawing */

/** What a text on the chart is, so a double-click on it can rename it. */
export type TextRole = { kind: 'group'; index: number } | { kind: 'reference'; index: number } | { kind: 'title' | 'yTitle' | 'xTitle' | 'lineTitle' | 'caption' | 'tick' | 'legend' | 'stats' }
/**
 * A text on the chart, one line each. `rotate` stands it up along the y axis, centred on (x, y);
 * `angle` tilts it (degrees, -45 rising to the right) about its anchor on the baseline at (x, y).
 */
export type ChartText = { text: string; x: number; y: number; size: number; colour: string; font: string; anchor: 'start' | 'middle' | 'end'; rotate?: boolean; angle?: number; bold?: boolean; role: TextRole }
export type ChartDrawing = {
  rects: { x: number; y: number; width: number; height: number; fill: string }[]
  lines: ChartLine[]
  /** Lines drawn behind everything else: the grid. */
  gridLines: ChartLine[]
  polylines: { points: { x: number; y: number }[]; colour: string; width: number; dash?: number[] }[]
  /** Closed shapes with a soft fill and an outline, such as violins. */
  polygons: { points: { x: number; y: number }[]; fill: string; stroke: string; width: number }[]
  /** Round unless `shape` says otherwise (XY charts' dots). */
  dots: ChartDot[]
  texts: ChartText[]
  /** The plotting area and each group's slot (its width along the groups' axis), for the spacing handles. */
  plot: { left: number; top: number; width: number; height: number; band: number }
  /** The graph lies down: groups run down the side, so the spacing and width handles drag up and down. */
  horizontal: boolean
  /** The significance brackets squash the plot (under a quarter of the chart along the values); the Statistics panel says how to make room. */
  crowded: boolean
  /** The box each group's column covers (its bar, its dots, or its point and error bar), for the column-width handles. */
  columns: ({ x: number; y: number; width: number; height: number } | undefined)[]
}

/** The shapes a dot can take. Triangles and diamonds reach a little further than `r` so they look as heavy as a circle. */
export type DotShape = 'circle' | 'square' | 'triangle' | 'diamond'
export type ChartDot = { x: number; y: number; r: number; fill: string; stroke?: string; shape?: DotShape }

/** The corners of a dot that isn't round, for drawing it as a polygon; undefined for a circle. */
export function dotCorners(dot: ChartDot): { x: number; y: number }[] | undefined {
  const { x, y, r } = dot
  if (dot.shape === 'square') {
    const a = r * 0.9
    return [{ x: x - a, y: y - a }, { x: x + a, y: y - a }, { x: x + a, y: y + a }, { x: x - a, y: y + a }]
  }
  if (dot.shape === 'triangle') {
    const t = r * 1.3
    return [{ x, y: y - t }, { x: x + t * 0.95, y: y + t * 0.6 }, { x: x - t * 0.95, y: y + t * 0.6 }]
  }
  if (dot.shape === 'diamond') {
    const a = r * 1.25
    return [{ x, y: y - a }, { x: x + a, y }, { x, y: y + a }, { x: x - a, y }]
  }
  return undefined
}

/** How wide a text is in its font: the canvas measures it, tests use an estimate. */
export type Measure = (text: string, size: number, font: string, bold?: boolean) => number
export const roughMeasure: Measure = (text, size, _font, bold) => text.length * size * (bold ? 0.6 : 0.55)

export const TITLE_WEIGHT = 600


/** The y axis title with its unit, as "Concentration (mM)". */
export const yLabel = (chart: ChartData) => (chart.yUnit.trim() ? `${chart.yTitle} (${chart.yUnit.trim()})`.trim() : chart.yTitle)

/** Break a text into lines that fit, at spaces. */
function wrap(text: string, fits: (line: string) => boolean): string[] {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    let line = ''
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word
      if (line && !fits(next)) {
        lines.push(line)
        line = word
      } else line = next
    }
    lines.push(line)
  }
  return lines
}

/* Fitting text into the room it has */

/** The smallest text fitting goes down to, in pt: the least journals accept. */
export const MIN_TEXT = 5
/** Line spacing of wrapped labels and titles, as a share of the text size. */
const LINE = 1.2
const SIN45 = Math.SQRT1_2

/** The smallest size a text may shrink to before it wraps or tilts instead: 70% of its size, not below MIN_TEXT. */
const shrinkFloor = (size: number) => Math.min(size, Math.max(MIN_TEXT, size * 0.7))

/** The two lines a text breaks into at the space that makes the longer line shortest; one line if it has no space. */
function twoLines(text: string, width: (line: string) => number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length < 2) return [text]
  let best = [text]
  let longest = Infinity
  for (let i = 1; i < words.length; i++) {
    const lines = [words.slice(0, i).join(' '), words.slice(i).join(' ')]
    const longer = Math.max(...lines.map(width))
    if (longer < longest) [best, longest] = [lines, longer]
  }
  return best
}

/**
 * A text fitted into `room`: as it is when it fits; else smaller, down to
 * `floor`; else on as many lines as it needs at the largest size from `size`
 * down to MIN_TEXT whose longest line fits, and no more than `maxLines`. A
 * word too long for even that keeps MIN_TEXT and is the one thing left wider.
 */
export function fitText(text: string, room: number, size: number, floor: number, width: (line: string, size: number) => number, maxLines = Infinity): { size: number; lines: string[] } {
  if (!text) return { size, lines: [] }
  const full = width(text, size)
  if (full <= room) return { size, lines: [text] }
  // Widths grow in step with the size, so the size that just fits follows from one measure.
  if ((size * room) / full >= floor) return { size: (size * room) / full, lines: [text] }
  const least = Math.min(size, MIN_TEXT)
  for (let s = size; s >= least - 1e-9; s -= 0.25) {
    const lines = wrap(text, (line) => width(line, s) <= room)
    if (lines.length <= maxLines && lines.every((line) => width(line, s) <= room)) return { size: s, lines }
  }
  const lines = maxLines === 2 ? twoLines(text, (line) => width(line, least)) : wrap(text, (line) => width(line, least) <= room)
  return { size: least, lines }
}

/** How the group names along the groups' axis are drawn: one size for all, each on one or more lines, level or tilted. */
export type GroupLabels = {
  size: number
  lines: string[][]
  angle: 0 | -45 | -90
  /** The room they take from the axis line outward: their height upright, their width lying down. */
  depth: number
  /** Upright and tilted: how far the first one reaches left of its column's middle. */
  reach: number
}

/**
 * Fits the group names into their columns (`band` wide each) under an upright
 * chart, so neighbours never run into each other. In turn, until they fit: as
 * they are; smaller, down to 70% of their size; on two lines; tilted 45°
 * (making the room under the axis taller); and last, standing upright.
 */
export function fitGroupLabels(names: string[], band: number, size: number, width: (line: string, size: number) => number, maxDepth = Infinity): GroupLabels {
  const room = band * 0.92
  const floor = shrinkFloor(size)
  const widest = (lists: string[][], s: number) => Math.max(0, ...lists.flat().map((line) => width(line, s)))
  const sizeFor = (lists: string[][]) => Math.min(size, (size * room) / Math.max(widest(lists, size), 1e-6))
  const level = (lists: string[][], s: number): GroupLabels => ({ size: s, lines: lists, angle: 0, depth: 6 + s * 1.25 + (Math.max(1, ...lists.map((l) => l.length)) - 1) * s * LINE, reach: 0 })
  const single = names.map((name) => [name])
  if (sizeFor(single) >= floor) return level(single, sizeFor(single))
  const wrapped = names.map((name) => twoLines(name, (line) => width(line, size)))
  if (sizeFor(wrapped) >= floor) return level(wrapped, sizeFor(wrapped))
  // Tilted names sit side by side across the columns, each needing about 1.4 times its height of room.
  const tilt = Math.min(size, band / 1.5)
  if (tilt >= Math.min(size, MIN_TEXT)) {
    const drop = (s: number) => 6 + s * 0.8 + widest(single, s) * SIN45
    // Very long names get smaller still, so they don't take over the chart.
    const s = drop(tilt) <= maxDepth ? tilt : Math.max((tilt * maxDepth) / drop(tilt), Math.min(size, MIN_TEXT))
    return { size: s, lines: single, angle: -45, depth: drop(s), reach: (widest(single, s) + s) * SIN45 - s * 0.3 }
  }
  const upright = Math.max(Math.min(size, band / 1.15), Math.min(size, MIN_TEXT))
  return { size: upright, lines: single, angle: -90, depth: 8 + widest(single, upright), reach: 0 }
}

/*
 * A significance bracket, in parts of the font size: its feet drop under the
 * line, with a dot under each foot; its label sits over the line's middle
 * (beside it, lying down); stars and "ns" reach about this high over their baseline.
 */
const FOOT_DROP = 0.35
const FOOT_DOT = 0.3
const LABEL_LIFT = 0.2
const LABEL_SIDE = 0.35
const GLYPH_HEIGHT = 0.75

type Box = { x1: number; y1: number; x2: number; y2: number }
const meets = (p: Box, q: Box) => p.x1 < q.x2 && q.x1 < p.x2 && p.y1 < q.y2 && q.y1 < p.y2

type BracketPlace = { size: number; rowStep: number; horizontal: boolean; dots: boolean; x: (group: number) => number }

/**
 * Where a bracket's label and the rest of its ink (line, feet, dots) sit on a
 * row, worked out upright: groups across, rows going up from the plot's top
 * (so y is negative). `width` is the label's width.
 */
function bracketInk(pair: { a: number; b: number; width: number }, row: number, at: BracketPlace): { label: Box; marks: Box[] } {
  const { size } = at
  const by = -(row + 0.35) * at.rowStep
  const x1 = at.x(pair.a)
  const x2 = at.x(pair.b)
  const middle = (x1 + x2) / 2
  const pad = size * 0.1
  // Upright the label stands over the line's middle; lying down it reads on from the line, over the bracket's middle.
  const label = at.horizontal
    ? { x1: middle - (GLYPH_HEIGHT - LABEL_SIDE) * size - pad, y1: by - LABEL_SIDE * size - pair.width - pad, x2: middle + LABEL_SIDE * size + pad, y2: by - LABEL_SIDE * size + pad }
    : { x1: middle - pair.width / 2 - pad, y1: by - (LABEL_LIFT + GLYPH_HEIGHT) * size - pad, x2: middle + pair.width / 2 + pad, y2: by - LABEL_LIFT * size + pad }
  if (pair.a === pair.b) return { label, marks: [] }
  const footHalf = at.dots ? FOOT_DOT * size : 0.5
  const footLow = by + (FOOT_DROP + (at.dots ? FOOT_DOT * 2 : 0)) * size
  return {
    label,
    marks: [{ x1, y1: by - 0.5, x2, y2: by + 0.5 }, ...[x1, x2].map((foot) => ({ x1: foot - footHalf, y1: by, x2: foot + footHalf, y2: footLow }))],
  }
}

/**
 * Brackets stacked in rows, short spans low and long spans higher: each goes
 * on the lowest row where its line overlaps no other on that row, and no
 * label touches another bracket's ink. A foot (and its dot) reaches down
 * towards the row below, where it could land on the label of a bracket whose
 * middle is that same group, so such a bracket moves up a row.
 */
function bracketRows<T extends { a: number; b: number; width: number }>(pairs: T[], at: BracketPlace): (T & { row: number })[] {
  const placed: { pair: T; row: number; label: Box; marks: Box[] }[] = []
  for (const pair of [...pairs].sort((p, q) => p.b - p.a - (q.b - q.a) || p.a - q.a)) {
    for (let row = 0; ; row++) {
      const ink = bracketInk(pair, row, at)
      const clear = placed.every(
        (other) =>
          (other.row !== row || pair.b <= other.pair.a || pair.a >= other.pair.b) &&
          ![other.label, ...other.marks].some((box) => meets(box, ink.label)) &&
          !ink.marks.some((box) => meets(box, other.label)),
      )
      if (clear) {
        placed.push({ pair, row, ...ink })
        break
      }
    }
  }
  return placed.map(({ pair, row }) => ({ ...pair, row }))
}

export const DOT_RADIUS = 3

/**
 * How far a group's column reaches either side of its middle: the bar, or
 * the spread of dots, a box or a violin; a line chart shows it as the width
 * of its error-bar caps, kept narrower than a bar, and a box or violin with
 * dots over it is narrower than the dots' own room.
 */
const COLUMN_SHARE: Partial<Record<ChartKind, number>> = { line: 0.5, slope: 0.5, 'dots-box': 0.55, 'dots-violin': 0.85 }
export const columnHalf = (kind: ChartKind, half: number) => half * (COLUMN_SHARE[uprightKind(kind)] ?? 1)

export function drawChart(source: ChartData, plainMeasure: Measure = roughMeasure): ChartDrawing {
  const full = withDefaults(source)
  // Sub- and superscripts are laid out as marked text (chart-text.ts); unstyled charts pass through unchanged.
  const measure = scriptMeasure(plainMeasure)
  if (isHeatmap(full.kind)) return drawHeatmap(markChartScripts(full), measure)
  if (isXy(full.kind)) return drawXy(markChartScripts(full), measure)
  const log = full.yScale === 'log'
  // On a log axis, values at or below 0 can't be drawn and are left out; the significance test still uses every value.
  const chart = markChartScripts(log ? { ...full, groups: positiveOnly(full.groups) } : full)
  const horizontal = isHorizontal(chart.kind)
  const kind = uprightKind(chart.kind)
  type Shapes = Pick<ChartDrawing, 'rects' | 'lines' | 'polylines' | 'polygons' | 'dots' | 'columns'>
  // What is drawn on the plot is worked out upright (groups across, values up from a corner at 0, 0) in `v`,
  // then turned onto the page in `d`; axes, labels and the rest are placed on the page directly.
  const d: Omit<ChartDrawing, 'plot' | 'horizontal' | 'crowded'> = { rects: [], lines: [], gridLines: [], polylines: [], polygons: [], dots: [], texts: [], columns: [] }
  const v: Shapes = { rects: [], lines: [], polylines: [], polygons: [], dots: [], columns: [] }
  const starTexts: { text: string; x: number; y: number }[] = []
  const font = fontStack(fontByName(chart.fontFamily) ?? DEFAULT_FONT)
  const size = chart.fontSize
  const titleSize = size + 1
  const headSize = size + 3
  const ink = chart.axisColour
  const label = yLabel(chart)
  const text = (t: Omit<ChartText, 'size' | 'colour' | 'font'> & { size?: number }) => d.texts.push({ size, colour: ink, font, ...t })
  const width = (line: string, s: number) => measure(line, s, font)
  const boldWidth = (line: string, s: number) => measure(line, s, font, true)
  // A bar + line chart: the line's settings and its measure as a line chart of its own (its axis, its means).
  const combo = isCombo(kind) ? comboOf(chart) : undefined
  const comboLine = combo && lineChart(chart)
  const ownAxis = !!combo?.rightAxis
  const rightLabel = combo && ownAxis ? lineLabel(combo) : ''
  const legendItems: { name: string; colour: string; mark?: 'line' }[] =
    kind === 'line' || kind === 'slope' ? [{ name: chart.yTitle || 'Mean', colour: groupColour(chart, 0) }] : chart.groups.map((g, i) => ({ name: g.name, colour: groupColour(chart, i) }))
  if (combo) {
    // Bars all in one colour are one entry, named by their axis; bars in several colours keep one entry per group.
    const oneColour = chart.groups.every((_, i) => groupColour(chart, i).toLowerCase() === groupColour(chart, 0).toLowerCase())
    if (oneColour) legendItems.splice(0, legendItems.length, { name: chart.yTitle || 'Bars', colour: groupColour(chart, 0) })
    legendItems.push({ name: combo.title || 'Line', colour: combo.colour, mark: 'line' })
  }

  // Significance: which pairs get a bracket, and how many rows of brackets that needs.
  const result =
    chart.test === 'none'
      ? undefined
      : runTest(
          chart.test,
          full.groups.map((g) => g.values),
          {
            welch: chart.welch,
            correction: chart.correction,
            value: chart.testValue,
            effectSize: chart.effectSize,
            names: chart.groups.map((g) => g.name),
          },
        )
  const pairs = (result?.comparisons ?? []).filter((c) => chart.showNs || c.p < 0.05).map((c) => ({ ...c, width: measure(stars(c.p), size, font) }))
  const rowStep = size * 1.5

  const captionSize = size - 1
  const testNote = chart.test !== 'none' && chart.testNote ? (result?.note ?? 'Not enough data for the test.') : ''
  const note = testNote
  const captionText = [chart.caption.trim(), note].filter(Boolean).join('\n')
  const captionLines = captionText ? wrap(captionText, (line) => measure(line, captionSize, font) <= chart.width) : []
  const captionBlock = captionLines.length ? captionLines.length * captionSize * 1.35 + captionSize * 0.4 : 0
  // The chart's name wraps onto more lines rather than running past the chart's edges.
  const head = fitText(chart.title.trim(), chart.width, headSize, shrinkFloor(headSize), boldWidth)
  const headBlock = head.lines.length ? headSize * 0.4 + head.lines.length * head.size * LINE : 0
  /** Room over the plot before its brackets: a little air, and the chart's name when it sits on top. */
  const overPlot = size * 0.8 + (chart.titlePosition === 'top' ? headBlock : 0)
  const titleDepth = (fit: { size: number; lines: string[] }) => (fit.lines.length ? fit.size * 0.6 + fit.lines.length * fit.size * LINE : 0)

  /*
   * The layout, fitted to the chart's size. The plot's size depends on the
   * room its labels take, and how the labels fit (and how many numbers the
   * axis gets) depends on the plot's size, so it is worked out a few times
   * from a first guess; it settles in two or three rounds.
   *
   * Upright: the y axis title and numbers are on the left, group names under
   * the plot, brackets above it. Lying down: group names and their title are
   * on the left, the numbers and the y axis title under the plot, and the
   * brackets stand to its right.
   */
  const plan = (guess: { w: number; h: number }) => {
    const valueGuess = horizontal ? guess.w : guess.h
    // A short axis gets fewer numbers, so they never touch.
    const tickRoom = (n: number) => {
      const ticks = yAxis(chart, n).ticks
      const format = tickFormatter(ticks, log)
      return horizontal ? Math.max(0, ...ticks.map((t) => width(format(t), size))) * 1.6 : size * 2.2
    }
    let count = 5
    while (count > 2 && valueGuess / count < tickRoom(count)) count--
    const axis = yAxis(chart, count)
    const formatTick = tickFormatter(axis.ticks, log)
    const tickWidth = chart.tickLabels ? Math.max(0, ...axis.ticks.map((t) => width(formatTick(t), size))) : 0
    // The line's own axis on the right: its numbers and its title, standing up like the left one's.
    // Not until the line has a number: an empty axis (0 to 1) on a chart just turned into a bar + line looks broken.
    const lineAxis = comboLine && ownAxis && comboLine.groups.some((g) => g.values.some((value) => value !== null && Number.isFinite(value))) ? yAxis(comboLine, count) : undefined
    const formatLineTick = tickFormatter(lineAxis?.ticks ?? [], false)
    const lineTickWidth = lineAxis && chart.tickLabels ? Math.max(0, ...lineAxis.ticks.map((t) => width(formatLineTick(t), size))) : 0
    const rightFit = fitText(rightLabel, Math.max(valueGuess, 20), titleSize, shrinkFloor(titleSize), width, 2)
    const rightAxisRoom = lineAxis ? (chart.tickLabels ? lineTickWidth + 8 : 6) + titleDepth(rightFit) : 0
    // The axis titles, along their axis: smaller, then on two lines.
    const yFit = fitText(label, Math.max(valueGuess, 20), titleSize, shrinkFloor(titleSize), width, 2)
    const xFit = fitText(chart.xTitle, Math.max(horizontal ? guess.h : guess.w, 20), titleSize, shrinkFloor(titleSize), width, 2)
    // The legend stands right of the plot, from its top down; more names than fit get smaller, then a second column.
    const legendRoom = Math.max(chart.height - overPlot - captionBlock - 2, size * 2)
    const legendSize = chart.legend ? Math.max(Math.min(size, legendRoom / (legendItems.length * 1.6)), Math.min(size, MIN_TEXT)) : size
    const legendColumns = chart.legend ? Math.max(1, Math.ceil((legendItems.length * legendSize * 1.6) / legendRoom)) : 1
    const legendPerColumn = Math.ceil(legendItems.length / legendColumns)
    const legendItemWidth = Math.max(0, ...legendItems.map((item) => width(item.name, legendSize))) + legendSize * 2.2
    const legendWidth = chart.legend ? legendItemWidth * legendColumns : 0
    const rightOfPlot = rightAxisRoom + (chart.legend ? legendWidth + 8 : lineAxis ? 2 : size)
    const bottomExtra = (chart.titlePosition === 'bottom' ? headBlock : 0) + captionBlock

    let left: number
    let axisBottom: number
    let names: GroupLabels
    if (horizontal) {
      // Group names down the left: smaller, then on more lines (as many as a group's slot has room for), at most 40% of the chart wide.
      const band = guess.h / Math.max(chart.groups.length, 1)
      const room = Math.max(chart.width * 0.4 - titleDepth(xFit), size * 3)
      const maxLines = Math.max(1, Math.floor(band / (size * LINE)))
      const fits = chart.groups.map((g) => fitText(g.name, room, size, shrinkFloor(size), width, maxLines))
      const s = Math.min(size, ...fits.map((f) => f.size))
      const lines = chart.groups.map((g) => (width(g.name, s) <= room ? [g.name] : wrap(g.name, (line) => width(line, s) <= room)))
      const widest = Math.max(0, ...lines.flat().map((line) => width(line, s)))
      names = { size: s, lines, angle: 0, depth: chart.tickLabels ? widest + 8 : 6, reach: 0 }
      left = titleDepth(xFit) + names.depth
      axisBottom = (chart.tickLabels ? size * 1.8 : 6) + titleDepth(yFit)
    } else {
      left = titleDepth(yFit) + tickWidth + 8
      const band = Math.max(chart.width - left - rightOfPlot, 20) / Math.max(chart.groups.length, 1)
      names = chart.tickLabels ? fitGroupLabels(chart.groups.map((g) => g.name), band, size, width, chart.height * 0.35) : { size, lines: [], angle: 0, depth: 6, reach: 0 }
      // Tilted names lean left from their column: the first one mustn't run past the chart's left edge. The first
      // column's middle sits half a column in, and the columns narrow as the left margin grows, so solve for the margin.
      const k = Math.max(chart.groups.length, 1)
      const room = chart.width - rightOfPlot
      left = Math.max(left, (names.reach + 1 - room / (2 * k)) / (1 - 1 / (2 * k)))
      axisBottom = names.depth + titleDepth(xFit)
    }
    return { axis, lineAxis, formatLineTick, lineTickWidth, rightFit, yFit, xFit, legendSize, legendPerColumn, legendItemWidth, legendWidth, rightOfPlot, left, axisBottom, bottom: axisBottom + bottomExtra, names }
  }
  /** The plot's size and the brackets' rows for a layout. */
  const placePlot = (p: ReturnType<typeof plan>) => {
    // Along the groups: the brackets take room along the values only, so the groups' spacing is known before they're stacked.
    const groupLen = horizontal ? Math.max(chart.height - overPlot - p.bottom, 20) : Math.max(chart.width - p.left - p.rightOfPlot, 20)
    const band = groupLen / Math.max(chart.groups.length, 1)
    /** Where a group's middle sits along the plot's upright width. */
    const x = (i: number) => band * (i + 0.5)
    const brackets = bracketRows(pairs, { size, rowStep, horizontal, dots: chart.colouredBrackets, x })
    const bracketRowCount = Math.max(0, ...brackets.map((b) => b.row + 1))
    // Lying down, the outermost labels read on past their row.
    const labelReach = horizontal ? Math.max(0, ...brackets.map((b) => (b.row + 0.35) * rowStep + LABEL_SIDE * size + b.width)) : 0
    const bracketRoom = bracketRowCount > 0 ? Math.max(bracketRowCount * rowStep + size, labelReach + size * 0.5) : 0
    const right = p.rightOfPlot + (horizontal ? bracketRoom : 0)
    const top = overPlot + (horizontal ? 0 : bracketRowCount * rowStep)
    const w = horizontal ? Math.max(chart.width - p.left - right, 20) : groupLen
    const h = horizontal ? groupLen : Math.max(chart.height - top - p.bottom, 20)
    // Brackets squash the plot to under a quarter of the chart along the values (and under six lines of text): the data
    // is hard to read, so the panel suggests a way out. A tall chart with many brackets but a readable plot isn't crowded.
    const valueLen = horizontal ? w : h
    const crowded = bracketRowCount > 0 && valueLen < Math.max((horizontal ? chart.width : chart.height) * 0.25, size * 6)
    return { band, x, brackets, top, w, h, crowded }
  }
  let layout = plan({ w: chart.width * 0.7, h: chart.height * 0.6 })
  let placed = placePlot(layout)
  for (let round = 0; round < 3; round++) {
    const next = plan({ w: placed.w, h: placed.h })
    const nextPlaced = placePlot(next)
    const settled = Math.abs(nextPlaced.w - placed.w) < 0.5 && Math.abs(nextPlaced.h - placed.h) < 0.5
    layout = next
    placed = nextPlaced
    if (settled) break
  }
  const { axis, lineAxis, formatLineTick, lineTickWidth, rightFit, yFit, xFit, left, axisBottom, names, legendSize, legendPerColumn, legendItemWidth, legendWidth } = layout
  const { band, x, brackets, top, w, h, crowded } = placed
  // Along the values.
  const valueLen = horizontal ? w : h
  /** Where a value sits along the plot's upright height (0 at the top). */
  const y = (value: number) => valueLen - axisShare(value, axis, log) * valueLen
  const formatTick = tickFormatter(axis.ticks, log)
  const half = (band * Math.min(Math.max(chart.barWidth, 0.1), 0.95)) / 2
  const cap = kind === 'line' || kind === 'slope' ? columnHalf('line', half) : Math.min(half * 0.5, 6)
  /** Where a line value sits: on its own axis, or on the bars' one. */
  const lineY = (value: number) => (lineAxis ? valueLen - axisShare(value, lineAxis, false) * valueLen : y(value))

  // Axes, grid and tick marks, on the page. Tick marks point out of the plot, or into it.
  d.lines.push(...frameLines(chart.frame, { left, top, w, h }, ink))
  d.gridLines.push(...gridLines(chart, { left, top, w, h }, axis.ticks, (t) => valueLen - y(t), horizontal))
  const tick = chart.ticks === 'in' ? -4 : 4
  for (const t of axis.ticks) {
    if (horizontal) {
      const tx = left + valueLen - y(t)
      d.lines.push({ x1: tx, y1: top + h, x2: tx, y2: top + h + tick, colour: ink, width: 1 })
      if (chart.tickLabels) text({ text: formatTick(t), x: tx, y: top + h + 6 + size, anchor: 'middle', role: { kind: 'tick' } })
    } else {
      d.lines.push({ x1: left - tick, y1: top + y(t), x2: left, y2: top + y(t), colour: ink, width: 1 })
      if (chart.tickLabels) text({ text: formatTick(t), x: left - 6, y: top + y(t) + size * 0.35, anchor: 'end', role: { kind: 'tick' } })
    }
  }
  if (lineAxis) {
    // The line's own axis on the plot's right: its line (a box frame already has one), ticks, numbers and title.
    const rx = left + w
    if (chart.frame === 'open') d.lines.push({ x1: rx, y1: top, x2: rx, y2: top + h, colour: ink, width: 1 })
    for (const t of lineAxis.ticks) {
      const ty = top + valueLen - axisShare(t, lineAxis, false) * valueLen
      d.lines.push({ x1: rx, y1: ty, x2: rx + tick, y2: ty, colour: ink, width: 1 })
      if (chart.tickLabels) text({ text: formatLineTick(t), x: rx + 6, y: ty + size * 0.35, anchor: 'start', role: { kind: 'tick' } })
    }
    const titleX = rx + (chart.tickLabels ? lineTickWidth + 8 : 6)
    rightFit.lines.forEach((line, i) => text({ text: line, x: titleX + rightFit.size * (0.9 + i * LINE), y: top + h / 2, size: rightFit.size, anchor: 'middle', rotate: true, role: { kind: 'lineTitle' } }))
  }
  /** An axis title under the plot, its lines from the top of its room down, along the plot's width. */
  const levelTitle = (fit: { size: number; lines: string[] }, align: 'left' | 'center' | 'right', role: TextRole) => {
    const y0 = top + h + axisBottom - (fit.lines.length ? fit.size * 0.6 + fit.lines.length * fit.size * LINE : 0)
    const lx = align === 'left' ? left : align === 'right' ? left + w : left + w / 2
    const anchor = align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle'
    fit.lines.forEach((line, i) => text({ text: line, x: lx, y: y0 + fit.size * (0.35 + (i + 1) * LINE), size: fit.size, anchor, role }))
  }
  /** An axis title standing up at the chart's left edge, its lines side by side, along the plot's height. */
  const standingTitle = (fit: { size: number; lines: string[] }, align: 'left' | 'center' | 'right', role: TextRole) =>
    fit.lines.forEach((line, i) => {
      const along = width(line, fit.size) / 2
      const ly = align === 'left' ? top + h - along : align === 'right' ? top + along : top + h / 2
      text({ text: line, x: fit.size * (0.9 + i * LINE), y: ly, size: fit.size, anchor: 'middle', rotate: true, role })
    })
  if (label) {
    if (horizontal) levelTitle(yFit, chart.yTitleAlign, { kind: 'yTitle' })
    else standingTitle(yFit, chart.yTitleAlign, { kind: 'yTitle' })
  }
  if (chart.xTitle) {
    if (horizontal) standingTitle(xFit, 'center', { kind: 'xTitle' })
    else levelTitle(xFit, 'center', { kind: 'xTitle' })
  }

  const barLike = kind === 'bar' || kind === 'dots-bars' || kind === 'bar-line'
  const colHalf = columnHalf(kind, half)
  // Violins share one scale, so a wider one holds more values.
  const profiles = chart.groups.map((g) => (kind === 'violin' || kind === 'dots-violin' ? violinProfile(numbersOf(g.values)) : []))
  // A group with one value or identical values has no outline to draw (just a spike), so it doesn't set the scale.
  const densest = Math.max(1e-9, ...profiles.filter((p) => p.length > 1).flatMap((p) => p.map((pt) => pt.density)))
  const means: { x: number; y: number }[] = []
  chart.groups.forEach((g, i) => {
    const s = stats(g.values)
    const c = groupColour(chart, kind === 'line' || kind === 'slope' ? 0 : i)
    if (chart.tickLabels) {
      // Fitted names: one size for all, each on one or more lines, level, tilted or standing.
      const lines = names.lines[i] ?? [g.name]
      const s = names.size
      const role = { kind: 'group', index: i } as const
      if (horizontal) lines.forEach((line, j) => text({ text: line, x: left - 6, y: top + x(i) + s * 0.35 + (j - (lines.length - 1) / 2) * s * LINE, size: s, anchor: 'end', role }))
      else if (names.angle === -45) text({ text: g.name, x: left + x(i) + s * 0.3, y: top + h + 6 + s * 0.8, size: s, anchor: 'end', angle: -45, role })
      else if (names.angle === -90) text({ text: g.name, x: left + x(i) + s * 0.35, y: top + h + 6, size: s, anchor: 'end', angle: -90, role })
      else lines.forEach((line, j) => text({ text: line, x: left + x(i), y: top + h + 6 + s * (1 + j * LINE), size: s, anchor: 'middle', role }))
    }
    if (!s) return
    const values = numbersOf(g.values)
    const box = boxStats(values)!
    const mid = x(i)
    const bounds = errorBounds(chart, values, s)
    const base = y(Math.max(axis.min, Math.min(0, axis.max)))
    if (barLike) {
      const bar = { x: mid - half, y: Math.min(y(s.mean), base), width: half * 2, height: Math.abs(base - y(s.mean)) }
      v.rects.push({ ...bar, fill: kind === 'dots-bars' ? tint(c, 0.55) : c })
    }
    if (kind === 'floating') {
      v.rects.push({ x: mid - half, y: y(box.max), width: half * 2, height: Math.abs(y(box.min) - y(box.max)), fill: c })
      v.lines.push({ x1: mid - half, y1: y(box.median), x2: mid + half, y2: y(box.median), colour: ink, width: 1.5 })
    }
    if (kind === 'box' || kind === 'dots-box') {
      // A soft fill from the lower to the upper quartile, drawn round, with the median and the whiskers (smallest to largest value).
      const bh = colHalf
      const q1 = y(box.q1)
      const q3 = y(box.q3)
      v.rects.push({ x: mid - bh, y: Math.min(q1, q3), width: bh * 2, height: Math.abs(q1 - q3), fill: tint(c, 0.5) })
      for (const [x1, y1, x2, y2] of [[mid - bh, q3, mid + bh, q3], [mid - bh, q1, mid + bh, q1], [mid - bh, q3, mid - bh, q1], [mid + bh, q3, mid + bh, q1]] as const) v.lines.push({ x1, y1, x2, y2, colour: ink, width: 1 })
      v.lines.push({ x1: mid - bh, y1: y(box.median), x2: mid + bh, y2: y(box.median), colour: ink, width: 1.5 })
      const capHalf = Math.min(bh * 0.5, 6)
      for (const [from, to, end] of [[q3, y(box.max), y(box.max)], [q1, y(box.min), y(box.min)]] as const) {
        v.lines.push({ x1: mid, y1: from, x2: mid, y2: to, colour: ink, width: 1 })
        v.lines.push({ x1: mid - capHalf, y1: end, x2: mid + capHalf, y2: end, colour: ink, width: 1 })
      }
    }
    if (kind === 'violin' || kind === 'dots-violin') {
      const profile = profiles[i] ?? []
      const vh = colHalf
      if (profile.length > 1) {
        const right = profile.map((pt) => ({ x: mid + (vh * pt.density) / densest, y: y(pt.value) }))
        const left = profile.map((pt) => ({ x: mid - (vh * pt.density) / densest, y: y(pt.value) })).reverse()
        v.polygons.push({ points: [...right, ...left], fill: tint(c, 0.4), stroke: ink, width: 1 })
      }
      v.lines.push({ x1: mid - vh * 0.5, y1: y(box.median), x2: mid + vh * 0.5, y2: y(box.median), colour: ink, width: 1.5 })
    }
    if (kind === 'scatter') {
      // The outer dots touch the column's edges, so the width handles sit right on them.
      const spread = Math.max(2 * (half - DOT_RADIUS), 0)
      values.forEach((value, j) => v.dots.push({ x: mid + (values.length < 2 ? 0 : (j / (values.length - 1) - 0.5) * spread), y: y(value), r: DOT_RADIUS, fill: c }))
      v.lines.push({ x1: mid - half, y1: y(s.mean), x2: mid + half, y2: y(s.mean), colour: ink, width: 1.5 })
    }
    if (kind === 'dots-bars' || kind === 'dots-spread' || kind === 'dots-box' || kind === 'dots-violin') {
      const offsets = beeswarm(values.map(y), DOT_RADIUS, Math.max(colHalf - DOT_RADIUS, 0))
      values.forEach((value, j) => v.dots.push({ x: mid + (offsets.at(j) ?? 0), y: y(value), r: DOT_RADIUS, fill: c }))
      if (kind === 'dots-spread') v.lines.push({ x1: mid - colHalf, y1: y(s.mean), x2: mid + colHalf, y2: y(s.mean), colour: ink, width: 1.5 })
    }
    if (kind === 'before-after') values.forEach((value) => v.dots.push({ x: mid, y: y(value), r: DOT_RADIUS, fill: c }))
    if (kind === 'point') v.dots.push({ x: mid, y: y(s.mean), r: DOT_RADIUS + 1, fill: c })
    if (kind === 'line' || kind === 'slope' || kind === 'point') means.push({ x: mid, y: y(s.mean) })
    // What the column covers from top to bottom, for its width handles.
    const spread = usesSpread(kind) ? values : []
    const outward = bounds && barLike ? (chart.errorInside ? [bounds.low, bounds.high] : [s.mean >= 0 ? bounds.high : bounds.low]) : []
    const zero = Math.max(axis.min, Math.min(0, axis.max))
    const low = barLike ? Math.min(zero, s.mean, ...spread, ...outward) : Math.min(bounds?.low ?? s.mean, s.mean, ...spread)
    const high = barLike ? Math.max(zero, s.mean, ...spread, ...outward) : Math.max(bounds?.high ?? s.mean, s.mean, ...spread)
    const pad = kind === 'bar' ? 0 : DOT_RADIUS
    v.columns[i] = { x: mid - colHalf, y: Math.min(y(high), y(low)) - pad, width: colHalf * 2, height: Math.abs(y(low) - y(high)) + pad * 2 }
    if (bounds && bounds.high !== bounds.low) {
      // A bar chart's error bar only goes outward from the bar's end, away from zero (up for a bar above it, down for a bar below), as is usual in papers.
      const outer = s.mean >= 0 ? bounds.high : bounds.low
      const [from, to] = barLike && !chart.errorInside ? [s.mean, outer] : [bounds.low, bounds.high]
      v.lines.push({ x1: mid, y1: y(to), x2: mid, y2: y(from), colour: ink, width: 1 })
      v.lines.push({ x1: mid - cap, y1: y(to), x2: mid + cap, y2: y(to), colour: ink, width: 1 })
      if (!barLike || chart.errorInside) v.lines.push({ x1: mid - cap, y1: y(from), x2: mid + cap, y2: y(from), colour: ink, width: 1 })
    }
  })
  if (kind === 'line' || kind === 'slope') {
    const c = groupColour(chart, 0)
    if (means.length > 1) v.polylines.push({ points: means, colour: c, width: 1.5 })
    // A slope's markers are open: white with an outline in the line's colour.
    for (const m of means) v.dots.push({ x: m.x, y: m.y, r: DOT_RADIUS, fill: kind === 'slope' ? '#ffffff' : c, ...(kind === 'slope' ? { stroke: c } : {}) })
  }
  if (comboLine && combo) {
    // The line over the bars: each group's mean joined up, with an error bar round it and a marker on it.
    const points: { x: number; y: number }[] = []
    comboLine.groups.forEach((g, i) => {
      const all = numbersOf(g.values)
      // Sharing a log axis, the line's values at or below 0 can't be drawn either.
      const values = log && !ownAxis ? all.filter((value) => value > 0) : all
      const s = stats(values)
      if (!s) return
      const mid = x(i)
      const bounds = errorBounds(comboLine, values, s)
      if (bounds && bounds.high !== bounds.low) {
        const [lo, hi] = [lineY(bounds.low), lineY(bounds.high)]
        v.lines.push({ x1: mid, y1: hi, x2: mid, y2: lo, colour: combo.colour, width: 1 })
        for (const end of [hi, lo]) v.lines.push({ x1: mid - cap, y1: end, x2: mid + cap, y2: end, colour: combo.colour, width: 1 })
      }
      points.push({ x: mid, y: lineY(s.mean) })
    })
    if (points.length > 1) v.polylines.push({ points, colour: combo.colour, width: 1.5 })
    for (const p of points) v.dots.push({ x: p.x, y: p.y, r: DOT_RADIUS, fill: combo.colour })
  }
  if (kind === 'before-after') {
    // One thin line per row (a subject, measured in every group), drawn under the dots.
    const link = tint(ink, 0.45)
    for (let r = 0; r < rowCount(chart); r++) {
      let run: { x: number; y: number }[] = []
      const flush = () => {
        if (run.length > 1) v.polylines.push({ points: run, colour: link, width: 1 })
        run = []
      }
      chart.groups.forEach((g, i) => {
        const value = g.values[r]
        if (value === null || value === undefined || !Number.isFinite(value)) flush()
        else run.push({ x: x(i), y: y(value) })
      })
      flush()
    }
  }

  // Brackets above the plot (beside it, when lying down), one row each, with stars over the middle. A test against a value
  // puts stars over the group alone.
  for (const b of brackets) {
    const by = -(b.row + 0.35) * rowStep
    const drop = size * FOOT_DROP
    const x1 = x(b.a)
    const x2 = x(b.b)
    const middle = (x1 + x2) / 2
    if (b.a !== b.b) {
      v.lines.push({ x1, y1: by + drop, x2: x1, y2: by, colour: ink, width: 1 })
      v.lines.push({ x1, y1: by, x2, y2: by, colour: ink, width: 1 })
      v.lines.push({ x1: x2, y1: by, x2, y2: by + drop, colour: ink, width: 1 })
      // With coloured brackets, a dot in each group's colour at each foot shows which two are compared.
      if (chart.colouredBrackets) for (const [foot, group] of [[x1, b.a], [x2, b.b]] as const) v.dots.push({ x: foot, y: by + drop + size * FOOT_DOT, r: size * FOOT_DOT, fill: groupColour(chart, group), stroke: '#ffffff' })
    }
    starTexts.push({ text: stars(b.p), x: middle, y: by })
  }

  // Turn what was drawn upright onto the page: upright just moves it to the plot's corner; lying down
  // swaps the two directions, so the values run left to right and the first group is at the top.
  const map = (px: number, py: number) => (horizontal ? { x: left + valueLen - py, y: top + px } : { x: left + px, y: top + py })
  const onPage = (r: { x: number; y: number; width: number; height: number }) => {
    const a = map(r.x, r.y)
    const b = map(r.x + r.width, r.y + r.height)
    return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) }
  }
  for (const r of v.rects) d.rects.push({ ...onPage(r), fill: r.fill })
  for (const l of v.lines) {
    const a = map(l.x1, l.y1)
    const b = map(l.x2, l.y2)
    d.lines.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, colour: l.colour, width: l.width })
  }
  for (const p of v.polylines) d.polylines.push({ ...p, points: p.points.map((pt) => map(pt.x, pt.y)) })
  for (const g of v.polygons) d.polygons.push({ ...g, points: g.points.map((pt) => map(pt.x, pt.y)) })
  for (const dot of v.dots) d.dots.push({ ...dot, ...map(dot.x, dot.y) })
  v.columns.forEach((c, i) => (d.columns[i] = c && onPage(c)))
  // Reference lines across the plot, over the data, each with its label just inside the plot at the line's far end.
  chart.referenceLines.forEach((ref, i) => {
    if (!Number.isFinite(ref.value) || ref.value < axis.min || ref.value > axis.max || (log && ref.value <= 0)) return
    const dash = ref.style === 'dashed' ? DASHES.dashed : undefined
    const along = y(ref.value)
    const line = horizontal ? { x1: left + valueLen - along, y1: top, x2: left + valueLen - along, y2: top + h } : { x1: left, y1: top + along, x2: left + w, y2: top + along }
    d.lines.push({ ...line, colour: ink, width: 1, ...(dash ? { dash } : {}) })
    const name = ref.label.trim()
    if (!name) return
    const role = { kind: 'reference', index: i } as const
    const s = size - 1
    if (horizontal) text({ text: name, x: line.x1 + 3, y: top + s, size: s, anchor: 'start', role })
    else text({ text: name, x: left + w - 2, y: top + along - 3, size: s, anchor: 'end', role })
  })
  // A bracket's stars sit over its middle, or beside it when it stands at the plot's right.
  for (const t of starTexts) {
    const at = map(t.x, t.y)
    if (horizontal) text({ text: t.text, x: at.x + size * LABEL_SIDE, y: at.y + size * 0.35, anchor: 'start', role: { kind: 'stats' } })
    else text({ text: t.text, x: at.x, y: at.y - size * LABEL_LIFT, anchor: 'middle', role: { kind: 'stats' } })
  }

  if (chart.legend)
    legendItems.forEach((item, i) => {
      // From the chart's top (by the plot), in columns when there are more names than fit down the side.
      const ls = legendSize
      const column = Math.floor(i / legendPerColumn)
      const ly = overPlot + ls * 0.6 + (i % legendPerColumn) * ls * 1.6
      const lx = chart.width - legendWidth + column * legendItemWidth
      if (item.mark === 'line') {
        // The line's entry: a short stroke of the line with its marker.
        d.lines.push({ x1: lx - ls * 0.1, y1: ly, x2: lx + ls * 0.9, y2: ly, colour: item.colour, width: 1.5 })
        d.dots.push({ x: lx + ls * 0.4, y: ly, r: Math.min(DOT_RADIUS, ls * 0.3), fill: item.colour })
      } else d.rects.push({ x: lx, y: ly - ls * 0.4, width: ls * 0.8, height: ls * 0.8, fill: item.colour })
      text({ text: item.name, x: lx + ls * 1.3, y: ly + ls * 0.35, size: ls, anchor: 'start', role: { kind: 'legend' } })
    })

  if (head.lines.length) {
    const tx = chart.titleAlign === 'left' ? 0 : chart.titleAlign === 'right' ? chart.width : chart.width / 2
    const ty = chart.titlePosition === 'top' ? head.size : top + h + axisBottom + head.size * 1.3
    const anchor = chart.titleAlign === 'left' ? 'start' : chart.titleAlign === 'right' ? 'end' : 'middle'
    head.lines.forEach((line, i) => text({ text: line, x: tx, y: ty + i * head.size * LINE, size: head.size, bold: true, anchor, role: { kind: 'title' } }))
  }
  const captionTop = chart.height - captionLines.length * captionSize * 1.35
  const captionX = chart.captionAlign === 'left' ? 0 : chart.captionAlign === 'right' ? chart.width : chart.width / 2
  const captionAnchor = chart.captionAlign === 'left' ? 'start' : chart.captionAlign === 'right' ? 'end' : 'middle'
  captionLines.forEach((line, i) => text({ text: line, x: captionX, y: captionTop + captionSize * (1 + i * 1.35), size: captionSize, anchor: captionAnchor, role: { kind: 'caption' } }))
  return { ...d, plot: { left, top, width: w, height: h, band }, horizontal, crowded }
}

/**
 * How tall an upright chart has to be for its significance brackets to leave
 * the plot readable, at most `maxHeight` (the room left on the page under its
 * top). Undefined when it isn't crowded, can't grow, or lies down (its
 * brackets stand beside the plot, so height doesn't help).
 */
export function heightToFit(chart: ChartData, measure: Measure, maxHeight: number): number | undefined {
  if (isHorizontal(chart.kind) || maxHeight <= chart.height || !drawChart(chart, measure).crowded) return undefined
  if (drawChart({ ...chart, height: maxHeight }, measure).crowded) return maxHeight
  // The least height that isn't crowded, to within a pixel.
  let low = chart.height
  let high = maxHeight
  while (high - low > 1) {
    const mid = (low + high) / 2
    if (drawChart({ ...chart, height: mid }, measure).crowded) low = mid
    else high = mid
  }
  return Math.ceil(high)
}

/** Where a text starts, since exported text is outlined from its left end. */
export const textLeft = (t: ChartText, width: number) => (t.anchor === 'start' ? t.x : t.anchor === 'middle' ? t.x - width / 2 : t.x - width)

/** The box a text covers, in the chart's own space, for hitting it with a double-click. */
export function textBox(t: ChartText, measure: Measure): { x: number; y: number; width: number; height: number } {
  const width = scriptMeasure(measure)(t.text, t.size, t.font, t.bold)
  if (t.rotate) return { x: t.x - t.size * 0.9, y: t.y - width / 2, width: t.size * 1.4, height: width }
  if (t.angle) {
    // The four corners of the text's own box, turned about its anchor.
    const a = (t.angle * Math.PI) / 180
    const x0 = textLeft(t, width) - t.x
    const corners = [[x0, -t.size], [x0 + width, -t.size], [x0, t.size * 0.3], [x0 + width, t.size * 0.3]].map(([cx = 0, cy = 0]) => ({ x: t.x + cx * Math.cos(a) - cy * Math.sin(a), y: t.y + cx * Math.sin(a) + cy * Math.cos(a) }))
    const xs = corners.map((c) => c.x)
    const ys = corners.map((c) => c.y)
    return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) }
  }
  return { x: textLeft(t, width), y: t.y - t.size, width, height: t.size * 1.3 }
}

const escapeXml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const n = (value: number) => String(Math.round(value * 100) / 100)

/** The chart as plain SVG shapes and text, in its own space moved by `origin`. */
export function chartSvg(chart: ChartData, plainMeasure: Measure = roughMeasure, origin = { x: 0, y: 0 }): string[] {
  const measure = scriptMeasure(plainMeasure)
  const d = drawChart(chart, measure)
  const x = (value: number) => n(value + origin.x)
  const y = (value: number) => n(value + origin.y)
  const out: string[] = []
  const line = (l: ChartLine) =>
    `<line x1="${x(l.x1)}" y1="${y(l.y1)}" x2="${x(l.x2)}" y2="${y(l.y2)}" stroke="${l.colour}" stroke-width="${n(l.width)}" stroke-linecap="${l.dash ? 'butt' : 'square'}"${l.dash ? ` stroke-dasharray="${l.dash.join(' ')}"` : ''} />\n`
  // The grid first, behind the data.
  for (const l of d.gridLines) out.push(line(l))
  for (const r of d.rects) out.push(`<rect x="${x(r.x)}" y="${y(r.y)}" width="${n(r.width)}" height="${n(r.height)}" fill="${r.fill}" />\n`)
  for (const p of d.polylines) out.push(`<polyline points="${p.points.map((pt) => `${x(pt.x)},${y(pt.y)}`).join(' ')}" fill="none" stroke="${p.colour}" stroke-width="${n(p.width)}" stroke-linejoin="round"${p.dash ? ` stroke-dasharray="${p.dash.join(' ')}"` : ''} />\n`)
  for (const g of d.polygons) out.push(`<polygon points="${g.points.map((pt) => `${x(pt.x)},${y(pt.y)}`).join(' ')}" fill="${g.fill}" stroke="${g.stroke}" stroke-width="${n(g.width)}" stroke-linejoin="round" />\n`)
  for (const l of d.lines) out.push(line(l))
  for (const dot of d.dots) {
    const stroke = dot.stroke ? ` stroke="${dot.stroke}"` : ''
    const corners = dotCorners(dot)
    out.push(corners ? `<polygon points="${corners.map((pt) => `${x(pt.x)},${y(pt.y)}`).join(' ')}" fill="${dot.fill}"${stroke} stroke-linejoin="round" />\n` : `<circle cx="${x(dot.x)}" cy="${y(dot.y)}" r="${n(dot.r)}" fill="${dot.fill}"${stroke} />\n`)
  }
  for (const t of d.texts) {
    const width = measure(t.text, t.size, t.font, t.bold)
    const weight = t.bold ? ` font-weight="${TITLE_WEIGHT}"` : ''
    const text = (tx: number, ty: number) => `<text x="${n(tx)}" y="${n(ty)}" font-family="${escapeXml(t.font)}" font-size="${n(t.size)}"${weight} fill="${t.colour}" xml:space="preserve">${scriptSpans(t.text, t.size, ty) ?? escapeXml(t.text)}</text>`
    if (t.rotate) out.push(`<g transform="translate(${x(t.x)} ${y(t.y)}) rotate(-90)">${text(-width / 2, t.size * 0.35)}</g>\n`)
    else if (t.angle) out.push(`<g transform="translate(${x(t.x)} ${y(t.y)}) rotate(${n(t.angle)})">${text(textLeft(t, width) - t.x, 0)}</g>\n`)
    else out.push(`${text(textLeft(t, width) + origin.x, t.y + origin.y)}\n`)
  }
  return out
}
