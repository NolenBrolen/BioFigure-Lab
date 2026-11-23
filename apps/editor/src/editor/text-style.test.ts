// @vitest-environment jsdom
import '../test/canvas-stub'

import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

import { outlineText, usedFonts } from '@biofigure-lab/export/outline-text'
import { IText, util } from 'fabric'
import { parse } from 'opentype.js'
import { describe, expect, it } from 'vitest'

import { fontStack, fontByName } from './fonts'
import { SCRIPT_SCALE, applyTextStyle, insertSymbol, readTextStyle, textFaces, toggledScript } from './text-style'

const require = createRequire(import.meta.url)

/** A text box, as if being typed in with characters start to end selected. */
function typing(content: string, start: number, end: number): IText {
  const text = new IText(content, { fontSize: 20, fontFamily: fontStack(fontByName('Inter')!) })
  text.isEditing = true
  text.selectionStart = start
  text.selectionEnd = end
  return text
}

/** Save and open again, the way figures and undo do. */
const reload = async (text: IText) => (await util.enlivenObjects<IText>([JSON.parse(JSON.stringify(text.toObject()))]))[0]!

describe('subscript and superscript', () => {
  it('makes only the selected characters a subscript', () => {
    const text = typing('H2O', 1, 2)
    applyTextStyle(text, { script: 'sub' })
    const [h, two, o] = text.getSelectionStyles(0, 3, true)
    expect(two!.fontSize).toBeCloseTo(20 * SCRIPT_SCALE)
    expect(two!.deltaY).toBeGreaterThan(0)
    expect(h!.fontSize).toBe(20)
    expect(o!.deltaY ?? 0).toBe(0)
    expect(readTextStyle(text).script).toBe('sub')
  })

  it('puts a superscript above the line and switches it off on a second press', () => {
    const text = typing('Ca2+', 2, 4)
    applyTextStyle(text, { script: toggledScript(readTextStyle(text).script, 'super') })
    expect(text.getSelectionStyles(2, 4, true).every((char) => (char.deltaY as number) < 0)).toBe(true)
    applyTextStyle(text, { script: toggledScript(readTextStyle(text).script, 'super') })
    expect(text.getSelectionStyles(2, 4, true).every((char) => !char.deltaY && char.fontSize === 20)).toBe(true)
    // Nothing of its own is left on the characters.
    expect(JSON.stringify(text.toObject().styles)).toBe('[]')
  })

  it('keeps a subscript in proportion when the whole text gets bigger', () => {
    const text = typing('H2O', 1, 2)
    applyTextStyle(text, { script: 'sub' })
    text.isEditing = false
    applyTextStyle(text, { size: 40 })
    expect(text.getSelectionStyles(1, 2, true)[0]!.fontSize).toBeCloseTo(40 * SCRIPT_SCALE)
    expect(text.getSelectionStyles(0, 1, true)[0]!.fontSize).toBe(40)
  })

  it('survives saving and opening again', async () => {
    const text = typing('10-3', 2, 4)
    applyTextStyle(text, { script: 'super' })
    const again = await reload(text)
    again.isEditing = true
    again.selectionStart = 2
    again.selectionEnd = 4
    expect(readTextStyle(again)).toMatchObject({ script: 'super', size: 20 })
  })
})

describe('styling text', () => {
  it('makes selected characters italic without touching the rest', () => {
    const text = typing('lacZ gene', 0, 4)
    applyTextStyle(text, { italic: true })
    expect(text.getSelectionStyles(0, 1, true)[0]!.fontStyle).toBe('italic')
    expect(text.getSelectionStyles(5, 6, true)[0]!.fontStyle).toBe('normal')
  })

  it('styles the whole text when nothing is selected, clearing character overrides', () => {
    const text = typing('Label', 0, 2)
    applyTextStyle(text, { colour: '#dc2626' })
    text.isEditing = false
    applyTextStyle(text, { colour: '#2563eb', weight: 700, align: 'center' })
    expect(text.fill).toBe('#2563eb')
    expect(text.fontWeight).toBe(700)
    expect(text.textAlign).toBe('center')
    expect(text.getSelectionStyles(0, 1, true)[0]!.fill).toBe('#2563eb')
  })

  it('keeps the font after saving and opening again, and knows which faces to load', async () => {
    const text = typing('Figure 1', 0, 0)
    text.isEditing = false
    applyTextStyle(text, { font: 'Source Serif 4', weight: 600 })
    const again = await reload(text)
    expect(readTextStyle(again)).toMatchObject({ font: 'Source Serif 4', weight: 600 })
    expect(textFaces(again)).toEqual([{ font: 'Source Serif 4', weight: 600, italic: false }])
  })
})

describe('keyboard selection', () => {
  it('selects a whole word with Ctrl + Shift + Arrow, and letters with Shift + Arrow', () => {
    const text = typing('stained overnight', 17, 17)
    const key = (keyCode: number, extra: Partial<KeyboardEvent>) => ({ keyCode, shiftKey: true, ctrlKey: false, altKey: false, metaKey: false, preventDefault() {}, stopPropagation() {}, ...extra }) as unknown as KeyboardEvent
    text.moveCursorLeft(key(37, { ctrlKey: true }))
    expect(text.text.slice(text.selectionStart, text.selectionEnd)).toBe('overnight')
    text.moveCursorLeft(key(37, {}))
    expect(text.text.slice(text.selectionStart, text.selectionEnd)).toBe(' overnight')
  })
})

describe('symbols', () => {
  it('inserts at the cursor, replacing the selection, and moves the cursor after it', () => {
    const text = typing('5 m', 2, 2)
    insertSymbol(text, 'µ')
    expect(text.text).toBe('5 µm')
    expect(text.selectionStart).toBe(3)
    const replaced = typing('A -> B', 2, 4)
    insertSymbol(replaced, '→')
    expect(replaced.text).toBe('A → B')
  })

  it('takes the look of the character before it', () => {
    const text = typing('Ca2', 2, 3)
    applyTextStyle(text, { script: 'super' })
    text.selectionStart = 3
    text.selectionEnd = 3
    insertSymbol(text, '+')
    expect(text.getSelectionStyles(3, 4, true)[0]!.deltaY).toBeLessThan(0)
  })
})

describe('export', () => {
  /** Inter's files from the bundled package, standing in for every face. */
  const interFonts = () =>
    ['latin', 'greek'].map((subset) => {
      const bytes = readFileSync(require.resolve(`@fontsource/inter/files/inter-${subset}-400-normal.woff`))
      return parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
    })

  it('turns styled text into outlines, with each font face and the subscript kept', () => {
    const text = typing('H2O µm', 1, 2)
    applyTextStyle(text, { script: 'sub' })
    text.selectionStart = 4
    text.selectionEnd = 6
    applyTextStyle(text, { font: 'Source Serif 4', italic: true })
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">${text.toSVG()}</svg>`
    expect(usedFonts(svg)).toEqual([
      { family: 'Inter Variable', weight: 400, italic: false },
      { family: 'Source Serif 4', weight: 400, italic: true },
    ])
    const doc = new DOMParser().parseFromString(outlineText(svg, interFonts()), 'image/svg+xml')
    expect(doc.getElementsByTagName('text')).toHaveLength(0)
    const paths = [...doc.getElementsByTagName('path')].map((path) => path.getAttribute('d')!)
    const lowest = (d: string) => Math.max(...[...d.matchAll(/-?[\d.]+/g)].filter((_, i) => i % 2 === 1).map((m) => Number(m[0])))
    // "H", then the subscript "2" below the line, then the rest.
    expect(lowest(paths[1]!)).toBeGreaterThan(lowest(paths[0]!) + 2)
  })
})
