/*
 * A pick in a quick-actions widget opens the matching tab of the properties
 * panel on the left, so the finer settings for what was just picked are right
 * there (BIO-82, the owner's call of 2026-11-25): Frame for an icon's frame,
 * Shape for a shape's style. The panels listen; the bar's widgets ask.
 */
import { useEffect, useEffectEvent } from 'react'

export type PanelTab = 'icon-frame' | 'shape-style'

const listeners = new Set<(tab: PanelTab) => void>()

/** Ask the properties panel to show this tab. */
export function openPanelTab(tab: PanelTab): void {
  for (const listener of listeners) listener(tab)
}

/** Run `onOpen` when a widget asks for a tab, while the calling panel is shown. */
export function usePanelTab(onOpen: (tab: PanelTab) => void): void {
  const listener = useEffectEvent(onOpen)
  useEffect(() => {
    const each = (tab: PanelTab) => listener(tab)
    listeners.add(each)
    return () => {
      listeners.delete(each)
    }
  }, [])
}
