/*
 * Figure grids (BIO-86, design A "Open grid" picked 2026-11-25): a block for
 * multi-panel figures (2 side by side, 2 x 2, 1 big + 2 small, 3 in a row,
 * 2 x 3). Each cell starts as an empty chart space; the chart picked for it
 * fills the cell at its size.
 *
 * A grid is a panel (PanelBlock) with a look of its own: no frame, a panel
 * letter above each cell's top-left corner (A, B, C… in reading order, counted
 * together with the slide's panel letters, BIO-83)
 * and, when switched on, one legend for all its charts in a row under the
 * cells. Like a panel's contents, the cells stay ordinary objects on the page
 * pointing at the grid with `panelId`, so moving, copying and deleting work as
 * for panels, and every chart keeps all its own settings.
 *
 * The grid draws its letters and legend from where its cells are, so they
 * follow when cells are moved, added, removed or resized (`syncGrid`, run by
 * the canvas on every change). Resizing a cell moves its row and column
 * neighbours by as much (`startCellResize`); resizing the grid lays the cells
 * out again at the new size with even gaps (`startGridResize`). Nothing is
 * stretched: every step lays things out again at their new size.
 */
import { Control, FabricText, IText, Point, Rect, classRegistry, util, type FabricObject, type GroupProps, type TPointerEvent, type Transform } from 'fabric'

import { ChartObject } from './ChartObject'
import { groupColour } from './chart-model'
import { ContentSpace, SMALLEST_SPACE, bakeContentScale, buildContentSpace, contentBox, setContentBox, sizeContentInSelection } from './content-space'
import { DEFAULT_FONT, fontStack } from './fonts'
import { DEFAULT_PANEL, PanelBlock, bodyOf, contentsOf, redrawPanel, setPanelBox, settingsOf, type Box, type PanelSettings } from './panel-block'
import { DEFAULT_LOOK, letterName, letterRoom, lookOfLetters, sameLook, type LetterLook, type SlideLetters } from './panel-letters'

export type GridLayoutId = 'two' | 'grid' | 'big' | 'three' | 'six'

export type GridSettings = {
  layout: GridLayoutId
  /** Space between cells, in page pixels (the letters sit above it). */
  gap: number
  /** Whether each cell has its panel letter. */
  letters: boolean
  /** One legend for all the grid's charts, under the cells. */
  legend: boolean
}

export const DEFAULT_GRID: GridSettings = { layout: 'grid', gap: 16, letters: true, legend: false }
export const GAP_RANGE = { min: 4, max: 48 }

type Cell = { col: number; row: number; cols?: number; rows?: number }
export type GridLayout = { id: GridLayoutId; name: string; cols: number; rows: number; cells: Cell[] }

export const GRID_LAYOUTS: readonly GridLayout[] = [
  { id: 'two', name: '2 side by side', cols: 2, rows: 1, cells: [{ col: 0, row: 0 }, { col: 1, row: 0 }] },
  { id: 'grid', name: '2 × 2', cols: 2, rows: 2, cells: [{ col: 0, row: 0 }, { col: 1, row: 0 }, { col: 0, row: 1 }, { col: 1, row: 1 }] },
  { id: 'big', name: '1 big + 2 small', cols: 2, rows: 2, cells: [{ col: 0, row: 0, rows: 2 }, { col: 1, row: 0 }, { col: 1, row: 1 }] },
  { id: 'three', name: '3 in a row', cols: 3, rows: 1, cells: [{ col: 0, row: 0 }, { col: 1, row: 0 }, { col: 2, row: 0 }] },
  { id: 'six', name: '2 × 3', cols: 3, rows: 2, cells: [0, 1, 2, 3, 4, 5].map((i) => ({ col: i % 3, row: Math.floor(i / 3) })) },
]
const TWO_BY_TWO: GridLayout = { id: 'grid', name: '2 × 2', cols: 2, rows: 2, cells: [{ col: 0, row: 0 }, { col: 1, row: 0 }, { col: 0, row: 1 }, { col: 1, row: 1 }] }
export const gridLayout = (id: GridLayoutId | undefined): GridLayout => GRID_LAYOUTS.find((layout) => layout.id === id) ?? TWO_BY_TWO

/* ---------- Sizes ---------- */

const LEGEND_SIZE = 10
const LEGEND_GAP = 10
const LEGEND_ROW = 14
const SWATCH = { width: 10, height: 8, gap: 4, between: 14 }
const INK = '#18181b'
const LEGEND_INK = '#27272a'
/** A new cell's size, by how many columns the layout has. */
const NEW_CELL_2 = { width: 220, height: 165 }
const NEW_CELL: Partial<Record<number, { width: number; height: number }>> = { 1: { width: 300, height: 220 }, 2: NEW_CELL_2, 3: { width: 170, height: 130 } }
/** The smallest a chart in a cell gets when the grid is made smaller. */
const SMALLEST_CHART = { width: 60, height: 45 }

/* ---------- The grid object ---------- */

export type GridLetter = { text: string; x: number; y: number }
export type GridLegend = { y: number; items: { name: string; colour: string }[] }

export class GridBlock extends PanelBlock {
  static type = 'GridBlock'
  declare grid?: GridSettings
  /** Each cell's letter, from the box's top-left corner (worked out by `syncGrid`). */
  declare gridLetters?: GridLetter[]
  /** The shared legend's row, from the box's top-left corner, when it is on. */
  declare gridLegend?: GridLegend

  /** While a gap handle is dragged: the gap and where the pointer was when it started. */
  gapDrag: { gap: number; from: number } | undefined

  constructor(objects?: FabricObject[], options?: Partial<GroupProps>) {
    super(objects, options)
    // A handle in the middle of each gap between cells: dragging one widens or narrows every gap (owner's feedback, 2026-11-25).
    const handles: Record<string, Control> = {}
    for (let i = 0; i < GAP_HANDLES; i++) for (const axis of ['across', 'down'] as const) handles[`${GAP_HANDLE}${axis}${i}`] = gapControl(axis, i)
    this.controls = { ...handles, ...this.controls }
  }

  lookParts(_settings: PanelSettings, size: { width: number; height: number }): FabricObject[] {
    return gridParts(this, size)
  }
}
classRegistry.setClass(GridBlock)

/** What a grid saves of its own (its panel settings and box are saved as a panel's). */
export const GRID_PROPERTIES = ['grid', 'gridLetters', 'gridLegend'] as const

export const isGrid = (object: FabricObject | undefined): object is GridBlock => object instanceof GridBlock
export const gridSettingsOf = (grid: GridBlock): GridSettings => ({ ...DEFAULT_GRID, ...grid.grid })

/** A grid is a panel without frame, title or padding. */
const GRID_PANEL: PanelSettings = { ...DEFAULT_PANEL, style: 'dashed', colour: '#71717a', titleShown: false, title: 'Figure grid', padding: 0 }

/** The weight and size the grid's letters are drawn in (the slide's settings, kept on the grid). */
const lookOf = (grid: GridBlock): LetterLook => grid.letterLook ?? DEFAULT_LOOK

/** The grid's parts for a box of this size: an empty back (so the gaps pick the grid), its letters and its legend. */
function gridParts(grid: GridBlock, size: { width: number; height: number }): FabricObject[] {
  const settings = gridSettingsOf(grid)
  const look = lookOf(grid)
  const back = new Rect({ left: 0, top: 0, width: size.width, height: size.height, fill: 'transparent', strokeWidth: 0, originX: 'left', originY: 'top' })
  const parts: FabricObject[] = [back]
  const font = fontStack(DEFAULT_FONT)
  if (settings.letters)
    for (const letter of grid.gridLetters ?? [])
      parts.push(new FabricText(letter.text, { left: letter.x, top: letter.y, fontFamily: font, fontSize: look.px, fontWeight: look.bold ? 700 : 400, fill: INK, strokeWidth: 0, originX: 'left', originY: 'top' }))
  const legend = settings.legend ? grid.gridLegend : undefined
  if (legend && legend.items.length > 0) {
    const entries = legend.items.map((item) => ({ colour: item.colour, name: new FabricText(item.name, { fontFamily: font, fontSize: LEGEND_SIZE, fill: LEGEND_INK, strokeWidth: 0, originX: 'left', originY: 'top' }) }))
    const widthOf = (name: FabricText) => SWATCH.width + SWATCH.gap + name.width
    const total = entries.reduce((sum, entry) => sum + widthOf(entry.name), 0) + SWATCH.between * (entries.length - 1)
    const middle = legend.y + LEGEND_ROW / 2
    let x = size.width / 2 - total / 2
    for (const { colour, name } of entries) {
      parts.push(new Rect({ left: x, top: middle - SWATCH.height / 2, width: SWATCH.width, height: SWATCH.height, fill: colour, strokeWidth: 0, originX: 'left', originY: 'top' }))
      name.set({ left: x + SWATCH.width + SWATCH.gap, top: middle - name.height / 2 })
      parts.push(name)
      x += widthOf(name) + SWATCH.between
    }
  }
  return parts
}

/* ---------- Cells ---------- */

/** What gets a letter in a grid: its spaces and what fills them (charts, and later images and icons). */
export const isGridCell = (object: FabricObject): boolean => object instanceof ContentSpace || object instanceof ChartObject

/** A cell's box on the page, also inside a selection of several. */
export function cellBox(object: FabricObject): Box {
  if (object instanceof ContentSpace) return contentBox(object)
  const rect = object.getBoundingRect()
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
}

/** Give a cell a new box on the page: a space and a chart take the size (laid out again, not stretched); anything else only moves. */
export function setCellBox(object: FabricObject, box: Box): void {
  if (object instanceof ContentSpace) return setContentBox(object, box)
  if (object instanceof ChartObject) {
    object.setChart({ ...object.chart, width: Math.max(SMALLEST_CHART.width, box.width), height: Math.max(SMALLEST_CHART.height, box.height), grown: undefined })
    object.setPositionByOrigin(new Point(box.x, box.y), 'left', 'top')
    object.setCoords()
    return
  }
  const now = cellBox(object)
  object.set({ left: object.left + box.x - now.x, top: object.top + box.y - now.y })
  object.setCoords()
}

const right = (box: Box) => box.x + box.width
const bottom = (box: Box) => box.y + box.height
const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0)

export function unionOf(boxes: readonly Box[]): Box {
  const x = Math.min(...boxes.map((box) => box.x))
  const y = Math.min(...boxes.map((box) => box.y))
  return { x, y, width: Math.max(...boxes.map(right)) - x, height: Math.max(...boxes.map(bottom)) - y }
}

/** Things in the order cells are lettered in: row by row (tops within a few pixels count as one row), left to right. */
export function inReadingOrder<T>(items: readonly T[], boxOf: (item: T) => Box): T[] {
  const byTop = items.map((item) => ({ item, box: boxOf(item) })).sort((a, b) => a.box.y - b.box.y)
  const rows: { top: number; items: typeof byTop }[] = []
  for (const each of byTop) {
    const row = rows.at(-1)
    if (row && Math.abs(each.box.y - row.top) <= 12) row.items.push(each)
    else rows.push({ top: each.box.y, items: [each] })
  }
  return rows.flatMap((row) => row.items.sort((a, b) => a.box.x - b.box.x).map((each) => each.item))
}

/** The cells a grid holds, in reading order. */
export function cellsOf(grid: GridBlock, objects: readonly FabricObject[]): FabricObject[] {
  return inReadingOrder(
    contentsOf(grid, objects).filter((object) => isGridCell(object) && object.visible),
    cellBox,
  )
}

/** The shared legend's entries: each chart's groups by colour, each name once. Charts drawn in one colour (line, slope, heat map) have no groups to list. */
function legendItems(cells: readonly FabricObject[]): { name: string; colour: string }[] {
  const items = new Map<string, string>()
  for (const cell of cells) {
    if (!(cell instanceof ChartObject)) continue
    const chart = cell.chart
    if (chart.kind === 'heatmap' || chart.kind === 'line' || chart.kind === 'slope') continue
    chart.groups.forEach((group, i) => {
      if (group.name.trim() && !items.has(group.name)) items.set(group.name, groupColour(chart, i))
    })
  }
  return [...items].map(([name, colour]) => ({ name, colour }))
}

/** How much room the letters and legend take around the cells. */
function margins(settings: GridSettings, px: number = DEFAULT_LOOK.px): { top: number; bottom: number } {
  return { top: settings.letters ? letterRoom(px) : 0, bottom: settings.legend ? LEGEND_GAP + LEGEND_ROW : 0 }
}

/**
 * Lay the grid out again around its cells: its box fits them (with the
 * letters' strip above and the legend under them), each cell gets its letter
 * in reading order, and the legend lists the charts' groups. Does nothing when
 * nothing changed; says whether it did something.
 */
export function syncGrid(grid: GridBlock, objects: readonly FabricObject[], lettering?: Lettering): boolean {
  const settings = gridSettingsOf(grid)
  const look = lettering?.look ?? lookOf(grid)
  const cells = cellsOf(grid, objects)
  // A grid with no cells left keeps its box, without letters.
  if (cells.length === 0) {
    if (!grid.gridLetters?.length && !grid.gridLegend?.items.length && sameLook(grid.letterLook, look)) return false
    grid.gridLetters = []
    grid.gridLegend = undefined
    grid.letterLook = look
    const body = bodyOf(grid)
    setPanelBox(grid, body)
    return true
  }
  const boxes = cells.map(cellBox)
  const around = unionOf(boxes)
  const room = margins(settings, look.px)
  const box = { x: around.x, y: around.y - room.top, width: around.width, height: around.height + room.top + room.bottom }
  // Each cell's text comes from the slide's count; without it (mid-drag) the texts it had stay, in the same places.
  const letters = boxes.map((cell, i) => ({ text: lettering?.texts.at(i) ?? grid.gridLetters?.at(i)?.text ?? letterName(i, 'capital'), x: round(cell.x - box.x), y: round(cell.y - room.top + 1 - box.y) }))
  const legend = settings.legend ? { y: round(around.y + around.height + LEGEND_GAP - box.y), items: legendItems(cells) } : undefined
  const body = bodyOf(grid)
  const same =
    JSON.stringify(letters) === JSON.stringify(grid.gridLetters ?? []) &&
    JSON.stringify(legend) === JSON.stringify(grid.gridLegend) &&
    sameLook(grid.letterLook, look) &&
    [box.x - body.x, box.y - body.y, box.width - body.width, box.height - body.height].every((d) => Math.abs(d) < 0.01) &&
    grid.scaleX === 1 &&
    grid.scaleY === 1
  if (same) return false
  grid.gridLetters = letters
  grid.gridLegend = legend
  grid.letterLook = look
  setPanelBox(grid, box)
  return true
}

/** What a grid is lettered with: its cells' texts in its own reading order, and the look. */
export type Lettering = { texts: readonly string[]; look: LetterLook }
const round = (value: number) => Math.round(value * 100) / 100

/**
 * After any change on the page: every letter on the slide (each cell of a
 * grid with letters on, each panel with its letter on) gets its text from one
 * count in reading order, starting at index `start` and written in the slide's
 * style; every grid lays itself out again around its cells; and spaces that
 * were stretched (resized among several, or by a typed size) take the stretch
 * into their size. Things inside a selection of several wait until they are
 * on their own again (their parts can't be rebuilt there). Does nothing, and
 * returns false, when nothing changed.
 */
export function syncLetters(objects: readonly FabricObject[], letters: SlideLetters, start: number): boolean {
  let changed = false
  for (const object of objects) {
    if (object instanceof ContentSpace && !object.group && (object.scaleX !== 1 || object.scaleY !== 1)) {
      bakeContentScale(object, 'left', 'top')
      changed = true
    }
  }
  const look = lookOfLetters(letters)
  // Everything lettered on the slide: a grid's cells, and panels with a letter.
  const lettered: { key: FabricObject; box: Box }[] = []
  for (const object of objects) {
    if (!(object instanceof PanelBlock) || !object.visible) continue
    if (object instanceof GridBlock) {
      if (gridSettingsOf(object).letters) for (const cell of cellsOf(object, objects)) lettered.push({ key: cell, box: cellBox(cell) })
    } else if (settingsOf(object).letter) {
      lettered.push({ key: object, box: bodyOf(object) })
    }
  }
  const texts = new Map<FabricObject, string>()
  for (const [i, item] of inReadingOrder(lettered, (each) => each.box).entries()) texts.set(item.key, letterName(start + i, letters.style))
  for (const object of objects) {
    if (!(object instanceof PanelBlock) || object.group) continue
    if (object instanceof GridBlock) {
      const settings = gridSettingsOf(object)
      const cells = cellsOf(object, objects)
      // A bigger or smaller letter changes the strip above the cells: they give or take the room inside the grid's box.
      if (settings.letters && cells.length > 0 && letterRoom(lookOf(object).px) !== letterRoom(look.px)) {
        const body = bodyOf(object)
        const room = margins(settings, look.px)
        place(cells, fitCells(measured(cells), gapsOf(settings, look.px), { x: body.x, y: body.y + room.top }, { width: body.width, height: body.height - room.top - room.bottom }))
        changed = true
      }
      if (syncGrid(object, objects, { texts: cells.map((cell, i) => texts.get(cell) ?? letterName(i, letters.style)), look })) changed = true
    } else {
      const text = settingsOf(object).letter ? texts.get(object) : undefined
      if (object.letterText === text && (text === undefined || sameLook(object.letterLook, look))) continue
      object.letterText = text
      object.letterLook = text === undefined ? undefined : look
      redrawPanel(object)
      changed = true
    }
  }
  return changed
}

/* ---------- Laying cells out with even gaps ---------- */

type Laid = { boxes: Box[]; extent: { width: number; height: number } }

/**
 * Lay cells out again, their sizes times `k`, every gap between neighbours
 * set to `gap` across and `gapDown` down, the top-left corner of them all at
 * `corner`. Which cells are neighbours comes from where they were: a cell
 * sits right of every cell wholly left of it in its row (overlapping it
 * up and down), and below every cell wholly above it in its column.
 */
function layOut(cells: readonly { box: Box; smallest: { width: number; height: number } }[], k: { x: number; y: number }, gap: { across: number; down: number }, corner: { x: number; y: number }): Laid {
  const was = unionOf(cells.map((cell) => cell.box))
  const items = cells.map(({ box, smallest }) => ({ box, out: { x: 0, y: 0, width: Math.max(smallest.width, box.width * k.x), height: Math.max(smallest.height, box.height * k.y) } }))
  // Across, from the left: each cell starts a gap after the cells before it in its row end.
  for (const item of [...items].sort((a, b) => a.box.x - b.box.x)) {
    const { box } = item
    const before = items.filter((other) => other !== item && right(other.box) <= box.x + 0.5 && overlap(box.y, bottom(box), other.box.y, bottom(other.box)) > 1)
    item.out.x = before.length ? Math.max(...before.map((other) => right(other.out))) + gap.across : corner.x + (box.x - was.x) * k.x
  }
  // Down, from the top: likewise under the cells above it in its column.
  for (const item of [...items].sort((a, b) => a.box.y - b.box.y)) {
    const { box } = item
    const above = items.filter((other) => other !== item && bottom(other.box) <= box.y + 0.5 && overlap(box.x, right(box), other.box.x, right(other.box)) > 1)
    item.out.y = above.length ? Math.max(...above.map((other) => bottom(other.out))) + gap.down : corner.y + (box.y - was.y) * k.y
  }
  const boxes = items.map((item) => item.out)
  const now = unionOf(boxes)
  return { boxes, extent: { width: right(now) - corner.x, height: bottom(now) - corner.y } }
}

const smallestOf = (object: FabricObject) => (object instanceof ChartObject ? SMALLEST_CHART : object instanceof ContentSpace ? { width: SMALLEST_SPACE, height: SMALLEST_SPACE } : cellBox(object))

/** The size factor that makes the laid-out cells `target` long along one side (they only grow with it). */
function solve(extent: (k: number) => number, target: number): number {
  let low = 0.01
  let high = 50
  for (let step = 0; step < 40; step++) {
    const middle = (low + high) / 2
    if (extent(middle) < target) low = middle
    else high = middle
  }
  return (low + high) / 2
}

const gapsOf = (settings: GridSettings, px: number = DEFAULT_LOOK.px) => ({ across: settings.gap, down: settings.gap + margins(settings, px).top })

/** Put the cells at their new boxes, in turn. */
function place(cells: readonly FabricObject[], boxes: readonly Box[]): void {
  for (const [i, box] of boxes.entries()) {
    const cell = cells.at(i)
    if (cell) setCellBox(cell, box)
  }
}

/** Cells with their boxes and how small each may get, for `layOut`. */
const measured = (cells: readonly FabricObject[]) => cells.map((cell) => ({ box: cellBox(cell), smallest: smallestOf(cell) }))

/* ---------- Resizing the grid ---------- */

export type GridResize = { grid: GridBlock; body: Box; around: Box; cells: FabricObject[]; start: ReturnType<typeof measured> }

/** Start resizing a grid by its handles: where it and its cells were. */
export function startGridResize(target: FabricObject, objects: readonly FabricObject[]): GridResize | undefined {
  if (!(target instanceof GridBlock)) return undefined
  const cells = cellsOf(target, objects)
  if (cells.length === 0) return undefined
  const start = measured(cells)
  return { grid: target, body: bodyOf(target), around: unionOf(start.map((cell) => cell.box)), cells, start }
}

/**
 * While the grid is resized (after its own box took the stretch): the cells
 * fill the new box, each as much bigger or smaller, the gaps staying as set.
 */
export function applyGridResize(resize: GridResize, objects: readonly FabricObject[]): void {
  const { grid, body: was, around, cells, start } = resize
  const body = bodyOf(grid)
  const settings = gridSettingsOf(grid)
  const gap = gapsOf(settings, lookOf(grid).px)
  const corner = { x: body.x + around.x - was.x, y: body.y + around.y - was.y }
  const want = { width: body.width - (was.width - around.width), height: body.height - (was.height - around.height) }
  place(cells, fitCells(start, gap, corner, want))
  syncGrid(grid, objects)
}

/** The cells' boxes laid out from `corner` with these gaps, each as much bigger or smaller, all of them filling `want`. */
function fitCells(start: ReturnType<typeof measured>, gap: { across: number; down: number }, corner: { x: number; y: number }, want: { width: number; height: number }): Box[] {
  const kx = solve((k) => layOut(start, { x: k, y: 1 }, gap, corner).extent.width, want.width)
  const ky = solve((k) => layOut(start, { x: 1, y: k }, gap, corner).extent.height, want.height)
  return layOut(start, { x: kx, y: ky }, gap, corner).boxes
}

/** Give a grid a typed size: the cells fill it, the gaps staying as set. */
export function fitGridToBox(grid: GridBlock, box: Box, objects: readonly FabricObject[]): void {
  const resize = startGridResize(grid, objects)
  if (!resize) return
  setPanelBox(grid, box)
  applyGridResize(resize, objects)
}

/* ---------- Resizing one cell ---------- */

export type CellResize = { target: FabricObject; grid: GridBlock; start: Box; others: ReadonlyMap<FabricObject, { box: Box; left: number; top: number }> }

/** The grid an object is a cell of. */
export function gridOf(object: FabricObject, objects: readonly FabricObject[]): GridBlock | undefined {
  const id = (object as FabricObject & { panelId?: string }).panelId
  if (!id) return undefined
  return objects.find((each): each is GridBlock => each instanceof GridBlock && (each as FabricObject & { figureId?: string }).figureId === id)
}

/** Start resizing a cell of a grid: where it and the other cells were. */
export function startCellResize(target: FabricObject, objects: readonly FabricObject[]): CellResize | undefined {
  if (!isGridCell(target)) return undefined
  const grid = gridOf(target, objects)
  if (!grid) return undefined
  const others = new Map(cellsOf(grid, objects).filter((cell) => cell !== target).map((cell) => [cell, { box: cellBox(cell), left: cell.left, top: cell.top }] as const))
  return { target, grid, start: cellBox(target), others }
}

/**
 * Make room for a resized cell: the cells in its row move with the edge
 * that moved on their side (right of it with its right edge, left of it with
 * its left edge), and the cells in its column likewise up and down, so the
 * gaps stay as they were. Then the grid's letters and box follow.
 */
export function applyCellResize(resize: CellResize, objects: readonly FabricObject[]): void {
  const { start } = resize
  const now = cellBox(resize.target)
  const shift = { right: right(now) - right(start), left: now.x - start.x, down: bottom(now) - bottom(start), up: now.y - start.y }
  for (const [cell, { box, left, top }] of resize.others) {
    const inRow = overlap(box.y, bottom(box), start.y, bottom(start)) > 1
    const inColumn = overlap(box.x, right(box), start.x, right(start)) > 1
    const dx = inRow ? (box.x >= right(start) - 0.5 ? shift.right : right(box) <= start.x + 0.5 ? shift.left : 0) : 0
    const dy = inColumn ? (box.y >= bottom(start) - 0.5 ? shift.down : bottom(box) <= start.y + 0.5 ? shift.up : 0) : 0
    cell.set({ left: left + dx, top: top + dy })
    cell.setCoords()
  }
  syncGrid(resize.grid, objects)
}

/* ---------- Spaces resized among several ---------- */

export type SpacesStretch = { selection: FabricObject & { getObjects(): FabricObject[] }; sizes: ReadonlyMap<ContentSpace, { width: number; height: number }> }

/** Start resizing a selection of several holding content spaces: their sizes within it. */
export function startSpacesStretch(selection: FabricObject & { getObjects(): FabricObject[] }): SpacesStretch | undefined {
  const spaces = selection.getObjects().filter((object): object is ContentSpace => object instanceof ContentSpace)
  if (spaces.length === 0) return undefined
  const stretch = { x: Math.abs(selection.scaleX) || 1, y: Math.abs(selection.scaleY) || 1 }
  return { selection, sizes: new Map(spaces.map((space) => [space, { width: contentBox(space).width / stretch.x, height: contentBox(space).height / stretch.y }] as const)) }
}

/** The selection's stretch goes into each space's size, which undoes it on itself: the dashes never stretch. */
export function applySpacesStretch(resize: SpacesStretch): void {
  const stretch = { x: Math.abs(resize.selection.scaleX) || 1, y: Math.abs(resize.selection.scaleY) || 1 }
  for (const [space, size] of resize.sizes) sizeContentInSelection(space, { width: size.width * stretch.x, height: size.height * stretch.y }, stretch)
}

/* ---------- Settings ---------- */

/**
 * Change a grid's settings. A new gap, or letters switched on or off, lays
 * the cells out again with even gaps, the grid's top-left corner staying
 * put; the rest only redraws the grid.
 */
export function updateGrid(grid: GridBlock, change: Partial<GridSettings>, objects: readonly FabricObject[]): void {
  const before = gridSettingsOf(grid)
  const after = { ...before, ...change }
  grid.grid = after
  const cells = cellsOf(grid, objects)
  const look = lookOf(grid)
  if (cells.length > 0 && (after.gap !== before.gap || after.letters !== before.letters || after.legend !== before.legend)) {
    // The grid keeps its box (it may already fill the page's margins): the cells give or take the room (owner's feedback, 2026-11-25).
    const body = bodyOf(grid)
    const room = margins(after, look.px)
    place(cells, fitCells(measured(cells), gapsOf(after, look.px), { x: body.x, y: body.y + room.top }, { width: body.width, height: body.height - room.top - room.bottom }))
  }
  // Drawn again even when the cells' boxes stay; the slide's count (the canvas's next sync) gives the texts again.
  const texts = grid.gridLetters?.map((letter) => letter.text)
  grid.gridLetters = cells.length ? undefined : []
  syncGrid(grid, objects, texts && { texts, look })
}

/** How many cells hold something (not an empty space): a layout needs at least as many. */
export const filledCells = (grid: GridBlock, objects: readonly FabricObject[]) => cellsOf(grid, objects).filter((cell) => !(cell instanceof ContentSpace)).length

/**
 * Switch a grid to another layout: its cells, in reading order, take the new
 * layout's places at the size its cells have now (empty spaces go first
 * when there are too many); new places get empty chart spaces. Returns
 * the spaces to add and the ones to remove; nothing when the layout has
 * fewer places than filled cells.
 */
export function changeLayout(grid: GridBlock, id: GridLayoutId, objects: readonly FabricObject[]): { add: ContentSpace[]; remove: FabricObject[] } | undefined {
  const settings = gridSettingsOf(grid)
  const next = gridLayout(id)
  const cells = cellsOf(grid, objects)
  if (filledCells(grid, objects) > next.cells.length) return undefined
  // Too many cells: the last empty spaces go.
  const remove: FabricObject[] = []
  const kept = [...cells]
  for (let i = kept.length - 1; i >= 0 && kept.length > next.cells.length; i--) if (kept[i] instanceof ContentSpace) remove.push(...kept.splice(i, 1))
  // A cell of the old layout's size, from the cells' area.
  const old = gridLayout(settings.layout)
  const gap = gapsOf(settings, lookOf(grid).px)
  const body = bodyOf(grid)
  const area = cells.length ? unionOf(cells.map(cellBox)) : { x: body.x, y: body.y + gap.down - settings.gap, width: body.width, height: body.height }
  const cell = { width: (area.width - (old.cols - 1) * gap.across) / old.cols, height: (area.height - (old.rows - 1) * gap.down) / old.rows }
  const slots = slotBoxes(next, { x: area.x, y: area.y }, cell, gap)
  place(kept, slots.slice(0, kept.length))
  const add = slots.slice(kept.length).map((slot) => buildContentSpace({ x: slot.x, y: slot.y }, { width: slot.width, height: slot.height }))
  grid.grid = { ...settings, layout: id }
  return { add, remove }
}

/** The boxes of a layout's cells, its top-left corner at `corner`, each cell `cell` big. */
function slotBoxes(layout: GridLayout, corner: { x: number; y: number }, cell: { width: number; height: number }, gap: { across: number; down: number }): Box[] {
  return layout.cells.map((c) => ({
    x: corner.x + c.col * (cell.width + gap.across),
    y: corner.y + c.row * (cell.height + gap.down),
    width: cell.width * (c.cols ?? 1) + gap.across * ((c.cols ?? 1) - 1),
    height: cell.height * (c.rows ?? 1) + gap.down * ((c.rows ?? 1) - 1),
  }))
}

/* ---------- Building one ---------- */

/**
 * A new grid of empty chart spaces for a layout, the whole of it centred at
 * `centre`. Given `area` (a page's room inside its margins), the grid fills
 * it, as a chart placed on an empty page does; otherwise each cell has a
 * standard size. The spaces still need the grid's id once it has one.
 */
export function buildGrid(id: GridLayoutId, centre: { x: number; y: number }, settings: Partial<GridSettings> = {}, area?: { width: number; height: number }): { panel: GridBlock; spaces: ContentSpace[] } {
  const layout = gridLayout(id)
  const full = { ...DEFAULT_GRID, ...settings, layout: id }
  const gap = gapsOf(full)
  const room = margins(full)
  const cell = area
    ? { width: Math.max(SMALLEST_SPACE, (area.width - (layout.cols - 1) * gap.across) / layout.cols), height: Math.max(SMALLEST_SPACE, (area.height - room.top - room.bottom - (layout.rows - 1) * gap.down) / layout.rows) }
    : (NEW_CELL[layout.cols] ?? NEW_CELL_2)
  const width = layout.cols * cell.width + (layout.cols - 1) * gap.across
  const height = room.top + layout.rows * cell.height + (layout.rows - 1) * gap.down + room.bottom
  const corner = { x: centre.x - width / 2, y: centre.y - height / 2 }
  const slots = slotBoxes(layout, { x: corner.x, y: corner.y + room.top }, cell, gap)
  const spaces = slots.map((slot) => buildContentSpace({ x: slot.x, y: slot.y }, { width: slot.width, height: slot.height }))
  const grid = new GridBlock([new Rect({ left: 0, top: 0, width, height, fill: 'transparent', strokeWidth: 0, originX: 'left', originY: 'top' })], { lockRotation: true })
  Object.assign(grid, { panel: { ...GRID_PANEL }, panelWidth: width, panelHeight: height, grid: full })
  grid.setControlVisible('mtr', false)
  grid.setPositionByOrigin(new Point(corner.x + width / 2, corner.y + height / 2), 'center', 'center')
  grid.setCoords()
  // Its letters: worked out from its spaces as on the page (they have no grid id yet, so they're passed straight in).
  grid.gridLetters = inReadingOrder(spaces.map(contentBox), (box) => box).map((box, i) => ({ text: letterName(i, 'capital'), x: round(box.x - corner.x), y: round(box.y - room.top + 1 - corner.y) }))
  grid.gridLegend = full.legend ? { y: round(height - LEGEND_ROW), items: [] } : undefined
  setPanelBox(grid, { x: corner.x, y: corner.y, width, height })
  return { panel: grid, spaces }
}

/* ---------- Gap handles ---------- */

/** What Fabric reports as the action while a grid's gap is dragged. */
export const GRID_GAP_ACTION = 'gridGap'
const GAP_HANDLE = 'gridGap'
/** At most this many gap handles each way (a 2 × 3 grid has 2 across and 1 down). */
const GAP_HANDLES = 6

/**
 * The middles of a grid's gaps on the page: between each cell and the next
 * one to its right in its row (`across`), and the next one under it in its
 * column (`down`), one handle per gap line.
 */
export function gapMiddles(grid: GridBlock): { across: { x: number; y: number }[]; down: { x: number; y: number }[] } {
  const objects = grid.canvas?.getObjects() ?? []
  const boxes = cellsOf(grid, objects).map(cellBox)
  const across = new Map<number, { x: number; y: number }>()
  const down = new Map<number, { x: number; y: number }>()
  for (const box of boxes) {
    const next = boxes.filter((other) => other.x >= right(box) - 0.5 && overlap(box.y, bottom(box), other.y, bottom(other)) > 1).sort((a, b) => a.x - b.x)[0]
    if (next) {
      const x = (right(box) + next.x) / 2
      const key = Math.round(x)
      const top = Math.max(box.y, next.y)
      const y = (top + Math.min(bottom(box), bottom(next))) / 2
      if (!across.has(key)) across.set(key, { x, y })
    }
    const under = boxes.filter((other) => other.y >= bottom(box) - 0.5 && overlap(box.x, right(box), other.x, right(other)) > 1).sort((a, b) => a.y - b.y)[0]
    if (under) {
      // Down gaps hold the letters' strip too: the handle sits in the space between the cell and the letter under it.
      const settings = gridSettingsOf(grid)
      const y = (bottom(box) + under.y - margins(settings, lookOf(grid).px).top) / 2
      const key = Math.round(y)
      const left = Math.max(box.x, under.x)
      const x = (left + Math.min(right(box), right(under))) / 2
      if (!down.has(key)) down.set(key, { x, y })
    }
  }
  return { across: [...across.values()], down: [...down.values()] }
}

function gapControl(axis: 'across' | 'down', index: number): Control {
  const control: Control = new Control({
    actionName: GRID_GAP_ACTION,
    cursorStyle: axis === 'across' ? 'ew-resize' : 'ns-resize',
    sizeX: axis === 'across' ? 12 : 36,
    sizeY: axis === 'across' ? 36 : 12,
    getVisibility: (object: FabricObject) => object instanceof GridBlock && gapMiddles(object)[axis].at(index) !== undefined,
    positionHandler: (_dim, _matrix, object: FabricObject) => {
      const middle = object instanceof GridBlock ? gapMiddles(object)[axis].at(index) : undefined
      return util.transformPoint(new Point(middle?.x ?? 0, middle?.y ?? 0), object.canvas?.viewportTransform ?? [1, 0, 0, 1, 0, 0])
    },
    mouseDownHandler: (_event: TPointerEvent, transform: Transform, x: number, y: number) => {
      const grid = transform.target
      if (grid instanceof GridBlock) grid.gapDrag = { gap: gridSettingsOf(grid).gap, from: axis === 'across' ? x : y }
      return false
    },
    mouseUpHandler: (_event: TPointerEvent, transform: Transform) => {
      const grid = transform.target
      if (grid instanceof GridBlock) grid.gapDrag = undefined
      return false
    },
    actionHandler: (_event: TPointerEvent, transform: Transform, x: number, y: number) => {
      const grid = transform.target
      const drag = grid instanceof GridBlock ? grid.gapDrag : undefined
      if (!(grid instanceof GridBlock) || !drag) return false
      // The gap opens to both sides of the handle, so it grows twice as fast as the pointer moves.
      const moved = (axis === 'across' ? x : y) - drag.from
      const gap = Math.round(Math.min(GAP_RANGE.max, Math.max(GAP_RANGE.min, drag.gap + 2 * moved)))
      if (gap === gridSettingsOf(grid).gap) return false
      updateGrid(grid, { gap }, grid.canvas?.getObjects() ?? [])
      return true
    },
    render: (ctx, left, top) => {
      const w = control.sizeX
      const h = control.sizeY
      ctx.save()
      ctx.translate(left, top)
      ctx.fillStyle = 'rgba(37, 99, 235, 0.15)'
      ctx.beginPath()
      ctx.roundRect(-w / 2, -h / 2, w, h, 3)
      ctx.fill()
      ctx.fillStyle = '#2563eb'
      if (axis === 'across') ctx.fillRect(-1, -8, 2, 16)
      else ctx.fillRect(-8, -1, 16, 2)
      ctx.restore()
    },
  })
  return control
}

/* ---------- Its outline on screen ---------- */

/** How a grid's outline looks on screen while the pointer is over it. */
const OUTLINE = { gap: 4, colour: '#2563eb', dash: [4, 3] }

/** The grid the pointer is over: the grid itself or one of its cells (or what fills them). */
export function gridUnder(target: FabricObject | undefined, objects: readonly FabricObject[]): GridBlock | undefined {
  if (!target) return undefined
  return target instanceof GridBlock ? target : gridOf(target, objects)
}

/**
 * Draw the outline of the grid under the pointer on the screen (never
 * exported), a few pixels outside its box, so it's clear where a grid ends
 * and where to grab it. Only while hovered: an outline always shown looked
 * like part of the figure (owner's feedback, 2026-11-25). A selected grid has
 * Fabric's own box instead.
 */
export function drawGridOutlines(ctx: CanvasRenderingContext2D, objects: readonly FabricObject[], zoom: number, hovered: GridBlock | undefined, selected: ReadonlySet<FabricObject>): void {
  ctx.save()
  for (const object of objects) if (object instanceof GridBlock && object.visible) drawLegendPlaceholder(ctx, object, zoom)
  for (const object of objects) {
    if (!(object instanceof GridBlock) || object !== hovered || !object.visible || selected.has(object)) continue
    const body = bodyOf(object)
    ctx.strokeStyle = OUTLINE.colour
    ctx.lineWidth = 1.5
    // Dotted, so it reads as a working aid rather than a line in the figure (owner's pick, 2026-11-25).
    ctx.setLineDash(OUTLINE.dash)
    ctx.beginPath()
    ctx.roundRect(body.x * zoom - OUTLINE.gap, body.y * zoom - OUTLINE.gap, body.width * zoom + 2 * OUTLINE.gap, body.height * zoom + 2 * OUTLINE.gap, 6)
    ctx.stroke()
  }
  ctx.restore()
}

/**
 * Where a grid's legend goes while it is switched on but has nothing to list
 * yet (no graph in any cell), on the page; otherwise undefined.
 */
export function legendPlaceholder(grid: GridBlock): Box | undefined {
  const legend = gridSettingsOf(grid).legend ? grid.gridLegend : undefined
  if (!legend || legend.items.length > 0) return undefined
  const body = bodyOf(grid)
  const width = Math.min(body.width, 180)
  return { x: body.x + (body.width - width) / 2, y: body.y + legend.y, width, height: LEGEND_ROW }
}

/** How the waiting legend looks: grey like an empty chart space. */
const WAITING = { stroke: '#a1a1aa', fill: 'rgba(113, 113, 122, 0.05)', swatch: '#d4d4d8', dash: [3, 3] }

/**
 * A switched-on legend with nothing to list yet shows where it goes, on the
 * screen only (exports leave it out, like empty spaces): a dashed grey strip
 * with three grey swatches and their names as short bars. Without it the
 * legend's room looked like an unexplained gap (owner's feedback, 2026-11-25).
 * It goes once a graph in the grid gives the legend its entries.
 */
function drawLegendPlaceholder(ctx: CanvasRenderingContext2D, grid: GridBlock, zoom: number): void {
  const box = legendPlaceholder(grid)
  if (!box) return
  const z = (value: number) => value * zoom
  ctx.save()
  ctx.fillStyle = WAITING.fill
  ctx.strokeStyle = WAITING.stroke
  ctx.lineWidth = 1
  ctx.setLineDash(WAITING.dash)
  ctx.beginPath()
  ctx.roundRect(z(box.x), z(box.y - 2), z(box.width), z(box.height + 4), z(4))
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = WAITING.swatch
  const item = box.width / 3
  for (let i = 0; i < 3; i++) {
    const x = box.x + item * i + item * 0.18
    const middle = box.y + box.height / 2
    ctx.fillRect(z(x), z(middle - SWATCH.height / 2), z(SWATCH.width), z(SWATCH.height))
    ctx.beginPath()
    ctx.roundRect(z(x + SWATCH.width + SWATCH.gap), z(middle - 1.5), z(item * 0.42), z(3), z(1.5))
    ctx.fill()
  }
  ctx.restore()
}

/* ---------- Detach ---------- */

/** Take a grid apart into plain objects: its letters and legend names as text boxes, the legend's swatches as rectangles. */
export function detachedGridShapes(grid: GridBlock): FabricObject[] {
  // The parts are the back, then the letters (when on), then the legend.
  const letterCount = gridSettingsOf(grid).letters ? (grid.gridLetters?.length ?? 0) : 0
  const parts = grid.removeAll().slice(1)
  return parts.map((part, index) => {
    if (part instanceof FabricText) {
      const text = new IText(part.text, { left: part.left, top: part.top, originX: part.originX, originY: part.originY, fontFamily: part.fontFamily, fontSize: part.fontSize, fontWeight: part.fontWeight, fill: part.fill })
      return Object.assign(text, { name: index < letterCount ? `Letter ${part.text}` : part.text })
    }
    return Object.assign(part, { name: 'Legend swatch' })
  })
}
