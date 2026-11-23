import { describe, expect, it } from 'vitest'

import { placeAt, rubberBand, settleZoom } from './pinch-zoom'

describe('pinch zoom', () => {
  it('follows the fingers between the limits and gives with resistance past them', () => {
    expect(rubberBand(1.5, 1, 4)).toBe(1.5)
    // Pinching to half of fit only shrinks the page a little way.
    const below = rubberBand(0.5, 1, 4)
    expect(below).toBeLessThan(1)
    expect(below).toBeGreaterThan(0.5)
    const above = rubberBand(8, 1, 4)
    expect(above).toBeGreaterThan(4)
    expect(above).toBeLessThan(8)
  })

  it('springs to fit when let go below or near it, and back from past the largest zoom', () => {
    expect(settleZoom(0.8, 1, 4)).toBe(1)
    expect(settleZoom(1.08, 1, 4)).toBe(1)
    expect(settleZoom(1.5, 1, 4)).toBe(1.5)
    expect(settleZoom(5, 1, 4)).toBe(4)
  })

  it('keeps the point between the fingers under them while stretching', () => {
    const frame = { left: 10, top: 20 }
    const { x, y } = placeAt({ left: 200, top: 300 }, { left: 150, top: 250 }, frame, 2)
    // The frame stretched from its corner, then moved: the first point lands where the fingers are now.
    expect(frame.left + x + (150 - frame.left) * 2).toBe(200)
    expect(frame.top + y + (250 - frame.top) * 2).toBe(300)
  })
})
