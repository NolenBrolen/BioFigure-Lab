/*
 * Setting rows on phones. The properties panels lay out their settings as
 * rows: a label, then the controls. Each row marks its label with
 * `data-prop-label` and its controls with `data-prop-row`, both holding the
 * setting's name. An unnamed row (label "")
 * belongs with the named row above it, like the R, G, B fields under Colour.
 *
 * `useRowFocus` reads which settings a panel shows, so the phone's property
 * bar can list them, and with `focus` set shows only those settings' rows:
 * everything else in the panel (headers, other rows, tiles) is hidden until
 * the focus changes. It follows the panel as it changes.
 */
import { useLayoutEffect, useState, type RefObject } from 'react'

/** Marks what `useRowFocus` hid, so it only ever shows those again. */
const HIDDEN_BY_FOCUS = 'data-prop-hidden'

type Row = { name: string; elements: Element[] }

/** The panel's rows in order, unnamed rows joined to the named one above, leaving out rows hidden by the panel itself (another tab). */
function readRows(container: Element): Row[] {
  const rows: Row[] = []
  for (const element of container.querySelectorAll('[data-prop-label], [data-prop-row]')) {
    const hiddenBy = element.parentElement?.closest(`[hidden]:not([${HIDDEN_BY_FOCUS}])`)
    if (hiddenBy && container.contains(hiddenBy)) continue
    // Rows inside a row's controls (a popup shown in place, like text spacing) belong to that row.
    if (element.parentElement?.closest('[data-prop-row]') && container.contains(element.parentElement.closest('[data-prop-row]'))) continue
    const name = element.getAttribute('data-prop-label') ?? element.getAttribute('data-prop-row') ?? ''
    const last = rows.at(-1)
    if (name === '' && last) last.elements.push(element)
    else if (last?.name === name && element.hasAttribute('data-prop-row')) last.elements.push(element)
    else rows.push({ name, elements: [element] })
  }
  return rows.filter((row) => row.name !== '')
}

/** Shows only `keep` and what holds it; hides everything else in the container. */
function showOnly(container: Element, keep: Element[] | undefined) {
  for (const hidden of container.querySelectorAll(`[${HIDDEN_BY_FOCUS}]`)) {
    hidden.removeAttribute(HIDDEN_BY_FOCUS)
    hidden.removeAttribute('hidden')
  }
  if (!keep) return
  const hide = (parent: Element) => {
    for (const child of parent.children) {
      if (keep.includes(child)) continue
      if (keep.some((element) => child.contains(element))) hide(child)
      else if (!child.hasAttribute('hidden')) {
        child.setAttribute('hidden', '')
        child.setAttribute(HIDDEN_BY_FOCUS, '')
      }
    }
  }
  hide(container)
}

const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((name, i) => name === b[i])

/** The names of the settings in the container, in order. With `focus` (one name or several), only those settings' rows show. */
export function useRowFocus(container: RefObject<HTMLElement | null>, focus: string | readonly string[] | undefined, enabled = true): string[] {
  // A new array each render must not re-run the effect, so it keys on the names.
  const focusKey = focus === undefined ? undefined : JSON.stringify(typeof focus === 'string' ? [focus] : focus)
  const [names, setNames] = useState<string[]>([])
  useLayoutEffect(() => {
    const element = container.current
    if (!element || !enabled) return
    const apply = () => {
      observer.disconnect()
      const rows = readRows(element)
      const next = rows.map((row) => row.name)
      setNames((current) => (same(current, next) ? current : next))
      const keep = focusKey === undefined ? undefined : (JSON.parse(focusKey) as string[])
      showOnly(element, keep && rows.filter((row) => keep.includes(row.name)).flatMap((row) => row.elements))
      observer.observe(element, { childList: true, subtree: true })
    }
    const observer = new MutationObserver(apply)
    apply()
    return () => {
      observer.disconnect()
      showOnly(element, undefined)
    }
  }, [container, focusKey, enabled])
  return names
}
