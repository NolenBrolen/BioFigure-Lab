import { describe, expect, it } from 'vitest'

import { SHAPE_TEXT_PADDING, fitText, heightForText, innerBox, type Measure } from './shape-text'

/** One paragraph 300 px long in 20 px lines, wrapped at a width. */
const measure: Measure = (width) => (Number.isFinite(width) ? { width: Math.min(width, 300), height: Math.ceil(300 / width) * 20 } : { width: 300, height: 20 })

describe('fitting text in shapes', () => {
  it('"Shrink text" keeps the text on one line, drawn smaller, while it is above the smallest size', () => {
    const fitted = fitText('rectangle', 'shrink', measure, { width: 200, height: 60 }, 0.5)
    expect(fitted).toEqual({ width: 200, height: 60, scale: (200 - 2 * SHAPE_TEXT_PADDING) / 300 })
  })

  it('"Shrink text" wraps only at the smallest size, and makes the shape taller when the lines need it', () => {
    // 88 px of room: one line would need a scale under 0.5, so it wraps into two lines at 0.5.
    expect(fitText('rectangle', 'shrink', measure, { width: 100, height: 60 }, 0.5)).toEqual({ width: 100, height: 60, scale: 0.5 })
    expect(fitText('rectangle', 'shrink', measure, { width: 100, height: 20 }, 0.5)).toEqual({ width: 100, height: heightForText('rectangle', 20), scale: 0.5 })
  })

  it('"Grow shape" fits the longest line and every line, and never makes the shape smaller', () => {
    const fitted = fitText('rectangle', 'grow', measure, { width: 100, height: 100 }, 0.5)
    expect(innerBox('rectangle', fitted.width, fitted.height).width).toBeGreaterThanOrEqual(300)
    expect(fitted.height).toBe(100)
  })

  it('a shape made shorter by hand gets wider until its wrapped text fits, instead of springing back', () => {
    // Room for one 20 px line: the whole paragraph must fit on it.
    const oneLine = fitText('rectangle', 'wrap', measure, { width: 100, height: 40 }, 0.5, 'height')
    expect(oneLine.height).toBe(40)
    expect(innerBox('rectangle', oneLine.width, 40).width).toBeGreaterThanOrEqual(299)
    // Room for two lines: about half as wide.
    const twoLines = fitText('rectangle', 'wrap', measure, { width: 100, height: 60 }, 0.5, 'height')
    expect(twoLines.height).toBe(60)
    expect(twoLines.width).toBeGreaterThan(150)
    expect(twoLines.width).toBeLessThan(oneLine.width)
  })

  it('without a hand-set height, wrapped text makes the shape taller and keeps its width', () => {
    expect(fitText('rectangle', 'wrap', measure, { width: 100, height: 40 }, 0.5)).toEqual({ width: 100, height: heightForText('rectangle', 80), scale: 1 })
  })
})
