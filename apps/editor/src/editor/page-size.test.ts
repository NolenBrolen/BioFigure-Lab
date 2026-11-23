import { describe, expect, it } from 'vitest'

import { sizeLabel } from './page-size'

describe('sizeLabel', () => {
  it('names each journal column preset like the canvas does', () => {
    expect(sizeLabel({ width: 85, height: 60 })).toBe('Single column · 85 × 60 mm')
    expect(sizeLabel({ width: 114, height: 80 })).toBe('1.5 column · 114 × 80 mm')
    expect(sizeLabel({ width: 174, height: 120 })).toBe('Double column · 174 × 120 mm')
  })

  it('names a custom size by the column it fits', () => {
    expect(sizeLabel({ width: 70, height: 70 })).toBe('Single column · 70 × 70 mm')
    expect(sizeLabel({ width: 130, height: 90 })).toBe('1.5 column · 130 × 90 mm')
  })

  it('says when a figure is wider than a journal page', () => {
    expect(sizeLabel({ width: 250, height: 150 })).toBe('Wider than a journal page · 250 × 150 mm')
  })
})
