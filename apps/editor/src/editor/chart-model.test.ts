import { describe, expect, it } from 'vitest'

import { renameChartText } from './chart-label-editor'
import { chartSizeForPage, chartSvg, createChart, drawChart, moveGroup, parseNumber, parsePasted, pasteInto, removeRow, setValue, errorBounds, stats, withDefaults, yAxis, yLabel, type ChartData } from './chart-model'

describe('pasting chart data', () => {
  it('reads a block from Excel or Google Sheets, with group names from the first row', () => {
    expect(parsePasted('Control\tDrug A\n1\t2,5\n1.5\t\n')).toEqual([
      { name: 'Control', values: [1, 1.5] },
      { name: 'Drug A', values: [2.5, null] },
    ])
  })

  it('reads decimal commas and leaves unreadable cells empty', () => {
    expect(parseNumber('1,25')).toBe(1.25)
    expect(parseNumber('1,250.5')).toBe(1250.5)
    expect(parseNumber('n/a')).toBeNull()
  })

  it('pastes numbers into the cell they land on, growing the table', () => {
    const chart = { ...createChart('bar', 'sd'), groups: [{ name: 'A', values: [1, 2] }] }
    const pasted = pasteInto(chart, '7\t8\n9\t10', { r: 1, c: 0 })
    expect(pasted.groups).toEqual([
      { name: 'A', values: [1, 7, 9] },
      { name: 'Group 2', values: [null, 8, 10] },
    ])
  })
})

describe('chart numbers', () => {
  it('works out the mean, SD and SEM', () => {
    const s = stats([2, 4, 4, 4, 5, 5, 7, 9, null])!
    expect(s.mean).toBe(5)
    expect(s.sd).toBeCloseTo(2.138, 3)
    expect(s.sem).toBeCloseTo(2.138 / Math.sqrt(8), 3)
  })

  it('starts a bar chart at zero and keeps a typed axis range', () => {
    const chart = createChart('bar', 'sd')
    expect(yAxis(chart).min).toBe(0)
    expect(yAxis({ ...chart, yMin: 0.5, yMax: 4 })).toMatchObject({ min: 0.5, max: 4 })
    expect(yLabel({ ...chart, yTitle: 'Concentration', yUnit: 'mM' })).toBe('Concentration (mM)')
  })

  it('follows typed values: a taller group gets a taller bar', () => {
    const before = drawChart(createChart('bar', 'none')).rects[0]!
    const after = drawChart(setValue(createChart('bar', 'none'), 0, 0, '9')).rects[0]!
    expect(after.height).toBeGreaterThan(before.height)
  })
})

describe('chart export', () => {
  it('writes plain vector shapes and text, not a picture', () => {
    const chart = { ...createChart('bar', 'sem'), legend: true, xTitle: 'Treatment' }
    const svg = chartSvg(chart).join('')
    expect(svg).not.toContain('<image')
    expect(svg.match(/<rect /g)).toHaveLength(chart.groups.length * 2) // bars, legend keys
    for (const text of ['Control', 'Drug A', 'Fold change', 'Treatment']) expect(svg).toContain(`>${text}</text>`)
  })

  it('draws the same after saving and loading', () => {
    const chart = { ...createChart('scatter', 'sd'), yUnit: 'µM', colours: ['#123456'] }
    const reloaded = JSON.parse(JSON.stringify(chart)) as typeof chart
    expect(chartSvg(reloaded)).toEqual(chartSvg(chart))
  })
})

describe('arranging a chart', () => {
  it('takes a row out of every group, the rows under it moving up', () => {
    const chart = createChart('bar', 'sd')
    const removed = removeRow(chart, 1)
    for (const [i, group] of removed.groups.entries()) {
      const before = chart.groups[i]?.values ?? []
      expect(group.values).toEqual([before[0], ...before.slice(2)])
    }
  })

  it('moves a group to another place, taking its colour along', () => {
    const chart = createChart('bar', 'sd')
    const moved = moveGroup(chart, 0, 2)
    expect(moved.groups.map((g) => g.name)).toEqual(['Drug A', 'Drug B', 'Control'])
    expect(moved.colours.slice(0, 3)).toEqual([chart.colours[1], chart.colours[2], chart.colours[0]])
  })

  it('renames a group or a title from the text double-clicked on the chart', () => {
    const chart = createChart('bar', 'sd')
    const texts = drawChart(chart).texts
    const label = texts.find((t) => t.text === 'Drug A')
    const yTitle = texts.find((t) => t.role.kind === 'yTitle')
    expect(label && renameChartText(chart, label, 'My drug')?.groups[1]?.name).toBe('My drug')
    expect(yTitle && renameChartText(chart, yTitle, 'Signal')?.yTitle).toBe('Signal')
  })

  it('draws the name, the line underneath and significance stars; wider gaps make narrower bars', () => {
    const chart: ChartData = { ...createChart('bar', 'sd'), title: 'Figure 1', caption: 'Primers: GAPDH', test: 'anova' }
    const texts = drawChart(chart).texts
    const title = texts.find((t) => t.role.kind === 'title')
    expect(title).toMatchObject({ text: 'Figure 1', bold: true })
    expect(texts.filter((t) => t.role.kind === 'caption').map((t) => t.text).join(' ')).toMatch(/Primers: GAPDH.*One-way ANOVA/)
    expect(texts.some((t) => t.role.kind === 'stats' && t.text.startsWith('*'))).toBe(true)
    const below = drawChart({ ...chart, titlePosition: 'bottom' }).texts.find((t) => t.role.kind === 'title')
    expect(below?.y).toBeGreaterThan(title?.y ?? Infinity)
    expect(drawChart({ ...chart, barWidth: 0.3 }).rects[0]?.width).toBeLessThan(drawChart(chart).rects[0]?.width ?? 0)
  })

  it('opens charts saved before these settings existed', () => {
    const old: Partial<ChartData> = { ...createChart('bar', 'sd') }
    delete old.title
    delete old.test
    delete old.barWidth
    expect(withDefaults(old as ChartData)).toMatchObject({ title: '', test: 'none', barWidth: 0.6 })
  })
})

describe('chart text and error bars', () => {
  it('gives a new chart a left-aligned name', () => {
    expect(createChart('bar', 'sd', undefined, 'Chart 2')).toMatchObject({ title: 'Chart 2', titleAlign: 'left' })
  })

  it('aligns the text under the chart', () => {
    const chart: ChartData = { ...createChart('bar', 'sd'), caption: 'Primers', captionAlign: 'right' }
    expect(drawChart(chart).texts.find((t) => t.role.kind === 'caption')).toMatchObject({ x: chart.width, anchor: 'end' })
  })

  it('runs a bar chart error bar down into the bar only when asked', () => {
    const lowest = (chart: ChartData) => {
      const d = drawChart(chart)
      // Upright lines right of the y axis: the error bars.
      return Math.max(...d.lines.filter((l) => l.x1 === l.x2 && l.x1 > d.plot.left + 1).map((l) => Math.max(l.y1, l.y2)))
    }
    const chart = createChart('bar', 'sd')
    expect(lowest({ ...chart, errorInside: true })).toBeGreaterThan(lowest(chart))
  })
})

describe('significance brackets', () => {
  it("draws black brackets with a dot in each compared group's colour at the feet", () => {
    const chart: ChartData = { ...createChart('bar', 'sd'), test: 'anova', showNs: true }
    const feet = (c: ChartData) => drawChart(c).dots.filter((dot) => dot.stroke).map((dot) => dot.fill)
    expect(feet(chart)).toEqual(expect.arrayContaining([chart.colours[0], chart.colours[1]]))
    expect(feet({ ...chart, colouredBrackets: false })).toEqual([])
  })
})

describe('chart size for the page', () => {
  const mm = (value: number) => (value * 96) / 25.4

  it('keeps the 85 mm default on a double-column page', () => {
    expect(chartSizeForPage({ width: mm(174), height: mm(120) })).toEqual({ width: 320, height: 240 })
  })

  it('starts at half the page width on a single-column page, so it fits on the page', () => {
    const page = { width: mm(85), height: mm(60) }
    const size = chartSizeForPage(page)
    expect(size.width).toBeCloseTo(page.width / 2)
    expect(size.height).toBeCloseTo((size.width * 3) / 4)
    expect(size.height).toBeLessThan(page.height)
  })

  it('stays inside a short, wide page', () => {
    const page = { width: mm(174), height: mm(40) }
    expect(chartSizeForPage(page).height).toBeLessThanOrEqual(page.height * 0.8)
  })
})

describe('graph types', () => {
  const upright = ['bar', 'line', 'scatter', 'point', 'slope', 'dots-bars', 'before-after', 'dots-spread', 'dots-box', 'dots-violin', 'floating', 'box', 'violin'] as const
  const kinds = [...upright, 'bar-h', 'point-h', 'floating-h', 'box-h', 'violin-h'] as const

  it('draws every graph type with a column for each group and no broken numbers', () => {
    for (const kind of kinds) {
      const d = drawChart(createChart(kind, 'sd'))
      expect(d.columns.filter(Boolean), kind).toHaveLength(3)
      const numbers = [...d.rects.flatMap((r) => [r.x, r.y, r.width, r.height]), ...d.dots.flatMap((p) => [p.x, p.y]), ...d.polygons.flatMap((g) => g.points.flatMap((p) => [p.x, p.y]))]
      expect(numbers.every(Number.isFinite), kind).toBe(true)
      expect(chartSvg(createChart(kind, 'sd')).join(''), kind).not.toContain('NaN')
    }
  })

  it('draws a box from the lower to the upper quartile, whatever the error bars say', () => {
    const chart = { ...createChart('box', 'sd'), groups: [{ name: 'A', values: [1, 2, 3, 4, 5] }] }
    const box = drawChart(chart).rects[0]!
    const axis = drawChart({ ...chart, yMin: 0, yMax: 6 })
    const unit = axis.plot.height / 6
    expect(drawChart({ ...chart, yMin: 0, yMax: 6 }).rects[0]!.height).toBeCloseTo(2 * unit, 5) // quartiles 2 and 4
    expect(drawChart({ ...chart, errorBars: 'none' }).lines).toEqual(drawChart(chart).lines)
    expect(box.height).toBeGreaterThan(0)
  })

  it('joins each row across the groups in before-after', () => {
    const chart = { ...createChart('before-after', 'none'), groups: [{ name: 'Before', values: [1, 2, 3] }, { name: 'After', values: [2, null, 5] }] }
    const d = drawChart(chart)
    expect(d.polylines).toHaveLength(2) // the row with a gap has nothing to join
    expect(d.dots).toHaveLength(5)
  })

  it('shows a violin as a closed outline, and bars start at zero with dots over them', () => {
    expect(drawChart(createChart('violin', 'none')).polygons).toHaveLength(3)
    expect(chartSvg(createChart('violin', 'none')).join('')).toContain('<polygon ')
    expect(yAxis(createChart('dots-bars', 'sd')).min).toBe(0)
    expect(yAxis(createChart('box', 'sd')).min).toBeGreaterThanOrEqual(0)
  })

  it('keeps the dots of a spread plot apart', () => {
    const d = drawChart({ ...createChart('dots-spread', 'none'), groups: [{ name: 'A', values: [1, 1, 1, 1.01, 1.02, 0.99] }], width: 400, height: 300 })
    for (const [i, a] of d.dots.entries()) for (const b of d.dots.slice(i + 1)) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(2 * a.r - 0.01)
  })

  it('turns a lying-down graph on its side: groups run down the left, values along the bottom', () => {
    const upright = drawChart({ ...createChart('bar', 'none'), yMin: 0, yMax: 3 })
    const lying = drawChart({ ...createChart('bar-h', 'none'), yMin: 0, yMax: 3 })
    expect(lying.horizontal).toBe(true)
    expect(upright.horizontal).toBe(false)
    // Bars grow rightwards from the axis; the taller group's bar is the longer one.
    const bars = lying.rects.slice(0, 3)
    expect(bars.every((b) => b.x === lying.plot.left)).toBe(true)
    expect(bars[1]!.width).toBeGreaterThan(bars[0]!.width)
    // The first group is at the top, and the bars stack down the plot.
    expect(bars[0]!.y).toBeLessThan(bars[1]!.y)
    expect(bars[2]!.y + bars[2]!.height).toBeLessThanOrEqual(lying.plot.top + lying.plot.height)
    // Group names sit left of the axis, the numbers under it.
    const names = lying.texts.filter((t) => t.role.kind === 'group')
    expect(names.every((t) => t.anchor === 'end' && t.x < lying.plot.left)).toBe(true)
    expect(lying.texts.filter((t) => t.role.kind === 'tick').every((t) => t.y > lying.plot.top + lying.plot.height)).toBe(true)
    // The group axis title is turned along the left side; the y title runs along the bottom.
    const lyingTitled = drawChart({ ...createChart('bar-h', 'none'), xTitle: 'Treatment' })
    expect(lyingTitled.texts.find((t) => t.role.kind === 'xTitle')).toMatchObject({ rotate: true })
    expect(lyingTitled.texts.find((t) => t.role.kind === 'yTitle')?.rotate).toBeFalsy()
  })

  it('puts significance brackets to the right of a lying-down graph', () => {
    const chart = { ...createChart('bar-h', 'sd'), groups: [{ name: 'A', values: [1, 1.1, 0.9, 1] }, { name: 'B', values: [5, 5.2, 4.9, 5.1] }], test: 'ttest' as const }
    const d = drawChart(chart)
    const stars = d.texts.find((t) => t.role.kind === 'stats')!
    expect(stars.x).toBeGreaterThan(d.plot.left + d.plot.width)
    expect(stars.x).toBeLessThan(chart.width)
  })

  it('draws a slope with open markers', () => {
    const d = drawChart(createChart('slope', 'sd'))
    expect(d.polylines).toHaveLength(1)
    expect(d.dots.filter((dot) => dot.fill === '#ffffff' && dot.stroke)).toHaveLength(3)
  })
})

describe('error bar whiskers', () => {
  const values = [2, 4, 4, 4, 5, 5, 7, 9]
  const bounds = (errorBars: ChartData['errorBars']) => {
    const chart = { ...createChart('point', errorBars), groups: [{ name: 'A', values }] }
    return errorBounds(chart, values, stats(values)!)
  }

  it('keeps SD and SEM centred on the mean', () => {
    const s = stats(values)!
    expect(bounds('sd')).toEqual({ low: s.mean - s.sd, high: s.mean + s.sd })
    expect(bounds('sem')).toEqual({ low: s.mean - s.sem, high: s.mean + s.sem })
  })

  it('makes a confidence interval from the t quantile, wider at 99% than 95%', () => {
    const s = stats(values)!
    const ci95 = bounds('ci95')!
    expect(ci95.high - s.mean).toBeCloseTo(2.365 * s.sem, 2) // t(0.975, 7 df) = 2.365
    expect(bounds('ci99')!.high).toBeGreaterThan(ci95.high)
    expect(bounds('ci90')!.high).toBeLessThan(ci95.high)
  })

  it('runs range and IQR from real values, uneven around the mean', () => {
    expect(bounds('range')).toEqual({ low: 2, high: 9 })
    expect(bounds('iqr')).toEqual({ low: 4, high: 5.5 })
  })

  it('centres MAD on the median and draws nothing for None', () => {
    expect(bounds('mad')).toEqual({ low: 4, high: 5 }) // median 4.5, and the median of the distances from it is 0.5
    expect(bounds('none')).toBeUndefined()
  })

  it('draws no whisker for one replicate and keeps old saved values working', () => {
    const one = { ...createChart('point', 'ci95'), groups: [{ name: 'A', values: [3] }] }
    expect(drawChart(one).lines.length).toBe(drawChart({ ...one, errorBars: 'none' }).lines.length)
    const old = { ...createChart('point', 'sem'), groups: [{ name: 'A', values }] }
    expect(drawChart(old).lines.length).toBeGreaterThan(drawChart({ ...old, errorBars: 'none' }).lines.length)
  })
})
