/**
 * Callout blocks (BIO-97): a zoom inset and a labelled icon. Three looks each,
 * all offered (the owner, 2026-11-26).
 *
 * Zoom inset. Two objects that belong together:
 * - `CalloutInset`, the close-up: a round or square frame (and a zoom tag or
 *   a caption). It is a holder: its marker and, when it shows an icon, the
 *   icon space (or the icon that filled it) point at it with `panelId`, so
 *   delete, copy and group take them along.
 * - `CalloutMarker`, the small ring, square or dot on the spot it shows. It is
 *   its own object, moved on its own: moving the inset leaves the marker on
 *   its spot, and the other way round.
 * The lines between them are drawn by the inset, from where both are at that
 * moment, so they follow either one while it is dragged. The inset shows an
 * icon space to fill, or a live magnified copy of what lies under the marker
 * (also drawn by the inset, each time the page is drawn, and as vector in SVG).
 *
 * Labelled icon. `CalloutLabels` is a holder like a sequence: it draws only
 * its look (lines, dots, chips, number badges, an invisible frame that is its
 * area). Its subject (an icon space or icon) and its labels (text boxes with
 * `calloutPart`, the spot on the subject the label points at, as shares of
 * the subject's box) are ordinary objects pointing at it with `panelId`.
 * `layOutLabels` draws the look again whenever a label or the subject moves.
 */
import { Circle, FabricText, Group, IText, Path, Point, Rect, classRegistry, util, type FabricObject } from 'fabric'

import { hexToRgb } from './colour'
import { ContentSpace } from './content-space'
import { DEFAULT_FONT, fontStack } from './fonts'
import { IconSpace, buildIconSpace, resizeIconSpace, roundIconSpace, spaceBox } from './icon-space'
import { bakeCardScale, frameOf as cardFrameOf, IconCard } from './icon-card'
import { contentsOf, panelIdOf, wash, type Box } from './panel-block'

const INK = '#27272a'
export const CALLOUT_BLUE = '#0072b2'

type XY = { x: number; y: number }
type DrawContext = Parameters<Group['drawObject']>[2]

const idOf = (object: FabricObject): string | undefined => (object as FabricObject & { figureId?: string }).figureId

/** A colour with some see-through, for fills that must not hide what is under them. */
function alpha(hex: string, share: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${share})`
}

const text = (value: string, look: { colour: string; weight: number; size: number }) =>
  new FabricText(value, { fontFamily: fontStack(DEFAULT_FONT), fontSize: look.size, fontWeight: look.weight, fill: look.colour, strokeWidth: 0, originX: 'left', originY: 'top' })

function boxOfPart(part: FabricObject): Box {
  part.setCoords()
  const rect = part.getBoundingRect()
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
}

function union(boxes: readonly Box[]): Box {
  const x = Math.min(...boxes.map((box) => box.x))
  const y = Math.min(...boxes.map((box) => box.y))
  return { x, y, width: Math.max(...boxes.map((box) => box.x + box.width)) - x, height: Math.max(...boxes.map((box) => box.y + box.height)) - y }
}

/* =====================================================================
 * Zoom inset
 * ===================================================================== */

export type InsetLook = 'lens' | 'frame' | 'pin'
export type InsetShows = 'icon' | 'copy'

export type InsetSettings = {
  look: InsetLook
  /** An icon space to fill, or a live magnified copy of what is under the marker. */
  shows: InsetShows
  colour: string
  /** The "4×" tag in the frame look's corner. */
  tag: boolean
  captionShown: boolean
  caption: string
}

export const INSET_LOOKS: readonly { id: InsetLook; name: string }[] = [
  { id: 'lens', name: 'Lens' },
  { id: 'frame', name: 'Frame' },
  { id: 'pin', name: 'Pin' },
]

export const DEFAULT_INSET: InsetSettings = { look: 'lens', shows: 'icon', colour: CALLOUT_BLUE, tag: true, captionShown: false, caption: 'Close-up' }
export const NEW_INSET_SIZE = 128
/** A new marker is a third of the inset's size: it starts at 3× zoom (owner's pick, 2026-11-26). */
export const NEW_MARKER_SIZE = NEW_INSET_SIZE / 3
export const INSET_SIZE_RANGE = { min: 40, max: 600 }
export const MARKER_SIZE_RANGE = { min: 8, max: 200 }
const PIN_DOT = 6
const CAPTION_GAP = 8

export class CalloutInset extends Group {
  static type = 'CalloutInset'
  declare inset?: InsetSettings
  /** The inset's width (its diameter when round), in page pixels. */
  declare insetSize?: number
  /** The marker to draw lines to while the inset isn't on a page (a Blocks card's picture). Not saved. */
  markerHint?: CalloutMarker

  constructor(...args: ConstructorParameters<typeof Group>) {
    super(...args)
    // Its lines and magnified copy reach outside its box, and the copy changes with the page: never drawn from a cached picture.
    this.objectCaching = false
  }

  drawObject(ctx: CanvasRenderingContext2D, forClipping: boolean | undefined, context: DrawContext): void {
    if (!forClipping) drawUnderneath(this, ctx)
    super.drawObject(ctx, forClipping, context)
  }

  toSVG(reviver?: Parameters<Group['toSVG']>[0]): string {
    return underneathSvg(this) + super.toSVG(reviver)
  }
}
classRegistry.setClass(CalloutInset)

export class CalloutMarker extends Group {
  static type = 'CalloutMarker'
  /** The marked area's width (a dot's area in the pin look is this wide too, though only the dot shows). */
  declare markerSize?: number
  declare markerLook?: InsetLook
  declare markerColour?: string
}
classRegistry.setClass(CalloutMarker)

export const isInset = (object: FabricObject | undefined): object is CalloutInset => object instanceof CalloutInset
export const isMarker = (object: FabricObject | undefined): object is CalloutMarker => object instanceof CalloutMarker

export function insetSettingsOf(inset: CalloutInset): InsetSettings {
  return { ...DEFAULT_INSET, ...inset.inset }
}
export const insetSizeOf = (inset: CalloutInset): number => inset.insetSize ?? NEW_INSET_SIZE
export const markerSizeOf = (marker: CalloutMarker): number => marker.markerSize ?? NEW_MARKER_SIZE

/** Where the inset's frame is on the page: its middle and its half width (the first part is always the frame). */
export function insetCircle(inset: CalloutInset): { centre: Point; radius: number } {
  const frame = inset.getObjects()[0]
  const radius = (insetSizeOf(inset) / 2) * inset.scaleX
  if (!frame) return { centre: inset.getCenterPoint(), radius }
  return { centre: util.transformPoint(frame.getRelativeCenterPoint(), inset.calcTransformMatrix()), radius }
}

export function markerCircle(marker: CalloutMarker): { centre: Point; radius: number } {
  return { centre: marker.getCenterPoint(), radius: (markerSizeOf(marker) / 2) * marker.scaleX }
}

/** How much the inset magnifies: its size over the marked area's. */
export function zoomOf(inset: CalloutInset, marker: CalloutMarker | undefined): number {
  return marker ? insetSizeOf(inset) / markerSizeOf(marker) : 1
}

/** "4×", "2.5×". */
export function zoomText(zoom: number): string {
  const rounded = zoom >= 10 ? Math.round(zoom) : Math.round(zoom * 10) / 10
  return `${rounded}×`
}

/** Every object on the page, also inside groups made with Group (not inside icons). */
function pageObjects(objects: readonly FabricObject[]): FabricObject[] {
  return objects.flatMap((object) => ((object.constructor as { type?: string }).type === 'FigureGroup' && object instanceof Group ? [object, ...pageObjects(object.getObjects())] : [object]))
}

/** The inset's marker: the first object on the page pointing at it. */
export function markerOf(inset: CalloutInset, objects?: readonly FabricObject[]): CalloutMarker | undefined {
  const id = idOf(inset)
  const all = objects ?? inset.canvas?.getObjects()
  if (!all || !id) return inset.markerHint
  return pageObjects(all).find((object): object is CalloutMarker => object instanceof CalloutMarker && panelIdOf(object) === id) ?? inset.markerHint
}

/** The inset a marker belongs to. */
export function insetOfMarker(marker: CalloutMarker, objects: readonly FabricObject[]): CalloutInset | undefined {
  const id = panelIdOf(marker)
  return id ? pageObjects(objects).find((object): object is CalloutInset => object instanceof CalloutInset && idOf(object) === id) : undefined
}

/* ---------- Lines between marker and inset ---------- */

type Segment = [XY, XY]

/** The two outer lines touching both circles (a magnifying glass). None while one circle holds the other. */
function tangents(a: XY, ra: number, b: XY, rb: number): Segment[] {
  const d = Math.hypot(b.x - a.x, b.y - a.y)
  if (d <= Math.abs(ra - rb) + 0.5) return []
  const theta = Math.atan2(b.y - a.y, b.x - a.x)
  const phi = Math.acos((ra - rb) / d)
  return [1, -1].map((s) => {
    const angle = theta + s * phi
    return [
      { x: a.x + ra * Math.cos(angle), y: a.y + ra * Math.sin(angle) },
      { x: b.x + rb * Math.cos(angle), y: b.y + rb * Math.sin(angle) },
    ]
  })
}

/** The corner-to-corner lines that run along the outside of both squares. */
function cornerLines(a: XY, ra: number, b: XY, rb: number): Segment[] {
  const corners = (c: XY, r: number): XY[] => [
    { x: c.x - r, y: c.y - r },
    { x: c.x + r, y: c.y - r },
    { x: c.x + r, y: c.y + r },
    { x: c.x - r, y: c.y + r },
  ]
  const ca = corners(a, ra)
  const cb = corners(b, rb)
  const all = [...ca, ...cb]
  const lines: Segment[] = []
  ca.forEach((p, i) => {
    const q = cb[i]
    if (!q || Math.hypot(q.x - p.x, q.y - p.y) < 1) return
    const side = (r: XY) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)
    const sides = all.map(side).filter((v) => Math.abs(v) > 0.01)
    if (sides.every((v) => v > 0) || sides.every((v) => v < 0)) lines.push([p, q])
  })
  return lines
}

/** The lines from the marker to the inset, in page coordinates. */
export function insetLines(inset: CalloutInset, marker: CalloutMarker | undefined): Segment[] {
  if (!marker) return []
  const { look } = insetSettingsOf(inset)
  const i = insetCircle(inset)
  const m = markerCircle(marker)
  if (look === 'lens') return tangents(m.centre, m.radius, i.centre, i.radius)
  if (look === 'frame') return cornerLines(m.centre, m.radius, i.centre, i.radius)
  // Pin: one line from the dot to the inset's edge.
  const d = Math.hypot(i.centre.x - m.centre.x, i.centre.y - m.centre.y)
  if (d <= i.radius + 1) return []
  const u = { x: (i.centre.x - m.centre.x) / d, y: (i.centre.y - m.centre.y) / d }
  return [[{ x: m.centre.x, y: m.centre.y }, { x: i.centre.x - u.x * i.radius, y: i.centre.y - u.y * i.radius }]]
}

/** Points round a circle (or square), for the area between marker and inset. */
function outline(centre: XY, radius: number, square: boolean): XY[] {
  if (square)
    return [
      { x: centre.x - radius, y: centre.y - radius },
      { x: centre.x + radius, y: centre.y - radius },
      { x: centre.x + radius, y: centre.y + radius },
      { x: centre.x - radius, y: centre.y + radius },
    ]
  return Array.from({ length: 32 }, (_, i) => ({ x: centre.x + radius * Math.cos((i / 32) * 2 * Math.PI), y: centre.y + radius * Math.sin((i / 32) * 2 * Math.PI) }))
}

/** The smallest convex outline round these points (Andrew's monotone chain). */
function hull(points: readonly XY[]): XY[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y)
  const cross = (o: XY, a: XY, b: XY) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
  const half = (list: XY[]) => {
    const chain: XY[] = []
    for (const point of list) {
      while (chain.length >= 2 && cross(chain.at(-2) ?? point, chain.at(-1) ?? point, point) <= 0) chain.pop()
      chain.push(point)
    }
    chain.pop()
    return chain
  }
  return [...half(sorted), ...half(sorted.toReversed())]
}

/**
 * Whether a page point is in the area between the marker and the inset (the
 * outline round both, bounded by the lines). Pressing there grabs the whole
 * callout: inset and marker move together (owner's feedback, 2026-11-26).
 */
export function inCalloutArea(inset: CalloutInset, marker: CalloutMarker | undefined, point: XY): boolean {
  if (!marker) return false
  const square = insetSettingsOf(inset).look === 'frame'
  const i = insetCircle(inset)
  const m = markerCircle(marker)
  // The pin's line is thin: its area is as wide as the dot.
  const markerRadius = insetSettingsOf(inset).look === 'pin' ? Math.max(PIN_DOT, 4) : m.radius
  const area = hull([...outline(i.centre, i.radius, square), ...outline(m.centre, markerRadius, square)])
  let inside = false
  area.forEach((a, k) => {
    const b = area.at(k - 1) ?? a
    if (a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  })
  return inside
}

const lineLook = (look: InsetLook) => ({ width: look === 'pin' ? 1.5 : 1.25, dash: look === 'frame' ? [4, 3] : undefined })

/* ---------- The magnified copy ---------- */

/** What a magnified copy shows: everything on the page but callouts and empty spaces. */
function copySources(inset: CalloutInset): FabricObject[] {
  const objects = inset.canvas?.getObjects() ?? []
  return objects.filter((object) => object.visible && !object.excludeFromExport && !(object instanceof CalloutInset || object instanceof CalloutMarker || object instanceof IconSpace || object instanceof ContentSpace))
}

/** How the page maps into the inset: page point p goes to centre + (p - marker) × zoom. */
function copyMatrix(inset: CalloutInset, marker: CalloutMarker): [number, number, number, number, number, number] {
  const i = insetCircle(inset)
  const m = markerCircle(marker)
  const zoom = i.radius / Math.max(0.5, m.radius)
  return [zoom, 0, 0, zoom, i.centre.x - m.centre.x * zoom, i.centre.y - m.centre.y * zoom]
}

function traceInset(ctx: CanvasRenderingContext2D, inset: CalloutInset): void {
  const { centre, radius } = insetCircle(inset)
  ctx.beginPath()
  if (insetSettingsOf(inset).look === 'frame') ctx.roundRect(centre.x - radius, centre.y - radius, 2 * radius, 2 * radius, 6)
  else ctx.arc(centre.x, centre.y, radius, 0, Math.PI * 2)
}

/** Draw an object as it is on the page, without its cached picture, so it stays sharp when magnified. */
function drawPlain(object: FabricObject, ctx: CanvasRenderingContext2D): void {
  ctx.save()
  ctx.transform(...object.calcTransformMatrix())
  ctx.globalAlpha *= object.opacity
  // A group's parts are placed within it only while it says its own place is already on the context (as its own render does).
  const group = object instanceof Group ? (object as Group & { _transformDone?: boolean }) : undefined
  if (group) group._transformDone = true
  object.drawObject(ctx, false, {})
  if (group) group._transformDone = false
  ctx.restore()
}

/** Under the inset's own parts: the lines to its marker and, when it shows one, the magnified copy. In page coordinates. */
function drawUnderneath(inset: CalloutInset, ctx: CanvasRenderingContext2D): void {
  const marker = markerOf(inset)
  const settings = insetSettingsOf(inset)
  ctx.save()
  ctx.transform(...util.invertTransform(inset.calcTransformMatrix()))
  const look = lineLook(settings.look)
  ctx.strokeStyle = settings.colour
  ctx.lineWidth = look.width
  ctx.setLineDash(look.dash ?? [])
  ctx.beginPath()
  for (const [a, b] of insetLines(inset, marker)) {
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
  }
  ctx.stroke()
  ctx.setLineDash([])
  if (settings.shows === 'copy' && marker) {
    traceInset(ctx, inset)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.clip()
    ctx.transform(...copyMatrix(inset, marker))
    for (const object of copySources(inset)) drawPlain(object, ctx)
  }
  ctx.restore()
}

const svgNumber = (value: number) => String(Math.round(value * 1000) / 1000)

/** The same as SVG, for exports and the Blocks card: lines, then the copy clipped to the inset. */
function underneathSvg(inset: CalloutInset): string {
  const marker = markerOf(inset)
  const settings = insetSettingsOf(inset)
  const look = lineLook(settings.look)
  const lines = insetLines(inset, marker)
    .map(([a, b]) => `<path d="M ${svgNumber(a.x)} ${svgNumber(a.y)} L ${svgNumber(b.x)} ${svgNumber(b.y)}" fill="none" stroke="${settings.colour}" stroke-width="${look.width}"${look.dash ? ` stroke-dasharray="${look.dash.join(' ')}"` : ''}/>`)
    .join('')
  let copy = ''
  if (settings.shows === 'copy' && marker) {
    const { centre, radius } = insetCircle(inset)
    const shape =
      settings.look === 'frame'
        ? `<rect x="${svgNumber(centre.x - radius)}" y="${svgNumber(centre.y - radius)}" width="${svgNumber(2 * radius)}" height="${svgNumber(2 * radius)}" rx="6"/>`
        : `<circle cx="${svgNumber(centre.x)}" cy="${svgNumber(centre.y)}" r="${svgNumber(radius)}"/>`
    const clip = `callout-clip-${idOf(inset) ?? 'inset'}`
    const matrix = copyMatrix(inset, marker).map(svgNumber).join(' ')
    copy = `<clipPath id="${clip}">${shape}</clipPath><g clip-path="url(#${clip})"><g fill="#ffffff">${shape}</g><g transform="matrix(${matrix})">${copySources(inset)
      .map((object) => object.toSVG())
      .join('')}</g></g>`
  }
  if (!lines && !copy) return ''
  // Drawn in page coordinates: inside a group, the group's own place is taken back out.
  const parent = inset.group
  const back = parent ? util.invertTransform(parent.calcTransformMatrix()).map(svgNumber).join(' ') : undefined
  return back ? `<g transform="matrix(${back})">${lines}${copy}</g>` : lines + copy
}

/* ---------- Building ---------- */

/** The inset's parts around `centre`: its frame first, then the zoom tag and caption. */
function insetParts(settings: InsetSettings, centre: XY, size: number, zoom: number): FabricObject[] {
  const r = size / 2
  const { colour, look } = settings
  // Showing a copy, the white under it is drawn with the copy (see drawUnderneath).
  const fill = settings.shows === 'copy' ? 'rgba(0,0,0,0)' : look === 'pin' ? wash(colour, 0.12) : '#ffffff'
  const width = look === 'pin' ? 3 : 2
  const frame =
    look === 'frame'
      ? new Rect({ left: centre.x, top: centre.y, width: size, height: size, rx: 6, ry: 6, fill, stroke: colour, strokeWidth: width, originX: 'center', originY: 'center' })
      : new Circle({ left: centre.x, top: centre.y, radius: r, fill, stroke: colour, strokeWidth: width, originX: 'center', originY: 'center' })
  const parts: FabricObject[] = [frame]
  if (look === 'frame' && settings.tag) {
    const label = text(zoomText(zoom), { colour: '#ffffff', weight: 600, size: 10 })
    const tag = { width: Math.max(28, label.width + 10), height: 17 }
    // On the frame's bottom edge, half outside it, so the icon in the frame never covers it (owner's feedback, 2026-11-26).
    const corner = { x: centre.x + r - tag.width - 8, y: centre.y + r - tag.height / 2 }
    parts.push(new Rect({ left: corner.x, top: corner.y, width: tag.width, height: tag.height, rx: 4, ry: 4, fill: colour, strokeWidth: 0, originX: 'left', originY: 'top' }))
    label.set({ left: corner.x + (tag.width - label.width) / 2, top: corner.y + (tag.height - label.height) / 2 })
    parts.push(label)
  }
  if (settings.captionShown && settings.caption.trim()) {
    const caption = text(settings.caption.trim(), { colour, weight: 600, size: 12 })
    caption.set({ left: centre.x - caption.width / 2, top: centre.y + r + width / 2 + CAPTION_GAP })
    parts.push(caption)
  }
  return parts
}

/** Put the inset's parts in again for its settings and size, its frame's middle staying at `centre` (else where it is). */
export function redrawInset(inset: CalloutInset, zoom: number, centre?: XY): void {
  const middle = centre ?? insetCircle(inset).centre
  inset.set({ scaleX: 1, scaleY: 1, angle: 0 })
  inset.removeAll()
  inset.add(...insetParts(insetSettingsOf(inset), middle, insetSizeOf(inset), zoom))
  const now = insetCircle(inset).centre
  inset.set({ left: inset.left + middle.x - now.x, top: inset.top + middle.y - now.y })
  inset.setCoords()
}

export function buildInset(settings: InsetSettings, centre: XY, size: number, zoom: number): CalloutInset {
  const inset = new CalloutInset(insetParts(settings, centre, size, zoom), { lockRotation: true, lockSkewingX: true, lockSkewingY: true })
  Object.assign(inset, { inset: { ...settings }, insetSize: size, name: 'Zoom inset' })
  const now = insetCircle(inset).centre
  inset.set({ left: inset.left + centre.x - now.x, top: inset.top + centre.y - now.y })
  inset.setCoords()
  return inset
}

function markerParts(look: InsetLook, colour: string, size: number, centre: XY): FabricObject[] {
  if (look === 'pin') return [new Circle({ left: centre.x, top: centre.y, radius: PIN_DOT, fill: colour, stroke: '#ffffff', strokeWidth: 2, originX: 'center', originY: 'center' })]
  if (look === 'frame')
    return [new Rect({ left: centre.x, top: centre.y, width: size, height: size, rx: 2, ry: 2, fill: 'rgba(0,0,0,0)', stroke: colour, strokeWidth: 1.5, strokeDashArray: [4, 3], originX: 'center', originY: 'center' })]
  return [new Circle({ left: centre.x, top: centre.y, radius: size / 2, fill: alpha(colour, 0.08), stroke: colour, strokeWidth: 1.5, originX: 'center', originY: 'center' })]
}

export function buildMarker(look: InsetLook, colour: string, size: number, centre: XY): CalloutMarker {
  const marker = new CalloutMarker(markerParts(look, colour, size, centre), { lockRotation: true, lockSkewingX: true, lockSkewingY: true })
  Object.assign(marker, { markerSize: size, markerLook: look, markerColour: colour, name: 'Zoom marker' })
  marker.setPositionByOrigin(new Point(centre.x, centre.y), 'center', 'center')
  marker.setCoords()
  return marker
}

/** Draw the marker again for a look, colour or size, its middle staying put. */
export function redrawMarker(marker: CalloutMarker, change: { look?: InsetLook; colour?: string; size?: number } = {}): void {
  const centre = marker.getCenterPoint()
  if (change.look) marker.markerLook = change.look
  if (change.colour) marker.markerColour = change.colour
  if (change.size !== undefined) marker.markerSize = Math.min(MARKER_SIZE_RANGE.max, Math.max(MARKER_SIZE_RANGE.min, change.size))
  marker.set({ scaleX: 1, scaleY: 1, angle: 0 })
  marker.removeAll()
  marker.add(...markerParts(marker.markerLook ?? 'lens', marker.markerColour ?? CALLOUT_BLUE, markerSizeOf(marker), centre))
  marker.setPositionByOrigin(centre, 'center', 'center')
  marker.setCoords()
}

/** A marker being resized takes the stretch into its size (never stretched), its opposite corner staying put. */
export function bakeMarkerScale(marker: CalloutMarker, originX: 'left' | 'center' | 'right' = 'center', originY: 'top' | 'center' | 'bottom' = 'center'): void {
  const { scaleX: sx, scaleY: sy } = marker
  if (sx === 1 && sy === 1) return
  const pinned = marker.getPointByOrigin(originX, originY)
  const stretch = Math.abs(sx - 1) >= Math.abs(sy - 1) ? Math.abs(sx) : Math.abs(sy)
  redrawMarker(marker, { size: markerSizeOf(marker) * stretch })
  marker.setPositionByOrigin(pinned, originX, originY)
  marker.setCoords()
}

/** An inset being resized takes the stretch into its size (its tag and caption keep theirs), its opposite corner staying put. */
export function bakeInsetScale(inset: CalloutInset, zoomFor: (size: number) => number, originX: 'left' | 'center' | 'right' = 'center', originY: 'top' | 'center' | 'bottom' = 'center'): void {
  const { scaleX: sx, scaleY: sy } = inset
  if (sx === 1 && sy === 1) return
  const pinned = inset.getPointByOrigin(originX, originY)
  const stretch = Math.abs(sx - 1) >= Math.abs(sy - 1) ? Math.abs(sx) : Math.abs(sy)
  inset.insetSize = Math.min(INSET_SIZE_RANGE.max, Math.max(INSET_SIZE_RANGE.min, insetSizeOf(inset) * stretch))
  redrawInset(inset, zoomFor(inset.insetSize))
  inset.setPositionByOrigin(pinned, originX, originY)
  inset.setCoords()
}

/** The box the icon (or icon space) sits in: as big as fits in the circle or square, with a little room. */
export function insetRoom(inset: CalloutInset): Box {
  const { centre, radius } = insetCircle(inset)
  const half = insetSettingsOf(inset).look === 'frame' ? radius - 10 : radius * 0.72
  return { x: centre.x - half, y: centre.y - half, width: 2 * half, height: 2 * half }
}

/** The empty icon space a new inset (or one switched to icons) holds. */
export function insetSpace(inset: CalloutInset): IconSpace {
  const room = insetRoom(inset)
  return buildIconSpace({ x: room.x, y: room.y }, { width: room.width, height: room.height }, insetSettingsOf(inset).colour)
}

/** Put what the inset holds (an icon space or the icon in it) in the middle of the inset, as big as fits. It isn't resized on its own (dragging it drags the inset). */
export function fitInsetContent(inset: CalloutInset, content: FabricObject): void {
  const room = insetRoom(inset)
  const middle = new Point(room.x + room.width / 2, room.y + room.height / 2)
  if (content instanceof IconSpace) {
    // Round in a round inset (Lens, Pin), a rounded square in the Frame (owner's feedback, 2026-11-26).
    roundIconSpace(content, insetSettingsOf(inset).look !== 'frame')
    if (Math.abs((content.spaceWidth ?? 0) - room.width) > 0.5 || Math.abs((content.spaceHeight ?? 0) - room.height) > 0.5) resizeIconSpace(content, { width: room.width, height: room.height })
  } else if (content instanceof IconCard) {
    const holder = cardFrameOf(content).holder
    if (holder && Math.abs(holder.width - room.width) > 0.5) {
      content.set({ scaleX: room.width / holder.width, scaleY: room.height / holder.height })
      bakeCardScale(content, 'center', 'center')
    }
  }
  content.setPositionByOrigin(middle, 'center', 'center')
  content.set({ hasControls: false })
  content.setCoords()
}

/** A new zoom inset: the inset up and to the right of `centre`, its marker down and to the left, an empty icon space in it. */
export function buildZoomInset(look: InsetLook, centre: XY): { inset: CalloutInset; marker: CalloutMarker; space: IconSpace } {
  const settings: InsetSettings = { ...DEFAULT_INSET, look, captionShown: look === 'pin' }
  const inset = buildInset(settings, { x: centre.x + 70, y: centre.y - 20 }, NEW_INSET_SIZE, NEW_INSET_SIZE / NEW_MARKER_SIZE)
  const marker = buildMarker(look, settings.colour, NEW_MARKER_SIZE, { x: centre.x - 110, y: centre.y + 50 })
  inset.markerHint = marker
  return { inset, marker, space: insetSpace(inset) }
}

/** Take an inset apart into plain shapes where it is: its frame, tag and caption, the lines, and its marker's shape. Both are left empty. */
export function detachedInsetParts(inset: CalloutInset, marker: CalloutMarker | undefined): FabricObject[] {
  const settings = insetSettingsOf(inset)
  const look = lineLook(settings.look)
  const lines = insetLines(inset, marker).map(([a, b]) =>
    Object.assign(new Path(`M ${a.x} ${a.y} L ${b.x} ${b.y}`, { fill: '', stroke: settings.colour, strokeWidth: look.width, strokeDashArray: look.dash ?? null, objectCaching: false }), { name: 'Line' }),
  )
  const own = inset.removeAll().map((part) => {
    if (part instanceof FabricText) return Object.assign(new IText(part.text, { left: part.left, top: part.top, originX: part.originX, originY: part.originY, fontFamily: part.fontFamily, fontSize: part.fontSize, fontWeight: part.fontWeight, fill: part.fill, strokeWidth: 0 }), { name: part.text })
    return Object.assign(part, { name: part instanceof Circle ? 'Inset circle' : 'Inset frame' })
  })
  const dot = marker ? marker.removeAll().map((part) => Object.assign(part, { name: 'Marker' })) : []
  return [...lines, ...own, ...dot]
}

/**
 * A magnified copy as plain objects (copies of what lies under the marker),
 * scaled and clipped to the inset's shape, in a group made by `group`.
 */
export async function frozenCopy(inset: CalloutInset, marker: CalloutMarker, group: (objects: FabricObject[]) => Group, keep: readonly string[]): Promise<Group | undefined> {
  const sources = copySources(inset)
  if (sources.length === 0) return undefined
  const copies = await Promise.all(sources.map((object) => object.clone([...keep])))
  const made = group(copies)
  const i = insetCircle(inset)
  const m = markerCircle(marker)
  const zoom = i.radius / Math.max(0.5, m.radius)
  const middle = made.getCenterPoint()
  // The clip is in the group's own units (before it is scaled up): the marked area.
  const local = { x: m.centre.x - middle.x, y: m.centre.y - middle.y }
  made.clipPath =
    insetSettingsOf(inset).look === 'frame'
      ? new Rect({ left: local.x, top: local.y, width: 2 * m.radius, height: 2 * m.radius, rx: 6 / zoom, ry: 6 / zoom, originX: 'center', originY: 'center' })
      : new Circle({ left: local.x, top: local.y, radius: m.radius, originX: 'center', originY: 'center' })
  made.set({ scaleX: zoom, scaleY: zoom })
  made.setPositionByOrigin(new Point(i.centre.x + (middle.x - m.centre.x) * zoom, i.centre.y + (middle.y - m.centre.y) * zoom), 'center', 'center')
  made.setCoords()
  return Object.assign(made, { name: 'Magnified copy' })
}

/* =====================================================================
 * Labelled icon
 * ===================================================================== */

export type LabelLook = 'plain' | 'chips' | 'numbers'

export type LabelSettings = {
  look: LabelLook
  colour: string
  /** Where the key starts in the numbers look, from the subject's top-right corner. */
  key: XY
}

export const LABEL_LOOKS: readonly { id: LabelLook; name: string }[] = [
  { id: 'plain', name: 'Plain lines' },
  { id: 'chips', name: 'Chips' },
  { id: 'numbers', name: 'Numbers + key' },
]

export const DEFAULT_LABELS: LabelSettings = { look: 'plain', colour: CALLOUT_BLUE, key: { x: 36, y: 6 } }
export const NEW_SUBJECT_SIZE = 112
const LABEL_SIZE = 12
const KEY_STEP = 24
const KEY_BADGE = 8
const BADGE = 9
const CHIP = { padX: 8, padY: 4 }

export class CalloutLabels extends Group {
  static type = 'CalloutLabels'
  declare labelBlock?: LabelSettings
}
classRegistry.setClass(CalloutLabels)

/** A label of a labelled icon: a text box with the spot it points at. */
export type CalloutLabel = IText & { calloutPart: XY }

export const isLabelBlock = (object: FabricObject | undefined): object is CalloutLabels => object instanceof CalloutLabels
export const isCalloutLabel = (object: FabricObject | undefined): object is CalloutLabel => {
  const part: unknown = object && 'calloutPart' in object ? object.calloutPart : undefined
  return object instanceof IText && typeof part === 'object' && part !== null
}

export function labelSettingsOf(block: CalloutLabels): LabelSettings {
  const saved = block.labelBlock
  return { ...DEFAULT_LABELS, ...saved, key: { ...DEFAULT_LABELS.key, ...saved?.key } }
}

/** What the properties panel shows about a selected callout. */
export type CalloutInfo =
  | { kind: 'inset'; settings: InsetSettings; insetSize: number; markerSize: number }
  | { kind: 'labels'; settings: LabelSettings; labels: string[] }

/** Callout blocks' saved properties, besides the usual ones. */
export const CALLOUT_PROPERTIES = ['inset', 'insetSize', 'markerSize', 'markerLook', 'markerColour', 'labelBlock', 'calloutPart'] as const

/** What a label looks like in a look: blue and bold on a chip, else dark. */
export function labelTextLook(look: LabelLook, colour: string): { fill: string; fontWeight: number } {
  return look === 'chips' ? { fill: colour, fontWeight: 600 } : { fill: INK, fontWeight: 500 }
}

export function makeLabel(value: string, part: XY, at: XY, settings: LabelSettings): CalloutLabel {
  const label = new IText(value, { left: at.x, top: at.y, fontFamily: fontStack(DEFAULT_FONT), fontSize: LABEL_SIZE, strokeWidth: 0, originX: 'left', originY: 'top', ...labelTextLook(settings.look, settings.colour) })
  return Object.assign(label, { calloutPart: { ...part }, name: value })
}

/** The block's labels and its subject (the icon space or icon), in stacking order. */
export function labelParts(block: CalloutLabels, objects: readonly FabricObject[]): { subject?: FabricObject; labels: CalloutLabel[] } {
  const contents = contentsOf(block, objects)
  return { subject: contents.find((object) => !isCalloutLabel(object)), labels: contents.filter(isCalloutLabel) }
}

const partOf = (label: CalloutLabel): XY => ({ x: Math.min(1, Math.max(0, label.calloutPart.x)), y: Math.min(1, Math.max(0, label.calloutPart.y)) })
export const partPoint = (label: CalloutLabel, subject: Box): XY => {
  const part = partOf(label)
  return { x: subject.x + part.x * subject.width, y: subject.y + part.y * subject.height }
}

function polyline(points: readonly XY[], colour: string, width: number): Path {
  return new Path(`M ${points.map((p) => `${p.x} ${p.y}`).join(' L ')}`, { fill: '', stroke: colour, strokeWidth: width, strokeLineJoin: 'round', strokeLineCap: 'round', objectCaching: false })
}

const dot = (at: XY, radius: number, fill: string, stroke?: string, width = 0) =>
  new Circle({ left: at.x, top: at.y, radius, fill, stroke, strokeWidth: stroke ? width : 0, originX: 'center', originY: 'center' })

function numberBadge(at: XY, radius: number, colour: string, number: number, size: number): FabricObject[] {
  const label = text(String(number), { colour: '#ffffff', weight: 700, size })
  label.set({ left: at.x - label.width / 2, top: at.y - label.height / 2 })
  return [dot(at, radius, colour), label]
}

/** Where a numbered badge sits: out from the subject's middle through the spot, just past its edge. */
function badgePlace(point: XY, subject: Box): XY {
  const centre = { x: subject.x + subject.width / 2, y: subject.y + subject.height / 2 }
  const d = Math.hypot(point.x - centre.x, point.y - centre.y)
  const u = d < 0.5 ? { x: 0, y: -1 } : { x: (point.x - centre.x) / d, y: (point.y - centre.y) / d }
  const exit = Math.min(Math.abs(u.x) > 1e-6 ? subject.width / 2 / Math.abs(u.x) : Infinity, Math.abs(u.y) > 1e-6 ? subject.height / 2 / Math.abs(u.y) : Infinity)
  const reach = Math.max(exit + BADGE + 8, d + BADGE + 10)
  return { x: centre.x + u.x * reach, y: centre.y + u.y * reach }
}

/** Where the key's rows are in the numbers look: the badge's middle of row `i`. */
export function keyRow(settings: LabelSettings, subject: Box, i: number): XY {
  return { x: subject.x + subject.width + settings.key.x, y: subject.y + settings.key.y + KEY_BADGE + i * KEY_STEP }
}

/**
 * The look's parts in page coordinates, for a subject's box and its labels.
 * In the numbers look the labels are put in the key's rows first; `dragged`
 * (a label being moved) sets where the key is instead.
 */
export function labelsPlan(settings: LabelSettings, subject: Box, labels: readonly CalloutLabel[], dragged?: FabricObject): { parts: FabricObject[]; key?: XY } {
  const { look, colour } = settings
  const parts: FabricObject[] = []
  let key: XY | undefined
  if (look === 'numbers') {
    const index = labels.findIndex((label) => label === dragged)
    const moved = labels.at(index)
    if (moved && index >= 0) {
      const box = boxOfPart(moved)
      // The inverse of keyRow, for this label's row: its text starts a badge and a gap right of the row's badge.
      key = { x: box.x - KEY_BADGE - 6 - (subject.x + subject.width), y: box.y + box.height / 2 - KEY_BADGE - index * KEY_STEP - subject.y }
      settings = { ...settings, key }
    }
    labels.forEach((label, i) => {
      const row = keyRow(settings, subject, i)
      if (label !== dragged) {
        label.set({ left: row.x + KEY_BADGE + 6, top: row.y - label.height / 2 })
        label.setCoords()
      }
      parts.push(...numberBadge(row, KEY_BADGE, colour, i + 1, 9.5))
    })
  }
  labels.forEach((label, i) => {
    const point = partPoint(label, subject)
    const box = boxOfPart(label)
    const middleY = box.y + box.height / 2
    const right = box.x + box.width / 2 >= point.x
    if (look === 'plain') {
      const end = { x: right ? box.x - 4 : box.x + box.width + 4, y: middleY }
      const elbow = { x: end.x + (right ? -12 : 12), y: end.y }
      parts.push(polyline([point, elbow, end], INK, 1), dot(point, 2.5, INK))
    } else if (look === 'chips') {
      const chip = { x: box.x - CHIP.padX, y: box.y - CHIP.padY, width: box.width + 2 * CHIP.padX, height: box.height + 2 * CHIP.padY }
      const end = { x: right ? chip.x : chip.x + chip.width, y: middleY }
      const bend = { x: point.x + (right ? 1 : -1) * Math.min(18, Math.abs(end.y - point.y), Math.abs(end.x - point.x)), y: end.y }
      parts.push(polyline([point, bend, end], colour, 1.25))
      parts.push(new Rect({ left: chip.x, top: chip.y, width: chip.width, height: chip.height, rx: chip.height / 2, ry: chip.height / 2, fill: wash(colour, 0.12), stroke: colour, strokeWidth: 1, originX: 'left', originY: 'top' }))
      parts.push(dot(point, 3.5, '#ffffff', colour, 1.5))
    } else {
      const badge = badgePlace(point, subject)
      const d = Math.hypot(badge.x - point.x, badge.y - point.y)
      const edge = d > BADGE ? { x: badge.x - ((badge.x - point.x) / d) * BADGE, y: badge.y - ((badge.y - point.y) / d) * BADGE } : point
      parts.push(polyline([point, edge], colour, 1.25), dot(point, 2.5, colour), ...numberBadge(badge, BADGE, colour, i + 1, 10))
    }
  })
  // Chips go under their text, but over their lines: lines first, then chips and dots, as pushed.
  return { parts, ...(key && { key }) }
}

function frameRect(frame: Box): Rect {
  return new Rect({ left: frame.x, top: frame.y, width: frame.width, height: frame.height, fill: 'rgba(0,0,0,0)', strokeWidth: 0, originX: 'left', originY: 'top' })
}

/** The block's whole area on the page (its subject, labels and look). */
export function labelsBox(block: CalloutLabels): Box {
  const frame = block.getObjects()[0]
  if (!frame) {
    const rect = block.getBoundingRect()
    return { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
  }
  const matrix = util.multiplyTransformMatrices(block.calcTransformMatrix(), frame.calcOwnMatrix())
  const corner = util.transformPoint(new Point(-frame.width / 2, -frame.height / 2), matrix)
  return { x: corner.x, y: corner.y, width: frame.width * block.scaleX, height: frame.height * block.scaleY }
}

function fillLabels(block: CalloutLabels, parts: FabricObject[], frame: Box): void {
  block.set({ scaleX: 1, scaleY: 1, angle: 0 })
  block.removeAll()
  block.add(frameRect(frame), ...parts)
  const now = labelsBox(block)
  block.set({ left: block.left + frame.x - now.x, top: block.top + frame.y - now.y })
  block.setCoords()
}

/** Draw the block's look again round its subject and labels (`dragged` is a label being moved). */
export function layOutLabels(block: CalloutLabels, subject: FabricObject | undefined, labels: readonly CalloutLabel[], boxOf: (object: FabricObject) => Box, dragged?: FabricObject): void {
  const settings = labelSettingsOf(block)
  if (!subject) {
    const boxes = labels.map(boxOfPart)
    if (boxes.length > 0) fillLabels(block, [], union(boxes))
    return
  }
  const box = boxOf(subject)
  const plan = labelsPlan(settings, box, labels, dragged)
  if (plan.key) block.labelBlock = { ...settings, key: plan.key }
  const frame = union([box, ...labels.map(boxOfPart), ...plan.parts.map(boxOfPart)])
  fillLabels(block, plan.parts, frame)
}

export function buildLabelBlock(settings: LabelSettings, subject: FabricObject, labels: readonly CalloutLabel[], boxOf: (object: FabricObject) => Box): CalloutLabels {
  const box = boxOf(subject)
  const plan = labelsPlan(settings, box, labels)
  const frame = union([box, ...labels.map(boxOfPart), ...plan.parts.map(boxOfPart)])
  const block = new CalloutLabels([frameRect(frame), ...plan.parts], { lockRotation: true, lockScalingX: true, lockScalingY: true, lockSkewingX: true, lockSkewingY: true })
  Object.assign(block, { labelBlock: { ...settings, ...(plan.key && { key: plan.key }) }, name: 'Labelled icon' })
  const now = labelsBox(block)
  block.set({ left: block.left + frame.x - now.x, top: block.top + frame.y - now.y })
  block.setCoords()
  return block
}

/** Where a new label goes: beside the subject on the side with fewer labels, under the lowest one there. */
export function nextLabelPlace(subject: Box, labels: readonly CalloutLabel[]): { part: XY; at: XY; right: boolean } {
  const middle = subject.x + subject.width / 2
  const boxes = labels.map((label) => ({ label, box: boxOfPart(label) }))
  const onRight = boxes.filter(({ box }) => box.x + box.width / 2 >= middle)
  const onLeft = boxes.filter(({ box }) => box.x + box.width / 2 < middle)
  const right = onRight.length <= onLeft.length
  const side = right ? onRight : onLeft
  const lowest = side.reduce((most, { box }) => Math.max(most, box.y + box.height), subject.y - 6)
  const y = side.length === 0 ? subject.y + subject.height * 0.2 : lowest + 18
  return { part: { x: right ? 0.8 : 0.2, y: Math.min(0.9, Math.max(0.1, (y - subject.y) / subject.height)) }, at: { x: right ? subject.x + subject.width + 44 : subject.x - 44, y }, right }
}

/** A new labelled icon: an empty icon space with three labels, two on the right and one on the left, the space's middle at `centre`. */
export function buildLabelledIcon(look: LabelLook, centre: XY): { block: CalloutLabels; space: IconSpace; labels: CalloutLabel[] } {
  const settings: LabelSettings = { ...DEFAULT_LABELS, look }
  const size = NEW_SUBJECT_SIZE
  const space = buildIconSpace({ x: centre.x - size / 2, y: centre.y - size / 2 }, { width: size, height: size })
  const box = spaceBox(space)
  const subject = { x: centre.x - size / 2, y: centre.y - size / 2, width: size, height: size }
  const spots: { part: XY; right: boolean; y: number }[] = [
    { part: { x: 0.72, y: 0.18 }, right: true, y: subject.y + 2 },
    { part: { x: 0.82, y: 0.72 }, right: true, y: subject.y + subject.height * 0.62 },
    { part: { x: 0.22, y: 0.45 }, right: false, y: subject.y + subject.height * 0.34 },
  ]
  const labels = spots.map(({ part, right, y }, i) => {
    const label = makeLabel(`Label ${i + 1}`, part, { x: 0, y }, settings)
    label.set({ left: right ? subject.x + subject.width + 44 : subject.x - 44 - label.width })
    label.setCoords()
    return label
  })
  const block = buildLabelBlock(settings, space, labels, () => box)
  return { block, space, labels }
}

/**
 * Take a labelled icon's look apart into plain shapes where they are (its
 * invisible frame goes; badge numbers become text boxes). The block is left empty.
 */
export function detachedLabelParts(block: CalloutLabels): FabricObject[] {
  return block
    .removeAll()
    .slice(1)
    .map((part) => {
      if (part instanceof FabricText) return Object.assign(new IText(part.text, { left: part.left, top: part.top, originX: part.originX, originY: part.originY, fontFamily: part.fontFamily, fontSize: part.fontSize, fontWeight: part.fontWeight, fill: part.fill, strokeWidth: 0 }), { name: part.text })
      return Object.assign(part, { name: part instanceof Circle ? 'Dot' : part instanceof Rect ? 'Chip' : 'Line' })
    })
}
