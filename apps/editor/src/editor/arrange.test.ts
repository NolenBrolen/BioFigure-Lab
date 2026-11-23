import { describe, expect, it } from 'vitest'

import { align, distribute, marginBox, snap, snapPoint, snapResize, touchesMargin, type Box } from './arrange'

const box = (left: number, top: number, width = 10, height = 10): Box => ({ left, top, width, height })
const page = box(0, 0, 200, 100)

describe('align', () => {
  const boxes = [box(10, 5, 20, 10), box(50, 30, 40, 20)]

  it('lines several objects up with the box around all of them', () => {
    expect(align(boxes, 'left', page)).toEqual([{ dx: 0, dy: 0 }, { dx: -40, dy: 0 }])
    expect(align(boxes, 'right', page)).toEqual([{ dx: 60, dy: 0 }, { dx: 0, dy: 0 }])
    expect(align(boxes, 'bottom', page)).toEqual([{ dx: 0, dy: 35 }, { dx: 0, dy: 0 }])
  })

  it('centres on the middle of the selection', () => {
    // Selection runs from x 10 to 90, so its centre is 50.
    expect(align(boxes, 'centre', page)).toEqual([{ dx: 30, dy: 0 }, { dx: -20, dy: 0 }])
  })

  it('lines one object up with the page', () => {
    expect(align([box(10, 5, 20, 10)], 'centre', page)).toEqual([{ dx: 80, dy: 0 }])
    expect(align([box(10, 5, 20, 10)], 'middle', page)).toEqual([{ dx: 0, dy: 40 }])
  })
})

describe('distribute', () => {
  it('makes the gaps equal and keeps the outer objects in place', () => {
    // Listed out of order on purpose: order on the page counts, not selection order.
    const moves = distribute([box(0, 0), box(100, 0), box(20, 0)], 'horizontal')
    expect(moves).toEqual([{ dx: 0, dy: 0 }, { dx: 0, dy: 0 }, { dx: 30, dy: 0 }])
  })

  it('handles objects of different sizes vertically', () => {
    const moves = distribute([box(0, 0, 10, 10), box(0, 15, 10, 30), box(0, 90, 10, 10)], 'vertical')
    // Space 100, objects 50, so each of the two gaps is 25: the middle one starts at 35.
    expect(moves[1]).toEqual({ dx: 0, dy: 20 })
  })

  it('does nothing with fewer than three objects', () => {
    expect(distribute([box(0, 0), box(50, 0)], 'horizontal')).toEqual([{ dx: 0, dy: 0 }, { dx: 0, dy: 0 }])
  })
})

describe('snap', () => {
  it('snaps an edge to a nearby object edge and shows a guide', () => {
    const result = snap(box(53, 40), [box(30, 10, 20, 10)], page, 6)
    // The moving box's left edge (53) is 3 away from the other's right edge (50).
    expect(result.dx).toBe(-3)
    expect(result.guides).toContainEqual({ axis: 'x', at: 50, from: 10, to: 50 })
  })

  it('snaps centres to the page centre', () => {
    const result = snap(box(93, 43), [], page, 6)
    expect(result).toMatchObject({ dx: 2, dy: 2 })
    expect(result.guides.map((guide) => guide.at)).toEqual([100, 50])
  })

  it('leaves the box alone when nothing is close', () => {
    expect(snap(box(60, 30), [box(130, 70)], page, 6)).toEqual({ dx: 0, dy: 0, guides: [] })
  })

  it('picks the closest line when several are in reach', () => {
    expect(snap(box(24, 70), [box(30, 0), box(25, 20)], page, 6).dx).toBe(1)
  })

  it('falls back to the grid when no object is close', () => {
    expect(snap(box(61, 23), [], page, 6, 20)).toEqual({ dx: -1, dy: -3, guides: [] })
  })
})

describe('snapping while resizing', () => {
  it('pulls a dragged right edge onto the page edge, the left edge staying put', () => {
    const result = snapResize(box(20, 20, 177, 30), { x: 'end' }, [], page, 6)
    expect(result.box).toEqual(box(20, 20, 180, 30))
    expect(result.guides).toEqual([{ axis: 'x', at: 200, from: 0, to: 100 }])
  })

  it('pulls a dragged top edge onto another object, the bottom staying put', () => {
    const result = snapResize(box(20, 42, 30, 40), { y: 'start' }, [box(100, 30, 20, 10)], page, 6)
    expect(result.box).toEqual(box(20, 40, 30, 42))
  })

  it('leaves the box alone when nothing is close', () => {
    const moving = box(20, 20, 100, 30)
    expect(snapResize(moving, { x: 'end' }, [], page, 6)).toEqual({ box: moving, guides: [] })
  })

  it('keeps the shape on a proportional corner drag, snapping the nearer edge', () => {
    // The right edge is 3 from the page edge; the bottom 8 from the page's middle line, too far.
    const result = snapResize(box(100, 0, 97, 42), { x: 'end', y: 'end' }, [], page, 6, undefined, true)
    expect(result.box.left).toBe(100)
    expect(result.box.width).toBeCloseTo(100)
    expect(result.box.height).toBeCloseTo((42 * 100) / 97)
  })

  it('snaps a dragged edge to the grid when no object is close', () => {
    expect(snapResize(box(12, 12, 44, 30), { x: 'end' }, [], box(0, 0, 1000, 1000), 6, 25).box.width).toBe(38)
  })
})

describe('snapping an arrow end', () => {
  it('pulls a dragged end onto the page edge and the middle of another object', () => {
    expect(snapPoint({ x: 197, y: 44 }, [box(30, 30, 20, 30)], page, 6)).toMatchObject({ x: 200, y: 45 })
  })
})

describe('page margin', () => {
  it('is the page shrunk on every side, or none on a page too small for it', () => {
    expect(marginBox(page, 10)).toEqual(box(10, 10, 180, 80))
    expect(marginBox(page, 60)).toBeUndefined()
    expect(marginBox(page, 0)).toBeUndefined()
  })

  it('gives an edge being dragged near the page edge a line to snap to with some room left', () => {
    const margin = marginBox(page, 10)!
    expect(snapResize(box(20, 20, 167, 30), { x: 'end' }, [margin], page, 6).box.width).toBe(170)
  })
})

describe('showing the page margin', () => {
  const margin = box(10, 10, 180, 80)

  it('shows when a guide runs along a margin edge', () => {
    expect(touchesMargin([{ axis: 'x', at: 190, from: 0, to: 100 }], margin)).toBe(true)
    expect(touchesMargin([{ axis: 'y', at: 10, from: 0, to: 200 }], margin)).toBe(true)
  })

  it('stays hidden for the page edge or middle, which are not the margin', () => {
    expect(touchesMargin([{ axis: 'x', at: 200, from: 0, to: 100 }, { axis: 'x', at: 100, from: 0, to: 100 }], margin)).toBe(false)
  })
})
