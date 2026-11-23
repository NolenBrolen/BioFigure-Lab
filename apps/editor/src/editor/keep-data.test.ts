import { afterEach, describe, expect, it, vi } from 'vitest'

import { ASK_AGAIN_AFTER, keepBrowserData, keepBrowserDataOnce, REFUSED_KEY, resetKeepDataOnce, type PersistApi } from './keep-data'

function fakeApi(kept: boolean, answer = true) {
  return { persisted: vi.fn(() => Promise.resolve(kept)), persist: vi.fn(() => Promise.resolve(answer)) } satisfies PersistApi
}

function fakeMemory() {
  const items = new Map<string, string>()
  return { getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => void items.set(key, value) }
}

afterEach(() => resetKeepDataOnce())

describe('keeping browser data', () => {
  it('asks the browser when the data is not kept yet', async () => {
    const api = fakeApi(false)
    expect(await keepBrowserData({ api, memory: fakeMemory() })).toBe('granted')
    expect(api.persist).toHaveBeenCalledOnce()
  })

  it('does not ask when the data is already kept', async () => {
    const api = fakeApi(true)
    expect(await keepBrowserData({ api, memory: fakeMemory() })).toBe('kept')
    expect(api.persist).not.toHaveBeenCalled()
  })

  it('copes quietly with the API missing or failing', async () => {
    expect(await keepBrowserData({ api: undefined })).toBe('unsupported')
    expect(await keepBrowserData({ api: {} as PersistApi })).toBe('unsupported')
    const broken = { persisted: () => Promise.reject(new Error('blocked')), persist: () => Promise.resolve(true) }
    expect(await keepBrowserData({ api: broken, memory: fakeMemory() })).toBe('unsupported')
  })

  it('after a refusal, waits before asking again', async () => {
    const memory = fakeMemory()
    let time = 1_000
    const now = () => time
    expect(await keepBrowserData({ api: fakeApi(false, false), memory, now })).toBe('refused')
    expect(memory.getItem(REFUSED_KEY)).toBe('1000')

    const api = fakeApi(false)
    time += ASK_AGAIN_AFTER - 1
    expect(await keepBrowserData({ api, memory, now })).toBe('skipped')
    expect(api.persist).not.toHaveBeenCalled()
    time += 1
    expect(await keepBrowserData({ api, memory, now })).toBe('granted')
  })

  it('asks at most once per page load', async () => {
    const api = fakeApi(false)
    await keepBrowserDataOnce({ api, memory: fakeMemory() })
    await keepBrowserDataOnce({ api, memory: fakeMemory() })
    expect(api.persisted).toHaveBeenCalledOnce()
    expect(api.persist).toHaveBeenCalledOnce()
  })
})
