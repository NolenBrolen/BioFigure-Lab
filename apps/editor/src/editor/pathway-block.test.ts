// @vitest-environment jsdom
import '../test/canvas-stub'

import { FabricText, Point, util, type FabricObject } from 'fabric'
import { afterEach, describe, expect, it } from 'vitest'

import { pathwayCascade } from './blocks'
import { chartSizeForPage } from './chart-model'
import { FigureCanvas, idOf } from './FigureCanvas'
import { IconSpace, spaceBox } from './icon-space'
import { panelIdOf } from './panel-block'
import { PathwayBlock, pathwaySettingsOf, type PathwayLook } from './pathway-block'
import { sequenceBox, sequenceSettingsOf } from './sequence-block'

let figures: FigureCanvas[] = []

afterEach(async () => {
  for (const figure of figures) await figure.dispose()
  figures = []
})

function makeFigure(page = { width: 1000, height: 1000 }): FigureCanvas {
  const element = document.createElement('canvas')
  document.body.append(element)
  const figure = new FigureCanvas(element, page)
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
      for (let step = 1; step <= 5; step++) this.move(from[0] + ((to[0] - from[0]) * step) / 5, from[1] + ((to[1] - from[1]) * step) / 5)
      this.release(...to)
    },
  }
}

const settle = () => new Promise((resolve) => setTimeout(resolve))

/** A figure with a pathway placed from the Blocks tool, its steps top to bottom and their names. */
function withPathway(look: PathwayLook = 'cutout') {
  const f = makeFigure()
  f.addBlock(pathwayCascade(look))
  const objects = () => f.canvas.getObjects()
  const block = () => objects().find((object): object is PathwayBlock => object instanceof PathwayBlock)!
  const steps = () =>
    objects()
      .filter((object): object is IconSpace => object instanceof IconSpace && panelIdOf(object) === idOf(block()))
      .sort((a, b) => spaceBox(a).y - spaceBox(b).y)
  const names = () => sequenceSettingsOf(block()).labels
  const part = (name: string) => block().getObjects().find((each) => (each as FabricObject & { name?: string }).name === name)
  return { f, block, steps, names, part, mouse: pointer(f) }
}

/** A part's box on the page: its corners through the group's transform (its own bounding box is in the group's frame). */
function pageBox(part: FabricObject) {
  const matrix = part.calcTransformMatrix()
  const corners = [new Point(-part.width / 2, -part.height / 2), new Point(part.width / 2, part.height / 2)].map((corner) => util.transformPoint(corner, matrix))
  const [a, b] = corners as [Point, Point]
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) }
}

describe('pathway cascades', () => {
  it('places a ligand, a receptor in the membrane, two steps and a target gene inside the nucleus, in one column, selected', () => {
    const { f, block, steps, names, part } = withPathway()
    expect(f.canvas.getActiveObject()).toBe(block())
    expect(steps()).toHaveLength(5)
    expect(names()).toEqual(['Ligand', 'Receptor', 'Step 1', 'Step 2', 'Target gene'])
    const middles = steps().map((step) => spaceBox(step).x + spaceBox(step).width / 2)
    for (const x of middles) expect(x).toBeCloseTo(middles[0]!, 5)
    // The receptor is crossed by the bilayer; the last step sits inside the nucleus, the one before it doesn't.
    const lipids = pageBox(part('Lipid heads')!)
    const receptor = spaceBox(steps()[1]!)
    expect(lipids.y).toBeGreaterThan(receptor.y)
    expect(lipids.y + lipids.height).toBeLessThan(receptor.y + receptor.height)
    const nucleus = pageBox(part('Nuclear envelope')!)
    const [, , , chainEnd, gene] = steps().map(spaceBox)
    expect(gene!.y).toBeGreaterThan(nucleus.y)
    expect(gene!.y + gene!.height).toBeLessThan(nucleus.y + nucleus.height)
    expect(chainEnd!.y + chainEnd!.height).toBeLessThan(nucleus.y)
  })

  it('on a page too short for it, it is placed between the top and bottom margins, its steps smaller and not stretched', () => {
    const page = { width: 660, height: 450 }
    const f = makeFigure(page)
    f.addBlock(pathwayCascade('cutout'))
    const block = f.canvas.getObjects().find((object): object is PathwayBlock => object instanceof PathwayBlock)!
    const box = sequenceBox(block)
    const room = chartSizeForPage(page, true).height
    const margin = (page.height - room) / 2
    expect(box.height).toBeLessThanOrEqual(room + 0.5)
    expect(box.height).toBeGreaterThan(room - 20)
    expect(box.y).toBeGreaterThanOrEqual(margin - 0.5)
    expect(box.y + box.height).toBeLessThanOrEqual(page.height - margin + 0.5)
    for (const step of f.canvas.getObjects().filter((object) => object instanceof IconSpace)) {
      expect(step.scaleX).toBe(1)
      expect(spaceBox(step).width).toBeLessThan(84)
    }
  })

  it('the "+" adds an empty step after the chain, above the nucleus, named next; the nucleus keeps its step; one Undo takes it away', async () => {
    const { f, block, steps, names, mouse } = withPathway()
    const plus = block().oCoords.addStep!
    mouse.click(plus.x, plus.y)
    expect(steps()).toHaveLength(6)
    expect(names()).toEqual(['Ligand', 'Receptor', 'Step 1', 'Step 2', 'Step 3', 'Target gene'])
    expect(pathwaySettingsOf(block()).nuclear).toBe(1)
    // Laid out: even arrow gaps down the chain, the new step right before the target gene.
    const boxes = steps().map(spaceBox)
    const gap = (i: number) => boxes[i + 1]!.y - (boxes[i]!.y + boxes[i]!.height)
    expect(gap(3)).toBeCloseTo(gap(2), 5)
    expect(f.canvas.getActiveObject()).toBe(block())

    f.undo()
    await settle()
    expect(steps()).toHaveLength(5)
    expect(names()).toEqual(['Ligand', 'Receptor', 'Step 1', 'Step 2', 'Target gene'])

    // The "+" is back in its place after Undo, and still adds a step.
    f.canvas.setActiveObject(block())
    f.canvas.requestRenderAll()
    const again = block().oCoords.addStep
    expect(again).toBeDefined()
    expect(again!.x).toBeCloseTo(plus.x, 0)
    expect(again!.y).toBeCloseTo(plus.y, 0)
    mouse.click(again!.x, again!.y)
    expect(steps()).toHaveLength(6)
  })

  it('removing a step takes its name, role and arrow word along and closes up; removing the ligand turns it off', () => {
    const { f, block, steps, names } = withPathway()
    f.setPathwayStep(2, { role: 'Kinase', verb: 'phosphorylates' })
    f.setPathwayStep(3, { role: 'Enzyme' })
    const before = steps().map(spaceBox)
    expect(f.removeStep(2)).toBe(true)
    expect(names()).toEqual(['Ligand', 'Receptor', 'Step 2', 'Target gene'])
    expect(pathwaySettingsOf(block()).roles.slice(0, 3)).toEqual(['', '', 'Enzyme'])
    expect(pathwaySettingsOf(block()).verbs.at(2) ?? '').toBe('')
    // Step 2 moved up into Step 1's place.
    expect(spaceBox(steps()[2]!).y).toBeCloseTo(before[2]!.y, 5)

    f.canvas.setActiveObject(block())
    expect(f.removeStep(0)).toBe(true)
    expect(pathwaySettingsOf(block()).ligand).toBe(false)
    expect(names()).toEqual(['Receptor', 'Step 2', 'Target gene'])
  })

  it('dragging a side handle makes it wider while dragging, nothing stretched; from the left edge the steps move along and the right edge stays', () => {
    const { f, block, steps, mouse } = withPathway('bands')
    const start = sequenceBox(block())
    const column = () => spaceBox(steps()[0]!).x
    const firstX = column()
    const level = start.y + start.height / 2

    // Right handle, 80 px out.
    mouse.press(start.x + start.width, level)
    mouse.move(start.x + start.width + 40, level)
    mouse.move(start.x + start.width + 80, level)
    expect(block().scaleX).toBe(1)
    for (const part of block().getObjects()) expect(part.scaleX).toBe(1)
    expect(sequenceBox(block()).width).toBeGreaterThan(start.width + 60)
    expect(sequenceBox(block()).x).toBeCloseTo(start.x, 1)
    expect(column()).toBeCloseTo(firstX, 5)
    mouse.release(start.x + start.width + 80, level)
    expect(f.canvas.getActiveObject()).toBe(block())

    // Left handle, 50 px out: the right edge stays, the steps move with the left edge.
    const wide = sequenceBox(block())
    mouse.press(wide.x, level)
    mouse.move(wide.x - 25, level)
    mouse.move(wide.x - 50, level)
    const now = sequenceBox(block())
    expect(block().scaleX).toBe(1)
    expect(now.x + now.width).toBeCloseTo(wide.x + wide.width, 0)
    expect(column() - firstX).toBeCloseTo(now.x - wide.x, 0)
    mouse.release(wide.x - 50, level)
  })

  it('resizing a step lays the chain out again while dragging: the steps under it move down by as much as it grew', () => {
    const { f, steps, mouse } = withPathway()
    const [, , step] = steps()
    const before = steps().map(spaceBox)
    f.canvas.setActiveObject(step!)
    f.canvas.requestRenderAll()
    const box = spaceBox(step!)
    // The bottom-right corner, pulled 30 px out.
    const corner = step!.oCoords.br!
    mouse.press(corner.x, corner.y)
    mouse.move(corner.x + 15, corner.y + 15)
    mouse.move(corner.x + 30, corner.y + 30)
    expect(step!.scaleX).toBe(1)
    const grew = spaceBox(step!).height - box.height
    expect(grew).toBeGreaterThan(10)
    const after = steps().map(spaceBox)
    // Its top stays (the step being resized is pinned); everything under it moves down by the growth.
    expect(after[2]!.y).toBeCloseTo(before[2]!.y, 5)
    expect(after[3]!.y - before[3]!.y).toBeCloseTo(grew, 5)
    expect(after[4]!.y - before[4]!.y).toBeCloseTo(grew, 5)
    mouse.release(corner.x + 30, corner.y + 30)
  })

  it("switching style keeps the block's box (size and middle), every way round, without drifting; one Undo goes back", async () => {
    const { f, block, steps } = withPathway()
    const start = sequenceBox(block())
    const expectBox = (box: ReturnType<typeof sequenceBox>) => {
      expect(box.width).toBeCloseTo(start.width, 0)
      expect(box.height).toBeCloseTo(start.height, 0)
      expect(box.x + box.width / 2).toBeCloseTo(start.x + start.width / 2, 0)
      expect(box.y + box.height / 2).toBeCloseTo(start.y + start.height / 2, 0)
    }
    for (const look of ['cards', 'bands', 'cutout', 'bands', 'cards', 'cutout'] as const) {
      f.setPathway({ look })
      expectBox(sequenceBox(block()))
      // The steps stay inside it and unstretched.
      for (const step of steps()) expect(step.scaleX).toBe(1)
    }
    f.undo()
    await settle()
    expect(pathwaySettingsOf(block()).look).toBe('cards')
    expectBox(sequenceBox(block()))
  })

  it("a step dragged onto another trades places and sizes with it: the receptor dragged onto Step 1 gets its size, and Step 1 the receptor's", () => {
    const { f, block, steps, mouse } = withPathway()
    const [, receptor, first] = steps()
    const sizes = [spaceBox(receptor!), spaceBox(first!)].map((box) => box.width)
    expect(sizes[0]).toBeGreaterThan(sizes[1]! + 10)
    const middleOf = (space: IconSpace): [number, number] => [spaceBox(space).x + spaceBox(space).width / 2, spaceBox(space).y + spaceBox(space).height / 2]
    // With the pathway selected, a press on a step drags that step.
    f.canvas.setActiveObject(block())
    mouse.drag(middleOf(receptor!), middleOf(first!))
    const order = steps()
    expect(order[1]).toBe(first)
    expect(order[2]).toBe(receptor)
    expect(spaceBox(first!).width).toBeCloseTo(sizes[0]!, 1)
    expect(spaceBox(receptor!).width).toBeCloseTo(sizes[1]!, 1)
    for (const step of order) expect(step.scaleX).toBe(1)
  })

  it('a new look keeps the colour and the steps; Detach leaves the drawing as plain shapes and text, the steps loose', () => {
    const { f, block, steps } = withPathway()
    f.setPathway({ colour: '#d55e00' })
    f.setPathway({ look: 'cards' })
    expect(pathwaySettingsOf(block())).toMatchObject({ look: 'cards', colour: '#d55e00' })
    expect(steps()).toHaveLength(5)
    const kept = steps()
    expect(f.detachSequence()).toBe(true)
    const objects = f.canvas.getObjects()
    expect(objects.some((object) => object instanceof PathwayBlock)).toBe(false)
    for (const step of kept) expect(panelIdOf(step)).toBeUndefined()
    const texts = objects.filter((object) => object instanceof FabricText).map((object) => (object as FabricText).text)
    expect(texts).toEqual(expect.arrayContaining(['Ligand', 'Receptor', 'Target gene', 'NUCLEUS']))
    expect(objects.filter((object) => (object as FabricObject & { name?: string }).name === 'Card')).toHaveLength(5)
  })
})
