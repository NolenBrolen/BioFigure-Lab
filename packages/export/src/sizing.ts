/** Resolutions offered for PNG export, in dots (pixels) per inch. */
export const PNG_DPIS = [300, 600, 1200] as const
export type PngDpi = (typeof PNG_DPIS)[number]

export const MM_PER_INCH = 25.4

/** How many pixels a length in mm becomes at a resolution, rounded to whole pixels. */
export const mmToPixels = (mm: number, dpi: number) => Math.max(1, Math.round((mm / MM_PER_INCH) * dpi))

/** The PNG's size in pixels for a page in mm, e.g. 174 × 120 mm at 300 dpi is 2055 × 1417 px. */
export function pngSize(pageMm: { width: number; height: number }, dpi: number): { width: number; height: number } {
  return { width: mmToPixels(pageMm.width, dpi), height: mmToPixels(pageMm.height, dpi) }
}
