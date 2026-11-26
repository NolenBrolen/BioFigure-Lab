/*
 * Error bar picker: the three most used error bars (SD, SEM, 95% CI) are
 * tiles in a row with a More tile. More opens a popup to the right with family
 * tabs (Spread, Confidence, Distribution), a search field that looks through
 * every family, and the error bars as tiles. An error bar picked from More
 * takes the row's third place, as in the graph picker.
 *
 * Inside `ExpandedControls` (a phone's sheet) there is no popup: the tabs,
 * search and tiles show in place under the row (see Popover).
 *
 * Picked look: draft C with tabs (BIO-39, 2026-11-19).
 */
import { Ellipsis } from 'lucide-react'
import { useState, type ComponentProps, type KeyboardEvent } from 'react'

import { cn } from '../../lib/cn'
import { DrawTile } from '../draw-tile/DrawTile'
import { Popover } from '../popover/Popover'
import { SearchField } from '../search-field/SearchField'
import { Tabs } from '../tabs/Tabs'
import { Tooltip } from '../tooltip/Tooltip'

/** Old saved figures only have 'sd', 'sem' and 'none'; the other ids are newer. */
export type ErrorBars = 'sd' | 'sem' | 'ci95' | 'ci90' | 'ci99' | 'sd2' | 'sem2' | 'range' | 'iqr' | 'mad' | 'none'

export type ErrorBarInfo = {
  id: ErrorBars
  name: string
  hint: string
  /** Where the whisker ends in the small picture (0 = top); `down` only for the uneven ones. */
  up: number
  down?: number
  cap: number
}
export type ErrorBarFamily = { id: string; name: string; tab: string; bars: ErrorBarInfo[] }

export const ERROR_BAR_FAMILIES: ErrorBarFamily[] = [
  {
    id: 'spread',
    name: 'Spread',
    tab: 'Spread',
    bars: [
      { id: 'sd', name: 'SD', hint: 'Standard deviation: the spread of the replicates', up: 2, cap: 3 },
      { id: 'sem', name: 'SEM', hint: 'Standard error of the mean: how sure the mean is', up: 6, cap: 3 },
      { id: 'sd2', name: '2 × SD', hint: 'Two standard deviations', up: 0, cap: 3 },
      { id: 'sem2', name: '2 × SEM', hint: 'Two standard errors of the mean, about a 95% interval', up: 3, cap: 3 },
      { id: 'none', name: 'None', hint: 'No error bars', up: 10, cap: 0 },
    ],
  },
  {
    id: 'confidence',
    name: 'Confidence interval',
    tab: 'Confidence',
    bars: [
      { id: 'ci95', name: '95% CI', hint: '95% confidence interval: the mean is in here 95 times out of 100', up: 4, cap: 4 },
      { id: 'ci90', name: '90% CI', hint: '90% confidence interval', up: 5, cap: 4 },
      { id: 'ci99', name: '99% CI', hint: '99% confidence interval', up: 2, cap: 4 },
    ],
  },
  {
    id: 'distribution',
    name: 'Distribution',
    tab: 'Distribution',
    bars: [
      { id: 'range', name: 'Range', hint: 'From the smallest to the largest value', up: 1, down: 18, cap: 3 },
      { id: 'iqr', name: 'IQR', hint: 'Interquartile range: the middle half of the values', up: 4, down: 15, cap: 3 },
      { id: 'mad', name: 'MAD', hint: 'Raw (unscaled) median absolute deviation: spread that outliers hardly move', up: 5, down: 15, cap: 3 },
    ],
  },
]

export const ERROR_BARS: ErrorBarInfo[] = ERROR_BAR_FAMILIES.flatMap((family) => family.bars)

/** The three most used error bars, always in the row. */
export const COMMON_ERROR_BARS: ErrorBars[] = ['sd', 'sem', 'ci95']

export const errorBarInfo = (id: ErrorBars) => ERROR_BARS.find((bar) => bar.id === id)

const familyIdOf = (id: ErrorBars) => ERROR_BAR_FAMILIES.find((family) => family.bars.some((bar) => bar.id === id))?.id ?? 'spread'

const lineProps = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.25, strokeLinejoin: 'round', strokeLinecap: 'round' } as const

/** A small picture of an error bar: a bar with its whisker; the uneven ones (range, IQR, MAD) also have a lower whisker through the bar. */
export function ErrorBarPicture({ bars, className }: { bars: ErrorBars; className?: string }) {
  const { up = 10, down, cap = 0 } = errorBarInfo(bars) ?? {}
  const half = cap / 1.5
  return (
    <svg aria-hidden viewBox="0 0 16 20" className={className} {...lineProps}>
      <rect x="4" y="10" width="8" height="9" />
      {bars !== 'none' && <path d={`M8 10V${up}M${8 - half} ${up}h${half * 2}`} />}
      {down !== undefined && <path d={`M8 10V${down}M${8 - half} ${down}h${half * 2}`} />}
    </svg>
  )
}

/** Arrow keys move along a radio group, as in the other panels. */
function radioKeys(event: KeyboardEvent<HTMLElement>, bars: ErrorBars[], index: number, pick: (id: ErrorBars) => void) {
  const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
  if (step === 0) return
  event.preventDefault()
  const next = (index + step + bars.length) % bars.length
  const id = bars[next]
  if (id) pick(id)
  event.currentTarget.closest('[role=radiogroup]')?.querySelectorAll<HTMLElement>('[role=radio]')[next]?.focus()
}

/** The More tile. Passes its props on so the popover can attach itself to it. */
function MoreTile(props: ComponentProps<'button'>) {
  return (
    <button
      type="button"
      aria-label="More error bars"
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

/** One error bar in the popup: a bordered button with its picture and name, the picked one blue. */
function NamedTile({ bar, on, onPick }: { bar: ErrorBarInfo; on: boolean; onPick: (id: ErrorBars) => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      title={bar.hint}
      aria-description={bar.hint}
      onClick={() => onPick(bar.id)}
      className={cn(
        'flex aspect-square min-w-0 flex-col items-center justify-center gap-2 rounded-md border px-1 py-2 transition-colors duration-(--duration-instant) focus-visible:outline-2 focus-visible:outline-ring',
        on ? 'border-primary/25 bg-primary-subtle text-primary-subtle-foreground hover:bg-primary-subtle-hover' : 'border-border-strong bg-panel text-foreground hover:bg-muted',
      )}
    >
      <span className="size-10 shrink-0 [&>svg]:size-full">
        <ErrorBarPicture bars={bar.id} />
      </span>
      <span className={cn('w-full truncate text-center text-[11px] leading-tight', !on && 'text-muted-foreground')}>{bar.name}</span>
    </button>
  )
}

const matches = (bar: ErrorBarInfo, query: string) => `${bar.name} ${bar.hint}`.toLowerCase().includes(query.trim().toLowerCase())

/** The popup's contents: family tabs, a search field, and the error bars. */
function AllErrorBars({ value, onPick }: { value?: ErrorBars; onPick: (id: ErrorBars) => void }) {
  const [family, setFamily] = useState(familyIdOf(value ?? 'sd'))
  const [query, setQuery] = useState('')
  const searching = query.trim() !== ''
  // Searching looks through every family and names them; otherwise the open tab's error bars show.
  const shown = ERROR_BAR_FAMILIES.map((f) => ({ ...f, bars: f.bars.filter((bar) => matches(bar, query)) })).filter((f) => f.bars.length > 0 && (searching || f.id === family))
  return (
    <div className="flex w-[300px] max-w-full flex-col gap-2">
      <Tabs label="Error bar family" variant="segmented" value={family} onValueChange={setFamily} tabs={ERROR_BAR_FAMILIES.map((f) => ({ value: f.id, label: f.tab }))} />
      <SearchField value={query} onValueChange={setQuery} placeholder="Search all error bars" label="Search error bars" />
      <div className="flex min-h-[190px] flex-col gap-1">
        {shown.map((f) => (
          <section key={f.id} aria-label={f.name}>
            {searching && <h3 className="section-label flex h-7 items-center">{f.name}</h3>}
            <div role="radiogroup" aria-label={f.name} className="grid grid-cols-3 gap-2">
              {f.bars.map((bar) => (
                <NamedTile key={bar.id} bar={bar} on={bar.id === value} onPick={onPick} />
              ))}
            </div>
          </section>
        ))}
        {shown.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">No error bar matches that search.</p>}
      </div>
    </div>
  )
}

export type ErrorBarPickerProps = {
  value: ErrorBars
  onChange: (bars: ErrorBars) => void
}

/** Three common error bars and a More tile. Shared by the Graph panel and the properties panel. */
export function ErrorBarPicker({ value, onChange }: ErrorBarPickerProps) {
  const [open, setOpen] = useState(false)
  // The picked error bar takes the third place when it isn't one of the common ones.
  const row = COMMON_ERROR_BARS.includes(value) ? COMMON_ERROR_BARS : [...COMMON_ERROR_BARS.slice(0, -1), value]
  const bars = row.flatMap((id) => errorBarInfo(id) ?? [])
  const pick = (id: ErrorBars) => {
    onChange(id)
    setOpen(false)
  }
  return (
    <div role="radiogroup" aria-label="Error bars" className="grid grid-cols-4 gap-2">
      {bars.map((bar, index) => (
        <span key={bar.id} className="flex min-w-0 [&>*]:w-full">
          <Tooltip label={bar.hint}>
            <DrawTile
              role="radio"
              aria-checked={bar.id === value}
              aria-pressed={undefined}
              aria-description={bar.hint}
              tabIndex={bar.id === value ? 0 : -1}
              name={bar.name}
              picked={bar.id === value}
              picture={<ErrorBarPicture bars={bar.id} />}
              onClick={() => onChange(bar.id)}
              onKeyDown={(event) => radioKeys(event, row, index, onChange)}
            />
          </Tooltip>
        </span>
      ))}
      <Popover title="All error bars" side="right" align="start" divider={false} className="w-auto" open={open} onOpenChange={setOpen} trigger={<MoreTile />}>
        <AllErrorBars value={value} onPick={pick} />
      </Popover>
    </div>
  )
}
