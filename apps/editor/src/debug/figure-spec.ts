/*
 * The figure spec: a short JSON description of a figure that the figure
 * builder (figure-builder.ts) turns into a real figure in the editor. This file
 * holds the spec's shape, its checks (clear errors for typos) and the small
 * text markup. It knows nothing about Fabric, so it is easy to test.
 *
 * Development only; see example-figures/README.md for the format.
 */
import { ARROW_PRESETS, SHAPES, type EndKind, type LineStyle, type MidMark, type Route, type ShapeKind } from '@biofigure-lab/ui/lib/arrow-geometry'
import { type ChartKind } from '@biofigure-lab/ui/lib/graph-kinds'

import type { ErrorBars } from '../editor/chart-model'
import type { StatTest } from '../editor/chart-stats'
import { PX_PER_MM } from '../editor/units'

export class SpecError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SpecError'
  }
}

// ---------- pages ----------

/** Page sizes a spec can name, in millimetres. The first three are the app's own presets (page-size.ts). */
export const PAGE_SIZES: Record<string, { width: number; height: number }> = {
  single: { width: 85, height: 60 },
  'one-and-half': { width: 114, height: 80 },
  double: { width: 174, height: 120 },
  // Landscape A4, and a 16:9 slide that is exactly 1280 x 720 px.
  a4: { width: 297, height: 210 },
  'a4-portrait': { width: 210, height: 297 },
  slide: { width: 338.667, height: 190.5 },
}

/** Page: a preset name, or a preset with its height or width changed, or a size in mm, or a size in px. */
export type PageSpec = string | { preset?: string; width?: number; height?: number } | { px: [number, number] }

export function pageMm(page: PageSpec | undefined): { width: number; height: number } {
  const size = (name: string) => {
    const found = PAGE_SIZES[name]
    if (!found) throw new SpecError(`page: unknown preset "${name}". Use one of: ${Object.keys(PAGE_SIZES).join(', ')}`)
    return found
  }
  if (page === undefined) return size('double')
  if (typeof page === 'string') return size(page)
  if ('px' in page) return { width: page.px[0] / PX_PER_MM, height: page.px[1] / PX_PER_MM }
  const base = size(page.preset ?? 'double')
  return { width: page.width ?? base.width, height: page.height ?? base.height }
}

// ---------- objects ----------

type Common = { id?: string; name?: string; rotation?: number; opacity?: number }
/** Where an object sits, in page pixels: top-left (`x`, `y`) or centre (`cx`, `cy`). */
type Place = { x?: number; y?: number; cx?: number; cy?: number }

export type IconSpec = Common & Place & { type: 'icon'; icon: string; width: number; flip?: 'x' | 'y' | 'xy'; color?: string }
export type ShapeSpec = Common &
  Place & {
    type: 'shape'
    kind: ShapeKind
    width: number
    height: number
    fill?: string
    stroke?: string
    strokeWidth?: number
    cornerRadius?: number
    /** Text inside the shape (see the markup). */
    text?: string
    fontSize?: number
    font?: string
    weight?: number
    bold?: boolean
    italic?: boolean
    textColor?: string
    align?: 'left' | 'center' | 'right'
    lineSpacing?: number
    /** What happens when the text is too long: the shape grows, the lines wrap (default) or the text shrinks. */
    fit?: 'grow' | 'wrap' | 'shrink'
  }
export type TextSpec = Common &
  Place & {
    type: 'text'
    text: string
    fontSize?: number
    font?: string
    weight?: number
    bold?: boolean
    italic?: boolean
    color?: string
    align?: 'left' | 'center' | 'right'
    lineSpacing?: number
    /** A width makes the text wrap and gives `align` something to line up against. */
    width?: number
  }
export type PointSpec = { x: number; y: number }
export type ArrowSpec = Common & {
  type: 'arrow'
  /** The id of an object (the arrow sticks to it), or a point on the page. */
  from: string | PointSpec
  to: string | PointSpec
  /** A name from the Arrows panel (see ARROW_PRESETS); `start`, `end` and `mid` change single parts of it. */
  preset?: string
  route?: Route
  line?: LineStyle
  /** Shorthand for `line: "dashed"`. */
  dashed?: boolean
  start?: EndKind
  end?: EndKind
  mid?: MidMark
  /** How far a curved arrow bows, -0.5 to 0.5 (0.2 is the classic bow, negative bows the other way); `"auto"` (the default) softens it on diagonals. */
  bend?: number | 'auto'
  color?: string
  width?: number
}
export type ChartSpec = Common &
  Place & {
    type: 'chart'
    kind: ChartKind
    width: number
    height: number
    errorBars?: ErrorBars
    /** Groups of replicate values (columns of the data table). Empty cells are null. */
    groups?: { name: string; values: (number | null)[] }[]
    /** The same as a table: a header row with the group names, then one row per replicate. */
    table?: (string | number | null)[][]
    colours?: string[]
    title?: string
    xTitle?: string
    yTitle?: string
    yUnit?: string
    yMin?: number | null
    yMax?: number | null
    tickLabels?: boolean
    legend?: boolean
    fontFamily?: string
    fontSize?: number
    axisColour?: string
    titlePosition?: 'top' | 'bottom'
    titleAlign?: 'left' | 'center' | 'right'
    caption?: string
    barWidth?: number
    test?: StatTest
    showNs?: boolean
    /** A dot in each group's colour at the feet of the brackets; on unless set to false. */
    colouredBrackets?: boolean
    testNote?: boolean
  }

export type ObjectSpec = IconSpec | ShapeSpec | TextSpec | ArrowSpec | ChartSpec

export type FigureSpec = { name: string; page?: PageSpec; objects: ObjectSpec[] }

const COMMON = ['type', 'id', 'name', 'rotation', 'opacity']
const PLACE = ['x', 'y', 'cx', 'cy']
const KEYS: Record<ObjectSpec['type'], string[]> = {
  icon: [...COMMON, ...PLACE, 'icon', 'width', 'flip', 'color'],
  shape: [...COMMON, ...PLACE, 'kind', 'width', 'height', 'fill', 'stroke', 'strokeWidth', 'cornerRadius', 'text', 'fontSize', 'font', 'weight', 'bold', 'italic', 'textColor', 'align', 'lineSpacing', 'fit'],
  text: [...COMMON, ...PLACE, 'text', 'fontSize', 'font', 'weight', 'bold', 'italic', 'color', 'align', 'lineSpacing', 'width'],
  arrow: [...COMMON, 'from', 'to', 'preset', 'route', 'line', 'dashed', 'start', 'end', 'mid', 'bend', 'color', 'width'],
  chart: [
    ...COMMON, ...PLACE, 'kind', 'width', 'height', 'errorBars', 'groups', 'table', 'colours', 'title', 'xTitle', 'yTitle', 'yUnit', 'yMin', 'yMax', 'tickLabels', 'legend', 'fontFamily', 'fontSize',
    'axisColour', 'titlePosition', 'titleAlign', 'caption', 'barWidth', 'test', 'showNs', 'colouredBrackets', 'testNote',
  ],
}

/** Spelling the American way is fine too. */
const ALIASES: Record<string, string> = { colour: 'color', colours: 'colours', textColour: 'textColor', axisColor: 'axisColour', colors: 'colours' }

const ARROW_ENDS: EndKind[] = ['none', 'open', 'filled', 'activation', 'inhibition', 'catalysis', 'binding', 'half', 'synapse', 'axon']
export const CHART_KINDS: ChartKind[] = [
  'bar', 'line', 'scatter', 'point', 'slope', 'dots-bars', 'before-after', 'dots-spread', 'dots-box', 'dots-violin', 'floating', 'box', 'violin',
  'bar-h', 'point-h', 'floating-h', 'box-h', 'violin-h',
]
export const ERROR_BARS: ErrorBars[] = ['sd', 'sem', 'ci95', 'ci90', 'ci99', 'sd2', 'sem2', 'range', 'iqr', 'mad', 'none']

export const shapeKinds = (): string[] => SHAPES.map((shape) => shape.id)

const levenshtein = (a: string, b: string): number => {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0] ?? 0
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const above = row[j] ?? 0
      row[j] = Math.min(above + 1, (row[j - 1] ?? 0) + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1))
      diagonal = above
    }
  }
  return row[b.length] ?? 0
}

/** The word of `choices` closest to `word`, for "did you mean". */
const closest = (word: string, choices: readonly string[]): string | undefined => {
  const best = choices.map((choice) => [choice, levenshtein(word.toLowerCase(), choice.toLowerCase())] as const).sort((a, b) => a[1] - b[1])[0]
  return best && best[1] <= Math.max(2, Math.floor(word.length / 3)) ? best[0] : undefined
}

const oneOf = (where: string, key: string, value: unknown, choices: readonly string[]) => {
  if (typeof value === 'string' && choices.includes(value)) return
  const guess = typeof value === 'string' ? closest(value, choices) : undefined
  throw new SpecError(`${where}: "${key}" is ${JSON.stringify(value)}; use one of: ${choices.join(', ')}${guess ? ` (did you mean "${guess}"?)` : ''}`)
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

function needNumber(where: string, key: string, value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new SpecError(`${where}: "${key}" must be a number, not ${JSON.stringify(value)}`)
}

/**
 * Checks a parsed spec and returns it with the colour spellings made the same.
 * Errors name the object (by number, and id when it has one) and the key.
 */
export function parseSpec(raw: unknown): FigureSpec {
  if (!isRecord(raw)) throw new SpecError('The spec must be a JSON object with "name" and "objects"')
  if (typeof raw.name !== 'string' || raw.name.trim() === '') throw new SpecError('The spec needs a "name" (it names the figure and its files)')
  if (!Array.isArray(raw.objects)) throw new SpecError('The spec needs an "objects" list')
  for (const key of Object.keys(raw)) if (!['name', 'page', 'objects', 'comment'].includes(key)) throw new SpecError(`Unknown top-level key "${key}"`)
  pageMm(raw.page as PageSpec | undefined)
  const ids = new Set<string>()
  const objects = raw.objects.map((item: unknown, index): ObjectSpec => {
    if (!isRecord(item)) throw new SpecError(`objects[${index}] must be an object`)
    const label = `objects[${index}]${typeof item.id === 'string' ? ` "${item.id}"` : ''}`
    const type = item.type
    if (typeof type !== 'string' || !(type in KEYS)) throw new SpecError(`${label}: "type" must be one of: ${Object.keys(KEYS).join(', ')}`)
    const allowed = KEYS[type as ObjectSpec['type']]
    const object: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(item)) {
      const name = ALIASES[key] ?? key
      if (key === 'comment') continue
      if (!allowed.includes(name)) {
        const guess = closest(key, allowed)
        throw new SpecError(`${label} (${type}): unknown key "${key}"${guess ? `; did you mean "${guess}"?` : `; allowed: ${allowed.join(', ')}`}`)
      }
      object[name] = value
    }
    if (typeof object.id === 'string') {
      if (ids.has(object.id)) throw new SpecError(`${label}: the id "${object.id}" is used twice`)
      ids.add(object.id)
    }
    checkObject(label, object as ObjectSpec)
    return object as ObjectSpec
  })
  for (const [index, object] of objects.entries()) {
    if (object.type !== 'arrow') continue
    for (const end of ['from', 'to'] as const) {
      const value = object[end]
      if (typeof value === 'string' && !ids.has(value)) {
        const guess = closest(value, [...ids])
        throw new SpecError(`objects[${index}] (arrow): "${end}" is "${value}", but no object has that id${guess ? `; did you mean "${guess}"?` : ''}`)
      }
    }
  }
  return { name: raw.name, page: raw.page as PageSpec | undefined, objects }
}

function checkPlace(label: string, o: Place, centreOnly = false) {
  const hasTopLeft = o.x !== undefined || o.y !== undefined
  const hasCentre = o.cx !== undefined || o.cy !== undefined
  if (hasTopLeft && hasCentre) throw new SpecError(`${label}: use either x/y (top-left) or cx/cy (centre), not both`)
  for (const key of ['x', 'y', 'cx', 'cy'] as const) if (o[key] !== undefined) needNumber(label, key, o[key])
  const ok = hasCentre ? o.cx !== undefined && o.cy !== undefined : o.x !== undefined && o.y !== undefined
  if (!ok) throw new SpecError(`${label}: give both x and y (top-left)${centreOnly ? '' : ', or both cx and cy (centre)'}`)
}

function checkObject(label: string, o: ObjectSpec) {
  if (o.rotation !== undefined) needNumber(label, 'rotation', o.rotation)
  if (o.opacity !== undefined) needNumber(label, 'opacity', o.opacity)
  switch (o.type) {
    case 'icon':
      if (typeof o.icon !== 'string') throw new SpecError(`${label}: "icon" must be a library id such as "cells/t-cell-simple-flat"`)
      checkPlace(label, o)
      needNumber(label, 'width', o.width)
      if (o.flip !== undefined) oneOf(label, 'flip', o.flip, ['x', 'y', 'xy'])
      return
    case 'shape':
      oneOf(label, 'kind', o.kind, shapeKinds())
      checkPlace(label, o)
      needNumber(label, 'width', o.width)
      needNumber(label, 'height', o.height)
      if (o.align !== undefined) oneOf(label, 'align', o.align, ['left', 'center', 'right'])
      if (o.fit !== undefined) oneOf(label, 'fit', o.fit, ['grow', 'wrap', 'shrink'])
      if (o.text !== undefined) parseMarkup(o.text, label)
      if (o.text !== undefined && (o.kind === 'membrane')) throw new SpecError(`${label}: a membrane takes no text`)
      return
    case 'text':
      if (typeof o.text !== 'string') throw new SpecError(`${label}: "text" must be a string`)
      parseMarkup(o.text, label)
      checkPlace(label, o)
      if (o.align !== undefined) oneOf(label, 'align', o.align, ['left', 'center', 'right'])
      return
    case 'arrow': {
      for (const end of ['from', 'to'] as const) {
        const value = o[end]
        const point = isRecord(value) && typeof value.x === 'number' && typeof value.y === 'number'
        if (typeof value !== 'string' && !point) throw new SpecError(`${label}: "${end}" must be an object id or a point like {"x": 10, "y": 20}`)
      }
      if (o.preset !== undefined) oneOf(label, 'preset', o.preset, ARROW_PRESETS.map((preset) => preset.id))
      if (o.route !== undefined) oneOf(label, 'route', o.route, ['straight', 'curved', 'elbow'])
      if (o.line !== undefined) oneOf(label, 'line', o.line, ['solid', 'dashed', 'dotted'])
      if (o.start !== undefined) oneOf(label, 'start', o.start, ARROW_ENDS)
      if (o.end !== undefined) oneOf(label, 'end', o.end, ARROW_ENDS)
      if (o.mid !== undefined) oneOf(label, 'mid', o.mid, ['none', 'tick'])
      if (o.bend !== undefined && o.bend !== 'auto' && !(typeof o.bend === 'number' && o.bend >= -0.5 && o.bend <= 0.5)) throw new SpecError(`${label}: "bend" must be "auto" or a number from -0.5 to 0.5`)
      return
    }
    case 'chart':
      oneOf(label, 'kind', o.kind, CHART_KINDS)
      checkPlace(label, o)
      needNumber(label, 'width', o.width)
      needNumber(label, 'height', o.height)
      if (o.errorBars !== undefined) oneOf(label, 'errorBars', o.errorBars, ERROR_BARS)
      if (!o.groups && !o.table) throw new SpecError(`${label}: give the data as "groups" or "table"`)
      if (o.groups && o.table) throw new SpecError(`${label}: give the data as "groups" or "table", not both`)
      return
  }
}

// ---------- text markup ----------

export type Run = { text: string; italic?: boolean; bold?: boolean; script?: 'sub' | 'super' }

/**
 * The spec's text markup, as runs of text with their own look:
 *   `*italic*`  `**bold**`  `H_{2}O` (subscript)  `Ca^{2+}` (superscript)
 * A backslash makes the next character plain: `\*`, `\^`, `\_`, `\\`.
 * Scripts can hold `*italic*`/`**bold**` but not another script.
 */
export function parseMarkup(source: string, where = 'text'): Run[] {
  const runs: Run[] = []
  const add = (text: string, look: Omit<Run, 'text'>) => {
    if (text === '') return
    const last = runs.at(-1)
    if (last && last.italic === look.italic && last.bold === look.bold && last.script === look.script) last.text += text
    else runs.push({ text, ...look })
  }
  const walk = (text: string, script: Run['script'], inScript: boolean) => {
    let italic = false
    let bold = false
    const look = (): Omit<Run, 'text'> => ({ ...(italic && { italic: true }), ...(bold && { bold: true }), ...(script && { script }) })
    let plain = ''
    const flush = () => {
      add(plain, look())
      plain = ''
    }
    for (let i = 0; i < text.length; i++) {
      const char = text.charAt(i)
      if (char === '\\' && i + 1 < text.length) {
        plain += text.charAt(++i)
      } else if (char === '*') {
        flush()
        if (text.charAt(i + 1) === '*') {
          bold = !bold
          i++
        } else italic = !italic
      } else if ((char === '^' || char === '_') && text.charAt(i + 1) === '{') {
        if (inScript) throw new SpecError(`${where}: a ${char === '^' ? 'superscript' : 'subscript'} can't sit inside another script ("${source}")`)
        const close = text.indexOf('}', i + 2)
        if (close === -1) throw new SpecError(`${where}: "${char}{" is never closed with "}" in "${source}"`)
        flush()
        // The script's text takes the italic and bold that are on around it.
        const inner = text.slice(i + 2, close)
        const around = { italic, bold }
        const start = runs.length
        walk(inner, char === '^' ? 'super' : 'sub', true)
        for (const run of runs.slice(start)) {
          if (around.italic) run.italic = true
          if (around.bold) run.bold = true
        }
        i = close
      } else plain += char
    }
    if (italic || bold) throw new SpecError(`${where}: a "*" is never closed in "${source}" (write \\* for a plain asterisk)`)
    flush()
  }
  walk(source, undefined, false)
  return runs
}

/** The characters of some markup without its marks. */
export const plainText = (runs: readonly Run[]): string => runs.map((run) => run.text).join('')
