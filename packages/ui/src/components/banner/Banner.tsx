/*
 * Banner: a bar across the top of a screen with a short message and a close
 * button, for something the person should notice and can dismiss, such as
 * "Welcome back". It stays until it is closed. A success banner is soft green
 * with a tick; the text keeps the page's own colour, so it reads well in light
 * and dark mode.
 */
import { Check, X } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '../../lib/cn'

export type BannerProps = {
  children: ReactNode
  /** Only success for now; other tones can join when a feature needs one. */
  tone?: 'success'
  /** Called by the close button. Leave out for a banner that can't be closed. */
  onClose?: () => void
  className?: string
}

export function Banner({ children, tone = 'success', onClose, className }: BannerProps) {
  return (
    <div role="status" data-tone={tone} className={cn('flex items-center gap-3 border-b border-success/30 bg-success/10 px-6 py-2 text-sm text-foreground', className)}>
      <Check aria-hidden="true" strokeWidth={2} className="size-4 shrink-0 text-success" />
      <div className="min-w-0 flex-1">{children}</div>
      {onClose && (
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="grid size-6 shrink-0 place-items-center rounded-sm text-muted-foreground transition-colors duration-(--duration-instant) hover:bg-accent hover:text-foreground"
        >
          <X aria-hidden="true" strokeWidth={2} className="size-3.5" />
        </button>
      )}
    </div>
  )
}
