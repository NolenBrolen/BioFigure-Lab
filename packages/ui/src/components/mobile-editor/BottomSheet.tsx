/*
 * BottomSheet: a panel that slides up from the bottom of its container over
 * what's behind it, the phone version of the editor's side panels. It has
 * a few heights: `half` (the default, so the page stays visible above it),
 * `tall` (all but a strip of the page, for browsing a tool's panel) and
 * `full`; `fit` is as tall as its content, up to `tall`. Drag the handle up for full height, down for half or to close;
 * tapping the handle switches between the two heights. `size="auto"` fits
 * the content instead, for a single setting.
 *
 * The sheet stays mounted while closed (slid out of view and out of reach),
 * so what's inside keeps its state, like the library's search and scroll.
 * It doesn't block the page: the canvas above stays usable.
 */
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'

import { cn } from '../../lib/cn'
import { SheetTitleEnd } from '../../lib/sheet-title'

export type SheetSize = 'half' | 'tall' | 'full' | 'fit' | 'auto'

export type BottomSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The sheet's name for screen readers. */
  label: string
  /** Shown next to the handle, e.g. the open setting's name. */
  title?: ReactNode
  /** Starting height each time it opens. */
  size?: SheetSize
  children: ReactNode
  /** Stays at the bottom while the content scrolls, e.g. a Place button. */
  footer?: ReactNode
  /** How tall the open sheet is, in px (0 when closed), so the page behind it can move up out of its way. */
  onHeightChange?: (px: number) => void
  className?: string
}

/** How far a drag on the handle must go before it counts, in px. */
const DRAG_PX = 60

export function BottomSheet({ open, onOpenChange, label, title, size = 'half', children, footer, onHeightChange, className }: BottomSheetProps) {
  const [expanded, setExpanded] = useState(false)
  const [titleEnd, setTitleEnd] = useState<HTMLElement | null>(null)
  const [wasOpen, setWasOpen] = useState(open)
  // Each opening starts at the asked height.
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setExpanded(false)
  }
  const drag = useRef<{ start: number; id: number } | null>(null)
  // The last press was a drag, so the click that follows it doesn't also switch the height.
  const dragged = useRef(false)
  const [offset, setOffset] = useState(0)

  const sheet = useRef<HTMLElement>(null)
  const reportHeight = useRef(onHeightChange)
  reportHeight.current = onHeightChange
  useEffect(() => {
    const element = sheet.current
    if (!element || !open) {
      reportHeight.current?.(0)
      return
    }
    const report = () => reportHeight.current?.(element.offsetHeight)
    report()
    // Test browsers (jsdom) have no ResizeObserver.
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(report)
    observer.observe(element)
    return () => observer.disconnect()
  }, [open])

  const height = expanded ? 'h-full' : size === 'half' ? 'h-1/2' : size === 'tall' ? 'h-[calc(100%-3.5rem)]' : size === 'full' ? 'h-full' : size === 'fit' ? 'max-h-[calc(100%-3.5rem)]' : 'max-h-[70%]'

  const onDown = (event: PointerEvent<HTMLButtonElement>) => {
    drag.current = { start: event.clientY, id: event.pointerId }
    dragged.current = false
    // Test browsers (jsdom) have no pointer capture.
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }
  const onMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (drag.current?.id !== event.pointerId) return
    setOffset(event.clientY - drag.current.start)
  }
  const onUp = (event: PointerEvent<HTMLButtonElement>) => {
    if (drag.current?.id !== event.pointerId) return
    const moved = event.clientY - drag.current.start
    drag.current = null
    setOffset(0)
    if (Math.abs(moved) < DRAG_PX) return
    dragged.current = true
    if (moved < 0) setExpanded(true)
    else if (expanded && size !== 'full') setExpanded(false)
    else onOpenChange(false)
  }

  return (
    <section
      ref={sheet}
      aria-label={label}
      inert={!open}
      aria-hidden={!open || undefined}
      className={cn(
        'absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-2xl border-t bg-panel shadow-[0_-6px_24px_rgb(0_0_0/0.12)]',
        'transition-[height,translate,visibility] duration-(--duration-slow) ease-out motion-reduce:transition-none',
        height,
        !open && 'invisible translate-y-full',
        className,
      )}
      style={offset ? { translate: `0 ${Math.max(offset, -40)}px`, transition: 'none' } : undefined}
    >
      <button
        type="button"
        aria-label={expanded ? 'Make the panel smaller' : 'Make the panel bigger'}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => {
          drag.current = null
          setOffset(0)
        }}
        onClick={() => {
          // A drag ends in a click too; only a tap (or Enter) switches the height.
          if (!dragged.current) setExpanded(!expanded)
          dragged.current = false
        }}
        className="flex h-7 w-full shrink-0 touch-none items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <span className="h-1.5 w-10 rounded-full bg-border-strong" />
      </button>
      {title && (
        <div className="flex min-h-8 shrink-0 items-center justify-between gap-2 px-4 pb-1">
          <span className="text-sm font-semibold">{title}</span>
          {/* A spot for a small action that belongs with the title, filled from inside the sheet (see lib/sheet-title). */}
          <span ref={setTitleEnd} className="flex items-center empty:hidden" />
        </div>
      )}
      <SheetTitleEnd value={title ? titleEnd : null}>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">{children}</div>
      </SheetTitleEnd>
      {footer && <div className="shrink-0 border-t bg-panel px-4 py-3">{footer}</div>}
    </section>
  )
}
