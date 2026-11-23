/**
 * Typing in a table cell. A text box is laid exactly over the cell (following
 * zoom, scroll and rotation), so you type on the canvas itself. Tab and
 * Shift+Tab move along the cells (Tab in the last cell adds a row), the up
 * and down arrows move between rows, left and right move on at the ends of
 * the text. Enter stops typing and picks the cell below (or keeps this one
 * picked on the bottom row) without typing in it; Escape stops typing and
 * keeps this cell picked. Pasting a block copied from a
 * spreadsheet fills the cells from here, adding rows and columns as needed.
 * Each cell you change is one undo step.
 */
import { util, type Canvas } from 'fabric'

import { BOLD_WEIGHT, CELL_PADDING, cellBox, cellOf, cellTextStyle, insertRow, moveCell, parseCells, pasteCells, rowCount, setText, type Move } from './table-model'
import type { TableObject } from './TableObject'

export class CellEditor {
  private box: HTMLTextAreaElement | undefined
  private table: TableObject | undefined
  private cell = { r: 0, c: 0 }
  /** The text when typing in this cell started, to tell whether it changed. */
  private before = ''
  private readonly place = () => this.layout()

  private readonly canvas: Canvas
  /** Something changed for good: make an undo step. */
  private readonly onCommit: () => void
  /** Typing stopped. */
  private readonly onFinish: () => void

  constructor(canvas: Canvas, onCommit: () => void, onFinish: () => void) {
    this.canvas = canvas
    this.onCommit = onCommit
    this.onFinish = onFinish
  }

  get editing(): TableObject | undefined {
    return this.table
  }

  get editingCell(): { r: number; c: number } | undefined {
    return this.table && { ...this.cell }
  }

  /** Start typing in a cell. With `selectAll` the old text is selected, so typing replaces it. */
  start(table: TableObject, cell: { r: number; c: number }, selectAll = false): void {
    if (this.table && this.table !== table) this.finish()
    else this.save()
    this.table = table
    this.cell = cell
    this.before = cellOf(table.table, cell.r, cell.c).text
    table.editingCell = cell
    table.cellRange = { r0: cell.r, c0: cell.c, r1: cell.r, c1: cell.c }
    const box = this.box ?? this.makeBox()
    box.value = this.before
    this.layout()
    box.focus({ preventScroll: true })
    if (selectAll) box.select()
    else box.setSelectionRange(box.value.length, box.value.length)
    this.canvas.requestRenderAll()
  }

  /** Stop typing; the table stays selected with this cell picked. */
  finish(): void {
    const table = this.table
    if (!table) return
    this.save()
    table.editingCell = undefined
    this.table = undefined
    this.canvas.off('after:render', this.place)
    this.box?.remove()
    this.box = undefined
    this.canvas.requestRenderAll()
    this.onFinish()
  }

  /** Make an undo step if the cell's text changed. */
  private save(): void {
    if (!this.table) return
    const now = this.table.table.cells[this.cell.r]?.[this.cell.c]?.text ?? ''
    if (now === this.before) return
    this.before = now
    this.onCommit()
  }

  private makeBox(): HTMLTextAreaElement {
    const box = document.createElement('textarea')
    box.setAttribute('aria-label', 'Cell text')
    box.spellcheck = false
    box.rows = 1
    Object.assign(box.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      margin: '0',
      border: '0',
      outline: 'none',
      background: 'transparent',
      resize: 'none',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      transformOrigin: '0 0',
      boxSizing: 'border-box',
      zIndex: '1',
    } satisfies Partial<CSSStyleDeclaration>)
    box.addEventListener('input', () => this.typed())
    box.addEventListener('keydown', (event) => this.onKeyDown(event))
    box.addEventListener('paste', (event) => this.onPaste(event))
    // Clicking anywhere else (a toolbar button, the properties panel) stops typing first, so that click works as usual.
    box.addEventListener('blur', () => this.finish())
    // Typing must not reach the editor's shortcuts or Fabric.
    box.addEventListener('keyup', (event) => event.stopPropagation())
    this.canvas.wrapperEl.append(box)
    this.canvas.on('after:render', this.place)
    this.box = box
    return box
  }

  /** Put the text box over the cell, in the cell's font. */
  private layout(): void {
    const { table, box } = this
    if (!table || !box) return
    const cellArea = cellBox(table.table, this.cell.r, this.cell.c)
    const style = cellTextStyle(table.table, this.cell.r, this.cell.c)
    const toScreen = util.multiplyTransformMatrices(table.getViewportTransform(), table.calcTransformMatrix())
    const [a, b, c, d, e, f] = util.multiplyTransformMatrices(toScreen, [1, 0, 0, 1, cellArea.x - table.width / 2, cellArea.y - table.height / 2])
    Object.assign(box.style, {
      // The font shorthand resets the line height, so it goes first.
      font: `${style.bold ? BOLD_WEIGHT : 400} ${style.size}px ${style.font}`,
      width: `${cellArea.width}px`,
      height: `${cellArea.height}px`,
      lineHeight: `${cellArea.height}px`,
      padding: `0 ${CELL_PADDING}px`,
      color: style.colour,
      textAlign: style.align,
      transform: `matrix(${[a, b, c, d, e, f].join(',')})`,
    } satisfies Partial<CSSStyleDeclaration>)
  }

  private typed(): void {
    const { table, box } = this
    if (!table || !box) return
    table.setTable(setText(table.table, this.cell.r, this.cell.c, box.value.replace(/\r?\n/g, ' ')))
    this.canvas.requestRenderAll()
  }

  private move(move: Move): void {
    const table = this.table
    if (!table) return
    let to = moveCell(table.table, this.cell.r, this.cell.c, move)
    if (!to && move === 'next') {
      // Tab in the last cell adds a row, like in word processors.
      this.save()
      table.setTable(insertRow(table.table, rowCount(table.table)))
      this.onCommit()
      to = { r: rowCount(table.table) - 1, c: 0 }
    }
    if (to) this.start(table, to, true)
  }

  private onKeyDown(event: KeyboardEvent): void {
    event.stopPropagation()
    const box = this.box!
    const atStart = box.selectionStart === 0 && box.selectionEnd === 0
    const atEnd = box.selectionStart === box.value.length && box.selectionEnd === box.value.length
    const moves: Partial<Record<string, Move | false>> = {
      Tab: event.shiftKey ? 'previous' : 'next',
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: atStart && 'left',
      ArrowRight: atEnd && 'right',
    }
    if (event.key === 'Escape' || event.key === 'Enter') {
      event.preventDefault()
      const table = this.table
      const below = event.key === 'Enter' && table ? moveCell(table.table, this.cell.r, this.cell.c, 'down') : undefined
      if (table && below) table.cellRange = { r0: below.r, c0: below.c, r1: below.r, c1: below.c }
      this.finish()
      return
    }
    const move = moves[event.key]
    if (!move) return
    event.preventDefault()
    this.move(move)
  }

  private onPaste(event: ClipboardEvent): void {
    const table = this.table
    const block = parseCells(event.clipboardData?.getData('text/plain') ?? '')
    if (!table || !block) return
    event.preventDefault()
    this.save()
    table.setTable(pasteCells(table.table, this.cell.r, this.cell.c, block))
    table.cellRange = { r0: this.cell.r, c0: this.cell.c, r1: this.cell.r + block.length - 1, c1: this.cell.c + Math.max(...block.map((row) => row.length)) - 1 }
    this.before = cellOf(table.table, this.cell.r, this.cell.c).text
    this.box!.value = this.before
    this.onCommit()
    this.canvas.requestRenderAll()
  }
}
