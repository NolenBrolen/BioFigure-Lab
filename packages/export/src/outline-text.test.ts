// @vitest-environment jsdom
import { parse } from 'opentype.js'
import { describe, expect, it } from 'vitest'

import { outlineText, usedFonts, type FontRequest } from './outline-text'
import { FIGURE_SVG, loadTestFonts } from './test/fonts'

const fonts = async () => (await loadTestFonts()).map((buffer) => parse(buffer))
const read = (svg: string) => new DOMParser().parseFromString(svg, 'image/svg+xml')

describe('text to outlines', () => {
  it('replaces every text with paths, keeping place and colour', async () => {
    const doc = read(outlineText(FIGURE_SVG, await fonts()))
    expect(doc.getElementsByTagName('text')).toHaveLength(0)
    const group = doc.querySelector('g[transform="matrix(1 0 0 1 300 200)"] > g')!
    expect(group.getAttribute('style')).toContain('fill: rgb(220,38,38)')
    expect(group.hasAttribute('font-family')).toBe(false)
    const paths = [...group.getElementsByTagName('path')]
    expect(paths).toHaveLength(2)
    expect(paths[0]!.getAttribute('d')).toMatch(/^M-?\d/)
    expect(paths[1]!.getAttribute('style')).toContain('fill: rgb(0,0,0)')
  })

  it('draws Greek letters with the font that has them', async () => {
    const [latin, greek] = await fonts()
    const latinOnly = read(outlineText(FIGURE_SVG, [latin!])).getElementsByTagName('path')[0]!.getAttribute('d')!
    const withGreek = read(outlineText(FIGURE_SVG, [latin!, greek!])).getElementsByTagName('path')[0]!.getAttribute('d')!
    expect(withGreek).not.toBe(latinOnly)
  })

  it('leaves the shapes alone', async () => {
    const doc = read(outlineText(FIGURE_SVG, await fonts()))
    expect(doc.getElementsByTagName('rect')).toHaveLength(1)
  })
})

/** Styled text the way Fabric writes it: H₂O in a serif with a subscript, then italic and underlined pieces. */
const STYLED_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200">
<g transform="matrix(1 0 0 1 200 100)">
<text xml:space="preserve" font-family="'Source Serif 4', 'Inter Variable', serif" font-size="20" font-style="normal" font-weight="400" style="fill: rgb(0,0,0);"><tspan x="-50" y="6">H</tspan><tspan x="-36" y="6" dy="5" style="font-size: 12px; ">2</tspan><tspan x="-29" y="6">O </tspan><tspan x="-5" y="6" style="font-family: 'Inter Variable'; font-style: italic; font-weight: 700; ">lacZ</tspan><tspan x="40" y="6" style="text-decoration: underline; ">u</tspan></text>
</g>
</svg>`

describe('styled text to outlines', () => {
  it('lists each font face the text uses once', () => {
    expect(usedFonts(STYLED_SVG)).toEqual([
      { family: 'Source Serif 4', weight: 400, italic: false },
      { family: 'Inter Variable', weight: 700, italic: true },
    ])
  })

  it('draws each piece with the fonts for its own face', async () => {
    const asked: FontRequest[] = []
    const list = await fonts()
    outlineText(STYLED_SVG, (face) => (asked.push(face), list))
    expect(asked).toContainEqual({ family: 'Inter Variable', weight: 700, italic: true, size: 20, decoration: '' })
    expect(asked).toContainEqual(expect.objectContaining({ family: 'Source Serif 4', size: 12 }))
  })

  it('keeps a subscript smaller and below the line', async () => {
    const paths = [...read(outlineText(STYLED_SVG, await fonts())).getElementsByTagName('path')]
    const lowest = (d: string) => Math.max(...[...d.matchAll(/-?[\d.]+/g)].filter((_, i) => i % 2 === 1).map((m) => Number(m[0])))
    const [h, two] = paths.map((path) => path.getAttribute('d')!)
    // The baseline of "H" is y 6; the "2" sits 5 lower.
    expect(lowest(h!)).toBeCloseTo(6, 0)
    expect(lowest(two!)).toBeGreaterThan(9)
  })

  it('draws underlines as a bar under the text', async () => {
    const paths = [...read(outlineText(STYLED_SVG, await fonts())).getElementsByTagName('path')]
    const underlined = paths.at(-1)!.getAttribute('d')!
    const plain = paths.at(-2)!.getAttribute('d')!
    expect(underlined).toMatch(/H[\d.-]+V[\d.-]+H[\d.-]+Z$/)
    expect(plain).not.toMatch(/Z$/)
  })
})
