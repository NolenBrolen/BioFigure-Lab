/*
 * An icon's SVG text for a picture, loaded when it's needed. With a `near`
 * element, it loads once that element comes within a few hundred pixels of
 * the screen (library tiles), so scrolling past hundreds of icons only loads
 * the ones that are looked at. Without one it loads right away. Already
 * loaded icons show at once, with no placeholder in between.
 */
import { useEffect, useState, type RefObject } from 'react'

import { cachedIconSvg, loadIconSvg } from '../editor/icon-library'

// One observer for every tile; each watched element is called back once.
const waiting = new Map<Element, () => void>()
let observer: IntersectionObserver | undefined

function whenNear(element: Element, then: () => void): () => void {
  if (typeof IntersectionObserver === 'undefined') {
    // No observer (tests, very old browsers): load at once.
    then()
    return () => undefined
  }
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const callback = entry.isIntersecting ? waiting.get(entry.target) : undefined
        if (!callback) continue
        waiting.delete(entry.target)
        observer?.unobserve(entry.target)
        callback()
      }
    },
    { rootMargin: '400px' },
  )
  waiting.set(element, then)
  observer.observe(element)
  return () => {
    waiting.delete(element)
    observer?.unobserve(element)
  }
}

export function useIconSvg(iconId: string | undefined, near?: RefObject<Element | null>): string | undefined {
  const [loaded, setLoaded] = useState<{ id: string; svg: string }>()
  const cached = iconId ? cachedIconSvg(iconId) : undefined

  useEffect(() => {
    if (!iconId || cachedIconSvg(iconId) !== undefined) return
    let live = true
    const load = () => {
      loadIconSvg(iconId).then(
        (svg) => {
          if (live && svg) setLoaded({ id: iconId, svg })
        },
        // A failed load keeps the placeholder; the next time the tile shows tries again.
        () => undefined,
      )
    }
    const element = near?.current
    const stop = element ? whenNear(element, load) : (load(), undefined)
    return () => {
      live = false
      stop?.()
    }
  }, [iconId, near])

  return cached ?? (loaded && loaded.id === iconId ? loaded.svg : undefined)
}
