/*
 * The example figure: a new visitor with no figures gets one sample figure in
 * their list, once. A flag in this browser remembers it was added, so
 * deleting the example keeps it gone.
 */
import type { FigureFile } from '../templates/templates'
import type { FigureStore } from './storage'

export const EXAMPLE_FLAG = 'biofigure-lab:example-added'
/** A fixed id, so two runs at the same time make one example, not two. */
export const EXAMPLE_ID = 'example-figure'

type FlagStorage = Pick<Storage, 'getItem' | 'setItem'>

/**
 * Adds the example when this browser has never had it and has no figures yet.
 * A browser that already has figures (people who used the app before the
 * example existed) gets none, and is marked so it never will. When the flag
 * cannot be read or kept (blocked storage), nothing is added, since it could
 * not be remembered.
 */
export async function seedExampleOnce(
  store: FigureStore,
  load: () => Promise<FigureFile>,
  name: string,
  storage: FlagStorage | undefined = globalThis.localStorage,
): Promise<void> {
  try {
    if (!storage || storage.getItem(EXAMPLE_FLAG)) return
    // Marked first, so a second run at the same time (or a crash half way) cannot add it twice.
    storage.setItem(EXAMPLE_FLAG, '1')
  } catch {
    return
  }
  if ((await store.list()).length > 0) return
  await store.createFrom({ ...(await load()), name }, EXAMPLE_ID)
}
