/*
 * The start screen: New figure, and your figures as pictures, last edited
 * first. No account needed; everything is saved in this browser.
 */
import { Button } from '@biofigure-lab/ui/components/button/Button'
import { IconButton } from '@biofigure-lab/ui/components/icon-button/IconButton'
import { Skeleton } from '@biofigure-lab/ui/components/skeleton/Skeleton'
import { useToast } from '@biofigure-lab/ui/components/toast/Toast'
import { Moon, Plus, Sun, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { keepBrowserDataOnce } from '../editor/keep-data'
import { sizeLabel, type PageMm } from '../editor/page-size'
import type { Figure, FigureStore } from '../editor/storage'
import { NewFigureDialog } from './NewFigureDialog'
import { useTheme } from './useTheme'

type StartScreenProps = {
  store: FigureStore
  /** Done once older saved work has been moved over. */
  ready: Promise<unknown>
  onOpen: (id: string) => void
}

export function StartScreen({ store, ready, onOpen }: StartScreenProps) {
  const [figures, setFigures] = useState<Figure[]>()
  const [failed, setFailed] = useState(false)
  const [theme, toggleTheme] = useTheme()
  const toasts = useToast()

  const reload = useCallback(
    () =>
      ready
        .then(() => store.list())
        .then(setFigures, () => {
          setFigures([])
          setFailed(true)
        }),
    [ready, store],
  )
  useEffect(() => void reload(), [reload])

  const create = (page: PageMm) => {
    void store.create(page).then(
      (figure) => {
        // Now there's a figure worth keeping: ask the browser not to clear it (quietly, once per visit).
        void keepBrowserDataOnce()
        onOpen(figure.id)
      },
      () => setFailed(true),
    )
  }

  const remove = (figure: Figure) => {
    // Gone from the list straight away; Undo brings it back.
    setFigures((list) => list?.filter((item) => item.id !== figure.id))
    void store.remove(figure.id).then(() => {
      const id = toasts.add({
        title: 'Deleted',
        description: figure.name,
        actionProps: {
          children: 'Undo',
          onClick: () => {
            toasts.close(id)
            void store.restore(figure.id).then(reload)
          },
        },
      })
    }, reload)
  }

  const newFigureButton = (
    <Button variant="primary">
      <Plus className="size-4" strokeWidth={2} aria-hidden="true" />
      New figure
    </Button>
  )

  return (
    <div className="flex h-screen flex-col bg-background text-sm text-foreground">
      <header className="flex h-(--topbar-height) shrink-0 items-center gap-1 border-b bg-panel px-4">
        <span className="font-semibold">BioFigure Lab</span>
        <div className="ml-auto">
          <IconButton icon={theme === 'dark' ? Sun : Moon} label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} onClick={toggleTheme} />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-8 py-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-lg font-semibold">Your figures</h1>
              <p className="text-muted-foreground">Saved in this browser as you work. No account needed.</p>
            </div>
            <NewFigureDialog trigger={newFigureButton} onCreate={create} />
          </div>

          {failed && (
            <p role="alert" className="rounded-md border border-destructive px-3 py-2 text-destructive">
              This browser blocks saving (for example in a private window), so figures can't be kept here.
            </p>
          )}

          {figures === undefined ? (
            <ul aria-busy="true" aria-label="Loading your figures" className={gridClass}>
              {[0, 1, 2, 3].map((key) => (
                <li key={key} className="flex flex-col gap-2">
                  <Skeleton className="aspect-[4/3] w-full" />
                  <Skeleton shape="text" className="w-2/3" />
                  <Skeleton shape="text" className="w-1/3" />
                </li>
              ))}
            </ul>
          ) : figures.length === 0 ? (
            !failed && (
              <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed px-6 py-16 text-center">
                <p className="font-medium">No figures yet</p>
                <p className="text-muted-foreground">Start one with New figure. Pick a journal column width and you're ready to draw.</p>
              </div>
            )
          ) : (
            <ul aria-label="Your figures" className={gridClass}>
              {figures.map((figure) => (
                <FigureCard key={figure.id} figure={figure} onOpen={() => {
                    void keepBrowserDataOnce()
                    onOpen(figure.id)
                  }} onDelete={() => remove(figure)} />
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  )
}

const gridClass = 'grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-x-4 gap-y-6'

function FigureCard({ figure, onOpen, onDelete }: { figure: Figure; onOpen: () => void; onDelete: () => void }) {
  const { width, height } = figure.page
  return (
    <li className="group relative flex flex-col gap-2">
      <button
        type="button"
        onClick={onOpen}
        className="flex flex-col gap-2 rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
      >
        {/* A fixed 4:3 tile, with the page inside it at its own shape, so the grid never shifts. */}
        <span className="grid aspect-[4/3] w-full place-items-center rounded-md border bg-muted p-4 transition-colors duration-(--duration-instant) group-hover:border-border-strong">
          <span className="relative max-h-full max-w-full bg-white shadow-sm" style={{ aspectRatio: `${width} / ${height}`, width: width >= height ? '100%' : 'auto', height: width >= height ? 'auto' : '100%' }}>
            {figure.thumbnail && <img src={figure.thumbnail} alt="" className="absolute inset-0 size-full" />}
          </span>
        </span>
        {/* Name, then the size the way the canvas names it ("Single column · 85 × 60 mm"), then when it was last edited. */}
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{figure.name}</span>
          <span className="truncate text-xs text-muted-foreground tabular-nums">{sizeLabel(figure.page)}</span>
          <span className="text-xs text-muted-foreground">{editedAgo(figure.updatedAt)}</span>
        </span>
      </button>
      <IconButton
        icon={Trash2}
        size="sm"
        label={`Delete ${figure.name}`}
        onClick={onDelete}
        className="absolute top-2 right-2 bg-panel opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
      />
    </li>
  )
}

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

/** "Edited just now", "Edited 5 minutes ago", "Edited yesterday", or the date. */
function editedAgo(time: number): string {
  const seconds = (Date.now() - time) / 1000
  if (seconds < 60) return 'Edited just now'
  if (seconds < 3600) return `Edited ${relative.format(-Math.round(seconds / 60), 'minute')}`
  if (seconds < 86400) return `Edited ${relative.format(-Math.round(seconds / 3600), 'hour')}`
  if (seconds < 30 * 86400) return `Edited ${relative.format(-Math.round(seconds / 86400), 'day')}`
  return `Edited ${new Date(time).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })}`
}
