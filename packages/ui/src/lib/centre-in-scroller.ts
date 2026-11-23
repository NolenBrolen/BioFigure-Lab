/*
 * Long lists in the phone's sheet (fonts, tests) scroll with the sheet rather
 * than in a box of their own. `useCentrePicked` brings the picked option
 * into the middle of the sheet each time the list comes into view (it stays
 * mounted, hidden, while another setting is open).
 */
import { useEffect, type RefObject } from 'react'

/**
 * Scrolls the nearest scrolling box around `element` so the element sits in
 * its middle. Unlike `scrollIntoView` it leaves every other box alone, so
 * nothing else on the page shifts.
 */
export function centreInScroller(element: HTMLElement): void {
  const box = scroller(element)
  if (!box) return
  const offset = element.getBoundingClientRect().top - box.getBoundingClientRect().top
  box.scrollTop += offset - box.clientHeight / 2 + element.offsetHeight / 2
}

function scroller(element: HTMLElement): HTMLElement | null {
  let box = element.parentElement
  while (box && !/(auto|scroll)/.test(getComputedStyle(box).overflowY)) box = box.parentElement
  return box
}

/**
 * Centres the list's picked option (`[aria-checked="true"]`) each time the
 * list goes from hidden to shown, when the list starts in view and its picked
 * option is out of sight (so a second list lower in the sheet, like the
 * correction under the tests, doesn't pull the view down).
 */
export function useCentrePicked(list: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const element = list.current
    // Test browsers (jsdom) have no ResizeObserver.
    if (!element || typeof ResizeObserver === 'undefined') return
    let shown = false
    const observer = new ResizeObserver(() => {
      const now = element.offsetHeight > 0
      if (now && !shown) {
        const picked = element.querySelector<HTMLElement>('[aria-checked="true"]')
        const box = picked && scroller(picked)
        if (picked && box) {
          const view = box.getBoundingClientRect()
          const listTop = element.getBoundingClientRect().top
          const at = picked.getBoundingClientRect()
          if (listTop >= view.top && listTop < view.bottom && at.bottom > view.bottom) centreInScroller(picked)
        }
      }
      shown = now
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [list])
}
