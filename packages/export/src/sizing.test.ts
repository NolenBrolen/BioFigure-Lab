import { describe, expect, it } from 'vitest'

import { mmToPixels, pngSize } from './sizing'

describe('PNG size from mm and dpi', () => {
  it('turns one inch into exactly the dpi in pixels', () => {
    expect(mmToPixels(25.4, 300)).toBe(300)
    expect(mmToPixels(25.4, 600)).toBe(600)
    expect(mmToPixels(25.4, 1200)).toBe(1200)
  })

  it('sizes journal pages to whole pixels', () => {
    expect(pngSize({ width: 85, height: 60 }, 300)).toEqual({ width: 1004, height: 709 })
    expect(pngSize({ width: 174, height: 120 }, 600)).toEqual({ width: 4110, height: 2835 })
    expect(pngSize({ width: 174, height: 120 }, 1200)).toEqual({ width: 8220, height: 5669 })
  })
})
