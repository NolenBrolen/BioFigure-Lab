// @vitest-environment jsdom
import '../test/canvas-stub'

import { FabricText, IText, Point, util, type FabricObject } from 'fabric'
import { afterEach, describe, expect, it } from 'vitest'

import { figureGrid } from './blocks'
import { ChartObject } from './ChartObject'
import { chartSizeForPage } from './chart-model'
import { ContentSpace, contentBox } from './content-space'
import { FigureCanvas, idOf } from './FigureCanvas'
import { GridBlock, cellBox, cellsOf, legendPlaceholder, type GridLayoutId } from './grid-block'
import { bodyOf, panelIdOf } from './panel-block'

let figures: FigureCanvas[] = []

afterEach(async () => {
  for (const figure of figures) await figure.dispose()
  figures = []
})

function makeFigure(saved?: string): FigureCanvas {
  const element = document.createElement('canvas')
  document.body.append(element)
  const figure = new FigureCanvas(element, { width: 1000, height: 800 }, saved)
  figures.push(figure)
  return figure
}

const settle = () => new Promise((resolve) => setTimeout(resolve))
const gridIn = (f: FigureCanvas) => f.canvas.getObjects().find((object): object is GridBlock => object instanceof GridBlock)!
const spaces = (f: FigureCanvas) => f.canvas.getObjects().filter((object): object is ContentSpace => object instanceof ContentSpace)
/** The letters the grid draws, in the order it draws them, with where they are on the page. */
const letters = (grid: GridBlock) => grid.getObjects().filter((part): part is FabricText => part instanceof FabricText && part.fontSize === 14)
/** A letter's box on the page (its parts' own boxes are measured inside the grid). */
function letterAt(grid: GridBlock, text: string) {
  const letter = letters(grid).find((each) => each.text === text)!
  const corner = util.transformPoint(new Point(-letter.width / 2, -letter.height / 2), letter.calcTransformMatrix())
  return { left: corner.x, top: corner.y, width: letter.width, height: letter.height }
}
const middle = (object: FabricObject) => object.getCenterPoint()

/** Mouse events the way a browser sends them to the canvas (at zoom 1, page points are client points). */
function pointer(figure: FigureCanvas) {
  const upper = figure.canvas.upperCanvasEl
  const at = (type: string, x: number, y: number, target: EventTarget) =>
    target.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, button: 0, buttons: type === 'mouseup' ? 0 : 1, detail: 1 }))
  return {
    click(x: number, y: number) {
      at('mousedown', x, y, upper)
      at('mouseup', x, y, document)
    },
    press: (x: number, y: number) => at('mousedown', x, y, upper),
    move: (x: number, y: number) => at('mousemove', x, y, document),
    release: (x: number, y: number) => at('mouseup', x, y, document),
  }
}

function withGrid(layout: GridLayoutId = 'grid') {
  const f = makeFigure()
  f.addBlock(figureGrid(layout))
  return { f, grid: gridIn(f) }
}

describe('figure grids', () => {
  it('each layout places a selected grid of empty chart spaces, lettered in reading order, with even gaps', () => {
    const counts: Record<GridLayoutId, number> = { two: 2, grid: 4, big: 3, three: 3, six: 6 }
    for (const [layout, count] of Object.entries(counts) as [GridLayoutId, number][]) {
      const { f, grid } = withGrid(layout)
      expect(f.canvas.getActiveObject()).toBe(grid)
      const cells = cellsOf(grid, f.canvas.getObjects())
      expect(cells).toHaveLength(count)
      for (const cell of cells) expect(panelIdOf(cell)).toBe(idOf(grid))
      expect(letters(grid).map((letter) => letter.text)).toEqual('ABCDEF'.slice(0, count).split(''))
      // Each letter sits just above its cell's top-left corner.
      cells.forEach((cell, i) => {
        const box = cellBox(cell)
        const letter = letterAt(grid, 'ABCDEF'[i]!)
        expect(letter.left).toBeCloseTo(box.x, 0)
        expect(letter.top + letter.height).toBeLessThanOrEqual(box.y + 0.5)
        expect(letter.top + letter.height).toBeGreaterThan(box.y - 6)
      })
    }
    // 1 big + 2 small: the big one is A, then the small ones top to bottom.
    const { f, grid } = withGrid('big')
    const [a, b, c] = cellsOf(grid, f.canvas.getObjects()).map(cellBox)
    expect(a!.height).toBeGreaterThan(b!.height * 1.5)
    expect(b!.x).toBeGreaterThan(a!.x + a!.width)
    expect(c!.y).toBeGreaterThan(b!.y + b!.height)
    // Gaps across are the grid's gap setting (16).
    expect(b!.x - (a!.x + a!.width)).toBeCloseTo(16, 0)
  })

  it('on an empty page a grid fills the room inside the margins, as a chart does; on a page with something on it, it keeps its standard size', () => {
    const { f, grid } = withGrid('grid')
    const area = chartSizeForPage({ width: 1000, height: 800 }, true)
    const body = bodyOf(grid)
    expect(body.width).toBeCloseTo(area.width, 0)
    expect(body.height).toBeCloseTo(area.height, 0)
    expect(body.x + body.width / 2).toBeCloseTo(500, 0)
    expect(body.y + body.height / 2).toBeCloseTo(400, 0)
    // The cells share it with even gaps.
    const [a, b] = cellsOf(grid, f.canvas.getObjects()).map(cellBox)
    expect(b!.x - (a!.x + a!.width)).toBeCloseTo(16, 0)
    expect(b!.x + b!.width).toBeCloseTo(body.x + body.width, 0)

    f.addBlock(figureGrid('grid'))
    const second = f.canvas.getObjects().filter((object): object is GridBlock => object instanceof GridBlock)[1]!
    expect(bodyOf(second).width).toBeLessThan(area.width * 0.7)
  })

  it('a wider gap, from the slider or by dragging the handle in a gap, keeps the grid box: the cells get narrower, mid-drag too', () => {
    const { f, grid } = withGrid('grid')
    const body = bodyOf(grid)
    const width = cellBox(cellsOf(grid, f.canvas.getObjects())[0]!).width
    f.setFigureGrid({ gap: 40 })
    let cells = cellsOf(grid, f.canvas.getObjects()).map(cellBox)
    expect(cells[1]!.x - (cells[0]!.x + cells[0]!.width)).toBeCloseTo(40, 0)
    expect(bodyOf(grid).x).toBeCloseTo(body.x, 0)
    expect(bodyOf(grid).width).toBeCloseTo(body.width, 0)
    expect(bodyOf(grid).height).toBeCloseTo(body.height, 0)
    expect(cells[0]!.width).toBeCloseTo(width - 12, 0)

    // The handle in the gap between the columns, dragged 5 px right: the gap opens by 10 on both sides of it.
    f.canvas.setActiveObject(grid)
    f.canvas.requestRenderAll()
    const handle = grid.oCoords.gridGapacross0!
    expect(handle.x).toBeCloseTo(cells[0]!.x + cells[0]!.width + 20, 0)
    const mouse = pointer(f)
    mouse.press(handle.x, handle.y)
    mouse.move(handle.x + 2, handle.y)
    mouse.move(handle.x + 5, handle.y)
    cells = cellsOf(grid, f.canvas.getObjects()).map(cellBox)
    // Fabric counts the drag from its first step, so a pixel or two less than twice the 5 px moved.
    const opened = cells[1]!.x - (cells[0]!.x + cells[0]!.width)
    expect(opened).toBeGreaterThanOrEqual(46)
    expect(opened).toBeLessThanOrEqual(50)
    expect(bodyOf(grid).width).toBeCloseTo(body.width, 0)
    expect(grid.scaleX).toBe(1)
    mouse.release(handle.x + 5, handle.y)
    expect(grid.grid?.gap).toBeCloseTo(opened, 5)
    expect(f.canvas.getActiveObject()).toBe(grid)
  })

  it('the first click on a space selects the grid, the next picks the space, and a picked chart fills it at its size, in its place; Undo brings the space back', async () => {
    const { f, grid } = withGrid('grid')
    f.canvas.discardActiveObject()
    const target = cellsOf(grid, f.canvas.getObjects())[2]!
    const box = contentBox(target as ContentSpace)
    const index = f.canvas.getObjects().indexOf(target)
    const mouse = pointer(f)
    const at = middle(target)
    mouse.click(at.x, at.y)
    expect(f.canvas.getActiveObject()).toBe(grid)
    mouse.click(at.x, at.y)
    expect(f.canvas.getActiveObject()).toBe(target)
    expect(f.waitingChartSpace()).toBe(target)

    const chart = f.fillChartSpace('line')!
    expect(chart).toBeInstanceOf(ChartObject)
    expect(chart.chart.kind).toBe('line')
    expect(f.canvas.getObjects()).not.toContain(target)
    expect(f.canvas.getObjects().indexOf(chart)).toBe(index)
    expect(panelIdOf(chart)).toBe(idOf(grid))
    expect(f.canvas.getActiveObject()).toBe(chart)
    const rect = chart.getBoundingRect()
    expect(rect.left).toBeCloseTo(box.x, 0)
    expect(rect.top).toBeCloseTo(box.y, 0)
    expect(rect.width).toBeCloseTo(box.width, 0)
    expect(rect.height).toBeCloseTo(box.height, 0)
    // Still cell C.
    expect(letterAt(grid, 'C').left).toBeCloseTo(box.x, 0)

    f.undo()
    await settle()
    expect(spaces(f)).toHaveLength(4)
    expect(f.canvas.getObjects().some((object) => object instanceof ChartObject)).toBe(false)
  })

  it('letters renumber when a cell is removed or trades places, and follow the letter settings; the legend lists the charts\' groups', () => {
    const { f, grid } = withGrid('grid')
    const [a, b, c, d] = cellsOf(grid, f.canvas.getObjects())
    // Remove A: B, C, D become A, B, C.
    f.canvas.setActiveObject(a!)
    f.deleteSelection()
    expect(letters(gridIn(f)).map((letter) => letter.text)).toEqual(['A', 'B', 'C'])
    expect(letterAt(grid, 'A').left).toBeCloseTo(cellBox(b!).x, 0)
    // Drag D onto C, by the mouse: they trade places, so D is B now and C is C.
    const [slotC, slotD] = [cellBox(c!), cellBox(d!)]
    f.canvas.setActiveObject(d!)
    const mouse = pointer(f)
    const from = middle(d!)
    const to = { x: slotC.x + slotC.width / 2, y: slotC.y + slotC.height / 2 }
    mouse.press(from.x, from.y)
    mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2)
    mouse.move(to.x, to.y)
    mouse.release(to.x, to.y)
    expect(panelIdOf(d!)).toBe(idOf(grid))
    expect(cellBox(d!).x).toBeCloseTo(slotC.x, 0)
    expect(cellBox(c!).x).toBeCloseTo(slotD.x, 0)
    expect(cellsOf(grid, f.canvas.getObjects())).toEqual([b, d, c])
    expect(letterAt(grid, 'B').left).toBeCloseTo(cellBox(d!).x, 0)

    f.canvas.setActiveObject(grid)
    f.setSlideLetters({ style: 'small', bold: false })
    expect(letters(grid).map((letter) => letter.text)).toEqual(['a', 'b', 'c'])
    expect(letters(grid).every((letter) => letter.fontWeight === 400)).toBe(true)
    f.setFigureGrid({ letters: false })
    expect(letters(grid)).toHaveLength(0)

    // A chart in the grid, and the shared legend on: its groups show under the cells.
    f.canvas.setActiveObject(c!)
    f.fillChartSpace('bar')
    f.canvas.setActiveObject(grid)
    f.setFigureGrid({ legend: true })
    const names = grid.getObjects().filter((part): part is FabricText => part instanceof FabricText).map((part) => part.text)
    expect(names).toEqual(['Control', 'Drug A', 'Drug B'])
    const lowest = Math.max(...cellsOf(grid, f.canvas.getObjects()).map((cell) => cellBox(cell).y + cellBox(cell).height))
    expect(bodyOf(grid).y + bodyOf(grid).height).toBeGreaterThan(lowest + 15)
  })

  it('a cell let go on a cell of another size trades boxes with it, sizes too; let go in a gap it jumps back', () => {
    const { f, grid } = withGrid('big')
    const [a, b, c] = cellsOf(grid, f.canvas.getObjects())
    const [boxA, boxB, boxC] = [a!, b!, c!].map(cellBox)
    const mouse = pointer(f)
    const drag = (cell: FabricObject, to: { x: number; y: number }) => {
      f.canvas.setActiveObject(cell)
      const from = middle(cell)
      mouse.press(from.x, from.y)
      mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2)
      mouse.move(to.x, to.y)
      mouse.release(to.x, to.y)
    }
    // C onto the big A: C is big now, where A was, and A is small, where C was.
    drag(c!, { x: boxA!.x + boxA!.width / 2, y: boxA!.y + boxA!.height / 2 })
    const sameBox = (got: ReturnType<typeof cellBox>, want: ReturnType<typeof cellBox>) => {
      for (const key of ['x', 'y', 'width', 'height'] as const) expect(got[key]).toBeCloseTo(want[key], 0)
    }
    sameBox(cellBox(c!), boxA!)
    sameBox(cellBox(a!), boxC!)
    expect(cellBox(b!).x).toBeCloseTo(boxB!.x, 5)
    expect(cellsOf(grid, f.canvas.getObjects())).toEqual([c, b, a])

    // B let go in the gap between the cells: back in its slot.
    drag(b!, { x: boxB!.x - 8, y: boxB!.y + 20 })
    expect(cellBox(b!).x).toBeCloseTo(boxB!.x, 5)
    expect(cellBox(b!).y).toBeCloseTo(boxB!.y, 5)
  })

  it('dragging a cell\'s right handle widens it without stretching and moves its row neighbour along, mid-drag; the row below stays', () => {
    const { f, grid } = withGrid('grid')
    const [a, b, c, d] = cellsOf(grid, f.canvas.getObjects()) as ContentSpace[]
    const [boxA, boxB, boxC, boxD] = [a, b, c, d].map((cell) => contentBox(cell!))
    const body = bodyOf(grid)
    f.canvas.setActiveObject(a!)
    const handle = a!.oCoords.mr!
    const mouse = pointer(f)
    mouse.press(handle.x, handle.y)
    mouse.move(handle.x + 20, handle.y)
    mouse.move(handle.x + 40, handle.y)
    // Mid-drag: A is wider but drawn at its size (no scale on it or its parts), B has moved by as much, the grid has grown.
    expect(a!.scaleX).toBe(1)
    for (const part of a!.getObjects()) expect([part.scaleX, part.scaleY]).toEqual([1, 1])
    expect(contentBox(a!).width).toBeCloseTo(boxA!.width + 40, 0)
    expect(contentBox(a!).x).toBeCloseTo(boxA!.x, 5)
    expect(contentBox(b!).x - (contentBox(a!).x + contentBox(a!).width)).toBeCloseTo(boxB!.x - (boxA!.x + boxA!.width), 0)
    expect(letterAt(grid, 'B').left).toBeCloseTo(contentBox(b!).x, 0)
    expect(bodyOf(grid).width).toBeCloseTo(body.width + 40, 0)
    expect(contentBox(c!)).toEqual(boxC)
    expect(contentBox(d!)).toEqual(boxD)
    mouse.release(handle.x + 40, handle.y)
    expect(contentBox(b!).x).toBeCloseTo(boxB!.x + 40, 0)

    // Its bottom handle: the cell below moves down with it, the one beside it stays.
    f.canvas.setActiveObject(a!)
    const bottom = a!.oCoords.mb!
    mouse.press(bottom.x, bottom.y)
    mouse.move(bottom.x, bottom.y + 15)
    mouse.move(bottom.x, bottom.y + 30)
    expect(a!.scaleY).toBe(1)
    const grew = contentBox(a!).height - boxA!.height
    expect(grew).toBeGreaterThan(20)
    expect(contentBox(c!).y).toBeCloseTo(boxC!.y + grew, 5)
    expect(contentBox(b!).y).toBeCloseTo(boxB!.y, 5)
    expect(letterAt(grid, 'C').top).toBeGreaterThan(boxC!.y)
    mouse.release(bottom.x, bottom.y + 30)
  })

  it('dragging the grid\'s handle resizes its cells (charts too) without stretching anything, mid-drag, and the gaps stay as set', () => {
    const { f, grid } = withGrid('two')
    const [first, second] = cellsOf(grid, f.canvas.getObjects())
    f.canvas.setActiveObject(first!)
    const chart = f.fillChartSpace('bar')!
    const before = [cellBox(chart), contentBox(second as ContentSpace)]
    const body = bodyOf(grid)
    f.canvas.setActiveObject(grid)
    const handle = grid.oCoords.mr!
    const mouse = pointer(f)
    mouse.press(handle.x, handle.y)
    mouse.move(handle.x + 30, handle.y)
    mouse.move(handle.x + 60, handle.y)
    // Mid-drag: nothing is scaled; each cell is 30 px wider (the gap doesn't grow), the left side stays put.
    expect(grid.scaleX).toBe(1)
    expect(chart.scaleX).toBe(1)
    expect(second!.scaleX).toBe(1)
    for (const part of (second as ContentSpace).getObjects()) expect(part.scaleX).toBe(1)
    expect(chart.chart.width).toBeCloseTo(before[0]!.width + 30, 0)
    expect(contentBox(second as ContentSpace).width).toBeCloseTo(before[1]!.width + 30, 0)
    const gap = contentBox(second as ContentSpace).x - (cellBox(chart).x + cellBox(chart).width)
    expect(gap).toBeCloseTo(16, 0)
    expect(bodyOf(grid).x).toBeCloseTo(body.x, 0)
    expect(bodyOf(grid).width).toBeCloseTo(body.width + 60, 0)
    expect(letterAt(grid, 'B').left).toBeCloseTo(contentBox(second as ContentSpace).x, 0)
    mouse.release(handle.x + 60, handle.y)
    expect(chart.scaleX).toBe(1)
    expect(chart.chart.width).toBeCloseTo(before[0]!.width + 30, 0)
  })

  it('switching layout keeps the charts, drops spare empty spaces, adds new ones, and letters them all again', () => {
    const { f, grid } = withGrid('grid')
    const [, second] = cellsOf(grid, f.canvas.getObjects())
    f.canvas.setActiveObject(second!)
    const chart = f.fillChartSpace('bar')!
    f.canvas.setActiveObject(grid)
    f.setGridLayout('two')
    let cells = cellsOf(grid, f.canvas.getObjects())
    expect(cells).toHaveLength(2)
    expect(cells).toContain(chart)
    expect(letters(grid).map((letter) => letter.text)).toEqual(['A', 'B'])
    f.setGridLayout('six')
    cells = cellsOf(grid, f.canvas.getObjects())
    expect(cells).toHaveLength(6)
    expect(cells).toContain(chart)
    for (const cell of cells) expect(panelIdOf(cell)).toBe(idOf(grid))
    expect(letters(grid).map((letter) => letter.text)).toEqual(['A', 'B', 'C', 'D', 'E', 'F'])
    // Laid out as 2 rows of 3 with even gaps.
    const boxes = cells.map(cellBox)
    expect(boxes[1]!.x - (boxes[0]!.x + boxes[0]!.width)).toBeCloseTo(16, 0)
    expect(boxes[3]!.y).toBeGreaterThan(boxes[0]!.y + boxes[0]!.height)
  })

  it('a legend switched on with no graph yet shows where it goes (on screen only); a graph gives it its entries', () => {
    const { f, grid } = withGrid('two')
    expect(legendPlaceholder(grid)).toBeUndefined()
    f.setFigureGrid({ legend: true })
    const box = legendPlaceholder(grid)!
    const lowest = Math.max(...cellsOf(grid, f.canvas.getObjects()).map((cell) => cellBox(cell).y + cellBox(cell).height))
    expect(box.y).toBeGreaterThan(lowest)
    expect(box.y + box.height).toBeLessThanOrEqual(bodyOf(grid).y + bodyOf(grid).height + 0.5)
    // Nothing of it is in the figure: the grid's only text parts are its two letters.
    expect(grid.getObjects().filter((part) => part instanceof FabricText)).toHaveLength(2)

    f.canvas.setActiveObject(cellsOf(grid, f.canvas.getObjects())[0]!)
    f.fillChartSpace('bar')
    expect(legendPlaceholder(grid)).toBeUndefined()
    expect(grid.getObjects().filter((part): part is FabricText => part instanceof FabricText).map((part) => part.text)).toContain('Control')
  })

  it('the gap setting evens the gaps; Detach leaves plain objects (letters as text) and Undo brings the grid back; spaces stay out of exports', async () => {
    const { f, grid } = withGrid('three')
    f.setFigureGrid({ gap: 30 })
    const boxes = cellsOf(grid, f.canvas.getObjects()).map(cellBox)
    expect(boxes[1]!.x - (boxes[0]!.x + boxes[0]!.width)).toBeCloseTo(30, 5)
    expect(boxes[2]!.x - (boxes[1]!.x + boxes[1]!.width)).toBeCloseTo(30, 5)

    expect(f.toSVG()).not.toContain('stroke-dasharray: 3 3')

    f.canvas.setActiveObject(grid)
    expect(f.detachPanel()).toBe(true)
    const objects = f.canvas.getObjects()
    expect(objects.some((object) => object instanceof GridBlock)).toBe(false)
    expect(objects.filter((object) => object instanceof IText).map((text) => (text as IText).text)).toEqual(['A', 'B', 'C'])
    for (const space of spaces(f)) expect(panelIdOf(space)).toBeUndefined()

    f.undo()
    await settle()
    const back = gridIn(f)
    expect(back).toBeInstanceOf(GridBlock)
    expect(cellsOf(back, f.canvas.getObjects())).toHaveLength(3)
    expect(letters(back).map((letter) => letter.text)).toEqual(['A', 'B', 'C'])
  })
})
