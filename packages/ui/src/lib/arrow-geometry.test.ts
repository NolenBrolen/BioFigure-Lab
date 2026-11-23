import { describe, expect, it } from 'vitest'

import { ARROW_PRESETS, OPEN_SHAPES, SHAPES, drawArrow, routePoints, shapePath, type ArrowLook } from './arrow-geometry'

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
