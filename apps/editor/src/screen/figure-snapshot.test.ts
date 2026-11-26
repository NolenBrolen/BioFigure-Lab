import { describe, expect, it } from 'vitest'

import { sameSnapshot, snapshotOf } from './figure-snapshot'

const page = { width: 174, height: 98 }
const slides = [
  { id: 'a', canvas: '{"objects":[]}' },
  { id: 'b', canvas: undefined },
]

describe('figure snapshots', () => {
  it('match when nothing changed', () => {
    expect(sameSnapshot(snapshotOf('Fig', page, slides), snapshotOf('Fig', { ...page }, slides.map((slide) => ({ ...slide }))))).toBe(true)
  })

  it('differ when the name or page size changed', () => {
    const before = snapshotOf('Fig', page, slides)
    expect(sameSnapshot(before, snapshotOf('Fig 2', page, slides))).toBe(false)
    expect(sameSnapshot(before, snapshotOf('Fig', { width: 174, height: 99 }, slides))).toBe(false)
  })

  it('differ when a slide changed, moved, was added or removed', () => {
    const before = snapshotOf('Fig', page, slides)
    expect(sameSnapshot(before, snapshotOf('Fig', page, [{ id: 'a', canvas: '{"objects":[1]}' }, slides[1]!]))).toBe(false)
    expect(sameSnapshot(before, snapshotOf('Fig', page, [...slides].reverse()))).toBe(false)
    expect(sameSnapshot(before, snapshotOf('Fig', page, [...slides, { id: 'c', canvas: undefined }]))).toBe(false)
    expect(sameSnapshot(before, snapshotOf('Fig', page, slides.slice(0, 1)))).toBe(false)
  })
})
