import { describe, expect, it } from 'vitest'

import { boxStats } from './chart-distribution'
import { adjust, defaultCorrection, dunnettWithin, formatP, geisserGreenhouseEpsilon, mannWhitney, oneWayAnova, pairedT, runTest, shapiroWilk, spearmanExactP, stars, tTest, welch, wilcoxonSignedRank } from './chart-stats'

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
    expect(rm?.note).toMatch(/^Repeated-measures ANOVA \(4 samples\), Geisser-Greenhouse corrected, ε = /)
    expect(runTest('trend', steps)?.note).toMatch(/rising/)
  })
})

describe('groups without spread, and groups too small', () => {
  const noInfinity = (note: string | undefined) => expect(note ?? '').not.toMatch(/NaN|Infinity/)

  it('gives no result when every value is the same', () => {
    for (const test of ['anova', 'control', 'brownforsythe'] as const) expect(runTest(test, [[7, 7, 7], [7, 7, 7], [7, 7, 7]])).toBeUndefined()
  })

  it('says F cannot be computed, with no brackets, when each group is constant but the means differ', () => {
    for (const test of ['anova', 'control'] as const) {
      const result = runTest(test, [[5, 5, 5], [6, 6, 6], [7, 7, 7]])
      expect(result?.comparisons).toEqual([])
      expect(result?.note).toMatch(/can't be computed/)
      noInfinity(result?.note)
    }
  })

  it("leaves out Tukey's pairs when there are fewer than 2 degrees of freedom", () => {
    const result = runTest('anova', [[4.2], [5.1, 6.3]])
    expect(result?.comparisons).toEqual([])
    expect(result?.note).toMatch(/Too few values in each group for Tukey/)
    noInfinity(result?.note)
  })

  it('leaves out Games-Howell pairs with fewer than 2 degrees of freedom, and never writes NaN', () => {
    const result = runTest('welchanova', [[1, 2], [3, 5], [8, 13]])
    expect(result?.comparisons.every((c) => Number.isFinite(c.p))).toBe(true)
    noInfinity(result?.note)
  })

  it('writes no NaN or Infinity for values too large to square', () => {
    const big = 1e200
    for (const test of ['anova', 'control', 'rmanova', 'welchanova', 'brownforsythe', 'ttest'] as const) {
      const result = runTest(test, [[big, 2 * big, 3 * big], [4 * big, 5 * big, 7 * big]])
      noInfinity(result?.note)
      expect(result?.comparisons.every((c) => Number.isFinite(c.p)) ?? true).toBe(true)
    }
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

describe('repeated measures, Dunn and quartile methods', () => {
  // Three conditions over six samples; the second differs from the first by a steady amount, the third scatters widely.
  const raw = [
    [10, 12, 9, 11, 10, 13],
    [11, 13, 10, 12, 11, 14],
    [14, 9, 18, 8, 15, 10],
  ]

  it('repeated-measures ANOVA multiplies the degrees of freedom by the Geisser-Greenhouse epsilon', () => {
    const rows = raw[0]!.map((_, r) => raw.map((g) => g[r]!))
    const epsilon = geisserGreenhouseEpsilon(rows)
    expect(epsilon).toBeGreaterThanOrEqual(0.5) // lowest possible: 1 / (3 - 1)
    expect(epsilon).toBeLessThan(0.9)
    const note = runTest('rmanova', raw)!.note
    expect(note).toContain(`ε = ${Number(epsilon.toPrecision(3))}`)
    expect(note).toContain(`F(${Number((2 * epsilon).toPrecision(3))}, ${Number((10 * epsilon).toPrecision(3))})`)
    expect(geisserGreenhouseEpsilon([[1, 2], [2, 3], [3, 5]])).toBe(1) // two groups: nothing to correct
  })

  it('repeated-measures post tests compare each pair on its own differences', () => {
    // Groups 1 and 2 differ by exactly 1 in every sample: no spread, so p is 0 however wild the third group is.
    const pairs = runTest('rmanova', raw)!.comparisons
    expect(pairs.find((c) => c.a === 0 && c.b === 1)?.p).toBe(0)
    expect(pairs.find((c) => c.a === 0 && c.b === 2)?.p).toBeGreaterThan(0.2)
  })

  it('finds quartiles by rank (n + 1)p', () => {
    expect(boxStats([1, 2, 3, 4, 5, 6, 7, 8])).toMatchObject({ q1: 2.25, median: 4.5, q3: 6.75 })
    expect(boxStats([3])).toMatchObject({ q1: 3, q3: 3 })
    expect(boxStats([1, 2])).toMatchObject({ q1: 1, q3: 2 }) // ranks outside the data give the smallest and largest
  })

  it("starts Dunn's test with Bonferroni, but keeps a correction that was chosen", () => {
    const groups = [[1, 2, 3, 4], [3, 4, 5, 6], [9, 10, 11, 12]]
    expect(defaultCorrection('kruskal')).toBe('bonferroni')
    expect(defaultCorrection('ttest')).toBe('holmsidak')
    const given = runTest('kruskal', groups)!
    expect(given.note).toContain('Bonferroni-corrected')
    expect(given.comparisons).toEqual(runTest('kruskal', groups, { correction: 'bonferroni' })!.comparisons)
    const chosen = runTest('kruskal', groups, { correction: 'holmsidak' })!
    expect(chosen.note).toContain('Holm-Šidák-corrected')
    expect(chosen.comparisons).not.toEqual(given.comparisons)
  })

  it('gives Spearman an exact p for few pairs without ties, and the t approximation otherwise', () => {
    // Five pairs in perfect order: 2 of the 120 orderings are this extreme (and its mirror image)
    expect(spearmanExactP(5, 0)).toBeCloseTo(2 / 120, 10)
    expect(spearmanExactP(3, 2)).toBe(1)
    const names = ['1', '2', '3', '4', '5']
    expect(runTest('spearman', [[1], [2], [3], [4], [5]], { names })?.note).toMatch(/r = 1, n = 5, p = 0.017 \(exact\)/)
    const tied = runTest('spearman', [[1, 1], [2], [3], [4], [5]], { names })!.note
    expect(tied).toContain('approximate')
    const long = runTest('spearman', Array.from({ length: 12 }, (_, i) => [i + (i % 3)]), { names: Array.from({ length: 12 }, (_, i) => String(i)) })!.note
    expect(long).toContain('approximate')
  })
})
