// @vitest-environment jsdom
import '../test/canvas-stub'

import { FabricText, util, type FabricObject } from 'fabric'
import { afterEach, describe, expect, it } from 'vitest'

import { FigureCanvas, idOf } from './FigureCanvas'
import { IconSpace } from './icon-space'
import { panelIdOf } from './panel-block'
import { SequenceBlock, nextLabel, sequenceBox } from './sequence-block'

let figures: FigureCanvas[] = []

afterEach(async () => {
  for (const figure of figures) await figure.dispose()
  figures = []
})

function makeFigure(): FigureCanvas {
  const element = document.createElement('canvas')
  document.body.append(element)
  const figure = new FigureCanvas(element, { width: 1000, height: 800 })
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

const square = (f: FigureCanvas, left: number, top: number, size = 40) => f.addShape({ kind: 'rectangle', left, top, width: size, height: size, fill: '#dbeafe', stroke: '#1f2937', strokeWidth: 1 })
const sequences = (f: FigureCanvas) => f.canvas.getObjects().filter((object): object is SequenceBlock => object instanceof SequenceBlock)
const box = (object: FabricObject) => object.getBoundingRect()
const middle = (object: FabricObject): [number, number] => {
  const point = object.getCenterPoint()
  return [point.x, point.y]
}
/** The steps of a sequence, left to right (or top to bottom). */
const stepsOf = (f: FigureCanvas, sequence: SequenceBlock, axis: 'x' | 'y' = 'x') =>
  f.canvas
    .getObjects()
    .filter((object) => panelIdOf(object) === idOf(sequence))
    .sort((a, b) => (axis === 'x' ? middle(a)[0] - middle(b)[0] : middle(a)[1] - middle(b)[1]))
/** The gaps between neighbouring steps, across. */
const gaps = (steps: FabricObject[]) => steps.slice(1).map((step, i) => box(step).left - (box(steps[i]!).left + box(steps[i]!).width))

/** Three squares lying about, made into a row with Make a row. */
function withRow() {
  const f = makeFigure()
  const [a, b, c] = [square(f, 100, 300), square(f, 300, 200), square(f, 500, 350)]
  f.selectAll()
  expect(f.makeRow()).toBe(3)
  const sequence = sequences(f)[0]!
  return { f, sequence, a, b, c, mouse: pointer(f) }
}

describe('sequence blocks', () => {
  it('Make a row lines the picked objects up with even gaps and arrows, the first staying put; one Undo puts them back', async () => {
    const { f, sequence, a, b, c } = withRow()
    expect(f.canvas.getActiveObject()).toBe(sequence)
    for (const step of [a, b, c]) expect(panelIdOf(step)).toBe(idOf(sequence))
    // The first stays where it was; the others' middles join its line, 48 px apart (the Arrows look's gap).
    expect(box(a)).toMatchObject({ left: 100, top: 300 })
    for (const step of [b, c]) expect(middle(step)[1]).toBeCloseTo(middle(a)[1], 5)
    for (const gap of gaps([a, b, c])) expect(gap).toBeCloseTo(48, 5)
    // An arrow in each gap: the look's parts besides its invisible frame.
    expect(sequence.getObjects()).toHaveLength(1 + 2)
    // A holder sits under what it holds.
    expect(f.canvas.getObjects().indexOf(sequence)).toBeLessThan(f.canvas.getObjects().indexOf(a))

    f.undo()
    await settle()
    expect(sequences(f)).toHaveLength(0)
    const tops = f.canvas.getObjects().map((object) => Math.round(box(object).top))
    expect(tops).toEqual([300, 200, 350])
  })

  it('resizing a step by its corner moves the others while dragging, gaps staying even, nothing stretched, and nothing jumps on letting go', () => {
    const { f, sequence, a, b, c, mouse } = withRow()
    f.canvas.setActiveObject(b)
    const corner = { x: box(b).left + box(b).width, y: box(b).top + box(b).height }
    mouse.press(corner.x - 0.5, corner.y - 0.5)
    mouse.move(corner.x + 10, corner.y + 10)
    mouse.move(corner.x + 30, corner.y + 30)
    // Mid-drag: b has grown, c has already moved along, the gaps are still even, the sequence isn't stretched.
    expect(box(b).width).toBeGreaterThan(60)
    for (const gap of gaps([a, b, c])) expect(gap).toBeCloseTo(48, 0)
    expect(middle(c)[1]).toBeCloseTo(middle(b)[1], 0)
    expect(sequence.scaleX).toBe(1)
    expect(sequence.scaleY).toBe(1)
    const during = [a, b, c].map((step) => ({ ...box(step) }))
    expect(sequenceBox(sequence).width).toBeGreaterThan(box(c).left + box(c).width - box(a).left - 1)

    mouse.release(corner.x + 30, corner.y + 30)
    const after = [a, b, c].map(box)
    after.forEach((each, i) => {
      expect(each.left).toBeCloseTo(during[i]!.left, 0)
      expect(each.top).toBeCloseTo(during[i]!.top, 0)
    })
  })

  it('a step let go on another step trades places with it; let go anywhere else (the gap, off the sequence) it jumps back', () => {
    const { f, sequence, a, b, c, mouse } = withRow()
    const slots = [a, b, c].map(middle)
    // Select the sequence first, then its step (the first click on a step picks the sequence).
    f.canvas.setActiveObject(sequence)
    mouse.drag(middle(a), middle(c))
    expect(stepsOf(f, sequence)).toEqual([c, b, a])
    // Each took the other's slot; b never moved.
    expect(middle(c)[0]).toBeCloseTo(slots[0]![0], 0)
    expect(middle(a)[0]).toBeCloseTo(slots[2]![0], 0)
    expect(middle(b)[0]).toBeCloseTo(slots[1]![0], 5)
    for (const gap of gaps([c, b, a])) expect(gap).toBeCloseTo(48, 0)

    // In the gap between two steps, or off the sequence: back where it was.
    f.canvas.setActiveObject(a)
    const before = middle(a)
    for (const to of [[(middle(b)[0] + before[0]) / 2, before[1]], [before[0], 700]] as [number, number][]) {
      mouse.drag(before, to)
      expect(panelIdOf(a)).toBe(idOf(sequence))
      expect(middle(a)[0]).toBeCloseTo(before[0], 5)
      expect(middle(a)[1]).toBeCloseTo(before[1], 5)
    }
    expect(stepsOf(f, sequence)).toEqual([c, b, a])
  })

  it('moving the sequence carries its steps; deleting a step closes the gap, and the sequence goes with its last step', () => {
    const { f, sequence, a, b, c, mouse } = withRow()
    const before = [a, b, c].map(middle)
    // Grab it by the arrow between a and b.
    const grab: [number, number] = [box(a).left + box(a).width + 24, middle(a)[1]]
    f.canvas.setActiveObject(sequence)
    mouse.drag(grab, [grab[0] + 40, grab[1] + 100])
    const [dx, dy] = [middle(a)[0] - before[0]![0], middle(a)[1] - before[0]![1]]
    expect(dx).toBeCloseTo(40, -1)
    expect(dy).toBeCloseTo(100, -1)
    ;[b, c].forEach((step, i) => {
      expect(middle(step)[0]).toBeCloseTo(before[i + 1]![0] + dx, 5)
      expect(middle(step)[1]).toBeCloseTo(before[i + 1]![1] + dy, 5)
    })

    f.canvas.setActiveObject(b)
    f.deleteSelection()
    expect(gaps([a, c])[0]).toBeCloseTo(48, 5)
    f.canvas.setActiveObject(a)
    f.deleteSelection()
    f.canvas.setActiveObject(c)
    f.deleteSelection()
    expect(sequences(f)).toHaveLength(0)
  })

  it('turning a row from across to down keeps its order and puts the labels beside the steps', () => {
    const { f, sequence, a, b, c } = withRow()
    f.canvas.setActiveObject(sequence)
    f.setSequence({ labels: ['Day 0', 'Day 5', 'Day 7'], look: 'timeline' })
    f.setSequence({ direction: 'down' })
    // In the same order, top to bottom, under the first, which stays put.
    expect(stepsOf(f, sequence, 'y')).toEqual([a, b, c])
    expect(box(a)).toMatchObject({ left: 100, top: 300 })
    for (const step of [b, c]) expect(middle(step)[0]).toBeCloseTo(middle(a)[0], 5)
    // Each label sits to the right of its step, level with it.
    const labels = sequence.getObjects().filter((part): part is FabricText => part instanceof FabricText)
    expect(labels.map((label) => label.text)).toEqual(['Day 0', 'Day 5', 'Day 7'])
    labels.forEach((label, i) => {
      const step = [a, b, c][i]!
      // The label's middle on the page (it sits in the sequence's group).
      const at = util.transformPoint(label.getRelativeCenterPoint(), sequence.calcTransformMatrix())
      expect(at.x).toBeGreaterThan(box(step).left + box(step).width)
      // Level with it, give or take the text's line spacing.
      expect(Math.abs(at.y - middle(step)[1])).toBeLessThan(2)
    })
  })

  it('Add step adds an empty icon space at the end with the next label; Detach leaves plain shapes and the steps loose', () => {
    const { f, sequence, a, b, c } = withRow()
    f.canvas.setActiveObject(sequence)
    f.setSequence({ labels: ['Day 0', 'Day 5', 'Day 10'] })
    f.addStep()
    const steps = stepsOf(f, sequence)
    expect(steps).toHaveLength(4)
    expect(steps.slice(0, 3)).toEqual([a, b, c])
    expect(steps[3]).toBeInstanceOf(IconSpace)
    // The space is laid out by its box; its dashed outline adds half a pixel to what Fabric draws round it.
    expect(Math.abs(gaps(steps)[2]! - 48)).toBeLessThanOrEqual(1)
    expect(sequence.sequence?.labels).toEqual(['Day 0', 'Day 5', 'Day 10', 'Day 15'])

    f.canvas.setActiveObject(sequence)
    expect(f.detachSequence()).toBe(true)
    expect(sequences(f)).toHaveLength(0)
    for (const step of steps) expect(panelIdOf(step)).toBeUndefined()
    // Three arrows and four labels, now ordinary objects, selected with the steps.
    expect(f.canvas.getActiveObjects()).toHaveLength(4 + 3 + 4)
  })

  it('switching style keeps the colour picked, whichever it is, as for panels', () => {
    const { f, sequence } = withRow()
    f.canvas.setActiveObject(sequence)
    // Starts in the panels' blue, so a ribbon made from arrows isn't grey.
    f.setSequence({ look: 'ribbon' })
    expect(sequence.sequence?.colour).toBe('#0072b2')
    for (const colour of ['#d9a400', '#0072b2']) {
      f.setSequence({ colour })
      for (const look of ['arrows', 'timeline', 'cards', 'ribbon'] as const) {
        f.setSequence({ look })
        expect(sequence.sequence?.colour).toBe(colour)
      }
    }
  })

  it('removing a step takes its label along and closes the row up; the last step stays', () => {
    const { f, sequence, a, b, c } = withRow()
    f.canvas.setActiveObject(sequence)
    f.setSequence({ labels: ['Day 0', 'Day 5', 'Day 7'] })
    expect(f.removeStep(1)).toBe(true)
    expect(f.canvas.getObjects()).not.toContain(b)
    expect(stepsOf(f, sequence)).toEqual([a, c])
    expect(gaps([a, c])[0]).toBeCloseTo(48, 5)
    expect(sequence.sequence?.labels).toEqual(['Day 0', 'Day 7'])
    expect(f.canvas.getActiveObject()).toBe(sequence)
    // Deleting a selected step does the same with its label.
    f.canvas.setActiveObject(a)
    f.deleteSelection()
    expect(sequence.sequence?.labels).toEqual(['Day 7'])
    f.canvas.setActiveObject(sequence)
    expect(f.removeStep(0)).toBe(false)
    expect(stepsOf(f, sequence)).toEqual([c])
  })

  it('the next label follows the labels\' own count', () => {
    expect(nextLabel(['Day 0', 'Day 5'], 2)).toBe('Day 10')
    expect(nextLabel(['Step 1', 'Step 2', 'Step 3'], 3)).toBe('Step 4')
    expect(nextLabel(['t = 0', 't = 1'], 2)).toBe('t = 2')
    expect(nextLabel(['Control', 'Treated'], 2)).toBe('')
    expect(nextLabel(['A', 'B', 'Kept'], 2)).toBe('Kept')
  })
})
