/** Sizes on the page are kept in pixels at 96 per inch; people see millimetres. */
export const PX_PER_MM = 96 / 25.4

export const mmToPx = (mm: number) => mm * PX_PER_MM
export const pxToMm = (px: number) => px / PX_PER_MM

/** A length in mm with at most one decimal, e.g. "30.5". */
export const formatMm = (px: number) => String(Math.round(pxToMm(px) * 10) / 10)

export const ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3, 4] as const
export const MIN_ZOOM = ZOOM_STEPS[0]
export const MAX_ZOOM = ZOOM_STEPS[10]

/** The next zoom step in or out from any zoom, also from one between two steps. */
export function nextZoom(zoom: number, direction: 'in' | 'out'): number {
  if (direction === 'in') return ZOOM_STEPS.find((step) => step > zoom + 0.001) ?? MAX_ZOOM
  return [...ZOOM_STEPS].reverse().find((step) => step < zoom - 0.001) ?? MIN_ZOOM
}

/** The zoom at which the whole page fits in the space, with room around it. */
export function fitZoom(page: { width: number; height: number }, space: { width: number; height: number }, margin = 48): number {
  const zoom = Math.min((space.width - margin * 2) / page.width, (space.height - margin * 2) / page.height)
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
}
