import { Dexie } from 'dexie'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, describe, expect, it } from 'vitest'

import { defaultHeight, mmError, parseMm, presetFor } from './page-size'
import { FigureStore, OLD_BACKUP_KEY, OLD_KEY } from './storage'

let clock = 1000
let store: FigureStore
const newStore = () => {
  // A fresh fake database for each test, and a clock that moves on by itself.
  store = new FigureStore({ indexedDB: new IDBFactory(), IDBKeyRange }, () => (clock += 1))
  return store
}
afterEach(() => store.close())

const fakeStorage = (entries: Record<string, string>) => {
  const map = new Map(Object.entries(entries))
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  }
}

describe('figures saved in the browser', () => {
  it('opens a figure saved before slides as a one-slide figure, keeping the old copy', async () => {
    const indexedDB = new IDBFactory()
    const old = new Dexie('biofigure-lab', { indexedDB, IDBKeyRange })
    old.version(1).stores({ figures: 'id, updatedAt' })
    await old.table('figures').add({
      id: 'old', name: 'Old cell', page: { width: 85, height: 60 }, canvas: '{"objects":[1]}', thumbnail: 'data:,A', createdAt: 1, updatedAt: 1,
    })
    old.close()

    store = new FigureStore({ indexedDB, IDBKeyRange })
    const figure = await store.get('old')
    expect(figure?.slides).toHaveLength(1)
    expect(figure?.slides[0]).toMatchObject({ canvas: '{"objects":[1]}', thumbnail: 'data:,A' })
    expect(figure?.canvas).toBe('{"objects":[1]}')
  })

  it('gives a new figure one empty slide', async () => {
    const figure = await newStore().create({ width: 85, height: 60 })
    expect(figure.slides).toHaveLength(1)
    expect(figure.slides[0]?.canvas).toBeUndefined()
  })

  it('keeps several figures, each with its own name, page size and contents, last edited first', async () => {
    const figures = newStore()
    const first = await figures.create({ width: 85, height: 60 }, 'Phagocytosis')
    const second = await figures.create({ width: 174, height: 120 })
    await figures.save(first.id, { slides: [{ id: 's1', canvas: '{"objects":[]}' }], thumbnail: 'data:image/png;base64,AA' })

    const list = await figures.list()
    expect(list.map((figure) => figure.name)).toEqual(['Phagocytosis', 'Untitled figure'])
    expect(list[0]).toMatchObject({ page: { width: 85, height: 60 }, slides: [{ id: 's1', canvas: '{"objects":[]}' }], thumbnail: 'data:image/png;base64,AA' })
    expect(await figures.get(second.id)).toMatchObject({ page: { width: 174, height: 120 } })
  })

  it('deletes at once and brings a figure back with undo, in its old place', async () => {
    const figures = newStore()
    const older = await figures.create({ width: 85, height: 60 }, 'Older')
    await figures.create({ width: 85, height: 60 }, 'Newer')

    await figures.remove(older.id)
    expect((await figures.list()).map((figure) => figure.name)).toEqual(['Newer'])
    expect(await figures.get(older.id)).toBeUndefined()

    await figures.restore(older.id)
    expect((await figures.list()).map((figure) => figure.name)).toEqual(['Newer', 'Older'])
  })

  it('moves the old single figure over once, keeping a copy', async () => {
    const figures = newStore()
    const storage = fakeStorage({ [OLD_KEY]: JSON.stringify({ name: 'My cell', canvas: '{"objects":[1]}' }) })

    // Twice at once, as React's development mode does.
    await Promise.all([figures.moveOldFigure(storage), figures.moveOldFigure(storage)])
    await figures.moveOldFigure(storage)

    const list = await figures.list()
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ name: 'My cell', slides: [{ canvas: '{"objects":[1]}' }], page: { width: 174, height: 120 } })
    expect(storage.map.has(OLD_KEY)).toBe(false)
    expect(storage.map.get(OLD_BACKUP_KEY)).toContain('My cell')
  })

  it('does nothing when there is no old figure or storage is blocked', async () => {
    const figures = newStore()
    await figures.moveOldFigure(fakeStorage({}))
    await figures.moveOldFigure({
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => undefined,
      removeItem: () => undefined,
    })
    expect(await figures.list()).toEqual([])
  })
})

describe('page sizes', () => {
  it('reads typed millimetres, also with a comma', () => {
    expect(parseMm('85')).toBe(85)
    expect(parseMm(' 85,5 ')).toBe(85.5)
    expect(parseMm('90 mm')).toBe(90)
    expect(parseMm('abc')).toBeUndefined()
    expect(parseMm('')).toBeUndefined()
  })

  it('explains sizes it refuses', () => {
    expect(mmError('85')).toBeUndefined()
    expect(mmError('')).toBe('Type a number of millimetres')
    expect(mmError('2')).toBe('At least 10 mm')
    expect(mmError('1740')).toBe('At most 1000 mm')
  })

  it('knows the presets and gives custom widths a matching height', () => {
    expect(presetFor({ width: 114, height: 80 })).toBe('one-and-half')
    expect(presetFor({ width: 114, height: 90 })).toBeUndefined()
    expect(defaultHeight(114)).toBe(80)
    expect(defaultHeight(100)).toBe(69)
  })
})
