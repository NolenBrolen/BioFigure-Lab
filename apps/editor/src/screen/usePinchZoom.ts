/*
 * Two fingers on the canvas (phones, BIO-11). With something selected,
 * pinching resizes it, keeping its proportions (one undo step when the
 * fingers lift); the page stays put. With nothing selected, pinching zooms
 * the page around the point between the fingers, and moving both fingers
 * pans it (owner's call, 2026-11-17). One finger stays with the canvas, to
 * select and move objects.
 *
 * Zooming feels like an iPhone app (2026-11-17): while the fingers move the
 * page is only stretched on screen (a CSS transform, smooth at any size);
 * when they lift, the canvas is drawn once at the new zoom and springs into
 * place. Past fit and the largest zoom the page gives with resistance and
 * springs back; letting go below or near fit springs to fit (see
 * pinch-zoom.ts).
 */
import { useEffect, type RefObject } from 'react'

import type { FigureCanvas } from '../editor/FigureCanvas'
import { MAX_ZOOM } from '../editor/units'
import { placeAt, rubberBand, settleZoom } from './pinch-zoom'

type Point = { x: number; y: number }

/** The spring when the fingers lift: a short ease with a little overshoot. */
const SPRING = 'transform 420ms cubic-bezier(0.25, 1.25, 0.4, 1)'
const SPRING_MS = 420
/** Taps and menus are ignored this long after a two-finger gesture ends, in ms: lifting the fingers isn't a tap. */
const AFTER_GESTURE_MS = 500

/**
 * The right-click menu opens on a long press and cancels itself when it sees
 * a second finger, but the second finger is kept from the canvas below; the
 * cancel sent to the menu instead is not the end of a pinch.
 */
const menuCancels = new WeakSet<Event>()

/** Where finger `i` is on screen (callers check there are two). */
const finger = (touches: TouchList, i: number): Point => {
  const one = touches.item(i)
  return { x: one?.clientX ?? 0, y: one?.clientY ?? 0 }
}
const middle = (touches: TouchList): Point => {
  const [a, b] = [finger(touches, 0), finger(touches, 1)]
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}
const spread = (touches: TouchList) => {
  const [a, b] = [finger(touches, 0), finger(touches, 1)]
  return Math.hypot(a.x - b.x, a.y - b.y)
}

const stretch = (frame: HTMLElement, x: number, y: number, scale: number) => {
  frame.style.transform = `translate(${x}px, ${y}px) scale(${scale})`
}
const unstretch = (frame: HTMLElement) => {
  frame.style.transition = ''
  frame.style.transform = ''
  frame.style.transformOrigin = ''
  frame.style.willChange = ''
}

/**
 * `fitZoom` gives the zoom that fits the page in view, the smallest a pinch
 * settles on.
 */
export function usePinchZoom(
  viewport: RefObject<HTMLElement | null>,
  canvasHost: RefObject<HTMLElement | null>,
  figure: FigureCanvas | null,
  enabled: boolean,
  fitZoom: () => number | undefined,
) {
  useEffect(() => {
    const space = viewport.current
    if (!space || !figure || !enabled) return
    type Pinch = { spread: number; zoom: number; mid: Point; frame: HTMLElement; corner: DOMRect; fit: number; shown: number }
    let start: { resizing: true; spread: number } | ({ resizing: false } & Pinch) | undefined
    // What was selected before the first finger landed: a finger beside the selection lets go of it before the second one arrives.
    let selectedBefore = figure.selectedObjects()
    let springTimer: ReturnType<typeof setTimeout> | undefined
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    // Two or more fingers anywhere on screen, and when the last such gesture ended.
    let gesture = false
    let gestureEnded = Number.NEGATIVE_INFINITY
    const cancelLongPress = () => {
      const cancel = new Event('touchcancel', { bubbles: true })
      menuCancels.add(cancel)
      space.dispatchEvent(cancel)
    }

    const frameOf = () => canvasHost.current?.parentElement ?? undefined
    // A new pinch during the spring starts from where the page is headed.
    const endSpring = () => {
      clearTimeout(springTimer)
      const frame = frameOf()
      if (frame) unstretch(frame)
    }

    const onStart = (event: TouchEvent) => {
      // Runs before the canvas sees the finger (capture phase).
      const selected = figure.selectedObjects()
      if (event.touches.length === 1) selectedBefore = selected
      if (event.touches.length !== 2) return
      // The canvas would take the second finger for a tap of its own, and a tap beside the selection lets go of it.
      event.stopPropagation()
      cancelLongPress()
      // Both fingers can land at once: then what is selected now counts (bug: it used what was selected before the tap that selected it).
      const pinched = event.changedTouches.length >= 2 ? selected : selectedBefore
      if (figure.startPinch(pinched)) {
        start = { resizing: true, spread: spread(event.touches) }
        return
      }
      endSpring()
      const frame = frameOf()
      if (!frame) return
      figure.setZooming(true)
      frame.style.transformOrigin = '0 0'
      frame.style.willChange = 'transform'
      const zoom = figure.zoom
      start = { resizing: false, spread: spread(event.touches), zoom, mid: middle(event.touches), frame, corner: frame.getBoundingClientRect(), fit: fitZoom() ?? zoom, shown: zoom }
    }

    const onMove = (event: TouchEvent) => {
      if (!start || event.touches.length !== 2) return
      // Keeps the browser from zooming the whole app, and the canvas from also dragging.
      event.preventDefault()
      event.stopPropagation()
      if (start.resizing) return figure.pinchTo(spread(event.touches) / start.spread)
      const raw = (start.zoom * spread(event.touches)) / start.spread
      start.shown = rubberBand(raw, Math.min(start.fit, start.zoom), MAX_ZOOM)
      const scale = start.shown / start.zoom
      // The page point first under the fingers stays under them as they move.
      const now = middle(event.touches)
      const { x, y } = placeAt({ left: now.x, top: now.y }, { left: start.mid.x, top: start.mid.y }, start.corner, scale)
      stretch(start.frame, x, y, scale)
    }

    const settle = ({ frame, fit, shown, zoom }: Pinch) => {
      figure.setZooming(false)
      const host = canvasHost.current
      if (!host) return unstretch(frame)
      const target = settleZoom(shown, fit, MAX_ZOOM)
      // Where the page is on screen now, stretched.
      const seen = host.getBoundingClientRect()
      unstretch(frame)
      if (Math.abs(target - zoom) > 0.0001) figure.setZoom(target)
      // Scroll so the page stays where it was seen, shrunk or grown about the middle of the view when it settles on
      // another zoom. The browser keeps the scroll in range, so a page panned past its edge springs back too.
      const drawn = host.getBoundingClientRect()
      const view = space.getBoundingClientRect()
      const ratio = target / shown
      const centre = { x: view.left + view.width / 2, y: view.top + view.height / 2 }
      space.scrollLeft += drawn.left - (centre.x + (seen.left - centre.x) * ratio)
      space.scrollTop += drawn.top - (centre.y + (seen.top - centre.y) * ratio)
      if (reducedMotion?.matches) return
      // Then spring from where it was seen to where it now is.
      const placed = host.getBoundingClientRect()
      const scale = seen.width / placed.width
      frame.style.transformOrigin = '0 0'
      const { x, y } = placeAt(seen, placed, frame.getBoundingClientRect(), scale)
      stretch(frame, x, y, scale)
      void frame.offsetWidth
      frame.style.transition = SPRING
      frame.style.transform = ''
      springTimer = setTimeout(() => unstretch(frame), SPRING_MS + 50)
    }

    const onEnd = (event: TouchEvent) => {
      if (menuCancels.has(event) || event.touches.length >= 2 || !start) return
      if (start.resizing) figure.endPinch()
      else settle(start)
      start = undefined
    }

    // Anywhere on screen, a finger on the quick-actions bar included.
    const onAnyStart = (event: TouchEvent) => {
      if (event.touches.length >= 2) gesture = true
    }
    const onAnyEnd = (event: TouchEvent) => {
      if (!gesture || menuCancels.has(event) || event.touches.length > 0) return
      gesture = false
      gestureEnded = event.timeStamp
    }
    const swallow = (event: Event) => {
      if (!gesture && event.timeStamp - gestureEnded > AFTER_GESTURE_MS) return
      event.preventDefault()
      event.stopPropagation()
    }
    window.addEventListener('touchstart', onAnyStart, { capture: true, passive: true })
    window.addEventListener('touchend', onAnyEnd, { capture: true, passive: true })
    window.addEventListener('touchcancel', onAnyEnd, { capture: true, passive: true })
    window.addEventListener('click', swallow, { capture: true })
    window.addEventListener('contextmenu', swallow, { capture: true })
    space.addEventListener('touchstart', onStart, { capture: true, passive: true })
    space.addEventListener('touchmove', onMove, { capture: true, passive: false })
    space.addEventListener('touchend', onEnd, { capture: true })
    space.addEventListener('touchcancel', onEnd, { capture: true })
    return () => {
      endSpring()
      window.removeEventListener('touchstart', onAnyStart, { capture: true })
      window.removeEventListener('touchend', onAnyEnd, { capture: true })
      window.removeEventListener('touchcancel', onAnyEnd, { capture: true })
      window.removeEventListener('click', swallow, { capture: true })
      window.removeEventListener('contextmenu', swallow, { capture: true })
      space.removeEventListener('touchstart', onStart, { capture: true })
      space.removeEventListener('touchmove', onMove, { capture: true })
      space.removeEventListener('touchend', onEnd, { capture: true })
      space.removeEventListener('touchcancel', onEnd, { capture: true })
    }
  }, [viewport, canvasHost, figure, enabled, fitZoom])
}
