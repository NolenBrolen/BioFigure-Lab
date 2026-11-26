import { describe, expect, it } from 'vitest'

import { addLineRow, pasteIntoLine, setLineValue } from './chart-combo'
import { createChart, drawChart, moveGroup, removeGroup, yAxis, type ChartData } from './chart-model'

const combo = (patch: Partial<ChartData> = {}): ChartData => ({ ...createChart('bar-line', 'sd'), ...patch })
const textsOf = (chart: ChartData, role: string) => drawChart(chart).texts.filter((t) => t.role.kind === role).map((t) => t.text)

describe('bar + line charts', () => {
  it('draws bars and a line through each group, with the line on its own axis on the right', () => {
    const chart = combo()
    const d = drawChart(chart)
    expect(d.rects.length).toBeGreaterThanOrEqual(3)
    // One line through the three groups' means, a marker on each.
    expect(d.polylines).toHaveLength(1)
    expect(d.polylines[0]?.points).toHaveLength(3)
    expect(textsOf(chart, 'lineTitle')).toEqual(['Viability (%)'])
    // The line's points sit right of the plot's left edge and inside it.
    for (const p of d.polylines[0]?.points ?? []) {
      expect(p.x).toBeGreaterThan(d.plot.left)
      expect(p.y).toBeGreaterThanOrEqual(d.plot.top)
      expect(p.y).toBeLessThanOrEqual(d.plot.top + d.plot.height)
    }
  })

  it('shares the bars’ axis when the right axis is off, which then reaches the line’s values', () => {
    const chart = combo()
    const shared = { ...chart, combo: { ...chart.combo!, rightAxis: false } }
    expect(yAxis(chart).max).toBeLessThan(10)
    expect(yAxis(shared).max).toBeGreaterThanOrEqual(97)
    expect(textsOf(shared, 'lineTitle')).toEqual([])
  })

  it('shows no empty right axis while the line has no numbers (a bar chart just turned into a bar + line)', () => {
    const bar = createChart('bar', 'sd')
    const turned: ChartData = { ...bar, kind: 'bar-line' }
    const d = drawChart(turned)
    expect(d.polylines).toHaveLength(0)
    expect(textsOf(turned, 'lineTitle')).toEqual([])
  })

  it('names the bars by their axis and the line by its title in the legend', () => {
    expect(textsOf(combo({ legend: true }), 'legend')).toEqual(['Fold change', 'Viability'])
    // Bars in several colours keep one entry per group.
    expect(textsOf(combo({ legend: true, colours: ['#0072B2', '#E69F00', '#009E73'] }), 'legend')).toEqual(['Control', 'Drug A', 'Drug B', 'Viability'])
  })

  it('keeps each group’s line values with it when typing, pasting, adding rows, moving and removing groups', () => {
    let chart = setLineValue(combo(), 1, 5, 42)
    expect(chart.groups[1]?.line).toEqual([80, 84, 81, 83, null, 42])
    chart = addLineRow(chart)
    expect(chart.groups.map((g) => g.line?.length)).toEqual([7, 7, 7])
    chart = pasteIntoLine(chart, [[1, 2, 3, 4]], { r: 0, c: 1 })
    // The block fills Drug A and Drug B; the column past the last group is left out.
    expect(chart.groups.map((g) => g.line?.[0])).toEqual([96, 1, 2])
    chart = moveGroup(chart, 0, 2)
    expect(chart.groups.map((g) => [g.name, g.line?.[0]])).toEqual([['Drug A', 1], ['Drug B', 2], ['Control', 96]])
    chart = removeGroup(chart, 0)
    expect(chart.groups.map((g) => g.line?.[0])).toEqual([2, 96])
  })
})
