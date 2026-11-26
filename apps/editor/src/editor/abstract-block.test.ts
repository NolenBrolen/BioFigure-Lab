// @vitest-environment jsdom
import '../test/canvas-stub'

import { FabricText, type FabricObject } from 'fabric'
import { afterEach, describe, expect, it } from 'vitest'

import { AbstractBlock, abstractSettingsOf } from './abstract-block'
import { graphicalAbstract } from './blocks'
import { ContentSpace } from './content-space'
import { FigureCanvas, idOf } from './FigureCanvas'
import { IconSpace } from './icon-space'
import { panelIdOf } from './panel-block'
import { sequenceBox } from './sequence-block'

let figures: FigureCanvas[] = []

afterEach(async () => {
  for (const figure of figures) await figure.dispose()
  figures = []
})

function makeFigure(): FigureCanvas {
  const element = document.createElement('canvas')
  document.body.append(element)
  const figure = new FigureCanvas(element, { width: 1200, height: 900 })
  figures.push(figure)
  return figure
}

/** Mouse events the way a browser sends them to the canvas: press on it, move and let go anywhere. */
function pointer(figure: FigureCanvas) {
  const upper = figure.canvas.upperCanvasEl
  const at = (type: string, x: number, y: number, target: EventTarget) =>
    target.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, button: 0, buttons: type === 'mouseup' ? 0 : 1, detail: 1 }))
  return {
    press: (x: number, y: number) => at('mousedown', x, y, upper),
    move: (x: number, y: number) => at('mousemove', x, y, document),
    release: (x: number, y: number) => at('mouseup', x, y, document),
    click(x: number, y: number) {
      this.press(x, y)
      this.release(x, y)
    },
    drag(from: [number, number], to: [number, number]) {
      this.press(...from)
      this.move((from[0] + to[0]) / 2, (from[1] + to[1]) / 2)
      this.move(...to)
      this.release(...to)
    },
  }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 20))

const middle = (object: FabricObject): [number, number] => {
  const point = object.getCenterPoint()
  return [point.x, point.y]
}

/** A figure with a graphical abstract placed from the Blocks tool, and what sits in its parts, left to right. */
function withAbstract(look: 'cards' | 'chevrons' | 'spotlight' = 'cards') {
  const f = makeFigure()
  f.addBlock(graphicalAbstract(look))
  const block = () => f.canvas.getObjects().find((object): object is AbstractBlock => object instanceof AbstractBlock)!
  const contents = () =>
    f.canvas
      .getObjects()
      .filter((object) => panelIdOf(object) === idOf(block()))
      .sort((a, b) => middle(a)[0] - middle(b)[0])
  const texts = () =>
    block()
      .getObjects()
      .filter((part): part is FabricText => part instanceof FabricText)
      .map((part) => part.text.replace(/\n/g, ' '))
  return { f, block, contents, texts, mouse: pointer(f) }
}

describe('graphical abstracts', () => {
  it('places a title over three parts (two icon spaces, a chart space); the first click picks the block, the next one the space', () => {
    const { f, block, contents, texts, mouse } = withAbstract()
    const [problem, method, finding] = contents()
    expect(contents()).toHaveLength(3)
    expect(problem).toBeInstanceOf(IconSpace)
    expect(method).toBeInstanceOf(IconSpace)
    expect(finding).toBeInstanceOf(ContentSpace)
    expect(texts()).toEqual(expect.arrayContaining(['Title of your study', 'Problem', 'Method', 'Finding', 'What was wrong', 'What we did', 'What we found']))
    // The three spaces on one line, inside the block.
    expect(middle(problem!)[1]).toBeCloseTo(middle(finding!)[1], 5)
    const area = sequenceBox(block())
    for (const content of contents()) expect(middle(content)[0]).toBeGreaterThan(area.x)
    expect(f.canvas.getActiveObject()).toBe(block())

    mouse.click(20, 20)
    expect(f.canvas.getActiveObject()).toBeUndefined()
    mouse.click(...middle(method!))
    expect(f.canvas.getActiveObject()).toBe(block())
    mouse.click(...middle(method!))
    expect(f.canvas.getActiveObject()).toBe(method)
  })

  it('a side handle makes it wider while dragging: nothing stretches, the parts spread out, the other edge stays; one Undo puts it back', async () => {
    const { f, block, contents, mouse } = withAbstract()
    f.canvas.setActiveObject(block())
    block().setCoords()
    const start = { area: sequenceBox(block()), middles: contents().map(middle), width: abstractSettingsOf(block()).width }
    const sizes = contents().map((content) => content.getBoundingRect().width)
    const handle = block().oCoords.mr!
    mouse.press(handle.x, handle.y)
    mouse.move(handle.x + 60, handle.y)
    mouse.move(handle.x + 120, handle.y)
    // Checked before letting go.
    expect(block().scaleX).toBe(1)
    for (const part of block().getObjects()) expect(part.scaleX).toBe(1)
    const area = sequenceBox(block())
    expect(area.width - start.area.width).toBeGreaterThan(80)
    expect(area.x).toBeCloseTo(start.area.x, 2)
    contents().forEach((content, i) => {
      expect(content.getBoundingRect().width).toBeCloseTo(sizes[i]!, 5)
      expect(content.scaleX).toBe(1)
    })
    // The first part moves a little, the last one most.
    const moved = contents().map((content, i) => middle(content)[0] - start.middles[i]![0])
    expect(moved[2]!).toBeGreaterThan(moved[0]! + 40)
    mouse.release(handle.x + 120, handle.y)
    expect(abstractSettingsOf(block()).width).toBeGreaterThan(start.width + 80)

    f.undo()
    await settle()
    expect(abstractSettingsOf(block()).width).toBeCloseTo(start.width, 5)
    expect(sequenceBox(block()).width).toBeCloseTo(start.area.width, 2)

    // Pulled in past what its contents need, the other way: it stops there, and its width is what is drawn (no dead stretch on the way back).
    f.canvas.setActiveObject(block())
    block().setCoords()
    const left = block().oCoords.ml!
    mouse.press(left.x, left.y)
    mouse.move(left.x + 500, left.y)
    mouse.move(left.x + 900, left.y)
    mouse.release(left.x + 900, left.y)
    const narrow = sequenceBox(block())
    expect(narrow.width).toBeLessThan(start.area.width - 300)
    expect(abstractSettingsOf(block()).width).toBeCloseTo(narrow.width, 0)
    expect(narrow.x + narrow.width).toBeCloseTo(start.area.x + start.area.width, 2)
  })

  it('title, headings and captions are typed over; captions hide; a new style keeps the colour', () => {
    const { f, block, texts } = withAbstract()
    f.setAbstract({ colour: '#d55e00' })
    f.setAbstract({ title: 'Drug X restores T-cell killing' })
    f.setAbstractText('headings', 1, 'Screen')
    f.setAbstractText('captions', 2, 'Killing up 3×')
    expect(texts()).toEqual(expect.arrayContaining(['Drug X restores T-cell killing', 'Screen', 'Killing up 3×']))
    expect(texts()).not.toContain('Method')

    f.setAbstract({ captionsShown: false })
    expect(texts()).not.toContain('Killing up 3×')
    expect(texts()).not.toContain('What was wrong')

    // Chevron flow writes its headings in capitals.
    for (const [look, heading] of [['chevrons', 'SCREEN'], ['spotlight', 'Screen']] as const) {
      f.setAbstract({ look })
      expect(abstractSettingsOf(block()).colour).toBe('#d55e00')
      expect(texts()).toEqual(expect.arrayContaining(['Drug X restores T-cell killing', heading]))
    }
  })

  it('a content dragged onto another part trades places with it; let go elsewhere it jumps back', () => {
    const { f, contents, mouse } = withAbstract()
    const [problem, method, finding] = contents()
    const slots = contents().map(middle)
    f.canvas.setActiveObject(problem!)
    mouse.drag(middle(problem!), middle(finding!))
    expect(contents()).toEqual([finding, method, problem])
    expect(middle(finding!)[0]).toBeCloseTo(slots[0]![0], 0)
    expect(middle(problem!)[0]).toBeCloseTo(slots[2]![0], 0)

    f.canvas.setActiveObject(method!)
    const before = middle(method!)
    mouse.drag(before, [before[0], before[1] + 400])
    expect(middle(method!)[0]).toBeCloseTo(before[0], 5)
    expect(middle(method!)[1]).toBeCloseTo(before[1], 5)
  })

  it('deleting what is in a part leaves an empty space there, so it always has three parts; Undo brings it back', async () => {
    const { f, block, contents } = withAbstract()
    const [, method] = contents()
    const at = middle(method!)
    f.canvas.setActiveObject(method!)
    f.deleteSelection()
    expect(f.canvas.getObjects()).not.toContain(method)
    expect(contents()).toHaveLength(3)
    const refilled = contents()[1]!
    expect(refilled).toBeInstanceOf(IconSpace)
    expect(middle(refilled)[0]).toBeCloseTo(at[0], 0)
    expect(f.canvas.getObjects()).toContain(block())

    f.undo()
    await settle()
    expect(contents()).toHaveLength(3)
  })

  it('Detach leaves the title, headings and captions as text and the spaces loose, all selected', () => {
    const { f, contents } = withAbstract('spotlight')
    const spaces = contents()
    expect(f.detachSequence()).toBe(true)
    const objects = f.canvas.getObjects()
    expect(objects.some((object) => object instanceof AbstractBlock)).toBe(false)
    for (const space of spaces) expect(panelIdOf(space)).toBeUndefined()
    const names = objects.map((object) => (object as FabricObject & { name?: string }).name)
    expect(names).toEqual(expect.arrayContaining(['Title of your study', 'Problem', 'Finding card', 'Title strip']))
    const selected = f.canvas.getActiveObjects()
    for (const space of spaces) expect(selected).toContain(space)
    expect(selected.some((object) => (object as FabricObject & { name?: string }).name === 'Title of your study')).toBe(true)
  })
})
