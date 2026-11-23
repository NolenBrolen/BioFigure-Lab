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
 * Built on Base UI's Dialog.
 */
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { cva } from 'class-variance-authority'
import { X } from 'lucide-react'
import type { ReactElement, ReactNode } from 'react'

import { cn } from '../../lib/cn'

export type DialogPlacement = 'center' | 'side'

const popupVariants = cva(
  [
    'fixed z-50 flex flex-col bg-panel text-sm text-foreground shadow-xl outline-none',
    'transition-[opacity,scale,translate] duration-(--duration-base) ease-enter data-ending-style:opacity-0 data-starting-style:opacity-0',
  ],
  {
    variants: {
      placement: {
        center: 'top-1/2 left-1/2 max-h-[calc(100dvh-2rem)] w-[min(36rem,calc(100vw-2rem))] -translate-1/2 rounded-lg border data-ending-style:scale-95 data-starting-style:scale-95',
        side: 'top-0 right-0 h-full w-[28rem] max-w-full border-l data-ending-style:translate-x-full data-starting-style:translate-x-full',
      },
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
  /** The buttons at the bottom, main action last. */
  actions: ReactNode
  children?: ReactNode
  placement?: DialogPlacement
}

/** Wrap a button in this to make it close the dialog, e.g. Cancel. */
export const DialogClose = DialogPrimitive.Close

export function Dialog({ title, description, trigger, open, onOpenChange, actions, children, placement = 'center' }: DialogProps) {
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
        <DialogPrimitive.Popup className={popupVariants({ placement })}>
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
          <div className={cn('flex min-h-0 flex-col gap-4 overflow-y-auto', side ? 'flex-1 p-4' : 'px-6 pt-5 max-md:px-4')}>{children}</div>
          <div className={cn('flex justify-end gap-2', side ? 'border-t p-4' : 'px-6 pt-7 pb-6 max-md:px-4 max-md:pt-5 max-md:pb-4')}>{actions}</div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
