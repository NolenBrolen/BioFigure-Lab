/*
 * Where the figure is saved, in the editor's top bar (BIO-33, picked 2026-11-24: the text of draft A, the icons
 * of draft D, and a tooltip with the details as in draft B). Signed out it says "Saved" as before.
 *
 *   local     signed out: saved in this browser
 *   synced    on the server: every device has it
 *   syncing   uploading now
 *   waiting   saved on this device; uploads when the connection is back
 *   failed    the server keeps refusing; a click tries again
 *   blocked   the browser blocks storage: nothing is saved
 */
import { Check, CircleAlert, Laptop, LoaderCircle, type LucideIcon } from 'lucide-react'

import { cn } from '../../lib/cn'
import { Tooltip } from '../tooltip/Tooltip'

export type SyncState = 'local' | 'synced' | 'syncing' | 'waiting' | 'failed' | 'blocked'

const LOOK: Record<SyncState, { icon: LucideIcon; text: string; detail: string; tone?: string; spin?: boolean }> = {
  local: { icon: Check, text: 'Saved', detail: 'Saved in this browser. Sign in to have your figures on every device.' },
  synced: { icon: Check, text: 'Saved', detail: 'Saved to your account. Open it on any device where you sign in.' },
  syncing: { icon: LoaderCircle, text: 'Saving…', detail: 'Saving to your account…', spin: true },
  waiting: { icon: Laptop, text: 'Saved on this device', detail: 'Saved on this device. Your changes go to your account when you’re back online.' },
  failed: { icon: CircleAlert, text: 'Not synced', detail: 'Couldn’t save to your account. Your work is safe on this device. Click to try again.', tone: 'text-destructive-text' },
  blocked: { icon: CircleAlert, text: 'Not saved', detail: 'The browser blocks storage, so this figure can’t be saved. Allow site data for this page.', tone: 'text-destructive-text' },
}

export type SyncStatusProps = {
  state: SyncState
  /** Phones: the icon only (the words stay for screen readers). */
  compact?: boolean
  /** Try again, offered in the `failed` state. */
  onRetry?: () => void
}

export function SyncStatus({ state, compact = false, onRetry }: SyncStatusProps) {
  const { icon: Icon, text, detail, tone, spin } = LOOK[state]
  const retry = state === 'failed' && onRetry
  return (
    <Tooltip label={detail} multiline>
      <button
        type="button"
        // A plain label unless it can try again; still focusable, so keyboard users can read the tooltip.
        onClick={retry ? onRetry : undefined}
        aria-disabled={retry ? undefined : true}
        className={cn(
          'flex shrink-0 items-center gap-1 rounded-sm px-1 text-xs text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring',
          retry ? 'cursor-pointer hover:underline' : 'cursor-default',
          tone,
        )}
      >
        <Icon className={cn('size-3.5', spin && 'animate-spin motion-reduce:animate-none')} strokeWidth={2} aria-hidden="true" />
        <span role="status" className={cn(compact && 'sr-only')}>
          {text}
        </span>
      </button>
    </Tooltip>
  )
}
