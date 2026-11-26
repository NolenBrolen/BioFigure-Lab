import { describe, expect, it } from 'vitest'

import { colourScale, EMPTY_FILL, textColourOn } from './chart-colour-scale'
import { correlationMatrix, parseMatrix, pasteHeatmap, pearson, spearman } from './chart-heatmap'
import { createChart, drawChart, type ChartData } from './chart-model'

const heatmap = (patch: Partial<ChartData> = {}): ChartData => ({ ...createChart('heatmap', 'sd', { width: 320, height: 240 }, ''), ...patch })

describe('heatmap correlations', () => {
  it('match known Pearson and Spearman values, ties sharing their rank', () => {
    // r = 6 / √60; ρ (y has ties: 4, 4 and 5, 5) = 7 / √90.
    expect(pearson([1, 2, 3, 4, 5], [2, 4, 5, 4, 5])).toBeCloseTo(0.7745966692, 9)
    expect(spearman([1, 2, 3, 4, 5], [2, 4, 5, 4, 5])).toBeCloseTo(0.7378647874, 9)
    expect(pearson([1, 2, 3], [6, 4, 2])).toBeCloseTo(-1, 12)
    // Spearman only sees the order: any rising curve is 1.
    expect(spearman([1, 2, 3, 4], [1, 8, 27, 64])).toBeCloseTo(1, 12)
    // No spread, or under two pairs: nothing to say.
    expect(pearson([1, 2, 3], [5, 5, 5])).toBeNull()
    expect(pearson([1, null, 3], [null, 2, 7])).toBeNull()
  })

  it('makes a symmetric matrix with 1 on the diagonal, using only the rows both columns have', () => {
    const m = correlationMatrix([[1, 2, 3, 4, null], [2, 4, 6, 8, 100], [4, 3, 2, 1, 0]], 'pearson')
    expect(m.map((row) => row.map((v) => (v === null ? null : Number(v.toFixed(6)))))).toEqual([
      [1, 1, -1],
      [1, 1, -0.743294],
      [-1, -0.743294, 1],
    ])
  })
})

describe('colour scale', () => {
  it('puts the scale’s end colours at the range’s ends and the white middle at the centre', () => {
    const viridis = colourScale({ scale: 'viridis', min: null, max: null }, [3, 7, 5])
    expect([viridis.min, viridis.max]).toEqual([3, 7])
    expect(viridis.colour(3)).toBe('#440154')
    expect(viridis.colour(7)).toBe('#fde725')
    expect(viridis.colour(99)).toBe('#fde725')
    const two = colourScale({ scale: 'blue-red', min: -1, max: 1 }, [])
    expect(two.colour(-1)).toBe('#2166ac')
    expect(two.colour(0)).toBe('#f7f7f7')
    expect(two.colour(1)).toBe('#b2182b')
    expect(two.colour(null)).toBe(EMPTY_FILL)
  })

  it('keeps a two-sided range symmetric round its centre unless told not to', () => {
    expect(colourScale({ scale: 'blue-red', min: null, max: null }, [-0.2, 0.8])).toMatchObject({ min: -0.8, max: 0.8, centre: 0 })
    expect(colourScale({ scale: 'blue-red', min: -0.5, max: 1 }, [])).toMatchObject({ min: -1, max: 1 })
    expect(colourScale({ scale: 'blue-red', min: null, max: null, centre: 1 }, [0, 4])).toMatchObject({ min: -2, max: 4 })
    // Not symmetric: each side stretches to its own end, and the centre still gets the middle colour.
    const lopsided = colourScale({ scale: 'blue-red', min: -0.2, max: 0.8, symmetric: false }, [])
    expect([lopsided.min, lopsided.max]).toEqual([-0.2, 0.8])
    expect(lopsided.colour(0)).toBe('#f7f7f7')
    expect(lopsided.colour(-0.2)).toBe('#2166ac')
  })
})

describe('drawing a heatmap', () => {
  it('prints values in white or black, whichever reads better on the cell, and leaves empty cells blank and grey', () => {
    expect(textColourOn('#440154')).toBe('#ffffff')
    expect(textColourOn('#fde725')).toBe('#000000')
    const chart = heatmap({
      groups: [
        { name: 'A', values: [0, 10] },
        { name: 'B', values: [null, 5] },
      ],
      rowNames: ['x', 'y'],
      heatmap: { ...heatmap().heatmap!, cellValues: true, decimals: 1 },
    })
    const d = drawChart(chart)
    const cells = d.rects.slice(0, 4)
    expect(cells.map((r) => r.fill)).toEqual(['#440154', EMPTY_FILL, '#fde725', '#21918c'])
    const printed = d.texts.filter((t) => /^\d+\.\d$/.test(t.text))
    expect(printed.map((t) => [t.text, t.colour])).toEqual([
      ['0.0', '#ffffff'],
      ['10.0', '#000000'],
      ['5.0', '#000000'],
    ])
    // Row names on the left, column names under the grid.
    expect(d.texts.filter((t) => t.anchor === 'end').map((t) => t.text)).toEqual(['x', 'y'])
    expect(d.texts.filter((t) => t.role.kind === 'group').map((t) => t.text)).toEqual(['A', 'B'])
  })

  it('draws a correlation matrix with its colour bar titled', () => {
    const chart = heatmap({ heatmap: { ...heatmap().heatmap!, values: 'pearson', scale: 'blue-red', barTitle: 'Pearson r' } })
    const d = drawChart(chart)
    // Four columns: a 4 × 4 grid, the diagonal the deepest red.
    expect(d.rects[0]?.fill).toBe('#b2182b')
    expect(d.rects[5]?.fill).toBe('#b2182b')
    const ticks = d.texts.filter((t) => t.role.kind === 'tick').map((t) => t.text)
    expect(ticks).toEqual(expect.arrayContaining(['-1', '0', '1']))
    expect(d.texts.find((t) => t.text === 'Pearson r')?.rotate).toBe(true)
  })
})

describe('heatmap data', () => {
  it('reads a pasted block with column names along the top and row names down the side', () => {
    const block = 'Gene\tS1\tS2\nTP53\t1,5\t2\nMYC\t\t-3\n'
    expect(parseMatrix(block)).toEqual({
      groups: [
        { name: 'S1', values: [1.5, null] },
        { name: 'S2', values: [2, -3] },
      ],
      rowNames: ['TP53', 'MYC'],
      header: true,
    })
    const pasted = pasteHeatmap(heatmap(), block, { r: 0, c: 0 })
    expect(pasted.rowNames).toEqual(['TP53', 'MYC'])
    expect(pasted.groups.map((g) => g.name)).toEqual(['S1', 'S2'])
  })

  it('leaves other kinds of chart as they were', () => {
    const bar = createChart('bar', 'sd')
    expect(bar).not.toHaveProperty('rowNames')
    expect(bar).not.toHaveProperty('heatmap')
    const d = drawChart(bar)
    expect(d.columns).toHaveLength(3)
    expect(d.rects).toHaveLength(3)
    // A plain block pasted into a heatmap still fills cells as in any chart.
    expect(pasteHeatmap(heatmap(), '1\t2', { r: 1, c: 1 }).groups[1]?.values[1]).toBe(1)
  })
})
