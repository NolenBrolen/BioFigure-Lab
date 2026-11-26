/*
 * Importing data into a chart: reading a file (CSV, TSV, TXT or XLSX) or
 * pasted text into a table of text cells, then turning that table into the
 * chart's groups. Reading is the only part that touches a file; everything
 * after it is plain functions, so the preview window can redo them instantly
 * whenever an option changes.
 *
 * Text files go through Papa Parse (MIT), spreadsheets through
 * read-excel-file (MIT). A big text file is read in pieces, so progress can
 * show and Cancel can stop it.
 */
import type { ImportChoice, ImportOrientation, ImportSheet, ImportTools } from '@biofigure-lab/ui/components/graph-panel/ImportPreview'
import Papa from 'papaparse'

import { evenRows, parseNumber, type ChartGroup } from './chart-model'

/** A table of cells as text, as read from a file; rows can have different lengths. */
export type Table = string[][]

export type { ImportChoice, ImportOrientation, ImportSheet }

/** Files over this many bytes are parsed in a background thread, in pieces. */
const BIG_FILE = 1_000_000

export class ImportCancelled extends Error {
  constructor() {
    super('Import cancelled')
    this.name = 'ImportCancelled'
  }
}

export const isSpreadsheet = (name: string) => /\.xlsx$/i.test(name)

/** Text (a CSV, a TSV, or a block pasted from a spreadsheet) as a table. The separator is found by itself: comma, tab, semicolon or bar. */
export function readText(text: string): Table {
  const result = Papa.parse<string[]>(text, { delimitersToGuess: [',', '\t', ';', '|'], skipEmptyLines: 'greedy' })
  return result.data.map((row) => row.map((cell) => String(cell)))
}

/**
 * Read a file into its sheets (a text file has one). `onProgress` gets 0 to 1
 * while a big text file is read; aborting `signal` stops it and rejects with
 * `ImportCancelled`.
 */
export async function readFile(file: File, options: { signal?: AbortSignal; onProgress?: (fraction: number) => void } = {}): Promise<ImportSheet[]> {
  const { signal, onProgress } = options
  if (signal?.aborted) throw new ImportCancelled()
  if (isSpreadsheet(file.name)) {
    // Loaded only when a spreadsheet is imported, so it isn't part of the app's first download.
    const { default: readSheets } = await import('read-excel-file/universal')
    const sheets = await readSheets(file)
    if (signal?.aborted) throw new ImportCancelled()
    return sheets.map((sheet) => ({ name: sheet.sheet, rows: sheet.data.map((row) => row.map(cellText)) }))
  }
  const rows = await new Promise<Table>((resolve, reject) => {
    const collected: Table = []
    Papa.parse<string[]>(file, {
      delimitersToGuess: [',', '\t', ';', '|'],
      skipEmptyLines: 'greedy',
      worker: file.size > BIG_FILE && Papa.WORKERS_SUPPORTED,
      chunk: (results, parser) => {
        for (const row of results.data) collected.push(row.map((cell) => String(cell)))
        if (file.size > 0) onProgress?.(Math.min(results.meta.cursor / file.size, 1))
        if (signal?.aborted) parser.abort()
      },
      complete: () => (signal?.aborted ? reject(new ImportCancelled()) : resolve(collected)),
      error: (error) => reject(error),
    })
  })
  return [{ name: file.name, rows }]
}

function cellText(cell: string | number | boolean | Date | null): string {
  if (cell === null) return ''
  if (cell instanceof Date) return cell.toISOString().slice(0, 10)
  return String(cell)
}

/** Every row as long as the longest, the missing cells empty. */
function padded(rows: Table): Table {
  const width = Math.max(0, ...rows.map((row) => row.length))
  return rows.map((row) => Array.from({ length: width }, (_, i) => row[i] ?? ''))
}

/** The table with groups running down the columns: as it is for `columns`, turned on its side for `rows`. */
export function orient(rows: Table, orientation: ImportOrientation): Table {
  const even = padded(rows)
  if (orientation === 'columns') return even
  return Array.from({ length: even[0]?.length ?? 0 }, (_, c) => even.map((row) => row[c] ?? ''))
}

const isBlank = (cell: string) => cell.trim() === ''
const isText = (cell: string) => !isBlank(cell) && parseNumber(cell) === null

/**
 * Whether the first line (the first row, or for `rows` the first column) is names, so the preview starts with
 * "First row is group names" on. Two cases, kept careful because the user can switch it either way:
 * - text in the first line over a column that holds numbers (a column with no number in it, such as notes, doesn't count);
 * - numbers that read like labels, such as doses 0, 1, 3, 10: rising from one column to the next across three
 *   or more columns, and in at least half the columns outside the range of the numbers below them (data
 *   usually has its first value among the others). At least three rows must sit below, to judge by.
 */
export function looksLikeHeader(rows: Table, orientation: ImportOrientation): boolean {
  const lines = orient(rows, orientation)
  const [first, ...rest] = lines
  if (!first || rest.length === 0) return false
  const below = (c: number) => rest.map((row) => parseNumber(row[c] ?? '')).filter((v): v is number => v !== null)
  const dataColumns = first.map((_, c) => c).filter((c) => below(c).length > 0)
  if (dataColumns.some((c) => isText(first[c] ?? ''))) return true
  if (dataColumns.length === 0 && first.some(isText)) return true
  const labels = dataColumns.map((c) => parseNumber(first[c] ?? ''))
  if (labels.length < 3 || labels.some((v) => v === null)) return false
  const numbers = labels as number[]
  if (!numbers.every((v, i) => i === 0 || v > (numbers[i - 1] ?? Infinity))) return false
  const outside = dataColumns.filter((c, i) => {
    const under = below(c)
    return under.length >= 3 && (((numbers[i] ?? 0) < Math.min(...under)) || ((numbers[i] ?? 0) > Math.max(...under)))
  })
  return outside.length * 2 >= dataColumns.length
}

/** Columns (after `orient`) with no number in them, such as notes: they start out left out. */
export function textColumns(rows: Table, orientation: ImportOrientation, header: boolean): boolean[] {
  const lines = orient(rows, orientation).slice(header ? 1 : 0)
  const width = lines[0]?.length ?? 0
  return Array.from({ length: width }, (_, c) => !lines.some((row) => parseNumber(row[c] ?? '') !== null))
}

/** The preview window's helpers, in the shape it asks for. */
export const importTools: ImportTools = { orient, looksLikeHeader, textColumns }

/** The groups a choice in the preview makes: one per column kept, numbers read with `parseNumber`, blanks and text empty. */
export function buildGroups(rows: Table, choice: Pick<ImportChoice, 'header' | 'orientation' | 'leftOut'>): ChartGroup[] {
  const lines = orient(rows, choice.orientation)
  const names = choice.header ? (lines[0] ?? []) : []
  const body = choice.header ? lines.slice(1) : lines
  const groups: ChartGroup[] = []
  for (let c = 0; c < (lines[0]?.length ?? 0); c++) {
    if (choice.leftOut.includes(c)) continue
    groups.push({ name: (names[c] ?? '').trim() || `Group ${c + 1}`, values: body.map((row) => parseNumber(row[c] ?? '')) })
  }
  return trimEmptyRows(evenRows(groups))
}

/** Drops empty rows at the bottom, as left by a spreadsheet's formatting. */
function trimEmptyRows(groups: ChartGroup[]): ChartGroup[] {
  let rows = Math.max(0, ...groups.map((g) => g.values.length))
  while (rows > 0 && groups.every((g) => g.values[rows - 1] === null)) rows--
  return groups.map((g) => ({ ...g, values: g.values.slice(0, rows) }))
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** The name of a data set that came from the clipboard: "Pasted 20 Nov 14:02". */
export function pastedName(date: Date): string {
  const two = (n: number) => String(n).padStart(2, '0')
  return `Pasted ${date.getDate()} ${MONTHS[date.getMonth()]} ${two(date.getHours())}:${two(date.getMinutes())}`
}
