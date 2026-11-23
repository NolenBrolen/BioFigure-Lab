/*
 * PropertyBar: on a phone, the settings of the selected object in one row
 * along the bottom, in place of the tool tabs.
 * Each item opens its settings in a short panel above the bar. Names show in
 * full: an item is as wide as its name. The row
 * sits in the middle while it fits, and starts at the left and scrolls
 * sideways when it doesn't. There is no Done button: tapping empty canvas
 * lets go of the object and brings the tools back (the owner's call).
 *
 * An item that does nothing for now (`off`, like a table's line colour while
 * it has no lines) is faded: a tap says why in a tooltip instead of opening
 * it, and a second tap while that shows goes to the item that can change
 * it (`off.goTo`, like Style) (owner's call, 2026-11-17).
 */
import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type ComponentType } from 'react'

import { cn } from '../../lib/cn'
import { Tooltip } from '../tooltip/Tooltip'

export type PropertyBarItem = {
  id: string
  label: string
  icon: LucideIcon | ComponentType<{ className?: string }>
  /** Faded and not opened: `why` shows on a tap; a second tap opens the item `goTo`. */
  off?: { why: string; goTo?: string }
  /** Opens more items in the bar rather than a panel; a small side arrow beside its icon says so (picked 2026-11-17). */
  opensItems?: boolean
}

export type PropertyBarProps = {
  /** What the bar is for, e.g. "B cell settings". */
  label: string
  items: readonly PropertyBarItem[]
  /** The item whose setting is open. */
  value?: string
  onPick: (id: string) => void
  /** A button before the items that goes back, e.g. from a shape's text items to its Shape and Text buttons. */
  back?: { label: string; onBack: () => void }
  /**
   * Which set of items shows, and the side the new ones slide in from: a new
   * `key` glides them in, one after another (owner's call, 2026-11-17).
   */
  slide?: { key: string; from: 'left' | 'right' }
  className?: string
}

/** How far new items travel, in px, and the gap between one item starting and the next. */
const SLIDE_PX = 24
const STAGGER_MS = 25

export function PropertyBar({ label, items, value, onPick, back, slide, className }: PropertyBarProps) {
  const bar = useRef<HTMLDivElement>(null)
  const shownKey = useRef(slide?.key)
  // A new set of items glides in before it is painted, so the old ones never flash in its place.
  useLayoutEffect(() => {
    if (!slide || slide.key === shownKey.current) return
    shownKey.current = slide.key
    if (!bar.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const offset = slide.from === 'right' ? SLIDE_PX : -SLIDE_PX
    const moving = [...bar.current.querySelectorAll<HTMLElement>('[data-bar-back], [data-bar-item]')]
    moving.forEach((element, index) => {
      element.animate?.([{ opacity: 0, transform: `translateX(${offset}px)` }, { opacity: 1, transform: 'none' }], {
        duration: 200,
        delay: index * STAGGER_MS,
        easing: 'cubic-bezier(0, 0, 0, 1)',
        fill: 'backwards',
      })
    })
  }, [slide])
  // The faded item whose tooltip is showing; it goes again by itself after a while.
  const [told, setTold] = useState<string | null>(null)
  useEffect(() => {
    if (!told) return
    const timer = window.setTimeout(() => setTold(null), 3000)
    return () => window.clearTimeout(timer)
  }, [told])
  return (
    <div ref={bar} role="toolbar" aria-label={label} className={cn('flex h-(--mobile-bar-height) shrink-0 border-t bg-panel pb-[env(safe-area-inset-bottom,0px)]', className)}>
      {/* Stays put at the left while the items scroll. */}
      {back && (
        <button
          type="button"
          data-bar-back
          aria-label={back.label}
          onClick={back.onBack}
          className="flex w-14 shrink-0 flex-col items-center justify-center gap-0.5 border-r text-[11px] font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        >
          <span className="grid h-7 w-11 place-items-center rounded-full">
            <ChevronLeft className="size-5" />
          </span>
          <span className="whitespace-nowrap">Back</span>
        </button>
      )}
      <div className="flex h-full min-w-0 flex-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none]">
        {/* Centred while the items fit; once they don't, the auto margins drop to 0 and the row starts at the left and scrolls. */}
        {/* A little room between items, so longer names like "Properties" don't run into their neighbours. */}
        <div className="mx-auto flex h-full w-max items-stretch gap-2 px-1">
          {items.map(({ id, label: name, icon: Icon, off, opensItems }) => {
            const on = id === value && !off
            const button = (
              <button
                key={id}
                type="button"
                data-bar-item
                aria-pressed={off ? undefined : on}
                aria-disabled={off ? true : undefined}
                aria-description={off?.why}
                onClick={() => {
                  if (!off) onPick(id)
                  else if (told === id) {
                    setTold(null)
                    // Already open, it stays open (tapping an open item would close it).
                    if (off.goTo && off.goTo !== value) onPick(off.goTo)
                  } else setTold(id)
                }}
                className={cn(
                  'flex min-w-16 shrink-0 flex-col px-1.5 items-center justify-center gap-0.5 text-[11px] font-medium outline-none',
                  'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                  on ? 'text-primary-subtle-foreground' : 'text-foreground',
                  off && 'opacity-40',
                )}
              >
                <span className={cn('relative grid h-7 w-11 place-items-center rounded-full transition-colors duration-(--duration-instant)', on && 'bg-primary-subtle')}>
                  <Icon className="size-5" />
                  {opensItems && <ChevronRight aria-hidden="true" className="absolute top-1/2 -right-1 size-3.5 -translate-y-1/2 text-muted-foreground" />}
                </span>
                <span className="whitespace-nowrap">{name}</span>
              </button>
            )
            return off ? (
              // Opened by taps alone and closed by the timer: hovering mustn't count as a first tap, and the tooltip would close itself as the finger comes down for the second.
              <Tooltip key={id} label={off.why} side="top" multiline open={told === id} onOpenChange={() => undefined}>
                {button}
              </Tooltip>
            ) : (
              button
            )
          })}
        </div>
      </div>
    </div>
  )
}
