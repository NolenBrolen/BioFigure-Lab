/*
 * The app: the start screen with your figures, or the editor with one figure.
 * Which one shows is kept in the address (#/figure/<id>), so a reload stays in
 * the figure and the browser's back button returns to the start screen.
 */
import { ToastProvider, ToastViewport } from '@biofigure-lab/ui/components/toast/Toast'
import { lazy, Suspense, useEffect, useState, useSyncExternalStore } from 'react'

import { debugTargets } from './debug/debug-targets'

import { FigureStore, type Figure } from './editor/storage'
import { EditorScreen } from './screen/EditorScreen'
import { StartScreen } from './screen/StartScreen'

const store = new FigureStore()
// Bring over the one figure older versions kept, before anything reads the list.
const ready = store.moveOldFigure().catch(() => undefined)

// Development only: Vite drops this (and Leva with it) from the production build.
const DebugPanel = import.meta.env.DEV ? lazy(() => import('./debug/DebugPanel')) : null
if (import.meta.env.DEV) debugTargets.store = store

const FIGURE_ROUTE = /^#\/figure\/(.+)$/

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
  return (
    <ToastProvider>
      {figureId ? <OpenFigure key={figureId} id={figureId} /> : <StartScreen store={store} ready={ready} onOpen={openFigure} />}
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
function OpenFigure({ id }: { id: string }) {
  const [figure, setFigure] = useState<Figure>()

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
  }, [id])

  // Reading takes a few milliseconds; an empty background avoids a flash of anything else.
  if (!figure) return <div className="h-screen bg-background" aria-busy="true" />
  return <EditorScreen figure={figure} store={store} onBack={showStart} />
}
