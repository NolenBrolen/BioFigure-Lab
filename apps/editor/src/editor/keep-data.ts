/**
 * Ask the browser to keep this site's data (BIO-29), so the figures in
 * IndexedDB aren't cleared when the disk runs low or, in Safari, after a week
 * without a visit. Without an account the browser holds the only copy.
 *
 * Asked once the user has a figure worth keeping (creating or opening one),
 * never on page load: Firefox shows a permission prompt, and a prompt with no
 * context gets refused. Chrome, Edge and Safari decide silently. Every answer
 * is handled quietly; a refusal or a missing API changes nothing else.
 * What each browser does is written down in `notes/architecture.md`.
 */

/** The part of `navigator.storage` this needs. */
export type PersistApi = Pick<StorageManager, 'persisted' | 'persist'>

/** Where a refusal is remembered, so Firefox users aren't asked on every visit. */
export const REFUSED_KEY = 'biofigure-lab:keep-data-refused'
/** After a refusal, wait this long before asking again. */
export const ASK_AGAIN_AFTER = 30 * 24 * 60 * 60 * 1000

type Memory = Pick<Storage, 'getItem' | 'setItem'>

export type KeepDataResult = 'kept' | 'granted' | 'refused' | 'unsupported' | 'skipped'

type Options = {
  api?: PersistApi | undefined
  memory?: Memory | undefined
  now?: () => number
}

/**
 * Check whether the data is kept and, if not, ask once. Never throws.
 * `kept`: it already was; `granted`/`refused`: the browser's answer;
 * `unsupported`: no API; `skipped`: refused recently, so not asked.
 */
export async function keepBrowserData({ api = defaultApi(), memory = defaultMemory(), now = Date.now }: Options = {}): Promise<KeepDataResult> {
  if (typeof api?.persisted !== 'function' || typeof api.persist !== 'function') return 'unsupported'
  try {
    if (await api.persisted()) return 'kept'
    const refusedAt = Number(read(memory))
    if (refusedAt && now() - refusedAt < ASK_AGAIN_AFTER) return 'skipped'
    if (await api.persist()) return 'granted'
    write(memory, String(now()))
    return 'refused'
  } catch {
    return 'unsupported'
  }
}

let asked: Promise<KeepDataResult> | undefined

/** `keepBrowserData` at most once per page load; later calls get the first answer. */
export function keepBrowserDataOnce(options?: Options): Promise<KeepDataResult> {
  asked ??= keepBrowserData(options)
  return asked
}

/** For tests: forget that this page load already asked. */
export function resetKeepDataOnce(): void {
  asked = undefined
}

function defaultApi(): PersistApi | undefined {
  return typeof navigator === 'undefined' ? undefined : navigator.storage
}

function defaultMemory(): Memory | undefined {
  try {
    return globalThis.localStorage
  } catch {
    return undefined // Storage blocked.
  }
}

function read(memory: Memory | undefined): string | null | undefined {
  try {
    return memory?.getItem(REFUSED_KEY)
  } catch {
    return undefined
  }
}

function write(memory: Memory | undefined, value: string): void {
  try {
    memory?.setItem(REFUSED_KEY, value)
  } catch {
    // Can't remember the refusal; we'll ask again next visit.
  }
}
