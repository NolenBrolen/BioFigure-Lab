/**
 * Significance tests for a chart's groups, and how to show them: stars over
 * a bracket between two groups (or over one group, for tests against a
 * value), and a short line saying which test was used.
 *
 * The tests, most used first (see STAT_TESTS):
 * - Unpaired t-test (Welch's or Student's), paired t-test, Mann-Whitney U,
 *   Wilcoxon signed-rank: two groups. With more groups, every group is
 *   compared with the first and the p values are corrected for the number
 *   of comparisons (Bonferroni, Holm, Šidák, Holm-Šidák or Benjamini-Hochberg).
 * - One-way ANOVA with Tukey's or Dunnett's test, Kruskal-Wallis with Dunn's
 *   test, Welch's ANOVA with Games-Howell, repeated-measures ANOVA, Friedman:
 *   three or more groups.
 * - Pearson and Spearman correlation, linear regression, test for a linear
 *   trend: does the value rise or fall across the groups? The x value of a
 *   group is its name when every name is a number (doses, times), else its place.
 * - One-sample t-test and Wilcoxon: each group against a value (such as a
 *   fold change of 1).
 * - Shapiro-Wilk (is each group bell-shaped?) and Brown-Forsythe (do the
 *   groups spread equally?): checks to help pick a test.
 *
 * Paired and repeated-measures tests pair values by row: row 1 of each group
 * is the same sample. The rank tests use the exact distribution for small
 * groups without ties and the normal approximation otherwise, as R does.
 * jStat gives the probability tables (F, studentized range, t, chi-square,
 * normal); Dunnett's test is worked out by integration.
 */
import { jStat } from 'jstat'

export type StatTest =
  | 'none'
  | 'ttest'
  | 'anova'
  | 'mannwhitney'
  | 'paired'
  | 'control'
  | 'kruskal'
  | 'wilcoxon'
  | 'rmanova'
  | 'welchanova'
  | 'friedman'
  | 'pearson'
  | 'spearman'
  | 'regression'
  | 'onesample'
  | 'onesamplewilcoxon'
  | 'trend'
  | 'shapiro'
  | 'brownforsythe'

export type Correction = 'bonferroni' | 'holm' | 'sidak' | 'holmsidak' | 'bh'

/** Every test, the most used first. */
export const STAT_TESTS: { id: StatTest; name: string; hint: string }[] = [
  { id: 'none', name: 'None', hint: 'No significance test' },
  { id: 'ttest', name: 'Unpaired t-test', hint: 'Two groups of different samples' },
  { id: 'anova', name: 'ANOVA + Tukey', hint: 'Three or more groups: every pair compared' },
  { id: 'mannwhitney', name: 'Mann-Whitney U', hint: 'Two groups of different samples, data not bell-shaped' },
  { id: 'paired', name: 'Paired t-test', hint: 'Two groups of the same samples (row by row)' },
  { id: 'control', name: 'ANOVA + Dunnett', hint: 'Three or more groups: every group against the first (control)' },
  { id: 'kruskal', name: 'Kruskal-Wallis + Dunn', hint: 'Like ANOVA + Tukey, data not bell-shaped' },
  { id: 'wilcoxon', name: 'Wilcoxon signed-rank', hint: 'Like the paired t-test, data not bell-shaped' },
  { id: 'rmanova', name: 'Repeated-measures ANOVA', hint: 'The same samples measured in every group (row by row)' },
  { id: 'welchanova', name: "Welch's ANOVA + Games-Howell", hint: 'Like ANOVA + Tukey, when the groups spread very differently' },
  { id: 'friedman', name: 'Friedman', hint: 'Like repeated-measures ANOVA, data not bell-shaped' },
  { id: 'pearson', name: 'Pearson correlation', hint: 'Does the value rise or fall in a straight line across the groups?' },
  { id: 'spearman', name: 'Spearman correlation', hint: 'Does the value rise or fall across the groups, straight line or not?' },
  { id: 'regression', name: 'Linear regression', hint: 'Fits a straight line across the groups: slope, R² and p' },
  { id: 'onesample', name: 'One-sample t-test', hint: 'Each group against a value, such as a fold change of 1' },
  { id: 'onesamplewilcoxon', name: 'One-sample Wilcoxon', hint: 'Each group against a value, data not bell-shaped' },
  { id: 'trend', name: 'Test for linear trend', hint: 'After ANOVA: does the mean rise or fall with the order of the groups?' },
  { id: 'shapiro', name: 'Shapiro-Wilk normality', hint: 'Check: is each group bell-shaped?' },
  { id: 'brownforsythe', name: 'Brown-Forsythe', hint: 'Check: do the groups spread equally?' },
]

export const CORRECTIONS: { id: Correction; name: string }[] = [
  { id: 'bonferroni', name: 'Bonferroni' },
  { id: 'holm', name: 'Holm' },
  { id: 'holmsidak', name: 'Holm-Šidák' },
  { id: 'sidak', name: 'Šidák' },
  { id: 'bh', name: 'Benjamini-Hochberg (FDR)' },
]

/** Tests that pair values by row: row 1 of each group is the same sample. */
export const PAIRED_TESTS: ReadonlySet<StatTest> = new Set(['paired', 'wilcoxon', 'rmanova', 'friedman'])
/** Tests that compare several p values, so the correction applies. */
export const CORRECTED_TESTS: ReadonlySet<StatTest> = new Set(['ttest', 'paired', 'mannwhitney', 'wilcoxon', 'kruskal', 'friedman', 'onesample', 'onesamplewilcoxon'])
/** Tests of each group against a value. */
export const VALUE_TESTS: ReadonlySet<StatTest> = new Set(['onesample', 'onesamplewilcoxon'])

/** One compared pair: the two groups (by place) and the p value. A test of one group against a value has a === b. */
export type Comparison = { a: number; b: number; p: number }
export type TestResult = { comparisons: Comparison[]; note: string }
export type TestOptions = {
  /** Unpaired t-test: Welch's version (unequal spread). */
  welch?: boolean
  correction?: Correction
  /** One-sample tests: the value each group is tested against. */
  value?: number
  /** Add effect sizes (Cohen's d, η²) to the note. */
  effectSize?: boolean
  /** The groups' names, to use as x values when they are all numbers. */
  names?: string[]
}

const numbers = (values: (number | null)[]) => values.filter((v): v is number => v !== null && Number.isFinite(v))
const isNumber = (v: number | null | undefined): v is number => v !== null && v !== undefined && Number.isFinite(v)
const sum = (v: number[]) => v.reduce((a, b) => a + b, 0)
const meanOf = (v: number[]) => sum(v) / v.length
const varianceOf = (v: number[]) => {
  const m = meanOf(v)
  return sum(v.map((x) => (x - m) ** 2)) / (v.length - 1)
}
const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? (s[mid] ?? 0) : ((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2
}
const normalCdf = (z: number) => jStat.normal.cdf(z, 0, 1)
/** Two-sided p from a z score. */
const twoSidedZ = (z: number) => 2 * (1 - normalCdf(Math.abs(z)))
const twoSidedT = (t: number, df: number) => 2 * (1 - jStat.studentt.cdf(Math.abs(t), df))
const clampP = (p: number) => Math.min(Math.max(p, 0), 1)

/** p as papers write it: "p < 0.0001" or "p = 0.012". */
export const formatP = (p: number) => (p < 0.0001 ? 'p < 0.0001' : `p = ${p < 0.001 ? p.toFixed(4) : p.toFixed(3)}`)

/** The usual stars: * p < 0.05, ** < 0.01, *** < 0.001, **** < 0.0001; ns otherwise. */
export const stars = (p: number) => (p < 0.0001 ? '****' : p < 0.001 ? '***' : p < 0.01 ? '**' : p < 0.05 ? '*' : 'ns')

const fmt = (value: number) => String(Number(value.toPrecision(3)))

/* Multiple comparisons */

/** Adjusted p values, in the same order, for testing several things at once. */
export function adjust(ps: number[], method: Correction): number[] {
  const m = ps.length
  if (m <= 1) return ps.map(clampP)
  if (method === 'bonferroni') return ps.map((p) => clampP(p * m))
  if (method === 'sidak') return ps.map((p) => clampP(1 - (1 - p) ** m))
  const order = ps.map((p, i) => ({ p, i })).sort((x, y) => x.p - y.p)
  const out = new Array<number>(m).fill(1)
  if (method === 'bh') {
    // Step-up: from the largest p down, keeping each no bigger than the one after it.
    let running = 1
    for (let r = m - 1; r >= 0; r--) {
      const item = order[r]
      if (!item) continue
      running = Math.min(running, (item.p * m) / (r + 1))
      out[item.i] = clampP(running)
    }
    return out
  }
  // Holm and Holm-Šidák step down: from the smallest p up, keeping each no smaller than the one before.
  let running = 0
  order.forEach((item, r) => {
    const left = m - r
    const p = method === 'holm' ? item.p * left : 1 - (1 - item.p) ** left
    running = Math.max(running, p)
    out[item.i] = clampP(running)
  })
  return out
}

const correctionName = (method: Correction) => CORRECTIONS.find((c) => c.id === method)?.name ?? method

/* Ranks */

/** Ranks from 1, ties sharing the average of their ranks; and the sizes of the tied groups, for tie corrections. */
export function rank(values: number[]): { ranks: number[]; ties: number[] } {
  const order = values.map((value, i) => ({ value, i })).sort((x, y) => x.value - y.value)
  const ranks = new Array<number>(values.length).fill(0)
  const ties: number[] = []
  for (let start = 0; start < order.length; ) {
    let end = start
    while (end + 1 < order.length && order[end + 1]?.value === order[start]?.value) end++
    const shared = (start + end) / 2 + 1
    for (let k = start; k <= end; k++) ranks[order[k]?.i ?? 0] = shared
    if (end > start) ties.push(end - start + 1)
    start = end + 1
  }
  return { ranks, ties }
}

const tieSum = (ties: number[]) => sum(ties.map((t) => t ** 3 - t))

/** The two-sided p of an observed sum from a table of how many ways each sum can come out. */
function exactP(counts: number[], observed: number): number {
  const total = sum(counts)
  let below = 0
  let above = 0
  counts.forEach((count, s) => {
    if (s <= observed + 1e-9) below += count
    if (s >= observed - 1e-9) above += count
  })
  return clampP((2 * Math.min(below, above)) / total)
}

/* Two groups, and one group against a value */

/** Unpaired t-test; Welch's version unless `welch` is false. Two-sided p. */
export function tTest(a: number[], b: number[], welch = true): number | undefined {
  if (a.length < 2 || b.length < 2) return undefined
  const diff = meanOf(a) - meanOf(b)
  if (welch) {
    const va = varianceOf(a) / a.length
    const vb = varianceOf(b) / b.length
    if (va + vb === 0) return diff === 0 ? 1 : 0
    const df = (va + vb) ** 2 / (va ** 2 / (a.length - 1) + vb ** 2 / (b.length - 1))
    return twoSidedT(diff / Math.sqrt(va + vb), df)
  }
  const df = a.length + b.length - 2
  const pooled = ((a.length - 1) * varianceOf(a) + (b.length - 1) * varianceOf(b)) / df
  const se = Math.sqrt(pooled * (1 / a.length + 1 / b.length))
  if (se === 0) return diff === 0 ? 1 : 0
  return twoSidedT(diff / se, df)
}

/** Welch's t-test between two groups; two-sided p. */
export const welch = (a: number[], b: number[]) => tTest(a, b, true)

/** One-sample t-test of values against `mu` (a paired t-test is this on the differences, against 0). Two-sided p. */
export function oneSampleT(values: number[], mu = 0): number | undefined {
  const n = values.length
  if (n < 2) return undefined
  const se = Math.sqrt(varianceOf(values) / n)
  const m = meanOf(values) - mu
  if (se === 0) return m === 0 ? 1 : 0
  return twoSidedT(m / se, n - 1)
}

/** Paired t-test on the row-by-row differences; two-sided p. */
export const pairedT = (differences: number[]) => oneSampleT(differences, 0)

/** The distribution of Mann-Whitney's U for groups of m and n: how many orderings give each U. */
function mannWhitneyCounts(m: number, n: number): number[] {
  // ways[i][j][u]: orderings of i values from one group and j from the other with U = u, built up a value at a time.
  let previous: number[][] = Array.from({ length: n + 1 }, () => [1])
  for (let i = 1; i <= m; i++) {
    const row: number[][] = [[1]]
    for (let j = 1; j <= n; j++) {
      const counts = new Array<number>(i * j + 1).fill(0)
      // The largest value is from the first group (it beats all j others) or from the second.
      ;(previous[j] ?? []).forEach((c, u) => (counts[u + j] = (counts[u + j] ?? 0) + c))
      ;(row[j - 1] ?? []).forEach((c, u) => (counts[u] = (counts[u] ?? 0) + c))
      row.push(counts)
    }
    previous = row
  }
  return previous[n] ?? [1]
}

/** Mann-Whitney U test (R's wilcox.test for two groups); two-sided p. */
export function mannWhitney(a: number[], b: number[]): number | undefined {
  const m = a.length
  const n = b.length
  if (m === 0 || n === 0) return undefined
  const { ranks, ties } = rank([...a, ...b])
  const u = sum(ranks.slice(0, m)) - (m * (m + 1)) / 2
  if (ties.length === 0 && m < 50 && n < 50) return exactP(mannWhitneyCounts(m, n), u)
  const N = m + n
  const sigma = Math.sqrt(((m * n) / 12) * (N + 1 - tieSum(ties) / (N * (N - 1))))
  if (sigma === 0) return 1
  const centred = u - (m * n) / 2
  return twoSidedZ((centred - Math.sign(centred) * 0.5) / sigma)
}

/** Wilcoxon signed-rank test of values against `mu` (zeros dropped, as R does); on paired differences with mu 0. Two-sided p. */
export function wilcoxonSignedRank(values: number[], mu = 0): number | undefined {
  const d = values.map((x) => x - mu).filter((x) => x !== 0)
  const n = d.length
  if (n === 0) return undefined
  const { ranks, ties } = rank(d.map(Math.abs))
  const v = sum(ranks.map((r, i) => ((d[i] ?? 0) > 0 ? r : 0)))
  if (ties.length === 0 && n < 50) {
    // How many sets of the ranks 1…n add up to each sum.
    let counts = [1]
    for (let k = 1; k <= n; k++) {
      const next = new Array<number>(counts.length + k).fill(0)
      counts.forEach((c, s) => {
        next[s] = (next[s] ?? 0) + c
        next[s + k] = (next[s + k] ?? 0) + c
      })
      counts = next
    }
    return exactP(counts, v)
  }
  const sigma = Math.sqrt((n * (n + 1) * (2 * n + 1)) / 24 - tieSum(ties) / 48)
  if (sigma === 0) return 1
  const centred = v - (n * (n + 1)) / 4
  return twoSidedZ((centred - Math.sign(centred) * 0.5) / sigma)
}

/** Cohen's d between two groups, with the pooled standard deviation. */
export function cohensD(a: number[], b: number[]): number | undefined {
  if (a.length < 2 || b.length < 2) return undefined
  const pooled = Math.sqrt(((a.length - 1) * varianceOf(a) + (b.length - 1) * varianceOf(b)) / (a.length + b.length - 2))
  return pooled === 0 ? undefined : (meanOf(b) - meanOf(a)) / pooled
}

/* Three or more groups */

export function oneWayAnova(groups: number[][]): { f: number; df1: number; df2: number; p: number; mse: number; eta2: number } | undefined {
  const used = groups.filter((g) => g.length > 0)
  const n = sum(used.map((g) => g.length))
  const k = used.length
  if (k < 2 || n - k < 1) return undefined
  const grand = meanOf(used.flat())
  const between = sum(used.map((g) => g.length * (meanOf(g) - grand) ** 2))
  const within = sum(used.map((g) => sum(g.map((x) => (x - meanOf(g)) ** 2))))
  const df1 = k - 1
  const df2 = n - k
  const mse = within / df2
  const f = mse === 0 ? Infinity : between / df1 / mse
  return { f, df1, df2, p: Number.isFinite(f) ? 1 - jStat.centralF.cdf(f, df1, df2) : 0, mse, eta2: between / (between + within) }
}

/** Simpson's rule over [from, to] with an even number of steps. */
function integrate(f: (x: number) => number, from: number, to: number, steps: number): number {
  const h = (to - from) / steps
  let total = f(from) + f(to)
  for (let i = 1; i < steps; i++) total += f(from + i * h) * (i % 2 === 1 ? 4 : 2)
  return (total * h) / 3
}

/**
 * The chance that every one of Dunnett's comparisons stays within ±q, for
 * comparisons whose correlations come from the group sizes (λᵢ = √(nᵢ/(nᵢ+n₀))),
 * with `df` degrees of freedom (Infinity: the normal case). One minus this is
 * the adjusted p value of a comparison with |t| = q. Worked out by
 * integrating over the shared control and the spread estimate.
 */
export function dunnettWithin(q: number, lambdas: number[], df: number): number {
  const inner = (s: number) =>
    integrate(
      (z) => {
        let product = jStat.normal.pdf(z, 0, 1)
        for (const l of lambdas) {
          const c = Math.sqrt(1 - l * l)
          product *= normalCdf((q * s - l * z) / c) - normalCdf((-q * s - l * z) / c)
        }
        return product
      },
      -7,
      7,
      70,
    )
  if (!Number.isFinite(df) || df > 2000) return inner(1)
  // The spread estimate s = √(χ²/df) has this density.
  const logConstant = (df / 2) * Math.log(df) - (df / 2 - 1) * Math.log(2) - jStat.gammaln(df / 2)
  const density = (s: number) => (s <= 0 ? 0 : Math.exp(logConstant + (df - 1) * Math.log(s) - (df * s * s) / 2))
  return integrate((s) => density(s) * inner(s), 0, 1 + 8 / Math.sqrt(df), 40)
}

const anovaLine = (a: { df1: number; df2: number; f: number; p: number; eta2: number }, effect: boolean, name = 'One-way ANOVA') =>
  `${name}, F(${a.df1}, ${fmt(a.df2)}) = ${fmt(a.f)}, ${formatP(a.p)}${effect ? `, η² = ${fmt(a.eta2)}` : ''}`

function anovaTukey(groups: number[][], effect: boolean): TestResult | undefined {
  const anova = oneWayAnova(groups)
  if (!anova) return undefined
  const k = groups.filter((g) => g.length > 0).length
  const comparisons: Comparison[] = []
  for (let a = 0; a < groups.length; a++)
    for (let b = a + 1; b < groups.length; b++) {
      const ga = groups[a] ?? []
      const gb = groups[b] ?? []
      if (ga.length === 0 || gb.length === 0) continue
      const se = Math.sqrt((anova.mse / 2) * (1 / ga.length + 1 / gb.length))
      const q = se === 0 ? (meanOf(ga) === meanOf(gb) ? 0 : Infinity) : Math.abs(meanOf(ga) - meanOf(gb)) / se
      comparisons.push({ a, b, p: Number.isFinite(q) ? clampP(1 - jStat.tukey.cdf(q, k, anova.df2)) : 0 })
    }
  return { comparisons, note: `${anovaLine(anova, effect)}; Tukey's multiple comparisons.` }
}

function anovaDunnett(groups: number[][], effect: boolean): TestResult | undefined {
  const anova = oneWayAnova(groups)
  const control = groups[0] ?? []
  if (!anova || control.length === 0) return undefined
  const others = groups.flatMap((g, i) => (i > 0 && g.length > 0 ? [{ g, i }] : []))
  if (others.length === 0) return undefined
  const lambdas = others.map(({ g }) => Math.sqrt(g.length / (g.length + control.length)))
  const comparisons = others.map(({ g, i }) => {
    const se = Math.sqrt(anova.mse * (1 / g.length + 1 / control.length))
    const t = se === 0 ? (meanOf(g) === meanOf(control) ? 0 : Infinity) : Math.abs(meanOf(g) - meanOf(control)) / se
    return { a: 0, b: i, p: Number.isFinite(t) ? clampP(1 - dunnettWithin(t, lambdas, anova.df2)) : 0 }
  })
  return { comparisons, note: `${anovaLine(anova, effect)}; Dunnett's test against the first group.` }
}

/** Welch's ANOVA, then Games-Howell between every pair. */
function welchGamesHowell(groups: number[][], effect: boolean): TestResult | undefined {
  const used = groups.flatMap((g, i) => (g.length > 1 ? [{ g, i }] : []))
  const k = used.length
  if (k < 2) return undefined
  const v = used.map(({ g }) => varianceOf(g))
  if (v.some((x) => x === 0)) return undefined
  const w = used.map(({ g }, j) => g.length / (v[j] ?? 1))
  const W = sum(w)
  const means = used.map(({ g }) => meanOf(g))
  const weighted = sum(w.map((wj, j) => wj * (means[j] ?? 0))) / W
  const lambda = sum(used.map(({ g }, j) => (1 - (w[j] ?? 0) / W) ** 2 / (g.length - 1)))
  const f = sum(w.map((wj, j) => wj * ((means[j] ?? 0) - weighted) ** 2)) / (k - 1) / (1 + ((2 * (k - 2)) / (k * k - 1)) * lambda)
  const df2 = (k * k - 1) / (3 * lambda)
  const p = 1 - jStat.centralF.cdf(f, k - 1, df2)
  const comparisons: Comparison[] = []
  for (let x = 0; x < k; x++)
    for (let y = x + 1; y < k; y++) {
      const gx = used[x]
      const gy = used[y]
      if (!gx || !gy) continue
      const sx = (v[x] ?? 0) / gx.g.length
      const sy = (v[y] ?? 0) / gy.g.length
      const q = Math.abs((means[x] ?? 0) - (means[y] ?? 0)) / Math.sqrt((sx + sy) / 2)
      const df = (sx + sy) ** 2 / (sx ** 2 / (gx.g.length - 1) + sy ** 2 / (gy.g.length - 1))
      comparisons.push({ a: gx.i, b: gy.i, p: clampP(1 - jStat.tukey.cdf(q, k, df)) })
    }
  const eta = oneWayAnova(used.map(({ g }) => g))
  return { comparisons, note: `Welch's ANOVA, F(${k - 1}, ${fmt(df2)}) = ${fmt(f)}, ${formatP(p)}${effect && eta ? `, η² = ${fmt(eta.eta2)}` : ''}; Games-Howell multiple comparisons.` }
}

/** The rows where every group has a value: the complete samples for repeated-measures tests. */
function completeRows(raw: (number | null)[][]): number[][] {
  const rows = Math.max(0, ...raw.map((g) => g.length))
  const out: number[][] = []
  for (let r = 0; r < rows; r++) {
    const row = raw.map((g) => g[r])
    if (row.every(isNumber)) out.push(row)
  }
  return out
}

/** Repeated-measures ANOVA (rows are the samples), then Tukey's test with the error term. */
function repeatedAnova(raw: (number | null)[][], effect: boolean): TestResult | undefined {
  const rows = completeRows(raw)
  const k = raw.length
  const n = rows.length
  if (k < 2 || n < 2) return undefined
  const grand = meanOf(rows.flat())
  const colMeans = raw.map((_, j) => meanOf(rows.map((r) => r[j] ?? 0)))
  const rowMeans = rows.map(meanOf)
  const ssTreat = n * sum(colMeans.map((m) => (m - grand) ** 2))
  const ssSubject = k * sum(rowMeans.map((m) => (m - grand) ** 2))
  const ssTotal = sum(rows.flat().map((x) => (x - grand) ** 2))
  const ssError = ssTotal - ssTreat - ssSubject
  const df1 = k - 1
  const df2 = (k - 1) * (n - 1)
  const mse = ssError / df2
  if (mse <= 0) return undefined
  const f = ssTreat / df1 / mse
  const p = 1 - jStat.centralF.cdf(f, df1, df2)
  const comparisons: Comparison[] = []
  for (let a = 0; a < k; a++)
    for (let b = a + 1; b < k; b++) {
      const q = Math.abs((colMeans[a] ?? 0) - (colMeans[b] ?? 0)) / Math.sqrt(mse / n)
      comparisons.push({ a, b, p: clampP(1 - jStat.tukey.cdf(q, k, df2)) })
    }
  const partialEta = ssTreat / (ssTreat + ssError)
  return { comparisons, note: `Repeated-measures ANOVA (${n} samples), F(${df1}, ${df2}) = ${fmt(f)}, ${formatP(p)}${effect ? `, partial η² = ${fmt(partialEta)}` : ''}; Tukey's multiple comparisons.` }
}

/** Kruskal-Wallis with the tie correction, then Dunn's test between every pair. */
function kruskalDunn(groups: number[][], correction: Correction): TestResult | undefined {
  const used = groups.flatMap((g, i) => (g.length > 0 ? [{ g, i }] : []))
  const N = sum(used.map(({ g }) => g.length))
  if (used.length < 2 || N < 3) return undefined
  const { ranks, ties } = rank(used.flatMap(({ g }) => g))
  let at = 0
  const meanRanks = used.map(({ g }) => {
    const r = ranks.slice(at, at + g.length)
    at += g.length
    return meanOf(r)
  })
  const tieFactor = 1 - tieSum(ties) / (N ** 3 - N)
  if (tieFactor === 0) return undefined
  const h = ((12 / (N * (N + 1))) * sum(used.map(({ g }, j) => g.length * ((meanRanks[j] ?? 0) - (N + 1) / 2) ** 2))) / tieFactor
  const df = used.length - 1
  const p = 1 - jStat.chisquare.cdf(h, df)
  const spread = (N * (N + 1)) / 12 - tieSum(ties) / (12 * (N - 1))
  const pairs: { a: number; b: number; p: number }[] = []
  for (let x = 0; x < used.length; x++)
    for (let y = x + 1; y < used.length; y++) {
      const gx = used[x]
      const gy = used[y]
      if (!gx || !gy) continue
      const z = ((meanRanks[x] ?? 0) - (meanRanks[y] ?? 0)) / Math.sqrt(spread * (1 / gx.g.length + 1 / gy.g.length))
      pairs.push({ a: gx.i, b: gy.i, p: twoSidedZ(z) })
    }
  const adjusted = adjust(pairs.map((c) => c.p), correction)
  return {
    comparisons: pairs.map((c, i) => ({ ...c, p: adjusted[i] ?? 1 })),
    note: `Kruskal-Wallis, H(${df}) = ${fmt(h)}, ${formatP(p)}; Dunn's multiple comparisons, ${correctionName(correction)}-corrected.`,
  }
}

/** Friedman's test (rows are the samples), then pairwise rank comparisons. */
function friedman(raw: (number | null)[][], correction: Correction): TestResult | undefined {
  const rows = completeRows(raw)
  const k = raw.length
  const n = rows.length
  if (k < 2 || n < 2) return undefined
  const rankSums = new Array<number>(k).fill(0)
  let tieTerm = 0
  for (const row of rows) {
    const { ranks, ties } = rank(row)
    ranks.forEach((r, j) => (rankSums[j] = (rankSums[j] ?? 0) + r))
    tieTerm += tieSum(ties)
  }
  const denominator = n * k * (k + 1) - tieTerm / (k - 1)
  if (denominator <= 0) return undefined
  const chi = (12 * sum(rankSums.map((r) => (r - (n * (k + 1)) / 2) ** 2))) / denominator
  const p = 1 - jStat.chisquare.cdf(chi, k - 1)
  const se = Math.sqrt((k * (k + 1)) / (6 * n))
  const pairs: Comparison[] = []
  for (let a = 0; a < k; a++)
    for (let b = a + 1; b < k; b++) pairs.push({ a, b, p: twoSidedZ(((rankSums[a] ?? 0) - (rankSums[b] ?? 0)) / n / se) })
  const adjusted = adjust(pairs.map((c) => c.p), correction)
  return {
    comparisons: pairs.map((c, i) => ({ ...c, p: adjusted[i] ?? 1 })),
    note: `Friedman test (${n} samples), χ²(${k - 1}) = ${fmt(chi)}, ${formatP(p)}; Dunn's multiple comparisons, ${correctionName(correction)}-corrected.`,
  }
}

/* Trends across groups */

/** Each value with its group's x: the group name when every name is a number, else the group's place (1, 2, 3…). */
function points(raw: (number | null)[][], names: string[] | undefined): { x: number; y: number }[] {
  const numeric = names?.length === raw.length && names.every((name) => name.trim() !== '' && Number.isFinite(Number(name.replace(',', '.'))))
  return raw.flatMap((g, i) => numbers(g).map((y) => ({ x: numeric ? Number(names[i]?.replace(',', '.')) : i + 1, y })))
}

/** Pearson's r and its two-sided p (t with n − 2 df). */
export function pearson(xs: number[], ys: number[]): { r: number; p: number } | undefined {
  const n = xs.length
  if (n < 3) return undefined
  const mx = meanOf(xs)
  const my = meanOf(ys)
  const sxy = sum(xs.map((x, i) => (x - mx) * ((ys[i] ?? 0) - my)))
  const sxx = sum(xs.map((x) => (x - mx) ** 2))
  const syy = sum(ys.map((y) => (y - my) ** 2))
  if (sxx === 0 || syy === 0) return undefined
  const r = sxy / Math.sqrt(sxx * syy)
  if (Math.abs(r) >= 1) return { r, p: 0 }
  return { r, p: twoSidedT((r * Math.sqrt(n - 2)) / Math.sqrt(1 - r * r), n - 2) }
}

function correlation(test: 'pearson' | 'spearman' | 'regression', raw: (number | null)[][], names: string[] | undefined): TestResult | undefined {
  const pts = points(raw, names)
  const xs = pts.map((pt) => pt.x)
  const ys = pts.map((pt) => pt.y)
  if (test === 'spearman') {
    const result = pearson(rank(xs).ranks, rank(ys).ranks)
    return result && { comparisons: [], note: `Spearman correlation, r = ${fmt(result.r)}, n = ${pts.length}, ${formatP(result.p)}.` }
  }
  const result = pearson(xs, ys)
  if (!result) return undefined
  if (test === 'pearson') return { comparisons: [], note: `Pearson correlation, r = ${fmt(result.r)}, n = ${pts.length}, ${formatP(result.p)}.` }
  const mx = meanOf(xs)
  const my = meanOf(ys)
  const slope = sum(xs.map((x, i) => (x - mx) * ((ys[i] ?? 0) - my))) / sum(xs.map((x) => (x - mx) ** 2))
  const intercept = my - slope * mx
  return { comparisons: [], note: `Linear regression, y = ${fmt(slope)}x ${intercept < 0 ? '−' : '+'} ${fmt(Math.abs(intercept))}, R² = ${fmt(result.r ** 2)}, ${formatP(result.p)}.` }
}

/** Test for a linear trend across the groups in order (a contrast after one-way ANOVA). */
function linearTrend(groups: number[][], names: string[] | undefined): TestResult | undefined {
  const anova = oneWayAnova(groups)
  if (!anova) return undefined
  const used = groups.flatMap((g, i) => (g.length > 0 ? [{ g, i }] : []))
  const xs = used.map(({ i }) => {
    const value = Number(names?.[i]?.replace(',', '.'))
    return names?.every((name) => Number.isFinite(Number(name.replace(',', '.'))) && name.trim() !== '') ? value : i + 1
  })
  const n = sum(used.map(({ g }) => g.length))
  // Weights centred on the size-weighted mean x, so they sum to zero over all values.
  const mx = sum(used.map(({ g }, j) => g.length * (xs[j] ?? 0))) / n
  const c = xs.map((x) => x - mx)
  const estimate = sum(used.map(({ g }, j) => (c[j] ?? 0) * meanOf(g) * g.length))
  const se = Math.sqrt(anova.mse * sum(used.map(({ g }, j) => (c[j] ?? 0) ** 2 * g.length)))
  if (se === 0) return undefined
  const t = estimate / se
  const p = twoSidedT(t, anova.df2)
  return { comparisons: [], note: `Test for linear trend after one-way ANOVA, F(1, ${anova.df2}) = ${fmt(t * t)}, ${formatP(p)}; ${estimate >= 0 ? 'rising' : 'falling'}.` }
}

/* Checks */

/** poly as in Royston's algorithm: c₀ + c₁x + c₂x² + … */
const poly = (c: number[], x: number) => c.reduceRight((acc, coefficient) => acc * x + coefficient, 0)

/** Shapiro-Wilk W and its p (Royston's 1995 method, as R's shapiro.test), for 3 to 5000 values. */
export function shapiroWilk(values: number[]): { w: number; p: number } | undefined {
  const x = [...values].sort((a, b) => a - b)
  const n = x.length
  if (n < 3 || n > 5000) return undefined
  const range = (x[n - 1] ?? 0) - (x[0] ?? 0)
  if (range === 0) return undefined
  const half = Math.floor(n / 2)
  const a = new Array<number>(half).fill(0)
  if (n === 3) a[0] = Math.SQRT1_2
  else {
    // Expected normal scores of the lowest half (negative), as in Royston's algorithm.
    const m = Array.from({ length: half }, (_, i) => jStat.normal.inv((i + 1 - 0.375) / (n + 0.25), 0, 1))
    const summ2 = 2 * sum(m.map((v) => v * v))
    const ssumm2 = Math.sqrt(summ2)
    const rsn = 1 / Math.sqrt(n)
    const a1 = poly([0, 0.221157, -0.147981, -2.07119, 4.434685, -2.706056], rsn) - (m[0] ?? 0) / ssumm2
    let start: number
    let fac: number
    if (n > 5) {
      start = 2
      const a2 = -(m[1] ?? 0) / ssumm2 + poly([0, 0.042981, -0.293762, -1.752461, 5.682633, -3.582633], rsn)
      fac = Math.sqrt((summ2 - 2 * (m[0] ?? 0) ** 2 - 2 * (m[1] ?? 0) ** 2) / (1 - 2 * a1 ** 2 - 2 * a2 ** 2))
      a[1] = a2
    } else {
      start = 1
      fac = Math.sqrt((summ2 - 2 * (m[0] ?? 0) ** 2) / (1 - 2 * a1 ** 2))
    }
    a[0] = a1
    for (let i = start; i < half; i++) a[i] = -(m[i] ?? 0) / fac
  }
  const mean = meanOf(x)
  const ss = sum(x.map((v) => (v - mean) ** 2))
  const top = sum(a.map((ai, i) => ai * ((x[i] ?? 0) - (x[n - 1 - i] ?? 0))))
  const w = Math.min((top * top) / ss, 1)
  if (n === 3) return { w, p: clampP((6 / Math.PI) * (Math.asin(Math.sqrt(w)) - Math.asin(Math.sqrt(0.75)))) }
  const w1 = Math.log(1 - w)
  if (n <= 11) {
    const gamma = poly([-2.273, 0.459], n)
    if (w1 >= gamma) return { w, p: 0 }
    const y = -Math.log(gamma - w1)
    const mean2 = poly([0.544, -0.39978, 0.025054, -6.714e-4], n)
    const s = Math.exp(poly([1.3822, -0.77857, 0.062767, -0.0020322], n))
    return { w, p: clampP(1 - normalCdf((y - mean2) / s)) }
  }
  const xx = Math.log(n)
  const mean2 = poly([-1.5861, -0.31082, -0.083751, 0.0038915], xx)
  const s = Math.exp(poly([-0.4803, -0.082676, 0.0030302], xx))
  return { w, p: clampP(1 - normalCdf((w1 - mean2) / s)) }
}

/** Brown-Forsythe test for equal spread: ANOVA on each value's distance from its group's median. */
export function brownForsythe(groups: number[][]): { f: number; df1: number; df2: number; p: number } | undefined {
  return oneWayAnova(groups.filter((g) => g.length > 0).map((g) => g.map((x) => Math.abs(x - median(g)))))
}

/* Running a test */

/** A two-group test on every group against the first, corrected when there are several. */
function againstFirst(raw: (number | null)[][], test: (first: (number | null)[], other: (number | null)[]) => number | undefined, name: string, correction: Correction, extra = ''): TestResult | undefined {
  const first = raw[0] ?? []
  const found = raw.slice(1).flatMap((other, i) => {
    const p = test(first, other)
    return p === undefined ? [] : [{ a: 0, b: i + 1, p }]
  })
  if (found.length === 0) return undefined
  const adjusted = adjust(found.map((c) => c.p), correction)
  const many = found.length > 1
  return {
    comparisons: found.map((c, i) => ({ ...c, p: adjusted[i] ?? 1 })),
    note: many ? `${name}, each group against the first, ${correctionName(correction)}-corrected for ${found.length} comparisons${extra}.` : `${name}${extra}.`,
  }
}

/** Every group against a value; stars go over the group. */
function againstValue(raw: (number | null)[][], test: (values: number[]) => number | undefined, name: string, value: number, correction: Correction): TestResult | undefined {
  const found = raw.flatMap((g, i) => {
    const p = test(numbers(g))
    return p === undefined ? [] : [{ a: i, b: i, p }]
  })
  if (found.length === 0) return undefined
  const adjusted = adjust(found.map((c) => c.p), correction)
  const many = found.length > 1
  return {
    comparisons: found.map((c, i) => ({ ...c, p: adjusted[i] ?? 1 })),
    note: `${name} against ${fmt(value)}${many ? `, ${correctionName(correction)}-corrected for ${found.length} groups` : ''}.`,
  }
}

/** Row-by-row differences where both groups have a value. */
const differences = (a: (number | null)[], b: (number | null)[]) =>
  a.flatMap((x, i) => {
    const y = b[i]
    return isNumber(x) && isNumber(y) ? [y - x] : []
  })

/** The last results, so a chart redrawn with the same numbers doesn't work its test out again. */
const recent = new Map<string, TestResult | undefined>()

export function runTest(test: StatTest, groupValues: (number | null)[][], options: TestOptions = {}): TestResult | undefined {
  const key = JSON.stringify([test, groupValues, options])
  if (recent.has(key)) return recent.get(key)
  const result = computeTest(test, groupValues, options)
  if (recent.size > 50) recent.delete(recent.keys().next().value ?? '')
  recent.set(key, result)
  return result
}

function computeTest(test: StatTest, groupValues: (number | null)[][], options: TestOptions): TestResult | undefined {
  const groups = groupValues.map(numbers)
  const correction = options.correction ?? 'holmsidak'
  const effect = options.effectSize ?? false
  const value = options.value ?? 0
  const useWelch = options.welch ?? true
  /** Cohen's d of each group against the first, for the note. */
  const effectNote = (paired: boolean) => {
    if (!effect) return ''
    const ds = groupValues.slice(1).flatMap((g, i) => {
      if (paired) {
        const d = differences(groupValues[0] ?? [], g)
        const sd = d.length > 1 ? Math.sqrt(varianceOf(d)) : 0
        return sd > 0 ? [`${groupValues.length > 2 ? `group ${i + 2}: ` : ''}d = ${fmt(meanOf(d) / sd)}`] : []
      }
      const d = cohensD(groups[0] ?? [], numbers(g))
      return d === undefined ? [] : [`${groupValues.length > 2 ? `group ${i + 2}: ` : ''}d = ${fmt(d)}`]
    })
    return ds.length ? `; Cohen's ${ds.join(', ')}` : ''
  }
  switch (test) {
    case 'ttest':
      return againstFirst(groupValues, (a, b) => tTest(numbers(a), numbers(b), useWelch), useWelch ? "Welch's unpaired t-test" : "Student's unpaired t-test", correction, effectNote(false))
    case 'anova':
      return anovaTukey(groups, effect)
    case 'mannwhitney':
      return againstFirst(groupValues, (a, b) => mannWhitney(numbers(a), numbers(b)), 'Mann-Whitney U test', correction)
    case 'paired':
      return againstFirst(groupValues, (a, b) => pairedT(differences(a, b)), 'Paired t-test (rows paired)', correction, effectNote(true))
    case 'control':
      return anovaDunnett(groups, effect)
    case 'kruskal':
      return kruskalDunn(groups, correction)
    case 'wilcoxon':
      return againstFirst(groupValues, (a, b) => wilcoxonSignedRank(differences(a, b)), 'Wilcoxon signed-rank test (rows paired)', correction)
    case 'rmanova':
      return repeatedAnova(groupValues, effect)
    case 'welchanova':
      return welchGamesHowell(groups, effect)
    case 'friedman':
      return friedman(groupValues, correction)
    case 'pearson':
    case 'spearman':
    case 'regression':
      return correlation(test, groupValues, options.names)
    case 'onesample':
      return againstValue(groupValues, (v) => oneSampleT(v, value), 'One-sample t-test', value, correction)
    case 'onesamplewilcoxon':
      return againstValue(groupValues, (v) => wilcoxonSignedRank(v, value), 'One-sample Wilcoxon signed-rank test', value, correction)
    case 'trend':
      return linearTrend(groups, options.names)
    case 'shapiro': {
      const results = groups.map((g, i) => ({ i, r: shapiroWilk(g) }))
      const done = results.filter((x) => x.r)
      if (done.length === 0) return undefined
      const parts = done.map(({ i, r }) => `${options.names?.[i] ?? `group ${i + 1}`}: W = ${fmt(r?.w ?? 0)}, ${formatP(r?.p ?? 1)}`)
      return { comparisons: [], note: `Shapiro-Wilk normality test (p < 0.05: not bell-shaped). ${parts.join('; ')}.` }
    }
    case 'brownforsythe': {
      const r = brownForsythe(groups)
      return r && { comparisons: [], note: `Brown-Forsythe test for equal spread, F(${r.df1}, ${r.df2}) = ${fmt(r.f)}, ${formatP(r.p)} (p < 0.05: the groups spread differently).` }
    }
    case 'none':
      return undefined
  }
}
