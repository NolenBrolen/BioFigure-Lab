/*
 * Panel letters (BIO-83, design A "Outside the corner"): the letters that
 * label a figure's parts (A, B, C…) on grid cells and panel blocks. Every
 * letter on a slide is counted together in one reading order, and the slide
 * has one look for all of them (style, weight, size) and a numbering (start
 * again at A, or go on where the slide before ended).
 *
 * This file holds what is pure: the settings, the text of a letter, and
 * reading a slide's saved canvas text to know where its letters end, so the
 * next slide can go on from there. The canvas keeps a slide's settings under
 * one extra top-level key, `letters` (`FigureCanvas.serialize`); the sync
 * that gives every grid and panel its letter is `syncLetters` (grid-block.ts).
 */

export type LetterStyle = 'capital' | 'small' | 'brackets' | 'stop'
export type LetterNumbering = 'start' | 'continue'

/** A slide's letter look and numbering, the same for every letter on it. */
export type SlideLetters = {
  style: LetterStyle
  bold: boolean
  /** In pt, as text sizes are everywhere in the app. */
  size: number
  numbering: LetterNumbering
}

/** Page pixels per pt, as the text controls convert it. */
export const PX_PER_PT = 96 / 72

/** 10.5 pt is 14 px: the size grid letters always had. */
export const DEFAULT_LETTERS: SlideLetters = { style: 'capital', bold: true, size: 10.5, numbering: 'start' }
export const LETTER_SIZE_RANGE = { min: 6, max: 24 }

export const LETTER_STYLES: readonly { id: LetterStyle; name: string }[] = [
  { id: 'capital', name: 'Capital' },
  { id: 'small', name: 'Small' },
  { id: 'brackets', name: 'Brackets' },
  { id: 'stop', name: 'Full stop' },
]

/** What a block needs to draw a letter without the canvas: weight and size in page pixels. */
export type LetterLook = { bold: boolean; px: number }
export const lookOfLetters = (letters: SlideLetters): LetterLook => ({ bold: letters.bold, px: Math.round(letters.size * PX_PER_PT * 100) / 100 })
export const DEFAULT_LOOK: LetterLook = lookOfLetters(DEFAULT_LETTERS)
export const sameLook = (a: LetterLook | undefined, b: LetterLook | undefined) => (a ?? DEFAULT_LOOK).bold === (b ?? DEFAULT_LOOK).bold && Math.abs((a ?? DEFAULT_LOOK).px - (b ?? DEFAULT_LOOK).px) < 0.005

/** The strip a letter takes above its box: 20 px at the default size, growing with the letter so a big one never touches the cell. */
export const letterRoom = (px: number): number => Math.max(14, Math.round((px * 20) / DEFAULT_LOOK.px))

/** A letter's text: A … Z, then AA, AB… (index 0 is the first), in the slide's style. */
export function letterName(index: number, style: LetterStyle): string {
  const name = index < 26 ? String.fromCharCode(65 + index) : String.fromCharCode(65 + Math.floor(index / 26) - 1) + String.fromCharCode(65 + (index % 26))
  switch (style) {
    case 'capital':
      return name
    case 'small':
      return name.toLowerCase()
    case 'brackets':
      return `(${name})`
    case 'stop':
      return `${name}.`
  }
}

/** Where the slide on screen sits among the slides, for its numbering. */
export type LetterContext = {
  /** The slide's place, from 1. */
  slide: number
  /** Whether it is the first slide (it always starts at A). */
  first: boolean
  /** How many letters the slides before it end with: where "Go on" starts (index of the next letter). */
  continueAt: number
  /** The style of the slide before, whose style no longer names the "From" letter (this slide's does). */
  previousStyle: LetterStyle
}
export const FIRST_SLIDE: LetterContext = { slide: 1, first: true, continueAt: 0, previousStyle: 'capital' }

/** The index the slide's first letter has. */
export const startIndexOf = (letters: SlideLetters, context: LetterContext): number => (context.first || letters.numbering === 'start' ? 0 : context.continueAt)

/* ---------- Reading a slide's saved text ---------- */

type Saved = { type?: unknown; visible?: unknown; panel?: { letter?: unknown }; grid?: { letters?: unknown; bold?: unknown; upper?: unknown }; gridLetters?: unknown }

const isStyle = (value: unknown): value is LetterStyle => LETTER_STYLES.some((style) => style.id === value)

/** Settings as saved under `letters`, filled in with the defaults; undefined when there are none. */
export function readLetters(value: unknown): SlideLetters | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const saved = value as Partial<Record<keyof SlideLetters, unknown>>
  return {
    style: isStyle(saved.style) ? saved.style : DEFAULT_LETTERS.style,
    bold: typeof saved.bold === 'boolean' ? saved.bold : DEFAULT_LETTERS.bold,
    size: typeof saved.size === 'number' && saved.size > 0 ? Math.min(LETTER_SIZE_RANGE.max, Math.max(LETTER_SIZE_RANGE.min, saved.size)) : DEFAULT_LETTERS.size,
    numbering: saved.numbering === 'continue' ? 'continue' : 'start',
  }
}

const savedObjects = (canvas: unknown): Saved[] => {
  const objects = typeof canvas === 'object' && canvas !== null ? (canvas as { objects?: unknown }).objects : undefined
  return Array.isArray(objects) ? (objects as Saved[]) : []
}

/**
 * A slide with no saved letter settings (figures from before BIO-83) takes
 * its look from the first figure grid on it: its case and weight were the
 * grid's own then. Without a grid, the defaults.
 */
export function legacyLetters(canvas: unknown): SlideLetters {
  const grid = savedObjects(canvas).find((object) => object.type === 'GridBlock')?.grid
  if (!grid) return DEFAULT_LETTERS
  return { ...DEFAULT_LETTERS, style: grid.upper === false ? 'small' : 'capital', bold: grid.bold !== false }
}

/** How many letters a slide's own things take (grids with letters on, panels with a letter), from its parsed canvas. */
export function countLetters(canvas: unknown): number {
  let count = 0
  for (const object of savedObjects(canvas)) {
    if (object.visible === false) continue
    if (object.type === 'GridBlock') {
      if (object.grid?.letters !== false && Array.isArray(object.gridLetters)) count += object.gridLetters.length
    } else if (object.type === 'PanelBlock' && object.panel?.letter === true) count += 1
  }
  return count
}

/** A slide's settings from its saved canvas text (parsed): its own, else the old grid's, else the defaults. */
export function lettersOfCanvas(canvas: unknown): SlideLetters {
  const own = typeof canvas === 'object' && canvas !== null ? readLetters((canvas as { letters?: unknown }).letters) : undefined
  return own ?? legacyLetters(canvas)
}

/** The canvas of a new slide: empty, with the look (not the numbering) of the slide it follows. */
export function newSlideCanvas(previous: string | undefined): string {
  const { style, bold, size } = lettersOfCanvas(parse(previous))
  return JSON.stringify({ objects: [], letters: { style, bold, size, numbering: 'start' } })
}

const parse = (text: string | undefined): unknown => {
  if (!text) return undefined
  try {
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
}

/**
 * Where each slide's letters stand, from the slides' saved canvas text in
 * order: its place, whether it goes on, and the index the slides before it
 * end at. A slide that goes on adds its own letters to the count; one that
 * starts again begins from nothing. So A–D, then a slide going on with three
 * letters (E–G), then one going on starts at H.
 */
export function letterContexts(canvases: readonly (string | undefined)[]): LetterContext[] {
  const contexts: LetterContext[] = []
  let end = 0
  let style: LetterStyle = DEFAULT_LETTERS.style
  for (const [i, text] of canvases.entries()) {
    const canvas = parse(text)
    const letters = lettersOfCanvas(canvas)
    const context: LetterContext = { slide: i + 1, first: i === 0, continueAt: i === 0 ? 0 : end, previousStyle: style }
    contexts.push(context)
    end = startIndexOf(letters, context) + countLetters(canvas)
    style = letters.style
  }
  return contexts
}

/** What the properties panels show: the settings, the slide's place, and the real letters the numbering row names. */
export type LettersInfo = SlideLetters & {
  slide: number
  first: boolean
  /** The first letter "Start at" gives, in this slide's style. */
  startAt: string
  /** The letter "From" gives when going on: the one after the slide before's last, written in this slide's style. */
  goOnAt: string
}

export const lettersInfo = (letters: SlideLetters, context: LetterContext): LettersInfo => ({
  ...letters,
  slide: context.slide,
  first: context.first,
  startAt: letterName(0, letters.style),
  goOnAt: letterName(context.continueAt, letters.style),
})
