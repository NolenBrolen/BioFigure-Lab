import { afterEach, describe, expect, it, vi } from 'vitest'

import { newId } from './new-id'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('new ids', () => {
  it('still makes ids on a plain-http address, where randomUUID is missing (bug: no figure could be made from a phone over Wi-Fi)', () => {
    const real = globalThis.crypto
    vi.stubGlobal('crypto', { getRandomValues: real.getRandomValues.bind(real) })
    const ids = new Set(Array.from({ length: 50 }, newId))
    vi.unstubAllGlobals()
    expect(ids.size).toBe(50)
    for (const id of ids) expect(id).toMatch(UUID_V4)
  })
})
