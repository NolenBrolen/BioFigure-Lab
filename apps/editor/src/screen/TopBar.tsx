/*
 * Top bar: back, figure name, Saved on the left; while something is selected
 * the Arrange group, lined up with the left edge of the canvas; Undo, Redo,
 * Export on the right.
 */
import { Button } from '@biofigure-lab/ui/components/button/Button'
import { IconButton } from '@biofigure-lab/ui/components/icon-button/IconButton'
import { cn } from '@biofigure-lab/ui/lib/cn'
import { Check, ChevronLeft, CircleAlert, Moon, Redo2, Share, Sun, Undo2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { DEFAULT_NAME } from '../editor/storage'

type TopBarProps = {
  name: string
  onRename: (name: string) => void
  onBack: () => void
  saveFailed: boolean
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onExport: () => void
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  /** The Arrange group, while something is selected. */
  arrange?: ReactNode
  /** The phone layout: no theme switch, Export as an icon, and the name takes what room is left. */
  compact?: boolean
}

export function TopBar({ name, onRename, onBack, saveFailed, canUndo, canRedo, onUndo, onRedo, onExport, theme, onToggleTheme, arrange, compact = false }: TopBarProps) {
  return (
    <header className={cn('flex items-center gap-1 bg-panel px-2', !compact && 'col-span-3')}>
      {/* At least as wide as the rail and left panel, so the Arrange group starts over the canvas. */}
      <div className={cn('flex items-center gap-1', compact ? 'min-w-0 flex-1' : 'min-w-[calc(var(--rail-width)+1px+var(--panel-left-width)-0.5rem)] shrink-0 pr-3')}>
      <IconButton icon={ChevronLeft} label="Back to your figures" onClick={onBack} />
      {!compact && <div className="mx-1 h-5 w-px bg-border" />}
      <FigureName name={name} onRename={onRename} />
      <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground" role="status">
        {saveFailed ? (
          <>
            <CircleAlert className="size-3.5" strokeWidth={2} />
            {compact ? <span className="sr-only">Not saved: the browser blocks storage</span> : 'Not saved: the browser blocks storage'}
          </>
        ) : (
          <>
            <Check className="size-3.5" strokeWidth={2} />
            {compact ? <span className="sr-only">Saved</span> : 'Saved'}
          </>
        )}
      </span>
      </div>
      {arrange}

      <div className="ml-auto flex shrink-0 items-center gap-1">
        {!compact && (
          <>
            <IconButton icon={theme === 'dark' ? Sun : Moon} label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} onClick={onToggleTheme} />
            <div className="mx-1 h-5 w-px bg-border" />
          </>
        )}
        <IconButton icon={Undo2} label="Undo" shortcut="Mod+Z" disabled={!canUndo} onClick={onUndo} />
        <IconButton icon={Redo2} label="Redo" shortcut="Mod+Shift+Z" disabled={!canRedo} onClick={onRedo} />
        <div className="mx-1 h-5 w-px bg-border" />
        {compact ? (
          <IconButton icon={Share} label="Export" onClick={onExport} />
        ) : (
          <Button variant="primary" onClick={onExport}>
            Export
          </Button>
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
