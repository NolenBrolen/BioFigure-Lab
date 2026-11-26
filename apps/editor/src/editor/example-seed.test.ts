import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { FigureFile } from '../templates/templates'
import { EXAMPLE_FLAG, seedExampleOnce } from './example-seed'
import { FigureStore } from './storage'

let store: FigureStore
const newStore = () => (store = new FigureStore({ indexedDB: new IDBFactory(), IDBKeyRange }))
afterEach(() => store.close())

const flagStorage = (flag?: string) => {
  const map = new Map<string, string>(flag ? [[EXAMPLE_FLAG, flag]] : [])
  return { map, getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => void map.set(key, value) }
}
const file: FigureFile = { name: 'File name', page: { width: 174, height: 98 }, slides: [{ id: 'a', canvas: '{}' }], thumbnail: 'data:image/png;base64,x' }
const load = () => Promise.resolve(file)

describe('the example figure for new visitors', () => {
  it('adds one example, named as a sample, to an empty list', async () => {
    newStore()
    await seedExampleOnce(store, load, 'Example figure', flagStorage())
    const figures = await store.list()
    expect(figures.map((figure) => figure.name)).toEqual(['Example figure'])
    expect(figures[0]?.slides[0]?.canvas).toBe('{}')
  })

  it('adds it only once: a deleted example stays gone, even after a reload', async () => {
    newStore()
    const storage = flagStorage()
    await seedExampleOnce(store, load, 'Example figure', storage)
    await store.remove((await store.list())[0]!.id)
    await seedExampleOnce(store, load, 'Example figure', storage) // the next visit
    expect(await store.list()).toEqual([])
  })

  it('adds a single example when two runs start at the same time', async () => {
    newStore()
    const storage = flagStorage()
    await Promise.all([seedExampleOnce(store, load, 'Example figure', storage), seedExampleOnce(store, load, 'Example figure', storage)])
    expect(await store.list()).toHaveLength(1)
  })

  it('leaves people who already have figures alone, and never adds it later', async () => {
    newStore()
    const storage = flagStorage()
    await store.create({ width: 85, height: 60 }, 'Mine')
    await seedExampleOnce(store, load, 'Example figure', storage)
    await store.remove((await store.list())[0]!.id)
    await seedExampleOnce(store, load, 'Example figure', storage)
    expect(await store.list()).toEqual([])
  })

  it('adds nothing when the browser will not keep the flag', async () => {
    newStore()
    const blocked = { getItem: () => null, setItem: vi.fn(() => { throw new Error('blocked') }) }
    await seedExampleOnce(store, load, 'Example figure', blocked)
    expect(await store.list()).toEqual([])
  })

  it('a template makes a new figure each time, with fresh slide ids', async () => {
    newStore()
    const first = await store.createFrom({ ...file, name: 'T' })
    const second = await store.createFrom({ ...file, name: 'T' })
    expect(first.id).not.toBe(second.id)
    expect(first.slides[0]!.id).not.toBe('a')
    expect(await store.list()).toHaveLength(2)
  })
})
