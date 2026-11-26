import { describe, expect, it } from 'vitest'

import { pageMm, parseMarkup, parseSpec } from './figure-spec'

describe('text markup', () => {
  it('turns Ca^{2+} and H_{2}O into script runs, not look-alike characters', () => {
    expect(parseMarkup('Ca^{2+} and H_{2}O')).toEqual([
      { text: 'Ca' },
      { text: '2+', script: 'super' },
      { text: ' and H' },
      { text: '2', script: 'sub' },
      { text: 'O' },
    ])
  })

  it('marks italic and bold, and lets a backslash keep a plain asterisk', () => {
    expect(parseMarkup('*TP53* **up** \\*')).toEqual([{ text: 'TP53', italic: true }, { text: ' ' }, { text: 'up', bold: true }, { text: ' *' }])
  })

  it('lets a script take the italic around it, and complains about an unclosed mark', () => {
    expect(parseMarkup('*p^{53}*')).toEqual([{ text: 'p', italic: true }, { text: '53', italic: true, script: 'super' }])
    expect(() => parseMarkup('*p')).toThrow(/never closed/)
    expect(() => parseMarkup('Ca^{2+')).toThrow(/never closed/)
  })
})

describe('spec checks', () => {
  const box = { type: 'shape', kind: 'rounded', x: 0, y: 0, width: 10, height: 10 }

  it('names the object and suggests the right key for a typo', () => {
    expect(() => parseSpec({ name: 'a', objects: [{ ...box, id: 'one', fil: '#fff' }] })).toThrow(/objects\[0\] "one".*"fil".*"fill"/)
  })

  it('rejects an arrow pointing at an id that does not exist', () => {
    expect(() => parseSpec({ name: 'a', objects: [{ ...box, id: 'one' }, { type: 'arrow', from: 'one', to: 'tow' }] })).toThrow(/no object has that id.*"two"|no object has that id/)
  })

  it('knows the page presets in mm', () => {
    expect(pageMm('double')).toEqual({ width: 174, height: 120 })
    expect(pageMm({ preset: 'single', height: 90 })).toEqual({ width: 85, height: 90 })
    expect(() => pageMm('huge')).toThrow(/unknown preset/)
  })
})
