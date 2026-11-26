/*
 * One FigureStore per local database: the no-account one and one per signed-in
 * account. A store is made the first time it's needed and kept, so signing out
 * and back in finds the same figures again (nothing is deleted on sign-out).
 */
import { seedExampleOnce } from './example-seed'
import { FigureStore } from './storage'
import { EXAMPLE_NAME, loadExample } from '../templates/templates'

const NO_ACCOUNT_DB = 'biofigure-lab'

/** The local database for an account's figures. Without an account it's the original one, so older figures stay where they were. */
export function figureDbName(accountId?: string | null): string {
  return accountId ? `${NO_ACCOUNT_DB}-account-${accountId}` : NO_ACCOUNT_DB
}

export type OpenStore = {
  store: FigureStore
  /** Done once the no-account database is set up (older saved work moved over, the example added). */
  ready: Promise<unknown>
}

/** First-visit set-up of the no-account database: the one figure older versions kept, then the example (once; see example-seed.ts). */
const prepareNoAccount = (store: FigureStore) => store.moveOldFigure().then(() => seedExampleOnce(store, loadExample, EXAMPLE_NAME))

export function createStoreRegistry(
  make: (name: string) => FigureStore = (name) => new FigureStore(undefined, Date.now, name),
  prepare: (store: FigureStore) => Promise<unknown> = prepareNoAccount,
) {
  const stores = new Map<string, OpenStore>()
  return (accountId?: string | null): OpenStore => {
    const name = figureDbName(accountId)
    let open = stores.get(name)
    if (!open) {
      const store = make(name)
      // Older saved work and the example belong to the no-account database only.
      const ready = accountId ? Promise.resolve() : prepare(store).catch(() => undefined)
      open = { store, ready }
      stores.set(name, open)
    }
    return open
  }
}

/** The app's stores. */
export const storeFor = createStoreRegistry()
