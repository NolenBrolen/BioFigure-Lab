import { columnName } from '@biofigure-lab/ui/components/paper-preview/PaperPreviewWindow'

/** Page sizes for a new figure, in millimetres. */
export type PageMm = { width: number; height: number }

export type PagePresetId = 'single' | 'one-and-half' | 'double'

/** Journal column widths. The heights are a first guess people can change. */
export const PAGE_PRESETS: readonly { id: PagePresetId; label: string; page: PageMm }[] = [
  { id: 'single', label: 'Single column', page: { width: 85, height: 60 } },
  { id: 'one-and-half', label: '1.5 column', page: { width: 114, height: 80 } },
  { id: 'double', label: 'Double column', page: { width: 174, height: 120 } },
]

export const DEFAULT_PAGE: PageMm = { width: 174, height: 120 }

/** Smallest and largest side we allow, so a typo like 1740 doesn't make a page nobody can work on. */
export const MIN_MM = 10
export const MAX_MM = 1000

/** The height a page of this width starts with: the preset's for a column width, otherwise about 7:10 like them. */
export function defaultHeight(width: number): number {
  return PAGE_PRESETS.find((preset) => preset.page.width === width)?.page.height ?? Math.round(width * 0.69)
}

/** The preset with exactly this size, or undefined for a custom size. */
export function presetFor(page: PageMm): PagePresetId | undefined {
  return PAGE_PRESETS.find((preset) => preset.page.width === page.width && preset.page.height === page.height)?.id
}

/** A figure's size the way the canvas names it: "Single column · 85 × 60 mm". */
export function sizeLabel(page: PageMm): string {
  return `${columnName(page.width)} · ${page.width} × ${page.height} mm`
}

/** A typed length in mm, e.g. "85", "85.5" or "85,5". Undefined when it isn't a number. */
export function parseMm(text: string): number | undefined {
  const cleaned = text.trim().replace(',', '.').replace(/\s*mm$/i, '')
  if (!/^\d+(\.\d*)?$|^\.\d+$/.test(cleaned)) return undefined
  return Math.round(Number(cleaned) * 10) / 10
}

/** What is wrong with a typed length, or undefined when it is fine. */
export function mmError(text: string): string | undefined {
  const mm = parseMm(text)
  if (mm === undefined) return 'Type a number of millimetres'
  if (mm < MIN_MM) return `At least ${MIN_MM} mm`
  if (mm > MAX_MM) return `At most ${MAX_MM} mm`
  return undefined
}

/** A size read back from storage, with anything missing or broken replaced by the default. */
export function cleanPage(value: unknown): PageMm {
  const page = value as Partial<PageMm> | null | undefined
  const ok = (mm: unknown): mm is number => typeof mm === 'number' && Number.isFinite(mm) && mm >= MIN_MM && mm <= MAX_MM
  return ok(page?.width) && ok(page.height) ? { width: page.width, height: page.height } : DEFAULT_PAGE
}
