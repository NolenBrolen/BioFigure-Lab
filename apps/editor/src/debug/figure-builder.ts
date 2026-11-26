/*
 * The figure builder: turns a spec (figure-spec.ts) into a real figure on the
 * open canvas, through the same code the editor's own tools use, so what it
 * builds can be edited, moved (arrows stay attached) and undone like a figure
 * made by hand. Development only: App installs it on `window.__figureBuilder`
 * behind `import.meta.env.DEV`, and example-figures/build.mjs drives it.
 */
import { ARROW_PRESETS, type ArrowLook } from '@biofigure-lab/ui/lib/arrow-geometry'
import type { FabricObject, IText } from 'fabric'
import { IText as FabricIText } from 'fabric'

import { type ChartData, createChart, parsePasted } from '../editor/chart-model'
import { DEFAULT_FONT, fontByName, fontStack, loadFontFace } from '../editor/fonts'
import { FigureCanvas, idOf } from '../editor/FigureCanvas'
import { iconById, loadIconSvg } from '../editor/icon-library'
import { labelFromText, restyleLabel } from '../editor/shape-text'
import { DEFAULT_STROKE, type ShapeSpec as CanvasShapeSpec } from '../editor/shapes'
import type { FigureStore } from '../editor/storage'
import { applyTextStyle, drawnWeight, type TextStyle } from '../editor/text-style'
import { mmToPx } from '../editor/units'
import { debugTargets } from './debug-targets'
import {
  pageMm,
  parseMarkup,
  parseSpec,
  plainText,
  SpecError,
  type ArrowSpec,
  type ChartSpec,
  type FigureSpec,
  type IconSpec,
  type ObjectSpec,
  type PointSpec,
  type Run,
  type ShapeSpec,
  type TextSpec,
} from './figure-spec'

type Box = { left: number; top: number }

/** Where an object's top-left goes for a spec's x/y or cx/cy, given its size. */
function topLeft(o: { x?: number; y?: number; cx?: number; cy?: number }, width: number, height: number): Box {
  return o.cx !== undefined && o.cy !== undefined ? { left: o.cx - width / 2, top: o.cy - height / 2 } : { left: o.x ?? 0, top: o.y ?? 0 }
}

/** Turn an object around its middle and mirror it, leaving its middle where it is. */
function orient(object: FabricObject, o: { rotation?: number; flip?: 'x' | 'y' | 'xy'; opacity?: number }) {
  const middle = object.getCenterPoint()
  if (o.flip?.includes('x')) object.set({ flipX: true })
  if (o.flip?.includes('y')) object.set({ flipY: true })
  if (o.opacity !== undefined) object.set({ opacity: o.opacity })
  if (o.rotation) object.rotate(o.rotation)
  object.setPositionByOrigin(middle, 'center', 'center')
  object.setCoords()
}

type TextLook = { fontSize?: number; font?: string; weight?: number; bold?: boolean; italic?: boolean; color?: string; align?: TextStyle['align']; lineSpacing?: number }

/** Our spec's text settings as the app's text style. */
function baseStyle(look: TextLook): Partial<TextStyle> {
  return {
    font: look.font ?? DEFAULT_FONT.name,
    ...(look.fontSize !== undefined && { size: look.fontSize }),
    ...(look.weight !== undefined && { weight: look.weight }),
    ...(look.bold !== undefined && { bold: look.bold }),
    ...(look.italic !== undefined && { italic: look.italic }),
    ...(look.color !== undefined && { colour: look.color }),
    ...(look.align !== undefined && { align: look.align }),
    ...(look.lineSpacing !== undefined && { lineSpacing: look.lineSpacing }),
  }
}

/** Put marked-up text into a text box, as real character styles (not look-alike characters). */
export function writeRuns(text: IText, runs: readonly Run[], look: TextLook): void {
  text.set({ text: plainText(runs) })
  text.initDimensions()
  applyTextStyle(text, baseStyle(look))
  let at = 0
  for (const run of runs) {
    const end = at + run.text.length
    if (run.italic || run.bold || run.script) {
      applyTextStyle(text, { ...(run.italic && { italic: true }), ...(run.bold && { bold: true }), ...(run.script && { script: run.script }) }, { start: at, end })
    }
    at = end
  }
  text.initDimensions()
}

/** The font faces text with this look needs, so they are loaded before anything is measured. */
function facesOf(look: TextLook, runs: readonly Run[]): { font: string; weight: number; italic: boolean }[] {
  const font = look.font ?? DEFAULT_FONT.name
  const weight = look.weight ?? 400
  const faces = [{ font, weight: drawnWeight({ weight, bold: look.bold ?? false }), italic: look.italic ?? false }]
  for (const run of runs) faces.push({ font, weight: drawnWeight({ weight, bold: (run.bold ?? false) || (look.bold ?? false) }), italic: (run.italic ?? false) || (look.italic ?? false) })
  return faces
}

async function loadFaces(spec: FigureSpec): Promise<void> {
  const faces = spec.objects.flatMap((o) => {
    if (o.type === 'text') return facesOf(o, parseMarkup(o.text))
    if (o.type === 'shape' && o.text !== undefined) return facesOf({ ...o, color: o.textColor }, parseMarkup(o.text))
    if (o.type === 'chart') return facesOf({ font: o.fontFamily }, [])
    return []
  })
  await Promise.all(faces.map((face) => loadFontFace(fontByName(face.font) ?? DEFAULT_FONT, face.weight, face.italic)))
}

/** Spec keys of a chart that are not settings of the chart's data. */
const NOT_CHART_DATA = new Set(['type', 'id', 'name', 'rotation', 'opacity', 'x', 'y', 'cx', 'cy', 'kind', 'errorBars', 'table', 'groups'])

type Built = { object: FabricObject; spec: ObjectSpec }

class Builder {
  /** What each spec id became on the page. */
  readonly byId = new Map<string, FabricObject>()

  private readonly figure: FigureCanvas

  constructor(figure: FigureCanvas) {
    this.figure = figure
  }

  private register(object: FabricObject, o: ObjectSpec): Built {
    if (o.name ?? o.id) Object.assign(object, { name: o.name ?? o.id })
    if (o.id) this.byId.set(o.id, object)
    return { object, spec: o }
  }

  async icon(o: IconSpec): Promise<Built> {
    const svg = await loadIconSvg(o.icon)
    if (svg === undefined) {
      const near = [...new Set([o.icon.split('/')[0] ?? ''])]
      throw new SpecError(`Unknown icon "${o.icon}": it is not in the icon library (icons/${near[0] ?? ''}/…). Ids are paths under icons/ without .svg`)
    }
    const meta = iconById(o.icon)
    const group = await this.figure.addSvg(svg, meta?.name ?? o.icon, { x: 0, y: 0 }, 74, o.icon)
    group.scaleToWidth(o.width)
    const { left, top } = topLeft(o, group.getScaledWidth(), group.getScaledHeight())
    group.set({ left, top })
    group.setCoords()
    if (o.color !== undefined) {
      this.figure.canvas.setActiveObject(group)
      this.figure.change({ fill: o.color })
      this.figure.canvas.discardActiveObject()
    }
    orient(group, o)
    return this.register(group, o)
  }

  shape(o: ShapeSpec): Built {
    const style = { fill: o.fill ?? '#ffffff', stroke: o.stroke ?? DEFAULT_STROKE, strokeWidth: o.strokeWidth ?? 1.5 }
    const { left, top } = topLeft(o, o.width, o.height)
    const extras = { opacity: o.opacity, textFit: o.fit ?? 'wrap', ...(o.cornerRadius !== undefined && { cornerRadius: o.cornerRadius }) }
    const base = { left, top, ...style, ...extras }
    const spec: CanvasShapeSpec =
      o.kind === 'rectangle' && o.cornerRadius === undefined
        ? { kind: 'rectangle', width: o.width, height: o.height, ...base }
        : o.kind === 'ellipse'
          ? { kind: 'ellipse', rx: o.width / 2, ry: o.height / 2, ...base }
          : { kind: 'path', shape: o.kind, width: o.width, height: o.height, ...base }
    const object = this.figure.addShape(spec, false)
    if (o.text !== undefined && o.text !== '') {
      const look: TextLook = { fontSize: o.fontSize ?? 14, font: o.font, weight: o.weight, bold: o.bold, italic: o.italic, color: o.textColor ?? DEFAULT_STROKE, align: o.align ?? 'center', lineSpacing: o.lineSpacing }
      const runs = parseMarkup(o.text)
      const starting = new FabricIText('', { fontFamily: fontStack(fontByName(look.font ?? '') ?? DEFAULT_FONT), fontSize: look.fontSize, fill: look.color, textAlign: look.align })
      const taken = restyleLabel(object, (text) => writeRuns(text, runs, look), labelFromText(starting))
      if (!taken) throw new SpecError(`A "${o.kind}" shape takes no text`)
    }
    orient(object, o)
    return this.register(object, o)
  }

  text(o: TextSpec): Built {
    const look: TextLook = { fontSize: o.fontSize ?? 14, font: o.font, weight: o.weight, bold: o.bold, italic: o.italic, color: o.color ?? DEFAULT_STROKE, align: o.align, lineSpacing: o.lineSpacing }
    const runs = parseMarkup(o.text)
    const object = this.figure.addShape({ kind: 'text', left: 0, top: 0, text: plainText(runs), fontSize: look.fontSize ?? 14, fill: look.color ?? DEFAULT_STROKE, width: o.width }, false) as IText
    writeRuns(object, runs, look)
    object.setCoords()
    const { left, top } = topLeft(o, object.getScaledWidth(), object.getScaledHeight())
    object.set({ left, top })
    orient(object, o)
    return this.register(object, o)
  }

  chart(o: ChartSpec): Built {
    const base = createChart(o.kind, o.errorBars ?? 'sd', { width: o.width, height: o.height }, o.title ?? '')
    const overrides = Object.fromEntries(Object.entries(o).filter(([key]) => !NOT_CHART_DATA.has(key)))
    const groups = o.groups ?? parsePasted((o.table ?? []).map((row) => row.map((cell) => cell ?? '').join('\t')).join('\n'))
    const data: ChartData = { ...base, ...(overrides as Partial<ChartData>), groups, width: o.width, height: o.height }
    const { left, top } = topLeft(o, data.width, data.height)
    const object = this.figure.addChart(data, { x: left, y: top }, false)
    orient(object, o)
    return this.register(object, o)
  }

  /** Where a point of an arrow is while it is made: a given point, or the middle of its object (the object's edge replaces it once attached). */
  private end(value: string | PointSpec): { point: PointSpec; id?: string } {
    if (typeof value !== 'string') return { point: value }
    const object = this.byId.get(value)
    if (!object) throw new SpecError(`An arrow points at "${value}", which comes later in the list or does not exist; list the object before the arrow`)
    const { x, y } = object.getCenterPoint()
    return { point: { x, y }, id: idOf(object) }
  }

  arrow(o: ArrowSpec): Built {
    const preset = o.preset ? ARROW_PRESETS.find((p) => p.id === o.preset) : undefined
    const look: ArrowLook = {
      route: o.route ?? 'straight',
      line: o.line ?? (o.dashed ? 'dashed' : 'solid'),
      start: o.start ?? preset?.start ?? 'none',
      end: o.end ?? preset?.end ?? 'filled',
      mid: o.mid ?? preset?.mid ?? 'none',
      ...(typeof o.bend === 'number' && { bend: o.bend }),
    }
    const from = this.end(o.from)
    const to = this.end(o.to)
    const arrow = this.figure.addShape({ kind: 'arrow', points: [from.point.x, from.point.y, to.point.x, to.point.y], look, stroke: o.color ?? DEFAULT_STROKE, strokeWidth: o.width ?? 2 }, false)
    if (o.opacity !== undefined) arrow.set({ opacity: o.opacity })
    this.figure.attachArrow(arrow, { start: from.id, end: to.id }, false)
    return this.register(arrow, o)
  }
}

/** The ids and kinds of what was built, for a quick look at the result. */
export type BuildReport = { objects: number; ids: string[] }

/**
 * Build the spec's objects onto the figure's canvas. The canvas should be
 * empty and the right size (see `buildSpec` for the whole job).
 */
export async function buildFigure(figure: FigureCanvas, raw: unknown): Promise<BuildReport> {
  const spec = parseSpec(raw)
  await loadFaces(spec)
  const builder = new Builder(figure)
  for (const o of spec.objects) {
    switch (o.type) {
      case 'icon':
        await builder.icon(o)
        break
      case 'shape':
        builder.shape(o)
        break
      case 'text':
        builder.text(o)
        break
      case 'chart':
        builder.chart(o)
        break
      case 'arrow':
        builder.arrow(o)
        break
    }
  }
  figure.canvas.discardActiveObject()
  figure.canvas.requestRenderAll()
  return { objects: spec.objects.length, ids: [...builder.byId.keys()] }
}

// ---------- the whole job, in the running app ----------

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function until<T>(what: string, read: () => T | undefined | false, timeoutMs = 20_000): Promise<T> {
  const started = Date.now()
  for (;;) {
    const value = read()
    if (value) return value
    if (Date.now() - started > timeoutMs) throw new Error(`Timed out waiting for ${what}`)
    await wait(50)
  }
}

/** The saved figure as the app stores it, ready to write to a `.figure.json` file. */
export type FigureFile = { name: string; page: { width: number; height: number }; slides: { id: string; canvas?: string; thumbnail?: string }[]; thumbnail?: string }

export type BuildResult = { figure: FigureFile; svg: string; png: string; report: BuildReport }

/**
 * Make a new figure of the spec's page size, open it, build the spec in it and
 * export it the way the app does (text turned into outlines): the figure as
 * stored, its SVG, and a PNG about `pngWidth` px wide (base64).
 */
export async function buildSpec(raw: unknown, pngWidth = 2400): Promise<BuildResult> {
  const spec = parseSpec(raw)
  const store = debugTargets.store
  if (!store) throw new Error('The app has not started yet')
  const previous = debugTargets.figure
  const created = await store.create(pageMm(spec.page), spec.name)
  window.location.hash = `#/figure/${created.id}`
  const widthPx = mmToPx(created.page.width)
  const figure = await until('the editor to open the new figure', () => {
    const open = debugTargets.figure
    return open && open !== previous && !open.loading && Math.abs(open.page.width - widthPx) < 0.5 ? open : undefined
  })
  const report = await buildFigure(figure, spec)
  await wait(100)

  const slide = created.slides[0]
  if (!slide) throw new Error('The new figure has no slide')
  const saved = { id: slide.id, canvas: figure.serialize(), thumbnail: figure.thumbnail() }
  await store.save(created.id, { slides: [saved], thumbnail: saved.thumbnail })

  const { exportFigure, sizedSvg } = await import('@biofigure-lab/export')
  const { browserSteps } = await import('@biofigure-lab/export/export-figure')
  const { loadExportFonts } = await import('../editor/export-fonts')
  const pageSize = created.page
  const exported = await exportFigure({ svg: figure.toSVG({ background: false }), pageMm: pageSize, settings: { format: 'svg', dpi: 300, transparent: false }, loadFonts: loadExportFonts })
  const svg = await exported.text()
  const pngHeight = Math.round((pngWidth * pageSize.height) / pageSize.width)
  const bytes = await browserSteps.rasterize(sizedSvg(svg, String(pngWidth), String(pngHeight), true), { width: pngWidth, height: pngHeight })
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))

  return { figure: { name: spec.name, page: pageSize, slides: [saved], thumbnail: saved.thumbnail }, svg, png: btoa(binary), report }
}

/**
 * Put figures from `.figure.json` files into the figure list, replacing earlier
 * ones with the same name. Returns how many were added.
 */
export async function importFigures(store: FigureStore, files: readonly FigureFile[]): Promise<number> {
  const existing = await store.list()
  for (const file of files) {
    for (const old of existing.filter((figure) => figure.name === file.name)) await store.remove(old.id)
    const made = await store.create(file.page, file.name)
    await store.save(made.id, { slides: file.slides.length > 0 ? file.slides : made.slides, thumbnail: file.thumbnail })
  }
  return files.length
}

declare global {
  interface Window {
    __figureBuilder?: { buildSpec: typeof buildSpec; openFigure: () => FigureCanvas | null }
  }
}

/** Make the builder reachable from the page (example-figures/build.mjs calls it). Development only. */
export function installFigureBuilder(): void {
  window.__figureBuilder = { buildSpec, openFigure: () => debugTargets.figure }
}
