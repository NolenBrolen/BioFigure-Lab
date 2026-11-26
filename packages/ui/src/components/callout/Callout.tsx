/*
 * Callout: a short message in a tinted box inside a panel, for something the
 * user should notice before going on, such as a chart whose brackets don't
 * fit. A warning is soft yellow with a warning sign; the text keeps the
 * panel's own colour, so it stays easy to read in light and dark mode.
 *
 * It says what is wrong and what to do about it; it never blocks anything.
 */
import { TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '../../lib/cn'

export type CalloutProps = {
  children: ReactNode
  /** Only warnings for now; other tones can join when a feature needs one. */
  tone?: 'warning'
  className?: string
}

export function Callout({ children, tone = 'warning', className }: CalloutProps) {
  return (
    <div
      role="note"
      data-tone={tone}
      className={cn('flex items-start gap-2 rounded-md border border-warning-border bg-warning-surface px-2.5 py-2 text-xs leading-snug text-foreground', className)}
    >
      <TriangleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0 text-warning" />
      <div className="min-w-0">{children}</div>
    </div>
  )
}
