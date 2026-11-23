/**
 * A chart on the canvas. Its data and settings live in `chart` (see
 * chart-model.ts); the object draws them, saves them with the figure and
 * writes them as plain SVG for export, so the chart stays vector. Resizing
 * it with its handles changes the chart's size but keeps its text and lines
 * the same thickness.
 *
 * While it is selected, two kinds of small handles light up under the
 * pointer: one in the middle of each gap between groups, which
 * drags the gaps wider or narrower (the chart grows or shrinks with them),
 * and one along each side of every column (a bar, or a group's dots), which
 * makes every column wider or narrower.
 * Double-clicking a group name or a title edits it (see FigureCanvas).
 */
import { Control, FabricObject, Point, classRegistry, util, type TMat2D } from 'fabric'

import { chartSvg, columnHalf, drawChart, textBox, textLeft, TITLE_WEIGHT, withDefaults, type ChartData, type ChartDrawing, type ChartText, type Measure } from './chart-model'
import type { XY } from './geometry'

/** What Fabric reports as the action while the space between groups is dragged. */
export const SPACING_ACTION = 'chartSpacing'
/** What Fabric reports as the action while the side of a bar is dragged. */
export const BAR_WIDTH_ACTION = 'chartBarWidth'
/** The handles' names start with this, to tell them from the usual ones. */
export const CHART_HANDLE = 'chart'
/** Set as the hovered handle while the pointer is over the chart itself: every handle shows faintly, so they are easy to find. */
export const ALL_HANDLES = 'all'
import { DEFAULT_FONT, fontByName, loadFontFace } from './fonts'

let measuring: CanvasRenderingContext2D | null | undefined
/** How wide a text is in its font. Export outlines the same font, so placing matches. */
export const measureText: Measure = (text, size, font, bold) => {
  measuring ??= document.createElement('canvas').getContext('2d')
  if (!measuring) return text.length * size * 0.55
  measuring.font = `${bold ? TITLE_WEIGHT : 400} ${size}px ${font}`
  return measuring.measureText(text).width
}

export class ChartObject extends FabricObject {
  static type = 'Chart'

  declare chart: ChartData

  constructor(options: Record<string, unknown> & { chart: ChartData }) {
    super(options as Record<string, unknown>)
    this.chart = withDefaults(this.chart)
    this.rebuildControls()
    this.set({ width: this.chart.width, height: this.chart.height, fill: null, stroke: null, strokeWidth: 0, objectCaching: false })
    this.loadFont()
  }

  private loadedFont: string | undefined
  /** Has the browser load the chart's font, then redraws, so text isn't drawn in a stand-in font. */
  private loadFont(): void {
    const name = this.chart.fontFamily
    if (name === this.loadedFont) return
    this.loadedFont = name
    void loadFontFace(fontByName(name) ?? DEFAULT_FONT, 400, false).then(() => {
      this.set({ dirty: true })
      this.canvas?.requestRenderAll()
    })
  }

  /** The spacing or bar-width handle under the pointer, lit up while the chart is selected. */
  hoverHandle: string | undefined
  /** The handle being dragged, and how things were when the drag started. */
  dragging: { key: string; startX: number; chart: ChartData } | undefined

  /** The chart as drawn, kept until the data or size changes. */
  private drawn: { chart: ChartData; drawing: ChartDrawing } | undefined
  drawing(): ChartDrawing {
    if (this.drawn?.chart !== this.chart) this.drawn = { chart: this.chart, drawing: drawChart(this.chart, measureText) }
    return this.drawn.drawing
  }

  /** A point on the page in the chart's own space (top-left at 0, 0). */
  toChartSpace(point: XY): XY {
    const local = util.transformPoint(new Point(point.x, point.y), util.invertTransform(this.calcTransformMatrix()))
    return { x: local.x + this.width / 2, y: local.y + this.height / 2 }
  }

  /** A point in the chart's own space on the screen, with zoom, scroll and rotation. */
  toScreen(local: XY): Point {
    return util.transformPoint(new Point(local.x - this.width / 2, local.y - this.height / 2), toScreen(this))
  }

  /** The text under a point on the page, if any. */
  textAt(point: XY): ChartText | undefined {
    const local = this.toChartSpace(point)
    const pad = 2
    return this.drawing()
      .texts.toReversed()
      .find((t) => {
        const box = textBox(t, measureText)
        return local.x >= box.x - pad && local.x <= box.x + box.width + pad && local.y >= box.y - pad && local.y <= box.y + box.height + pad
      })
  }

  /** Put new data or settings in, keeping the top-left corner where it is. */
  setChart(chart: ChartData): void {
    const corner = this.getPointByOrigin('left', 'top')
    this.chart = chart
    this.set({ width: chart.width, height: chart.height, dirty: true })
    this.loadFont()
    this.setPositionByOrigin(corner, 'left', 'top')
    if (!(`${CHART_HANDLE}BarR${chart.groups.length - 1}` in this.controls) || `${CHART_HANDLE}BarR${chart.groups.length}` in this.controls) this.rebuildControls()
    this.setCoords()
  }

  /** The usual handles, plus a spacing handle in each gap between groups and a width handle on each bar. */
  private rebuildControls(): void {
    const base = Object.fromEntries(Object.entries(this.controls).filter(([key]) => !key.startsWith(CHART_HANDLE)))
    const count = this.chart.groups.length
    const extra: Record<string, Control> = {}
    for (let i = 0; i < count - 1; i++) extra[`${CHART_HANDLE}Gap${i}`] = gapControl(i)
    for (let i = 0; i < count; i++) for (const side of [-1, 1] as const) extra[`${CHART_HANDLE}Bar${side < 0 ? 'L' : 'R'}${i}`] = barControl(i, side)
    // Put first, so the usual handles win where they overlap.
    this.controls = { ...extra, ...base }
  }

  /** After the handles resized the chart: the stretch goes into its size. */
  bakeScale(): void {
    if (this.scaleX === 1 && this.scaleY === 1) return
    const width = Math.max(this.chart.width * this.scaleX, 60)
    const height = Math.max(this.chart.height * this.scaleY, 45)
    const corner = this.getPointByOrigin('left', 'top')
    this.set({ scaleX: 1, scaleY: 1 })
    this.setPositionByOrigin(corner, 'left', 'top')
    this.setChart({ ...this.chart, width, height })
  }

  _render(ctx: CanvasRenderingContext2D): void {
    const d = this.drawing()
    ctx.save()
    ctx.translate(-this.width / 2, -this.height / 2)
    for (const r of d.rects) {
      ctx.fillStyle = r.fill
      ctx.fillRect(r.x, r.y, r.width, r.height)
    }
    ctx.lineCap = 'square'
    ctx.lineJoin = 'round'
    for (const g of d.polygons) {
      ctx.beginPath()
      g.points.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)))
      ctx.closePath()
      ctx.fillStyle = g.fill
      ctx.fill()
      ctx.strokeStyle = g.stroke
      ctx.lineWidth = g.width
      ctx.stroke()
    }
    for (const p of d.polylines) {
      ctx.beginPath()
      p.points.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)))
      ctx.strokeStyle = p.colour
      ctx.lineWidth = p.width
      ctx.stroke()
    }
    for (const l of d.lines) {
      ctx.beginPath()
      ctx.moveTo(l.x1, l.y1)
      ctx.lineTo(l.x2, l.y2)
      ctx.strokeStyle = l.colour
      ctx.lineWidth = l.width
      ctx.stroke()
    }
    for (const dot of d.dots) {
      ctx.beginPath()
      ctx.arc(dot.x, dot.y, dot.r, 0, Math.PI * 2)
      ctx.fillStyle = dot.fill
      ctx.fill()
      if (dot.stroke) {
        ctx.strokeStyle = dot.stroke
        ctx.lineWidth = 1
        ctx.stroke()
      }
    }
    ctx.textBaseline = 'alphabetic'
    ctx.textAlign = 'left'
    for (const t of d.texts) {
      ctx.font = `${t.bold ? TITLE_WEIGHT : 400} ${t.size}px ${t.font}`
      ctx.fillStyle = t.colour
      const width = measureText(t.text, t.size, t.font, t.bold)
      if (t.rotate) {
        ctx.save()
        ctx.translate(t.x, t.y)
        ctx.rotate(-Math.PI / 2)
        ctx.fillText(t.text, -width / 2, t.size * 0.35)
        ctx.restore()
      } else ctx.fillText(t.text, textLeft(t, width), t.y)
    }
    ctx.restore()
  }

  _toSVG(): string[] {
    return [`<g opacity="${this.opacity}">\n`, ...chartSvg(this.chart, measureText, { x: -this.width / 2, y: -this.height / 2 }), '</g>\n']
  }

  toObject<T extends Omit<Record<string, unknown>, keyof this>, K extends keyof T = never>(propertiesToInclude: K[] = []): Record<string, unknown> {
    return super.toObject([...propertiesToInclude, 'chart'] as K[]) as Record<string, unknown>
  }
}

classRegistry.setClass(ChartObject)

/** From the chart's own space (centre at 0, 0) to the screen, with zoom, scroll and rotation. */
const toScreen = (object: ChartObject): TMat2D => util.multiplyTransformMatrices(object.getViewportTransform(), object.calcTransformMatrix())

/** How many screen pixels one unit of the chart is, across its width and its height. */
function screenScale(object: ChartObject): { x: number; y: number } {
  const m = toScreen(object)
  return { x: Math.hypot(m[0], m[1]), y: Math.hypot(m[2], m[3]) }
}

/** A point's place along the groups' axis: across the page for an upright graph, down it for one lying down. */
const alongGroups = (chart: ChartObject, point: XY) => (chart.drawing().horizontal ? point.y : point.x)

/** A small handle drawn only while the pointer is on it or it is being dragged: a light box with a short grip. */
function renderHandle(key: string, ctx: CanvasRenderingContext2D, left: number, top: number, object: ChartObject, control: Control): void {
  const strong = object.hoverHandle === key || object.dragging?.key === key
  if (!strong && object.hoverHandle !== ALL_HANDLES) return
  ctx.save()
  ctx.translate(left, top)
  ctx.rotate(util.degreesToRadians(object.getTotalAngle()))
  const w = control.sizeX
  const h = control.sizeY
  ctx.globalAlpha = strong ? 1 : 0.55
  ctx.fillStyle = 'rgba(37, 99, 235, 0.15)'
  ctx.beginPath()
  ctx.roundRect(-w / 2, -h / 2, w, h, 3)
  ctx.fill()
  ctx.fillStyle = '#2563eb'
  if (object.drawing().horizontal) ctx.fillRect(-Math.min(8, w / 2 - 2), -1, Math.min(16, w - 4), 2)
  else ctx.fillRect(-1, -Math.min(8, h / 2 - 2), 2, Math.min(16, h - 4))
  ctx.restore()
}

/** Where a drag started, in the chart's own space, and the chart as it was then. */
function startDrag(key: string) {
  return (_event: unknown, transform: { target: FabricObject }, x: number, y: number) => {
    const chart = transform.target as ChartObject
    chart.dragging = { key, startX: alongGroups(chart, chart.toChartSpace({ x, y })), chart: chart.chart }
    return false
  }
}

function endDrag(_event: unknown, transform: { target: FabricObject }) {
  ;(transform.target as ChartObject).dragging = undefined
  return false
}

/**
 * A small handle in the middle of the gap after group `index`, not filling
 * it, so the chart can still be grabbed around it. Dragging it sideways
 * makes every gap wider or narrower while the bars keep their width: the
 * chart grows or shrinks to make room.
 */
function gapControl(index: number): Control {
  const key = `${CHART_HANDLE}Gap${index}`
  const control: Control = new Control({
    actionName: SPACING_ACTION,
    cursorStyleHandler: (_event, _control, object) => ((object as ChartObject).drawing().horizontal ? 'ns-resize' : 'ew-resize'),
    positionHandler: (_dim, _finalMatrix, object: ChartObject) => {
      const { plot, horizontal } = object.drawing()
      const scale = screenScale(object)
      // Across the gap (thin) and along it (long); lying down they swap sides.
      const across = Math.min(Math.max(plot.band * (1 - object.chart.barWidth) * (horizontal ? scale.y : scale.x) * 0.6, 14), 32)
      const along = Math.min(Math.max((horizontal ? plot.width * scale.x : plot.height * scale.y) * 0.55, 24), 90)
      control.sizeX = horizontal ? along : across
      control.sizeY = horizontal ? across : along
      return object.toScreen(horizontal ? { x: plot.left + plot.width / 2, y: plot.top + plot.band * (index + 1) } : { x: plot.left + plot.band * (index + 1), y: plot.top + plot.height / 2 })
    },
    mouseDownHandler: startDrag(key),
    mouseUpHandler: endDrag,
    actionHandler: (_event, transform, x, y) => {
      const chart = transform.target as ChartObject
      const start = chart.dragging
      if (!start) return false
      const before = withDefaults(start.chart)
      const { plot } = drawChart(before)
      const bar = plot.band * before.barWidth
      // The handle sits past index + 1 bars and gaps, so it moves about that many times faster than one gap grows.
      const dx = alongGroups(chart, chart.toChartSpace({ x, y })) - start.startX
      const gap = Math.max(plot.band - bar + dx / (index + 1.5), 2)
      const band = bar + gap
      const grown = (band - plot.band) * before.groups.length
      // The chart grows along the groups: wider when upright, taller when lying down.
      const size = drawChart(before).horizontal ? { height: Math.max(before.height + grown, 60) } : { width: Math.max(before.width + grown, 80) }
      chart.setChart({ ...chart.chart, ...size, barWidth: Math.min(Math.max(bar / band, 0.1), 0.95) })
      return true
    },
    render: (ctx, left, top, _style, object: ChartObject) => renderHandle(key, ctx, left, top, object, control),
  })
  return control
}

/**
 * A handle along the left (`side` -1) or right (1) side of column `index`:
 * the whole height of a bar, or the middle of the plot for dots and lines.
 * Dragging either one makes every column wider or narrower, whichever
 * column it is on; the chart keeps its size.
 */
function barControl(index: number, side: -1 | 1): Control {
  const key = `${CHART_HANDLE}Bar${side < 0 ? 'L' : 'R'}${index}`
  const control: Control = new Control({
    actionName: BAR_WIDTH_ACTION,
    cursorStyleHandler: (_event, _control, object) => ((object as ChartObject).drawing().horizontal ? 'ns-resize' : 'ew-resize'),
    getVisibility: (object: ChartObject) => object.drawing().columns[index] !== undefined,
    positionHandler: (_dim, _finalMatrix, object: ChartObject) => {
      const column = object.drawing().columns[index] ?? { x: 0, y: 0, width: 0, height: 0 }
      const scale = screenScale(object)
      // Lying down, the handles sit on the column's top and bottom edges instead of its sides.
      if (object.drawing().horizontal) {
        control.sizeX = Math.max(column.width * scale.x, 12)
        control.sizeY = 10
        return object.toScreen({ x: column.x + column.width / 2, y: side < 0 ? column.y : column.y + column.height })
      }
      control.sizeX = 10
      control.sizeY = Math.max(column.height * scale.y, 12)
      return object.toScreen({ x: side < 0 ? column.x : column.x + column.width, y: column.y + column.height / 2 })
    },
    mouseDownHandler: startDrag(key),
    mouseUpHandler: endDrag,
    actionHandler: (_event, transform, x, y) => {
      const chart = transform.target as ChartObject
      const { plot } = chart.drawing()
      const middle = (chart.drawing().horizontal ? plot.top : plot.left) + plot.band * (index + 0.5)
      // The pointer marks the column's edge; a line chart's column is half as wide as its slot share.
      const reach = Math.abs(alongGroups(chart, chart.toChartSpace({ x, y })) - middle)
      const half = reach / (columnHalf(chart.chart.kind, 1))
      const barWidth = Math.min(Math.max((2 * half) / plot.band, 0.1), 0.95)
      if (Math.abs(barWidth - chart.chart.barWidth) < 0.005) return false
      chart.setChart({ ...chart.chart, barWidth })
      return true
    },
    render: (ctx, left, top, _style, object: ChartObject) => renderHandle(key, ctx, left, top, object, control),
  })
  return control
}
