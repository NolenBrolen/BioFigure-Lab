/**
 * Text inside closed shapes (rectangles, ellipses, polygons, stars, cells,
 * callouts). The shape keeps its text as a saved setting (`label`), so the
 * text moves, scales, rotates, copies, saves and undoes with the shape, and
 * the shape draws it itself, centred in its inner box and wrapped to its width.
 *
 * Double-clicking a shape puts a text box over that inner box to type in;
 * when typing stops, the text goes back into the shape. Each shape has a fit
 * (see `fitText`): `grow` makes the shape wider and taller as the text needs
 * (lines break only where Enter is pressed); `wrap` keeps the width, wraps the
 * lines and makes the shape taller; `shrink` keeps the shape's size and draws
 * the text smaller, on one line, down to 2 pt, and only then wraps it (and
 * grows the shape taller if that still doesn't fit). Fitting never makes a
 * shape smaller, and happens while a shape is being resized too.
 *
 * A shape keeps the look of its text also while it holds none (a label with
 * empty text), so its text can be styled before anything is typed.
 */
import { Ellipse, FabricObject, IText, Path, Point, Rect, Textbox, util, type Canvas, type TOriginX, type TOriginY, type TPointerEvent, type Transform } from 'fabric'

import { BRACKETS, DOUBLE_BRACKETS, doubleBracketArm, type ShapeKind } from '@biofigure-lab/ui/lib/arrow-geometry'

/** What happens when the text gets too long for its shape. */
export type TextFit = 'grow' | 'wrap' | 'shrink'
/** The fit of a shape that has none stored (older figures); new shapes from the Shapes panel start on Shrink. */
export const DEFAULT_TEXT_FIT: TextFit = 'grow'

/** Room between the text and the inner box's edges, in page pixels. */
export const SHAPE_TEXT_PADDING = 6
/** "Shrink text" never draws text smaller than this (2 pt, was 8 pt), in page pixels. */
export const MIN_SHAPE_FONT_SIZE = (2 * 96) / 72

/** The shapes that take text: the closed ones, and brackets (single ones' text sits beside them, double ones' between them). */
export type TextShape = Exclude<ShapeKind, 'line' | 'membrane'>

/**
 * Shapes whose text sits outside them, past the bracket's point (on the right,
 * or on the left when the bracket is mirrored), centred on its height. Their
 * text never wraps or shrinks, and never makes the bracket bigger.
 */
export const OUTSIDE_TEXT: ReadonlySet<ShapeKind> = new Set([...BRACKETS].filter((kind) => !DOUBLE_BRACKETS.has(kind)))
/** Room between a bracket's point and its text, in page pixels. */
export const OUTSIDE_TEXT_GAP = 16

const isOutside = (object: FabricObject) => OUTSIDE_TEXT.has((object as WithText).shapeKind ?? 'rectangle')
const isDouble = (object: FabricObject) => DOUBLE_BRACKETS.has((object as WithText).shapeKind ?? 'rectangle')

/**
 * Where a bracket's text sits: its middle, measured from the bracket's middle
 * in page pixels and turned the way the page is (not mirrored with the
 * bracket), for text `textWidth` wide.
 */
function outsideBox(object: FabricObject, textWidth: number, textHeight: number): InnerBox {
  const side = object.flipX ? -1 : 1
  return { x: side * (sizeOf(object).width / 2 + OUTSIDE_TEXT_GAP + textWidth / 2), y: 0, width: textWidth, height: textHeight }
}

/** The look a shape's new text starts with: brackets line it up on the left, against the bracket. */
export const lookFor = (object: FabricObject, look: ShapeLabel): ShapeLabel => (isOutside(object) ? { ...look, textAlign: 'left' } : look)

/**
 * How much of a shape's box its text area takes (as shares of the width and
 * height), and where the area's middle sits (as shares of the height and,
 * when not halfway, the width). Round and pointed shapes leave their curved
 * edges and tips free.
 */
const INNER: Record<TextShape, { x: number; y: number; middle: number; centre?: number }> = {
  rectangle: { x: 1, y: 1, middle: 0.5 },
  rounded: { x: 0.92, y: 0.96, middle: 0.5 },
  ellipse: { x: 0.71, y: 0.71, middle: 0.5 },
  circle: { x: 0.71, y: 0.71, middle: 0.5 },
  pill: { x: 0.8, y: 0.86, middle: 0.5 },
  cell: { x: 0.66, y: 0.66, middle: 0.5 },
  // The wide part, below the tip.
  triangle: { x: 0.5, y: 0.45, middle: 0.72 },
  // The square that fits in the corner with the right angle.
  'right-triangle': { x: 0.41, y: 0.41, middle: 0.71, centre: 0.29 },
  diamond: { x: 0.5, y: 0.5, middle: 0.5 },
  trapezoid: { x: 0.62, y: 0.9, middle: 0.5 },
  parallelogram: { x: 0.55, y: 0.8, middle: 0.5 },
  pentagon: { x: 0.7, y: 0.6, middle: 0.56 },
  polygon: { x: 0.82, y: 0.56, middle: 0.5 },
  octagon: { x: 0.7, y: 0.7, middle: 0.5 },
  star: { x: 0.4, y: 0.34, middle: 0.53 },
  // The left half, out of the cut-out quarter.
  pie: { x: 0.46, y: 0.6, middle: 0.5, centre: 0.3 },
  // The square that fits in its corner, at the bottom left.
  slice: { x: 0.6, y: 0.6, middle: 0.66, centre: 0.34 },
  // The bubble above the tail.
  callout: { x: 1, y: 0.75, middle: 0.375 },
  // Not used: their text sits outside them (see `outsideBox`).
  bracket: { x: 1, y: 1, middle: 0.5 },
  brace: { x: 1, y: 1, middle: 0.5 },
  // Between the brackets, which take a few pixels of the width each.
  'double-bracket': { x: 0.84, y: 1, middle: 0.5 },
  'double-brace': { x: 0.84, y: 1, middle: 0.5 },
}

/** The box text sits in: its middle, measured from the shape's middle, and its size. All in page pixels. */
export type InnerBox = { x: number; y: number; width: number; height: number }

export function innerBox(shape: TextShape, width: number, height: number): InnerBox {
  const share = INNER[shape]
  return {
    x: ((share.centre ?? 0.5) - 0.5) * width,
    y: (share.middle - 0.5) * height,
    width: Math.max(1, width * share.x - 2 * SHAPE_TEXT_PADDING),
    height: Math.max(1, height * share.y - 2 * SHAPE_TEXT_PADDING),
  }
}

/** How tall a shape must be for text this tall to fit in its inner box. */
export function heightForText(shape: TextShape, textHeight: number): number {
  return (textHeight + 2 * SHAPE_TEXT_PADDING) / INNER[shape].y
}

/** How wide a shape must be for a line this wide to fit in its inner box (with a pixel to spare, so it doesn't wrap). */
export function widthForText(shape: TextShape, textWidth: number): number {
  return (textWidth + 2 * SHAPE_TEXT_PADDING) / INNER[shape].x + 1
}

/** Lays the text out wrapped at a width (`Infinity`: only where Enter was pressed) and gives back the size it takes. */
export type Measure = (width: number) => { width: number; height: number }

/** A shape's size for its text, and how much smaller than its own size the text is drawn. */
export type Fitted = { width: number; height: number; scale: number }

/**
 * The size a shape takes for its text, starting from the size it's asked to
 * have (`size`), which fitting never makes smaller.
 * - `grow`: wide enough for the longest line and tall enough for all lines.
 * - `wrap`: as wide as asked; the lines wrap and the shape gets taller.
 * - `shrink`: as big as asked; the text is drawn smaller to fit without
 *   wrapping, down to `smallest` (a share of its own size). Only then do the
 *   lines wrap, at that size, and the shape gets taller if they need it.
 * With `keep: 'height'` the height is being set by hand (dragging a top or
 * bottom handle), so wrapped lines make the shape wider instead of taller.
 * `growLimit` is how wide `grow` may make the shape before its lines wrap
 * (and it gets taller instead), once the text has been given a width.
 */
export function fitText(shape: TextShape, fit: TextFit, measure: Measure, size: { width: number; height: number }, smallest: number, keep?: 'height', growLimit?: number): Fitted {
  const line = measure(Infinity)
  if (fit === 'grow') {
    const unwrapped = widthForText(shape, line.width)
    const widest = Math.max(size.width, growLimit ?? Infinity)
    if (unwrapped <= widest) return { width: Math.max(size.width, unwrapped), height: Math.max(size.height, heightForText(shape, line.height)), scale: 1 }
    size = { width: widest, height: size.height }
  }
  let scale = 1
  if (fit === 'shrink') {
    const inner = innerBox(shape, size.width, size.height)
    scale = Math.min(1, inner.width / line.width, inner.height / line.height)
    if (scale >= smallest) return { ...size, scale }
    scale = Math.min(1, smallest)
  }
  // From here the lines wrap, drawn at `scale`.
  const heightAt = (width: number) => heightForText(shape, measure(wrapWidth(shape, width, scale)).height * scale)
  if (keep === 'height' && heightAt(size.width) > size.height + 0.01) {
    // Wider than one line per paragraph makes no difference.
    const widest = Math.max(size.width, widthForText(shape, line.width * scale))
    if (heightAt(widest) > size.height + 0.01) return { width: widest, height: heightAt(widest), scale }
    let [low, high] = [size.width, widest]
    for (let step = 0; step < 14; step++) {
      const middle = (low + high) / 2
      if (heightAt(middle) <= size.height + 0.01) high = middle
      else low = middle
    }
    return { width: high, height: size.height, scale }
  }
  return { width: size.width, height: Math.max(size.height, heightAt(size.width)), scale }
}

/** How wide text drawn at `scale` is laid out in a shape this wide (with a pixel to spare, so a line that just fits doesn't wrap). */
const wrapWidth = (shape: TextShape, width: number, scale: number) => innerBox(shape, width, 0).width / scale + 1

/** A shape's text as saved: the characters, their own looks, and the text's look. */
export type ShapeLabel = { text: string; styles: Textbox['styles'] } & Record<(typeof LABEL_PROPS)[number], unknown>

const LABEL_PROPS = ['fontFamily', 'fontWeight', 'baseWeight', 'fontStyle', 'fontSize', 'underline', 'linethrough', 'fill', 'textBackgroundColor', 'textAlign', 'lineHeight', 'charSpacing'] as const

type WithText = FabricObject & { label?: ShapeLabel; textFit?: TextFit; growLimit?: number; shapeKind?: ShapeKind; editingLabel?: boolean }

const TEXT_SHAPES: ReadonlySet<ShapeKind> = new Set(Object.keys(INNER) as TextShape[])

/** Which kind of text-taking shape an object is, if it is one. */
export function textShapeOf(object: FabricObject): TextShape | undefined {
  if (object instanceof Rect) return 'rectangle'
  if (object instanceof Ellipse) return 'ellipse'
  const kind = (object as WithText).shapeKind
  return object instanceof Path && kind && TEXT_SHAPES.has(kind) ? (kind as TextShape) : undefined
}

export const labelOf = (object: FabricObject): ShapeLabel | undefined => (object as WithText).label
export const textFitOf = (object: FabricObject): TextFit => (object as WithText).textFit ?? DEFAULT_TEXT_FIT
/** How wide "Grow shape" may make the shape before its text wraps (see `fitText`); none: as wide as the text. */
const growLimitOf = (object: FabricObject): number | undefined => (object as WithText).growLimit

/** The shape's size on the page, without its line. */
const sizeOf = (object: FabricObject) => ({ width: object.width * object.scaleX, height: object.height * object.scaleY })

/** The text box each shape draws its text with, made again when the text changes. */
const drawn = new WeakMap<FabricObject, { label: ShapeLabel; box: Textbox; key: string; scale: number; inner: InnerBox }>()

const newBox = (label: ShapeLabel) =>
  new Textbox(label.text, { ...Object.fromEntries(LABEL_PROPS.flatMap((prop) => (label[prop] === undefined ? [] : [[prop, label[prop]]]))), styles: structuredClone(label.styles), originX: 'center', originY: 'center', left: 0, top: 0 })

/** A text box with a shape's text in it, for measuring and for the fonts it needs. */
export function labelBox(object: FabricObject): Textbox | undefined {
  return layout(object)?.box
}

/** The shape's text laid out for its current size and fit, or nothing when it has none. */
function layout(object: FabricObject) {
  const shape = textShapeOf(object)
  const label = labelOf(object)
  if (!shape || !label || label.text === '') return undefined
  const { width, height } = sizeOf(object)
  const fit = textFitOf(object)
  const key = `${width}/${height}/${fit}/${object.flipX}`
  let entry = drawn.get(object)
  if (entry?.label !== label) {
    entry = { label, box: newBox(label), key: '', scale: 1, inner: innerBox(shape, width, height) }
    drawn.set(object, entry)
  }
  if (entry.key !== key && OUTSIDE_TEXT.has(shape)) {
    // As wide as its longest line, so left-aligned text starts right past the bracket.
    measure(entry.box, measure(entry.box, Infinity).width + 1)
    Object.assign(entry, { key, scale: 1, inner: outsideBox(object, entry.box.width, entry.box.height) })
  }
  if (entry.key !== key) {
    const inner = innerBox(shape, width, height)
    const box = entry.box
    const { scale } = fitText(shape, fit, (w) => measure(box, w), { width, height }, smallestScale(box), undefined, growLimitOf(object))
    measure(box, wrapWidth(shape, width, scale))
    Object.assign(entry, { key, scale, inner })
  }
  return entry
}

function measure(box: Textbox, width: number): { width: number; height: number } {
  box.set({ width: Number.isFinite(width) ? width : 1e5 })
  box.initDimensions()
  // Laid out without wrapping, the box is as wide as asked; its longest line is what counts.
  return { width: Number.isFinite(width) ? box.width : box.calcTextWidth(), height: box.height }
}

/** Room around a shape's drawn text that still counts as clicking it, in page pixels. */
const TEXT_HIT_MARGIN = 3

/**
 * The corners of a shape's drawn text on the page (top left, top right,
 * bottom right, bottom left), with a little room around it; nothing when the
 * shape holds no text.
 */
export function labelCorners(object: FabricObject): Point[] | undefined {
  const entry = layout(object)
  if (!entry) return undefined
  const half = { x: (entry.box.calcTextWidth() * entry.scale) / 2 + TEXT_HIT_MARGIN, y: (entry.box.height * entry.scale) / 2 + TEXT_HIT_MARGIN }
  return cornersAround(object, entry.inner, half)
}

/** The corners on the page of a box around `middle` (page pixels from the shape's middle, as `drawLabel` places text), `half` its half size. */
function cornersAround(object: FabricObject, middle: { x: number; y: number }, half: { x: number; y: number }): Point[] {
  // Drawn like `drawLabel`: page pixels from the shape's middle, without its stretch or mirroring.
  const toShape = new Point((object.flipX ? -1 : 1) / object.scaleX, (object.flipY ? -1 : 1) / object.scaleY)
  const matrix = object.calcTransformMatrix()
  const signs: [number, number][] = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ]
  return signs.map(([sx, sy]) => util.transformPoint(new Point(middle.x + sx * half.x, middle.y + sy * half.y).multiply(toShape), matrix))
}

/** Room between a double bracket's brackets and its empty text area, in page pixels. */
const DOUBLE_TEXT_GAP = 10

/** How wide the empty text area beside a bracket is, in letters of its text size. */
const EMPTY_AREA_EMS = 4.5

/**
 * The area of a bracket where its text goes, as page corners (see
 * `labelCorners`): around its text, or, while it holds none, a box as tall as
 * a line of its text and about four letters wide (beside a single bracket;
 * between a double bracket's brackets, as wide as fits with room to spare). Nothing for other
 * shapes. `empty` says it holds no text yet.
 */
export function bracketTextArea(object: FabricObject): { corners: Point[]; empty: boolean; fontSize: number } | undefined {
  if (!isOutside(object) && !isDouble(object)) return undefined
  const label = labelOf(object)
  const fontSize = typeof label?.fontSize === 'number' ? label.fontSize : 16
  const corners = labelCorners(object)
  if (corners) return { corners, empty: false, fontSize }
  const lineHeight = fontSize * (typeof label?.lineHeight === 'number' ? label.lineHeight : 1.16)
  const { width, height } = sizeOf(object)
  const box = isOutside(object)
    ? outsideBox(object, fontSize * EMPTY_AREA_EMS, lineHeight)
    : { x: 0, y: 0, width: Math.max(1, Math.min(fontSize * EMPTY_AREA_EMS, width - 2 * doubleBracketArm(width, height) - 2 * (DOUBLE_TEXT_GAP + TEXT_HIT_MARGIN))), height: Math.min(lineHeight, height) }
  return { corners: cornersAround(object, box, { x: box.width / 2 + TEXT_HIT_MARGIN, y: box.height / 2 + TEXT_HIT_MARGIN }), empty: true, fontSize }
}

/** Whether a point on the page lies in a bracket's text area (see `bracketTextArea`). */
export function hitsBracketTextArea(object: FabricObject, point: Point): boolean {
  const area = bracketTextArea(object)
  return area !== undefined && inside(area.corners, point)
}

/**
 * Whether a point on the page lands on one of a double bracket's brackets
 * (within `margin` page pixels), not the room between them, so whatever sits
 * between them can still be clicked. False for other shapes.
 */
export function hitsDoubleBracketArms(object: FabricObject, point: Point, margin: number): boolean {
  if (!isDouble(object)) return false
  const { width, height } = sizeOf(object)
  const local = util.transformPoint(point, util.invertTransform(object.calcTransformMatrix()))
  const x = Math.abs(local.x * object.scaleX)
  const y = Math.abs(local.y * object.scaleY)
  return y <= height / 2 + margin && x <= width / 2 + margin && x >= width / 2 - doubleBracketArm(width, height) - margin
}

/** Whether a point on the page lands on a shape's drawn text. */
export function hitsLabel(object: FabricObject, point: Point): boolean {
  const corners = labelCorners(object)
  return corners !== undefined && inside(corners, point)
}

/** Whether a point lies in a (turned) rectangle given by its four corners in order. */
function inside(corners: Point[], point: Point): boolean {
  // Inside the (turned) rectangle: on the inner side of each of its four edges.
  // Each corner paired with the one after it, the last with the first.
  const nexts = [...corners.slice(1), ...corners.slice(0, 1)]
  const sides = nexts.map((next, i) => {
    const corner = corners[i] ?? next
    return Math.sign((next.x - corner.x) * (point.y - corner.y) - (next.y - corner.y) * (point.x - corner.x))
  })
  return sides.every((side) => side >= 0) || sides.every((side) => side <= 0)
}

/** "Shrink text" goes down to 2 pt, as a share of the text's own size. */
const smallestScale = (box: Textbox) => Math.min(1, MIN_SHAPE_FONT_SIZE / box.fontSize)

/** Draw a shape's text, called at the end of the shape's own drawing (see `addTextToShapes`). */
function drawLabel(object: WithText, ctx: CanvasRenderingContext2D): void {
  if (object.editingLabel) return
  const entry = layout(object)
  if (!entry) return
  ctx.save()
  // Undo the shape's stretch and mirroring: text keeps its own proportions and reads the right way round.
  ctx.scale((object.flipX ? -1 : 1) / object.scaleX, (object.flipY ? -1 : 1) / object.scaleY)
  ctx.translate(entry.inner.x, entry.inner.y)
  ctx.scale(entry.scale, entry.scale)
  entry.box._render(ctx)
  ctx.restore()
}

/** The shape's text as SVG, in the shape's own coordinates (see `addTextToShapes`). */
function labelSvg(object: WithText): string | undefined {
  const entry = layout(object)
  if (!entry) return undefined
  const fx = (object.flipX ? -1 : 1) / object.scaleX
  const fy = (object.flipY ? -1 : 1) / object.scaleY
  return `<g transform="scale(${fx} ${fy}) translate(${entry.inner.x} ${entry.inner.y}) scale(${entry.scale})">\n${entry.box.toSVG()}</g>\n`
}

/** Fabric's own drawing and export, kept on each class so loading this file again replaces our additions instead of stacking them. */
const FABRIC_OWN = Symbol.for('biofigure-lab:shape-text:fabric-own')
type Patched = { [FABRIC_OWN]?: { render: Rect['_render']; toSVG: Rect['_toSVG']; shouldCache: Rect['shouldCache'] } }

/**
 * Teach Fabric's rectangles, ellipses and paths to draw and export their text.
 * While developing, a code change loads this file again: it then wraps
 * Fabric's own functions afresh, so a shape never draws its text twice.
 */
function addTextToShapes(): void {
  for (const Kind of [Rect, Ellipse, Path]) {
    const proto = Kind.prototype as typeof Kind.prototype & Patched
    // eslint-disable-next-line @typescript-eslint/unbound-method -- called below with the shape as `this`
    const own = (proto[FABRIC_OWN] ??= { render: proto._render, toSVG: proto._toSVG, shouldCache: proto.shouldCache })
    const render = own.render
    Kind.prototype._render = function (this: WithText, ctx: CanvasRenderingContext2D) {
      render.call(this, ctx)
      drawLabel(this, ctx)
    }
    const toSVG = own.toSVG
    Kind.prototype._toSVG = function (this: WithText) {
      const markup = toSVG.call(this)
      const text = labelSvg(this)
      return text ? [...markup, text] : markup
    }
    const shouldCache = own.shouldCache
    // Fabric draws a shape into a picture of its own box first; text beside a bracket lies outside that box, so a bracket with text is drawn straight onto the page.
    Kind.prototype.shouldCache = function (this: WithText) {
      if (!isOutside(this) || !this.label?.text) return shouldCache.call(this)
      this.ownCaching = false
      return false
    }
  }
}
addTextToShapes()

/** Which point of a shape stays put when it changes size, as Fabric names a point (e.g. `center`, `top`). */
type Anchor = { x: TOriginX; y: TOriginY }
const TOP_MIDDLE: Anchor = { x: 'center', y: 'top' }

/**
 * Make a shape as big as its text needs (see `fitText`), never smaller than
 * it is, keeping the middle of its top edge in place. Returns whether it changed.
 */
export function growToFit(object: FabricObject, keep?: 'height'): boolean {
  const label = labelOf(object)
  return label !== undefined && label.text !== '' && fitShape(object, newBox(label), sizeOf(object), keep) !== undefined
}

/**
 * While a handle is being dragged: the shape fits itself around its text on
 * every step, instead of only when the handle is let go. Dragging the top or
 * bottom handle sets the height, so wrapped text makes the shape wider rather
 * than taller. Returns whether the shape changed.
 */
export function fitWhileResizing(object: FabricObject, transform: Transform): boolean {
  const label = labelOf(object)
  if (!label || label.text === '' || !textShapeOf(object) || isOutside(object)) return false
  const { corner, original, originX, originY } = transform
  const vertical = corner === 'mt' || corner === 'mb'
  const sideways = corner === 'ml' || corner === 'mr'
  // What the drag asks for: a side handle leaves the other direction as it was when the drag started.
  const now = sizeOf(object)
  const asked = { width: vertical ? object.width * original.scaleX : now.width, height: sideways ? object.height * original.scaleY : now.height }
  const anchor: Anchor = { x: vertical ? 'center' : originX, y: sideways ? 'top' : originY }
  // Grown text that already wraps takes the dragged width as its new line width.
  if (!vertical && growLimitOf(object) !== undefined) (object as WithText).growLimit = asked.width
  return fitShape(object, newBox(label), asked, vertical ? 'height' : undefined, anchor) !== undefined
}

/** Size a shape for the text in `box` (see `fitText`); gives back the scale the text is drawn at, or nothing when the shape kept its size. */
function fitShape(object: FabricObject, box: Textbox, atLeast: { width: number; height: number }, keep?: 'height', anchor = TOP_MIDDLE): number | undefined {
  const fitted = fitTo(object, box, atLeast, keep)
  if (!fitted) return undefined
  return setSize(object, fitted.width, fitted.height, anchor) ? fitted.scale : undefined
}

function fitTo(object: FabricObject, box: Textbox, size: { width: number; height: number }, keep?: 'height'): Fitted | undefined {
  const shape = textShapeOf(object)
  // Text beside a bracket doesn't change its size.
  if (!shape || OUTSIDE_TEXT.has(shape)) return undefined
  return fitText(shape, textFitOf(object), (width) => measure(box, width), size, smallestScale(box), keep, growLimitOf(object))
}

/** Give a shape a new size on the page, keeping its anchor point where it is. */
function setSize(object: FabricObject, width: number, height: number, anchor: Anchor): boolean {
  // A circle stays round: it grows to the bigger of the two.
  if ((object as WithText).shapeKind === 'circle') width = height = Math.max(width, height)
  const now = sizeOf(object)
  if (object.width <= 0 || object.height <= 0 || (Math.abs(width - now.width) < 0.01 && Math.abs(height - now.height) < 0.01)) return false
  const point = object.getPointByOrigin(anchor.x, anchor.y)
  object.set({ scaleX: width / object.width, scaleY: height / object.height })
  object.setPositionByOrigin(point, anchor.x, anchor.y)
  object.setCoords()
  object.set('dirty', true)
  return true
}

/**
 * Switch a shape to another fit without changing what is seen: text drawn
 * smaller by "Shrink text" keeps that size as its own, and text that wraps
 * keeps its line width under "Grow shape" (the shape then grows taller).
 * Only typing and resizing afterwards follow the new fit. `box` is the text
 * being typed in the shape, if any; otherwise the shape's saved text changes.
 */
export function changeTextFit(object: FabricObject, fit: TextFit, box?: Textbox): void {
  const shape = object as WithText
  const label = labelOf(object)
  const text = box ?? (label && label.text !== '' ? newBox(label) : undefined)
  if (text) {
    const scale = fitTo(object, text, sizeOf(object))?.scale ?? 1
    if (scale < 1) scaleTextSize(text, scale)
    if (!box) shape.label = { text: text.text, ...labelLook(text) }
  }
  const width = sizeOf(object).width
  shape.textFit = fit
  shape.growLimit = fit === 'grow' && text && widthForText(textShapeOf(object) ?? 'rectangle', measure(text, Infinity).width) > width + 0.5 ? width : undefined
  object.set('dirty', true)
}

/** The text a shape holds while it isn't being typed in, as a text box to read its look from; none when it holds no text. */
export function labelText(object: FabricObject): IText | undefined {
  const label = labelOf(object)
  // A Textbox is an IText; Fabric's typings only disagree about `this` in its event handlers.
  return textShapeOf(object) && label && label.text !== '' ? (newBox(label) as unknown as IText) : undefined
}

/** A label as a text box, to read or change its look; works for a label without text too. */
export const textOfLabel = (label: ShapeLabel): IText => newBox(label) as unknown as IText

/** The look of some text as a shape's label without text. */
export const labelFromText = (text: IText): ShapeLabel => ({ text: '', ...labelLook(text) })

/** How much smaller than its own size a shape's text is drawn ("Shrink text"); 1 when it isn't. */
export const labelScale = (object: FabricObject): number => drawn.get(object)?.scale ?? 1

/**
 * Restyle the text a shape holds without typing in it: `change` gets the
 * text as a text box, and the result goes back into the shape, which then
 * fits itself around it again. A shape holding no text keeps the look for
 * when text is typed; it starts from `look` when it had none yet. Says
 * whether the shape takes text.
 */
export function restyleLabel(object: FabricObject, change: (text: IText) => void, look?: ShapeLabel): boolean {
  const label = labelOf(object) ?? (look && lookFor(object, look))
  const text = textShapeOf(object) && label ? textOfLabel(label) : undefined
  if (!text) return false
  change(text)
  ;(object as WithText).label = { text: text.text, ...labelLook(text) }
  growToFit(object)
  object.set('dirty', true)
  return true
}

/** Make text and each of its letters `scale` times their size. */
function scaleTextSize(text: Textbox, scale: number): void {
  text.set({ fontSize: text.fontSize * scale })
  for (const line of Object.values(text.styles)) {
    for (const char of Object.values(line)) {
      if (char.fontSize !== undefined) char.fontSize *= scale
      if (char.deltaY !== undefined) char.deltaY *= scale
    }
  }
  text.set('dirty', true)
}

/** The look a shape's text starts with: the look of new text, centred. */
export function startingLabel(look: IText): ShapeLabel {
  return { text: '', ...labelLook(look), textAlign: 'center' }
}

function labelLook(text: Pick<IText, 'styles' | 'get'>): Omit<ShapeLabel, 'text'> {
  return { styles: structuredClone(text.styles), ...(Object.fromEntries(LABEL_PROPS.map((prop) => [prop, text.get(prop)])) as Record<(typeof LABEL_PROPS)[number], unknown>) }
}

/** Marks the text box laid over a shape while typing in it, so the layers panel leaves it out. */
export const isShapeTextBox = (object: FabricObject): boolean => (object as FabricObject & { shapeTextBox?: boolean }).shapeTextBox === true

/**
 * Typing in a shape: a text box laid over the shape's inner box, turned with
 * it. The shape grows or the text shrinks as you type. Escape or clicking
 * elsewhere stops typing and puts the text into the shape.
 */
export class ShapeTextEditor {
  private editing: { shape: FabricObject; box: Textbox; startSize: { width: number; height: number } } | undefined
  private readonly canvas: Canvas
  /** The shape changed size while typing (arrows stuck to it follow). */
  private readonly onResize: () => void
  /** Typing stopped and the text went into the shape: make an undo step. */
  private readonly onFinish: () => void
  /** "Shrink text" drew the text at another size: the panels show the size it is drawn at. */
  private readonly onScale: () => void

  constructor(canvas: Canvas, onResize: () => void, onFinish: () => void, onScale: () => void = () => {}) {
    this.canvas = canvas
    this.onResize = onResize
    this.onFinish = onFinish
    this.onScale = onScale
  }

  get shape(): FabricObject | undefined {
    return this.editing?.shape
  }

  /** Start typing in a shape; `e` is the double-click, which puts the cursor where it was. */
  start(shape: FabricObject, look: ShapeLabel, e?: TPointerEvent): Textbox {
    this.finish()
    const label = labelOf(shape) ?? lookFor(shape, look)
    const box = newBox(label)
    box.set({ originX: 'center', originY: 'center', hasControls: false, lockMovementX: true, lockMovementY: true, lockScalingX: true, lockScalingY: true, lockRotation: true, borderDashArray: [3, 3], excludeFromExport: true })
    Object.assign(box, { shapeTextBox: true })
    this.editing = { shape, box, startSize: sizeOf(shape) }
    ;(shape as WithText).editingLabel = true
    shape.set('dirty', true)
    this.canvas.insertAt(this.canvas.getObjects().indexOf(shape) + 1, box)
    this.refit()
    box.on('changed', () => this.refit())
    box.on('editing:exited', () => this.finish())
    this.canvas.setActiveObject(box)
    box.enterEditing(e)
    if (e) {
      const at = label.text === '' ? 0 : box.getSelectionStartFromPointer(e)
      box.selectionStart = at
      box.selectionEnd = at
      box._updateTextarea()
    }
    this.canvas.requestRenderAll()
    return box
  }

  /** Fit the text box and the shape to each other again, after typing or a change of look. */
  refit(): void {
    const editing = this.editing
    const kind = editing && textShapeOf(editing.shape)
    if (!editing || !kind) return
    const { shape, box } = editing
    if (OUTSIDE_TEXT.has(kind)) return this.refitOutside(shape, box)
    // While typing, the shape goes back to the size it started at when text is deleted, but no smaller.
    if (fitShape(shape, box, editing.startSize) !== undefined) this.onResize()
    const size = sizeOf(shape)
    const inner = innerBox(kind, size.width, size.height)
    const scale = fitTo(shape, box, size)?.scale ?? 1
    measure(box, wrapWidth(kind, size.width, scale))
    // The box's middle, turned with the shape.
    const flip = new Point(shape.flipX ? -1 : 1, shape.flipY ? -1 : 1)
    const middle = shape.getCenterPoint().add(new Point(inner.x, inner.y).multiply(flip).rotate(util.degreesToRadians(shape.getTotalAngle())))
    const rescaled = Math.abs(box.scaleX - scale) > 1e-6
    box.set({ left: middle.x, top: middle.y, angle: shape.getTotalAngle(), scaleX: scale, scaleY: scale })
    box.setCoords()
    this.canvas.requestRenderAll()
    if (rescaled) this.onScale()
  }

  /** Keep the text box being typed in beside its bracket, as wide as its text. */
  private refitOutside(shape: FabricObject, box: Textbox): void {
    // At least as wide as the empty text area the bracket showed, so a second click there (a double-click) lands in the box and keeps typing.
    measure(box, Math.max(measure(box, Infinity).width + 1, box.fontSize * EMPTY_AREA_EMS))
    const inner = outsideBox(shape, box.width, box.height)
    const middle = shape.getCenterPoint().add(new Point(inner.x, inner.y).rotate(util.degreesToRadians(shape.getTotalAngle())))
    box.set({ left: middle.x, top: middle.y, angle: shape.getTotalAngle(), scaleX: 1, scaleY: 1 })
    box.setCoords()
    this.canvas.requestRenderAll()
  }

  /** Switch the shape being typed in to another fit, keeping what is seen (see `changeTextFit`). */
  setFit(fit: TextFit): void {
    const editing = this.editing
    if (!editing) return
    changeTextFit(editing.shape, fit, editing.box)
    this.resized()
  }

  /**
   * Before a size is set while typing: text drawn smaller by "Shrink text"
   * takes that size as its own, so the size set is the size seen.
   */
  keepDrawnSize(): void {
    const box = this.editing?.box
    if (!box || box.scaleX >= 1) return
    scaleTextSize(box, box.scaleX)
    box.set({ scaleX: 1, scaleY: 1 })
  }

  /** The shape being typed in was moved or resized from the panel: that is its size from now on. */
  resized(): void {
    if (!this.editing) return
    this.editing.startSize = sizeOf(this.editing.shape)
    this.refit()
  }

  /** The size the text being typed is drawn at, as a share of its own size. */
  get drawnScale(): number {
    return this.editing?.box.scaleX ?? 1
  }

  /** Stop typing: the text goes into the shape, and the shape is selected again when nothing else was picked. */
  finish(): void {
    const editing = this.editing
    if (!editing) return
    this.editing = undefined
    const { shape, box } = editing
    if (box.isEditing) box.exitEditing()
    const text = box.text
    // Without text the shape still keeps the look, for when text is typed again.
    ;(shape as WithText).label = { text, ...labelLook(box) }
    ;(shape as WithText).editingLabel = false
    shape.set('dirty', true)
    growToFit(shape)
    shape.setCoords()
    this.onFinish()
    // Fabric is still busy with the text box (it ends typing while handling a click), so it goes once Fabric is done.
    setTimeout(() => {
      const reselect = this.canvas.getActiveObject() === box
      this.canvas.remove(box)
      if (reselect && this.canvas.getObjects().includes(shape)) this.canvas.setActiveObject(shape)
      this.canvas.requestRenderAll()
      this.onFinish()
    })
  }
}
