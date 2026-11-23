// @vitest-environment jsdom
import '../test/canvas-stub'

import type { Route } from '@biofigure-lab/ui/lib/arrow-geometry'
import { describe, expect, it } from 'vitest'

import { Connector } from './Connector'
import { FigureCanvas } from './FigureCanvas'
import type { XY } from './geometry'

// jsdom has no Path2D; arrows draw with it.
globalThis.Path2D ??= class {} as unknown as typeof Path2D

/** A figure with one arrow from (100, 100) to (300, 200), nothing selected. */
function figure(route: Route = 'curved') {
  const element = document.createElement('canvas')
  document.body.append(element)
  const editor = new FigureCanvas(element, { width: 600, height: 400 })
  const look = { route, line: 'solid', start: 'none', end: 'filled', mid: 'none' } as const
  const arrow = editor.addShape({ kind: 'arrow', points: [100, 100, 300, 200], look, stroke: '#000000', strokeWidth: 2 }) as Connector
  editor.canvas.discardActiveObject()
  return { editor, arrow }
}

const fire = (type: string, p: XY, target: EventTarget) =>
  target.dispatchEvent(new MouseEvent(type, { clientX: p.x, clientY: p.y, bubbles: true, button: 0 }))

/** Press at `from`, move to `to` in a few steps, let go there. Page and screen line up here (zoom 1, canvas in the window's corner). */
function drag(editor: FigureCanvas, from: XY, to: XY) {
  fire('mousedown', from, editor.canvas.upperCanvasEl)
  for (const t of [0.25, 0.5, 0.75, 1]) fire('mousemove', { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }, document)
  fire('mouseup', to, document)
}

function click(editor: FigureCanvas, at: XY) {
  fire('mousedown', at, editor.canvas.upperCanvasEl)
  fire('mouseup', at, document)
}

const near = (actual: XY, expected: XY) => {
  expect(actual.x).toBeCloseTo(expected.x)
  expect(actual.y).toBeCloseTo(expected.y)
}

describe('arrow end handles', () => {
  it('dragging the tip of an arrow that is not selected yet moves only the tip, and it stays there', () => {
    const { editor, arrow } = figure('curved')
    drag(editor, { x: 300, y: 200 }, { x: 400, y: 320 })
    const [start, tip] = arrow.pagePoints()
    near(start, { x: 100, y: 100 })
    near(tip, { x: 400, y: 320 })
    expect(editor.canvas.getActiveObject()).toBe(arrow)
    // Undo would bring back what was saved: the new tip.
    const saved = (JSON.parse(editor.serialize()) as { objects: { x2: number }[] }).objects[0]!
    expect(saved.x2).toBeCloseTo(arrow.x2)
  })

  it('moves either end of a selected straight arrow', () => {
    const { editor, arrow } = figure('straight')
    editor.canvas.setActiveObject(arrow)
    drag(editor, { x: 100, y: 100 }, { x: 50, y: 250 })
    drag(editor, { x: 300, y: 200 }, { x: 320, y: 60 })
    const [start, tip] = arrow.pagePoints()
    near(start, { x: 50, y: 250 })
    near(tip, { x: 320, y: 60 })
  })
})

describe('arrow end handles, past the ends', () => {
  it('sit just past each end, so they don\'t hide the arrowheads, and drag their end without a jump', () => {
    const { editor, arrow } = figure('straight')
    editor.canvas.setActiveObject(arrow)
    const handle = arrow.oCoords.p2!
    // Further along the line than the tip at (300, 200).
    expect(Math.hypot(handle.x - 100, handle.y - 100)).toBeGreaterThan(Math.hypot(200, 100) + 5)
    drag(editor, handle, { x: handle.x + 20, y: handle.y - 30 })
    near(arrow.pagePoints()[1], { x: 320, y: 170 })
    near(arrow.pagePoints()[0], { x: 100, y: 100 })
  })
})

describe('arrow tool', () => {
  it('stays on after placing, so a drag and then a click each place an arrow', () => {
    const { editor } = figure()
    let tool = ''
    editor.subscribe((state) => (tool = state.tool))
    editor.setTool('arrow')
    drag(editor, { x: 50, y: 300 }, { x: 250, y: 350 })
    expect(tool).toBe('arrow')
    click(editor, { x: 400, y: 100 })
    expect(editor.canvas.getObjects().filter((object) => object instanceof Connector)).toHaveLength(3)
    expect(tool).toBe('arrow')
  })

  it('selects the arrow just drawn, whose tip can be dragged without drawing a new one', () => {
    const { editor } = figure()
    editor.setTool('arrow')
    drag(editor, { x: 50, y: 300 }, { x: 250, y: 350 })
    const placed = editor.canvas.getActiveObject()
    expect(placed).toBeInstanceOf(Connector)
    // Dropped well away from the page's snap lines (edges, middle, 4 mm margin), so it lands exactly there.
    drag(editor, { x: 250, y: 350 }, { x: 280, y: 340 })
    near((placed as Connector).pagePoints()[1], { x: 280, y: 340 })
    expect(editor.canvas.getObjects()).toHaveLength(2)
    // Pressing somewhere else draws the next arrow, which is then the selected one.
    drag(editor, { x: 400, y: 50 }, { x: 500, y: 100 })
    expect(editor.canvas.getObjects()).toHaveLength(3)
    expect(editor.canvas.getActiveObject()).not.toBe(placed)
  })

  it('picking another arrow type restyles the arrow just drawn and keeps it selected', () => {
    const { editor } = figure()
    editor.setTool('arrow')
    drag(editor, { x: 50, y: 300 }, { x: 250, y: 350 })
    const placed = editor.canvas.getActiveObject() as Connector
    const ends = placed.pagePoints()
    expect(editor.setDrawChoice({ look: { start: 'none', end: 'inhibition', mid: 'none' } }, true)).toBe(true)
    expect(placed.endEnd).toBe('inhibition')
    placed.pagePoints().forEach((end, i) => near(end, ends[i]!))
    expect(editor.canvas.getActiveObject()).toBe(placed)
  })
})

describe('arrow selection box', () => {
  it('a selected arrow is grabbed anywhere inside its box; an unselected one only on its line', () => {
    const { editor, arrow } = figure('straight')
    // (280, 110) is inside the box but far from the line.
    click(editor, { x: 280, y: 110 })
    expect(editor.canvas.getActiveObject()).toBeUndefined()

    editor.canvas.setActiveObject(arrow)
    drag(editor, { x: 280, y: 110 }, { x: 290, y: 130 })
    near(arrow.pagePoints()[0], { x: 110, y: 120 })
    near(arrow.pagePoints()[1], { x: 310, y: 220 })
  })

  it('turns with the rotate area by a corner, and a turned arrow keeps its turn when an end is dragged', () => {
    const { editor, arrow } = figure('elbow')
    editor.canvas.setActiveObject(arrow)
    const before = arrow.pagePoints()
    const centre = arrow.getCenterPoint()
    const corner = arrow.oCoords['rotate-br']!
    // Drag the rotate area a quarter turn round the centre.
    drag(editor, corner, { x: centre.x - (corner.y - centre.y), y: centre.y + (corner.x - centre.x) })
    expect(arrow.angle).toBeCloseTo(90, 0)
    // Each end turned with it: still the same distance apart.
    const [a, b] = arrow.pagePoints()
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(Math.hypot(before[1].x - before[0].x, before[1].y - before[0].y))

    const angle = arrow.angle
    drag(editor, b, { x: b.x + 40, y: b.y + 30 })
    expect(arrow.angle).toBe(angle)
    near(arrow.pagePoints()[0], a)
    near(arrow.pagePoints()[1], { x: b.x + 40, y: b.y + 30 })
  })

  it('squares the box up around a turned arrow once it is let go of, but not for elbow or U-shaped arrows', () => {
    for (const route of ['straight', 'curved', 'elbow', 'u-shape'] as const) {
      const { editor, arrow } = figure(route)
      editor.canvas.setActiveObject(arrow)
      arrow.rotate(30)
      arrow.setCoords()
      const ends = arrow.pagePoints()
      editor.canvas.discardActiveObject()
      expect(arrow.angle).toBe(route === 'elbow' || route === 'u-shape' ? 30 : 0)
      arrow.pagePoints().forEach((end, i) => near(end, ends[i]!))
    }
  })

  it('a turned arrow opens again exactly where it was', async () => {
    const { editor, arrow } = figure('curved')
    arrow.rotate(30)
    arrow.setCoords()
    const ends = arrow.pagePoints()
    const element = document.createElement('canvas')
    document.body.append(element)
    const reopened = new FigureCanvas(element, { width: 600, height: 400 }, editor.serialize())
    await expect.poll(() => reopened.canvas.getObjects().length).toBe(1)
    const copy = reopened.canvas.getObjects()[0] as Connector
    copy.pagePoints().forEach((end, i) => near(end, ends[i]!))
  })
})

describe('snapping a dragged arrow end', () => {
  it('pulls the end onto the page edge, like moving an object does', () => {
    const { editor, arrow } = figure('straight')
    editor.canvas.setActiveObject(arrow)
    const handle = arrow.oCoords.p2!
    // Moves the tip from (300, 200) to (596, 150), 4 px short of the page's right edge.
    drag(editor, handle, { x: handle.x + 296, y: handle.y - 50 })
    near(arrow.pagePoints()[1], { x: 600, y: 150 })
  })
})
