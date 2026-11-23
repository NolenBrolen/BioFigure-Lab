/**
 * A table as plain data, and everything you can do to it: add and remove rows
 * and columns, merge cells, paste a block from a spreadsheet, move between
 * cells with the keyboard, and draw it (on the canvas and as SVG). Every
 * change returns a new table, so undo can keep the old one as it is.
 * Sizes are in page pixels; the table's own space starts at its top-left corner.
 */
import type { TableLayout, TableLook } from '@biofigure-lab/ui/components/table-panel/TablePanel'

import { DEFAULT_FONT, fontByName, fontStack } from './fonts'
import { mmToPx } from './units'

export type { TableLayout, TableLook }
/** `rules`: a line at the top, one under the header and one at the bottom, as in journals. */
export type Borders = 'none' | 'outer' | 'all' | 'horizontal' | 'rules'
export type HeaderStyle = 'plain' | 'bold' | 'filled'
export type Align = 'left' | 'center' | 'right'

export type Cell = { text: string; fill?: string; align?: Align; bold?: boolean }
/** A block of cells drawn as one; the text of its top-left cell is shown. */
export type Merge = { r: number; c: number; rows: number; cols: number }
/** A block of cells, both corners included. */
export type CellRange = { r0: number; c0: number; r1: number; c1: number }

export type TableData = {
  colWidths: number[]
  rowHeights: number[]
  cells: Cell[][]
  merges: Merge[]
  look: TableLook
  headerRow: boolean
  headerCol: boolean
  striped: boolean
  borders: Borders
  header: HeaderStyle
  fontSize: number
  /** The font's name, e.g. "Source Serif 4". Tables from before fonts could be picked are Inter. */
  fontFamily?: string
  textColour: string
  lineColour: string
  lineWidth: number
  headerFill: string
  headerText: string
  stripeFill: string
  /** The background of the other cells. Tables from before it was added count as white. */
  cellFill?: string
}

const LOOK_STYLE: Record<TableLook, Pick<TableData, 'borders' | 'header' | 'lineColour' | 'headerFill' | 'headerText' | 'stripeFill' | 'textColour'>> = {
  classic: { borders: 'all', header: 'filled', lineColour: '#a3a3a3', headerFill: '#e5e5e5', headerText: '#111827', stripeFill: '#f3f4f6', textColour: '#111827' },
  soft: { borders: 'none', header: 'filled', lineColour: '#cbd5e1', headerFill: '#0072b2', headerText: '#ffffff', stripeFill: '#eef2f7', textColour: '#111827' },
  journal: { borders: 'rules', header: 'bold', lineColour: '#404040', headerFill: '#e5e5e5', headerText: '#000000', stripeFill: '#f3f4f6', textColour: '#000000' },
}

const LAYOUT_FLAGS: Record<TableLayout, Pick<TableData, 'headerRow' | 'headerCol' | 'striped'>> = {
  grid: { headerRow: false, headerCol: false, striped: false },
  header: { headerRow: true, headerCol: false, striped: false },
  'header-col': { headerRow: true, headerCol: true, striped: false },
  striped: { headerRow: true, headerCol: false, striped: true },
}

/** What the table tool places: the picks from the Table panel. */
export type TableChoice = { rows: number; cols: number; layout: TableLayout; look: TableLook }
export const DEFAULT_TABLE_CHOICE: TableChoice = { rows: 4, cols: 3, layout: 'header', look: 'classic' }

/** Cells are solid white unless filled otherwise, so what's behind the table doesn't show through. */
export const DEFAULT_CELL_FILL = '#ffffff'

export const DEFAULT_COL_WIDTH = mmToPx(22)
/**
 * The column width a table placed by a click starts with on a page this wide
 * (page pixels): the default 22 mm, narrower when the table would take more
 * than 60% of the page, but never so narrow that a short word no longer fits.
 */
export const colWidthForPage = (pageWidth: number, cols: number) => Math.max(mmToPx(15), Math.min(DEFAULT_COL_WIDTH, (pageWidth * 0.6) / cols))
export const DEFAULT_FONT_SIZE = 12
/** The smallest a row can be for its text size, and the smallest column. */
export const minRowHeight = (fontSize: number) => Math.round(fontSize * 1.8)
export const MIN_COL_WIDTH = 12
export const CELL_PADDING = 6

const emptyRow = (cols: number): Cell[] => Array.from({ length: cols }, () => ({ text: '' }))

export function createTable(rows: number, cols: number, layout: TableLayout = 'header', look: TableLook = 'classic', size?: { width: number; height: number }): TableData {
  const fontSize = DEFAULT_FONT_SIZE
  const colWidth = size ? Math.max(MIN_COL_WIDTH, size.width / cols) : DEFAULT_COL_WIDTH
  const rowHeight = size ? Math.max(minRowHeight(fontSize), size.height / rows) : minRowHeight(fontSize)
  return {
    colWidths: Array.from({ length: cols }, () => colWidth),
    rowHeights: Array.from({ length: rows }, () => rowHeight),
    cells: Array.from({ length: rows }, () => emptyRow(cols)),
    merges: [],
    look,
    ...LAYOUT_FLAGS[layout],
    ...LOOK_STYLE[look],
    fontSize,
    lineWidth: 1,
    cellFill: DEFAULT_CELL_FILL,
  }
}

export const rowCount = (t: TableData) => t.rowHeights.length
export const colCount = (t: TableData) => t.colWidths.length
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0)
export const tableSize = (t: TableData) => ({ width: sum(t.colWidths), height: sum(t.rowHeights) })

export function layoutOf(t: TableData): TableLayout {
  if (t.striped) return 'striped'
  if (t.headerCol) return 'header-col'
  return t.headerRow ? 'header' : 'grid'
}
export const withLayout = (t: TableData, layout: TableLayout): TableData => ({ ...t, ...LAYOUT_FLAGS[layout] })
export const withLook = (t: TableData, look: TableLook): TableData => ({ ...t, look, ...LOOK_STYLE[look] })

/* Cells and merges */

const inMerge = (m: Merge, r: number, c: number) => r >= m.r && r < m.r + m.rows && c >= m.c && c < m.c + m.cols
export const mergeAt = (t: TableData, r: number, c: number) => t.merges.find((m) => inMerge(m, r, c))

/** The top-left cell of the merged block this cell belongs to (itself when not merged). */
export function anchorOf(t: TableData, r: number, c: number): { r: number; c: number } {
  const m = mergeAt(t, r, c)
  return m ? { r: m.r, c: m.c } : { r, c }
}

/** Where a cell (with its merge) sits in the table's own space. */
export function cellBox(t: TableData, r: number, c: number): { x: number; y: number; width: number; height: number } {
  const m = mergeAt(t, r, c) ?? { r, c, rows: 1, cols: 1 }
  return {
    x: sum(t.colWidths.slice(0, m.c)),
    y: sum(t.rowHeights.slice(0, m.r)),
    width: sum(t.colWidths.slice(m.c, m.c + m.cols)),
    height: sum(t.rowHeights.slice(m.r, m.r + m.rows)),
  }
}

/** The cell under a point in the table's own space, or undefined outside the table. */
export function cellAt(t: TableData, x: number, y: number): { r: number; c: number } | undefined {
  const index = (sizes: number[], at: number) => {
    let edge = 0
    for (const [i, size] of sizes.entries()) {
      edge += size
      if (at < edge) return i
    }
    return -1
  }
  if (x < 0 || y < 0) return undefined
  const r = index(t.rowHeights, y)
  const c = index(t.colWidths, x)
  return r < 0 || c < 0 ? undefined : anchorOf(t, r, c)
}

/** A range grown until it holds every merged block it touches whole. */
export function fullRange(t: TableData, range: CellRange): CellRange {
  let { r0, c0, r1, c1 } = { r0: Math.min(range.r0, range.r1), c0: Math.min(range.c0, range.c1), r1: Math.max(range.r0, range.r1), c1: Math.max(range.c0, range.c1) }
  let grown = true
  while (grown) {
    grown = false
    for (const m of t.merges) {
      const touches = m.r <= r1 && m.r + m.rows - 1 >= r0 && m.c <= c1 && m.c + m.cols - 1 >= c0
      if (!touches) continue
      const next = { r0: Math.min(r0, m.r), c0: Math.min(c0, m.c), r1: Math.max(r1, m.r + m.rows - 1), c1: Math.max(c1, m.c + m.cols - 1) }
      if (next.r0 !== r0 || next.c0 !== c0 || next.r1 !== r1 || next.c1 !== c1) grown = true
      ;({ r0, c0, r1, c1 } = next)
    }
  }
  return { r0, c0, r1, c1 }
}

export const wholeTable = (t: TableData): CellRange => ({ r0: 0, c0: 0, r1: rowCount(t) - 1, c1: colCount(t) - 1 })

/** One cell (any cell; for a merged block, its top-left cell holds the text). */
export const cellOf = (t: TableData, r: number, c: number): Cell => t.cells.at(r)!.at(c)!

/**
 * The cell whose alignment and bold the properties show: the first picked
 * one, or with none picked the first cell under the header row (which the
 * whole-table changes reach too).
 */
export const shownCell = (t: TableData, range?: CellRange): Cell | undefined => (range ? t.cells[range.r0]?.[range.c0] : (t.cells[1] ?? t.cells[0])?.[0])

/** A copy of the cells with some of them replaced. */
const replaceCells = (t: TableData, replace: (cell: Cell, r: number, c: number) => Cell): Cell[][] => t.cells.map((row, r) => row.map((cell, c) => replace(cell, r, c)))

export function setText(t: TableData, r: number, c: number, text: string): TableData {
  return { ...t, cells: replaceCells(t, (cell, i, j) => (i === r && j === c ? { ...cell, text } : cell)) }
}

/** Fill, alignment or boldness for every cell in the range. */
export function styleCells(t: TableData, range: CellRange, patch: Partial<Omit<Cell, 'text'>>): TableData {
  const { r0, c0, r1, c1 } = fullRange(t, range)
  const cells = t.cells.map((row, r) => row.map((cell, c) => (r >= r0 && r <= r1 && c >= c0 && c <= c1 ? { ...cell, ...patch } : cell)))
  return { ...t, cells }
}

/** Empty the text of every cell in the range. */
export function clearCells(t: TableData, range: CellRange): TableData {
  const { r0, c0, r1, c1 } = fullRange(t, range)
  return { ...t, cells: replaceCells(t, (cell, r, c) => (r >= r0 && r <= r1 && c >= c0 && c <= c1 ? { ...cell, text: '' } : cell)) }
}

/** Merge the range into one cell; the texts that were in it are kept, joined by spaces. */
export function mergeCells(t: TableData, range: CellRange): TableData {
  const { r0, c0, r1, c1 } = fullRange(t, range)
  if (r0 === r1 && c0 === c1) return t
  const texts: string[] = []
  const cells = t.cells.map((row, r) =>
    row.map((cell, c) => {
      if (r < r0 || r > r1 || c < c0 || c > c1) return cell
      if (cell.text) texts.push(cell.text)
      return r === r0 && c === c0 ? cell : { ...cell, text: '' }
    }),
  )
  cells[r0] = cells.at(r0)!.map((cell, c) => (c === c0 ? { ...cell, text: texts.join(' ') } : cell))
  const merges = t.merges.filter((m) => !(m.r >= r0 && m.r <= r1 && m.c >= c0 && m.c <= c1))
  return { ...t, cells, merges: [...merges, { r: r0, c: c0, rows: r1 - r0 + 1, cols: c1 - c0 + 1 }] }
}

/** Split every merged block in the range back into single cells. */
export function unmergeCells(t: TableData, range: CellRange): TableData {
  const { r0, c0, r1, c1 } = fullRange(t, range)
  return { ...t, merges: t.merges.filter((m) => m.r > r1 || m.r + m.rows - 1 < r0 || m.c > c1 || m.c + m.cols - 1 < c0) }
}

export const hasMerge = (t: TableData, range: CellRange) => unmergeCells(t, range).merges.length !== t.merges.length

/* Rows and columns */

/** Shift merges for a row or column added (`delta` 1) or removed (-1) at `at`. */
function shiftMerges(merges: Merge[], axis: 'r' | 'c', at: number, delta: 1 | -1): Merge[] {
  const span = axis === 'r' ? 'rows' : 'cols'
  return merges.flatMap((m) => {
    const start = m[axis]
    const end = start + m[span]
    if (delta === 1) {
      if (at <= start) return [{ ...m, [axis]: start + 1 }]
      if (at < end) return [{ ...m, [span]: m[span] + 1 }]
      return [m]
    }
    if (at < start) return [{ ...m, [axis]: start - 1 }]
    if (at < end) {
      const shrunk = { ...m, [span]: m[span] - 1 }
      return shrunk.rows * shrunk.cols > 1 ? [shrunk] : []
    }
    return [m]
  })
}

export function insertRow(t: TableData, at: number): TableData {
  const height = t.rowHeights[Math.min(at, rowCount(t) - 1)] ?? minRowHeight(t.fontSize)
  const rowHeights = [...t.rowHeights]
  rowHeights.splice(at, 0, height)
  const cells = [...t.cells]
  cells.splice(at, 0, emptyRow(colCount(t)))
  return { ...t, rowHeights, cells, merges: shiftMerges(t.merges, 'r', at, 1) }
}

export function insertCol(t: TableData, at: number): TableData {
  const width = t.colWidths[Math.min(at, colCount(t) - 1)] ?? DEFAULT_COL_WIDTH
  const colWidths = [...t.colWidths]
  colWidths.splice(at, 0, width)
  const cells = t.cells.map((row) => {
    const next = [...row]
    next.splice(at, 0, { text: '' })
    return next
  })
  return { ...t, colWidths, cells, merges: shiftMerges(t.merges, 'c', at, 1) }
}

/** A whole row or column, as picked cells. */
export const wholeRow = (t: TableData, r: number): CellRange => ({ r0: r, r1: r, c0: 0, c1: colCount(t) - 1 })
export const wholeCol = (t: TableData, c: number): CellRange => ({ r0: 0, r1: rowCount(t) - 1, c0: c, c1: c })

/** Remove a row; the last row stays. */
export function removeRow(t: TableData, at: number): TableData {
  if (rowCount(t) <= 1) return t
  return {
    ...t,
    rowHeights: t.rowHeights.filter((_, i) => i !== at),
    cells: t.cells.filter((_, i) => i !== at),
    merges: shiftMerges(t.merges, 'r', at, -1),
  }
}

/** Remove a column; the last column stays. */
export function removeCol(t: TableData, at: number): TableData {
  if (colCount(t) <= 1) return t
  return {
    ...t,
    colWidths: t.colWidths.filter((_, i) => i !== at),
    cells: t.cells.map((row) => row.filter((_, i) => i !== at)),
    merges: shiftMerges(t.merges, 'c', at, -1),
  }
}

export function resizeCol(t: TableData, index: number, width: number): TableData {
  return { ...t, colWidths: t.colWidths.map((w, i) => (i === index ? Math.max(MIN_COL_WIDTH, width) : w)) }
}

export function resizeRow(t: TableData, index: number, height: number): TableData {
  return { ...t, rowHeights: t.rowHeights.map((h, i) => (i === index ? Math.max(minRowHeight(t.fontSize), height) : h)) }
}

/** Stretch every column and row, after the table was resized with its handles. The text keeps its size. */
export function scaleTable(t: TableData, sx: number, sy: number): TableData {
  return {
    ...t,
    colWidths: t.colWidths.map((w) => Math.max(MIN_COL_WIDTH, w * sx)),
    rowHeights: t.rowHeights.map((h) => Math.max(minRowHeight(t.fontSize), h * sy)),
  }
}

/** A new text size; rows grow when the text no longer fits them. */
export function withFontSize(t: TableData, fontSize: number): TableData {
  return { ...t, fontSize, rowHeights: t.rowHeights.map((h) => Math.max(minRowHeight(fontSize), h)) }
}

/**
 * Move row `from` to the gap before row `to` (0 is above the first row, the
 * row count is below the last). Merged blocks the move would tear apart are
 * split back into single cells first.
 */
export function moveRow(t: TableData, from: number, to: number): TableData {
  return moveLine(t, 'r', from, to)
}

/** Move column `from` to the gap before column `to`; see `moveRow`. */
export function moveCol(t: TableData, from: number, to: number): TableData {
  return moveLine(t, 'c', from, to)
}

function moveLine(t: TableData, axis: 'r' | 'c', from: number, to: number): TableData {
  const count = axis === 'r' ? rowCount(t) : colCount(t)
  const landing = to > from ? to - 1 : to
  if (from < 0 || from >= count || landing === from || landing < 0 || landing >= count) return t
  // The new order, as old indices, and where each old index ends up.
  const order = Array.from({ length: count }, (_, i) => i).filter((i) => i !== from)
  order.splice(landing, 0, from)
  const newIndex = new Map(order.map((old, i) => [old, i]))
  const span = axis === 'r' ? 'rows' : 'cols'
  const merges = t.merges.flatMap((m) => {
    const start = m[axis]
    const end = start + m[span]
    const holdsMoved = m[span] > 1 && from >= start && from < end
    const crossed = m[span] > 1 && to > start && to < end
    return holdsMoved || crossed ? [] : [{ ...m, [axis]: newIndex.get(start)! }]
  })
  const reorder = <T,>(items: T[]) => order.map((old) => items.at(old)!)
  return axis === 'r'
    ? { ...t, rowHeights: reorder(t.rowHeights), cells: reorder(t.cells), merges }
    : { ...t, colWidths: reorder(t.colWidths), cells: t.cells.map((row) => reorder(row)), merges }
}

/** Give these columns (all when none are named) one width. */
export function setColWidths(t: TableData, width: number, cols?: number[]): TableData {
  return { ...t, colWidths: t.colWidths.map((w, i) => (!cols || cols.includes(i) ? Math.max(MIN_COL_WIDTH, width) : w)) }
}

/** Give these rows (all when none are named) one height. */
export function setRowHeights(t: TableData, height: number, rows?: number[]): TableData {
  return { ...t, rowHeights: t.rowHeights.map((h, i) => (!rows || rows.includes(i) ? Math.max(minRowHeight(t.fontSize), height) : h)) }
}

const between = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i)
const average = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length

/** Make these columns (all when none are named) equally wide, keeping their total width. */
export function evenCols(t: TableData, cols = between(0, colCount(t) - 1)): TableData {
  return setColWidths(t, average(cols.map((i) => t.colWidths.at(i)!)), cols)
}

/** Make these rows (all when none are named) equally tall, keeping their total height. */
export function evenRows(t: TableData, rows = between(0, rowCount(t) - 1)): TableData {
  return setRowHeights(t, average(rows.map((i) => t.rowHeights.at(i)!)), rows)
}

/* Paste */

/**
 * The cells in text copied from Excel, Google Sheets or LibreOffice: rows on
 * lines, cells split by tabs, and "quoted" cells that may hold tabs, line
 * breaks and doubled quotes. Undefined for plain text without tabs or lines.
 */
export function parseCells(text: string): string[][] | undefined {
  if (!/[\t\n]/.test(text)) return undefined
  const rows: string[][] = [[]]
  let cell = ''
  let i = 0
  while (i < text.length) {
    const char = text[i]
    if (char === '"' && cell === '') {
      // A quoted cell runs to the closing quote; "" inside it is one quote.
      i += 1
      while (i < text.length) {
        if (text[i] === '"' && text[i + 1] === '"') {
          cell += '"'
          i += 2
        } else if (text[i] === '"') {
          i += 1
          break
        } else {
          cell += text[i]
          i += 1
        }
      }
      continue
    }
    if (char === '\t') {
      rows.at(-1)!.push(cell)
      cell = ''
    } else if (char === '\n' || char === '\r') {
      rows.at(-1)!.push(cell)
      cell = ''
      rows.push([])
      if (char === '\r' && text[i + 1] === '\n') i += 1
    } else {
      cell += char
    }
    i += 1
  }
  rows.at(-1)!.push(cell)
  // Spreadsheets end the copied block with a line break.
  while (rows.length > 1 && rows.at(-1)!.every((value) => value === '')) rows.pop()
  return rows
}

/** Put a block of cells in, its top-left at (r, c); the table grows to fit it. */
export function pasteCells(t: TableData, r: number, c: number, block: string[][]): TableData {
  let next = t
  const width = Math.max(...block.map((row) => row.length))
  while (rowCount(next) < r + block.length) next = insertRow(next, rowCount(next))
  while (colCount(next) < c + width) next = insertCol(next, colCount(next))
  const cells = replaceCells(next, (cell, i, j) => {
    const text = block.at(i - r)?.at(j - c)
    return i >= r && j >= c && text !== undefined ? { ...cell, text } : cell
  })
  return { ...next, cells }
}

/* Keyboard moves */

export type Move = 'next' | 'previous' | 'up' | 'down' | 'left' | 'right'

/**
 * The cell a key moves to from (r, c), skipping over merged blocks. Tab
 * (`next`) runs along the row and on to the next row; undefined means there
 * is no cell that way (Tab in the last cell adds a row instead).
 */
export function moveCell(t: TableData, r: number, c: number, move: Move): { r: number; c: number } | undefined {
  const here = mergeAt(t, r, c) ?? { r, c, rows: 1, cols: 1 }
  const rows = rowCount(t)
  const cols = colCount(t)
  switch (move) {
    case 'up':
      return here.r > 0 ? anchorOf(t, here.r - 1, c) : undefined
    case 'down':
      return here.r + here.rows < rows ? anchorOf(t, here.r + here.rows, c) : undefined
    case 'left':
      return here.c > 0 ? anchorOf(t, r, here.c - 1) : undefined
    case 'right':
      return here.c + here.cols < cols ? anchorOf(t, r, here.c + here.cols) : undefined
    case 'next':
    case 'previous': {
      // Walk cell by cell in reading order until a different block's top-left cell.
      const step = move === 'next' ? 1 : -1
      let index = here.r * cols + here.c
      for (;;) {
        index += step
        if (index < 0 || index >= rows * cols) return undefined
        const at = { r: Math.floor(index / cols), c: index % cols }
        const anchor = anchorOf(t, at.r, at.c)
        if (anchor.r === at.r && anchor.c === at.c && !(at.r === here.r && at.c === here.c)) return at
      }
    }
  }
}

/* Drawing */

export type TableText = { r: number; c: number; text: string; x: number; y: number; width: number; align: Align; bold: boolean; colour: string; size: number; font: string }
export type TableDrawing = {
  fills: { x: number; y: number; width: number; height: number; colour: string }[]
  lines: { x1: number; y1: number; x2: number; y2: number; width: number }[]
  /** `x` is the cell's left edge plus padding and `width` the room for text; `y` is the baseline. */
  texts: TableText[]
  lineColour: string
}

export const isHeaderCell = (t: TableData, r: number, c: number) => (t.headerRow && r === 0) || (t.headerCol && c === 0)

/** The weight bold text is drawn and exported in. */
export const BOLD_WEIGHT = 700

/** The table's font as a CSS font list: the font, then Inter and the maths font for characters it lacks. */
export const tableFont = (t: TableData): string => fontStack((t.fontFamily && fontByName(t.fontFamily)) || DEFAULT_FONT)

/** How a cell's text looks: alignment (numbers go right), boldness, colour, size and font. */
export function cellTextStyle(t: TableData, r: number, c: number): Pick<TableText, 'align' | 'bold' | 'colour' | 'size' | 'font'> {
  const cell = cellOf(t, r, c)
  const header = isHeaderCell(t, r, c)
  const onHeaderFill = header && t.header === 'filled' && !cell.fill
  return {
    align: cell.align ?? (!header && /^[-+−]?[\d.,]+%?$/.test(cell.text.trim()) ? 'right' : 'left'),
    bold: cell.bold ?? (header && t.header !== 'plain'),
    colour: onHeaderFill ? t.headerText : t.textColour,
    size: t.fontSize,
    font: tableFont(t),
  }
}

/** What to draw, in the table's own space. The canvas and the SVG export both draw from this. */
export function drawTable(t: TableData): TableDrawing {
  const { width, height } = tableSize(t)
  const fills: TableDrawing['fills'] = []
  const lines: TableDrawing['lines'] = []
  const texts: TableText[] = []
  const line = (x1: number, y1: number, x2: number, y2: number, w = t.lineWidth) => lines.push({ x1, y1, x2, y2, width: w })
  const firstBody = t.headerRow ? 1 : 0
  for (let r = 0; r < rowCount(t); r++) {
    for (let c = 0; c < colCount(t); c++) {
      const anchor = anchorOf(t, r, c)
      if (anchor.r !== r || anchor.c !== c) continue
      const cell = cellOf(t, r, c)
      const box = cellBox(t, r, c)
      const look = cellTextStyle(t, r, c)
      const header = isHeaderCell(t, r, c)
      const stripe = t.striped && !header && r >= firstBody && (r - firstBody) % 2 === 1
      const fill = cell.fill ?? (header && t.header === 'filled' ? t.headerFill : stripe ? t.stripeFill : (t.cellFill ?? DEFAULT_CELL_FILL))
      fills.push({ ...box, colour: fill })
      if (t.borders === 'all') {
        line(box.x, box.y, box.x + box.width, box.y)
        line(box.x, box.y + box.height, box.x + box.width, box.y + box.height)
        line(box.x, box.y, box.x, box.y + box.height)
        line(box.x + box.width, box.y, box.x + box.width, box.y + box.height)
      } else if (t.borders === 'horizontal') {
        line(box.x, box.y, box.x + box.width, box.y)
        line(box.x, box.y + box.height, box.x + box.width, box.y + box.height)
      }
      if (cell.text) {
        texts.push({
          r,
          c,
          text: cell.text,
          x: box.x + CELL_PADDING,
          y: box.y + box.height / 2 + t.fontSize * 0.36,
          width: box.width - CELL_PADDING * 2,
          ...look,
        })
      }
    }
  }
  if (t.borders === 'outer') {
    line(0, 0, width, 0)
    line(0, height, width, height)
    line(0, 0, 0, height)
    line(width, 0, width, height)
  } else if (t.borders === 'rules') {
    const thick = t.lineWidth * 1.5
    line(0, 0, width, 0, thick)
    const header = t.rowHeights.at(0) ?? 0
    if (t.headerRow && rowCount(t) > 1) line(0, header, width, header)
    line(0, height, width, height, thick)
  }
  return { fills, lines, texts, lineColour: t.lineColour }
}

/** Where a text starts for its alignment, given how wide it is. */
export function textStart(text: TableText, measuredWidth: number): number {
  if (text.align === 'center') return text.x + (text.width - measuredWidth) / 2
  if (text.align === 'right') return text.x + text.width - measuredWidth
  return text.x
}

const escapeXml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const n = (value: number) => String(Math.round(value * 100) / 100)

/**
 * The table as SVG elements, with (0, 0) at `origin`. Plain <rect>, <line>
 * and <text> with the table's font and weight, so export turns the text into
 * outlines in that same font, like any other text.
 */
export function tableSvg(t: TableData, measure: (text: TableText) => number, origin = { x: 0, y: 0 }): string[] {
  const drawing = drawTable(t)
  const out: string[] = []
  const x = (value: number) => n(value + origin.x)
  const y = (value: number) => n(value + origin.y)
  for (const f of drawing.fills) out.push(`<rect x="${x(f.x)}" y="${y(f.y)}" width="${n(f.width)}" height="${n(f.height)}" fill="${f.colour}" />\n`)
  for (const l of drawing.lines) out.push(`<line x1="${x(l.x1)}" y1="${y(l.y1)}" x2="${x(l.x2)}" y2="${y(l.y2)}" stroke="${drawing.lineColour}" stroke-width="${n(l.width)}" stroke-linecap="square" />\n`)
  for (const text of drawing.texts) {
    const start = textStart(text, measure(text))
    const weight = text.bold ? ` font-weight="${BOLD_WEIGHT}"` : ''
    out.push(`<text x="${x(start)}" y="${y(text.y)}" font-family="${escapeXml(text.font)}" font-size="${n(text.size)}"${weight} fill="${text.colour}" xml:space="preserve">${escapeXml(text.text)}</text>\n`)
  }
  return out
}

/* Commands from the menus, the toolbar and the properties panel */

export type TableCommand = 'row-above' | 'row-below' | 'col-left' | 'col-right' | 'delete-rows' | 'delete-cols' | 'merge' | 'unmerge' | 'even-rows' | 'even-cols'

const clampRange = (t: TableData, range: CellRange): CellRange => {
  const r = (value: number) => Math.min(Math.max(value, 0), rowCount(t) - 1)
  const c = (value: number) => Math.min(Math.max(value, 0), colCount(t) - 1)
  return { r0: r(range.r0), c0: c(range.c0), r1: r(range.r1), c1: c(range.c1) }
}

/**
 * Run a command on the picked cells. Without picked cells, rows and columns
 * are added and removed at the end of the table.
 */
export function runTableCommand(t: TableData, picked: CellRange | undefined, command: TableCommand): { table: TableData; range: CellRange | undefined } {
  const range = picked ? fullRange(t, picked) : { r0: rowCount(t) - 1, c0: colCount(t) - 1, r1: rowCount(t) - 1, c1: colCount(t) - 1 }
  let table = t
  let next: CellRange | undefined = picked
  switch (command) {
    case 'row-above':
      table = insertRow(t, range.r0)
      next = picked && { ...picked, r0: range.r0, r1: range.r0, c0: range.c0, c1: range.c1 }
      break
    case 'row-below':
      table = insertRow(t, range.r1 + 1)
      next = picked && { r0: range.r1 + 1, r1: range.r1 + 1, c0: range.c0, c1: range.c1 }
      break
    case 'col-left':
      table = insertCol(t, range.c0)
      next = picked && { r0: range.r0, r1: range.r1, c0: range.c0, c1: range.c0 }
      break
    case 'col-right':
      table = insertCol(t, range.c1 + 1)
      next = picked && { r0: range.r0, r1: range.r1, c0: range.c1 + 1, c1: range.c1 + 1 }
      break
    case 'delete-rows':
      for (let r = range.r1; r >= range.r0; r--) table = removeRow(table, r)
      break
    case 'delete-cols':
      for (let c = range.c1; c >= range.c0; c--) table = removeCol(table, c)
      break
    case 'merge':
      if (picked) table = mergeCells(t, picked)
      break
    case 'unmerge':
      table = unmergeCells(t, picked ?? wholeTable(t))
      break
    // Several picked rows or columns are evened out among themselves; otherwise all of them.
    case 'even-rows':
      table = evenRows(t, picked && range.r1 > range.r0 ? between(range.r0, range.r1) : undefined)
      break
    case 'even-cols':
      table = evenCols(t, picked && range.c1 > range.c0 ? between(range.c0, range.c1) : undefined)
      break
  }
  return { table, range: next && clampRange(table, next) }
}

export type TableStyle = {
  look: TableLook
  layout: TableLayout
  borders: Borders
  header: HeaderStyle
  fontSize: number
  /** The font's name. */
  fontFamily: string
  /** For the picked cells, or all of them. */
  align: Align
  bold: boolean
  /** For the picked columns and rows, or all of them. */
  colWidth: number
  rowHeight: number
}

/** Change the table's look; alignment and boldness go onto the picked cells (all cells when none are picked). */
export function styleTable(t: TableData, picked: CellRange | undefined, patch: Partial<TableStyle>): TableData {
  let table = t
  if (patch.look) table = withLook(table, patch.look)
  if (patch.layout) table = withLayout(table, patch.layout)
  if (patch.borders) table = { ...table, borders: patch.borders }
  if (patch.header) table = { ...table, header: patch.header }
  if (patch.fontSize !== undefined) table = withFontSize(table, patch.fontSize)
  if (patch.fontFamily !== undefined) table = { ...table, fontFamily: patch.fontFamily }
  if (patch.align) table = styleCells(table, picked ?? wholeTable(table), { align: patch.align })
  if (patch.bold !== undefined) table = styleCells(table, picked ?? wholeTable(table), { bold: patch.bold })
  if (patch.colWidth !== undefined) table = setColWidths(table, patch.colWidth, picked && between(picked.c0, picked.c1))
  if (patch.rowHeight !== undefined) table = setRowHeights(table, patch.rowHeight, picked && between(picked.r0, picked.r1))
  return table
}
