// @vitest-environment jsdom
import '../test/canvas-stub'

import { routePoints, type Route } from '@biofigure-lab/ui/lib/arrow-geometry'
import { describe, expect, it } from 'vitest'

import { Connector } from './Connector'
import { ANCHOR_GAP } from './connectors'
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
  it('stays on after placing: a drag places an arrow, a click places none', () => {
    const { editor } = figure()
    let tool = ''
    editor.subscribe((state) => (tool = state.tool))
    editor.setTool('arrow')
    drag(editor, { x: 50, y: 300 }, { x: 250, y: 350 })
    expect(tool).toBe('arrow')
    click(editor, { x: 400, y: 100 })
    expect(editor.canvas.getObjects().filter((object) => object instanceof Connector)).toHaveLength(2)
    expect(editor.canvas.getActiveObject()).toBeUndefined()
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

describe('U-shaped arrow stuck to two objects', () => {
  it('ends just below the bottom of both, and follows when one moves', () => {
    const { editor } = figure()
    const spec = { kind: 'rectangle', width: 100, height: 60, fill: '#dbeafe', stroke: '#1f2937', strokeWidth: 1 } as const
    const left = editor.addShape({ ...spec, left: 50, top: 250 })
    const right = editor.addShape({ ...spec, left: 300, top: 250 })
    editor.canvas.discardActiveObject()
    editor.setDrawChoice({ look: { route: 'u-shape' } })
    editor.setTool('arrow')
    // From inside the left box to inside the right box, at the same height.
    drag(editor, { x: 100, y: 280 }, { x: 350, y: 280 })
    const arrow = editor.canvas.getActiveObject() as Connector
    expect(arrow.route).toBe('u-shape')
    const belowBottom = (box: typeof left, end: XY) => {
      const centre = box.getCenterPoint()
      expect(end.x).toBeCloseTo(centre.x)
      expect(end.y).toBeGreaterThan(centre.y + 25)
      expect(end.y).toBeLessThan(centre.y + 40)
    }
    belowBottom(left, arrow.pagePoints()[0])
    belowBottom(right, arrow.pagePoints()[1])

    editor.setTool('select')
    drag(editor, { x: 330, y: 265 }, { x: 360, y: 325 })
    expect(right.getCenterPoint().y).toBeGreaterThan(left.getCenterPoint().y + 20)
    belowBottom(right, arrow.pagePoints()[1])
  })
})

describe('arrow anchors', () => {
  /** Two boxes side by side and an arrow from the first one's right anchor to the second box's left part. */
  function joined() {
    const { editor } = figure()
    const spec = { kind: 'rectangle', width: 100, height: 60, fill: '#dbeafe', stroke: '#1f2937', strokeWidth: 1 } as const
    const first = editor.addShape({ ...spec, left: 50, top: 100 })
    const second = editor.addShape({ ...spec, left: 350, top: 100 })
    editor.canvas.discardActiveObject()
    editor.setTool('arrow')
    // Starts just outside the right side of the first box, ends on the left dot of the second.
    drag(editor, { x: 158, y: 132 }, { x: 346, y: 131 })
    return { editor, first, second, arrow: editor.canvas.getActiveObject() as Connector }
  }

  it('an arrow pressed at an anchor and let go over another object sticks to those sides', () => {
    const { first, second, arrow } = joined()
    expect(arrow.attachStartSide).toBe('right')
    expect(arrow.attachEndSide).toBe('left')
    const [a, b] = arrow.pagePoints()
    // Half the box plus half its line, plus the small gap from the edge.
    near(a, { x: first.getCenterPoint().x + 50.5 + ANCHOR_GAP, y: first.getCenterPoint().y })
    near(b, { x: second.getCenterPoint().x - 50.5 - ANCHOR_GAP, y: second.getCenterPoint().y })
  })

  it('keeps the sides when an object moves', () => {
    const { editor, second, arrow } = joined()
    editor.setTool('select')
    drag(editor, { x: 400, y: 150 }, { x: 420, y: 250 })
    const centre = second.getCenterPoint()
    expect(centre.y).toBeGreaterThan(200)
    near(arrow.pagePoints()[1], { x: centre.x - 50.5 - ANCHOR_GAP, y: centre.y })
    expect(arrow.attachEndSide).toBe('left')
  })

  it('lets go of the side along with the object when the end is dragged off', () => {
    const { editor, arrow } = joined()
    const handle = arrow.oCoords.p2!
    drag(editor, handle, { x: handle.x + 20, y: handle.y + 150 })
    expect(arrow.attachEnd).toBeUndefined()
    expect(arrow.attachEndSide).toBeUndefined()
    expect(arrow.attachStartSide).toBe('right')
  })

  it('a dragged end handle let go on a dot sticks with that side, and let go on the body sticks with none', () => {
    const { editor, second, arrow } = joined()
    editor.setTool('select')
    editor.canvas.setActiveObject(arrow)
    const handle = arrow.oCoords.p2!
    const centre = second.getCenterPoint()
    // On the bottom dot of the second box: 30.5 down to the edge, then the gap to the dot.
    drag(editor, handle, { x: centre.x, y: centre.y + 30.5 + ANCHOR_GAP })
    expect(arrow.attachEnd).toBeDefined()
    expect(arrow.attachEndSide).toBe('bottom')
    near(arrow.pagePoints()[1], { x: centre.x, y: centre.y + 30.5 + ANCHOR_GAP })
    // Then dragged onto the middle of the box: attached, but with no side.
    drag(editor, arrow.oCoords.p2!, { x: centre.x + 5, y: centre.y })
    expect(arrow.attachEnd).toBeDefined()
    expect(arrow.attachEndSide).toBeUndefined()
  })

  it('a U-shaped arrow drawn from the top anchor goes up and over, not down through the box', () => {
    const { editor, first, second } = joined()
    editor.setDrawChoice({ look: { route: 'u-shape' } })
    // Pressed on the top dot of the first box, let go on the top dot of the second.
    const [one, two] = [first.getCenterPoint(), second.getCenterPoint()]
    drag(editor, { x: one.x, y: one.y - 30.5 - ANCHOR_GAP }, { x: two.x, y: two.y - 30.5 - ANCHOR_GAP })
    const arrow = editor.canvas.getActiveObject() as Connector
    expect(arrow.route).toBe('u-shape')
    expect([arrow.attachStartSide, arrow.attachEndSide]).toEqual(['top', 'top'])
    const matrix = arrow.calcTransformMatrix()
    const path = routePoints({ x: arrow.x1, y: arrow.y1 }, { x: arrow.x2, y: arrow.y2 }, 'u-shape', arrow.ownDirs()).map((p) => ({ x: matrix[0] * p.x + matrix[2] * p.y + matrix[4], y: matrix[1] * p.x + matrix[3] * p.y + matrix[5] }))
    // The second point of the path is above the box's top edge.
    expect(path[1]!.y).toBeLessThan(one.y - 30.5 - ANCHOR_GAP)
  })

  it('pressing the tip of a top marker attaches with that side at any zoom, and a U arrow leaves upward', () => {
    for (const zoom of [1, 0.32]) {
      const { editor } = figure('curved')
      const spec = { kind: 'rectangle', width: 100, height: 60, fill: '#dbeafe', stroke: '#1f2937', strokeWidth: 1 } as const
      const box = editor.addShape({ ...spec, left: 50, top: 200 })
      editor.canvas.discardActiveObject()
      editor.setZoom(zoom)
      editor.setDrawChoice({ look: { route: 'u-shape' } })
      editor.setTool('arrow')
      const centre = box.getCenterPoint()
      // The marker starts at the anchor spot and points up for 10 screen pixels: press at its tip.
      const tip = { x: centre.x * zoom, y: (centre.y - 30.5 - ANCHOR_GAP) * zoom - 10 }
      drag(editor, tip, { x: tip.x + 150 * zoom, y: tip.y - 60 * zoom })
      const arrow = editor.canvas.getActiveObject() as Connector
      expect(arrow.attachStartSide).toBe('top')
      const matrix = arrow.calcTransformMatrix()
      const second = routePoints({ x: arrow.x1, y: arrow.y1 }, { x: arrow.x2, y: arrow.y2 }, 'u-shape', arrow.ownDirs())[1]!
      expect(matrix[1] * second.x + matrix[3] * second.y + matrix[5]).toBeLessThan(centre.y - 30.5)
      // The arrow just drawn is selected and its box covers that marker: pressing it again still starts a new arrow from it.
      const before = editor.canvas.getObjects().filter((object) => object instanceof Connector).length
      drag(editor, tip, { x: tip.x - 150 * zoom, y: tip.y - 60 * zoom })
      expect(editor.canvas.getObjects().filter((object) => object instanceof Connector)).toHaveLength(before + 1)
      expect((editor.canvas.getActiveObject() as Connector).attachStartSide).toBe('top')
    }
  })

  it('with the arrow tool on, clicking an existing arrow selects it instead of drawing a new one', () => {
    const { editor, arrow } = figure('straight')
    editor.setTool('arrow')
    click(editor, { x: 200, y: 150 })
    expect(editor.canvas.getActiveObject()).toBe(arrow)
    expect(editor.canvas.getObjects().filter((object) => object instanceof Connector)).toHaveLength(1)
  })

  /** Two boxes, 100 x 60 each, the second to the right; the arrow tool is on. */
  function twoBoxes(route: Route = 'u-shape') {
    const { editor } = figure('straight')
    const spec = { kind: 'rectangle', width: 100, height: 60, fill: '#dbeafe', stroke: '#1f2937', strokeWidth: 1 } as const
    const first = editor.addShape({ ...spec, left: 50, top: 200 })
    const second = editor.addShape({ ...spec, left: 350, top: 200 })
    editor.canvas.discardActiveObject()
    editor.setDrawChoice({ look: { route } })
    editor.setTool('arrow')
    return { editor, first, second }
  }
  const lastArrow = (editor: FigureCanvas) => editor.canvas.getObjects().findLast((object) => object instanceof Connector) as Connector
  /** The arrow's route on the page, as drawn now. */
  const pathOf = (arrow: Connector) => {
    const m = arrow.calcTransformMatrix()
    return routePoints({ x: arrow.x1, y: arrow.y1 }, { x: arrow.x2, y: arrow.y2 }, arrow.route, arrow.ownDirs()).map((p) => ({ x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] }))
  }

  it('while dragging, a U arrow from a top marker already goes up and comes in from above, the same as after release', () => {
    const { editor, first, second } = twoBoxes()
    const [one, two] = [first.getCenterPoint(), second.getCenterPoint()]
    const marker = (centre: XY) => ({ x: centre.x, y: centre.y - 30.5 - ANCHOR_GAP - 5 })
    fire('mousedown', marker(one), editor.canvas.upperCanvasEl)
    // Up and to the right, not on anything yet: it leaves upward already.
    fire('mousemove', { x: one.x + 80, y: one.y - 120 }, document)
    expect(pathOf(lastArrow(editor))[1]!.y).toBeLessThan(one.y - 30.5)
    // Over the second box's top marker: it comes in from above.
    fire('mousemove', marker(two), document)
    const preview = pathOf(lastArrow(editor))
    expect(preview[1]!.y).toBeLessThan(one.y - 30.5)
    expect(preview[2]!.y).toBeLessThan(preview[3]!.y)
    fire('mouseup', marker(two), document)
    const done = pathOf(editor.canvas.getActiveObject() as Connector)
    done.forEach((point, i) => near(point, preview[i]!))
  })

  it('while dragging, the end follows the pointer over an object, and only snaps onto a marker', () => {
    const { editor, second } = twoBoxes('straight')
    const centre = second.getCenterPoint()
    fire('mousedown', { x: 60, y: 350 }, editor.canvas.upperCanvasEl)
    fire('mousemove', { x: centre.x, y: centre.y }, document)
    near(lastArrow(editor).pagePoints()[1], centre)
    // The left marker: its middle is the gap plus half the marker out from the left edge.
    fire('mousemove', { x: centre.x - 50.5 - ANCHOR_GAP - 5, y: centre.y }, document)
    near(lastArrow(editor).pagePoints()[1], { x: centre.x - 50.5 - ANCHOR_GAP, y: centre.y })
    fire('mouseup', centre, document)
  })

  it('after clicking an arrow with the arrow tool, a click on empty page only lets go of it; a drag still draws the next one', () => {
    const { editor, arrow } = figure('straight')
    editor.setTool('arrow')
    click(editor, { x: 200, y: 150 })
    expect(editor.canvas.getActiveObject()).toBe(arrow)
    click(editor, { x: 450, y: 330 })
    expect(editor.canvas.getObjects().filter((object) => object instanceof Connector)).toHaveLength(1)
    expect(editor.canvas.getActiveObject()).toBeUndefined()
    expect(editor.canvas.getObjects().filter((object) => object instanceof Connector)).toHaveLength(1)
    // A drag on empty page draws, and then the next drag draws right away.
    drag(editor, { x: 50, y: 300 }, { x: 250, y: 350 })
    drag(editor, { x: 400, y: 50 }, { x: 500, y: 100 })
    expect(editor.canvas.getObjects().filter((object) => object instanceof Connector)).toHaveLength(3)
  })

  it('a click with the arrow tool places no arrow: after a U or straight arrow, and with nothing selected', () => {
    for (const route of ['u-shape', 'straight'] as const) {
      const { editor } = twoBoxes(route)
      drag(editor, { x: 100, y: 230 }, { x: 400, y: 230 })
      const count = () => editor.canvas.getObjects().filter((object) => object instanceof Connector).length
      expect(count()).toBe(2)
      click(editor, { x: 300, y: 80 })
      expect(count()).toBe(2)
      expect(editor.canvas.getActiveObject()).toBeUndefined()
      click(editor, { x: 500, y: 60 })
      expect(count()).toBe(2)
      let tool = ''
      editor.subscribe((state) => (tool = state.tool))
      expect(tool).toBe('arrow')
    }
  })

  it('a U arrow is picked within 8 screen pixels of its path at any zoom, but not from the empty inside', () => {
    for (const zoom of [1, 0.32]) {
      const { editor } = figure()
      editor.setZoom(zoom)
      editor.setDrawChoice({ look: { route: 'u-shape' } })
      editor.setTool('arrow')
      drag(editor, { x: 100 * zoom, y: 300 * zoom }, { x: 300 * zoom, y: 300 * zoom })
      editor.canvas.discardActiveObject()
      const arrow = lastArrow(editor)
      // Its bottom segment is at y 340 on the page: a point 6 screen pixels below it hits.
      expect(editor.canvas.objectAt({ x: 200, y: 340 + 6 / zoom })).toBe(arrow)
      expect(editor.canvas.objectAt({ x: 200, y: 340 + 12 / zoom })).toBeUndefined()
      // The middle of the empty inside does not.
      expect(editor.canvas.objectAt({ x: 200, y: 305 })).toBeUndefined()
    }
  })

  it('a U arrow from a top marker keeps going up through selecting, deselecting, undo, redo and reopening', async () => {
    const { editor, first } = twoBoxes()
    const top = first.getCenterPoint().y - 30.5
    const marker = { x: first.getCenterPoint().x, y: top - ANCHOR_GAP - 5 }
    drag(editor, marker, { x: 300, y: 60 })
    const arrow = () => lastArrow(editor)
    const goesUp = (a: Connector) => {
      expect(a.startDir).toBe('up')
      expect(pathOf(a)[1]!.y).toBeLessThan(top)
      // The box holds every point of the route.
      const [hw, hh] = [(a.width + a.strokeWidth) / 2, (a.height + a.strokeWidth) / 2]
      for (const p of routePoints({ x: a.x1, y: a.y1 }, { x: a.x2, y: a.y2 }, a.route, a.ownDirs())) {
        expect(Math.abs(p.x)).toBeLessThanOrEqual(hw + 1e-6)
        expect(Math.abs(p.y)).toBeLessThanOrEqual(hh + 1e-6)
      }
    }
    goesUp(arrow())
    // Click it to select it, then let go of it.
    editor.canvas.discardActiveObject()
    const line = pathOf(arrow())
    click(editor, { x: (line[1]!.x + line[2]!.x) / 2, y: line[1]!.y })
    expect(editor.canvas.getActiveObject()).toBe(arrow())
    goesUp(arrow())
    click(editor, { x: 560, y: 380 })
    goesUp(arrow())
    // Undo and redo build the arrow again from what was saved.
    editor.undo()
    editor.redo()
    await expect.poll(() => (editor.canvas.getObjects().findLast((o) => o instanceof Connector) as Connector).startDir).toBe('up')
    goesUp(arrow())
    // Saved and opened again.
    const element = document.createElement('canvas')
    document.body.append(element)
    const reopened = new FigureCanvas(element, { width: 600, height: 400 }, editor.serialize())
    await expect.poll(() => reopened.canvas.getObjects().length).toBe(4)
    expect((reopened.canvas.getObjects().findLast((o) => o instanceof Connector) as Connector).startDir).toBe('up')
  })

  /** A U arrow from the top marker of the first box to a free point, left selected; the helpers check its shape. */
  function upArrow() {
    const { editor, first } = twoBoxes()
    const top = first.getCenterPoint().y - 30.5
    drag(editor, { x: first.getCenterPoint().x, y: top - ANCHOR_GAP - 5 }, { x: 300, y: 60 })
    const arrow = lastArrow(editor)
    const holdsRoute = (a: Connector) => {
      const [hw, hh] = [(a.width + a.strokeWidth) / 2, (a.height + a.strokeWidth) / 2]
      for (const p of routePoints({ x: a.x1, y: a.y1 }, { x: a.x2, y: a.y2 }, a.route, a.ownDirs())) {
        expect(Math.abs(p.x)).toBeLessThanOrEqual(hw + 1e-6)
        expect(Math.abs(p.y)).toBeLessThanOrEqual(hh + 1e-6)
      }
    }
    const onLine = () => {
      const line = pathOf(arrow)
      return { x: (line[1]!.x + line[2]!.x) / 2, y: line[1]!.y }
    }
    return { editor, arrow, top, holdsRoute, onLine }
  }

  it.each(['arrow', 'select'] as const)('a press on a placed arrow with a 1 px wobble selects it and changes nothing (%s tool)', (tool) => {
    const { editor, arrow, top, holdsRoute, onLine } = upArrow()
    editor.setTool(tool)
    editor.canvas.discardActiveObject()
    // Selected by a click first, then pressed again on its line with a tiny move, as a real click does.
    click(editor, onLine())
    expect(editor.canvas.getActiveObject()).toBe(arrow)
    const before = editor.serialize()
    const at = onLine()
    fire('mousedown', at, editor.canvas.upperCanvasEl)
    fire('mousemove', { x: at.x + 1, y: at.y }, document)
    fire('mouseup', { x: at.x + 1, y: at.y }, document)
    expect(editor.canvas.getActiveObject()).toBe(arrow)
    expect([arrow.attachStart === undefined, arrow.attachStartSide, arrow.startDir]).toEqual([false, 'top', 'up'])
    expect(pathOf(arrow)[1]!.y).toBeLessThan(top)
    holdsRoute(arrow)
    expect(editor.serialize()).toBe(before)
  })

  it('a real drag of a placed arrow unsticks its start but keeps its shape', () => {
    const { editor, arrow, holdsRoute, onLine } = upArrow()
    editor.setTool('select')
    const at = onLine()
    drag(editor, at, { x: at.x + 60, y: at.y + 90 })
    expect(arrow.attachStart).toBeUndefined()
    expect(arrow.startDir).toBe('up')
    const path = pathOf(arrow)
    expect(path[1]!.y).toBeLessThan(path[0]!.y)
    holdsRoute(arrow)
  })

  it('a click on an object with the arrow tool selects it, draws nothing, and keeps the tool and its anchors on', () => {
    const { editor, first } = twoBoxes()
    let tool = ''
    editor.subscribe((state) => (tool = state.tool))
    click(editor, first.getCenterPoint())
    expect(editor.canvas.getActiveObject()).toBe(first)
    expect(tool).toBe('arrow')
    expect(editor.canvas.getObjects().filter((object) => object instanceof Connector)).toHaveLength(1)
    // Clicking away again: nothing selected, still the arrow tool, and a drag from a marker still draws.
    click(editor, { x: 560, y: 360 })
    expect(editor.canvas.getActiveObject()).toBeUndefined()
    expect(tool).toBe('arrow')
    const c = first.getCenterPoint()
    drag(editor, { x: c.x, y: c.y - 30.5 - ANCHOR_GAP - 5 }, { x: 300, y: 60 })
    expect(editor.canvas.getObjects().filter((object) => object instanceof Connector)).toHaveLength(2)
    expect((editor.canvas.getActiveObject() as Connector).attachStartSide).toBe('top')
  })

  it('a press shows no arrow until the pointer has really moved, so a click never flashes one', () => {
    const { editor } = twoBoxes('straight')
    const shown = () => editor.canvas.getObjects().filter((object) => object instanceof Connector && object.visible).length
    const at = { x: 300, y: 80 }
    fire('mousedown', at, editor.canvas.upperCanvasEl)
    expect(shown()).toBe(1)
    fire('mousemove', { x: at.x + 1, y: at.y + 1 }, document)
    expect(shown()).toBe(1)
    fire('mousemove', { x: at.x + 60, y: at.y + 40 }, document)
    expect(shown()).toBe(2)
    fire('mouseup', { x: at.x + 60, y: at.y + 40 }, document)
    expect(shown()).toBe(2)
  })

  it('the sides are saved and opened again with the arrow', async () => {
    const { editor } = joined()
    const element = document.createElement('canvas')
    document.body.append(element)
    const reopened = new FigureCanvas(element, { width: 600, height: 400 }, editor.serialize())
    await expect.poll(() => reopened.canvas.getObjects().length).toBe(4)
    const copy = reopened.canvas.getObjects().findLast((object) => object instanceof Connector) as Connector
    expect([copy.attachStartSide, copy.attachEndSide]).toEqual(['right', 'left'])
  })
})
