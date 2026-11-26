/*
 * A heatmap's own settings, in the chart properties' Colours section (and the
 * phone's Colours sheet): what the cells show, the colour scale and its range,
 * the values printed in the cells, and the colour bar. Its labels rows (row and
 * column titles, names on or off) go in the Axes section instead.
 *
 * Small choices are buttons with pictures, never dropdowns; on/off settings are
 * the fat bar toggle with a picture for each state; the scale is the
 * colour-scale picker (draft A, picked 2026-11-24).
 */
import { ColourScalePicker } from '@biofigure-lab/ui/components/colour-scale-picker/ColourScalePicker'
import { SegmentedToggle } from '@biofigure-lab/ui/components/segmented-toggle/SegmentedToggle'
import { TextField } from '@biofigure-lab/ui/components/text-field/TextField'
import { Toggle } from '@biofigure-lab/ui/components/toggle/Toggle'
import { COLOUR_SCALES, isTwoSided, scaleGradient } from '@biofigure-lab/ui/lib/colour-scales'
import { cn } from '@biofigure-lab/ui/lib/cn'
import { useExpandedControls } from '@biofigure-lab/ui/lib/expanded-controls'
import type { ReactNode } from 'react'

import type { ChartData } from '../editor/chart-model'
import { parseNumber } from '../editor/chart-model'
import { heatmapScale, heatmapSettings, type HeatmapSettings, type HeatmapValues } from '../editor/chart-heatmap'
import { Segmented } from './ChartProperties'
import { useTyped } from './fields'
import { LopsidedIcon, NamesIcon, NamesOffIcon, PearsonIcon, SpearmanIcon, SymmetricIcon, TypedValuesIcon } from './heatmap-icons'
import { PropRow } from './properties-pane'

type Props = {
  chart: ChartData
  onChange: (patch: Partial<ChartData>, save?: boolean) => void
  onSave: () => void
}

/** The colour bar's title a correlation gets, unless one was typed. */
const BAR_TITLES: Record<HeatmapValues, string> = { typed: '', pearson: 'Pearson r', spearman: 'Spearman ρ' }

/** What the cells show, as three buttons with pictures (the name under each). */
const VALUE_OPTIONS = [
  { value: 'typed', icon: TypedValuesIcon, label: 'As typed' },
  { value: 'pearson', icon: PearsonIcon, label: 'Pearson' },
  { value: 'spearman', icon: SpearmanIcon, label: 'Spearman' },
] as const

/** Words in place of pictures, for bars with no clear pair of pictures (the owner's call, 2026-11-24). */
export const OFF_TEXT = <span className="text-xs font-medium">Off</span>
export const ON_TEXT = <span className="text-xs font-medium">On</span>

/** The fat on/off bar, with a picture for each state. */
export function BarToggle({ label, checked, onCheckedChange, offIcon, onIcon }: { label: string; checked: boolean; onCheckedChange: (on: boolean) => void; offIcon: ReactNode; onIcon: ReactNode }) {
  return <Toggle variant="bar" label={label} hideLabel checked={checked} onCheckedChange={onCheckedChange} offIcon={offIcon} onIcon={onIcon} className="min-w-0 flex-1" />
}

/** A one-line field that changes the chart as you type; Enter leaves it. */
export function LiveField({ label, value, placeholder, onType, onDone }: { label: string; value: string; placeholder?: string; onType: (text: string) => void; onDone: () => void }) {
  const { text, setText, setFocused } = useTyped(value)
  return (
    <TextField
      label={label}
      hideLabel
      value={text}
      placeholder={placeholder}
      onFocus={() => setFocused(true)}
      onChange={(event) => {
        setText(event.target.value)
        onType(event.target.value)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
      }}
      onBlur={() => {
        setFocused(false)
        onDone()
      }}
    />
  )
}

/** A number applied when the field is left or Enter is pressed. */
export function ValueField({ label, value, onCommit }: { label: string; value: number; onCommit: (value: number) => void }) {
  const shown = String(Number(value.toPrecision(6)))
  return (
    <TextField
      key={shown}
      label={label}
      hideLabel
      inputMode="decimal"
      defaultValue={shown}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
      }}
      onBlur={(event) => {
        const next = parseNumber(event.target.value)
        if (next !== null && next !== value) onCommit(next)
        else event.target.value = shown
      }}
    />
  )
}

export function HeatmapColourRows({ chart, onChange, onSave }: Props) {
  const expanded = useExpandedControls()
  const s = heatmapSettings(chart)
  const set = (patch: Partial<HeatmapSettings>, save?: boolean) => onChange({ heatmap: { ...s, ...patch } }, save)
  const scale = heatmapScale(chart)
  const twoSided = isTwoSided(s.scale)
  const custom = s.min !== null || s.max !== null
  const centre = s.centre
  // Symmetric: changing one end moves the other to the same distance on the centre's other side.
  const setEnd = (end: 'min' | 'max', value: number) => {
    if (!twoSided || !s.symmetric) return set(end === 'min' ? { min: value, max: scale.max } : { min: scale.min, max: value })
    const reach = Math.abs(value - centre)
    set({ min: centre - reach, max: centre + reach })
  }
  return (
    <>
      {/* Desktop: the label above and the buttons across the whole row, as the graph Kind row. */}
      <PropRow label="Values" top wide={!expanded}>
        <SegmentedToggle
          label="What the cells show"
          stacked
          className="w-full"
          options={VALUE_OPTIONS}
          value={s.values}
          onValueChange={(values) => {
            // A correlation is two-sided round 0, from -1 to 1, and its bar says which one it is.
            const correlation = values !== 'typed'
            const autoTitle = s.barTitle === '' || Object.values(BAR_TITLES).includes(s.barTitle) || s.barTitle === 'log₂ expression'
            set({
              values,
              ...(correlation && s.values === 'typed' ? { scale: 'blue-red', min: null, max: null, centre: 0, symmetric: true } : {}),
              ...(autoTitle ? { barTitle: BAR_TITLES[values] } : {}),
            })
          }}
        />
      </PropRow>
      {/* Desktop: the whole row's width, as the colour templates of other charts. */}
      <PropRow label="Scale" top wide={!expanded} hideLabel={!expanded}>
        <ColourScalePicker value={s.scale} onChange={(scale) => set({ scale })} />
      </PropRow>
      <PropRow label="Colour range">
        <div className="min-w-0 flex-1">
          <Segmented
            label="Colour range"
            value={custom ? 'custom' : 'auto'}
            options={[
              { id: 'auto', name: 'Auto', hint: s.values === 'typed' ? 'From the smallest to the largest value' : 'From -1 to 1' },
              { id: 'custom', name: 'Custom', hint: 'Type where the colours start and end' },
            ]}
            onChange={(choice) => set(choice === 'auto' ? { min: null, max: null } : { min: scale.min, max: scale.max })}
          />
        </div>
      </PropRow>
      {custom && (
        <PropRow label="">
          <div className={cn('grid min-w-0 flex-1 grid-cols-2', expanded ? 'gap-2' : 'gap-1')}>
            <ValueField label="Colours from" value={scale.min} onCommit={(v) => setEnd('min', v)} />
            <ValueField label="Colours to" value={scale.max} onCommit={(v) => setEnd('max', v)} />
          </div>
        </PropRow>
      )}
      {twoSided && (
        <>
          <PropRow label="Centre">
            <div className="min-w-0 flex-1">
              <ValueField label="Value at the white middle" value={centre} onCommit={(next) => set({ centre: next, ...(custom && s.symmetric ? { min: next - (scale.max - scale.min) / 2, max: next + (scale.max - scale.min) / 2 } : {}) })} />
            </div>
          </PropRow>
          <PropRow label="Symmetric">
            <BarToggle label="As far below the centre as above it" checked={s.symmetric} onCheckedChange={(symmetric) => set({ symmetric })} offIcon={<LopsidedIcon />} onIcon={<SymmetricIcon />} />
          </PropRow>
        </>
      )}
      <PropRow label="Cell values">
        <BarToggle label="Print each cell's value" checked={s.cellValues} onCheckedChange={(cellValues) => set({ cellValues })} offIcon={OFF_TEXT} onIcon={ON_TEXT} />
      </PropRow>
      {s.cellValues && (
        <PropRow label="Decimals">
          <div className="min-w-0 flex-1">
            <Segmented label="Decimals in the cells" value={String(s.decimals)} options={['0', '1', '2', '3'].map((d) => ({ id: d, name: d }))} onChange={(d) => set({ decimals: Number(d) })} />
          </div>
        </PropRow>
      )}
      <PropRow label="Colour bar">
        <BarToggle label="Colour bar" checked={s.colourBar} onCheckedChange={(colourBar) => set({ colourBar })} offIcon={OFF_TEXT} onIcon={ON_TEXT} />
      </PropRow>
      {s.colourBar && (
        <PropRow label="Bar title">
          <div className="min-w-0 flex-1">
            <LiveField label="Colour bar title" placeholder="e.g. Pearson r" value={s.barTitle} onType={(barTitle) => set({ barTitle }, false)} onDone={onSave} />
          </div>
        </PropRow>
      )}
    </>
  )
}

/** The heatmap's labels: a title for the rows (standing at the left) and the columns (under them), and the names on or off. */
export function HeatmapLabelRows({ chart, onChange, onSave }: Props) {
  return (
    <>
      <PropRow label="Row title">
        <div className="min-w-0 flex-1">
          <LiveField label="Title of the rows" placeholder="None" value={chart.yTitle} onType={(yTitle) => onChange({ yTitle }, false)} onDone={onSave} />
        </div>
      </PropRow>
      <PropRow label="Column title">
        <div className="min-w-0 flex-1">
          <LiveField label="Title of the columns" placeholder="None" value={chart.xTitle} onType={(xTitle) => onChange({ xTitle }, false)} onDone={onSave} />
        </div>
      </PropRow>
      <PropRow label="Names">
        <BarToggle label="Row and column names" checked={chart.tickLabels} onCheckedChange={(tickLabels) => onChange({ tickLabels })} offIcon={<NamesOffIcon />} onIcon={<NamesIcon />} />
      </PropRow>
    </>
  )
}

/** A small strip of the heatmap's colour scale, for the Colours row's summary. */
export function ScaleSummary({ chart }: { chart: ChartData }) {
  const s = heatmapSettings(chart)
  return (
    <span className="flex items-center gap-1.5">
      {COLOUR_SCALES.find((c) => c.id === s.scale)?.name}
      <span className="h-3.5 w-10 rounded-sm ring-1 ring-border-strong ring-inset" style={{ background: scaleGradient(s.scale) }} />
    </span>
  )
}
