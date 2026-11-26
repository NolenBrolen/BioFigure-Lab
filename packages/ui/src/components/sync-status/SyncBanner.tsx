/*
 * The banner across the top of the start screen while figures made on this device before signing in go into the
 * account (BIO-33, draft B picked 2026-11-24): "Syncing 3 of 5 figures…" with a progress line and Cancel.
 */
import { Cloud } from 'lucide-react'

import { Button } from '../button/Button'

export type SyncBannerProps = {
  done: number
  total: number
  onCancel: () => void
}

export function SyncBanner({ done, total, onCancel }: SyncBannerProps) {
  const label = `Syncing ${Math.min(done + 1, total)} of ${total} ${total === 1 ? 'figure' : 'figures'} to your account…`
  return (
    <div className="flex items-center gap-3 border-b bg-primary-subtle px-6 py-2 text-sm text-primary-subtle-foreground">
      <Cloud className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
      <div className="min-w-48 space-y-1">
        <div className="text-xs" role="status">
          {label}
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-primary/15" role="progressbar" aria-label="Syncing figures" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
          <div className="h-full rounded-full bg-primary transition-[width] duration-(--duration-fast)" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
        </div>
      </div>
      <Button size="sm" variant="ghost" className="ml-auto" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  )
}
