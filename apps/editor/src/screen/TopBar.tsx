/*
 * Top bar: back, figure name, Saved on the left; while something is selected
 * the Arrange group, lined up with the left edge of the canvas; Undo, Redo,
 * Export on the right.
 */
import { Button } from '@biofigure-lab/ui/components/button/Button'
import { IconButton } from '@biofigure-lab/ui/components/icon-button/IconButton'
import { SyncStatus as SyncStatusView } from '@biofigure-lab/ui/components/sync-status/SyncStatus'
import { cn } from '@biofigure-lab/ui/lib/cn'
import { ChevronLeft, History, MessageSquare, Moon, Redo2, Share, Share2, Sun, Undo2, UserPlus } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { site } from '../site/site'
import { DEFAULT_NAME } from '../editor/storage'
import type { FigureSync } from '../site/types'

type TopBarProps = {
  name: string
  onRename: (name: string) => void
  onBack: () => void
  saveFailed: boolean
  /** Figure sync's status while signed in (undefined when signed out: saved in this browser only). */
  sync?: FigureSync['status']
  /** Try syncing again (the status's click when it failed). */
  onRetrySync?: () => void
  /** Opens the Share dialog; no Share button without it (signed out). */
  onShare?: () => void
  /** Who else has the figure open, beside Undo. */
  presence?: ReactNode
  /** Opens or closes the slide's version history (BIO-36); no History button without it. */
  onHistory?: () => void
  historyOpen?: boolean
  /** Who you are on a figure opened through its share link ("Visitor 1"), left of the account button. */
  you?: ReactNode
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onExport: () => void
  /** Opens the feedback dialog. Leave out when there is none: no Feedback button. */
  onFeedback?: () => void
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  /** The Arrange group, while something is selected. */
  arrange?: ReactNode
  /** The phone layout: no theme switch, Export as an icon, and the name takes what room is left. */
  compact?: boolean
}

export function TopBar({ name, onRename, onBack, saveFailed, sync, onRetrySync, onShare, presence, onHistory, historyOpen = false, you, canUndo, canRedo, onUndo, onRedo, onExport, onFeedback, theme, onToggleTheme, arrange, compact = false }: TopBarProps) {
  return (
    <header className={cn('flex items-center gap-1 bg-panel px-2', !compact && 'col-span-3')}>
      {/* At least as wide as the rail and left panel, so the Arrange group starts over the canvas. */}
      <div className={cn('flex items-center gap-1', compact ? 'min-w-0 flex-1' : 'min-w-[calc(var(--rail-width)+1px+var(--panel-left-width)-0.5rem)] shrink-0 pr-3')}>
      <IconButton icon={ChevronLeft} label="Back to your figures" onClick={onBack} />
      {!compact && <div className="mx-1 h-5 w-px bg-border" />}
      <FigureName name={name} onRename={onRename} />
      <SyncStatusView state={saveFailed ? 'blocked' : (sync ?? 'local')} compact={compact} onRetry={onRetrySync} />
      </div>
      {arrange}

      <div className="ml-auto flex shrink-0 items-center gap-1">
        {onFeedback &&
          (compact ? (
            <IconButton icon={MessageSquare} label="Feedback" onClick={onFeedback} />
          ) : (
            <Button variant="ghost" onClick={onFeedback}>
              <MessageSquare className="size-4" strokeWidth={2} aria-hidden="true" />
              Feedback
            </Button>
          ))}
        {!compact && (
          <>
            <IconButton icon={theme === 'dark' ? Sun : Moon} label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} onClick={onToggleTheme} />
            <div className="mx-1 h-5 w-px bg-border" />
          </>
        )}
        {presence}
        {onHistory && !compact && <IconButton icon={History} label="Version history" pressed={historyOpen} onClick={onHistory} />}
        <IconButton icon={Undo2} label="Undo" shortcut="Mod+Z" disabled={!canUndo} onClick={onUndo} />
        <IconButton icon={Redo2} label="Redo" shortcut="Mod+Shift+Z" disabled={!canRedo} onClick={onRedo} />
        <div className="mx-1 h-5 w-px bg-border" />
        {onShare &&
          (compact ? (
            <IconButton icon={UserPlus} label="Share" onClick={onShare} />
          ) : (
            <Button onClick={onShare}>
              <Share2 className="size-4" strokeWidth={2} aria-hidden="true" />
              Share
            </Button>
          ))}
        {compact ? (
          <IconButton icon={Share} label="Export" onClick={onExport} />
        ) : (
          <Button variant="primary" onClick={onExport}>
            Export
          </Button>
        )}
        {site.AccountControl && (
          <>
            <div className="mx-1 h-5 w-px bg-border" />
            {you}
            <site.AccountControl compact={compact} />
          </>
        )}
      </div>
    </header>
  )
}

/** The figure name; click it to rename. Enter or clicking away keeps the new name, Escape cancels. */
function FigureName({ name, onRename }: { name: string; onRename: (name: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  const className = 'h-(--control-height) min-w-0 max-w-80 truncate rounded-md px-2 font-medium'

  if (draft === null) {
    return (
      <button type="button" title="Rename" onClick={() => setDraft(name)} className={`${className} transition-colors duration-(--duration-instant) hover:bg-accent`}>
        {name}
      </button>
    )
  }
  const finish = () => {
    onRename(draft.trim() || DEFAULT_NAME)
    setDraft(null)
  }
  return (
    <input
      aria-label="Figure name"
      autoFocus
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onFocus={(event) => event.target.select()}
      onBlur={finish}
      onKeyDown={(event) => {
        if (event.key === 'Enter') finish()
        if (event.key === 'Escape') setDraft(null)
      }}
      className={`${className} w-64 bg-background ring-1 ring-ring outline-none`}
    />
  )
}
