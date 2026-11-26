/**
 * The heatmap chart: a matrix of coloured cells, with names along its rows and
 * columns, such as gene expression across samples or the correlations between
 * drivers. It keeps its numbers like every chart (one group per column, a
 * value per row), plus the rows' names in `rowNames`; its own settings live in
 * `heatmap`. Its values are either the numbers as typed, or the correlation of
 * every column with every other one (Pearson or Spearman) worked out from them.
 *
 * Drawn from the same plain shapes as the other charts (see chart-model), so it
 * stays vector in SVG and PDF export. The colours and the colour bar come from
 * chart-colour-scale, shared with other charts that colour by value.
 */
import { colourBar, colourScale, formatValue, textColourOn, type ColourScale, type ColourScaleId } from './chart-colour-scale'
import { fitGroupLabels, fitText, MIN_TEXT, pasteInto, parseNumber, rowCount, yLabel, type ChartData, type ChartDrawing, type ChartGroup, type ChartText, type Measure, type TextRole } from './chart-model'
import { orient, type Table } from './data-import'
import type { ImportChoice } from './data-import'
import { DEFAULT_FONT, fontByName, fontStack } from './fonts'

/** What the cells show: the numbers as typed, or the correlation of each column with each other one. */
export type HeatmapValues = 'typed' | 'pearson' | 'spearman'

export type HeatmapSettings = {
  values: HeatmapValues
  scale: ColourScaleId
  /** The colour range; null ends are worked out from the values (-1 to 1 for correlations). */
  min: number | null
  max: number | null
  /** Two-sided scales: the value at the neutral middle. */
  centre: number
  /** Two-sided scales: the range reaches as far below the centre as above it. */
  symmetric: boolean
  /** Each cell's number printed in it. */
  cellValues: boolean
  decimals: number
  colourBar: boolean
  /** The colour bar's title, such as "Pearson r". */
  barTitle: string
}

export const HEATMAP_DEFAULTS: HeatmapSettings = {
  values: 'typed',
  scale: 'viridis',
  min: null,
  max: null,
  centre: 0,
  symmetric: true,
  cellValues: false,
  decimals: 2,
  colourBar: true,
  barTitle: '',
}

/** A chart's heatmap settings, with any it predates filled in. */
export const heatmapSettings = (chart: ChartData): HeatmapSettings => ({ ...HEATMAP_DEFAULTS, ...chart.heatmap })

/** The numbers and names a new heatmap starts with: expression of six genes across four samples. */
export function heatmapStart(): Pick<ChartData, 'groups' | 'rowNames' | 'yTitle' | 'heatmap'> {
  return {
    groups: [
      { name: 'Control 1', values: [8.1, 5.2, 3.4, 9.8, 6.1, 2.2] },
      { name: 'Control 2', values: [7.8, 5.6, 3.1, 9.5, 6.4, 2.6] },
      { name: 'Treated 1', values: [4.2, 8.9, 7.7, 9.1, 3.3, 6.8] },
      { name: 'Treated 2', values: [3.9, 9.3, 8.2, 8.8, 2.9, 7.4] },
    ],
    rowNames: ['GAPDH', 'IL6', 'TNF', 'ACTB', 'SOX2', 'CXCL8'],
    yTitle: '',
    heatmap: { ...HEATMAP_DEFAULTS, barTitle: 'log₂ expression' },
  }
}

/* The numbers */

/** The rows where both lists have a number, as two lists of numbers. */
function pairs(x: readonly (number | null)[], y: readonly (number | null)[]): [number[], number[]] {
  const a: number[] = []
  const b: number[] = []
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    const p = x[i]
    const q = y[i]
    if (typeof p === 'number' && Number.isFinite(p) && typeof q === 'number' && Number.isFinite(q)) {
      a.push(p)
      b.push(q)
    }
  }
  return [a, b]
}

/** Pearson's r of two lists of numbers of the same length, or null when it can't be worked out (under two pairs, or no spread). */
function pearsonOf(a: number[], b: number[]): number | null {
  const n = a.length
  if (n < 2) return null
  const ma = a.reduce((s, v) => s + v, 0) / n
  const mb = b.reduce((s, v) => s + v, 0) / n
  let sab = 0
  let saa = 0
  let sbb = 0
  for (let i = 0; i < n; i++) {
    const da = (a[i] ?? 0) - ma
    const db = (b[i] ?? 0) - mb
    sab += da * db
    saa += da * da
    sbb += db * db
  }
  if (saa === 0 || sbb === 0) return null
  return Math.max(-1, Math.min(1, sab / Math.sqrt(saa * sbb)))
}

/** Ranks from 1, ties sharing the mean of their ranks. */
export function ranks(values: readonly number[]): number[] {
  const order = values.map((v, i) => ({ v, i })).sort((p, q) => p.v - q.v)
  const out = Array.from({ length: values.length }, () => 0)
  for (let start = 0; start < order.length; ) {
    let end = start
    while (end + 1 < order.length && order[end + 1]?.v === order[start]?.v) end++
    const rank = (start + end) / 2 + 1
    for (let k = start; k <= end; k++) out[order[k]?.i ?? 0] = rank
    start = end + 1
  }
  return out
}

/** Pearson's r of two columns, using the rows where both have a number. */
export const pearson = (x: readonly (number | null)[], y: readonly (number | null)[]) => pearsonOf(...pairs(x, y))

/** Spearman's ρ: Pearson's r of the ranks (ties share their mean rank), using the rows where both have a number. */
export function spearman(x: readonly (number | null)[], y: readonly (number | null)[]): number | null {
  const [a, b] = pairs(x, y)
  return pearsonOf(ranks(a), ranks(b))
}

/** Every column's correlation with every other one: entry [i][j] is the correlation of columns i and j (1 on the diagonal, when a column has spread). */
export function correlationMatrix(columns: readonly (readonly (number | null)[])[], method: 'pearson' | 'spearman'): (number | null)[][] {
  const correlate = method === 'pearson' ? pearson : spearman
  return columns.map((x, i) => columns.map((y, j) => (j < i ? null : correlate(x, y)))).map((row, i, all) => row.map((value, j) => (j < i ? (all[j]?.[i] ?? null) : value)))
}

/** The matrix a heatmap draws: its rows' and columns' names, and cells[row][column] (null when empty). */
export type HeatMatrix = { rows: string[]; columns: string[]; cells: (number | null)[][] }

export const rowName = (chart: ChartData, r: number) => chart.rowNames?.[r]?.trim() || `Row ${r + 1}`

export function heatmapMatrix(chart: ChartData): HeatMatrix {
  const settings = heatmapSettings(chart)
  const columns = chart.groups.map((g, i) => g.name.trim() || `Column ${i + 1}`)
  if (settings.values !== 'typed') return { rows: columns, columns, cells: correlationMatrix(chart.groups.map((g) => g.values), settings.values) }
  const rows = rowCount(chart)
  return {
    rows: Array.from({ length: rows }, (_, r) => rowName(chart, r)),
    columns,
    cells: Array.from({ length: rows }, (_, r) => chart.groups.map((g) => g.values[r] ?? null)),
  }
}

/** The heatmap's colour scale, fitted to its cells. Correlations run from -1 to 1 unless a range is typed. */
export function heatmapScale(chart: ChartData, matrix = heatmapMatrix(chart)): ColourScale {
  const s = heatmapSettings(chart)
  return colourScale({ scale: s.scale, min: s.min, max: s.max, centre: s.centre, symmetric: s.symmetric }, matrix.cells.flat(), s.values === 'typed' ? undefined : { min: -1, max: 1 })
}

/* Data in and out */

/** A rows' name changed in the data table. */
export function renameRow(chart: ChartData, r: number, name: string): ChartData {
  const rowNames = Array.from({ length: Math.max(rowCount(chart), r + 1, chart.rowNames?.length ?? 0) }, (_, i) => chart.rowNames?.[i] ?? '')
  rowNames[r] = name
  return { ...chart, rowNames }
}

const isText = (cell: string) => cell.trim() !== '' && parseNumber(cell) === null

/**
 * A block copied from a spreadsheet, read as a matrix: column names in the
 * first row when it has text over the numbers, row names in the first column
 * when it has text beside them (or `rowNames` says so). Empty and unreadable
 * cells are null.
 */
export function parseMatrix(text: string, rowNames?: boolean): { groups: ChartGroup[]; rowNames: string[] | undefined; header: boolean } {
  const lines = text
    .replace(/\r/g, '')
    .split('\n')
    .filter((row, i, all) => row.trim() !== '' || i < all.length - 1)
  const cells = lines.map((row) => row.split(row.includes('\t') ? '\t' : /;|,(?=\D)|\s{2,}/))
  const header = cells[0]?.slice(1).some(isText) ?? false
  const body = header ? cells.slice(1) : cells
  const named = rowNames ?? body.some((row) => isText(row[0] ?? ''))
  const first = named ? 1 : 0
  const cols = Math.max(0, ...cells.map((row) => row.length)) - first
  return {
    groups: Array.from({ length: Math.max(cols, 0) }, (_, c) => ({
      name: header ? (cells[0]?.[c + first] ?? '').trim() || `Column ${c + 1}` : `Column ${c + 1}`,
      values: body.map((row) => parseNumber(row[c + first] ?? '')),
    })),
    rowNames: named ? body.map((row) => (row[0] ?? '').trim()) : undefined,
    header,
  }
}

/**
 * Paste a block into a heatmap's table at a cell (`c` -1 is the row names'
 * column). A block with row names pasted at the top-left replaces the whole
 * table; elsewhere its numbers go in from that cell and its names onto those
 * rows. A block of plain numbers pastes as in every chart.
 */
export function pasteHeatmap(chart: ChartData, text: string, at: { r: number; c: number }): ChartData {
  const matrix = parseMatrix(text, at.c < 0 ? true : undefined)
  // A block with column names but no row names, pasted at the top, replaces the table: the old rows' names go with it.
  if (!matrix.rowNames) return matrix.header && at.r === 0 && at.c <= 0 ? { ...pasteInto(chart, text, { r: 0, c: 0 }), rowNames: undefined } : pasteInto(chart, text, at)
  if (matrix.groups.length > 0 && at.r === 0 && at.c <= 0 && (matrix.header || at.c < 0 || chart.groups.length <= matrix.groups.length)) {
    return { ...chart, groups: matrix.groups, rowNames: matrix.rowNames }
  }
  const body = matrix.groups.length ? matrix.groups.map((g) => g.values) : []
  const numbers = matrix.rowNames.map((_, r) => body.map((values) => (values[r] === null || values[r] === undefined ? '' : String(values[r]))).join('\t')).join('\n')
  let next = numbers.trim() ? pasteInto(chart, numbers, { r: at.r, c: Math.max(at.c, 0) }) : chart
  matrix.rowNames.forEach((name, i) => (next = renameRow(next, at.r + i, name)))
  return next
}

/** Row names for data imported into a heatmap: the first column left out of the import, when it holds text (as names usually do). */
export function importedRowNames(rows: Table, choice: Pick<ImportChoice, 'header' | 'orientation' | 'leftOut'>): string[] | undefined {
  const lines = orient(rows, choice.orientation)
  const body = choice.header ? lines.slice(1) : lines
  const column = [...choice.leftOut].sort((a, b) => a - b)[0]
  if (column === undefined || !body.some((row) => isText(row[column] ?? ''))) return undefined
  return body.map((row) => (row[column] ?? '').trim())
}

/* Drawing */

const LINE = 1.2

/**
 * A heatmap's picture: the cells in a grid filling the plot, row names on the
 * left (and the y axis title beside them), column names under the grid
 * (smaller, on two lines, then tilted when crowded, as group names are), the
 * colour bar on the right, the chart's name and the text under it as in every
 * chart. Empty cells are a neutral grey. Printed values get black or white,
 * whichever reads better on their cell, and are left out when even the
 * smallest text wouldn't fit inside the cells.
 */
export function drawHeatmap(chart: ChartData, measure: Measure): ChartDrawing {
  const settings = heatmapSettings(chart)
  const matrix = heatmapMatrix(chart)
  const scale = heatmapScale(chart, matrix)
  const font = fontStack(fontByName(chart.fontFamily) ?? DEFAULT_FONT)
  const size = chart.fontSize
  const titleSize = size + 1
  const headSize = size + 3
  const ink = chart.axisColour
  const width = (line: string, s: number) => measure(line, s, font)
  const texts: ChartText[] = []
  const rects: ChartDrawing['rects'] = []
  const lines: ChartDrawing['lines'] = []
  const text = (t: Omit<ChartText, 'size' | 'colour' | 'font'> & { size?: number; colour?: string }) => texts.push({ size, colour: ink, font, ...t })
  const nRows = Math.max(matrix.rows.length, 1)
  const nCols = Math.max(matrix.columns.length, 1)
  // In a correlation matrix the rows are the columns too, so a row's name renames its column.
  const rowRole = (r: number): TextRole => (settings.values === 'typed' ? { kind: 'tick' } : { kind: 'group', index: r })

  const head = fitText(chart.title.trim(), chart.width, headSize, Math.max(MIN_TEXT, headSize * 0.7), (line, s) => measure(line, s, font, true))
  const headBlock = head.lines.length ? headSize * 0.4 + head.lines.length * head.size * LINE : 0
  const captionSize = size - 1
  const captionLines = chart.caption.trim() ? fitText(chart.caption.trim(), chart.width, captionSize, captionSize, width).lines : []
  const captionBlock = captionLines.length ? captionLines.length * captionSize * 1.35 + captionSize * 0.4 : 0
  const top = size * 0.6 + (chart.titlePosition === 'top' ? headBlock : 0)
  const bottomExtra = (chart.titlePosition === 'bottom' ? headBlock : 0) + captionBlock
  const titleDepth = (fit: { size: number; lines: string[] }) => (fit.lines.length ? fit.size * 0.6 + fit.lines.length * fit.size * LINE : 0)

  // Row names: one size for all, smaller (down to 70%) when the longest takes more than a third of the chart.
  const rowRoom = chart.width * 0.33
  const widestRow = Math.max(0, ...matrix.rows.map((name) => width(name, size)))
  const rowSize = chart.tickLabels ? Math.max(Math.min(size, (size * rowRoom) / Math.max(widestRow, 1e-6)), Math.min(size, Math.max(MIN_TEXT, size * 0.7))) : size
  const rowDepth = chart.tickLabels ? Math.max(0, ...matrix.rows.map((name) => width(name, rowSize))) + 6 : 2

  /** The layout for a guess of the grid's height: the bar's room depends on its ticks, and the column names on the grid's width. */
  const plan = (gridHeight: number) => {
    const yFit = fitText(yLabel(chart), Math.max(gridHeight, 20), titleSize, Math.max(MIN_TEXT, titleSize * 0.7), width, 2)
    const bar = settings.colourBar ? colourBar(scale, { height: Math.max(gridHeight, 20), size, font, ink, title: settings.barTitle, measure }) : undefined
    const left = titleDepth(yFit) + rowDepth
    const right = bar ? bar.width + size * 1.2 : size * 0.3
    const w = Math.max(chart.width - left - right, 20)
    const band = w / nCols
    const names = chart.tickLabels ? fitGroupLabels(matrix.columns, band, size, width, chart.height * 0.35) : { size, lines: [] as string[][], angle: 0 as const, depth: 4, reach: 0 }
    const xFit = fitText(chart.xTitle, w, titleSize, Math.max(MIN_TEXT, titleSize * 0.7), width, 2)
    const h = Math.max(chart.height - top - names.depth - titleDepth(xFit) - bottomExtra, 20)
    return { yFit, xFit, bar, left, w, band, names, h }
  }
  let layout = plan(chart.height * 0.6)
  for (let round = 0; round < 3; round++) {
    const next = plan(layout.h)
    const settled = Math.abs(next.h - layout.h) < 0.5
    layout = next
    if (settled) break
  }
  const { yFit, xFit, bar, left, w, band, names, h } = layout
  const cellW = w / nCols
  const cellH = h / nRows
  // A hairline of white between cells keeps them apart, and hides the seams screens draw between touching shapes.
  const gap = Math.min(1, cellW * 0.06, cellH * 0.06)

  // The size printed values get: what fits the widest one inside a cell, at most the chart's text size; none below the smallest text.
  const shown = settings.cellValues ? matrix.cells.flat().filter((v): v is number => v !== null).map((v) => formatValue(v, settings.decimals)) : []
  const widestValue = Math.max(0, ...shown.map((t) => width(t, size)))
  const valueSize = Math.min(size, ((cellW - gap) * 0.86 * size) / Math.max(widestValue, 1e-6), (cellH - gap) * 0.7)
  const printValues = shown.length > 0 && valueSize >= MIN_TEXT - 1e-9

  matrix.cells.forEach((row, r) =>
    matrix.columns.forEach((_, c) => {
      const value = row[c] ?? null
      const fill = scale.colour(value)
      const x = left + c * cellW
      const y = top + r * cellH
      rects.push({ x: x + gap / 2, y: y + gap / 2, width: Math.max(cellW - gap, 0.1), height: Math.max(cellH - gap, 0.1), fill })
      if (printValues && value !== null) text({ text: formatValue(value, settings.decimals), x: x + cellW / 2, y: y + cellH / 2 + valueSize * 0.35, size: valueSize, colour: textColourOn(fill), anchor: 'middle', role: { kind: 'tick' } })
    }),
  )

  if (chart.tickLabels) {
    matrix.rows.forEach((name, r) => text({ text: name, x: left - 6, y: top + (r + 0.5) * cellH + rowSize * 0.35, size: rowSize, anchor: 'end', role: rowRole(r) }))
    matrix.columns.forEach((name, c) => {
      const s = names.size
      const mid = left + (c + 0.5) * band
      const role = { kind: 'group', index: c } as const
      if (names.angle === -45) text({ text: name, x: mid + s * 0.3, y: top + h + 6 + s * 0.8, size: s, anchor: 'end', angle: -45, role })
      else if (names.angle === -90) text({ text: name, x: mid + s * 0.35, y: top + h + 6, size: s, anchor: 'end', angle: -90, role })
      else (names.lines[c] ?? [name]).forEach((line, j) => text({ text: line, x: mid, y: top + h + 6 + s * (1 + j * LINE), size: s, anchor: 'middle', role }))
    })
  }
  // Axis titles: the y title standing at the left edge, the x title under the column names.
  yFit.lines.forEach((line, i) => text({ text: line, x: yFit.size * (0.9 + i * LINE), y: top + h / 2, size: yFit.size, anchor: 'middle', rotate: true, role: { kind: 'yTitle' } }))
  const xTop = top + h + names.depth
  xFit.lines.forEach((line, i) => text({ text: line, x: left + w / 2, y: xTop + xFit.size * (0.35 + (i + 1) * LINE), size: xFit.size, anchor: 'middle', role: { kind: 'xTitle' } }))

  if (bar) {
    const drawn = bar.draw({ x: left + w + size * 1.2, y: top })
    rects.push(...drawn.rects)
    lines.push(...drawn.lines)
    texts.push(...drawn.texts)
  }

  if (head.lines.length) {
    const tx = chart.titleAlign === 'left' ? 0 : chart.titleAlign === 'right' ? chart.width : chart.width / 2
    const ty = chart.titlePosition === 'top' ? head.size : top + h + names.depth + titleDepth(xFit) + head.size * 1.3
    const anchor = chart.titleAlign === 'left' ? 'start' : chart.titleAlign === 'right' ? 'end' : 'middle'
    head.lines.forEach((line, i) => text({ text: line, x: tx, y: ty + i * head.size * LINE, size: head.size, bold: true, anchor, role: { kind: 'title' } }))
  }
  const captionTop = chart.height - captionLines.length * captionSize * 1.35
  const captionX = chart.captionAlign === 'left' ? 0 : chart.captionAlign === 'right' ? chart.width : chart.width / 2
  const captionAnchor = chart.captionAlign === 'left' ? 'start' : chart.captionAlign === 'right' ? 'end' : 'middle'
  captionLines.forEach((line, i) => text({ text: line, x: captionX, y: captionTop + captionSize * (1 + i * 1.35), size: captionSize, anchor: captionAnchor, role: { kind: 'caption' } }))

  return { rects, lines, gridLines: [], polylines: [], polygons: [], dots: [], texts, plot: { left, top, width: w, height: h, band }, horizontal: false, crowded: false, columns: [] }
}
