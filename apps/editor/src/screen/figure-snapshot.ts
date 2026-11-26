/*
 * What decides whether an open figure has something new to save: its name,
 * page size and every slide's contents, in order. Compared piece by piece
 * rather than as one long text, so checking costs next to nothing when the
 * slides are the same strings as before (BIO-88).
 */
import type { PageMm } from '../editor/page-size'

export type FigureSnapshot = {
  name: string
  page: PageMm
  slides: readonly (readonly [id: string, canvas: string | undefined])[]
}

export const snapshotOf = (name: string, page: PageMm, slides: readonly { id: string; canvas?: string }[]): FigureSnapshot => ({
  name,
  page: { width: page.width, height: page.height },
  slides: slides.map((slide) => [slide.id, slide.canvas] as const),
})

export const sameSnapshot = (a: FigureSnapshot, b: FigureSnapshot): boolean =>
  a.name === b.name &&
  a.page.width === b.page.width &&
  a.page.height === b.page.height &&
  a.slides.length === b.slides.length &&
  a.slides.every(([id, canvas], index) => b.slides[index]?.[0] === id && b.slides[index]?.[1] === canvas)
