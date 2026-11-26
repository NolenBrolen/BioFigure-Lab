// @vitest-environment jsdom
import '../test/canvas-stub'

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { Group, IText } from 'fabric'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { legendBlock } from './blocks'
import { FigureCanvas, type CanvasState } from './FigureCanvas'
import { LegendBlock, legendMarks, type LegendLook } from './legend-block'

// The icon library is a separate download (`npm run icons`), so every legend icon loads the plain test drawing instead:
// not cached yet, then loaded in the background, the way a library icon arrives.
const testIcon = vi.hoisted(() => ({ svg: '' }))
vi.mock('./icon-library', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./icon-library')>()
  return { ...actual, cachedIconSvg: () => undefined, loadIconSvg: () => Promise.resolve(testIcon.svg) }
})
testIcon.svg = readFileSync(join(import.meta.dirname, '..', 'test', 'fixtures', 'test-cell.svg'), 'utf8')

let figures: FigureCanvas[] = []

afterEach(async () => {
  for (const figure of figures) await figure.dispose()
  figures = []
})

const settle = () => new Promise((resolve) => setTimeout(resolve, 20))

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

const legends = (f: FigureCanvas) => f.canvas.getObjects().filter((object): object is LegendBlock => object instanceof LegendBlock)

/** A figure with a legend placed from the Blocks tool, selected. */
function withLegend(look: LegendLook = 'plain') {
  const element = document.createElement('canvas')
  document.body.append(element)
  const f = new FigureCanvas(element, { width: 1000, height: 800 })
  figures.push(f)
  let state: CanvasState | undefined
  f.subscribe((next) => (state = next))
  f.addBlock(legendBlock(look))
  const legend = legends(f)[0]!
  return { f, legend, mouse: pointer(f), selection: () => state?.selection }
}

const textSizes = (legend: LegendBlock) => legendMarks(legend.legend).marks.flatMap((mark) => (mark.kind === 'text' ? [mark.size] : []))

describe('legends', () => {
  it('is placed selected with two icon rows and a colour row; the icons load into the legend, and one Undo takes it away', async () => {
    const { f, legend, selection } = withLegend('boxed')
    expect(f.canvas.getActiveObject()).toBe(legend)
    expect(selection()?.kind).toBe('legend')
    expect(selection()?.legend?.rows.map((row) => row.kind)).toEqual(['icon', 'icon', 'swatch'])
    // The library icon loads in the background; on a busy machine that can take a while.
    await vi.waitFor(() => expect(legend.legend.rows[0]!.svg).toContain('<svg'), { timeout: 10000 })
    // Exported as vector, the icon inside.
    expect(legend.toSVG()).toContain('viewBox')
    f.undo()
    await settle()
    expect(legends(f)).toHaveLength(0)
  })

  it('resizing by a corner grows everything together mid-drag without stretching: scale stays 1, the opposite corner stays', () => {
    const { legend, mouse } = withLegend('chips')
    const { left, top, width } = legend
    const before = textSizes(legend)
    const handle = legend.oCoords.br!
    mouse.press(handle.x, handle.y)
    mouse.move(handle.x + 30, handle.y + 20)
    mouse.move(handle.x + 60, handle.y + 40)
    // Mid-drag.
    expect(legend.scaleX).toBe(1)
    expect(legend.scaleY).toBe(1)
    expect(legend.width).toBeGreaterThan(width)
    expect(textSizes(legend)[0]).toBeGreaterThan(before[0]!)
    expect(legend.left).toBeCloseTo(left, 5)
    expect(legend.top).toBeCloseTo(top, 5)
    mouse.release(handle.x + 60, handle.y + 40)
    expect(legend.scaleX).toBe(1)
    expect(legend.legend.size).toBeGreaterThan(12)
  })

  it('the "+" adds a row like the last one, in a colour the legend doesn\'t use yet; one Undo takes it back', async () => {
    const { f, legend, mouse } = withLegend()
    const plus = legend.oCoords.addRow!
    mouse.press(plus.x, plus.y)
    mouse.release(plus.x, plus.y)
    const rows = legend.legend.rows
    expect(rows).toHaveLength(4)
    expect(rows[3]!.kind).toBe('swatch')
    expect(rows.slice(0, 3).map((row) => row.colour)).not.toContain(rows[3]!.colour)
    // An icon row on request, with the last icon row's icon.
    f.addLegendRow('icon')
    expect(legend.legend.rows.at(-1)!.iconId).toBe(rows[1]!.iconId)
    f.undo()
    f.undo()
    await settle()
    expect(legends(f)[0]!.legend.rows).toHaveLength(3)
  })

  it('− removes a row (the legend keeps its last one), labels and colours change, and Undo brings a removed row back with its label', async () => {
    const { f, legend } = withLegend()
    const [first, second, third] = legend.legend.rows
    f.updateLegendRow(third!.id, { label: 'LPS 100 ng/ml', colour: '#009e73' }, 'label')
    expect(legendMarks(legend.legend).marks.some((mark) => mark.kind === 'text' && mark.text === 'LPS 100 ng/ml')).toBe(true)
    expect(f.removeLegendRow(second!.id)).toBe(true)
    expect(f.removeLegendRow(third!.id)).toBe(true)
    expect(f.removeLegendRow(first!.id)).toBe(false)
    expect(legend.legend.rows).toHaveLength(1)
    f.undo()
    await settle()
    const back = legends(f)[0]!.legend.rows
    expect(back.map((row) => row.label)).toEqual(['T cell', 'LPS 100 ng/ml'])
    expect(back[1]!.colour).toBe('#009e73')
  })

  it('a new style keeps the box (back and forth without shrinking), a new layout the middle, both the colour; the boxed key\'s header comes and goes with its style', () => {
    const { f, legend } = withLegend()
    // Bigger, so the boxed key can fit its box here too: the test canvas measures text at a fixed width whatever its size.
    f.setLegend({ colour: '#cc79a7', size: 24 })
    const middle = legend.getCenterPoint()
    const box = { width: legend.width, height: legend.height }
    f.setLegend({ look: 'boxed' })
    // The new style fits the old box: one side the same, the other no bigger.
    expect(legend.width).toBeLessThanOrEqual(box.width + 0.5)
    expect(legend.height).toBeLessThanOrEqual(box.height + 0.5)
    expect(Math.max(legend.width / box.width, legend.height / box.height)).toBeCloseTo(1, 2)
    f.setLegend({ look: 'chips' })
    f.setLegend({ look: 'plain' })
    expect(legend.width).toBeCloseTo(box.width, 1)
    expect(legend.height).toBeCloseTo(box.height, 1)
    f.setLegend({ look: 'boxed' })
    expect(legendMarks(legend.legend).marks.some((mark) => mark.kind === 'text' && mark.text === 'KEY')).toBe(true)
    f.setLegend({ layout: 'across' })
    expect(legend.width).toBeGreaterThan(legend.height)
    expect(legend.getCenterPoint().x).toBeCloseTo(middle.x, 5)
    expect(legend.getCenterPoint().y).toBeCloseTo(middle.y, 5)
    f.setLegend({ look: 'chips' })
    expect(legend.legend.colour).toBe('#cc79a7')
    expect(legendMarks(legend.legend).marks.some((mark) => mark.kind === 'text' && mark.text === 'KEY')).toBe(false)
    // Its "+" moves to the right end across.
    expect(legend.oCoords.addRow!.x).toBeGreaterThan(legend.getBoundingRect().left + legend.getBoundingRect().width)
  })

  it('Detach leaves plain shapes, text and library icons where the legend was, all selected, and Undo brings the legend back', async () => {
    const { f, legend } = withLegend('boxed')
    await vi.waitFor(() => expect(legend.legend.rows.every((row) => row.kind !== 'icon' || row.svg)).toBe(true), { timeout: 10000 })
    const area = legend.getBoundingRect()
    expect(await f.detachLegend()).toBe(true)
    expect(legends(f)).toHaveLength(0)
    const parts = f.canvas.getActiveObjects()
    const texts = parts.flatMap((part) => (part instanceof IText ? [part.text] : []))
    expect(texts).toEqual(expect.arrayContaining(['KEY', 'T cell', 'B cell', 'Treated']))
    const icons = parts.filter((part): part is Group => part instanceof Group)
    expect(icons.map((icon) => (icon as Group & { iconId?: string }).iconId)).toEqual(['cells/t-cell-simple-flat', 'cells/b-cell-simple-flat'])
    for (const part of parts) {
      const box = part.getBoundingRect()
      expect(box.left).toBeGreaterThanOrEqual(area.left - 2)
      expect(box.top).toBeGreaterThanOrEqual(area.top - 2)
      expect(box.left + box.width).toBeLessThanOrEqual(area.left + area.width + 2)
    }
    f.undo()
    await settle()
    expect(legends(f)).toHaveLength(1)
    expect(legends(f)[0]!.legend.look).toBe('boxed')
  })
})
