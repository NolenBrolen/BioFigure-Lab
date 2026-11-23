import { drawArrow } from '@biofigure-lab/ui/lib/arrow-geometry'
import { describe, expect, it } from 'vitest'

import { ATTACH_GAP, arrowSvg, attachTargetAt, edgePoint, followEnds, type Frame } from './connectors'

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
})
