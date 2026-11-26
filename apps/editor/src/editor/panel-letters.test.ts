// @vitest-environment jsdom
import '../test/canvas-stub'

import { FabricText, IText, Point, util } from 'fabric'
import { afterEach, describe, expect, it } from 'vitest'

import { emptyPanel, figureGrid } from './blocks'
import { FigureCanvas } from './FigureCanvas'
import { GridBlock, cellBox, cellsOf } from './grid-block'
import { PanelBlock, bakePanelScale, bodyOf, setPanelBox } from './panel-block'
import { letterContexts, letterName, letterRoom, DEFAULT_LOOK } from './panel-letters'

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

const settle = () => new Promise((resolve) => setTimeout(resolve, 50))
const gridIn = (f: FigureCanvas) => f.canvas.getObjects().find((object): object is GridBlock => object instanceof GridBlock)!
const panels = (f: FigureCanvas) => f.canvas.getObjects().filter((object): object is PanelBlock => object instanceof PanelBlock && !(object instanceof GridBlock))
/** A panel's letter: its last text part (the title comes first). */
const letterPart = (panel: PanelBlock) => panel.getObjects().filter((part): part is FabricText => part instanceof FabricText).at(-1)!
/** A grid's letters, with where each cell's is. */
const gridLetters = (grid: GridBlock) => grid.getObjects().filter((part): part is FabricText => part instanceof FabricText).map((part) => part.text)

/** A slide with a grid of two cells and one panel with its letter on, the panel's box put at `box`. */
function slideWith(box: { x: number; y: number; width: number; height: number }) {
  const f = makeFigure()
  f.addBlock(figureGrid('two'))
  f.addBlock(emptyPanel)
  const panel = panels(f)[0]!
  f.canvas.setActiveObject(panel)
  f.setPanel({ letter: true })
  setPanelBox(panel, box)
  f.setPanel({})
  return { f, panel, grid: gridIn(f) }
}

describe('panel letters (BIO-83)', () => {
  it('counts a panel and a grid\'s cells together in reading order, and counts again when the panel moves', () => {
    const { f, panel, grid } = slideWith({ x: 40, y: 640, width: 200, height: 100 })
    // The panel is below the grid: the grid's cells are A and B, the panel C.
    expect(gridLetters(grid)).toEqual(['A', 'B'])
    expect(letterPart(panel).text).toBe('C')
    // Moved above the grid, it comes first.
    f.canvas.setActiveObject(panel)
    setPanelBox(panel, { x: 40, y: 20, width: 200, height: 100 })
    f.setPanel({})
    expect(letterPart(panel).text).toBe('A')
    expect(gridLetters(grid)).toEqual(['B', 'C'])
    // Level with the grid's cells (same row) and to their left, it is still first; to their right, last.
    const row = cellBox(cellsOf(grid, f.canvas.getObjects())[0]!)
    setPanelBox(panel, { x: row.x - 300, y: row.y, width: 200, height: 100 })
    f.setPanel({})
    expect(letterPart(panel).text).toBe('A')
    setPanelBox(panel, { x: 900, y: row.y, width: 90, height: 100 })
    f.setPanel({})
    expect(letterPart(panel).text).toBe('C')
  })

  it('the letter sits at the top-left corner, moves with the panel, never shifts the frame and is not stretched by resizing', () => {
    const f = makeFigure()
    f.addBlock(emptyPanel)
    const panel = panels(f)[0]!
    const before = bodyOf(panel)
    f.setPanel({ letter: true })
    const after = bodyOf(panel)
    expect(after.x).toBeCloseTo(before.x)
    expect(after.y).toBeCloseTo(before.y)
    const place = () => {
      const part = letterPart(panel)
      return util.transformPoint(new Point(part.left, part.top), panel.calcTransformMatrix())
    }
    const room = letterRoom(DEFAULT_LOOK.px)
    expect(Math.abs(place().x - (after.x))).toBeLessThan(1)
    expect(Math.abs(place().y - (after.y - room + 1))).toBeLessThan(1)
    // Moving the panel takes the letter along.
    panel.set({ left: panel.left + 70, top: panel.top + 30 })
    panel.setCoords()
    expect(Math.abs(place().x - (after.x + 70))).toBeLessThan(1)
    expect(Math.abs(place().y - (after.y + 30 - room + 1))).toBeLessThan(1)
    // Stretching the panel lays it out again: the letter stays at the corner, at its own size.
    const size = letterPart(panel).fontSize
    panel.set({ scaleX: 1.6, scaleY: 1.4 })
    bakePanelScale(panel, 'left', 'top')
    const moved = bodyOf(panel)
    expect(letterPart(panel).fontSize).toBe(size)
    expect(letterPart(panel).scaleX).toBe(1)
    expect(Math.abs(place().x - (moved.x))).toBeLessThan(1)
    expect(Math.abs(place().y - (moved.y - room + 1))).toBeLessThan(1)
  })

  it('a slide\'s style and size change every letter at once, one undo step each, and Undo puts them back', async () => {
    const { f, panel, grid } = slideWith({ x: 40, y: 640, width: 200, height: 100 })
    f.setSlideLetters({ style: 'brackets' })
    expect(gridLetters(grid)).toEqual(['(A)', '(B)'])
    expect(letterPart(panel).text).toBe('(C)')
    f.setSlideLetters({ size: 18 }, 'letter-size')
    const px = 18 * (96 / 72)
    expect(letterPart(panel).fontSize).toBeCloseTo(px)
    expect(grid.getObjects().filter((part): part is FabricText => part instanceof FabricText).every((part) => Math.abs(part.fontSize - px) < 0.01)).toBe(true)
    f.undo()
    await settle()
    expect(letterPart(panels(f)[0]!).fontSize).toBeCloseTo(14)
    expect(letterPart(panels(f)[0]!).text).toBe('(C)')
    f.undo()
    await settle()
    expect(letterPart(panels(f)[0]!).text).toBe('C')
    expect(gridLetters(gridIn(f))).toEqual(['A', 'B'])
  })

  it('a slide that goes on continues from the last letter before it, and Start at A restarts', async () => {
    const one = slideWith({ x: 40, y: 640, width: 200, height: 100 })
    const first = one.f.serialize()
    // Slide 2: one panel with a letter, set to go on.
    const two = makeFigure()
    two.addBlock(emptyPanel)
    two.setPanel({ letter: true })
    two.setSlideLetters({ numbering: 'continue' })
    const second = two.serialize()
    const contexts = letterContexts([first, second, undefined])
    expect(contexts.map((context) => context.continueAt)).toEqual([0, 3, 4])
    const shown = makeFigure()
    await shown.showSlide(second, undefined, contexts[1])
    expect(letterPart(panels(shown)[0]!).text).toBe('D')
    shown.setSlideLetters({ numbering: 'start' })
    expect(letterPart(panels(shown)[0]!).text).toBe('A')
    // Slide 3 goes on after a slide that started again: it continues from that slide's one letter.
    expect(letterContexts([first, shown.serialize(), second]).map((context) => context.continueAt)).toEqual([0, 3, 1])
    expect(letterName(3, 'brackets')).toBe('(D)')
  })

  it('a new panel gets its letter on a slide that has letters, not on one that has none', () => {
    const bare = makeFigure()
    bare.addBlock(emptyPanel)
    bare.addBlock(emptyPanel)
    expect(panels(bare).map((panel) => panel.panel?.letter)).toEqual([false, false])
    const lettered = makeFigure()
    lettered.addBlock(emptyPanel)
    lettered.setPanel({ letter: true })
    lettered.addBlock(emptyPanel)
    expect(panels(lettered).map((panel) => panel.panel?.letter)).toEqual([true, true])
    expect(panels(lettered).map((panel) => letterPart(panel).text).sort()).toEqual(['A', 'B'])
    // A grid with its letters on counts too.
    const withGrid = makeFigure()
    withGrid.addBlock(figureGrid('two'))
    withGrid.addBlock(emptyPanel)
    expect(panels(withGrid)[0]!.panel?.letter).toBe(true)
  })

  it('a slide saved before panel letters takes Small and Plain from its grid', async () => {
    const f = makeFigure()
    f.addBlock(figureGrid('two'))
    const saved = JSON.parse(f.serialize()) as { letters?: unknown; objects: { type: string; grid?: Record<string, unknown> }[] }
    delete saved.letters
    for (const object of saved.objects) if (object.type === 'GridBlock') Object.assign(object.grid ?? {}, { upper: false, bold: false })
    const opened = makeFigure(JSON.stringify(saved))
    await settle()
    expect(opened.letters).toMatchObject({ style: 'small', bold: false })
    const grid = gridIn(opened)
    expect(gridLetters(grid)).toEqual(['a', 'b'])
    expect(grid.getObjects().filter((part): part is FabricText => part instanceof FabricText).every((part) => part.fontWeight === 400)).toBe(true)
  })

  it('Detach leaves a panel\'s letter as plain text where it was', () => {
    const f = makeFigure()
    f.addBlock(emptyPanel)
    const panel = panels(f)[0]!
    f.setPanel({ letter: true })
    const part = letterPart(panel)
    expect(part.text).toBe('A')
    expect(f.detachPanel()).toBe(true)
    const letter = f.canvas.getObjects().find((object): object is IText => object instanceof IText && object.text === 'A')
    expect(letter).toBeDefined()
    expect(letter?.fontSize).toBeCloseTo(DEFAULT_LOOK.px)
    expect(letter?.fontWeight).toBe(700)
  })
})
