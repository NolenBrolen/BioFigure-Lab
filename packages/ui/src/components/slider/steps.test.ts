import { describe, expect, it } from 'vitest'

import { decimalsOf, keyboardValue, snap } from './steps'

const percent = { min: 0, max: 100, step: 1, largeStep: 10 }
const stroke = { min: 0, max: 10, step: 0.25, largeStep: 2.5 }

describe('slider steps', () => {
  it('counts the decimals of a step', () => {
    expect(decimalsOf(1)).toBe(0)
    expect(decimalsOf(0.25)).toBe(2)
    expect(decimalsOf(0.1)).toBe(1)
  })

  it('rounds a dragged position to the nearest step', () => {
    expect(snap(41.6, percent)).toBe(42)
    expect(snap(1.37, stroke)).toBe(1.25)
    expect(snap(1.38, stroke)).toBe(1.5)
  })

  it('keeps values inside min and max', () => {
    expect(snap(-3, percent)).toBe(0)
    expect(snap(140, percent)).toBe(100)
  })

  it('leaves no float noise', () => {
    expect(snap(0.1 + 0.2, { min: 0, max: 1, step: 0.1 })).toBe(0.3)
  })

  it('turns a tiny keyboard move into one step, a big one into a large step', () => {
    expect(keyboardValue(80, 80.05, percent)).toBe(81)
    expect(keyboardValue(80, 79.95, percent)).toBe(79)
    expect(keyboardValue(80, 90, percent)).toBe(90)
    expect(keyboardValue(1, 1.0125, stroke)).toBe(1.25)
  })

  it('goes straight to the ends for Home and End', () => {
    expect(keyboardValue(80, 0, percent)).toBe(0)
    expect(keyboardValue(80, 100, percent)).toBe(100)
  })
})
