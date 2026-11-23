import { describe, expect, it } from 'vitest'

import { readPngDpi, withPngDpi } from './png-dpi'

/** A PNG block: length, type, data, checksum (the checksum isn't checked here). */
function chunk(type: string, data: number[]): number[] {
  const length = data.length
  return [length >>> 24, (length >>> 16) & 255, (length >>> 8) & 255, length & 255, ...[...type].map((c) => c.charCodeAt(0)), ...data, 0, 0, 0, 0]
}
const fakePng = () =>
  new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, ...chunk('IHDR', Array<number>(13).fill(0)), ...chunk('IDAT', [1, 2, 3]), ...chunk('IEND', [])])

describe('PNG resolution', () => {
  it('writes the dpi into the file', () => {
    expect(readPngDpi(fakePng())).toBeUndefined()
    expect(readPngDpi(withPngDpi(fakePng(), 600))).toBe(600)
  })

  it('replaces a resolution that is already there', () => {
    const png = withPngDpi(withPngDpi(fakePng(), 300), 1200)
    expect(readPngDpi(png)).toBe(1200)
    expect(png.length).toBe(withPngDpi(fakePng(), 300).length)
  })
})
