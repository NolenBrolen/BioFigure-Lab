/*
 * The app: the start screen with your figures, or the editor with one figure.
 * Which one shows is kept in the address (#/figure/<id>), so a reload stays in
 * the figure and the browser's back button returns to the start screen.
 * The live site adds its own pages and accounts through `site` (site/types.ts).
 *
 * Figures live in a local database per account (none when signed out). When
 * the account changes, the app switches to that database and shows its start
 * screen, since an open figure's id wouldn't exist there.
 */
import { ToastProvider, ToastViewport } from '@biofigure-lab/ui/components/toast/Toast'
import { lazy, Suspense, useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { debugTargets } from './debug/debug-targets'

import type { Figure, FigureStore } from './editor/storage'
import { EditorScreen } from './screen/EditorScreen'
import { StartScreen } from './screen/StartScreen'
import { ViewerScreen } from './screen/ViewerScreen'
import { site } from './site/site'

// Development only: Vite drops this (and Leva with it) from the production build.
const DebugPanel = import.meta.env.DEV ? lazy(() => import('./debug/DebugPanel')) : null
if (import.meta.env.DEV) void import('./debug/figure-builder').then((builder) => builder.installFigureBuilder())

const FIGURE_ROUTE = /^#\/figure\/(.+)$/
const FIGURE_SCREENS = { Editor: EditorScreen, Viewer: ViewerScreen }

const subscribe = (onChange: () => void) => {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}
const openFigureId = () => FIGURE_ROUTE.exec(window.location.hash)?.[1]

const openFigure = (id: string) => {
  window.location.hash = `#/figure/${id}`
}
const showStart = () => {
  // Leaves the start screen's address clean, without a lone "#".
  history.pushState(null, '', window.location.pathname + window.location.search)
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}

export function App() {
  const figureId = useSyncExternalStore(subscribe, openFigureId)
  const { store, ready, key, signedIn } = site.useFigures()
  const siteScreen = site.useScreen(showStart, FIGURE_SCREENS)

  // A different account (signed in, out or switched): back to the start screen of that account.
  const lastKey = useRef(key)
  useEffect(() => {
    if (lastKey.current === key) return
    lastKey.current = key
    showStart()
  }, [key])

  useEffect(() => {
    if (import.meta.env.DEV) debugTargets.store = store
  }, [store])

  return (
    <ToastProvider>
      <site.Provider store={store}>
        {siteScreen ??
          (figureId ? (
            <OpenFigure key={`${key}:${figureId}`} id={figureId} store={store} ready={ready} />
          ) : (
            <StartScreen key={key} store={store} ready={ready} signedIn={signedIn} onOpen={openFigure} />
          ))}
      </site.Provider>
      <ToastViewport />
      {DebugPanel && (
        <Suspense>
          <DebugPanel />
        </Suspense>
      )}
    </ToastProvider>
  )
}

/** Reads the figure, then shows the editor. A figure that's gone sends you back to the start screen. */
function OpenFigure({ id, store, ready }: { id: string; store: FigureStore; ready: Promise<unknown> }) {
  const [figure, setFigure] = useState<Figure>()
  // Goes up when sync changed the open figure's page size: the editor opens it again from what's stored.
  const [opened, setOpened] = useState(0)

  useEffect(() => {
    let current = true
    void ready
      .then(() => store.get(id))
      .then((found) => {
        if (!current) return
        if (found) setFigure(found)
        else showStart()
      })
    return () => {
      current = false
    }
  }, [id, store, ready, opened])

  // What sync brings in: a view-only figure shows the owner's latest; a changed role (or no access) switches screens.
  useEffect(
    () =>
      store.subscribe((change) => {
        if (change.source !== 'sync' || change.id !== id) return
        void store.get(id).then((fresh) => {
          if (!fresh) return showStart()
          const role = (current?: Figure) => current?.access?.role ?? 'owner'
          setFigure((shown) => {
            if (shown && (role(shown) === 'view' || role(fresh) !== role(shown))) {
              setOpened((n) => n + 1)
              return fresh
            }
            return shown
          })
        })
      }),
    [id, store],
  )

  // Reading takes a few milliseconds; an empty background avoids a flash of anything else.
  if (!figure) return <div className="h-screen bg-background" aria-busy="true" />
  // Shared with you for viewing: the look-only screen (BIO-34).
  if (figure.access?.role === 'view') return <ViewerScreen key={opened} figure={figure} store={store} onBack={showStart} onOpen={openFigure} />
  return <EditorScreen key={opened} figure={figure} store={store} onBack={showStart} onReload={() => setOpened((n) => n + 1)} />
}
