/*
 * The properties of a selected table, in the Table panel (the Shapes panel's
 * label-left rows, 2026-11-14), in two tabs. Table: layout and look, lines,
 * header, cell fill, line colour and width, column and row sizes, size and
 * opacity. Text: font, size, alignment and bold. Phones get one list without
 * tabs (the bar groups it), with pictures instead of dropdowns. Fill, alignment and bold go
 * onto the picked cells (click a cell of the selected table to pick it,
 * Shift+click to pick more), or onto all cells.
 */
import { ColourInput } from '@biofigure-lab/ui/components/colour-input/ColourInput'
import { IconButton } from '@biofigure-lab/ui/components/icon-button/IconButton'
import { Select } from '@biofigure-lab/ui/components/select/Select'
import { FontPicker, type FontOption } from '@biofigure-lab/ui/components/text-controls/FontPicker'
import { TextField } from '@biofigure-lab/ui/components/text-field/TextField'
import { LayoutPicture, LookPicture, TABLE_LAYOUTS, TABLE_LOOKS } from '@biofigure-lab/ui/components/table-panel/TablePanel'
import { Slider } from '@biofigure-lab/ui/components/slider/Slider'
import { Tabs, TabsPanel } from '@biofigure-lab/ui/components/tabs/Tabs'
import { Tooltip } from '@biofigure-lab/ui/components/tooltip/Tooltip'
import { useExpandedControls } from '@biofigure-lab/ui/lib/expanded-controls'
import { cn } from '@biofigure-lab/ui/lib/cn'
import { AlignCenter, AlignLeft, AlignRight, ArrowLeftRight, ArrowUpDown, Bold, Columns3, Rows3 } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

import { toHex } from '../editor/colour'
import type { SelectionInfo, StyleChange, TableInfo } from '../editor/FigureCanvas'
import type { Borders, HeaderStyle, TableCommand, TableStyle } from '../editor/table-model'
import { FONTS, fontStack } from '../editor/fonts'
import { formatMm, mmToPx } from '../editor/units'
import { PhoneCaption, Segmented } from './ChartProperties'
import { NumberField } from './fields'
import { OpacityRow, OptionPicker, PropNote, PropRow, PropRows, SizeRow, type SizeChange } from './properties-pane'

/** `short`: the name under its picture on phones. */
const BORDERS: { value: Borders; label: string; short: string }[] = [
  { value: 'all', label: 'All lines', short: 'All' },
  { value: 'outer', label: 'Outside only', short: 'Outside' },
  { value: 'horizontal', label: 'Horizontal only', short: 'Rows' },
  { value: 'rules', label: 'Top, header and bottom', short: 'Minimal' },
  { value: 'none', label: 'None', short: 'None' },
]

const HEADERS: { value: HeaderStyle; label: string; short: string }[] = [
  { value: 'filled', label: 'Bold, filled', short: 'Filled' },
  { value: 'bold', label: 'Bold', short: 'Bold' },
  { value: 'plain', label: 'Plain', short: 'Plain' },
]

/** The same fonts as text boxes, each name shown in its own font. */
const FONT_OPTIONS: FontOption[] = FONTS.map((font) => ({ name: font.name, category: font.category, family: fontStack(font) }))

const FONT_SIZES = ['8', '9', '10', '11', '12', '14', '16', '18', '20', '24'] as const

const ALIGNS = [
  { align: 'left', icon: AlignLeft, label: 'Align text left' },
  { align: 'center', icon: AlignCenter, label: 'Centre text' },
  { align: 'right', icon: AlignRight, label: 'Align text right' },
] as const

/** The layout and look pictures as picker options, all in the row (so no ⋯ button). */
const LAYOUT_OPTIONS = TABLE_LAYOUTS.map((layout) => ({ id: layout.id, name: layout.name, picture: <LayoutPicture layout={layout.id} /> }))
const LOOK_OPTIONS = TABLE_LOOKS.map((look) => ({ id: look.id, name: look.name, picture: <LookPicture look={look.id} /> }))

type Props = {
  table: TableInfo
  /** The selected table as an object: its colours, size and opacity. */
  selection: SelectionInfo
  onChange: (patch: Partial<TableStyle>) => void
  onCommand: (command: TableCommand) => void
  /** Cell fill, line colour and width, opacity. */
  onPaint: (patch: StyleChange) => void
  onResize: (change: SizeChange, keepProportions: boolean) => void
  /** The colours already in the figure, for the swatch dropdowns. */
  usedColours?: () => readonly string[]
}

export function TableProperties({ table, selection, onChange, onCommand, onPaint, onResize, usedColours }: Props) {
  const [tab, setTab] = useState('table')
  const expanded = useExpandedControls()
  const sizes = FONT_SIZES.includes(String(table.fontSize) as (typeof FONT_SIZES)[number]) ? FONT_SIZES : [...FONT_SIZES, String(table.fontSize)]
  const note = table.picked
    ? 'Fill, alignment and bold apply to the picked cells. Enter or typing edits them; Escape lets go, so the table can be moved again.'
    : 'Click a cell to pick it, then drag to pick more. The tabs along the top and left edges pick a whole column or row, and drag to move it. Double-click or press Enter to type.'
  // Phones: alignment and bold, first under the bar's Properties item.
  const textStyleRow = (
    <>
      <PropRow label="Text style">
        <div className="flex w-full min-w-0 gap-2">
          <div className="min-w-0 flex-1">
            <Segmented label={table.picked ? 'Alignment of the picked cells' : 'Alignment'} value={table.align} options={ALIGNS.map(({ align, icon, label }) => ({ id: align, name: label, icon }))} onChange={(align) => onChange({ align })} />
          </div>
          <div className="w-14 shrink-0">
            <Segmented label="Bold" value={table.bold ? 'bold' : 'plain'} options={[{ id: 'bold', name: 'Bold', icon: Bold }]} onChange={() => onChange({ bold: !table.bold })} />
          </div>
        </div>
      </PropRow>
    </>
  )
  const tableRows = (
    <>
      {/* The look first: picking one also sets the header style and lines (owner's call, 2026-11-17). */}
      <PropRow label="Look">
        <OptionPicker title="Looks" options={LOOK_OPTIONS} rowIds={LOOK_OPTIONS.map((each) => each.id)} more={false} value={table.look} onPick={(look) => onChange({ look })} />
      </PropRow>
      <PropRow label="Layout">
        <OptionPicker title="Layouts" options={LAYOUT_OPTIONS} rowIds={LAYOUT_OPTIONS.map((each) => each.id)} more={false} value={table.layout} onPick={(layout) => onChange({ layout })} />
      </PropRow>
      {/* How the header looks, right under the layout that gives the table one; a plain grid has none. */}
      {table.layout !== 'grid' && (
        <PropRow label="Header">
          {expanded ? (
            <PictureChoices label="Header style" options={HEADERS.map((each) => ({ ...each, picture: <HeaderPicture header={each.value} /> }))} value={table.header} onChange={(header) => onChange({ header })} />
          ) : (
            <Select label="Header style" hideLabel className="min-w-0 flex-1" options={HEADERS} value={table.header} onValueChange={(header) => onChange({ header })} />
          )}
        </PropRow>
      )}
      {/* Soft (no lines) and Journal (top, header and bottom lines) set the lines themselves; only Classic offers a choice (owner's call, 2026-11-17). */}
      {table.look === 'classic' && (
        <PropRow label="Lines">
          {expanded ? (
            <PictureChoices label="Table lines" options={BORDERS.map((each) => ({ ...each, picture: <BordersPicture borders={each.value} /> }))} value={table.borders} onChange={(borders) => onChange({ borders })} />
          ) : (
            <Select label="Table lines" hideLabel className="min-w-0 flex-1" options={BORDERS} value={table.borders} onValueChange={(borders) => onChange({ borders })} />
          )}
        </PropRow>
      )}
      <PropRow label={table.picked ? 'Picked fill' : 'Cell fill'}>
        <ColourInput label="Cell fill" noneLabel="No fill" value={toHex(selection.fill)} onChange={(fill) => onPaint({ fill: fill ?? '' })} used={usedColours} className="min-w-0 flex-1" />
      </PropRow>
      <PropRow label="Line colour">
        <NoLines
          off={table.borders === 'none'}
          why={table.look === 'soft' ? 'The Soft look has no lines. Pick Classic or Journal in Style to add them.' : 'This table has no lines. Pick lines in Style to add them.'}
        >
        {expanded ? (
          // Phones: the line width as a slider under a caption of its own, then the swatches.
          <div className="flex w-full min-w-0 flex-col gap-3">
            <PhoneCaption text="Line width">
              <Slider look="bar" label="Line width" hideLabel value={Math.min(selection.strokeWidth ?? 0, 6)} min={0} max={6} step={0.25} unit="px" onValueChange={(strokeWidth) => onPaint({ strokeWidth })} className="min-w-0 flex-1" />
            </PhoneCaption>
            <ColourInput label="Line colour" value={toHex(selection.stroke)} onChange={(stroke) => stroke && onPaint({ stroke })} className="min-w-0 flex-1" />
          </div>
        ) : (
          <>
            <ColourInput label="Line colour" value={toHex(selection.stroke)} onChange={(stroke) => stroke && onPaint({ stroke })} used={usedColours} className="min-w-0 flex-1" />
            <NumberField label="Line width" value={selection.strokeWidth ?? 0} suffix="px" min={0} max={50} onCommit={(strokeWidth) => onPaint({ strokeWidth })} className="w-[3.75rem] shrink-0" />
          </>
        )}
        </NoLines>
      </PropRow>
      {expanded && textStyleRow}
      {/* Phones: opacity above the column and row sizes (owner's call, 2026-11-17). */}
      {expanded && <OpacityRow opacity={selection.opacity} onChange={(opacity) => onPaint({ opacity })} />}
      {expanded ? (
        // Phones: column width and row height side by side, each with a caption and a button that evens them out.
        <PropRow label={table.picked ? 'Picked cells (mm)' : 'Cells (mm)'} hideLabel>
          {/* pt-2: the space a row label would leave above it. */}
          <div className="grid w-full grid-cols-2 gap-3 pt-2">
            {(
              [
                { caption: table.picked ? 'Picked column width (mm)' : 'Column width (mm)', icon: ArrowLeftRight, label: table.picked ? 'Width of the picked columns' : 'Width of every column', px: table.colWidth, key: 'colWidth', even: 'even-cols', evenLabel: table.picked ? 'Make the picked columns even' : 'Make all columns even' },
                { caption: table.picked ? 'Picked row height (mm)' : 'Row height (mm)', icon: ArrowUpDown, label: table.picked ? 'Height of the picked rows' : 'Height of every row', px: table.rowHeight, key: 'rowHeight', even: 'even-rows', evenLabel: table.picked ? 'Make the picked rows even' : 'Make all rows even' },
              ] as const
            ).map((each) => (
              <div key={each.key} className="flex min-w-0 flex-col gap-1">
                <span className="text-xs text-muted-foreground">{each.caption}</span>
                <div className="flex gap-1">
                  <CellSizeField label={each.label} prefix={<each.icon className="size-4" aria-hidden="true" />} hideUnit px={each.px} onCommit={(px) => onChange({ [each.key]: px })} />
                  <button
                    type="button"
                    aria-label={each.evenLabel}
                    onClick={() => onCommand(each.even)}
                    className="h-11 shrink-0 rounded-md px-2.5 text-sm ring-1 ring-border-strong ring-inset outline-none focus-visible:ring-2 focus-visible:ring-ring active:bg-accent"
                  >
                    Even
                  </button>
                </div>
              </div>
            ))}
          </div>
        </PropRow>
      ) : (
        <>
      <PropRow label={table.picked ? 'Picked cols' : 'Columns'}>
        <CellSizeField label={table.picked ? 'Width of the picked columns' : 'Width of every column'} prefix="W" px={table.colWidth} onCommit={(colWidth) => onChange({ colWidth })} />
        <IconButton icon={Columns3} label={table.picked ? 'Make the picked columns even' : 'Make all columns even'} onClick={() => onCommand('even-cols')} />
      </PropRow>
      <PropRow label={table.picked ? 'Picked rows' : 'Rows'}>
        <CellSizeField label={table.picked ? 'Height of the picked rows' : 'Height of every row'} prefix="H" px={table.rowHeight} onCommit={(rowHeight) => onChange({ rowHeight })} />
        <IconButton icon={Rows3} label={table.picked ? 'Make the picked rows even' : 'Make all rows even'} onClick={() => onCommand('even-rows')} />
      </PropRow>
        </>
      )}
      {/* Phones: the table's size comes from its columns and rows, and its handles on the page (owner's call, 2026-11-17). */}
      {!expanded && <SizeRow width={selection.width} height={selection.height} onResize={onResize} />}
      {!expanded && <OpacityRow opacity={selection.opacity} onChange={(opacity) => onPaint({ opacity })} />}
      {/* The note talks of clicks and drags with a mouse, and makes the phone's sheet much taller. */}
      {!expanded && <PropNote>{note}</PropNote>}
    </>
  )
  // Phones: the text size above the font list, under the bar's Text item.
  const phoneTextRows = (
    <>
      <PropRow label="Text size">
        <Slider look="bar" label="Table text size" hideLabel value={table.fontSize} min={5} max={24} step={0.5} unit="pt" onValueChange={(fontSize) => onChange({ fontSize })} className="min-w-0 flex-1" />
      </PropRow>
      <PropRow label="Font">
        <div className="min-w-0 flex-1">
          <FontPicker fonts={FONT_OPTIONS} value={table.fontFamily} onValueChange={(fontFamily) => onChange({ fontFamily })} />
        </div>
      </PropRow>
    </>
  )
  // Phones: one list of rows, no tabs, so every setting reaches the bar (each item opens its own rows).
  if (expanded) {
    return (
      <PropRows>
        {tableRows}
        {phoneTextRows}
      </PropRows>
    )
  }
  return (
    <Tabs
      label="Table properties"
      value={tab}
      onValueChange={setTab}
      tabs={[
        { value: 'table', label: 'Table' },
        { value: 'text', label: 'Text' },
      ]}
    >
      <TabsPanel value="table">
        <PropRows>{tableRows}</PropRows>
      </TabsPanel>
      <TabsPanel value="text">
        <PropRows>
          <PropRow label="Font">
            <div className="min-w-0 flex-1">
              <FontPicker fonts={FONT_OPTIONS} value={table.fontFamily} onValueChange={(fontFamily) => onChange({ fontFamily })} />
            </div>
          </PropRow>
          <PropRow label="Size">
            <Select label="Text size" hideLabel className="min-w-0 flex-1" options={sizes.map((size) => ({ value: size, label: `${size} pt` }))} value={String(table.fontSize)} onValueChange={(size) => onChange({ fontSize: Number(size) })} />
          </PropRow>
          <PropRow label="Style">
            {ALIGNS.map(({ align, icon, label }) => (
              <IconButton key={align} icon={icon} label={label} pressed={table.align === align} onClick={() => onChange({ align })} />
            ))}
            <span className="w-2" />
            <IconButton icon={Bold} label="Bold" pressed={table.bold} onClick={() => onChange({ bold: !table.bold })} />
          </PropRow>
          <PropNote>{table.picked ? 'Alignment and bold apply to the picked cells.' : 'Alignment and bold apply to every cell, or to the cells you pick.'}</PropNote>
        </PropRows>
      </TabsPanel>
    </Tabs>
  )
}

/** A column or row size typed in mm and kept in px; applies on Enter or when leaving the field. */
function CellSizeField({ label, prefix, hideUnit = false, px, onCommit }: { label: string; prefix: ReactNode; hideUnit?: boolean; px: number; onCommit: (px: number) => void }) {
  const shown = formatMm(px)
  return (
    <TextField
      key={shown}
      label={label}
      hideLabel
      prefix={prefix}
      suffix={hideUnit ? undefined : 'mm'}
      inputMode="decimal"
      defaultValue={shown}
      className="min-w-0 flex-1"
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
      }}
      onBlur={(event) => {
        const mm = Number.parseFloat(event.target.value.replace(',', '.'))
        if (Number.isFinite(mm) && mm > 0 && event.target.value !== shown) onCommit(mmToPx(mm))
        else event.target.value = shown
      }}
    />
  )
}

/**
 * The line colour and width while the table has no lines (the Soft look, or
 * Lines set to None): faded and out of reach, and a tap (or hover) anywhere
 * on them says why, instead of hiding them (owner's call, 2026-11-17).
 */
function NoLines({ off, why, children }: { off: boolean; why: string; children: ReactNode }) {
  const [told, setTold] = useState(false)
  // A tapped tooltip goes again by itself after a while.
  useEffect(() => {
    if (!told) return
    const timer = window.setTimeout(() => setTold(false), 3000)
    return () => window.clearTimeout(timer)
  }, [told])
  if (!off) return <div className="flex w-full min-w-0 flex-1 items-center gap-1">{children}</div>
  return (
    <div className="relative flex w-full min-w-0 flex-1 items-center gap-1">
      <div inert className="flex w-full min-w-0 flex-1 items-center gap-1 opacity-40">
        {children}
      </div>
      <Tooltip label={why} side="top" multiline open={told} onOpenChange={setTold}>
        <button type="button" aria-label={`Line colour and width are off. ${why}`} onClick={() => setTold(true)} className="absolute inset-0 cursor-not-allowed rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      </Tooltip>
    </div>
  )
}

/**
 * Phones: a few choices as small pictures with their names under them, side
 * by side across the sheet, the picked one blue (like the layout tiles).
 */
function PictureChoices<T extends string>({ label, options, value, onChange }: { label: string; options: { value: T; label: string; short: string; picture: ReactNode }[]; value: T; onChange: (value: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid w-full auto-cols-fr grid-flow-col gap-1.5">
      {options.map((option) => {
        const on = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={option.label}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex min-w-0 flex-col items-center gap-1 rounded-md border px-1 pt-2 pb-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring',
              on ? 'border-primary/25 bg-primary-subtle text-primary-subtle-foreground' : 'border-border-strong bg-panel text-foreground',
            )}
          >
            <span className="size-7 [&>svg]:size-full">{option.picture}</span>
            <span className={cn('w-full truncate text-center text-[11px] leading-tight', !on && 'text-muted-foreground')}>{option.short}</span>
          </button>
        )
      })}
    </div>
  )
}

/** A small 3 × 3 table: the lines a choice draws are solid, the others faint, so the pictures can be told apart. */
function BordersPicture({ borders }: { borders: Borders }) {
  const [l, t, r, b] = [3, 5, 25, 23]
  const rows = [11, 17]
  const cols = [10.33, 17.67]
  const shown = {
    outer: borders === 'all' || borders === 'outer',
    sides: borders === 'all' || borders === 'outer',
    topBottom: borders !== 'none',
    rowLines: borders === 'all' || borders === 'horizontal',
    headerLine: borders === 'all' || borders === 'horizontal' || borders === 'rules',
    colLines: borders === 'all',
  }
  const line = (on: boolean) => ({ stroke: 'currentColor', strokeWidth: on ? 1.5 : 1, strokeOpacity: on ? 1 : 0.2 })
  return (
    <svg viewBox="0 0 28 28" fill="none" strokeLinecap="round" aria-hidden="true">
      <path d={`M${l} ${t}H${r}M${l} ${b}H${r}`} {...line(shown.topBottom)} />
      <path d={`M${l} ${t}V${b}M${r} ${t}V${b}`} {...line(shown.sides)} />
      <path d={`M${l} ${rows[0]}H${r}`} {...line(shown.headerLine)} />
      <path d={`M${l} ${rows[1]}H${r}`} {...line(shown.rowLines)} />
      <path d={cols.map((x) => `M${x} ${t}V${b}`).join('')} {...line(shown.colLines)} />
    </svg>
  )
}

/**
 * A small table whose top row is the header, with "Aa" in it: on a solid
 * shade and bold (filled), bold on no shade (bold), or thin (plain). The
 * body's rows are faint lines.
 */
function HeaderPicture({ header }: { header: HeaderStyle }) {
  return (
    <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeLinecap="round" aria-hidden="true">
      {header === 'filled' && <rect x="2" y="3" width="24" height="10" rx="1" fill="currentColor" fillOpacity={0.35} stroke="none" />}
      <rect x="2" y="3" width="24" height="22" rx="1" strokeOpacity={0.35} strokeWidth={1} />
      <path d="M2 13h24" strokeOpacity={0.6} strokeWidth={1} />
      <text x="14" y="11" textAnchor="middle" fontSize="8.5" fontWeight={header === 'plain' ? 400 : 800} fill="currentColor" stroke="none">
        Aa
      </text>
      <path d="M6 17.5h5M17 17.5h5M6 21.5h5M17 21.5h5" strokeWidth={1} strokeOpacity={0.45} />
    </svg>
  )
}
