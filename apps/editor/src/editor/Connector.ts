/**
 * An arrow on the canvas: straight, curved, elbow or U-shaped, with any of the
 * arrow ends from the Arrows panel. Its two ends have round handles you can
 * drag; let an end go over an object and it sticks to it (see connectors.ts).
 * Selected, it shows the same box as other objects, with the same rotate
 * areas just outside its corners, but no handles that stretch it. Once let
 * go of, a turned arrow's box squares up again (see squareUp).
 * Elbow and U-shaped arrows leave and enter an end along the side it is attached to.
 * Drawn with the same geometry as the panel tiles, and exported as plain SVG
 * paths, so it stays vector in SVG and PDF.
 */
import { CORNER_ROUTES, drawArrow, arrowBounds, routePoints, type ArrowLook, type EndDirs, type EndKind, type LineStyle, type MidMark, type Route } from '@biofigure-lab/ui/lib/arrow-geometry'
import { Control, FabricObject, Point, classRegistry, util, type TPointerEvent, type Transform } from 'fabric'

import { arrowSvg, type ConnectorEnd, type Side } from './connectors'
import type { XY } from './geometry'

/** The connector's own saved properties, besides Fabric's usual ones. */
const CONNECTOR_PROPERTIES = ['x1', 'y1', 'x2', 'y2', 'route', 'lineStyle', 'startEnd', 'endEnd', 'mid', 'attachStart', 'attachEnd', 'attachStartSide', 'attachEndSide', 'startDir', 'endDir'] as const

/** What Fabric reports as the action while an end handle is dragged. */
export const MOVE_END_ACTION = 'moveArrowEnd'

/** Which way an arrow's end leaves its object, in the arrow's own frame. */
export type Dir = 'up' | 'down' | 'left' | 'right'

const DIR_VECTORS: Record<Dir, XY> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } }

export type ConnectorOptions = Partial<ArrowLook> & { stroke?: string; strokeWidth?: number }

export class Connector extends FabricObject {
  static type = 'Connector'

  // Both ends, relative to the object's centre (its own space).
  declare x1: number
  declare y1: number
  declare x2: number
  declare y2: number
  declare route: Route
  declare lineStyle: LineStyle
  declare startEnd: EndKind
  declare endEnd: EndKind
  declare mid: MidMark
  /** Ids of the objects the start and end are stuck to, and which side of each (none for arrows attached before sides existed). */
  declare attachStart?: string
  declare attachEnd?: string
  declare attachStartSide?: Side
  declare attachEndSide?: Side
  /**
   * The way an elbow or U-shaped arrow leaves its start and enters its end, in
   * the arrow's own frame, when that end is attached to a chosen side: the way
   * that side faces. Saved with the arrow, so the drawing, the box, hit tests
   * and the end handles always agree, through selecting, undo and reopening.
   * Set whenever the ends are placed (see setSideNormals); none for ends with
   * no side.
   */
  declare startDir?: Dir
  declare endDir?: Dir

  constructor(options: Record<string, unknown> = {}) {
    super(options)
    this.x1 ??= 0
    this.y1 ??= 0
    this.x2 ??= 0
    this.y2 ??= 0
    this.route ??= 'straight'
    this.lineStyle ??= 'solid'
    this.startEnd ??= 'none'
    this.endEnd ??= 'filled'
    this.mid ??= 'none'
    this.set({
      fill: null,
      objectCaching: false,
      lockScalingX: true,
      lockScalingY: true,
      lockSkewingX: true,
      lockSkewingY: true,
    })
    // Fabric checks controls last-first, so the end handles win over the rotate areas where they overlap.
    const rotateZones = Object.entries(FabricObject.createControls().controls).filter(([key]) => key.startsWith('rotate-'))
    this.controls = { ...Object.fromEntries(rotateZones), p1: endControl(0), p2: endControl(1) }
  }

  /** A new arrow from `a` to `b` on the page. */
  static between(a: XY, b: XY, look: ArrowLook, paint: { stroke: string; strokeWidth: number }): Connector {
    const connector = new Connector({ ...paint, route: look.route, lineStyle: look.line, startEnd: look.start, endEnd: look.end, mid: look.mid })
    connector.setPagePoints(a, b)
    return connector
  }

  get look(): ArrowLook {
    return { route: this.route, line: this.lineStyle, start: this.startEnd, end: this.endEnd, mid: this.mid }
  }

  setLook(look: Partial<ArrowLook>): void {
    const { route, line, start, end, mid } = { ...this.look, ...look }
    const [a, b] = this.pagePoints()
    // Another route starts from the plain rules again (attached sides then set their directions afresh).
    this.set({ route, lineStyle: line, startEnd: start, endEnd: end, mid, ...(route !== this.route && { startDir: undefined, endDir: undefined }) })
    this.setPagePoints(a, b)
  }

  /** The saved directions as the geometry wants them, or none when no end has one. */
  ownDirs(): EndDirs | undefined {
    const start = this.startDir && DIR_VECTORS[this.startDir]
    const end = this.endDir && DIR_VECTORS[this.endDir]
    return start || end ? { ...(start && { start }), ...(end && { end }) } : undefined
  }

  /**
   * Take the way each attached side faces on the page (outward, unit vectors)
   * and keep it as the arrow's own saved directions: turned back by the
   * arrow's own turn and rounded to an axis. An end left out keeps its
   * direction (a detached arrow keeps its shape); `null` clears it, for an end
   * attached with no side.
   */
  setSideNormals(normals: { start?: XY | null; end?: XY | null }): void {
    const turn = util.degreesToRadians(this.angle)
    const own = (normal: XY | null | undefined, kept: Dir | undefined): Dir | undefined => {
      if (normal === undefined) return kept
      if (normal === null) return undefined
      const x = normal.x * Math.cos(turn) + normal.y * Math.sin(turn)
      const y = -normal.x * Math.sin(turn) + normal.y * Math.cos(turn)
      return Math.abs(x) > Math.abs(y) ? (x > 0 ? 'right' : 'left') : y > 0 ? 'down' : 'up'
    }
    this.set({ startDir: own(normals.start, this.startDir), endDir: own(normals.end, this.endDir) })
  }

  /** Both ends with what they're stuck to, in page coordinates. */
  ends(): [ConnectorEnd, ConnectorEnd] {
    const [a, b] = this.pagePoints()
    return [
      { point: a, ...(this.attachStart && { attach: this.attachStart }), ...(this.attachStart && this.attachStartSide && { side: this.attachStartSide }) },
      { point: b, ...(this.attachEnd && { attach: this.attachEnd }), ...(this.attachEnd && this.attachEndSide && { side: this.attachEndSide }) },
    ]
  }

  pagePoints(): [XY, XY] {
    const matrix = this.calcTransformMatrix()
    const a = util.transformPoint(new Point(this.x1, this.y1), matrix)
    const b = util.transformPoint(new Point(this.x2, this.y2), matrix)
    return [{ x: a.x, y: a.y }, { x: b.x, y: b.y }]
  }

  /**
   * Move the ends to these page points; the object's box is fitted around the
   * arrow again. A turned arrow stays turned: the box is fitted in its own
   * turned frame. Only for arrows not inside a group. `normals` are the ways
   * the attached sides face (see setSideNormals); left out, the saved
   * directions stay as they are.
   */
  setPagePoints(a: XY, b: XY, normals?: { start?: XY | null; end?: XY | null }): void {
    if (normals) this.setSideNormals(normals)
    const turn = util.degreesToRadians(this.angle)
    const back = util.degreesToRadians(360 - this.angle)
    const [ownA, ownB] = [new Point(a).rotate(back), new Point(b).rotate(back)]
    const box = arrowBounds(ownA, ownB, this.look, this.strokeWidth, this.ownDirs())
    const centre = new Point(box.left + box.width / 2, box.top + box.height / 2)
    // Fabric adds the line width to the box itself.
    this.set({
      width: box.width - this.strokeWidth,
      height: box.height - this.strokeWidth,
      x1: ownA.x - centre.x,
      y1: ownA.y - centre.y,
      x2: ownB.x - centre.x,
      y2: ownB.y - centre.y,
      dirty: true,
    })
    this.setPositionByOrigin(centre.rotate(turn), 'center', 'center')
    this.setCoords()
  }

  /**
   * Drop the turn but keep both ends where they are, so the box sits square
   * around the arrow again. Straight and curved arrows look the same either
   * way; an elbow or U-shaped arrow keeps its turn, since its corners follow
   * the box.
   */
  squareUp(): void {
    if (this.angle === 0 || CORNER_ROUTES.has(this.route) || this.group) return
    const [a, b] = this.pagePoints()
    this.set({ angle: 0 })
    this.setPagePoints(a, b)
  }

  /** Which end's handle is within `reach` page pixels of a point, if any. */
  endNear(point: XY, reach: number): 0 | 1 | undefined {
    const index = this.pagePoints().findIndex((end) => Math.hypot(end.x - point.x, end.y - point.y) <= reach)
    return index === -1 ? undefined : (index as 0 | 1)
  }

  /** The arrow's points in its own space, for drawing. */
  drawing(): ReturnType<typeof drawArrow> {
    return drawArrow({ x: this.x1, y: this.y1 }, { x: this.x2, y: this.y2 }, this.look, this.strokeWidth, this.ownDirs())
  }

  _render(ctx: CanvasRenderingContext2D): void {
    const drawing = this.drawing()
    const colour = typeof this.stroke === 'string' ? this.stroke : '#000000'
    ctx.save()
    ctx.strokeStyle = colour
    ctx.fillStyle = colour
    ctx.lineWidth = this.strokeWidth
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.setLineDash(drawing.dash ?? [])
    ctx.stroke(new Path2D(drawing.shaft))
    ctx.setLineDash([])
    for (const part of drawing.parts) {
      const path = new Path2D(part.d)
      if (part.filled) ctx.fill(path)
      ctx.stroke(path)
    }
    ctx.restore()
  }

  _toSVG(): string[] {
    const stroke = typeof this.stroke === 'string' ? this.stroke : '#000000'
    return [`<g opacity="${this.opacity}">\n`, ...arrowSvg(this.drawing(), { stroke, strokeWidth: this.strokeWidth }), '</g>\n']
  }

  toObject<T extends Omit<Record<string, unknown>, keyof this>, K extends keyof T = never>(propertiesToInclude: K[] = []): Record<string, unknown> {
    return super.toObject([...propertiesToInclude, ...CONNECTOR_PROPERTIES] as K[]) as Record<string, unknown>
  }
}
classRegistry.setClass(Connector)

/** Size of the round end handles, in screen pixels. */
export const END_HANDLE_SIZE_PX = 11

/** Radius of the round end handles, in screen pixels. */
const END_HANDLE_RADIUS_PX = 5

/** How far past the arrow's end its handle's centre sits, in screen pixels: the circle just touches the tip, so it doesn't hide the arrowhead. */
const END_HANDLE_GAP_PX = END_HANDLE_RADIUS_PX + 1

/** Where the pointer was pressed, relative to the end being dragged, per drag. */
const grabOffsets = new WeakMap<Transform, XY>()

/** One end of the arrow and the direction it points out in, on screen. */
function screenEnd(object: Connector, index: 0 | 1): { end: Point; out: XY } {
  const matrix = util.multiplyTransformMatrices(object.getViewportTransform(), object.calcTransformMatrix())
  const path = routePoints({ x: object.x1, y: object.y1 }, { x: object.x2, y: object.y2 }, object.route, object.ownDirs())
  const [end, before] = (index === 0 ? path.slice(0, 2) : path.slice(-2).reverse()).map((p) => util.transformPoint(new Point(p.x, p.y), matrix)) as [Point, Point]
  const length = Math.hypot(end.x - before.x, end.y - before.y)
  return { end, out: length === 0 ? { x: 0, y: 0 } : { x: (end.x - before.x) / length, y: (end.y - before.y) / length } }
}

/**
 * Set by the editor on its canvas: lines a dragged end up with the page,
 * other objects and the grid, the way moving an object does.
 */
export type ArrowEndSnapper = (point: XY, arrow: FabricObject, event: TPointerEvent) => XY

/**
 * A round handle touching one end of the arrow; dragging it moves that end
 * and unsticks it. Pressing on the end itself grabs it too.
 */
function endControl(index: 0 | 1): Control {
  return new Control({
    actionName: MOVE_END_ACTION,
    cursorStyle: 'crosshair',
    sizeX: END_HANDLE_SIZE_PX,
    sizeY: END_HANDLE_SIZE_PX,
    positionHandler: (_dim, _finalMatrix, object: Connector) => {
      const { end, out } = screenEnd(object, index)
      return new Point(end.x + out.x * END_HANDLE_GAP_PX, end.y + out.y * END_HANDLE_GAP_PX)
    },
    shouldActivate(key, object, pointer, corners) {
      const { end } = screenEnd(object as Connector, index)
      const onEnd = Math.hypot(pointer.x - end.x, pointer.y - end.y) <= END_HANDLE_SIZE_PX / 2
      return Control.prototype.shouldActivate.call(this, key, object, pointer, corners) || (object.canvas?.getActiveObject() === object && onEnd)
    },
    // The end keeps its distance from the pointer, so it doesn't jump to it when the drag starts.
    mouseDownHandler: (_event: TPointerEvent, transform: Transform, x: number, y: number) => {
      const end = (transform.target as Connector).pagePoints()[index]
      grabOffsets.set(transform, { x: x - end.x, y: y - end.y })
      return false
    },
    actionHandler: (event: TPointerEvent, transform: Transform, x: number, y: number) => {
      const connector = transform.target as Connector
      const offset = grabOffsets.get(transform) ?? { x: 0, y: 0 }
      const free = { x: x - offset.x, y: y - offset.y }
      const snapper = (connector.canvas as { snapArrowEnd?: ArrowEndSnapper } | undefined)?.snapArrowEnd
      const point = snapper ? snapper(free, connector, event) : free
      const [a, b] = connector.pagePoints()
      if (index === 0) connector.set({ attachStart: undefined, attachStartSide: undefined })
      else connector.set({ attachEnd: undefined, attachEndSide: undefined })
      connector.setPagePoints(index === 0 ? point : a, index === 0 ? b : point)
      return true
    },
    render: (ctx, left, top) => {
      ctx.save()
      ctx.fillStyle = '#ffffff'
      ctx.strokeStyle = '#2563eb'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(left, top, END_HANDLE_RADIUS_PX, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.restore()
    },
  })
}
