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

import { BRACKETS, CORNER_SHAPES, DOUBLE_BRACKETS, MAX_BEND, OPEN_SHAPES, SHAPES, defaultCornerRadius, headSize, routePoints, shapePath, type ArrowLook, type ShapeKind } from '@biofigure-lab/ui/lib/arrow-geometry'

import { DRAG_THRESHOLD_PX, HIT_TOLERANCE_PX, cornerCursor, distance, rotateCursor, distanceToPolygon, distanceToSegment, type XY } from './geometry'
import { History } from './history'
import { toHex } from './colour'
import { iconById, iconMainColour, isOnePencilColour, keepsColour, loadIconSvg, modeColour, recolourPart, tintColour, type ColourMode } from './icon-library'
import { resizedScale } from './resize'
import { mmToPx, PAGE_MARGIN_MM } from './units'
import { AngleTip } from './angle-tip'
import { DEFAULT_CHOICE, pressOnObject, shapeAt, shapeFromDrag, toolAfterPlacing, type DrawChoice, type ShapeSpec, type ShapeStyle, type Tool } from './shapes'
import { Connector, END_HANDLE_SIZE_PX, MOVE_END_ACTION, type ArrowEndSnapper } from './Connector'
import { DEFAULT_FONT, fontByName, fontStack, loadFontFace } from './fonts'
import { CARD_PROPERTIES, DEFAULT_FRAME_STYLE, IconCard, swapHeldIcon, bakeCardScale, captionStyle, cardCaptionText, cardIcon, relayoutCard, frameIcon, frameOf as cardFrameOf, holdIcon, holderSettings, isBareHolder, rebuildCard, sizeHolderInSelection, replaceCardIcon, styleSettings, unframe, type FrameSettings, type FrameStyle } from './icon-card'
import { type Block, emptyPanel } from './blocks'
import {
  CALLOUT_PROPERTIES,
  INSET_SIZE_RANGE,
  NEW_MARKER_SIZE,
  CalloutInset,
  CalloutLabels,
  CalloutMarker,
  bakeInsetScale,
  bakeMarkerScale,
  detachedInsetParts,
  detachedLabelParts,
  fitInsetContent,
  frozenCopy,
  insetOfMarker,
  insetSettingsOf,
  insetSizeOf,
  inCalloutArea,
  insetRoom,
  insetSpace,
  isCalloutLabel,
  labelParts,
  labelSettingsOf,
  labelTextLook,
  labelsBox,
  layOutLabels,
  makeLabel,
  markerOf,
  markerSizeOf,
  nextLabelPlace,
  partPoint,
  redrawInset,
  redrawMarker,
  type CalloutInfo,
  type InsetSettings,
  type LabelSettings,
} from './callout-block'
import { ABSTRACT_PROPERTIES, AbstractBlock, PARTS, abstractSettingsOf, emptyParts, emptySpaceFor, partMiddles, takeWidthFromScale, type AbstractSettings } from './abstract-block'
import { COMPARISON_PROPERTIES, ComparisonBlock, ComparisonSide, LOOK_BETWEEN, comparisonName, comparisonSettingsOf, styleSide, swapMoves, type ComparisonSettings } from './comparison-block'
import { IconSpace, NEW_SPACE_SIZE, SPACE_PROPERTIES, bakeSpaceScale, buildIconSpace, iconSpaceAt, resizeIconSpace, sizeSpaceInSelection, spaceBox, spaceSize, tintIconSpace } from './icon-space'
import { CONTENT_SPACE_PROPERTIES, ContentSpace, bakeContentScale, contentBox, contentSpaceName } from './content-space'
import { GRID_PROPERTIES, GridBlock, cellBox, cellsOf, setCellBox, applyCellResize, applyGridResize, applySpacesStretch, changeLayout, detachedGridShapes, drawGridOutlines, filledCells, gridUnder, fitGridToBox, gridSettingsOf, startCellResize, startGridResize, startSpacesStretch, syncLetters, updateGrid, type CellResize, type GridLayoutId, type GridResize, type GridSettings, type SpacesStretch } from './grid-block'
import { PANEL_PROPERTIES, PanelBlock, panelFill, contentsOf, descendantsOf, bakePanelScale, bodyOf, detachedShapes, resizePanel, setPanelBox, innerOf, panelAt, panelIdOf, setPanelId, settingsOf, updatePanel, withDescendants, type PanelSettings } from './panel-block'
import {
  DEFAULT_SEQUENCE,
  GAP_RANGE,
  LOOK_GAP,
  sequencePlan,
  SEQUENCE_PROPERTIES,
  SequenceBlock,
  buildSequence,
  detachedSequenceParts,
  layOutSequence,
  nextLabel,
  orderedSteps,
  sequenceBox,
  sequenceSettingsOf,
  type SequenceSettings,
} from './sequence-block'
import { canAddStep, familyOf, minSteps, newStepCorner } from './process-looks'
import { IconTextEditor, hasSlotText, hitsSlot, iconOriginFromSvg, needsIconOrigin, noteIconOrigin, refreshSlotText, setIconOrigin, slotInfo, startSlotText } from './icon-text'
import { applyTextStyle, drawnWeight, insertSymbol, readTextStyle, restoreText, snapshotText, textFaces, type TextSnapshot, type TextStyle } from './text-style'
import { ANCHOR_GAP, attachTargetAt, followEnds, sideNormal, sidePoint, straighten, type ConnectorEnd, type Frame, type Side as AnchorSide } from './connectors'
import { CellEditor } from './CellEditor'
import { DEFAULT_TEXT_FIT, OUTSIDE_TEXT, ShapeTextEditor, changeTextFit, fitWhileResizing, growToFit, hitsLabel, hitsBracketTextArea, hitsDoubleBracketArms, bracketTextArea, isShapeTextBox, labelBox, labelCorners, labelFromText, labelOf, labelScale, labelText, lookFor, restyleLabel, startingLabel, textFitOf, textOfLabel, textShapeOf, type ShapeLabel, type TextFit } from './shape-text'
import { ALL_HANDLES, CHART_HANDLE, ChartObject, measureText } from './ChartObject'
import { ChartLabelEditor } from './chart-label-editor'
import { DEFAULT_LETTERS, FIRST_SLIDE, lettersInfo, legacyLetters, readLetters, startIndexOf, type LetterContext, type LettersInfo, type SlideLetters } from './panel-letters'
import { chartSizeForPage, createChart, heightToFit, type ChartData, type ChartKind, type ErrorBars } from './chart-model'
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
import { TIMELINE_PROPERTIES, TimelineBlock, axisWidthFor, bakeTimelineScale, detachedTimelineParts, nextEvent, redrawTimeline, timelineBox, timelineSettingsOf, type TimelineEvent, type TimelineSettings } from './timeline-block'
import { LegendBlock, bakeLegendScale, detachedLegendParts, nextRow as nextLegendRow, sizeToFit, type LegendRow, type LegendSettings } from './legend-block'
import { PATHWAY_PROPERTIES, PATHWAY_WIDTH, PathwayBlock, SPREAD, insertIndex, pathwayPlan, pathwaySettingsOf, withStepAt, withoutSteps, type PathwaySettings } from './pathway-block'
import { WellPlate, wellsOnPlate, bakePlateScale, detachedPlateParts, resizedPlate, wellName, NEW_CONDITION_COLOURS, type PlateCondition, type PlateSettings, type WellCount } from './well-plate'

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
const OWN_PROPERTIES = ['name', 'iconId', 'layerId', 'locked', 'figureId', 'shapeKind', 'cornerRadius', 'label', 'textFit', 'growLimit', 'baseWeight', 'colourMode', 'baseColours', 'slotText', 'slotShown', 'iconOrigin', ...CARD_PROPERTIES, ...PANEL_PROPERTIES, ...SPACE_PROPERTIES, ...SEQUENCE_PROPERTIES, ...CONTENT_SPACE_PROPERTIES, ...GRID_PROPERTIES, ...COMPARISON_PROPERTIES, ...ABSTRACT_PROPERTIES, ...TIMELINE_PROPERTIES, ...CALLOUT_PROPERTIES, ...PATHWAY_PROPERTIES]

export class FigureGroup extends Group {
  static type = 'FigureGroup'
}
classRegistry.setClass(FigureGroup)

type Own = FabricObject & { figureId?: string; shapeKind?: ShapeKind }
/** The id arrows use to stick to an object. */
export const idOf = (object: FabricObject) => (object as Own).figureId

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

/** The callout blocks' own objects (BIO-97): a zoom inset, its marker, a labelled icon's look. */
const isCallout = (object: FabricObject) => object instanceof CalloutInset || object instanceof CalloutMarker || object instanceof CalloutLabels

/** Lines and arrows: you click on the line itself, not their whole box, until they're selected. */
const isLineLike = (object: FabricObject) => object instanceof Line || object instanceof Connector

/** Lines and open shapes (brackets, membranes) take a line colour but no fill. */
const isOpen = (object: FabricObject) => object instanceof Line || object instanceof Connector || OPEN_SHAPES.has((object as Own).shapeKind as ShapeKind)

/** The objects that get painted: what's inside groups, but icons stay whole. */
const paintedParts = (objects: readonly FabricObject[]): FabricObject[] =>
  objects.flatMap((object) => (object instanceof FigureGroup ? paintedParts(object.getObjects()) : [object]))

const isIcon = (object: FabricObject) => object instanceof Group && !(object instanceof FigureGroup) && !(object instanceof IconCard) && !(object instanceof PanelBlock) && !(object instanceof IconSpace) && !(object instanceof SequenceBlock) && !(object instanceof ContentSpace) && !(object instanceof TimelineBlock) && !isCallout(object)

/** The library icon an object is or holds: itself, or the icon inside a framed icon (BIO-73). */
const iconOf = (object: FabricObject): Group | undefined => (object instanceof IconCard ? cardIcon(object) : isIcon(object) ? (object as Group) : undefined)

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
  const icon = iconOf(object)
  if (icon) {
    if (paint.fill !== undefined) recolourIcon(icon, paint.fill)
    if (paint.fill !== undefined && icon !== object) icon.set({ dirty: true })
    return paint.fill === undefined ? {} : { dirty: true }
  }
  const { fill, stroke, strokeWidth } = paint
  if (object instanceof IText) return fill === undefined ? {} : { fill }
  const outline = { ...(stroke !== undefined && { stroke }), ...(strokeWidth !== undefined && { strokeWidth }) }
  if (isOpen(object)) return outline
  return { ...(fill !== undefined && { fill }), ...outline }
}

/**
 * What moves along with panels that are being moved (BIO-74): the objects
 * being moved themselves, where each moved panel's box started, and where
 * each object inside them (not moved itself) started.
 */
type Carry = {
  moved: ReadonlySet<FabricObject>
  panels: ReadonlyMap<Holder, XY>
  followers: ReadonlyMap<FabricObject, XY>
  skipped: ReadonlySet<FabricObject>
  /**
   * The dragged things that sit in a block not dragged along, with that
   * block's id: they can't leave it (only Detach takes a block apart), so a
   * drag that lets go of them anywhere else jumps back.
   */
  locked: ReadonlyMap<FabricObject, string>
  /** Where the dragged object (or selection) started, and how its arrows were stuck, to put it back. */
  start?: { target: FabricObject; left: number; top: number; arrows: ReadonlyMap<Connector, ArrowEnds> }
}
type ArrowEnds = Pick<Connector, 'attachStart' | 'attachStartSide' | 'attachEnd' | 'attachEndSide'>

/** A step's own size for trading sizes: an empty space's box without its outline (which doesn't grow with it), else its box. */
const stepSize = (step: FabricObject): { width: number; height: number } => (step instanceof IconSpace ? spaceBox(step) : plainBox(step))

/** What can hold other objects (they point at it with `panelId`): a panel, or a sequence holding its steps (BIO-75). */
type Holder = PanelBlock | SequenceBlock | CalloutInset | CalloutLabels
const isHolder = (object: FabricObject | undefined): object is Holder => object instanceof PanelBlock || object instanceof SequenceBlock || object instanceof CalloutInset || object instanceof CalloutLabels
/** A holder's own box on the page: a panel's box, or a sequence's or callout's whole area. */
const holderBox = (holder: Holder): PlainBox => (holder instanceof PanelBlock || holder instanceof SequenceBlock || holder instanceof CalloutLabels ? plainBox(holder) : drawnBox(holder))

/**
 * What moves freely in its block (BIO-97): a zoom marker, what a zoom inset
 * holds (the inset comes along), a labelled icon's labels and subject.
 * Dragging one never trades places or jumps back, and letting go of it never
 * puts it in another block.
 */
const freeInBlock = (object: FabricObject, holder: Holder | undefined): boolean => object instanceof CalloutMarker || holder instanceof CalloutLabels || holder instanceof CalloutInset

/**
 * Resizing an icon space (empty or filled) in a block (BIO-74): where it,
 * its panel and the other things in the panel (with what they hold) were
 * when the resize started, so the row can make room as it changes.
 */
type RowResize = { target: FabricObject; panel: PanelBlock; start: PlainBox; body: PlainBox; around: PlainBox; others: ReadonlyMap<FabricObject, { box: PlainBox; moves: ReadonlyMap<FabricObject, XY> }> }
type PlainBox = { x: number; y: number; width: number; height: number }

/**
 * Resizing a selection of several that holds icon spaces (BIO-74): their
 * sizes within it, its stretch and their boxes on the page when it started,
 * and the blocks they sit in, with the other things there and where they were.
 */
type SpacesInSelection = {
  selection: ActiveSelection
  sizes: ReadonlyMap<FabricObject, { width: number; height: number }>
  stretch: { x: number; y: number }
  boxes: ReadonlyMap<FabricObject, PlainBox>
  onlySpaces: boolean
  panels: readonly { panel: PanelBlock; body: PlainBox; around: PlainBox; contents: readonly FabricObject[]; others: ReadonlyMap<FabricObject, { box: PlainBox; moves: ReadonlyMap<FabricObject, XY> }> }[]
}

/** An icon that filled an empty icon space, keeping its box. */
const isHeldIcon = (object: FabricObject): object is IconCard => object instanceof IconCard && cardFrameOf(object).holder !== undefined

/** Where an object's box is on the page: a space's or panel's own box, else what Fabric draws around it. */
function plainBox(object: FabricObject): PlainBox {
  if (object instanceof IconSpace) return spaceBox(object)
  if (object instanceof PanelBlock) return bodyOf(object)
  if (object instanceof SequenceBlock) return sequenceBox(object)
  if (object instanceof CalloutLabels) return labelsBox(object)
  const rect = object.getBoundingRect()
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
}

/** What Fabric draws around an object on the page, also inside a selection of several. */
function drawnBox(object: FabricObject): PlainBox {
  const rect = object.getBoundingRect()
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
}

function unionOf(boxes: readonly PlainBox[]): PlainBox {
  const x = Math.min(...boxes.map((box) => box.x))
  const y = Math.min(...boxes.map((box) => box.y))
  return { x, y, width: Math.max(...boxes.map((box) => box.x + box.width)) - x, height: Math.max(...boxes.map((box) => box.y + box.height)) - y }
}

/** The selection-blue ring around the panel a dragged object would land in, in screen pixels. */
const DROP_RING = { colour: '#2563eb', width: 3 }

/** The round "+" handle that adds to a block (a sequence's step, a timeline's event). */
function drawPlus(ctx: CanvasRenderingContext2D, left: number, top: number): void {
  ctx.save()
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = DROP_RING.colour
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(left, top, 11, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.lineWidth = 1.75
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(left - 5, top)
  ctx.lineTo(left + 5, top)
  ctx.moveTo(left, top - 5)
  ctx.lineTo(left, top + 5)
  ctx.stroke()
  ctx.restore()
}
/** The white card a thing dragged within its block is lifted on (page pixels, except the shadow, in screen pixels). */
const LIFT_CARD = { padding: 8, radius: 10, shadow: 'rgba(15, 23, 42, 0.28)', blur: 18, offsetY: 6 }

/** A panel turns only with the page: no rotation handle (BIO-74). */
function panelRules(panel: PanelBlock): void {
  panel.set({ lockRotation: true })
  panel.setControlVisible('mtr', false)
}

/** An arrow or an empty icon space in a panel takes the panel's colour (BIO-74); other objects keep theirs. */
function tintArrow(object: FabricObject, colour: string): void {
  if (object instanceof Connector || object instanceof Arrow) object.set({ stroke: colour, dirty: true })
  if (object instanceof IconSpace) tintIconSpace(object, colour)
}

/** An icon space turns only with the page, like a panel. */
function spaceRules(space: IconSpace): void {
  space.set({ lockRotation: true })
  space.setControlVisible('mtr', false)
}

/** The frame style picked last, which the floating bar's Frame button adds (BIO-73); shared by every figure open in this tab. */
let lastFrameStyle: FrameStyle = DEFAULT_FRAME_STYLE

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
const SNAP_MARGIN_MM = PAGE_MARGIN_MM

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
    const own = routePoints({ x: object.x1, y: object.y1 }, { x: object.x2, y: object.y2 }, object.route, object.ownDirs(), object.bend)
    const path = own.map((p) => util.transformPoint(new Point(p.x, p.y), matrix))
    const nearest = Math.min(...path.slice(1).map((p, i) => distanceToSegment(point, path.at(i)!, p)))
    return Math.max(0, nearest - object.strokeWidth / 2 - (object.size.outline ?? 0))
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
  /** What a press last found inside a selected comparison (BIO-95): the press drags the whole block, and a click without a drag picks this. */
  pressedInComparison: FabricObject | undefined
  /** The pointer event `pressedInComparison` was found for. */
  pressedFor: TPointerEvent | undefined

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
    // The area between a zoom inset's marker and the inset picks the inset (and drags both, see startCarry) (BIO-97).
    if (object instanceof CalloutInset && inCalloutArea(object, markerOf(object, this._objects), point)) return true
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
    const info = super.findTarget(e)
    // Fabric looks more than once for the same press; only a new pointer event starts afresh.
    if (e !== this.pressedFor) {
      this.pressedInComparison = undefined
      this.pressedFor = e
    }
    // A handle of the selected object stays that object's (a comparison's side is resized by its own handles).
    const onHandle = active !== undefined && info.target === active && active.findControl(this.getViewportPoint(e)) !== undefined
    // A labelled icon moves as a whole; a click picks its parts (BIO-97).
    const labelled = info.target && !onHandle ? this.labelledTarget(info.target, e) : undefined
    const block = labelled ?? (info.target && !onHandle && this.blockFirst(info.target))
    return block ? { ...info, target: block, currentTarget: block } : info
  }

  /** The labelled icon an object is, or is a label or the icon of (BIO-97). */
  labelBlockAround(object: FabricObject): CalloutLabels | undefined {
    if (object instanceof CalloutLabels) return object
    const id = panelIdOf(object)
    return id ? this._objects.find((other): other is CalloutLabels => other instanceof CalloutLabels && idOf(other) === id) : undefined
  }

  /** The label or icon of a labelled icon under a page point, topmost first. */
  labelPartAt(block: CalloutLabels, point: Point): FabricObject | undefined {
    return contentsOf(block, this._objects)
      .toReversed()
      .find((object) => this._checkTarget(object, point))
  }

  /**
   * Pressing on a labelled icon (BIO-97): it moves as a whole, so a press
   * anywhere on it picks the block, also while the block is selected (a click
   * there without dragging then picks the label or icon, see FigureCanvas).
   * Only once one of its labels or its icon is selected does a press pick the
   * part under the pointer, to drag it on its own (owner's feedback, 2026-11-26).
   */
  private labelledTarget(target: FabricObject, e: TPointerEvent): FabricObject | undefined {
    const block = this.labelBlockAround(target)
    if (!block) return undefined
    const active = this._activeObject
    const working = active !== undefined && active !== block && !(active instanceof ActiveSelection) && this.labelBlockAround(active) === block
    if (!working) return block
    return this.labelPartAt(block, this.getScenePoint(e)) ?? block
  }

  /**
   * An empty icon space in a block that isn't being worked on picks the
   * block instead (BIO-74): the first click selects the block, and only with
   * the block (or something in it) selected does a click pick the space.
   */
  private blockFirst(target: FabricObject): Holder | undefined {
    const id = panelIdOf(target)
    // A zoom marker is grabbed and moved on its own (BIO-97).
    if (!id || target instanceof CalloutMarker) return undefined
    const holder = this._objects.find((object): object is Holder => isHolder(object) && idOf(object) === id)
    // A comparison (BIO-95) is picked first by a click on anything in it; once something in it is picked, clicks go straight to what is under them.
    const outer = holder instanceof ComparisonBlock || holder instanceof AbstractBlock ? holder : holder && this._objects.find((object): object is ComparisonBlock => object instanceof ComparisonBlock && idOf(object) === panelIdOf(holder))
    if (outer) {
      const active = this._activeObject
      const picked = active instanceof ActiveSelection ? active.getObjects() : active ? [active] : []
      const family = new Set([outer, ...descendantsOf(outer, this._objects)])
      if (!picked.some((object) => family.has(object))) return outer
      // Once it or something in it is picked, a press still drags the whole block: its sides don't trade places by dragging,
      // which was confusing (owner's feedback, 2026-11-26). A click without a drag picks what is under the pointer (`pressedInComparison`).
      // The picked thing itself stays grabbable (a space waiting for an icon, double-clicks), except a side, which would drag on its own.
      if (target === active && !(target instanceof ComparisonSide)) return undefined
      this.pressedInComparison = target
      return outer
    }
    // In a panel only empty spaces wait for the block; every step of a sequence does (BIO-75).
    // A figure grid's empty chart spaces too (BIO-86).
    if (!holder || (holder instanceof PanelBlock && !(target instanceof IconSpace || target instanceof ContentSpace))) return undefined
    const active = this._activeObject
    // Something in the block is selected, alone or among several (spaces picked with Shift).
    const picked = active instanceof ActiveSelection ? active.getObjects() : active ? [active] : []
    const inside = picked.some((object) => idOf(object) === id || panelIdOf(object) === id || object === target)
    if (inside) return undefined
    // A step in a sequence that sits in a panel: the sequence first, then its steps.
    return holder
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
  kind: 'shape' | 'line' | 'text' | 'icon' | 'group' | 'table' | 'chart' | 'panel' | 'space' | 'sequence' | 'timeline' | 'callout' | 'chart-space' | 'plate' | 'legend' | 'multiple'
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
  /** For one icon: its frame's settings and caption (BIO-73), or null when it has no frame. */
  frame?: (FrameSettings & { captionText: string; captionStyle: TextStyle }) | null
  /** For one icon in a block's space (it keeps the space's box): it can be swapped for another icon (replaceHeldIcon). */
  heldIcon?: boolean
  /** For one icon with a text slot: the text typed for it and whether it shows; null for an icon without a slot. */
  slot?: { text: string; shown: boolean } | null
  /** For one shape: which one from the Shapes panel (also for rectangles and ellipses from their own tools). */
  shapeKind?: ShapeKind
  /** For one shape with straight sides: how round its corners are, in page pixels. */
  cornerRadius?: number
  /** For one panel (BIO-74): its settings and what it holds directly, the top one first. */
  panel?: PanelSettings & { contents: PanelContent[] }
  /** For one figure grid (BIO-86): its settings, how many cells it has and how many hold something. */
  grid?: GridSettings & { cells: number; filled: number }
  /** For one panel or figure grid: the slide's letter settings and numbering, which they share (BIO-83). */
  letters?: LettersInfo
  /** For one sequence (BIO-75): its settings and how many steps it has. */
  sequence?: SequenceSettings & { steps: number }
  /** For one pathway cascade (BIO-105), also a sequence: its own settings (its step names are the sequence's labels). */
  pathway?: PathwaySettings
  /** A selected zoom inset (or its marker) or labelled icon (BIO-97). */
  callout?: CalloutInfo
  /** For one experiment timeline (BIO-96): its settings. */
  timeline?: TimelineSettings
  /** For one comparison (BIO-95), or one of its sides: its settings and its sides' titles, left to right. */
  comparison?: ComparisonSettings & { titles: string[] }
  /** For one graphical abstract (BIO-107): its settings. */
  abstract?: AbstractSettings
  /** For one well plate (BIO-98): its settings, and the condition being painted with (null: emptying wells; undefined: not painting). */
  plate?: PlateSettings & { brush: string | null | undefined }
  /** For one legend (BIO-106): its settings. */
  legend?: LegendSettings
  /** For several selected objects: whether they can be made into a row (Make a row, BIO-75). */
  canMakeRow?: boolean
  /** For one arrow: its path, line and ends. */
  arrowLook?: ArrowLook
  /** For one curved arrow: the bow it really has (its own or the automatic one), as a share of its length. */
  arrowBend?: number
  /** For one arrow: its outline colour (none: no outline) and width. */
  arrowStyle?: ArrowStyle
}

/** An arrow's outline (see `FigureCanvas.setArrowStyle`). */
export type ArrowStyle = { outline?: string | undefined; outlineWidth: number }
/** A change to the selected arrows' look: their outline, and with a preset their colour too. */
export type ArrowStyleChange = Partial<ArrowStyle> & { colour?: string }

/** How wide an arrow's outline starts when one is picked: a tenth of its thickness, at least 1 px. */
export const defaultArrowOutline = (strokeWidth: number) => Math.max(1, Math.round(strokeWidth / 10))

/** One object a panel holds, for its Contents list; `id` is its layer id (select it with `selectLayer`). */
export type PanelContent = { id: string; name: string; kind: LayerItem['kind'] }

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
  if (object instanceof PanelBlock) return settingsOf(object).title.trim() || 'Panel'
  if (object instanceof IconSpace) return 'Empty icon space'
  if (object instanceof ContentSpace) return contentSpaceName(object)
  if (object instanceof ComparisonBlock) return comparisonName(object)
  if (object instanceof AbstractBlock) return 'Graphical abstract'
  if (object instanceof TimelineBlock) return 'Experiment timeline'
  if (object instanceof PathwayBlock) return 'Pathway'
  if (object instanceof SequenceBlock) return { sequence: 'Sequence', cycle: 'Cycle', branch: 'Branching' }[familyOf(sequenceSettingsOf(object).look)]
  if (object instanceof WellPlate) return 'Well plate'
  if (object instanceof LegendBlock) return 'Legend'
  if (object instanceof CalloutLabels) return 'Labelled icon'
  if (object instanceof CalloutInset) return 'Zoom inset'
  if (object instanceof CalloutMarker) return 'Zoom marker'
  return 'Object'
}

/** What we keep on each object for the layers panel (saved with it). */
type LayerProps = { layerId?: string }
const layerProps = (object: FabricObject) => object as FabricObject & LayerProps

let nextLayerId = 0
const newLayerId = () => `layer-${Date.now().toString(36)}-${(nextLayerId++).toString(36)}`

const layerKind = (object: FabricObject): LayerItem['kind'] =>
  object instanceof FigureGroup || object instanceof SequenceBlock || object instanceof TimelineBlock || object instanceof CalloutLabels || object instanceof LegendBlock ? 'group'
    : object instanceof TableObject || object instanceof WellPlate ? 'table'
    : object instanceof ChartObject || object instanceof ContentSpace ? 'graph'
    : isIcon(object) || object instanceof IconCard || object instanceof IconSpace ? 'icon'
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
  /** Where the last press was on the page: a zoom inset grabbed between its marker and itself takes the marker along. */
  private pressPoint: XY | undefined
  /** A press on a selected labelled icon, over one of its labels or its icon: picked if let go without dragging. */
  private labelPress: { part: FabricObject; x: number; y: number } | undefined
  /** The last tap with a finger, to tell a double tap (see `onPointerUp`). */
  private lastTap: { target: FabricObject; at: number } | undefined
  /** A selected shape whose text was clicked once: the Text tab then styles that text (see `onPointerUp`). */
  private pickedText: FabricObject | undefined
  /** A text just placed, its words selected so typing replaces them; that isn't a highlight the user made, so it gets no highlight bar (BIO-82). */
  private freshText: IText | undefined
  /** A drag over a table's cells that picks a block of them, from the cell it started on. */
  /** A press over picked cells; `again` when it was on the one cell already picked, so a click (no drag) lets go of it. */
  private cellDrag: { table: TableObject; anchor: { r: number; c: number }; again?: boolean } | undefined
  /** The well plate being painted and the condition its wells get (null: emptied), while a condition is picked in its properties (BIO-98). */
  private plateBrush: { plate: WellPlate; id: string | null } | undefined
  /** A box being dragged over a plate's wells, from the well pressed to the one under the pointer. */
  private plateDrag: { plate: WellPlate; from: { r: number; c: number }; to: { r: number; c: number } } | undefined
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
  private readonly chartLabel: ChartLabelEditor
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
  /** While panels move (dragged, aligned, typed): what moves along with them, from where (BIO-74). */
  private carry: Carry | undefined
  /** While objects are dragged: the panel they would land in, ringed in blue (BIO-74). */
  private dropPanel: Holder | undefined
  /** While dragging one thing in a block: the slot it would trade places with, ringed. */
  private swapTarget: FabricObject | undefined
  /** An icon space in a block being resized: its row makes room (BIO-74). */
  private rowResize: RowResize | undefined
  /** Icon spaces (empty or filled) in a selection of several being resized, with their sizes within it when it started. */
  private spacesInSelection: SpacesInSelection | undefined
  /** A figure grid, or one of its cells, being resized: the cells make room (BIO-86). Content spaces resized among several. */
  private gridResize: GridResize | CellResize | undefined
  private spacesStretch: SpacesStretch | undefined
  /** The figure grid under the pointer, its outline in selection blue (BIO-86). */
  private hoverGrid: GridBlock | undefined
  /** The slide's letter settings once set or read from the saved slide (BIO-83); saved with the slide. */
  private lettersSet: SlideLetters | undefined
  /** What a slide with no saved settings uses: the look of its first grid (figures from before BIO-83), else the defaults. */
  private lettersFallback: SlideLetters = DEFAULT_LETTERS
  /** Where this slide sits among the slides, which says where "Go on" starts its letters. */
  private letterContext: LetterContext = FIRST_SLIDE
  /** A press inside a selected comparison, which picks what it was on if it doesn't become a drag (BIO-95). */
  private comparisonClick: { object: FabricObject; x: number; y: number } | undefined
  /** The empty icon space an icon dragged from the Icons panel is over, ringed like a selected one. */
  private hoverSpace: IconSpace | undefined
  /** Text being highlighted by a drag with the Text tool, and where the drag started in it. */
  private textSelecting: { text: IText; anchor: number } | undefined
  /** A screen update waiting for the next frame (see `emitSoon`). */
  private emitFrame: number | undefined
  /** What the screen was last told, to hand back unchanged parts as the same objects (see `state`). */
  private lastState: CanvasState | undefined

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
    this.canvas.snapArrowEnd = (point, arrow, e, end) => this.snapArrowEnd(point, arrow, e, end)
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
    this.chartLabel = new ChartLabelEditor(this.canvas, (chart, data) => {
      chart.setChart(data)
      this.canvas.requestRenderAll()
      this.commit()
    })

    const changed = () => this.emit()
    // A turned arrow's box squares up around it once it's no longer selected.
    const squareUp = ({ deselected }: { deselected: FabricObject[] }) => {
      for (const object of deselected) if (object instanceof Connector) object.squareUp()
      // Letting go of a plate stops painting it (BIO-98).
      if (this.plateBrush && deselected.includes(this.plateBrush.plate)) this.setPlateBrush(undefined)
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
      if (this.carry) this.applyCarry(this.carry)
      // A labelled icon's lines follow its labels and subject while they are dragged (BIO-97).
      this.calloutsFollow(event.target)
      this.findDropPanel(event.e)
      this.followConnectors()
      this.transforming = true
      this.emitSoon()
    })
    this.canvas.on('object:rotating', ({ e, target }) => {
      this.showAngle(e, target)
      this.followConnectors()
      this.transforming = true
      this.emitSoon()
    })
    this.canvas.on('object:resizing', () => this.followConnectors())
    this.canvas.on('before:transform', ({ transform }) => {
      // Panels carry what they hold along; the objects being dragged can land in another panel.
      this.carry = transform.action === 'drag' ? this.startCarry(transform.target instanceof ActiveSelection ? transform.target.getObjects() : [transform.target], transform.target) : undefined
      this.dropPanel = undefined
      this.swapTarget = undefined
      this.rowResize = transform.action?.startsWith('scale') ? this.startRow(transform.target) : undefined
      this.spacesInSelection = transform.action?.startsWith('scale') && transform.target instanceof ActiveSelection ? this.startSpacesInSelection(transform.target) : undefined
      const scaling = transform.action?.startsWith('scale') === true
      this.gridResize = scaling ? (startGridResize(transform.target, this.canvas.getObjects()) ?? startCellResize(transform.target, this.canvas.getObjects())) : undefined
      this.spacesStretch = scaling && transform.target instanceof ActiveSelection ? startSpacesStretch(transform.target) : undefined
    })
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
    // A click (no drag) inside a selected comparison picks what was under the pointer (BIO-95).
    this.canvas.on('mouse:down', ({ e, scenePoint }) => {
      const pressed = this.canvas.pressedFor === e ? this.canvas.pressedInComparison : undefined
      this.comparisonClick = pressed && { object: pressed, x: scenePoint.x, y: scenePoint.y }
    })
    this.canvas.on('mouse:up', ({ scenePoint }) => {
      const click = this.comparisonClick
      this.comparisonClick = undefined
      if (!click || Math.hypot(scenePoint.x - click.x, scenePoint.y - click.y) > 3 / this.zoom || !this.canvas.getObjects().includes(click.object)) return
      this.canvas.setActiveObject(click.object)
      this.canvas.requestRenderAll()
      this.emit()
    })
    this.canvas.on('mouse:up', ({ e }) => {
      const pressed = this.labelPress
      this.labelPress = undefined
      if (pressed) {
        const at = this.canvas.getViewportPoint(e)
        if (Math.hypot(at.x - pressed.x, at.y - pressed.y) < DRAG_THRESHOLD_PX && this.canvas.getObjects().includes(pressed.part)) {
          this.canvas.setActiveObject(pressed.part)
          this.canvas.requestRenderAll()
          this.emit()
        }
      }
      this.angleTip.hide()
      this.endSnapping()
      this.rowResize = undefined
      this.spacesInSelection = undefined
      if (this.carry || this.dropPanel || this.swapTarget) {
        this.carry = undefined
        this.dropPanel = undefined
        this.swapTarget = undefined
        this.canvas.requestRenderAll()
      }
      // A table's column or row tab picks cells on press, without a change to save.
      if (this.activeTable()) this.emit()
      if (!this.transforming) return
      this.transforming = false
      this.emit()
    })
    this.canvas.on('after:render', ({ ctx }) => {
      this.drawGuides(ctx)
      this.drawDropRing(ctx)
      this.drawLifted(ctx)
      // Figure grids show where they end (BIO-86).
      if (ctx === this.canvas.getContext()) drawGridOutlines(ctx, this.canvas.getObjects(), this.zoom, this.hoverGrid, new Set(this.canvas.getActiveObjects()))
      this.drawWaitingSpace(ctx)
      this.drawPickedText(ctx)
      this.drawAnchors(ctx)
    })
    this.canvas.on('object:scaling', ({ e, target, transform }) => {
      this.snapWhileResizing(e, target, transform)
      // A table takes the stretch into its columns and rows right away, so its text and lines keep their size while dragging.
      if (target instanceof TableObject || target instanceof ChartObject) target.bakeScale()
      // An arrow's box handles move its ends; its line and heads keep their thickness (BIO-91).
      if (target instanceof Connector) target.bakeScale(transform.originX as string, transform.originY as string)
      // A framed icon is laid out again as it is dragged, so its caption and padding never stretch.
      if (target instanceof IconCard) bakeCardScale(target, transform.originX as 'left', transform.originY as 'top', transform.corner)
      // So is a panel: its title, header and padding never stretch, and what it holds isn't scaled.
      if (target instanceof PanelBlock) bakePanelScale(target, transform.originX as 'left', transform.originY as 'top')
      if (target instanceof IconSpace) bakeSpaceScale(target, transform.originX as 'left', transform.originY as 'top')
      // A zoom inset and its marker too, and a labelled icon draws its lines again round its resized subject (BIO-97).
      this.calloutScaling(target, transform.originX as 'left', transform.originY as 'top')
      // A timeline lengthens its axis; markers and text keep their size (BIO-96).
      if (target instanceof TimelineBlock) bakeTimelineScale(target, transform.originX as 'left')
      // A graphical abstract takes the stretch into its width; its parts spread out, nothing stretches (BIO-107).
      if (target instanceof AbstractBlock) this.resizeAbstract(target, transform.originX as 'left')
      // A pathway gets wider or narrower; its steps and text keep their size (BIO-105).
      if (target instanceof PathwayBlock) this.pathwayScaling(target, transform.originX as string)
      // A well plate's wells spread out or close up; its text keeps its size (BIO-98).
      if (target instanceof WellPlate) bakePlateScale(target, transform.originX as 'left', transform.originY as 'top')
      // A legend's text, markers and gaps grow together (BIO-106).
      if (target instanceof LegendBlock) bakeLegendScale(target, transform.originX as 'left', transform.originY as 'top')
      // A chart space too; in a figure grid, the other cells make room, or fill the grid's new box (BIO-86).
      if (target instanceof ContentSpace) bakeContentScale(target, transform.originX as 'left', transform.originY as 'top')
      if (this.gridResize && 'cells' in this.gridResize && this.gridResize.grid === target) applyGridResize(this.gridResize, this.canvas.getObjects())
      if (this.gridResize && 'target' in this.gridResize && this.gridResize.target === target) applyCellResize(this.gridResize, this.canvas.getObjects())
      if (this.spacesStretch?.selection === target) applySpacesStretch(this.spacesStretch)
      // So is an icon in a space's box; in a block, the row makes room as it grows or shrinks.
      if (this.rowResize?.target === target) this.applyRow(this.rowResize)
      // A step of a sequence stays where Fabric puts it; the other steps and the look move round it (BIO-75).
      this.layOutAround(target)
      // Icon spaces in a selection of several take the stretch into their size, never stretching.
      if (this.spacesInSelection?.selection === target) this.sizeSpacesInSelection(this.spacesInSelection, transform.originX as string, transform.originY as string)
      // A double bracket's brackets stay at its edges, as deep as before.
      keepBracketArms(target)
      // A shape with text stays big enough for it while dragging.
      fitWhileResizing(target, transform)
      this.followConnectors()
      this.transforming = true
      this.emitSoon()
    })
    this.canvas.on('object:modified', ({ target, action }) => {
      // A click on an arrow that never became a drag changes nothing and leaves no undo step.
      const gate = this.dragGate
      this.dragGate = undefined
      if (action === 'drag' && gate && gate.arrow === target && !gate.passed) return
      if (action === MOVE_END_ACTION && target instanceof Connector) this.stickEnds(target)
      if (target instanceof ChartObject) target.bakeScale()
      if (target instanceof IconCard) bakeCardScale(target, 'center', 'center')
      if (target instanceof PanelBlock) bakePanelScale(target)
      if (target instanceof IconSpace) bakeSpaceScale(target)
      if (target instanceof TimelineBlock) bakeTimelineScale(target)
      if (target instanceof AbstractBlock) this.resizeAbstract(target)
      if (target instanceof PathwayBlock) this.pathwayScaling(target, 'left')
      if (target instanceof WellPlate) bakePlateScale(target)
      if (target instanceof LegendBlock) bakeLegendScale(target)
      // Dropped objects belong to the panel or sequence they were let go over, or to the page.
      // What sits in a block stays in its slots until the block is detached: it trades places, or jumps back.
      if (action === 'drag' && this.carry && this.carry.locked.size > 0) this.tradePlaces(this.carry, this.swapTarget)
      else if (action === 'drag' && this.carry) this.dropInto(this.carry, this.dropPanel)
      // A resized or turned step: its sequence lines up again round it.
      else if (target) this.layOutAround(target)
      // Spaces resized together are selected again afresh, so the selection's box fits them.
      if (target instanceof ActiveSelection && this.spacesInSelection?.selection === target) {
        this.spacesInSelection = undefined
        this.reselectSpaces(target)
      }
      // A shape made narrower grows taller again if its text no longer fits.
      if (target && growToFit(target)) this.followConnectors()
      if (target instanceof TableObject) {
        target.bakeScale()
        target.finishDrag()
      }
      this.commit()
    })
    this.canvas.on('text:editing:exited', () => {
      this.freshText = undefined
      this.commit()
    })
    this.canvas.on('text:changed', ({ target }) => {
      this.freshText = undefined
      // A label's line and chip follow its text as it is typed (BIO-97).
      this.calloutsFollow(target)
    })
    // The text panels show the look of the characters under the text cursor.
    this.canvas.on('text:selection:changed', () => this.emit())
    // Fabric ends text editing as soon as a click lands elsewhere, before
    // 'mouse:down', so the text tool needs to know what was being typed first.
    this.canvas.on('mouse:down:before', ({ e }) => {
      const active = this.canvas.getActiveObject()
      this.activeBeforeClick = active
      this.pressPoint = this.canvas.getScenePoint(e)
      // A press on a selected labelled icon moves it whole; let go without dragging, it picks the label or icon under the pointer (BIO-97).
      const part = active instanceof CalloutLabels ? this.canvas.labelPartAt(active, new Point(this.pressPoint.x, this.pressPoint.y)) : undefined
      const press = this.canvas.getViewportPoint(e)
      this.labelPress = part && { part, x: press.x, y: press.y }
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
        if (text) {
          this.chartLabel.start(target, text)
          this.emit()
        }
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
    // The figure grid under the pointer shows its outline in blue (BIO-86).
    this.canvas.on('mouse:over', ({ target }) => this.lightGrid(gridUnder(target, this.canvas.getObjects())))
    this.canvas.on('mouse:out', () => this.lightGrid(undefined))
    // Every object gets its own id, so the layers panel can point at it.
    // Copies arrive with the original's id and get a new one.
    this.canvas.on('object:added', ({ target }) => {
      this.prepareLayer(target)
      if (target instanceof PanelBlock) panelRules(target)
      if (target instanceof IconSpace) spaceRules(target)
      if (target instanceof SequenceBlock) this.sequenceRules(target)
      this.calloutRules(target)
      if (target instanceof TimelineBlock) this.timelineRules(target)
      if (target instanceof LegendBlock) this.legendRules(target)
    })

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
    const data = this.canvas.toObject(OWN_PROPERTIES) as Record<string, unknown>
    // The slide's letter settings sit beside its objects, as one extra key (BIO-83).
    if (this.lettersSet) data.letters = this.lettersSet
    return JSON.stringify(data)
  }

  /** The slide's letter settings now (BIO-83). */
  get letters(): SlideLetters {
    return this.lettersSet ?? this.lettersFallback
  }

  /** Change the look or numbering of every letter on the slide at once: one undo step; `mergeKey` joins quick changes (the size slider) into one. */
  setSlideLetters(change: Partial<SlideLetters>, mergeKey?: string): void {
    const next = readLetters({ ...this.letters, ...change })
    if (!next || JSON.stringify(next) === JSON.stringify(this.letters)) return
    this.lettersSet = next
    this.canvas.requestRenderAll()
    this.commit(mergeKey)
  }

  /**
   * Tell the canvas where the slide on it sits among the slides (see
   * `letterContexts`). A new start letters the slide again, without an undo
   * step of its own.
   */
  setLetterStart(context: LetterContext): void {
    if (JSON.stringify(context) === JSON.stringify(this.letterContext)) return
    this.letterContext = context
    if (this.relabel()) {
      this.followConnectors()
      this.canvas.requestRenderAll()
    }
    this.emit()
  }

  /** What the properties panels show of the slide's letters (BIO-83). */
  private lettersState(): LettersInfo {
    return lettersInfo(this.letters, this.letterContext)
  }

  /** Give every letter on the slide its text again; says whether anything changed. */
  private relabel(): boolean {
    return syncLetters(this.canvas.getObjects(), this.letters, startIndexOf(this.letters, this.letterContext))
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
    const shape = active && isShapeTextBox(active) && !letGo ? (this.shapeText.shape ?? this.iconText.icon ?? this.chartLabel.chart) : undefined
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

  /**
   * Set how far the selected curved arrows bow (share of length, negative to
   * the other side), or `undefined` for the automatic bow. Drags merge into
   * one undo step.
   */
  setArrowBend(bend: number | undefined): void {
    const arrows = this.canvas.getActiveObjects().filter((object): object is Connector => object instanceof Connector && !object.group)
    if (arrows.length === 0) return
    for (const arrow of arrows) arrow.setLook({ bend: bend === undefined ? undefined : Math.max(-MAX_BEND, Math.min(MAX_BEND, bend)) })
    this.canvas.requestRenderAll()
    this.commit('bend')
  }

  /**
   * Set the selected arrows' outline: a colour, or `undefined` for none, and
   * its width; a preset sets their colour too, in the same step. An outline
   * picked with no width gets one to suit the arrow's thickness. Drags merge
   * into one undo step.
   */
  setArrowStyle(change: ArrowStyleChange): void {
    const arrows = this.canvas.getActiveObjects().filter((object): object is Connector => object instanceof Connector && !object.group)
    if (arrows.length === 0) return
    for (const arrow of arrows) {
      const [a, b] = arrow.pagePoints()
      if (change.colour) arrow.set({ stroke: change.colour })
      if ('outline' in change) arrow.set({ outline: change.outline })
      if (change.outlineWidth !== undefined) arrow.set({ outlineWidth: Math.max(0, change.outlineWidth) })
      if (arrow.outline && !(arrow.outlineWidth! > 0)) arrow.set({ outlineWidth: defaultArrowOutline(arrow.strokeWidth) })
      // The box fits round the outline again.
      arrow.setPagePoints(a, b)
    }
    this.canvas.requestRenderAll()
    // Each setting merges only with itself, so a width drag is one step and a new outline colour another.
    this.commit(`arrowStyle:${Object.keys(change).sort().join(',')}`)
  }

  /** Point the selected arrows the other way by swapping their two ends' heads, as one undo step (BIO-82). */
  reverseArrows(): void {
    const arrows = this.canvas.getActiveObjects().filter((object): object is Connector => object instanceof Connector && !object.group)
    if (arrows.length === 0) return
    for (const arrow of arrows) arrow.setLook({ start: arrow.endEnd, end: arrow.startEnd })
    this.canvas.requestRenderAll()
    this.commit()
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
   *
   * With `fit` (a test picked, data put in), a chart whose brackets would
   * squash its plot grows just enough, at most the page's height: downward
   * first, and when the page's bottom stops it, it moves up (never past the
   * page's top). A chart that grew this way shrinks back towards its own
   * height (and spot) when its brackets need less room. Same undo step.
   * Returns the height it had before when it grew.
   */
  updateChart(change: (chart: ChartData) => ChartData, save = true, mergeKey?: string, fit = false): number | undefined {
    const chart = this.activeChart()
    if (!chart) return undefined
    let next = change(chart.chart)
    let grewFrom: number | undefined
    let top: number | undefined
    if (fit && !chart.angle) {
      const corner = chart.getPointByOrigin('left', 'top')
      // Measure from the chart's own size, so it shrinks back when it needs less room than it grew to.
      const own = next.grown ?? { height: next.height, top: corner.y, grownTop: corner.y }
      const moved = next.grown !== undefined && Math.abs(next.grown.grownTop - corner.y) > 0.5
      const base = { ...next, height: own.height }
      const needed = heightToFit(base, measureText, this.page.height) ?? own.height
      if (needed > own.height) {
        // Grows (or stays grown): downward first, up when the page's bottom stops it.
        const from = moved ? corner.y : own.top
        top = from + needed > this.page.height ? Math.max(this.page.height - needed, 0) : from
        if (needed > next.height) grewFrom = next.height
        next = { ...next, height: needed, grown: { height: own.height, top: moved ? corner.y : own.top, grownTop: top } }
      } else if (next.grown) {
        // Fits at its own height again: back to it, and to its own spot unless it was moved since.
        top = moved ? corner.y : own.top
        next = { ...next, height: own.height, grown: undefined }
      }
    }
    chart.setChart(next)
    if (top !== undefined) {
      const corner = chart.getPointByOrigin('left', 'top')
      chart.setPositionByOrigin(new Point(corner.x, top), 'left', 'top')
      chart.setCoords()
    }
    this.canvas.requestRenderAll()
    if (save) this.commit(mergeKey)
    else this.emit()
    return grewFrom
  }

  /** Undo a chart's growing to fit its brackets, keeping the rest (the toast's Undo): its own height and spot again. */
  shrinkChartBack(): void {
    const chart = this.activeChart()
    const grown = chart?.chart.grown
    if (!chart || !grown) return
    const corner = chart.getPointByOrigin('left', 'top')
    const moved = Math.abs(grown.grownTop - corner.y) > 0.5
    chart.setChart({ ...chart.chart, height: grown.height, grown: undefined })
    if (!moved) {
      chart.setPositionByOrigin(new Point(chart.getPointByOrigin('left', 'top').x, grown.top), 'left', 'top')
      chart.setCoords()
    }
    this.canvas.requestRenderAll()
    this.commit()
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
    this.freshText = text
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

  /** Add a chart with its data and look worked out already (see `createChart`), at a spot on the page. */
  addChart(data: ChartData, at: XY, commit = true): ChartObject {
    const chart = new ChartObject({ chart: data, left: at.x, top: at.y })
    this.add(chart, commit)
    return chart
  }

  /**
   * Stick the ends of an arrow to the objects with these ids, as drawing it
   * from one object to another does: the ends move to the objects' edges and
   * follow them when they move. A missing end stays where it is.
   */
  attachArrow(arrow: FabricObject, ends: { start?: string; end?: string }, commit = true): void {
    if (!(arrow instanceof Connector)) return
    arrow.set({ attachStart: ends.start ?? arrow.attachStart, attachEnd: ends.end ?? arrow.attachEnd })
    this.followConnectors()
    this.canvas.requestRenderAll()
    if (commit) this.commit()
  }

  /**
   * Add an icon from SVG text, centred at a point on the page. Every icon gets
   * the same area (that of a `size` square), so tall and wide icons look
   * equally big: a side-view mouse comes out about 113 by 48.
   */
  async addSvg(svg: string, name: string, at?: { x: number; y: number }, size = 74, iconId?: string): Promise<FabricObject> {
    const { objects, options } = await loadSVGFromString(svg)
    const group = util.groupSVGElements(
      objects.filter((object): object is FabricObject => object !== null),
      options,
    )
    noteIconOrigin(group, iconId)
    // Dropped on an empty icon space, or picked while one is selected: it goes into that space (BIO-74).
    const space = at ? iconSpaceAt(at, this.canvas.getObjects()) : this.waitingSpace()
    this.hoverSpace = undefined
    if (space && !isLocked(space)) return this.fillSpace(space, group, name, iconId)
    const centre = at ?? { x: this.page.width / 2, y: this.page.height / 2 }
    const area = group.width * group.height
    group.scale(area > 0 ? size / Math.sqrt(area) : size / Math.max(group.width, group.height, 1))
    group.set({ left: centre.x - group.getScaledWidth() / 2, top: centre.y - group.getScaledHeight() / 2 })
    Object.assign(group, { name, iconId })
    startSlotText(group, iconId)
    this.add(group)
    return group
  }

  /**
   * Give the selected icons their own colours back, read again from the icon
   * library (recolouring tints them, which can't be undone by picking colours).
   * One undo step. `svgOf` finds an icon's SVG by its library id.
   */
  async resetIconColours(svgOf: (iconId: string) => string | undefined | Promise<string | undefined> = loadIconSvg): Promise<void> {
    const icons = this.selected().targets.flatMap((target) => iconOf(target) ?? []).filter((icon) => typeof (icon as FabricObject & { iconId?: unknown }).iconId === 'string')
    let changed = false
    for (const icon of icons) {
      const svg = await svgOf((icon as unknown as { iconId: string }).iconId)
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
    const target = this.selected().targets[0]
    const card = target instanceof IconCard ? target : undefined
    const old = card ? cardIcon(card) : target
    const next = await library(iconId)
    const oldId = old && iconIdOf(old)
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
    if (card) {
      this.replaceObject(card, replaceCardIcon(card, group as Group))
      this.commit()
      return
    }
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
    const icon = targets.length === 1 && targets[0] ? iconOf(targets[0]) : undefined
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

  /**
   * Put a frame around the selected icon (BIO-73), in a style coloured to go
   * with the icon; its caption starts as the icon's name. On a framed icon,
   * switches it to that style. One undo step.
   */
  addFrame(style: FrameStyle = DEFAULT_FRAME_STYLE): void {
    const target = this.onlySelected()
    if (!target || isLocked(target)) return
    const icon = iconOf(target)
    if (!icon) return
    const colour = iconMainColour(baseIconColours(icon), iconIdOf(icon)) ?? '#0072b2'
    const settings = styleSettings(style, colour)
    lastFrameStyle = style
    if (target instanceof IconCard) {
      // Colours picked by hand (a preset) stay when switching style; untouched ones follow the new style.
      const now = cardFrameOf(target)
      const before = styleSettings(now.style, colour)
      const picked = !isBareHolder(now, target.cardCaption ?? '') && (now.fill !== before.fill || now.outline !== before.outline)
      // An icon in a space's box keeps that box.
      const next = { ...(picked ? { ...settings, fill: now.fill, outline: now.outline } : settings), ...(now.holder && { holder: now.holder }) }
      this.rebuildCard(target, { settings: next })
    } else {
      const index = this.canvas.getObjects().indexOf(target)
      this.canvas.discardActiveObject()
      this.canvas.remove(target)
      const card = frameIcon(icon, settings, objectName(icon))
      this.canvas.insertAt(index, card)
      this.canvas.setActiveObject(card)
      this.canvas.requestRenderAll()
    }
    this.commit()
  }

  /** The style the floating bar's Frame button adds: the last one picked. */
  get frameStyle(): FrameStyle {
    return lastFrameStyle
  }

  /** Change the selected framed icon's frame settings. One undo step; `mergeKey` joins quick changes (a slider) into one. */
  setFrame(change: Partial<FrameSettings>, mergeKey?: string): void {
    const card = this.onlySelected()
    if (!(card instanceof IconCard)) return
    this.rebuildCard(card, { settings: { ...cardFrameOf(card), ...change } })
    this.commit(mergeKey)
  }

  /** Change the selected framed icon's caption; an empty caption shows none. Typing joins into one undo step. */
  setCaption(caption: string): void {
    const card = this.onlySelected()
    if (!(card instanceof IconCard) || card.cardCaption === caption) return
    this.rebuildCard(card, { caption })
    this.commit('frame-caption')
  }

  /**
   * Restyle the selected framed icon's caption (the Frame's Text tab: font,
   * size, colour and the rest of the text tool's settings), the whole caption
   * at once. One undo step; quick changes to the same setting join into one.
   */
  async setCaptionStyle(change: Partial<TextStyle>): Promise<void> {
    const card = this.onlySelected()
    if (!(card instanceof IconCard)) return
    const look = { ...captionStyle(card), ...change }
    if (change.font !== undefined || change.weight !== undefined || change.bold !== undefined || change.italic !== undefined) await loadFontFace(fontByName(look.font) ?? DEFAULT_FONT, drawnWeight(look), look.italic)
    // The card may have been let go of while the font loaded.
    if (this.onlySelected() !== card) return
    this.rebuildCard(card, { text: { ...card.cardText, ...change } })
    this.commit(`caption:${Object.keys(change).join(',')}`)
  }

  /** Add a symbol (from the Text tab's symbol buttons) to the end of the selected framed icon's caption. */
  addCaptionSymbol(symbol: string): void {
    const card = this.onlySelected()
    if (!(card instanceof IconCard)) return
    this.rebuildCard(card, { caption: (card.cardCaption ?? '') + symbol })
    this.commit()
  }

  /** Take the frame off the selected icon. One undo step. */
  removeFrame(): void {
    const card = this.onlySelected()
    if (!(card instanceof IconCard)) return
    // An icon in a space's box keeps the box, only its frame goes.
    const holder = cardFrameOf(card).holder
    if (holder) {
      this.rebuildCard(card, { settings: holderSettings(holder) })
      this.commit()
      return
    }
    const index = this.canvas.getObjects().indexOf(card)
    this.canvas.discardActiveObject()
    this.canvas.remove(card)
    const icon = unframe(card)
    if (icon) {
      this.canvas.insertAt(index, icon)
      this.canvas.setActiveObject(icon)
    }
    this.canvas.requestRenderAll()
    this.commit()
  }

  /**
   * Panel blocks (BIO-74): place an empty panel in the middle of the page,
   * selected, ready to have things dragged into it. One undo step.
   */
  addPanel(): void {
    this.addBlock(emptyPanel)
  }


  /**
   * Place a block from the Blocks tool (an empty panel, or one with icon
   * spaces) in the middle of the page, the panel selected. One undo step.
   */
  addBlock(make: (centre: { x: number; y: number }, area?: { width: number; height: number }) => Block): void {
    if (this.isTyping()) return
    this.setTool('select')
    // On an empty page a block may fill the room inside the margins, as a chart does (a figure grid does, BIO-86).
    const emptyPage = !this.canvas.getObjects().some((object) => !object.excludeFromExport)
    const { panel, spaces, inner } = make(this.pageCentre(), emptyPage ? chartSizeForPage(this.page, true) : undefined)
    // On a slide that already has letters, a new plain panel gets its letter too and joins the count (BIO-83); grids and comparison sides don't.
    if (panel instanceof PanelBlock && Object.getPrototypeOf(panel) === PanelBlock.prototype && this.canvas.getObjects().some((object) => (object instanceof GridBlock ? gridSettingsOf(object).letters : object instanceof PanelBlock && settingsOf(object).letter))) panel.panel = { ...settingsOf(panel), letter: true }
    this.canvas.discardActiveObject()
    this.add(panel, false)
    for (const space of spaces) {
      setPanelId(space, idOf(panel))
      this.add(space, false)
    }
    // What those hold in turn (a comparison's sides hold an icon space each, BIO-95).
    for (const { holder, objects } of inner ?? []) {
      for (const object of objects) {
        setPanelId(object, idOf(holder))
        this.add(object, false)
      }
    }
    // A sequence's look is measured again once its steps are on the page.
    if (panel instanceof SequenceBlock) this.layOut(panel)
    // A pathway taller than the page's room fits between the top and bottom margins (owner's feedback, 2026-11-26).
    if (panel instanceof PathwayBlock) this.fitPathwayToPage(panel)
    // A callout's handles need its parts on the page (BIO-97).
    this.calloutRules(panel)
    this.canvas.setActiveObject(panel)
    this.canvas.requestRenderAll()
    this.commit()
  }

  /*
   * Sequence blocks (BIO-75). The steps point at their sequence with
   * `panelId`, like a panel's contents, so moving, copying and deleting take
   * them along; these keep the row tidy whenever its steps change.
   */

  /** The sequence an object is a step of. */
  private sequenceOf(object: FabricObject): SequenceBlock | undefined {
    const id = panelIdOf(object)
    return id ? this.canvas.getObjects().find((other): other is SequenceBlock => other instanceof SequenceBlock && idOf(other) === id) : undefined
  }

  private stepsOf(sequence: SequenceBlock): FabricObject[] {
    return contentsOf(sequence, this.canvas.getObjects())
  }

  /** Moves a step with whatever it holds (a panel as a step takes its contents along). */
  private readonly moveStep = (step: FabricObject, dx: number, dy: number): void => {
    if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return
    for (const object of [step, ...descendantsOf(step, this.canvas.getObjects())]) {
      object.set({ left: object.left + dx, top: object.top + dy })
      object.setCoords()
    }
  }

  /** Line a sequence's steps up again and draw its look round them, `pinned` (else the first step) staying put. */
  private layOut(sequence: SequenceBlock, pinned?: FabricObject): void {
    if (sequence instanceof ComparisonBlock) this.styleSides(sequence)
    layOutSequence(sequence, this.stepsOf(sequence), plainBox, pinned, this.moveStep)
    this.sequenceRules(sequence)
    this.followConnectors()
  }

  /** After a step was resized or turned (also while it is): its sequence lines up round it. */
  private layOutAround(target: FabricObject): void {
    const sequence = this.sequenceOf(target)
    if (sequence) {
      this.layOut(sequence, target)
      return
    }
    // Something in a comparison's side that grew or shrank its side: the other side matches it (BIO-95).
    const side = this.holdersById().get(panelIdOf(target) ?? '')
    const comparison = side && this.sequenceOf(side)
    if (side && comparison instanceof ComparisonBlock) this.layOut(comparison, side)
  }

  /**
   * Tidy these sequences after steps came or went: an empty one goes, the
   * rest line up again, each round its first step that `keep` says stayed put.
   */
  private relayOut(ids: Iterable<string | undefined>, keep: (step: FabricObject) => boolean = () => true): void {
    for (const id of new Set(ids)) {
      const sequence = id ? this.canvas.getObjects().find((object): object is SequenceBlock => object instanceof SequenceBlock && idOf(object) === id) : undefined
      if (!sequence) continue
      const steps = this.stepsOf(sequence)
      if (steps.length === 0 && !(sequence instanceof AbstractBlock)) {
        this.canvas.remove(sequence)
        continue
      }
      this.layOut(sequence, orderedSteps(sequence, steps, plainBox).find(keep))
    }
  }

  /** A sequence turns and stretches only through its steps; its one handle is the "+" that adds a step. */
  private sequenceRules(sequence: SequenceBlock): void {
    // A graphical abstract's side handles make it wider or narrower (BIO-107).
    if (sequence instanceof AbstractBlock) {
      const { ml, mr } = controlsUtils.createObjectDefaultControls()
      sequence.set({ lockRotation: true, lockScalingX: false, lockScalingY: true, lockSkewingX: true, lockSkewingY: true })
      sequence.controls = { ml, mr }
      sequence.setCoords()
      return
    }
    sequence.set({ lockRotation: true, lockScalingX: true, lockScalingY: true, lockSkewingX: true, lockSkewingY: true })
    // A comparison has its two sides and no more: no "+" (BIO-95).
    const { direction, look } = sequenceSettingsOf(sequence)
    const family = familyOf(look)
    // A cycle's "+" sits on its bottom-right corner, a tree's or arm rows' under the arms; branching at its most arms has none (BIO-96).
    if (sequence instanceof ComparisonBlock || !canAddStep(family, this.stepsOf(sequence).length)) {
      sequence.controls = {}
      sequence.setCoords()
      return
    }
    if (sequence instanceof PathwayBlock) return this.pathwayRules(sequence)
    const across = family === 'cycle' ? false : family === 'branch' ? look === 'fan' : direction === 'across'
    const corner = family === 'cycle'
    sequence.controls = {
      addStep: new FabricControl({
        x: corner ? 0.5 : across ? 0.5 : 0,
        y: corner ? 0.5 : across ? 0 : 0.5,
        offsetX: corner ? 14 : across ? 20 : 0,
        offsetY: corner ? 14 : across ? 0 : 20,
        sizeX: 24,
        sizeY: 24,
        cursorStyle: 'pointer',
        actionName: 'addStep',
        mouseUpHandler: (_event, transform) => {
          if (transform.target === sequence) this.addStep()
          return true
        },
        render: (ctx, left, top) => drawPlus(ctx, left, top),
      }),
    }
    // The handle's place on screen is worked out from the controls, so again now they changed.
    sequence.setCoords()
  }

  /*
   * Graphical abstracts (BIO-107): a sequence of three parts drawn from its
   * settings (abstract-block.ts). Its contents are ordinary objects; these
   * change its settings and keep every part filled.
   */

  /** The selected graphical abstract, unless it is locked or text is being typed. */
  private editableAbstract(): AbstractBlock | undefined {
    const only = this.onlySelected()
    return only instanceof AbstractBlock && !isLocked(only) && !this.isTyping() ? only : undefined
  }

  /** Whether one graphical abstract is selected. */
  abstractSelected(): boolean {
    return this.onlySelected() instanceof AbstractBlock
  }

  /** Change the selected abstract's settings (title, headings, captions, look, colour). One undo step; `mergeKey` joins typing into one. */
  setAbstract(change: Partial<AbstractSettings>, mergeKey?: string): void {
    const block = this.editableAbstract()
    if (!block) return
    const settings = abstractSettingsOf(block)
    block.abstract = { ...settings, ...change, headings: [...(change.headings ?? settings.headings)], captions: [...(change.captions ?? settings.captions)] }
    this.layOut(block)
    this.canvas.requestRenderAll()
    this.commit(mergeKey)
  }

  /** Give the selected abstract's part `index` (first, left, is 0) its heading or caption. */
  setAbstractText(field: 'headings' | 'captions', index: number, text: string): void {
    const block = this.editableAbstract()
    if (!block) return
    const list = [...abstractSettingsOf(block)[field]]
    list[index] = text
    this.setAbstract({ [field]: list }, `abstract-${field}-${index}`)
  }

  /**
   * While a side handle is dragged: the stretch becomes the abstract's width,
   * its parts are laid out again, and it moves (with what it holds) so the
   * edge Fabric holds still stays exactly where it was.
   */
  private resizeAbstract(block: AbstractBlock, originX: 'left' | 'center' | 'right' = 'left'): void {
    const held = block.getPointByOrigin(originX, 'top')
    if (!takeWidthFromScale(block, originX)) return
    this.layOut(block)
    const now = block.getPointByOrigin(originX, 'top')
    this.shiftWithContents(block, held.x - now.x, held.y - now.y)
  }

  /** Every abstract keeps its three parts filled: an emptied part gets an empty space again. Says whether anything changed. */
  private syncAbstracts(): boolean {
    let changed = false
    for (const block of this.canvas.getObjects()) {
      if (!(block instanceof AbstractBlock) || block.group) continue
      const steps = this.stepsOf(block)
      const empty = steps.length < PARTS ? emptyParts(block, steps, plainBox) : []
      if (empty.length === 0) continue
      const middles = partMiddles(block, steps, plainBox)
      const colour = abstractSettingsOf(block).colour
      for (const index of empty) {
        const space = emptySpaceFor(index, middles.at(index) ?? { x: 0, y: 0 }, colour)
        setPanelId(space, idOf(block))
        this.add(space, false)
      }
      this.layOut(block)
      changed = true
    }
    return changed
  }

  /*
   * Experiment timelines (BIO-96). A timeline draws itself from its settings,
   * so it moves, copies and deletes as one object; these change it and keep
   * its handles: the side ones lengthen the axis, the "+" adds an event.
   */

  /** A timeline doesn't turn and only lengthens sideways; its "+" (bottom-right) adds an event. */
  private timelineRules(block: TimelineBlock): void {
    block.set({ lockRotation: true, lockScalingY: true, lockSkewingX: true, lockSkewingY: true })
    const { ml, mr } = block.controls
    block.controls = {
      ...(ml && { ml }),
      ...(mr && { mr }),
      addEvent: new FabricControl({
        x: 0.5,
        y: 0.5,
        offsetX: 14,
        offsetY: 14,
        sizeX: 24,
        sizeY: 24,
        cursorStyle: 'pointer',
        actionName: 'addEvent',
        mouseUpHandler: (_event, transform) => {
          if (transform.target === block) this.addEvent()
          return true
        },
        render: (ctx, left, top) => drawPlus(ctx, left, top),
      }),
    }
    block.setCoords()
  }

  /** The selected timeline, unless it is locked or text is being typed. */
  private editableTimeline(): TimelineBlock | undefined {
    const only = this.onlySelected()
    return only instanceof TimelineBlock && !isLocked(only) && !this.isTyping() ? only : undefined
  }

  /** Change the selected timeline's settings and draw it again, its left edge staying put. One undo step; `mergeKey` joins quick changes. */
  setTimeline(change: Partial<TimelineSettings>, mergeKey?: string): void {
    const block = this.editableTimeline()
    if (!block) return
    const settings = timelineSettingsOf(block)
    const before = timelineBox(block)
    const restyled = change.style !== undefined && change.style !== settings.style
    // The colour (and so the picked preset) stays whatever the style, as for panels.
    const next = { ...settings, ...change }
    // A new style fills the box the old one had: as wide, round the same middle (owner's feedback, 2026-11-26).
    block.timeline = restyled && change.width === undefined ? { ...next, width: axisWidthFor(next, before.width) } : next
    redrawTimeline(block)
    if (restyled) {
      const now = timelineBox(block)
      block.set({ left: block.left + before.x + before.width / 2 - (now.x + now.width / 2), top: block.top + before.y + before.height / 2 - (now.y + now.height / 2) })
      block.setCoords()
    }
    this.canvas.requestRenderAll()
    this.commit(mergeKey)
  }

  /** Add an event after the last one: the same kind, as far on as the gap before it (the axis grows if it must). */
  addEvent(): void {
    const block = this.editableTimeline()
    if (!block) return
    const settings = timelineSettingsOf(block)
    const event = nextEvent(settings)
    this.setTimeline({ events: [...settings.events, event], length: Math.max(settings.length, event.day) })
  }

  /** Change one event (its place in the settings' list). */
  setEvent(index: number, change: Partial<TimelineEvent>, mergeKey?: string): void {
    const block = this.editableTimeline()
    if (!block) return
    const settings = timelineSettingsOf(block)
    const events = settings.events.map((event, i) => (i === index ? { ...event, ...change } : event))
    const day = events.at(index)?.day ?? 0
    this.setTimeline({ events, length: Math.max(settings.length, day) }, mergeKey)
  }

  /** Remove one event; a timeline keeps its last one. Says whether it did. */
  removeEvent(index: number): boolean {
    const block = this.editableTimeline()
    if (!block) return false
    const settings = timelineSettingsOf(block)
    if (settings.events.length < 2 || !settings.events.at(index)) return false
    this.setTimeline({ events: settings.events.filter((_, i) => i !== index) })
    return true
  }

  /** Remove one kind of event with its events (the later kinds move up); a timeline keeps one kind. Says whether it did. */
  removeEventKind(kind: number): boolean {
    const block = this.editableTimeline()
    if (!block) return false
    const settings = timelineSettingsOf(block)
    if (settings.kinds.length < 2 || !settings.kinds.at(kind)) return false
    const events = settings.events.filter((event) => event.kind !== kind).map((event) => (event.kind > kind ? { ...event, kind: event.kind - 1 } : event))
    this.setTimeline({ kinds: settings.kinds.filter((_, i) => i !== kind), events: events.length > 0 ? events : [{ kind: 0, day: 0 }] })
    return true
  }

  /**
   * Take the selected timeline apart: its axis, bar, lanes, markers and text
   * become plain shapes and text boxes where they are, all selected. One undo
   * step. Says whether it did.
   */
  detachTimeline(): boolean {
    const block = this.editableTimeline()
    if (!block) return false
    const index = this.canvas.getObjects().indexOf(block)
    const outer = panelIdOf(block)
    this.canvas.discardActiveObject()
    // Taken out of the block, the parts are back on the page where they showed (as a sequence's are).
    const parts = detachedTimelineParts(block)
    this.canvas.remove(block)
    for (const part of parts) {
      ;(part as Own).figureId = newId()
      setPanelId(part, outer)
      part.setCoords()
    }
    this.canvas.insertAt(Math.max(0, index), ...parts)
    this.select(parts)
    this.canvas.requestRenderAll()
    this.commit()
    return true
  }

  /**
   * Make a row (BIO-75): the selected objects (two or more, arrows left out)
   * become the steps of a new sequence with arrows between them, lined up
   * with even gaps from the first one: across when they spread more across
   * the page than down it, else down. The sequence is selected. One undo step.
   * Says how many steps it made (0 when it didn't).
   */
  makeRow(): number {
    if (this.isTyping()) return 0
    const steps = this.rowCandidates()
    if (steps.length < 2) return 0
    const objects = this.canvas.getObjects()
    const middles = steps.map((step) => plainBox(step)).map((box) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 }))
    const spread = (values: number[]) => Math.max(...values) - Math.min(...values)
    const direction = spread(middles.map((point) => point.x)) >= spread(middles.map((point) => point.y)) ? 'across' : 'down'
    // The row stays in the panel (or sequence) they all share, if they share one.
    const outer = new Set(steps.map(panelIdOf))
    const holder = outer.size === 1 ? [...outer][0] : undefined
    const left = new Set(steps.map(panelIdOf).filter((id) => id !== holder))
    this.canvas.discardActiveObject()
    const sequence = buildSequence({ ...DEFAULT_SEQUENCE, direction, labels: [] }, steps, plainBox, this.moveStep)
    this.add(sequence, false)
    setPanelId(sequence, holder)
    for (const step of steps) setPanelId(step, idOf(sequence))
    // A holder sits under what it holds: just under the lowest step.
    const lowest = Math.min(...steps.map((step) => objects.indexOf(step)))
    this.canvas.moveObjectTo(sequence, Math.max(0, lowest))
    this.layOut(sequence, orderedSteps(sequence, steps, plainBox)[0])
    // Sequences that gave up steps close up.
    this.relayOut(left)
    this.canvas.setActiveObject(sequence)
    this.canvas.requestRenderAll()
    this.commit()
    return steps.length
  }

  /** What Make a row would line up: the selected objects (not what they hold), without arrows. */
  private rowCandidates(): FabricObject[] {
    const picked = this.selectedInStackOrder()
    if (picked.length < 2 || picked.some(isLocked)) return []
    return picked.filter((object) => !(object instanceof Connector) && !(object instanceof Arrow) && !(object instanceof Line))
  }

  /**
   * Add a step at the end of the selected sequence (or the one the selected
   * step is in): an empty icon space as big as the last step, with the next
   * label in the labels' own count. The sequence stays selected. One undo step.
   */
  addStep(): void {
    const only = this.onlySelected()
    const sequence = only instanceof SequenceBlock ? only : only && this.sequenceOf(only)
    if (!sequence || sequence instanceof AbstractBlock || isLocked(sequence) || this.isTyping()) return
    const steps = orderedSteps(sequence, this.stepsOf(sequence), plainBox)
    if (sequence instanceof PathwayBlock) return this.addPathwayStep(sequence, steps)
    const last = steps.at(-1)
    const settings = sequenceSettingsOf(sequence)
    const family = familyOf(settings.look)
    if (!canAddStep(family, steps.length)) return
    const across = settings.direction === 'across'
    const box = last ? plainBox(last) : { x: sequenceBox(sequence).x, y: sequenceBox(sequence).y, width: NEW_SPACE_SIZE, height: NEW_SPACE_SIZE }
    const size = { width: Math.min(160, Math.max(28, box.width)), height: Math.min(160, Math.max(28, box.height)) }
    // Past the last step; the layout then puts it its gap away, on the line. Round a cycle, in the gap before the first; branching, after the last arm (BIO-96).
    const corner =
      family !== 'sequence'
        ? newStepCorner(settings.look, steps.map(plainBox), size, settings.gap)
        : across
          ? { x: box.x + box.width + settings.gap, y: box.y + (box.height - size.height) / 2 }
          : { x: box.x + (box.width - size.width) / 2, y: box.y + box.height + settings.gap }
    const space = buildIconSpace(corner, size, undefined)
    setPanelId(space, idOf(sequence))
    const index = Math.max(...[sequence, ...steps].map((object) => this.canvas.getObjects().indexOf(object))) + 1
    this.add(space, false)
    this.canvas.moveObjectTo(space, index)
    sequence.sequence = { ...settings, labels: Object.assign([...settings.labels], { [steps.length]: nextLabel(settings.labels, steps.length) }) }
    this.layOut(sequence, steps[0])
    this.canvas.discardActiveObject()
    this.canvas.setActiveObject(sequence)
    this.canvas.requestRenderAll()
    this.commit()
  }

  /**
   * Remove one step (first step 0) from the selected sequence, or from the
   * sequence the selected step is in, with whatever it holds and its label;
   * the row closes up and the sequence stays selected. A sequence keeps its
   * last step (Detach or Delete remove the rest). One undo step. Says whether it did.
   */
  removeStep(index: number): boolean {
    const only = this.onlySelected()
    const sequence = only instanceof SequenceBlock ? only : only && this.sequenceOf(only)
    if (!sequence || sequence instanceof AbstractBlock || isLocked(sequence) || this.isTyping()) return false
    const steps = orderedSteps(sequence, this.stepsOf(sequence), plainBox)
    const step = steps.at(index)
    // A cycle keeps two steps, branching its start and two arms (BIO-96).
    // A pathway keeps its receptor and one more step (BIO-105).
    if (!step || steps.length <= (sequence instanceof PathwayBlock ? 2 : minSteps(familyOf(sequenceSettingsOf(sequence).look)))) return false
    this.forgetLabels([step])
    this.canvas.discardActiveObject()
    this.canvas.remove(...withDescendants([step], this.canvas.getObjects()))
    this.layOut(sequence, steps.find((other) => other !== step))
    this.canvas.setActiveObject(sequence)
    this.canvas.requestRenderAll()
    this.commit()
    return true
  }

  /** Steps about to go: their labels go with them, so the labels after them move up a step. */
  private forgetLabels(going: readonly FabricObject[]): void {
    const bySequence = new Map<SequenceBlock, Set<FabricObject>>()
    for (const object of going) {
      const sequence = this.sequenceOf(object)
      if (sequence) bySequence.set(sequence, (bySequence.get(sequence) ?? new Set()).add(object))
    }
    for (const [sequence, gone] of bySequence) {
      const settings = sequenceSettingsOf(sequence)
      const order = orderedSteps(sequence, this.stepsOf(sequence), plainBox)
      sequence.sequence = { ...settings, labels: settings.labels.filter((_, i) => !gone.has(order.at(i) ?? sequence)) }
      // A pathway's roles and arrow words go too, and which steps are the ligand and in the nucleus follows (BIO-105).
      if (sequence instanceof PathwayBlock) sequence.pathway = withoutSteps(pathwaySettingsOf(sequence), order.length, new Set(order.flatMap((step, i) => (gone.has(step) ? [i] : []))))
    }
  }

  /**
   * Change the selected sequence's settings (look, direction, colour, gap,
   * labels) and line it up again. Picking a look starts it on that look's own
   * gap. One undo step; `mergeKey` joins quick changes (typing a label, the
   * gap slider) into one.
   */
  setSequence(change: Partial<SequenceSettings>, mergeKey?: string): void {
    const sequence = this.onlySelected()
    if (!(sequence instanceof SequenceBlock) || isLocked(sequence)) return
    const settings = sequenceSettingsOf(sequence)
    const newLook = change.look && change.look !== settings.look ? change.look : undefined
    const gap = newLook && change.gap === undefined ? LOOK_GAP[newLook] : (change.gap ?? settings.gap)
    // The colour (and so the picked preset) stays whatever the style, as for panels.
    sequence.sequence = { ...settings, ...change, gap, labels: [...(change.labels ?? settings.labels)] }
    // A cycle or branching switching style fills the box the old one had (owner's feedback, 2026-11-26).
    if (newLook && change.gap === undefined && familyOf(newLook) !== 'sequence') return this.restyleInBox(sequence, sequenceBox(sequence), mergeKey)
    this.layOut(sequence, orderedSteps(sequence, this.stepsOf(sequence), plainBox)[0])
    this.canvas.requestRenderAll()
    this.commit(mergeKey)
  }

  /**
   * Lay a cycle or branching out in its new look inside `box`, the area its
   * old look had: the gap that makes it fit (the biggest that keeps it within
   * the box both ways, found by halving). When even no gap is small enough
   * (a look that takes more room of its own), the steps get smaller instead,
   * the gap with them, as a figure grid's cells do. Then everything moves so
   * its middle is the box's middle. One undo step.
   */
  private restyleInBox(sequence: SequenceBlock, current: PlainBox, mergeKey?: string): void {
    const steps = this.stepsOf(sequence)
    const first = orderedSteps(sequence, steps, plainBox)[0]
    const settings = sequenceSettingsOf(sequence)
    // Styles differ in shape (a ring with names beside it is wider than tall), so fitting each into the last
    // would shrink the block a little at every switch. While its steps are as the last switch left them, it
    // fits into the box it had before the first switch instead, round its middle now.
    const sizes = steps.map((step) => `${Math.round(plainBox(step).width)}x${Math.round(plainBox(step).height)}`).join(' ')
    const kept = this.styleBoxes.get(sequence)
    const size = kept && kept.sizes === sizes ? kept : current
    const box = { x: current.x + (current.width - size.width) / 2, y: current.y + (current.height - size.height) / 2, width: size.width, height: size.height }
    /** A step's box made `k` times as big round its middle. */
    const sized = (k: number) => (step: FabricObject) => {
      const b = plainBox(step)
      return { x: b.x + (b.width * (1 - k)) / 2, y: b.y + (b.height * (1 - k)) / 2, width: b.width * k, height: b.height * k }
    }
    const fits = (gap: number, k = 1) => {
      const frame = sequencePlan({ ...settings, gap }, steps, sized(k), first).frame
      return frame.width <= box.width + 0.5 && frame.height <= box.height + 0.5
    }
    /** The biggest value in [low, high] that `ok` allows (`low` if none does). */
    const largest = (low: number, high: number, ok: (value: number) => boolean) => {
      if (ok(high)) return high
      for (let round = 0; round < 24 && high - low > 0.001; round++) {
        const middle = (low + high) / 2
        if (ok(middle)) low = middle
        else high = middle
      }
      return low
    }
    if (fits(GAP_RANGE.min)) {
      sequence.sequence = { ...settings, gap: Math.floor(largest(GAP_RANGE.min, GAP_RANGE.max, (gap) => fits(gap))) }
    } else {
      const lookGap = LOOK_GAP[settings.look]
      const k = largest(0.2, 1, (each) => fits(lookGap * each, each))
      sequence.sequence = { ...settings, gap: Math.floor(lookGap * k) }
      for (const step of steps) this.resizeStep(step, k)
    }
    this.layOut(sequence, first)
    const now = sequenceBox(sequence)
    const dx = box.x + box.width / 2 - (now.x + now.width / 2)
    const dy = box.y + box.height / 2 - (now.y + now.height / 2)
    for (const step of steps) this.moveStep(step, dx, dy)
    this.layOut(sequence, first)
    this.styleBoxes.set(sequence, { width: box.width, height: box.height, sizes: steps.map((step) => `${Math.round(plainBox(step).width)}x${Math.round(plainBox(step).height)}`).join(' ') })
    this.canvas.requestRenderAll()
    this.commit(mergeKey)
  }

  /** Give a step this size round its middle, as when resized by hand (a space or framed icon takes it into its own size). */
  private sizeStepTo(step: FabricObject, size: { width: number; height: number }): void {
    if (isHolder(step) || step instanceof TimelineBlock) return
    // An empty space takes the size exactly (a stretch baked in would leave its outline's width over).
    if (step instanceof IconSpace) {
      const middle = step.getCenterPoint()
      resizeIconSpace(step, size)
      step.setPositionByOrigin(middle, 'center', 'center')
      step.setCoords()
      return
    }
    const now = stepSize(step)
    if (now.width <= 0 || now.height <= 0) return
    const middle = step.getCenterPoint()
    step.set({ scaleX: (step.scaleX * size.width) / now.width, scaleY: (step.scaleY * size.height) / now.height })
    step.setPositionByOrigin(middle, 'center', 'center')
    if (step instanceof ContentSpace) bakeContentScale(step, 'center', 'center')
    if (step instanceof IconCard) bakeCardScale(step, 'center', 'center')
    step.setCoords()
  }

  /** Make a step `k` times as big round its middle; an icon or chart space takes it into its own size, as when resized by hand. */
  private resizeStep(step: FabricObject, k: number): void {
    // A panel or sequence as a step holds other things, which would stay their size; it keeps its own.
    if (isHolder(step) || step instanceof TimelineBlock) return
    const middle = step.getCenterPoint()
    step.set({ scaleX: step.scaleX * k, scaleY: step.scaleY * k })
    step.setPositionByOrigin(middle, 'center', 'center')
    if (step instanceof IconSpace) bakeSpaceScale(step, 'center', 'center')
    if (step instanceof ContentSpace) bakeContentScale(step, 'center', 'center')
    step.setCoords()
  }

  /** Give one step of the selected sequence its label (first step 0). */
  setStepLabel(index: number, text: string): void {
    const sequence = this.onlySelected()
    if (!(sequence instanceof SequenceBlock)) return
    const labels = [...sequenceSettingsOf(sequence).labels]
    while (labels.length < index) labels.push('')
    labels[index] = text
    this.setSequence({ labels }, `sequence-label-${index}`)
  }

  /*
   * Pathway cascades (BIO-105): a sequence running down the page, from a
   * receptor in the membrane to the nucleus (pathway-block.ts). These add its
   * own handles and settings; the rest is the sequence's.
   */

  /** A pathway's handles: the sides make it wider or narrower, the "+" (beside the arrow into the nucleus) adds a step there. */
  private pathwayRules(block: PathwayBlock): void {
    block.set({ lockScalingX: false, lockScalingFlip: true })
    const { ml, mr } = controlsUtils.createObjectDefaultControls()
    const at = block.plusAt ?? { x: -0.5, y: 0.5 }
    block.controls = {
      ml,
      mr,
      addStep: new FabricControl({
        x: at.x,
        y: at.y,
        sizeX: 24,
        sizeY: 24,
        cursorStyle: 'pointer',
        actionName: 'addStep',
        mouseUpHandler: (_event, transform) => {
          if (transform.target === block) this.addStep()
          return true
        },
        render: (ctx, left, top) => drawPlus(ctx, left, top),
      }),
    }
    block.setCoords()
  }

  /** Find where a pathway's "+" goes from where its steps are now, without moving anything, and give it its handles. */
  private placePathwayPlus(block: PathwayBlock): void {
    const steps = this.stepsOf(block)
    if (steps.length > 0) block.planLayout(steps, plainBox, orderedSteps(block, steps, plainBox)[0])
    this.sequenceRules(block)
  }

  /**
   * While a pathway's side handle is dragged: the stretch becomes its width
   * and it is laid out again at once, so nothing stretches. The edge across
   * from the handle stays put (its steps move along when the left edge is dragged).
   */
  private pathwayScaling(block: PathwayBlock, originX: string): void {
    if (block.scaleX === 1 && block.scaleY === 1) return
    const box = sequenceBox(block)
    const right = box.x + box.width
    block.pathway = { ...pathwaySettingsOf(block), width: Math.max(PATHWAY_WIDTH.min, Math.min(PATHWAY_WIDTH.max, box.width)) }
    block.set({ scaleX: 1, scaleY: 1 })
    const first = orderedSteps(block, this.stepsOf(block), plainBox)[0]
    this.layOut(block, first)
    if (originX === 'right') {
      const now = sequenceBox(block)
      const dx = right - (now.x + now.width)
      if (Math.abs(dx) > 0.01) {
        for (const step of this.stepsOf(block)) this.moveStep(step, dx, 0)
        this.layOut(block, first)
      }
    }
  }

  /**
   * Make a pathway that is taller than the room between the page's top and
   * bottom margins just fit it: its steps get smaller (the arrows, names and
   * the drawing round them keep their size), then it is centred on the page.
   */
  private fitPathwayToPage(block: PathwayBlock): void {
    const room = chartSizeForPage(this.page, true).height
    for (let round = 0; round < 3; round++) {
      const steps = this.stepsOf(block)
      const height = sequenceBox(block).height
      if (height <= room + 0.5) break
      // Only the steps shrink, so their share of the height has to give all the room that's missing.
      const stepsHeight = steps.reduce((sum, step) => sum + plainBox(step).height, 0)
      if (stepsHeight <= 0) break
      const k = Math.max(0.3, (stepsHeight - (height - room)) / stepsHeight)
      for (const step of steps) this.resizeStep(step, k)
      this.layOut(block, orderedSteps(block, steps, plainBox)[0])
    }
    const box = sequenceBox(block)
    const centre = this.pageCentre()
    const dx = centre.x - (box.x + box.width / 2)
    const dy = centre.y - (box.y + box.height / 2)
    for (const step of this.stepsOf(block)) this.moveStep(step, dx, dy)
    this.layOut(block, orderedSteps(block, this.stepsOf(block), plainBox)[0])
  }

  /** Add an empty step after the chain, just above the nucleus, as big as the chain step before it. One undo step. */
  private addPathwayStep(block: PathwayBlock, steps: readonly FabricObject[]): void {
    const settings = pathwaySettingsOf(block)
    const index = insertIndex(settings, steps.length)
    const before = steps.at(index - 1)
    const after = steps.at(index)
    const above = before ? plainBox(before) : sequenceBox(block)
    // After the receptor (or ligand) a new step gets the usual size, not theirs.
    const afterChain = index - 1 > (settings.ligand ? 1 : 0)
    const size = Math.min(160, Math.max(28, afterChain ? Math.min(above.width, above.height) : NEW_SPACE_SIZE * 0.9))
    const middle = above.x + above.width / 2
    // Just under the step before (its middle above the next one's), so it comes next in the order.
    const next = after && plainBox(after)
    const top = next ? Math.min(above.y + above.height + 1, next.y + next.height / 2 - size / 2 - 1) : above.y + above.height + 30
    const space = buildIconSpace({ x: middle - size / 2, y: top }, { width: size, height: size }, undefined)
    setPanelId(space, idOf(block))
    const position = Math.max(...[block, ...steps].map((object) => this.canvas.getObjects().indexOf(object))) + 1
    this.add(space, false)
    this.canvas.moveObjectTo(space, position)
    const changed = withStepAt(settings, sequenceSettingsOf(block).labels, index, steps.length)
    block.sequence = { ...sequenceSettingsOf(block), labels: changed.names }
    block.pathway = changed.pathway
    this.layOut(block, steps[0])
    this.canvas.discardActiveObject()
    this.canvas.setActiveObject(block)
    this.canvas.requestRenderAll()
    this.commit()
  }

  /** Change the selected pathway's own settings (look, colour, width, ligand, steps in the nucleus) and lay it out again. One undo step; `mergeKey` joins quick changes. */
  setPathway(change: Partial<PathwaySettings>, mergeKey?: string): void {
    const block = this.onlySelected()
    if (!(block instanceof PathwayBlock) || isLocked(block)) return
    const settings = pathwaySettingsOf(block)
    const restyled = change.look !== undefined && change.look !== settings.look
    const before = sequenceBox(block)
    // The colour (and so the picked preset) stays whatever the style, as for panels.
    block.pathway = { ...settings, ...change }
    if (restyled) this.restylePathway(block, before)
    else this.layOut(block, orderedSteps(block, this.stepsOf(block), plainBox)[0])
    this.canvas.requestRenderAll()
    this.commit(mergeKey)
  }

  /**
   * A pathway in a new style fills the box the old one had (the rule for
   * every block, notes/blocks.md): as wide (unless the new style's names need
   * more), and as tall, by the length of its arrows (`spread`, found by
   * halving); only when even the shortest arrows are too long do the steps get
   * smaller. Then it is centred on the old box's middle. While its steps stay
   * as the last switch left them it fits the box from before the first switch,
   * so switching back and forth never drifts.
   */
  private restylePathway(block: PathwayBlock, current: PlainBox): void {
    const steps = this.stepsOf(block)
    const sizes = steps.map((step) => `${Math.round(plainBox(step).width)}x${Math.round(plainBox(step).height)}`).join(' ')
    const kept = this.styleBoxes.get(block)
    const size = kept && kept.sizes === sizes ? kept : current
    const box = { x: current.x + (current.width - size.width) / 2, y: current.y + (current.height - size.height) / 2, width: size.width, height: size.height }
    const first = orderedSteps(block, steps, plainBox)[0]
    const settings = { ...pathwaySettingsOf(block), width: box.width }
    const names = sequenceSettingsOf(block).labels
    const heightWith = (spread: number) => pathwayPlan({ ...settings, spread }, names, steps, plainBox, first).frame.height
    let spread: number
    if (heightWith(SPREAD.max) <= box.height) spread = SPREAD.max
    else if (heightWith(SPREAD.min) >= box.height) spread = SPREAD.min
    else {
      let low = SPREAD.min
      let high = SPREAD.max
      for (let round = 0; round < 30; round++) {
        const middle = (low + high) / 2
        if (heightWith(middle) <= box.height) low = middle
        else high = middle
      }
      spread = low
    }
    block.pathway = { ...settings, spread }
    this.layOut(block, first)
    // Too tall even with the shortest arrows: the steps get smaller, as on a page that is too short.
    for (let round = 0; round < 3 && sequenceBox(block).height > box.height + 0.5; round++) {
      const stepsHeight = steps.reduce((sum, step) => sum + plainBox(step).height, 0)
      const k = Math.max(0.3, (stepsHeight - (sequenceBox(block).height - box.height)) / stepsHeight)
      for (const step of steps) this.resizeStep(step, k)
      this.layOut(block, first)
    }
    const now = sequenceBox(block)
    const dx = box.x + box.width / 2 - (now.x + now.width / 2)
    const dy = box.y + box.height / 2 - (now.y + now.height / 2)
    for (const step of steps) this.moveStep(step, dx, dy)
    this.layOut(block, first)
    this.styleBoxes.set(block, { width: box.width, height: box.height, sizes: steps.map((step) => `${Math.round(plainBox(step).width)}x${Math.round(plainBox(step).height)}`).join(' ') })
  }

  /** Give one step of the selected pathway (first 0) its name, its role or the word on the arrow after it. Typing in one field is one undo step. */
  setPathwayStep(index: number, change: { name?: string; role?: string; verb?: string }): void {
    const block = this.onlySelected()
    if (!(block instanceof PathwayBlock) || isLocked(block)) return
    const settings = pathwaySettingsOf(block)
    const put = (list: readonly string[], value: string | undefined) => {
      const next = [...list]
      if (value === undefined) return next
      while (next.length < index) next.push('')
      next[index] = value
      return next
    }
    block.sequence = { ...sequenceSettingsOf(block), labels: put(sequenceSettingsOf(block).labels, change.name) }
    this.setPathway({ roles: put(settings.roles, change.role), verbs: put(settings.verbs, change.verb) }, `pathway-${Object.keys(change).join(',')}-${index}`)
  }

  /*
   * Comparison blocks (BIO-95): a sequence of two matching sides. Picking a
   * side shows the comparison's settings, so these act on the comparison of
   * the selected side too.
   */

  /** The comparison an object is, or is a side of. */
  private comparisonOf(object: FabricObject): ComparisonBlock | undefined {
    if (object instanceof ComparisonBlock) return object
    const holder = this.sequenceOf(object)
    return holder instanceof ComparisonBlock ? holder : undefined
  }

  /** The comparison's sides, left to right. */
  private sidesOf(comparison: ComparisonBlock): FabricObject[] {
    return orderedSteps(comparison, this.stepsOf(comparison), plainBox)
  }

  private comparisonInfo(comparison: ComparisonBlock): ComparisonSettings & { titles: string[] } {
    return { ...comparisonSettingsOf(comparison), titles: this.sidesOf(comparison).map((side) => (side instanceof PanelBlock ? settingsOf(side).title : objectName(side))) }
  }

  /** Each side takes the look of its place (Paired colours: grey first), its icon spaces its colour. */
  private styleSides(comparison: ComparisonBlock): void {
    const settings = comparisonSettingsOf(comparison)
    const objects = this.canvas.getObjects()
    this.sidesOf(comparison).forEach((side, i) => styleSide(side, settings, i, contentsOf(side, objects)))
  }

  /** Whether one comparison, or a side of one, is selected. */
  comparisonSelected(): boolean {
    const only = this.onlySelected()
    return only !== undefined && this.comparisonOf(only) !== undefined
  }

  /** The selected comparison, or the one the selected side is in, when it can be changed. */
  private selectedComparison(): ComparisonBlock | undefined {
    const only = this.onlySelected()
    const comparison = only && this.comparisonOf(only)
    return comparison && !isLocked(comparison) ? comparison : undefined
  }

  /**
   * Change the selected comparison's settings (look, colour, what goes
   * between, the arrow's label) and lay it out again, its first side staying
   * put. A new look starts on its own divider unless "vs" was picked. One
   * undo step; `mergeKey` joins quick changes (typing the label) into one.
   */
  setComparison(change: Partial<ComparisonSettings>, mergeKey?: string): void {
    const comparison = this.selectedComparison()
    if (!comparison) return
    const settings = comparisonSettingsOf(comparison)
    const newLook = change.look && change.look !== settings.look ? change.look : undefined
    const between = newLook && change.between === undefined && settings.between !== 'vs' ? LOOK_BETWEEN[newLook] : (change.between ?? settings.between)
    comparison.comparison = { ...settings, ...change, between }
    this.layOut(comparison, this.sidesOf(comparison)[0])
    this.canvas.requestRenderAll()
    this.commit(mergeKey)
  }

  /** Give one side of the selected comparison its title (first, left, is 0). */
  setComparisonTitle(index: number, title: string): void {
    const comparison = this.selectedComparison()
    const side = comparison && this.sidesOf(comparison).at(index)
    if (!comparison || !(side instanceof PanelBlock)) return
    updatePanel(side, { title })
    this.layOut(comparison, side)
    this.canvas.requestRenderAll()
    this.commit(`comparison-title-${index}`)
  }

  /** The selected comparison's two sides trade places, each with what it holds. One undo step. */
  swapSides(): void {
    const comparison = this.selectedComparison()
    if (!comparison || this.isTyping()) return
    const sides = this.sidesOf(comparison)
    if (sides.length < 2) return
    for (const { side, dx } of swapMoves(sides)) this.shiftWithContents(side, dx, 0)
    this.layOut(comparison, this.sidesOf(comparison)[0])
    this.followConnectors()
    this.canvas.requestRenderAll()
    this.commit()
  }

  /*
   * Well plate maps (BIO-98). The plate draws itself from its settings; these
   * change them (one undo step each) and paint its wells: with a condition
   * picked in its properties, a press on a well starts a box that fills the
   * wells it covers on release, and a row letter or column number fills its
   * whole row or column. Escape or letting go of the plate stops painting.
   */

  /** The selected well plate, if it can be changed. */
  private onlyPlate(): WellPlate | undefined {
    const only = this.onlySelected()
    return only instanceof WellPlate && !isLocked(only) && !this.isTyping() ? only : undefined
  }

  /** Paint the selected plate's wells with a condition (null: empty them), or stop painting (undefined). */
  setPlateBrush(id: string | null | undefined): void {
    const before = this.plateBrush?.plate
    const plate = id === undefined ? undefined : this.onlyPlate()
    this.plateBrush = plate && id !== undefined ? { plate, id } : undefined
    for (const each of new Set([before, plate])) if (each) each.hoverCursor = this.plateBrush?.plate === each ? 'crosshair' : null
    this.emit()
  }

  /** Change the selected plate's settings (look, size, labels, legend). `mergeKey` joins quick changes into one undo step. */
  setPlate(change: Partial<Omit<PlateSettings, 'wells'>> & { wells?: WellCount }, mergeKey?: string): void {
    const plate = this.onlyPlate()
    if (!plate) return
    // A new size keeps the wells that still exist, and about the plate's width.
    const sized = change.wells !== undefined && change.wells !== plate.plate.wells ? resizedPlate(plate.plate, change.wells) : {}
    plate.setPlate({ ...change, ...sized })
    this.followConnectors()
    this.canvas.requestRenderAll()
    this.commit(mergeKey)
  }

  /** Add a condition to the selected plate, in the next colour it doesn't use yet, and paint with it. Returns its id. */
  addPlateCondition(): string | undefined {
    const plate = this.onlyPlate()
    if (!plate) return undefined
    const { conditions } = plate.plate
    const used = new Set(conditions.map((condition) => condition.colour.toLowerCase()))
    const colour = NEW_CONDITION_COLOURS.find((each) => !used.has(each)) ?? '#71717a'
    let n = conditions.length + 1
    while (conditions.some((condition) => condition.name === `Condition ${n}`)) n++
    const condition: PlateCondition = { id: newId(), name: `Condition ${n}`, colour, short: String(n) }
    plate.setPlate({ conditions: [...conditions, condition] })
    this.plateBrush = { plate, id: condition.id }
    plate.hoverCursor = 'crosshair'
    this.canvas.requestRenderAll()
    this.commit()
    return condition.id
  }

  /** Change one of the selected plate's conditions (name, colour, short label). */
  updatePlateCondition(id: string, change: Partial<Omit<PlateCondition, 'id'>>, mergeKey?: string): void {
    const plate = this.onlyPlate()
    if (!plate) return
    plate.setPlate({ conditions: plate.plate.conditions.map((condition) => (condition.id === id ? { ...condition, ...change } : condition)) })
    this.canvas.requestRenderAll()
    this.commit(mergeKey)
  }

  /** Take a condition off the selected plate; its wells become empty. Says whether it did. */
  removePlateCondition(id: string): boolean {
    const plate = this.onlyPlate()
    if (!plate || !plate.plate.conditions.some((condition) => condition.id === id)) return false
    const map = Object.fromEntries(Object.entries(plate.plate.map).filter(([, each]) => each !== id))
    plate.setPlate({ conditions: plate.plate.conditions.filter((condition) => condition.id !== id), map })
    if (this.plateBrush?.plate === plate && this.plateBrush.id === id) this.setPlateBrush(undefined)
    this.canvas.requestRenderAll()
    this.commit()
    return true
  }

  /** A press on the painted plate: a row or column fills at once; a well starts a box. Says whether it took the press. */
  private startPlatePaint(point: XY, target: FabricObject | undefined): boolean {
    const brush = this.plateBrush
    if (!brush || target !== brush.plate || this.activeBeforeClick !== target || this.canvas._currentTransform?.corner) return false
    const part = brush.plate.partAt(point)
    if (!part) return false
    // The plate stays put: this press paints.
    this.canvas._currentTransform = null
    const { rows, cols } = brush.plate.plateGeometry
    if ('row' in part || 'col' in part) {
      const wells = 'row' in part ? Array.from({ length: cols }, (_, c) => wellName(part.row, c)) : Array.from({ length: rows }, (_, r) => wellName(r, part.col))
      this.paintWells(brush.plate, wells, brush.id)
      return true
    }
    this.plateDrag = { plate: brush.plate, from: part.well, to: part.well }
    this.showPlatePaint()
    return true
  }

  private dragPlatePaint(point: XY): void {
    const drag = this.plateDrag
    if (!drag) return
    const to = drag.plate.nearestWell(point)
    if (to.r === drag.to.r && to.c === drag.to.c) return
    drag.to = to
    this.showPlatePaint()
  }

  /** The wells under the box show the brush's colour while the box is dragged. */
  private showPlatePaint(): void {
    const drag = this.plateDrag
    const brush = this.plateBrush
    if (!drag || !brush) return
    const colour = brush.id === null ? null : (drag.plate.plate.conditions.find((condition) => condition.id === brush.id)?.colour ?? null)
    drag.plate.preview = { wells: new Set(this.boxWells(drag)), colour, box: { r0: drag.from.r, c0: drag.from.c, r1: drag.to.r, c1: drag.to.c } }
    drag.plate.set({ dirty: true })
    this.canvas.requestRenderAll()
  }

  private endPlatePaint(): void {
    const drag = this.plateDrag
    this.plateDrag = undefined
    if (!drag) return
    drag.plate.preview = undefined
    this.paintWells(drag.plate, this.boxWells(drag), this.plateBrush?.id ?? null)
  }

  private boxWells({ from, to }: { from: { r: number; c: number }; to: { r: number; c: number } }): string[] {
    const wells: string[] = []
    for (let r = Math.min(from.r, to.r); r <= Math.max(from.r, to.r); r++) for (let c = Math.min(from.c, to.c); c <= Math.max(from.c, to.c); c++) wells.push(wellName(r, c))
    return wells
  }

  /** Give wells a condition (null: empty them). One undo step; nothing when nothing changes. */
  private paintWells(plate: WellPlate, wells: readonly string[], id: string | null): void {
    const map = { ...plate.plate.map }
    let changed = false
    for (const well of wells) {
      if ((map[well] ?? null) === id) continue
      changed = true
      if (id === null) delete map[well]
      else map[well] = id
    }
    plate.set({ dirty: true })
    if (changed) {
      plate.setPlate({ map })
      this.followConnectors()
    }
    this.canvas.requestRenderAll()
    if (changed) this.commit()
    else this.emit()
  }

  /**
   * Turn the selected well plate into plain shapes and text where it is
   * (rim, wells, letters, numbers, legend), all selected. One undo step.
   */
  detachPlate(): boolean {
    const plate = this.onlyPlate()
    if (!plate) return false
    const index = this.canvas.getObjects().indexOf(plate)
    const outer = panelIdOf(plate)
    this.setPlateBrush(undefined)
    this.canvas.discardActiveObject()
    const parts = detachedPlateParts(plate)
    this.canvas.remove(plate)
    for (const part of parts) {
      ;(part as Own).figureId = newId()
      setPanelId(part, outer)
    }
    this.canvas.insertAt(Math.max(0, index), ...parts)
    this.select(parts)
    this.canvas.requestRenderAll()
    this.commit()
    return true
  }

  /*
   * Legends (BIO-106). A legend draws itself from its settings, like a well
   * plate; these change it. Corners resize it (its text size), the "+" adds
   * a row like the last one.
   */

  /** A legend doesn't turn and resizes from its corners; its "+" (under it, or right of it across) adds a row. */
  private legendRules(legend: LegendBlock): void {
    const across = legend.legend.layout === 'across'
    const { tl, tr, bl, br } = legend.controls
    legend.controls = {
      ...(tl && { tl }),
      ...(tr && { tr }),
      ...(bl && { bl }),
      ...(br && { br }),
      addRow: new FabricControl({
        x: across ? 0.5 : 0,
        y: across ? 0 : 0.5,
        offsetX: across ? 22 : 0,
        offsetY: across ? 0 : 22,
        sizeX: 24,
        sizeY: 24,
        cursorStyle: 'pointer',
        actionName: 'addRow',
        mouseUpHandler: (_event, transform) => {
          if (transform.target === legend) this.addLegendRow()
          return true
        },
        render: (ctx, left, top) => drawPlus(ctx, left, top),
      }),
    }
    legend.setCoords()
  }

  /** The selected legend, unless it is locked or text is being typed. */
  private onlyLegend(): LegendBlock | undefined {
    const only = this.onlySelected()
    return only instanceof LegendBlock && !isLocked(only) && !this.isTyping() ? only : undefined
  }

  /** Change the selected legend (look, layout, colour, title, size). One undo step; `mergeKey` joins quick changes. */
  setLegend(change: Partial<Omit<LegendSettings, 'rows'>>, mergeKey?: string): void {
    const legend = this.onlyLegend()
    if (!legend) return
    // A new look or layout stays round the legend's middle, as other blocks' styles do.
    const middle = legend.getCenterPoint()
    // A new look keeps the legend's box: it takes the biggest size that fits (owner's feedback, 2026-11-26).
    if (change.look !== undefined && change.look !== legend.legend.look && change.size === undefined) {
      const kept = legend.styleBox
      const same = kept && Math.abs(kept.after.width - legend.width) < 0.5 && Math.abs(kept.after.height - legend.height) < 0.5
      const box = same ? kept.box : { width: legend.width, height: legend.height }
      change = { ...change, size: sizeToFit({ ...legend.legend, ...change }, box) }
      legend.setLegend(change)
      legend.styleBox = { box, after: { width: legend.width, height: legend.height } }
    }
    legend.setLegend(change)
    if (change.look !== undefined || change.layout !== undefined) {
      legend.setPositionByOrigin(middle, 'center', 'center')
      legend.setCoords()
    }
    if (change.layout !== undefined) this.legendRules(legend)
    this.followConnectors()
    this.canvas.requestRenderAll()
    this.commit(mergeKey)
  }

  /** Add a row to the selected legend: like the last one, or an icon or colour row. Returns its id. */
  addLegendRow(kind?: LegendRow['kind']): string | undefined {
    const legend = this.onlyLegend()
    if (!legend) return undefined
    const row = nextLegendRow(legend.legend, kind)
    legend.setLegend({ rows: [...legend.legend.rows, row] })
    this.canvas.requestRenderAll()
    this.commit()
    return row.id
  }

  /** Change one row of the selected legend (label, colour, icon, kind). */
  updateLegendRow(id: string, change: Partial<Omit<LegendRow, 'id'>>, mergeKey?: string): void {
    const legend = this.onlyLegend()
    if (!legend) return
    legend.setLegend({ rows: legend.legend.rows.map((row) => (row.id === id ? { ...row, ...change } : row)) })
    this.canvas.requestRenderAll()
    this.commit(mergeKey)
  }

  /** Take a row off the selected legend; it keeps its last row. Says whether it did. */
  removeLegendRow(id: string): boolean {
    const legend = this.onlyLegend()
    if (!legend || legend.legend.rows.length <= 1 || !legend.legend.rows.some((row) => row.id === id)) return false
    legend.setLegend({ rows: legend.legend.rows.filter((row) => row.id !== id) })
    this.canvas.requestRenderAll()
    this.commit()
    return true
  }

  /**
   * Turn the selected legend into plain shapes, text and library icons where
   * it is, all selected. One undo step. Says whether it did.
   */
  async detachLegend(): Promise<boolean> {
    const legend = this.onlyLegend()
    if (!legend) return false
    const parts: FabricObject[] = []
    for (const piece of detachedLegendParts(legend)) {
      if ('object' in piece) {
        parts.push(piece.object)
        continue
      }
      const { row, left, top, size } = piece.icon
      if (!row.svg) continue
      const { objects, options } = await loadSVGFromString(row.svg)
      const icon = util.groupSVGElements(
        objects.filter((object): object is FabricObject => object !== null),
        options,
      ) as Group
      noteIconOrigin(icon, row.iconId)
      Object.assign(icon, { name: row.label, ...(row.iconId && { iconId: row.iconId }) })
      // The icon fits the square it was drawn in.
      const scale = size / Math.max(icon.width, icon.height, 1)
      icon.set({ scaleX: scale, scaleY: scale })
      icon.setPositionByOrigin(new Point(left + size / 2, top + size / 2), 'center', 'center')
      icon.setCoords()
      parts.push(icon)
    }
    // The legend may have been let go of while the icons loaded.
    if (this.onlySelected() !== legend) return false
    const index = this.canvas.getObjects().indexOf(legend)
    const outer = panelIdOf(legend)
    this.canvas.discardActiveObject()
    this.canvas.remove(legend)
    for (const part of parts) {
      ;(part as Own).figureId = newId()
      setPanelId(part, outer)
    }
    this.canvas.insertAt(Math.max(0, index), ...parts)
    this.select(parts)
    this.canvas.requestRenderAll()
    this.commit()
    return true
  }


  /**
   * Take the selected sequence apart: its arrows, line, cards or ribbon and
   * its labels become plain shapes and text boxes, its steps stay where they
   * are, and all of them end up selected. One undo step. Says whether it did.
   */
  detachSequence(): boolean {
    // A comparison's side selected: the comparison comes apart (BIO-95).
    const picked = this.onlySelected()
    const only = (picked && this.comparisonOf(picked)) ?? picked
    if (!(only instanceof SequenceBlock) || isLocked(only) || this.isTyping()) return false
    const objects = this.canvas.getObjects()
    const index = objects.indexOf(only)
    const steps = this.stepsOf(only)
    const outer = panelIdOf(only)
    this.canvas.discardActiveObject()
    // A comparison's bare sides (Split frame) become panels with a box of their own (BIO-95).
    if (only instanceof ComparisonBlock) for (const side of steps) if (side instanceof ComparisonSide && side.bare) {
      side.bare = false
      updatePanel(side, {})
    }
    const parts = detachedSequenceParts(only)
    this.canvas.remove(only)
    for (const part of parts) {
      ;(part as Own).figureId = newId()
      setPanelId(part, outer)
    }
    this.canvas.insertAt(Math.max(0, index), ...parts)
    for (const step of steps) setPanelId(step, outer)
    this.select([...parts, ...steps])
    this.canvas.requestRenderAll()
    this.commit()
    return true
  }

  /**
   * Change the selected panel's settings (title, style, colour, padding). A
   * new colour also goes onto the panel's own arrows. One undo step;
   * `mergeKey` joins quick changes (typing the title, the padding slider) into one.
   */
  setPanel(change: Partial<PanelSettings>, mergeKey?: string): void {
    const panel = this.onlySelected()
    if (!(panel instanceof PanelBlock) || isLocked(panel)) return
    updatePanel(panel, change)
    if (change.colour !== undefined) for (const arrow of contentsOf(panel, this.canvas.getObjects())) tintArrow(arrow, change.colour)
    this.canvas.requestRenderAll()
    this.commit(mergeKey)
  }

  /**
   * Turn the selected panel into plain shapes (its box, header strip or
   * stripe, and its title as a text box), with what it held loose on the
   * page; all of them end up selected. One undo step. Says whether it did.
   */
  detachPanel(): boolean {
    const panel = this.onlySelected()
    if (!(panel instanceof PanelBlock) || isLocked(panel) || this.isTyping()) return false
    const objects = this.canvas.getObjects()
    const index = objects.indexOf(panel)
    const contents = contentsOf(panel, objects)
    const shapes = panel instanceof GridBlock ? detachedGridShapes(panel) : detachedShapes(panel)
    const outer = panelIdOf(panel)
    this.canvas.discardActiveObject()
    this.canvas.remove(panel)
    // The shapes take the panel's place in the stack (and its own panel, if it sat in one); its contents keep theirs.
    for (const shape of shapes) {
      ;(shape as Own).figureId = newId()
      setPanelId(shape, outer)
    }
    this.canvas.insertAt(Math.max(0, index), ...shapes)
    for (const object of contents) setPanelId(object, outer)
    this.select([...shapes, ...contents])
    this.canvas.requestRenderAll()
    this.commit()
    return true
  }

  /**
   * Change the selected figure grid's settings (letters, legend, gap) (BIO-86).
   * One undo step; `mergeKey` joins quick changes (the gap slider) into one.
   */
  setFigureGrid(change: Partial<GridSettings>, mergeKey?: string): void {
    const grid = this.onlySelected()
    if (!(grid instanceof GridBlock) || isLocked(grid)) return
    updateGrid(grid, change, this.canvas.getObjects())
    this.followConnectors()
    this.canvas.requestRenderAll()
    this.commit(mergeKey)
  }

  /** Switch the selected figure grid to another layout: new places get empty chart spaces, spare empty ones go. One undo step. */
  setGridLayout(layout: GridLayoutId): void {
    const grid = this.onlySelected()
    if (!(grid instanceof GridBlock) || isLocked(grid)) return
    const change = changeLayout(grid, layout, this.canvas.getObjects())
    if (!change) return
    for (const object of change.remove) this.canvas.remove(object)
    // New spaces sit just above the grid's other contents.
    for (const space of change.add) {
      setPanelId(space, idOf(grid))
      this.add(space, false)
      this.canvas.moveObjectTo(space, this.canvas.getObjects().indexOf(grid) + 1)
    }
    this.canvas.setActiveObject(grid)
    this.followConnectors()
    this.canvas.requestRenderAll()
    this.commit()
  }

  /** The one selected empty chart space: it waits for a chart picked in the Graph panel (BIO-86). */
  waitingChartSpace(): ContentSpace | undefined {
    const only = this.onlySelected()
    return only instanceof ContentSpace && !isLocked(only) && !this.isTyping() ? only : undefined
  }

  /**
   * Fill the selected empty chart space with a new chart of this kind: the
   * chart takes the space's box, block and place in the stack, and is
   * selected. One undo step.
   */
  fillChartSpace(kind: ChartKind): ChartObject | undefined {
    const space = this.waitingChartSpace()
    if (!space) return undefined
    this.chartChoice = { ...this.chartChoice, kind }
    const box = contentBox(space)
    const number = this.canvas.getObjects().filter((object) => object instanceof ChartObject).length + 1
    const chart = new ChartObject({ chart: createChart(kind, this.chartChoice.errorBars, { width: box.width, height: box.height }, `Chart ${number}`), left: box.x, top: box.y })
    setPanelId(chart, panelIdOf(space))
    const index = this.canvas.getObjects().indexOf(space)
    this.canvas.discardActiveObject()
    this.canvas.remove(space)
    this.add(chart, false)
    // Placed once added, so its box is measured as drawn.
    chart.setPositionByOrigin(new Point(box.x, box.y), 'left', 'top')
    chart.setCoords()
    this.canvas.moveObjectTo(chart, index)
    this.setTool('select')
    this.canvas.setActiveObject(chart)
    this.canvas.requestRenderAll()
    this.commit()
    return chart
  }

  /*
   * Callout blocks (BIO-97): a zoom inset with its marker, and a labelled
   * icon. Their parts point at them with `panelId`, like a panel's contents;
   * these keep them tidy whenever a part moves or a setting changes.
   */

  /** The zoom inset an object is or belongs to: the inset itself, its marker or what it holds. */
  private insetOf(object: FabricObject | undefined): CalloutInset | undefined {
    if (!object) return undefined
    if (object instanceof CalloutInset) return object
    if (object instanceof CalloutMarker) return insetOfMarker(object, this.canvas.getObjects())
    const holder = this.holdersById().get(panelIdOf(object) ?? '')
    return holder instanceof CalloutInset ? holder : undefined
  }

  /** The labelled icon an object is or belongs to: the block itself, its subject or one of its labels. */
  private labelBlockOf(object: FabricObject | undefined): CalloutLabels | undefined {
    if (!object) return undefined
    if (object instanceof CalloutLabels) return object
    const holder = this.holdersById().get(panelIdOf(object) ?? '')
    return holder instanceof CalloutLabels ? holder : undefined
  }

  private calloutInfo(object: FabricObject): CalloutInfo | undefined {
    const objects = this.canvas.getObjects()
    const inset = this.insetOf(object)
    if (inset) {
      const marker = markerOf(inset, objects)
      return { kind: 'inset', settings: insetSettingsOf(inset), insetSize: insetSizeOf(inset), markerSize: marker ? markerSizeOf(marker) : NEW_MARKER_SIZE }
    }
    const block = this.labelBlockOf(object)
    return block && { kind: 'labels', settings: labelSettingsOf(block), labels: labelParts(block, objects).labels.map((label) => label.text) }
  }

  /** Draw a labelled icon's look again round its subject and labels; `dragged` is a label being moved. */
  private layOutLabelBlock(block: CalloutLabels, dragged?: FabricObject): void {
    const { subject, labels } = labelParts(block, this.canvas.getObjects())
    layOutLabels(block, subject, labels, plainBox, dragged)
    // The look (lines, dots, chips) sits just above its icon, so a dot on the icon shows (owner's feedback, 2026-11-26); the labels stay above it.
    const objects = this.canvas.getObjects()
    if (subject && !block.group && !subject.group && objects.indexOf(block) < objects.indexOf(subject)) this.canvas.moveObjectTo(block, objects.indexOf(subject))
    this.labelRules(block)
  }

  /** While a label or subject of a labelled icon is dragged or typed in: the look follows. The icon in a zoom inset takes the inset along (its marker stays). */
  private calloutsFollow(target: FabricObject | undefined): void {
    if (!target || target instanceof ActiveSelection || target instanceof CalloutLabels || target instanceof CalloutInset || target instanceof CalloutMarker) return
    const inset = this.insetOf(target)
    if (inset) {
      const room = insetRoom(inset)
      const centre = target.getCenterPoint()
      inset.set({ left: inset.left + centre.x - (room.x + room.width / 2), top: inset.top + centre.y - (room.y + room.height / 2) })
      inset.setCoords()
      return
    }
    const block = this.labelBlockOf(target)
    if (block && !block.group) this.layOutLabelBlock(block, target)
  }

  /** A zoom inset, its marker or what it holds: moved and resized freely, never snapping to guide lines (owner's feedback, 2026-11-26). */
  private movesFreely(target: FabricObject): boolean {
    return target instanceof CalloutInset || target instanceof CalloutMarker || this.insetOf(target) !== undefined
  }

  /** How much an inset magnifies at a size: its size over its marker's. */
  private zoomFor(inset: CalloutInset, size = insetSizeOf(inset)): number {
    const marker = markerOf(inset, this.canvas.getObjects())
    return marker ? size / markerSizeOf(marker) : 1
  }

  /** Put what an inset holds in its middle, as big as fits. */
  private fitInset(inset: CalloutInset): void {
    for (const object of contentsOf(inset, this.canvas.getObjects())) if (!(object instanceof CalloutMarker) && !object.group) fitInsetContent(inset, object)
  }

  /** While a zoom inset or marker is resized, the stretch goes into its size; a labelled icon's subject being resized takes its lines along. */
  private calloutScaling(target: FabricObject, originX: 'left' | 'center' | 'right', originY: 'top' | 'center' | 'bottom'): void {
    if (target instanceof CalloutInset) {
      bakeInsetScale(target, (size) => this.zoomFor(target, size), originX, originY)
      this.fitInset(target)
    } else if (target instanceof CalloutMarker) {
      bakeMarkerScale(target, originX, originY)
      const inset = this.insetOf(target)
      // The frame look's zoom tag says how much it magnifies.
      if (inset && insetSettingsOf(inset).look === 'frame') redrawInset(inset, this.zoomFor(inset))
    } else this.calloutsFollow(target)
  }

  /** A callout's handles: an inset and marker resize from their corners; what an inset holds stays in its middle. */
  private calloutRules(object: FabricObject): void {
    if (object instanceof CalloutInset || object instanceof CalloutMarker) {
      object.set({ lockRotation: true, lockSkewingX: true, lockSkewingY: true })
      object.setControlsVisibility({ ml: false, mr: false, mt: false, mb: false, mtr: false })
      // A pin's dot has no handles: the marked area's size is set in the properties.
      if (object instanceof CalloutMarker) object.hasControls = object.markerLook !== 'pin'
      return
    }
    if (object instanceof CalloutLabels) return this.labelRules(object)
    const id = panelIdOf(object)
    const holder = id && this.canvas.getObjects().find((other) => other instanceof CalloutInset && idOf(other) === id)
    // What a zoom inset holds is sized by the inset; dragging it drags the inset.
    if (holder) object.set({ hasControls: false })
  }

  /** A labelled icon's handles: a dot on each label's spot to drag it about the subject, and a "+" that adds a label. */
  private labelRules(block: CalloutLabels): void {
    block.set({ lockRotation: true, lockScalingX: true, lockScalingY: true, lockSkewingX: true, lockSkewingY: true })
    const { labels } = labelParts(block, this.canvas.getObjects())
    const subjectBox = () => {
      const subject = labelParts(block, this.canvas.getObjects()).subject
      return subject && plainBox(subject)
    }
    const controls: Record<string, FabricControl> = {}
    labels.forEach((label, i) => {
      controls[`spot${i}`] = new FabricControl({
        sizeX: 14,
        sizeY: 14,
        cursorStyle: 'move',
        actionName: 'moveLabelSpot',
        positionHandler: () => {
          const box = subjectBox()
          const point = box ? partPoint(label, box) : label.getCenterPoint()
          return util.transformPoint(new Point(point.x, point.y), this.canvas.viewportTransform)
        },
        actionHandler: (eventData) => {
          const box = subjectBox()
          if (!box) return false
          const point = this.canvas.getScenePoint(eventData)
          const share = (value: number) => Math.min(1, Math.max(0, value))
          label.calloutPart = { x: share((point.x - box.x) / Math.max(1, box.width)), y: share((point.y - box.y) / Math.max(1, box.height)) }
          const { subject } = labelParts(block, this.canvas.getObjects())
          layOutLabels(block, subject, labels, plainBox)
          return true
        },
        render: (ctx, left, top) => {
          ctx.save()
          ctx.fillStyle = '#ffffff'
          ctx.strokeStyle = DROP_RING.colour
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.arc(left, top, 4.5, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()
          ctx.restore()
        },
      })
    })
    controls.addLabel = new FabricControl({
      x: 0,
      y: 0.5,
      offsetY: 22,
      sizeX: 24,
      sizeY: 24,
      cursorStyle: 'pointer',
      actionName: 'addLabel',
      mouseUpHandler: (_event, transform) => {
        if (transform.target === block) this.addCalloutLabel()
        return true
      },
      render: (ctx, left, top) => {
        ctx.save()
        ctx.fillStyle = '#ffffff'
        ctx.strokeStyle = DROP_RING.colour
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(left, top, 11, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        ctx.lineWidth = 1.75
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(left - 5, top)
        ctx.lineTo(left + 5, top)
        ctx.moveTo(left, top - 5)
        ctx.lineTo(left, top + 5)
        ctx.stroke()
        ctx.restore()
      },
    })
    block.controls = controls
    block.setCoords()
  }

  /**
   * After every change: an inset whose marker went goes too (with what it
   * holds), insets take any stretch into their size and fit what they hold,
   * and labelled icons draw their look again (an empty one goes). Says
   * whether anything changed.
   */
  private syncCallouts(): boolean {
    const objects = this.canvas.getObjects()
    let changed = false
    for (const inset of objects.filter((object): object is CalloutInset => object instanceof CalloutInset)) {
      const markers = allObjects(objects).filter((object): object is CalloutMarker => object instanceof CalloutMarker && panelIdOf(object) === idOf(inset))
      const [marker, ...extra] = markers
      if (!marker) {
        this.canvas.remove(...withDescendants([inset], objects))
        changed = true
        continue
      }
      // A marker pasted on its own would be a second marker of the same inset.
      const loose = extra.filter((object) => !object.group)
      if (loose.length > 0) {
        this.canvas.remove(...loose)
        changed = true
      }
      if (inset.group) continue
      if (!marker.group && (marker.scaleX !== 1 || marker.scaleY !== 1)) {
        bakeMarkerScale(marker)
        changed = true
      }
      const settings = insetSettingsOf(inset)
      if (inset.scaleX !== 1 || inset.scaleY !== 1) {
        bakeInsetScale(inset, (size) => this.zoomFor(inset, size))
        changed = true
      } else if (settings.look === 'frame' && settings.tag) {
        redrawInset(inset, this.zoomFor(inset))
        changed = true
      }
      this.fitInset(inset)
    }
    for (const block of objects.filter((object): object is CalloutLabels => object instanceof CalloutLabels)) {
      if (contentsOf(block, objects).length === 0) {
        this.canvas.remove(block)
        changed = true
        continue
      }
      if (block.group) continue
      this.layOutLabelBlock(block)
      changed = true
    }
    return changed
  }

  /**
   * Change the selected zoom inset's settings (look, what it shows, colour,
   * tag, caption); its marker takes the look and colour. Showing a magnified
   * copy takes the icon out; showing an icon again puts an empty icon space
   * in. One undo step; `mergeKey` joins quick changes (typing the caption).
   */
  setInset(change: Partial<InsetSettings>, mergeKey?: string): void {
    const inset = this.insetOf(this.onlySelected())
    if (!inset || isLocked(inset) || this.isTyping()) return
    const objects = this.canvas.getObjects()
    const settings = { ...insetSettingsOf(inset), ...change }
    inset.inset = settings
    const marker = markerOf(inset, objects)
    if (marker && (change.look !== undefined || change.colour !== undefined)) {
      redrawMarker(marker, { look: settings.look, colour: settings.colour })
      this.calloutRules(marker)
    }
    redrawInset(inset, this.zoomFor(inset))
    const held = contentsOf(inset, objects).filter((object) => !(object instanceof CalloutMarker))
    if (settings.shows === 'copy' && held.length > 0) {
      if (held.some((object) => this.canvas.getActiveObjects().includes(object))) this.canvas.setActiveObject(inset)
      this.canvas.remove(...withDescendants(held, objects))
    }
    if (settings.shows === 'icon' && held.length === 0) {
      const space = insetSpace(inset)
      setPanelId(space, idOf(inset))
      this.add(space, false)
      this.canvas.moveObjectTo(space, this.canvas.getObjects().indexOf(inset) + 1)
      this.calloutRules(space)
    }
    if (change.colour !== undefined) for (const object of held) if (object instanceof IconSpace) tintIconSpace(object, settings.colour)
    this.fitInset(inset)
    this.canvas.requestRenderAll()
    this.commit(mergeKey)
  }

  /** Give the selected zoom inset or its marker a new size (page pixels). One undo step; `mergeKey` joins slider moves. */
  setInsetSizes(size: { inset?: number; marker?: number }, mergeKey?: string): void {
    const inset = this.insetOf(this.onlySelected())
    if (!inset || isLocked(inset)) return
    const marker = markerOf(inset, this.canvas.getObjects())
    if (size.inset !== undefined) inset.insetSize = Math.min(INSET_SIZE_RANGE.max, Math.max(INSET_SIZE_RANGE.min, size.inset))
    if (size.marker !== undefined && marker) redrawMarker(marker, { size: size.marker })
    redrawInset(inset, this.zoomFor(inset))
    this.fitInset(inset)
    this.canvas.requestRenderAll()
    this.commit(mergeKey)
  }

  /** Change the selected labelled icon's settings (look, colour); its labels take the look's text colour. One undo step. */
  setLabels(change: Partial<LabelSettings>, mergeKey?: string): void {
    const block = this.labelBlockOf(this.onlySelected())
    if (!block || isLocked(block) || this.isTyping()) return
    const settings = { ...labelSettingsOf(block), ...change }
    block.labelBlock = settings
    if (change.look !== undefined || change.colour !== undefined) for (const label of labelParts(block, this.canvas.getObjects()).labels) label.set(labelTextLook(settings.look, settings.colour))
    this.layOutLabelBlock(block)
    this.canvas.requestRenderAll()
    this.commit(mergeKey)
  }

  /**
   * Add a label to the selected labelled icon (or the one the selected
   * label or icon is in): beside the subject on the side with fewer labels,
   * pointing at the subject's edge on that side. The block stays selected.
   * One undo step.
   */
  addCalloutLabel(): void {
    const block = this.labelBlockOf(this.onlySelected())
    if (!block || isLocked(block) || this.isTyping()) return
    const objects = this.canvas.getObjects()
    const { subject, labels } = labelParts(block, objects)
    if (!subject) return
    const place = nextLabelPlace(plainBox(subject), labels)
    const label = makeLabel(`Label ${labels.length + 1}`, place.part, place.at, labelSettingsOf(block))
    if (!place.right) label.set({ left: place.at.x - label.width })
    label.setCoords()
    setPanelId(label, idOf(block))
    const index = Math.max(...[block, subject, ...labels].map((object) => objects.indexOf(object))) + 1
    this.add(label, false)
    this.canvas.moveObjectTo(label, index)
    this.layOutLabelBlock(block)
    this.canvas.discardActiveObject()
    this.canvas.setActiveObject(block)
    this.canvas.requestRenderAll()
    this.commit()
  }

  /** Remove one label (first 0) of the selected labelled icon; it keeps its last one. One undo step. Says whether it did. */
  removeCalloutLabel(index: number): boolean {
    const block = this.labelBlockOf(this.onlySelected())
    if (!block || isLocked(block) || this.isTyping()) return false
    const { labels } = labelParts(block, this.canvas.getObjects())
    const label = labels.at(index)
    if (!label || labels.length < 2) return false
    this.canvas.discardActiveObject()
    this.canvas.remove(label)
    this.layOutLabelBlock(block)
    this.canvas.setActiveObject(block)
    this.canvas.requestRenderAll()
    this.commit()
    return true
  }

  /** Change one label's text (first 0) of the selected labelled icon. Quick changes join into one undo step. */
  setCalloutLabel(index: number, text: string): void {
    const block = this.labelBlockOf(this.onlySelected())
    if (!block || isLocked(block)) return
    const label = labelParts(block, this.canvas.getObjects()).labels.at(index)
    if (!label) return
    label.set({ text, name: text })
    label.setCoords()
    this.layOutLabelBlock(block)
    this.canvas.requestRenderAll()
    this.commit(`callout-label-${index}`)
  }

  /**
   * Take the selected callout apart into plain shapes and text where they
   * are: an inset's frame, lines, tag, caption and marker (a magnified copy
   * becomes copies of what it showed, clipped to the inset), or a labelled
   * icon's lines, dots, chips and badges. What it held stays, now loose; all
   * of it ends up selected. One undo step. Says whether it did.
   */
  async detachCallout(): Promise<boolean> {
    const only = this.onlySelected()
    if (!only || isLocked(only) || this.isTyping()) return false
    const inset = this.insetOf(only)
    const block = inset ? undefined : this.labelBlockOf(only)
    const holder = inset ?? block
    if (!holder) return false
    const objects = this.canvas.getObjects()
    const outer = panelIdOf(holder)
    let made: FabricObject[] = []
    let loose: FabricObject[] = []
    if (inset) {
      const marker = markerOf(inset, objects)
      loose = contentsOf(inset, objects).filter((object) => !(object instanceof CalloutMarker))
      // The copy is made while the inset still has its parts (they say where it is).
      const copy = insetSettingsOf(inset).shows === 'copy' && marker ? await frozenCopy(inset, marker, (parts) => new FigureGroup(parts), OWN_PROPERTIES) : undefined
      this.canvas.discardActiveObject()
      made = detachedInsetParts(inset, marker)
      const frame = made.find((part) => (part as Own & { name?: string }).name === 'Inset circle' || (part as Own & { name?: string }).name === 'Inset frame')
      if (copy && frame) {
        frame.set({ fill: '#ffffff' })
        made.splice(made.indexOf(frame) + 1, 0, copy)
      }
      const index = this.canvas.getObjects().indexOf(inset)
      this.canvas.remove(inset, ...(marker ? [marker] : []))
      this.canvas.insertAt(Math.max(0, index), ...made)
    } else if (block) {
      loose = contentsOf(block, objects)
      this.canvas.discardActiveObject()
      const index = objects.indexOf(block)
      made = detachedLabelParts(block)
      this.canvas.remove(block)
      this.canvas.insertAt(Math.max(0, index), ...made)
      for (const label of loose) if (isCalloutLabel(label)) delete (label as FabricObject & { calloutPart?: unknown }).calloutPart
    }
    for (const part of made) {
      ;(part as Own).figureId = newId()
      setPanelId(part, outer)
    }
    for (const object of loose) {
      setPanelId(object, outer)
      object.set({ hasControls: true })
    }
    this.select([...made, ...loose])
    this.canvas.requestRenderAll()
    this.commit()
    return true
  }

  /** Start moving these objects: what the panels among them carry along (BIO-74). */
  private startCarry(moved: readonly FabricObject[], target?: FabricObject): Carry | undefined {
    const objects = this.canvas.getObjects()
    const all = withDescendants(moved, objects)
    const movedSet = new Set(moved)
    const skipped = new Set(all)
    const panels = new Map<Holder, XY>()
    for (const object of moved) {
      if (!isHolder(object)) continue
      const body = holderBox(object)
      panels.set(object, { x: body.x, y: body.y })
    }
    // A zoom marker stays on its spot while its inset is dragged (it comes along when a panel holding both moves).
    // Grabbed in the area between marker and inset (not on the inset itself), the whole callout moves.
    const press = this.pressPoint
    const onInset = (inset: CalloutInset) => {
      if (target !== inset || !press) return true
      const box = inset.getBoundingRect()
      return press.x >= box.left && press.x <= box.left + box.width && press.y >= box.top && press.y <= box.top + box.height
    }
    const stays = (object: FabricObject) => object instanceof CalloutMarker && [...movedSet].some((moved) => moved instanceof CalloutInset && idOf(moved) === panelIdOf(object) && onInset(moved))
    const followers = new Map(all.filter((object) => !movedSet.has(object) && !stays(object)).map((object) => [object, { x: object.left, y: object.top }] as const))
    const holders = this.holdersById()
    const locked = new Map(
      moved.flatMap((object) => {
        const id = panelIdOf(object)
        const holder = id === undefined ? undefined : holders.get(id)
        return id !== undefined && holder && !skipped.has(holder) && !freeInBlock(object, holder) ? [[object, id] as const] : []
      }),
    )
    const arrows = new Map(
      allObjects(all)
        .filter((object) => object instanceof Connector)
        .map((arrow) => [arrow, { attachStart: arrow.attachStart, attachStartSide: arrow.attachStartSide, attachEnd: arrow.attachEnd, attachEndSide: arrow.attachEndSide }] as const),
    )
    const start = target && { target, left: target.left, top: target.top, arrows }
    return { moved: movedSet, panels, followers, skipped, locked, start }
  }

  /** The slots of a block, which its things trade places between: a sequence's steps, a grid's cells, or what a panel holds besides arrows and lines. */
  private slotsOf(holder: Holder): FabricObject[] {
    if (holder instanceof SequenceBlock) return this.stepsOf(holder)
    const objects = this.canvas.getObjects()
    if (holder instanceof GridBlock) return cellsOf(holder, objects)
    return contentsOf(holder, objects).filter((object) => object.visible && !(object instanceof Connector || object instanceof Arrow || object instanceof Line))
  }

  /**
   * While dragging one thing in a block: the other slot of its block under the
   * pointer, that it would trade places with. Several dragged together, or
   * something that isn't a slot (an arrow in a panel), trade with nothing.
   */
  private swapTargetAt(carry: Carry, point: XY): FabricObject | undefined {
    const only = carry.start?.target
    const id = only && carry.moved.size === 1 ? carry.locked.get(only) : undefined
    const holder = id === undefined ? undefined : this.holdersById().get(id)
    if (!only || !holder) return undefined
    const slots = this.slotsOf(holder)
    if (!slots.includes(only)) return undefined
    return slots.toReversed().find((slot) => {
      if (slot === only) return false
      const box = cellBox(slot)
      return point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height
    })
  }

  /**
   * Let go of something dragged in its block: it trades places with the slot
   * it was let go over, or, anywhere else, jumps back. Grid cells trade boxes
   * (size too); other things trade middles, and a sequence lines up again.
   */
  private tradePlaces(carry: Carry, other: FabricObject | undefined): void {
    this.putBack(carry)
    const only = carry.start?.target
    const holder = only && this.holdersById().get(carry.locked.get(only) ?? '')
    if (!only || !other || !holder) return
    if (holder instanceof GridBlock) {
      const [a, b] = [cellBox(only), cellBox(other)]
      setCellBox(only, b)
      setCellBox(other, a)
    } else {
      // In a pathway the size goes with the place (the receptor's is bigger): the two take each other's size (owner's feedback, 2026-11-26).
      if (holder instanceof PathwayBlock) {
        const [sizeA, sizeB] = [stepSize(only), stepSize(other)]
        this.sizeStepTo(only, sizeB)
        this.sizeStepTo(other, sizeA)
      }
      const [a, b] = [only.getCenterPoint(), other.getCenterPoint()]
      this.shiftWithContents(only, b.x - a.x, b.y - a.y)
      this.shiftWithContents(other, a.x - b.x, a.y - b.y)
      if (holder instanceof SequenceBlock) this.relayOut([idOf(holder)])
    }
    this.followConnectors()
    this.canvas.requestRenderAll()
  }

  /** Move an object, and what it holds if it is a panel or sequence, by so much. */
  private shiftWithContents(object: FabricObject, dx: number, dy: number): void {
    for (const each of withDescendants([object], this.canvas.getObjects())) {
      each.set({ left: each.left + dx, top: each.top + dy })
      each.setCoords()
    }
  }

  /** A drag that would have pulled something out of its block: everything goes back where it was. */
  private putBack(carry: Carry): void {
    const start = carry.start
    if (!start) return
    start.target.set({ left: start.left, top: start.top })
    start.target.setCoords()
    if (start.target instanceof ActiveSelection) for (const object of start.target.getObjects()) object.setCoords()
    this.applyCarry(carry)
    for (const [arrow, ends] of start.arrows) arrow.set(ends)
    this.followConnectors()
    this.canvas.requestRenderAll()
  }

  /** The panels and sequences on the page, by id. */
  private holdersById(): Map<string, Holder> {
    return new Map(this.canvas.getObjects().flatMap((object) => (isHolder(object) && idOf(object) ? [[idOf(object)!, object] as const] : [])))
  }

  /** Move what the moved panels and sequences hold by as much as its nearest moved holder has moved. */
  private applyCarry(carry: Carry): void {
    if (carry.followers.size === 0) return
    const byId = this.holdersById()
    for (const [object, start] of carry.followers) {
      let holder = byId.get(panelIdOf(object) ?? '')
      while (holder && !carry.panels.has(holder)) holder = byId.get(panelIdOf(holder) ?? '')
      const from = holder && carry.panels.get(holder)
      if (!holder || !from) continue
      const body = holderBox(holder)
      object.set({ left: start.x + body.x - from.x, top: start.y + body.y - from.y })
      object.setCoords()
    }
  }

  /** Move the selected objects with `move`, carrying what panels among them hold along. */
  private movingContents(move: () => void): void {
    const carry = this.startCarry(this.canvas.getActiveObjects())
    move()
    if (carry) this.applyCarry(carry)
  }

  /** While dragging: the panel under the pointer that the dragged objects would land in, ringed. */
  private findDropPanel(e: TPointerEvent): void {
    const carry = this.carry
    const point = carry && this.canvas.getScenePoint(e)
    // A sequence under the pointer takes the dragged things as steps (BIO-75), before the panel around it.
    // Something in a block never lands anywhere: it can only trade places with another slot of its block, ringed instead.
    const locked = carry !== undefined && carry.locked.size > 0
    // Things that move freely in their block (a zoom marker, a label) never land anywhere, so no panel is ringed for them.
    const holders = carry && this.holdersById()
    const free = carry !== undefined && holders !== undefined && [...carry.moved].every((object) => freeInBlock(object, holders.get(panelIdOf(object) ?? '')))
    const next = carry && point && !locked && !free ? (this.sequenceAt(point, carry) ?? panelAt(point, this.canvas.getObjects(), carry.skipped)) : undefined
    const swap = carry && point && locked ? this.swapTargetAt(carry, point) : undefined
    if (next === this.dropPanel && swap === this.swapTarget) return
    this.dropPanel = next
    this.swapTarget = swap
    this.canvas.requestRenderAll()
  }

  /**
   * The topmost sequence whose area is under the point, that the dragged
   * things could join: never one being dragged, and nothing joins a sequence
   * while a sequence or a line is among the dragged things.
   */
  private sequenceAt(point: XY, carry: Carry): SequenceBlock | undefined {
    if ([...carry.moved].some((object) => object instanceof SequenceBlock || object instanceof Connector || object instanceof Arrow || object instanceof Line)) return undefined
    const slack = 6
    return this.canvas
      .getObjects()
      .toReversed()
      .find((object): object is SequenceBlock => {
        // Things dropped on a comparison go into the side under them, not beside it (BIO-95).
        if (!(object instanceof SequenceBlock) || object instanceof ComparisonBlock || object instanceof AbstractBlock || carry.skipped.has(object) || !object.visible) return false
        const box = sequenceBox(object)
        return point.x >= box.x - slack && point.x <= box.x + box.width + slack && point.y >= box.y - slack && point.y <= box.y + box.height + slack
      })
  }

  /**
   * Let go of dragged objects over `panel` (a panel or a sequence, or over
   * neither): each one whose own holder isn't being dragged along with it now
   * belongs there. They go above it in the stack if they were under it, and
   * arrows take a panel's colour. The sequences that gained or lost steps
   * (also by a step dragged within its own) line up again round a step that
   * stayed put.
   */
  private dropInto(carry: Carry, panel: Holder | undefined): void {
    const objects = this.canvas.getObjects()
    const id = panel && idOf(panel)
    const holders = this.holdersById()
    const landed = [...carry.moved].filter((object) => {
      const holder = holders.get(panelIdOf(object) ?? '')
      return !(holder && carry.moved.has(holder)) && panelIdOf(object) !== id && !freeInBlock(object, holder)
    })
    const touched = new Set([...carry.moved].map(panelIdOf))
    for (const object of landed) {
      setPanelId(object, id)
      // A figure grid is grey only as a panel: what lands in it keeps its colour (BIO-86).
      if (panel instanceof PanelBlock && !(panel instanceof GridBlock)) tintArrow(object, settingsOf(panel).colour)
      else if (object instanceof IconSpace && !panel) tintIconSpace(object, undefined)
    }
    if (panel && landed.length > 0) {
      // Contents sit above their holder: lift what landed (with what it holds) to just above it.
      const lifted = withDescendants(landed, objects).filter((object) => objects.indexOf(object) < objects.indexOf(panel))
      for (const object of lifted) this.canvas.moveObjectTo(object, this.canvas.getObjects().indexOf(panel))
    }
    touched.add(id)
    this.relayOut(touched, (step) => !carry.moved.has(step))
  }

  /**
   * Start resizing a selection of several: the icon spaces (empty or filled)
   * in it, with their sizes within it and their boxes on the page; and, when
   * it holds nothing else, the blocks they sit in with the other things in
   * them, which make room as the spaces grow (BIO-74).
   */
  private startSpacesInSelection(selection: ActiveSelection): SpacesInSelection | undefined {
    const sizes = new Map<FabricObject, { width: number; height: number }>()
    for (const object of selection.getObjects()) {
      const size = object instanceof IconSpace ? spaceSize(object) : isHeldIcon(object) ? cardFrameOf(object).holder : undefined
      if (size) sizes.set(object, { width: size.width * Math.abs(object.scaleX), height: size.height * Math.abs(object.scaleY) })
    }
    if (sizes.size === 0) return undefined
    const stretch = { x: Math.abs(selection.scaleX) || 1, y: Math.abs(selection.scaleY) || 1 }
    const boxes = new Map([...sizes.keys()].map((object) => [object, drawnBox(object)] as const))
    // Only spaces: they keep their gaps, and what is beside them moves along. Mixed with other things, the spaces only keep from stretching.
    const onlySpaces = sizes.size === selection.getObjects().length
    const objects = this.canvas.getObjects()
    const picked = new Set(selection.getObjects())
    const ids = new Set([...sizes.keys()].map(panelIdOf).filter((id): id is string => id !== undefined))
    const panels = objects
      .filter((object): object is PanelBlock => object instanceof PanelBlock && ids.has(idOf(object) ?? '') && !picked.has(object))
      .map((panel) => {
        const contents = contentsOf(panel, objects).filter((object) => object.visible)
        const others = new Map(
          (onlySpaces ? contents.filter((object) => !picked.has(object)) : []).map((object) => {
            const moved = object instanceof PanelBlock ? [object, ...descendantsOf(object, objects)] : [object]
            return [object, { box: drawnBox(object), moves: new Map(moved.map((each) => [each, { x: each.left, y: each.top }] as const)) }] as const
          }),
        )
        return { panel, body: bodyOf(panel), around: unionOf(contents.map(drawnBox)), contents, others }
      })
    return { selection, sizes, stretch, boxes, onlySpaces, panels }
  }

  /**
   * The selection's stretch goes into each icon space's size; each undoes it
   * on itself, so nothing in it stretches. With only spaces selected they
   * are laid out again like a row of their own: each grows from where it
   * was, the gaps between them stay as they were, and the side opposite the
   * handle stays put. In a block, what sits beside them moves along by as
   * much as they grew, and the panel keeps its padding around everything.
   */
  private sizeSpacesInSelection(resize: SpacesInSelection, originX: string, originY: string): void {
    const { selection, sizes, boxes, panels } = resize
    const stretch = { x: Math.abs(selection.scaleX) || 1, y: Math.abs(selection.scaleY) || 1 }
    const grew = new Map<FabricObject, { x: number; y: number }>()
    for (const [object, size] of sizes) {
      const next = { width: size.width * stretch.x, height: size.height * stretch.y }
      if (object instanceof IconSpace) sizeSpaceInSelection(object, next, stretch)
      else if (object instanceof IconCard) sizeHolderInSelection(object, next, stretch)
      grew.set(object, { x: size.width * (stretch.x - resize.stretch.x), y: size.height * (stretch.y - resize.stretch.y) })
    }
    if (resize.onlySpaces) {
      // Each moves by as much as the spaces wholly before it (left of it, or above it) grew.
      const start = [...boxes.values()]
      const was = unionOf(start)
      const placed = new Map<FabricObject, PlainBox>()
      for (const [object, box] of boxes) {
        let dx = 0
        let dy = 0
        for (const [other, from] of boxes) {
          if (other === object) continue
          if (from.x + from.width <= box.x + 0.5) dx += grew.get(other)?.x ?? 0
          if (from.y + from.height <= box.y + 0.5) dy += grew.get(other)?.y ?? 0
        }
        const now = drawnBox(object)
        placed.set(object, { x: box.x + dx, y: box.y + dy, width: now.width, height: now.height })
      }
      // The side opposite the handle stays put (both halves, from the middle).
      const laid = unionOf([...placed.values()])
      const align = (from: number, size: number, to: number, toSize: number, origin: string) => (origin === 'left' || origin === 'top' ? from - to : origin === 'right' || origin === 'bottom' ? from + size - (to + toSize) : from + size / 2 - (to + toSize / 2))
      const shift = { x: align(was.x, was.width, laid.x, laid.width, originX), y: align(was.y, was.height, laid.y, laid.height, originY) }
      for (const [object, box] of placed) {
        object.setXY(new Point(box.x + shift.x + box.width / 2, box.y + shift.y + box.height / 2), 'center', 'center')
        object.setCoords()
      }
      const now = { x: laid.x + shift.x, width: laid.width }
      // What sits wholly beside them in their block moves along.
      for (const { others } of panels) {
        for (const { box, moves } of others.values()) {
          const dx = box.x >= was.x + was.width - 0.5 ? now.x + now.width - (was.x + was.width) : box.x + box.width <= was.x + 0.5 ? now.x - was.x : 0
          for (const [object, from] of moves) {
            object.set({ left: from.x + dx, top: from.y })
            object.setCoords()
          }
        }
      }
    }
    for (const { panel, body, around: was, contents } of panels) {
      const around = unionOf(contents.map(drawnBox))
      setPanelBox(panel, { x: body.x + around.x - was.x, y: body.y + around.y - was.y, width: body.width + around.width - was.width, height: body.height + around.height - was.height })
    }
    this.followConnectors()
    this.canvas.requestRenderAll()
  }

  /** After resizing a selection of spaces: select them again afresh, so the selection's box fits them and a next resize starts clean. */
  private reselectSpaces(selection: ActiveSelection): void {
    const objects = selection.getObjects()
    this.canvas.discardActiveObject()
    this.canvas.setActiveObject(new ActiveSelection(objects, { canvas: this.canvas }))
  }

  /** Start resizing an icon space (empty or filled) that sits in a block: what its row will move. */
  private startRow(target: FabricObject): RowResize | undefined {
    if (!(target instanceof IconSpace || isHeldIcon(target))) return undefined
    const id = panelIdOf(target)
    const objects = this.canvas.getObjects()
    const panel = objects.find((object): object is PanelBlock => object instanceof PanelBlock && idOf(object) === id)
    if (!id || !panel) return undefined
    const contents = contentsOf(panel, objects).filter((object) => object !== target && object.visible)
    const others = new Map(
      contents.map((object) => {
        const moved = object instanceof PanelBlock ? [object, ...descendantsOf(object, objects)] : [object]
        return [object, { box: plainBox(object), moves: new Map(moved.map((each) => [each, { x: each.left, y: each.top }] as const)) }] as const
      }),
    )
    const start = plainBox(target)
    return { target, panel, start, body: bodyOf(panel), around: unionOf([start, ...[...others.values()].map((other) => other.box)]), others }
  }

  /**
   * Make room in the block for a resized icon space: what sits wholly to its
   * right moves with its right edge, what sits wholly to its left with its
   * left edge, so the gaps stay even; the panel's box then changes by as much
   * as all it holds did, keeping its padding around them.
   */
  private applyRow(row: RowResize): void {
    const now = plainBox(row.target)
    const { start } = row
    const shiftRight = now.x + now.width - (start.x + start.width)
    const shiftLeft = now.x - start.x
    const boxes = [now]
    for (const { box, moves } of row.others.values()) {
      const dx = box.x >= start.x + start.width - 0.5 ? shiftRight : box.x + box.width <= start.x + 0.5 ? shiftLeft : 0
      for (const [object, from] of moves) {
        object.set({ left: from.x + dx, top: from.y })
        object.setCoords()
      }
      boxes.push({ ...box, x: box.x + dx })
    }
    const around = unionOf(boxes)
    const was = row.around
    setPanelBox(row.panel, {
      x: row.body.x + around.x - was.x,
      y: row.body.y + around.y - was.y,
      width: row.body.width + around.width - was.width,
      height: row.body.height + around.height - was.height,
    })
    this.followConnectors()
  }

  /** The one selected empty icon space: it waits for an icon picked in the Icons panel. */
  waitingSpace(): IconSpace | undefined {
    const only = this.onlySelected()
    return only instanceof IconSpace && !isLocked(only) && !this.isTyping() ? only : undefined
  }

  /**
   * While an icon is dragged from the Icons panel over the page (a point on
   * the page, or none once it leaves): ring the empty icon space it would go into.
   */
  showIconDropAt(point: { x: number; y: number } | undefined): void {
    const next = point ? iconSpaceAt(point, this.canvas.getObjects()) : undefined
    if (next === this.hoverSpace) return
    this.hoverSpace = next
    this.canvas.requestRenderAll()
  }

  /**
   * Put an icon into an empty icon space: centred in it, as big as fits, in
   * the same panel and at the same place in the stack, keeping the space's box
   * as an invisible frame (so it selects and resizes as that box). The space
   * goes and the icon is selected. One undo step.
   */
  private fillSpace(space: IconSpace, group: FabricObject, name: string, iconId: string | undefined): FabricObject {
    const box = spaceBox(space)
    const middle = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    Object.assign(group, { name, iconId })
    startSlotText(group, iconId)
    // It keeps the space's box (an invisible frame), the icon centred in it.
    const card = holdIcon(group as Group, { width: box.width, height: box.height }, middle)
    setPanelId(card, panelIdOf(space))
    const index = this.canvas.getObjects().indexOf(space)
    this.canvas.discardActiveObject()
    this.canvas.remove(space)
    this.add(card, false)
    // Centred once added: adding it changes how its outline is measured.
    card.setPositionByOrigin(new Point(middle.x, middle.y), 'center', 'center')
    card.setCoords()
    this.canvas.moveObjectTo(card, index)
    this.canvas.setActiveObject(card)
    this.canvas.requestRenderAll()
    this.commit()
    return card
  }

  /**
   * Swap the selected icon in a block's space (a zoom inset's, a panel's,
   * a labelled icon's) for another library icon: the new one is fitted into
   * the same box and keeps its block, frame and place in the stack, and is
   * selected. One undo step. Says whether it did.
   */
  async replaceHeldIcon(svg: string, name: string, iconId?: string): Promise<boolean> {
    const card = this.onlySelected()
    if (!card || !isHeldIcon(card) || isLocked(card) || this.isTyping()) return false
    const { objects, options } = await loadSVGFromString(svg)
    const group = util.groupSVGElements(
      objects.filter((object): object is FabricObject => object !== null),
      options,
    ) as Group
    noteIconOrigin(group, iconId)
    Object.assign(group, { name, iconId })
    startSlotText(group, iconId)
    const holder = panelIdOf(card)
    const next = swapHeldIcon(card, group)
    // It is the new icon now, in the layers list too.
    Object.assign(next, { name })
    setPanelId(next, holder)
    this.replaceObject(card, next)
    this.commit()
    return true
  }

  /** The selected empty icon space (waiting for an icon), and the one an icon is dragged over, in selection blue. */
  private drawWaitingSpace(ctx: CanvasRenderingContext2D): void {
    if (ctx !== this.canvas.getContext()) return
    const spaces = new Set([this.waitingSpace(), this.hoverSpace].filter((space): space is IconSpace => space !== undefined && this.canvas.getObjects().includes(space)))
    if (spaces.size === 0) return
    const zoom = this.zoom
    ctx.save()
    for (const space of spaces) {
      const box = spaceBox(space)
      ctx.fillStyle = 'rgba(37, 99, 235, 0.08)'
      ctx.strokeStyle = DROP_RING.colour
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.roundRect(box.x * zoom, box.y * zoom, box.width * zoom, box.height * zoom, 8 * zoom)
      ctx.fill()
      ctx.stroke()
    }
    ctx.restore()
  }

  private lightGrid(grid: GridBlock | undefined): void {
    if (grid === this.hoverGrid) return
    this.hoverGrid = grid
    this.canvas.requestRenderAll()
  }

  /** The blue ring around the panel a dragged object would land in. */
  private drawDropRing(ctx: CanvasRenderingContext2D): void {
    const panel = this.dropPanel
    const body = panel ? holderBox(panel) : this.swapTarget && cellBox(this.swapTarget)
    if (!body || ctx !== this.canvas.getContext()) return
    const zoom = this.zoom
    const gap = DROP_RING.width / 2 + 1
    ctx.save()
    ctx.strokeStyle = DROP_RING.colour
    ctx.lineWidth = DROP_RING.width
    ctx.beginPath()
    ctx.roundRect(body.x * zoom - gap, body.y * zoom - gap, body.width * zoom + 2 * gap, body.height * zoom + 2 * gap, 8 * zoom + gap)
    ctx.stroke()
    ctx.restore()
  }

  /**
   * Something dragged within its block, once it has moved: drawn again above
   * everything, on a white card with a soft shadow, so it reads as picked up
   * and never seems to overlap what it passes over.
   */
  private drawLifted(ctx: CanvasRenderingContext2D): void {
    const start = this.carry && this.carry.locked.size > 0 ? this.carry.start : undefined
    if (!start || ctx !== this.canvas.getContext()) return
    const { target } = start
    if (Math.abs(target.left - start.left) < 0.5 && Math.abs(target.top - start.top) < 0.5) return
    const box = cellBox(target)
    const { padding, radius } = LIFT_CARD
    // The card is a piece of what is behind the thing: a panel's own colour; white in a grid, a sequence, or where the page shows through.
    const holder = this.holdersById().get(this.carry?.locked.get(target) ?? '')
    const fill = holder instanceof PanelBlock && !(holder instanceof GridBlock) ? panelFill(settingsOf(holder)) : '#ffffff'
    ctx.save()
    ctx.transform(...this.canvas.viewportTransform)
    ctx.save()
    ctx.shadowColor = LIFT_CARD.shadow
    ctx.shadowBlur = LIFT_CARD.blur
    ctx.shadowOffsetY = LIFT_CARD.offsetY
    ctx.fillStyle = fill === 'transparent' ? '#ffffff' : fill
    ctx.beginPath()
    ctx.roundRect(box.x - padding, box.y - padding, box.width + 2 * padding, box.height + 2 * padding, radius)
    ctx.fill()
    ctx.restore()
    target.render(ctx)
    ctx.restore()
  }

  /** The one selected object, if exactly one is. */
  /** The box each cycle or branching had before its first style switch, while its steps stay as that switch left them (`restyleInBox`). */
  private readonly styleBoxes = new WeakMap<SequenceBlock, { width: number; height: number; sizes: string }>()

  private onlySelected(): FabricObject | undefined {
    const { targets } = this.selected()
    return targets.length === 1 ? targets[0] : undefined
  }

  /** Build a card again (new settings, caption, or after a resize) in its place, still selected; no undo step of its own. */
  private rebuildCard(card: IconCard, change: Parameters<typeof rebuildCard>[1] = {}): void {
    const next = rebuildCard(card, change)
    if (next) this.replaceObject(card, next)
  }

  /** Put `next` where `old` is in the stack, selected if `old` was. Arrows stuck to it follow. */
  private replaceObject(old: FabricObject, next: FabricObject): void {
    const index = this.canvas.getObjects().indexOf(old)
    const wasActive = this.canvas.getActiveObject() === old
    if (wasActive) this.canvas.discardActiveObject()
    this.canvas.remove(old)
    this.canvas.insertAt(Math.max(0, index), next)
    if (wasActive) this.canvas.setActiveObject(next)
    this.followConnectors()
    this.canvas.requestRenderAll()
  }

  /** Draw the selected icons in colour or greyscale. One undo step. */
  setIconColourMode(mode: ColourMode): void {
    const icons = this.selected().targets.flatMap((target) => iconOf(target) ?? []).filter((icon) => colourModeOf(icon) !== mode)
    if (icons.length === 0) return
    for (const icon of icons) {
      setColourMode(icon, mode)
      icon.set({ dirty: true })
    }
    this.canvas.requestRenderAll()
    this.commit()
  }

  /** Change the selected objects' look or position. */
  change(patch: StyleChange): void {
    const { active, targets } = this.selected()
    if (!active) return
    const { left, top, ...style } = patch
    if (left !== undefined || top !== undefined)
      this.movingContents(() => {
        active.set({ ...(left !== undefined && { left }), ...(top !== undefined && { top }) })
        active.setCoords()
      })
    const { opacity, ...paint } = style
    if (opacity !== undefined) for (const target of targets) target.set({ opacity })
    const tables = targets.filter((target) => target instanceof TableObject)
    for (const table of tables) paintTable(table, paint)
    if (Object.keys(paint).length > 0) {
      for (const part of paintedParts(targets.filter((target) => !(target instanceof TableObject)))) part.set(paintFor(part, paint))
      // A thicker arrow has a bigger head: its box fits round it again.
      if (paint.strokeWidth !== undefined) for (const arrow of targets) if (arrow instanceof Connector && !arrow.group) arrow.setPagePoints(...arrow.pagePoints())
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
    const typedIn = active && isShapeTextBox(active) ? (this.shapeText.shape ?? this.iconText.icon ?? this.chartLabel.chart) : undefined
    return typedIn ? { active: typedIn, targets: [typedIn] } : { active, targets: this.canvas.getActiveObjects() }
  }

  /** Give the selection a typed width or height, optionally keeping its proportions. */
  resize(change: SizeChange, keepProportions: boolean): void {
    const { active } = this.selected()
    if (!active) return
    // A panel's typed size is its box's (BIO-74), changed from its top-left corner without stretching anything.
    if (active instanceof PanelBlock) {
      const body = bodyOf(active)
      const ratio = body.height / body.width
      const size = keepProportions ? { width: change.width ?? (change.height ?? body.height) / ratio, height: change.height ?? (change.width ?? body.width) * ratio } : change
      // A figure grid's cells fill its new box (BIO-86).
      if (active instanceof GridBlock) fitGridToBox(active, { ...body, ...size }, this.canvas.getObjects())
      else resizePanel(active, size)
      // A step of a sequence: the row lines up again round it (BIO-75), here and below.
      this.layOutAround(active)
      this.canvas.requestRenderAll()
      this.commit()
      return
    }
    // So is an empty icon space's, and an icon's in a space's box (fitted in again); in a block, its row makes room.
    // A chart space or chart in a figure grid takes its typed size without stretching, and the other cells make room (BIO-86).
    const cell = startCellResize(active, this.canvas.getObjects())
    if (active instanceof ContentSpace || cell) {
      active.set(resizedScale(active, change, keepProportions))
      if (active instanceof ContentSpace) bakeContentScale(active, 'left', 'top')
      if (active instanceof ChartObject) active.bakeScale()
      if (cell) applyCellResize(cell, this.canvas.getObjects())
      this.canvas.requestRenderAll()
      this.commit()
      return
    }
    if (active instanceof IconSpace || isHeldIcon(active)) {
      const row = this.startRow(active)
      if (active instanceof IconSpace) {
        const box = spaceBox(active)
        const ratio = box.height / box.width
        resizeIconSpace(active, keepProportions ? { width: change.width ?? (change.height ?? box.height) / ratio, height: change.height ?? (change.width ?? box.width) * ratio } : change)
      } else {
        active.set(resizedScale(active, change, keepProportions))
        bakeCardScale(active, 'left', 'top')
      }
      if (row) this.applyRow(row)
      this.layOutAround(active)
      this.canvas.requestRenderAll()
      this.commit()
      return
    }
    const spaces = active instanceof ActiveSelection ? this.startSpacesInSelection(active) : undefined
    active.set(resizedScale(active, change, keepProportions))
    if (spaces && active instanceof ActiveSelection) {
      this.sizeSpacesInSelection(spaces, 'left', 'top')
      this.reselectSpaces(active)
      this.canvas.requestRenderAll()
      this.commit()
      return
    }
    if (active instanceof ChartObject) active.bakeScale()
    if (active instanceof WellPlate) bakePlateScale(active, 'left', 'top')
    if (active instanceof LegendBlock) bakeLegendScale(active, 'left', 'top')
    if (active instanceof IconCard) {
      this.rebuildCard(active)
      const rebuilt = this.onlySelected()
      if (rebuilt) this.layOutAround(rebuilt)
      this.commit()
      return
    }
    active.setCoords()
    // A shape with text stays big enough for it; a typed height makes it wider instead of taller.
    if (growToFit(active, change.width === undefined && !keepProportions ? 'height' : undefined)) this.followConnectors()
    this.layOutAround(active)
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
    // Arrows are resized by their handles, not pinched: a pinch would stretch their line.
    this.pinch = active && !(active instanceof Connector) && !active.lockScalingX && !active.lockScalingY ? { object: active, scaleX: active.scaleX, scaleY: active.scaleY, centre: active.getCenterPoint() } : undefined
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

  /** Whether `text` is a just-placed text with all its words still selected for typing over. */
  private isFreshPlaceholder(text: IText): boolean {
    return text === this.freshText && text.selectionStart === 0 && text.selectionEnd === text.text.length
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
    if (!this.canvas.getActiveObject() || this.isTyping()) return
    clipboard = await this.withContentsSelected((active) => active.clone(OWN_PROPERTIES))
  }

  /**
   * Run `use` on the selection with everything inside its panels selected too
   * (copying a panel copies what it holds, BIO-74); the selection is put back after.
   */
  private async withContentsSelected<T>(use: (active: FabricObject) => Promise<T>): Promise<T> {
    const picked = this.selectedInStackOrder()
    const all = withDescendants(picked, this.canvas.getObjects())
    if (all.length === picked.length) return use(this.canvas.getActiveObject()!)
    this.canvas.discardActiveObject()
    this.select(all)
    try {
      return await use(this.canvas.getActiveObject()!)
    } finally {
      this.canvas.discardActiveObject()
      this.select(picked)
    }
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
    if (!this.canvas.getActiveObject() || this.isTyping()) return
    const copy = await this.withContentsSelected((active) => active.clone(OWN_PROPERTIES))
    await this.placeCopyOf(copy)
  }

  /** Put the selected objects into one group, where the topmost of them was. */
  group(): void {
    // A panel goes into the group with everything it holds.
    const targets = withDescendants(this.selectedInStackOrder(), this.canvas.getObjects())
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
    // A deleted step takes its label along (BIO-75).
    this.forgetLabels(targets)
    // A panel or sequence goes with everything in it (Detach keeps the contents instead).
    this.canvas.remove(...withDescendants(targets, this.canvas.getObjects()))
    // A sequence that lost a step closes up; one left without steps goes too.
    this.relayOut(targets.map(panelIdOf))
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
    const cards = objects.filter((object) => object instanceof IconCard)
    const captions = cards.flatMap((card) => cardCaptionText(card) ?? [])
    const faces = [...texts, ...labels, ...captions].flatMap(textFaces)
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
    // Captions measure again in their font, and their cards are laid out around them.
    for (const card of cards) {
      cardCaptionText(card)?.initDimensions()
      // A card inside a group keeps its place; it is laid out again when next changed.
      if (!card.group) relayoutCard(card)
    }
    for (const object of objects) if (labelBox(object)) object.set('dirty', true)
    for (const icon of slotted) refreshSlotText(icon)
    this.canvas.requestRenderAll()
  }

  /** Put saved contents on the page (an earlier version of this slide, BIO-36) as one step that Undo takes back. */
  async replaceWith(saved: string): Promise<void> {
    this.canvas.discardActiveObject()
    await this.restore(saved)
    if (!this.abort.signal.aborted) this.commit()
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
    // Empty icon spaces are for working on the figure, not part of it.
    const spaces = this.canvas.getObjects().filter((object) => (object instanceof IconSpace || object instanceof ContentSpace) && !object.excludeFromExport)
    for (const space of spaces) space.excludeFromExport = true
    const svg = this.canvas.toSVG()
    for (const space of spaces) space.excludeFromExport = false
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
  async showSlide(saved: string | undefined, history?: History, letters?: LetterContext): Promise<History> {
    const previous = this.history
    this.canvas.discardActiveObject()
    if (letters) this.letterContext = letters
    if (saved) {
      await this.restore(saved, true)
    } else {
      this.canvas.remove(...this.canvas.getObjects())
      this.lettersSet = undefined
      this.lettersFallback = DEFAULT_LETTERS
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
    this.chartLabel.finish(false)
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
  static async fitSaved(saved: string, from: { width: number; height: number }, to: { width: number; height: number }, letters?: LetterContext): Promise<{ canvas: string; thumbnail: string }> {
    const scratch = new FigureCanvas(document.createElement('canvas'), from)
    if (letters) scratch.letterContext = letters
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
    this.chartLabel.finish(false)
    this.abort.abort()
    if (this.emitFrame !== undefined) cancelAnimationFrame(this.emitFrame)
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
    // A copied step joins its sequence just after the original, which makes room for it (BIO-75).
    const pasted = new Set(objects)
    this.relayOut(objects.map(panelIdOf), (step) => !pasted.has(step))
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
    const carry = this.startCarry(targets)
    targets.forEach((object, index) => {
      const { dx, dy } = moves[index] ?? { dx: 0, dy: 0 }
      object.set({ left: object.left + dx, top: object.top + dy })
      object.setCoords()
    })
    if (carry) this.applyCarry(carry)
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
    // Its box is measured afresh either way: what it carries along moves by it.
    target.setCoords()
    if (e.altKey || this.movesFreely(target)) {
      this.guides = []
      return
    }
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
      // Inside a panel, things snap to its padding (BIO-74).
      ...this.canvas
        .getObjects()
        .filter((object): object is PanelBlock => object instanceof PanelBlock && object !== target && !moving.includes(object) && object.visible)
        .map((panel) => {
          const inner = innerOf(panel)
          return { left: inner.x, top: inner.y, width: inner.width, height: inner.height }
        }),
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
    if (!(e as TPointerEvent | undefined) || !corner || e.altKey || this.movesFreely(target) || target.getTotalAngle() % 360 !== 0 || transform.originX === 'center' || transform.originY === 'center') return
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

  /**
   * Snapping for a dragged arrow end: the same lines as moving an object, and
   * straight with the other end when it is nearly level, upright or at 45°
   * (which wins over a line along the other way).
   */
  private snapArrowEnd(point: XY, arrow: FabricObject, e: TPointerEvent, end: 0 | 1): XY {
    if (e.altKey) {
      this.guides = []
      return this.snapToAnchor(point, point)
    }
    const result = snapPoint(point, this.snapTargetsFor(arrow), this.pageBox, SNAP_DISTANCE_PX / this.zoom, this.canvas.grid)
    const other = arrow instanceof Connector ? arrow.pagePoints()[end === 0 ? 1 : 0] : undefined
    const straight = other ? straighten(other, point) : undefined
    if (!straight?.line) {
      this.guides = result.guides
      return this.snapToAnchor(point, result)
    }
    // Level keeps the other end's height but may still snap left-right to a line, and upright the other way round.
    const snapped = straight.line === 'y' ? { x: result.x, y: straight.point.y } : straight.line === 'x' ? { x: straight.point.x, y: result.y } : straight.point
    this.guides = result.guides.filter((guide) => (straight.line === 'y' ? guide.axis === 'x' : straight.line === 'x' ? guide.axis === 'y' : false))
    return this.snapToAnchor(point, snapped)
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
    if (this.tool === 'select' && this.startPlatePaint(scenePoint, target)) return
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
    if (this.plateDrag) return this.dragPlatePaint(scenePoint)
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
    // Drawn by hand, an arrow or line that is nearly level, upright or at 45° comes out straight (Alt: as drawn; Shift: always 45° steps).
    const free = hover?.side ? sidePoint(hover.frame, hover.side, ANCHOR_GAP) : scenePoint
    const to = (this.tool === 'arrow' || this.tool === 'line') && !hover?.side && !e.shiftKey && !e.altKey ? straighten(this.drawing.start, free).point : free
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
    if (this.plateDrag) return this.endPlatePaint()
    if (this.cellDrag) {
      // A click on the only picked cell lets go of it, back to the table's own bar (BIO-82). A double-click still
      // edits the cell: its first click picks the cell, the second lets go, and the double-click picks it again to edit.
      if (this.cellDrag.again && isClick) {
        this.cellDrag.table.cellRange = undefined
        this.canvas.requestRenderAll()
      }
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
      this.freshText = text
      this.emit()
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
   * A new chart from the Graph panel's picks: a click places one centred on the
   * page, filling the area inside the margins on an empty page and half the
   * page wide otherwise (see `chartSizeForPage`); a drag places one that fills the dragged box.
   */
  private placeChart(start: XY, end: XY, commit: boolean): ChartObject {
    const dragged = distance(start, end) > 0
    // Named Chart 1, Chart 2… so the layers and the page tell them apart.
    const number = this.canvas.getObjects().filter((object) => object instanceof ChartObject).length + 1
    // Helpers such as the drag box aren't part of the figure, so they don't count.
    const emptyPage = !this.canvas.getObjects().some((object) => !object.excludeFromExport)
    const size = dragged ? { width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) } : chartSizeForPage(this.page, emptyPage)
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
   * picked block to the cell pressed. Escape, or a click on the one picked
   * cell, lets go of the cells, so the table moves again.
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
    const picked = fullRange(target.table, { r0: anchor.r, c0: anchor.c, r1: cell.r, c1: cell.c })
    const again = !e.shiftKey && picked.r0 === range.r0 && picked.c0 === range.c0 && picked.r1 === range.r1 && picked.c1 === range.c1
    this.cellDrag = { table: target, anchor, again }
    target.cellRange = picked
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
    // Escape stops painting a well plate first, keeping it selected (BIO-98).
    if (event.key === 'Escape' && this.plateBrush) {
      this.setPlateBrush(undefined)
      return true
    }
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
    // Every letter on the slide gets its text from one count, and figure grids fit their box around their cells again (BIO-83, BIO-86).
    if (this.relabel()) this.canvas.requestRenderAll()
    // Callouts too: insets fit what they hold, labelled icons draw their lines again (BIO-97).
    if (this.syncCallouts()) this.canvas.requestRenderAll()
    // A graphical abstract's empty part gets a space again (BIO-107).
    if (this.syncAbstracts()) this.canvas.requestRenderAll()
    this.followConnectors()
    this.history.push(this.serialize(), mergeKey)
    this.emit()
  }

  private async restore(state: string, asStart = false): Promise<void> {
    this.cells.finish()
    this.shapeText.finish()
    this.iconText.finish()
    this.chartLabel.finish(false)
    // Undo and redo keep what was selected, as far as it is still there, so its panels stay open.
    const selected = this.canvas.getActiveObjects().flatMap((object) => layerProps(object).layerId ?? [])
    this.restoring = true
    this.canvas.discardActiveObject()
    // The slide's letter settings are one extra key beside its objects; Fabric gets only the objects.
    const { letters, ...saved } = JSON.parse(state) as { letters?: unknown } & Record<string, unknown>
    try {
      await this.canvas.loadFromJSON(saved, undefined, { signal: this.abort.signal })
    } catch (error) {
      // Closed while loading (React closes and reopens the screen in development).
      if (this.abort.signal.aborted) return
      throw error
    }
    if (this.abort.signal.aborted) return
    this.lettersSet = readLetters(letters)
    this.lettersFallback = legacyLetters(saved)
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
    // Callouts' handles and what their insets hold, once everything is back (BIO-97).
    for (const object of this.canvas.getObjects()) this.calloutRules(object)
    // A pathway's "+" goes by where its steps are, which only exist once everything is back (BIO-105): after undo, redo or opening, it would sit in a corner.
    for (const object of this.canvas.getObjects()) if (object instanceof PathwayBlock) this.placePathwayPlus(object)
    this.canvas.backgroundColor = '#ffffff'
    // Letters are counted again for where this slide sits now (the slides before it may have changed), without an undo step.
    this.relabel()
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
    // The layer list and picked layers stay the same objects while they don't change (a drag), so the layers panel needn't redraw (BIO-88).
    const layers = this.layers()
    const selectedLayerIds = this.canvas.getActiveObjects().flatMap((object) => layerProps(object).layerId ?? [])
    const last = this.lastState
    this.lastState = {
      selection: this.selectionInfo(),
      layers: last && sameLayers(last.layers, layers) ? last.layers : layers,
      selectedLayerIds: last && sameIds(last.selectedLayerIds, selectedLayerIds) ? last.selectedLayerIds : selectedLayerIds,
      canUndo: this.history.canUndo,
      canRedo: this.history.canRedo,
      zoom: this.zoom,
      tool: this.tool,
      transforming: this.transforming,
      newText: this.newTextStyle(),
      nextShapeText: this.nextShapeText(),
      drawChoice: this.choice,
    }
    return this.lastState
  }

  private selectionInfo(): SelectionInfo | null {
    const { active, targets: objects } = this.selected()
    if (!active) return null
    // While typing in a shape, the panel shows the shape and the look of the text being typed.
    const typing = this.shapeText.shape === active ? this.selectedText() : undefined
    const first = objects[0] ?? active
    const typed = typing ?? asText(first)
    const comparison = objects.length === 1 ? this.comparisonOf(first) : undefined
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
              : first instanceof PanelBlock
                ? 'panel'
              : first instanceof IconSpace
                ? 'space'
              : first instanceof ContentSpace
                ? 'chart-space'
              : first instanceof SequenceBlock
                ? 'sequence'
              : first instanceof TimelineBlock
                ? 'timeline'
              : first instanceof WellPlate
                ? 'plate'
              : first instanceof LegendBlock
                ? 'legend'
              : isCallout(first)
                ? 'callout'
              : isIcon(first) || first instanceof IconCard
                ? 'icon'
                : 'shape'
    // A group shows the colours of its first part.
    const painted = paintedParts(objects)[0] ?? first
    // A framed icon shows its icon's settings, and its frame's.
    const icon = iconOf(first) ?? first
    return {
      kind,
      name: objects.length > 1 ? `${objects.length} objects` : objectName(first),
      count: objects.length,
      hasGroup: objects.some((object) => object instanceof FigureGroup),
      locked: objects.every(isLocked),
      bounds: active.getBoundingRect(),
      // An icon in greyscale shows the colour it has in RGB, the one the colour field changes.
      fill: kind === 'icon' ? iconMainColour(baseIconColours(icon), iconIdOf(icon)) : colour(painted.fill),
      ...(kind === 'icon' && { colourMode: colourModeOf(icon) }),
      ...(kind === 'icon' && objects.length === 1 && { slot: slotInfo(icon) ?? null }),
      ...(kind === 'icon' && objects.length === 1 && typeof (icon as FabricObject & { iconId?: unknown }).iconId === 'string' && { iconId: (icon as FabricObject & { iconId: string }).iconId }),
      ...(kind === 'icon' && objects.length === 1 && isHeldIcon(first) && { heldIcon: true }),
      ...(kind === 'icon' && objects.length === 1 && { frame: first instanceof IconCard && !isBareHolder(cardFrameOf(first), first.cardCaption ?? '') ? { ...cardFrameOf(first), captionText: first.cardCaption ?? '', captionStyle: captionStyle(first) } : null }),
      stroke: colour(painted.stroke),
      strokeWidth: painted.strokeWidth,
      text: typing ? this.drawnTextStyle(typing) : kind === 'text' ? textStyleOf(first) : kind === 'shape' ? (labelStyleOf(first) ?? this.emptyLabelStyle(first)) : undefined,
      textRange: typed !== undefined && typed.isEditing && typed.selectionStart !== typed.selectionEnd && !this.isFreshPlaceholder(typed),
      ...(typing && { typingInShape: true }),
      ...(this.textPickedIn() === first && { textPicked: true }),
      opacity: first.opacity,
      left: active.left,
      top: active.top,
      // Without the line around it, so typed sizes and shown sizes agree; a panel's is its box's.
      width: active instanceof PanelBlock || active instanceof IconSpace || active instanceof SequenceBlock ? plainBox(active).width : active.width * active.scaleX,
      height: active instanceof PanelBlock || active instanceof IconSpace || active instanceof SequenceBlock ? plainBox(active).height : active.height * active.scaleY,
      ...(kind === 'chart' && first instanceof ChartObject && { chart: first.chart }),
      // Text beside a bracket never wraps or shrinks, so brackets have no text fit.
      ...(kind === 'shape' && textShapeOf(first) && !OUTSIDE_TEXT.has(kindOf(first) ?? 'rectangle') && { textFit: textFitOf(first) }),
      ...(kind === 'shape' && kindOf(first) !== undefined && { shapeKind: kindOf(first) }),
      ...(kind === 'shape' && cornerRadiusOf(first) !== undefined && { cornerRadius: cornerRadiusOf(first) }),
      ...(kind === 'table' && first instanceof TableObject && { ...this.tableColours(first), table: tableInfo(first) }),
      ...(kind === 'line' && first instanceof Connector && { arrowLook: first.look, arrowBend: first.effectiveBend, arrowStyle: { outline: first.outline, outlineWidth: first.outlineWidth ?? 0 } }),
      ...(kind === 'panel' && first instanceof PanelBlock && { panel: { ...settingsOf(first), contents: this.panelContents(first) } }),
      ...(first instanceof PanelBlock && objects.length === 1 && { letters: this.lettersState() }),
      ...(first instanceof GridBlock && objects.length === 1 && { grid: { ...gridSettingsOf(first), cells: this.panelContents(first).length, filled: filledCells(first, this.canvas.getObjects()) } }),
      ...(kind === 'sequence' && first instanceof SequenceBlock && { sequence: { ...sequenceSettingsOf(first), steps: this.stepsOf(first).length } }),
      ...(kind === 'sequence' && first instanceof PathwayBlock && { pathway: pathwaySettingsOf(first) }),
      ...(kind === 'callout' && { callout: this.calloutInfo(first) }),
      ...(kind === 'timeline' && first instanceof TimelineBlock && { timeline: timelineSettingsOf(first) }),
      ...(comparison && { comparison: this.comparisonInfo(comparison) }),
      ...(objects.length === 1 && first instanceof AbstractBlock && { abstract: abstractSettingsOf(first) }),
      ...(kind === 'plate' && first instanceof WellPlate && { plate: { ...first.plate, map: wellsOnPlate(first.plate), brush: this.plateBrush?.plate === first ? this.plateBrush.id : undefined } }),
      ...(kind === 'legend' && first instanceof LegendBlock && { legend: first.legend }),
      ...(kind === 'multiple' && { canMakeRow: this.rowCandidates().length >= 2 }),
    }
  }

  /** What a panel holds directly, for its Contents list: the top one first, as in the layers panel. */
  private panelContents(panel: PanelBlock): PanelContent[] {
    return contentsOf(panel, this.canvas.getObjects())
      .filter((object) => !isShapeTextBox(object))
      .reverse()
      .map((object) => ({ id: layerProps(object).layerId ?? '', name: objectName(object), kind: layerKind(object) }))
  }

  /**
   * Tell the screen at the next frame, at most once per frame. Dragging,
   * turning and resizing change things at every pointer move, often several
   * times per frame; redrawing the panels each time made the editor slow (BIO-88).
   */
  private emitSoon(): void {
    this.emitFrame ??= requestAnimationFrame(() => {
      this.emitFrame = undefined
      this.emit()
    })
  }

  private emit(): void {
    // A screen update now covers one that was waiting for the next frame.
    if (this.emitFrame !== undefined) cancelAnimationFrame(this.emitFrame)
    this.emitFrame = undefined
    const state = this.state()
    for (const listener of this.listeners) listener(state)
  }
}

const sameIds = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((id, index) => id === b[index])

/** Whether two layer lists show the same rows, groups' rows included. */
function sameLayers(a: readonly LayerItem[], b: readonly LayerItem[]): boolean {
  return (
    a.length === b.length &&
    a.every((row, index) => {
      const other = b[index]
      return (
        other !== undefined &&
        row.id === other.id &&
        row.name === other.name &&
        row.kind === other.kind &&
        row.hidden === other.hidden &&
        row.locked === other.locked &&
        (row.children === undefined ? other.children === undefined : other.children !== undefined && sameLayers(row.children, other.children))
      )
    })
  )
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
  // Copies of what a copied panel holds belong to the copied panel; a copy made on its own stays in its panel.
  for (const object of all) {
    const panel = panelIdOf(object)
    if (panel && renamed.has(panel)) setPanelId(object, renamed.get(panel))
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
