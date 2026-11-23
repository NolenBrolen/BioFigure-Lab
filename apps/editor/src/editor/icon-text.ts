/**
 * Text slots on library icons (BIO-56). An icon's JSON can name a rectangle on
 * its 128x128 grid (`textSlot`, a bottle's label). A placed icon keeps the text
 * typed for it as saved settings of its own (`slotText`, `slotShown`) and draws
 * it itself, centred in that rectangle, kept apart from the icon's own shapes:
 * recolouring and greyscale never touch it, and it moves, scales, copies, saves
 * and undoes with the icon.
 *
 * The rectangle is read from the library entry whenever the text is drawn, so
 * swapping the icon for another one, or editing the library, keeps it right.
 *
 * Where the slot sits. Fabric builds the icon's group from its SVG shapes and
 * puts the group's own origin (its middle) at the middle of those shapes'
 * bounds, measured in the SVG's grid (the icons have no width or height, so
 * grid units are viewBox units). So a point of the grid (gx, gy) lies at
 * (gx - originX, gy - originY) in the group's own coordinates, where the
 * origin is the group's centre at the moment it was made. That centre is saved
 * with the icon (`iconOrigin`), since moving and scaling the group would
 * otherwise lose it. The group's own scale then turns grid units into page
 * pixels, as for the icon's shapes.
 */
import { Group, Point, Textbox, loadSVGFromString, util, type Canvas, type FabricObject, type TPointerEvent } from 'fabric'

import { DEFAULT_FONT, fontStack } from './fonts'
import { iconById, type TextSlot } from './icon-library'

/** The colour of slot text: fixed, so recolouring and greyscale leave it alone. */
export const SLOT_TEXT_COLOUR = '#20242a'
/** The text starts at this share of the slot's height and shrinks until it fits. */
const START_SHARE = 0.6
/** The smallest the text gets, in grid units (still legible at the usual icon size); past that it is clipped at the slot. */
export const MIN_FONT_UNITS = 3.5

type WithSlot = FabricObject & {
  iconId?: unknown
  slotText?: unknown
  slotShown?: unknown
  iconOrigin?: unknown
  /** True while the text is being typed in place: the icon then leaves drawing it to the text box laid over it. */
  editingSlotText?: boolean
}

type Point2 = { x: number; y: number }

/** The slot of the library icon an object is, if it is a placed icon whose library entry has one. */
export function slotOf(object: FabricObject): TextSlot | undefined {
  const id = (object as WithSlot).iconId
  return object instanceof Group && typeof id === 'string' ? iconById(id)?.textSlot : undefined
}

/** The text a freshly placed icon with a slot starts with, unless its library entry names another. */
export const DEFAULT_SLOT_TEXT = 'Label'

/** Give a new icon its slot's starting text, shown; nothing for an icon without a slot. */
export function startSlotText(object: FabricObject, iconId: string | undefined): void {
  const slot = iconId ? iconById(iconId)?.textSlot : undefined
  if (slot) Object.assign(object, { slotText: slot.defaultText ?? DEFAULT_SLOT_TEXT, slotShown: true })
}

/** The text and the shown flag an icon with a slot holds; nothing for other objects. */
export function slotInfo(object: FabricObject): { text: string; shown: boolean } | undefined {
  if (!slotOf(object)) return undefined
  const { slotText, slotShown } = object as WithSlot
  return { text: typeof slotText === 'string' ? slotText : '', shown: slotShown !== false }
}

const isPoint = (value: unknown): value is Point2 =>
  typeof value === 'object' && value !== null && Number.isFinite((value as Point2).x) && Number.isFinite((value as Point2).y)

/**
 * Save where the group's own origin sits on the SVG's grid. Call it right after
 * the group is made from the icon's SVG, before it is moved or scaled. Only
 * icons with a slot keep it.
 */
export function noteIconOrigin(group: FabricObject, iconId: string | undefined): void {
  const target = group as WithSlot
  const slot = iconId ? iconById(iconId)?.textSlot : undefined
  if (!slot) {
    delete target.iconOrigin
    return
  }
  const { x, y } = group.getCenterPoint()
  target.iconOrigin = { x, y }
}

/** Whether an icon with a slot still lacks its saved origin (a figure saved before the icon had a slot). */
export const needsIconOrigin = (object: FabricObject): boolean => slotOf(object) !== undefined && !isPoint((object as WithSlot).iconOrigin)

/** Read the origin from the icon's SVG text, for an icon that was placed before it had a slot. */
export async function iconOriginFromSvg(svg: string): Promise<Point2> {
  const { objects, options } = await loadSVGFromString(svg)
  const group = util.groupSVGElements(objects.filter((object): object is FabricObject => object !== null), options)
  const { x, y } = group.getCenterPoint()
  return { x, y }
}

export function setIconOrigin(object: FabricObject, origin: Point2): void {
  ;(object as WithSlot).iconOrigin = origin
}

/**
 * The slot in the group's own coordinates (unscaled grid units): its middle
 * and its size. Nothing when the icon has no slot or no saved origin.
 */
export function slotInGroup(object: FabricObject): { x: number; y: number; width: number; height: number } | undefined {
  const slot = slotOf(object)
  const origin = (object as WithSlot).iconOrigin
  if (!slot || !isPoint(origin)) return undefined
  return { x: slot.x + slot.width / 2 - origin.x, y: slot.y + slot.height / 2 - origin.y, width: slot.width, height: slot.height }
}

/** Whether this icon has text to draw: a slot, text, and the text shown. */
export function hasSlotText(object: FabricObject): boolean {
  const info = slotInfo(object)
  return info !== undefined && info.text.trim() !== '' && info.shown && slotInGroup(object) !== undefined
}

type Drawn = {
  key: string
  box: Textbox
  /** The slot's size on the page, in pixels. */
  width: number
  height: number
  /** The slot's middle in the group's own coordinates. */
  x: number
  y: number
  /** Whether the text still overflows the slot at the smallest size. */
  overflows: boolean
}

/** The text box each icon draws its slot text with, made again when the text or the size changes. */
const drawn = new WeakMap<FabricObject, Drawn>()

/** Forget the measured text, e.g. after fonts have loaded. */
export function refreshSlotText(object: FabricObject): void {
  drawn.delete(object)
  object.set('dirty', true)
}

const textOptions = { fontFamily: fontStack(DEFAULT_FONT), fontWeight: 400, fill: SLOT_TEXT_COLOUR, textAlign: 'center', lineHeight: 1.16, originX: 'center', originY: 'center', left: 0, top: 0 } as const

/**
 * Give `box` the biggest font size at which its text fits a slot `width` by
 * `height` without breaking a word, from 60% of the slot's height down to
 * `smallest`. Lines break where Enter was pressed and wrap at word boundaries.
 */
export function fitInto(box: Textbox, width: number, height: number, smallest: number): { overflows: boolean } {
  // One word per line: the widest one decides whether any word would break.
  const words = new Textbox(box.text.trim().split(/\s+/).join('\n'), { ...textOptions, width: 1e5, fontSize: height * START_SHARE })
  const start = Math.max(smallest, height * START_SHARE)
  /** Shrink from the start size until the text fits; `wordsMustFit` also demands that no word is wider than the slot. */
  const shrink = (wordsMustFit: boolean) => {
    let size = start
    for (;;) {
      box.set({ fontSize: size, width })
      box.initDimensions()
      words.set({ fontSize: size })
      words.initDimensions()
      if ((box.height <= height && (!wordsMustFit || words.calcTextWidth() <= width)) || size <= smallest) return
      size = Math.max(smallest, size * 0.92)
    }
  }
  box.splitByGrapheme = false
  shrink(true)
  // A single word wider than the slot even at the smallest size: break it across lines by character
  // (Fabric then breaks every word that way, so this is only done when a word would not fit otherwise).
  if (words.calcTextWidth() > width) {
    box.splitByGrapheme = true
    shrink(false)
  }
  return { overflows: box.height > height + 0.01 || (!box.splitByGrapheme && words.calcTextWidth() > width + 0.01) }
}

/** The icon's text laid out for its current scale: the biggest size that fits the slot without breaking a word, from 60% of the slot's height down to 3.5 grid units; a word wider than the slot at that size is broken by character. */
function layout(object: FabricObject): Drawn | undefined {
  if (!hasSlotText(object)) return undefined
  const slot = slotInGroup(object)
  const info = slotInfo(object)
  if (!slot || !info) return undefined
  // Page pixels: text keeps its own proportions whatever the icon's stretch.
  const scaleX = Math.abs(object.scaleX) || 1
  const scaleY = Math.abs(object.scaleY) || 1
  const width = slot.width * scaleX
  const height = slot.height * scaleY
  const key = `${info.text}/${width}/${height}`
  const found = drawn.get(object)
  if (found?.key === key) return found
  const smallest = MIN_FONT_UNITS * Math.min(scaleX, scaleY)
  const box = new Textbox(info.text, { ...textOptions, width, fontSize: height * START_SHARE })
  const { overflows } = fitInto(box, width, height, smallest)
  const entry: Drawn = { key, box, width, height, x: slot.x, y: slot.y, overflows }
  drawn.set(object, entry)
  return entry
}

/** The page-pixel scale that undoes the icon's stretch and mirroring, so the text isn't stretched or flipped. */
const counterScale = (object: FabricObject) => ({ x: (object.flipX ? -1 : 1) / (object.scaleX || 1), y: (object.flipY ? -1 : 1) / (object.scaleY || 1) })

/** The slant of the slot's label in degrees (0 for a straight one); a nonsense value counts as straight. */
export function slotSkew(object: FabricObject): number {
  const skew = slotOf(object)?.skewY
  return typeof skew === 'number' && Number.isFinite(skew) && Math.abs(skew) < 80 ? skew : 0
}

/** Draw an icon's slot text, called at the end of the group's own drawing. */
function drawSlotText(object: FabricObject, ctx: CanvasRenderingContext2D): void {
  if ((object as WithSlot).editingSlotText) return
  const entry = layout(object)
  if (!entry) return
  const back = counterScale(object)
  ctx.save()
  ctx.translate(entry.x, entry.y)
  // A slanted label: the slant is applied in the icon's own grid units, before the stretch is undone.
  const skew = slotSkew(object)
  if (skew) ctx.transform(1, Math.tan((skew * Math.PI) / 180), 0, 1, 0, 0)
  ctx.scale(back.x, back.y)
  ctx.beginPath()
  ctx.rect(-entry.width / 2, -entry.height / 2, entry.width, entry.height)
  ctx.clip()
  entry.box._render(ctx)
  ctx.restore()
}

let clipCount = 0

/** The icon's slot text as SVG, in the icon's own coordinates. */
function slotTextSvg(object: FabricObject): string | undefined {
  const entry = layout(object)
  if (!entry) return undefined
  const back = counterScale(object)
  const clip = entry.overflows ? `clip-path="url(#icon-slot-clip-${++clipCount})" ` : ''
  const clipDef = entry.overflows ? `<clipPath id="icon-slot-clip-${clipCount}"><rect x="${-entry.width / 2}" y="${-entry.height / 2}" width="${entry.width}" height="${entry.height}"/></clipPath>\n` : ''
  const skew = slotSkew(object)
  const slant = skew ? ` skewY(${skew})` : ''
  return `<g transform="translate(${entry.x} ${entry.y})${slant} scale(${back.x} ${back.y})">\n${clipDef}<g ${clip}>\n${entry.box.toSVG()}</g>\n</g>\n`
}

/** Fabric's own drawing and export, kept on the class so loading this file again replaces our additions instead of stacking them. */
const FABRIC_OWN = Symbol.for('biofigure-lab:icon-text:fabric-own')
type Patched = { [FABRIC_OWN]?: { drawObject: Group['drawObject']; toSVG: Group['_toSVG'] } }

/**
 * Teach groups to draw and export an icon's slot text. Every kind of group
 * shares this class, so the added code does nothing unless the group is a
 * placed icon whose library entry has a slot and which holds text to show.
 */
function addTextToIcons(): void {
  const proto = Group.prototype as typeof Group.prototype & Patched
  // eslint-disable-next-line @typescript-eslint/unbound-method -- called below with the group as `this`
  const own = (proto[FABRIC_OWN] ??= { drawObject: proto.drawObject, toSVG: proto._toSVG })
  const drawObject = own.drawObject
  Group.prototype.drawObject = function (this: Group, ctx, forClipping, context) {
    drawObject.call(this, ctx, forClipping, context)
    if (!forClipping) drawSlotText(this, ctx)
  }
  const toSVG = own.toSVG
  Group.prototype._toSVG = function (this: Group, reviver) {
    const markup = toSVG.call(this, reviver)
    const text = slotTextSvg(this)
    if (!text) return markup
    // The group's markup ends with its closing tag; the text goes just before it.
    return [...markup.slice(0, -1), text, ...markup.slice(-1)]
  }
}
addTextToIcons()

/** Whether a point on the page lies inside the icon's text slot. */
export function hitsSlot(object: FabricObject, point: Point): boolean {
  const slot = slotInGroup(object)
  if (!slot) return false
  const local = util.transformPoint(point, util.invertTransform(object.calcTransformMatrix()))
  // A slanted label: undo the slant first, so the hit area is the label's own parallelogram.
  const dy = local.y - slot.y - Math.tan((slotSkew(object) * Math.PI) / 180) * (local.x - slot.x)
  return Math.abs(local.x - slot.x) <= slot.width / 2 && Math.abs(dy) <= slot.height / 2
}

/**
 * Typing the text of an icon's slot in place: a text box laid over the slot,
 * with the font, size and middle the drawn text has, turned with the icon.
 * It is marked like the text box over a shape (`shapeTextBox`), so the layers
 * panel and the text panels leave it out. The icon's text follows as you type;
 * Escape or a click elsewhere stops typing, and the text is saved as one undo step.
 */
export class IconTextEditor {
  private editing: { icon: FabricObject; box: Textbox; width: number; height: number; smallest: number } | undefined
  private readonly canvas: Canvas
  private readonly onChange: () => void
  private readonly onFinish: () => void

  constructor(canvas: Canvas, onChange: () => void, onFinish: () => void) {
    this.canvas = canvas
    this.onChange = onChange
    this.onFinish = onFinish
  }

  /** The icon being typed in. */
  get icon(): FabricObject | undefined {
    return this.editing?.icon
  }

  /** Start typing in an icon's slot; `e` is the double-click; the cursor always goes to the end of the text. Shows the text if it was hidden. */
  start(icon: FabricObject, e?: TPointerEvent): Textbox | undefined {
    this.finish()
    const slot = slotInGroup(icon)
    const info = slotInfo(icon)
    if (!slot || !info) return undefined
    const scaleX = Math.abs(icon.scaleX) || 1
    const scaleY = Math.abs(icon.scaleY) || 1
    const width = slot.width * scaleX
    const height = slot.height * scaleY
    const middle = util.transformPoint(new Point(slot.x, slot.y), icon.calcTransformMatrix())
    const box = new Textbox(info.text, {
      ...textOptions,
      width,
      fontSize: height * START_SHARE,
      left: middle.x,
      top: middle.y,
      angle: icon.getTotalAngle(),
      skewY: slotSkew(icon),
      hasControls: false,
      lockMovementX: true,
      lockMovementY: true,
      lockScalingX: true,
      lockScalingY: true,
      lockRotation: true,
      borderDashArray: [3, 3],
      excludeFromExport: true,
    })
    Object.assign(box, { shapeTextBox: true })
    this.editing = { icon, box, width, height, smallest: MIN_FONT_UNITS * Math.min(scaleX, scaleY) }
    Object.assign(icon, { slotShown: true, editingSlotText: true })
    icon.set('dirty', true)
    this.refit()
    this.canvas.insertAt(this.canvas.getObjects().indexOf(icon) + 1, box)
    box.on('changed', () => {
      Object.assign(icon, { slotText: box.text })
      this.refit()
      this.onChange()
    })
    box.on('editing:exited', () => this.finish())
    this.canvas.setActiveObject(box)
    box.enterEditing(e)
    const at = info.text.length
    box.selectionStart = at
    box.selectionEnd = at
    box._updateTextarea()
    this.canvas.requestRenderAll()
    this.onChange()
    return box
  }

  /** Size the text to the slot again after typing, as the icon itself draws it. */
  private refit(): void {
    const editing = this.editing
    if (!editing) return
    const { box, width, height, smallest } = editing
    fitInto(box, width, height, smallest)
    box.setCoords()
    this.canvas.requestRenderAll()
  }

  /** Stop typing: the text goes into the icon, which draws it again, as one undo step. */
  finish(): void {
    const editing = this.editing
    if (!editing) return
    this.editing = undefined
    const { icon, box } = editing
    if (box.isEditing) box.exitEditing()
    Object.assign(icon, { slotText: box.text, slotShown: true, editingSlotText: false })
    refreshSlotText(icon)
    this.onFinish()
    // Fabric is still busy with the text box (it ends typing while handling a click), so it goes once Fabric is done.
    setTimeout(() => {
      const reselect = this.canvas.getActiveObject() === box
      this.canvas.remove(box)
      if (reselect && this.canvas.getObjects().includes(icon)) this.canvas.setActiveObject(icon)
      this.canvas.requestRenderAll()
      this.onFinish()
    })
  }
}
