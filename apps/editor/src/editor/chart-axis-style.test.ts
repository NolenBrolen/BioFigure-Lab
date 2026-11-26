import { describe, expect, it } from 'vitest'

import { framePatch, hiddenOnLog, logTicks, tickFormatter } from './chart-axis-style'
import { chartSvg, createChart, drawChart, withDefaults, yAxis, type ChartData } from './chart-model'

const bars = (values: number[][], patch: Partial<ChartData> = {}): ChartData => ({
  ...createChart('bar', 'none'),
  groups: values.map((v, i) => ({ name: `G${i + 1}`, values: v })),
  ...patch,
})

describe('chart frame, grid and log scale', () => {
  it('puts log ticks at powers of 10, with 2 and 5 between on a short range, and writes wide ranges as powers', () => {
    expect(logTicks(1, 100)).toEqual([1, 2, 5, 10, 20, 50, 100])
    expect(logTicks(0.01, 1000)).toEqual([0.01, 0.1, 1, 10, 100, 1000])
    expect(tickFormatter([0.01, 0.1, 1, 10], true)(0.01)).toBe('0.01')
    const wide = tickFormatter([1e-6, 1e-3, 1, 1e3], true)
    expect([wide(1e-6), wide(1000)]).toEqual(['10⁻⁶', '10³'])
    const chart = bars([[3, 4], [300, 400]], { yScale: 'log' })
    expect(yAxis(chart)).toMatchObject({ min: 1, max: 1000 })
  })

  it('leaves out values at or below 0 on a log axis without failing, and bars grow from the axis bottom', () => {
    const chart = bars([[0, -2, 10], [5, 50]], { kind: 'dots-bars', yScale: 'log' })
    expect(hiddenOnLog(chart)).toBe(2)
    const d = drawChart(chart)
    // Only the three positive values become dots; nothing is NaN.
    expect(d.dots).toHaveLength(3)
    expect(chartSvg(chart).join('')).not.toContain('NaN')
    const bottom = d.plot.top + d.plot.height
    for (const r of d.rects.slice(0, 2)) expect(r.y + r.height).toBeCloseTo(bottom, 5)
  })

  it('stretches the auto range to take in reference lines', () => {
    const chart = bars([[1, 2], [2, 3]])
    expect(yAxis(chart).max).toBeLessThan(10)
    const withLine = { ...chart, referenceLines: [{ value: 10, style: 'dashed' as const, label: 'Cut-off' }] }
    expect(yAxis(withLine).max).toBeGreaterThanOrEqual(10)
    const d = drawChart(withLine)
    const ref = d.lines.find((l) => l.dash && l.y1 === l.y2 && l.x2 - l.x1 === d.plot.width)
    expect(ref).toBeDefined()
    expect(d.texts.find((t) => t.role.kind === 'reference')?.text).toBe('Cut-off')
  })

  it('draws a box frame on all four sides of the plot, and no axis lines with no frame', () => {
    const chart = bars([[1, 2], [3, 4]], { tickLabels: false })
    const { plot } = drawChart(chart)
    const edges = (c: ChartData) => {
      const d = drawChart(c)
      const full = (l: { x1: number; y1: number; x2: number; y2: number }) => Math.abs(l.x2 - l.x1) === plot.width || Math.abs(l.y2 - l.y1) === plot.height
      return d.lines.filter(full).length
    }
    expect(edges(chart)).toBe(2)
    expect(edges({ ...chart, frame: 'box' })).toBe(4)
    expect(edges({ ...chart, frame: 'none' })).toBe(0)
  })

  it('draws grid lines behind the data, across the value axis, also on a lying graph', () => {
    const upright = bars([[1, 2], [3, 4]], { grid: 'lines', gridStyle: 'dotted' })
    const d = drawChart(upright)
    expect(d.gridLines.length).toBeGreaterThan(0)
    expect(d.gridLines.every((l) => l.y1 === l.y2 && l.dash)).toBe(true)
    // In the export the grid comes before the bars, so the bars cover it.
    const svg = chartSvg(upright).join('')
    expect(svg.indexOf('stroke-dasharray')).toBeLessThan(svg.indexOf('<rect'))
    const lying = drawChart({ ...upright, kind: 'bar-h' })
    expect(lying.gridLines.length).toBeGreaterThan(0)
    expect(lying.gridLines.every((l) => l.x1 === l.x2)).toBe(true)
  })

  it('turns the ticks inward when Box is picked, and they can go back out and stay out', () => {
    let chart: ChartData = { ...bars([[1, 2], [3, 4]]), ...framePatch('box') }
    expect(chart).toMatchObject({ frame: 'box', ticks: 'in' })
    chart = { ...chart, ticks: 'out' }
    // Other changes, and picking Open or None, leave the ticks where the user put them.
    chart = { ...chart, grid: 'lines', ...framePatch('none') }
    expect(chart.ticks).toBe('out')
    expect({ ...chart, ...framePatch('open') }.ticks).toBe('out')
    // The plot draws them inward: the tick on the left axis reaches into the plot.
    const d = drawChart({ ...bars([[1, 2], [3, 4]]), ...framePatch('box') })
    expect(d.lines.some((l) => l.y1 === l.y2 && Math.min(l.x1, l.x2) === d.plot.left && Math.max(l.x1, l.x2) === d.plot.left + 4)).toBe(true)
  })

  it('loads a chart saved before these settings with today’s look', () => {
    const { frame, grid, gridStyle, gridColour, ticks, yScale, referenceLines, ...old } = createChart('bar', 'sd')
    void [frame, grid, gridStyle, gridColour, ticks, yScale, referenceLines]
    const loaded = withDefaults(old as ChartData)
    expect(loaded).toMatchObject({ frame: 'open', grid: 'none', ticks: 'out', yScale: 'linear', referenceLines: [] })
    expect(chartSvg(old as ChartData)).toEqual(chartSvg(createChart('bar', 'sd')))
    expect(drawChart(old as ChartData).gridLines).toEqual([])
  })
})
