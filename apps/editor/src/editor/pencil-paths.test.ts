// Pencil icons are written in a compact path notation (relative commands, no leading
// zeros) to keep the files small. Fabric must read it back to the same points as the
// full notation, or the drawing would shift on the canvas.
import { util } from 'fabric'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

type Items = unknown[]
type Pencil = {
  compactD: (d: string) => string
  render: (items: Items, style: unknown, seed: number, paper: string, opts: { size: number }) => string
  STYLES: unknown[]
}
type PencilSvg = { analyseSvg: (svg: string, opts?: { mosaic?: boolean }) => Items }

const root = join(import.meta.dirname, '..', '..', '..', '..')
const load = async <T>(file: string) => (await import(pathToFileURL(join(root, 'scripts', 'pencil', file)).href)) as T

/** Every point of a path as Fabric reads it, in absolute coordinates. */
const points = (d: string) => util.makePathSimpler(util.parsePath(d)).flatMap((command) => command.slice(1) as number[])

describe('compact pencil paths', () => {
  it('read back in Fabric to the same points as the full notation', async () => {
    const pencil = await load<Pencil>('pencil.js')
    const { analyseSvg } = await load<PencilSvg>('pencil-svg.js')
    const items = analyseSvg(readFileSync(join(import.meta.dirname, '..', 'test', 'fixtures', 'test-cell.svg'), 'utf8'))
    let checked = 0
    for (const style of pencil.STYLES) {
      // Size level 0 writes absolute M, L, Q and Z commands, the notation compactD shortens.
      const full = pencil.render(items, style, 1, '#ffffff', { size: 0 })
      for (const [, d] of full.matchAll(/ d="([^"]+)"/g)) {
        const want = points(d!)
        const got = points(pencil.compactD(d!))
        expect(got).toHaveLength(want.length)
        got.forEach((value, i) => expect(value).toBeCloseTo(want[i]!, 3))
        checked++
      }
    }
    expect(checked).toBeGreaterThan(50)
    // Loads Fabric and renders every pencil style: under 1 s alone, but it can pass 5 s
    // when the full check runs all test files in parallel.
  }, 30_000)
})
