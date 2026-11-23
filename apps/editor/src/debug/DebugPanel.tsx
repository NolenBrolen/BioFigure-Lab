/*
 * The debug panel: a small bug button in the bottom-left corner (top-left on
 * phones, clear of the bottom bar and the panels sliding up) opens Leva's
 * panel of tuning controls and test-state buttons. Development only: App loads
 * this file behind `import.meta.env.DEV`, so it never reaches the production
 * build.
 *
 * Tuning: while a feature is being built and the owner judges a size by eye,
 * don't guess values back and forth in chat. Make the size a CSS variable with
 * the current value as fallback (`font-size: var(--tune-tile-name, 12px)`) and
 * add a `useTuning` line to `DebugControls`. The owner clicks through the
 * choices or drags the slider, then says which one; that value goes into the
 * code and the tuning line comes out again before the feature is merged.
 *
 * Other controls: write a hook that calls Leva's `useControls` with a folder
 * name and call it in `DebugControls`. Reach the open figure through
 * `debugTargets`.
 */
import { IconButton } from '@biofigure-lab/ui/components/icon-button/IconButton'
import { button, folder, Leva, useControls } from 'leva'
import { Bug, GripHorizontal } from 'lucide-react'
import { useRef, useState, type PointerEvent } from 'react'

import { shapeAt, type ShapeTool } from '../editor/shapes'
import { buttonRow } from './button-row'
import { debugTargets } from './debug-targets'

const OPEN_KEY = 'biofigure-lab:debug-open'
const CLEARED_KEY = 'biofigure-lab:debug-cleared'
const PLACE_KEY = 'biofigure-lab:debug-place'

type Place = { x: number; y: number }

/** Where the panel was dragged to last, or null for its spot above the bug button. */
function storedPlace(): Place | null {
  try {
    const place = JSON.parse(stored(PLACE_KEY) ?? 'null') as Place | null
    return place && Number.isFinite(place.x) && Number.isFinite(place.y) ? place : null
  } catch {
    return null
  }
}

const clamp = (value: number, max: number) => Math.min(Math.max(0, value), Math.max(0, max))

function stored(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function store(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // Storage blocked: lasts until reload.
  }
}

export default function DebugPanel() {
  const [open, setOpen] = useState(() => stored(OPEN_KEY) === '1')
  const toggle = () => {
    setOpen(!open)
    store(OPEN_KEY, open ? null : '1')
  }
  // Dragged by the grip at its top, so it can be moved off what is being tuned.
  const [place, setPlace] = useState<Place | null>(storedPlace)
  const grab = useRef<Place | null>(null)
  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    const box = (event.currentTarget.parentElement as HTMLElement).getBoundingClientRect()
    grab.current = { x: event.clientX - box.left, y: event.clientY - box.top }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const drag = (event: PointerEvent<HTMLDivElement>) => {
    if (!grab.current) return
    setPlace({ x: clamp(event.clientX - grab.current.x, window.innerWidth - 120), y: clamp(event.clientY - grab.current.y, window.innerHeight - 40) })
  }
  const endDrag = () => {
    grab.current = null
    store(PLACE_KEY, place && JSON.stringify(place))
  }
  return (
    <>
      <div className="fixed bottom-2 left-2 z-50 opacity-50 hover:opacity-100 max-md:top-[calc(var(--topbar-height)+0.5rem)] max-md:bottom-auto">
        <IconButton icon={Bug} label={open ? 'Close debug panel' : 'Open debug panel'} size="sm" pressed={open} tooltipSide="right" onClick={toggle} />
      </div>
      {/* Above the button, not in Leva's usual top-right spot, where it would cover the top bar. */}
      <div
        id="debug-panel"
        // Popovers stay open while clicking here, so their look can be tuned with them open.
        data-keeps-popups-open
        style={place ? { left: place.x, top: place.y, bottom: 'auto', maxHeight: `calc(100vh - ${place.y + 8}px)` } : undefined}
        className={`fixed bottom-10 left-2 z-50 max-h-[calc(100vh-3.5rem)] max-md:top-[calc(var(--topbar-height)+2.75rem)] max-md:bottom-auto max-md:max-h-[calc(100dvh-var(--topbar-height)-var(--mobile-bar-height)-4rem)] w-[340px] overflow-auto rounded-lg shadow-lg ${open ? '' : 'hidden'}`}
      >
        <div
          title="Drag to move; double-click to put it back"
          onPointerDown={startDrag}
          onPointerMove={drag}
          onPointerUp={endDrag}
          onDoubleClick={() => {
            setPlace(null)
            store(PLACE_KEY, null)
          }}
          className="flex h-5 cursor-grab touch-none items-center justify-center bg-[#181c20] text-[#8c92a4] active:cursor-grabbing"
        >
          <GripHorizontal className="size-4" aria-hidden="true" />
        </div>
        {/*
          Leva measures an open folder's height once at start. In StrictMode that
          runs twice, and the second time the panel is still hidden, so it pins
          the folder at 0px and the rows spill over each other. A real fold always
          sets overflow hidden alongside its height, so a 0px height without it is
          always this leftover: let those folders take their natural height.
        */}
        <style>{'#debug-panel div[style*="height: 0px"]:not([style*="overflow"]) { height: auto !important; }'}</style>
        <Leva fill titleBar={{ title: 'Debug', filter: true, drag: false }} theme={{ sizes: { controlWidth: '150px' } }} />
      </div>
      <DebugControls />
    </>
  )
}

function DebugControls() {
  // Tuning lines (see tuning.ts) for the feature being built go here, e.g.
  // useTuning('Tile name', '--tune-tile-name', { now: 12, choices: [11, 12, 13, 14] })
  useTestStateControls()
  return null
}

const SHAPE_TOOLS: ShapeTool[] = ['rectangle', 'ellipse', 'shape', 'line', 'arrow', 'text']

/** Buttons and toggles that put the app in a state worth testing. */
function useTestStateControls() {
  useControls(() => ({
    'Test state': folder({
      theme: {
        value: stored('biofigure-lab:theme') ?? 'system',
        options: ['system', 'light', 'dark'],
        onChange: (theme: string) => {
          const root = document.documentElement
          if (theme === 'system') delete root.dataset.theme
          else root.dataset.theme = theme
          store('biofigure-lab:theme', theme === 'system' ? null : theme)
        },
      },
      'layout outlines': { value: false, onChange: (on: boolean) => toggleStyle('debug-outlines', on, '* { outline: 1px solid rgb(255 0 128 / 0.35); }') },
      'no animations': {
        value: false,
        onChange: (on: boolean) =>
          toggleStyle('debug-no-motion', on, ':root { --duration-instant: 0ms !important; --duration-fast: 0ms !important; --duration-base: 0ms !important; --duration-slow: 0ms !important; }'),
      },
      'export delay (s)': { value: 0, min: 0, max: 15, step: 1, onChange: (seconds: number) => (debugTargets.exportDelayMs = seconds * 1000) },
      objects: { value: 200, min: 10, max: 2000, step: 10 },
      // Related buttons share one row to keep the panel short.
      canvas: buttonRow({
        'Fill canvas': (get) => fillCanvas(get('Test state.objects') as number),
        'Empty canvas': () => {
          const figure = debugTargets.figure
          if (!figure) return
          figure.selectAll()
          figure.deleteSelection() // Ctrl+Z brings everything back.
        },
      }),
      'Log figure JSON': button(() => console.log(debugTargets.figure?.serialize() ?? 'No figure open')),
      'saved figures': buttonRow({
        'Clear figures': () => void clearFigures(),
        'Restore figures': () => void restoreFigures(),
      }),
    }),
  }))
}

function toggleStyle(id: string, on: boolean, css: string) {
  document.getElementById(id)?.remove()
  if (!on) return
  const style = document.createElement('style')
  style.id = id
  style.textContent = css
  document.head.append(style)
}

/** Many random shapes, added as one undo step. */
function fillCanvas(count: number) {
  const figure = debugTargets.figure
  if (!figure) return
  const { width, height } = figure.page
  for (let index = 0; index < count; index++) {
    const tool = SHAPE_TOOLS[index % SHAPE_TOOLS.length]
    // The last one commits, so the whole batch is one undo step.
    figure.addShape(shapeAt(tool, Math.random() * width, Math.random() * height), index === count - 1)
  }
}

/**
 * Moves every saved figure in this browser to the deleted list (the same as
 * deleting from the start screen), remembering which ones, so "Restore
 * figures" brings them back. Then shows the empty start screen.
 */
async function clearFigures() {
  const figureStore = debugTargets.store
  if (!figureStore) return
  const figures = await figureStore.list()
  const earlier = JSON.parse(stored(CLEARED_KEY) ?? '[]') as string[]
  await Promise.all(figures.map((figure) => figureStore.remove(figure.id)))
  store(CLEARED_KEY, JSON.stringify([...earlier, ...figures.map((figure) => figure.id)]))
  window.location.hash = ''
  window.location.reload()
}

async function restoreFigures() {
  const figureStore = debugTargets.store
  const ids = JSON.parse(stored(CLEARED_KEY) ?? '[]') as string[]
  if (!figureStore || ids.length === 0) return
  await Promise.all(ids.map((id) => figureStore.restore(id)))
  store(CLEARED_KEY, null)
  window.location.reload()
}
