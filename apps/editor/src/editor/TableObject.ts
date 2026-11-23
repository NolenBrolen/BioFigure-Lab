/**
 * A table on the canvas. Its contents live in `table` (see table-model.ts);
 * the object draws them, saves them with the figure and writes them as plain
 * SVG for export. While it's selected, a strip runs along its top edge (one
 * tab per column) and its left edge (one tab per row): press a tab to pick
 * that column or row, drag it along the strip to move it. Small bars between
 * the tabs resize one column or row; the "+" past the last column and below
 * the last row add one. Resizing the whole table with its handles stretches
 * every column and row evenly, but keeps the text size.
 */
import { Control, FabricObject, Point, classRegistry, util, type TMat2D, type TPointerEvent, type Transform } from 'fabric'

import type { XY } from './geometry'
import {
  cellAt,
  drawTable,
  moveCol,
  moveRow,
  resizeCol,
  resizeRow,
  runTableCommand,
  scaleTable,
  tableSize,
  tableSvg,
  textStart,
  wholeCol,
  wholeRow,
  type CellRange,
  type TableData,
  type TableDrawing,
  type TableText,
} from './table-model'
import { BOLD_WEIGHT } from './table-model'
import { DEFAULT_FONT, fontByName, loadFontFace } from './fonts'

/** What Fabric reports as the action while a column or row bar is dragged. */
export const RESIZE_CELLS_ACTION = 'resizeTableCells'
/** What Fabric reports as the action while a column or row tab is dragged. */
export const MOVE_LINE_ACTION = 'moveTableLine'
/** The action reported after a "+" added a column or row. */
export const ADD_LINE_ACTION = 'addTableLine'

/** The canvas font for a cell's text. */
const fontFor = (text: Pick<TableText, 'size' | 'bold' | 'font'>) => `${text.bold ? BOLD_WEIGHT : 400} ${text.size}px ${text.font}`

let measuring: CanvasRenderingContext2D | null | undefined
/** How wide a text is in its font. Export outlines the same font, so alignment matches. */
function measureText(text: TableText): number {
  measuring ??= document.createElement('canvas').getContext('2d')
  if (!measuring) return text.text.length * text.size * 0.55
  measuring.font = fontFor(text)
  return measuring.measureText(text.text).width
}

const sumTo = (sizes: number[], index: number) => sizes.slice(0, index).reduce((a, b) => a + b, 0)

export class TableObject extends FabricObject {
  static type = 'Table'

  declare table: TableData
  private picked: CellRange | undefined
  /** The picked cells, while the table is selected. Not saved. With cells picked, dragging over the table picks cells instead of moving it. */
  get cellRange(): CellRange | undefined {
    return this.picked
  }
  set cellRange(range: CellRange | undefined) {
    this.picked = range
    this.hoverCursor = range ? 'cell' : null
  }
  /** The cell being typed in; its text is drawn by the text box on top instead. */
  editingCell: { r: number; c: number } | undefined
  /**
   * A column or row tab being dragged: which one, the gap it would land in,
   * where the pointer is along the table and where on the column or row it
   * was grabbed (both in the table's own space).
   */
  dragging: { axis: 'r' | 'c'; from: number; to: number; at: number; grab: number } | undefined

  constructor(options: Record<string, unknown> & { table: TableData }) {
    super(options as Record<string, unknown>)
    this.rebuildControls()
    this.set({ ...tableSize(this.table), fill: null, stroke: null, strokeWidth: 0, objectCaching: false })
    this.loadFont()
  }

  private loadedFont: string | undefined
  /** Has the browser load the table's font (regular and bold), then redraws, so the text isn't drawn in a stand-in font. */
  private loadFont(): void {
    const name = this.table.fontFamily ?? DEFAULT_FONT.name
    if (name === this.loadedFont) return
    this.loadedFont = name
    const font = fontByName(name) ?? DEFAULT_FONT
    void Promise.all([loadFontFace(font, 400, false), loadFontFace(font, BOLD_WEIGHT, false)]).then(() => {
      this.set({ dirty: true })
      this.canvas?.requestRenderAll()
    })
  }

  /** Put new contents in, keeping the top-left corner where it is. */
  setTable(table: TableData): void {
    const corner = this.getPointByOrigin('left', 'top')
    this.table = table
    this.set({ ...tableSize(table), dirty: true })
    this.loadFont()
    this.setPositionByOrigin(corner, 'left', 'top')
    // The handles first, so their places and sizes are worked out for the new contents.
    this.rebuildControls()
    this.setCoords()
  }

  /** After the handles resized the table: the stretch goes into the columns and rows. */
  bakeScale(): void {
    if (this.scaleX === 1 && this.scaleY === 1) return
    const corner = this.getPointByOrigin('left', 'top')
    const table = scaleTable(this.table, this.scaleX, this.scaleY)
    this.set({ scaleX: 1, scaleY: 1 })
    this.setPositionByOrigin(corner, 'left', 'top')
    this.setTable(table)
  }

  /** A page point in the table's own space (top-left corner at 0, 0). */
  toTableSpace(point: XY): XY {
    const local = util.transformPoint(new Point(point.x, point.y), util.invertTransform(this.calcTransformMatrix()))
    return { x: local.x + this.width / 2, y: local.y + this.height / 2 }
  }

  cellAtPoint(point: XY): { r: number; c: number } | undefined {
    const local = this.toTableSpace(point)
    return cellAt(this.table, local.x, local.y)
  }

  /** Where a dragged column (`c`) or row (`r`) tab would drop: the gap between columns or rows nearest the pointer. */
  dropGap(axis: 'r' | 'c', point: XY): number {
    const local = this.toTableSpace(point)
    const at = axis === 'c' ? local.x : local.y
    const sizes = axis === 'c' ? this.table.colWidths : this.table.rowHeights
    let best = 0
    for (let gap = 1; gap <= sizes.length; gap++) {
      if (Math.abs(at - sumTo(sizes, gap)) < Math.abs(at - sumTo(sizes, best))) best = gap
    }
    return best
  }

  /** At the end of a column or row drag: move it to where it was dropped, and pick it there. */
  finishDrag(): void {
    const drag = this.dragging
    this.dragging = undefined
    if (!drag) return
    const table = drag.axis === 'c' ? moveCol(this.table, drag.from, drag.to) : moveRow(this.table, drag.from, drag.to)
    if (table === this.table) return
    this.setTable(table)
    const landed = drag.to > drag.from ? drag.to - 1 : drag.to
    this.cellRange = drag.axis === 'c' ? wholeCol(table, landed) : wholeRow(table, landed)
  }

  _render(ctx: CanvasRenderingContext2D): void {
    const drawing = drawTable(this.table)
    ctx.save()
    ctx.translate(-this.width / 2, -this.height / 2)
    this.renderContents(ctx, drawing)
    this.renderPicked(ctx)
    this.renderDrag(ctx, drawing)
    ctx.restore()
  }

  /** Fills, lines and text, in the table's own space. */
  private renderContents(ctx: CanvasRenderingContext2D, drawing: TableDrawing): void {
    for (const f of drawing.fills) {
      ctx.fillStyle = f.colour
      ctx.fillRect(f.x, f.y, f.width, f.height)
    }
    ctx.strokeStyle = drawing.lineColour
    ctx.lineCap = 'square'
    for (const l of drawing.lines) {
      ctx.lineWidth = l.width
      ctx.beginPath()
      ctx.moveTo(l.x1, l.y1)
      ctx.lineTo(l.x2, l.y2)
      ctx.stroke()
    }
    const editing = this.editingCell
    for (const text of drawing.texts) {
      if (editing?.r === text.r && editing.c === text.c) continue
      ctx.font = fontFor(text)
      ctx.fillStyle = text.colour
      ctx.fillText(text.text, textStart(text, ctx.measureText(text.text).width), text.y)
    }
  }

  /** A blue box around the picked cells, only while the table is selected on screen. */
  private renderPicked(ctx: CanvasRenderingContext2D): void {
    const range = this.cellRange
    if (!range || this.dragging || !this.canvas || this.canvas.getActiveObject() !== this) return
    const x0 = sumTo(this.table.colWidths, range.c0)
    const y0 = sumTo(this.table.rowHeights, range.r0)
    const w = sumTo(this.table.colWidths, range.c1 + 1) - x0
    const h = sumTo(this.table.rowHeights, range.r1 + 1) - y0
    ctx.fillStyle = 'rgba(37, 99, 235, 0.08)'
    ctx.fillRect(x0, y0, w, h)
    ctx.strokeStyle = '#2563eb'
    ctx.lineWidth = 2 / (this.canvas.getZoom() || 1)
    ctx.strokeRect(x0, y0, w, h)
  }

  /**
   * While a column or row is dragged, it is lifted out: its place is left
   * empty, a copy of it with a shadow follows the pointer, and a blue line
   * shows the gap where it will land.
   */
  private renderDrag(ctx: CanvasRenderingContext2D, drawing: TableDrawing): void {
    const drag = this.dragging
    if (!drag) return
    const along = drag.axis === 'c'
    const sizes = along ? this.table.colWidths : this.table.rowHeights
    const start = sumTo(sizes, drag.from)
    const size = sizes.at(drag.from) ?? 0
    const zoom = this.canvas?.getZoom() ?? 1
    const slot = (offset: number): [number, number, number, number] => (along ? [start + offset, 0, size, this.height] : [0, start + offset, this.width, size])
    // The empty place it was lifted from.
    ctx.fillStyle = '#f1f5f9'
    ctx.fillRect(...slot(0))
    // The gap it will land in.
    const gap = sumTo(sizes, drag.to)
    ctx.strokeStyle = '#2563eb'
    ctx.lineWidth = 3 / zoom
    ctx.beginPath()
    if (along) {
      ctx.moveTo(gap, 0)
      ctx.lineTo(gap, this.height)
    } else {
      ctx.moveTo(0, gap)
      ctx.lineTo(this.width, gap)
    }
    ctx.stroke()
    // The lifted copy, following the pointer.
    const shift = drag.at - drag.grab - start
    ctx.save()
    ctx.shadowColor = 'rgba(15, 23, 42, 0.25)'
    ctx.shadowBlur = 12 / zoom
    ctx.shadowOffsetY = 4 / zoom
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(...slot(shift))
    ctx.restore()
    ctx.save()
    ctx.beginPath()
    ctx.rect(...slot(shift))
    ctx.clip()
    ctx.translate(along ? shift : 0, along ? 0 : shift)
    this.renderContents(ctx, drawing)
    ctx.restore()
    ctx.strokeStyle = '#2563eb'
    ctx.lineWidth = 1.5 / zoom
    ctx.strokeRect(...slot(shift))
  }

  _toSVG(): string[] {
    return [`<g opacity="${this.opacity}">\n`, ...tableSvg(this.table, measureText, { x: -this.width / 2, y: -this.height / 2 }), '</g>\n']
  }

  toObject<T extends Omit<Record<string, unknown>, keyof this>, K extends keyof T = never>(propertiesToInclude: K[] = []): Record<string, unknown> {
    return super.toObject([...propertiesToInclude, 'table'] as K[]) as Record<string, unknown>
  }

  /** The usual handles, plus the column and row strips and the "+" buttons. */
  private rebuildControls(): void {
    const base = Object.fromEntries(Object.entries(this.controls).filter(([key]) => !key.startsWith('table')))
    const extra: Record<string, Control> = {}
    for (const i of this.table.colWidths.keys()) extra[`tableColTab${i}`] = lineTab('c', i)
    for (const i of this.table.rowHeights.keys()) extra[`tableRowTab${i}`] = lineTab('r', i)
    // Fabric checks controls last-first, so the resize bars win where they meet the tabs.
    for (const i of this.table.colWidths.keys()) extra[`tableColBar${i}`] = boundaryControl('c', i)
    for (const i of this.table.rowHeights.keys()) extra[`tableRowBar${i}`] = boundaryControl('r', i)
    extra.tableAddCol = addControl('c')
    extra.tableAddRow = addControl('r')
    this.controls = { ...base, ...extra }
  }
}
classRegistry.setClass(TableObject)

/** How far outside the table the column and row strips run, in screen pixels. */
const STRIP_PX = 14
/** Room left free around each line between tabs, for the resize bar, in screen pixels. */
const TAB_GAP_PX = 10
const ADD_BUTTON_PX = 18

/** From the table's own space (centre at 0, 0) to the screen, with zoom, scroll and rotation. */
const toScreen = (object: TableObject): TMat2D => util.multiplyTransformMatrices(object.getViewportTransform(), object.calcTransformMatrix())

/**
 * A point on the table (in its own space, centre at 0, 0) on the screen, moved
 * `out` screen pixels away from it: up for the column strip (`c`), left for the
 * row strip (`r`), turned with the table. A negative `out` goes the other way.
 */
function outside(object: TableObject, local: Point, axis: 'r' | 'c', out: number): Point {
  const onScreen = util.transformPoint(local, toScreen(object))
  const away = axis === 'c' ? new Point(0, -out) : new Point(-out, 0)
  return onScreen.add(util.rotateVector(away, util.degreesToRadians(object.getTotalAngle())))
}

/** How many screen pixels one unit of the table is, across its width (`c`) or height (`r`). */
function screenScale(object: TableObject, axis: 'r' | 'c'): number {
  const m = toScreen(object)
  return axis === 'c' ? Math.hypot(m[0], m[1]) : Math.hypot(m[2], m[3])
}

/** A rounded box `w` × `h` at the control, turned with the table. */
function drawPill(ctx: CanvasRenderingContext2D, object: TableObject, at: XY, w: number, h: number, paint: (pen: CanvasRenderingContext2D) => void): void {
  ctx.save()
  ctx.translate(at.x, at.y)
  ctx.rotate(util.degreesToRadians(object.getTotalAngle()))
  ctx.beginPath()
  ctx.roundRect(-w / 2, -h / 2, w, h, Math.min(w, h) / 2)
  paint(ctx)
  ctx.restore()
}

/** Whether a whole column (`c`) or row (`r`) is among the picked cells. */
function isPicked(object: TableObject, axis: 'r' | 'c', index: number): boolean {
  const range = object.cellRange
  if (!range) return false
  const { colWidths, rowHeights } = object.table
  return axis === 'c'
    ? range.c0 <= index && range.c1 >= index && range.r0 === 0 && range.r1 === rowHeights.length - 1
    : range.r0 <= index && range.r1 >= index && range.c0 === 0 && range.c1 === colWidths.length - 1
}

/**
 * The tab for one column (in the strip above the table) or row (in the strip
 * to its left). Pressing it picks the whole column or row; dragging it along
 * the strip moves it, with a blue line where it will land.
 */
function lineTab(axis: 'r' | 'c', index: number): Control {
  const along = axis === 'c'
  const control: Control = new Control({
    actionName: MOVE_LINE_ACTION,
    cursorStyle: 'grab',
    sizeX: 10,
    sizeY: 10,
    positionHandler: (_dim, _finalMatrix, object: TableObject) => {
      const sizes = along ? object.table.colWidths : object.table.rowHeights
      const middle = sumTo(sizes, index) + (sizes.at(index) ?? 0) / 2
      const local = along ? new Point(middle - object.width / 2, -object.height / 2) : new Point(-object.width / 2, middle - object.height / 2)
      // The tab runs the length of its column or row, less room for the resize bars at both ends.
      const full = (sizes.at(index) ?? 0) * screenScale(object, axis)
      const length = Math.max(6, full - Math.min(TAB_GAP_PX, full * 0.3))
      control.sizeX = along ? length : 10
      control.sizeY = along ? 10 : length
      return outside(object, local, axis, STRIP_PX)
    },
    mouseDownHandler: (_event, transform) => {
      const table = transform.target as TableObject
      table.cellRange = along ? wholeCol(table.table, index) : wholeRow(table.table, index)
      table.canvas?.requestRenderAll()
      return false
    },
    actionHandler: (_event, transform, x, y) => {
      const table = transform.target as TableObject
      const local = table.toTableSpace({ x, y })
      const at = along ? local.x : local.y
      // Where on the column or row it was grabbed, kept from the first move, so the lifted copy doesn't jump.
      const grab = table.dragging?.grab ?? at - sumTo(along ? table.table.colWidths : table.table.rowHeights, index)
      table.dragging = { axis, from: index, to: table.dropGap(axis, { x, y }), at, grab }
      return true
    },
    render: (ctx, left, top, _style, object: TableObject) => {
      const picked = isPicked(object, axis, index) || object.dragging?.from === index && object.dragging.axis === axis
      drawPill(ctx, object, { x: left, y: top }, along ? control.sizeX : 6, along ? 6 : control.sizeY, (pen) => {
        pen.fillStyle = picked ? '#2563eb' : '#e2e8f0'
        pen.strokeStyle = picked ? '#2563eb' : '#94a3b8'
        pen.lineWidth = 1
        pen.fill()
        pen.stroke()
      })
    },
  })
  return control
}

/** A bar in the strip on the line after column (or row) `index`; dragging it resizes that column (or row). */
function boundaryControl(axis: 'r' | 'c', index: number): Control {
  const along = axis === 'c'
  return new Control({
    actionName: RESIZE_CELLS_ACTION,
    cursorStyle: along ? 'col-resize' : 'row-resize',
    sizeX: along ? 8 : 14,
    sizeY: along ? 14 : 8,
    positionHandler: (_dim, _finalMatrix, object: TableObject) => {
      const at = sumTo(along ? object.table.colWidths : object.table.rowHeights, index + 1)
      const local = along ? new Point(at - object.width / 2, -object.height / 2) : new Point(-object.width / 2, at - object.height / 2)
      return outside(object, local, axis, STRIP_PX)
    },
    actionHandler: (_event: TPointerEvent, transform: Transform, x: number, y: number) => {
      const table = transform.target as TableObject
      const local = table.toTableSpace({ x, y })
      const start = sumTo(along ? table.table.colWidths : table.table.rowHeights, index)
      table.setTable(along ? resizeCol(table.table, index, local.x - start) : resizeRow(table.table, index, local.y - start))
      return true
    },
    render: (ctx, left, top, _style, object: TableObject) => {
      drawPill(ctx, object, { x: left, y: top }, along ? 4 : 12, along ? 12 : 4, (pen) => {
        pen.fillStyle = '#ffffff'
        pen.strokeStyle = '#2563eb'
        pen.lineWidth = 1.5
        pen.fill()
        pen.stroke()
      })
    },
  })
}

/** A round "+" just past the last column (right of the table) or below the last row: a click adds one there. */
function addControl(axis: 'r' | 'c'): Control {
  const along = axis === 'c'
  return new Control({
    actionName: ADD_LINE_ACTION,
    cursorStyle: 'pointer',
    sizeX: ADD_BUTTON_PX,
    sizeY: ADD_BUTTON_PX,
    positionHandler: (_dim, _finalMatrix, object: TableObject) => {
      const local = along ? new Point(object.width / 2, 0) : new Point(0, object.height / 2)
      // Out to the right of the table, or down below it: the opposite way to the strips.
      return outside(object, local, along ? 'r' : 'c', -(ADD_BUTTON_PX / 2 + 8))
    },
    mouseUpHandler: (event, transform) => {
      const table = transform.target as TableObject
      const count = along ? table.table.colWidths.length : table.table.rowHeights.length
      const last = along ? wholeCol(table.table, count - 1) : wholeRow(table.table, count - 1)
      const result = runTableCommand(table.table, last, along ? 'col-right' : 'row-below')
      table.setTable(result.table)
      table.cellRange = result.range
      table.canvas?.fire('object:modified', { target: table, e: event, action: ADD_LINE_ACTION })
      table.canvas?.requestRenderAll()
      return true
    },
    render: (ctx, left, top, _style, object: TableObject) => {
      drawPill(ctx, object, { x: left, y: top }, ADD_BUTTON_PX, ADD_BUTTON_PX, (pen) => {
        pen.fillStyle = '#ffffff'
        pen.strokeStyle = '#2563eb'
        pen.lineWidth = 1.5
        pen.fill()
        pen.stroke()
        pen.beginPath()
        pen.moveTo(-4, 0)
        pen.lineTo(4, 0)
        pen.moveTo(0, -4)
        pen.lineTo(0, 4)
        pen.stroke()
      })
    },
  })
}
