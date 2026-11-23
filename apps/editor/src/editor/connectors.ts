/**
 * Arrows that stick to objects. An arrow end can be attached to an object;
 * whenever that object moves, turns or changes size, the end follows and sits
 * on the object's edge, on the side facing the arrow's other end. Plain maths
 * here; the canvas code feeds in where each object is.
 */
import type { ArrowDrawing } from '@biofigure-lab/ui/lib/arrow-geometry'

import type { XY } from './geometry'

/**
 * Where an object is: the matrix that takes points from its own space (origin
 * at its centre) to the page, its size in its own space, and whether its
 * outline is round (an ellipse) rather than a box.
 */
export type Frame = { matrix: readonly number[]; width: number; height: number; round: boolean }

/** One arrow end: where it is now, and the id of the object it's stuck to. */
export type ConnectorEnd = { point: XY; attach?: string }

/** Gap between an attached arrow end and the object's edge, in page pixels. */
export const ATTACH_GAP = 3

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

/**
 * Where both ends of an arrow should be now. Attached ends sit on their
 * object's edge facing the other end; an end whose object is gone (deleted)
 * stays where it last was.
 */
export function followEnds(ends: readonly [ConnectorEnd, ConnectorEnd], frameOf: (id: string) => Frame | undefined): [XY, XY] {
  const frames = ends.map((end) => (end.attach ? frameOf(end.attach) : undefined))
  const aim = ends.map((end, i) => (frames[i] ? frameCentre(frames[i]) : end.point))
  return ends.map((end, i) => {
    const frame = frames[i]
    return frame ? edgePoint(frame, aim.at(1 - i)!) : end.point
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
