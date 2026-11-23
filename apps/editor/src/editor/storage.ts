/**
 * Saving figures in the browser (IndexedDB, through Dexie), so they are still
 * there after a reload. Each figure keeps its name, page size, contents and a
 * small picture for the start screen. A figure has one or more slides, each
 * its own page with its own objects.
 *
 * Deleting only marks a figure as deleted, so Undo can bring it back. The
 * "Recently deleted" list can later show these and clear them after 30 days.
 */
import { Dexie, type DexieOptions, type EntityTable } from 'dexie'

import { cleanPage, DEFAULT_PAGE, type PageMm } from './page-size'
import { newId } from './new-id'

export type Slide = {
  id: string
  /** The Fabric canvas as JSON. Missing for a new, empty slide. */
  canvas?: string
  /** A small PNG of the slide, as a data URL. */
  thumbnail?: string
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
}

export type FigureChanges = Partial<Pick<Figure, 'name' | 'page' | 'slides' | 'thumbnail'>>

export const DEFAULT_NAME = 'Untitled figure'

/** Where the editor kept its one figure before there was a list. */
export const OLD_KEY = 'biofigure-lab:figure'
/** The old figure is kept here after it is moved, as a copy in case moving went wrong. */
export const OLD_BACKUP_KEY = 'biofigure-lab:figure-before-move'
const OLD_FIGURE_ID = 'first-figure'

class FigureDatabase extends Dexie {
  figures!: EntityTable<Figure, 'id'>

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
  }
}

export class FigureStore {
  private readonly db: FigureDatabase
  private readonly now: () => number

  constructor(options?: DexieOptions, now: () => number = Date.now, name = 'biofigure-lab') {
    this.db = new FigureDatabase(name, options)
    this.now = now
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
    await this.db.figures.add(figure)
    return figure
  }

  async save(id: string, changes: FigureChanges): Promise<void> {
    await this.db.figures.update(id, { ...changes, updatedAt: this.now() })
  }

  /** Delete at once; `restore` undoes it. */
  async remove(id: string): Promise<void> {
    await this.db.figures.update(id, { deletedAt: this.now() })
  }

  async restore(id: string): Promise<void> {
    // Writing `undefined` removes the field.
    await this.db.figures.update(id, { deletedAt: undefined })
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
