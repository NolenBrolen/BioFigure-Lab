/*
 * Phones: how far the on-screen keyboard covers the bottom of an element, in
 * px (0 while it's closed). Phone browsers shrink the visual viewport for the
 * keyboard and leave the page's own size alone, so the covered part is what
 * of the element lies below the visual viewport. The editor slides the page
 * up by it, as it does for an open sheet (owner's call, 2026-11-17).
 */
import { useEffect, useState, type RefObject } from 'react'

export function useKeyboardRoom(element: RefObject<HTMLElement | null>, enabled: boolean): number {
  const [room, setRoom] = useState(0)
  useEffect(() => {
    const view = window.visualViewport
    if (!enabled || !view) return
    const measure = () => {
      const box = element.current?.getBoundingClientRect()
      const covered = box ? Math.round(box.bottom - (view.offsetTop + view.height)) : 0
      // Small differences are browser bars coming and going, not a keyboard.
      setRoom(covered > 80 ? covered : 0)
    }
    // The keyboard is closed to begin with; it opens and closes with a resize.
    view.addEventListener('resize', measure)
    view.addEventListener('scroll', measure)
    return () => {
      view.removeEventListener('resize', measure)
      view.removeEventListener('scroll', measure)
    }
  }, [element, enabled])
  return enabled ? room : 0
}
