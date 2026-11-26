// @vitest-environment jsdom
import '../test/canvas-stub'

import { ActiveSelection, type FabricObject } from 'fabric'
import { afterEach, describe, expect, it } from 'vitest'

import { panelWithIcons } from './blocks'
import { FigureCanvas, idOf } from './FigureCanvas'
import { IconCard, cardIcon } from './icon-card'
import { IconSpace, spaceBox } from './icon-space'
import { PanelBlock, bodyOf, panelIdOf } from './panel-block'

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
const spaces = (f: FigureCanvas) => f.canvas.getObjects().filter((object): object is IconSpace => object instanceof IconSpace)
const panel = (f: FigureCanvas) => f.canvas.getObjects().find((object): object is PanelBlock => object instanceof PanelBlock)!
/** A tall icon, twice as high as wide, in two parts like a library icon. */
const TALL = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 20"><rect width="10" height="20" fill="#d55e00"/><circle cx="5" cy="5" r="3" fill="#ffffff"/></svg>'
const middle = (object: FabricObject) => object.getCenterPoint()

const upper = (figure: FigureCanvas) => figure.canvas.upperCanvasEl

/** A click the way a browser sends it to the canvas. */
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

function withBlock() {
  const f = makeFigure()
  f.addBlock((centre) => panelWithIcons(centre, 3))
  return { f, holder: panel(f) }
}

describe('empty icon spaces', () => {
  it('the "Panel with 3 icons" block places a panel holding three spaces in a row, which move with it', () => {
    const { f, holder } = withBlock()
    const row = spaces(f)
    expect(row).toHaveLength(3)
    for (const space of row) expect(panelIdOf(space)).toBe(idOf(holder))
    const [a, b, c] = row.map(spaceBox)
    expect(a!.y).toBe(b!.y)
    expect(b!.x - a!.x).toBeCloseTo(c!.x - b!.x, 5)
    // Inside the panel's box.
    const body = bodyOf(holder)
    expect(a!.x).toBeGreaterThan(body.x)
    expect(c!.x + c!.width).toBeLessThan(body.x + body.width)
    expect(f.canvas.getActiveObject()).toBe(holder)
  })

  it('with a space selected, an icon picked in the Icons panel goes into it: it keeps the space\'s box with the icon centred and fitting, same panel and stack place; Undo brings the space back', async () => {
    const { f, holder } = withBlock()
    const target = spaces(f)[1]!
    const box = spaceBox(target)
    const index = f.canvas.getObjects().indexOf(target)
    f.canvas.setActiveObject(target)
    expect(f.waitingSpace()).toBe(target)

    const filled = await f.addSvg(TALL, 'Tall thing', undefined, 74, 'tall')
    expect(f.canvas.getObjects()).not.toContain(target)
    expect(spaces(f)).toHaveLength(2)
    expect(f.canvas.getObjects().indexOf(filled)).toBe(index)
    expect(panelIdOf(filled)).toBe(idOf(holder))
    expect(f.canvas.getActiveObject()).toBe(filled)
    // Selected, it is the space's box, not the icon's.
    const rect = filled.getBoundingRect()
    expect([rect.left, rect.top, rect.width, rect.height].map(Math.round)).toEqual([box.x, box.y, box.width, box.height].map(Math.round))
    const icon = cardIcon(filled as IconCard)!
    expect(middle(icon).x).toBeCloseTo(box.x + box.width / 2, 5)
    expect(middle(icon).y).toBeCloseTo(box.y + box.height / 2, 5)
    expect(icon.getBoundingRect().height).toBeLessThanOrEqual(box.height)
    expect(icon.getBoundingRect().height).toBeGreaterThan(box.height * 0.7)

    f.undo()
    await settle()
    expect(spaces(f)).toHaveLength(3)
  })

  it('an icon dropped on a space fills that space; dropped elsewhere it is added as usual and the spaces stay', async () => {
    const { f } = withBlock()
    const [first] = spaces(f)
    const box = spaceBox(first!)
    await f.addSvg(TALL, 'Tall thing', { x: 100, y: 100 }, 74, 'tall')
    expect(spaces(f)).toHaveLength(3)
    const filled = await f.addSvg(TALL, 'Tall thing', { x: box.x + 5, y: box.y + 5 }, 74, 'tall')
    expect(spaces(f)).toHaveLength(2)
    expect(middle(filled).x).toBeCloseTo(box.x + box.width / 2, 5)
  })

  it('in a block that is not selected, a click on a space selects the block; with the block selected, a click picks the space', () => {
    const { f, holder } = withBlock()
    const [, second] = spaces(f)
    f.canvas.discardActiveObject()
    const mouse = pointer(f)
    const at = middle(second!)
    mouse.click(at.x, at.y)
    expect(f.canvas.getActiveObject()).toBe(holder)
    mouse.click(at.x, at.y)
    expect(f.canvas.getActiveObject()).toBe(second)
    expect(f.waitingSpace()).toBe(second)
  })

  it('making the middle space wider moves the last one along by as much, and the panel grows with them', async () => {
    const { f, holder } = withBlock()
    const [first, second, third] = spaces(f)
    // Filled, it resizes as its box too.
    f.canvas.setActiveObject(second!)
    const filled = await f.addSvg(TALL, 'Tall thing', undefined, 74, 'tall')
    const [a, b, c] = [spaceBox(first!), filled.getBoundingRect(), spaceBox(third!)]
    const gap = c.x - (b.left + b.width)
    const body = bodyOf(holder)
    f.resize({ width: b.width + 40 }, false)
    const wider = filled.getBoundingRect()
    expect(wider.width).toBeCloseTo(b.width + 40, 0)
    expect(wider.left).toBeCloseTo(b.left, 5)
    expect(spaceBox(first!)).toEqual(a)
    expect(spaceBox(third!).x - (wider.left + wider.width)).toBeCloseTo(gap, 5)
    expect(bodyOf(holder).width).toBeCloseTo(body.width + 40, 5)
    expect(bodyOf(holder).x).toBeCloseTo(body.x, 5)
    // The icon stays centred in its wider box.
    expect(middle(cardIcon(filled as IconCard)!).x).toBeCloseTo(wider.left + wider.width / 2, 5)
  })

  it('dragging the right handle of an empty space moves the next space and grows the panel while dragging, without stretching the space', () => {
    const { f, holder } = withBlock()
    const [, second, third] = spaces(f)
    f.canvas.setActiveObject(second!)
    const [b, c, body] = [spaceBox(second!), spaceBox(third!), bodyOf(holder)]
    const mouse = pointer(f)
    const y = b.y + b.height / 2
    // The right-middle handle, on the outline's outer edge, pulled 30 px right; checked before letting go.
    mouse.press(b.x + b.width + 0.5, y)
    mouse.move(b.x + b.width + 15.5, y)
    mouse.move(b.x + b.width + 30.5, y)
    expect(second!.scaleX).toBe(1)
    expect(spaceBox(second!).width).toBeCloseTo(b.width + 30, 0)
    expect(spaceBox(third!).x).toBeCloseTo(c.x + 30, 0)
    expect(bodyOf(holder).width).toBeCloseTo(body.width + 30, 0)
    mouse.release(b.x + b.width + 30.5, y)
    expect(spaceBox(third!).x).toBeCloseTo(c.x + 30, 0)
  })

  it('without a space selected, a picked icon is added in the middle of the page as before', async () => {
    const { f } = withBlock()
    f.canvas.discardActiveObject()
    expect(f.waitingSpace()).toBeUndefined()
    const icon = await f.addSvg(TALL, 'Tall thing', undefined, 74, 'tall')
    expect(spaces(f)).toHaveLength(3)
    expect(middle(icon).x).toBeCloseTo(500, -1)
  })

  it('a typed size changes the box without stretching it, and spaces are saved with the figure but left out of exports', async () => {
    const { f } = withBlock()
    const space = spaces(f)[0]!
    f.canvas.setActiveObject(space)
    f.resize({ width: 100, height: 80 }, false)
    expect(space.scaleX).toBe(1)
    expect(spaceBox(space)).toMatchObject({ width: 100, height: 80 })

    // The only dashed thing on the page is the spaces' outline.
    expect(f.toSVG()).not.toContain('stroke-dasharray: 3 3')
    expect(space.excludeFromExport).toBe(false)

    const loaded = makeFigure(f.serialize())
    await settle()
    const back = spaces(loaded)
    expect(back).toHaveLength(3)
    expect(spaceBox(back[0]!)).toMatchObject({ width: 100, height: 80 })
    expect(panelIdOf(back[0]!)).toBe(idOf(panel(loaded)))
  })

  it('two spaces selected together and pulled taller grow without stretching, and their panel grows with them, while dragging and after', async () => {
    const { f, holder } = withBlock()
    const [first, second] = spaces(f)
    // The second one filled, so a filled space is checked too.
    f.canvas.setActiveObject(second!)
    const filled = await f.addSvg(TALL, 'Tall thing', undefined, 74, 'tall')
    const before = [spaceBox(first!), filled.getBoundingRect()]
    const body = bodyOf(holder)
    const selection = new ActiveSelection([first!, filled], { canvas: f.canvas })
    f.canvas.setActiveObject(selection)
    f.canvas.requestRenderAll()
    const handle = selection.oCoords.mb!
    const mouse = pointer(f)
    mouse.press(handle.x, handle.y)
    mouse.move(handle.x, handle.y + 20)
    mouse.move(handle.x, handle.y + 40)
    // Mid-drag: the selection is stretched, but each space undoes it on itself.
    expect(selection.scaleY).toBeGreaterThan(1.3)
    expect(first!.scaleY * selection.scaleY).toBeCloseTo(1, 5)
    expect(filled.scaleY * selection.scaleY).toBeCloseTo(1, 5)
    expect(first!.spaceHeight).toBeCloseTo(before[0]!.height * selection.scaleY, 5)
    const grown = first!.spaceHeight! - before[0]!.height
    expect(bodyOf(holder).height).toBeCloseTo(body.height + grown, 0)
    expect(bodyOf(holder).y).toBeCloseTo(body.y, 0)
    const icon = cardIcon(filled as IconCard)!
    expect(Math.abs(icon.scaleX * filled.scaleX * selection.scaleX)).toBeCloseTo(Math.abs(icon.scaleY * filled.scaleY * selection.scaleY), 5)
    mouse.release(handle.x, handle.y + 40)

    f.canvas.discardActiveObject()
    expect(first!.scaleX).toBeCloseTo(1, 5)
    expect(first!.scaleY).toBeCloseTo(1, 5)
    expect(spaceBox(first!).height).toBeGreaterThan(before[0]!.height + 30)
    expect(spaceBox(first!).width).toBeCloseTo(before[0]!.width, 5)
    // Its parts too: drawn at their own size, not stretched (each drag step builds them again).
    for (const part of first!.getObjects()) expect([part.scaleX, part.scaleY]).toEqual([1, 1])
    expect(first!.getBoundingRect().height).toBeCloseTo(spaceBox(first!).height + 1, 0)
    expect(filled.scaleY).toBeCloseTo(1, 5)
    expect(filled.getBoundingRect().height).toBeGreaterThan(before[1]!.height + 30)
    // The icon inside keeps its shape: as wide for its height as before.
    const inside = cardIcon(filled as IconCard)!
    expect(Math.abs(inside.scaleX)).toBeCloseTo(Math.abs(inside.scaleY), 5)
  })

  it('two spaces selected by clicking, pulled taller and then wider, keep the gap between them and move the third one along', () => {
    const { f, holder } = withBlock()
    const [first, second, third] = spaces(f)
    const mouse = pointer(f)
    // Click the block, then the first space; shift-click the second.
    f.canvas.discardActiveObject()
    const a = middle(first!)
    mouse.click(a.x, a.y)
    mouse.click(a.x, a.y)
    const b = middle(second!)
    upper(f).dispatchEvent(new MouseEvent('mousedown', { clientX: b.x, clientY: b.y, bubbles: true, button: 0, buttons: 1, detail: 1, shiftKey: true }))
    document.dispatchEvent(new MouseEvent('mouseup', { clientX: b.x, clientY: b.y, bubbles: true, button: 0, buttons: 0, detail: 1, shiftKey: true }))
    expect(f.canvas.getActiveObjects()).toEqual([first, second])

    const drag = (handle: 'mb' | 'mr', dx: number, dy: number) => {
      const at = (f.canvas.getActiveObject() as ActiveSelection).oCoords[handle]!
      mouse.press(at.x, at.y)
      mouse.move(at.x + dx / 2, at.y + dy / 2)
      mouse.move(at.x + dx, at.y + dy)
      mouse.release(at.x + dx, at.y + dy)
    }
    drag('mb', 0, 40)
    const [a1, b1, c1] = [first, second, third].map((space) => spaceBox(space!))
    const body = bodyOf(holder)
    expect(a1!.height).toBeGreaterThan(64 + 30)

    drag('mr', 40, 0)
    f.canvas.discardActiveObject()
    const [a2, b2, c2] = [first, second, third].map((space) => spaceBox(space!))
    // Each grew by as much, from where it was; the gaps stay; the third moved along.
    expect(a2!.width).toBeGreaterThan(a1!.width + 10)
    expect(b2!.width).toBeCloseTo(a2!.width, 5)
    expect(a2!.x).toBeCloseTo(a1!.x, 0)
    expect(b2!.x - (a2!.x + a2!.width)).toBeCloseTo(b1!.x - (a1!.x + a1!.width), 0)
    expect(c2!.x - (b2!.x + b2!.width)).toBeCloseTo(c1!.x - (b1!.x + b1!.width), 0)
    expect(bodyOf(holder).width - body.width).toBeCloseTo(c2!.x - c1!.x, 0)
    // Still taller, and nothing stretched.
    expect(a2!.height).toBeCloseTo(a1!.height, 0)
    for (const space of [first, second]) {
      expect([space!.scaleX, space!.scaleY].map((scale) => Math.round(scale * 1000) / 1000)).toEqual([1, 1])
      for (const part of space!.getObjects()) expect([part.scaleX, part.scaleY]).toEqual([1, 1])
    }
  })

  it('with two spaces of a block selected, a click on its third space picks that space, not the block', () => {
    const { f } = withBlock()
    const [first, second, third] = spaces(f)
    f.canvas.setActiveObject(new ActiveSelection([first!, second!], { canvas: f.canvas }))
    const c = middle(third!)
    pointer(f).click(c.x, c.y)
    expect(f.canvas.getActiveObject()).toBe(third)
  })
})
