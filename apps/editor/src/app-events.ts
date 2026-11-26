/*
 * Moments in the app that other scripts on the page may listen for, as a
 * window event: `addEventListener('biofigurelab:app-event', (e) => e.detail)`.
 * The app itself only announces them; it sends nothing anywhere.
 */
export type AppEvent =
  | { name: 'figure_created'; value: 'blank' | 'template' }
  | { name: 'figure_opened' | 'item_added' }
  | { name: 'export'; value: 'png' | 'svg' | 'pdf' }
  | { name: 'tool'; value: string }

export const APP_EVENT = 'biofigurelab:app-event'

export function emitAppEvent(event: AppEvent): void {
  window.dispatchEvent(new CustomEvent<AppEvent>(APP_EVENT, { detail: event }))
}
