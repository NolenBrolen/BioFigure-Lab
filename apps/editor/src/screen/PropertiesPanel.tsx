/*
 * Right panel, above the layers. Every kind of object with its own tool shows
 * its properties in that tool's panel on the left (shapes, arrows, text,
 * icons, charts, tables; moved there 2026-11-14), so here it only says where
 * they are, with a button to show them. What has no tool of its own stays
 * here, in the same label-left rows: the page settings (nothing selected)
 * and groups or several objects at once. Aligning lives in the top bar
 * (ArrangeBar).
 */
import { Button } from '@biofigure-lab/ui/components/button/Button'
import { ColourInput } from '@biofigure-lab/ui/components/colour-input/ColourInput'
import { TextField } from '@biofigure-lab/ui/components/text-field/TextField'
import { Toggle } from '@biofigure-lab/ui/components/toggle/Toggle'

import { toHex } from '../editor/colour'
import type { SelectionInfo, SizeChange, StyleChange } from '../editor/FigureCanvas'
import { NumberField } from './fields'
import { OpacityRow, PropNote, PropRow, PropRows, SizeRow } from './properties-pane'

type PropertiesPanelProps = {
  selection: SelectionInfo | null
  /** The left panel that holds the selection's properties, e.g. "Shapes"; none for groups and several objects. */
  home?: string
  /** Open that panel. */
  onShowHome: () => void
  pageMm: { width: number; height: number }
  /** Grid spacing in mm. */
  gridMm: number
  snapToGrid: boolean
  onSnapToGrid: (on: boolean) => void
  onChange: (patch: StyleChange) => void
  onResize: (change: SizeChange, keepProportions: boolean) => void
  /** The colours already in the figure, for the swatch dropdowns. */
  usedColours?: () => readonly string[]
}

export function PropertiesPanel({ selection, home, onShowHome, pageMm, gridMm, snapToGrid, onSnapToGrid, onChange, onResize, usedColours }: PropertiesPanelProps) {
  // relative: hidden screen-reader labels inside stay within the scrolling panel instead of stretching the page.
  return (
    <aside aria-label="Properties" className="relative flex min-h-0 shrink-0 flex-col overflow-y-auto bg-panel">
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b px-3">
        <span className="truncate font-medium">{selection ? selection.name : 'Page'}</span>
      </div>
      {selection && home ? (
        <div className="flex items-center justify-between gap-2 px-3 py-3">
          <p className="text-xs text-muted-foreground">Its properties are in the {home} panel on the left.</p>
          <Button size="sm" onClick={onShowHome}>
            Show
          </Button>
        </div>
      ) : selection ? (
        <PropRows className="grid-cols-[3.5rem_minmax(0,1fr)] gap-x-3">
          <SizeRow width={selection.width} height={selection.height} onResize={onResize} />
          <PropRow label="Fill">
            <ColourInput label="Fill" noneLabel="No fill" value={toHex(selection.fill)} onChange={(fill) => onChange({ fill: fill ?? '' })} used={usedColours} className="min-w-0 flex-1" />
          </PropRow>
          <PropRow label="Outline">
            <ColourInput label="Outline" noneLabel="No outline" value={toHex(selection.stroke)} onChange={(stroke) => onChange({ stroke: stroke ?? '' })} used={usedColours} className="min-w-0 flex-1" />
          </PropRow>
          <PropRow label="Width">
            <NumberField label="Outline width" value={selection.strokeWidth ?? 0} suffix="px" min={0} max={50} onCommit={(strokeWidth) => onChange({ strokeWidth })} className="w-[4.5rem]" />
          </PropRow>
          <OpacityRow opacity={selection.opacity} onChange={(opacity) => onChange({ opacity })} />
        </PropRows>
      ) : (
        <PropRows className="grid-cols-[3.5rem_minmax(0,1fr)] gap-x-3">
          <PropRow label="Size">
            <TextField label="Page width" hideLabel prefix="W" value={String(pageMm.width)} readOnly className="min-w-0 flex-1" />
            <TextField label="Page height" hideLabel prefix="H" value={String(pageMm.height)} readOnly className="min-w-0 flex-1" />
            <span className="text-xs text-muted-foreground">mm</span>
          </PropRow>
          <PropRow label="Grid">
            <Toggle label="Snap to grid" hideLabel checked={snapToGrid} onCheckedChange={onSnapToGrid} />
          </PropRow>
          <PropNote>
            A {gridMm} mm grid. Objects always snap to each other and to the page; hold Alt while dragging to stop snapping. Turning clicks onto 15° steps when close to one; hold Shift to turn without snapping. Pick a tool on the left and click on the page to place something.
          </PropNote>
        </PropRows>
      )}
    </aside>
  )
}
