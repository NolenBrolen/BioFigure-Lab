/*
 * The start screen: New figure, and your figures as pictures, last edited
 * first. No account needed; everything is saved in this browser.
 */
import { Button } from '@biofigure-lab/ui/components/button/Button'
import { IconButton } from '@biofigure-lab/ui/components/icon-button/IconButton'
import { Skeleton } from '@biofigure-lab/ui/components/skeleton/Skeleton'
import { useToast } from '@biofigure-lab/ui/components/toast/Toast'
import { Eye, MessageSquare, Moon, Plus, Sun, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { emitAppEvent } from '../app-events'
import { keepBrowserDataOnce } from '../editor/keep-data'
import { sizeLabel, type PageMm } from '../editor/page-size'
import type { Figure, FigureStore } from '../editor/storage'
import { NewFigureDialog } from './NewFigureDialog'
import { site } from '../site/site'
import type { FigureFilter } from '../site/types'
import { TEMPLATES, type Template } from '../templates/templates'
import { useTheme } from './useTheme'

type StartScreenProps = {
  store: FigureStore
  /** Done once older saved work has been moved over. */
  ready: Promise<unknown>
  /** Someone is signed in: these are their account's figures. */
  signedIn?: boolean
  onOpen: (id: string) => void
}

export function StartScreen({ store, ready, signedIn = false, onOpen }: StartScreenProps) {
  const [figures, setFigures] = useState<Figure[]>()
  const [failed, setFailed] = useState(false)
  const [theme, toggleTheme] = useTheme()
  const toasts = useToast()
  // All / Yours / Shared with you, remembered on this device.
  const [filter, setFilter] = useState<FigureFilter>(readFilter)
  const pickFilter = (next: FigureFilter) => {
    setFilter(next)
    writeFilter(next)
  }
  const feedback = site.useFeedback()

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
  // Figures that arrive or change through sync (or move into the account after signing in) show without a reload;
  // what's there stays until the new list is read.
  useEffect(() => store.subscribe(() => void reload()), [store, reload])

  const create = (page: PageMm) => {
    void store.create(page).then(
      (figure) => {
        // Now there's a figure worth keeping: ask the browser not to clear it (quietly, once per visit).
        void keepBrowserDataOnce()
        emitAppEvent({ name: 'figure_created', value: 'blank' })
        onOpen(figure.id)
      },
      () => setFailed(true),
    )
  }

  const createFromTemplate = (template: Template) => {
    void template
      .load()
      .then((file) => store.createFrom({ ...file, name: template.name }))
      .then(
        (figure) => {
          void keepBrowserDataOnce()
          emitAppEvent({ name: 'figure_created', value: 'template' })
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
        <div className="flex items-center gap-2">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="size-6" />
          <span className="font-semibold">BioFigure Lab</span>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <IconButton icon={theme === 'dark' ? Sun : Moon} label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} onClick={toggleTheme} />
          {site.AccountControl && (
            <>
              <div className="mx-1 h-5 w-px bg-border" />
              <site.AccountControl />
            </>
          )}
        </div>
      </header>
      {site.StartBanner && <site.StartBanner />}

      <main className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        {/* Extra room at the bottom, so the last cards scroll clear of the Feedback button. */}
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-8 pt-8 pb-24">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-lg font-semibold">{signedIn ? 'Figures' : 'Your figures'}</h1>
              <p className="text-muted-foreground">{signedIn ? 'Saved to your account and in this browser.' : 'Saved in this browser as you work. No account needed.'}</p>
            </div>
            {site.SharedFigures && signedIn && figures && figures.length > 0 && <site.SharedFigures.Filter figures={figures} value={filter} onValueChange={pickFilter} />}
            <NewFigureDialog trigger={newFigureButton} onCreate={create} templates={TEMPLATES} onCreateTemplate={createFromTemplate} />
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
              {figures.filter((figure) => filter === 'all' || (filter === 'mine') === isMine(figure)).map((figure) => (
                <FigureCard key={figure.id} figure={figure} onOpen={() => {
                    void keepBrowserDataOnce()
                    onOpen(figure.id)
                  }} onDelete={isMine(figure) ? () => remove(figure) : undefined} />
              ))}
            </ul>
          )}
        </div>
      </main>

      {feedback.open && (
        <Button variant="secondary" onClick={() => feedback.open?.()} className="fixed right-4 bottom-4 h-9 rounded-full bg-panel px-4 shadow-lg">
          <MessageSquare className="size-4 text-primary" strokeWidth={2} aria-hidden="true" />
          Feedback
        </Button>
      )}
      {feedback.dialog}
    </div>
  )
}

const gridClass = 'grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-x-4 gap-y-6'

const FILTER_KEY = 'biofigure-lab:figure-filter'
function readFilter(): FigureFilter {
  try {
    const saved = localStorage.getItem(FILTER_KEY)
    return saved === 'mine' || saved === 'shared' ? saved : 'all'
  } catch {
    return 'all'
  }
}
function writeFilter(filter: FigureFilter) {
  try {
    localStorage.setItem(FILTER_KEY, filter)
  } catch {
    // Blocked storage: the filter just isn't remembered.
  }
}

/** Yours: not synced yet, or the server says you own it. */
const isMine = (figure: Figure) => (figure.access?.role ?? 'owner') === 'owner'

function FigureCard({ figure, onOpen, onDelete }: { figure: Figure; onOpen: () => void; onDelete?: () => void }) {
  const { width, height } = figure.page
  const owner = figure.access && !isMine(figure) ? figure.access.owner : undefined
  return (
    <li className="group relative flex flex-col gap-2">
      <button
        type="button"
        onClick={onOpen}
        className="flex flex-col gap-2 rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
      >
        {/* A fixed 4:3 tile, with the page inside it at its own shape, so the grid never shifts. */}
        <span className="relative grid aspect-[4/3] w-full place-items-center rounded-md border bg-muted p-4 transition-colors duration-(--duration-instant) group-hover:border-border-strong">
          <span className="relative max-h-full max-w-full bg-white shadow-sm" style={{ aspectRatio: `${width} / ${height}`, width: width >= height ? '100%' : 'auto', height: width >= height ? 'auto' : '100%' }}>
            {figure.thumbnail && <img src={figure.thumbnail} alt="" className="absolute inset-0 size-full" />}
          </span>
          {figure.access?.role === 'view' && (
            <span className="absolute top-2 left-2 flex items-center gap-1 rounded bg-black/65 px-1.5 py-0.5 text-[10px] text-white">
              <Eye className="size-3" aria-hidden="true" /> View only
            </span>
          )}
          {site.SharedFigures && <site.SharedFigures.Faces figure={figure} />}
        </span>
        {/* Name, then the size the way the canvas names it ("Single column · 85 × 60 mm"), then when it was last edited. */}
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{figure.name}</span>
          <span className="truncate text-xs text-muted-foreground tabular-nums">{sizeLabel(figure.page)}</span>
          <span className="truncate text-xs text-muted-foreground">{owner ? `${firstName(owner)}’s · ${editedAgo(figure.updatedAt)}` : editedAgo(figure.updatedAt)}</span>
        </span>
      </button>
      {onDelete && <IconButton
        icon={Trash2}
        size="sm"
        label={`Delete ${figure.name}`}
        onClick={onDelete}
        className="absolute top-2 right-2 bg-panel opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
      />}
    </li>
  )
}

/** "Ana" for Ana López; the address when there's no name. */
const firstName = (person: { name: string; email: string }) => person.name.trim().split(' ')[0] || person.email

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
