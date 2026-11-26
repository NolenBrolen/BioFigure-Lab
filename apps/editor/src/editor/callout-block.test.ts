// @vitest-environment jsdom
import '../test/canvas-stub'

import { Path, Point, util, type FabricObject } from 'fabric'
import { afterEach, describe, expect, it } from 'vitest'

import { labelledIcon, zoomInset } from './blocks'
import { CalloutInset, CalloutLabels, CalloutMarker, insetCircle, insetLines, insetSizeOf, markerSizeOf, isCalloutLabel, labelParts, labelsBox, markerCircle, partPoint, type CalloutLabel } from './callout-block'
import { FigureCanvas, idOf } from './FigureCanvas'
import { IconSpace, spaceBox } from './icon-space'
import { panelIdOf } from './panel-block'

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
/** Long enough after a click that the next press isn't a double click. */
const apart = () => new Promise((resolve) => setTimeout(resolve, 550))
/** The test canvas measures text a few pixels wide, so a selected label's resize handles would cover it: they go, so a press drags it. */
const grabbable = (label: FabricObject) => label.set({ hasControls: false })

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
  }
}

const one = <T extends FabricObject>(f: FigureCanvas, type: abstract new (...args: never[]) => T): T => {
  const found = f.canvas.getObjects().filter((object): object is T => object instanceof type)
  expect(found).toHaveLength(1)
  return found[0]!
}

/** A zoom inset in a look, placed from the Blocks tool in the middle of the page. */
function withInset(look: 'lens' | 'frame' | 'pin' = 'lens') {
  const f = makeFigure()
  // Something on the page first, so the block gets its usual size (an empty page lets some blocks fill it).
  f.addShape({ kind: 'rectangle', left: 20, top: 20, width: 40, height: 40, fill: '#dbeafe', stroke: '#1f2937', strokeWidth: 1 })
  f.addBlock(zoomInset(look))
  return { f, inset: one(f, CalloutInset), marker: one(f, CalloutMarker), space: one(f, IconSpace), mouse: pointer(f) }
}

/** A labelled icon in a look, placed from the Blocks tool. */
function withLabels(look: 'plain' | 'chips' | 'numbers' = 'plain') {
  const f = makeFigure()
  f.addShape({ kind: 'rectangle', left: 20, top: 20, width: 40, height: 40, fill: '#dbeafe', stroke: '#1f2937', strokeWidth: 1 })
  f.addBlock(labelledIcon(look))
  const block = one(f, CalloutLabels)
  const { subject, labels } = labelParts(block, f.canvas.getObjects())
  return { f, block, subject: subject!, labels, mouse: pointer(f) }
}

const centreOf = (object: FabricObject): [number, number] => {
  const point = object.getCenterPoint()
  return [point.x, point.y]
}

/** A part of a block, where it is on the page (its corners through its own and the block's transform). */
function pageBox(part: FabricObject) {
  const matrix = part.calcTransformMatrix()
  const corners = [new Point(-part.width / 2, -part.height / 2), new Point(part.width / 2, part.height / 2)].map((corner) => util.transformPoint(corner, matrix))
  return { left: Math.min(...corners.map((c) => c.x)), right: Math.max(...corners.map((c) => c.x)), top: Math.min(...corners.map((c) => c.y)), bottom: Math.max(...corners.map((c) => c.y)) }
}

describe('zoom inset', () => {
  it('is placed as one undo step: the inset selected, its marker and an empty icon space pointing at it; the first click on the space picks the inset, the marker is picked directly', async () => {
    const { f, inset, marker, space, mouse } = withInset()
    expect(f.canvas.getActiveObject()).toBe(inset)
    expect(panelIdOf(marker)).toBe(idOf(inset))
    expect(panelIdOf(space)).toBe(idOf(inset))
    // It starts at 3× zoom (owner's pick, 2026-11-26).
    expect(insetSizeOf(inset) / markerSizeOf(marker)).toBeCloseTo(3, 5)
    // The space sits in the middle of the inset.
    const room = spaceBox(space)
    expect(room.x + room.width / 2).toBeCloseTo(insetCircle(inset).centre.x, 0)

    f.canvas.discardActiveObject()
    mouse.click(...centreOf(space))
    expect(f.canvas.getActiveObject()).toBe(inset)
    mouse.click(...centreOf(marker))
    expect(f.canvas.getActiveObject()).toBe(marker)

    f.undo()
    await settle()
    expect(f.canvas.getObjects().some((object) => object instanceof CalloutInset || object instanceof CalloutMarker || object instanceof IconSpace)).toBe(false)
  })

  it('dragging the inset leaves the marker on its spot; mid-drag the lines already reach the inset where it is, and the icon space has come along', () => {
    const { inset, marker, space, mouse } = withInset('lens')
    const spot = centreOf(marker)
    const start = insetCircle(inset).centre
    // Press on the inset's ring, away from its icon space.
    const grab: [number, number] = [start.x, start.y - insetCircle(inset).radius + 4]
    mouse.press(...grab)
    mouse.move(grab[0] + 40, grab[1] + 10)
    mouse.move(grab[0] + 80, grab[1] + 20)
    const now = insetCircle(inset).centre
    // Free-form: moved exactly with the pointer, never pulled to a guide line (owner's feedback, 2026-11-26).
    expect(now.x - start.x).toBeCloseTo(80, 5)
    expect(now.y - start.y).toBeCloseTo(20, 5)
    expect(centreOf(marker)).toEqual(spot)
    // Each line touches the inset's circle where it is now, and the marker's.
    for (const [from, to] of insetLines(inset, marker)) {
      expect(Math.hypot(to.x - now.x, to.y - now.y)).toBeCloseTo(insetCircle(inset).radius, 3)
      expect(Math.hypot(from.x - spot[0], from.y - spot[1])).toBeCloseTo(markerCircle(marker).radius, 3)
    }
    expect(centreOf(space)[0]).toBeCloseTo(now.x, 3)
    mouse.release(grab[0] + 80, grab[1] + 20)
    expect(centreOf(marker)).toEqual(spot)
  })

  it('a press in the area between marker and inset picks the inset, and dragging from there moves the whole callout, mid-drag', () => {
    const { f, inset, marker, space, mouse } = withInset('lens')
    f.canvas.discardActiveObject()
    const i = insetCircle(inset).centre
    const m = markerCircle(marker).centre
    // Halfway between the two circles' edges, on the line joining their middles: empty page inside the lines.
    const between: [number, number] = [(i.x + m.x) / 2, (i.y + m.y) / 2]
    expect(f.canvas.objectAt({ x: between[0], y: between[1] })).toBe(inset)
    const spot = centreOf(marker)
    mouse.press(...between)
    mouse.move(between[0] + 30, between[1] - 10)
    mouse.move(between[0] + 60, between[1] - 20)
    expect(f.canvas.getActiveObject()).toBe(inset)
    // Moved (snapping may pull a few pixels), the marker by as much as the inset.
    const moved = { x: insetCircle(inset).centre.x - i.x, y: insetCircle(inset).centre.y - i.y }
    expect(moved.x).toBeGreaterThan(45)
    expect(centreOf(marker)[0] - spot[0]).toBeCloseTo(moved.x, 3)
    expect(centreOf(marker)[1] - spot[1]).toBeCloseTo(moved.y, 3)
    expect(centreOf(space)[0]).toBeCloseTo(insetCircle(inset).centre.x, 3)
    mouse.release(between[0] + 60, between[1] - 20)
    expect(centreOf(marker)[0] - spot[0]).toBeCloseTo(insetCircle(inset).centre.x - i.x, 3)
    // Outside the lines, the page stays the page.
    expect(f.canvas.objectAt({ x: between[0] + 60, y: between[1] + 200 })).not.toBe(inset)
  })

  it('the inset and marker move freely: let go 2 px off the page’s middle, they stay 2 px off (no snapping)', () => {
    const { inset, marker, mouse } = withInset('lens')
    for (const object of [inset, marker]) {
      const box = object.getBoundingRect()
      // Grab the inset by its ring (not its icon space), the marker anywhere.
      const grab: [number, number] = object === inset ? [box.left + box.width / 2, box.top + 3] : centreOf(object)
      const middle = box.left + box.width / 2
      const to = grab[0] + (500 + 2 - middle)
      mouse.press(...grab)
      mouse.move((grab[0] + to) / 2, grab[1])
      mouse.move(to, grab[1])
      mouse.release(to, grab[1])
      const after = object.getBoundingRect()
      expect(after.left + after.width / 2).toBeCloseTo(502, 3)
    }
  })

  it('dragging the marker moves only the marker, and the lines follow it mid-drag; it never lands in a panel or jumps back', () => {
    const { f, inset, marker, mouse } = withInset('pin')
    const insetAt = insetCircle(inset).centre
    const from = centreOf(marker)
    mouse.press(...from)
    mouse.move(from[0] - 30, from[1] + 20)
    mouse.move(from[0] - 60, from[1] + 40)
    const [line] = insetLines(inset, marker)
    expect(line![0].x).toBeCloseTo(from[0] - 60, 5)
    expect(line![0].y).toBeCloseTo(from[1] + 40, 5)
    expect(insetCircle(inset).centre).toEqual(insetAt)
    mouse.release(from[0] - 60, from[1] + 40)
    expect(centreOf(marker)[0]).toBeCloseTo(from[0] - 60, -1)
    expect(panelIdOf(marker)).toBe(idOf(inset))
    expect(f.canvas.getObjects()).toContain(marker)
  })

  it('resizing the inset by its corner grows it without stretching, mid-drag: the frame stays round, the icon space grows to fit', () => {
    const { inset, space, mouse } = withInset('lens')
    const size = insetSizeOf(inset)
    const rect = inset.getBoundingRect()
    const corner = { x: rect.left + rect.width, y: rect.top + rect.height }
    mouse.press(corner.x - 0.5, corner.y - 0.5)
    mouse.move(corner.x + 20, corner.y + 20)
    mouse.move(corner.x + 40, corner.y + 40)
    expect(insetSizeOf(inset)).toBeGreaterThan(size + 20)
    expect(inset.scaleX).toBe(1)
    expect(inset.scaleY).toBe(1)
    for (const part of inset.getObjects()) expect([part.scaleX, part.scaleY]).toEqual([1, 1])
    expect(spaceBox(space).width).toBeGreaterThan(size * 0.72 * 2 * 0.5 + 10)
    expect(space.scaleX).toBe(1)
    mouse.release(corner.x + 40, corner.y + 40)
    expect(inset.scaleX).toBe(1)
  })

  it('shows a magnified copy instead of an icon (the space goes, and comes back); a copy exports as vector inside the inset; deleting the marker deletes the whole callout', () => {
    const { f, inset, marker } = withInset('frame')
    f.addShape({ kind: 'rectangle', left: centreOf(marker)[0] - 5, top: centreOf(marker)[1] - 5, width: 10, height: 10, fill: '#cc79a7', stroke: '#1f2937', strokeWidth: 1 })
    f.canvas.setActiveObject(inset)
    f.setInset({ shows: 'copy' })
    expect(f.canvas.getObjects().some((object) => object instanceof IconSpace)).toBe(false)
    const svg = f.toSVG()
    expect(svg).toContain('clipPath')
    // The pink square, drawn again inside the inset's clip, magnified.
    expect(svg.match(/#cc79a7|rgb\(204,121,167\)/g)?.length).toBeGreaterThanOrEqual(2)

    f.setInset({ shows: 'icon' })
    expect(panelIdOf(one(f, IconSpace))).toBe(idOf(inset))

    f.canvas.setActiveObject(marker)
    f.deleteSelection()
    expect(f.canvas.getObjects().some((object) => object instanceof CalloutInset || object instanceof CalloutMarker || object instanceof IconSpace)).toBe(false)
  })
})

describe('zoom inset details (owner’s feedback, 2026-11-26)', () => {
  const TALL = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 20"><rect width="10" height="20" fill="#d55e00"/><circle cx="5" cy="5" r="3" fill="#ffffff"/></svg>'
  const WIDE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 10"><rect width="30" height="10" fill="#009e73"/><circle cx="5" cy="5" r="3" fill="#ffffff"/></svg>'

  it('the icon space is round in the Lens and Pin, a rounded square in the Frame; the Frame’s zoom tag sits on its edge, clear of the space', () => {
    const { f, inset, space } = withInset('lens')
    expect(space.spaceRound).toBe(true)
    f.canvas.setActiveObject(inset)
    f.setInset({ look: 'frame' })
    const square = one(f, IconSpace)
    expect(square.spaceRound).toBeFalsy()
    const tag = inset.getObjects().find((part, i) => i > 0 && !(part instanceof Path) && part.type === 'rect')!
    const tagBox = pageBox(tag)
    const room = spaceBox(square)
    const { centre, radius } = insetCircle(inset)
    expect((tagBox.top + tagBox.bottom) / 2).toBeCloseTo(centre.y + radius, 0)
    expect(tagBox.top).toBeGreaterThan(room.y + room.height)
    f.setInset({ look: 'pin' })
    expect(one(f, IconSpace).spaceRound).toBe(true)
  })

  it('an icon in the inset can be replaced by another: it takes the same box, block and place, and stays selected; one undo step', async () => {
    const { f, inset, space } = withInset('lens')
    f.canvas.setActiveObject(space)
    let held: boolean | undefined
    f.subscribe((next) => (held = next.selection?.heldIcon))
    const first = await f.addSvg(TALL, 'Tall')
    expect(panelIdOf(first)).toBe(idOf(inset))
    expect(held).toBe(true)
    const box = first.getBoundingRect()
    expect(await f.replaceHeldIcon(WIDE, 'Wide')).toBe(true)
    const next = f.canvas.getActiveObject()!
    expect(next).not.toBe(first)
    expect((next as FabricObject & { name?: string }).name).toBe('Wide')
    expect(panelIdOf(next)).toBe(idOf(inset))
    expect(f.canvas.getObjects()).not.toContain(first)
    expect(centreOf(next)[0]).toBeCloseTo(box.left + box.width / 2, 0)
    expect(centreOf(next)[1]).toBeCloseTo(box.top + box.height / 2, 0)
    f.undo()
    await settle()
    expect(f.canvas.getObjects().filter((object) => panelIdOf(object) === idOf(inset)).map((object) => (object as FabricObject & { name?: string }).name)).toContain('Tall')
  })
})

describe('labelled icon', () => {
  it('is placed with an empty icon space and three labels pointing at it; the first click on a label picks the block, the next the label', () => {
    const { f, block, subject, labels, mouse } = withLabels()
    expect(f.canvas.getActiveObject()).toBe(block)
    expect(subject).toBeInstanceOf(IconSpace)
    expect(labels).toHaveLength(3)
    for (const label of labels) expect(panelIdOf(label)).toBe(idOf(block))
    f.canvas.discardActiveObject()
    mouse.click(...centreOf(labels[0]!))
    expect(f.canvas.getActiveObject()).toBe(block)
    mouse.click(...centreOf(labels[0]!))
    expect(f.canvas.getActiveObject()).toBe(labels[0])
  })

  it('dragging a label takes its line along mid-drag and leaves the label where it was let go (it never jumps back)', async () => {
    const { f, block, labels, mouse } = withLabels('plain')
    const label = labels[0]!
    // With the block selected, a click on a label picks it; then it drags on its own.
    f.canvas.setActiveObject(block)
    const from = centreOf(label)
    mouse.click(...from)
    expect(f.canvas.getActiveObject()).toBe(label)
    // Pressed again within half a second, a text counts it as a double click.
    await apart()
    grabbable(label)
    mouse.press(...from)
    mouse.move(from[0] + 30, from[1] + 50)
    mouse.move(from[0] + 60, from[1] + 100)
    // A line of the look now ends just left of the label, where it is mid-drag.
    const left = label.getBoundingRect().left
    const middle = label.getBoundingRect().top + label.getBoundingRect().height / 2
    const lines = block.getObjects().filter((part) => part instanceof Path).map(pageBox)
    expect(lines.some((line) => Math.abs(line.right - (left - 4)) < 1.5 && Math.abs(line.bottom - middle) < 1.5)).toBe(true)
    expect(block.scaleX).toBe(1)
    mouse.release(from[0] + 60, from[1] + 100)
    expect(centreOf(label)[0]).toBeCloseTo(from[0] + 60, -1)
    expect(centreOf(label)[1]).toBeCloseTo(from[1] + 100, -1)
    expect(panelIdOf(label)).toBe(idOf(block))
    expect(labelsBox(block).y + labelsBox(block).height).toBeGreaterThanOrEqual(label.getBoundingRect().top + label.getBoundingRect().height - 0.5)
  })

  it('with the block selected, a drag starting on a label or the icon moves the whole block (mid-drag); its look sits above the icon so dots on it show', () => {
    const { f, block, subject, labels, mouse } = withLabels('plain')
    const objects = () => f.canvas.getObjects()
    expect(objects().indexOf(block)).toBeGreaterThan(objects().indexOf(subject))
    for (const label of labels) expect(objects().indexOf(label)).toBeGreaterThan(objects().indexOf(block))
    f.canvas.setActiveObject(block)
    const before = [subject, ...labels].map(centreOf)
    const from = centreOf(labels[2]!)
    mouse.press(...from)
    mouse.move(from[0] + 20, from[1] + 15)
    mouse.move(from[0] + 40, from[1] + 30)
    expect(f.canvas.getActiveObject()).toBe(block)
    // Everything moved together (snapping may pull a few pixels): each by as much as the icon.
    const moved = { x: centreOf(subject)[0] - before[0]![0], y: centreOf(subject)[1] - before[0]![1] }
    expect(moved.x).toBeGreaterThan(30)
    ;[subject, ...labels].forEach((part, i) => {
      expect(centreOf(part)[0] - before[i]![0]).toBeCloseTo(moved.x, 3)
      expect(centreOf(part)[1] - before[i]![1]).toBeCloseTo(moved.y, 3)
    })
    mouse.release(from[0] + 40, from[1] + 30)
    expect(f.canvas.getActiveObject()).toBe(block)
    // A press on the icon drags the whole block too.
    const icon = centreOf(subject)
    const label = centreOf(labels[0]!)
    mouse.press(...icon)
    mouse.move(icon[0] - 30, icon[1])
    expect(centreOf(labels[0]!)[0] - label[0]).toBeCloseTo(centreOf(subject)[0] - icon[0], 3)
    expect(centreOf(subject)[0] - icon[0]).toBeLessThan(-20)
    mouse.release(icon[0] - 30, icon[1])
  })

  it('the dot on a label’s spot drags the spot about the icon (kept inside it), mid-drag', () => {
    const { f, block, subject, labels, mouse } = withLabels('chips')
    f.canvas.setActiveObject(block)
    const label = labels[0] as CalloutLabel
    const box = spaceBox(subject as IconSpace)
    const spot = partPoint(label, box)
    mouse.press(spot.x, spot.y)
    mouse.move(spot.x - 20, spot.y + 20)
    mouse.move(box.x + 10, box.y + box.height - 10)
    expect(partPoint(label, box).x).toBeCloseTo(box.x + 10, 0)
    expect(partPoint(label, box).y).toBeCloseTo(box.y + box.height - 10, 0)
    mouse.move(box.x - 200, box.y + box.height + 200)
    expect(label.calloutPart).toEqual({ x: 0, y: 1 })
    mouse.release(box.x - 200, box.y + box.height + 200)
    expect(label.calloutPart).toEqual({ x: 0, y: 1 })
  })

  it('Add label adds one with its own line; a label can be removed (the block keeps its last one); Detach leaves plain shapes and loose text', async () => {
    const { f, block, labels } = withLabels('plain')
    f.addCalloutLabel()
    const added = labelParts(block, f.canvas.getObjects()).labels
    expect(added).toHaveLength(4)
    expect(added.at(-1)?.text).toBe('Label 4')
    expect(block.getObjects().filter((part) => part instanceof Path)).toHaveLength(4)
    expect(f.removeCalloutLabel(0)).toBe(true)
    expect(f.removeCalloutLabel(0)).toBe(true)
    expect(f.removeCalloutLabel(0)).toBe(true)
    expect(f.removeCalloutLabel(0)).toBe(false)
    expect(labelParts(block, f.canvas.getObjects()).labels).toHaveLength(1)

    expect(await f.detachCallout()).toBe(true)
    expect(f.canvas.getObjects().some((object) => object instanceof CalloutLabels)).toBe(false)
    const left = f.canvas.getObjects().filter((object) => labels.includes(object as CalloutLabel) || added.includes(object as CalloutLabel))
    expect(left).toHaveLength(1)
    expect(isCalloutLabel(left[0])).toBe(false)
    expect(panelIdOf(left[0]!)).toBeUndefined()
  })

  it('in the numbers look the labels sit in a key, one row each; dragging one row moves the whole key', async () => {
    const { f, block, labels, mouse } = withLabels('numbers')
    const lefts = labels.map((label) => Math.round(label.getBoundingRect().left))
    expect(new Set(lefts).size).toBe(1)
    const tops = labels.map((label) => label.getBoundingRect().top)
    expect(tops[1]! - tops[0]!).toBeCloseTo(tops[2]! - tops[1]!, 3)

    f.canvas.setActiveObject(block)
    const from = centreOf(labels[1]!)
    mouse.click(...from)
    expect(f.canvas.getActiveObject()).toBe(labels[1])
    await apart()
    grabbable(labels[1]!)
    mouse.press(...from)
    mouse.move(from[0] + 20, from[1] + 30)
    mouse.move(from[0] + 40, from[1] + 60)
    // Mid-drag, the other rows have moved with it.
    expect(labels[1]!.getBoundingRect().left).toBeCloseTo(lefts[1]! + 40, -1)
    expect(labels[0]!.getBoundingRect().left).toBeCloseTo(labels[1]!.getBoundingRect().left, 0)
    expect(labels[2]!.getBoundingRect().top - labels[1]!.getBoundingRect().top).toBeCloseTo(tops[2]! - tops[1]!, 0)
    mouse.release(from[0] + 40, from[1] + 60)
    expect(labels[0]!.getBoundingRect().left).toBeCloseTo(lefts[0]! + 40, -1)
  })
})
