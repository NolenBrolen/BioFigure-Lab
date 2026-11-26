/*
 * Empty icon spaces (BIO-74, from the Blocks plan of 2026-11-24): a dashed
 * square on the page with a faded cell in it, where a block's icon goes. An
 * icon dragged from the Icons panel onto it, or clicked in the Icons panel
 * while the space is selected, takes its place: centred in it, as big as
 * fits, in the same panel and at the same place in the stack.
 *
 * Like a panel, a space is laid out again (not stretched) while it is
 * resized, so its dashes and cell keep their size. It is a placeholder for
 * working on the figure: exports leave it out (FigureCanvas.toSVG).
 */
import { Circle, Group, Path, Point, Rect, classRegistry, type FabricObject } from 'fabric'

import { wash } from './panel-block'

export class IconSpace extends Group {
  static type = 'IconSpace'
  declare spaceWidth?: number
  declare spaceHeight?: number
  /** The colour it is drawn in: its panel's, or grey on the page. */
  declare spaceColour?: string
  /** Drawn as a circle (in a round zoom inset, BIO-97) instead of a rounded square. */
  declare spaceRound?: boolean
}
classRegistry.setClass(IconSpace)

/** What a space saves of its own (its panel is `panelId`, saved with every panel's contents). */
export const SPACE_PROPERTIES = ['spaceWidth', 'spaceHeight', 'spaceColour', 'spaceRound'] as const

export const NEW_SPACE_SIZE = 64
const GREY = '#71717a'
const DASH = [3, 3]
const RADIUS = 8
/** The smallest a space gets: room for its cell. */
const SMALLEST = 28

export const isIconSpace = (object: FabricObject | undefined): object is IconSpace => object instanceof IconSpace

export function spaceSize(space: IconSpace): { width: number; height: number } {
  return { width: space.spaceWidth ?? NEW_SPACE_SIZE, height: space.spaceHeight ?? NEW_SPACE_SIZE }
}

/**
 * The faint dashed box and, in its middle, a faded flat cell (a lymphocyte:
 * a round cell with a big nucleus) with a small plus badge on its
 * bottom-right, cut out from the cell by a ring of the box's colour.
 */
function spaceParts(size: { width: number; height: number }, colour: string, circle = false): FabricObject[] {
  const { width, height } = size
  const back = wash(colour, 0.05)
  const corner = circle ? Math.min(width, height) / 2 : RADIUS
  const box = new Rect({ left: 0, top: 0, width, height, rx: corner, ry: corner, fill: back, stroke: wash(colour, 0.32), strokeWidth: 1, strokeDashArray: DASH, originX: 'left', originY: 'top' })
  const r = Math.min(15, Math.max(8, Math.min(width, height) * 0.2))
  const middle = { x: width / 2, y: height / 2 }
  const round = (x: number, y: number, radius: number, fill: string, stroke?: string) =>
    new Circle({ left: x, top: y, radius, fill, stroke, strokeWidth: stroke ? 1 : 0, originX: 'center', originY: 'center' })
  const cell = round(middle.x, middle.y, r, wash(colour, 0.12), wash(colour, 0.3))
  const nucleus = round(middle.x - r * 0.12, middle.y - r * 0.1, r * 0.58, wash(colour, 0.24))
  const badge = { x: middle.x + r * 0.68, y: middle.y + r * 0.68, radius: Math.max(4, r * 0.36) }
  const cutout = round(badge.x, badge.y, badge.radius + 1.5, back)
  const dot = round(badge.x, badge.y, badge.radius, wash(colour, 0.42))
  const arm = badge.radius * 0.5
  const plus = new Path(`M ${badge.x - arm} ${badge.y} H ${badge.x + arm} M ${badge.x} ${badge.y - arm} V ${badge.y + arm}`, { stroke: '#ffffff', strokeWidth: 1.25, strokeLineCap: 'round', fill: '' })
  return [box, cell, nucleus, cutout, dot, plus]
}

/** The space's box on the page (spaces are never turned). */
export function spaceBox(space: IconSpace): { x: number; y: number; width: number; height: number } {
  const size = spaceSize(space)
  const box = space.getObjects()[0]
  if (!box) return { x: space.left, y: space.top, width: size.width, height: size.height }
  const centre = space.getCenterPoint()
  return { x: centre.x - (size.width * space.scaleX) / 2, y: centre.y - (size.height * space.scaleY) / 2, width: size.width * space.scaleX, height: size.height * space.scaleY }
}

/** Put the parts in again for the space's size and colour, its box's middle staying at `middle`. */
function refill(space: IconSpace, middle: Point): void {
  space.removeAll()
  space.set({ scaleX: 1, scaleY: 1, angle: 0 })
  space.add(...spaceParts(spaceSize(space), space.spaceColour ?? GREY, space.spaceRound))
  space.setPositionByOrigin(middle, 'center', 'center')
  space.setCoords()
}

/** A new empty space with its box's top-left corner at `corner`. */
export function buildIconSpace(corner: { x: number; y: number }, size = { width: NEW_SPACE_SIZE, height: NEW_SPACE_SIZE }, colour?: string): IconSpace {
  const space = new IconSpace(spaceParts(size, colour ?? GREY), { lockRotation: true })
  Object.assign(space, { spaceWidth: size.width, spaceHeight: size.height, spaceColour: colour, name: 'Empty icon space' })
  space.setControlVisible('mtr', false)
  space.setPositionByOrigin(new Point(corner.x + size.width / 2, corner.y + size.height / 2), 'center', 'center')
  space.setCoords()
  return space
}

/** Draw the space as a circle or a rounded square, in place (BIO-97). */
export function roundIconSpace(space: IconSpace, round: boolean): void {
  if ((space.spaceRound ?? false) === round) return
  space.spaceRound = round || undefined
  refill(space, space.getCenterPoint())
}

/** Draw the space in another colour (its panel's), in place. */
export function tintIconSpace(space: IconSpace, colour: string | undefined): void {
  if (space.spaceColour === colour) return
  space.spaceColour = colour
  refill(space, space.getCenterPoint())
}

/** While a space is resized (and when let go): the stretch goes into its size, the side opposite the handle staying put. */
export function bakeSpaceScale(space: IconSpace, originX: 'left' | 'center' | 'right' = 'center', originY: 'top' | 'center' | 'bottom' = 'center'): void {
  const { scaleX: sx, scaleY: sy } = space
  if (sx === 1 && sy === 1) return
  const size = spaceSize(space)
  const pinned = space.getPointByOrigin(originX, originY)
  // The outline doesn't grow: only the box takes the stretch.
  space.spaceWidth = Math.max(SMALLEST, space.width * Math.abs(sx) - (space.width - size.width))
  space.spaceHeight = Math.max(SMALLEST, space.height * Math.abs(sy) - (space.height - size.height))
  refill(space, space.getCenterPoint())
  space.setPositionByOrigin(pinned, originX, originY)
  space.setCoords()
}

/**
 * A space inside a selection of several that is being resized: it takes
 * `size` (its size within the selection, already stretched) and undoes the
 * selection's stretch on itself, so its dashes and cell never stretch, while
 * dragging or after. Its middle stays where the selection puts it.
 */
export function sizeSpaceInSelection(space: IconSpace, size: { width: number; height: number }, stretch: { x: number; y: number }): void {
  const middle = space.getRelativeCenterPoint()
  // Rebuilt as if on its own: parts added inside the stretched selection would take on its stretch.
  const parent = space.group
  space.group = undefined
  space.spaceWidth = Math.max(SMALLEST, size.width)
  space.spaceHeight = Math.max(SMALLEST, size.height)
  // Unscaled while its parts go in, or they would take on its scale from the step before.
  space.set({ angle: 0, scaleX: 1, scaleY: 1 })
  space.removeAll()
  space.add(...spaceParts(spaceSize(space), space.spaceColour ?? GREY, space.spaceRound))
  space.set({ scaleX: 1 / stretch.x, scaleY: 1 / stretch.y })
  space.group = parent
  space.setPositionByOrigin(middle, 'center', 'center')
  space.setCoords()
}

/** Give a space a typed size, keeping its top-left corner where it is. */
export function resizeIconSpace(space: IconSpace, size: { width?: number; height?: number }): void {
  const box = spaceBox(space)
  space.spaceWidth = Math.max(SMALLEST, size.width ?? box.width)
  space.spaceHeight = Math.max(SMALLEST, size.height ?? box.height)
  refill(space, new Point(box.x + space.spaceWidth / 2, box.y + space.spaceHeight / 2))
}

/** The topmost empty space under a point on the page. */
export function iconSpaceAt(point: { x: number; y: number }, objects: readonly FabricObject[]): IconSpace | undefined {
  return objects.toReversed().find((object): object is IconSpace => {
    if (!isIconSpace(object) || !object.visible) return false
    const box = spaceBox(object)
    return point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height
  })
}
