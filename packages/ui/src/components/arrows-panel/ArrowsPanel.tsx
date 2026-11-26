/*
 * Arrows panel: the contents of the left panel when the Arrows tool is on.
 * Two rows of picture switches at the top choose the path (straight, curved,
 * elbow, U-shape) and the line (solid, dashed, dotted); below them, square
 * tiles pick the arrow's ends (heads, biology ends). Every tile is drawn with
 * the chosen path and line, so it shows exactly the arrow you'll draw.
 *
 * Picked look: C1 (icon switches side by side, square end tiles).
 */
import { useRef, type KeyboardEvent, type ReactNode } from 'react'

import { ARROW_PRESETS, LINE_STYLES, ROUTES, arrowStrokes, drawArrow, type ArrowLook, type ArrowPreset, type LineStyle, type Route, type XY } from '../../lib/arrow-geometry'
import { cn } from '../../lib/cn'
import { DrawTile } from '../draw-tile/DrawTile'
import { Tooltip } from '../tooltip/Tooltip'

export type ArrowsPanelProps = {
  route: Route
  line: LineStyle
  onRouteChange: (route: Route) => void
  onLineChange: (line: LineStyle) => void
  /** The end tile that is picked (its tool is on), if any. */
  picked?: string
  onPick: (preset: ArrowPreset) => void
  className?: string
}

/** Where tile arrows start and end in their 64 × 32 picture, per path. */
const PREVIEW_ENDS: Record<Route, [XY, XY]> = {
  straight: [{ x: 8, y: 16 }, { x: 56, y: 16 }],
  curved: [{ x: 8, y: 22 }, { x: 56, y: 22 }],
  elbow: [{ x: 8, y: 8 }, { x: 56, y: 24 }],
  // Both ends level, and far enough apart for the dip to leave room for a head.
  'u-shape': [{ x: 8, y: 8 }, { x: 56, y: 8 }],
}

/** A small picture of an arrow, drawn with the same geometry as the canvas. */
export function ArrowPicture({ look, className }: { look: ArrowLook; className?: string }) {
  const [a, b] = PREVIEW_ENDS[look.route]
  return (
    <svg aria-hidden viewBox="0 0 64 32" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeMiterlimit={10}>
      {arrowStrokes(drawArrow(a, b, look, 2), 2).map((part, i) => (
        <path key={i} d={part.d} fill={part.filled ? 'currentColor' : 'none'} stroke={part.width > 0 ? 'currentColor' : 'none'} strokeWidth={part.width} strokeLinecap={part.cap} strokeLinejoin={part.join} strokeDasharray={part.dash?.join(' ')} />
      ))}
    </svg>
  )
}

const switchIcon = (d: string, dash?: string) => (
  <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dash}>
    <path d={d} />
  </svg>
)
const ROUTE_ICONS: Record<Route, ReactNode> = {
  straight: switchIcon('M3 12 H21'),
  curved: switchIcon('M3 19 Q8 3 21 8'),
  elbow: switchIcon('M3 6 H12 V18 H21'),
  'u-shape': switchIcon('M5 4 V19 H19 V4'),
}
const LINE_ICONS: Record<LineStyle, ReactNode> = {
  solid: switchIcon('M3 12 H21'),
  dashed: switchIcon('M3 12 H21', '5 3'),
  dotted: switchIcon('M3 12 H21', '0.5 3.5'),
}

/** A row of picture-only choices; the arrow keys move between them, like radio buttons. */
function IconSwitch<T extends string>({ label, value, options, icons, onChange }: { label: string; value: T; options: { id: T; name: string }[]; icons: Record<T, ReactNode>; onChange: (value: T) => void }) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
    if (step === 0) return
    event.preventDefault()
    const next = (index + step + options.length) % options.length
    onChange(options.at(next)!.id)
    buttons.current[next]?.focus()
  }
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <span className="section-label flex h-7 items-center">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex rounded-md bg-muted p-0.5">
        {options.map((option, index) => (
          <Tooltip key={option.id} label={option.name}>
            <button
              ref={(element) => {
                buttons.current[index] = element
              }}
              type="button"
              role="radio"
              aria-checked={option.id === value}
              aria-label={option.name}
              tabIndex={option.id === value ? 0 : -1}
              onClick={() => onChange(option.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                'grid h-8 flex-1 place-items-center rounded-sm transition-colors duration-(--duration-instant)',
                option.id === value ? 'bg-panel text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {icons[option.id]}
            </button>
          </Tooltip>
        ))}
      </div>
    </div>
  )
}

export function ArrowsPanel({ route, line, onRouteChange, onLineChange, picked, onPick, className }: ArrowsPanelProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex gap-2">
        <IconSwitch label="Path" value={route} options={ROUTES} icons={ROUTE_ICONS} onChange={onRouteChange} />
        <IconSwitch label="Line" value={line} options={LINE_STYLES} icons={LINE_ICONS} onChange={onLineChange} />
      </div>
      <section aria-label="Arrow ends">
        <h3 className="section-label flex h-7 items-center">Ends</h3>
        <ArrowEndTiles route={route} line={line} picked={picked} onPick={onPick} />
      </section>
    </div>
  )
}

/**
 * The end tiles alone, drawn in the given path and line. Also the arrow's Ends
 * widget in the quick-actions bar (BIO-82), so both always offer the same ends.
 */
export function ArrowEndTiles({ route, line, picked, onPick, drawTitles = true, className }: Pick<ArrowsPanelProps, 'route' | 'line' | 'picked' | 'onPick' | 'className'> & { /** Tooltips say "Draw … arrow"; off, they give only the end's name. */ drawTitles?: boolean }) {
  return (
    <div className={cn('grid grid-cols-3 gap-2', className)}>
      {ARROW_PRESETS.map((preset) => (
        <DrawTile key={preset.id} name={preset.name} title={drawTitles ? `Draw ${preset.name.toLowerCase()} arrow` : preset.name} picked={preset.id === picked} onClick={() => onPick(preset)} picture={<ArrowPicture look={{ route, line, start: preset.start, end: preset.end, mid: preset.mid }} />} />
      ))}
    </div>
  )
}
