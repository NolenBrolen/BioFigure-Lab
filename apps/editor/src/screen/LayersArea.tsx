/*
 * The layers panel at the bottom right, with a bar along its top edge to
 * drag it taller or shorter (or focus it and use the arrow keys), and its
 * header to fold it shut. Its height and whether it is folded are kept in
 * this browser for next time.
 */
import { LayersPanel, type LayersPanelProps } from '@biofigure-lab/ui/components/layers-panel/LayersPanel'
import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

const KEY = 'biofigure-lab:layers-panel'
const MIN = 96
const DEFAULT = 260

type Saved = { height: number; collapsed: boolean }

function load(): Saved {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Saved> | null
    return { height: typeof saved?.height === 'number' ? saved.height : DEFAULT, collapsed: saved?.collapsed === true }
  } catch {
    return { height: DEFAULT, collapsed: false }
  }
}

function save(value: Saved): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(value))
  } catch {
    // Storage can be off (private windows); the panel just starts at its usual size next time.
  }
}

export function LayersArea(props: Omit<LayersPanelProps, 'collapsed' | 'onCollapsedChange' | 'className'>) {
  const [state, setState] = useState(load)
  const area = useRef<HTMLDivElement>(null)
  const drag = useRef<{ startY: number; startHeight: number }>(undefined)
  const change = (next: Partial<Saved>) =>
    setState((current) => {
      // No taller than the column leaves room for the properties above it.
      const room = (area.current?.parentElement?.clientHeight ?? 800) - 160
      const value = { ...current, ...next }
      value.height = Math.round(Math.min(Math.max(value.height, MIN), Math.max(room, MIN)))
      save(value)
      return value
    })

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (state.collapsed) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { startY: event.clientY, startHeight: state.height }
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current) change({ height: drag.current.startHeight + drag.current.startY - event.clientY })
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === 'ArrowUp' ? 24 : event.key === 'ArrowDown' ? -24 : 0
    if (step === 0) return
    event.preventDefault()
    change({ height: state.height + step })
  }

  return (
    <div ref={area} className="relative flex shrink-0 flex-col" style={{ height: state.collapsed ? undefined : state.height }}>
      {!state.collapsed && (
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize the layers panel"
          aria-valuenow={state.height}
          aria-valuemin={MIN}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => (drag.current = undefined)}
          onKeyDown={onKeyDown}
          className="absolute inset-x-0 -top-1 z-10 h-2 cursor-row-resize outline-none hover:bg-primary/30 focus-visible:bg-primary/40"
        />
      )}
      <LayersPanel {...props} collapsed={state.collapsed} onCollapsedChange={(collapsed) => change({ collapsed })} className="min-h-0 flex-1" />
    </div>
  )
}
