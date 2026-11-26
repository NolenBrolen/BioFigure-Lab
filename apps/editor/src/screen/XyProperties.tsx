/*
 * An XY chart's own settings (BIO-71), placed in the chart properties'
 * sections like the heatmap's:
 *
 * - Colours: one block per series (draft A, picked 2026-11-25): its colour
 *   swatch and the four dot shapes side by side, Filled / Open as the bar
 *   toggle under them; then which column colours the dots by its value, with
 *   the colour scale and its range.
 * - Graph: the x axis's scale and the y = x line, next to the frame and grid.
 * - Axes: the x axis's range.
 *
 * Small choices are buttons with pictures, never dropdowns; on/off settings
 * are the bar toggle.
 */
import { ColourMenu } from '@biofigure-lab/ui/components/colour-input/ColourInput'
import { ColourScalePicker } from '@biofigure-lab/ui/components/colour-scale-picker/ColourScalePicker'
import { SegmentedToggle } from '@biofigure-lab/ui/components/segmented-toggle/SegmentedToggle'
import { isTwoSided } from '@biofigure-lab/ui/lib/colour-scales'
import { cn } from '@biofigure-lab/ui/lib/cn'
import { useExpandedControls } from '@biofigure-lab/ui/lib/expanded-controls'
import { Fragment } from 'react'

import { groupColour, type ChartData, type DotShape } from '../editor/chart-model'
import { colourColumn, DOT_SHAPES, markerFor, xyAxes, xyColourScale, xySettings, type XyMarker, type XySettings } from '../editor/chart-xy'
import { Segmented } from './ChartProperties'
import { ScaleLinearIcon, ScaleLogIcon } from './chart-frame-icons'
import { BarToggle, ValueField } from './HeatmapProperties'
import { PropRow } from './properties-pane'
import { dotShapeIcon, FilledDotIcon, IdentityOffIcon, IdentityOnIcon, OpenDotIcon } from './xy-icons'

type Props = {
  chart: ChartData
  onChange: (patch: Partial<ChartData>, save?: boolean) => void
}

/** The phone's bar knows each series' row by this and the series' name, and puts them all under Colours. */
export const DOTS_ROW = 'Dots: '

const SHAPE_NAMES: Record<DotShape, string> = { circle: 'Circle', square: 'Square', triangle: 'Triangle', diamond: 'Diamond' }

/** The y columns that are drawn as series (not the x column, not the colour-by one), with their place among the y columns. */
export function seriesColumns(chart: ChartData): { group: number; series: number; name: string }[] {
  const colourBy = colourColumn(chart)
  return chart.groups.flatMap((g, group) => (group === 0 || group === colourBy ? [] : [{ group, series: group - 1, name: g.name.trim() || `Series ${group}` }]))
}

const setXy = (chart: ChartData, patch: Partial<XySettings>): Partial<ChartData> => ({ xy: { ...xySettings(chart), ...patch } })

/** One series' dot changed: every series up to it keeps the dot it shows now. */
function withMarker(chart: ChartData, series: number, patch: Partial<XyMarker>): Partial<ChartData> {
  const s = xySettings(chart)
  const markers = Array.from({ length: Math.max(s.markers.length, series + 1) }, (_, i) => markerFor(s, i))
  markers[series] = { ...markers[series], ...patch }
  return setXy(chart, { markers })
}

/** Each series' colour, shape and fill (draft A). */
export function XyDotRows({ chart, onChange, usedColours }: Props & { usedColours?: () => readonly string[] }) {
  const s = xySettings(chart)
  const byValue = colourColumn(chart) !== null
  const setColour = (series: number, colour: string) => {
    const colours = Array.from({ length: Math.max(chart.groups.length, series + 1) }, (_, j) => groupColour(chart, j))
    colours[series] = colour
    onChange({ colours })
  }
  const list = seriesColumns(chart)
  return (
    <>
      {list.map(({ series, name }, i) => {
        const marker = markerFor(s, series)
        const colour = groupColour(chart, series)
        return (
          <Fragment key={series}>
            <PropRow label={name} rowId={`${DOTS_ROW}${name}`} top>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  {/* Coloured by a value, the dots take the scale's colours; the series colour still draws its line. */}
                  <ColourMenu
                    label={`Colour of ${name}`}
                    value={colour.toLowerCase()}
                    used={usedColours}
                    onChange={(next) => next && setColour(series, next)}
                    trigger={
                      <button
                        type="button"
                        aria-label={`Colour of ${name}`}
                        title={byValue ? 'Colours the line; the dots follow the colour scale' : undefined}
                        style={{ background: colour }}
                        className="size-7 shrink-0 cursor-pointer rounded-md ring-1 ring-border-strong ring-inset focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
                      />
                    }
                  />
                  <SegmentedToggle
                    label={`Dot shape of ${name}`}
                    className="min-w-0 flex-1"
                    value={marker.shape}
                    options={DOT_SHAPES.map((shape) => ({ value: shape, label: SHAPE_NAMES[shape], icon: dotShapeIcon(shape, marker.filled) }))}
                    onValueChange={(shape) => onChange(withMarker(chart, series, { shape }))}
                  />
                </div>
                <BarToggle label={`${name}: filled dots`} checked={marker.filled} onCheckedChange={(filled) => onChange(withMarker(chart, series, { filled }))} offIcon={<OpenDotIcon className="size-4" />} onIcon={<FilledDotIcon className="size-4" />} />
              </div>
            </PropRow>
            {i < list.length - 1 && <div aria-hidden="true" className="col-span-2 border-t" />}
          </Fragment>
        )
      })}
    </>
  )
}

/** Which column colours the dots (none, or one of the y columns), then its colour scale and range. */
export function XyColourByRows({ chart, onChange }: Props) {
  const expanded = useExpandedControls()
  const s = xySettings(chart)
  const column = colourColumn(chart)
  const scale = xyColourScale(chart)
  const twoSided = isTwoSided(s.scale)
  const custom = s.min !== null || s.max !== null
  const options = [{ id: null as number | null, name: 'None' }, ...chart.groups.slice(1).map((g, i) => ({ id: i + 1, name: g.name.trim() || `Series ${i + 1}` }))]
  return (
    <>
      <PropRow label="Colour by" top>
        {/* A few choices as pills, the picked one blue: no dropdown. */}
        <div role="radiogroup" aria-label="Colour the dots by a column" className="flex min-w-0 flex-1 flex-wrap gap-1">
          {options.map((option) => {
            const on = option.id === column
            return (
              <button
                key={option.id ?? 'none'}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onChange(setXy(chart, { colourBy: option.id }))}
                className={cn(
                  'max-w-full truncate rounded-full px-2.5 ring-1 ring-border-strong ring-inset outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  expanded ? 'h-9 text-sm' : 'h-7 text-xs',
                  on ? 'bg-primary-subtle text-primary-subtle-foreground ring-primary' : 'hover:bg-muted',
                )}
              >
                {option.name}
              </button>
            )
          })}
        </div>
      </PropRow>
      {column !== null && scale && (
        <>
          <PropRow label="Scale" top wide={!expanded} hideLabel={!expanded}>
            <ColourScalePicker value={s.scale} onChange={(next) => onChange(setXy(chart, { scale: next }))} />
          </PropRow>
          <PropRow label="Colour range">
            <div className="min-w-0 flex-1">
              <Segmented
                label="Colour range"
                value={custom ? 'custom' : 'auto'}
                options={[
                  { id: 'auto', name: 'Auto', hint: 'From the smallest to the largest value' },
                  { id: 'custom', name: 'Custom', hint: 'Type where the colours start and end' },
                ]}
                onChange={(choice) => onChange(setXy(chart, choice === 'auto' ? { min: null, max: null } : { min: scale.min, max: scale.max }))}
              />
            </div>
          </PropRow>
          {custom && (
            <PropRow label="">
              <div className={cn('grid min-w-0 flex-1 grid-cols-2', expanded ? 'gap-2' : 'gap-1')}>
                <ValueField label="Colours from" value={scale.min} onCommit={(min) => onChange(setXy(chart, { min, max: scale.max }))} />
                <ValueField label="Colours to" value={scale.max} onCommit={(max) => onChange(setXy(chart, { min: scale.min, max }))} />
              </div>
            </PropRow>
          )}
          {twoSided && (
            <PropRow label="Centre">
              <div className="min-w-0 flex-1">
                <ValueField label="Value at the white middle" value={s.centre} onCommit={(centre) => onChange(setXy(chart, { centre }))} />
              </div>
            </PropRow>
          )}
        </>
      )}
    </>
  )
}

/** The x axis's scale and the y = x line, for the Graph section beside the frame and grid. */
export function XyPlotRows({ chart, onChange }: Props) {
  const s = xySettings(chart)
  return (
    <>
      <PropRow label="X scale" top>
        <SegmentedToggle
          label="X axis scale"
          stacked
          className="w-full"
          value={s.xScale}
          options={[
            { value: 'linear', label: 'Linear', icon: ScaleLinearIcon },
            { value: 'log', label: 'Log', icon: ScaleLogIcon },
          ]}
          // A typed range at or below 0 can't be used on a log axis, so the range goes back to auto.
          onValueChange={(xScale) => onChange(setXy(chart, xScale === 'log' && ((s.xMin ?? 1) <= 0 || (s.xMax ?? 1) <= 0) ? { xScale, xMin: null, xMax: null } : { xScale }))}
        />
      </PropRow>
      <PropRow label="y = x">
        <BarToggle label="Dashed y = x line" checked={s.identityLine} onCheckedChange={(identityLine) => onChange(setXy(chart, { identityLine }))} offIcon={<IdentityOffIcon className="size-4" />} onIcon={<IdentityOnIcon className="size-4" />} />
      </PropRow>
    </>
  )
}

/** The x axis's range: auto from the data, or typed. */
export function XyRangeRows({ chart, onChange }: Props) {
  const expanded = useExpandedControls()
  const s = xySettings(chart)
  const axis = xyAxes(chart).x
  const custom = s.xMin !== null || s.xMax !== null
  return (
    <>
      <PropRow label="X range">
        <div className="min-w-0 flex-1">
          <Segmented
            label="X axis range"
            value={custom ? 'custom' : 'auto'}
            options={[
              { id: 'auto', name: 'Auto', hint: 'Worked out from the data' },
              { id: 'custom', name: 'Custom', hint: 'Type where the x axis starts and ends' },
            ]}
            onChange={(choice) => onChange(setXy(chart, choice === 'auto' ? { xMin: null, xMax: null } : { xMin: axis.min, xMax: axis.max }))}
          />
        </div>
      </PropRow>
      {custom && (
        <PropRow label="">
          <div className={cn('grid min-w-0 flex-1 grid-cols-2', expanded ? 'gap-2' : 'gap-1')}>
            <ValueField label="X axis from" value={axis.min} onCommit={(xMin) => onChange(setXy(chart, { xMin }))} />
            <ValueField label="X axis to" value={axis.max} onCommit={(xMax) => onChange(setXy(chart, { xMax }))} />
          </div>
        </PropRow>
      )}
    </>
  )
}

/** The series' dots in their colours and shapes, for the Colours row's summary. */
export function DotsSummary({ chart }: { chart: ChartData }) {
  const s = xySettings(chart)
  return (
    <span className="flex items-center gap-1">
      {seriesColumns(chart)
        .slice(0, 6)
        .map(({ series }) => {
          const marker = markerFor(s, series)
          const Icon = dotShapeIcon(marker.shape, marker.filled)
          return (
            <span key={series} style={{ color: groupColour(chart, series) }}>
              <Icon className="size-3.5" />
            </span>
          )
        })}
    </span>
  )
}
