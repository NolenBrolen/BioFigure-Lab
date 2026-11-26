// @vitest-environment jsdom
import '../test/canvas-stub'

import { FabricText, type FabricObject } from 'fabric'
import { afterEach, describe, expect, it } from 'vitest'

import { FigureCanvas, idOf } from './FigureCanvas'
import { PanelBlock, bodyOf, panelIdOf, settingsOf } from './panel-block'

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

/** Mouse events the way a browser sends them to the canvas: press on it, move and let go anywhere. */
function pointer(figure: FigureCanvas) {
  const upper = figure.canvas.upperCanvasEl
  const at = (type: string, x: number, y: number, target: EventTarget) =>
    target.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, button: 0, buttons: type === 'mouseup' ? 0 : 1, detail: 1 }))
  return {
    press: (x: number, y: number) => at('mousedown', x, y, upper),
    move: (x: number, y: number) => at('mousemove', x, y, document),
    release: (x: number, y: number) => at('mouseup', x, y, document),
    drag(from: [number, number], to: [number, number]) {
      this.press(...from)
      for (let step = 1; step <= 5; step++) this.move(from[0] + ((to[0] - from[0]) * step) / 5, from[1] + ((to[1] - from[1]) * step) / 5)
      this.release(...to)
    },
  }
}

const panels = (f: FigureCanvas) => f.canvas.getObjects().filter((object): object is PanelBlock => object instanceof PanelBlock)
const square = (f: FigureCanvas, left: number, top: number) => f.addShape({ kind: 'rectangle', left, top, width: 40, height: 40, fill: '#dbeafe', stroke: '#1f2937', strokeWidth: 1 })
const middle = (object: FabricObject): [number, number] => {
  const point = object.getCenterPoint()
  return [point.x, point.y]
}

/** A figure with a new panel (its box 380-620 across, 320-480 down) and a square beside it. */
function withPanel() {
  const f = makeFigure()
  f.addPanel()
  const panel = panels(f)[0]!
  const thing = square(f, 100, 100)
  return { f, panel, thing, mouse: pointer(f) }
}

describe('panel blocks', () => {
  it('a square dropped inside belongs to the panel and moves with it; dragged elsewhere in or out of it, it jumps back, and only leaves once the panel is detached', () => {
    const { f, panel, thing, mouse } = withPanel()
    expect(bodyOf(panel)).toMatchObject({ x: 380, y: 320, width: 240, height: 160 })
    mouse.drag(middle(thing), [500, 420])
    expect(panelIdOf(thing)).toBe(idOf(panel))
    // Above the panel in the stack, so it shows.
    expect(f.canvas.getObjects().indexOf(thing)).toBeGreaterThan(f.canvas.getObjects().indexOf(panel))

    // Grab the panel by an empty spot near its bottom-left corner and move it.
    const [x, y] = middle(thing)
    mouse.drag([395, 470], [495, 520])
    expect(middle(thing)[0]).toBeCloseTo(x + 100, 0)
    expect(middle(thing)[1]).toBeCloseTo(y + 50, 0)

    // Moved to an empty spot in the panel, or pulled onto the page, it jumps back to where it was.
    const inPanel = middle(thing)
    for (const to of [[inPanel[0] - 60, inPanel[1] + 20], [100, 700]] as [number, number][]) {
      f.canvas.setActiveObject(thing)
      mouse.drag(inPanel, to)
      expect(panelIdOf(thing)).toBe(idOf(panel))
      expect(middle(thing)[0]).toBeCloseTo(inPanel[0], 5)
      expect(middle(thing)[1]).toBeCloseTo(inPanel[1], 5)
    }

    // Nor can it hop into another panel: a second one, moved by its corner to 80-320 across, 20-180 down.
    f.addPanel()
    const second = panels(f).find((each) => each !== panel)!
    mouse.drag([395, 470], [95, 170])
    expect(bodyOf(second).x).toBeCloseTo(80, -1)
    f.canvas.setActiveObject(thing)
    mouse.drag(inPanel, middle(second))
    expect(panelIdOf(thing)).toBe(idOf(panel))
    expect(middle(thing)[0]).toBeCloseTo(inPanel[0], 5)

    // Detached, it is a loose square again and can go anywhere.
    f.canvas.setActiveObject(panel)
    expect(f.detachPanel()).toBe(true)
    f.canvas.setActiveObject(thing)
    mouse.drag(middle(thing), [100, 300])
    expect(panelIdOf(thing)).toBeUndefined()
    expect(middle(thing)[1]).toBeCloseTo(300, -1)
  })

  it('with a panel inside a panel, a drop lands in the innermost one, and moving the outer one carries both', () => {
    const { f, panel: outer, thing, mouse } = withPanel()
    // Make the outer panel bigger, then put a second, smaller panel inside it.
    f.canvas.setActiveObject(outer)
    f.resize({ width: 500, height: 400 }, false)
    expect(bodyOf(outer)).toMatchObject({ x: 380, y: 320, width: 500, height: 400 })
    f.addPanel()
    const inner = panels(f).find((panel) => panel !== outer)!
    // By its bottom-left corner, from 395, 470 to 455, 570: its box is then 440-680 across, 420-580 down.
    mouse.drag([395, 470], [455, 570])
    expect(panelIdOf(inner)).toBe(idOf(outer))

    mouse.drag(middle(thing), [560, 500])
    expect(panelIdOf(thing)).toBe(idOf(inner))

    // Moving the outer panel (by its own empty corner) carries the inner one and the square.
    const [outerBefore, innerBefore, thingBefore] = [bodyOf(outer), bodyOf(inner), middle(thing)]
    mouse.drag([395, 710], [345, 690])
    // By as much as the outer panel moved (it may snap a little on the way).
    const [dx, dy] = [bodyOf(outer).x - outerBefore.x, bodyOf(outer).y - outerBefore.y]
    expect(dx).toBeCloseTo(-50, -1)
    expect(dy).toBeCloseTo(-20, -1)
    expect(bodyOf(inner).x).toBeCloseTo(innerBefore.x + dx, 5)
    expect(bodyOf(inner).y).toBeCloseTo(innerBefore.y + dy, 5)
    expect(middle(thing)[0]).toBeCloseTo(thingBefore[0] + dx, 5)
    expect(middle(thing)[1]).toBeCloseTo(thingBefore[1] + dy, 5)
  })

  it('dragging a side handle resizes the box on the spot: mid-drag the title and header keep their size, the far side stays put, the contents keep theirs', () => {
    const { f, panel, thing, mouse } = withPanel()
    mouse.drag(middle(thing), [500, 420])
    f.canvas.setActiveObject(panel)
    const title = () => panel.getObjects().find((part): part is FabricText => part instanceof FabricText)!
    const header = () => panel.getObjects()[1]!
    const [fontSize, headerHeight] = [title().fontSize, header().getScaledHeight()]
    const thingWidth = thing.getScaledWidth()

    // The right-middle handle (on the outline's outer edge), pulled 160 px to the right; checked before letting go.
    mouse.press(620.75, 400)
    mouse.move(700.75, 400)
    mouse.move(780.75, 400)
    expect(panel.scaleX).toBe(1)
    expect(panel.scaleY).toBe(1)
    expect(bodyOf(panel).x).toBeCloseTo(380, 0)
    expect(bodyOf(panel).width).toBeCloseTo(400, 0)
    expect(title().fontSize).toBe(fontSize)
    expect(title().scaleX).toBe(1)
    expect(header().getScaledHeight()).toBeCloseTo(headerHeight, 5)
    mouse.release(780.75, 400)
    expect(panel.panelWidth).toBeCloseTo(400, 0)
    expect(thing.getScaledWidth()).toBe(thingWidth)
  })

  it('Detach turns the panel into plain shapes with its contents loose, all selected; Undo brings the panel back holding them', async () => {
    const { f, panel, thing, mouse } = withPanel()
    mouse.drag(middle(thing), [500, 420])
    f.canvas.setActiveObject(panel)
    expect(f.detachPanel()).toBe(true)
    expect(panels(f)).toHaveLength(0)
    expect(panelIdOf(thing)).toBeUndefined()
    const selected = f.canvas.getActiveObjects()
    expect(selected).toContain(thing)
    // The box, the header strip and the title, now a text that can be typed in.
    expect(selected).toHaveLength(4)
    expect(selected.some((object) => object.type === 'i-text' && (object as unknown as { text: string }).text === 'Panel')).toBe(true)

    f.undo()
    await settle()
    const [back] = panels(f)
    expect(back).toBeDefined()
    const square = f.canvas.getObjects().find((object) => object.type === 'rect' && !(object instanceof PanelBlock))!
    expect(panelIdOf(square)).toBe(idOf(back!))
  })

  it('every change is one undo step, and a panel is saved with the figure and loads back holding its contents', async () => {
    const { f, panel, thing, mouse } = withPanel()
    mouse.drag(middle(thing), [500, 420])
    f.canvas.setActiveObject(panel)
    f.setPanel({ style: 'tab', title: 'Inputs', colour: '#009e73', padding: 20 })
    f.undo()
    await settle()
    expect(settingsOf(panels(f)[0]!)).toMatchObject({ style: 'bar', title: 'Panel', colour: '#0072b2' })
    f.redo()
    await settle()

    const loaded = makeFigure(f.serialize())
    await settle()
    const [again] = panels(loaded)
    expect(settingsOf(again!)).toMatchObject({ style: 'tab', title: 'Inputs', colour: '#009e73', padding: 20 })
    const body = bodyOf(again!)
    expect([body.x, body.y, body.width, body.height].map(Math.round)).toEqual([380, 320, 240, 160])
    const contents = loaded.canvas.getObjects().filter((object) => panelIdOf(object) === idOf(again!))
    expect(contents).toHaveLength(1)
  })

  it('deleting a panel takes its contents along; duplicating it copies them into the copy', async () => {
    const { f, panel, thing, mouse } = withPanel()
    mouse.drag(middle(thing), [500, 420])
    f.canvas.setActiveObject(panel)
    await f.duplicate()
    const copy = panels(f).find((other) => other !== panel)!
    expect(copy).toBeDefined()
    expect(f.canvas.getObjects().filter((object) => panelIdOf(object) === idOf(copy))).toHaveLength(1)
    expect(f.canvas.getObjects().filter((object) => panelIdOf(object) === idOf(panel))).toEqual([thing])

    f.canvas.discardActiveObject()
    f.canvas.setActiveObject(panel)
    f.deleteSelection()
    expect(f.canvas.getObjects()).not.toContain(thing)
    expect(panels(f)).toEqual([copy])
  })
})
