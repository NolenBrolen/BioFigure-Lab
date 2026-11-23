/*
 * The phone's bottom sheet keeps a spot at the right end of its title row.
 * Controls inside the sheet can put a small action there (like "Reset all
 * colours" next to "Colours", or "No fill" next to "Cell fill") with
 * `useSheetTitleEnd` and a portal; outside a sheet it is null, and they stay
 * where they are.
 */
import { createContext, useContext, useEffect, useState, type RefObject } from 'react'

export const SheetTitleEnd = createContext<HTMLElement | null>(null)

/**
 * The title row's spot. With `own` (an element of the control), only while
 * that element is shown: the sheet keeps the rows of its other settings
 * mounted but hidden, and their actions mustn't land in this title.
 */
export function useSheetTitleEnd(own?: RefObject<HTMLElement | null>): HTMLElement | null {
  const spot = useContext(SheetTitleEnd)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const element = own?.current
    if (!element || !spot) return
    // The sheet hides the other settings' rows with the `hidden` attribute (see row-focus).
    const check = () => setShown(!element.closest('[hidden]'))
    check()
    const observer = new MutationObserver(check)
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['hidden'] })
    return () => observer.disconnect()
  }, [own, spot])
  return own ? (shown ? spot : null) : spot
}
