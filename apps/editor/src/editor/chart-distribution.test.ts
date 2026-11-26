import { describe, expect, it } from 'vitest'

import { beeswarm, boxStats, quantile, tint, violinProfile } from './chart-distribution'

describe('chart distribution', () => {
  it('finds quartiles between neighbouring values, by rank (n + 1)p', () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5)
    expect(boxStats([4, 1, 3, 2, 5])).toEqual({ min: 1, q1: 1.5, median: 3, q3: 4.5, max: 5 })
    expect(boxStats([])).toBeUndefined()
  })

  it('outlines a violin from the smallest to the largest value, widest where values crowd', () => {
    const profile = violinProfile([1, 1.1, 1.2, 1.1, 3])
    expect(profile[0]!.value).toBe(1)
    expect(profile.at(-1)!.value).toBe(3)
    const widest = profile.reduce((a, b) => (b.density > a.density ? b : a))
    expect(widest.value).toBeLessThan(1.6)
    expect(violinProfile([2, 2])).toEqual([{ value: 2, density: 1 }])
  })

  it('mixes a colour with white', () => {
    expect(tint('#000000', 0.5)).toBe('#808080')
    expect(tint('#0072b2', 0)).toBe('#0072b2')
    expect(tint('red', 0.5)).toBe('red')
  })

  it('places level dots side by side, staying within reach', () => {
    const offsets = beeswarm([50, 50, 50], 3, 20)
    expect(new Set(offsets).size).toBe(3)
    expect(offsets.every((o) => Math.abs(o) <= 20)).toBe(true)
  })
})
