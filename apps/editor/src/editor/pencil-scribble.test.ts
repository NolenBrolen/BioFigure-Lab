// The Scribble style fills a shape with one back-and-forth stroke. When one path holds
// separate pieces (glucose's three bond wedges), the stroke must lift between them
// instead of drawing a long line across the icon.
import { util } from 'fabric'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

type Items = unknown[]
type Style = { id: string }
type Pencil = {
  render: (items: Items, style: Style, seed: number, paper: string, opts: { size: number }) => string
  STYLES: Style[]
}
type PencilSvg = { analyseSvg: (svg: string) => Items }

const root = join(import.meta.dirname, '..', '..', '..', '..')
const load = async <T>(file: string) => (await import(pathToFileURL(join(root, 'scripts', 'pencil', file)).href)) as T

// Glucose skeletal's three wedges, one filled path with three separate triangles.
const WEDGES = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><path d="M84.23 81.52L96.05 90.01L97.49 87.51L84.23 81.52ZM43.77 81.52L30.51 87.51L31.95 90.01L43.77 81.52ZM64 46.48L66.34 23.12L61.66 23.12L64 46.48Z" fill="#d55e00"/></svg>`

/** Each zigzag stroke as its list of points (one list per M). */
const runs = (d: string) => {
  const out: number[][][] = []
  for (const [cmd, x, y] of util.makePathSimpler(util.parsePath(d)) as [string, number, number][]) {
    if (cmd === 'M') out.push([[x, y]])
    else out.at(-1)!.push([x, y])
  }
  return out
}

describe('scribble fill', () => {
  it('never joins separate pieces of one shape with a stroke', async () => {
    const pencil = await load<Pencil>('pencil.js')
    const { analyseSvg } = await load<PencilSvg>('pencil-svg.js')
    const style = pencil.STYLES.find((s) => s.id === 'colour-scribble')!
    let checked = 0
    for (let seed = 1; seed <= 20; seed++) {
      const svg = pencil.render(analyseSvg(WEDGES), style, seed, '#ffffff', { size: 0 })
      // The zigzag fill is the only stroke drawn 1.5 wide.
      for (const [, d] of svg.matchAll(/<path d="([^"]+)"[^>]*stroke-width="1.5"/g)) {
        for (const run of runs(d!)) {
          // Points come in pairs, one pair per hatch line; neighbouring lines must overlap
          // along the hatch direction, or the stroke between them crosses empty paper.
          for (let k = 1; k + 2 < run.length; k += 2) {
            const [a, b, c, e] = [run[k - 1]!, run[k]!, run[k + 1]!, run[k + 2]!]
            const len = Math.hypot(b[0]! - a[0]!, b[1]! - a[1]!) || 1
            const along = (p: number[]) => ((p[0]! * (b[0]! - a[0]!)) + (p[1]! * (b[1]! - a[1]!))) / len
            const gap = Math.max(Math.min(along(c), along(e)) - Math.max(along(a), along(b)), Math.min(along(a), along(b)) - Math.max(along(c), along(e)))
            expect(gap).toBeLessThan(2)
            checked++
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(20)
  }, 30_000)
})
