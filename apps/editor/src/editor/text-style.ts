/*
 * Styling text: reading and changing the look of a text box, or of the
 * characters selected while typing in it.
 *
 * While typing with some characters selected, a change applies to those
 * characters only. Otherwise it applies to the whole text: the text box gets
 * the new value and the characters lose their own, so the whole text matches.
 * Alignment and spacing always apply to the whole text.
 *
 * Sub- and superscript characters are smaller and moved off the line. They
 * remember which they are (`script`), so they can be switched back, and they
 * keep their place when the text size changes.
 *
 * Bold is a setting of its own, apart from the weight: bold text is drawn
 * heavier than its weight (Regular becomes Bold), and the weight stays what
 * was picked. Bold text keeps that picked weight as `baseWeight`, next to
 * Fabric's `fontWeight`, which is the weight it is drawn at.
 */
import { SCRIPT_SCALE, SCRIPT_SHIFT, type Script } from '@biofigure-lab/ui/lib/script-runs'
import { IText, type TextStyleDeclaration } from 'fabric'

import { fontByName, fontOf, fontStack, nearestWeight } from './fonts'

/*
 * While typing, Ctrl+Arrow jumps a word and Ctrl+Shift+Arrow selects one, as
 * in other Windows and Linux programs. Fabric only knows the Mac's Alt+Arrow.
 */
// Kept to call with the text as `this` below.
// eslint-disable-next-line @typescript-eslint/unbound-method
const fabricMove = IText.prototype._move
IText.prototype._move = function (this: IText, event, prop, direction) {
  const wordKey = event.altKey || (event.ctrlKey && !event.metaKey)
  return fabricMove.call(this, { altKey: wordKey, metaKey: event.metaKey, keyCode: event.keyCode } as KeyboardEvent, prop, direction)
}

export type { Script }
export type TextAlign = 'left' | 'center' | 'right' | 'justify'

export type TextStyle = {
  /** The font's name, e.g. "Source Serif 4". */
  font: string
  /** The weight picked; bold text is drawn heavier than this. */
  weight: number
  bold: boolean
  italic: boolean
  underline: boolean
  strikethrough: boolean
  script: Script
  /** In page pixels; for sub- and superscripts, the size of the text they sit in. */
  size: number
  /** #rrggbb */
  colour: string
  /** #rrggbb, or '' for none. */
  highlight: string
  align: TextAlign
  /** Times the font size. */
  lineSpacing: number
  /** Thousandths of the font size, like Fabric's charSpacing. */
  letterSpacing: number
}

/** What a new text box looks like before anything is changed. */
export const DEFAULT_TEXT_STYLE: TextStyle = {
  font: 'Inter',
  weight: 400,
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  script: 'none',
  size: 16,
  colour: '#1f2937',
  highlight: '',
  align: 'left',
  lineSpacing: 1.16,
  letterSpacing: 0,
}

export { SCRIPT_SCALE }

type CharStyle = TextStyleDeclaration & { script?: Exclude<Script, 'none'>; baseWeight?: number }
type WithBase = { baseWeight?: number }

/** The weight bold text is drawn at: three steps heavier, at least Bold. */
export const boldWeight = (weight: number): number => Math.min(900, Math.max(700, weight + 300))

/** The weight a look is drawn at. */
export const drawnWeight = (style: Pick<TextStyle, 'weight' | 'bold'>): number => nearestWeight(style.bold ? boldWeight(style.weight) : style.weight)

/** Fabric's weight and our picked weight for a weight and bold setting. */
const weightLook = (weight: number, bold: boolean) => ({ fontWeight: drawnWeight({ weight, bold }), baseWeight: bold ? weight : undefined })

const PARAGRAPH = ['align', 'lineSpacing', 'letterSpacing'] as const

/** Our names for the parts of a character's look Fabric keeps. */
const CHAR_PROPS = {
  font: 'fontFamily',
  italic: 'fontStyle',
  underline: 'underline',
  strikethrough: 'linethrough',
  colour: 'fill',
  highlight: 'textBackgroundColor',
} as const

const weightOf = (value: unknown): number => (value === 'bold' ? 700 : typeof value === 'number' ? value : Number.parseInt(String(value), 10) || 400)

const hex = (value: unknown): string => (typeof value === 'string' ? value : '')

/** The range a change applies to: the selected characters while typing, else the whole text. */
function range(text: IText): { start: number; end: number; whole: boolean } {
  const length = text.text.length
  if (text.isEditing && text.selectionStart !== text.selectionEnd) {
    return { start: text.selectionStart, end: text.selectionEnd, whole: text.selectionStart === 0 && text.selectionEnd === length }
  }
  return { start: 0, end: length, whole: true }
}

/** The look of each character in a range, with what it gets from the text box filled in. */
const charsIn = (text: IText, start: number, end: number): CharStyle[] =>
  end > start ? (text.getSelectionStyles(start, end, true)) : [text.getStyleAtPosition(Math.max(0, start - 1), true)]

/** A character's size without its sub- or superscript shrinking. */
const baseSize = (char: CharStyle, fallback: number) => (char.script ? (char.fontSize ?? fallback) / SCRIPT_SCALE : (char.fontSize ?? fallback))

/** The look the panels show: of the selected characters while typing (the first one where they differ), else of the whole text. */
export function readTextStyle(text: IText): TextStyle {
  const { start, end } = range(text)
  const chars = charsIn(text, start, end)
  const first = chars[0] ?? {}
  // The picked weight of the first character: its own when it has its own weight, else the text's.
  const own = text.getStyleAtPosition(end > start ? start : Math.max(0, start - 1)) as CharStyle
  const base = own.fontWeight !== undefined ? own.baseWeight : (text as IText & WithBase).baseWeight
  const script = chars.every((char) => char.script === first.script) ? (first.script ?? 'none') : 'none'
  return {
    font: fontOf(first.fontFamily ?? text.fontFamily).name,
    weight: base ?? weightOf(first.fontWeight ?? text.fontWeight),
    bold: base !== undefined,
    italic: (first.fontStyle ?? text.fontStyle) === 'italic',
    underline: Boolean(first.underline ?? text.underline),
    strikethrough: Boolean(first.linethrough ?? text.linethrough),
    script,
    size: Math.round(baseSize(first, text.fontSize) * 100) / 100,
    colour: hex(first.fill ?? text.fill),
    highlight: hex(first.textBackgroundColor ?? text.textBackgroundColor),
    align: (['left', 'center', 'right', 'justify'] as const).find((align) => align === text.textAlign) ?? 'left',
    lineSpacing: text.lineHeight,
    letterSpacing: text.charSpacing,
  }
}

/** Fabric's value for one of our character properties. */
function fabricValue(key: keyof typeof CHAR_PROPS, value: TextStyle[keyof typeof CHAR_PROPS]): unknown {
  if (key === 'font') return fontStack(fontByName(value as string) ?? fontOf(undefined))
  if (key === 'italic') return value ? 'italic' : 'normal'
  return value
}

/** The size and shift of a character at a size, as plain text or a sub- or superscript. */
export const scriptLook = (script: Script, size: number): CharStyle =>
  script === 'none' ? { fontSize: size, deltaY: 0, script: undefined } : { fontSize: size * SCRIPT_SCALE, deltaY: size * SCRIPT_SHIFT[script], script }

/** Remove the given properties from every character's own look. */
function clearChars(text: IText, props: readonly string[]): void {
  for (const line of Object.values(text.styles)) {
    for (const [index, char] of Object.entries(line)) {
      const own = char as Record<string, unknown>
      for (const prop of props) delete own[prop]
      if (Object.keys(own).length === 0) delete line[Number(index)]
    }
  }
}

/**
 * Change the look of the text (or its selected characters). `only` names the
 * characters to change instead (for text that isn't being typed in).
 */
export function applyTextStyle(text: IText, change: Partial<TextStyle>, only?: { start: number; end: number }): void {
  const { start, end, whole } = only ? { ...only, whole: only.start === 0 && only.end === text.text.length } : range(text)
  for (const key of PARAGRAPH) {
    const value = change[key]
    if (value === undefined) continue
    text.set(key === 'align' ? { textAlign: value } : key === 'lineSpacing' ? { lineHeight: value } : { charSpacing: value })
  }

  const charChange: Record<string, unknown> = {}
  for (const key of Object.keys(CHAR_PROPS) as (keyof typeof CHAR_PROPS)[]) {
    if (change[key] !== undefined) charChange[CHAR_PROPS[key]] = fabricValue(key, change[key])
  }
  if (Object.keys(charChange).length > 0) {
    if (whole) {
      text.set(charChange)
      clearChars(text, Object.keys(charChange))
    } else {
      text.setSelectionStyles(charChange, start, end)
    }
  }

  if (change.weight !== undefined || change.bold !== undefined) changeWeight(text, change, start, end, whole)

  if (change.size !== undefined || change.script !== undefined) {
    if (whole && change.size !== undefined) {
      // Scripts keep their place relative to the new size.
      const ratio = change.size / text.fontSize
      text.set({ fontSize: change.size })
      for (const line of Object.values(text.styles)) {
        for (const char of Object.values(line) as CharStyle[]) {
          if (char.script) Object.assign(char, scriptLook(char.script, (char.fontSize ?? 0) / SCRIPT_SCALE * ratio))
          else delete char.fontSize
        }
      }
    }
    if (change.script !== undefined || !whole) {
      const chars = charsIn(text, start, end)
      for (let i = start; i < end; i++) {
        const char = chars.at(i - start) ?? {}
        const size = change.size ?? baseSize(char, text.fontSize)
        const script = change.script ?? char.script ?? 'none'
        const look = scriptLook(script, size)
        // Plain text at the text box's own size needs no size of its own.
        text.setSelectionStyles(look, i, i + 1)
        if (script === 'none') clearOne(text, i, ['script', ...(size === text.fontSize ? ['fontSize'] : []), 'deltaY'])
      }
    }
  }
  text.initDimensions()
  text.setCoords()
  text.set('dirty', true)
}

/**
 * Change the weight or bold setting. Each character keeps what wasn't
 * changed: making text bold keeps every character's own weight.
 */
function changeWeight(text: IText, change: Partial<TextStyle>, start: number, end: number, whole: boolean): void {
  const next = (fontWeight: unknown, base: number | undefined) =>
    weightLook(change.weight ?? base ?? weightOf(fontWeight), change.bold ?? base !== undefined)
  if (whole) {
    const box = text as IText & WithBase
    text.set(next(text.fontWeight, box.baseWeight))
    for (const line of Object.values(text.styles)) {
      for (const char of Object.values(line) as CharStyle[]) {
        if (char.fontWeight === undefined) continue
        // A new weight goes on the whole text; bold alone keeps each character's own weight.
        if (change.weight !== undefined) {
          delete char.fontWeight
          delete char.baseWeight
        } else Object.assign(char, next(char.fontWeight, char.baseWeight))
        if (char.baseWeight === undefined) delete char.baseWeight
      }
    }
    if (box.baseWeight === undefined) delete box.baseWeight
    return
  }
  for (let i = start; i < end; i++) {
    const own = text.getStyleAtPosition(i) as CharStyle
    const mine = own.fontWeight !== undefined
    const look = next(mine ? own.fontWeight : text.fontWeight, mine ? own.baseWeight : (text as IText & WithBase).baseWeight)
    text.setSelectionStyles(look, i, i + 1)
    if (look.baseWeight === undefined) clearOne(text, i, ['baseWeight'])
  }
}

function clearOne(text: IText, index: number, props: readonly string[]): void {
  const { lineIndex, charIndex } = text.get2DCursorLocation(index, true)
  const line = text.styles[lineIndex]
  const own = line?.[charIndex] as Record<string, unknown> | undefined
  if (!line || !own) return
  for (const prop of props) delete own[prop]
  if (Object.keys(own).length === 0) delete line[charIndex]
}

/** The script a button press sets: switching a sub- or superscript that's already on turns it off. */
export const toggledScript = (current: Script, pressed: Exclude<Script, 'none'>): Script => (current === pressed ? 'none' : pressed)

/**
 * Put a symbol where the text cursor is, replacing any selected characters,
 * and move the cursor after it. Not typing: it goes at the end of the text.
 * It takes the look of the character before it, like typed text.
 */
export function insertSymbol(text: IText, symbol: string): void {
  const start = text.isEditing ? text.selectionStart : text.text.length
  const end = text.isEditing ? text.selectionEnd : start
  const style = start > 0 ? [{ ...text.getStyleAtPosition(start - 1) }] : undefined
  text.insertChars(symbol, style ? [...symbol].map(() => ({ ...style[0] })) : undefined, start, end)
  const after = start + symbol.length
  text.selectionStart = after
  text.selectionEnd = after
  text.initDimensions()
  text.setCoords()
  text.set('dirty', true)
  if (text.isEditing && text.hiddenTextarea) {
    // Keep Fabric's hidden typing field in step, or the next key press undoes this.
    text.hiddenTextarea.value = text.text
    text._updateTextarea()
  }
}

/** What a preview can change, kept so it can be put back. */
export type TextSnapshot = { props: Record<string, unknown>; styles: IText['styles'] }

const SNAPSHOT_PROPS = ['fontFamily', 'fontWeight', 'baseWeight', 'fontStyle', 'fontSize', 'underline', 'linethrough', 'fill', 'textBackgroundColor', 'textAlign', 'lineHeight', 'charSpacing'] as const

export function snapshotText(text: IText): TextSnapshot {
  return { props: Object.fromEntries(SNAPSHOT_PROPS.map((prop) => [prop, text.get(prop)])), styles: structuredClone(text.styles) }
}

/** Put a text back the way a snapshot found it (after a preview). */
export function restoreText(text: IText, snapshot: TextSnapshot): void {
  text.set({ ...snapshot.props, styles: structuredClone(snapshot.styles) })
  text.initDimensions()
  text.setCoords()
  text.set('dirty', true)
}

/** The font faces a text uses, for loading them before it's drawn. */
export function textFaces(text: IText): { font: string; weight: number; italic: boolean }[] {
  const faces = new Map<string, { font: string; weight: number; italic: boolean }>()
  const add = (family: string | undefined, weight: unknown, style: unknown) => {
    const face = { font: fontOf(family ?? text.fontFamily).name, weight: weightOf(weight ?? text.fontWeight), italic: (style ?? text.fontStyle) === 'italic' }
    faces.set(`${face.font}/${face.weight}/${face.italic}`, face)
  }
  add(undefined, undefined, undefined)
  for (const line of Object.values(text.styles)) for (const char of Object.values(line) as CharStyle[]) add(char.fontFamily, char.fontWeight, char.fontStyle)
  return [...faces.values()]
}
