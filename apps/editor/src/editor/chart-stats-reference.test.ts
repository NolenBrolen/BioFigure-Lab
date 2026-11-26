// @vitest-environment jsdom
/*
 * Accuracy audit: the chart statistics against reference libraries.
 *
 * stats-fixtures/ holds realistic data files (CSV, TSV, XLSX). Each is read through the app's own import
 * code (readFile, textColumns, buildGroups), then every test that applies is run and every error bar is
 * worked out, and the numbers are compared with stats-fixtures/reference.json.
 * reference.json comes from scripts/stats-reference/make_reference.py (scipy, statsmodels, pingouin,
 * scikit-posthocs); every value in it names the library function that made it ("method").
 *
 * A red test here is a finding, not necessarily a bug: the message says which value differs and the
 * reference's method. Tolerances (tighten or loosen a value only with a written reason):
 * - Statistics from exported helpers (F, W, r, ...): relative 1e-6.
 * - Closed-form p values (t, F, chi-square, z, exact rank tests): |diff| <= 1e-9 + 1e-6 * p. Below about
 *   1e-9 the app shows "p < 0.0001" and 1 - cdf loses digits, so the absolute floor is harmless.
 * - p values of Tukey, Games-Howell, Dunnett (studentized range and multivariate t have no closed form; jStat
 *   and scipy both use numerical approximations): |diff| <= 1e-3, as the audit brief says. The largest
 *   difference seen is printed at the end ("max |diff|").
 * - Numbers read out of the note text are printed with 3 significant figures: relative 5.1e-3; a p in the
 *   note has 3 decimals (4 below 0.001): half a unit of the last digit.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { afterAll, describe, expect, it } from 'vitest'

import { createChart, errorBounds, parseNumber, stats, type ChartGroup } from './chart-model'
import {
  adjust,
  brownForsythe,
  cohensD,
  type Correction,
  mannWhitney,
  oneWayAnova,
  pearson,
  runTest,
  shapiroWilk,
  STAT_TESTS,
  tTest,
  wilcoxonSignedRank,
  type StatTest,
  type TestResult,
} from './chart-stats'
import { buildGroups, looksLikeHeader, readFile, textColumns, type Table } from './data-import'

/* ---------------------------------------------------------------- reference file */

type Method = { method: string }
type RefComparison = { a: number; b: number; p: number }
type RefTest = Method & {
  none?: string
  comparisons?: RefComparison[]
  adjusted?: Record<Correction, number[]>
  undefined?: { a: number; b: number }[]
  stats?: Record<string, number | null>
  per_group?: Record<string, { w: number; p: number }>
  x_from_names?: boolean
}
type RefErrorBar = { n: number; mean?: number; median?: number; mad_raw?: number; range?: number[]; iqr?: number[]; iqr_methods?: Record<string, number[]> } & Record<string, unknown>
type Entry = { name: string; file: string; sheet: string | null; orientation: 'columns' | 'rows'; header: boolean; delimiter: string; value: number; note: string }
type RefFixture = {
  entry: Entry
  groups: ChartGroup[]
  tests: Record<string, RefTest>
  effect: Method & { d_vs_first?: Record<string, number>; dz_vs_first?: Record<string, number> }
  errorBars: RefErrorBar[]
}
type Reference = { versions: Record<string, string>; fixtures: RefFixture[]; corrections: { ps: number[]; adjusted: Record<Correction, number[]> }[] }

const DIR = join(import.meta.dirname, 'stats-fixtures') + '/'
const reference = JSON.parse(readFileSync(DIR + 'reference.json', 'utf8')) as Reference

/* ---------------------------------------------------------------- reading a fixture like the import window does */

type Loaded = { ref: RefFixture; table: Table; groups: ChartGroup[]; autoHeader: boolean; autoLeftOut: number[] }

async function load(ref: RefFixture): Promise<Loaded> {
  const { entry } = ref
  const sheets = await readFile(new File([readFileSync(DIR + entry.file)], entry.file))
  const sheet = entry.sheet === null ? sheets[0] : sheets.find((s) => s.name === entry.sheet)
  if (!sheet) throw new Error(`${entry.file}: no sheet ${entry.sheet}`)
  const table = sheet.rows
  // What the preview starts with: the user's own header choice stands in for a toggle; text-only columns start out left out.
  const autoLeftOut = textColumns(table, entry.orientation, entry.header)
    .map((isText, c) => (isText ? c : -1))
    .filter((c) => c >= 0)
  const groups = buildGroups(table, { header: entry.header, orientation: entry.orientation, leftOut: autoLeftOut })
  return { ref, table, groups, autoHeader: looksLikeHeader(table, entry.orientation), autoLeftOut }
}

const loaded = await Promise.all(reference.fixtures.map(load))

/* ---------------------------------------------------------------- comparing numbers */

const maxLoose = new Map<string, number>()
const worst = new Map<string, string>()
const note = (key: string, d: number, label: string, app: number, ref: number) => {
  if (d >= (maxLoose.get(key) ?? 0)) worst.set(key, `${current} ${label}: app ${app}, ref ${ref}`)
  maxLoose.set(key, Math.max(maxLoose.get(key) ?? 0, d))
}

let compared = 0
let current = ''
const nums = (g: (number | null)[]) => g.filter((v): v is number => v !== null)
const isBad = (x: number) => !Number.isFinite(x)

function statNear(label: string, app: number, ref: number | null | undefined, rel = 1e-6, abs = 1e-12): string[] {
  compared++
  if (ref === null || ref === undefined) return [`${label}: app ${app}, reference undefined`]
  if (isBad(app)) return [`${label}: app ${app}, reference ${ref}`]
  return Math.abs(app - ref) <= abs + rel * Math.abs(ref) ? [] : [`${label}: app ${app}, reference ${ref}`]
}

const pTight = (label: string, app: number, ref: number) => (compared++, isBad(app) ? [`${label}: app p ${app}, reference ${ref}`] : Math.abs(app - ref) <= 1e-9 + 1e-6 * ref ? [] : [`${label}: app p ${app}, reference ${ref}`])
function pLoose(key: string, label: string, app: number, ref: number): string[] {
  compared++
  if (isBad(app)) return [`${label}: app p ${app}, reference ${ref}`]
  note(key, Math.abs(app - ref), label, app, ref)
  return Math.abs(app - ref) <= 1e-3 ? [] : [`${label}: app p ${app}, reference ${ref}`]
}

/** A p written in a note ("p < 0.0001" or "p = 0.012"): does it fit the reference value? */
function noteP(label: string, text: string | undefined, ref: number | null | undefined): string[] {
  compared++
  if (text === undefined) return [`${label}: p missing from the note`]
  if (ref === null || ref === undefined) return [`${label}: note says "${text}", reference undefined`]
  if (text.includes('<')) return ref < 1e-4 * (1 + 1e-9) ? [] : [`${label}: note says "${text}", reference ${ref}`]
  const digits = text.split('=')[1]?.trim().split('.')[1]?.length ?? 0
  const value = Number(text.split('=')[1])
  return Math.abs(value - ref) <= 0.5 * 10 ** -digits + 1e-12 ? [] : [`${label}: note says "${text}", reference ${ref}`]
}

const NUM = String.raw`(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?|Infinity|NaN)`
const P = String.raw`(p [<=] \d+\.\d+)`
const grab = (text: string, pattern: RegExp) => pattern.exec(text) ?? undefined
const noteNear = (label: string, text: string | undefined, ref: number | null | undefined) =>
  text === undefined ? [`${label}: missing from the note`] : statNear(`${label} (note, 3 s.f.)`, Number(text), ref, 5.1e-3, 1e-12)
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/* ---------------------------------------------------------------- running the app's test the way the chart does */

const KEYS = ['ttest_welch', 'ttest_student', 'anova', 'mannwhitney', 'paired', 'control', 'kruskal', 'wilcoxon', 'rmanova', 'welchanova', 'friedman', 'pearson', 'spearman', 'regression', 'onesample', 'onesamplewilcoxon', 'trend', 'shapiro', 'brownforsythe'] as const
type Key = (typeof KEYS)[number]
const CORRECTED: ReadonlySet<Key> = new Set(['ttest_welch', 'ttest_student', 'paired', 'mannwhitney', 'wilcoxon', 'kruskal', 'friedman', 'onesample', 'onesamplewilcoxon'])
const LOOSE: ReadonlySet<Key> = new Set(['anova', 'control', 'welchanova', 'rmanova'])
const CORRECTIONS: Correction[] = ['holmsidak', 'holm', 'bonferroni', 'sidak', 'bh']

function appRun(key: Key, l: Loaded, correction: Correction): TestResult | undefined {
  const values = l.groups.map((g) => g.values)
  const names = l.groups.map((g) => g.name)
  const test: StatTest = key === 'ttest_welch' || key === 'ttest_student' ? 'ttest' : key
  return runTest(test, values, { welch: key !== 'ttest_student', correction, value: l.ref.entry.value, names })
}

/** A list of problems: empty is good; otherwise every line shows in the failure message. */
const expectNone = (problems: string[]) => {
  if (problems.length > 0) throw new Error(problems.join(String.fromCharCode(10)))
}

const finite01 = (p: number) => Number.isFinite(p) && p >= 0 && p <= 1

/** Notes and p values must be clean whatever the data. */
function cleanResult(r: TestResult | undefined): string[] {
  if (!r) return []
  const out: string[] = []
  for (const c of r.comparisons) if (!finite01(c.p)) out.push(`comparison ${c.a}-${c.b} has p = ${c.p}`)
  if (/NaN|Infinity|undefined|null/.test(r.note)) out.push(`note: ${r.note}`)
  return out
}

function compareComparisons(key: Key, app: TestResult, ref: RefTest, correction: Correction): string[] {
  const out: string[] = []
  const expected = ref.comparisons ?? []
  const adjustedRef = CORRECTED.has(key) ? ref.adjusted?.[correction] : undefined
  for (const [i, c] of expected.entries()) {
    const label = `${key}[${correction}] ${c.a}-${c.b}`
    const got = app.comparisons.find((x) => x.a === c.a && x.b === c.b)
    if (!got) {
      out.push(`${label}: app has no comparison, reference p ${adjustedRef?.[i] ?? c.p}`)
      continue
    }
    const want = adjustedRef?.[i] ?? c.p
    out.push(...(LOOSE.has(key) ? pLoose(key, label, got.p, want) : pTight(label, got.p, want)))
  }
  for (const x of app.comparisons) {
    if (!expected.some((c) => c.a === x.a && c.b === x.b)) out.push(`${key}: app compares ${x.a}-${x.b} (p ${x.p}) where the reference has no defined p (${ref.undefined?.some((u) => u.a === x.a && u.b === x.b) ? 'undefined' : 'absent'})`)
  }
  return out
}

/** The numbers the app only shows in its note (3 significant figures). */
function compareNote(key: Key, l: Loaded, app: TestResult, ref: RefTest): string[] {
  const s = ref.stats ?? {}
  const text = app.note
  switch (key) {
    case 'kruskal': {
      const m = grab(text, new RegExp(String.raw`H\((\d+)\) = ${NUM}, ${P}`))
      return [...statNear('kruskal df', Number(m?.[1]), s.df), ...noteNear('kruskal H', m?.[2], s.h), ...noteP('kruskal p', m?.[3], s.p)]
    }
    case 'rmanova': {
      const m = grab(text, new RegExp(String.raw`\((\d+) samples\), Geisser-Greenhouse corrected, ε = ${NUM}, F\(${NUM}, ${NUM}\) = ${NUM}, ${P}`))
      return [...statNear('rmanova n', Number(m?.[1]), s.n), ...noteNear('rmanova epsilon', m?.[2], s.eps), ...noteNear('rmanova df1', m?.[3], s.df1), ...noteNear('rmanova df2', m?.[4], s.df2), ...noteNear('rmanova F', m?.[5], s.f), ...noteP('rmanova p', m?.[6], s.p)]
    }
    case 'welchanova': {
      const m = grab(text, new RegExp(String.raw`Welch's ANOVA, F\((\d+), ${NUM}\) = ${NUM}, ${P}`))
      return [...statNear('welch df1', Number(m?.[1]), s.df1), ...noteNear('welch df2', m?.[2], s.df2), ...noteNear('welch F', m?.[3], s.f), ...noteP('welch p', m?.[4], s.p)]
    }
    case 'friedman': {
      const m = grab(text, new RegExp(String.raw`\((\d+) samples\), χ²\((\d+)\) = ${NUM}, ${P}`))
      return [...statNear('friedman n', Number(m?.[1]), s.n), ...statNear('friedman df', Number(m?.[2]), s.df), ...noteNear('friedman chi2', m?.[3], s.chi), ...noteP('friedman p', m?.[4], s.p)]
    }
    case 'trend': {
      const m = grab(text, new RegExp(String.raw`F\(1, (\d+)\) = ${NUM}, ${P}; (rising|falling)`))
      const slopeSign = (s.slope ?? 0) >= 0 ? 'rising' : 'falling'
      return [...statNear('trend df2', Number(m?.[1]), s.df2), ...noteNear('trend F', m?.[2], s.f), ...noteP('trend p', m?.[3], s.p), ...(m?.[4] === slopeSign ? [] : [`trend direction: note says ${m?.[4]}, reference slope ${s.slope}`])]
    }
    case 'pearson':
    case 'spearman': {
      const m = grab(text, new RegExp(String.raw`r = ${NUM}, n = (\d+), ${P}`))
      const out = [...noteNear(`${key} r`, m?.[1], s.r), ...statNear(`${key} n`, Number(m?.[2]), s.n), ...noteP(`${key} p`, m?.[3], s.p)]
      if (key === 'pearson') {
        // The helper itself, with the x values the reference used, to full precision.
        const xs: number[] = []
        const ys: number[] = []
        l.groups.forEach((g, i) => {
          for (const y of nums(g.values)) {
            xs.push(ref.x_from_names ? Number(g.name.trim().replace(',', '.')) : i + 1)
            ys.push(y)
          }
        })
        const r = pearson(xs, ys)
        out.push(...(r ? [...statNear('pearson() r', r.r, s.r), ...pTight('pearson() p', r.p, s.p ?? NaN)] : ['pearson(): undefined, reference has a value']))
      }
      return out
    }
    case 'regression': {
      const m = grab(text, new RegExp(String.raw`y = ${NUM}x ([−+]) ${NUM}, R² = ${NUM}, ${P}`))
      const intercept = m?.[2] === '−' ? -Number(m?.[3]) : Number(m?.[3])
      return [...noteNear('regression slope', m?.[1], s.slope), ...statNear('regression intercept (note, 3 s.f.)', intercept, s.intercept, 5.1e-3, 1e-12), ...noteNear('regression R2', m?.[4], s.r2), ...noteP('regression p', m?.[5], s.p)]
    }
    case 'brownforsythe': {
      const m = grab(text, new RegExp(String.raw`F\((\d+), (\d+)\) = ${NUM}, ${P}`))
      const helper = brownForsythe(l.groups.map((g) => nums(g.values)))
      return [...statNear('BF df1', Number(m?.[1]), s.df1), ...statNear('BF df2', Number(m?.[2]), s.df2), ...noteNear('BF F', m?.[3], s.f), ...noteP('BF p', m?.[4], s.p), ...(helper ? [...statNear('brownForsythe() F', helper.f, s.f), ...pTight('brownForsythe() p', helper.p, s.p ?? NaN)] : ['brownForsythe(): undefined'])]
    }
    case 'anova': {
      const a = oneWayAnova(l.groups.map((g) => nums(g.values)))
      if (!a) return ['oneWayAnova(): undefined, reference has values']
      return [...statNear('anova F', a.f, s.f), ...pTight('anova p', a.p, s.p ?? NaN), ...statNear('anova df1', a.df1, s.df1), ...statNear('anova df2', a.df2, s.df2), ...statNear('anova MSE', a.mse, s.mse), ...statNear('anova eta2', a.eta2, s.eta2)]
    }
    default:
      return []
  }
}

function compareShapiro(l: Loaded, app: TestResult | undefined, ref: RefTest): string[] {
  const out: string[] = []
  const per = ref.per_group ?? {}
  for (const [i, g] of l.groups.entries()) {
    const want = per[String(i)]
    const got = shapiroWilk(nums(g.values))
    if (!want) {
      if (got) out.push(`shapiro group ${i} (${g.name}): app W = ${got.w}, reference undefined`)
      continue
    }
    if (!got) {
      out.push(`shapiro group ${i}: app undefined, reference W = ${want.w}`)
      continue
    }
    out.push(...statNear(`shapiro W group ${i}`, got.w, want.w), ...pTight(`shapiro p group ${i}`, got.p, want.p))
    const m = grab(app?.note ?? '', new RegExp(String.raw`(?<=\)\. |; )` + escapeRe(g.name) + `: W = ${NUM}, ${P}`))
    out.push(...noteNear(`shapiro note W group ${i}`, m?.[1], want.w), ...noteP(`shapiro note p group ${i}`, m?.[2], want.p))
  }
  return out
}

/** Everything the app returns for one fixture and one test, against the reference. Empty list: all good. */
const TWO_GROUP_P1: ReadonlySet<Key> = new Set(['ttest_welch', 'ttest_student', 'paired', 'mannwhitney'])

function mismatches(key: Key, l: Loaded, correction: Correction): string[] {
  const ref = l.ref.tests[key]
  current = l.ref.entry.name
  if (!ref) return [`no reference for ${key}`]
  let app: TestResult | undefined
  try {
    app = appRun(key, l, correction)
  } catch (error) {
    return [`threw: ${String(error)}`]
  }
  const out = cleanResult(app)
  if (key === 'shapiro') return [...out, ...(ref.none && app ? [`app result where reference undefined (${ref.none}): ${app.note}`] : compareShapiro(l, app, ref))]
  if (ref.none !== undefined) {
    // All values identical: scipy gives NaN, but "no difference" (p = 1) is the sensible answer, and R's wilcox.test gives p = 1 as well. No result is fine too.
    if (app && l.ref.entry.name === 'all-identical' && TWO_GROUP_P1.has(key) && app.comparisons.every((c) => c.p === 1)) return out
    if (app) out.push(`app returns a result where the reference has none (${ref.none}): ${app.note}`)
    return out
  }
  if (!app) return [...out, 'app returns undefined, reference has a result']
  if (ref.comparisons) out.push(...compareComparisons(key, app, ref, correction))
  out.push(...compareNote(key, l, app, ref))
  return out
}

/* ---------------------------------------------------------------- 1. import */

describe('import: the fixture files come out as the reference groups', () => {
  it.each(loaded.map((l) => [l.ref.entry.name, l] as const))('%s', (_name, l) => {
    const want = l.ref.groups
    expect(l.groups.map((g) => g.name)).toEqual(want.map((g) => g.name))
    for (const [i, g] of l.groups.entries()) {
      expect(g.values, `group ${g.name}`).toHaveLength(want[i]?.values.length ?? -1)
      expect(g.values, `group ${g.name}`).toEqual(want[i]?.values)
    }
  })

  it.each(loaded.map((l) => [l.ref.entry.name, l] as const))('%s: header found automatically', (_name, l) => {
    // A first row of plain numbers (doses such as 0, 1, 10) is not seen as names: the user has to switch "header" on.
    expect(l.autoHeader).toBe(l.ref.entry.header)
  })
})

describe('import: a number typed into a cell', () => {
  const cases: [string, number | null][] = [
    ['1.5', 1.5],
    ['1,5', 1.5],
    ['-2,5', -2.5],
    ['1,234.5', 1234.5],
    ['1 234,5', 1234.5],
    ['1.234,5', 1234.5], // European thousands point + decimal comma
    ['1,234', 1.234], // ambiguous with one comma; comma decimals are common in the European files the import is built for
    ['1e-3', 0.001],
    ['−2.5', -2.5], // the real minus sign (U+2212) that Word and some exports write
    ['  7  ', 7],
    ['5 %', null],
    ['n/a', null],
    ['', null],
    ['Infinity', null],
  ]
  it.each(cases)('%s', (text, want) => {
    expect(parseNumber(text)).toBe(want)
  })
})

/* ---------------------------------------------------------------- 2. the tests */

describe('tests match the reference', () => {
  for (const l of loaded) {
    describe(l.ref.entry.name, () => {
      for (const key of KEYS) {
        if (CORRECTED.has(key)) {
          it(`${key} (all five corrections)`, () => {
            const found = CORRECTIONS.flatMap((c) => mismatches(key, l, c).map((m) => `[${c}] ${m}`))
            expectNone(found)
          })
        } else {
          it(key, () => {
            expectNone(mismatches(key, l, 'holmsidak'))
          })
        }
      }
    })
  }
})

describe('helpers called directly (two groups, full precision)', () => {
  const two = loaded.filter((l) => l.groups.length === 2)
  it.each(two.map((l) => [l.ref.entry.name, l] as const))('%s', (_name, l) => {
    const [a, b] = l.groups.map((g) => nums(g.values))
    const found: string[] = []
    const t = (key: Key) => l.ref.tests[key]?.comparisons?.[0]?.p
    const check = (label: string, app: number | undefined, ref: number | undefined) => {
      if (ref === undefined) return app === undefined || finite01(app) ? undefined : found.push(`${label}: app ${app}`)
      if (app === undefined) return found.push(`${label}: app undefined, reference ${ref}`)
      found.push(...pTight(label, app, ref))
    }
    // two groups: one comparison, so the correction leaves the p value alone
    check('tTest welch', tTest(a ?? [], b ?? [], true), t('ttest_welch'))
    check('tTest student', tTest(a ?? [], b ?? [], false), t('ttest_student'))
    check('mannWhitney', mannWhitney(a ?? [], b ?? []), t('mannwhitney'))
    const diffs = nums(l.groups[0]?.values.map((x, i) => { const y = l.groups[1]?.values[i]; return x !== null && y !== null && y !== undefined ? y - x : null }) ?? [])
    check('wilcoxonSignedRank', wilcoxonSignedRank(diffs), t('wilcoxon'))
    expectNone(found)
  })
})

/* ---------------------------------------------------------------- 3. effect sizes */

describe('effect sizes', () => {
  it.each(loaded.filter((l) => l.groups.length >= 2).map((l) => [l.ref.entry.name, l] as const))('%s', (_name, l) => {
    const found: string[] = []
    const want = l.ref.effect.d_vs_first ?? {}
    const first = nums(l.groups[0]?.values ?? [])
    for (let i = 1; i < l.groups.length; i++) {
      const d = cohensD(first, nums(l.groups[i]?.values ?? []))
      const ref = want[String(i)]
      if (ref === undefined) {
        if (d !== undefined) found.push(`cohensD group ${i}: app ${d}, reference undefined`)
      } else if (d === undefined) found.push(`cohensD group ${i}: app undefined, reference ${ref}`)
      else found.push(...statNear(`cohensD group ${i}`, d, ref))
    }
    // The note: unpaired d for the t-test, dz for the paired t-test, values in the order of the groups.
    const values = l.groups.map((g) => g.values)
    for (const [test, refMap] of [['ttest', want], ['paired', l.ref.effect.dz_vs_first ?? {}]] as const) {
      const r = runTest(test, values, { effectSize: true, welch: true, correction: 'holmsidak' })
      const shown = [...(r?.note.matchAll(new RegExp(`d = ${NUM}`, 'g')) ?? [])].map((m) => Number(m[1]))
      const expected = Object.keys(refMap).map((k) => refMap[k] as number)
      // Only groups with a p value are in the note's comparisons, but d is written for every group with a defined d.
      if (shown.length !== expected.length) found.push(`${test} note shows ${shown.length} effect sizes, reference ${expected.length} (${r?.note ?? 'no result'})`)
      else shown.forEach((v, i) => found.push(...statNear(`${test} note d #${i + 1} (3 s.f.)`, v, expected[i], 5.1e-3)))
    }
    expectNone(found)
  })
})

/* ---------------------------------------------------------------- 4. corrections */

describe('corrections match statsmodels multipletests', () => {
  it.each(reference.corrections.map((c, i) => [i, c] as const))('p value set %i', (_i, set) => {
    const found: string[] = []
    for (const method of CORRECTIONS) {
      const got = adjust(set.ps, method)
      const want = set.adjusted[method]
      want.forEach((w, i) => {
        if (Math.abs((got[i] ?? NaN) - w) > 1e-12) found.push(`${method} [${set.ps.join(', ')}] #${i}: app ${got[i]}, reference ${w}`)
      })
    }
    expectNone(found)
  })
})

/* ---------------------------------------------------------------- 5. error bars */

const ERROR_BARS = ['sd', 'sem', 'sd2', 'sem2', 'ci90', 'ci95', 'ci99', 'range', 'iqr', 'mad', 'none'] as const
let iqrDiffersFromLinear = 0

describe('error bars match the reference', () => {
  it.each(loaded.map((l) => [l.ref.entry.name, l] as const))('%s', (_name, l) => {
    const found: string[] = []
    for (const [i, g] of l.groups.entries()) {
      const want = l.ref.errorBars[i]
      const values = nums(g.values)
      const s = stats(g.values)
      if (!want || !s) {
        if (values.length > 0) found.push(`group ${i}: no reference error bar`)
        continue
      }
      for (const eb of ERROR_BARS) {
        const label = `${g.name} (n=${values.length}) ${eb}`
        const got = errorBounds(createChart('bar', eb), values, s)
        const mean = want.mean ?? NaN
        const around = (d: unknown): { low: number; high: number } | undefined => (typeof d === 'number' ? { low: mean - d, high: mean + d } : undefined)
        let expected: { low: number; high: number } | undefined
        if (eb === 'none') expected = undefined
        else if (eb === 'range') expected = { low: want.range?.[0] ?? NaN, high: want.range?.[1] ?? NaN }
        else if (eb === 'iqr') expected = { low: want.iqr?.[0] ?? NaN, high: want.iqr?.[1] ?? NaN }
        else if (eb === 'mad') expected = { low: (want.median ?? NaN) - (want.mad_raw ?? NaN), high: (want.median ?? NaN) + (want.mad_raw ?? NaN) }
        else expected = around(eb.startsWith('ci') ? want[eb] : want[eb])
        if (eb === 'none') {
          if (got !== undefined) found.push(`${label}: app ${JSON.stringify(got)}, reference none`)
          continue
        }
        if (!expected) {
          // n = 1: SD, SEM and CI are undefined. Zero length (no whisker is drawn) is the accepted answer.
          if (!got || (got.low === mean && got.high === mean)) continue
          found.push(`${label}: app ${JSON.stringify(got)}, reference undefined (n < 2)`)
          continue
        }
        if (!got) {
          found.push(`${label}: app none, reference ${JSON.stringify(expected)}`)
          continue
        }
        found.push(...statNear(`${label} low`, got.low, expected.low, 1e-6, 1e-9), ...statNear(`${label} high`, got.high, expected.high, 1e-6, 1e-9))
      }
      // Not a failure: how often the quartiles differ from the (n+1)p rule in the reference file.
      const weibull = want.iqr_methods?.numpy_weibull_type6
      const linear = want.iqr_methods?.numpy_linear_type7
      if (weibull && linear && values.length > 2 && (Math.abs(weibull[0]! - linear[0]!) > 1e-9 || Math.abs(weibull[1]! - linear[1]!) > 1e-9)) iqrDiffersFromLinear++
    }
    expectNone(found)
  })
})

/* ---------------------------------------------------------------- 6. edge cases: never NaN, Infinity or a crash */

const BIG = 1e200
const EDGE: Record<string, (number | null)[][]> = {
  'no groups': [],
  'one group of 3': [[1, 2, 3]],
  'two empty groups': [[], []],
  'all blank cells': [[null, null], [null, null]],
  'n=1 and n=1': [[1], [2]],
  'n=2 and n=2': [[1, 2], [3, 4]],
  'n=2, n=2, n=2': [[1, 2], [3, 5], [8, 13]],
  'SD 0, same mean': [[5, 5, 5], [5, 5, 5]],
  'SD 0, different mean': [[5, 5, 5], [6, 6, 6]],
  'SD 0, three groups': [[5, 5, 5], [6, 6, 6], [7, 7, 7]],
  'one group SD 0': [[5, 5, 5], [4, 6, 8]],
  'all tied, three groups': [[1, 1], [1, 1], [1, 1]],
  'tied across groups': [[1, 2, 3], [1, 2, 3], [1, 2, 3]],
  'very large values': [[BIG, 2 * BIG, 3 * BIG], [4 * BIG, 5 * BIG, 7 * BIG]],
  'very small values': [[1e-200, 2e-200, 3e-200], [4e-200, 5e-200, 7e-200]],
  'n=1, n=1, n=1': [[1], [2], [3]],
  'one value and a group': [[4], [1, 2, 3, 4]],
}
const edgeOutcomes: string[] = []

describe('edge cases: undefined or a clean result, never NaN, Infinity or a crash', () => {
  for (const [name, values] of Object.entries(EDGE)) {
    describe(name, () => {
      for (const test of STAT_TESTS.filter((t) => t.id !== 'none').map((t) => t.id)) {
        it(test, () => {
          const options = { names: values.map((_, i) => `G${i + 1}`), value: 1, effectSize: true }
          let result: TestResult | undefined
          expect(() => (result = runTest(test, values, options))).not.toThrow()
          edgeOutcomes.push(`${name} | ${test} | ${result ? result.note : 'undefined'}`)
          expectNone(cleanResult(result))
          // The unpaired t-test in Student's form and every correction as well.
          if (test === 'ttest') for (const welch of [true, false]) expectNone(cleanResult(runTest('ttest', values, { ...options, welch })))
          if (['kruskal', 'friedman', 'mannwhitney', 'ttest'].includes(test)) for (const correction of CORRECTIONS) expectNone(cleanResult(runTest(test, values, { ...options, correction })))
        })
      }
    })
  }

  it('error bars of groups with 0, 1, 2 values and zero spread', () => {
    const found: string[] = []
    for (const values of [[], [3], [3, 3], [1, 2], [1, 1, 1, 1]]) {
      const s = stats(values)
      if (!s) continue
      for (const eb of ERROR_BARS) {
        const b = errorBounds(createChart('bar', eb), values, s)
        if (b && (!Number.isFinite(b.low) || !Number.isFinite(b.high) || b.low > b.high)) found.push(`${values.join(',')} ${eb}: ${JSON.stringify(b)}`)
      }
    }
    expectNone(found)
  })
})

afterAll(() => {
  const diffs = [...maxLoose].map(([k, v]) => `${k}: ${v.toExponential(2)}`).join(', ')
  console.info(`max |diff| of the studentized-range / Dunnett p values vs the reference (tolerance 1e-3): ${diffs}`)
  console.info(`groups whose quartiles differ from the old linear rule (the app now uses the (n+1)p rule): ${iqrDiffersFromLinear}`)
  console.info(`worst: ${[...worst].map(([k, v]) => `${k} -> ${v}`).join(' | ')}`)
  console.info(`numbers compared with the reference: ${compared}`)
  console.info(`reference library versions: ${JSON.stringify(reference.versions)}`)
  if (process.env['STATS_DUMP']) console.info(['EDGE OUTCOMES', ...edgeOutcomes.sort()].join('\n'))
})
