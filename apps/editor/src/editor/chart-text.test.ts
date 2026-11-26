// @vitest-environment jsdom
import '../test/canvas-stub'

import { IText, Point, util, type TPointerEvent } from 'fabric'
import { afterEach, describe, expect, it } from 'vitest'

import { chartSvg, createChart, drawChart, roughMeasure, textBox, type ChartData } from './chart-model'
import { keepScripts, markChartScripts, markScripts, scriptMeasure, type ScriptRun } from './chart-text'
import { ChartObject, measureText } from './ChartObject'
import { FigureCanvas } from './FigureCanvas'
import { textActionForKey } from './shortcuts'

const settle = () => new Promise((resolve) => setTimeout(resolve))
const sub = (start: number, end: number): ScriptRun => ({ start, end, style: { script: 'sub' } })

/** "−log10(p)" with 10 as subscript on the y axis, "λGC = 2.53" with GC as subscript as the name. */
const styled = (): ChartData => ({
  ...createChart('bar', 'sd'),
  yTitle: '−log10(p)',
  title: 'λGC = 2.53',
  textStyles: { yTitle: [sub(4, 6)], title: [sub(1, 3)] },
})

let figure: FigureCanvas | undefined
afterEach(async () => {
  await figure?.dispose()
  figure = undefined
})

function open(saved?: string): FigureCanvas {
  const element = document.createElement('canvas')
  document.body.append(element)
  figure = new FigureCanvas(element, { width: 1000, height: 800 }, saved)
  return figure
}

describe('sub- and superscript in chart text', () => {
  it('draws a chart saved with plain text exactly as before', () => {
    // A chart saved before chart text could be styled: no textStyles, no nameStyles.
    const old = JSON.parse(JSON.stringify(createChart('bar', 'sd'))) as ChartData
    expect(markChartScripts(old)).toBe(old)
    const svg = chartSvg(old).join('')
    expect(svg).not.toContain('<tspan')
    expect(svg).toContain('>Fold change</text>')
    expect(drawChart(old).texts.map((t) => t.text)).toEqual(drawChart(createChart('bar', 'sd')).texts.map((t) => t.text))
  })

  it('keeps a subscript through saving and opening the figure', async () => {
    const first = open()
    first.addChart(styled(), { x: 100, y: 100 })
    const saved = first.serialize()
    await first.dispose()
    const reopened = open(saved)
    await settle()
    const chart = reopened.canvas.getObjects().find((o): o is ChartObject => o instanceof ChartObject)
    expect(chart?.chart.yTitle).toBe('−log10(p)')
    expect(chart?.chart.textStyles).toEqual({ yTitle: [sub(4, 6)], title: [sub(1, 3)] })
  })

  it('measures sub- and superscripts smaller, so the layout gives them less room', () => {
    const measure = scriptMeasure(roughMeasure)
    const marked = markScripts('−log10(p)', [sub(4, 6)])
    expect(measure(marked, 10, 'Inter')).toBeLessThan(roughMeasure('−log10(p)', 10, 'Inter'))
    const title = (chart: ChartData) => drawChart(chart).texts.find((t) => t.role.kind === 'title')!
    expect(textBox(title(styled()), roughMeasure).width).toBeLessThan(textBox(title({ ...styled(), textStyles: undefined }), roughMeasure).width)
  })

  it('exports the subscript as a smaller tspan moved below the line, with tick numbers left plain', () => {
    const svg = chartSvg(styled()).join('')
    const run = /<tspan y="([\d.]+)" font-size="([\d.]+)" dy="([\d.]+)">10<\/tspan>/.exec(svg)
    expect(run).not.toBeNull()
    expect(Number(run![2])).toBeLessThan(styled().fontSize + 1)
    expect(Number(run![3])).toBeGreaterThan(0)
    expect(svg).toMatch(/<tspan y="[\d.]+">λ<\/tspan><tspan y="[\d.]+" font-size="[\d.]+" dy="[\d.]+">GC<\/tspan><tspan y="[\d.]+"> = 2.53<\/tspan>/)
    const ticks = drawChart(styled()).texts.filter((t) => t.role.kind === 'tick')
    expect(ticks.length).toBeGreaterThan(0)
    expect(ticks.every((t) => /^-?[\d.]+$/.test(t.text))).toBe(true)
  })

  it('makes selected letters of a chart label subscript with the Text tool shortcut while typing on the canvas', async () => {
    const canvas = open()
    const chart = canvas.addChart({ ...createChart('bar', 'sd'), title: 'λGC = 2.53' }, { x: 100, y: 100 })
    const title = chart.drawing().texts.find((t) => t.role.kind === 'title')!
    const box = textBox(title, measureText)
    const scenePoint = util.transformPoint(new Point(box.x + box.width / 2 - chart.width / 2, box.y + box.height / 2 - chart.height / 2), chart.calcTransformMatrix())
    canvas.canvas.fire('mouse:dblclick', { e: new MouseEvent('dblclick') as unknown as TPointerEvent, target: chart, scenePoint } as never)
    const typing = canvas.canvas.getActiveObject()
    expect(typing).toBeInstanceOf(IText)
    const text = typing as IText
    text.selectionStart = 1
    text.selectionEnd = 3
    // What the editor screen does on Ctrl+= while typing in text on the page.
    expect(textActionForKey({ key: '=', code: 'Equal', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false }, true)).toBe('subscript')
    expect(canvas.textStyle()?.script).toBe('none')
    await canvas.changeText({ script: 'sub' })
    canvas.finishTyping()
    await settle()
    expect(chart.chart.title).toBe('λGC = 2.53')
    expect(chart.chart.textStyles?.title).toEqual([sub(1, 3)])
    expect(canvas.canvas.getObjects()).toEqual([chart])
  })

  it('keeps subscripts on the right letters when the text is changed as plain text in a panel field', () => {
    const before = styled()
    const after = keepScripts(before, { ...before, yTitle: 'Signal −log10(p)' })
    expect(after.textStyles?.yTitle).toEqual([sub(11, 13)])
    expect(after.textStyles?.title).toEqual([sub(1, 3)])
  })
})
