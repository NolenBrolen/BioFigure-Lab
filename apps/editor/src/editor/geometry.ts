/**
 * Distances used to decide what the pointer is on. Objects can be grabbed a
 * few screen pixels outside their visible edge, so thin lines and small
 * objects are as easy to pick up as big ones.
 */
export type XY = { x: number; y: number }

/** How far outside an object's edge it can still be grabbed, in screen pixels. */
export const HIT_TOLERANCE_PX = 6

/** How far the pointer must move before a press counts as a drag, in screen pixels. */
export const DRAG_THRESHOLD_PX = 4

export function distance(a: XY, b: XY): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** Shortest distance from a point to the segment a–b. */
export function distanceToSegment(p: XY, a: XY, b: XY): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return distance(p, a)
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared))
  return distance(p, { x: a.x + t * dx, y: a.y + t * dy })
}

/** 0 when the point is inside the polygon, otherwise the distance to its nearest edge. */
export function distanceToPolygon(p: XY, polygon: readonly XY[]): number {
  let inside = false
  let nearest = Infinity
  let b = polygon.at(-1)
  for (const a of polygon) {
    if (!b) break
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
    nearest = Math.min(nearest, distanceToSegment(p, a, b))
    b = a
  }
  return inside ? 0 : nearest
}

const RESIZE_CURSORS = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'] as const

/**
 * The resize cursor for a corner handle. Fabric picks it from the direction
 * between the shape's centre and the mouse, which gives a sideways arrow on the
 * corners of wide, flat shapes. This uses the corner itself, so corners always
 * get a diagonal arrow, turned with the shape.
 */
export function cornerCursor(corner: XY, angle: number, flipX = false, flipY = false): string {
  return `${RESIZE_CURSORS[Math.round(cornerDirection(corner, angle, flipX, flipY) / 45) % 8]}-resize`
}

/**
 * The usual rotate cursor of drawing apps, drawn for a corner on the right: a
 * quarter circle with a solid arrowhead at each end, black with a white
 * outline so it shows on any background.
 */
const ROTATE_ARROW_SHAPES =
  '<path d="M12.4 5.6A9 9 0 0 1 12.4 18.4" fill="none"/><path d="M9.6 3.2 14.6 3.4 10.2 7.8Z"/><path d="M9.6 20.8 14.6 20.6 10.2 16.2Z"/>'
const ROTATE_ARROW = (degrees: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><g transform="rotate(${degrees} 12 12)" stroke-linejoin="round" stroke-linecap="round"><g fill="#fff" stroke="#fff" stroke-width="4">${ROTATE_ARROW_SHAPES}</g><g fill="#000" stroke="#000" stroke-width="1.75">${ROTATE_ARROW_SHAPES}</g></g></svg>`

/** The direction a corner points away from the shape's centre, in degrees (0 = right, 90 = down). */
export function cornerDirection(corner: XY, angle: number, flipX = false, flipY = false): number {
  const x = flipX ? -corner.x : corner.x
  const y = flipY ? -corner.y : corner.y
  const degrees = (Math.atan2(y, x) * 180) / Math.PI + angle
  return ((degrees % 360) + 360) % 360
}

/**
 * The rotate cursor just outside a corner: a curved arrow that bends around
 * that corner, turned with the shape. Falls back to a plain grab cursor.
 */
export function rotateCursor(corner: XY, angle: number, flipX = false, flipY = false): string {
  const degrees = Math.round(cornerDirection(corner, angle, flipX, flipY))
  return `url("data:image/svg+xml,${encodeURIComponent(ROTATE_ARROW(degrees))}") 12 12, grab`
}
