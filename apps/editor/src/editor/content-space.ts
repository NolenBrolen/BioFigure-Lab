/*
 * Content spaces (BIO-86): an empty dashed box on the page where a chart goes,
 * like an icon space (icon-space.ts) holds an icon. A figure grid's cells
 * start as chart spaces. Selecting one opens the Graph tool, and the chart
 * picked there fills the space at the space's size.
 *
 * The space knows what it waits for (`holds`), so later blocks can use the
 * same box for an image or an icon. Only charts fill one for now.
 *
 * Like the other blocks it is laid out again (never stretched) on every step
 * of a resize, and it is a placeholder for working on the figure: exports
 * leave it out (FigureCanvas.toSVG).
 */
import { Group, Path, Point, Rect, classRegistry, type FabricObject, type GroupProps } from 'fabric'

import { wash } from './panel-block'

export type SpaceHolds = 'chart' | 'image' | 'icon'

export class ContentSpace extends Group {
  static type = 'ContentSpace'
  declare spaceWidth?: number
  declare spaceHeight?: number
  /** What goes in it. */
  declare holds?: SpaceHolds

  constructor(objects?: FabricObject[], options?: Partial<GroupProps>) {
    super(objects, options)
    // Spaces turn only with the page, also when read back from a saved figure.
    this.lockRotation = true
    this.setControlVisible('mtr', false)
  }
}
classRegistry.setClass(ContentSpace)

/** What a space saves of its own (its block is `panelId`). */
export const CONTENT_SPACE_PROPERTIES = ['spaceWidth', 'spaceHeight', 'holds'] as const

const GREY = '#71717a'
const DASH = [3, 3]
const RADIUS = 6
/** The smallest a space gets: room for its picture. */
export const SMALLEST_SPACE = 40

export const isContentSpace = (object: FabricObject | undefined): object is ContentSpace => object instanceof ContentSpace

export function contentSize(space: ContentSpace): { width: number; height: number } {
  return { width: space.spaceWidth ?? 160, height: space.spaceHeight ?? 120 }
}

const NAMES: Record<SpaceHolds, string> = { chart: 'Empty chart space', image: 'Empty image space', icon: 'Empty icon space' }
export const contentSpaceName = (space: ContentSpace): string => NAMES[space.holds ?? 'chart']

/**
 * The faint dashed box and, in its middle, a faded picture of what goes in
 * it (for a chart: an axis with three bars) with a small plus badge cut out
 * on its bottom-right, as on an icon space. No text.
 */
function spaceParts(size: { width: number; height: number }): FabricObject[] {
  const { width, height } = size
  const back = wash(GREY, 0.05)
  const box = new Rect({ left: 0, top: 0, width, height, rx: RADIUS, ry: RADIUS, fill: back, stroke: wash(GREY, 0.4), strokeWidth: 1, strokeDashArray: DASH, originX: 'left', originY: 'top' })
  const s = Math.min(34, Math.max(14, Math.min(width, height) * 0.3))
  const x = width / 2 - s / 2
  const y = height / 2 - s / 2
  const faint = wash(GREY, 0.4)
  const axis = new Path(`M ${x} ${y} V ${y + s} H ${x + s}`, { stroke: faint, strokeWidth: 1.25, strokeLineCap: 'round', strokeLineJoin: 'round', fill: '' })
  const bars = [0.45, 0.8, 0.6].map(
    (v, i) => new Rect({ left: x + s * (0.14 + i * 0.29), top: y + s * (1 - v), width: s * 0.18, height: s * v - 1.5, rx: 1, ry: 1, fill: wash(GREY, 0.22), originX: 'left', originY: 'top' }),
  )
  const badge = { x: x + s + 2, y: y + s - 2, radius: Math.max(4, s * 0.15) }
  const round = (radius: number, fill: string) => new Rect({ left: badge.x, top: badge.y, width: radius * 2, height: radius * 2, rx: radius, ry: radius, fill, originX: 'center', originY: 'center' })
  const cutout = round(badge.radius + 1.5, back)
  const dot = round(badge.radius, wash(GREY, 0.45))
  const arm = badge.radius * 0.5
  const plus = new Path(`M ${badge.x - arm} ${badge.y} H ${badge.x + arm} M ${badge.x} ${badge.y - arm} V ${badge.y + arm}`, { stroke: '#ffffff', strokeWidth: 1.25, strokeLineCap: 'round', fill: '' })
  return [box, axis, ...bars, cutout, dot, plus]
}

/** The space's box on the page (spaces are never turned). */
export function contentBox(space: ContentSpace): { x: number; y: number; width: number; height: number } {
  const size = contentSize(space)
  const centre = space.getCenterPoint()
  return { x: centre.x - (size.width * space.scaleX) / 2, y: centre.y - (size.height * space.scaleY) / 2, width: size.width * space.scaleX, height: size.height * space.scaleY }
}

/** Put the parts in again for the space's size, its box's middle at `middle`. */
function refill(space: ContentSpace, middle: Point): void {
  // Unscaled while its parts go in, or they would take on its old scale.
  space.set({ scaleX: 1, scaleY: 1, angle: 0 })
  space.removeAll()
  space.add(...spaceParts(contentSize(space)))
  space.setPositionByOrigin(middle, 'center', 'center')
  space.setCoords()
}

/** A new empty space with its box's top-left corner at `corner`. */
export function buildContentSpace(corner: { x: number; y: number }, size: { width: number; height: number }, holds: SpaceHolds = 'chart'): ContentSpace {
  const width = Math.max(SMALLEST_SPACE, size.width)
  const height = Math.max(SMALLEST_SPACE, size.height)
  const space = new ContentSpace(spaceParts({ width, height }))
  Object.assign(space, { spaceWidth: width, spaceHeight: height, holds, name: NAMES[holds] })
  space.setPositionByOrigin(new Point(corner.x + width / 2, corner.y + height / 2), 'center', 'center')
  space.setCoords()
  return space
}

/** While a space is resized (and when let go): the stretch goes into its size, the side opposite the handle staying put. */
export function bakeContentScale(space: ContentSpace, originX: 'left' | 'center' | 'right' = 'center', originY: 'top' | 'center' | 'bottom' = 'center'): void {
  const { scaleX: sx, scaleY: sy } = space
  if (sx === 1 && sy === 1) return
  const size = contentSize(space)
  const pinned = space.getPointByOrigin(originX, originY)
  // The outline doesn't grow: only the box takes the stretch.
  space.spaceWidth = Math.max(SMALLEST_SPACE, space.width * Math.abs(sx) - (space.width - size.width))
  space.spaceHeight = Math.max(SMALLEST_SPACE, space.height * Math.abs(sy) - (space.height - size.height))
  refill(space, space.getCenterPoint())
  space.setPositionByOrigin(pinned, originX, originY)
  space.setCoords()
}

/**
 * A space inside a selection of several that is being resized: it takes
 * `size` (already stretched) and undoes the selection's stretch on itself,
 * so its dashes never stretch, while dragging or after.
 */
export function sizeContentInSelection(space: ContentSpace, size: { width: number; height: number }, stretch: { x: number; y: number }): void {
  const middle = space.getRelativeCenterPoint()
  // Rebuilt as if on its own: parts added inside the stretched selection would take on its stretch.
  const parent = space.group
  space.group = undefined
  space.spaceWidth = Math.max(SMALLEST_SPACE, size.width)
  space.spaceHeight = Math.max(SMALLEST_SPACE, size.height)
  space.set({ angle: 0, scaleX: 1, scaleY: 1 })
  space.removeAll()
  space.add(...spaceParts(contentSize(space)))
  space.set({ scaleX: 1 / stretch.x, scaleY: 1 / stretch.y })
  space.group = parent
  space.setPositionByOrigin(middle, 'center', 'center')
  space.setCoords()
}

/** Give a space a new box on the page. */
export function setContentBox(space: ContentSpace, box: { x: number; y: number; width: number; height: number }): void {
  space.spaceWidth = Math.max(SMALLEST_SPACE, box.width)
  space.spaceHeight = Math.max(SMALLEST_SPACE, box.height)
  refill(space, new Point(box.x + space.spaceWidth / 2, box.y + space.spaceHeight / 2))
}
