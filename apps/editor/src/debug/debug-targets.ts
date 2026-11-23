/*
 * What the debug panel can reach in the running app. Screens fill this in
 * (only in development, behind `import.meta.env.DEV`), and the panel's buttons
 * read it when clicked. Nothing here imports the debug panel itself, so it is
 * safe to use from app code.
 */
import type { FigureCanvas } from '../editor/FigureCanvas'
import type { FigureStore } from '../editor/storage'

export const debugTargets: {
  /** The open figure's canvas, or null on the start screen. */
  figure: FigureCanvas | null
  store: FigureStore | null
  /** Extra time an export waits before it starts, so its progress bar can be watched. */
  exportDelayMs: number
} = { figure: null, store: null, exportDelayMs: 0 }

/**
 * Waits `ms`, reporting progress from 0 to `share` along the way. Stops early
 * when the export is cancelled.
 */
export async function fakeProgress(ms: number, share: number, signal: AbortSignal, onProgress: (progress: number) => void): Promise<void> {
  const steps = 20
  for (let step = 1; step <= steps; step++) {
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError')
    await new Promise((resolve) => setTimeout(resolve, ms / steps))
    onProgress((step / steps) * share)
  }
}
