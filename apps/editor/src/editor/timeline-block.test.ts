// @vitest-environment jsdom
import '../test/canvas-stub'

import { FabricText } from 'fabric'
import { afterEach, describe, expect, it } from 'vitest'

import { experimentTimeline } from './blocks'
import { FigureCanvas } from './FigureCanvas'
import { TimelineBlock, timelineBox, timelineSettingsOf } from './timeline-block'

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
  }
}

const timelines = (f: FigureCanvas) => f.canvas.getObjects().filter((object): object is TimelineBlock => object instanceof TimelineBlock)

function place(style: Parameters<typeof experimentTimeline>[0] = 'lanes') {
  const f = makeFigure()
  f.addBlock(experimentTimeline(style))
  const block = timelines(f)[0]!
  return { f, block, mouse: pointer(f) }
}

/** Where a control of the selected block is drawn. */
function control(block: TimelineBlock, name: string) {
  block.setCoords()
  const spot = block.oCoords[name]
  if (!spot) throw new Error(`no ${name} control`)
  return spot
}

/** The day labels' middles along the axis, by their text ("Day 7"). */
function dayLabels(block: TimelineBlock) {
  return new Map(
    block
      .getObjects()
      .filter((part): part is FabricText => part instanceof FabricText && /^Day \d+$/.test(part.text))
      .map((part) => [part.text, part.getBoundingRect().left + part.getBoundingRect().width / 2]),
  )
}

describe('experiment timelines', () => {
  it('places each day by its real time: day 14 is twice as far from day 0 as day 7', () => {
    const { block } = place('lanes')
    const days = dayLabels(block)
    const zero = days.get('Day 0')!
    expect(days.get('Day 14')! - zero).toBeCloseTo(2 * (days.get('Day 7')! - zero), 3)
    expect(days.get('Day 28')! - zero).toBeCloseTo(400, 3)
  })

  it('the "+" adds an event after the last one, as far on as the gap before it, the axis growing to fit; one Undo takes it away', async () => {
    const { f, block, mouse } = place('ruler')
    expect(f.canvas.getActiveObject()).toBe(block)
    const plus = control(block, 'addEvent')
    mouse.press(plus.x, plus.y)
    mouse.release(plus.x, plus.y)
    const settings = timelineSettingsOf(timelines(f)[0]!)
    expect(settings.events).toHaveLength(9)
    // The last event was the endpoint on day 28, a week after day 21.
    expect(settings.events.at(-1)).toEqual({ kind: 2, day: 35 })
    expect(settings.length).toBe(35)
    f.undo()
    await settle()
    expect(timelineSettingsOf(timelines(f)[0]!).events).toHaveLength(8)
  })

  it('dragging the right handle lengthens the axis while dragging, nothing stretched, the left edge staying put and nothing jumping on letting go', () => {
    const { f, block, mouse } = place('pins')
    const before = timelineBox(block)
    const width = timelineSettingsOf(block).width
    const handle = control(block, 'mr')
    mouse.press(handle.x, handle.y)
    mouse.move(handle.x + 20, handle.y)
    mouse.move(handle.x + 80, handle.y)
    // Mid-drag: the axis is longer, the block and every part at scale 1, the left edge where it was.
    expect(timelineSettingsOf(block).width).toBeGreaterThan(width + 60)
    expect([block.scaleX, block.scaleY]).toEqual([1, 1])
    for (const part of block.getObjects()) expect([part.scaleX, part.scaleY]).toEqual([1, 1])
    expect(timelineBox(block).x).toBeCloseTo(before.x, 0)
    const during = timelineBox(block)
    mouse.release(handle.x + 80, handle.y)
    const after = timelineBox(f.canvas.getObjects().find((object) => object instanceof TimelineBlock) as TimelineBlock)
    expect(after.x).toBeCloseTo(during.x, 0)
    expect(after.width).toBeCloseTo(during.width, 0)
  })

  it('dragging the left handle keeps the right edge put', () => {
    const { block, mouse } = place('lanes')
    const before = timelineBox(block)
    const handle = control(block, 'ml')
    mouse.press(handle.x, handle.y)
    mouse.move(handle.x - 20, handle.y)
    mouse.move(handle.x - 60, handle.y)
    expect(timelineBox(block).width).toBeGreaterThan(before.width + 40)
    expect(timelineBox(block).x + timelineBox(block).width).toBeCloseTo(before.x + before.width, 0)
    expect(block.scaleX).toBe(1)
    mouse.release(handle.x - 60, handle.y)
  })

  it('switching style keeps the colour picked; removing an event or a kind keeps at least one, and a kind takes its events along', () => {
    const { f, block } = place('lanes')
    f.setTimeline({ colour: '#cc79a7' })
    f.setTimeline({ style: 'pins' })
    expect(timelineSettingsOf(block)).toMatchObject({ style: 'pins', colour: '#cc79a7' })
    // The blood samples (kind 1) go with their kind; the endpoint becomes kind 1.
    expect(f.removeEventKind(1)).toBe(true)
    const settings = timelineSettingsOf(block)
    expect(settings.kinds.map((kind) => kind.name)).toEqual(['Dosing', 'Endpoint'])
    expect(settings.events).toHaveLength(5)
    expect(settings.events.at(-1)).toEqual({ kind: 1, day: 28 })
    for (let i = 0; i < 4; i++) expect(f.removeEvent(0)).toBe(true)
    expect(f.removeEvent(0)).toBe(false)
  })

  it('switching style keeps the block as wide as it was, round the same middle', () => {
    const { f, block } = place('lanes')
    const before = timelineBox(block)
    for (const style of ['ruler', 'pins', 'lanes'] as const) {
      f.setTimeline({ style })
      const now = timelineBox(block)
      expect(now.width).toBeCloseTo(before.width, 0)
      expect(now.x + now.width / 2).toBeCloseTo(before.x + before.width / 2, 0)
      expect(now.y + now.height / 2).toBeCloseTo(before.y + before.height / 2, 0)
    }
  })

  it('Detach leaves its lines, markers and text as plain objects where they were, all selected', () => {
    const { f, block } = place('ruler')
    const area = timelineBox(block)
    const count = block.getObjects().length - 1
    expect(f.detachTimeline()).toBe(true)
    expect(timelines(f)).toHaveLength(0)
    const parts = f.canvas.getActiveObjects()
    expect(parts).toHaveLength(count)
    const left = Math.min(...parts.map((part) => part.getBoundingRect().left))
    const top = Math.min(...parts.map((part) => part.getBoundingRect().top))
    expect(left).toBeCloseTo(area.x + 4, 0)
    expect(top).toBeCloseTo(area.y + 4, 0)
  })
})
