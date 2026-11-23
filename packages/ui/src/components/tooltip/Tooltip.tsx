/*
 * Tooltip: a short label that appears when you hover or keyboard-focus
 * something, mostly icon-only buttons. It can show a keyboard shortcut.
 * A small white card with a border and a pointer to what it belongs to.
 *
 * Built on Base UI's Tooltip. Structure based on shadcn/ui (MIT, see
 * THIRD_PARTY_NOTICES.md).
 */
import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip'
import type { ReactElement, ReactNode } from 'react'

import { cn } from '../../lib/cn'
import { formatShortcut } from '../../lib/shortcut'

/**
 * Put this once around the app. The first tooltip waits a fifth of a second;
 * moving to a neighbouring button shows the next one straight away.
 */
export function TooltipProvider({ delay = 200, closeDelay = 0, ...props }: TooltipPrimitive.Provider.Props) {
  return <TooltipPrimitive.Provider delay={delay} closeDelay={closeDelay} {...props} />
}

export type TooltipProps = {
  /** What the tooltip says. Keep it to a few words. */
  label: ReactNode
  /** A keyboard shortcut written like "Mod+Shift+Z" ("Mod" is Ctrl, or ⌘ on a Mac). */
  shortcut?: string
  /** The element that shows the tooltip, usually a button. */
  children: ReactElement
  side?: 'top' | 'bottom' | 'left' | 'right'
  /** Start open. Only for Storybook and tests. */
  defaultOpen?: boolean
  /** Don't show it, e.g. when the label is already written on the button. */
  disabled?: boolean
  /** Shown or hidden from outside, e.g. on a tap (phones have no hover). With `onOpenChange`. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** A sentence rather than a few words: it may wrap onto more lines. */
  multiline?: boolean
}

export function Tooltip({ label, shortcut, children, side = 'bottom', defaultOpen, disabled, open, onOpenChange, multiline = false }: TooltipProps) {
  return (
    <TooltipPrimitive.Root defaultOpen={defaultOpen} disabled={disabled} open={open} onOpenChange={onOpenChange ? (next) => onOpenChange(next) : undefined}>
      <TooltipPrimitive.Trigger render={children} />
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner side={side} sideOffset={8} collisionPadding={12} className="z-50">
          <TooltipPrimitive.Popup
            className={cn(
              'flex items-center gap-2 rounded-md border bg-tooltip px-2.5 py-1.5 text-xs text-tooltip-foreground shadow-md select-none',
              multiline ? 'max-w-64 whitespace-normal' : 'whitespace-nowrap',
              'transition-[opacity,scale] duration-(--duration-fast) ease-enter',
              'data-ending-style:opacity-0 data-instant:duration-0 data-starting-style:scale-95 data-starting-style:opacity-0',
              // Grow out of the button it belongs to.
              'data-[side=bottom]:origin-top data-[side=left]:origin-right data-[side=right]:origin-left data-[side=top]:origin-bottom',
            )}
          >
            <span>{label}</span>
            {shortcut && <kbd className="font-sans font-normal text-muted-foreground">{formatShortcut(shortcut)}</kbd>}
            <TooltipPrimitive.Arrow
              className={cn(
                'size-2.5 rotate-45 border-border bg-tooltip',
                'data-[side=bottom]:-top-[5px] data-[side=bottom]:border-t data-[side=bottom]:border-l',
                'data-[side=top]:-bottom-[5px] data-[side=top]:border-r data-[side=top]:border-b',
                'data-[side=left]:-right-[5px] data-[side=left]:border-t data-[side=left]:border-r',
                'data-[side=right]:-left-[5px] data-[side=right]:border-b data-[side=right]:border-l',
              )}
            />
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}
