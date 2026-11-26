// @vitest-environment jsdom
import '../test/canvas-stub'

import { type FabricObject } from 'fabric'
import { afterEach, describe, expect, it } from 'vitest'

import { comparisonOfSpaces } from './blocks'
import { ComparisonBlock, ComparisonSide, comparisonSettingsOf } from './comparison-block'
import { FigureCanvas, idOf } from './FigureCanvas'
import { IconSpace } from './icon-space'
import { PanelBlock, bodyOf, panelIdOf, settingsOf } from './panel-block'

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

const settle = () => new Promise((resolve) => setTimeout(resolve))

const middle = (object: FabricObject): [number, number] => {
  const point = object.getCenterPoint()
  return [point.x, point.y]
}

/** A figure with a comparison of `kind` placed from the Blocks tool, and its sides left to right with what each holds. */
function withComparison(kind: 'versus' | 'change' = 'versus') {
  const f = makeFigure()
  f.addBlock(comparisonOfSpaces(kind))
  const objects = () => f.canvas.getObjects()
  const comparison = objects().find((object): object is ComparisonBlock => object instanceof ComparisonBlock)!
  const sides = () =>
    objects()
      .filter((object): object is ComparisonSide => object instanceof ComparisonSide && panelIdOf(object) === idOf(comparison))
      .sort((a, b) => bodyOf(a).x - bodyOf(b).x)
  const spaceIn = (side: PanelBlock) => objects().find((object): object is IconSpace => object instanceof IconSpace && panelIdOf(object) === idOf(side))!
  const titles = () => sides().map((side) => settingsOf(side).title)
  return { f, comparison, sides, spaceIn, titles, mouse: pointer(f) }
}

const gapBetween = (left: PanelBlock, right: PanelBlock) => bodyOf(right).x - (bodyOf(left).x + bodyOf(left).width)

describe('comparison blocks', () => {
  it('places two matching sides, each with an empty icon space; the first click picks the comparison, the next one what is under the pointer', () => {
    const { f, comparison, sides, spaceIn, titles, mouse } = withComparison()
    const [left, right] = sides()
    expect(titles()).toEqual(['Control', 'Treatment'])
    expect(bodyOf(left!).width).toBeCloseTo(bodyOf(right!).width, 5)
    expect(bodyOf(left!).height).toBeCloseTo(bodyOf(right!).height, 5)
    expect(bodyOf(left!).y).toBeCloseTo(bodyOf(right!).y, 5)
    expect(f.canvas.getActiveObject()).toBe(comparison)

    // Click away, then on the left side's space: the comparison first.
    mouse.click(60, 60)
    expect(f.canvas.getActiveObject()).toBeUndefined()
    const space = spaceIn(left!)
    mouse.click(...middle(space))
    expect(f.canvas.getActiveObject()).toBe(comparison)
    // Then the space itself.
    mouse.click(...middle(space))
    expect(f.canvas.getActiveObject()).toBe(space)
  })

  it('resizing one side by its handle resizes the other alike while dragging, nothing stretched and the gap kept; one Undo puts both back', async () => {
    const { f, sides, mouse } = withComparison()
    const [left, right] = sides()
    const start = { left: bodyOf(left!), right: bodyOf(right!), gap: gapBetween(left!, right!) }
    f.canvas.setActiveObject(left!)
    f.canvas.requestRenderAll()

    // The left side's bottom-middle handle (on the outline's outer edge), pulled 60 px down; then its right-middle one, 40 px right.
    const bottom = start.left.y + start.left.height + 0.75
    mouse.press(start.left.x + start.left.width / 2, bottom)
    mouse.move(start.left.x + start.left.width / 2, bottom + 30)
    mouse.move(start.left.x + start.left.width / 2, bottom + 60)
    // Checked before letting go: the other side is already as tall, its top level, and nothing is stretched.
    for (const side of sides()) {
      expect(side.scaleX).toBe(1)
      expect(side.scaleY).toBe(1)
      for (const part of side.getObjects()) expect(part.scaleY).toBe(1)
    }
    const grown = bodyOf(left!).height - start.left.height
    expect(grown).toBeGreaterThan(40)
    expect(bodyOf(right!).height).toBeCloseTo(bodyOf(left!).height, 5)
    expect(bodyOf(right!).y).toBeCloseTo(start.right.y, 5)
    mouse.release(start.left.x + start.left.width / 2, bottom + 60)

    const edge = bodyOf(left!).x + bodyOf(left!).width + 0.75
    const level = bodyOf(left!).y + bodyOf(left!).height / 2
    mouse.press(edge, level)
    mouse.move(edge + 20, level)
    mouse.move(edge + 40, level)
    const wider = bodyOf(left!).width - start.left.width
    expect(wider).toBeGreaterThan(25)
    // The right side as wide, moved along by as much as the left one grew, so the gap stays.
    expect(bodyOf(right!).width).toBeCloseTo(bodyOf(left!).width, 5)
    expect(gapBetween(left!, right!)).toBeCloseTo(start.gap, 5)
    expect(right!.scaleX).toBe(1)
    mouse.release(edge + 40, level)

    f.undo()
    await settle()
    f.undo()
    await settle()
    expect(bodyOf(sides()[0]!)).toMatchObject({ width: start.left.width, height: start.left.height })
    expect(bodyOf(sides()[1]!)).toMatchObject({ x: start.right.x, width: start.right.width, height: start.right.height })
  })

  it('dragging the comparison carries both sides and their spaces along, while dragging', () => {
    const { f, comparison, sides, spaceIn, mouse } = withComparison()
    mouse.click(60, 60)
    const [left, right] = sides()
    const before = [bodyOf(left!), bodyOf(right!), spaceIn(right!).getCenterPoint()] as const
    // Grab the right side's empty corner: the comparison is picked and moves.
    const grab: [number, number] = [before[1].x + 10, before[1].y + before[1].height - 8]
    mouse.press(...grab)
    mouse.move(grab[0] + 40, grab[1] + 30)
    mouse.move(grab[0] + 80, grab[1] + 60)
    expect(f.canvas.getActiveObject()).toBe(comparison)
    const dx = bodyOf(left!).x - before[0].x
    const dy = bodyOf(left!).y - before[0].y
    expect(dx).toBeCloseTo(80, -1)
    expect(dy).toBeCloseTo(60, -1)
    expect(bodyOf(right!).x).toBeCloseTo(before[1].x + dx, 5)
    expect(spaceIn(right!).getCenterPoint().y).toBeCloseTo(before[2].y + dy, 5)
    mouse.release(grab[0] + 80, grab[1] + 60)
    expect(panelIdOf(right!)).toBe(idOf(comparison))
  })

  it('once it is selected, dragging from a side or its space still moves the whole block and never reorders the sides; a click without a drag picks the side', () => {
    const { f, comparison, sides, spaceIn, titles, mouse } = withComparison('change')
    const drag = (from: [number, number], by: [number, number]) => {
      mouse.press(...from)
      mouse.move(from[0] + by[0] / 2, from[1] + by[1] / 2)
      mouse.move(from[0] + by[0], from[1] + by[1])
      // Mid-drag: the whole block is what moves.
      expect(f.canvas.getActiveObject()).toBe(comparison)
      mouse.release(from[0] + by[0], from[1] + by[1])
    }
    const [before, after] = sides()
    // The comparison is selected; drag the Before side over the After side, by its empty corner and then by its space.
    const grips: (() => [number, number])[] = [() => [bodyOf(before!).x + 8, bodyOf(before!).y + bodyOf(before!).height - 8], () => middle(spaceIn(before!))]
    for (const grip of grips) {
      const from = grip()
      const start = [bodyOf(before!).x, bodyOf(after!).x]
      drag(from, [200, 0])
      expect(titles()).toEqual(['Before', 'After'])
      const moved = bodyOf(before!).x - (start[0] ?? 0)
      expect(moved).toBeCloseTo(200, -1)
      expect(bodyOf(after!).x - (start[1] ?? 0)).toBeCloseTo(moved, 5)
    }

    // A click without a drag picks the side; dragging the picked side moves the whole block too.
    const corner: [number, number] = [bodyOf(after!).x + 8, bodyOf(after!).y + bodyOf(after!).height - 8]
    mouse.click(...corner)
    expect(f.canvas.getActiveObject()).toBe(after)
    const start = bodyOf(before!).x
    drag(corner, [-150, 40])
    expect(titles()).toEqual(['Before', 'After'])
    expect(bodyOf(before!).x - start).toBeCloseTo(-150, -1)
  })

  it('Swap sides trades the sides with what they hold; in Paired colours the left one stays grey; one Undo swaps back', async () => {
    const { f, comparison, sides, spaceIn, titles } = withComparison()
    f.setComparison({ look: 'paired' })
    const [control] = sides()
    const space = spaceIn(control!)
    const offset = space.getCenterPoint().x - bodyOf(control!).x
    f.swapSides()
    expect(titles()).toEqual(['Treatment', 'Control'])
    // Control is now on the right, its space still inside it at the same place.
    expect(sides()[1]).toBe(control)
    expect(space.getCenterPoint().x - bodyOf(control!).x).toBeCloseTo(offset, 5)
    // The colours go by place: grey on the left, the block's colour on the right.
    expect(settingsOf(sides()[0]!).colour).toBe('#71717a')
    expect(settingsOf(sides()[1]!).colour).toBe(comparisonSettingsOf(comparison).colour)
    f.undo()
    await settle()
    expect(titles()).toEqual(['Control', 'Treatment'])
  })

  it('no look starts with "vs": it shows only once picked, and stays through a change of look; the colour stays too', () => {
    const { f, comparison } = withComparison()
    const hasVs = () => comparison.getObjects().some((part) => (part as FabricObject & { name?: string }).name === 'vs')
    for (const look of ['twin', 'paired', 'split'] as const) {
      f.setComparison({ look })
      expect(comparisonSettingsOf(comparison).between).not.toBe('vs')
      expect(hasVs()).toBe(false)
    }
    f.setComparison({ colour: '#d55e00' })
    f.setComparison({ between: 'vs' })
    expect(hasVs()).toBe(true)
    f.setComparison({ look: 'twin' })
    expect(comparisonSettingsOf(comparison)).toMatchObject({ look: 'twin', between: 'vs', colour: '#d55e00' })
    expect(hasVs()).toBe(true)
  })

  it('Detach leaves two plain panels holding their spaces, with the arrow as a shape; Split frame sides get a box of their own', () => {
    const { f, comparison, sides, spaceIn } = withComparison('change')
    f.setComparison({ look: 'split' })
    const [before, after] = sides()
    expect(before!.bare).toBe(true)
    expect(f.detachSequence()).toBe(true)
    expect(f.canvas.getObjects()).not.toContain(comparison)
    for (const side of [before!, after!]) {
      expect(panelIdOf(side)).toBeUndefined()
      expect(side.bare).toBe(false)
      expect(panelIdOf(spaceIn(side))).toBe(idOf(side))
    }
    // The tinted After half and the chevron divider are loose shapes now, named for what they were.
    const names = f.canvas.getObjects().map((object) => (object as FabricObject & { name?: string }).name)
    expect(names).toEqual(expect.arrayContaining(['Frame', 'After tint', 'Divider']))
  })
})
