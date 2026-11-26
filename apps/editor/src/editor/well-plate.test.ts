// @vitest-environment jsdom
import '../test/canvas-stub'

import { afterEach, describe, expect, it } from 'vitest'

import { wellPlate } from './blocks'
import { FigureCanvas, type CanvasState } from './FigureCanvas'
import { WellPlate, plateMarks } from './well-plate'

let figures: FigureCanvas[] = []

afterEach(async () => {
  for (const figure of figures) await figure.dispose()
  figures = []
})

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
    click(x: number, y: number) {
      this.press(x, y)
      this.release(x, y)
    },
  }
}

/** A figure with a 96-well plate (the example dose series) placed from the Blocks tool, selected. */
function withPlate(look: 'plate' | 'grid' | 'labelled' = 'plate') {
  const element = document.createElement('canvas')
  document.body.append(element)
  const f = new FigureCanvas(element, { width: 1000, height: 800 })
  figures.push(f)
  let state: CanvasState | undefined
  f.subscribe((next) => (state = next))
  f.addBlock(wellPlate(look))
  const plate = plates(f)[0]!
  return { f, plate, mouse: pointer(f), selection: () => state?.selection }
}

const plates = (f: FigureCanvas) => f.canvas.getObjects().filter((object): object is WellPlate => object instanceof WellPlate)

/** The middle of a well ("A1" is row 0, column 0) on the page. */
function wellPoint(plate: WellPlate, r: number, c: number): [number, number] {
  const { x0, y0, pitch } = plate.plateGeometry
  return [plate.left + x0 + c * pitch + pitch / 2, plate.top + y0 + r * pitch + pitch / 2]
}

describe('well plate maps', () => {
  it('is placed selected; a first click on a well of a plate not being worked on picks the plate and paints nothing', () => {
    const { f, plate, mouse, selection } = withPlate()
    expect(f.canvas.getActiveObject()).toBe(plate)
    expect(selection()?.kind).toBe('plate')
    // Painting with Untreated, then letting go of the plate: painting stops.
    f.setPlateBrush('untreated')
    expect(selection()?.plate?.brush).toBe('untreated')
    f.canvas.discardActiveObject()
    f.canvas.fire('selection:cleared', { deselected: [plate], e: undefined })
    const before = { ...plate.plate.map }
    mouse.click(...wellPoint(plate, 0, 9))
    expect(f.canvas.getActiveObject()).toBe(plate)
    expect(plate.plate.map).toEqual(before)
    expect(selection()?.plate?.brush).toBeUndefined()
  })

  it('with a condition picked, a box dragged over wells shows the colour mid-drag without moving the plate, fills them on release, and one Undo takes it back', async () => {
    const { f, plate, mouse } = withPlate()
    f.setPlateBrush('dose-3')
    const { left, top } = plate
    // From A10 to H11: two empty columns, 16 wells.
    mouse.press(...wellPoint(plate, 0, 9))
    mouse.move(...wellPoint(plate, 3, 10))
    mouse.move(...wellPoint(plate, 7, 10))
    // Mid-drag: the plate stays put, the wells under the box are previewed, nothing is painted yet.
    expect([plate.left, plate.top]).toEqual([left, top])
    expect(plate.preview?.wells.size).toBe(16)
    expect(plate.preview?.colour).toBe('#0072b2')
    expect(plate.plate.map.A10).toBeUndefined()
    mouse.release(...wellPoint(plate, 7, 10))
    expect(plate.preview).toBeUndefined()
    for (const well of ['A10', 'D11', 'H11', 'H10']) expect(plate.plate.map[well]).toBe('dose-3')
    expect(Object.values(plate.plate.map).filter((id) => id === 'dose-3')).toHaveLength(6 + 16)
    expect([plate.left, plate.top]).toEqual([left, top])

    f.undo()
    await settle()
    expect(plates(f)[0]!.plate.map.A10).toBeUndefined()
  })

  it('a row letter fills its row, Empty clears wells, and Escape stops painting so a drag moves the plate again', () => {
    const { f, plate, mouse, selection } = withPlate()
    f.setPlateBrush('positive')
    const { x0, y0, pitch } = plate.plateGeometry
    // The letter C, left of row C.
    mouse.click(plate.left + x0 - 9, plate.top + y0 + 2 * pitch + pitch / 2)
    for (let c = 1; c <= 12; c++) expect(plate.plate.map[`C${c}`]).toBe('positive')
    f.setPlateBrush(null)
    mouse.click(...wellPoint(plate, 2, 4))
    expect(plate.plate.map.C5).toBeUndefined()

    expect(f.tableKey({ key: 'Escape', shiftKey: false, ctrlKey: false, metaKey: false, altKey: false })).toBe(true)
    expect(selection()?.plate?.brush).toBeUndefined()
    expect(f.canvas.getActiveObject()).toBe(plate)
    const left = plate.left
    const [x, y] = wellPoint(plate, 4, 4)
    mouse.press(x, y)
    mouse.move(x + 20, y)
    mouse.move(x + 40, y)
    mouse.release(x + 40, y)
    expect(plate.left).toBeCloseTo(left + 40, 0)
    expect(plate.plate.map.E5).toBe('dose-2')
  })

  it('resizing by a corner spreads the wells out mid-drag without stretching: scale stays 1, text keeps its size, the opposite corner stays', () => {
    const { plate, mouse } = withPlate('labelled')
    const { left, top } = plate
    const pitch = plate.plateGeometry.pitch
    const textSizes = () => plateMarks(plate.plate).marks.flatMap((mark) => (mark.kind === 'text' && mark.fill === '#71717a' && /^[A-H]$/.test(mark.text) ? [mark.size] : []))
    const before = textSizes()
    const handle = plate.oCoords.br!
    mouse.press(handle.x, handle.y)
    mouse.move(handle.x + 30, handle.y + 20)
    mouse.move(handle.x + 60, handle.y + 40)
    // Mid-drag.
    expect(plate.scaleX).toBe(1)
    expect(plate.scaleY).toBe(1)
    expect(plate.plateGeometry.pitch).toBeGreaterThan(pitch)
    expect(textSizes()).toEqual(before)
    expect(plate.left).toBeCloseTo(left, 5)
    expect(plate.top).toBeCloseTo(top, 5)
    mouse.release(handle.x + 60, handle.y + 40)
    expect(plate.scaleX).toBe(1)
    expect(plate.plateGeometry.pitch).toBeGreaterThan(pitch)
  })

  it('conditions: Add paints with a new colour, Remove empties its wells and leaves the legend; a smaller size and back keeps every coloured well', () => {
    const { f, plate, selection } = withPlate()
    const id = f.addPlateCondition()!
    expect(selection()?.plate?.brush).toBe(id)
    const added = plate.plate.conditions.at(-1)!
    expect(plate.plate.conditions.slice(0, -1).map((condition) => condition.colour)).not.toContain(added.colour)

    expect(f.removePlateCondition('vehicle')).toBe(true)
    expect(Object.values(plate.plate.map)).not.toContain('vehicle')
    const legend = plateMarks(plate.plate).marks.flatMap((mark) => (mark.kind === 'text' ? [mark.text] : []))
    expect(legend).not.toContain('Vehicle (0.1% DMSO)')
    expect(legend).toContain('Untreated')

    // A smaller plate shows only its own wells; going back shows every coloured well again (owner's bug, 2026-11-26).
    const map = { ...plate.plate.map }
    f.setPlate({ wells: 6 })
    expect(plate.plate.wells).toBe(6)
    expect(Object.keys(selection()!.plate!.map).sort()).toEqual(['A1', 'A2', 'A3', 'B1', 'B2']) // B3 held Vehicle, removed above
    f.setPlate({ wells: 96 })
    expect(plate.plate.map).toEqual(map)
    expect(selection()!.plate!.map).toEqual(map)
  })

  it('Detach leaves plain shapes and text where the plate was, all selected, and Undo brings the plate back', async () => {
    const { f, plate } = withPlate('grid')
    const area = plate.getBoundingRect()
    expect(f.detachPlate()).toBe(true)
    expect(plates(f)).toHaveLength(0)
    const parts = f.canvas.getActiveObjects()
    expect(parts.length).toBeGreaterThan(96)
    for (const part of parts) {
      const box = part.getBoundingRect()
      expect(box.left).toBeGreaterThanOrEqual(area.left - 1)
      expect(box.top).toBeGreaterThanOrEqual(area.top - 1)
    }
    f.undo()
    await settle()
    expect(plates(f)).toHaveLength(1)
    expect(plates(f)[0]!.plate.look).toBe('grid')
  })
})
