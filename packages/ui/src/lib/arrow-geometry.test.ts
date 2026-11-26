import { describe, expect, it } from 'vitest'

import { ARROW_PRESETS, arrowBounds, arrowStrokes, autoBend, OPEN_SHAPES, SHAPES, drawArrow, routePoints, shapePath, type ArrowLook } from './arrow-geometry'

const look = (change: Partial<ArrowLook> = {}): ArrowLook => ({ route: 'straight', line: 'solid', start: 'none', end: 'none', mid: 'none', ...change })
const a = { x: 0, y: 0 }
const b = { x: 100, y: 0 }

describe('arrow geometry', () => {
  it('routes elbow arrows across, down and across again', () => {
    expect(routePoints(a, { x: 100, y: 40 }, 'elbow')).toEqual([a, { x: 50, y: 0 }, { x: 50, y: 40 }, { x: 100, y: 40 }])
  })

  it('routes U-shaped arrows down, across below both ends, and up into the end', () => {
    expect(routePoints(a, { x: 100, y: 20 }, 'u-shape')).toEqual([a, { x: 0, y: 40 }, { x: 100, y: 40 }, { x: 100, y: 20 }])
    expect(routePoints({ x: 0, y: 20 }, { x: 100, y: 0 }, 'u-shape')).toEqual([
      { x: 0, y: 20 },
      { x: 0, y: 40 },
      { x: 100, y: 40 },
      { x: 100, y: 0 },
    ])
    // Short arrows keep a deep-enough U for their ends, but never dip more than half the gap.
    expect(routePoints(a, { x: 40, y: 0 }, 'u-shape')).toEqual([a, { x: 0, y: 16 }, { x: 40, y: 16 }, { x: 40, y: 0 }])
    expect(routePoints(a, { x: 10, y: 0 }, 'u-shape')).toEqual([a, { x: 0, y: 5 }, { x: 10, y: 5 }, { x: 10, y: 0 }])
  })

  it('lets a U-shaped arrow leave from the side an end is attached to, and an elbow leave up or down', () => {
    const up = { x: 0, y: -1 }
    // Up from the start, across above both ends, and down into the end.
    expect(routePoints({ x: 0, y: 20 }, { x: 100, y: 0 }, 'u-shape', { start: up })).toEqual([{ x: 0, y: 20 }, { x: 0, y: -20 }, { x: 100, y: -20 }, { x: 100, y: 0 }])
    // Only the end has a side: it still decides the way the U goes.
    expect(routePoints(a, { x: 100, y: 0 }, 'u-shape', { end: up })[1]).toEqual({ x: 0, y: -20 })
    // Out to the right of both ends.
    expect(routePoints(a, { x: 0, y: 100 }, 'u-shape', { start: { x: 1, y: 0 } })).toEqual([a, { x: 20, y: 0 }, { x: 20, y: 100 }, { x: 0, y: 100 }])
    // Elbow: up/down first when the start faces up or down.
    expect(routePoints(a, { x: 100, y: 40 }, 'elbow', { start: up })).toEqual([a, { x: 0, y: 20 }, { x: 100, y: 20 }, { x: 100, y: 40 }])
    expect(routePoints(a, { x: 100, y: 40 }, 'elbow', { start: { x: 1, y: 0 } })).toEqual(routePoints(a, { x: 100, y: 40 }, 'elbow'))
  })

  it('starts and ends curved arrows exactly at their two ends', () => {
    const points = routePoints(a, b, 'curved')
    expect(points[0]).toEqual(a)
    expect(points.at(-1)).toEqual(b)
    expect(points.some((p) => Math.abs(p.y) > 5)).toBe(true)
  })

  it('softens the automatic bow on diagonals and keeps it on horizontal and vertical arrows', () => {
    expect(autoBend(a, b)).toBeCloseTo(0.2)
    expect(autoBend(a, { x: 0, y: 100 })).toBeCloseTo(0.2)
    expect(autoBend(a, { x: 100, y: 100 })).toBeCloseTo(0.08)
  })

  it('draws a bend of 0 as a straight line and a negative bend on the other side', () => {
    const straight = routePoints(a, b, 'curved', undefined, 0)
    expect(straight.every((p) => Math.abs(p.y) < 1e-9)).toBe(true)
    const side = (bend: number) => Math.sign(routePoints(a, b, 'curved', undefined, bend)[24]!.y)
    expect(side(0.2)).toBe(-side(-0.2))
    // No bend given is the automatic one, which for a horizontal arrow is the classic 0.2.
    expect(routePoints(a, b, 'curved')).toEqual(routePoints(a, b, 'curved', undefined, 0.2))
  })

  it('shortens the line under a filled head so it does not poke through the tip', () => {
    expect(drawArrow(a, b, look(), 2).shaft).toBe('M0 0 L100 0')
    expect(drawArrow(a, b, look({ end: 'filled' }), 2).shaft).not.toContain('L100 0')
  })

  it('gives dashed and dotted lines a dash pattern, solid lines none', () => {
    expect(drawArrow(a, b, look(), 2).dash).toBeUndefined()
    expect(drawArrow(a, b, look({ line: 'dashed' }), 2).dash).toHaveLength(2)
    expect(drawArrow(a, b, look({ line: 'dotted' }), 2).dash?.[0]).toBeLessThan(0.1)
  })

  it('draws something at the ends of every arrow end except "No head"', () => {
    for (const preset of ARROW_PRESETS) {
      const { parts } = drawArrow(a, b, look(preset), 2)
      expect(parts.length > 0, preset.id).toBe(preset.id !== 'line')
    }
  })
})

describe('shape outlines', () => {
  it('fills the box for every shape, closing all but the open ones', () => {
    for (const { id } of SHAPES) {
      const d = shapePath(id, 80, 40)
      expect(d, id).toMatch(/^M/)
      expect(d.trim().endsWith('Z'), id).toBe(!OPEN_SHAPES.has(id))
    }
  })
})

/** The points of a path written as M/L commands. */
const pointsOf = (d: string) => [...d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) }))
/** How long and wide a filled head is: from its tip back to its base, and across its base. */
function headOf(d: string) {
  const [tip, left, right] = pointsOf(d) as [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }]
  return { length: tip.x - left.x, width: Math.abs(left.y - right.y) }
}

describe('thick arrows (BIO-91)', () => {
  it('a longer arrow keeps its head; only the line gets longer', () => {
    const short = drawArrow({ x: 0, y: 0 }, { x: 300, y: 0 }, look({ end: 'filled' }), 40)
    const long = drawArrow({ x: 0, y: 0 }, { x: 900, y: 0 }, look({ end: 'filled' }), 40)
    expect(headOf(long.parts[0]!.d)).toEqual(headOf(short.parts[0]!.d))
  })

  it('thin arrows keep their usual heads, and a thick one gets a block arrow head from its width alone', () => {
    // 2 px: about the 8 px head arrows always had.
    expect(headOf(drawArrow(a, { x: 300, y: 0 }, look({ end: 'filled' }), 2).parts[0]!.d).length).toBeCloseTo(8.5)
    // 40 px: a head not much longer than the line is wide, and about twice as wide as the line.
    const block = headOf(drawArrow(a, { x: 600, y: 0 }, look({ end: 'filled' }), 40).parts[0]!.d)
    expect(block.length / 40).toBeGreaterThan(1.2)
    expect(block.length / 40).toBeLessThan(1.6)
    expect(block.width / 40).toBeGreaterThan(1.8)
    expect(block.width / 40).toBeLessThan(2.6)
  })

  it("a short arrow's heads never take more than 80% of its length", () => {
    expect(headOf(drawArrow(a, { x: 50, y: 0 }, look({ end: 'filled' }), 40).parts[0]!.d).length).toBeCloseTo(40)
    // Two heads share it.
    expect(headOf(drawArrow(a, { x: 50, y: 0 }, look({ start: 'filled', end: 'filled' }), 40).parts[1]!.d).length).toBeCloseTo(20)
  })

  it("a thick arrow's box fits it closely: the margin round it doesn't grow with the thickness", () => {
    const box = (width: number) => arrowBounds(a, { x: 600, y: 0 }, look({ end: 'filled' }), width)
    const head = (width: number) => headOf(drawArrow(a, { x: 600, y: 0 }, look({ end: 'filled' }), width).parts[0]!.d).width
    // The same room above and below the head at 2 px and at 40 px.
    expect(box(40).height - head(40)).toBeCloseTo(box(2).height - head(2), 0)
  })

  it('a solid line has flat ends, so a thick arrow has a square tail; dots and dashes stay round', () => {
    expect(drawArrow(a, b, look(), 20).cap).toBe('butt')
    expect(drawArrow(a, b, look({ line: 'dotted' }), 20).cap).toBe('round')
  })

  it('filled heads are solid shapes, not stroked, and the line ends inside them, also on a curve', () => {
    const drawing = drawArrow(a, { x: 400, y: 0 }, look({ end: 'filled', route: 'curved' }), 40)
    const strokes = arrowStrokes(drawing, 40)
    expect(strokes[1]).toMatchObject({ filled: true, width: 0 })
    const head = pointsOf(drawing.parts[0]!.d)
    const lineEnd = pointsOf(drawing.shaft).at(-1)!
    // The line's end is closer to the tip than the head's base is.
    const tip = head[0]!
    const base = { x: (head[1]!.x + head[2]!.x) / 2, y: (head[1]!.y + head[2]!.y) / 2 }
    expect(Math.hypot(lineEnd.x - tip.x, lineEnd.y - tip.y)).toBeLessThan(Math.hypot(base.x - tip.x, base.y - tip.y))
  })

  it('an outline is drawn first, wider by its width on each side, and goes round a flat tail', () => {
    const drawing = drawArrow(a, { x: 400, y: 0 }, look({ end: 'filled' }), 20, undefined, { outline: 3 })
    const strokes = arrowStrokes(drawing, 20, 3)
    expect(strokes.map((part) => part.role)).toEqual(['outline', 'outline', 'line', 'line'])
    expect(strokes[0]!.width).toBe(26)
    expect(strokes[2]!.width).toBe(20)
    // The head's outline is a 3 px band round it, with sharp corners.
    expect(strokes[1]).toMatchObject({ filled: true, width: 6, join: 'miter' })
    // The outline's line starts 3 px before the tail; the arrow's own line at it.
    expect(pointsOf(strokes[0]!.d)[0]).toEqual({ x: -3, y: 0 })
    expect(pointsOf(strokes[2]!.d)[0]).toEqual({ x: 0, y: 0 })
    expect(arrowStrokes(drawing, 20).map((part) => part.role)).toEqual(['line', 'line'])
  })
})
