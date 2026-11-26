import { describe, expect, it } from 'vitest'

import { chartSvg, createChart, drawChart, type ChartData } from './chart-model'
import { hiddenOnXyLog, tableColours, xyAxes, xySeries, type XySettings } from './chart-xy'

const xy = (patch: Partial<ChartData> = {}, settings: Partial<XySettings> = {}): ChartData => {
  const chart = createChart('xy', 'none', { width: 360, height: 260 }, '')
  return { ...chart, ...patch, xy: { ...chart.xy!, ...settings } }
}
const groups = (x: (number | null)[], ...ys: (number | null)[][]) => [{ name: 'X', values: x }, ...ys.map((values, i) => ({ name: `Y${i + 1}`, values }))]

describe('XY charts', () => {
  it('places each dot at its real x: the first column is x, every other column a series', () => {
    const chart = xy({ groups: groups([0, 1, 10], [5, 5, 5]), legend: false })
    const d = drawChart(chart)
    expect(d.dots).toHaveLength(3)
    const [a, b, c] = d.dots.map((dot) => dot.x)
    // 1 is a tenth of the way from 0 to 10, not a third as on a group chart.
    expect((b! - a!) / (c! - a!)).toBeCloseTo(0.1, 5)
    expect(xySeries(chart).map((s) => s.name)).toEqual(['Y1'])
    expect(tableColours(chart)[0]).not.toBe(tableColours(chart)[1])
  })

  it('leaves out points a log axis cannot show, and says how many', () => {
    const chart = xy({ groups: groups([0, 1, 10, 100], [2, 3, -1, 4]), yScale: 'log' }, { xScale: 'log' })
    expect(xySeries(chart)[0]!.points.map((p) => p.x)).toEqual([1, 100])
    expect(hiddenOnXyLog(chart)).toBe(2)
    expect(xyAxes(chart).x).toMatchObject({ min: 1, max: 100, log: true })
    expect(chartSvg(chart).join('')).not.toContain('NaN')
  })

  it('draws the grid both ways, while group charts keep only lines across', () => {
    const standing = (lines: { x1: number; x2: number }[]) => lines.filter((l) => l.x1 === l.x2).length
    expect(standing(drawChart(xy({ grid: 'lines' })).gridLines)).toBeGreaterThan(0)
    expect(standing(drawChart({ ...createChart('bar', 'sd'), grid: 'lines' }).gridLines)).toBe(0)
  })

  it('draws a dashed y = x line where both axes reach', () => {
    const chart = xy({ groups: groups([0, 5, 10], [0, 5, 10]), yMin: 0, yMax: 10 }, { identityLine: true, xMin: 0, xMax: 10 })
    const line = drawChart(chart).polylines.find((p) => p.dash)
    expect(line?.points).toHaveLength(2)
    const dots = drawChart(chart).dots.slice(0, 3)
    // The line runs through points where y equals x.
    expect(line!.points[0]).toMatchObject({ x: dots[0]!.x, y: dots[0]!.y })
    expect(line!.points[1]!.x).toBeCloseTo(dots[2]!.x, 5)
    expect(line!.points[1]!.y).toBeCloseTo(dots[2]!.y, 5)
  })

  it('colours dots by a third column, which is then not drawn as a series, with a colour bar', () => {
    const chart = xy({ groups: groups([1, 2, 3], [4, 5, 6], [0, 50, 100]), legend: false }, { colourBy: 2 })
    const d = drawChart(chart)
    expect(d.dots).toHaveLength(3)
    expect(new Set(d.dots.map((dot) => dot.fill)).size).toBe(3)
    // The bar's title is the column's name, and renames it on a double-click.
    expect(d.texts.find((t) => t.rotate && t.text === 'Y2')?.role).toEqual({ kind: 'group', index: 2 })
  })

  it('exports open and shaped dots as they are drawn', () => {
    const chart = xy({ groups: groups([1, 2], [3, 4]), legend: false }, { markers: [{ shape: 'square', filled: false }] })
    const d = drawChart(chart)
    expect(d.dots.every((dot) => dot.shape === 'square' && dot.fill === '#ffffff' && dot.stroke)).toBe(true)
    const svg = chartSvg(chart).join('')
    expect(svg.match(/<polygon points="[^"]+" fill="#ffffff" stroke="#[0-9A-Fa-f]{6}"/g)).toHaveLength(2)
    expect(svg).not.toContain('<circle')
  })
})
