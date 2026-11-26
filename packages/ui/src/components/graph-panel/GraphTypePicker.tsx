/*
 * The graph type picker groups charts into families: Individual values,
 * Box and violin, Mean and error, and Other (the heatmap and the XY charts,
 * which have dots at real numeric x values; one tab, the owner's call 2026-11-25).
 * The three most used (bar, line, dots) are tiles in a row with a More tile;
 * More opens a popup to the right with the family tabs, a search field that
 * looks through every family, and six graphs at a time. A graph picked from
 * More takes the row's third place, as in the Shapes panel.
 *
 * Inside `ExpandedControls` (a phone's sheet) there is no popup: the tabs,
 * search and graphs show in place under the row (see Popover).
 *
 * Picked look: draft D with tabs (BIO-38, 2026-11-19).
 */
import { Ellipsis } from 'lucide-react'
import { useState, type ComponentProps, type KeyboardEvent } from 'react'

import { cn } from '../../lib/cn'
import { DrawTile } from '../draw-tile/DrawTile'
import { Popover } from '../popover/Popover'
import { SearchField } from '../search-field/SearchField'
import { Tabs } from '../tabs/Tabs'
import { Tooltip } from '../tooltip/Tooltip'
import { isHorizontal, uprightKind, type ChartKind, type UprightKind } from '../../lib/graph-kinds'

export { usesErrorBars, type ChartKind } from '../../lib/graph-kinds'

export type GraphType = { id: ChartKind; name: string; hint: string }
export type GraphFamily = { id: string; name: string; tab: string; types: GraphType[] }

export const GRAPH_FAMILIES: GraphFamily[] = [
  {
    id: 'individual',
    name: 'Individual values',
    tab: 'Individual',
    types: [
      { id: 'scatter', name: 'Scatter', hint: 'Every replicate as a dot' },
      { id: 'dots-bars', name: 'Bars + dots', hint: 'Mean bars with every replicate on top' },
      { id: 'before-after', name: 'Before-after', hint: 'Paired values joined by lines' },
      { id: 'dots-spread', name: 'Spread dots', hint: 'Dots spread sideways so none hide' },
      { id: 'dots-box', name: 'Box + dots', hint: 'Box and whiskers with every dot' },
      { id: 'dots-violin', name: 'Violin + dots', hint: 'Shape of the distribution with every dot' },
    ],
  },
  {
    id: 'box',
    name: 'Box and violin',
    tab: 'Box',
    types: [
      { id: 'floating', name: 'Floating bars', hint: 'From the smallest to the largest value' },
      { id: 'box', name: 'Box', hint: 'Median, quartiles and whiskers' },
      { id: 'violin', name: 'Violin', hint: 'The full shape of the distribution' },
      { id: 'floating-h', name: 'Float, wide', hint: 'Floating bars, lying down' },
      { id: 'box-h', name: 'Box, wide', hint: 'Box and whiskers, lying down' },
      { id: 'violin-h', name: 'Violin, wide', hint: 'Violin, lying down' },
    ],
  },
  {
    id: 'mean',
    name: 'Mean and error',
    tab: 'Mean',
    types: [
      { id: 'bar', name: 'Bar', hint: 'Compare groups' },
      { id: 'point', name: 'Point', hint: 'The mean as a dot with error bars' },
      { id: 'line', name: 'Line', hint: 'Change over time or dose' },
      { id: 'bar-h', name: 'Bar, wide', hint: 'Bars lying down: good for long names' },
      { id: 'point-h', name: 'Point, wide', hint: 'Points lying down' },
      { id: 'slope', name: 'Slope', hint: 'Means joined by a line, with open markers' },
      { id: 'bar-line', name: 'Bar + line', hint: 'Bars for one measure, a line for a second, with its own axis' },
    ],
  },
  {
    id: 'other',
    name: 'Other',
    tab: 'Other',
    types: [
      { id: 'heatmap', name: 'Heatmap', hint: 'A grid of coloured cells, such as expression or correlations' },
      { id: 'xy', name: 'XY dots', hint: 'Dots at real x values: QQ plots, maps, correlations' },
      { id: 'xy-line', name: 'XY line', hint: 'Dots joined in order of x: time courses, dose-response' },
    ],
  },
]

export const GRAPH_TYPES: GraphType[] = GRAPH_FAMILIES.flatMap((family) => family.types)

/** The three most used graphs, always in the row. */
export const COMMON_GRAPHS: ChartKind[] = ['bar', 'line', 'scatter']

export const graphType = (kind: ChartKind) => GRAPH_TYPES.find((type) => type.id === kind)

const familyIdOf = (kind: ChartKind) => GRAPH_FAMILIES.find((family) => family.types.some((type) => type.id === kind))?.id ?? 'individual'

const line = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.25, strokeLinejoin: 'round', strokeLinecap: 'round' } as const
const Dot = ({ x, y }: { x: number; y: number }) => <circle cx={x} cy={y} r="1.5" fill="currentColor" stroke="none" />
const Dots = ({ at }: { at: number[][] }) => at.map(([x = 0, y = 0]) => <Dot key={`${x}-${y}`} x={x} y={y} />)
const Whisk = ({ x, a, b }: { x: number; a: number; b: number }) => <path d={`M${x} ${a}V${b}M${x - 2} ${a}h4M${x - 2} ${b}h4`} />
const BoxV = ({ x, lo, a, m, b, hi }: { x: number; lo: number; a: number; m: number; b: number; hi: number }) => (
  <>
    <path d={`M${x} ${lo}V${a}M${x} ${b}V${hi}M${x - 2} ${lo}h4M${x - 2} ${hi}h4`} />
    <rect x={x - 4} y={Math.min(a, b)} width="8" height={Math.abs(b - a)} />
    <path d={`M${x - 4} ${m}h8`} />
  </>
)
const Violin = ({ x, top, bottom, w }: { x: number; top: number; bottom: number; w: number }) => {
  const mid = (top + bottom) / 2
  return <path d={`M${x} ${top}C${x + w} ${top + 3} ${x + w} ${mid - 3} ${x + w * 0.3} ${mid}C${x + w} ${mid + 3} ${x + w} ${bottom - 3} ${x} ${bottom}C${x - w} ${bottom - 3} ${x - w} ${mid + 3} ${x - w * 0.3} ${mid}C${x - w} ${mid - 3} ${x - w} ${top + 3} ${x} ${top}Z`} />
}

/** A small picture of one graph type, drawn with thin lines like the Shapes panel's pictures. */
export function GraphTypePicture({ kind: given, className }: { kind: ChartKind; className?: string }) {
  if (given === 'heatmap') return <HeatmapPicture className={className} />
  const kind = uprightKind(given)
  const picture = <UprightPicture kind={kind} />
  return (
    <svg aria-hidden viewBox="0 0 36 30" className={className} {...line}>
      <path d="M3 2v25h31" />
      {/* Lying down: the upright picture turned a quarter turn, so the groups run down the side. */}
      {isHorizontal(given) ? <g transform="matrix(0 -0.8 -1 0 30 29.4)">{picture}</g> : picture}
    </svg>
  )
}

/** A heatmap: a 4 × 3 grid of cells in shades of the line colour (no axes), with a small colour bar beside it. */
const HEAT_SHADES = [
  [0.85, 0.35, 0.1, 0.55],
  [0.35, 0.85, 0.45, 0.2],
  [0.1, 0.45, 0.85, 0.65],
]
function HeatmapPicture({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 36 30" className={className} {...line}>
      {HEAT_SHADES.map((row, r) => row.map((shade, c) => <rect key={`${r}-${c}`} x={3 + c * 6.5} y={4 + r * 7} width="6.5" height="7" fill="currentColor" fillOpacity={shade} strokeWidth="0.75" />))}
      <rect x="31" y="4" width="3" height="21" strokeWidth="0.75" />
      <rect x="31" y="4" width="3" height="10" fill="currentColor" fillOpacity={0.7} stroke="none" />
    </svg>
  )
}

function UprightPicture({ kind }: { kind: UprightKind }) {
  return (
    <>
      {kind === 'scatter' && <Dots at={[[9, 14], [11, 18], [8, 20], [10, 11], [25, 8], [27, 12], [24, 16], [28, 10], [17, 19], [18, 15]]} />}
      {kind === 'dots-bars' && (
        <>
          <rect x="6" y="14" width="9" height="13" />
          <rect x="21" y="8" width="9" height="19" />
          <Dots at={[[9, 11], [12, 17], [10, 21], [24, 5], [27, 11], [25, 16]]} />
        </>
      )}
      {kind === 'before-after' && (
        <>
          <path d="M9 20 27 10M9 14 27 18M9 23 27 22" />
          <Dots at={[[9, 20], [27, 10], [9, 14], [27, 18], [9, 23], [27, 22]]} />
        </>
      )}
      {kind === 'dots-spread' && <Dots at={[[6, 18], [9, 16], [12, 19], [7, 21], [11, 22], [9, 24], [22, 9], [25, 7], [28, 10], [23, 12], [27, 13], [25, 15]]} />}
      {kind === 'dots-box' && (
        <>
          <BoxV x={12} lo={22} a={17} m={14} b={11} hi={7} />
          <BoxV x={27} lo={24} a={19} m={16} b={13} hi={8} />
          <Dots at={[[9, 18], [15, 13], [13, 9], [24, 21], [30, 15], [28, 10]]} />
        </>
      )}
      {kind === 'dots-violin' && (
        <>
          <Violin x={12} top={6} bottom={25} w={5} />
          <Violin x={27} top={9} bottom={26} w={4} />
          <Dots at={[[10, 12], [14, 16], [11, 20], [25, 14], [29, 18], [26, 22]]} />
        </>
      )}
      {kind === 'floating' && (
        <>
          <rect x="7" y="11" width="9" height="13" />
          <path d="M7 17h9" />
          <rect x="21" y="5" width="9" height="15" />
          <path d="M21 12h9" />
        </>
      )}
      {kind === 'box' && (
        <>
          <BoxV x={12} lo={24} a={19} m={16} b={12} hi={6} />
          <BoxV x={27} lo={22} a={17} m={14} b={10} hi={5} />
        </>
      )}
      {kind === 'violin' && (
        <>
          <Violin x={12} top={5} bottom={25} w={6} />
          <Violin x={27} top={8} bottom={26} w={5} />
        </>
      )}
      {kind === 'bar' && (
        <>
          <rect x="6" y="14" width="7" height="13" />
          <rect x="15" y="7" width="7" height="20" />
          <rect x="24" y="11" width="7" height="16" />
        </>
      )}
      {kind === 'point' && (
        <>
          <Whisk x={9} a={10} b={20} />
          <Whisk x={18} a={14} b={24} />
          <Whisk x={27} a={6} b={14} />
          <Dots at={[[9, 15], [18, 19], [27, 10]]} />
        </>
      )}
      {kind === 'slope' && (
        <>
          <path d="M8 22 17 11l10 7" />
          <Whisk x={8} a={18} b={26} />
          <Whisk x={17} a={7} b={15} />
          <Whisk x={27} a={14} b={22} />
          {[[8, 22], [17, 11], [27, 18]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="2" fill="var(--color-panel, white)" />)}
        </>
      )}
      {kind === 'bar-line' && (
        <>
          {/* The line's own axis on the right, the bars soft so the line reads over them. */}
          <path d="M33 2v25" />
          <rect x="6" y="9" width="6" height="18" fill="currentColor" fillOpacity={0.25} />
          <rect x="15" y="15" width="6" height="12" fill="currentColor" fillOpacity={0.25} />
          <rect x="24" y="19" width="6" height="8" fill="currentColor" fillOpacity={0.25} />
          <path d="M9 18 18 10l9-4" />
          <Dots at={[[9, 18], [18, 10], [27, 6]]} />
        </>
      )}
      {kind === 'xy' &&<Dots at={[[7, 23], [10, 19], [13, 21], [15, 15], [19, 16], [21, 11], [25, 12], [28, 7], [31, 8]]} />}
      {kind === 'xy-line' && (
        <>
          <path d="M6 24 10 20 15 14 22 10 32 8" />
          <Dots at={[[6, 24], [10, 20], [15, 14], [22, 10], [32, 8]]} />
        </>
      )}
      {kind === 'line' && (
        <>
          <path d="M8 21 17 12l9 4 6-9" />
          <Dots at={[[8, 21], [17, 12], [26, 16], [32, 7]]} />
        </>
      )}
    </>
  )
}

/** Arrow keys move along a radio group, as in the other panels. */
function radioKeys(event: KeyboardEvent<HTMLElement>, types: GraphType[], index: number, pick: (kind: ChartKind) => void) {
  const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
  if (step === 0) return
  event.preventDefault()
  const next = (index + step + types.length) % types.length
  const type = types[next]
  if (type) pick(type.id)
  event.currentTarget.closest('[role=radiogroup]')?.querySelectorAll<HTMLElement>('[role=radio]')[next]?.focus()
}

/** The More tile. Passes its props on so the popover can attach itself to it. */
function MoreTile(props: ComponentProps<'button'>) {
  return (
    <button
      type="button"
      aria-label="More graphs"
      {...props}
      className="group flex aspect-square min-w-0 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border-strong p-2 text-muted-foreground transition-colors duration-(--duration-instant) hover:bg-accent hover:text-foreground data-popup-open:bg-accent"
    >
      <span className="flex w-3/5 flex-1 items-center justify-center">
        <Ellipsis className="size-5" aria-hidden="true" />
      </span>
      <span className="text-xs">More</span>
    </button>
  )
}

/** One graph in the popup: a bordered button with its picture and name, the picked one blue. */
function NamedTile({ type, on, onPick }: { type: GraphType; on: boolean; onPick: (kind: ChartKind) => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      title={type.hint}
      aria-description={type.hint}
      onClick={() => onPick(type.id)}
      className={cn(
        'flex aspect-square min-w-0 flex-col items-center justify-center gap-2 rounded-md border px-1 py-2 transition-colors duration-(--duration-instant) focus-visible:outline-2 focus-visible:outline-ring',
        on ? 'border-primary/25 bg-primary-subtle text-primary-subtle-foreground hover:bg-primary-subtle-hover' : 'border-border-strong bg-panel text-foreground hover:bg-muted',
      )}
    >
      <span className="size-11 shrink-0 [&>svg]:size-full">
        <GraphTypePicture kind={type.id} />
      </span>
      <span className={cn('w-full truncate text-center text-[11px] leading-tight', !on && 'text-muted-foreground')}>{type.name}</span>
    </button>
  )
}

const matches = (type: GraphType, query: string) => `${type.name} ${type.hint}`.toLowerCase().includes(query.trim().toLowerCase())

/** The popup's contents: family tabs, a search field, and the graphs. */
function AllGraphs({ value, onPick }: { value?: ChartKind; onPick: (kind: ChartKind) => void }) {
  const [family, setFamily] = useState(familyIdOf(value ?? 'bar'))
  const [query, setQuery] = useState('')
  const searching = query.trim() !== ''
  // Searching looks through every family and names them; otherwise the open tab's graphs show.
  const shown = GRAPH_FAMILIES.map((f) => ({ ...f, types: f.types.filter((type) => matches(type, query)) })).filter((f) => f.types.length > 0 && (searching || f.id === family))
  return (
    <div className="flex w-[300px] max-w-full flex-col gap-2">
      <Tabs label="Graph family" variant="segmented" value={family} onValueChange={setFamily} tabs={GRAPH_FAMILIES.map((f) => ({ value: f.id, label: f.tab }))} />
      <SearchField value={query} onValueChange={setQuery} placeholder="Search all graphs" label="Search graphs" />
      <div className="flex min-h-[190px] flex-col gap-1">
        {shown.map((f) => (
          <section key={f.id} aria-label={f.name}>
            {searching && <h3 className="section-label flex h-7 items-center">{f.name}</h3>}
            <div role="radiogroup" aria-label={f.name} className="grid grid-cols-3 gap-2">
              {f.types.map((type) => (
                <NamedTile key={type.id} type={type} on={type.id === value} onPick={onPick} />
              ))}
            </div>
          </section>
        ))}
        {shown.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">No graph matches that search.</p>}
      </div>
    </div>
  )
}

/**
 * Every graph type at once, family by family under its name, as named
 * tiles: for an empty chart space waiting for a graph (BIO-86), so it's clear
 * a graph type is to be picked (owner's feedback, 2026-11-25).
 */
export function GraphList({ onPick, className }: { onPick: (kind: ChartKind) => void; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {GRAPH_FAMILIES.map((f) => (
        <section key={f.id} aria-label={f.name}>
          <h3 className="section-label flex h-7 items-center">{f.name}</h3>
          <div role="radiogroup" aria-label={f.name} className="grid grid-cols-3 gap-2">
            {f.types.map((type) => (
              <NamedTile key={type.id} type={type} on={false} onPick={onPick} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

export type GraphTypePickerProps = {
  /** The picked graph. None: nothing is picked yet. */
  value?: ChartKind
  onChange: (kind: ChartKind) => void
}

/** Three common graphs and a More tile. Shared by the Graph panel and the properties panel. */
export function GraphTypePicker({ value, onChange }: GraphTypePickerProps) {
  const [open, setOpen] = useState(false)
  // The picked graph takes the third place when it isn't one of the common ones.
  const row = value === undefined || COMMON_GRAPHS.includes(value) ? COMMON_GRAPHS : [...COMMON_GRAPHS.slice(0, -1), value]
  const types = row.flatMap((kind) => graphType(kind) ?? [])
  const pick = (kind: ChartKind) => {
    onChange(kind)
    setOpen(false)
  }
  return (
    <div className="flex flex-col gap-2">
      <div role="radiogroup" aria-label="Graph type" className="grid grid-cols-4 gap-2">
        {types.map((type, index) => (
          <span key={type.id} className="flex min-w-0 [&>*]:w-full">
            <Tooltip label={type.hint}>
              <DrawTile
                role="radio"
                aria-checked={type.id === value}
                aria-pressed={undefined}
                aria-description={type.hint}
                tabIndex={type.id === (value ?? 'bar') ? 0 : -1}
                name={type.name}
                picked={type.id === value}
                picture={<GraphTypePicture kind={type.id} />}
                onClick={() => onChange(type.id)}
                onKeyDown={(event) => radioKeys(event, types, index, onChange)}
              />
            </Tooltip>
          </span>
        ))}
        <Popover title="All graphs" side="right" align="start" divider={false} className="w-auto" open={open} onOpenChange={setOpen} trigger={<MoreTile />}>
          <AllGraphs value={value} onPick={pick} />
        </Popover>
      </div>
    </div>
  )
}
