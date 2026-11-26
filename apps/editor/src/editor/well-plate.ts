/**
 * Well plate maps (BIO-98): a 6- to 384-well plate seen from above, row
 * letters and column numbers round it, each well coloured by its condition,
 * and a legend that lists the conditions in use.
 *
 * The plate is one object that draws itself from its settings (`plate`), like
 * a table: no parts to keep in step, cheap to redraw while painting, and the
 * same drawing (`plateMarks`) gives the canvas, the exported SVG, the card in
 * the Blocks tool and the plain shapes left by Detach.
 *
 * Three looks (the owner kept all three drafts, 2026-11-26): Plate (a rim with
 * a cut corner and round wells), Grid (square cells like a heat map, legend
 * underneath) and Labelled (round wells with a short label inside, a dose
 * series shown as one shaded strip in the legend). One way of painting for
 * all three: pick a condition in the properties, then click or drag a box over
 * wells, or click a row letter or column number (FigureCanvas does that part).
 *
 * Resizing changes the wells' spacing (`pitch`); letters, numbers and the
 * legend keep their text size, so nothing ever stretches.
 */
import { Circle, FabricObject, IText, Path, Point, Rect, classRegistry, util, type FabricObject as FabricObjectType } from 'fabric'

import { DEFAULT_FONT, fontStack, loadFontFace } from './fonts'
import type { XY } from './geometry'

export type PlateLook = 'plate' | 'grid' | 'labelled'
export type WellCount = 6 | 12 | 24 | 48 | 96 | 384

export type PlateCondition = {
  id: string
  name: string
  /** A hex like "#0072b2". */
  colour: string
  /** The short label drawn inside its wells in the Labelled look, e.g. "0.1" or "V". */
  short: string
}

export type PlateSettings = {
  look: PlateLook
  wells: WellCount
  /** In legend order. */
  conditions: PlateCondition[]
  /** Each painted well ("A1", "H12") and the id of its condition; empty wells are left out. */
  map: Record<string, string>
  labels: boolean
  legend: boolean
  /** The distance from one well's middle to the next, in page pixels. */
  pitch: number
}

export const PLATE_SIZES: readonly { wells: WellCount; rows: number; cols: number }[] = [
  { wells: 6, rows: 2, cols: 3 },
  { wells: 12, rows: 3, cols: 4 },
  { wells: 24, rows: 4, cols: 6 },
  { wells: 48, rows: 6, cols: 8 },
  { wells: 96, rows: 8, cols: 12 },
  { wells: 384, rows: 16, cols: 24 },
]

export const PLATE_LOOKS: readonly { id: PlateLook; name: string }[] = [
  { id: 'plate', name: 'Plate' },
  { id: 'grid', name: 'Grid' },
  { id: 'labelled', name: 'Labelled' },
]

export const PITCH_RANGE = { min: 8, max: 96 }

const LETTERS = 'ABCDEFGHIJKLMNOP'
const INK = '#27272a'
const MUTED = '#71717a'
const EMPTY_EDGE = '#c4c4ca'
const RIM = { pad: 10, cut: 14, radius: 6, fill: '#fafafa', edge: '#a1a1aa', inner: '#e4e4e7' }
const LABEL = { room: 16, size: 10, weight: 600 }
const LEGEND = { size: 11, gap: 22, line: 19, swatch: 10 }

export const plateSize = (wells: WellCount) => PLATE_SIZES.find((size) => size.wells === wells) ?? { wells: 96 as const, rows: 8, cols: 12 }
export const wellName = (r: number, c: number) => `${LETTERS.charAt(r)}${c + 1}`

/** The colours a new condition takes, in order, skipping ones the plate already uses: the palette's own colours, then its soft tints. */
export const NEW_CONDITION_COLOURS = ['#e69f00', '#cc79a7', '#56b4e9', '#f0e442', '#332288', '#0072b2', '#009e73', '#d55e00', '#f2cf80', '#e6bcd3', '#abdaf4', '#9990c3']

/** A dose series on the plate a new block starts with (the owner's drafts): blanks round the edge, controls, four doses, a positive control. */
const START_CONDITIONS: readonly PlateCondition[] = [
  { id: 'blank', name: 'Blank (medium only)', colour: '#d4d4d8', short: 'B' },
  { id: 'untreated', name: 'Untreated', colour: '#009e73', short: 'U' },
  { id: 'vehicle', name: 'Vehicle (0.1% DMSO)', colour: '#80ceb9', short: 'V' },
  { id: 'dose-1', name: 'Drug 0.1 µM', colour: '#d1e6f1', short: '0.1' },
  { id: 'dose-2', name: 'Drug 1 µM', colour: '#80b8d8', short: '1' },
  { id: 'dose-3', name: 'Drug 10 µM', colour: '#0072b2', short: '10' },
  { id: 'dose-4', name: 'Drug 100 µM', colour: '#003959', short: '100' },
  { id: 'positive', name: 'Positive control', colour: '#d55e00', short: '+' },
]

/** Where a new plate's example conditions go: a column each, blanks round the edge of a 96-well plate. */
function startMap(wells: WellCount): Record<string, string> {
  const { rows, cols } = plateSize(wells)
  const map: Record<string, string> = {}
  if (wells === 96) {
    const byCol = ['blank', 'untreated', 'vehicle', 'dose-1', 'dose-2', 'dose-3', 'dose-4', 'positive', 'positive', '', '', 'blank']
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const edge = r === 0 || r === rows - 1
        const id = edge ? (c < 9 || c === 11 ? 'blank' : '') : (byCol.at(c) ?? '')
        if (id) map[wellName(r, c)] = id
      }
    }
    return map
  }
  const ids = START_CONDITIONS.filter((condition) => condition.id !== 'blank').map((condition) => condition.id)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const id = ids.at(Math.floor((c * ids.length) / cols))
      if (id) map[wellName(r, c)] = id
    }
  }
  return map
}

/** A new plate in one look, with the example dose series painted on it. */
export function startPlate(look: PlateLook, wells: WellCount = 96): PlateSettings {
  const map = startMap(wells)
  const used = new Set(Object.values(map))
  return {
    look,
    wells,
    conditions: START_CONDITIONS.filter((condition) => used.has(condition.id)).map((condition) => ({ ...condition })),
    map,
    labels: true,
    legend: true,
    pitch: wells === 96 ? 24 : Math.round((24 * 12) / plateSize(wells).cols),
  }
}

/* ---------- Colours ---------- */

function channels(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', '').slice(0, 6).padEnd(6, '0'), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** A darker edge for a filled well, so pale colours still read on white. */
export function wellEdge(hex: string): string {
  return `#${channels(hex)
    .map((v) => Math.round(v * 0.72).toString(16).padStart(2, '0'))
    .join('')}`
}

/** White text on dark wells, ink on light ones. */
export function textOn(hex: string): string {
  const [r, g, b] = channels(hex)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.55 ? '#ffffff' : INK
}

/* ---------- The drawing ---------- */

/** One thing the plate draws, in its own space (top-left corner at 0, 0). */
export type Mark =
  | { kind: 'circle'; cx: number; cy: number; r: number; fill: string; stroke?: string; width?: number; name: string }
  | { kind: 'rect'; x: number; y: number; w: number; h: number; rx: number; fill: string; stroke?: string; width?: number; name: string }
  | { kind: 'path'; d: string; fill: string; stroke: string; width: number; name: string }
  | { kind: 'text'; x: number; y: number; text: string; size: number; weight: number; fill: string; anchor: 'start' | 'middle' }

/** How wide a text is, in page pixels. */
export type Measure = (text: string, size: number, weight: number) => number

let measuring: CanvasRenderingContext2D | null | undefined
export const measureText: Measure = (text, size, weight) => {
  measuring ??= typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d')
  if (!measuring) return text.length * size * 0.55
  measuring.font = `${weight} ${size}px ${fontStack(DEFAULT_FONT)}`
  return measuring.measureText(text).width
}

/** The painted wells this plate size has (the map may also keep wells of a bigger size, hidden). */
export function wellsOnPlate(settings: Pick<PlateSettings, 'wells' | 'map'>): Record<string, string> {
  const { rows, cols } = plateSize(settings.wells)
  const shown: Record<string, string> = {}
  for (const [well, id] of Object.entries(settings.map)) {
    const r = LETTERS.indexOf(well.charAt(0))
    const c = Number(well.slice(1)) - 1
    if (r >= 0 && r < rows && c >= 0 && c < cols) shown[well] = id
  }
  return shown
}

/** A dose series in a condition's name: "Drug 10 µM" → base "Drug", dose "10", unit "µM". */
function doseOf(name: string): { base: string; dose: string; unit: string } | undefined {
  const found = /^(.*\S)\s+(\d+(?:[.,]\d+)?)\s*([^\d\s.,][^\s]*)$/.exec(name.trim())
  return found ? { base: found[1] ?? '', dose: found[2] ?? '', unit: found[3] ?? '' } : undefined
}

/** The legend's lines in the Labelled look: single conditions, and runs of doses of one thing as one strip. */
function legendGroups(conditions: readonly PlateCondition[]): ({ single: PlateCondition } | { title: string; steps: { condition: PlateCondition; dose: string }[] })[] {
  const groups: ({ single: PlateCondition } | { title: string; steps: { condition: PlateCondition; dose: string }[] })[] = []
  let run: { key: string; title: string; steps: { condition: PlateCondition; dose: string }[] } | undefined
  const close = () => {
    if (!run) return
    if (run.steps.length >= 2) groups.push({ title: run.title, steps: run.steps })
    else for (const step of run.steps) groups.push({ single: step.condition })
    run = undefined
  }
  for (const condition of conditions) {
    const dose = doseOf(condition.name)
    const key = dose ? `${dose.base}|${dose.unit}` : ''
    if (dose && run?.key === key) {
      run.steps.push({ condition, dose: dose.dose })
      continue
    }
    close()
    if (dose) run = { key, title: `${dose.base} (${dose.unit})`, steps: [{ condition, dose: dose.dose }] }
    else groups.push({ single: condition })
  }
  close()
  return groups
}

export type PlateGeometry = {
  rows: number
  cols: number
  pitch: number
  /** Top-left of well A1's square. */
  x0: number
  y0: number
  width: number
  height: number
}

/** While painting: the wells shown in the brush's colour (null: emptied), and the box being dragged. */
export type PaintPreview = { wells: ReadonlySet<string>; colour: string | null; box?: { r0: number; c0: number; r1: number; c1: number } }

/**
 * Everything the plate draws, in its own space, and where its wells are.
 * Only conditions with wells are in the legend.
 */
export function plateMarks(settings: PlateSettings, measure: Measure = measureText, preview?: PaintPreview): { marks: Mark[]; geometry: PlateGeometry } {
  const { rows, cols } = plateSize(settings.wells)
  const { look, pitch } = settings
  const room = settings.labels ? LABEL.room : 0
  const rim = look === 'grid' ? 0 : RIM.pad
  const x0 = rim + room
  const y0 = rim + room
  const bodyW = x0 + cols * pitch + rim
  const bodyH = y0 + rows * pitch + rim
  const marks: Mark[] = []

  if (look === 'plate') {
    const { cut, radius: k } = RIM
    marks.push({ kind: 'path', d: `M ${cut} 0 H ${bodyW - k} A ${k} ${k} 0 0 1 ${bodyW} ${k} V ${bodyH - k} A ${k} ${k} 0 0 1 ${bodyW - k} ${bodyH} H ${k} A ${k} ${k} 0 0 1 0 ${bodyH - k} V ${cut} Z`, fill: RIM.fill, stroke: RIM.edge, width: 1.2, name: 'Plate' })
    marks.push({ kind: 'rect', x: x0 - 3, y: y0 - 3, w: cols * pitch + 6, h: rows * pitch + 6, rx: 4, fill: 'none', stroke: RIM.inner, width: 0.8, name: 'Well area' })
  }
  if (look === 'labelled') marks.push({ kind: 'rect', x: 0, y: 0, w: bodyW, h: bodyH, rx: 8, fill: '#ffffff', stroke: '#d4d4d8', width: 1, name: 'Plate' })

  if (settings.labels) {
    const size = Math.min(LABEL.size, pitch * 0.8)
    const away = look === 'grid' ? 8 : 9
    for (let r = 0; r < rows; r++) marks.push({ kind: 'text', x: x0 - away, y: y0 + r * pitch + pitch / 2, text: LETTERS.charAt(r), size, weight: LABEL.weight, fill: MUTED, anchor: 'middle' })
    for (let c = 0; c < cols; c++) marks.push({ kind: 'text', x: x0 + c * pitch + pitch / 2, y: y0 - away, text: String(c + 1), size, weight: LABEL.weight, fill: MUTED, anchor: 'middle' })
  }

  const byId = new Map(settings.conditions.map((condition) => [condition.id, condition]))
  const inside = Math.min(11, pitch * 0.36)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const name = wellName(r, c)
      const previewed = preview?.wells.has(name)
      const condition = previewed ? undefined : byId.get(settings.map[name] ?? '')
      const fill = previewed ? preview?.colour : condition?.colour
      const cx = x0 + c * pitch + pitch / 2
      const cy = y0 + r * pitch + pitch / 2
      if (look === 'grid') {
        const side = pitch - Math.max(1, pitch * 0.08)
        marks.push({ kind: 'rect', x: cx - side / 2, y: cy - side / 2, w: side, h: side, rx: Math.min(2, side * 0.12), fill: fill ?? '#f4f4f5', name: `Well ${name}` })
      } else {
        marks.push({ kind: 'circle', cx, cy, r: pitch * (look === 'labelled' ? 0.44 : 0.4), fill: fill ?? '#ffffff', stroke: fill ? wellEdge(fill) : EMPTY_EDGE, width: look === 'labelled' ? 1 : 0.9, name: `Well ${name}` })
        if (look === 'labelled' && condition?.short && pitch >= 14) {
          const size = condition.short.length > 2 ? inside * 0.82 : inside
          marks.push({ kind: 'text', x: cx, y: cy, text: condition.short, size, weight: 600, fill: textOn(condition.colour), anchor: 'middle' })
        }
      }
    }
  }

  let width = bodyW
  let height = bodyH
  if (settings.legend) {
    const used = new Set(Object.values(wellsOnPlate(settings)))
    const shown = settings.conditions.filter((condition) => used.has(condition.id))
    const legend = legendMarks(look, shown, measure, look === 'grid' ? { x: x0, y: bodyH + 14, wrap: cols * pitch } : { x: bodyW + LEGEND.gap, y: y0 + 6, wrap: Infinity })
    marks.push(...legend.marks)
    width = Math.max(width, legend.right)
    height = Math.max(height, legend.bottom)
  }

  if (preview?.box) {
    const { r0, c0, r1, c1 } = preview.box
    marks.push({ kind: 'rect', x: x0 + Math.min(c0, c1) * pitch, y: y0 + Math.min(r0, r1) * pitch, w: (Math.abs(c1 - c0) + 1) * pitch, h: (Math.abs(r1 - r0) + 1) * pitch, rx: 0, fill: 'rgba(37,99,235,0.06)', stroke: '#2563eb', width: 1, name: 'Paint box' })
  }
  return { marks, geometry: { rows, cols, pitch, x0, y0, width, height } }
}

function legendMarks(look: PlateLook, shown: readonly PlateCondition[], measure: Measure, at: { x: number; y: number; wrap: number }): { marks: Mark[]; right: number; bottom: number } {
  const marks: Mark[] = []
  const text = (x: number, y: number, words: string, weight = 400, fill = INK, size = LEGEND.size, anchor: 'start' | 'middle' = 'start') => marks.push({ kind: 'text', x, y, text: words, size, weight, fill, anchor })
  const s = LEGEND.swatch
  let right = at.x
  let bottom = at.y
  if (shown.length === 0) return { marks, right, bottom }

  if (look === 'grid') {
    // Side by side under the plate, wrapping at the plate's width.
    let x = at.x
    let y = at.y + s / 2
    for (const condition of shown) {
      const w = s + 5 + measure(condition.name, LEGEND.size, 400)
      if (x > at.x && x + w > at.x + at.wrap) {
        x = at.x
        y += LEGEND.line - 1
      }
      marks.push({ kind: 'rect', x, y: y - s / 2, w: s, h: s, rx: 1.5, fill: condition.colour, name: `Legend ${condition.name}` })
      text(x + s + 5, y, condition.name)
      right = Math.max(right, x + w)
      x += w + 14
    }
    return { marks, right, bottom: y + s / 2 + 2 }
  }

  if (look === 'labelled') {
    let y = at.y + 2
    for (const group of legendGroups(shown)) {
      if ('single' in group) {
        const { single: condition } = group
        marks.push({ kind: 'circle', cx: at.x + 8, cy: y, r: 8, fill: condition.colour, stroke: wellEdge(condition.colour), width: 0.8, name: `Legend ${condition.name}` })
        if (condition.short) text(at.x + 8, y, condition.short, 600, textOn(condition.colour), condition.short.length > 2 ? 6 : 7.5, 'middle')
        text(at.x + 22, y, condition.name)
        right = Math.max(right, at.x + 22 + measure(condition.name, LEGEND.size, 400))
        bottom = y + 9
        y += 22
        continue
      }
      // A dose series: its name, a strip of its colours, the doses under it.
      y += 2
      text(at.x, y, group.title, 600)
      const step = 26
      group.steps.forEach(({ condition, dose }, i) => {
        marks.push({ kind: 'rect', x: at.x + i * step, y: y + 10, w: step, h: 12, rx: 0, fill: condition.colour, name: `Legend ${condition.name}` })
        text(at.x + i * step + step / 2, y + 32, dose, 400, MUTED, 9.5, 'middle')
      })
      marks.push({ kind: 'rect', x: at.x, y: y + 10, w: group.steps.length * step, h: 12, rx: 0, fill: 'none', stroke: '#a1a1aa', width: 0.6, name: 'Legend strip outline' })
      right = Math.max(right, at.x + measure(group.title, LEGEND.size, 600), at.x + group.steps.length * step)
      bottom = y + 38
      y += 48
    }
    return { marks, right, bottom }
  }

  shown.forEach((condition, i) => {
    const y = at.y + i * LEGEND.line
    marks.push({ kind: 'circle', cx: at.x + s / 2, cy: y, r: s / 2, fill: condition.colour, stroke: wellEdge(condition.colour), width: 0.8, name: `Legend ${condition.name}` })
    text(at.x + s + 6, y, condition.name)
    right = Math.max(right, at.x + s + 6 + measure(condition.name, LEGEND.size, 400))
    bottom = y + s / 2 + 2
  })
  return { marks, right, bottom }
}

/** Where a text's baseline goes so its middle is at `y` (canvas and SVG alike, without relying on "middle" baselines). */
const baseline = (y: number, size: number) => y + size * 0.36

const esc = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** The marks as SVG elements, moved by `at`. */
export function marksSvg(marks: readonly Mark[], at: XY = { x: 0, y: 0 }): string {
  const font = esc(fontStack(DEFAULT_FONT))
  return marks
    .map((mark) => {
      const edge = 'stroke' in mark && mark.stroke ? ` stroke="${mark.stroke}" stroke-width="${mark.width ?? 1}"` : ''
      switch (mark.kind) {
        case 'circle':
          return `<circle cx="${mark.cx + at.x}" cy="${mark.cy + at.y}" r="${mark.r}" fill="${mark.fill}"${edge}/>`
        case 'rect':
          return `<rect x="${mark.x + at.x}" y="${mark.y + at.y}" width="${mark.w}" height="${mark.h}" rx="${mark.rx}" fill="${mark.fill}"${edge}/>`
        case 'path':
          return `<path transform="translate(${at.x} ${at.y})" d="${mark.d}" fill="${mark.fill}"${edge}/>`
        case 'text':
          return `<text x="${mark.x + at.x}" y="${baseline(mark.y, mark.size) + at.y}" font-family="${font}" font-size="${mark.size}" font-weight="${mark.weight}" fill="${mark.fill}"${mark.anchor === 'middle' ? ' text-anchor="middle"' : ''}>${esc(mark.text)}</text>`
      }
    })
    .join('')
}

/** A plate as a picture for its card in the Blocks tool (the example dose series), cropped to itself. */
export function plateSvg(look: PlateLook, wells: WellCount = 96): string {
  // Smaller wells and no legend, so the plate fills the card.
  const settings = { ...startPlate(look, wells), legend: false, labels: false }
  const { marks, geometry } = plateMarks(settings, (text, size) => text.length * size * 0.55)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 ${geometry.width + 4} ${geometry.height + 4}" width="100%" height="100%" aria-hidden="true">${marksSvg(marks)}</svg>`
}

/** Draws one mark on a canvas, in the space the marks are in. */
export function drawMark(ctx: CanvasRenderingContext2D, mark: Mark): void {
  if (mark.kind === 'text') {
    ctx.font = `${mark.weight} ${mark.size}px ${fontStack(DEFAULT_FONT)}`
    ctx.fillStyle = mark.fill
    ctx.textAlign = mark.anchor === 'middle' ? 'center' : 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(mark.text, mark.x, baseline(mark.y, mark.size))
    return
  }
  ctx.beginPath()
  if (mark.kind === 'circle') ctx.arc(mark.cx, mark.cy, mark.r, 0, Math.PI * 2)
  if (mark.kind === 'rect') ctx.roundRect(mark.x, mark.y, mark.w, mark.h, mark.rx)
  const path = mark.kind === 'path' && typeof Path2D !== 'undefined' ? new Path2D(mark.d) : undefined
  if (mark.fill !== 'none') {
    ctx.fillStyle = mark.fill
    if (path) ctx.fill(path)
    else ctx.fill()
  }
  if (mark.stroke) {
    ctx.strokeStyle = mark.stroke
    ctx.lineWidth = mark.width ?? 1
    if (mark.name === 'Paint box') ctx.setLineDash([4, 3])
    if (path) ctx.stroke(path)
    else ctx.stroke()
    ctx.setLineDash([])
  }
}

/* ---------- The object ---------- */

export class WellPlate extends FabricObject {
  static type = 'WellPlate'

  declare plate: PlateSettings
  /** While painting: what the wells under the drag will become. Not saved. */
  preview: PaintPreview | undefined
  private geometry: PlateGeometry

  constructor(options: Record<string, unknown> & { plate: PlateSettings }) {
    super(options as Record<string, unknown>)
    this.plate = { ...options.plate, conditions: options.plate.conditions.map((condition) => ({ ...condition })), map: { ...options.plate.map } }
    this.geometry = plateMarks(this.plate).geometry
    this.set({ width: this.geometry.width, height: this.geometry.height, fill: null, stroke: null, strokeWidth: 0, objectCaching: false, lockRotation: true, lockSkewingX: true, lockSkewingY: true })
    this.setControlsVisibility({ mtr: false, ml: false, mr: false, mt: false, mb: false })
    void Promise.all([loadFontFace(DEFAULT_FONT, 400, false), loadFontFace(DEFAULT_FONT, 600, false)]).then(() => {
      this.refresh()
      this.canvas?.requestRenderAll()
    })
  }

  /** New settings, keeping the top-left corner where it is. */
  setPlate(change: Partial<PlateSettings>): void {
    this.plate = { ...this.plate, ...change }
    this.refresh()
  }

  /** Measure again (after a change or once the font has loaded), keeping the top-left corner where it is. */
  refresh(): void {
    const corner = this.getPointByOrigin('left', 'top')
    this.geometry = plateMarks(this.plate).geometry
    this.set({ width: this.geometry.width, height: this.geometry.height, dirty: true })
    this.setPositionByOrigin(corner, 'left', 'top')
    this.setCoords()
  }

  get plateGeometry(): PlateGeometry {
    return this.geometry
  }

  /** A page point in the plate's own space (top-left corner at 0, 0). */
  toPlateSpace(point: XY): XY {
    const local = util.transformPoint(new Point(point.x, point.y), util.invertTransform(this.calcTransformMatrix()))
    return { x: local.x + this.width / 2, y: local.y + this.height / 2 }
  }

  /** The well under a page point, its row letter or its column number. */
  partAt(point: XY): { well: { r: number; c: number } } | { row: number } | { col: number } | undefined {
    const { x, y } = this.toPlateSpace(point)
    const { x0, y0, pitch, rows, cols } = this.geometry
    const c = Math.floor((x - x0) / pitch)
    const r = Math.floor((y - y0) / pitch)
    const inRows = r >= 0 && r < rows
    const inCols = c >= 0 && c < cols
    if (inRows && inCols) return { well: { r, c } }
    if (!this.plate.labels) return undefined
    if (inRows && x < x0 && x >= x0 - LABEL.room - 2) return { row: r }
    if (inCols && y < y0 && y >= y0 - LABEL.room - 2) return { col: c }
    return undefined
  }

  /** The nearest well to a page point, for a drag that runs off the plate. */
  nearestWell(point: XY): { r: number; c: number } {
    const { x, y } = this.toPlateSpace(point)
    const { x0, y0, pitch, rows, cols } = this.geometry
    const clamp = (v: number, n: number) => Math.max(0, Math.min(n - 1, v))
    return { r: clamp(Math.floor((y - y0) / pitch), rows), c: clamp(Math.floor((x - x0) / pitch), cols) }
  }

  _render(ctx: CanvasRenderingContext2D): void {
    const { marks } = plateMarks(this.plate, measureText, this.preview)
    ctx.save()
    ctx.translate(-this.width / 2, -this.height / 2)
    for (const mark of marks) drawMark(ctx, mark)
    ctx.restore()
  }

  _toSVG(): string[] {
    const { marks } = plateMarks(this.plate)
    return [`<g opacity="${this.opacity}">\n`, marksSvg(marks, { x: -this.width / 2, y: -this.height / 2 }), '</g>\n']
  }

  toObject<T extends Omit<Record<string, unknown>, keyof this>, K extends keyof T = never>(propertiesToInclude: K[] = []): Record<string, unknown> {
    return super.toObject([...propertiesToInclude, 'plate'] as K[]) as Record<string, unknown>
  }
}
classRegistry.setClass(WellPlate)

export const isWellPlate = (object: FabricObjectType | undefined): object is WellPlate => object instanceof WellPlate

/** A new plate in one look, its middle at `centre`. */
export function buildPlate(look: PlateLook, centre: XY, wells: WellCount = 96): WellPlate {
  const plate = new WellPlate({ plate: startPlate(look, wells) })
  plate.set({ left: centre.x - plate.width / 2, top: centre.y - plate.height / 2 })
  plate.setCoords()
  return plate
}

/**
 * While a handle is dragged: the stretch goes into the wells' spacing, the
 * text keeps its size, and the side or corner Fabric holds still stays put.
 */
export function bakePlateScale(plate: WellPlate, originX: 'left' | 'center' | 'right' = 'center', originY: 'top' | 'center' | 'bottom' = 'center'): void {
  const { scaleX: sx, scaleY: sy } = plate
  if (sx === 1 && sy === 1) return
  const { cols, rows, pitch } = plate.plateGeometry
  const fromWidth = (plate.width * Math.abs(sx) - (plate.width - cols * pitch)) / cols
  const fromHeight = (plate.height * Math.abs(sy) - (plate.height - rows * pitch)) / rows
  const next = sx === 1 ? fromHeight : sy === 1 ? fromWidth : (fromWidth + fromHeight) / 2
  const pinned = plate.getPointByOrigin(originX, originY)
  plate.set({ scaleX: 1, scaleY: 1 })
  plate.setPlate({ pitch: Math.max(PITCH_RANGE.min, Math.min(PITCH_RANGE.max, next)) })
  plate.setPositionByOrigin(pinned, originX, originY)
  plate.setCoords()
}

/**
 * A new plate size; the plate keeps about its width. The map is kept whole:
 * wells a smaller plate doesn't have keep their condition, hidden, so going
 * back to the bigger plate shows them again (owner's feedback, 2026-11-26).
 */
export function resizedPlate(settings: PlateSettings, wells: WellCount): Partial<PlateSettings> {
  const { cols } = plateSize(wells)
  const before = plateSize(settings.wells)
  const pitch = Math.max(PITCH_RANGE.min, Math.min(PITCH_RANGE.max, (settings.pitch * before.cols) / cols))
  return { wells, pitch }
}

/** The plate drawn as plain shapes and text where it is, for Detach. */
export function detachedPlateParts(plate: WellPlate): FabricObjectType[] {
  const corner = plate.getPointByOrigin('left', 'top')
  const { marks } = plateMarks(plate.plate)
  return marks.map((mark) => markObject(mark, corner))
}

/** One mark as a plain shape or text on the page, its space's top-left corner at `corner` (for Detach). */
export function markObject(mark: Mark, corner: XY): FabricObjectType {
  switch (mark.kind) {
    case 'circle':
      return Object.assign(new Circle({ left: corner.x + mark.cx - mark.r, top: corner.y + mark.cy - mark.r, radius: mark.r, fill: mark.fill, stroke: mark.stroke ?? null, strokeWidth: mark.width ?? 0 }), { name: mark.name })
    case 'rect':
      return Object.assign(new Rect({ left: corner.x + mark.x, top: corner.y + mark.y, width: mark.w, height: mark.h, rx: mark.rx, ry: mark.rx, fill: mark.fill === 'none' ? '' : mark.fill, stroke: mark.stroke ?? null, strokeWidth: mark.width ?? 0 }), { name: mark.name })
    case 'path': {
      const path = new Path(mark.d, { fill: mark.fill === 'none' ? '' : mark.fill, stroke: mark.stroke, strokeWidth: mark.width })
      // A path is placed by the top-left corner of its own outline, not its space's.
      const own = path.pathOffset
      path.set({ left: corner.x + own.x - path.width / 2 - mark.width / 2, top: corner.y + own.y - path.height / 2 - mark.width / 2 })
      return Object.assign(path, { name: mark.name })
    }
    case 'text': {
      const text = new IText(mark.text, { fontFamily: fontStack(DEFAULT_FONT), fontSize: mark.size, fontWeight: mark.weight, fill: mark.fill, strokeWidth: 0 })
      const left = mark.anchor === 'middle' ? mark.x - text.width / 2 : mark.x
      text.set({ left: corner.x + left, top: corner.y + mark.y - text.height / 2 })
      return Object.assign(text, { name: mark.text })
    }
  }
}
