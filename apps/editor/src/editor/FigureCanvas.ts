/**
 * The figure page, drawn with Fabric.js. This class owns the Fabric canvas and
 * is the only place that talks to Fabric; the React screen calls its methods
 * and listens for changes.
 */
import {
  ActiveSelection,
  Canvas,
  Ellipse,
  FabricObject,
  Gradient,
  Group,
  IText,
  Line,
  Path,
  Point,
  Rect,
  Textbox,
  cache,
  classRegistry,
  loadSVGFromString,
  util,
  type BasicTransformEvent,
  type Control,
  Control as FabricControl,
  controlsUtils,
  type TPointerEvent,
  type Transform,
  type TransformActionHandler,
  type TPointerEventInfo,
} from 'fabric'

import type { LayerItem } from '@biofigure-lab/ui/components/layers-panel/LayersPanel'

import { PASTE_OFFSET_PX, SNAP_DISTANCE_PX, align, distribute, marginBox, snap, snapPoint, snapResize, touchesMargin, type AlignEdge, type Axis, type Box, type Guide, type Move, type Side } from './arrange'

import { BRACKETS, CORNER_SHAPES, DOUBLE_BRACKETS, OPEN_SHAPES, SHAPES, defaultCornerRadius, headSize, routePoints, shapePath, type ArrowLook, type ShapeKind } from '@biofigure-lab/ui/lib/arrow-geometry'

import { DRAG_THRESHOLD_PX, HIT_TOLERANCE_PX, cornerCursor, distance, rotateCursor, distanceToPolygon, distanceToSegment, type XY } from './geometry'
import { History } from './history'
import { toHex } from './colour'
import { iconById, iconMainColour, isOnePencilColour, keepsColour, loadIconSvg, modeColour, recolourPart, tintColour, type ColourMode } from './icon-library'
import { resizedScale } from './resize'
import { mmToPx } from './units'
import { AngleTip } from './angle-tip'
import { DEFAULT_CHOICE, pressOnObject, shapeAt, shapeFromDrag, toolAfterPlacing, type DrawChoice, type ShapeSpec, type ShapeStyle, type Tool } from './shapes'
import { Connector, END_HANDLE_SIZE_PX, MOVE_END_ACTION, type ArrowEndSnapper } from './Connector'
import { DEFAULT_FONT, fontByName, fontStack, loadFontFace } from './fonts'
import { IconTextEditor, hasSlotText, hitsSlot, iconOriginFromSvg, needsIconOrigin, noteIconOrigin, refreshSlotText, setIconOrigin, slotInfo, startSlotText } from './icon-text'
import { applyTextStyle, drawnWeight, insertSymbol, selectedCharsBox, readTextStyle, restoreText, snapshotText, textFaces, type TextSnapshot, type TextStyle } from './text-style'
import { ANCHOR_GAP, attachTargetAt, followEnds, sideNormal, sidePoint, type ConnectorEnd, type Frame, type Side as AnchorSide } from './connectors'
import { CellEditor } from './CellEditor'
import { DEFAULT_TEXT_FIT, OUTSIDE_TEXT, ShapeTextEditor, changeTextFit, fitWhileResizing, growToFit, hitsLabel, hitsBracketTextArea, hitsDoubleBracketArms, bracketTextArea, isShapeTextBox, labelBox, labelCorners, labelFromText, labelOf, labelScale, labelText, lookFor, restyleLabel, startingLabel, textFitOf, textOfLabel, textShapeOf, type ShapeLabel, type TextFit } from './shape-text'
import { ALL_HANDLES, CHART_HANDLE, ChartObject } from './ChartObject'
import { editChartText } from './chart-label-editor'
import { chartSizeForPage, createChart, type ChartData, type ChartKind, type ErrorBars } from './chart-model'
import { TableObject } from './TableObject'
import { applyShapeRules, cornerRadiusOf, keepBracketArms, kindOf, outline, redrawOutline } from './shape-outline'
import {
  DEFAULT_CELL_FILL,
  DEFAULT_TABLE_CHOICE,
  clearCells,
  moveCell,
  colWidthForPage,
  createTable,
  fullRange,
  hasMerge,
  layoutOf,
  runTableCommand,
  styleCells,
  styleTable,
  tableSize,
  wholeTable,
  type CellRange,
  type TableChoice,
  type TableCommand,
  type Move as CellMove,
  type TableStyle,
  shownCell,
} from './table-model'
import { newId } from './new-id'

// Fabric 7 places objects by their centre by default. Our shapes are placed by
// their top-left corner, like in most drawing apps.
FabricObject.ownDefaults.originX = 'left'
FabricObject.ownDefaults.originY = 'top'
// Selection handles like the sample screen: white squares with a blue edge.
Object.assign(FabricObject.ownDefaults, {
  borderColor: '#2563eb',
  cornerColor: '#ffffff',
  cornerStrokeColor: '#2563eb',
  cornerStyle: 'rect',
  cornerSize: 9,
  transparentCorners: false,
  padding: 0,
  // Redraw sharply while being resized, instead of stretching a picture of the
  // object until the handle is let go (which looks blurry or pixelated).
  noScaleCache: false,
})
/** Size of the side handles, drawn as bars along the edge, in screen pixels. */
const EDGE_HANDLE_LENGTH_PX = 16
const EDGE_HANDLE_THICKNESS_PX = 6

/** How far outside each corner the invisible rotate area sits, and its size, in screen pixels. */
const ROTATE_ZONE_OFFSET_PX = 12
const ROTATE_ZONE_SIZE_PX = 18

/** Rotating turns in steps of this many degrees; holding Shift turns freely. */
export const ROTATE_STEP_DEG = 15

/** Within this many degrees of a step, rotating clicks onto the step. */
const ROTATE_SNAP_DEG = 4

/**
 * Fabric's rotation: free, but clicking onto the nearest `ROTATE_STEP_DEG`
 * step once within `ROTATE_SNAP_DEG` of it. Holding Shift turns with no snapping at all.
 */
const rotateInSteps: TransformActionHandler = (event, transform, x, y) => {
  const target = transform.target
  const before = { snapAngle: target.snapAngle, snapThreshold: target.snapThreshold }
  target.set(event.shiftKey ? { snapAngle: 0 } : { snapAngle: ROTATE_STEP_DEG, snapThreshold: ROTATE_SNAP_DEG })
  try {
    return controlsUtils.rotationWithSnapping(event, transform, x, y)
  } finally {
    target.set(before)
  }
}

// Corner handles always show a diagonal resize cursor, also on wide, flat shapes.
// Just outside each corner sits an invisible area that rotates the object, with
// a curved-arrow cursor turned to match that corner. Fabric checks controls
// last-first, so the rotate areas go first and the corner handles win where they overlap.
const createControls = FabricObject.createControls.bind(FabricObject)
FabricObject.createControls = () => {
  const made = createControls()
  // The round handle sticking out above the object turns it the same way as the corner areas.
  const top: Control | undefined = made.controls.mtr
  if (top) top.actionHandler = rotateInSteps
  const rotateZones: Record<string, Control> = {}
  for (const key of ['tl', 'tr', 'bl', 'br']) {
    const control: Control | undefined = made.controls[key]
    if (!control) continue
    control.cursorStyleHandler = (_event, corner, object) => cornerCursor(corner, object.getTotalAngle(), object.flipX, object.flipY)
    rotateZones[`rotate-${key}`] = new FabricControl({
      x: control.x,
      y: control.y,
      offsetX: Math.sign(control.x) * ROTATE_ZONE_OFFSET_PX,
      offsetY: Math.sign(control.y) * ROTATE_ZONE_OFFSET_PX,
      sizeX: ROTATE_ZONE_SIZE_PX,
      sizeY: ROTATE_ZONE_SIZE_PX,
      actionName: 'rotate',
      actionHandler: rotateInSteps,
      cursorStyleHandler: (_event, corner, object) => rotateCursor(corner, object.getTotalAngle(), object.flipX, object.flipY),
      render: () => undefined,
    })
  }
  // Side handles stretch one way only, so they are drawn as short bars along
  // the edge instead of squares.
  for (const key of ['mt', 'mb', 'ml', 'mr']) {
    const control: Control | undefined = made.controls[key]
    if (!control) continue
    const along = control.y !== 0
    control.sizeX = along ? EDGE_HANDLE_LENGTH_PX : EDGE_HANDLE_THICKNESS_PX
    control.sizeY = along ? EDGE_HANDLE_THICKNESS_PX : EDGE_HANDLE_LENGTH_PX
    control.touchSizeX = control.sizeX + 8
    control.touchSizeY = control.sizeY + 8
    control.render = (ctx, left, top, _style, object) => {
      ctx.save()
      ctx.translate(left, top)
      ctx.rotate(util.degreesToRadians(object.getTotalAngle()))
      ctx.beginPath()
      ctx.roundRect(-control.sizeX / 2, -control.sizeY / 2, control.sizeX, control.sizeY, EDGE_HANDLE_THICKNESS_PX / 2)
      ctx.fillStyle = object.cornerColor
      ctx.strokeStyle = object.cornerStrokeColor
      ctx.lineWidth = 1
      ctx.fill()
      ctx.stroke()
      ctx.restore()
    }
  }
  made.controls = { ...rotateZones, ...made.controls }
  return made
}

// With the Select tool a click selects a text as an object and a drag moves
// it; only a double-click starts typing (see 'mouse:dblclick'). Fabric would
// start typing on a second click, so its mouse-up only finishes what's already being typed.
// eslint-disable-next-line @typescript-eslint/unbound-method -- called below with the text as `this`
const textMouseUp = IText.prototype.mouseUpHandler
IText.prototype.mouseUpHandler = function (this: IText, options) {
  if (this.isEditing) textMouseUp.call(this, options)
  else this.canvas?.textEditingManager.unregister(this)
}

/** A line with a filled arrowhead at its end: the v0.1 arrow, kept so older figures still open. New arrows are Connectors. */
export class Arrow extends Line {
  static type = 'Arrow'

  /** The arrowhead's three corners, in the line's own coordinates. */
  private headPoints(): [[number, number], [number, number], [number, number]] {
    const { x1, y1, x2, y2 } = this.calcLinePoints()
    const angle = Math.atan2(y2 - y1, x2 - x1)
    const length = Math.max(8, this.strokeWidth * 4)
    const spread = Math.PI / 7
    return [
      [x2, y2],
      [x2 - length * Math.cos(angle - spread), y2 - length * Math.sin(angle - spread)],
      [x2 - length * Math.cos(angle + spread), y2 - length * Math.sin(angle + spread)],
    ]
  }

  _render(ctx: CanvasRenderingContext2D): void {
    super._render(ctx)
    const [tip, left, right] = this.headPoints()
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(...tip)
    ctx.lineTo(...left)
    ctx.lineTo(...right)
    ctx.closePath()
    ctx.fillStyle = typeof this.stroke === 'string' ? this.stroke : '#000000'
    ctx.fill()
    ctx.restore()
  }

  _toSVG(): string[] {
    const points = this.headPoints()
      .map(([x, y]) => `${x} ${y}`)
      .join(' ')
    const fill = typeof this.stroke === 'string' ? this.stroke : '#000000'
    return [...super._toSVG(), `<polygon points="${points}" fill="${fill}" />
`]
  }
}
classRegistry.setClass(Arrow)

/**
 * A group made with Group (Ctrl+G): moves, resizes and recolours as one, and
 * can be ungrouped. Icons are Fabric groups too, but those stay whole.
 */
/**
 * Our own object properties that saving, undo and copying keep: a label, which
 * library icon it is, its layer id and lock, an id that arrows use to stick to
 * it, which shape from the Shapes panel it is, a shape's text and how it fits,
 * and an icon's colour mode with the colours it shows in RGB, and the text of
 * an icon's text slot with where the icon's origin sits on its grid (icon-text.ts).
 */
const OWN_PROPERTIES = ['name', 'iconId', 'layerId', 'locked', 'figureId', 'shapeKind', 'cornerRadius', 'label', 'textFit', 'growLimit', 'baseWeight', 'colourMode', 'baseColours', 'slotText', 'slotShown', 'iconOrigin']

export class FigureGroup extends Group {
  static type = 'FigureGroup'
}
classRegistry.setClass(FigureGroup)

type Own = FabricObject & { figureId?: string; shapeKind?: ShapeKind }
const idOf = (object: FabricObject) => (object as Own).figureId

/** Every object on the page, also those inside groups (not the parts of icons). */
const allObjects = (objects: readonly FabricObject[]): FabricObject[] =>
  objects.flatMap((object) => (object instanceof FigureGroup ? [object, ...allObjects(object.getObjects())] : [object]))

/** Where an object is, for arrows stuck to it. */
const frameOf = (object: FabricObject): Frame => ({
  matrix: object.calcTransformMatrix(),
  width: object.width + object.strokeWidth,
  height: object.height + object.strokeWidth,
  round: object instanceof Ellipse || ['ellipse', 'circle', 'cell'].includes((object as Own).shapeKind ?? ''),
})

/**
 * Where an anchor is on screen and the way it points out of its object, both
 * in screen pixels. The drawing and the hit test both start from this, so what
 * you see is what you hit.
 */
function anchorOnScreen(frame: Frame, side: AnchorSide, vpt: Canvas['viewportTransform']): { at: XY; out: XY } {
  const spot = sidePoint(frame, side, ANCHOR_GAP)
  const normal = sideNormal(frame, side)
  const [x, y] = [vpt[0] * normal.x + vpt[2] * normal.y, vpt[1] * normal.x + vpt[3] * normal.y]
  const length = Math.hypot(x, y) || 1
  return { at: { x: vpt[0] * spot.x + vpt[2] * spot.y + vpt[4], y: vpt[1] * spot.x + vpt[3] * spot.y + vpt[5] }, out: { x: x / length, y: y / length } }
}

/**
 * One anchor marker in screen pixels: a tiny arrow that starts at the spot
 * where an arrow end will sit and points outward along `out`. The active one
 * is 1.5 times bigger, with a soft halo behind it.
 */
function drawAnchorMarker(ctx: CanvasRenderingContext2D, at: XY, out: XY, active: boolean): void {
  const k = active ? ANCHOR_ACTIVE_SCALE : 1
  const across = { x: -out.y, y: out.x }
  // A point `along` the way out and `side` across it, in marker pixels.
  const pt = (along: number, side: number): XY => ({ x: at.x + (out.x * along + across.x * side) * k, y: at.y + (out.y * along + across.y * side) * k })
  const polygon = (points: XY[]) => {
    ctx.beginPath()
    points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
  }
  ctx.fillStyle = ANCHOR_COLOUR
  ctx.strokeStyle = ANCHOR_COLOUR
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (active) {
    const centre = pt(ANCHOR_ARROW_LENGTH_PX / 2, 0)
    ctx.globalAlpha = 0.2
    ctx.beginPath()
    ctx.arc(centre.x, centre.y, ANCHOR_HALO_RADIUS_PX, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }
  ctx.lineWidth = 2 * k
  polygon([pt(0, 0), pt(ANCHOR_SHAFT_PX, 0)])
  ctx.stroke()
  polygon([pt(ANCHOR_ARROW_LENGTH_PX, 0), pt(ANCHOR_SHAFT_PX, -3), pt(ANCHOR_SHAFT_PX, 3)])
  ctx.fill()
}

/** Lines and arrows: you click on the line itself, not their whole box, until they're selected. */
const isLineLike = (object: FabricObject) => object instanceof Line || object instanceof Connector

/** Lines and open shapes (brackets, membranes) take a line colour but no fill. */
const isOpen = (object: FabricObject) => object instanceof Line || object instanceof Connector || OPEN_SHAPES.has((object as Own).shapeKind as ShapeKind)

/** The objects that get painted: what's inside groups, but icons stay whole. */
const paintedParts = (objects: readonly FabricObject[]): FabricObject[] =>
  objects.flatMap((object) => (object instanceof FigureGroup ? paintedParts(object.getObjects()) : [object]))

const isIcon = (object: FabricObject) => object instanceof Group && !(object instanceof FigureGroup)

/** The drawn parts inside an icon, however deeply its SVG nests them. */
const iconParts = (object: FabricObject): FabricObject[] =>
  object instanceof Group ? object.getObjects().flatMap(iconParts) : [object]

/** Every colour an icon is drawn with: plain fills and outlines, and the colours inside its gradients. */
function iconColours(object: FabricObject): string[] {
  return iconParts(object).flatMap((part) =>
    [part.fill, part.stroke].flatMap((paint) => (paint instanceof Gradient ? paint.colorStops.map((stop) => stop.color) : typeof paint === 'string' ? [paint] : [])),
  )
}

/** A gradient with every colour tinted; a new one, since parts can share theirs. */
function tintGradient(gradient: Gradient<'linear' | 'radial'>, from: string, to: string): Gradient<'linear' | 'radial'> {
  return new Gradient({ ...gradient.toObject(), colorStops: gradient.colorStops.map((stop) => ({ ...stop, color: tintColour(stop.color, from, to) })) })
}

/**
 * A new colour for an icon as a whole: every shade, gradients included, is
 * tinted towards it and keeps how much lighter or darker it was than the
 * icon's main colour, so shaded and multi-tone icons keep their shading.
 * A one-colour icon simply takes the new colour.
 */
function recolourIcon(object: FabricObject, colour: string): void {
  // The new colour goes on the icon's RGB colours; its colour mode then draws them again.
  const mode = colourModeOf(object)
  showBaseColours(object)
  // Pencil drawings keep their paper (and Scribble its dark outline); Graphite and Shaded have one pencil colour, which is simply replaced.
  const iconId = iconIdOf(object)
  const from = isOnePencilColour(iconId) ? undefined : iconMainColour(iconColours(object), iconId)
  for (const part of iconParts(object)) {
    const next = recolourPart(part, colour, from)
    if (typeof part.fill === 'string' && keepsColour(part.fill, iconId)) delete next.fill
    if (typeof part.stroke === 'string' && keepsColour(part.stroke, iconId)) delete next.stroke
    part.set(next)
    if (!from) continue
    if (part.fill instanceof Gradient) part.set({ fill: tintGradient(part.fill, from, colour) })
    if (part.stroke instanceof Gradient) part.set({ stroke: tintGradient(part.stroke, from, colour) })
  }
  setColourMode(object, mode)
}

/** A library icon's id, if the object is one. */
const iconIdOf = (object: FabricObject): string | undefined => {
  const id = (object as FabricObject & { iconId?: unknown }).iconId
  return typeof id === 'string' ? id : undefined
}

/** One part's fill or outline as saved: a colour, a gradient's settings, or whatever else it was (none). */
type SavedPaint = string | { gradient: Record<string, unknown> } | null
/** The colour mode name of the CMYK print preview, which older figures may still have saved. */
const LEGACY_CMYK = 'cmyk'
type IconWithMode = FabricObject & { colourMode?: ColourMode | typeof LEGACY_CMYK; baseColours?: { fill: SavedPaint; stroke: SavedPaint }[] }

const savePaint = (paint: unknown): SavedPaint =>
  paint instanceof Gradient ? { gradient: paint.toObject() as Record<string, unknown> } : typeof paint === 'string' ? paint : null
const loadPaint = (paint: SavedPaint): string | Gradient<'linear' | 'radial'> | null =>
  paint !== null && typeof paint === 'object' ? new Gradient(paint.gradient) : paint

/** An icon's colour mode; RGB when it has none. */
const colourModeOf = (object: FabricObject): ColourMode => ((object as IconWithMode).colourMode === 'grey' ? 'grey' : 'rgb')

/**
 * Put an icon's RGB colours back on its parts, as kept when a colour mode
 * was turned on, and forget them. Does nothing for an icon in RGB.
 */
function showBaseColours(object: FabricObject): void {
  const icon = object as IconWithMode
  const base = icon.baseColours
  const parts = iconParts(object)
  if (base?.length === parts.length) parts.forEach((part, i) => part.set({ fill: loadPaint(base[i]?.fill ?? null), stroke: loadPaint(base[i]?.stroke ?? null) }))
  icon.baseColours = undefined
  icon.colourMode = undefined
  object.set({ dirty: true })
}

/**
 * Draw an icon in a colour mode. Its RGB colours are kept on the icon, so
 * switching back to RGB (or to another mode) starts from them, never from
 * the grey or print-preview shades.
 */
function setColourMode(object: FabricObject, mode: ColourMode): void {
  showBaseColours(object)
  if (mode === 'rgb') return
  const icon = object as IconWithMode
  const parts = iconParts(object)
  icon.baseColours = parts.map((part) => ({ fill: savePaint(part.fill), stroke: savePaint(part.stroke) }))
  icon.colourMode = mode
  const draw = (paint: unknown) =>
    paint instanceof Gradient
      ? new Gradient({ ...paint.toObject(), colorStops: paint.colorStops.map((stop) => ({ ...stop, color: modeColour(stop.color, mode) })) })
      : typeof paint === 'string'
        ? modeColour(paint, mode)
        : paint
  for (const part of parts) part.set({ fill: draw(part.fill), stroke: draw(part.stroke) })
  object.set({ dirty: true })
}

/** An icon's colours as they are in RGB: its kept ones while a colour mode is on. */
function baseIconColours(object: FabricObject): string[] {
  const base = (object as IconWithMode).baseColours
  if (!base) return iconColours(object)
  return base.flatMap(({ fill, stroke }) =>
    [fill, stroke].flatMap((paint) =>
      typeof paint === 'string' ? [paint] : paint ? ((paint.gradient.colorStops as { color: string }[] | undefined) ?? []).map((stop) => stop.color) : [],
    ),
  )
}

/** The parts of a colour change that make sense for an object: text has no outline, lines have no fill. */
function paintFor(object: FabricObject, paint: Pick<StyleChange, 'fill' | 'stroke' | 'strokeWidth'>): Partial<FabricObject> {
  if (isIcon(object)) {
    if (paint.fill !== undefined) recolourIcon(object, paint.fill)
    return paint.fill === undefined ? {} : { dirty: true }
  }
  const { fill, stroke, strokeWidth } = paint
  if (object instanceof IText) return fill === undefined ? {} : { fill }
  const outline = { ...(stroke !== undefined && { stroke }), ...(strokeWidth !== undefined && { strokeWidth }) }
  if (isOpen(object)) return outline
  return { ...(fill !== undefined && { fill }), ...outline }
}

/** What's on the app's own clipboard (Ctrl+C), shared by every figure open in this tab. */
let clipboard: FabricObject | undefined

/** Colour of the snapping guide lines: stands apart from the blue selection. */
const GUIDE_COLOUR = '#e11d48'

/** The arrow anchors' blue, and their sizes, all in screen pixels (the same at every zoom). */
const ANCHOR_COLOUR = '#2563eb'
/** The marker: a 6 px shaft and a head, 10 px in all; 1.5 times that while active. */
const ANCHOR_SHAFT_PX = 6
const ANCHOR_ARROW_LENGTH_PX = 10
const ANCHOR_ACTIVE_SCALE = 1.5
const ANCHOR_HALO_RADIUS_PX = 9
/** The pointer picks an anchor within this of the middle of its marker as drawn when active (half its length) plus some slack, so the whole marker, tip included, can be pressed. */
const ANCHOR_REACH_PX = (ANCHOR_ARROW_LENGTH_PX * ANCHOR_ACTIVE_SCALE) / 2 + 5
/** How far outside the object the active object's outline sits. */
const ANCHOR_OUTLINE_GAP_PX = 3

/** What an arrow end would attach to: the object and where it is, and the side only when the pointer is on one of its anchor dots (over its body, there is no side). */
type AnchorHover = { id: string; side?: AnchorSide; frame: Frame }

/** How far in from the page edge the margin snap lines sit, in mm. */
const SNAP_MARGIN_MM = 4

/** The page margin for snapping, in page pixels. */
const snapMarginPx = () => mmToPx(SNAP_MARGIN_MM)

/** How far from an arrow's drawn path a press still picks it, in screen pixels (more forgiving than other objects, since arrows are thin). */
const ARROW_HIT_PX = 8

/**
 * Whether a page point is on an arrow: within ARROW_HIT_PX of its drawn path
 * (the same on screen at any zoom), and around its heads, which are wider than
 * the line. The empty inside of a U or elbow, or the arrow's box, doesn't count.
 */
function arrowHit(arrow: Connector, point: XY, zoom: number): boolean {
  const reach = ARROW_HIT_PX / zoom
  const along = distanceToObject(arrow, point)
  if (along <= reach) return true
  const head = headSize(arrow.strokeWidth)
  const nearEnd = arrow.pagePoints().some((end) => Math.hypot(end.x - point.x, end.y - point.y) <= head)
  return nearEnd && along <= reach + head * 0.7
}

/**
 * How far a point is from what you see of an object, in page pixels: 0 on it.
 * Lines count along the line itself, not their whole bounding box.
 */
function distanceToObject(object: FabricObject, point: XY): number {
  if (object instanceof Connector) {
    // Worked out in the arrow's own frame and turned onto the page, so turned corner arrows count right.
    const matrix = object.calcTransformMatrix()
    const own = routePoints({ x: object.x1, y: object.y1 }, { x: object.x2, y: object.y2 }, object.route, object.ownDirs())
    const path = own.map((p) => util.transformPoint(new Point(p.x, p.y), matrix))
    const nearest = Math.min(...path.slice(1).map((p, i) => distanceToSegment(point, path.at(i)!, p)))
    return Math.max(0, nearest - object.strokeWidth / 2)
  }
  if (object instanceof Line) {
    const { x1, y1, x2, y2 } = object.calcLinePoints()
    const matrix = object.calcTransformMatrix()
    const a = util.transformPoint(new Point(x1, y1), matrix)
    const b = util.transformPoint(new Point(x2, y2), matrix)
    return Math.max(0, distanceToSegment(point, a, b) - object.strokeWidth / 2)
  }
  return distanceToPolygon(point, object.getCoords())
}

/**
 * Scale objects from one page size to another: as large as fits both ways,
 * centred on the new page. Each object keeps its look, only bigger or smaller.
 */
export function fitObjects(objects: FabricObject[], from: { width: number; height: number }, to: { width: number; height: number }): void {
  const scale = Math.min(to.width / from.width, to.height / from.height)
  const move: Parameters<typeof util.multiplyTransformMatrices>[0] = [scale, 0, 0, scale, (to.width - from.width * scale) / 2, (to.height - from.height * scale) / 2]
  for (const object of objects) {
    util.applyTransformToObject(object, util.multiplyTransformMatrices(move, object.calcOwnMatrix()))
    object.setCoords()
  }
}

/** Fabric's canvas with a forgiving hit area: see HIT_TOLERANCE_PX. */
class FigureFabricCanvas extends Canvas {
  /** Grid spacing in page pixels when the grid is on. */
  grid: number | undefined

  /** Snaps a dragged arrow end (see `ArrowEndSnapper` in Connector). */
  snapArrowEnd: ArrowEndSnapper | undefined
  /** Set by the editor: whether a page point is on an arrow anchor marker (those presses start an arrow). */
  inAnchorMarker: ((point: XY) => boolean) | undefined

  /** The page's white background, with the grid on top of it when it's on (never exported). */
  _renderBackground(ctx: CanvasRenderingContext2D): void {
    super._renderBackground(ctx)
    if (!this.grid || ctx !== this.getContext()) return
    const step = this.grid * this.getZoom()
    ctx.save()
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.08)'
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let x = step; x < this.width; x += step) {
      ctx.moveTo(Math.round(x) + 0.5, 0)
      ctx.lineTo(Math.round(x) + 0.5, this.height)
    }
    for (let y = step; y < this.height; y += step) {
      ctx.moveTo(0, Math.round(y) + 0.5)
      ctx.lineTo(this.width, Math.round(y) + 0.5)
    }
    ctx.stroke()
    ctx.restore()
  }

  _checkTarget(object: FabricObject, point: Point): boolean {
    if (!object.visible || !object.evented) return false
    if (object instanceof Connector && !(object === this._activeObject && !this.skipTargetFind)) return arrowHit(object, point, this.getZoom())
    // A selected line or arrow can be grabbed anywhere in its box, like other objects.
    if (object === this._activeObject && isLineLike(object)) return distanceToPolygon(point, object.getCoords()) <= HIT_TOLERANCE_PX / this.getZoom()
    const kind = kindOf(object)
    // A double bracket is picked by its brackets or its text, so a picture between them can still be clicked; once selected, anywhere in its box.
    if (kind !== undefined && DOUBLE_BRACKETS.has(kind) && object !== this._activeObject) return hitsDoubleBracketArms(object, point, HIT_TOLERANCE_PX / this.getZoom()) || hitsLabel(object, point)
    if (distanceToObject(object, point) <= HIT_TOLERANCE_PX / this.getZoom()) return true
    // A bracket's text sits outside its box, and clicking it picks the bracket; so does its empty text area while it is selected.
    return kind !== undefined && OUTSIDE_TEXT.has(kind) && (object === this._activeObject ? hitsBracketTextArea(object, point) : hitsLabel(object, point))
  }

  /**
   * While the arrow tool is on, pressing on the page draws, so Fabric looks
   * for no objects (skipTargetFind). The arrow just drawn stays selected,
   * though, and its handles and box can still be grabbed to adjust it.
   */
  findTarget(e: TPointerEvent): ReturnType<Canvas['findTarget']> {
    const active = this._activeObject
    if (!this._targetInfo && this.skipTargetFind && active instanceof Connector && !active.group) {
      const control = active.findControl(this.getViewportPoint(e))
      // A press on an anchor marker starts a new arrow, even inside the selected arrow's box (but its end handles still win).
      const zone = this.inAnchorMarker?.(this.getScenePoint(e)) === true
      const onIt = control ? control.key === 'p1' || control.key === 'p2' || !zone : !zone && arrowHit(active, this.getScenePoint(e), this.getZoom())
      if (onIt) return { target: active, currentTarget: active, subTargets: [], currentSubTargets: [] }
    }
    return super.findTarget(e)
  }

  /** The topmost object under a point, using the same forgiving hit area. */
  objectAt(point: XY): FabricObject | undefined {
    return this.getObjects()
      .toReversed()
      .find((object) => this._checkTarget(object, new Point(point.x, point.y)))
  }
}

/** What the properties panel shows about the current selection. */
export type SelectionInfo = {
  kind: 'shape' | 'line' | 'text' | 'icon' | 'group' | 'table' | 'chart' | 'multiple'
  name: string
  /** How many objects are selected (a group counts as one). */
  count: number
  /** Whether the selection holds a group that can be ungrouped. */
  hasGroup: boolean
  /** Whether every selected object is locked in place. */
  locked: boolean
  /** The box around the selection on the page, line included, for placing the quick-actions toolbar. */
  bounds: Box
  fill?: string
  stroke?: string
  strokeWidth?: number
  /** The look of a selected text, or of its selected characters while typing. */
  text?: TextStyle
  /** True while some characters are selected in the text being typed. */
  textRange?: boolean
  /** True while typing in the selected shape. */
  typingInShape?: boolean
  /** True when the selected shape's text was clicked once (picked, not typed in). */
  textPicked?: boolean
  /** Where those characters are on the page, for the small quick-actions bar right above them. */
  textRangeBounds?: Box
  opacity: number
  left: number
  top: number
  width: number
  height: number
  /** For one table: its look, and what the picked cells allow. */
  table?: TableInfo
  /** For one chart: its data and settings. */
  chart?: ChartData
  /** For one shape that takes text: what happens when its text gets too long. */
  textFit?: TextFit
  /** For an icon: how its colours are drawn (in colour or greyscale). */
  colourMode?: ColourMode
  /** For one icon from the library: its library id, e.g. "small-molecules/caffeine-skeletal". */
  iconId?: string
  /** For one icon with a text slot: the text typed for it and whether it shows; null for an icon without a slot. */
  slot?: { text: string; shown: boolean } | null
  /** For one shape: which one from the Shapes panel (also for rectangles and ellipses from their own tools). */
  shapeKind?: ShapeKind
  /** For one shape with straight sides: how round its corners are, in page pixels. */
  cornerRadius?: number
  /** For one arrow: its path, line and ends. */
  arrowLook?: ArrowLook
}

export type TableInfo = TableStyle & {
  /** Whether cells are picked (styles then go onto them only). */
  picked: boolean
  canMerge: boolean
  canUnmerge: boolean
}

export type CanvasState = {
  selection: SelectionInfo | null
  /** Every object on the page for the layers panel, the top one first. */
  layers: LayerItem[]
  selectedLayerIds: string[]
  canUndo: boolean
  canRedo: boolean
  zoom: number
  tool: Tool
  /** True while the selection is being dragged, resized or rotated. */
  transforming: boolean
  /** The look new text boxes get (changed in the Text panel with no text selected). */
  newText: TextStyle
  /** The look of the text in the next shape the Shapes panel draws. */
  nextShapeText: TextStyle
  /** What the shape and arrow tools draw next, with the look set in the Shapes panel. */
  drawChoice: DrawChoice
}

export type StyleChange = Partial<Pick<SelectionInfo, 'fill' | 'stroke' | 'strokeWidth' | 'opacity' | 'left' | 'top'>>
export type SizeChange = { width?: number; height?: number }

/** The name shown for an object (also saved with it). */
const objectName = (object: FabricObject): string => {
  const name = (object as FabricObject & { name?: string }).name
  if (name) return name
  if (object instanceof FigureGroup) return 'Group'
  if (object instanceof Rect) return 'Rectangle'
  if (object instanceof Ellipse) return 'Ellipse'
  if (object instanceof Arrow || object instanceof Connector) return 'Arrow'
  const shape = SHAPES.find((item) => item.id === (object as Own).shapeKind)
  if (shape) return shape.name
  if (object instanceof Line) return 'Line'
  if (object instanceof IText) return 'Text'
  if (object instanceof TableObject) return 'Table'
  if (object instanceof ChartObject) return 'Chart'
  return 'Object'
}

/** What we keep on each object for the layers panel (saved with it). */
type LayerProps = { layerId?: string }
const layerProps = (object: FabricObject) => object as FabricObject & LayerProps

let nextLayerId = 0
const newLayerId = () => `layer-${Date.now().toString(36)}-${(nextLayerId++).toString(36)}`

const layerKind = (object: FabricObject): LayerItem['kind'] =>
  object instanceof FigureGroup ? 'group'
    : object instanceof TableObject ? 'table'
    : object instanceof ChartObject ? 'graph'
    : isIcon(object) ? 'icon'
      : object instanceof Arrow || object instanceof Connector ? 'arrow'
        : object instanceof Line ? 'line'
          : object instanceof IText ? 'text'
            : 'shape'

const colour = (value: unknown) => (typeof value === 'string' ? value : undefined)

/** A pinch makes an object no smaller than this across, in points. */
const MIN_PINCH_SIZE = 4

/** The pinched object, and each object in a pinched selection of several. */
const pinchedParts = (object: FabricObject): FabricObject[] => (object instanceof ActiveSelection ? [object, ...object.getObjects()] : [object])

/** While pinching, the cached picture is drawn again once the object is this much bigger than it (20%). */
const SHARPEN_AT = 1.2

/** Fabric's own (internal) cache step, and the zoom the cached picture was drawn at. */
type CachedObject = FabricObject & { _updateCacheCanvas: () => boolean; zoomX?: number }

/**
 * While a pinch resizes an object, keep stretching the picture Fabric has
 * cached of it instead of drawing it again at every step, as Fabric does
 * itself while a corner handle is dragged (its `noScaleCache`, which only
 * looks at handle drags). Shrinking a picture keeps it sharp; growing one
 * blurs it, so once the object is 20% bigger than its picture, the picture
 * is drawn again at the new size (bug: a small shape pinched bigger looked
 * blurry until the fingers lifted). Off again, the object is drawn sharp at
 * its final size.
 */
function keepCachedPicture(object: FabricObject, keep: boolean): void {
  if (!keep) {
    Reflect.deleteProperty(object, '_updateCacheCanvas')
    object.set('dirty', true)
    return
  }
  const cached = object as CachedObject
  const redraw = cached._updateCacheCanvas.bind(cached)
  Object.assign(object, {
    _updateCacheCanvas: () => {
      const drawnAt = cached.zoomX ?? 0
      return drawnAt === 0 || object.getTotalObjectScaling().x > drawnAt * SHARPEN_AT ? redraw() : false
    },
  })
}

/** Two taps closer together than this, in ms, are a double tap. */
const DOUBLE_TAP_MS = 400

/** Finds a library icon's SVG and name by its id; may load it first. */
type IconLookup = (iconId: string) => { svg: string; name: string } | undefined | Promise<{ svg: string; name: string } | undefined>
const libraryEntry: IconLookup = async (iconId) => {
  const meta = iconById(iconId)
  const svg = meta && (await loadIconSvg(iconId))
  return meta && svg ? { svg, name: meta.name } : undefined
}

/** Whether a pointer event came from a finger. */
const isTouch = (e: TPointerEvent): boolean => ('pointerType' in e ? e.pointerType === 'touch' : typeof TouchEvent !== 'undefined' && e instanceof TouchEvent)

export class FigureCanvas {
  readonly canvas: FigureFabricCanvas
  /** The shape being drawn while the pointer is held down. */
  private drawing: { start: XY; object: FabricObject } | undefined
  private editingBeforeClick: IText | undefined
  /** What was selected when the current click started, to tell a click on an already selected table. */
  private activeBeforeClick: FabricObject | undefined
  /** The last tap with a finger, to tell a double tap (see `onPointerUp`). */
  private lastTap: { target: FabricObject; at: number } | undefined
  /** A selected shape whose text was clicked once: the Text tab then styles that text (see `onPointerUp`). */
  private pickedText: FabricObject | undefined
  /** A drag over a table's cells that picks a block of them, from the cell it started on. */
  private cellDrag: { table: TableObject; anchor: { r: number; c: number } } | undefined
  private history: History
  private restoring = false
  private readonly abort = new AbortController()
  private tool: Tool = 'select'
  private choice: DrawChoice = DEFAULT_CHOICE
  private tableChoice: TableChoice = DEFAULT_TABLE_CHOICE
  private chartChoice: { kind: ChartKind; errorBars: ErrorBars } = { kind: 'bar', errorBars: 'sd' }
  private readonly cells: CellEditor
  private readonly shapeText: ShapeTextEditor
  private readonly iconText: IconTextEditor
  /** What the arrow being drawn is stuck to at its start. */
  private drawingAttach: string | undefined
  private drawingSide: AnchorSide | undefined
  /** Set when a lone arrow is pressed to be dragged: where, and whether the pointer has moved far enough yet to count as a drag. */
  private dragGate: { arrow: Connector; press: XY; left: number; top: number; passed: boolean } | undefined
  /** The object and anchor under the pointer while an arrow is drawn or an arrow end is dragged. */
  private anchorHover: AnchorHover | undefined
  /** An existing arrow's end is being dragged: the anchors show, as with the arrow tool. */
  private endDragging = false
  /** Where the last dragged arrow end was put, and the anchor it snapped to, for when it is let go. */
  private lastEndSnap: { point: XY; hover: AnchorHover | undefined } | undefined
  private listeners = new Set<(state: CanvasState) => void>()
  /** Edges of the objects that aren't being dragged, worked out once per drag. */
  private snapTargets: Box[] | undefined
  private guides: Guide[] = []
  /** The angle shown while rotating. */
  private angleTip: AngleTip
  private transforming = false
  /** A two-finger resize on a phone: the selection and its scale and middle when it started. */
  private pinch: { object: FabricObject; scaleX: number; scaleY: number; centre: Point } | undefined
  private newText: Partial<TextStyle> = {}
  /** The selected text as it was before a font or weight preview, to put back. */
  private preview: { text: IText; before: TextSnapshot; change?: Partial<TextStyle> } | undefined
  /** Where a text box drag started, and the dashed box shown meanwhile. */
  private textDrag: { start: XY; box: Rect } | undefined
  /** Text being highlighted by a drag with the Text tool, and where the drag started in it. */
  private textSelecting: { text: IText; anchor: number } | undefined

  /** The page's size in page pixels. Changes only through `setPage`. */
  page: { width: number; height: number }

  constructor(element: HTMLCanvasElement, page: { width: number; height: number }, saved?: string) {
    this.page = page
    this.canvas = new FigureFabricCanvas(element, {
      width: page.width,
      height: page.height,
      backgroundColor: '#ffffff',
      preserveObjectStacking: true,
      selectionColor: 'rgba(37, 99, 235, 0.08)',
      selectionBorderColor: '#2563eb',
      // Let right-clicks through to the editor's own menu.
      stopContextMenu: false,
    })
    this.canvas.snapArrowEnd = (point, arrow, e) => this.snapArrowEnd(point, arrow, e)
    this.canvas.inAnchorMarker = (point) => this.tool === 'arrow' && this.anchorAt(point)?.side !== undefined
    this.angleTip = new AngleTip(this.canvas.wrapperEl)
    this.history = new History(this.serialize())
    this.cells = new CellEditor(this.canvas, () => this.commit(), () => this.emit())
    this.shapeText = new ShapeTextEditor(
      this.canvas,
      () => this.followConnectors(),
      () => this.commit(),
      () => this.emit(),
    )
    this.iconText = new IconTextEditor(this.canvas, () => this.emit(), () => this.commit())

    const changed = () => this.emit()
    // A turned arrow's box squares up around it once it's no longer selected.
    const squareUp = ({ deselected }: { deselected: FabricObject[] }) => {
      for (const object of deselected) if (object instanceof Connector) object.squareUp()
      this.emit()
    }
    this.canvas.on('selection:created', changed)
    this.canvas.on('selection:updated', squareUp)
    this.canvas.on('selection:cleared', squareUp)
    this.canvas.on('object:moving', (event) => {
      // A press on an arrow with a tiny wobble is a click, not a drag: the arrow stays put until the pointer has moved a real distance.
      const gate = this.dragGate
      if (gate && event.target === gate.arrow && !gate.passed) {
        const pointer = this.canvas.getViewportPoint(event.e)
        if (Math.hypot(pointer.x - gate.press.x, pointer.y - gate.press.y) < DRAG_THRESHOLD_PX) {
          gate.arrow.set({ left: gate.left, top: gate.top })
          gate.arrow.setCoords()
          return
        }
        gate.passed = true
        this.unstickDraggedArrows()
      }
      this.snapWhileMoving(event)
      this.followConnectors()
      this.transforming = true
      this.emit()
    })
    this.canvas.on('object:rotating', ({ e, target }) => {
      this.showAngle(e, target)
      this.followConnectors()
      this.transforming = true
      this.emit()
    })
    this.canvas.on('object:resizing', () => this.followConnectors())
    this.canvas.on('before:transform', ({ e, transform }) => {
      // Dragging a lone arrow only lets go of its objects once the drag is real (see 'object:moving').
      if (transform.action === 'drag' && transform.target instanceof Connector) {
        const press = this.canvas.getViewportPoint(e)
        this.dragGate = { arrow: transform.target, press: { x: press.x, y: press.y }, left: transform.target.left, top: transform.target.top, passed: false }
        return
      }
      this.dragGate = undefined
      if (transform.action === 'drag' || transform.action === 'rotate') this.unstickDraggedArrows()
    })
    this.canvas.on('mouse:up', () => {
      this.angleTip.hide()
      this.endSnapping()
      // A table's column or row tab picks cells on press, without a change to save.
      if (this.activeTable()) this.emit()
      if (!this.transforming) return
      this.transforming = false
      this.emit()
    })
    this.canvas.on('after:render', ({ ctx }) => {
      this.drawGuides(ctx)
      this.drawPickedText(ctx)
      this.drawAnchors(ctx)
    })
    this.canvas.on('object:scaling', ({ e, target, transform }) => {
      this.snapWhileResizing(e, target, transform)
      // A table takes the stretch into its columns and rows right away, so its text and lines keep their size while dragging.
      if (target instanceof TableObject || target instanceof ChartObject) target.bakeScale()
      // A double bracket's brackets stay at its edges, as deep as before.
      keepBracketArms(target)
      // A shape with text stays big enough for it while dragging.
      fitWhileResizing(target, transform)
      this.followConnectors()
      this.transforming = true
      this.emit()
    })
    this.canvas.on('object:modified', ({ target, action }) => {
      // A click on an arrow that never became a drag changes nothing and leaves no undo step.
      const gate = this.dragGate
      this.dragGate = undefined
      if (action === 'drag' && gate && gate.arrow === target && !gate.passed) return
      if (action === MOVE_END_ACTION && target instanceof Connector) this.stickEnds(target)
      if (target instanceof ChartObject) target.bakeScale()
      // A shape made narrower grows taller again if its text no longer fits.
      if (target && growToFit(target)) this.followConnectors()
      if (target instanceof TableObject) {
        target.bakeScale()
        target.finishDrag()
      }
      this.commit()
    })
    this.canvas.on('text:editing:exited', () => this.commit())
    // The text panels show the look of the characters under the text cursor.
    this.canvas.on('text:selection:changed', () => this.emit())
    // Fabric ends text editing as soon as a click lands elsewhere, before
    // 'mouse:down', so the text tool needs to know what was being typed first.
    this.canvas.on('mouse:down:before', ({ e }) => {
      const active = this.canvas.getActiveObject()
      this.activeBeforeClick = active
      this.editingBeforeClick = active instanceof IText && active.isEditing ? active : undefined
      this.selectArrowAtEnd(e)
    })
    this.canvas.on('mouse:down', (event) => this.onPointerDown(event))
    this.canvas.on('mouse:dblclick', ({ e, target, scenePoint }) => {
      const text = target && asText(target)
      if (this.tool === 'select' && text && !text.isEditing && text.editable && !isLocked(text)) return this.startTyping(text, e)
      if (this.tool === 'select' && target && textShapeOf(target) && !isLocked(target)) return this.typeInShape(target, e)
      if (this.tool === 'select' && target && isIcon(target) && !isLocked(target) && hitsSlot(target, scenePoint)) {
        this.canvas.setActiveObject(target)
        this.iconText.start(target, e)
        return this.emit()
      }
      if (this.tool === 'select' && target instanceof ChartObject) {
        const text = target.textAt(scenePoint)
        if (text) editChartText(this.canvas, target, text, (chart) => {
          target.setChart(chart)
          this.canvas.requestRenderAll()
          this.commit()
        })
        return
      }
      if (this.tool !== 'select' || !(target instanceof TableObject)) return
      const cell = target.cellAtPoint(scenePoint)
      if (cell) this.cells.start(target, cell)
      this.emit()
    })
    this.canvas.on('mouse:move', (event) => {
      this.lightChartHandle(event.viewportPoint, event.scenePoint)
      this.onPointerMove(event)
    })
    this.canvas.on('mouse:up', (event) => this.onPointerUp(event))
    // Every object gets its own id, so the layers panel can point at it.
    // Copies arrive with the original's id and get a new one.
    this.canvas.on('object:added', ({ target }) => this.prepareLayer(target))

    if (saved) void this.restore(saved, true)
  }

  /** Get told whenever something the screen shows has changed. */
  subscribe(listener: (state: CanvasState) => void): () => void {
    this.listeners.add(listener)
    listener(this.state())
    return () => this.listeners.delete(listener)
  }

  /** The figure as text, for saving and for undo. */
  serialize(): string {
    return JSON.stringify(this.canvas.toObject(OWN_PROPERTIES))
  }

  /** What the shape and arrow tools draw now. */
  get drawChoice(): DrawChoice {
    return this.choice
  }

  setTool(tool: Tool): void {
    this.tool = tool
    this.anchorHover = undefined
    this.canvas.defaultCursor = tool === 'select' ? 'default' : tool === 'text' ? 'text' : 'crosshair'
    // Arrows and lines start drawing even on top of an object (to stick to it),
    // so Fabric mustn't grab the object; the text tool handles text itself.
    // Shape tools let Fabric find the object, so pressing on it grabs it.
    this.canvas.skipTargetFind = tool === 'arrow' || tool === 'line' || tool === 'text'
    this.canvas.selection = tool === 'select'
    if (tool !== 'select') this.canvas.discardActiveObject()
    this.canvas.requestRenderAll()
    this.emit()
  }

  /**
   * Stops typing in a text box, as a click beside it does (Ctrl+Enter): the
   * text is let go and Select comes back on, so the next press on the text
   * grabs it to move it rather than typing in it again. Text typed in a
   * shape goes into it and the shape stays selected (its properties stay
   * open), unless `letGo` (a press beside it) lets go of the shape too.
   */
  finishTyping(letGo = false): void {
    const active = this.canvas.getActiveObject()
    const shape = active && isShapeTextBox(active) && !letGo ? (this.shapeText.shape ?? this.iconText.icon) : undefined
    if (active instanceof IText && active.isEditing) active.exitEditing()
    if (shape && this.canvas.getObjects().includes(shape)) this.canvas.setActiveObject(shape)
    else this.canvas.discardActiveObject()
    this.setTool('select')
  }

  /** A press in the dark area around the page: stops typing, as a press beside the text on the page does. */
  pressOutsidePage(): void {
    if (this.cells.editing) this.cells.finish()
    const active = this.canvas.getActiveObject()
    if (active instanceof IText && active.isEditing) this.finishTyping(true)
  }

  /**
   * Pick what the shape and arrow tools draw. With `restyleSelection`, a
   * changed arrow look also goes onto the selected arrows. Says whether any
   * selected arrow was restyled.
   */
  setDrawChoice(change: { shape?: ShapeKind; look?: Partial<ArrowLook>; style?: Partial<ShapeStyle> }, restyleSelection = false): boolean {
    this.choice = { shape: change.shape ?? this.choice.shape, look: { ...this.choice.look, ...change.look }, style: { ...this.choice.style, ...change.style } }
    if (change.style || change.shape) this.emit()
    const arrows = this.canvas.getActiveObjects().filter((object): object is Connector => object instanceof Connector && !object.group)
    if (!restyleSelection || !change.look || arrows.length === 0) return false
    for (const arrow of arrows) arrow.setLook(change.look)
    this.canvas.requestRenderAll()
    this.commit()
    return true
  }

  /** The fill and line colours on the page, most used first, for the "In this figure" swatches. */
  usedColours(): string[] {
    const counts = new Map<string, number>()
    for (const object of allObjects(this.canvas.getObjects())) {
      for (const paint of [object.fill, object.stroke]) {
        const hex = typeof paint === 'string' ? toHex(paint) : undefined
        if (hex) counts.set(hex, (counts.get(hex) ?? 0) + 1)
      }
    }
    return [...counts].sort((a, b) => b[1] - a[1]).map(([hex]) => hex)
  }

  /** Switch the selected bracket between its square and curly style, staying single or double (see `setShapeKind`). */
  setBracketStyle(kind: ShapeKind): void {
    if (BRACKETS.has(kind)) this.setShapeKind(kind)
  }

  /**
   * Make the selected shape another shape, e.g. a rectangle a rounded one. It
   * keeps its middle, size, colours, text, layer and the arrows stuck to it.
   * Closed shapes switch between closed shapes and brackets between their two
   * styles. The next shape drawn is the new one too.
   */
  setShapeKind(kind: ShapeKind): void {
    this.setDrawChoice({ shape: kind })
    const active = this.canvas.getActiveObject()
    const now = active && !active.group ? kindOf(active) : undefined
    if (!active || !now || now === kind || OPEN_SHAPES.has(kind) !== OPEN_SHAPES.has(now) || BRACKETS.has(kind) !== BRACKETS.has(now) || DOUBLE_BRACKETS.has(kind) !== DOUBLE_BRACKETS.has(now)) return
    // Rectangle to Rounded rounds the corners, and back makes them sharp; other shapes keep how round they are.
    const radius = kind === 'rectangle' && now === 'rounded' ? 0 : kind === 'rounded' && !cornerRadiusOf(active) ? undefined : cornerRadiusOf(active)
    this.replaceShape(active, kind, radius)
  }

  /** Round the selected shape's corners (shapes with straight sides only) and those of the next shapes drawn. */
  setCornerRadius(radius: number): void {
    radius = Math.max(0, radius)
    this.setDrawChoice({ style: { cornerRadius: radius } })
    const active = this.canvas.getActiveObject()
    const kind = active && !active.group ? kindOf(active) : undefined
    if (!active || !kind || !CORNER_SHAPES.has(kind) || cornerRadiusOf(active) === radius) return
    // A rectangle from the rectangle tool has no outline of its own to round: it becomes one that has.
    if (!(active instanceof Path)) return this.replaceShape(active, kind, radius)
    Object.assign(active, { cornerRadius: radius })
    redrawOutline(active, true)
    this.canvas.requestRenderAll()
    // Dragging the phone's corner slider makes one undo step, not one per pixel.
    this.commit('cornerRadius')
  }

  /** Put a new outline of `kind` in place of a shape (see `setShapeKind`). */
  private replaceShape(active: FabricObject, kind: ShapeKind, radius: number | undefined): void {
    let width = active.width * active.scaleX
    let height = active.height * active.scaleY
    if (kind === 'circle') width = height = Math.max(width, height)
    const open = OPEN_SHAPES.has(kind)
    const corners = CORNER_SHAPES.has(kind) ? (radius ?? defaultCornerRadius(kind, width, height)) : undefined
    const drawn = open ? { d: shapePath(kind, width, height), scaleX: 1, scaleY: 1 } : outline(kind, width, height, corners)
    const { fill, stroke, strokeWidth, strokeDashArray, strokeUniform, opacity, angle, flipX, flipY } = active
    const next = new Path(drawn.d, {
      fill: open ? null : fill,
      stroke,
      strokeWidth,
      strokeDashArray,
      strokeUniform,
      opacity,
      angle,
      flipX,
      flipY,
      scaleX: drawn.scaleX,
      scaleY: drawn.scaleY,
      strokeLineCap: 'round',
      strokeLineJoin: 'round',
    })
    // The saved settings (id, layer, name, lock, text) go along; the kind and corners are the new ones.
    for (const prop of OWN_PROPERTIES) {
      const value = (active as unknown as Record<string, unknown>)[prop]
      if (value !== undefined) Object.assign(next, { [prop]: value })
    }
    Object.assign(next, { shapeKind: kind, cornerRadius: corners })
    applyShapeRules(next)
    next.setPositionByOrigin(active.getCenterPoint(), 'center', 'center')
    next.setCoords()
    const index = this.canvas.getObjects().indexOf(active)
    this.canvas.remove(active)
    this.canvas.insertAt(index, next)
    // A shape with less room inside grows until its text fits again.
    growToFit(next)
    this.canvas.setActiveObject(next)
    this.followConnectors()
    this.canvas.requestRenderAll()
    this.commit()
  }

  /** Pick what the chart tool places. A changed error-bar choice also goes onto the selected chart. */
  setChartChoice(change: Partial<{ kind: ChartKind; errorBars: ErrorBars }>): void {
    this.chartChoice = { ...this.chartChoice, ...change }
    const errorBars = change.errorBars
    if (errorBars && this.activeChart()) this.updateChart((chart) => ({ ...chart, errorBars }))
  }

  /**
   * Change the selected chart's data or settings; typing in the data editor
   * lands here. With `save` off (while typing in a text field), the chart
   * changes on the page right away but becomes one undo step only once the
   * field is left (`saveChart`). Quick changes with the same `mergeKey` (a
   * slider being dragged) merge into one undo step.
   */
  updateChart(change: (chart: ChartData) => ChartData, save = true, mergeKey?: string): void {
    const chart = this.activeChart()
    if (!chart) return
    chart.setChart(change(chart.chart))
    this.canvas.requestRenderAll()
    if (save) this.commit(mergeKey)
    else this.emit()
  }

  /** Save the chart changes made while typing as one undo step. */
  saveChart(): void {
    this.commit()
  }

  /** Pick what the table tool places. With `restyleSelection`, a changed layout or look also goes onto the selected table. */
  setTableChoice(change: Partial<TableChoice>, restyleSelection = false): void {
    this.tableChoice = { ...this.tableChoice, ...change }
    if (!restyleSelection || this.activeTable() === undefined) return
    this.setTableStyle({ ...(change.layout && { layout: change.layout }), ...(change.look && { look: change.look }) })
  }

  /**
   * How much bigger than on a desktop a Place button makes new things. Phones
   * set 1.5: at a phone's zoom, desktop sizes looked too small (owner's call,
   * 2026-11-17). Charts and tables already size themselves to the page.
   */
  placeScale = 1

  /**
   * Places what the drawing tool on makes, at its default size (times
   * `placeScale`) in the middle of the page; then Select comes back on with
   * the new object selected. Phones use it: the Place button under a tool's
   * panel places the object straight away. Text starts with its words
   * selected, ready to type over. Says whether it placed one.
   */
  placeWithTool(tool: Tool = this.tool): boolean {
    if (tool === 'select') return false
    const point = this.pageCentre()
    if (tool === 'text') return this.placeText(point)
    const object =
      tool === 'chart' ? this.placeChart(point, point, true) : tool === 'table' ? this.placeTable(point, point, true) : this.placeShape(shapeAt(tool, point.x, point.y, this.choice, this.placeScale))
    this.setTool('select')
    this.canvas.setActiveObject(object)
    this.canvas.requestRenderAll()
    this.emit()
    return true
  }

  /** A new text box centred on `point` in the look set for new text, as one undo step, with its words selected for typing. */
  private placeText(point: XY): boolean {
    const text = asText(toFabric(shapeAt('text', point.x, point.y, undefined, this.placeScale)))
    if (!text) return false
    this.setTool('select')
    this.styledText(text)
    text.initDimensions()
    text.set({ left: point.x - text.width / 2, top: point.y - text.height / 2 })
    text.setCoords()
    this.add(text)
    text.enterEditing()
    text.selectAll()
    this.emit()
    return true
  }

  /** Place a table from the Table panel's picks in the middle of the page, selected. */
  addTable(): void {
    this.setTool('select')
    this.placeTable(this.pageCentre(), this.pageCentre(), true)
  }

  private pageCentre(): XY {
    return { x: this.page.width / 2, y: this.page.height / 2 }
  }

  /** Add or remove rows and columns, or merge cells, in the selected table. */
  tableCommand(command: TableCommand): void {
    const table = this.activeTable()
    if (!table) return
    this.cells.finish()
    const result = runTableCommand(table.table, table.cellRange, command)
    table.setTable(result.table)
    table.cellRange = result.range
    this.canvas.requestRenderAll()
    this.commit()
  }

  /** Restyle the selected table; alignment and boldness go onto its picked cells. */
  setTableStyle(patch: Partial<TableStyle>): void {
    const table = this.activeTable()
    if (!table) return
    table.setTable(styleTable(table.table, table.cellRange, patch))
    this.canvas.requestRenderAll()
    this.commit(Object.keys(patch).join(','))
  }

  addShape(spec: ShapeSpec, commit = true): FabricObject {
    const object = toFabric(spec)
    this.add(object, commit)
    return object
  }

  /**
   * Add an icon from SVG text, centred at a point on the page. Every icon gets
   * the same area (that of a `size` square), so tall and wide icons look
   * equally big: a side-view mouse comes out about 113 by 48.
   */
  async addSvg(svg: string, name: string, centre = { x: this.page.width / 2, y: this.page.height / 2 }, size = 74, iconId?: string): Promise<void> {
    const { objects, options } = await loadSVGFromString(svg)
    const group = util.groupSVGElements(
      objects.filter((object): object is FabricObject => object !== null),
      options,
    )
    noteIconOrigin(group, iconId)
    const area = group.width * group.height
    group.scale(area > 0 ? size / Math.sqrt(area) : size / Math.max(group.width, group.height, 1))
    group.set({ left: centre.x - group.getScaledWidth() / 2, top: centre.y - group.getScaledHeight() / 2 })
    Object.assign(group, { name, iconId })
    startSlotText(group, iconId)
    this.add(group)
  }

  /**
   * Give the selected icons their own colours back, read again from the icon
   * library (recolouring tints them, which can't be undone by picking colours).
   * One undo step. `svgOf` finds an icon's SVG by its library id.
   */
  async resetIconColours(svgOf: (iconId: string) => string | undefined | Promise<string | undefined> = loadIconSvg): Promise<void> {
    const icons = this.selected().targets.filter((target) => isIcon(target) && typeof (target as FabricObject & { iconId?: unknown }).iconId === 'string')
    let changed = false
    for (const icon of icons) {
      const svg = await svgOf((icon as FabricObject & { iconId: string }).iconId)
      if (!svg) continue
      const { objects, options } = await loadSVGFromString(svg)
      const original = iconParts(util.groupSVGElements(objects.filter((object): object is FabricObject => object !== null), options))
      const parts = iconParts(icon)
      // The same SVG gives the same parts in the same order; anything else is left alone.
      if (original.length !== parts.length) continue
      // The library's colours become the icon's RGB colours; its colour mode stays on.
      const mode = colourModeOf(icon)
      showBaseColours(icon)
      parts.forEach((part, i) => part.set({ fill: original[i]?.fill, stroke: original[i]?.stroke }))
      setColourMode(icon, mode)
      icon.set({ dirty: true })
      changed = true
    }
    if (!changed) return
    this.canvas.requestRenderAll()
    this.commit()
  }

  /**
   * Swap the selected icon for another library icon drawn on the same grid
   * (e.g. a molecule with or without element letters). It keeps its middle,
   * scale, rotation, flips, opacity, layer and lock; a colour picked for it
   * goes on the new one too, and so does its colour mode. One undo step.
   */
  async swapIcon(iconId: string, library: IconLookup = libraryEntry): Promise<void> {
    const old = this.selected().targets[0]
    const next = await library(iconId)
    const oldId = (old as (FabricObject & { iconId?: unknown }) | undefined)?.iconId
    if (!(old instanceof Group) || !isIcon(old) || !next || typeof oldId !== 'string' || oldId === iconId) return
    const { objects, options } = await loadSVGFromString(next.svg)
    const group = util.groupSVGElements(objects.filter((object): object is FabricObject => object !== null), options)
    noteIconOrigin(group, iconId)
    // The same scale keeps the drawing the same size, even where the new version reaches a little further out.
    group.set({ scaleX: old.scaleX, scaleY: old.scaleY, angle: old.angle, flipX: old.flipX, flipY: old.flipY, skewX: old.skewX, skewY: old.skewY, opacity: old.opacity })
    for (const prop of OWN_PROPERTIES) {
      const value = (old as unknown as Record<string, unknown>)[prop]
      if (value !== undefined && prop !== 'colourMode' && prop !== 'baseColours' && prop !== 'iconOrigin') Object.assign(group, { [prop]: value })
    }
    if ((group as FabricObject & { slotText?: unknown }).slotText === undefined) startSlotText(group, iconId)
    // A renamed icon keeps its name; otherwise it takes the new version's name.
    const oldEntry = await library(oldId)
    const oldName = oldEntry?.name
    Object.assign(group, { iconId, name: (old as FabricObject & { name?: string }).name === oldName ? next.name : (old as FabricObject & { name?: string }).name })
    // A colour the user picked: the old icon's main colour differs from its library original's.
    const mode = colourModeOf(old)
    const picked = iconMainColour(baseIconColours(old), oldId)
    const oldSvg = oldEntry?.svg
    if (oldSvg && picked) {
      const { objects: originals } = await loadSVGFromString(oldSvg)
      const original = iconMainColour(iconColours(util.groupSVGElements(originals.filter((object): object is FabricObject => object !== null))), oldId)
      if (original && toHex(original) !== toHex(picked)) recolourIcon(group, picked)
    }
    setColourMode(group, mode)
    group.setPositionByOrigin(old.getCenterPoint(), 'center', 'center')
    group.setCoords()
    const index = this.canvas.getObjects().indexOf(old)
    this.canvas.remove(old)
    this.canvas.insertAt(index, group)
    this.canvas.setActiveObject(group)
    this.canvas.requestRenderAll()
    this.commit()
  }

  /**
   * Set the text of the selected icon's text slot and whether it shows. With
   * `save` off (typing in the field), the text changes on the page right away
   * but becomes one undo step only when typing ends (`saveIconText`).
   */
  async setIconText(text: string, shown: boolean, save = true): Promise<void> {
    const targets = this.selected().targets
    const icon = targets.length === 1 ? targets[0] : undefined
    if (!icon || !slotInfo(icon)) return
    // An icon placed before it had a slot doesn't know its origin yet: read it from the library (only then does this wait).
    if (needsIconOrigin(icon)) {
      const svg = await loadIconSvg(iconIdOf(icon) ?? '')
      if (svg) setIconOrigin(icon, await iconOriginFromSvg(svg))
    }
    Object.assign(icon, { slotText: text, slotShown: shown })
    refreshSlotText(icon)
    this.canvas.requestRenderAll()
    if (save) this.commit()
    else this.emit()
    // The text is measured again once the font is there (usually it already is).
    await loadFontFace(DEFAULT_FONT, 400, false)
    if (this.abort.signal.aborted) return
    cache.clearFontCache()
    refreshSlotText(icon)
    this.canvas.requestRenderAll()
  }

  /** Save the icon text typed so far as one undo step. */
  saveIconText(): void {
    this.commit()
  }

  /** Draw the selected icons in colour or greyscale. One undo step. */
  setIconColourMode(mode: ColourMode): void {
    const icons = this.selected().targets.filter((target) => isIcon(target) && colourModeOf(target) !== mode)
    if (icons.length === 0) return
    for (const icon of icons) setColourMode(icon, mode)
    this.canvas.requestRenderAll()
    this.commit()
  }

  /** Change the selected objects' look or position. */
  change(patch: StyleChange): void {
    const { active, targets } = this.selected()
    if (!active) return
    const { left, top, ...style } = patch
    if (left !== undefined || top !== undefined) {
      active.set({ ...(left !== undefined && { left }), ...(top !== undefined && { top }) })
      active.setCoords()
    }
    const { opacity, ...paint } = style
    if (opacity !== undefined) for (const target of targets) target.set({ opacity })
    const tables = targets.filter((target) => target instanceof TableObject)
    for (const table of tables) paintTable(table, paint)
    if (Object.keys(paint).length > 0) {
      for (const part of paintedParts(targets.filter((target) => !(target instanceof TableObject)))) part.set(paintFor(part, paint))
      // A group keeps a picture of its parts; a thicker line can also make it bigger.
      for (const group of targets.filter((target) => target instanceof FigureGroup)) {
        if (paint.strokeWidth !== undefined) group.triggerLayout()
        group.set('dirty', true)
      }
    }
    this.shapeText.resized()
    this.canvas.requestRenderAll()
    this.commit(Object.keys(patch).join(','))
  }

  /** The selection, with the shape being typed in standing in for the text box laid over it. */
  private selected(): { active: FabricObject | undefined; targets: FabricObject[] } {
    const active = this.canvas.getActiveObject()
    const typedIn = active && isShapeTextBox(active) ? (this.shapeText.shape ?? this.iconText.icon) : undefined
    return typedIn ? { active: typedIn, targets: [typedIn] } : { active, targets: this.canvas.getActiveObjects() }
  }

  /** Give the selection a typed width or height, optionally keeping its proportions. */
  resize(change: SizeChange, keepProportions: boolean): void {
    const { active } = this.selected()
    if (!active) return
    active.set(resizedScale(active, change, keepProportions))
    if (active instanceof ChartObject) active.bakeScale()
    active.setCoords()
    // A shape with text stays big enough for it; a typed height makes it wider instead of taller.
    if (growToFit(active, change.width === undefined && !keepProportions ? 'height' : undefined)) this.followConnectors()
    this.shapeText.resized()
    this.canvas.requestRenderAll()
    this.commit()
  }

  /** The selected objects, for `startPinch`. */
  selectedObjects(): FabricObject[] {
    return this.canvas.getActiveObjects()
  }

  /**
   * Phones: two fingers start resizing the selection. `objects` is what was
   * selected before the first finger landed, which may have let go of it by
   * touching beside it; that selection comes back. False when nothing was
   * selected (the fingers then zoom the page instead). A locked selection
   * stays as it is.
   */
  startPinch(objects: readonly FabricObject[]): boolean {
    const onCanvas = allObjects(this.canvas.getObjects())
    const kept = objects.filter((object) => onCanvas.includes(object))
    if (kept.length === 0 || this.isTyping()) return false
    const current = this.canvas.getActiveObjects()
    if (current.length !== kept.length || kept.some((object) => !current.includes(object))) {
      this.canvas.discardActiveObject()
      this.select(kept)
    }
    const active = this.canvas.getActiveObject()
    this.pinch = active && !active.lockScalingX && !active.lockScalingY ? { object: active, scaleX: active.scaleX, scaleY: active.scaleY, centre: active.getCenterPoint() } : undefined
    if (this.pinch) for (const part of pinchedParts(this.pinch.object)) keepCachedPicture(part, true)
    // The quick-actions bar steps aside while the fingers are down.
    this.transforming = true
    this.canvas.requestRenderAll()
    this.emit()
    return true
  }

  /** Resize the pinched selection to `factor` times its size when the pinch started, around its middle, keeping its proportions. */
  pinchTo(factor: number): void {
    const pinch = this.pinch
    if (!pinch) return
    const { object } = pinch
    // Never smaller than a few points across.
    const smallest = Math.min(object.width * pinch.scaleX, object.height * pinch.scaleY)
    const scale = Math.max(factor, smallest > 0 ? MIN_PINCH_SIZE / smallest : factor)
    object.set({ scaleX: pinch.scaleX * scale, scaleY: pinch.scaleY * scale })
    object.setPositionByOrigin(pinch.centre, 'center', 'center')
    object.setCoords()
    keepBracketArms(object)
    this.followConnectors()
    // Drawn on the next frame; the panels catch up when the fingers lift, so each step stays quick.
    this.canvas.requestRenderAll()
  }

  /** Phones: two fingers are zooming the page, so the quick-actions bar steps aside. */
  setZooming(zooming: boolean): void {
    if (this.transforming === zooming) return
    this.transforming = zooming
    this.emit()
  }

  /** Lift the fingers: the pinched size is saved as one undo step. */
  endPinch(): void {
    const pinch = this.pinch
    this.pinch = undefined
    this.transforming = false
    if (!pinch) return this.emit()
    const { object } = pinch
    for (const part of pinchedParts(object)) keepCachedPicture(part, false)
    this.canvas.requestRenderAll()
    if (object.scaleX === pinch.scaleX && object.scaleY === pinch.scaleY) return this.emit()
    if (object instanceof ChartObject || object instanceof TableObject) object.bakeScale()
    object.setCoords()
    if (growToFit(object)) this.followConnectors()
    this.shapeText.resized()
    this.canvas.requestRenderAll()
    this.commit()
  }

  /** Move the selection in front of or behind everything else, or one layer up or down. */
  arrange(where: 'front' | 'back' | 'forward' | 'backward'): void {
    const targets = this.canvas.getActiveObjects()
    if (targets.length === 0) return
    // Keep the selected objects in their order relative to each other.
    const ordered = this.canvas.getObjects().filter((object) => targets.includes(object))
    if (where === 'front') for (const object of ordered) this.canvas.bringObjectToFront(object)
    else if (where === 'back') for (const object of ordered.reverse()) this.canvas.sendObjectToBack(object)
    // One step: the top one moves first, so selected objects never swap with each other.
    else if (where === 'forward') {
      if (ordered.at(-1) === this.canvas.getObjects().at(-1)) return
      for (const object of ordered.reverse()) this.canvas.bringObjectForward(object)
    } else {
      if (ordered[0] === this.canvas.getObjects()[0]) return
      for (const object of ordered) this.canvas.sendObjectBackwards(object)
    }
    this.canvas.requestRenderAll()
    this.commit()
  }

  /** Lock the selection in place (it can still be selected, recoloured and unlocked), or unlock it. */
  toggleLock(): void {
    const targets = this.canvas.getActiveObjects()
    if (targets.length === 0 || this.isTyping()) return
    const locked = !targets.every(isLocked)
    for (const object of targets) setLocked(object, locked)
    // A selection of several takes its handles from its parts, so pick them again.
    this.canvas.discardActiveObject()
    this.select(targets)
    this.canvas.requestRenderAll()
    this.commit()
  }

  selectAll(): void {
    if (this.isTyping() || this.tool !== 'select') return
    this.canvas.discardActiveObject()
    this.select(this.canvas.getObjects().filter((object) => object.visible))
    this.canvas.requestRenderAll()
    this.emit()
  }

  /** Hide the selection's frame and handles for a while (the selection stays), e.g. while a phone slider changes the object, so the change is easy to see. */
  hideControls(hidden: boolean): void {
    // Fabric keeps this switch protected and offers no public way to skip drawing the controls for a while.
    const canvas = this.canvas as unknown as { skipControlsDrawing: boolean }
    if (canvas.skipControlsDrawing === hidden) return
    canvas.skipControlsDrawing = hidden
    this.canvas.requestRenderAll()
  }

  /** Select nothing (the Shapes panel's back button). */
  clearSelection(): void {
    if (this.isTyping()) return
    this.canvas.discardActiveObject()
    this.canvas.requestRenderAll()
    this.emit()
  }

  /**
   * Right-click at a point on the screen (relative to the canvas element): the
   * object there becomes the selection, unless it's already part of it; empty
   * page clears the selection.
   */
  selectForMenu(screen: XY): void {
    if (this.isTyping()) return
    const target = this.canvas.objectAt({ x: screen.x / this.zoom, y: screen.y / this.zoom })
    if (target && this.canvas.getActiveObjects().includes(target)) return
    this.canvas.discardActiveObject()
    if (target) this.canvas.setActiveObject(target)
    this.canvas.requestRenderAll()
    this.emit()
  }

  /** Whether Paste has something to paste. */
  get canPaste(): boolean {
    return clipboard !== undefined
  }

  /** Copy the selection to the app's own clipboard. */
  async copy(): Promise<void> {
    const active = this.canvas.getActiveObject()
    if (!active || this.isTyping()) return
    clipboard = await active.clone(OWN_PROPERTIES)
  }

  async cut(): Promise<void> {
    if (this.isTyping()) return
    await this.copy()
    this.deleteSelection()
  }

  /** Paste what was copied, a little further along each time so copies don't hide each other. */
  async paste(): Promise<void> {
    const source = clipboard
    if (!source) return
    await this.placeCopyOf(source)
    this.emit()
    source.set({ left: source.left + PASTE_OFFSET_PX, top: source.top + PASTE_OFFSET_PX })
  }

  /** Copy and paste in one go, without touching the clipboard. */
  async duplicate(): Promise<void> {
    const active = this.canvas.getActiveObject()
    if (!active || this.isTyping()) return
    await this.placeCopyOf(active)
  }

  /** Put the selected objects into one group, where the topmost of them was. */
  group(): void {
    const targets = this.selectedInStackOrder()
    const topmost = targets.at(-1)
    if (targets.length < 2 || !topmost || this.isTyping()) return
    const index = this.canvas.getObjects().indexOf(topmost) - targets.length + 1
    this.canvas.discardActiveObject()
    this.canvas.remove(...targets)
    const group = new FigureGroup(targets)
    this.canvas.insertAt(index, group)
    this.canvas.setActiveObject(group)
    this.canvas.requestRenderAll()
    this.commit()
  }

  /** Break the selected groups back into their parts, which stay selected. */
  ungroup(): void {
    const selected = this.canvas.getActiveObjects()
    const groups = selected.filter((object) => object instanceof FigureGroup)
    if (groups.length === 0 || this.isTyping()) return
    this.canvas.discardActiveObject()
    const parts = groups.flatMap((group) => {
      const index = this.canvas.getObjects().indexOf(group)
      const objects = group.removeAll()
      this.canvas.remove(group)
      this.canvas.insertAt(index, ...objects)
      return objects
    })
    this.select([...selected.filter((object) => !(object instanceof FigureGroup)), ...parts])
    this.canvas.requestRenderAll()
    this.commit()
  }

  /** Line the selection up: with each other, or with the page when one object is selected. */
  align(edge: AlignEdge): void {
    this.moveEach((boxes) => align(boxes, edge, this.pageBox))
  }

  /** Spread three or more objects out with equal gaps. */
  distribute(axis: Axis): void {
    this.moveEach((boxes) => distribute(boxes, axis))
  }

  /** Snap to a grid while dragging (spacing in page pixels), or turn the grid off. */
  setGrid(spacing: number | undefined): void {
    this.canvas.grid = spacing
    this.canvas.requestRenderAll()
  }

  deleteSelection(): void {
    const targets = this.canvas.getActiveObjects()
    if (targets.length === 0) return
    // Don't delete the text box while someone is typing in it.
    if (targets.some((target) => target instanceof IText && target.isEditing)) return
    this.canvas.discardActiveObject()
    this.canvas.remove(...targets)
    this.commit()
  }

  /** Select a layer from the layers panel; `add` keeps the rest of the selection. Objects inside a group select their group. */
  selectLayer(id: string, add = false): void {
    const found = this.findLayer(id)
    if (!found || this.isTyping()) return
    const object = found.topLevel
    const current = add ? this.selectedInStackOrder() : []
    const next = current.includes(object) ? current.filter((other) => other !== object) : [...current, object]
    this.canvas.discardActiveObject()
    this.select(this.canvas.getObjects().filter((other) => next.includes(other)))
    this.canvas.requestRenderAll()
    this.emit()
  }

  renameLayer(id: string, name: string): void {
    const found = this.findLayer(id)
    if (!found) return
    found.object.set({ name } as Partial<FabricObject>)
    this.commit()
  }

  /** Put a layer at this place among its siblings, 0 being the top. */
  moveLayer(id: string, index: number): void {
    const found = this.findLayer(id)
    if (!found) return
    const { object, parent } = found
    const count = parent ? parent.size() : this.canvas.size()
    const target = count - 1 - index
    if (parent) {
      parent.moveObjectTo(object, target)
      parent.set({ dirty: true })
    } else this.canvas.moveObjectTo(object, target)
    this.canvas.requestRenderAll()
    this.commit()
  }

  toggleLayerHidden(id: string): void {
    const found = this.findLayer(id)
    if (!found) return
    const { object, parent } = found
    object.set({ visible: !object.visible })
    parent?.set({ dirty: true })
    // A hidden object can't stay selected.
    if (!object.visible && this.canvas.getActiveObjects().includes(object)) this.canvas.discardActiveObject()
    this.canvas.requestRenderAll()
    this.commit()
  }

  toggleLayerLocked(id: string): void {
    const found = this.findLayer(id)
    if (!found) return
    setLocked(found.object, !isLocked(found.object))
    this.canvas.requestRenderAll()
    this.commit()
  }

  /**
   * Change the look of the selected text (or its selected characters while
   * typing). With no text selected, it sets the look of new text instead.
   * The font is loaded first, so the text is measured with it.
   */
  async changeText(change: Partial<TextStyle>): Promise<void> {
    this.endPreview()
    const text = this.selectedText()
    // A selected shape not being typed in: its whole text changes, or the look its text will get.
    const shape = text ? undefined : this.selectedTextShape()
    const held = shape && textOfLabel(labelOf(shape) ?? this.shapeTextLook())
    const look = { ...(text ? readTextStyle(text) : held ? readTextStyle(held) : this.newTextStyle()), ...change }
    const font = fontByName(look.font) ?? DEFAULT_FONT
    if (change.font !== undefined || change.weight !== undefined || change.bold !== undefined || change.italic !== undefined) await loadFontFace(font, drawnWeight(look), look.italic)
    if (shape) {
      restyleLabel(shape, (box) => applyTextStyle(box, change), this.shapeTextLook())
      // The next shape takes the look set last, like its colours.
      this.choice = { ...this.choice, style: { ...this.choice.style, text: look } }
      this.followConnectors()
      this.canvas.requestRenderAll()
      this.commit(`text:${Object.keys(change).join(',')}`)
      return
    }
    if (!text) {
      this.newText = { ...this.newText, ...change }
      this.emit()
      return
    }
    if (isShapeTextBox(text) && change.size !== undefined) this.shapeText.keepDrawnSize()
    applyTextStyle(text, change)
    if (isShapeTextBox(text)) this.shapeText.refit()
    this.canvas.requestRenderAll()
    this.commit(`text:${Object.keys(change).join(',')}`)
  }

  /**
   * Show a look on the selected text without keeping it, e.g. while hovering
   * fonts in the font list. `null` puts the text back as it was.
   */
  async previewText(change: Partial<TextStyle> | null): Promise<void> {
    if (!change) return this.endPreview()
    const text = this.selectedText()
    if (!text) return
    if (this.preview?.text !== text) {
      this.endPreview()
      this.preview = { text, before: snapshotText(text) }
    }
    this.preview.change = change
    const look = { ...readTextStyle(text), ...change }
    await loadFontFace(fontByName(look.font) ?? DEFAULT_FONT, drawnWeight(look), look.italic)
    // Another preview (or the end of previewing) came while the font loaded.
    if (this.preview?.change !== change) return
    restoreText(text, this.preview.before)
    applyTextStyle(text, change)
    this.canvas.requestRenderAll()
  }

  private endPreview(): void {
    const preview = this.preview
    if (!preview) return
    this.preview = undefined
    restoreText(preview.text, preview.before)
    this.canvas.requestRenderAll()
  }

  /** Put a symbol where the text cursor is; with no text selected, in a new text box in the middle of the page. */
  insertSymbol(symbol: string): void {
    let text = this.selectedText()
    if (!text) {
      text = new IText('', toFabricText({ left: this.page.width / 2, top: this.page.height / 2 }))
      this.styledText(text)
      this.add(text, false)
      this.canvas.setActiveObject(text)
      text.enterEditing()
    }
    insertSymbol(text, symbol)
    this.canvas.requestRenderAll()
    this.commit()
  }

  /**
   * Shift+Arrow on a selected (not yet typed in) text starts typing in it and
   * selects from its end (Left) or start (Right), so a word or letter can be
   * styled without the mouse. Returns whether it did.
   */
  selectInText(event: KeyboardEvent): boolean {
    const text = this.selectedText()
    if (!text || text.isEditing || !event.shiftKey || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return false
    text.enterEditing()
    const at = event.key === 'ArrowLeft' ? text.text.length : 0
    text.selectionStart = at
    text.selectionEnd = at
    if (event.key === 'ArrowLeft') text.moveCursorLeft(event)
    else text.moveCursorRight(event)
    this.canvas.requestRenderAll()
    this.emit()
    return true
  }

  /**
   * The text look for shapes from the Shapes panel (Text tab): the selected
   * shape's text, typed in or not, and the look the next shape's text gets.
   * With no shape selected, only the next shape's look changes.
   */
  async changeShapeText(change: Partial<TextStyle>): Promise<void> {
    if (this.selectedText() || this.selectedTextShape()) return this.changeText(change)
    const look = { ...this.nextShapeText(), ...change }
    if (change.font !== undefined || change.weight !== undefined || change.bold !== undefined || change.italic !== undefined) await loadFontFace(fontByName(look.font) ?? DEFAULT_FONT, drawnWeight(look), look.italic)
    this.choice = { ...this.choice, style: { ...this.choice.style, text: look } }
    this.emit()
  }

  /** Start typing in the one selected shape that takes text (the Text tab was opened), with the text cursor at the end of its text. */
  typeInSelectedShape(): void {
    const shape = this.selectedTextShape()
    if (!shape || isLocked(shape) || this.shapeText.shape === shape) return
    this.setTool('select')
    this.canvas.setActiveObject(shape)
    const box = this.shapeText.start(shape, this.shapeTextLook())
    box.selectionStart = box.selectionEnd = box.text.length
    box._updateTextarea()
    this.emit()
  }

  /** Start typing in the selected text box (phones: its Edit text button), with the text cursor at the end. */
  editSelectedText(): void {
    const active = this.canvas.getActiveObject()
    const text = active && asText(active)
    if (!text || isShapeTextBox(text) || text.isEditing || !text.editable || isLocked(text)) return
    this.setTool('select')
    text.enterEditing()
    text.selectionStart = text.selectionEnd = text.text.length
    text._updateTextarea()
    this.canvas.requestRenderAll()
    this.emit()
  }

  /** Start typing in a closed shape, in the look its text keeps, else the look set for shapes. */
  private typeInShape(shape: FabricObject, e?: TPointerEventInfo['e']): void {
    this.shapeText.start(shape, this.shapeTextLook(), e)
    this.emit()
  }

  /** The look a shape's text starts with: set in the Shapes panel, else the look of new text, centred. */
  private shapeTextLook(): ShapeLabel {
    const chosen = this.choice.style.text
    if (!chosen) return startingLabel(this.styledText(new IText('', toFabricText({}))))
    const text = new IText('', toFabricText({}))
    applyTextStyle(text, chosen)
    return labelFromText(text)
  }

  private nextShapeText(): TextStyle {
    return this.choice.style.text ?? readTextStyle(textOfLabel(this.shapeTextLook()))
  }

  /** A shape from the Shapes panel, with the text look set there (kept even before text is typed). */
  private placeShape(spec: ShapeSpec, commit = true): FabricObject {
    const object = toFabric(spec)
    if (this.choice.style.text && textShapeOf(object)) Object.assign(object, { label: lookFor(object, this.shapeTextLook()) })
    this.add(object, commit)
    return object
  }

  /** What happens when the text in the selected shapes gets too long: they grow, or their text shrinks. */
  setTextFit(fit: TextFit): void {
    const shapes = this.selected().targets.filter((object) => textShapeOf(object))
    if (shapes.length === 0) return
    for (const shape of shapes) {
      if (shape === this.shapeText.shape) {
        this.shapeText.setFit(fit)
        continue
      }
      changeTextFit(shape, fit)
      growToFit(shape)
    }
    this.followConnectors()
    this.canvas.requestRenderAll()
    this.commit()
  }

  /** Start typing in a double-clicked text; Fabric then selects the word that was clicked. */
  private startTyping(text: IText, e: TPointerEventInfo['e']): void {
    this.canvas.setActiveObject(text)
    text.enterEditing(e)
    this.canvas.requestRenderAll()
    this.emit()
  }

  /** The look of the selected text, if a text box is selected. */
  textStyle(): TextStyle | undefined {
    const text = this.selectedText()
    return text && this.drawnTextStyle(text)
  }

  /** A text's look, with the size text in a shape is drawn at ("Shrink text" draws it smaller). */
  private drawnTextStyle(text: IText): TextStyle {
    const style = readTextStyle(text)
    return isShapeTextBox(text) ? { ...style, size: Math.round(style.size * this.shapeText.drawnScale * 100) / 100 } : style
  }

  /** The text box that's selected (alone), if any. */
  private selectedText(): IText | undefined {
    const objects = this.canvas.getActiveObjects()
    const [only] = objects
    return only && objects.length === 1 ? asText(only) : undefined
  }

  /** The one selected shape that takes text, when it isn't being typed in. */
  private selectedTextShape(): FabricObject | undefined {
    const objects = this.canvas.getActiveObjects()
    const [only] = objects
    return only && objects.length === 1 && textShapeOf(only) ? only : undefined
  }

  /** The look kept by a shape that takes text but holds none yet. */
  private emptyLabelStyle(object: FabricObject): TextStyle | undefined {
    return textShapeOf(object) ? readTextStyle(textOfLabel(labelOf(object) ?? this.shapeTextLook())) : undefined
  }

  private newTextStyle(): TextStyle {
    return readTextStyle(this.styledText(new IText('', toFabricText({}))))
  }

  /** A new text box with the look set for new text. */
  private styledText(text: IText): IText {
    if (Object.keys(this.newText).length > 0) applyTextStyle(text, this.newText)
    return text
  }

  /** Load the fonts the page's text uses, then measure the text again with them. */
  private async loadTextFonts(): Promise<void> {
    const objects = allObjects(this.canvas.getObjects())
    const texts = objects.filter((object) => object instanceof IText)
    const labels = objects.flatMap((object) => { const box = labelBox(object); return (box && asText(box)) ?? [] })
    const slotted = objects.filter(hasSlotText)
    const faces = [...texts, ...labels].flatMap(textFaces)
    if (slotted.length > 0) faces.push({ font: DEFAULT_FONT.name, weight: 400, italic: false })
    if (faces.length === 0) return
    await Promise.all(faces.map((face) => loadFontFace(fontByName(face.font) ?? DEFAULT_FONT, face.weight, face.italic)))
    if (this.abort.signal.aborted) return
    cache.clearFontCache()
    for (const text of texts) {
      text.initDimensions()
      text.setCoords()
      text.set('dirty', true)
    }
    // Shapes measure their text again when it's drawn next.
    for (const box of labels) box.initDimensions()
    for (const object of objects) if (labelBox(object)) object.set('dirty', true)
    for (const icon of slotted) refreshSlotText(icon)
    this.canvas.requestRenderAll()
  }

  undo(): void {
    const state = this.history.undo()
    if (state) void this.restore(state)
  }

  redo(): void {
    const state = this.history.redo()
    if (state) void this.restore(state)
  }

  get zoom(): number {
    return this.canvas.getZoom()
  }

  setZoom(zoom: number): void {
    this.canvas.setZoom(zoom)
    this.canvas.setDimensions({ width: this.page.width * zoom, height: this.page.height * zoom })
    this.emit()
  }

  /** The page as an SVG file, at its real size whatever the zoom. Without `background` the white page is left out. */
  toSVG({ background = true } = {}): string {
    const zoom = this.zoom
    const active = this.canvas.getActiveObject()
    const backgroundColor = this.canvas.backgroundColor
    this.canvas.discardActiveObject()
    this.setZoom(1)
    if (!background) this.canvas.backgroundColor = ''
    const svg = this.canvas.toSVG()
    this.canvas.backgroundColor = backgroundColor
    this.setZoom(zoom)
    if (active) this.canvas.setActiveObject(active)
    return svg
  }

  /** True while a saved figure is still being read in; saving then would store an empty page. */
  get loading(): boolean {
    return this.restoring
  }

  /** A small PNG of the page for the start screen, `width` pixels wide, without selection handles. */
  thumbnail(width = 480): string {
    return this.canvas.toDataURL({ format: 'png', multiplier: width / (this.page.width * this.zoom) })
  }

  /**
   * Show another slide: its saved contents (empty when missing) with its own
   * undo steps, or fresh ones the first time. Returns the undo steps of the
   * slide that was showing, so switching back can hand them in again.
   */
  async showSlide(saved: string | undefined, history?: History): Promise<History> {
    const previous = this.history
    this.canvas.discardActiveObject()
    if (saved) {
      await this.restore(saved, true)
    } else {
      this.canvas.remove(...this.canvas.getObjects())
      this.canvas.requestRenderAll()
    }
    this.history = history ?? new History(this.serialize())
    this.emit()
    return previous
  }

  /**
   * Give the page a new size, in page pixels. With `fit`, everything on it
   * scales to fit the new page and stays centred, as if you had selected all
   * and resized it. Undo steps start again from here (switching page size
   * back is the Undo for this); returns the old ones.
   */
  setPage(page: { width: number; height: number }, fit = true): History {
    this.cells.finish()
    this.shapeText.finish()
    this.iconText.finish()
    this.canvas.discardActiveObject()
    if (fit) {
      fitObjects(this.canvas.getObjects(), this.page, page)
      for (const object of allObjects(this.canvas.getObjects())) redrawOutline(object)
      this.followConnectors()
    }
    this.page = page
    this.setZoom(this.zoom)
    const previous = this.history
    this.history = new History(this.serialize())
    this.emit()
    return previous
  }

  /** A saved slide scaled from one page size to another, with a new small picture, without showing it. */
  static async fitSaved(saved: string, from: { width: number; height: number }, to: { width: number; height: number }): Promise<{ canvas: string; thumbnail: string }> {
    const scratch = new FigureCanvas(document.createElement('canvas'), from)
    try {
      await scratch.restore(saved, true)
      scratch.setPage(to)
      return { canvas: scratch.serialize(), thumbnail: scratch.thumbnail() }
    } finally {
      void scratch.dispose()
    }
  }

  dispose(): Promise<boolean> {
    this.angleTip.dispose()
    this.cells.finish()
    this.shapeText.finish()
    this.iconText.finish()
    this.abort.abort()
    this.listeners.clear()
    return this.canvas.dispose()
  }

  private get pageBox(): Box {
    return { left: 0, top: 0, width: this.page.width, height: this.page.height }
  }

  private isTyping(): boolean {
    const active = this.canvas.getActiveObject()
    return (active instanceof IText && active.isEditing) || this.cells.editing !== undefined
  }

  /** The selected objects, bottom one first. */
  private selectedInStackOrder(): FabricObject[] {
    const selected = this.canvas.getActiveObjects()
    return this.canvas.getObjects().filter((object) => selected.includes(object))
  }

  private prepareLayer(object: FabricObject): void {
    const ids = new Set<string>()
    const others = (objects: FabricObject[]): void => {
      for (const other of objects) {
        if (other === object) continue
        const id = layerProps(other).layerId
        if (id) ids.add(id)
        if (other instanceof FigureGroup) others(other.getObjects())
      }
    }
    others(this.canvas.getObjects())
    const visit = (part: FabricObject) => {
      const props = layerProps(part)
      if (!props.layerId || ids.has(props.layerId)) props.layerId = newLayerId()
      ids.add(props.layerId)
      if (isLocked(part)) setLocked(part, true)
      if (part instanceof FigureGroup) part.getObjects().forEach(visit)
    }
    visit(object)
  }

  private findLayer(id: string): { object: FabricObject; parent?: FigureGroup; topLevel: FabricObject } | undefined {
    const search = (objects: FabricObject[], parent: FigureGroup | undefined, topLevel: FabricObject | undefined): ReturnType<FigureCanvas['findLayer']> => {
      for (const object of objects) {
        const top = topLevel ?? object
        if (layerProps(object).layerId === id) return { object, parent, topLevel: top }
        const inside = object instanceof FigureGroup ? search(object.getObjects(), object, top) : undefined
        if (inside) return inside
      }
      return undefined
    }
    return search(this.canvas.getObjects(), undefined, undefined)
  }

  private layers(objects: readonly FabricObject[] = this.canvas.getObjects()): LayerItem[] {
    return [...objects].filter((object) => !isShapeTextBox(object)).reverse().map((object) => ({
      id: layerProps(object).layerId ?? '',
      name: objectName(object),
      kind: layerKind(object),
      hidden: !object.visible,
      locked: isLocked(object),
      ...(object instanceof FigureGroup && { children: this.layers(object.getObjects()) }),
    }))
  }

  private select(objects: FabricObject[]): void {
    const [only] = objects
    if (objects.length === 1 && only) this.canvas.setActiveObject(only)
    else if (objects.length > 1) this.canvas.setActiveObject(new ActiveSelection(objects, { canvas: this.canvas }))
  }

  /** Add a copy of an object or selection, offset a little, and select it. */
  private async placeCopyOf(source: FabricObject): Promise<void> {
    const copy = await source.clone(OWN_PROPERTIES)
    copy.set({ left: copy.left + PASTE_OFFSET_PX, top: copy.top + PASTE_OFFSET_PX })
    this.canvas.discardActiveObject()
    // A copied selection comes back as a selection: its objects go onto the page one by one.
    const objects = copy instanceof ActiveSelection ? copy.removeAll() : [copy]
    giveNewIds(objects)
    for (const object of objects) {
      if (isLocked(object)) setLocked(object, true)
      applyShapeRules(object)
    }
    this.canvas.add(...objects)
    this.select(objects)
    this.canvas.requestRenderAll()
    this.commit()
  }

  /** Move each selected object by the amount a plan works out from their boxes. */
  private moveEach(plan: (boxes: Box[]) => Move[]): void {
    const targets = this.canvas.getActiveObjects()
    if (targets.length === 0 || this.isTyping()) return
    // Out of the selection first, so every object's position is a page position.
    this.canvas.discardActiveObject()
    const moves = plan(targets.map((object) => object.getBoundingRect()))
    targets.forEach((object, index) => {
      const { dx, dy } = moves[index] ?? { dx: 0, dy: 0 }
      object.set({ left: object.left + dx, top: object.top + dy })
      object.setCoords()
    })
    this.select(targets)
    this.canvas.requestRenderAll()
    this.commit()
  }

  /*
   * Snapping: while dragging, edges and centres jump to line up with other
   * objects, the page and the grid, and thin guide lines show what lined up.
   * Holding Alt turns it off for as long as it's held.
   */
  private snapWhileMoving({ e, target }: BasicTransformEvent & { target: FabricObject }): void {
    if (e.altKey) {
      this.guides = []
      return
    }
    target.setCoords()
    const result = snap(target.getBoundingRect(), this.snapTargetsFor(target), this.pageBox, SNAP_DISTANCE_PX / this.zoom, this.canvas.grid)
    if (result.dx !== 0 || result.dy !== 0) {
      target.set({ left: target.left + result.dx, top: target.top + result.dy })
      target.setCoords()
    }
    this.guides = result.guides
  }

  /**
   * The boxes of everything a dragged object can snap to: all visible objects
   * except the selection, and the page margin (see `snapMarginPx`).
   */
  private snapTargetsFor(target: FabricObject): Box[] {
    const moving = this.canvas.getActiveObjects()
    const margin = marginBox(this.pageBox, snapMarginPx())
    this.snapTargets ??= [
      ...(margin ? [margin] : []),
      ...this.canvas
        .getObjects()
        .filter((object) => object !== target && !moving.includes(object) && object.visible)
        .map((object) => object.getBoundingRect()),
    ]
    return this.snapTargets
  }

  /**
   * Snapping while a side or corner handle resizes an object: the edges being
   * dragged jump onto other objects' edges and centres, the page and the grid,
   * the same as when moving. Turned objects don't snap (their box isn't
   * their edges), and Alt turns it off, as when moving.
   */
  private snapWhileResizing(e: TPointerEvent, target: FabricObject, transform: Transform): void {
    this.guides = []
    const corner = transform.corner
    // Without a pointer (a resize fired by code) there is nothing to snap.
    if (!(e as TPointerEvent | undefined) || !corner || e.altKey || target.getTotalAngle() % 360 !== 0 || transform.originX === 'center' || transform.originY === 'center') return
    // Dragged past the other side, the handle now drags the opposite edge.
    const flippedX = target.flipX !== Boolean(transform.original.flipX)
    const flippedY = target.flipY !== Boolean(transform.original.flipY)
    const sideOf = (has: boolean, start: boolean, flipped: boolean): Side | undefined => (has ? (start !== flipped ? 'start' : 'end') : undefined)
    const sides = {
      x: sideOf(/[lr]/.test(corner), corner.includes('l'), flippedX),
      y: sideOf(/[tb]/.test(corner), corner.includes('t'), flippedY),
    }
    if (!sides.x && !sides.y) return
    const original = transform.original
    const keepRatio = Boolean(sides.x && sides.y) && Math.abs(target.scaleX / target.scaleY - original.scaleX / original.scaleY) < 1e-6
    target.setCoords()
    const before = target.getBoundingRect()
    const result = snapResize(before, sides, this.snapTargetsFor(target), this.pageBox, SNAP_DISTANCE_PX / this.zoom, this.canvas.grid, keepRatio)
    this.guides = result.guides
    if (result.box.width === before.width && result.box.height === before.height) return
    // The box's outline doesn't scale exactly with the object, so a couple of rounds bring the edge onto the line.
    const anchor = target.translateToOriginPoint(target.getCenterPoint(), transform.originX, transform.originY)
    for (let round = 0; round < 3; round++) {
      const now = target.getBoundingRect()
      if (Math.abs(now.width - result.box.width) < 0.05 && Math.abs(now.height - result.box.height) < 0.05) break
      target.set({
        scaleX: now.width > 0 ? (target.scaleX * result.box.width) / now.width : target.scaleX,
        scaleY: now.height > 0 ? (target.scaleY * result.box.height) / now.height : target.scaleY,
      })
      target.setPositionByOrigin(anchor, transform.originX, transform.originY)
      target.setCoords()
    }
  }

  /** Snapping for a dragged arrow end, the same lines as moving an object. */
  private snapArrowEnd(point: XY, arrow: FabricObject, e: TPointerEvent): XY {
    if (e.altKey) {
      this.guides = []
      return this.snapToAnchor(point, point)
    }
    const result = snapPoint(point, this.snapTargetsFor(arrow), this.pageBox, SNAP_DISTANCE_PX / this.zoom, this.canvas.grid)
    this.guides = result.guides
    return this.snapToAnchor(point, result)
  }

  /** While an arrow end is dragged: show the anchors, and put the end on the side whose dot is under the pointer. */
  private snapToAnchor(pointer: XY, snapped: XY): XY {
    this.endDragging = true
    const hover = this.hoverAnchors(pointer)
    const point = hover?.side ? sidePoint(hover.frame, hover.side, ANCHOR_GAP) : snapped
    this.lastEndSnap = { point, hover }
    return { x: point.x, y: point.y }
  }

  /** The angle while rotating, in a small pill beside the pointer. */
  private showAngle(e: TPointerEvent, target: FabricObject): void {
    const pointer = this.canvas.getViewportPoint(e)
    this.angleTip.show(target.angle, pointer.x, pointer.y)
  }

  private endSnapping(): void {
    this.snapTargets = undefined
    if (this.endDragging) {
      this.endDragging = false
      this.anchorHover = undefined
      this.canvas.requestRenderAll()
    }
    if (this.guides.length === 0) return
    this.guides = []
    this.canvas.requestRenderAll()
  }

  /**
   * The text clicked in a selected shape: a dashed box around it, in the blue
   * of the shape's selection frame. A selected bracket always shows the area
   * where its text goes (beside it, or between a double bracket's brackets),
   * also while it is empty, so it's clear a click there writes text.
   */
  private drawPickedText(ctx: CanvasRenderingContext2D): void {
    if (ctx !== this.canvas.getContext()) return
    const active = this.canvas.getActiveObject()
    const area = active && !isLocked(active) ? bracketTextArea(active) : undefined
    const shape = area ? active : this.textPickedIn()
    const corners = area?.corners ?? (shape && labelCorners(shape))
    if (!shape || !corners) return
    const vpt = this.canvas.viewportTransform
    ctx.save()
    ctx.transform(vpt[0], vpt[1], vpt[2], vpt[3], vpt[4], vpt[5])
    ctx.strokeStyle = shape.borderColor
    ctx.lineWidth = 1 / this.zoom
    ctx.setLineDash([3 / this.zoom, 3 / this.zoom])
    ctx.beginPath()
    corners.forEach((corner, i) => (i === 0 ? ctx.moveTo(corner.x, corner.y) : ctx.lineTo(corner.x, corner.y)))
    ctx.closePath()
    ctx.stroke()
    ctx.restore()
  }

  /** The shape whose text is picked, while it is still the one selected and isn't being typed in. */
  private textPickedIn(): FabricObject | undefined {
    const shape = this.pickedText
    return shape && this.canvas.getActiveObject() === shape && this.shapeText.shape !== shape ? shape : undefined
  }

  /** True while the arrow anchors show: with the arrow tool (unless typing), or while an arrow end is dragged. */
  private showingAnchors(): boolean {
    return this.endDragging || (this.tool === 'arrow' && !this.shapeText.shape)
  }

  /**
   * The object an arrow end at this point would attach to. A point within
   * reach of an object's anchor dot picks that object and that side. A point
   * over an object's body picks the object but no side (the arrow then
   * attaches the way it did before sides: on the edge facing its other end).
   * `skip` is an object that can't be picked (the one the arrow starts at).
   */
  private anchorAt(point: XY, skip?: string): AnchorHover | undefined {
    const objects = this.canvas.getObjects().filter((object) => object.visible && !(object instanceof Connector) && idOf(object) && idOf(object) !== skip)
    const candidates = objects.map((object) => ({ id: idOf(object)!, frame: frameOf(object) }))
    // Measured on screen, to the middle of each marker as drawn, so pressing anywhere on a marker (its tip too) picks it at every zoom.
    const vpt = this.canvas.viewportTransform
    const pointer = { x: vpt[0] * point.x + vpt[2] * point.y + vpt[4], y: vpt[1] * point.x + vpt[3] * point.y + vpt[5] }
    let best: (AnchorHover & { distance: number }) | undefined
    for (const { id, frame } of candidates.toReversed()) {
      for (const side of ['top', 'right', 'bottom', 'left'] as const) {
        const { at, out } = anchorOnScreen(frame, side, vpt)
        const middle = ANCHOR_ARROW_LENGTH_PX / 2
        const distance = Math.hypot(at.x + out.x * middle - pointer.x, at.y + out.y * middle - pointer.y)
        if (distance <= ANCHOR_REACH_PX && (!best || distance < best.distance)) best = { id, side, frame, distance }
      }
    }
    if (best) return { id: best.id, side: best.side, frame: best.frame }
    const over = attachTargetAt(point, candidates)
    const found = candidates.find((candidate) => candidate.id === over)
    return found && { id: found.id, frame: found.frame }
  }

  /** Point the anchors at what is under the pointer; redraw only when that changed. */
  private hoverAnchors(point: XY, skip?: string): AnchorHover | undefined {
    const hover = this.showingAnchors() ? this.anchorAt(point, skip) : undefined
    if (hover?.id !== this.anchorHover?.id || hover?.side !== this.anchorHover?.side) {
      this.anchorHover = hover
      this.canvas.requestRenderAll()
    }
    return hover
  }

  /**
   * The arrow anchors, in screen pixels like the guides: a small marker
   * outside the middle of each side of every object an arrow can stick to,
   * pointing outward (a tiny arrow), at the spot where
   * an arrow end on that side will sit. The object under the pointer gets a
   * thin outline, and the anchor under the pointer a bigger marker with a soft
   * halo (none over the body). Only on screen, never in exports (those draw on
   * another canvas, which this skips).
   */
  private drawAnchors(ctx: CanvasRenderingContext2D): void {
    if (!this.showingAnchors() || ctx !== this.canvas.getContext()) return
    const vpt = this.canvas.viewportTransform
    const hover = this.anchorHover
    ctx.save()
    for (const object of this.canvas.getObjects()) {
      if (!object.visible || object instanceof Connector || !idOf(object)) continue
      const frame = frameOf(object)
      const active = hover?.id === idOf(object) ? hover : undefined
      const marker = (side: AnchorSide, big: boolean) => {
        const { at, out } = anchorOnScreen(frame, side, vpt)
        drawAnchorMarker(ctx, at, out, big)
      }
      for (const side of ['top', 'right', 'bottom', 'left'] as const) if (active?.side !== side) marker(side, false)
      if (!active) continue
      // The outline: the object's box (or ellipse) a few screen pixels bigger, turned with the object.
      const screen = util.multiplyTransformMatrices(vpt, object.calcTransformMatrix())
      const grow = (a: number, b: number) => ANCHOR_OUTLINE_GAP_PX / (Math.hypot(a, b) || 1)
      const hw = frame.width / 2 + grow(screen[0], screen[1])
      const hh = frame.height / 2 + grow(screen[2], screen[3])
      const outline: XY[] = frame.round
        ? Array.from({ length: 72 }, (_, i) => ({ x: hw * Math.cos((i / 72) * Math.PI * 2), y: hh * Math.sin((i / 72) * Math.PI * 2) }))
        : [{ x: -hw, y: -hh }, { x: hw, y: -hh }, { x: hw, y: hh }, { x: -hw, y: hh }]
      ctx.strokeStyle = ANCHOR_COLOUR
      ctx.lineWidth = 1
      ctx.beginPath()
      outline.forEach((corner, i) => {
        const p = util.transformPoint(new Point(corner.x, corner.y), screen)
        if (i === 0) ctx.moveTo(p.x, p.y)
        else ctx.lineTo(p.x, p.y)
      })
      ctx.closePath()
      ctx.stroke()
      if (active.side) marker(active.side, true)
    }
    ctx.restore()
  }

  private drawGuides(ctx: CanvasRenderingContext2D): void {
    if (this.guides.length === 0 || ctx !== this.canvas.getContext()) return
    const zoom = this.zoom
    ctx.save()
    ctx.strokeStyle = GUIDE_COLOUR
    ctx.lineWidth = 1
    // Something lined up with the page margin: show all four margin lines,
    // faint and dashed, each running right across the page so they cross near
    // the corners like crop marks. It reads as a suggested inset, not a hard limit.
    const margin = marginBox(this.pageBox, snapMarginPx())
    if (margin && touchesMargin(this.guides, margin)) {
      ctx.save()
      ctx.globalAlpha = 0.55
      ctx.setLineDash([4, 3])
      const edge = (value: number) => Math.round(value * zoom) + 0.5
      const [width, height] = [this.page.width * zoom, this.page.height * zoom]
      ctx.beginPath()
      for (const x of [margin.left, margin.left + margin.width]) {
        ctx.moveTo(edge(x), 0)
        ctx.lineTo(edge(x), height)
      }
      for (const y of [margin.top, margin.top + margin.height]) {
        ctx.moveTo(0, edge(y))
        ctx.lineTo(width, edge(y))
      }
      ctx.stroke()
      ctx.restore()
    }
    ctx.beginPath()
    // Drawn in screen pixels, so the lines stay 1 px thin and sharp at any zoom.
    for (const { axis, at, from, to } of this.guides) {
      const line = Math.round(at * zoom) + 0.5
      if (axis === 'x') {
        ctx.moveTo(line, from * zoom)
        ctx.lineTo(line, to * zoom)
      } else {
        ctx.moveTo(from * zoom, line)
        ctx.lineTo(to * zoom, line)
      }
    }
    ctx.stroke()
    ctx.restore()
  }

  private add(object: FabricObject, commit = true): void {
    object.set({ strokeUniform: true })
    applyShapeRules(object)
    for (const part of allObjects([object])) (part as Own).figureId ??= newId()
    this.canvas.add(object)
    if (!commit) return
    this.canvas.setActiveObject(object)
    this.commit()
  }

  /*
   * Drawing tools place one object and then hand back to Select, so the next
   * click on it grabs it. Press and drag to draw a shape at the size you want;
   * a click without dragging places one of the default size. Pressing on an
   * existing object with a shape tool grabs that object instead.
   */
  private onPointerDown({ e, scenePoint, target }: TPointerEventInfo): void {
    if (this.cells.editing && target !== this.cells.editing) this.cells.finish()
    if (this.tool === 'select') return this.pickCells(e, scenePoint, target)
    if (this.tool === 'chart') {
      if (target) return this.setTool('select')
      this.drawing = { start: { x: scenePoint.x, y: scenePoint.y }, object: this.placeChart(scenePoint, scenePoint, false) }
      return
    }
    if (this.tool === 'table') {
      if (target) return this.setTool('select')
      this.drawing = { start: { x: scenePoint.x, y: scenePoint.y }, object: this.placeTable(scenePoint, scenePoint, false) }
      return
    }
    if (this.tool === 'text') return this.onTextToolDown(e, scenePoint)
    // Grabbing the arrow just drawn adjusts it instead of drawing a new one.
    if (target && target === this.canvas.getActiveObject() && target instanceof Connector) return
    if (target && pressOnObject(this.tool) === 'select') return this.setTool('select')
    // An arrow pressed on an anchor marker starts on that side and stays attached there; pressed on an object's body, it attaches with no side.
    const hover = this.tool === 'arrow' ? this.hoverAnchors(scenePoint) : undefined
    // With the arrow tool, pressing an existing arrow (away from the markers) selects it, so its ends can be dragged; it draws no new one.
    const existing = this.tool === 'arrow' && !hover?.side ? this.arrowAt(scenePoint) : undefined
    if (existing) {
      this.canvas.setActiveObject(existing)
      this.canvas.requestRenderAll()
      return this.emit()
    }
    const start = hover?.side ? sidePoint(hover.frame, hover.side, ANCHOR_GAP) : { x: scenePoint.x, y: scenePoint.y }
    const spec = shapeFromDrag(this.tool, start, start, false, this.choice)
    this.drawingAttach = hover?.id
    this.drawingSide = hover?.side
    const object = this.addShape(spec, false)
    // An arrow only shows once the pointer has really moved: a click (to select something) never flashes a head.
    if (this.tool === 'arrow') object.set({ visible: false })
    this.drawing = { start, object }
  }

  private onPointerMove({ e, scenePoint }: TPointerEventInfo): void {
    if (this.tool === 'arrow') {
      const hover = this.hoverAnchors(scenePoint, this.drawing ? this.drawingAttach : undefined)
      // Over an existing arrow (and not on a marker) a press selects it, so the cursor says clickable.
      const overArrow = !this.drawing && !hover?.side && this.arrowAt(scenePoint) !== undefined
      const cursor = overArrow ? 'pointer' : 'crosshair'
      if (this.canvas.defaultCursor !== cursor) {
        this.canvas.defaultCursor = cursor
        this.canvas.setCursor(cursor)
      }
    }
    if (this.cellDrag) return this.dragCells(scenePoint)
    if (this.textDrag) return this.moveTextDrag(scenePoint)
    if (this.textSelecting) return this.moveTextSelecting(e)
    if (!this.drawing || this.tool === 'select' || this.tool === 'text') return
    if (this.tool === 'chart') {
      this.canvas.remove(this.drawing.object)
      this.drawing.object = this.placeChart(this.drawing.start, scenePoint, false)
      return
    }
    if (this.tool === 'table') {
      this.canvas.remove(this.drawing.object)
      this.drawing.object = this.placeTable(this.drawing.start, scenePoint, false)
      return
    }
    // An arrow stays hidden until the drag is real, so a click shows nothing.
    if (this.tool === 'arrow' && !this.drawing.object.visible && distance(this.drawing.start, scenePoint) * this.zoom < DRAG_THRESHOLD_PX) return
    // Redrawn from scratch on each move: simple, and fast enough for one shape.
    this.canvas.remove(this.drawing.object)
    // The arrow's end snaps only onto a marker's side; over an object's body it follows the pointer freely.
    const hover = this.tool === 'arrow' ? this.anchorHover : undefined
    const to = hover?.side ? sidePoint(hover.frame, hover.side, ANCHOR_GAP) : scenePoint
    const preview = this.placeShape(shapeFromDrag(this.tool, this.drawing.start, to, e.shiftKey && !hover?.side, this.choice), false)
    this.drawing.object = preview
    // The preview is attached to the sides like the finished arrow will be, so an elbow or U shape
    // leaves the start side and enters the end side the right way on every move, not only after release.
    if (preview instanceof Connector) {
      const startFrame = this.drawingAttach && this.drawingSide ? this.frameById(this.drawingAttach) : undefined
      const [from, tip] = preview.pagePoints()
      preview.set({
        attachStart: startFrame && this.drawingSide ? this.drawingAttach : undefined,
        attachStartSide: startFrame ? this.drawingSide : undefined,
        attachEnd: hover?.side ? hover.id : undefined,
        attachEndSide: hover?.side,
      })
      preview.setPagePoints(from, tip, {
        ...(startFrame && this.drawingSide && { start: sideNormal(startFrame, this.drawingSide) }),
        ...(hover?.side && { end: sideNormal(hover.frame, hover.side) }),
      })
    }
  }

  private onPointerUp({ scenePoint, target, isClick, e }: TPointerEventInfo & { isClick?: boolean }): void {
    if (this.textDrag) return this.endTextDrag(scenePoint)
    if (this.textSelecting) return this.endTextSelecting()
    if (this.cellDrag) {
      this.cellDrag = undefined
      return this.emit()
    }
    // Phones: a double tap on a text or a shape starts typing in it, within the tap so the keyboard opens.
    // Browsers don't send a double click for taps reliably, so taps are timed here (owner's calls, 2026-11-17).
    if (this.tool === 'select' && isClick && target && isTouch(e)) {
      const last = this.lastTap
      this.lastTap = { target, at: e.timeStamp }
      const text = asText(target)
      if (last?.target === target && e.timeStamp - last.at < DOUBLE_TAP_MS && !isLocked(target)) {
        if (text && !text.isEditing && text.editable && !isShapeTextBox(text)) {
          this.lastTap = undefined
          return this.startTyping(text, e)
        }
        if (textShapeOf(target)) {
          this.lastTap = undefined
          this.pickedText = undefined
          return this.typeInShape(target, e)
        }
      }
    }
    // A click on the text area beside a bracket that was already selected starts typing there.
    if (this.tool === 'select' && isClick && target && target === this.activeBeforeClick && !isLocked(target) && hitsBracketTextArea(target, scenePoint)) {
      this.pickedText = undefined
      return this.typeInShape(target, e)
    }
    // A click (no drag) on the text of a shape that was already selected picks that text; any other click lets go of it.
    if (this.tool === 'select' && isClick) {
      const picked = target && target === this.activeBeforeClick && hitsLabel(target, scenePoint) ? target : undefined
      if (picked !== this.pickedText) {
        this.pickedText = picked
        this.canvas.requestRenderAll()
        this.emit()
      }
    }
    // A click (no drag) on a table that was already selected picks the cell under it.
    if (this.tool === 'select' && isClick && target instanceof TableObject && target === this.activeBeforeClick && !target.cellRange) {
      const cell = target.cellAtPoint(scenePoint)
      if (!cell) return
      target.cellRange = { r0: cell.r, c0: cell.c, r1: cell.r, c1: cell.c }
      this.canvas.requestRenderAll()
      return this.emit()
    }
    if (!this.drawing || this.tool === 'select' || this.tool === 'text') return
    const { start, object } = this.drawing
    this.drawing = undefined
    this.anchorHover = undefined
    if (this.tool === 'chart') {
      this.canvas.remove(object)
      const chart = this.placeChart(start, distance(start, scenePoint) * this.zoom < DRAG_THRESHOLD_PX ? start : scenePoint, true)
      this.setTool('select')
      this.canvas.setActiveObject(chart)
      this.emit()
      return
    }
    if (this.tool === 'table') {
      this.canvas.remove(object)
      const table = this.placeTable(start, distance(start, scenePoint) * this.zoom < DRAG_THRESHOLD_PX ? start : scenePoint, true)
      this.setTool('select')
      this.canvas.setActiveObject(table)
      this.emit()
      return
    }
    if (distance(start, scenePoint) * this.zoom < DRAG_THRESHOLD_PX) {
      this.canvas.remove(object)
      // A click with the arrow tool never places an arrow. On an object it selects that object, and the
      // arrow tool stays on (the Arrows panel is still open, so the anchors must stay too, as when an
      // arrow is clicked); on empty page it lets go of the selection.
      if (this.tool === 'arrow') {
        const id = this.drawingAttach ?? this.attachTargetAt(start)
        const picked = id ? this.canvas.getObjects().find((candidate) => idOf(candidate) === id) : undefined
        if (picked && !isLocked(picked)) {
          this.canvas.setActiveObject(picked)
          this.canvas.requestRenderAll()
          return this.emit()
        }
        this.canvas.discardActiveObject()
        this.canvas.requestRenderAll()
        return this.emit()
      }
      this.placeShape(shapeAt(this.tool, start.x, start.y, this.choice))
    } else {
      // An arrow drawn from one object to another sticks to both.
      if (object instanceof Connector) {
        const end = this.anchorAt(scenePoint, this.drawingAttach)
        object.set({
          attachStart: this.drawingAttach,
          attachStartSide: this.drawingAttach ? this.drawingSide : undefined,
          attachEnd: end?.id,
          attachEndSide: end?.side,
        })
      }
      this.canvas.setActiveObject(object)
      this.commit()
    }
    // A tool that stays on keeps the new object selected.
    const next = toolAfterPlacing(this.tool)
    if (next !== this.tool) this.setTool(next)
    else this.emit()
  }

  /*
   * The text tool: pressing on existing text edits it (a drag highlights), a
   * click beside the text while typing finishes the typing and hands back to
   * Select, and a click anywhere else adds a new text box.
   */
  private onTextToolDown(e: TPointerEventInfo['e'], point: XY): void {
    const wasEditing = this.editingBeforeClick
    const existing = this.canvas.objectAt(point)
    if (wasEditing && existing !== wasEditing) {
      if (wasEditing.isEditing) wasEditing.exitEditing()
      // Pressing another text goes straight into it; anywhere else ends the typing.
      if (existing && asText(existing)) {
        this.editingBeforeClick = undefined
        return this.onTextToolDown(e, point)
      }
      return this.finishTyping(true)
    }
    // Pressing and dragging highlights letters and words.
    const pressed = existing && asText(existing)
    if (pressed) {
      this.canvas.setActiveObject(pressed)
      if (!pressed.isEditing) pressed.enterEditing()
      const anchor = pressed.getSelectionStartFromPointer(e)
      pressed.selectionStart = anchor
      pressed.selectionEnd = anchor
      this.textSelecting = { text: pressed, anchor }
      this.canvas.requestRenderAll()
      this.emit()
      return
    }
    // A click adds text that grows as you type; a drag draws a box the text wraps in.
    const box = new Rect({ left: point.x, top: point.y, width: 0, height: 0, fill: 'rgba(37, 99, 235, 0.06)', stroke: '#2563eb', strokeWidth: 1, strokeDashArray: [4, 3], strokeUniform: true, selectable: false, evented: false, excludeFromExport: true })
    this.canvas.add(box)
    this.textDrag = { start: { x: point.x, y: point.y }, box }
  }

  private moveTextSelecting(e: TPointerEventInfo['e']): void {
    const { text, anchor } = this.textSelecting!
    const at = text.getSelectionStartFromPointer(e)
    if (Math.min(anchor, at) === text.selectionStart && Math.max(anchor, at) === text.selectionEnd) return
    text.selectionStart = Math.min(anchor, at)
    text.selectionEnd = Math.max(anchor, at)
    text._updateTextarea()
    this.canvas.requestRenderAll()
    this.emit()
  }

  private endTextSelecting(): void {
    const { text } = this.textSelecting!
    this.textSelecting = undefined
    // The mouse release can take the keyboard away from the text; give it back.
    setTimeout(() => {
      if (!text.isEditing) return
      text.hiddenTextarea?.focus()
      text._updateTextarea()
      this.emit()
    })
  }

  private moveTextDrag(point: XY): void {
    const { start, box } = this.textDrag!
    box.set({ left: Math.min(start.x, point.x), top: Math.min(start.y, point.y), width: Math.abs(point.x - start.x), height: Math.abs(point.y - start.y) })
    this.canvas.requestRenderAll()
  }

  private endTextDrag(point: XY): void {
    const { start, box } = this.textDrag!
    this.textDrag = undefined
    this.canvas.remove(box)
    const dragged = distance(start, point) * this.zoom >= DRAG_THRESHOLD_PX
    const spec = shapeAt('text', start.x, start.y)
    const text = asText(
      toFabric(dragged && spec.kind === 'text' ? { ...spec, left: Math.min(start.x, point.x), top: Math.min(start.y, point.y), text: 'Text', width: Math.max(Math.abs(point.x - start.x), 20) } : spec),
    )
    if (!text) return
    // Added with the look set for new text, as one undo step.
    this.styledText(text)
    this.add(text)
    // Start typing once Fabric has finished with the mouse release, or it takes the keyboard away again.
    setTimeout(() => {
      if (this.canvas.getActiveObject() !== text) return
      text.enterEditing()
      text.selectAll()
    })
  }

  /** Lights up the spacing or bar-width handle of a selected chart under the pointer. */
  private lightChartHandle(viewportPoint: Point, scenePoint: Point): void {
    const chart = this.activeChart()
    if (!chart) return
    const key = chart.findControl(viewportPoint)?.key
    const overChart = !key && chart.containsPoint(scenePoint)
    const handle = key?.startsWith(CHART_HANDLE) ? key : overChart ? ALL_HANDLES : undefined
    if (handle === chart.hoverHandle) return
    chart.hoverHandle = handle
    this.canvas.requestRenderAll()
  }

  /** The chart on its own in the selection, if that's what is selected. */
  private activeChart(): ChartObject | undefined {
    const active = this.canvas.getActiveObject()
    return active instanceof ChartObject ? active : undefined
  }

  /**
   * A new chart from the Graph panel's picks: a click places one sized to the
   * page (see `chartSizeForPage`) in the middle of the page, so none of it
   * hangs off the edge; a drag places one that fills the dragged box.
   */
  private placeChart(start: XY, end: XY, commit: boolean): ChartObject {
    const dragged = distance(start, end) > 0
    // Named Chart 1, Chart 2… so the layers and the page tell them apart.
    const number = this.canvas.getObjects().filter((object) => object instanceof ChartObject).length + 1
    const size = dragged ? { width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) } : chartSizeForPage(this.page)
    const data = createChart(this.chartChoice.kind, this.chartChoice.errorBars, size, `Chart ${number}`)
    const left = dragged ? Math.min(start.x, end.x) : (this.page.width - data.width) / 2
    const top = dragged ? Math.min(start.y, end.y) : (this.page.height - data.height) / 2
    const chart = new ChartObject({ chart: data, left, top })
    this.add(chart, commit)
    return chart
  }

  /** The table on its own in the selection, if that's what is selected. */
  private activeTable(): TableObject | undefined {
    const active = this.canvas.getActiveObject()
    return active instanceof TableObject ? active : undefined
  }

  /**
   * A new table from the Table panel's picks: a click places one of the
   * default size centred there, a drag gives the size.
   */
  private placeTable(start: XY, end: XY, commit: boolean): TableObject {
    const { rows, cols, layout, look } = this.tableChoice
    const dragged = start.x !== end.x || start.y !== end.y
    const asked = dragged ? { width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) } : { width: colWidthForPage(this.page.width, cols) * cols, height: 0 }
    const data = createTable(rows, cols, layout, look, asked)
    const size = tableSize(data)
    let left = dragged ? Math.min(start.x, end.x) : start.x - size.width / 2
    let top = dragged ? Math.min(start.y, end.y) : start.y - size.height / 2
    // A table placed by a click (or from the panel) moves along a little while
    // another table already sits right there, so it doesn't hide that one.
    const taken = (x: number, y: number) => this.canvas.getObjects().some((object) => object instanceof TableObject && Math.abs(object.left - x) < 1 && Math.abs(object.top - y) < 1)
    while (!dragged && taken(left, top)) {
      left += PASTE_OFFSET_PX
      top += PASTE_OFFSET_PX
    }
    const table = new TableObject({ table: data, left, top })
    this.add(table, commit)
    return table
  }

  /**
   * Pressing on a table that was already selected. Without picked cells this
   * is where moving it starts; a click without moving picks the cell (see
   * `onPointerUp`). With cells picked, pressing and dragging over the table
   * picks a block of cells instead of moving it, and Shift stretches the
   * picked block to the cell pressed. Escape lets go of the cells, so the
   * table moves again.
   */
  private pickCells(e: TPointerEventInfo['e'], point: XY, target: FabricObject | undefined): void {
    if (!(target instanceof TableObject)) return
    if (this.activeBeforeClick !== target) {
      target.cellRange = undefined
      return
    }
    const range = target.cellRange
    const cell = target.cellAtPoint(point)
    // Handles (corners, the column and row strips) keep working as usual.
    if (!range || !cell || this.canvas._currentTransform?.corner) return
    this.canvas._currentTransform = null
    const anchor = e.shiftKey ? { r: range.r0, c: range.c0 } : cell
    this.cellDrag = { table: target, anchor }
    target.cellRange = fullRange(target.table, { r0: anchor.r, c0: anchor.c, r1: cell.r, c1: cell.c })
    this.canvas.requestRenderAll()
    this.emit()
  }

  /** While dragging over a table: the picked block runs from where the drag started to the cell under the pointer. */
  private dragCells(point: XY): void {
    const drag = this.cellDrag
    const cell = drag?.table.cellAtPoint(point)
    if (!drag || !cell) return
    drag.table.cellRange = fullRange(drag.table.table, { r0: drag.anchor.r, c0: drag.anchor.c, r1: cell.r, c1: cell.c })
    this.canvas.requestRenderAll()
  }

  /**
   * Keys for the picked cells of the selected table, like in a spreadsheet:
   * Enter edits the first picked cell, typing replaces its text, the arrow
   * keys and Tab move the pick (Shift+arrows stretch it), Delete empties the
   * picked cells, and Escape lets go of them. Returns 'typing' when the key
   * should go on into the cell's text box, true when it was used, and false
   * when it is not for the table.
   */
  tableKey(event: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'ctrlKey' | 'metaKey' | 'altKey'>): boolean | 'typing' {
    const table = this.activeTable()
    const range = table?.cellRange
    if (!table || !range || this.cells.editing || event.ctrlKey || event.metaKey || event.altKey) return false
    const t = table.table
    const first = { r: range.r0, c: range.c0 }
    const repaint = () => {
      this.canvas.requestRenderAll()
      this.emit()
    }
    if (event.key === 'Enter' || event.key === 'F2') {
      this.cells.start(table, first)
      repaint()
      return true
    }
    if (event.key.length === 1) {
      this.cells.start(table, first, true)
      repaint()
      return 'typing'
    }
    if (event.key === 'Escape') {
      table.cellRange = undefined
      repaint()
      return true
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      table.setTable(clearCells(t, range))
      this.canvas.requestRenderAll()
      this.commit()
      return true
    }
    const moves: Partial<Record<string, CellMove>> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Tab: event.shiftKey ? 'previous' : 'next' }
    const move = moves[event.key]
    if (!move) return false
    if (event.shiftKey && move !== 'previous') {
      // Stretch the far corner of the picked block.
      const to = moveCell(t, range.r1, range.c1, move)
      if (to) table.cellRange = fullRange(t, { ...range, r1: to.r, c1: to.c })
    } else {
      const to = moveCell(t, first.r, first.c, move)
      if (to) table.cellRange = fullRange(t, { r0: to.r, c0: to.c, r1: to.r, c1: to.c })
    }
    repaint()
    return true
  }

  /** A table's colours in the colour fields: the picked cells' fill, and its lines. */
  private tableColours(table: TableObject): Pick<SelectionInfo, 'fill' | 'stroke' | 'strokeWidth'> {
    const range = table.cellRange ?? wholeTable(table.table)
    const fill = table.table.cells[range.r0]?.[range.c0]?.fill ?? table.table.cellFill ?? DEFAULT_CELL_FILL
    return { fill, stroke: table.table.lineColour, strokeWidth: table.table.lineWidth }
  }

  /** The topmost arrow under a point, on its line. */
  private arrowAt(point: XY): Connector | undefined {
    return this.canvas
      .getObjects()
      .toReversed()
      .find((object): object is Connector => object instanceof Connector && object.visible && !object.group && arrowHit(object, point, this.zoom))
  }

  /** The object an arrow end let go at this point sticks to: the topmost one under it that isn't an arrow. */
  private attachTargetAt(point: XY): string | undefined {
    const candidates = this.canvas
      .getObjects()
      .filter((object) => object.visible && !(object instanceof Connector) && idOf(object))
      .map((object) => ({ id: idOf(object)!, frame: frameOf(object) }))
    return attachTargetAt(point, candidates)
  }

  /**
   * Pressing on an end of an arrow that isn't selected yet selects it first,
   * so the press grabs that end's handle. Fabric only uses a handle on an
   * object that was already selected, and would otherwise move the whole arrow.
   */
  private selectArrowAtEnd(e: TPointerEvent): void {
    if (this.tool !== 'select' || e.shiftKey) return
    const point = this.canvas.getScenePoint(e)
    const arrow = this.canvas.objectAt(point)
    if (!(arrow instanceof Connector) || arrow === this.canvas.getActiveObject() || !arrow.hasControls) return
    if (arrow.endNear(point, END_HANDLE_SIZE_PX / 2 / this.zoom) === undefined) return
    this.canvas.setActiveObject(arrow)
  }

  /** After an end handle is dragged: the end sticks to the object it was let go over. */
  private stickEnds(arrow: Connector): void {
    const [a, b] = arrow.pagePoints()
    if (!arrow.attachStart) {
      const at = this.attachmentAt(a)
      arrow.set({ attachStart: at?.id, attachStartSide: at?.side })
    }
    if (!arrow.attachEnd) {
      const at = this.attachmentAt(b)
      arrow.set({ attachEnd: at?.id, attachEndSide: at?.side })
    }
    if (arrow.attachStart && arrow.attachStart === arrow.attachEnd) arrow.set({ attachEnd: undefined, attachEndSide: undefined })
    this.lastEndSnap = undefined
  }

  private frameById(id: string): Frame | undefined {
    const object = this.canvas.getObjects().find((candidate) => idOf(candidate) === id)
    return object && frameOf(object)
  }

  /** What a dragged arrow end let go at this point attaches to: the dot it snapped to (with its side), else the object under it with no side. */
  private attachmentAt(point: XY): { id: string; side?: AnchorSide } | undefined {
    const snap = this.lastEndSnap
    if (snap?.hover?.side && Math.hypot(snap.point.x - point.x, snap.point.y - point.y) < 0.5) return snap.hover
    const id = this.attachTargetAt(point)
    return id ? { id } : undefined
  }

  /** Dragging or turning an arrow unsticks the ends whose objects aren't moved along with it. */
  private unstickDraggedArrows(): void {
    const moving = allObjects(this.canvas.getActiveObjects())
    const movingIds = new Set(moving.map(idOf))
    for (const arrow of moving.filter((object) => object instanceof Connector)) {
      if (arrow.attachStart && !movingIds.has(arrow.attachStart)) arrow.set({ attachStart: undefined, attachStartSide: undefined })
      if (arrow.attachEnd && !movingIds.has(arrow.attachEnd)) arrow.set({ attachEnd: undefined, attachEndSide: undefined })
    }
  }

  /**
   * Move every stuck arrow end to its object: the side it was attached to,
   * else the edge facing the other end, or for a U-shaped arrow the bottom
   * (in the arrow's own turn). Arrows
   * moved along inside a selection keep their shape.
   */
  private followConnectors(): void {
    const gap = ANCHOR_GAP
    const byId = new Map(allObjects(this.canvas.getObjects()).flatMap((object) => (idOf(object) ? [[idOf(object)!, object] as const] : [])))
    for (const arrow of this.canvas.getObjects()) {
      if (!(arrow instanceof Connector) || arrow.group || (!arrow.attachStart && !arrow.attachEnd && !arrow.startDir && !arrow.endDir)) continue
      const frameFor = (id: string) => {
        const target = byId.get(id)
        return target?.visible ? frameOf(target) : undefined
      }
      // The way each end's side faces: corner routes leave and enter along it.
      const ends = arrow.ends()
      // An end attached with a side takes that side's way out; attached with none, it clears it; a loose end keeps its shape as it was.
      const normal = (end: ConnectorEnd): XY | null | undefined => {
        const frame = end.attach ? frameFor(end.attach) : undefined
        return frame ? (end.side ? sideNormal(frame, end.side) : null) : undefined
      }
      const [first, last] = [normal(ends[0]), normal(ends[1])]
      const turn = (arrow.angle * Math.PI) / 180
      // A U-shaped arrow dips towards a chosen side, else down; ends with no side then sit on that edge.
      const down = arrow.route === 'u-shape' ? (first ?? last ?? { x: -Math.sin(turn), y: Math.cos(turn) }) : undefined
      const [a, b] = followEnds(ends, frameFor, down, gap)
      arrow.setPagePoints(a, b, { ...(first !== undefined && { start: first }), ...(last !== undefined && { end: last }) })
    }
  }

  /** Save the current figure as an undo step and tell the screen. */
  private commit(mergeKey?: string): void {
    if (this.restoring) return
    // Resized shapes with round corners are drawn again at their new size, so the corners stay round (not while typing in one).
    let redrawn = false
    for (const object of allObjects(this.canvas.getObjects())) if (object !== this.shapeText.shape && redrawOutline(object)) redrawn = true
    if (redrawn) this.canvas.requestRenderAll()
    this.followConnectors()
    this.history.push(this.serialize(), mergeKey)
    this.emit()
  }

  private async restore(state: string, asStart = false): Promise<void> {
    this.cells.finish()
    this.shapeText.finish()
    this.iconText.finish()
    // Undo and redo keep what was selected, as far as it is still there, so its panels stay open.
    const selected = this.canvas.getActiveObjects().flatMap((object) => layerProps(object).layerId ?? [])
    this.restoring = true
    this.canvas.discardActiveObject()
    try {
      await this.canvas.loadFromJSON(state, undefined, { signal: this.abort.signal })
    } catch (error) {
      // Closed while loading (React closes and reopens the screen in development).
      if (this.abort.signal.aborted) return
      throw error
    }
    if (this.abort.signal.aborted) return
    // Figures from before arrows could stick to things have objects without ids.
    for (const object of allObjects(this.canvas.getObjects())) {
      ;(object as Own).figureId ??= newId()
      // Icons saved in the CMYK preview (removed 2026-11-17) get their own colours back.
      if ((object as IconWithMode).colourMode === LEGACY_CMYK) showBaseColours(object)
    }
    // Only `locked` is saved; the handles it switches off follow from it.
    for (const object of this.canvas.getObjects()) {
      if (isLocked(object)) setLocked(object, true)
      applyShapeRules(object)
    }
    this.canvas.backgroundColor = '#ffffff'
    // Corner arrows stuck to a side take their way out from the objects again.
    this.followConnectors()
    this.canvas.requestRenderAll()
    this.restoring = false
    if (asStart) this.history = new History(this.serialize())
    else this.reselect(selected)
    this.emit()
    void this.loadTextFonts()
  }

  /** Select the objects with these layer ids again, after the page was reloaded from history. */
  private reselect(layerIds: string[]): void {
    const objects = this.canvas.getObjects().filter((object) => layerIds.includes(layerProps(object).layerId ?? ''))
    if (objects.length === 1 && objects[0]) this.canvas.setActiveObject(objects[0])
    else if (objects.length > 1) this.canvas.setActiveObject(new ActiveSelection(objects, { canvas: this.canvas }))
  }

  private state(): CanvasState {
    return {
      selection: this.selectionInfo(),
      layers: this.layers(),
      selectedLayerIds: this.canvas.getActiveObjects().flatMap((object) => layerProps(object).layerId ?? []),
      canUndo: this.history.canUndo,
      canRedo: this.history.canRedo,
      zoom: this.zoom,
      tool: this.tool,
      transforming: this.transforming,
      newText: this.newTextStyle(),
      nextShapeText: this.nextShapeText(),
      drawChoice: this.choice,
    }
  }

  private selectionInfo(): SelectionInfo | null {
    const { active, targets: objects } = this.selected()
    if (!active) return null
    // While typing in a shape, the panel shows the shape and the look of the text being typed.
    const typing = this.shapeText.shape === active ? this.selectedText() : undefined
    const first = objects[0] ?? active
    const typed = typing ?? asText(first)
    const kind: SelectionInfo['kind'] =
      objects.length > 1
        ? 'multiple'
        : first instanceof FigureGroup
          ? 'group'
          : first instanceof Line || first instanceof Connector
            ? 'line'
            : first instanceof IText
              ? 'text'
              : first instanceof TableObject
                ? 'table'
              : first instanceof ChartObject
                ? 'chart'
              : isIcon(first)
                ? 'icon'
                : 'shape'
    // A group shows the colours of its first part.
    const painted = paintedParts(objects)[0] ?? first
    return {
      kind,
      name: objects.length > 1 ? `${objects.length} objects` : objectName(first),
      count: objects.length,
      hasGroup: objects.some((object) => object instanceof FigureGroup),
      locked: objects.every(isLocked),
      bounds: active.getBoundingRect(),
      // An icon in greyscale shows the colour it has in RGB, the one the colour field changes.
      fill: kind === 'icon' ? iconMainColour(baseIconColours(first), iconIdOf(first)) : colour(painted.fill),
      ...(kind === 'icon' && { colourMode: colourModeOf(first) }),
      ...(kind === 'icon' && objects.length === 1 && { slot: slotInfo(first) ?? null }),
      ...(kind === 'icon' && objects.length === 1 && typeof (first as FabricObject & { iconId?: unknown }).iconId === 'string' && { iconId: (first as FabricObject & { iconId: string }).iconId }),
      stroke: colour(painted.stroke),
      strokeWidth: painted.strokeWidth,
      text: typing ? this.drawnTextStyle(typing) : kind === 'text' ? textStyleOf(first) : kind === 'shape' ? (labelStyleOf(first) ?? this.emptyLabelStyle(first)) : undefined,
      textRange: typed !== undefined && typed.isEditing && typed.selectionStart !== typed.selectionEnd,
      ...(typing && { typingInShape: true }),
      ...(this.textPickedIn() === first && { textPicked: true }),
      textRangeBounds: typed && selectedCharsBox(typed),
      opacity: first.opacity,
      left: active.left,
      top: active.top,
      // Without the line around it, so typed sizes and shown sizes agree.
      width: active.width * active.scaleX,
      height: active.height * active.scaleY,
      ...(kind === 'chart' && first instanceof ChartObject && { chart: first.chart }),
      // Text beside a bracket never wraps or shrinks, so brackets have no text fit.
      ...(kind === 'shape' && textShapeOf(first) && !OUTSIDE_TEXT.has(kindOf(first) ?? 'rectangle') && { textFit: textFitOf(first) }),
      ...(kind === 'shape' && kindOf(first) !== undefined && { shapeKind: kindOf(first) }),
      ...(kind === 'shape' && cornerRadiusOf(first) !== undefined && { cornerRadius: cornerRadiusOf(first) }),
      ...(kind === 'table' && first instanceof TableObject && { ...this.tableColours(first), table: tableInfo(first) }),
      ...(kind === 'line' && first instanceof Connector && { arrowLook: first.look }),
    }
  }

  private emit(): void {
    const state = this.state()
    for (const listener of this.listeners) listener(state)
  }
}

/** What the properties panel shows for a table and its picked cells. */
function tableInfo(object: TableObject): TableInfo {
  const t = object.table
  const range = object.cellRange
  const first = shownCell(t, range)
  return {
    look: t.look,
    layout: layoutOf(t),
    borders: t.borders,
    header: t.header,
    fontSize: t.fontSize,
    fontFamily: t.fontFamily ?? DEFAULT_FONT.name,
    align: first?.align ?? 'left',
    bold: first?.bold ?? false,
    colWidth: t.colWidths.at(range?.c0 ?? 0) ?? 0,
    rowHeight: t.rowHeights.at(range?.r0 ?? 0) ?? 0,
    picked: range !== undefined,
    canMerge: range !== undefined && (range.r0 !== range.r1 || range.c0 !== range.c1),
    canUnmerge: hasMerge(t, range ?? wholeTable(t)),
  }
}

/** Colour changes on a table: fill goes onto the picked cells (all cells when none are picked), line colour and width onto its lines. */
function paintTable(object: TableObject, paint: Pick<StyleChange, 'fill' | 'stroke' | 'strokeWidth'>): void {
  let t = object.table
  const range: CellRange = object.cellRange ?? wholeTable(t)
  if (paint.fill !== undefined) t = styleCells(t, range, { fill: paint.fill })
  if (paint.stroke !== undefined) t = { ...t, lineColour: paint.stroke }
  if (paint.strokeWidth !== undefined) t = { ...t, lineWidth: paint.strokeWidth }
  if (t !== object.table) object.setTable(t)
}

/** The object as a text box, if it is one (Fabric's `instanceof` loses the text's types). */
const asText = (object: FabricObject): IText | undefined => (object instanceof IText ? (object as IText) : undefined)

/** The look of the text a shape holds, at the size it's drawn, while it isn't being typed in. */
const labelStyleOf = (object: FabricObject): TextStyle | undefined => {
  const text = labelText(object)
  if (!text) return undefined
  const style = readTextStyle(text)
  return { ...style, size: Math.round(style.size * labelScale(object) * 100) / 100 }
}

const textStyleOf = (object: FabricObject): TextStyle | undefined => {
  const text = asText(object)
  return text && readTextStyle(text)
}

/** A text box's starting look: Inter, in the given size and colour. */
const toFabricText = ({ left, top, fontSize, fill }: { left?: number; top?: number; fontSize?: number; fill?: string }) => ({
  left,
  top,
  fontSize: fontSize ?? 16,
  fill: fill ?? '#1f2937',
  fontFamily: fontStack(DEFAULT_FONT),
})

/** The opacity and text fit a new shape starts with, from the Shapes panel. */
function withExtras(object: FabricObject, { opacity, textFit }: { opacity?: number; textFit?: TextFit }): FabricObject {
  if (opacity !== undefined && opacity !== 1) object.set({ opacity })
  if (textFit && textFit !== DEFAULT_TEXT_FIT && textShapeOf(object)) Object.assign(object, { textFit })
  return object
}

function toFabric(spec: ShapeSpec): FabricObject {
  switch (spec.kind) {
    case 'rectangle': {
      const { left, top, width, height, fill, stroke, strokeWidth } = spec
      // With round corners it's drawn as an outline, like the other shapes, so its corners stay round when resized.
      if (spec.cornerRadius) return toFabric({ ...spec, kind: 'path', shape: 'rectangle' })
      return withExtras(new Rect({ left, top, width, height, fill, stroke, strokeWidth }), spec)
    }
    case 'ellipse': {
      const { left, top, rx, ry, fill, stroke, strokeWidth } = spec
      return withExtras(new Ellipse({ left, top, rx, ry, fill, stroke, strokeWidth }), spec)
    }
    case 'line': {
      const { points, stroke, strokeWidth } = spec
      return new Line(points, { stroke, strokeWidth, strokeLineCap: 'round' })
    }
    case 'arrow': {
      const [x1, y1, x2, y2] = spec.points
      return Connector.between({ x: x1, y: y1 }, { x: x2, y: y2 }, spec.look, { stroke: spec.stroke, strokeWidth: spec.strokeWidth })
    }
    case 'path': {
      const { shape, left, top, fill, stroke, strokeWidth } = spec
      // A circle starts round, as big as the bigger side of a drag.
      const [width, height] = shape === 'circle' ? [Math.max(spec.width, spec.height), Math.max(spec.width, spec.height)] : [spec.width, spec.height]
      const open = OPEN_SHAPES.has(shape)
      const cornerRadius = CORNER_SHAPES.has(shape) ? (spec.cornerRadius ?? defaultCornerRadius(shape, width, height)) : undefined
      const drawn = open ? { d: shapePath(shape, width, height), scaleX: 1, scaleY: 1 } : outline(shape, width, height, cornerRadius)
      const path = new Path(drawn.d, { left, top, scaleX: drawn.scaleX, scaleY: drawn.scaleY, fill: open ? null : fill, stroke, strokeWidth, strokeLineCap: 'round', strokeLineJoin: 'round' })
      return withExtras(Object.assign(path, { shapeKind: shape }, cornerRadius !== undefined && { cornerRadius }), spec)
    }
    case 'text': {
      const { text, ...props } = spec
      return props.width === undefined ? new IText(text, toFabricText(props)) : new Textbox(text, { ...toFabricText(props), width: props.width })
    }
  }
}

/**
 * Copies get ids of their own. Arrows copied together with the objects they're
 * stuck to stick to the copies; stuck to anything else, they come loose.
 */
function giveNewIds(objects: readonly FabricObject[]): void {
  const all = allObjects(objects)
  const renamed = new Map<string, string>()
  for (const object of all) {
    const id = newId()
    const old = idOf(object)
    if (old) renamed.set(old, id)
    ;(object as Own).figureId = id
  }
  for (const arrow of all.filter((object) => object instanceof Connector)) {
    const [start, end] = [arrow.attachStart && renamed.get(arrow.attachStart), arrow.attachEnd && renamed.get(arrow.attachEnd)]
    // A side stays only with an attachment that stays.
    arrow.set({
      attachStart: start,
      attachEnd: end,
      attachStartSide: start ? arrow.attachStartSide : undefined,
      attachEndSide: end ? arrow.attachEndSide : undefined,
    })
  }
}

const isLocked = (object: FabricObject) => (object as FabricObject & { locked?: boolean }).locked === true

/** A locked object can't be moved, resized or rotated, and shows no handles. */
function setLocked(object: FabricObject, locked: boolean): void {
  object.set({
    locked,
    lockMovementX: locked,
    lockMovementY: locked,
    lockScalingX: locked,
    lockScalingY: locked,
    lockRotation: locked,
    hasControls: !locked,
  })
}
