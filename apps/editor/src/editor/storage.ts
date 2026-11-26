/**
 * Saving figures in the browser (IndexedDB, through Dexie), so they are still
 * there after a reload. Each figure keeps its name, page size, contents and a
 * small picture for the start screen. A figure has one or more slides, each
 * its own page with its own objects.
 *
 * Saved data sets ("Your data": imported or pasted numbers) live in the same
 * database, shared by all figures.
 *
 * Deleting only marks a figure as deleted, so Undo can bring it back. The
 * "Recently deleted" list can later show these and clear them after 30 days.
 *
 * Figure sync (BIO-33): every change here also puts the figure on the "to
 * upload" list (the `sync` table, `dirty`), together with the figure as it was
 * last synced (`base`), which the merge needs. The sync engine reads and writes
 * through the methods at the end of FigureStore.
 */
import { Dexie, type DexieOptions, type EntityTable } from 'dexie'

import type { ChartGroup } from './chart-model'
import { cleanPage, DEFAULT_PAGE, type PageMm } from './page-size'
import { newId } from './new-id'

export type Slide = {
  id: string
  /** The Fabric canvas as JSON. Missing for a new, empty slide. */
  canvas?: string
  /** A small PNG of the slide, as a data URL. */
  thumbnail?: string
  /**
   * Added by sync when this slide changed here and on another device at the same time: this is this device's
   * version, next to the other one. Only kept on this device; cleared when the slide is edited.
   */
  clashCopy?: boolean
}

export type Figure = {
  id: string
  name: string
  page: PageMm
  /** Always at least one. */
  slides: Slide[]
  /**
   * Figures saved before slides had their one page here. Kept untouched as a
   * copy of the old data; the editor reads `slides`.
   */
  canvas?: string
  /** A small PNG of the first slide for the start screen, as a data URL. */
  thumbnail?: string
  createdAt: number
  updatedAt: number
  /** When it was deleted. Deleted figures don't show in the list. */
  deletedAt?: number
  /**
   * For a signed-in account: whose figure it is and who it's shared with, as the server last said (BIO-34).
   * Missing for figures not synced yet (they're yours).
   */
  access?: FigureAccess
}

/** Someone with access to a figure; `id` is null for an invite to an address without an account yet. */
export type FigurePerson = { id: string | null; name: string; email: string; image: string | null }

/** Your role on a figure, its owner, and everyone it's shared with (as the live site's server says; see site/sync). */
export type FigureAccess = { role: 'owner' | 'edit' | 'view'; owner: FigurePerson; shared: (FigurePerson & { role: 'view' | 'edit' })[] }

/** A saved set of numbers, kept to use again in any figure. A chart copies the numbers when it uses one. */
export type DataSet = {
  id: string
  name: string
  groups: ChartGroup[]
  createdAt: number
  updatedAt: number
}

/** A figure as this device last synced it with the server. */
export type SyncBase = {
  version: number
  name: string
  page: PageMm
  deletedAt: number | null
  slides: { id: string; hash: string }[]
}

/** A figure's sync bookkeeping: on the upload list (`dirty` 1) or not, and what it was last synced as. */
export type SyncRecord = { id: string; dirty: 0 | 1; base?: SyncBase }

/** What changed: `local` for edits on this device, `sync` for what sync wrote. */
export type StoreChange = { id: string; source: 'local' | 'sync' }

export type FigureChanges = Partial<Pick<Figure, 'name' | 'page' | 'slides' | 'thumbnail'>>

export const DEFAULT_NAME = 'Untitled figure'

/** Where the editor kept its one figure before there was a list. */
export const OLD_KEY = 'biofigure-lab:figure'
/** The old figure is kept here after it is moved, as a copy in case moving went wrong. */
export const OLD_BACKUP_KEY = 'biofigure-lab:figure-before-move'
const OLD_FIGURE_ID = 'first-figure'

class FigureDatabase extends Dexie {
  figures!: EntityTable<Figure, 'id'>
  datasets!: EntityTable<DataSet, 'id'>
  sync!: EntityTable<SyncRecord, 'id'>

  constructor(name: string, options?: DexieOptions) {
    super(name, options)
    // Bump the version (and add an upgrade step) whenever the stored shape changes.
    this.version(1).stores({ figures: 'id, updatedAt' })
    // Version 2: slides. An older figure becomes one slide; its old `canvas` stays as a copy.
    this.version(2)
      .stores({ figures: 'id, updatedAt' })
      .upgrade((tx) =>
        tx
          .table<Figure>('figures')
          .toCollection()
          .modify((figure) => {
            figure.slides ??= [oneSlide(figure.canvas, figure.thumbnail)]
          }),
      )
    // Version 3: saved data sets. Figures are left as they are.
    this.version(3).stores({ figures: 'id, updatedAt', datasets: 'id, updatedAt, name' })
    // Version 4: sync bookkeeping (BIO-33). Every figure starts on the upload list, so a signed-in account's figures go up.
    this.version(4)
      .stores({ figures: 'id, updatedAt', datasets: 'id, updatedAt, name', sync: 'id, dirty' })
      .upgrade(async (tx) => {
        const ids = (await tx.table<Figure>('figures').toCollection().primaryKeys()) as string[]
        await tx.table<SyncRecord>('sync').bulkPut(ids.map((id) => ({ id, dirty: 1 as const })))
      })
  }
}

/** Saved data sets, newest first. Deleting is final here; `restore` puts a deleted one back, for Undo. */
export class DatasetStore {
  private readonly db: FigureDatabase
  private readonly now: () => number

  constructor(db: FigureDatabase, now: () => number) {
    this.db = db
    this.now = now
  }

  async list(): Promise<DataSet[]> {
    return this.db.datasets.orderBy('updatedAt').reverse().toArray()
  }

  async get(id: string): Promise<DataSet | undefined> {
    return this.db.datasets.get(id)
  }

  async add(name: string, groups: ChartGroup[]): Promise<DataSet> {
    const time = this.now()
    const set: DataSet = { id: newId(), name: name.trim() || 'Untitled data', groups, createdAt: time, updatedAt: time }
    await this.db.datasets.add(set)
    return set
  }

  async rename(id: string, name: string): Promise<void> {
    const trimmed = name.trim()
    if (trimmed) await this.db.datasets.update(id, { name: trimmed, updatedAt: this.now() })
  }

  async duplicate(id: string): Promise<DataSet | undefined> {
    const original = await this.db.datasets.get(id)
    if (!original) return undefined
    const time = this.now()
    const copy: DataSet = { ...original, id: newId(), name: `${original.name} copy`, groups: original.groups.map((g) => ({ ...g, values: [...g.values] })), createdAt: time, updatedAt: time }
    await this.db.datasets.add(copy)
    return copy
  }

  async remove(id: string): Promise<DataSet | undefined> {
    const set = await this.db.datasets.get(id)
    await this.db.datasets.delete(id)
    return set
  }

  /** Put back a data set that was removed, as it was (same id and dates). */
  async restore(set: DataSet): Promise<void> {
    await this.db.datasets.put(set)
  }
}

export class FigureStore {
  private readonly db: FigureDatabase
  private readonly now: () => number
  /** The saved data sets ("Your data"), shared by all figures. */
  readonly datasets: DatasetStore
  private readonly listeners = new Set<(change: StoreChange) => void>()

  constructor(options?: DexieOptions, now: () => number = Date.now, name = 'biofigure-lab') {
    this.db = new FigureDatabase(name, options)
    this.now = now
    this.datasets = new DatasetStore(this.db, now)
  }

  /** All figures that aren't deleted, last edited first. */
  async list(): Promise<Figure[]> {
    const all = await this.db.figures.orderBy('updatedAt').reverse().toArray()
    return all.filter((figure) => figure.deletedAt === undefined).map(clean)
  }

  /** One figure, or undefined when it doesn't exist or was deleted. */
  async get(id: string): Promise<Figure | undefined> {
    const figure = await this.db.figures.get(id)
    return figure && figure.deletedAt === undefined ? clean(figure) : undefined
  }

  async create(page: PageMm, name = DEFAULT_NAME): Promise<Figure> {
    const time = this.now()
    const figure: Figure = { id: newId(), name, page, slides: [oneSlide()], createdAt: time, updatedAt: time }
    await this.changeLocally(figure.id, () => this.db.figures.add(figure))
    return figure
  }

  /**
   * A new figure from a figure file (a template or the example), with fresh
   * slide ids. With a fixed `id` it is added only if that id was never used,
   * deleted figures included.
   */
  async createFrom(file: Pick<Figure, 'name' | 'page' | 'slides' | 'thumbnail'>, id = newId()): Promise<Figure> {
    const existing = await this.db.figures.get(id)
    if (existing) return clean(existing)
    const time = this.now()
    const slides = file.slides.length > 0 ? file.slides.map((slide) => ({ ...slide, id: newId() })) : [oneSlide()]
    const figure: Figure = { id, name: file.name, page: file.page, slides, thumbnail: file.thumbnail, createdAt: time, updatedAt: time }
    await this.changeLocally(id, () => this.db.figures.add(figure))
    return figure
  }

  async save(id: string, changes: FigureChanges): Promise<void> {
    await this.changeLocally(id, () => this.db.figures.update(id, { ...changes, updatedAt: this.now() }))
  }

  /** Delete at once; `restore` undoes it. */
  async remove(id: string): Promise<void> {
    await this.changeLocally(id, () => this.db.figures.update(id, { deletedAt: this.now() }))
  }

  async restore(id: string): Promise<void> {
    // Writing `undefined` removes the field.
    await this.changeLocally(id, () => this.db.figures.update(id, { deletedAt: undefined }))
  }

  /* ---------- Sync (BIO-33) ---------- */

  /** Hear about every change, from this device's edits and from sync. Returns the way to stop. */
  subscribe(listener: (change: StoreChange) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(change: StoreChange) {
    for (const listener of this.listeners) listener(change)
  }

  /** Make an edit and put the figure on the upload list, in one step. */
  private async changeLocally(id: string, write: () => Promise<unknown>): Promise<void> {
    await this.db.transaction('rw', this.db.figures, this.db.sync, async () => {
      await write()
      const record = await this.db.sync.get(id)
      await this.db.sync.put({ ...record, id, dirty: 1 })
    })
    this.emit({ id, source: 'local' })
  }

  /** A figure as stored, deleted ones too (sync carries the deleted mark). */
  async getStored(id: string): Promise<Figure | undefined> {
    const figure = await this.db.figures.get(id)
    return figure && clean(figure)
  }

  async syncRecord(id: string): Promise<SyncRecord | undefined> {
    return this.db.sync.get(id)
  }

  /** The ids of every figure on this device, deleted ones too. */
  async allIds(): Promise<string[]> {
    return this.db.figures.toCollection().primaryKeys()
  }

  /** The figures on the upload list. */
  async dirtyIds(): Promise<string[]> {
    return this.db.sync.where('dirty').equals(1).primaryKeys()
  }

  /**
   * Write what sync worked out, but only if the figure wasn't edited here since sync read it (`readAt` is the
   * `updatedAt` it read, or undefined when it wasn't on this device). Returns false when it was: sync tries again.
   */
  async applySync(figure: Figure, base: SyncBase, dirty: boolean, readAt: number | undefined): Promise<boolean> {
    const written = await this.db.transaction('rw', this.db.figures, this.db.sync, async () => {
      const now = await this.db.figures.get(figure.id)
      if (now?.updatedAt !== readAt) return false
      await this.db.figures.put(figure)
      await this.db.sync.put({ id: figure.id, dirty: dirty ? 1 : 0, base })
      return true
    })
    if (written) this.emit({ id: figure.id, source: 'sync' })
    return written
  }

  /** Store whose figure it is and who it's shared with (changes nothing else, and doesn't put it on the upload list). */
  async setAccess(id: string, access: FigureAccess): Promise<void> {
    const changed = await this.db.transaction('rw', this.db.figures, async () => {
      const figure = await this.db.figures.get(id)
      if (!figure || JSON.stringify(figure.access) === JSON.stringify(access)) return false
      await this.db.figures.update(id, { access })
      return true
    })
    if (changed) this.emit({ id, source: 'sync' })
  }

  /** After an upload: remember what the server now has; off the upload list unless it was edited meanwhile. */
  async markSynced(id: string, base: SyncBase, readAt: number): Promise<void> {
    await this.db.transaction('rw', this.db.figures, this.db.sync, async () => {
      const now = await this.db.figures.get(id)
      await this.db.sync.put({ id, base, dirty: now?.updatedAt === readAt ? 0 : 1 })
    })
  }

  /** Remove a figure for good, with its sync record: a copy that never reached the server, or a figure no longer shared with you. */
  async discard(id: string): Promise<void> {
    await this.db.transaction('rw', this.db.figures, this.db.sync, async () => {
      await this.db.figures.delete(id)
      await this.db.sync.delete(id)
    })
    this.emit({ id, source: 'sync' })
  }

  /** Forget what was last synced and put the figure on the upload list, so it goes up as new. */
  async resetSync(id: string): Promise<void> {
    await this.db.sync.put({ id, dirty: 1 })
  }

  /**
   * Move the one figure the editor used to keep in localStorage into the list.
   * Runs once: afterwards the old copy sits under another key. Safe to call twice at once.
   */
  async moveOldFigure(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | undefined = globalThis.localStorage): Promise<void> {
    let raw: string | null | undefined
    try {
      raw = storage?.getItem(OLD_KEY)
    } catch {
      return // Storage blocked: nothing to move.
    }
    if (!raw || !storage) return
    let old: { name?: unknown; canvas?: unknown }
    try {
      old = JSON.parse(raw) as typeof old
    } catch {
      old = {}
    }
    const time = this.now()
    // A fixed id, so two calls at the same time make one figure, not two.
    if (!(await this.db.figures.get(OLD_FIGURE_ID))) {
      await this.db.figures.put({
        id: OLD_FIGURE_ID,
        name: typeof old.name === 'string' && old.name.trim() ? old.name : DEFAULT_NAME,
        // The editor's page was always 174 × 120 mm then.
        page: DEFAULT_PAGE,
        slides: [oneSlide(typeof old.canvas === 'string' ? old.canvas : undefined)],
        createdAt: time,
        updatedAt: time,
      })
    }
    try {
      storage.setItem(OLD_BACKUP_KEY, raw)
      storage.removeItem(OLD_KEY)
    } catch {
      // Couldn't tidy up; the fixed id stops it being moved twice.
    }
  }

  close(): void {
    this.db.close()
  }
}

/** A new slide, empty unless given saved contents. */
export function oneSlide(canvas?: string, thumbnail?: string): Slide {
  return { id: newId(), canvas, thumbnail }
}

/** Guard against stored figures with a missing or broken page size, name or slides. */
function clean(figure: Figure): Figure {
  const slides = Array.isArray(figure.slides) && figure.slides.length > 0 ? figure.slides : [oneSlide(figure.canvas, figure.thumbnail)]
  return { ...figure, name: figure.name.trim() ? figure.name : DEFAULT_NAME, page: cleanPage(figure.page), slides }
}
