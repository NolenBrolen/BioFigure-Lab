import { useCallback, useLayoutEffect, useRef } from 'react'

/**
 * A function that stays the same from one render to the next but always calls
 * the latest `fn`. Handing it to a memoised panel keeps that panel from
 * redrawing each time its parent does (BIO-88).
 */
export function useStableCallback<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  const latest = useRef(fn)
  useLayoutEffect(() => {
    latest.current = fn
  })
  return useCallback((...args: A) => latest.current(...args), [])
}
