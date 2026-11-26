import { drawArrow } from '@biofigure-lab/ui/lib/arrow-geometry'
import { describe, expect, it } from 'vitest'

import { ANCHOR_GAP, ATTACH_GAP, arrowSvg, attachTargetAt, edgePoint, followEnds, sidePoint, straighten, type Frame } from './connectors'

/** A 40 × 20 box (or ellipse) centred at (x, y), optionally turned by 90°. */
const box = (x: number, y: number, { round = false, turned = false } = {}): Frame => ({
  matrix: turned ? [0, 1, -1, 0, x, y] : [1, 0, 0, 1, x, y],
  width: 40,
  height: 20,
  round,
})

describe('arrows stuck to objects', () => {
  it('ends on the edge of a box, facing the other end, a small gap away', () => {
    expect(edgePoint(box(0, 0), { x: 100, y: 0 })).toEqual({ x: 20 + ATTACH_GAP, y: 0 })
    expect(edgePoint(box(0, 0), { x: 0, y: -100 })).toEqual({ x: 0, y: -10 - ATTACH_GAP })
  })

  it('follows round and turned objects', () => {
    const round = edgePoint(box(0, 0, { round: true }), { x: 100, y: 100 }, 0)
    expect((round.x / 20) ** 2 + (round.y / 10) ** 2).toBeCloseTo(1)
    // Turned on its side, the 40-wide box is 40 high.
    expect(edgePoint(box(0, 0, { turned: true }), { x: 0, y: 100 }, 0).y).toBeCloseTo(20)
  })

  it('moves the stuck ends when their objects move, and leaves loose ends alone', () => {
    const frames: Record<string, Frame> = { a: box(0, 0), b: box(200, 0) }
    const ends = [{ point: { x: 0, y: 0 }, attach: 'a' }, { point: { x: 0, y: 0 }, attach: 'b' }] as const
    expect(followEnds(ends, (id) => frames[id])).toEqual([{ x: 20 + ATTACH_GAP, y: 0 }, { x: 180 - ATTACH_GAP, y: 0 }])
    frames.b = box(0, 200)
    expect(followEnds(ends, (id) => frames[id])).toEqual([{ x: 0, y: 10 + ATTACH_GAP }, { x: 0, y: 190 - ATTACH_GAP }])
    expect(followEnds([ends[0], { point: { x: 300, y: 0 } }], (id) => frames[id])[1]).toEqual({ x: 300, y: 0 })
  })

  it('with a down direction, puts stuck ends on the bottom of their objects, straight below the centre', () => {
    const frames: Record<string, Frame> = { a: box(0, 0), b: box(200, 50) }
    const ends = [{ point: { x: 0, y: 0 }, attach: 'a' }, { point: { x: 0, y: 0 }, attach: 'b' }] as const
    const down = { x: 0, y: 1 }
    expect(followEnds(ends, (id) => frames[id], down)).toEqual([{ x: 0, y: 10 + ATTACH_GAP }, { x: 200, y: 60 + ATTACH_GAP }])
    // A loose end stays where it is.
    expect(followEnds([ends[0], { point: { x: 300, y: 0 } }], (id) => frames[id], down)[1]).toEqual({ x: 300, y: 0 })
    // Turned a quarter turn, the arrow's down is page-left.
    const [first] = followEnds(ends, (id) => frames[id], { x: -1, y: 0 })
    expect(first.x).toBeCloseTo(-20 - ATTACH_GAP)
    expect(first.y).toBeCloseTo(0)
  })

  it('keeps an end where it was when its object is deleted', () => {
    expect(followEnds([{ point: { x: 5, y: 6 }, attach: 'gone' }, { point: { x: 50, y: 6 } }], () => undefined)).toEqual([{ x: 5, y: 6 }, { x: 50, y: 6 }])
  })

  it('sticks to the topmost object under the point', () => {
    const candidates = [{ id: 'under', frame: box(0, 0) }, { id: 'over', frame: box(10, 0) }]
    expect(attachTargetAt({ x: 5, y: 0 }, candidates)).toBe('over')
    expect(attachTargetAt({ x: -15, y: 0 }, candidates)).toBe('under')
    expect(attachTargetAt({ x: 0, y: 50 }, candidates)).toBeUndefined()
  })
})

describe('arrows stuck to a side', () => {
  it('sidePoint is the middle of a side, pushed out by the gap, on a plain, a turned and a round object', () => {
    expect(sidePoint(box(100, 50), 'right')).toEqual({ x: 120 + ANCHOR_GAP, y: 50 })
    expect(sidePoint(box(100, 50), 'top', 0)).toEqual({ x: 100, y: 40 })
    // Turned a quarter turn, the box's own top faces page-right, and its own right faces down.
    const turned = sidePoint(box(0, 0, { turned: true }), 'top')
    expect(turned.x).toBeCloseTo(10 + ANCHOR_GAP)
    expect(turned.y).toBeCloseTo(0)
    expect(sidePoint(box(0, 0, { turned: true }), 'right').y).toBeCloseTo(20 + ANCHOR_GAP)
    // Round: the side middle is on the ellipse. Scaled: the gap is still in page pixels.
    const round = sidePoint({ matrix: [2, 0, 0, 1, 0, 0], width: 40, height: 20, round: true }, 'left', 5)
    expect(round.x).toBeCloseTo(-40 - 5)
    expect(round.y).toBeCloseTo(0)
  })

  it('puts an end with a side on that side, and still follows the other end when there is none', () => {
    const frames: Record<string, Frame> = { a: box(0, 0), b: box(200, 0) }
    const loose = { point: { x: 0, y: 0 } }
    const withSide = followEnds([{ ...loose, attach: 'a', side: 'top' }, { ...loose, attach: 'b' }], (id) => frames[id])
    expect(withSide[0]).toEqual({ x: 0, y: -10 - ANCHOR_GAP })
    expect(withSide[1]).toEqual({ x: 180 - ATTACH_GAP, y: 0 })
    // A side wins over a U-shaped arrow's down.
    expect(followEnds([{ ...loose, attach: 'a', side: 'left' }, { ...loose, attach: 'b' }], (id) => frames[id], { x: 0, y: 1 })[0]).toEqual({ x: -20 - ANCHOR_GAP, y: 0 })
  })
})

describe('straightening arrows drawn by hand (BIO-91)', () => {
  const from = { x: 100, y: 100 }
  it('puts a nearly level, upright or 45° end exactly on that line', () => {
    // 3° off level, either way.
    expect(straighten(from, { x: 300, y: 110 }).point).toEqual({ x: 300, y: 100 })
    expect(straighten(from, { x: -100, y: 90 }).point).toEqual({ x: -100, y: 100 })
    expect(straighten(from, { x: 108, y: 300 }).point).toEqual({ x: 100, y: 300 })
    const diagonal = straighten(from, { x: 300, y: 290 }).point
    expect(diagonal.x - from.x).toBeCloseTo(diagonal.y - from.y)
  })

  it('leaves an end that is clearly at another angle where it is', () => {
    expect(straighten(from, { x: 300, y: 140 })).toEqual({ point: { x: 300, y: 140 } })
  })
})

describe('arrow export', () => {
  it('writes arrows as plain SVG paths, so they stay vector in SVG and PDF', () => {
    const drawing = drawArrow({ x: 0, y: 0 }, { x: 100, y: 0 }, { route: 'curved', line: 'dashed', start: 'half', end: 'inhibition', mid: 'none' }, 2)
    const svg = arrowSvg(drawing, { stroke: '#123456', strokeWidth: 2 }).join('')
    expect(svg).not.toMatch(/<image|data:/)
    expect(svg.match(/<path /g)).toHaveLength(3)
    expect(svg).toContain('stroke-dasharray="6 5"')
    // The half head is filled with the line colour.
    expect(svg).toContain('fill="#123456"')
  })

  it('exports an arrow\'s outline under it, in the outline colour, with sharp head corners kept', () => {
    const drawing = drawArrow({ x: 0, y: 0 }, { x: 300, y: 0 }, { route: 'straight', line: 'solid', start: 'none', end: 'filled', mid: 'none' }, 20, undefined, { outline: 3 })
    const svg = arrowSvg(drawing, { stroke: '#e11d48', strokeWidth: 20, outline: '#1f2937', outlineWidth: 3 })
    expect(svg).toHaveLength(4)
    expect(svg[0]).toContain('stroke="#1f2937" stroke-width="26"')
    expect(svg[1]).toContain('fill="#1f2937"')
    expect(svg[1]).toContain('stroke-miterlimit="10"')
    // The head itself is a solid shape.
    expect(svg[3]).toContain('fill="#e11d48" stroke="none"')
  })
})
