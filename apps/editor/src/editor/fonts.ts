/*
 * The fonts text can use: a few open-licence fonts that suit scientific
 * figures, bundled with the app (see fonts.css). Inter stays the default.
 *
 * Text keeps its font as a CSS font list: the font itself, then Inter and
 * Noto Sans Math for any character it lacks (Greek, arrows, ⇌), then the
 * general kind (sans-serif, serif, monospace).
 */
import { familyName } from '@biofigure-lab/export/outline-text'

export type FontCategory = 'Sans serif' | 'Serif' | 'Monospace'

export type FontInfo = {
  /** The name people see. */
  name: string
  category: FontCategory
  /** The family name in CSS. */
  family: string
  /** The Fontsource package (and file prefix) the export reads the glyphs from. */
  files: string
  generic: 'sans-serif' | 'serif' | 'monospace'
}

export const DEFAULT_FONT: FontInfo = { name: 'Inter', category: 'Sans serif', family: 'Inter Variable', files: 'inter', generic: 'sans-serif' }

export const FONTS: readonly FontInfo[] = [
  DEFAULT_FONT,
  { name: 'Source Sans 3', category: 'Sans serif', family: 'Source Sans 3', files: 'source-sans-3', generic: 'sans-serif' },
  { name: 'Open Sans', category: 'Sans serif', family: 'Open Sans', files: 'open-sans', generic: 'sans-serif' },
  { name: 'Source Serif 4', category: 'Serif', family: 'Source Serif 4', files: 'source-serif-4', generic: 'serif' },
  { name: 'Merriweather', category: 'Serif', family: 'Merriweather', files: 'merriweather', generic: 'serif' },
  { name: 'JetBrains Mono', category: 'Monospace', family: 'JetBrains Mono', files: 'jetbrains-mono', generic: 'monospace' },
]

/** Every font comes in these weights, upright and italic. */
export const FONT_WEIGHTS = [300, 400, 500, 600, 700] as const

/** Draws the maths symbols no text font has. */
export const MATH_FAMILY = 'Noto Sans Math'

/** The font list a text object keeps, e.g. "'Source Serif 4', 'Inter Variable', 'Noto Sans Math', serif". */
export function fontStack(font: FontInfo): string {
  const families = [font.family, DEFAULT_FONT.family, MATH_FAMILY].filter((family, i, all) => all.indexOf(family) === i)
  return [...families.map((family) => `'${family}'`), font.generic].join(', ')
}

/** The font behind a font list; text from before fonts could be picked (or an unknown font) counts as Inter. */
export function fontOf(stack: string | undefined): FontInfo {
  const family = stack ? familyName(stack) : ''
  return FONTS.find((font) => font.family === family || font.name === family) ?? DEFAULT_FONT
}

export const fontByName = (name: string): FontInfo | undefined => FONTS.find((font) => font.name === name)

/** The nearest weight the fonts have. */
export const nearestWeight = (weight: number): number =>
  FONT_WEIGHTS.reduce((best, w) => (Math.abs(w - weight) < Math.abs(best - weight) ? w : best), 400)

/**
 * Has the browser load a font face, so the canvas measures and draws text with
 * it straight away instead of a stand-in. Does nothing outside a browser.
 */
export async function loadFontFace(font: FontInfo, weight: number, italic: boolean): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) return
  await Promise.all([
    document.fonts.load(`${italic ? 'italic ' : ''}${weight} 16px '${font.family}'`),
    document.fonts.load(`16px '${MATH_FAMILY}'`, '⇌'),
  ]).catch(() => undefined)
}
