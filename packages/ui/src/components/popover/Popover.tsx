/*
 * Popover: a small panel that opens from a button and stays open while you
 * work in it, like the colour picker next to a swatch or the filter options
 * of the icon library. A light card with a title bar, a close button and a
 * line under the title. Clicking outside or pressing Escape closes it, and
 * focus goes back to the button.
 *
 * Inside `ExpandedControls` (the phone's sheet with one setting open) there
 * is no popup: the contents show in place, under a small title, on a line of
 * their own, so every option is in view without a ⋯ button.
 *
 * Built on Base UI's Popover.
 */
import { Popover as PopoverPrimitive } from '@base-ui/react/popover'
import { X } from 'lucide-react'
import type { ReactElement, ReactNode } from 'react'

import { cn } from '../../lib/cn'
import { useExpandedControls } from '../../lib/expanded-controls'

export type PopoverProps = {
  /** Shown in the title bar; also names the panel for screen readers. */
  title: string
  /** The button that opens it. */
  trigger: ReactElement
  children: ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  align?: 'start' | 'center' | 'end'
  /** Moves the panel along its side from where `align` puts it, in pixels; a function gets the trigger's and the panel's sizes. */
  alignOffset?: number | ((sizes: { anchor: { width: number; height: number }; positioner: { width: number; height: number } }) => number)
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Start open. Only for Storybook and tests. */
  defaultOpen?: boolean
  /** Sizes the panel, e.g. "w-64". */
  className?: string
  /** A line under the title bar (on by default). */
  divider?: boolean
}

/**
 * Whether leaving the popover went to a part of the page marked
 * `data-keeps-popups-open` (the development debug panel), so the popover can
 * stay open while its look is tuned there.
 */
function leftForKeeper(event: Event): boolean {
  const to = event instanceof FocusEvent ? event.relatedTarget : event.target
  return to instanceof Element && to.closest('[data-keeps-popups-open]') !== null
}

export function Popover({ title, trigger, children, side = 'bottom', align = 'start', alignOffset, open, onOpenChange, defaultOpen, className, divider = true }: PopoverProps) {
  const expanded = useExpandedControls()
  if (expanded) {
    return (
      <div role="group" aria-label={title} className="col-span-full flex min-w-0 basis-full flex-col gap-1.5 pt-1">
        <span className="text-xs text-muted-foreground">{title}</span>
        {children}
      </div>
    )
  }
  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next, details) => {
        if (!next && (details.reason === 'outside-press' || details.reason === 'focus-out') && leftForKeeper(details.event)) return details.cancel()
        onOpenChange?.(next)
      }}
      defaultOpen={defaultOpen}
    >
      <PopoverPrimitive.Trigger render={trigger} />
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner side={side} align={align} alignOffset={alignOffset} sideOffset={6} className="z-50">
          <PopoverPrimitive.Popup
            className={cn(
              'rounded-md border bg-popover text-sm text-popover-foreground shadow-lg outline-none',
              'origin-(--transform-origin) transition-[opacity,scale] duration-(--duration-fast) ease-enter',
              'data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0',
              className,
            )}
          >
            <div className={cn('flex h-9 items-center justify-between pr-1.5 pl-3', divider && 'border-b')}>
              <PopoverPrimitive.Title className="font-medium">{title}</PopoverPrimitive.Title>
              <PopoverPrimitive.Close
                aria-label="Close"
                className="grid size-6 place-items-center rounded-sm text-muted-foreground transition-colors duration-(--duration-instant) hover:bg-accent hover:text-foreground"
              >
                <X className="size-3.5" strokeWidth={2} aria-hidden="true" />
              </PopoverPrimitive.Close>
            </div>
            <div className={cn('p-3', !divider && 'pt-0')}>{children}</div>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
