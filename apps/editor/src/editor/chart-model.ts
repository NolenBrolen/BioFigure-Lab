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
import { isHorizontal, startsAtZero, uprightKind, usesErrorBars, usesSpread, type ChartKind } from '@biofigure-lab/ui/lib/graph-kinds'
import { jStat } from 'jstat'

import { beeswarm, boxStats, quantile, tint, violinProfile } from './chart-distribution'
import { runTest, stars, type Correction, type StatTest } from './chart-stats'
import { DEFAULT_FONT, fontByName, fontStack } from './fonts'

export type { ChartKind, ErrorBars, StatTest }
export type TextAlign = 'left' | 'center' | 'right'

/** One group (a column in the data table): its name and its replicate values. Empty cells are null. */
export type ChartGroup = { name: string; values: (number | null)[] }

export type ChartData = {
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
  /** How p values are corrected when several comparisons are made. */
  correction: Correction
  /** One-sample tests: the value each group is tested against. */
  testValue: number
  /** Add effect sizes (Cohen's d, η²) to the line saying which test was used. */
  effectSize: boolean
  /** A dot in each group's colour at the feet of its significance brackets. */
  colouredBrackets: boolean
}

/** Okabe-Ito: colours most people with colour blindness can still tell apart. */
export const COLOUR_BLIND_SAFE = ['#0072B2', '#E69F00', '#009E73', '#CC79A7', '#56B4E9', '#D55E00', '#F0E442', '#000000']

export const DEFAULT_CHART_SIZE = { width: 320, height: 240 }

/**
 * The size a chart placed by a click starts at on a page of this size (both in
 * page pixels): half the page width, 4:3, at most the default (85 mm, right for
 * a double-column page) and never taller than most of the page. The text stays
 * the same size, so a small chart is as readable in print as a big one.
 */
export function chartSizeForPage(page: { width: number; height: number }): { width: number; height: number } {
  const width = Math.min(DEFAULT_CHART_SIZE.width, page.width / 2, (page.height * 0.8 * 4) / 3)
  return { width, height: (width * 3) / 4 }
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
  correction: 'holmsidak',
  testValue: 0,
  effectSize: false,
  colouredBrackets: true,
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
 * one. A comma counts as the decimal mark when there's no point, as
 * spreadsheets in many countries write "1,5".
 */
export function parseNumber(text: string): number | null {
  const t = text.trim().replace(/\s/g, '')
  if (!t) return null
  const value = Number(t.includes('.') ? t.replace(/,/g, '') : t.replace(',', '.'))
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
function evenRows(groups: ChartGroup[]): ChartGroup[] {
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
export const removeRow = (chart: ChartData, r: number): ChartData => ({ ...chart, groups: chart.groups.map((g) => ({ ...g, values: g.values.filter((_, i) => i !== r) })) })

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
export function yAxis(chart: ChartData): { min: number; max: number; ticks: number[] } {
  const spans = chart.groups.flatMap((g) => {
    const s = stats(g.values)
    if (!s) return []
    const bounds = errorBounds(chart, numbersOf(g.values), s)
    return [bounds?.low ?? s.mean, bounds?.high ?? s.mean, s.mean, ...(usesSpread(chart.kind) ? numbersOf(g.values) : [])]
  })
  const fromZero = startsAtZero(chart.kind)
  let lo = Math.min(...spans, fromZero ? 0 : Infinity)
  let hi = Math.max(...spans, fromZero ? 0 : -Infinity)
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) [lo, hi] = [0, 1]
  if (lo >= 0 && !fromZero && lo < hi * 0.3) lo = 0
  const auto = niceTicks(chart.yMin ?? lo, chart.yMax ?? hi)
  const min = chart.yMin ?? auto[0] ?? 0
  const max = chart.yMax ?? auto.at(-1) ?? 1
  if (!(max > min)) return { min, max: min + 1, ticks: [min, min + 1] }
  return { min, max, ticks: niceTicks(min, max).filter((t) => t >= min - 1e-9 && t <= max + 1e-9) }
}

/* Drawing */

/** What a text on the chart is, so a double-click on it can rename it. */
export type TextRole = { kind: 'group'; index: number } | { kind: 'title' | 'yTitle' | 'xTitle' | 'caption' | 'tick' | 'legend' | 'stats' }
export type ChartText = { text: string; x: number; y: number; size: number; colour: string; font: string; anchor: 'start' | 'middle' | 'end'; rotate?: boolean; bold?: boolean; role: TextRole }
export type ChartDrawing = {
  rects: { x: number; y: number; width: number; height: number; fill: string }[]
  lines: { x1: number; y1: number; x2: number; y2: number; colour: string; width: number }[]
  polylines: { points: { x: number; y: number }[]; colour: string; width: number }[]
  /** Closed shapes with a soft fill and an outline, such as violins. */
  polygons: { points: { x: number; y: number }[]; fill: string; stroke: string; width: number }[]
  dots: { x: number; y: number; r: number; fill: string; stroke?: string }[]
  texts: ChartText[]
  /** The plotting area and each group's slot (its width along the groups' axis), for the spacing handles. */
  plot: { left: number; top: number; width: number; height: number; band: number }
  /** The graph lies down: groups run down the side, so the spacing and width handles drag up and down. */
  horizontal: boolean
  /** The box each group's column covers (its bar, its dots, or its point and error bar), for the column-width handles. */
  columns: ({ x: number; y: number; width: number; height: number } | undefined)[]
}

/** How wide a text is in its font: the canvas measures it, tests use an estimate. */
export type Measure = (text: string, size: number, font: string, bold?: boolean) => number
export const roughMeasure: Measure = (text, size, _font, bold) => text.length * size * (bold ? 0.6 : 0.55)

export const TITLE_WEIGHT = 600

const formatTick = (value: number) => String(Number(value.toPrecision(6)))

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

const DOT_RADIUS = 3

/**
 * How far a group's column reaches either side of its middle: the bar, or
 * the spread of dots, a box or a violin; a line chart shows it as the width
 * of its error-bar caps, kept narrower than a bar, and a box or violin with
 * dots over it is narrower than the dots' own room.
 */
const COLUMN_SHARE: Partial<Record<ChartKind, number>> = { line: 0.5, slope: 0.5, 'dots-box': 0.55, 'dots-violin': 0.85 }
export const columnHalf = (kind: ChartKind, half: number) => half * (COLUMN_SHARE[uprightKind(kind)] ?? 1)

export function drawChart(source: ChartData, measure: Measure = roughMeasure): ChartDrawing {
  const chart = withDefaults(source)
  const horizontal = isHorizontal(chart.kind)
  const kind = uprightKind(chart.kind)
  type Shapes = Pick<ChartDrawing, 'rects' | 'lines' | 'polylines' | 'polygons' | 'dots' | 'columns'>
  // What is drawn on the plot is worked out upright (groups across, values up from a corner at 0, 0) in `v`,
  // then turned onto the page in `d`; axes, labels and the rest are placed on the page directly.
  const d: Omit<ChartDrawing, 'plot' | 'horizontal'> = { rects: [], lines: [], polylines: [], polygons: [], dots: [], texts: [], columns: [] }
  const v: Shapes = { rects: [], lines: [], polylines: [], polygons: [], dots: [], columns: [] }
  const starTexts: { text: string; x: number; y: number }[] = []
  const font = fontStack(fontByName(chart.fontFamily) ?? DEFAULT_FONT)
  const size = chart.fontSize
  const titleSize = size + 1
  const headSize = size + 3
  const axis = yAxis(chart)
  const ink = chart.axisColour
  const label = yLabel(chart)
  const text = (t: Omit<ChartText, 'size' | 'colour' | 'font'> & { size?: number }) => d.texts.push({ size, colour: ink, font, ...t })
  const tickWidth = chart.tickLabels ? Math.max(0, ...axis.ticks.map((t) => measure(formatTick(t), size, font))) : 0
  const legendItems = kind === 'line' || kind === 'slope' ? [{ name: chart.yTitle || 'Mean', colour: groupColour(chart, 0) }] : chart.groups.map((g, i) => ({ name: g.name, colour: groupColour(chart, i) }))
  const legendWidth = chart.legend ? Math.max(0, ...legendItems.map((item) => measure(item.name, size, font))) + size * 2.2 : 0

  // Significance: which pairs get a bracket, and how many rows of brackets that needs.
  const result =
    chart.test === 'none'
      ? undefined
      : runTest(
          chart.test,
          chart.groups.map((g) => g.values),
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
  const note = chart.test !== 'none' && chart.testNote ? (result?.note ?? 'Not enough data for the test.') : ''
  const captionText = [chart.caption.trim(), note].filter(Boolean).join('\n')
  const captionLines = captionText ? wrap(captionText, (line) => measure(line, captionSize, font) <= chart.width) : []
  const hasTitle = chart.title.trim() !== ''

  // Upright: the y axis title and numbers are on the left, group names under the plot, brackets above it.
  // Lying down: group names and their title are on the left, the numbers and the y axis title under the
  // plot, and the brackets stand to its right.
  const nameWidth = chart.tickLabels ? Math.max(0, ...chart.groups.map((g) => measure(g.name, size, font))) : 0
  const left = horizontal ? (chart.xTitle ? titleSize * 1.6 : 0) + (chart.tickLabels ? nameWidth + 8 : 6) : (label ? titleSize * 1.6 : 0) + tickWidth + 8
  const axisBottom = horizontal ? (chart.tickLabels ? size * 1.8 : 6) + (label ? titleSize * 1.6 : 0) : (chart.tickLabels ? size * 1.8 : 6) + (chart.xTitle ? titleSize * 1.6 : 0)
  const bottom = axisBottom + (hasTitle && chart.titlePosition === 'bottom' ? headSize * 1.6 : 0) + (captionLines.length ? captionLines.length * captionSize * 1.35 + captionSize * 0.4 : 0)
  const rightOfPlot = chart.legend ? legendWidth + 8 : size
  const overPlot = size * 0.8 + (hasTitle && chart.titlePosition === 'top' ? headSize * 1.6 : 0)
  // Along the groups: the brackets take room along the values only, so the groups' spacing is known before they're stacked.
  const groupLen = horizontal ? Math.max(chart.height - overPlot - bottom, 20) : Math.max(chart.width - left - rightOfPlot, 20)
  const band = groupLen / Math.max(chart.groups.length, 1)
  /** Where a group's middle sits along the plot's upright width. */
  const x = (i: number) => band * (i + 0.5)

  const brackets = bracketRows(pairs, { size, rowStep, horizontal, dots: chart.colouredBrackets, x })
  const bracketRowCount = Math.max(0, ...brackets.map((b) => b.row + 1))
  // Lying down, the outermost labels read on past their row.
  const labelReach = horizontal ? Math.max(0, ...brackets.map((b) => (b.row + 0.35) * rowStep + LABEL_SIDE * size + b.width)) : 0
  const bracketRoom = bracketRowCount > 0 ? Math.max(bracketRowCount * rowStep + size, labelReach + size * 0.5) : 0
  const right = rightOfPlot + (horizontal ? bracketRoom : 0)
  const top = overPlot + (horizontal ? 0 : bracketRowCount * rowStep)
  const w = horizontal ? Math.max(chart.width - left - right, 20) : groupLen
  const h = horizontal ? groupLen : Math.max(chart.height - top - bottom, 20)
  // Along the values.
  const valueLen = horizontal ? w : h
  /** Where a value sits along the plot's upright height (0 at the top). */
  const y = (value: number) => valueLen - ((Math.min(Math.max(value, axis.min), axis.max) - axis.min) / (axis.max - axis.min)) * valueLen
  const half = (band * Math.min(Math.max(chart.barWidth, 0.1), 0.95)) / 2
  const cap = kind === 'line' || kind === 'slope' ? columnHalf('line', half) : Math.min(half * 0.5, 6)

  // Axes and tick marks, on the page.
  d.lines.push({ x1: left, y1: top, x2: left, y2: top + h, colour: ink, width: 1 })
  d.lines.push({ x1: left, y1: top + h, x2: left + w, y2: top + h, colour: ink, width: 1 })
  for (const t of axis.ticks) {
    if (horizontal) {
      const tx = left + valueLen - y(t)
      d.lines.push({ x1: tx, y1: top + h, x2: tx, y2: top + h + 4, colour: ink, width: 1 })
      if (chart.tickLabels) text({ text: formatTick(t), x: tx, y: top + h + 6 + size, anchor: 'middle', role: { kind: 'tick' } })
    } else {
      d.lines.push({ x1: left - 4, y1: top + y(t), x2: left, y2: top + y(t), colour: ink, width: 1 })
      if (chart.tickLabels) text({ text: formatTick(t), x: left - 6, y: top + y(t) + size * 0.35, anchor: 'end', role: { kind: 'tick' } })
    }
  }
  if (label) {
    if (horizontal) {
      const lx = chart.yTitleAlign === 'left' ? left : chart.yTitleAlign === 'right' ? left + w : left + w / 2
      text({ text: label, x: lx, y: top + h + axisBottom - titleSize * 0.4, size: titleSize, anchor: chart.yTitleAlign === 'left' ? 'start' : chart.yTitleAlign === 'right' ? 'end' : 'middle', role: { kind: 'yTitle' } })
    } else {
      const along = measure(label, titleSize, font) / 2
      const ly = chart.yTitleAlign === 'left' ? top + h - along : chart.yTitleAlign === 'right' ? top + along : top + h / 2
      text({ text: label, x: titleSize * 0.9, y: ly, size: titleSize, anchor: 'middle', rotate: true, role: { kind: 'yTitle' } })
    }
  }
  if (chart.xTitle) {
    if (horizontal) text({ text: chart.xTitle, x: titleSize * 0.9, y: top + h / 2, size: titleSize, anchor: 'middle', rotate: true, role: { kind: 'xTitle' } })
    else text({ text: chart.xTitle, x: left + w / 2, y: top + h + axisBottom - titleSize * 0.4, size: titleSize, anchor: 'middle', role: { kind: 'xTitle' } })
  }

  const barLike = kind === 'bar' || kind === 'dots-bars'
  const colHalf = columnHalf(kind, half)
  // Violins share one scale, so a wider one holds more values.
  const profiles = chart.groups.map((g) => (kind === 'violin' || kind === 'dots-violin' ? violinProfile(numbersOf(g.values)) : []))
  const densest = Math.max(1e-9, ...profiles.flat().map((p) => p.density))
  const means: { x: number; y: number }[] = []
  chart.groups.forEach((g, i) => {
    const s = stats(g.values)
    const c = groupColour(chart, kind === 'line' || kind === 'slope' ? 0 : i)
    if (chart.tickLabels) {
      if (horizontal) text({ text: g.name, x: left - 6, y: top + x(i) + size * 0.35, anchor: 'end', role: { kind: 'group', index: i } })
      else text({ text: g.name, x: left + x(i), y: top + h + 6 + size, anchor: 'middle', role: { kind: 'group', index: i } })
    }
    if (!s) return
    const values = numbersOf(g.values)
    const box = boxStats(values)!
    const mid = x(i)
    const bounds = errorBounds(chart, values, s)
    const base = y(Math.max(axis.min, Math.min(0, axis.max)))
    if (barLike) {
      const bar = { x: mid - half, y: Math.min(y(s.mean), base), width: half * 2, height: Math.abs(base - y(s.mean)) }
      v.rects.push({ ...bar, fill: kind === 'bar' ? c : tint(c, 0.55) })
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
    const low = barLike ? Math.max(axis.min, Math.min(0, axis.max)) : Math.min(bounds?.low ?? s.mean, s.mean, ...spread)
    const high = barLike ? Math.max(s.mean, ...spread) : Math.max(bounds?.high ?? s.mean, s.mean, ...spread)
    const pad = kind === 'bar' ? 0 : DOT_RADIUS
    v.columns[i] = { x: mid - colHalf, y: Math.min(y(high), y(low)) - pad, width: colHalf * 2, height: Math.abs(y(low) - y(high)) + pad * 2 }
    if (bounds && bounds.high !== bounds.low) {
      // A bar chart's error bar only goes up, as is usual in papers.
      const low = barLike && !chart.errorInside ? s.mean : bounds.low
      v.lines.push({ x1: mid, y1: y(bounds.high), x2: mid, y2: y(low), colour: ink, width: 1 })
      v.lines.push({ x1: mid - cap, y1: y(bounds.high), x2: mid + cap, y2: y(bounds.high), colour: ink, width: 1 })
      if (!barLike || chart.errorInside) v.lines.push({ x1: mid - cap, y1: y(low), x2: mid + cap, y2: y(low), colour: ink, width: 1 })
    }
  })
  if (kind === 'line' || kind === 'slope') {
    const c = groupColour(chart, 0)
    if (means.length > 1) v.polylines.push({ points: means, colour: c, width: 1.5 })
    // A slope's markers are open: white with an outline in the line's colour.
    for (const m of means) v.dots.push({ x: m.x, y: m.y, r: DOT_RADIUS, fill: kind === 'slope' ? '#ffffff' : c, ...(kind === 'slope' ? { stroke: c } : {}) })
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
  // A bracket's stars sit over its middle, or beside it when it stands at the plot's right.
  for (const t of starTexts) {
    const at = map(t.x, t.y)
    if (horizontal) text({ text: t.text, x: at.x + size * LABEL_SIDE, y: at.y + size * 0.35, anchor: 'start', role: { kind: 'stats' } })
    else text({ text: t.text, x: at.x, y: at.y - size * LABEL_LIFT, anchor: 'middle', role: { kind: 'stats' } })
  }

  if (chart.legend)
    legendItems.forEach((item, i) => {
      const ly = top + size * 0.6 + i * size * 1.6
      const lx = chart.width - legendWidth
      d.rects.push({ x: lx, y: ly - size * 0.4, width: size * 0.8, height: size * 0.8, fill: item.colour })
      text({ text: item.name, x: lx + size * 1.3, y: ly + size * 0.35, anchor: 'start', role: { kind: 'legend' } })
    })

  if (hasTitle) {
    const tx = chart.titleAlign === 'left' ? 0 : chart.titleAlign === 'right' ? chart.width : chart.width / 2
    const ty = chart.titlePosition === 'top' ? headSize : top + h + axisBottom + headSize * 1.3
    const anchor = chart.titleAlign === 'left' ? 'start' : chart.titleAlign === 'right' ? 'end' : 'middle'
    text({ text: chart.title.trim(), x: tx, y: ty, size: headSize, bold: true, anchor, role: { kind: 'title' } })
  }
  const captionTop = chart.height - captionLines.length * captionSize * 1.35
  const captionX = chart.captionAlign === 'left' ? 0 : chart.captionAlign === 'right' ? chart.width : chart.width / 2
  const captionAnchor = chart.captionAlign === 'left' ? 'start' : chart.captionAlign === 'right' ? 'end' : 'middle'
  captionLines.forEach((line, i) => text({ text: line, x: captionX, y: captionTop + captionSize * (1 + i * 1.35), size: captionSize, anchor: captionAnchor, role: { kind: 'caption' } }))
  return { ...d, plot: { left, top, width: w, height: h, band }, horizontal }
}

/** Where a text starts, since exported text is outlined from its left end. */
export const textLeft = (t: ChartText, width: number) => (t.anchor === 'start' ? t.x : t.anchor === 'middle' ? t.x - width / 2 : t.x - width)

/** The box a text covers, in the chart's own space, for hitting it with a double-click. */
export function textBox(t: ChartText, measure: Measure): { x: number; y: number; width: number; height: number } {
  const width = measure(t.text, t.size, t.font, t.bold)
  if (t.rotate) return { x: t.x - t.size * 0.9, y: t.y - width / 2, width: t.size * 1.4, height: width }
  return { x: textLeft(t, width), y: t.y - t.size, width, height: t.size * 1.3 }
}

const escapeXml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const n = (value: number) => String(Math.round(value * 100) / 100)

/** The chart as plain SVG shapes and text, in its own space moved by `origin`. */
export function chartSvg(chart: ChartData, measure: Measure = roughMeasure, origin = { x: 0, y: 0 }): string[] {
  const d = drawChart(chart, measure)
  const x = (value: number) => n(value + origin.x)
  const y = (value: number) => n(value + origin.y)
  const out: string[] = []
  for (const r of d.rects) out.push(`<rect x="${x(r.x)}" y="${y(r.y)}" width="${n(r.width)}" height="${n(r.height)}" fill="${r.fill}" />\n`)
  for (const p of d.polylines) out.push(`<polyline points="${p.points.map((pt) => `${x(pt.x)},${y(pt.y)}`).join(' ')}" fill="none" stroke="${p.colour}" stroke-width="${n(p.width)}" stroke-linejoin="round" />\n`)
  for (const g of d.polygons) out.push(`<polygon points="${g.points.map((pt) => `${x(pt.x)},${y(pt.y)}`).join(' ')}" fill="${g.fill}" stroke="${g.stroke}" stroke-width="${n(g.width)}" stroke-linejoin="round" />\n`)
  for (const l of d.lines) out.push(`<line x1="${x(l.x1)}" y1="${y(l.y1)}" x2="${x(l.x2)}" y2="${y(l.y2)}" stroke="${l.colour}" stroke-width="${n(l.width)}" stroke-linecap="square" />\n`)
  for (const dot of d.dots) out.push(`<circle cx="${x(dot.x)}" cy="${y(dot.y)}" r="${n(dot.r)}" fill="${dot.fill}"${dot.stroke ? ` stroke="${dot.stroke}"` : ''} />\n`)
  for (const t of d.texts) {
    const width = measure(t.text, t.size, t.font, t.bold)
    const weight = t.bold ? ` font-weight="${TITLE_WEIGHT}"` : ''
    const text = (tx: number, ty: number) => `<text x="${n(tx)}" y="${n(ty)}" font-family="${escapeXml(t.font)}" font-size="${n(t.size)}"${weight} fill="${t.colour}" xml:space="preserve">${escapeXml(t.text)}</text>`
    if (t.rotate) out.push(`<g transform="translate(${x(t.x)} ${y(t.y)}) rotate(-90)">${text(-width / 2, t.size * 0.35)}</g>\n`)
    else out.push(`${text(textLeft(t, width) + origin.x, t.y + origin.y)}\n`)
  }
  return out
}
