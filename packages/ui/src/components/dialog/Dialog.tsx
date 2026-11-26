/*
 * Dialog: a window over the editor for a task that needs a few choices
 * first. The main action sits bottom right, Cancel next to it. Escape or
 * the close × closes it; focus stays inside while it's open.
 *
 * Two placements:
 *   side   – a full-height panel from the right edge, for tasks where you
 *            check the figure while choosing, like Export. The figure stays
 *            visible next to it.
 *   center – a roomy card in the middle, for short questions where the
 *            figure doesn't matter, like New figure.
 *
 * A dialog that starts a slow task closes straight away; the task carries on
 * in a progress toast with a Cancel button.
 *
 * The buttons at the bottom are optional: a dialog that has its buttons inside
 * its content (like Sign in, with a button per step) leaves `actions` out and
 * no footer is drawn.
 *
 * Built on Base UI's Dialog.
 */
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { cva } from 'class-variance-authority'
import { X } from 'lucide-react'
import type { ReactElement, ReactNode } from 'react'

import { cn } from '../../lib/cn'

export type DialogPlacement = 'center' | 'side'
export type DialogSize = 'narrow' | 'default' | 'wide'

const popupVariants = cva(
  [
    'fixed z-50 flex flex-col bg-panel text-sm text-foreground shadow-xl outline-none',
    'transition-[opacity,scale,translate,width] [transition-duration:var(--duration-base),var(--duration-base),var(--duration-base),200ms] ease-enter data-ending-style:opacity-0 data-starting-style:opacity-0',
  ],
  {
    variants: {
      placement: {
        center: 'top-1/2 left-1/2 max-h-[calc(100dvh-2rem)] -translate-1/2 rounded-lg border data-ending-style:scale-95 data-starting-style:scale-95',
        side: 'top-0 right-0 h-full w-[28rem] max-w-full border-l data-ending-style:translate-x-full data-starting-style:translate-x-full',
      },
      // Width of a centred dialog: `narrow` for short forms, `wide` for content that needs room, like a table with options beside it.
      size: {
        narrow: '',
        default: '',
        wide: '',
      },
    },
    compoundVariants: [
      { placement: 'center', size: 'narrow', className: 'w-[min(26rem,calc(100vw-2rem))]' },
      { placement: 'center', size: 'default', className: 'w-[min(36rem,calc(100vw-2rem))]' },
      { placement: 'center', size: 'wide', className: 'w-[min(64rem,calc(100vw-2rem))]' },
    ],
    defaultVariants: {
      size: 'default',
    },
  },
)

export type DialogProps = {
  title: string
  description?: ReactNode
  /** The button that opens it. Leave out when you control `open` yourself. */
  trigger?: ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** The buttons at the bottom, main action last. Leave out for no footer. */
  actions?: ReactNode
  children?: ReactNode
  placement?: DialogPlacement
  /** A band under the header, outside the scrolling body, e.g. the icon a report is about. */
  headerExtra?: ReactNode
  /** Extra classes for the window, e.g. a wider `w-[38rem]` for a long form. */
  className?: string
  /** Width of a centred dialog: `narrow` (26 rem) for short forms like Sign in, `wide` (about 64 rem) for content like a table. Ignored on the side. */
  size?: DialogSize
  /** What gets the keyboard cursor when it opens. Default: the first control. */
  initialFocus?: DialogPrimitive.Popup.Props['initialFocus']
}

/** Wrap a button in this to make it close the dialog, e.g. Cancel. */
export const DialogClose = DialogPrimitive.Close

export function Dialog({ title, description, trigger, open, onOpenChange, actions, children, placement = 'center', size = 'default', initialFocus, headerExtra, className }: DialogProps) {
  const side = placement === 'side'
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogPrimitive.Trigger render={trigger} />}
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className={cn(
            'fixed inset-0 z-50 transition-opacity duration-(--duration-base) data-ending-style:opacity-0 data-starting-style:opacity-0',
            // Light on the side, so the figure stays easy to check.
            side ? 'bg-black/10' : 'bg-black/30',
          )}
        />
        <DialogPrimitive.Popup initialFocus={initialFocus} className={cn(popupVariants({ placement, size }), className)}>
          <div className={cn('flex items-start justify-between gap-3', side ? 'border-b p-4' : 'px-6 pt-6 max-md:px-4')}>
            <div>
              <DialogPrimitive.Title className="text-base font-semibold">{title}</DialogPrimitive.Title>
              {description && <DialogPrimitive.Description className="mt-1 text-muted-foreground">{description}</DialogPrimitive.Description>}
            </div>
            <DialogPrimitive.Close
              aria-label="Close"
              className="grid size-6 shrink-0 place-items-center rounded-sm text-muted-foreground transition-colors duration-(--duration-instant) hover:bg-accent hover:text-foreground"
            >
              <X className="size-4" strokeWidth={1.75} aria-hidden="true" />
            </DialogPrimitive.Close>
          </div>
          {headerExtra}
          <div className={cn('flex min-h-0 flex-col gap-4 overflow-y-auto', side ? 'flex-1 p-4' : 'px-6 pt-5 max-md:px-4', !actions && !side && 'pb-6 max-md:pb-4')}>{children}</div>
          {actions && <div className={cn('flex justify-end gap-2', side ? 'border-t p-4' : 'px-6 pt-7 pb-6 max-md:px-4 max-md:pt-5 max-md:pb-4')}>{actions}</div>}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
