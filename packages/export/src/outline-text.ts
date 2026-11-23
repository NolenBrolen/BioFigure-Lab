/*
 * Turns the text in an SVG into outlines (paths), so it looks the same on
 * every computer and in every program, whether or not the font is installed.
 * Journals often ask for this. Uses opentype.js to read the glyph shapes.
 *
 * Each piece of text (a <tspan>) is drawn with its own font, weight and
 * italic, at its own size and baseline (so sub- and superscripts stay put),
 * and underline and strikethrough become thin bars.
 */
import type { Font, Glyph } from 'opentype.js'

const SVG_NS = 'http://www.w3.org/2000/svg'

/** One font face a figure uses: the family's name (first in the font-family list), its weight and whether it's italic. */
export type FontRequest = { family: string; weight: number; italic: boolean }

/** Picks the fonts to draw a face with, best first; later ones fill in characters the first lacks. */
export type FontPicker = (face: FontRequest) => readonly Font[]

/** Where underline and strikethrough sit and how thick they are, as a share of the font size. */
const UNDERLINE = { offset: 0.12, thickness: 0.06 }
const STRIKE = { offset: -0.3, thickness: 0.06 }

/** Text attributes that mean nothing once the text is a shape. */
const TEXT_ONLY = /^(font-|text-|xml:space$|direction$|letter-spacing$|word-spacing$)/

/** The first font that has a glyph for this character, else the first font (which draws its "missing" box). */
function fontFor(char: string, fonts: readonly Font[]): Font {
  return fonts.find((font) => font.charToGlyphIndex(char) > 0) ?? fonts[0]!
}

/**
 * Path data for a line of text starting at x on baseline y. Glyphs are placed
 * one by one with the font's kerning; opentype.js's own text layout can't read
 * all of Inter's substitution rules yet. A character the first font lacks
 * (e.g. Greek) comes from the next font that has it.
 */
export function textPathData(text: string, x: number, y: number, fontSize: number, fonts: readonly Font[]): string {
  const parts: string[] = []
  let previous: { font: Font; glyph: Glyph } | undefined
  for (const char of text) {
    const font = fontFor(char, fonts)
    const glyph = font.charToGlyph(char)
    const scale = fontSize / font.unitsPerEm
    if (previous && previous.font === font) x += font.getKerningValue(previous.glyph, glyph) * scale
    const d = glyph.getPath(x, y, fontSize).toPathData(3)
    if (d) parts.push(d)
    x += (glyph.advanceWidth ?? 0) * scale
    previous = { font, glyph }
  }
  return parts.join(' ')
}

/** How wide a line of text is, measured the same way as `textPathData`. */
export function textWidth(text: string, fontSize: number, fonts: readonly Font[]): number {
  let width = 0
  for (const char of text) {
    const font = fontFor(char, fonts)
    width += ((font.charToGlyph(char).advanceWidth ?? 0) * fontSize) / font.unitsPerEm
  }
  return width
}

const number = (value: string | null, fallback = 0) => {
  const parsed = Number.parseFloat(value ?? '')
  return Number.isFinite(parsed) ? parsed : fallback
}

/** A text property from the element's style ("font-size: 12px") or its attribute, if it has one. */
function own(element: Element, name: string): string | undefined {
  const style = element.getAttribute('style') ?? ''
  const match = new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`).exec(style)
  return (match?.[1] ?? element.getAttribute(name) ?? undefined)?.trim()
}

/** The first family named in a font-family list, without quotes. */
export const familyName = (list: string) => list.split(',')[0]!.trim().replace(/^['"]|['"]$/g, '')

const weightOf = (value: string | undefined) => (value === 'bold' ? 700 : value === 'normal' || value === undefined ? 400 : number(value, 400))

type Look = FontRequest & { size: number; decoration: string }

function lookOf(element: Element, parent: Look): Look {
  const family = own(element, 'font-family')
  const weight = own(element, 'font-weight')
  const style = own(element, 'font-style')
  const size = own(element, 'font-size')
  const decoration = own(element, 'text-decoration')
  return {
    family: family ? familyName(family) : parent.family,
    weight: weight ? weightOf(weight) : parent.weight,
    italic: style ? style === 'italic' || style === 'oblique' : parent.italic,
    size: size ? number(size, parent.size) : parent.size,
    decoration: decoration ?? parent.decoration,
  }
}

const sameFace = (a: FontRequest, b: FontRequest) => a.family === b.family && a.weight === b.weight && a.italic === b.italic

/** Every font face the SVG's text uses, each once, so they can be loaded before outlining. */
export function usedFonts(svg: string): FontRequest[] {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
  const faces: FontRequest[] = []
  const add = ({ family, weight, italic }: Look) => {
    if (!faces.some((face) => sameFace(face, { family, weight, italic }))) faces.push({ family, weight, italic })
  }
  for (const text of [...doc.getElementsByTagName('text')]) {
    const look = lookOf(text, { family: 'Inter', weight: 400, italic: false, size: 16, decoration: '' })
    const spans = [...text.getElementsByTagName('tspan')]
    if (spans.length === 0) add(look)
    for (const span of spans) add(lookOf(span, look))
  }
  return faces
}

function copyShapeAttributes(from: Element, to: Element): void {
  for (const { name, value } of [...from.attributes]) {
    if (!TEXT_ONLY.test(name) && name !== 'x' && name !== 'y' && name !== 'dx' && name !== 'dy') to.setAttribute(name, value)
  }
}

/** A thin bar under or through a piece of text, as path data. */
function bar(x: number, y: number, width: number, size: number, line: { offset: number; thickness: number }): string {
  const top = y + size * line.offset - (size * line.thickness) / 2
  const h = size * line.thickness
  const f = (n: number) => Number(n.toFixed(3))
  return `M${f(x)} ${f(top)}H${f(x + width)}V${f(top + h)}H${f(x)}Z`
}

/**
 * The SVG with every <text> replaced by a group of paths in the same place,
 * colour and size. `fonts` is either one list for all text, or a picker that
 * gives the fonts for each face.
 */
export function outlineText(svg: string, fonts: readonly Font[] | FontPicker): string {
  const pick: FontPicker = typeof fonts === 'function' ? fonts : () => fonts
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
  for (const text of [...doc.getElementsByTagName('text')]) {
    const group = doc.createElementNS(SVG_NS, 'g')
    copyShapeAttributes(text, group)
    const textLook = lookOf(text, { family: 'Inter', weight: 400, italic: false, size: 16, decoration: '' })
    const spans = [...text.getElementsByTagName('tspan')]
    const pieces = spans.length > 0 ? spans : [text]
    let x = number(text.getAttribute('x'))
    let y = number(text.getAttribute('y'))
    for (const piece of pieces) {
      const content = piece.textContent ?? ''
      const look = piece === text ? textLook : lookOf(piece, textLook)
      const faceFonts = pick(look)
      if (faceFonts.length === 0) throw new Error('No fonts to draw the text with')
      if (piece.hasAttribute('x')) x = number(piece.getAttribute('x'))
      if (piece.hasAttribute('y')) y = number(piece.getAttribute('y'))
      // Sub- and superscripts are moved off the line with dy.
      const baseline = y + number(piece.getAttribute('dy'))
      const width = textWidth(content, look.size, faceFonts)
      const parts = [textPathData(content, x, baseline, look.size, faceFonts)]
      if (content.trim() && look.decoration.includes('underline')) parts.push(bar(x, baseline, width, look.size, UNDERLINE))
      if (content.trim() && look.decoration.includes('line-through')) parts.push(bar(x, baseline, width, look.size, STRIKE))
      // A piece without an x carries on where the last one ended.
      x += width
      const d = parts.filter(Boolean).join(' ')
      if (!d) continue
      const path = doc.createElementNS(SVG_NS, 'path')
      if (piece !== text) copyShapeAttributes(piece, path)
      path.setAttribute('d', d)
      group.append(path)
    }
    text.replaceWith(group)
  }
  return new XMLSerializer().serializeToString(doc)
}
