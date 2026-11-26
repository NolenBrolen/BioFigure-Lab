/*
 * Sub- and superscript in a chart's own text: its name, axis titles, the line
 * under it and its group names (BIO-69), for "λGC", "−log10(p)", "CO2", "Ca2+".
 *
 * Stored the way the Text tool saves its styles: Fabric's style runs
 * (`{ start, end, style }`, as `util.stylesToArray` writes them, counting
 * characters without the line breaks), keeping only `script`. The text itself
 * stays a plain string next to them, so charts saved before this load and
 * look exactly as they did, and every place that reads the text keeps working.
 * Sizes, shifts and the run helpers are shared with the Text tool (packages/ui lib/script-runs.ts).
 *
 * For drawing, a styled text is turned into one string with marks around its
 * sub- and superscript parts (private-use characters, never saved). The
 * layout breaks and fits lines as before, measuring through `scriptMeasure`,
 * which measures the marked parts at their smaller size; the canvas and the
 * SVG export then draw the parts smaller and moved off the line. Marks close
 * at spaces, so a line break never leaves a part without its mark. Tick
 * numbers and other text without runs are never marked.
 */
import { runsOf, SCRIPT_SCALE, SCRIPT_SHIFT, scriptsOf, type Script, type ScriptRun } from '@biofigure-lab/ui/lib/script-runs'

import type { ChartData, Measure } from './chart-model'

export type { ScriptRun }
type On = Exclude<Script, 'none'>

/** The chart texts besides the group names that can hold sub- and superscript (the unit too, for units like mg·L⁻¹). */
export type ChartTextField = 'title' | 'xTitle' | 'yTitle' | 'yUnit' | 'caption'
export type ChartTextStyles = Partial<Record<ChartTextField, ScriptRun[]>>
const FIELDS: readonly ChartTextField[] = ['title', 'xTitle', 'yTitle', 'yUnit', 'caption']

const END = ''
const MARK: Record<On, string> = { sub: '', super: '' }
const HAS_MARK = /[-]/

/** The text with marks around its sub- and superscript parts, for drawing. */
export function markScripts(text: string, runs: readonly ScriptRun[] | undefined): string {
  if (!runs?.length || !text) return text
  const scripts = scriptsOf(text, runs)
  let out = ''
  let open: Script = 'none'
  ;[...text].forEach((char, i) => {
    const script = /\s/.test(char) ? 'none' : (scripts[i] ?? 'none')
    if (script !== open) {
      if (open !== 'none') out += END
      if (script !== 'none') out += MARK[script]
      open = script
    }
    out += char
  })
  return open === 'none' ? out : out + END
}

/** A marked text in parts, each plain, sub- or superscript. */
export function scriptSegments(marked: string): { text: string; script: Script }[] {
  if (!HAS_MARK.test(marked)) return [{ text: marked, script: 'none' }]
  const parts: { text: string; script: Script }[] = []
  let script: Script = 'none'
  let text = ''
  for (const char of marked) {
    if (char === END || char === MARK.sub || char === MARK.super) {
      if (text) parts.push({ text, script })
      text = ''
      script = char === MARK.sub ? 'sub' : char === MARK.super ? 'super' : 'none'
    } else text += char
  }
  if (text) parts.push({ text, script })
  return parts
}

/** A marked text without its marks. */
export const plainText = (marked: string): string => marked.replace(/[-]/g, '')

/** The size and the shift off the baseline of a part of text `size` big. */
export const scriptSize = (script: Script, size: number): { size: number; shift: number } =>
  script === 'none' ? { size, shift: 0 } : { size: size * SCRIPT_SCALE, shift: size * SCRIPT_SHIFT[script] }

const AWARE = Symbol('measures marked text')
/** A measure that also takes marked text, measuring sub- and superscripts at their smaller size. Plain text is measured as before. */
export function scriptMeasure(measure: Measure): Measure {
  if ((measure as Measure & { [AWARE]?: true })[AWARE]) return measure
  const aware: Measure = (text, size, font, bold) =>
    HAS_MARK.test(text) ? scriptSegments(text).reduce((sum, part) => sum + measure(part.text, scriptSize(part.script, size).size, font, bold), 0) : measure(text, size, font, bold)
  return Object.assign(aware, { [AWARE]: true as const })
}

/** The chart with its styled texts marked, for laying it out and drawing it. Returns the chart itself when nothing is styled. */
export function markChartScripts(chart: ChartData): ChartData {
  const styles = chart.textStyles
  const fields = FIELDS.filter((field) => styles?.[field]?.length)
  const groups = chart.groups.some((g) => g.nameStyles?.length)
  if (fields.length === 0 && !groups) return chart
  const marked: ChartData = { ...chart, groups: groups ? chart.groups.map((g) => (g.nameStyles?.length ? { ...g, name: markScripts(g.name, g.nameStyles) } : g)) : chart.groups }
  for (const field of fields) marked[field] = markScripts(chart[field], styles?.[field])
  return marked
}

/** Fill a marked text on a canvas, from `x` on the baseline `y`, each part at its own size and height. */
export function fillScriptText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fontFor: (size: number) => string, measure: Measure, font: string, bold?: boolean): void {
  if (!HAS_MARK.test(text)) return ctx.fillText(text, x, y)
  let at = x
  for (const part of scriptSegments(text)) {
    const look = scriptSize(part.script, size)
    ctx.font = fontFor(look.size)
    ctx.fillText(part.text, at, y + look.shift)
    at += measure(part.text, look.size, font, bold)
  }
  ctx.font = fontFor(size)
}

const escapeXml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const n = (value: number) => String(Math.round(value * 100) / 100)

/**
 * The inside of an SVG <text> for a marked text: one <tspan> per part, each on
 * the text's baseline `y` (so a shift never carries over), sub- and
 * superscripts smaller and moved with dy. Undefined for plain text.
 */
export function scriptSpans(text: string, size: number, y: number): string | undefined {
  if (!HAS_MARK.test(text)) return undefined
  return scriptSegments(text)
    .map((part) => {
      const look = scriptSize(part.script, size)
      const own = part.script === 'none' ? '' : ` font-size="${n(look.size)}" dy="${n(look.shift)}"`
      return `<tspan y="${n(y)}"${own}>${escapeXml(part.text)}</tspan>`
    })
    .join('')
}

/**
 * Keep sub- and superscripts in place when a chart text changes as plain text
 * (typed in a panel field or the data table): characters before and after the
 * change keep theirs; new ones take the script around them when both sides
 * share it. Texts given new runs of their own are left as they are.
 */
export function keepScripts(before: ChartData, after: ChartData): ChartData {
  let next = after
  for (const field of FIELDS) {
    const runs = after.textStyles?.[field]
    if (!runs?.length || before.textStyles?.[field] !== runs || before[field] === after[field]) continue
    next = { ...next, textStyles: { ...next.textStyles, [field]: shiftRuns(before[field], after[field], runs) } }
  }
  if (after.groups.some((g, i) => g.nameStyles?.length && g.nameStyles === before.groups[i]?.nameStyles && g.name !== before.groups[i]?.name)) {
    next = {
      ...next,
      groups: next.groups.map((g, i) => {
        const old = before.groups[i]
        return g.nameStyles?.length && old && g.nameStyles === old.nameStyles && g.name !== old.name ? { ...g, nameStyles: shiftRuns(old.name, g.name, g.nameStyles) } : g
      }),
    }
  }
  return next
}

/** Runs for `next`, made from the runs of `old` around the part that changed. */
export function shiftRuns(old: string, next: string, runs: readonly ScriptRun[]): ScriptRun[] | undefined {
  const a = [...old]
  const b = [...next]
  const scripts = scriptsOf(old, runs)
  let head = 0
  while (head < a.length && head < b.length && a[head] === b[head]) head++
  let tail = 0
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++
  const left = scripts[head - 1] ?? 'none'
  const right = scripts[a.length - tail] ?? 'none'
  const middle: Script = left === right ? left : 'none'
  const fresh = b.length - head - tail
  return runsOf(next, [...scripts.slice(0, head), ...Array<Script>(fresh).fill(middle), ...scripts.slice(a.length - tail)])
}
