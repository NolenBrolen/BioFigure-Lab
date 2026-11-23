/**
 * Arrows that stick to objects. An arrow end can be attached to an object;
 * whenever that object moves, turns or changes size, the end follows. An end
 * attached to a chosen side (top, right, bottom or left) sits just outside the
 * middle of that side. An end attached without a side (older figures) sits on
 * the object's edge, on the side facing the arrow's other end; a U-shaped
 * arrow of that kind puts its ends on the bottom of their objects, so the U
 * passes underneath. Plain maths here; the canvas code feeds in where each
 * object is.
 */
import type { ArrowDrawing } from '@biofigure-lab/ui/lib/arrow-geometry'

import type { XY } from './geometry'
import { mmToPx } from './units'

/**
 * Where an object is: the matrix that takes points from its own space (origin
 * at its centre) to the page, its size in its own space, and whether its
 * outline is round (an ellipse) rather than a box.
 */
export type Frame = { matrix: readonly number[]; width: number; height: number; round: boolean }

/** The four sides of an object, as the user sees them before the object is turned. */
export type Side = 'top' | 'right' | 'bottom' | 'left'

/** One arrow end: where it is now, the id of the object it's stuck to, and the side of it, if one was chosen. */
export type ConnectorEnd = { point: XY; attach?: string; side?: Side }

/** Gap between an attached arrow end and the object's edge, in page pixels. */
export const ATTACH_GAP = 3

/**
 * Gap between an arrow end attached to a chosen side and the object, in page
 * pixels (2 mm). The anchor dots sit at the same distance, so a dot shows
 * exactly where the arrow's end will be.
 */
export const ANCHOR_GAP = mmToPx(2)

const apply = (m: readonly number[], p: XY): XY => {
  const [a = 1, b = 0, c = 0, d = 1, e = 0, f = 0] = m
  return { x: a * p.x + c * p.y + e, y: b * p.x + d * p.y + f }
}

function invert(m: readonly number[]): number[] {
  const [a, b, c, d, e, f] = m as [number, number, number, number, number, number]
  const det = a * d - b * c
  return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det]
}

export const frameCentre = (frame: Frame): XY => apply(frame.matrix, { x: 0, y: 0 })

/** The point on an object's edge on the line from its centre towards `toward`, pulled back by `gap`. */
export function edgePoint(frame: Frame, toward: XY, gap = ATTACH_GAP): XY {
  const local = apply(invert(frame.matrix), toward)
  const hw = frame.width / 2
  const hh = frame.height / 2
  if (Math.hypot(local.x, local.y) < 1e-9) return frameCentre(frame)
  const k = frame.round
    ? 1 / Math.hypot(local.x / hw, local.y / hh)
    : Math.min(local.x === 0 ? Infinity : hw / Math.abs(local.x), local.y === 0 ? Infinity : hh / Math.abs(local.y))
  // The other end is inside the object: point at its centre.
  if (k >= 1) return frameCentre(frame)
  const edge = apply(frame.matrix, { x: local.x * k, y: local.y * k })
  const away = Math.hypot(toward.x - edge.x, toward.y - edge.y)
  return away === 0 ? edge : { x: edge.x + ((toward.x - edge.x) / away) * gap, y: edge.y + ((toward.y - edge.y) / away) * gap }
}

/** Where the middle of a side is in the object's own space, and the way that side faces. */
const SIDE_SPOTS = (frame: Frame): Record<Side, { at: XY; out: XY }> => ({
  top: { at: { x: 0, y: -frame.height / 2 }, out: { x: 0, y: -1 } },
  right: { at: { x: frame.width / 2, y: 0 }, out: { x: 1, y: 0 } },
  bottom: { at: { x: 0, y: frame.height / 2 }, out: { x: 0, y: 1 } },
  left: { at: { x: -frame.width / 2, y: 0 }, out: { x: -1, y: 0 } },
})

/** The way a side faces on the page (outward), as a unit direction. Turned and stretched objects work. */
export function sideNormal(frame: Frame, side: Side): XY {
  const { at, out } = SIDE_SPOTS(frame)[side]
  const start = apply(frame.matrix, at)
  const next = apply(frame.matrix, { x: at.x + out.x, y: at.y + out.y })
  const length = Math.hypot(next.x - start.x, next.y - start.y)
  return length === 0 ? out : { x: (next.x - start.x) / length, y: (next.y - start.y) / length }
}

/**
 * The middle of one side of an object, pushed outward by `gap` page pixels
 * (an arrow's end on a side uses ANCHOR_GAP).
 * Turned and stretched objects work: the outward direction is worked out on
 * the page, so the gap is the same whatever the object's scale. A round object's
 * side middle lies on its ellipse.
 */
export function sidePoint(frame: Frame, side: Side, gap = ANCHOR_GAP): XY {
  const start = apply(frame.matrix, SIDE_SPOTS(frame)[side].at)
  const normal = sideNormal(frame, side)
  return { x: start.x + normal.x * gap, y: start.y + normal.y * gap }
}

/** How far below an object's centre an arrow end aims when it is told which way is down. Far enough to count as straight down. */
const FAR = 1e6

/**
 * Where both ends of an arrow should be now. An attached end with a chosen
 * side sits `sideGap` outside the middle of that side, whatever the other end
 * is doing. Any other attached end sits on its object's edge facing the other
 * end; an end whose object is gone (deleted) stays where it last was.
 *
 * A U-shaped arrow without chosen sides is the exception: it leaves and enters from below, so it
 * passes `down` (the way the arrow's own downwards points on the page) and
 * each attached end then sits on the bottom edge, straight below the
 * object's centre, whatever the other end is doing.
 */
export function followEnds(ends: readonly [ConnectorEnd, ConnectorEnd], frameOf: (id: string) => Frame | undefined, down?: XY, sideGap = ANCHOR_GAP): [XY, XY] {
  const frames = ends.map((end) => (end.attach ? frameOf(end.attach) : undefined))
  const aim = ends.map((end, i) => {
    const frame = frames[i]
    if (!frame) return end.point
    const centre = frameCentre(frame)
    return down ? { x: centre.x + down.x * FAR, y: centre.y + down.y * FAR } : centre
  })
  return ends.map((end, i) => {
    const frame = frames[i]
    if (!frame) return end.point
    if (end.side) return sidePoint(frame, end.side, sideGap)
    return edgePoint(frame, (down ? aim.at(i) : aim.at(1 - i))!)
  }) as [XY, XY]
}

/** Which object an arrow end attaches to when it's let go at a point: the topmost one under it. */
export function attachTargetAt(point: XY, candidates: readonly { id: string; frame: Frame }[]): string | undefined {
  for (const { id, frame } of candidates.toReversed()) {
    const local = apply(invert(frame.matrix), point)
    const [u, v] = [local.x / (frame.width / 2), local.y / (frame.height / 2)]
    const inside = frame.round ? u * u + v * v <= 1 : Math.abs(u) <= 1 && Math.abs(v) <= 1
    if (inside) return id
  }
  return undefined
}

/** An arrow as SVG elements: plain paths, so it stays sharp (vector) in SVG and PDF exports. */
export function arrowSvg(drawing: ArrowDrawing, paint: { stroke: string; strokeWidth: number }): string[] {
  const common = `stroke="${paint.stroke}" stroke-width="${paint.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"`
  const dash = drawing.dash ? ` stroke-dasharray="${drawing.dash.join(' ')}"` : ''
  return [
    `<path d="${drawing.shaft}" fill="none" ${common}${dash} />\n`,
    ...drawing.parts.map((part) => `<path d="${part.d}" fill="${part.filled ? paint.stroke : 'none'}" ${common} />\n`),
  ]
}
