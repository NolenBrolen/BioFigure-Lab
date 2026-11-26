/*
 * The small widgets that open from buttons in the quick-actions bar
 * (BIO-82, the owner's picks of 2026-11-25): Frame for an icon, Style for a
 * shape, Ends and Style for an arrow, Row and Column for picked table cells. Each one
 * runs the same editor commands as the side panel, so every pick is one undo
 * step there too. A pick closes the widget and, where the panel has a tab for
 * it, opens that tab for the finer settings (owner's call, 2026-11-25). Which button opens which widget is in canvas-actions.ts.
 */
import { ArrowEndTiles } from '@biofigure-lab/ui/components/arrows-panel/ArrowsPanel'
import { ARROW_PRESETS, OPEN_SHAPES, type ArrowLook } from '@biofigure-lab/ui/lib/arrow-geometry'
import { cn } from '@biofigure-lab/ui/lib/cn'
import { ColumnLeft, ColumnRight, DeleteColumn, DeleteRow, RowAbove, RowBelow } from '@biofigure-lab/ui/lib/quick-action-icons'
import type { LucideIcon } from 'lucide-react'

import type { WidgetKind } from '../editor/canvas-actions'
import { toHex } from '../editor/colour'
import type { FigureCanvas, SelectionInfo } from '../editor/FigureCanvas'
import type { TableCommand } from '../editor/table-model'
import { ArrowStyleGrid } from './ArrowProperties'
import { FrameStyleTiles } from './FrameProperties'
import { openPanelTab, type PanelTab } from './panel-tab'
import { PRESET_GROUPS, PresetSwatch, type Preset } from './ShapeProperties'

type Props = { kind: WidgetKind; figure: FigureCanvas; selection: SelectionInfo; close: () => void }

/** The widget for one bar button. */
export function QuickWidget({ kind, figure, selection, close }: Props) {
  const picked = (tab: PanelTab) => {
    close()
    openPanelTab(tab)
  }
  switch (kind) {
    case 'frame':
      return <FrameStyleTiles figure={figure} icon={selection} className="w-64" onPicked={() => picked('icon-frame')} />
    case 'style':
      return <StyleGrid figure={figure} shape={selection} onPicked={() => picked('shape-style')} />
    case 'frame-style':
      return <FrameStyleGrid figure={figure} icon={selection} onPicked={() => picked('icon-frame')} />
    case 'arrow-style':
      return <ArrowStyleGrid figure={figure} arrow={selection} />
    case 'ends':
      return <EndsPicker figure={figure} look={selection.arrowLook} onPicked={close} />
    case 'row':
      return (
        <ActionList
          close={close}
          run={(command) => figure.tableCommand(command)}
          items={[
            { label: 'Add row above', icon: RowAbove, command: 'row-above' },
            { label: 'Add row below', icon: RowBelow, command: 'row-below' },
            { label: 'Delete row', icon: DeleteRow, command: 'delete-rows', danger: true },
          ]}
        />
      )
    case 'column':
      return (
        <ActionList
          close={close}
          run={(command) => figure.tableCommand(command)}
          items={[
            { label: 'Add column left', icon: ColumnLeft, command: 'col-left' },
            { label: 'Add column right', icon: ColumnRight, command: 'col-right' },
            { label: 'Delete column', icon: DeleteColumn, command: 'delete-cols', danger: true },
          ]}
        />
      )
  }
}

/**
 * Every shape preset in one grid (draft 3B): a row per look (Light, Bold,
 * Dark, Outline, then Neutral) with the look's name on the left, the same
 * colours in every column. A pick sets the fill, outline and text colour, as
 * the Shapes panel's presets do; a line only takes the outline.
 */
function StyleGrid({ figure, shape, onPicked }: { figure: FigureCanvas; shape: SelectionInfo; onPicked: () => void }) {
  const open = shape.shapeKind !== undefined && OPEN_SHAPES.has(shape.shapeKind)
  const fill = toHex(shape.fill)?.toLowerCase() ?? ''
  const stroke = toHex(shape.stroke)?.toLowerCase()
  const isOn = (preset: Preset) => stroke === preset.stroke && (open || fill === preset.fill)
  const pick = (preset: Preset) => {
    const patch = open ? { stroke: preset.stroke } : { fill: preset.fill, stroke: preset.stroke }
    figure.change(patch)
    // The next shape takes the look set last, as when a preset is picked in the Shapes panel.
    figure.setDrawChoice({ style: patch })
    if (!open) void figure.changeShapeText({ colour: preset.text })
    onPicked()
  }
  return <PresetGrid open={open} isOn={isOn} onPick={pick} />
}

/** A framed icon's Style: the same preset grid, setting the frame's fill and outline as the Frame tab's presets do. */
function FrameStyleGrid({ figure, icon, onPicked }: { figure: FigureCanvas; icon: SelectionInfo; onPicked: () => void }) {
  const frame = icon.frame
  const isOn = (preset: Preset) => (frame?.fill ?? '').toLowerCase() === preset.fill && frame?.outline?.toLowerCase() === preset.stroke
  return (
    <PresetGrid
      open={false}
      isOn={isOn}
      onPick={(preset) => {
        figure.setFrame({ fill: preset.fill || null, outline: preset.stroke })
        onPicked()
      }}
    />
  )
}

/** Every preset, a row per look with its name on the left. */
function PresetGrid({ open, isOn, onPick }: { open: boolean; isOn: (preset: Preset) => boolean; onPick: (preset: Preset) => void }) {
  return (
    <div className="grid grid-cols-[auto_repeat(16,22px)] items-center gap-1">
      {PRESET_GROUPS.map((group) => (
        <div key={group.name} role="group" aria-label={group.name} className="contents">
          <span className="pr-2 text-xs text-muted-foreground">{group.name}</span>
          {group.presets.map((preset) => (
            <PresetSwatch key={preset.name} preset={preset} on={isOn(preset)} open={open} onPick={onPick} />
          ))}
          {/* A shorter row (Neutral) ends early, and the next look starts on a new line. */}
          {group.presets.length < 16 && <span style={{ gridColumn: `span ${16 - group.presets.length}` }} />}
        </div>
      ))}
    </div>
  )
}

/**
 * The same end tiles as the Arrows panel, drawn in the arrow's own path
 * and line; a pick sets both ends (and the middle mark) as the panel does.
 */
function EndsPicker({ figure, look, onPicked }: { figure: FigureCanvas; look: ArrowLook | undefined; onPicked: () => void }) {
  if (!look) return null
  const picked = ARROW_PRESETS.find((preset) => preset.start === look.start && preset.end === look.end && preset.mid === look.mid)?.id
  return (
    <ArrowEndTiles
      className="w-60"
      route={look.route}
      line={look.line}
      picked={picked}
      drawTitles={false}
      onPick={(preset) => {
        figure.setDrawChoice({ look: { start: preset.start, end: preset.end, mid: preset.mid } }, true)
        onPicked()
      }}
    />
  )
}

/** A short list of one-off actions with pictures, like a menu; picking one closes the widget. */
function ActionList({ items, run, close }: { items: { label: string; icon: LucideIcon; command: TableCommand; danger?: boolean }[]; run: (command: TableCommand) => void; close: () => void }) {
  return (
    <div className="flex w-48 flex-col">
      {items.map(({ label, icon: Icon, command, danger }) => (
        <button
          key={command}
          type="button"
          onClick={() => {
            run(command)
            close()
          }}
          className={cn(
            'flex h-8 items-center gap-2 rounded-sm px-2 text-left outline-none',
            'transition-colors duration-(--duration-instant) hover:bg-accent focus-visible:bg-accent',
            danger ? 'mt-1 text-destructive-text hover:bg-destructive/10' : '',
          )}
        >
          <Icon className={cn('size-[18px]', !danger && 'text-muted-foreground')} strokeWidth={1.75} aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  )
}
