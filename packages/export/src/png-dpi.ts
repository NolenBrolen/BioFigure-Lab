/*
 * A PNG from the browser carries no resolution, so Word or a journal's system
 * would treat a 300 dpi figure as 72 or 96 dpi and show it far too big. This
 * writes the resolution into the file (the PNG "pHYs" block).
 */

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

const SIGNATURE_LENGTH = 8
const IHDR_END = SIGNATURE_LENGTH + 4 + 4 + 13 + 4

/** The PNG with its resolution set to `dpi`, replacing any resolution it had. */
export function withPngDpi(png: Uint8Array, dpi: number): Uint8Array {
  const pixelsPerMetre = Math.round(dpi / 0.0254)
  const chunk = new Uint8Array(4 + 4 + 9 + 4)
  const view = new DataView(chunk.buffer)
  view.setUint32(0, 9)
  chunk.set([0x70, 0x48, 0x59, 0x73], 4) // "pHYs"
  view.setUint32(8, pixelsPerMetre)
  view.setUint32(12, pixelsPerMetre)
  chunk[16] = 1 // the unit is the metre
  view.setUint32(17, crc32(chunk.subarray(4, 17)))

  // Copy every block after the header except an old pHYs, and put ours right after the header.
  const parts: Uint8Array[] = [png.subarray(0, IHDR_END), chunk]
  const data = new DataView(png.buffer, png.byteOffset, png.byteLength)
  for (let at = IHDR_END; at < png.length; ) {
    const end = at + 12 + data.getUint32(at)
    const type = String.fromCharCode(...png.subarray(at + 4, at + 8))
    if (type !== 'pHYs') parts.push(png.subarray(at, end))
    at = end
  }
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

/** The resolution written in a PNG, in dpi, or undefined when it has none. */
export function readPngDpi(png: Uint8Array): number | undefined {
  const data = new DataView(png.buffer, png.byteOffset, png.byteLength)
  for (let at = SIGNATURE_LENGTH; at < png.length; ) {
    const length = data.getUint32(at)
    if (String.fromCharCode(...png.subarray(at + 4, at + 8)) === 'pHYs') {
      return png[at + 16] === 1 ? Math.round(data.getUint32(at + 8) * 0.0254) : undefined
    }
    at += 12 + length
  }
  return undefined
}
