/**
 * Legends / keys (BIO-106): rows of an icon or a colour square next to a
 * label, down or across. Three looks, all offered (the owner, 2026-11-26,
 * from the drafts in packages/ui/src/drafts/legend-block/):
 *
 *   Plain key  no frame: marker, label, next row
 *   Boxed key  a white card with a header in the block colour, a thin line
 *              between rows, icons on a pale round tile
 *   Chips      each row a rounded chip tinted in its own colour (icon rows
 *              in the block colour)
 *
 * Like the well plate, a legend is one object that draws itself from its
 * settings (`legend`): the same marks give the canvas, the exported SVG, the
 * card pictures and the plain shapes Detach leaves. An icon row keeps its
 * icon's SVG text, so a saved figure draws without the library; it is drawn
 * on the canvas as a picture of that SVG (sharp at any zoom) and exported as
 * vector.
 *
 * Resizing (corners only) changes `size`, the text size everything else is
 * measured from, on every step, so nothing ever stretches.
 */
import { FabricObject, classRegistry, type FabricObject as FabricObjectType } from 'fabric'

import { DEFAULT_FONT, loadFontFace } from './fonts'
import type { XY } from './geometry'
import { cachedIconSvg, loadIconSvg } from './icon-library'
import { drawMark, markObject, marksSvg, measureText, type Mark, type Measure } from './well-plate'

export type LegendLook = 'plain' | 'boxed' | 'chips'
export type LegendLayout = 'down' | 'across'

export type LegendRow = {
  id: string
  label: string
  /** What the row shows before its label. */
  kind: 'icon' | 'swatch'
  /** The square's colour; kept on icon rows too, for when they turn into a square. */
  colour: string
  /** The library icon (icon rows), e.g. "cells/t-cell-simple-flat", and its SVG text once loaded. */
  iconId?: string
  svg?: string
}

export type LegendSettings = {
  look: LegendLook
  layout: LegendLayout
  rows: LegendRow[]
  /** The block colour: the boxed key's frame and header, the chips of icon rows. */
  colour: string
  /** The boxed key's header text. */
  title: string
  /** The labels' text size in page pixels; markers, gaps and padding grow with it. */
  size: number
}

export const LEGEND_LOOKS: readonly { id: LegendLook; name: string }[] = [
  { id: 'plain', name: 'Plain key' },
  { id: 'boxed', name: 'Boxed key' },
  { id: 'chips', name: 'Chips' },
]

export const LEGEND_SIZE = { min: 6, max: 72, start: 12 }
/** The panels' blue: every look starts in it, as every block does. */
export const LEGEND_BLUE = '#0072b2'
/** The colours new colour rows take, in turn, skipping ones the legend already uses (Okabe-Ito). */
export const NEW_ROW_COLOURS = ['#0072b2', '#e69f00', '#009e73', '#cc79a7', '#56b4e9', '#d55e00', '#f0e442', '#71717a']

const INK = '#27272a'
const DIVIDER = '#e4e4e7'
const SWATCH_EDGE = 'rgba(0,0,0,0.15)'

/** What a new legend shows: two cell types and a condition, ready to be renamed. */
export const START_ROWS: readonly Omit<LegendRow, 'id'>[] = [
  { label: 'T cell', kind: 'icon', colour: LEGEND_BLUE, iconId: 'cells/t-cell-simple-flat' },
  { label: 'B cell', kind: 'icon', colour: '#e69f00', iconId: 'cells/b-cell-simple-flat' },
  { label: 'Treated', kind: 'swatch', colour: '#d55e00' },
]

let rowCount = 0
export const newRowId = () => `row-${Date.now().toString(36)}-${(rowCount++).toString(36)}`

export function startLegend(look: LegendLook): LegendSettings {
  return {
    look,
    layout: 'down',
    rows: START_ROWS.map((row) => ({ ...row, id: newRowId(), ...(row.iconId && { svg: cachedIconSvg(row.iconId) }) })),
    colour: LEGEND_BLUE,
    title: 'Key',
    size: LEGEND_SIZE.start,
  }
}

/** A row like the last one: an icon row starts with the next start icon, a colour row with the next colour. */
export function nextRow(settings: LegendSettings, kind?: LegendRow['kind']): LegendRow {
  const last = settings.rows.at(-1)
  const as = kind ?? last?.kind ?? 'swatch'
  const used = new Set(settings.rows.map((row) => row.colour.toLowerCase()))
  const colour = NEW_ROW_COLOURS.find((each) => !used.has(each)) ?? '#71717a'
  let n = settings.rows.filter((row) => row.kind === as).length + 1
  const name = as === 'icon' ? 'Icon' : 'Condition'
  while (settings.rows.some((row) => row.label === `${name} ${n}`)) n++
  if (as === 'icon') {
    const lastIcon = settings.rows.findLast((row) => row.kind === 'icon' && row.iconId)
    const iconId = lastIcon?.iconId ?? START_ROWS[0]?.iconId
    return { id: newRowId(), label: `${name} ${n}`, kind: 'icon', colour, ...(iconId && { iconId, svg: cachedIconSvg(iconId) ?? (lastIcon?.iconId === iconId ? lastIcon.svg : undefined) }) }
  }
  return { id: newRowId(), label: `${name} ${n}`, kind: 'swatch', colour }
}

/* ---------- Colours ---------- */

/** A colour mixed with white: 0.82 gives the palette's pale tint. */
export function tintOf(hex: string, white = 0.82): string {
  const n = parseInt(hex.replace('#', '').slice(0, 6).padEnd(6, '0'), 16)
  const mix = (v: number) => Math.round(v + (255 - v) * white)
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => mix(v).toString(16).padStart(2, '0')).join('')}`
}

/* ---------- The drawing ---------- */

/** An icon drawn at (x, y), `size` square. */
export type IconMark = { kind: 'icon'; x: number; y: number; size: number; row: LegendRow }
export type LegendMark = Mark | IconMark

/** Where each row sits, in the legend's own space (for tests and handles). */
export type RowBox = { id: string; x: number; y: number; w: number; h: number }

/** Everything a legend draws, in its own space (top-left corner at 0, 0). */
export function legendMarks(settings: LegendSettings, measure: Measure = measureText): { marks: LegendMark[]; width: number; height: number; rows: RowBox[] } {
  if (settings.look === 'boxed') return boxedMarks(settings, measure)
  if (settings.look === 'chips') return chipMarks(settings, measure)
  return plainMarks(settings, measure)
}

const text = (x: number, y: number, words: string, size: number, weight = 400, anchor: 'start' | 'middle' = 'start', fill = INK): Mark => ({ kind: 'text', x, y, text: words, size, weight, fill, anchor })

/** An icon, or a colour square centred in the same room. */
function marker(row: LegendRow, x: number, y: number, room: number, square: number, round = false): LegendMark {
  if (row.kind === 'icon') return { kind: 'icon', x, y, size: room, row }
  return { kind: 'rect', x: x + (room - square) / 2, y: y + (room - square) / 2, w: square, h: square, rx: round ? square / 2 : square * 0.18, fill: row.colour, stroke: SWATCH_EDGE, width: 0.75, name: `${row.label} colour` }
}

function plainMarks(settings: LegendSettings, measure: Measure) {
  const { size: s, rows } = settings
  const k = s / 12
  const room = 22 * k
  const marks: LegendMark[] = []
  const boxes: RowBox[] = []
  if (settings.layout === 'down') {
    const step = 28 * k
    rows.forEach((row, i) => {
      const y = i * step
      marks.push(marker(row, 0, y, room, 14 * k), text(room + 8 * k, y + room / 2, row.label, s))
      boxes.push({ id: row.id, x: 0, y, w: room + 8 * k + measure(row.label, s, 400), h: room })
    })
    return { marks, rows: boxes, width: Math.max(room, ...boxes.map((box) => box.w)), height: Math.max(room, rows.length * step - (step - room)) }
  }
  let x = 0
  for (const row of rows) {
    const w = room + 6 * k + measure(row.label, s, 400)
    marks.push(marker(row, x, 0, room, 14 * k), text(x + room + 6 * k, room / 2, row.label, s))
    boxes.push({ id: row.id, x, y: 0, w, h: room })
    x += w + 18 * k
  }
  return { marks, rows: boxes, width: Math.max(room, x - 18 * k), height: room }
}

function boxedMarks(settings: LegendSettings, measure: Measure) {
  const { size: s, rows, colour } = settings
  const k = s / 12
  const head = 22 * k
  const tile = 30 * k
  const pad = 12 * k
  const pale = tintOf(colour, 0.88)
  const inner: LegendMark[] = []
  const boxes: RowBox[] = []
  const tileFor = (row: LegendRow, x: number, y: number) =>
    row.kind === 'icon' ? [{ kind: 'circle', cx: x + tile / 2, cy: y + tile / 2, r: tile / 2, fill: pale, name: `${row.label} tile` } satisfies Mark, marker(row, x + 4 * k, y + 4 * k, tile - 8 * k, 0)] : [marker(row, x, y, tile, 16 * k)]
  const title = settings.title.trim().toUpperCase()
  const titleSize = 10.5 * k
  const titleW = title ? pad * 2 + measure(title, titleSize, 700) : 0
  let width: number
  let height: number
  if (settings.layout === 'down') {
    const step = 40 * k
    width = Math.max(110 * k, titleW, ...rows.map((row) => pad * 2 + tile + 10 * k + measure(row.label, s, 400)))
    height = head + 6 * k + rows.length * step
    rows.forEach((row, i) => {
      const top = head + 6 * k + i * step
      const y = top + (step - tile) / 2
      if (i > 0) inner.push({ kind: 'path', d: `M ${pad} ${top} H ${width - pad}`, fill: 'none', stroke: DIVIDER, width: Math.max(0.5, k), name: 'Divider' })
      inner.push(...tileFor(row, pad, y), text(pad + tile + 10 * k, y + tile / 2, row.label, s))
      boxes.push({ id: row.id, x: pad - 4 * k, y: y - 4 * k, w: width - 2 * pad + 8 * k, h: tile + 8 * k })
    })
  } else {
    const label = 11 * k
    const cols = rows.map((row) => Math.max(tile, measure(row.label, label, 400)) + 20 * k)
    width = Math.max(titleW, cols.reduce((sum, each) => sum + each, 0) + 8 * k)
    height = head + 70 * k
    let x = (width - cols.reduce((sum, each) => sum + each, 0)) / 2
    rows.forEach((row, i) => {
      const w = cols.at(i) ?? tile
      if (i > 0) inner.push({ kind: 'path', d: `M ${x} ${head + 12 * k} V ${height - 10 * k}`, fill: 'none', stroke: DIVIDER, width: Math.max(0.5, k), name: 'Divider' })
      inner.push(...tileFor(row, x + (w - tile) / 2, head + 10 * k), text(x + w / 2, head + 10 * k + tile + 14 * k, row.label, label, 400, 'middle'))
      boxes.push({ id: row.id, x, y: head + 6 * k, w, h: height - head - 10 * k })
      x += w
    })
  }
  const edge = 1.5 * k
  const r = 6 * k
  const e = edge / 2
  const marks: LegendMark[] = [
    { kind: 'rect', x: e, y: e, w: width - edge, h: height - edge, rx: r, fill: '#ffffff', stroke: colour, width: edge, name: 'Legend frame' },
    { kind: 'path', d: `M ${e} ${head} V ${e + r} A ${r} ${r} 0 0 1 ${e + r} ${e} H ${width - e - r} A ${r} ${r} 0 0 1 ${width - e} ${e + r} V ${head} Z`, fill: colour, stroke: colour, width: edge, name: 'Legend header' },
  ]
  if (title) marks.push(text(pad, head / 2, title, titleSize, 700, 'start', '#ffffff'))
  return { marks: [...marks, ...inner], rows: boxes, width, height }
}

function chipMarks(settings: LegendSettings, measure: Measure) {
  const { size: s, rows, colour } = settings
  const k = s / 12
  const h = 28 * k
  const room = 20 * k
  const marks: LegendMark[] = []
  const boxes: RowBox[] = []
  const chip = (row: LegendRow, x: number, y: number) => {
    const w = 6 * k + room + 7 * k + measure(row.label, s, 500) + 12 * k
    const fill = row.kind === 'swatch' ? tintOf(row.colour, 0.8) : tintOf(colour, 0.85)
    marks.push({ kind: 'rect', x, y, w, h, rx: h / 2, fill, name: `${row.label} chip` })
    marks.push(row.kind === 'icon' ? marker(row, x + 6 * k, y + (h - room) / 2, room, 0) : { kind: 'circle', cx: x + 6 * k + room / 2, cy: y + h / 2, r: 7 * k, fill: row.colour, name: `${row.label} colour` })
    marks.push(text(x + 6 * k + room + 7 * k, y + h / 2, row.label, s, 500))
    boxes.push({ id: row.id, x, y, w, h })
    return w
  }
  if (settings.layout === 'down') {
    rows.forEach((row, i) => chip(row, 0, i * (h + 6 * k)))
    return { marks, rows: boxes, width: Math.max(h, ...boxes.map((box) => box.w)), height: Math.max(h, rows.length * (h + 6 * k) - 6 * k) }
  }
  let x = 0
  for (const row of rows) x += chip(row, x, 0) + 8 * k
  return { marks, rows: boxes, width: Math.max(h, x - 8 * k), height: h }
}

/** The biggest text size at which these settings fit a box (width and height), found by halving. */
export function sizeToFit(settings: LegendSettings, box: { width: number; height: number }, measure: Measure = measureText): number {
  const fits = (size: number) => {
    const { width, height } = legendMarks({ ...settings, size }, measure)
    return width <= box.width + 0.01 && height <= box.height + 0.01
  }
  let low = LEGEND_SIZE.min
  let high = LEGEND_SIZE.max
  if (!fits(low)) return low
  for (let i = 0; i < 30; i++) {
    const mid = (low + high) / 2
    if (fits(mid)) low = mid
    else high = mid
  }
  return low
}

/* ---------- Icons ---------- */

/** An icon's SVG as a picture for the canvas, made once per SVG text. */
const pictures = new Map<string, HTMLImageElement>()
function pictureOf(svg: string, ready: () => void): HTMLImageElement | undefined {
  if (typeof Image === 'undefined') return undefined
  let image = pictures.get(svg)
  if (!image) {
    image = new Image()
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
    pictures.set(svg, image)
  }
  if (!image.complete) image.addEventListener('load', ready, { once: true })
  return image
}

/** The icon's SVG as a nested <svg> at its place (vector in exports). */
export function iconSvg(svg: string, x: number, y: number, size: number): string {
  const open = /<svg\b[^>]*>/i.exec(svg)
  if (!open) return ''
  const viewBox = /viewBox\s*=\s*"([^"]*)"/i.exec(open[0])?.[1] ?? '0 0 128 128'
  const end = svg.lastIndexOf('</svg>')
  const inner = svg.slice(open.index + open[0].length, end < 0 ? undefined : end)
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="${viewBox}" overflow="visible">${inner}</svg>`
}

/** A faint rounded square where an icon goes while its SVG loads (or when it can't). */
const iconPlaceholder = (mark: IconMark): Mark => ({ kind: 'rect', x: mark.x + mark.size * 0.1, y: mark.y + mark.size * 0.1, w: mark.size * 0.8, h: mark.size * 0.8, rx: mark.size * 0.2, fill: '#e4e4e7', name: 'Icon' })

/** The marks as SVG elements, moved by `at`. */
export function legendMarksSvg(marks: readonly LegendMark[], at: XY = { x: 0, y: 0 }): string {
  return marks.map((mark) => (mark.kind === 'icon' ? (mark.row.svg ? iconSvg(mark.row.svg, mark.x + at.x, mark.y + at.y, mark.size) : marksSvg([iconPlaceholder(mark)], at)) : marksSvg([mark], at))).join('')
}

/** A legend as a picture for its card in the Blocks tool, cropped to itself. */
export function legendSvg(settings: LegendSettings, { bars = false }: { bars?: boolean } = {}): string {
  const measure: Measure = (words, size, weight) => words.length * size * (weight >= 600 ? 0.6 : 0.55)
  const drawn = legendMarks(settings, measure)
  // As bars, a small picture has no words in it (a button's name stays its own label).
  const marks = bars
    ? drawn.marks.map((mark): LegendMark => {
        if (mark.kind !== 'text') return mark
        const w = measure(mark.text, mark.size, mark.weight)
        const h = mark.size * 0.55
        return { kind: 'rect', x: mark.anchor === 'middle' ? mark.x - w / 2 : mark.x, y: mark.y - h / 2, w, h, rx: h / 2, fill: mark.fill === INK ? '#a1a1aa' : mark.fill, name: 'Label' }
      })
    : drawn.marks
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-3 -3 ${drawn.width + 6} ${drawn.height + 6}" width="100%" height="100%" aria-hidden="true">${legendMarksSvg(marks)}</svg>`
}

/** Load the start icons, so new legends and the cards show them. */
export function loadStartIcons(): Promise<void> {
  return Promise.all(START_ROWS.flatMap((row) => (row.iconId ? [loadIconSvg(row.iconId)] : []))).then(
    () => undefined,
    () => undefined,
  )
}

/* ---------- The object ---------- */

export class LegendBlock extends FabricObject {
  static type = 'LegendBlock'

  declare legend: LegendSettings
  /**
   * The box a style switch fits into: the one from before the first switch,
   * kept while the legend stays as the last switch left it, so switching
   * back and forth doesn't shrink it a little each time. Not saved.
   */
  styleBox: { box: { width: number; height: number }; after: { width: number; height: number } } | undefined
  private rowBoxes: RowBox[] = []

  constructor(options: Record<string, unknown> & { legend: LegendSettings }) {
    super(options as Record<string, unknown>)
    this.legend = { ...options.legend, rows: options.legend.rows.map((row) => ({ ...row })) }
    const { width, height, rows } = legendMarks(this.legend)
    this.rowBoxes = rows
    this.set({ width, height, fill: null, stroke: null, strokeWidth: 0, objectCaching: false, lockRotation: true, lockSkewingX: true, lockSkewingY: true })
    this.setControlsVisibility({ mtr: false, ml: false, mr: false, mt: false, mb: false })
    void Promise.all([loadFontFace(DEFAULT_FONT, 400, false), loadFontFace(DEFAULT_FONT, 500, false), loadFontFace(DEFAULT_FONT, 700, false)]).then(() => {
      this.refresh()
      this.canvas?.requestRenderAll()
    })
    this.loadIcons()
  }

  /** Icon rows without their SVG yet (a new legend, a new row) load it; the next save keeps it. */
  loadIcons(): void {
    for (const row of this.legend.rows) {
      if (row.kind !== 'icon' || row.svg || !row.iconId) continue
      const { id, iconId } = row
      void loadIconSvg(iconId).then(
        (svg) => {
          const now = this.legend.rows.find((each) => each.id === id)
          if (!svg || !now || now.iconId !== iconId || now.svg) return
          now.svg = svg
          this.set({ dirty: true })
          this.canvas?.requestRenderAll()
        },
        () => undefined,
      )
    }
  }

  /** New settings, keeping the top-left corner where it is. */
  setLegend(change: Partial<LegendSettings>): void {
    this.legend = { ...this.legend, ...change }
    this.refresh()
    this.loadIcons()
  }

  /** Measure again (after a change or once the font has loaded), keeping the top-left corner where it is. */
  refresh(): void {
    const corner = this.getPointByOrigin('left', 'top')
    const { width, height, rows } = legendMarks(this.legend)
    this.rowBoxes = rows
    this.set({ width, height, dirty: true })
    this.setPositionByOrigin(corner, 'left', 'top')
    this.setCoords()
  }

  /** Where each row sits, in the legend's own space. */
  get rowPlaces(): readonly RowBox[] {
    return this.rowBoxes
  }

  _render(ctx: CanvasRenderingContext2D): void {
    const { marks } = legendMarks(this.legend)
    ctx.save()
    ctx.translate(-this.width / 2, -this.height / 2)
    for (const mark of marks) {
      if (mark.kind !== 'icon') {
        drawMark(ctx, mark)
        continue
      }
      const picture = mark.row.svg ? pictureOf(mark.row.svg, () => this.canvas?.requestRenderAll()) : undefined
      if (picture?.complete && picture.naturalWidth > 0) ctx.drawImage(picture, mark.x, mark.y, mark.size, mark.size)
      else drawMark(ctx, iconPlaceholder(mark))
    }
    ctx.restore()
  }

  _toSVG(): string[] {
    const { marks } = legendMarks(this.legend)
    return [`<g opacity="${this.opacity}">\n`, legendMarksSvg(marks, { x: -this.width / 2, y: -this.height / 2 }), '</g>\n']
  }

  toObject<T extends Omit<Record<string, unknown>, keyof this>, K extends keyof T = never>(propertiesToInclude: K[] = []): Record<string, unknown> {
    return super.toObject([...propertiesToInclude, 'legend'] as K[]) as Record<string, unknown>
  }
}
classRegistry.setClass(LegendBlock)

/** A new legend in one look, its middle at `centre`. */
export function buildLegend(look: LegendLook, centre: XY): LegendBlock {
  const legend = new LegendBlock({ legend: startLegend(look) })
  legend.set({ left: centre.x - legend.width / 2, top: centre.y - legend.height / 2 })
  legend.setCoords()
  return legend
}

/**
 * While a corner is dragged: the stretch goes into the text size (and with
 * it every marker, gap and padding), the scale goes back to 1, and the
 * corner Fabric holds still stays put. Nothing stretches.
 */
export function bakeLegendScale(legend: LegendBlock, originX: 'left' | 'center' | 'right' = 'center', originY: 'top' | 'center' | 'bottom' = 'center'): void {
  const { scaleX: sx, scaleY: sy } = legend
  if (sx === 1 && sy === 1) return
  const factor = sx === 1 ? Math.abs(sy) : sy === 1 ? Math.abs(sx) : (Math.abs(sx) + Math.abs(sy)) / 2
  const pinned = legend.getPointByOrigin(originX, originY)
  legend.set({ scaleX: 1, scaleY: 1 })
  legend.setLegend({ size: Math.max(LEGEND_SIZE.min, Math.min(LEGEND_SIZE.max, legend.legend.size * factor)) })
  legend.setPositionByOrigin(pinned, originX, originY)
  legend.setCoords()
}

/** The legend's marks as plain shapes and text where it is, for Detach; icons come back as `{ icon }` for the canvas to load. */
export function detachedLegendParts(legend: LegendBlock): ({ object: FabricObjectType } | { icon: { row: LegendRow; left: number; top: number; size: number } })[] {
  const corner = legend.getPointByOrigin('left', 'top')
  return legendMarks(legend.legend).marks.map((mark) => (mark.kind === 'icon' ? { icon: { row: mark.row, left: corner.x + mark.x, top: corner.y + mark.y, size: mark.size } } : { object: markObject(mark, corner) }))
}

export const isLegend = (object: FabricObjectType | undefined): object is LegendBlock => object instanceof LegendBlock
