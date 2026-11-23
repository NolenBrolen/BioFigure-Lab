import { describe, expect, it } from 'vitest'

import { History } from './history'
import {
  cellOf,
  clearCells,
  colCount,
  colWidthForPage,
  createTable,
  shownCell,
  drawTable,
  evenCols,
  mergeCells,
  moveCell,
  moveCol,
  moveRow,
  parseCells,
  pasteCells,
  rowCount,
  runTableCommand,
  setText,
  styleTable,
  tableSvg,
  type TableData,
} from './table-model'

const texts = (t: TableData) => t.cells.map((row) => row.map((cell) => cell.text))
/** Every character 6 px wide, so text positions are easy to work out. */
const measure = ({ text }: { text: string }) => text.length * 6

describe('table cells', () => {
  it('moves with Tab along the rows, skipping merged blocks, and stops after the last cell', () => {
    let t = createTable(2, 3)
    t = mergeCells(t, { r0: 0, c0: 1, r1: 0, c1: 2 })
    expect(moveCell(t, 0, 0, 'next')).toEqual({ r: 0, c: 1 })
    expect(moveCell(t, 0, 1, 'next')).toEqual({ r: 1, c: 0 })
    expect(moveCell(t, 1, 0, 'previous')).toEqual({ r: 0, c: 1 })
    expect(moveCell(t, 1, 2, 'up')).toEqual({ r: 0, c: 1 })
    expect(moveCell(t, 0, 1, 'right')).toBeUndefined()
    expect(moveCell(t, 1, 2, 'next')).toBeUndefined()
  })

  it('adds and removes rows and columns at the picked cells, and undo brings the old table back', () => {
    const start = setText(createTable(2, 2), 0, 0, 'A')
    const history = new History(JSON.stringify(start))
    const below = runTableCommand(start, { r0: 0, c0: 0, r1: 0, c1: 0 }, 'row-below')
    expect(rowCount(below.table)).toBe(3)
    expect(below.range).toEqual({ r0: 1, c0: 0, r1: 1, c1: 0 })
    history.push(JSON.stringify(below.table))
    const left = runTableCommand(below.table, undefined, 'col-left')
    expect(texts(left.table)[0]).toEqual(['A', '', ''])
    const removed = runTableCommand(left.table, { r0: 0, c0: 0, r1: 2, c1: 0 }, 'delete-cols')
    expect(colCount(removed.table)).toBe(2)
    expect(JSON.parse(history.undo()!)).toEqual(start)
  })

  it('keeps merged blocks whole when rows are added inside them or removed', () => {
    let t = mergeCells(setText(createTable(3, 3), 1, 1, 'x'), { r0: 0, c0: 0, r1: 1, c1: 1 })
    expect(cellOf(t, 0, 0).text).toBe('x')
    const beside = { r0: 0, c0: 2, r1: 0, c1: 2 }
    t = runTableCommand(t, beside, 'row-below').table
    expect(t.merges).toEqual([{ r: 0, c: 0, rows: 3, cols: 2 }])
    t = runTableCommand(t, beside, 'delete-rows').table
    t = runTableCommand(t, beside, 'delete-rows').table
    expect(t.merges).toEqual([{ r: 0, c: 0, rows: 1, cols: 2 }])
  })
})

describe('arranging rows and columns', () => {
  it('moves a column or row to another gap, with its width and cells', () => {
    const t = { ...pasteCells(createTable(2, 3), 0, 0, [['a', 'b', 'c'], ['1', '2', '3']]), colWidths: [10, 20, 30] }
    const moved = moveCol(t, 0, 3)
    expect(texts(moved)).toEqual([['b', 'c', 'a'], ['2', '3', '1']])
    expect(moved.colWidths).toEqual([20, 30, 10])
    expect(texts(moveRow(t, 1, 0))).toEqual([['1', '2', '3'], ['a', 'b', 'c']])
    // Dropping it back where it was changes nothing.
    expect(moveCol(t, 1, 2)).toBe(t)
  })

  it('keeps merged blocks that move whole and splits the ones a move would tear apart', () => {
    const t = mergeCells(createTable(3, 3), { r0: 0, c0: 0, r1: 0, c1: 1 })
    expect(moveRow(t, 0, 3).merges).toEqual([{ r: 2, c: 0, rows: 1, cols: 2 }])
    expect(moveCol(t, 2, 1).merges).toEqual([])
  })

  it('evens out sizes and sets one size for the picked columns and rows, or all of them', () => {
    const t = { ...createTable(2, 3), colWidths: [10, 20, 60] }
    expect(evenCols(t).colWidths).toEqual([30, 30, 30])
    expect(runTableCommand(t, { r0: 0, c0: 0, r1: 0, c1: 1 }, 'even-cols').table.colWidths).toEqual([15, 15, 60])
    expect(styleTable(t, { r0: 0, c0: 2, r1: 1, c1: 2 }, { colWidth: 40 }).colWidths).toEqual([10, 20, 40])
    expect(styleTable(t, undefined, { rowHeight: 50 }).rowHeights).toEqual([50, 50])
  })

  it('shows the alignment and bold set on the whole table when no cell is picked', () => {
    const t = styleTable(createTable(3, 2), undefined, { align: 'center', bold: true })
    expect(shownCell(t)).toMatchObject({ align: 'center', bold: true })
    const picked = { r0: 2, c0: 1, r1: 2, c1: 1 }
    expect(shownCell(styleTable(t, picked, { align: 'right' }), picked)).toMatchObject({ align: 'right' })
  })
})

describe('cell contents and fill', () => {
  it('fills every cell solid white unless it has a colour of its own, so nothing behind shows through', () => {
    const t = createTable(2, 2, 'grid', 'soft')
    expect(drawTable(t).fills.map((f) => f.colour)).toEqual(['#ffffff', '#ffffff', '#ffffff', '#ffffff'])
    // Tables saved before cells had a background are white too.
    expect(drawTable({ ...t, cellFill: undefined }).fills.map((f) => f.colour)).toEqual(['#ffffff', '#ffffff', '#ffffff', '#ffffff'])
  })

  it('empties the picked cells and leaves the others', () => {
    const t = clearCells(pasteCells(createTable(2, 2), 0, 0, [['a', 'b'], ['c', 'd']]), { r0: 0, c0: 1, r1: 1, c1: 1 })
    expect(texts(t)).toEqual([['a', ''], ['c', '']])
  })
})

describe('pasting from a spreadsheet', () => {
  it('reads tabs, line breaks and quoted cells, and leaves plain text alone', () => {
    expect(parseCells('a\tb\r\n"c ""1"""\t"d\te"\r\n')).toEqual([
      ['a', 'b'],
      ['c "1"', 'd\te'],
    ])
    expect(parseCells('"two\nlines"\tx')).toEqual([['two\nlines', 'x']])
    expect(parseCells('just text')).toBeUndefined()
  })

  it('fills the cells from the one typed in and grows the table to fit', () => {
    const t = pasteCells(setText(createTable(2, 2), 0, 0, 'keep'), 1, 1, [
      ['1', '2'],
      ['3', '4'],
    ])
    expect(texts(t)).toEqual([
      ['keep', '', ''],
      ['', '1', '2'],
      ['', '3', '4'],
    ])
  })
})

describe('saving and export', () => {
  it('comes back the same after saving and loading', () => {
    const t = mergeCells(pasteCells(createTable(3, 3, 'striped', 'journal'), 0, 0, [['Dose', 'n']]), { r0: 1, c0: 0, r1: 2, c1: 0 })
    expect(JSON.parse(JSON.stringify({ table: t }))).toEqual({ table: t })
  })

  it('exports plain SVG: header fill, lines for the chosen borders, and text aligned in its cell', () => {
    let t = createTable(2, 2, 'header', 'classic')
    t = { ...t, colWidths: [100, 100], rowHeights: [20, 20] }
    t = pasteCells(t, 0, 0, [['Name', 'Value'], ['Low', '12']])
    const svg = tableSvg(t, measure).join('')
    expect(svg).toContain(`<rect x="0" y="0" width="100" height="20" fill="${t.headerFill}" />`)
    // All borders: four edges per cell.
    expect(svg.match(/<line /g)).toHaveLength(16)
    // A number goes to the right: 200 - 6 padding - 2 × 6 px.
    expect(svg).toMatch(/<text x="182" y="[\d.]+"[^>]*>12<\/text>/)
    // Header text is bold: the bold weight, which export outlines with the bold font.
    expect(svg).toMatch(/<text x="6"[^>]*font-weight="700"[^>]*>Name<\/text>/)
    expect(svg).toContain(`font-family="'Inter Variable'`)
    // A picked font goes into the SVG, so export outlines that font.
    const serif = tableSvg(styleTable(t, undefined, { fontFamily: 'Source Serif 4' }), measure).join('')
    expect(serif).toContain(`font-family="'Source Serif 4'`)
    const journal = tableSvg({ ...t, borders: 'rules' }, measure).join('')
    expect(journal.match(/<line /g)).toHaveLength(3)
  })
})

describe('table size for the page', () => {
  const mm = (value: number) => (value * 96) / 25.4

  it('keeps 22 mm columns on a double-column page', () => {
    expect(colWidthForPage(mm(174), 3)).toBeCloseTo(mm(22))
  })

  it('narrows the columns on a single-column page to 60% of its width', () => {
    expect(colWidthForPage(mm(85), 3) * 3).toBeCloseTo(mm(85) * 0.6)
  })

  it('never makes columns narrower than 15 mm', () => {
    expect(colWidthForPage(mm(85), 10)).toBeCloseTo(mm(15))
  })
})
