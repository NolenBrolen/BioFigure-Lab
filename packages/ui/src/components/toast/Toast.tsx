/*
 * Toast: a short message at the bottom right that says something happened,
 * like "Deleted · 2 objects · Undo", without stopping your work. A light card
 * with everything on one line. It can also show the progress of a slow task,
 * such as an export, as a thin blue line along its bottom edge, with a
 * Cancel button. Messages go away by themselves after a few seconds; a
 * progress toast stays until the task is done. F6 jumps to the toasts from
 * the keyboard.
 *
 * On a phone the toast is bigger and easier to spot: the screen's full width,
 * just above the bottom bar, with the title over the detail and a large Undo
 * (or other) button (owner's call, 2026-11-17).
 *
 * Built on Base UI's Toast.
 */
import { Toast as ToastPrimitive } from '@base-ui/react/toast'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '../../lib/cn'
import { usePhoneLayout } from '../../lib/use-media-query'

export type ToastData = {
  /** 0 to 1. Shows a progress line; give the toast `timeout: 0` so it stays. */
  progress?: number
  /** A picture or icon shown before the title, e.g. a green tick. */
  lead?: ReactNode
  /** Let a long detail wrap onto more lines instead of being cut off (desktop only). */
  wrap?: boolean
}

/** Put this once around the app, with a `ToastViewport` inside. */
export function ToastProvider({ children }: { children: ReactNode }) {
  return <ToastPrimitive.Provider timeout={6000}>{children}</ToastPrimitive.Provider>
}

/** Shows, updates and closes toasts: `add`, `update`, `close`. */
export function useToast() {
  return ToastPrimitive.useToastManager<ToastData>()
}

export type ToastViewportProps = {
  /** Keep the toasts inside the nearest positioned box instead of the window. Only for Storybook. */
  contained?: boolean
}

/** Where the toasts appear. Put it once inside `ToastProvider`. */
export function ToastViewport({ contained }: ToastViewportProps) {
  const { toasts } = useToast()
  const phone = usePhoneLayout()
  const viewport = (
    <ToastPrimitive.Viewport
      className={cn(
        // Above dialogs (z-50) and their dimmed backdrop, so a message about the open dialog is seen
        'z-60 flex flex-col items-end gap-2 outline-none',
        phone ? 'inset-x-3 bottom-[calc(var(--mobile-bar-height)+env(safe-area-inset-bottom,0px)+0.75rem)]' : 'right-4 bottom-4 w-[26rem] max-w-[calc(100%-2rem)]',
        contained ? 'absolute' : 'fixed',
      )}
    >
      {toasts.map((toast) => {
        const progress = toast.data?.progress
        const lead = toast.data?.lead
        const wrap = Boolean(toast.data?.wrap) && !phone
        return (
          <ToastPrimitive.Root
            key={toast.id}
            toast={toast}
            className={cn(
              'relative w-full overflow-hidden border bg-popover text-sm text-popover-foreground shadow-lg',
              phone ? 'rounded-xl py-2.5 pr-2 pl-4' : 'rounded-md py-1.5 pr-1.5 pl-3',
              'transition-[opacity,translate] duration-(--duration-base) ease-enter data-ending-style:opacity-0 data-starting-style:translate-y-2 data-starting-style:opacity-0',
            )}
          >
            <ToastPrimitive.Content className={cn('flex', wrap ? 'items-start' : 'items-center', phone ? 'gap-2' : 'gap-3')}>
              {lead && <span className={cn('shrink-0', wrap && 'mt-0.5')}>{lead}</span>}
              {phone ? (
                <div className="flex min-w-0 flex-1 flex-col">
                  <ToastPrimitive.Title className="truncate text-[0.9375rem] font-semibold" />
                  <ToastPrimitive.Description className="truncate text-xs text-muted-foreground" />
                </div>
              ) : wrap ? (
                <div className="flex min-w-0 flex-1 flex-col">
                  <ToastPrimitive.Title className="font-medium" />
                  <ToastPrimitive.Description className="text-xs text-muted-foreground" />
                </div>
              ) : (
                <>
                  <ToastPrimitive.Title className="font-medium whitespace-nowrap" />
                  <ToastPrimitive.Description className="flex-1 truncate text-xs text-muted-foreground" />
                </>
              )}
              {toast.actionProps && (
                <ToastPrimitive.Action
                  className={cn(
                    'shrink-0 rounded-md font-medium text-primary-subtle-foreground transition-colors duration-(--duration-instant) hover:bg-primary-subtle',
                    phone ? 'h-11 bg-primary-subtle px-4 text-[0.9375rem] font-semibold' : 'h-6 px-2',
                  )}
                />
              )}
              <ToastPrimitive.Close
                aria-label="Close"
                className={cn(
                  'grid shrink-0 place-items-center rounded-sm text-muted-foreground transition-colors duration-(--duration-instant) hover:bg-accent hover:text-foreground',
                  phone ? 'size-11 rounded-md' : 'size-6',
                )}
              >
                <X className={phone ? 'size-4' : 'size-3.5'} strokeWidth={2} aria-hidden="true" />
              </ToastPrimitive.Close>
            </ToastPrimitive.Content>
            {progress !== undefined && (
              <div
                role="progressbar"
                aria-label="Progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress * 100)}
                className="absolute inset-x-0 bottom-0 h-0.5 bg-muted"
              >
                <div className="h-full bg-primary transition-[width] duration-(--duration-base)" style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
            )}
          </ToastPrimitive.Root>
        )
      })}
    </ToastPrimitive.Viewport>
  )
  return contained ? viewport : <ToastPrimitive.Portal>{viewport}</ToastPrimitive.Portal>
}
