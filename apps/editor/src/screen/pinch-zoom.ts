/*
 * The maths behind pinch zoom on phones (BIO-11), the way iPhone apps do it:
 * past the smallest (fit) and largest zoom the page still follows the
 * fingers but with growing resistance, and when the fingers lift it springs
 * back. Letting go below or just above fit springs to fit, so the whole page
 * is one quick pinch away.
 */

/** Letting go within this factor above fit springs to fit (10%). */
export const FIT_SNAP = 1.1
/** How much the page still follows the fingers past a limit: 1 follows fully, 0 not at all. */
const GIVE = 0.35

/** The zoom shown for the fingers' zoom `raw`: as is between the limits, with resistance past them. */
export function rubberBand(raw: number, min: number, max: number): number {
  if (raw < min) return min * Math.pow(raw / min, GIVE)
  if (raw > max) return max * Math.pow(raw / max, GIVE)
  return raw
}

/** Where the zoom settles when the fingers lift: fit when below or near it, the largest zoom when past it, else where it is. */
export function settleZoom(shown: number, fit: number, max: number): number {
  if (shown <= fit * FIT_SNAP) return fit
  return Math.min(shown, max)
}

type Corner = { left: number; top: number }

/**
 * The move that makes the page's frame, transformed from its top-left
 * corner, show something at screen position `from` that its layout puts
 * at `to`, `scale` times as big. `frame` is the frame's own top-left.
 */
export function placeAt(from: Corner, to: Corner, frame: Corner, scale: number): { x: number; y: number } {
  return { x: from.left - frame.left - (to.left - frame.left) * scale, y: from.top - frame.top - (to.top - frame.top) * scale }
}
