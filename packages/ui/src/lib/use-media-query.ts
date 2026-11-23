/*
 * Whether a CSS media query matches now, kept up to date as the window
 * changes size. Used to switch the editor to its phone layout.
 */
import { useSyncExternalStore } from 'react'

/** Browsers without media queries (test browsers like jsdom) count as not matching. */
const canMatch = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (!canMatch()) return () => undefined
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () => canMatch() && window.matchMedia(query).matches,
    () => false,
  )
}

/** Below this width the editor uses its phone layout (Tailwind's `md` breakpoint). */
export const PHONE_QUERY = '(max-width: 767.98px)'

export const usePhoneLayout = () => useMediaQuery(PHONE_QUERY)
