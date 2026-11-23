import { describe, expect, it } from 'vitest'

import { adjust, dunnettWithin, formatP, mannWhitney, oneWayAnova, pairedT, runTest, shapiroWilk, stars, tTest, welch, wilcoxonSignedRank } from './chart-stats'

const twoSidedTForTen = 0.0734 // R: 2 * pt(-2, 10)

describe('two-group tests match R', () => {
  it("Welch's and Student's t-test", () => {
    // R: t.test(1:5, c(2,4,6,8,10)) p = 0.1075; with var.equal = TRUE p = 0.0943
    expect(welch([1, 2, 3, 4, 5], [2, 4, 6, 8, 10])).toBeCloseTo(0.1075, 3)
    expect(tTest([1, 2, 3, 4, 5], [2, 4, 6, 8, 10], false)).toBeCloseTo(0.0943, 3)
  })

  it('paired t-test', () => {
    // Differences 1, 2, 2, 0, 2: t = 3.5 with 4 df, p = 0.0249
    expect(pairedT([1, 2, 2, 0, 2])).toBeCloseTo(0.0249, 3)
  })

  it('Mann-Whitney U and Wilcoxon signed-rank, exact for small groups', () => {
    // R: wilcox.test(1:5, 6:10) p = 2/252; wilcox.test(1:5) p = 2/32
    expect(mannWhitney([1, 2, 3, 4, 5], [6, 7, 8, 9, 10])).toBeCloseTo(2 / 252, 6)
    expect(wilcoxonSignedRank([1, 2, 3, 4, 5])).toBeCloseTo(2 / 32, 6)
  })
})

describe('tests for three or more groups', () => {
  const steps = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
  ]

  it('works out a one-way ANOVA', () => {
    // Between: 3 × ((2-5)² + 0 + (8-5)²) = 54 over 2 df; within: 6 over 6 df; F = 27.
    expect(oneWayAnova(steps)).toMatchObject({ f: 27, df1: 2, df2: 6 })
    // With 2 and 6 df, p = (1 + 27 × 2/6)^-3 = 0.001 exactly.
    expect(oneWayAnova(steps)?.p).toBeCloseTo(0.001, 9)
  })

  it("compares every pair with Tukey's test", () => {
    const groups = [
      [1, 1.2, 0.9, 1.1],
      [2.1, 2.5, 1.8, 2.3],
      [1.0, 1.1, 1.2, 0.9],
    ]
    const anova = runTest('anova', groups)
    expect(anova?.comparisons.map((c) => [c.a, c.b])).toEqual([[0, 1], [0, 2], [1, 2]])
    expect(anova?.comparisons[0]?.p).toBeLessThan(0.001)
    expect(anova?.comparisons[1]?.p).toBeGreaterThan(0.5)
    expect(anova?.note).toMatch(/^One-way ANOVA, F\(2, 9\) = .*Tukey/)
  })

  it("matches Dunnett's published critical values, and a plain t-test for one comparison", () => {
    // Dunnett's table, two-sided 5 %, infinite df: 2.21 for 2 comparisons, 2.35 for 3.
    expect(dunnettWithin(2.212, [Math.SQRT1_2, Math.SQRT1_2], Infinity)).toBeCloseTo(0.95, 2)
    expect(dunnettWithin(2.349, [Math.SQRT1_2, Math.SQRT1_2, Math.SQRT1_2], Infinity)).toBeCloseTo(0.95, 2)
    expect(1 - dunnettWithin(2, [Math.SQRT1_2], 10)).toBeCloseTo(twoSidedTForTen, 3)
    expect(runTest('control', steps)?.comparisons.map((c) => [c.a, c.b])).toEqual([[0, 1], [0, 2]])
  })

  it('Kruskal-Wallis and Friedman', () => {
    // Ranks 1–9 in three groups: H = 7.2, p = e^(-3.6)
    expect(runTest('kruskal', steps)?.note).toMatch(/H\(2\) = 7.2, p = 0.027/)
    // Four samples, each rising across three groups: χ² = 8, p = e^(-4)
    const rising = [
      [1, 2, 3, 4],
      [2, 3, 4, 5],
      [3, 4, 5, 7],
    ]
    expect(runTest('friedman', rising)?.note).toMatch(/χ²\(2\) = 8, p = 0.018/)
  })

  it("runs Welch's ANOVA, repeated-measures ANOVA and the trend test", () => {
    expect(runTest('welchanova', [[1, 2, 3.5], [4, 5.5, 6], [7, 8, 9.5]])?.comparisons).toHaveLength(3)
    const rm = runTest('rmanova', [[1, 2, 3, 4], [2, 3.2, 4.1, 5], [3, 4.1, 5.3, 7]])
    expect(rm?.comparisons).toHaveLength(3)
    expect(rm?.note).toMatch(/^Repeated-measures ANOVA \(4 samples\)/)
    expect(runTest('trend', steps)?.note).toMatch(/rising/)
  })
})

describe('trends, one-sample tests and checks', () => {
  it('correlates and fits a line, using numeric group names as x', () => {
    const groups = [[2, 2], [4, 4], [6, 6]]
    expect(runTest('pearson', groups, { names: ['0', '1', '2'] })?.note).toMatch(/r = 1,/)
    expect(runTest('regression', groups, { names: ['0', '1', '2'] })?.note).toMatch(/y = 2x \+ 2, R² = 1/)
  })

  it('tests each group against a value, with stars over the group', () => {
    const result = runTest('onesample', [[1.9, 2.1, 2.0, 2.2]], { value: 1 })
    expect(result?.comparisons).toEqual([{ a: 0, b: 0, p: expect.any(Number) as number }])
    expect(result?.comparisons[0]?.p).toBeLessThan(0.001)
    expect(result?.note).toBe('One-sample t-test against 1.')
  })

  it("matches R's Shapiro-Wilk", () => {
    // R: shapiro.test(1:10) W = 0.97016, p = 0.8924
    const result = shapiroWilk([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(result?.w).toBeCloseTo(0.9702, 3)
    expect(result?.p).toBeCloseTo(0.8924, 2)
  })
})

describe('multiple comparisons and how p is shown', () => {
  it("adjusts p values as R's p.adjust does", () => {
    expect(adjust([0.01, 0.04, 0.03], 'holm')).toEqual([0.03, 0.06, 0.06])
    expect(adjust([0.01, 0.04, 0.03], 'bh').map((p) => Number(p.toFixed(6)))).toEqual([0.03, 0.04, 0.04])
    expect(adjust([0.01, 0.04, 0.03], 'bonferroni').map((p) => Number(p.toFixed(6)))).toEqual([0.03, 0.12, 0.09])
  })

  it('writes p values and stars the usual way', () => {
    expect([0.2, 0.04, 0.009, 0.0009, 0.00001].map(stars)).toEqual(['ns', '*', '**', '***', '****'])
    expect(formatP(0.0123)).toBe('p = 0.012')
    expect(formatP(0.00001)).toBe('p < 0.0001')
  })
})
