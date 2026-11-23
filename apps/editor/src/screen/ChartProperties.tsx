/*
 * The properties of a selected chart, in the Graph panel (the Shapes panel's
 * label-left rows, 2026-11-14). On desktop a list of sections with what each
 * is set to (Kind, Data, Colours, Axes, Labels, Font, Statistics,
 * Properties), the phone's groups; a click opens just that section, Back
 * returns to the list (design A of five, picked 2026-11-19; it replaced the
 * Chart / Text / Stats tabs).
 *
 * On a phone there are no tabs: every setting is listed once, in the
 * property bar's order, the data is edited in its own sheet, and the groups'
 * colours are picked one group at a time.
 *
 * Text fields change the chart as you type; leaving the field (or Enter)
 * makes it one undo step. In the text under the chart, Shift+Enter starts a
 * new line.
 */
import { ColourInput, ColourMenu } from '@biofigure-lab/ui/components/colour-input/ColourInput'
import { IconButton } from '@biofigure-lab/ui/components/icon-button/IconButton'
import { Select } from '@biofigure-lab/ui/components/select/Select'
import { Slider } from '@biofigure-lab/ui/components/slider/Slider'
import { FontPicker, type FontOption } from '@biofigure-lab/ui/components/text-controls/FontPicker'
import { TextField } from '@biofigure-lab/ui/components/text-field/TextField'
import { Tooltip } from '@biofigure-lab/ui/components/tooltip/Tooltip'
import { Toggle } from '@biofigure-lab/ui/components/toggle/Toggle'
import { ErrorBarPicker, errorBarInfo } from '@biofigure-lab/ui/components/graph-panel/ErrorBarPicker'
import { GraphTypePicker, graphType, usesErrorBars } from '@biofigure-lab/ui/components/graph-panel/GraphTypePicker'
import { uprightKind } from '@biofigure-lab/ui/lib/graph-kinds'
import { Tabs } from '@biofigure-lab/ui/components/tabs/Tabs'
import { cn } from '@biofigure-lab/ui/lib/cn'
import { ExpandedControls, useExpandedControls } from '@biofigure-lab/ui/lib/expanded-controls'
import { useSheetTitleEnd } from '@biofigure-lab/ui/lib/sheet-title'
import { Activity, Ban, ChartNoAxesCombined, ChartScatter, ChartSpline, Columns2, Crosshair, Flag, ListOrdered, Link2, MoveHorizontal, Repeat, Rows3, Target, TrendingUp, Waves, Waypoints, ArrowDownUp } from 'lucide-react'
import { AlignCenter, AlignLeft, AlignRight, ArrowDownToLine, ArrowUpToLine, Asterisk, Captions, ChartColumn, ChevronRight, Palette, RotateCcw, Ruler, Search, SlidersHorizontal, Type, X, type LucideIcon } from 'lucide-react'
import { useRef, useState, type ComponentType, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { COLOUR_BLIND_SAFE, groupColour, parseNumber, yAxis, type ChartData, type TextAlign } from '../editor/chart-model'
import { CORRECTED_TESTS, CORRECTIONS, STAT_TESTS, VALUE_TESTS, PAIRED_TESTS } from '../editor/chart-stats'
import { FONTS, fontStack } from '../editor/fonts'
import { LiveTextArea, NumberField as SizeField, useTyped, type LiveFieldProps } from './fields'
import { OpacityRow, PropNote, PropRow, PropRows, PropertiesHeader, SizeRow, type SizeChange } from './properties-pane'

const FONT_OPTIONS: FontOption[] = FONTS.map((font) => ({ name: font.name, category: font.category, family: fontStack(font) }))

/** Units scientists often put on a y axis; anything else is typed under Custom. */
export const Y_UNITS = ['%', 'mM', 'µM', 'nM', 'pM', 'mg/mL', 'µg/mL', 'ng/mL', 'pg/mL', 'cells/mL', 'CFU/mL', 'AU', 'RFU', 'RLU', 'OD₆₀₀', 'kDa', 'bp', 's', 'min', 'h', 'days', '°C', 'mmHg', 'mg/kg'] as const
const NO_UNIT = 'none'
const CUSTOM_UNIT = 'custom'

const ALIGNS = [
  { align: 'left', icon: AlignLeft, label: 'left' },
  { align: 'center', icon: AlignCenter, label: 'centre' },
  { align: 'right', icon: AlignRight, label: 'right' },
] as const

/** Left, centre and right buttons; `what` names the text in their labels. On phones, one wide segmented bar. */
function AlignButtons({ what, compact = false, value, onChange }: { what: string; compact?: boolean; value: TextAlign; onChange: (align: TextAlign) => void }) {
  const expanded = useExpandedControls()
  if (expanded) {
    const bar = <Segmented label={what} compact={compact} value={value} options={ALIGNS.map(({ align, icon, label }) => ({ id: align, name: label, icon }))} onChange={onChange} />
    // Compact: beside a field, as tall as it.
    return compact ? <div className="w-[7.5rem] shrink-0">{bar}</div> : bar
  }
  return (
    <div className="flex gap-1">
      {ALIGNS.map(({ align, icon, label }) => (
        <IconButton key={align} icon={icon} label={`${what}: ${label}`} pressed={value === align} onClick={() => onChange(align)} />
      ))}
    </div>
  )
}

/** Two or three choices side by side, the picked one raised (as the error-bar buttons). */
export function Segmented<T extends string>({ label, compact = false, value, options, onChange }: { label: string; compact?: boolean; value: T; options: { id: T; name: string; hint?: string; icon?: ComponentType<{ className?: string }> }[]; onChange: (value: T) => void }) {
  // Phones: tall enough to tap, and as wide as the sheet. An option with an icon shows only the icon.
  const expanded = useExpandedControls()
  return (
    <div role="radiogroup" aria-label={label} className={cn('grid auto-cols-fr grid-flow-col gap-1 rounded-lg bg-muted p-1', expanded && 'w-full')}>
      {options.map((option) => {
        const button = (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={value === option.id}
            aria-label={option.icon ? option.name : undefined}
            onClick={() => onChange(option.id)}
            className={cn(
              'flex items-center justify-center rounded-md',
              expanded ? (compact ? 'h-9 text-sm' : 'h-10 text-sm') : 'h-7 text-xs',
              value === option.id ? 'bg-panel text-foreground shadow-(--elevation-sm)' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option.icon ? <option.icon className="size-5" aria-hidden="true" /> : option.name}
          </button>
        )
        return option.hint && !expanded ? (
          <Tooltip key={option.id} label={option.hint}>
            {button}
          </Tooltip>
        ) : (
          button
        )
      })}
    </div>
  )
}

type FieldProps = LiveFieldProps

/** A one-line field that changes the chart as you type; Enter leaves it. */
function LiveField({ label, value, placeholder, onType, onDone }: FieldProps) {
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

/** A number for the y range, applied when the field is left or Enter is pressed. */
function NumberField({ label, value, onCommit }: { label: string; value: number; onCommit: (value: number) => void }) {
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

type Props = {
  chart: ChartData
  /** Change the chart; `save` off while typing, so it becomes one undo step when typing ends. */
  onChange: (patch: Partial<ChartData>, save?: boolean, mergeKey?: string) => void
  /** Typing ended: save what was typed as one undo step. */
  onSave: () => void
  onShowData: () => void
  /** Phones: the data editor, shown in the Data sheet itself (there is no drawer under the page). */
  data?: ReactNode
  /** The chart's size on the page, in px. */
  size: { width: number; height: number }
  opacity: number
  onResize: (change: SizeChange, keepProportions: boolean) => void
  onOpacity: (opacity: number) => void
  /** The colours already in the figure, offered first in each group's colour dropdown. */
  usedColours?: () => readonly string[]
  /** Desktop: the header over the list, which becomes the open section's header (one back arrow, always). */
  header?: { backLabel: string; picture: ReactNode; name: string; onBack: () => void }
}

/** A picture for each test, shown beside it in the full list. */
const TEST_ICONS: Record<string, LucideIcon> = {
  none: Ban, ttest: Columns2, anova: ChartColumn, mannwhitney: ArrowDownUp, paired: Link2, control: Target, kruskal: ListOrdered, wilcoxon: Waypoints,
  rmanova: Repeat, welchanova: Waves, friedman: Rows3, pearson: TrendingUp, spearman: ChartSpline, regression: ChartScatter, onesample: Crosshair,
  onesamplewilcoxon: Flag, trend: ChartNoAxesCombined, shapiro: Activity, brownforsythe: MoveHorizontal,
}

export function ChartProperties({ chart, onChange, onSave, onShowData, data, size, opacity, onResize, onOpacity, usedColours, header }: Props) {
  const [open, setOpen] = useState<ChartSection | null>(null)
  const [axisTab, setAxisTab] = useState<'y' | 'x'>('y')
  const expanded = useExpandedControls()
  const live = (key: 'title' | 'yTitle' | 'xTitle' | 'caption') => ({ value: chart[key], onType: (text: string) => onChange({ [key]: text }, false), onDone: onSave })
  const listedUnit = chart.yUnit === '' || (Y_UNITS as readonly string[]).includes(chart.yUnit)
  // Custom stays picked while its field is still empty.
  const [customUnit, setCustomUnit] = useState(!listedUnit)
  const unitChoice = customUnit || !listedUnit ? CUSTOM_UNIT : chart.yUnit || NO_UNIT
  const customRange = chart.yMin !== null || chart.yMax !== null
  const axis = yAxis(chart)
  const setColour = (i: number, colour: string) => {
    const colours = chart.groups.map((_, j) => groupColour(chart, j))
    colours[i] = colour
    onChange({ colours })
  }

  const withBars = usesErrorBars(chart.kind)
  const phoneInside = expanded && uprightKind(chart.kind) === 'bar' && chart.errorBars !== 'none'
  const kindRows = (
    <>
      {/* Desktop: the label above and the picker across the whole row, so the types get room (owner's call, 2026-11-19). */}
      <PropRow label="Kind" top wide={!expanded}>
        <div className="min-w-0 flex-1">
          <GraphTypePicker value={chart.kind} onChange={(kind) => onChange({ kind })} />
        </div>
      </PropRow>
      {/* Graphs with no error bar (box, violin, before-after...) have nothing to set below. */}
      {withBars && (
      <>
      {/* Phones: whether the error bar runs into the bar sits beside them, as two pictures, each part with its own caption (owner's call, 2026-11-17). */}
      <PropRow label="Error bars" top wide={!expanded} hideLabel={phoneInside}>
        <div className={cn('min-w-0 flex-1', phoneInside && 'pt-3')}>
          {phoneInside ? (
            <PhoneCaption text="Error bars">
              <ErrorBarPicker value={chart.errorBars} onChange={(errorBars) => onChange({ errorBars })} />
            </PhoneCaption>
          ) : (
            <ErrorBarPicker value={chart.errorBars} onChange={(errorBars) => onChange({ errorBars })} />
          )}
        </div>
        {phoneInside && (
          <div className="w-[6.5rem] shrink-0 pt-3">
            <PhoneCaption text="Inside bar">
            <Segmented
              label="Error bar inside the bar"
              value={chart.errorInside ? 'inside' : 'outside'}
              options={[
                { id: 'outside', name: 'Error bar on top of the bar', icon: ERROR_BAR_OUTSIDE },
                { id: 'inside', name: 'Error bar also inside the bar', icon: ERROR_BAR_INSIDE },
              ]}
              onChange={(choice) => onChange({ errorInside: choice === 'inside' })}
            />
            </PhoneCaption>
          </div>
        )}
      </PropRow>
      {!expanded && uprightKind(chart.kind) === 'bar' && chart.errorBars !== 'none' && (
        <PropRow label="Inside bar">
          <Toggle label="Error bar also inside the bar" hideLabel checked={chart.errorInside} onCheckedChange={(errorInside) => onChange({ errorInside })} />
        </PropRow>
      )}
      </>
      )}
    </>
  )
  const nameRows = (
    <>
      <PropRow label="Name">
        <div className="min-w-0 flex-1">
          <LiveField label="Chart name" placeholder="None" {...live('title')} />
        </div>
        {/* Phones: the alignment beside the field, as with the axis titles. */}
        {expanded && chart.title.trim() && <AlignButtons compact what="Align the name" value={chart.titleAlign} onChange={(titleAlign) => onChange({ titleAlign })} />}
      </PropRow>
      {chart.title.trim() && expanded && (
        <PropRow label="">
          <Segmented
            compact
            label="Name above or below the chart"
            value={chart.titlePosition}
            options={[
              { id: 'top', name: 'Above the chart' },
              { id: 'bottom', name: 'Below the chart' },
            ]}
            onChange={(titlePosition) => onChange({ titlePosition })}
          />
        </PropRow>
      )}
      {chart.title.trim() && !expanded && (
        <PropRow label="">
          <IconButton icon={ArrowUpToLine} label="Name above the chart" pressed={chart.titlePosition === 'top'} onClick={() => onChange({ titlePosition: 'top' })} />
          <IconButton icon={ArrowDownToLine} label="Name below the chart" pressed={chart.titlePosition === 'bottom'} onClick={() => onChange({ titlePosition: 'bottom' })} />
          <span className="w-2" />
          <AlignButtons what="Align the name" value={chart.titleAlign} onChange={(titleAlign) => onChange({ titleAlign })} />
        </PropRow>
      )}
    </>
  )
  const yAxisRows = (
    <>
      {!expanded && <AxisHeading text="Y axis" />}
      <PropRow label={expanded ? 'Title' : 'Label'}>
        <div className="min-w-0 flex-1">
          <LiveField label="Y axis title" placeholder="e.g. Concentration" {...live('yTitle')} />
        </div>
        {/* Phones: where the title sits along the axis, beside it (owner's call, 2026-11-17). */}
        {expanded && <AlignButtons compact what="Place the y axis title" value={chart.yTitleAlign} onChange={(yTitleAlign) => onChange({ yTitleAlign })} />}
      </PropRow>
      {!expanded && (
        <PropRow label="">
          <AlignButtons what="Place the y axis title" value={chart.yTitleAlign} onChange={(yTitleAlign) => onChange({ yTitleAlign })} />
        </PropRow>
      )}
      {/* Desktop: a dropdown; the phone's picker by kind of measurement needs room a panel doesn't have. */}
      <PropRow label="Unit" top={expanded}>
        {expanded ? (
          <UnitPicker
            value={chart.yUnit}
            onChange={(yUnit) => {
              setCustomUnit(false)
              onChange({ yUnit })
            }}
          />
        ) : (
          <Select
            label="Y axis unit"
            hideLabel
            className="min-w-0 flex-1"
            options={[{ value: NO_UNIT, label: 'No unit' }, ...UNIT_KINDS.flatMap((kind) => kind.units.map((unit) => ({ value: unit, label: unit, group: kind.name }))), { value: CUSTOM_UNIT, label: 'Custom…' }]}
            value={unitChoice}
            onValueChange={(choice) => {
              setCustomUnit(choice === CUSTOM_UNIT)
              if (choice !== CUSTOM_UNIT) onChange({ yUnit: choice === NO_UNIT ? '' : choice })
            }}
          />
        )}
      </PropRow>
      {unitChoice === CUSTOM_UNIT && !expanded && (
        <PropRow label="">
          <LiveField label="Custom y axis unit" value={chart.yUnit} placeholder="e.g. copies/µL" onType={(yUnit) => onChange({ yUnit }, false)} onDone={onSave} />
        </PropRow>
      )}
      <PropRow label="Range">
        <div className="min-w-0 flex-1">
          <Segmented
            label="Y axis range"
            value={customRange ? 'custom' : 'auto'}
            options={[
              { id: 'auto', name: 'Auto', hint: 'Worked out from the data' },
              { id: 'custom', name: 'Custom', hint: 'Type where the y axis starts and ends' },
            ]}
            // Custom starts from the range the chart has now.
            onChange={(choice) => onChange(choice === 'auto' ? { yMin: null, yMax: null } : { yMin: axis.min, yMax: axis.max })}
          />
        </div>
      </PropRow>
      {customRange && (
        <PropRow label="">
          <div className={cn('grid min-w-0 flex-1 grid-cols-2', expanded ? 'gap-2' : 'gap-1')}>
            <NumberField label="Y axis from" value={axis.min} onCommit={(yMin) => onChange({ yMin })} />
            <NumberField label="Y axis to" value={axis.max} onCommit={(yMax) => onChange({ yMax })} />
          </div>
        </PropRow>
      )}
    </>
  )
  const xAxisRows = (
    <>
      {!expanded && <AxisHeading text="X axis" second />}
      <PropRow label={expanded ? 'Title' : 'Label'}>
        <LiveField label="X axis title" placeholder="None" {...live('xTitle')} />
      </PropRow>
      <PropRow label="Tick labels">
        <Toggle label="Tick labels" hideLabel checked={chart.tickLabels} onCheckedChange={(tickLabels) => onChange({ tickLabels })} />
      </PropRow>
    </>
  )
  // Phones: Y axis and X axis tabs at the top of the Axes sheet, each showing only its own settings (owner's call, 2026-11-17).
  const axisRows = expanded ? (
    <>
      <PropRow label="Axis" hideLabel>
        <div className="min-w-0 flex-1">
        <Tabs
          label="Axis"
          value={axisTab}
          onValueChange={(next) => setAxisTab(next === 'x' ? 'x' : 'y')}
          tabs={[
            { value: 'y', label: 'Y axis' },
            { value: 'x', label: 'X axis' },
          ]}
          className="w-full [&_[role=tablist]]:h-11 [&_[role=tablist]]:px-0"
        />
        </div>
        {/* Puts the axes' settings back as on a new chart; the titles typed stay (owner's call, 2026-11-17). */}
        <IconButton
          icon={RotateCcw}
          label="Reset the axes"
          onClick={() => {
            setCustomUnit(false)
            onChange({ yUnit: '', yMin: null, yMax: null, yTitleAlign: 'center', tickLabels: true })
          }}
        />
      </PropRow>
      {axisTab === 'y' ? yAxisRows : xAxisRows}
    </>
  ) : (
    <>
      {yAxisRows}
      {xAxisRows}
    </>
  )
  const legendRow = (
    <PropRow label="Legend">
      <Toggle label="Legend" hideLabel checked={chart.legend} onCheckedChange={(legend) => onChange({ legend })} />
    </PropRow>
  )
  const coloursRow = (
    <PropRow label="Colours" wide={!expanded} hideLabel={!expanded}>
      {expanded ? (
        <GroupColours chart={chart} onColour={setColour} onReset={() => onChange({ colours: [...COLOUR_BLIND_SAFE] })} />
      ) : (
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {/* Each group's colour opens the same swatch dropdown as everywhere else, so the colour-blind friendly palette is offered here too. */}
          {chart.groups.map((group, i) => {
            const name = group.name || `group ${i + 1}`
            return (
              <ColourMenu
                key={i}
                label={`Colour of ${name}`}
                value={groupColour(chart, i).toLowerCase()}
                used={usedColours}
                onChange={(colour) => colour && setColour(i, colour)}
                trigger={
                  <button
                    type="button"
                    aria-label={`Colour of ${name}`}
                    title={group.name}
                    style={{ background: groupColour(chart, i) }}
                    className="size-6 cursor-pointer rounded-sm ring-1 ring-border-strong ring-inset focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
                  />
                }
              />
            )
          })}
          <button type="button" onClick={() => onChange({ colours: [...COLOUR_BLIND_SAFE] })} className="h-6 rounded-md px-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground">
            Reset
          </button>
        </div>
      )}
    </PropRow>
  )
  const templatesRow = (
    <PropRow label="Templates" wide hideLabel={!expanded}>
      <ColourTemplates chart={chart} onPick={(colours) => onChange({ colours })} />
    </PropRow>
  )
  const dataRow = (
    <PropRow label="Data" top={expanded && data !== undefined}>
      {expanded && data !== undefined ? (
        data
      ) : (
        <button type="button" onClick={onShowData} className="h-(--control-height) rounded-md border border-border-strong px-2.5 text-xs hover:bg-muted">
          Edit data
        </button>
      )}
    </PropRow>
  )
  const sizeRow = (
    <PropRow label="Text size">
      {expanded ? (
        <Slider look="bar" label="Chart text size" hideLabel value={chart.fontSize} min={5} max={24} step={0.5} unit="pt" onValueChange={(fontSize) => onChange({ fontSize }, true, 'fontSize')} className="min-w-0 flex-1" />
      ) : (
        <SizeField label="Chart text size" suffix="pt" min={5} max={24} value={chart.fontSize} onCommit={(fontSize) => onChange({ fontSize })} className="ml-auto w-24" />
      )}
    </PropRow>
  )
  // Desktop sections show their whole list at once, as the phone does: the font list sits under the size, not behind a dropdown.
  const fontRows = expanded ? (
    <>
      <PropRow label="Font">
        <div className="min-w-0 flex-1">
          <FontPicker fonts={FONT_OPTIONS} value={chart.fontFamily} onValueChange={(fontFamily) => onChange({ fontFamily })} />
        </div>
      </PropRow>
      {sizeRow}
    </>
  ) : (
    <>
      {sizeRow}
      <div aria-hidden="true" className="col-span-2 h-2" />
      <PropRow label="Font" wide hideLabel>
        <ExpandedControls.Provider value>
          <FontPicker fonts={FONT_OPTIONS} value={chart.fontFamily} onValueChange={(fontFamily) => onChange({ fontFamily })} />
        </ExpandedControls.Provider>
      </PropRow>
    </>
  )
  const captionRow = (
    <PropRow label="Under chart" top>
      <div className={cn('flex min-w-0 flex-1 gap-1', expanded ? 'items-start gap-2' : 'flex-col')}>
        <LiveTextArea label="Text under the chart" placeholder="e.g. Primers: GAPDH fw/rv" {...live('caption')} />
        <AlignButtons compact={expanded} what="Align the text under the chart" value={chart.captionAlign} onChange={(captionAlign) => onChange({ captionAlign })} />
      </div>
    </PropRow>
  )
  const statsRows = (
    <>
      <PropRow label="Test" wide={!expanded} hideLabel={!expanded}>
        {/* Desktop: every test listed at once, not behind a dropdown. */}
        <ExpandedControls.Provider value>
          <Select label="Significance test" hideLabel searchable className="min-w-0 flex-1" options={STAT_TESTS.map((t) => { const Icon = TEST_ICONS[t.id]; return { value: t.id, label: t.name, detail: t.hint, icon: Icon && <Icon aria-hidden="true" /> } })} value={chart.test} onValueChange={(test) => onChange({ test })} />
        </ExpandedControls.Provider>
      </PropRow>
      {chart.test !== 'none' && (
        <>
          {PAIRED_TESTS.has(chart.test) && <PropNote>Row 1 of every group is the same sample, row 2 the next, and so on.</PropNote>}
          {chart.test === 'ttest' && (
            <PropRow label="Welch’s">
              <Toggle label="Welch’s version (groups spread differently)" hideLabel checked={chart.welch} onCheckedChange={(welch) => onChange({ welch })} />
            </PropRow>
          )}
          {VALUE_TESTS.has(chart.test) && (
            <PropRow label="Against">
              <NumberField label="Value each group is tested against" value={chart.testValue} onCommit={(testValue) => onChange({ testValue })} />
            </PropRow>
          )}
          {CORRECTED_TESTS.has(chart.test) && (
            <PropRow label="Correction">
              <ExpandedControls.Provider value>
                <Select label="Correction for several comparisons" hideLabel className="min-w-0 flex-1" options={CORRECTIONS.map((c) => ({ value: c.id, label: c.name }))} value={chart.correction} onValueChange={(correction) => onChange({ correction })} />
              </ExpandedControls.Provider>
            </PropRow>
          )}
          <PropRow label="Coloured">
            <Toggle label="Coloured brackets" hideLabel checked={chart.colouredBrackets} onCheckedChange={(colouredBrackets) => onChange({ colouredBrackets })} />
          </PropRow>
          <PropRow label="Effect size">
            <Toggle label="Effect size in the test line" hideLabel checked={chart.effectSize} onCheckedChange={(effectSize) => onChange({ effectSize })} />
          </PropRow>
          <PropRow label="Show ns">
            <Toggle label="Show ns (not significant)" hideLabel checked={chart.showNs} onCheckedChange={(showNs) => onChange({ showNs })} />
          </PropRow>
          <PropRow label="Test note">
            <Toggle label="Say which test, under the chart" hideLabel checked={chart.testNote} onCheckedChange={(testNote) => onChange({ testNote })} />
          </PropRow>
        </>
      )}
    </>
  )
  const sizeRows = (
    <>
      <SizeRow width={size.width} height={size.height} onResize={onResize} />
      <OpacityRow opacity={opacity} onChange={onOpacity} />
    </>
  )

  // Phones: no tabs. Every setting is listed once, in the order of the property bar's items (Kind, Data, Colours, Axes,
  // Labels, Font, Statistics, then size and opacity under Properties); see mobile-props.
  if (expanded) {
    return (
      <PropRows>
        {kindRows}
        {dataRow}
        {coloursRow}
        {templatesRow}
        {axisRows}
        {nameRows}
        {captionRow}
        {legendRow}
        {fontRows}
        {statsRows}
        {sizeRows}
      </PropRows>
    )
  }

  // Desktop (drill-in list, design A of five drafts, picked 2026-11-19): a list of the same sections as the phone's
  // property bar, each with what it is set to now; a click opens just that section's rows, Back returns to the list.
  const sections: { id: ChartSection; icon: LucideIcon; summary: ReactNode; rows: ReactNode }[] = [
    { id: 'Graph', icon: ChartColumn, summary: usesErrorBars(chart.kind) ? `${graphType(chart.kind)?.name ?? ''}, ${chart.errorBars === 'none' ? 'no error bars' : (errorBarInfo(chart.errorBars)?.name ?? chart.errorBars)}` : (graphType(chart.kind)?.name ?? ''), rows: kindRows },
    { id: 'Title & caption', icon: Captions, summary: [chart.title.trim() || 'No title', chart.legend ? 'legend' : ''].filter(Boolean).join(' · '), rows: <>{nameRows}{captionRow}{legendRow}</> },
    {
      id: 'Colours',
      icon: Palette,
      summary: (
        <span className="flex gap-1">
          {chart.groups.slice(0, 6).map((_, i) => (
            <span key={i} className="size-3.5 rounded-sm ring-1 ring-border-strong ring-inset" style={{ background: groupColour(chart, i) }} />
          ))}
        </span>
      ),
      rows: <>{coloursRow}{templatesRow}</>,
    },
    { id: 'Y/X-Axis', icon: Ruler, summary: [chart.yTitle || 'No y title', chart.yUnit].filter(Boolean).join(' · '), rows: axisRows },
    { id: 'Font', icon: Type, summary: `${FONTS.find((f) => fontStack(f) === chart.fontFamily)?.name ?? chart.fontFamily}, ${chart.fontSize} pt`, rows: fontRows },
    { id: 'Statistics', icon: Asterisk, summary: STAT_TESTS.find((t) => t.id === chart.test)?.name ?? '', rows: statsRows },
    { id: 'Properties', icon: SlidersHorizontal, summary: `${Math.round(opacity * 100)}% opacity`, rows: sizeRows },
  ]
  const current = sections.find((s) => s.id === open)
  // One back arrow: the list's header leaves the chart's settings for the graph tiles; an open section's returns to the list.
  const head = current ? (
    <PropertiesHeader backLabel="Back to all chart settings" picture={<current.icon className="size-5" />} name={current.id} onBack={() => setOpen(null)} />
  ) : (
    header && <PropertiesHeader {...header} />
  )
  if (current) {
    return (
      <div>
        {head}
        <PropRows>{current.rows}</PropRows>
      </div>
    )
  }
  return (
    <>
      {head}
    <ul aria-label="Chart settings" className="divide-y">
      {sections.map(({ id, icon: Icon, summary }) => (
        <li key={id}>
          <button type="button" onClick={() => setOpen(id)} className="flex h-14 w-full items-center gap-3 px-4 text-left hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">
            <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="w-28 shrink-0 text-sm font-medium whitespace-nowrap">{id}</span>
            <span className="flex min-w-0 flex-1 justify-end truncate text-xs text-muted-foreground">{summary}</span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
    </>
  )
}

type ChartSection = 'Graph' | 'Colours' | 'Y/X-Axis' | 'Title & caption' | 'Font' | 'Statistics' | 'Properties'

/**
 * Phones: the groups' colours as a row of chips (colour and name); the picked
 * group's swatches show in full underneath, so only one swatch panel is open.
 * No "In this figure" row here: a chart's groups are picked from the palette.
 */
function GroupColours({ chart, onColour, onReset }: { chart: ChartData; onColour: (group: number, colour: string) => void; onReset: () => void }) {
  const [picked, setPicked] = useState(0)
  // Reset sits at the right of the sheet's "Colours" title (owner's call, 2026-11-17).
  const own = useRef<HTMLDivElement>(null)
  const titleEnd = useSheetTitleEnd(own)
  const reset = <IconButton icon={RotateCcw} label="Reset all colours" onClick={onReset} />
  const at = Math.min(picked, chart.groups.length - 1)
  const name = (i: number) => chart.groups[i]?.name || `Group ${i + 1}`
  return (
    <div ref={own} className="flex w-full min-w-0 flex-col gap-3">
      <div role="radiogroup" aria-label="Group" className="flex flex-wrap gap-1.5">
        {chart.groups.map((_, i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={i === at}
            onClick={() => setPicked(i)}
            className={cn(
              'flex h-11 max-w-full min-w-0 items-center gap-2 rounded-full pr-3.5 pl-1.5 text-sm ring-1 ring-border ring-inset outline-none focus-visible:ring-2 focus-visible:ring-ring',
              i === at && 'bg-primary-subtle text-primary-subtle-foreground ring-2 ring-primary',
            )}
          >
            <span className="size-8 shrink-0 rounded-full ring-1 ring-border-strong ring-inset" style={{ background: groupColour(chart, i) }} />
            <span className="truncate">{name(i)}</span>
          </button>
        ))}
      </div>
      {titleEnd && createPortal(reset, titleEnd)}
      {at >= 0 && (
        <ColourInput
          label={`Colour of ${name(at)}`}
          value={groupColour(chart, at).toLowerCase()}
          onChange={(colour) => colour && onColour(at, colour)}
          end={titleEnd ? undefined : reset}
        />
      )}
    </div>
  )
}

/** A bar with its error bar stopping on top of it, or running down into it, for the phone's Inside bar choice. */
function errorBarPicture(inside: boolean) {
  return function ErrorBarInBar({ className }: { className?: string }) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden="true">
        <rect x="6" y="10" width="12" height="12" rx="1" fill="currentColor" fillOpacity={0.3} stroke="none" />
        <path d={inside ? 'M12 3v13M9.5 3h5M9.5 16h5' : 'M12 3v7M9.5 3h5'} />
      </svg>
    )
  }
}
const ERROR_BAR_OUTSIDE = errorBarPicture(false)
const ERROR_BAR_INSIDE = errorBarPicture(true)

/** The y axis units by kind of measurement, for the phone's unit picker. Together they are `Y_UNITS`. */
const UNIT_KINDS: readonly { name: string; units: readonly string[] }[] = [
  { name: 'Concentration', units: ['mM', 'µM', 'nM', 'pM'] },
  { name: 'Mass / volume', units: ['mg/mL', 'µg/mL', 'ng/mL', 'pg/mL'] },
  { name: 'Counts', units: ['cells/mL', 'CFU/mL'] },
  { name: 'Signal', units: ['AU', 'RFU', 'RLU', 'OD₆₀₀'] },
  { name: 'Size', units: ['kDa', 'bp'] },
  { name: 'Time', units: ['s', 'min', 'h', 'days'] },
  { name: 'Other', units: ['%', '°C', 'mmHg', 'mg/kg'] },
]
/** What a unit means, so searching "fluorescence" or "hours" finds it. */
const UNIT_MEANING: Record<string, string> = {
  mM: 'millimolar', µM: 'micromolar', nM: 'nanomolar', pM: 'picomolar', AU: 'arbitrary units', RFU: 'relative fluorescence units', RLU: 'relative light units',
  'OD₆₀₀': 'optical density 600 nm', kDa: 'kilodalton', bp: 'base pairs', 'CFU/mL': 'colony-forming units', 'cells/mL': 'cell density', s: 'seconds',
  min: 'minutes', h: 'hours', '%': 'percent', '°C': 'degrees celsius', mmHg: 'pressure', 'mg/kg': 'dose per body weight',
}
/** Loose matching: "u" (or a Greek μ) finds µ, "600" finds ₆₀₀, case and spaces don't matter. */
const looseUnit = (text: string) => text.toLowerCase().replace(/[µμ]/g, 'u').replace(/₆₀₀/g, '600').replace(/°/g, '').replace(/\s+/g, '')
const NO_KIND = 'None'
const OWN_KIND = 'Own'

/**
 * Phones: the y axis unit (design C of five drafts, picked 2026-11-17). Small
 * tabs by kind of measurement, with that kind's units on one row under them;
 * the magnifier at the start of the row searches every unit (by name or
 * meaning) and offers "Use …" for one that isn't listed. A unit typed that
 * way gets its own tab.
 */
function UnitPicker({ value, onChange }: { value: string; onChange: (unit: string) => void }) {
  const listed = UNIT_KINDS.find((kind) => kind.units.includes(value))
  const own = value !== '' && !listed
  const [kind, setKind] = useState(value === '' ? NO_KIND : own ? OWN_KIND : (listed?.name ?? NO_KIND))
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  const all = UNIT_KINDS.flatMap((each) => each.units)
  const q = looseUnit(query.trim())
  const found = all.filter((unit) => !q || looseUnit(unit).includes(q) || looseUnit(UNIT_MEANING[unit] ?? '').includes(q))
  const exact = all.some((unit) => looseUnit(unit) === q)
  const closeSearch = () => {
    setSearching(false)
    setQuery('')
  }
  const pick = (unit: string) => {
    onChange(unit)
    setSearching(false)
    setQuery('')
    const into = UNIT_KINDS.find((each) => each.units.includes(unit))
    setKind(unit === '' ? NO_KIND : (into?.name ?? OWN_KIND))
  }
  const chip = (unit: string, label = unit || 'None', dashed = false) => (
    <button
      key={label}
      type="button"
      role="radio"
      aria-checked={unit === value && !dashed}
      onClick={() => pick(unit)}
      className={cn(
        'h-9 shrink-0 rounded-full px-3.5 text-sm whitespace-nowrap ring-1 ring-border ring-inset outline-none focus-visible:ring-2 focus-visible:ring-ring',
        unit === value && !dashed && 'bg-primary-subtle text-primary-subtle-foreground ring-2 ring-primary',
        dashed && 'border border-dashed border-primary text-primary-subtle-foreground ring-0',
      )}
    >
      {label}
    </button>
  )
  const row = 'flex gap-1.5 overflow-x-auto overscroll-x-contain py-0.5 [scrollbar-width:none]'

  if (searching) {
    return (
      <div className="flex w-full min-w-0 flex-col gap-2">
        <TextField
          label="Search units"
          hideLabel
          autoFocus
          value={query}
          placeholder="Search units"
          prefix={<Search aria-hidden="true" />}
          suffix={<IconButton icon={X} label="Close search" size="sm" onClick={closeSearch} />}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && query.trim()) pick(found.length === 1 && found[0] ? found[0] : query.trim())
            if (event.key === 'Escape') closeSearch()
          }}
        />
        <div role="radiogroup" aria-label="Y axis unit" className={row}>
          {found.map((unit) => chip(unit))}
          {q && !exact && chip(query.trim(), `Use "${query.trim()}"`, true)}
          {!found.length && !q && <span className="py-2 text-sm text-muted-foreground">No units match.</span>}
        </div>
      </div>
    )
  }
  const kinds = [NO_KIND, ...UNIT_KINDS.map((each) => each.name), ...(own ? [OWN_KIND] : [])]
  const units = kind === NO_KIND ? [''] : kind === OWN_KIND ? [value] : (UNIT_KINDS.find((each) => each.name === kind)?.units ?? [])
  return (
    <div className="flex w-full min-w-0 flex-col gap-2">
      <div role="tablist" aria-label="Kind of unit" className="flex gap-4 overflow-x-auto border-b [scrollbar-width:none]">
        {kinds.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={name === kind}
            onClick={() => setKind(name)}
            className={cn(
              'relative h-9 shrink-0 text-sm whitespace-nowrap text-muted-foreground outline-none focus-visible:text-foreground',
              name === kind && 'font-medium text-foreground after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary',
            )}
          >
            {name}
          </button>
        ))}
      </div>
      <div role="radiogroup" aria-label="Y axis unit" className={row}>
        <button
          type="button"
          aria-label="Search units"
          onClick={() => setSearching(true)}
          className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground ring-1 ring-border ring-inset outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Search className="size-4" aria-hidden="true" />
        </button>
        {units.map((unit) => chip(unit))}
      </div>
    </div>
  )
}

/** Desktop: names the axis the rows under it belong to; the second one is split from the first by a line. */
function AxisHeading({ text, second = false }: { text: string; second?: boolean }) {
  return <h4 className={cn('col-span-2 text-sm font-semibold', second && 'mt-3 border-t pt-4')}>{text}</h4>
}

/** Phones: a small caption over a control that has no row label of its own. */
export function PhoneCaption({ text, children }: { text: string; children: ReactNode }) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-1">
      <span className="text-xs text-muted-foreground">{text}</span>
      {children}
    </div>
  )
}

/** Colour templates for the groups. Categorical ones give each group the next colour; gradients are sampled evenly across their stops. */
type Template = { name: string; colours: readonly string[]; gradient?: boolean }
const TEMPLATE_GROUPS: { title: string; templates: Template[] }[] = [
  {
    title: 'Distinct colours',
    templates: [
      { name: 'Colour-blind safe', colours: COLOUR_BLIND_SAFE },
      { name: 'Muted', colours: ['#332288', '#88ccee', '#44aa99', '#999933', '#ddcc77', '#cc6677', '#882255', '#aa4499'] },
      { name: 'High contrast', colours: ['#004488', '#ddaa33', '#bb5566', '#000000'] },
      { name: 'Pastel', colours: ['#80b8d8', '#f2cf80', '#80ceb9', '#e6bcd3', '#abdaf4', '#eaae80', '#9990c3', '#f8f2a0'] },
    ],
  },
  {
    title: 'Gradients',
    templates: [
      { name: 'Viridis', gradient: true, colours: ['#440154', '#443983', '#31688e', '#21918c', '#35b779', '#90d743', '#fde725'] },
      { name: 'Plasma', gradient: true, colours: ['#0d0887', '#6a00a8', '#b12a90', '#e16462', '#fca636', '#f0f921'] },
      { name: 'Magma', gradient: true, colours: ['#000004', '#3b0f70', '#8c2981', '#de4968', '#fe9f6d'] },
      { name: 'Cividis', gradient: true, colours: ['#00204d', '#31446b', '#666970', '#958f78', '#cbba69', '#ffea46'] },
      { name: 'Blues', gradient: true, colours: ['#08306b', '#2171b5', '#6baed6', '#c6dbef'] },
      { name: 'Oranges', gradient: true, colours: ['#7f2704', '#d94801', '#fd8d3c', '#fdd0a2'] },
      { name: 'Greyscale', gradient: true, colours: ['#18181b', '#52525b', '#a1a1aa', '#d4d4d8'] },
    ],
  },
]

const hexToRgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
/** `count` colours spread evenly along the stops. */
function sampleGradient(stops: readonly string[], count: number): string[] {
  if (count <= 1) return [stops[0] ?? '#000000']
  return Array.from({ length: count }, (_, i) => {
    const at = (i / (count - 1)) * (stops.length - 1)
    const lo = Math.floor(at)
    const a = hexToRgb(stops[lo] ?? '#000000')
    const b = hexToRgb(stops[Math.min(lo + 1, stops.length - 1)] ?? '#000000')
    const t = at - lo
    return '#' + a.map((v, k) => Math.round(v + ((b[k] ?? v) - v) * t).toString(16).padStart(2, '0')).join('')
  })
}
const templateColours = (template: Template, groups: number) =>
  template.gradient ? sampleGradient(template.colours, Math.max(groups, 2)) : Array.from({ length: Math.max(groups, 1) }, (_, i) => template.colours[i % template.colours.length] ?? '#000000')

/** The templates as rows (name, and the colours the groups would get); picking one recolours every group. */
function ColourTemplates({ chart, onPick }: { chart: ChartData; onPick: (colours: string[]) => void }) {
  const groups = chart.groups.length
  const current = chart.groups.map((_, i) => groupColour(chart, i).toLowerCase())
  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      {TEMPLATE_GROUPS.map((group) => (
        <div key={group.title} className="flex flex-col gap-1 not-first:border-t not-first:pt-3">
          {group.templates.map((template) => {
            const colours = templateColours(template, groups)
            const picked = colours.length === current.length && colours.every((c, i) => c.toLowerCase() === current[i])
            return (
              <button
                key={template.name}
                type="button"
                aria-pressed={picked}
                onClick={() => onPick(colours)}
                className={cn(
                  'flex h-11 items-center justify-between gap-3 rounded-md px-3 text-left text-sm ring-1 ring-border ring-inset outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring',
                  picked && 'bg-primary-subtle text-primary-subtle-foreground ring-2 ring-primary hover:bg-primary-subtle',
                )}
              >
                <span className="truncate">{template.name}</span>
                <span className="flex shrink-0 overflow-hidden rounded-sm ring-1 ring-border-strong ring-inset">
                  {(template.gradient ? sampleGradient(template.colours, 8) : template.colours.slice(0, 8)).map((c, i) => (
                    <span key={i} className="h-5 w-4" style={{ background: c }} />
                  ))}
                </span>
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
