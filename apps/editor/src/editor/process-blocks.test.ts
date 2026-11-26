// @vitest-environment jsdom
import '../test/canvas-stub'

import { type FabricObject } from 'fabric'
import { afterEach, describe, expect, it } from 'vitest'

import { processOfSpaces } from './blocks'
import { FigureCanvas, idOf } from './FigureCanvas'
import { IconSpace, spaceBox } from './icon-space'
import { panelIdOf } from './panel-block'
import { processOrder } from './process-looks'
import { SequenceBlock, sequenceBox, sequenceSettingsOf } from './sequence-block'

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
  }
}

/** An object's box as the layout sees it: an icon space's without its dashed outline. */
const box = (object: FabricObject) => {
  if (!(object instanceof IconSpace)) return object.getBoundingRect()
  const { x, y, width, height } = spaceBox(object)
  return { left: x, top: y, width, height }
}
const middle = (object: FabricObject) => object.getCenterPoint()
const blocks = (f: FigureCanvas) => f.canvas.getObjects().filter((object): object is SequenceBlock => object instanceof SequenceBlock)
/** The block's steps in their order (first step first). */
const stepsOf = (f: FigureCanvas, block: SequenceBlock) =>
  processOrder(
    sequenceSettingsOf(block).look,
    f.canvas
      .getObjects()
      .filter((object) => panelIdOf(object) === idOf(block))
      .map((step) => {
        const rect = box(step)
        return { step, box: { x: rect.left, y: rect.top, width: rect.width, height: rect.height } }
      }),
  ).map((each) => each.step)

function place(look: Parameters<typeof processOfSpaces>[0]) {
  const f = makeFigure()
  f.addBlock(processOfSpaces(look))
  const block = blocks(f)[0]!
  return { f, block, mouse: pointer(f) }
}

/** The steps' middles round their centre: distances and angles (clockwise from the top, degrees). */
function round(steps: FabricObject[]) {
  const points = steps.map(middle)
  const cx = points.reduce((sum, p) => sum + p.x, 0) / points.length
  const cy = points.reduce((sum, p) => sum + p.y, 0) / points.length
  return points.map((p) => ({ r: Math.hypot(p.x - cx, p.y - cy), angle: (((Math.atan2(p.y - cy, p.x - cx) * 180) / Math.PI + 90) % 360 + 360) % 360 }))
}

describe('cycle blocks', () => {
  it('Add step puts an empty space last with the next label, and all the steps spread out evenly round the circle again', () => {
    const { f, block } = place('ring')
    expect(f.canvas.getActiveObject()).toBe(block)
    f.addStep()
    const steps = stepsOf(f, block)
    expect(steps).toHaveLength(5)
    expect(steps.at(-1)).toBeInstanceOf(IconSpace)
    expect(sequenceSettingsOf(block).labels.at(4)).toBe('Step 5')
    const spots = round(steps)
    for (const spot of spots) expect(spot.r).toBeCloseTo(spots[0]!.r, 3)
    // The first stays at the top; the others follow clockwise every 72°.
    spots.forEach((spot, i) => expect(spot.angle).toBeCloseTo((i * 72) % 360, 3))
    expect(f.canvas.getActiveObject()).toBe(block)
  })

  it('removing a step closes the circle up evenly; a cycle keeps two steps', () => {
    const { f, block } = place('ring')
    expect(f.removeStep(1)).toBe(true)
    const spots = round(stepsOf(f, block))
    spots.forEach((spot, i) => expect(spot.angle).toBeCloseTo(i * 120, 3))
    expect(f.removeStep(0)).toBe(true)
    expect(f.removeStep(0)).toBe(false)
    expect(stepsOf(f, block)).toHaveLength(2)
  })

  it('resizing a step by its corner spaces the circle again while dragging, nothing stretched, and nothing jumps on letting go', () => {
    const { f, block, mouse } = place('segments')
    const [top] = stepsOf(f, block)
    f.canvas.setActiveObject(top!)
    const corner = { x: box(top!).left + box(top!).width, y: box(top!).top + box(top!).height }
    const before = round(stepsOf(f, block))[0]!.r
    mouse.press(corner.x - 0.5, corner.y - 0.5)
    mouse.move(corner.x + 15, corner.y + 15)
    mouse.move(corner.x + 40, corner.y + 40)
    // Mid-drag: the step has grown, the circle is wider and still even, and nothing is stretched.
    expect(box(top!).width).toBeGreaterThan(90)
    const spots = round(stepsOf(f, block))
    for (const spot of spots) expect(spot.r).toBeGreaterThan(before + 5)
    spots.forEach((spot, i) => expect(spot.angle).toBeCloseTo(i * 90, 0))
    expect([block.scaleX, block.scaleY, top!.scaleX, top!.scaleY]).toEqual([1, 1, 1, 1])
    for (const part of block.getObjects()) expect([part.scaleX, part.scaleY]).toEqual([1, 1])
    const during = stepsOf(f, block).map((step) => ({ ...box(step) }))
    mouse.release(corner.x + 40, corner.y + 40)
    stepsOf(f, block).forEach((step, i) => {
      expect(box(step).left).toBeCloseTo(during[i]!.left, 0)
      expect(box(step).top).toBeCloseTo(during[i]!.top, 0)
    })
  })

  it('the first click on a step picks the cycle; dragging the cycle by its middle carries its steps', () => {
    const { f, block, mouse } = place('loop')
    f.canvas.discardActiveObject()
    const steps = stepsOf(f, block)
    const at = middle(steps[0]!)
    mouse.press(at.x, at.y)
    mouse.release(at.x, at.y)
    expect(f.canvas.getActiveObject()).toBe(block)
    const before = steps.map(middle)
    const grab = middle(block)
    mouse.press(grab.x, grab.y)
    mouse.move(grab.x + 20, grab.y + 10)
    mouse.move(grab.x + 60, grab.y + 30)
    // Mid-drag the steps already go along.
    const dx = middle(steps[0]!).x - before[0]!.x
    const dy = middle(steps[0]!).y - before[0]!.y
    expect(dx).toBeGreaterThan(40)
    expect(dy).toBeGreaterThan(15)
    steps.forEach((step, i) => {
      expect(middle(step).x).toBeCloseTo(before[i]!.x + dx, 3)
      expect(middle(step).y).toBeCloseTo(before[i]!.y + dy, 3)
    })
    mouse.release(grab.x + 60, grab.y + 30)
  })

  it('switching style keeps the colour picked and the middle text', () => {
    const { f, block } = place('ring')
    f.setSequence({ colour: '#cc79a7', title: 'Cell cycle' })
    f.setSequence({ look: 'segments' })
    expect(sequenceSettingsOf(block)).toMatchObject({ look: 'segments', colour: '#cc79a7', title: 'Cell cycle' })
    f.setSequence({ look: 'loop' })
    expect(sequenceSettingsOf(block)).toMatchObject({ look: 'loop', colour: '#cc79a7', title: 'Cell cycle' })
  })
})

describe('switching style', () => {
  it.each([
    ['ring', 'loop'],
    ['loop', 'segments'],
    ['tree', 'fan'],
    ['fan', 'rows'],
  ] as const)('%s to %s fills the box the old style had, round the same middle', (from, to) => {
    const { f, block } = place(from)
    const before = sequenceBox(block)
    f.setSequence({ look: to })
    const now = sequenceBox(block)
    expect(now.width).toBeLessThanOrEqual(before.width + 1)
    expect(now.height).toBeLessThanOrEqual(before.height + 1)
    // It fills the box one way or the other (within a pixel or two of the gap's rounding).
    expect(Math.max(now.width / before.width, now.height / before.height)).toBeGreaterThan(0.96)
    expect(now.x + now.width / 2).toBeCloseTo(before.x + before.width / 2, 0)
    expect(now.y + now.height / 2).toBeCloseTo(before.y + before.height / 2, 0)
  })
})

it('switching styles back and forth comes back to the same size, not a little smaller each time', () => {
  const { f, block } = place('segments')
  const before = sequenceBox(block)
  for (const look of ['ring', 'loop', 'segments', 'ring', 'segments'] as const) f.setSequence({ look })
  const now = sequenceBox(block)
  expect(now.width).toBeCloseTo(before.width, -1)
  expect(now.height).toBeCloseTo(before.height, -1)
})

describe('branching blocks', () => {
  it('a tree has its start on the left and the arms stacked down its right, evenly gapped, the middle arm level with the start', () => {
    const { f, block } = place('tree')
    const [start, ...arms] = stepsOf(f, block)
    expect(arms).toHaveLength(3)
    for (const arm of arms) expect(box(arm).left).toBeGreaterThan(box(start!).left + box(start!).width + 40)
    arms.slice(1).forEach((arm, i) => expect(box(arm).top - (box(arms[i]!).top + box(arms[i]!).height)).toBeCloseTo(24, 3))
    expect(middle(arms[1]!).y).toBeCloseTo(middle(start!).y, 3)
    expect(sequenceSettingsOf(block).labels).toEqual(['Start', 'Group 1', 'Group 2', 'Group 3'])
  })

  it('Add arm adds arms up to five, then the "+" goes; removing stops at two arms', () => {
    const { f, block } = place('tree')
    expect(block.controls.addStep).toBeDefined()
    f.addStep()
    f.addStep()
    expect(stepsOf(f, block)).toHaveLength(6)
    expect(sequenceSettingsOf(block).labels.slice(4)).toEqual(['Group 4', 'Group 5'])
    expect(block.controls.addStep).toBeUndefined()
    f.addStep()
    expect(stepsOf(f, block)).toHaveLength(6)
    // The new arms went to the bottom; the start is still first.
    const [start, ...arms] = stepsOf(f, block)
    expect(box(start!).left).toBeLessThan(box(arms[0]!).left)
    for (const step of [1, 1, 1]) f.removeStep(step)
    expect(f.removeStep(1)).toBe(false)
    expect(stepsOf(f, block)).toHaveLength(3)
    expect(block.controls.addStep).toBeDefined()
  })

  it('in a fan, resizing an arm moves the arms beside it while dragging, the gaps staying even and nothing stretched', () => {
    const { f, block, mouse } = place('fan')
    const [start, a, b, c] = stepsOf(f, block)
    // Under the start, side by side, the start centred over them.
    for (const arm of [a, b, c]) expect(box(arm!).top).toBeGreaterThan(box(start!).top + box(start!).height)
    expect(middle(start!).x).toBeCloseTo(middle(b!).x, 3)
    f.canvas.setActiveObject(a!)
    const corner = { x: box(a!).left + box(a!).width, y: box(a!).top + box(a!).height }
    mouse.press(corner.x - 0.5, corner.y - 0.5)
    mouse.move(corner.x + 10, corner.y + 10)
    mouse.move(corner.x + 30, corner.y + 30)
    expect(box(a!).width).toBeGreaterThan(80)
    const arms = [a!, b!, c!]
    arms.slice(1).forEach((arm, i) => expect(box(arm).left - (box(arms[i]!).left + box(arms[i]!).width)).toBeCloseTo(40, 0))
    expect([block.scaleX, a!.scaleX, a!.scaleY]).toEqual([1, 1, 1])
    for (const part of block.getObjects()) expect([part.scaleX, part.scaleY]).toEqual([1, 1])
    mouse.release(corner.x + 30, corner.y + 30)
  })

  it('arm rows Detach leaves the rows and chips as plain shapes and the steps loose, all selected', () => {
    const { f, block } = place('rows')
    const steps = stepsOf(f, block)
    const before = steps.map((step) => ({ ...box(step) }))
    expect(f.detachSequence()).toBe(true)
    expect(blocks(f)).toHaveLength(0)
    for (const step of steps) expect(panelIdOf(step)).toBeUndefined()
    steps.forEach((step, i) => expect(box(step)).toMatchObject({ left: before[i]!.left, top: before[i]!.top }))
    expect(f.canvas.getActiveObjects().length).toBeGreaterThan(steps.length + 3)
    for (const step of steps) expect(f.canvas.getActiveObjects()).toContain(step)
  })
})
