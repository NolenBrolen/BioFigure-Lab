// @vitest-environment jsdom
import '../test/canvas-stub'

import type { FabricObject, IText } from 'fabric'
import { afterEach, expect, it } from 'vitest'

// jsdom has no Path2D; arrows draw with it.
globalThis.Path2D ??= class {} as unknown as typeof Path2D

import { FigureCanvas } from '../editor/FigureCanvas'
import { buildFigure } from './figure-builder'

type Labelled = FabricObject & { label?: { text: string }; figureId?: string }
type Arrow = FabricObject & { attachStart?: string; attachEnd?: string; pagePoints: () => { x: number; y: number }[] }

let figure: FigureCanvas | undefined
afterEach(async () => {
  await figure?.dispose()
  figure = undefined
})

function makeFigure(): FigureCanvas {
  const element = document.createElement('canvas')
  document.body.append(element)
  figure = new FigureCanvas(element, { width: 600, height: 400 })
  return figure
}

it('writes marked-up text as real character styles', async () => {
  const f = makeFigure()
  await buildFigure(f, { name: 't', objects: [{ type: 'text', x: 10, y: 10, text: 'Ca^{2+} *TP53*' }] })
  const text = f.canvas.getObjects()[0] as IText
  expect(text.text).toBe('Ca2+ TP53')
  // "2" is a superscript: smaller and lifted; "T" is italic.
  expect(text.getStyleAtPosition(2)).toMatchObject({ script: 'super' })
  expect(text.getStyleAtPosition(2).deltaY).toBeLessThan(0)
  expect(text.getStyleAtPosition(5)).toMatchObject({ fontStyle: 'italic' })
  expect(text.getStyleAtPosition(0)).not.toHaveProperty('script')
})

it('keeps the text inside its shape, and attaches arrows to the objects by id', async () => {
  const f = makeFigure()
  await buildFigure(f, {
    name: 't',
    objects: [
      { type: 'shape', id: 'a', kind: 'rounded', x: 20, y: 20, width: 100, height: 50, text: 'Day 0' },
      { type: 'shape', id: 'b', kind: 'ellipse', x: 300, y: 20, width: 100, height: 50 },
      { type: 'arrow', from: 'a', to: 'b', preset: 'inhibition' },
    ],
  })
  const [a, b, arrow] = f.canvas.getObjects() as [Labelled, FabricObject & Labelled, Arrow]
  expect(a.label?.text).toBe('Day 0')
  expect(arrow.attachStart).toBe(a.figureId)
  expect(arrow.attachEnd).toBe(b.figureId)
  const [start, end] = arrow.pagePoints()
  expect(start?.x).toBeGreaterThan(120)
  expect(end?.x).toBeLessThan(300)
})

it('says clearly when an icon id is not in the library', async () => {
  const f = makeFigure()
  await expect(buildFigure(f, { name: 't', objects: [{ type: 'icon', id: 'x', icon: 'cells/nope', cx: 50, cy: 50, width: 40 }] })).rejects.toThrow(/Unknown icon "cells\/nope"/)
})

it('passes colouredBrackets through to the chart, so the dots at the bracket feet can be switched off', async () => {
  const f = makeFigure()
  const groups = [{ name: 'A', values: [1, 2, 3, 4] }, { name: 'B', values: [5, 6, 7, 8] }]
  const chart = { type: 'chart' as const, kind: 'dots-bars' as const, x: 10, y: 10, width: 200, height: 150, test: 'ttest' as const, groups }
  await buildFigure(f, { name: 't', objects: [chart, { ...chart, x: 250, colouredBrackets: false }] })
  const [on, off] = f.canvas.getObjects() as unknown as { chart: { colouredBrackets: boolean } }[]
  expect(on?.chart.colouredBrackets).toBe(true)
  expect(off?.chart.colouredBrackets).toBe(false)
})
