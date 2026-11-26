/*
 * The Graph tool's screens: the Graph panel on the left (pick a chart, then
 * click or drag on the page), and the data drawer under the page while a
 * chart is selected (type or paste its numbers; the chart follows).
 * Selecting a chart turns the Graph panel into its properties, under a
 * header with a back button and its name, like the Shapes panel.
 */
import { ChartDataEditor, type DataLine, type DataView } from '@biofigure-lab/ui/components/graph-panel/ChartDataEditor'
import { Button } from '@biofigure-lab/ui/components/button/Button'
import { ChartPicture, GraphPanel, type ChartKind, type ErrorBars } from '@biofigure-lab/ui/components/graph-panel/GraphPanel'
import { GraphList } from '@biofigure-lab/ui/components/graph-panel/GraphTypePicker'
import { useToast } from '@biofigure-lab/ui/components/toast/Toast'
import { useExpandedControls } from '@biofigure-lab/ui/lib/expanded-controls'
import { useState } from 'react'

import { measureText } from '../editor/ChartObject'
import type { FigureCanvas, SelectionInfo } from '../editor/FigureCanvas'
import type { Tool } from '../editor/shapes'
import type { DatasetStore } from '../editor/storage'
import { addGroup, addRow, chartSvg, moveGroup, parseNumber, parsePasted, pasteInto, removeGroup, removeRow, renameGroup, setValue, type ChartData } from '../editor/chart-model'
import { addLineRow, comboOf, isCombo, pasteIntoLine, setLineValue } from '../editor/chart-combo'
import { pasteHeatmap, renameRow } from '../editor/chart-heatmap'
import { tableColours } from '../editor/chart-xy'
import { ChartProperties } from './ChartProperties'
import { PropertiesHeader } from './properties-pane'
import { announceChartGrew } from './chart-grew-toast'
import { useChartData } from './useChartData'

type GraphViewProps = {
  figure: FigureCanvas | null
  tool: Tool
  /** The selected chart. */
  selection?: SelectionInfo
  /** Showing the selected chart's properties instead of the tiles. */
  open: boolean
  /** Back to the tiles; also lets go of the chart. */
  onBack: () => void
  onShowData: () => void
  /** The data card is open in full screen (so the Data section's button closes it). */
  dataOpen: boolean
  onCloseData: () => void
  /** The saved data sets (Your data). */
  datasets: DatasetStore
  /** An empty chart space is selected (BIO-86): every graph type shows, and the one picked fills it. Cancel lets go of it. */
  waiting?: { onCancel: () => void }
}

export function GraphView({ figure, tool, selection, open, onBack, onShowData, dataOpen, onCloseData, datasets, waiting }: GraphViewProps) {
  const [kind, setKind] = useState<ChartKind>('bar')
  const [chosenBars, setChosenBars] = useState<ErrorBars>('sd')
  const toasts = useToast()
  const chart = selection?.chart
  const expanded = useExpandedControls()
  const data = useChartData(figure, chart, datasets, { onEditData: onShowData, dataOpen, onCloseData })
  if (open && selection && chart) {
    return (
      <aside aria-label="Graph" className="flex min-h-0 flex-col overflow-y-auto bg-panel [scrollbar-gutter:stable]">
        {/* Desktop: the header lives in ChartProperties, so an open section can swap it for its own (one back arrow). */}
        {expanded && <PropertiesHeader backLabel="Back to graphs" picture={<ChartPicture kind={chart.kind} />} name={selection.name} onBack={onBack} />}
        <ChartProperties
          header={{ backLabel: 'Back to graphs', picture: <ChartPicture kind={chart.kind} className="size-5" />, name: selection.name, onBack }}
          chart={chart}
          onChange={(patch, save, mergeKey) => {
            // Picking a test (or showing ns) may need room for the brackets: the chart grows to fit, with an Undo toast.
            const fit = 'test' in patch || 'showNs' in patch || 'correction' in patch
            announceChartGrew(toasts, figure, figure?.updateChart((current) => ({ ...current, ...patch }), save, mergeKey && `chart:${mergeKey}`, fit))
          }}
          onSave={() => figure?.saveChart()}
          onShowData={onShowData}
          dataSection={data.section}
          data={<ChartDataSheet figure={figure} chart={chart} />}
          usedColours={() => figure?.usedColours() ?? []}
          size={{ width: selection.width, height: selection.height }}
          opacity={selection.opacity}
          onResize={(change, keep) => figure?.resize(change, keep)}
          onOpacity={(opacity) => figure?.change({ opacity })}
        />
        {data.dialog}
      </aside>
    )
  }
  // An empty chart space waits for a graph: every graph type in view, so it's clear one is to be picked (owner's feedback, 2026-11-25).
  if (waiting) {
    return (
      <aside aria-label="Graph" className="flex min-h-0 flex-col overflow-y-auto bg-panel p-3 [scrollbar-gutter:stable]">
        <div role="status" className="mb-3 flex items-center gap-2 rounded-md border border-primary/25 bg-primary-subtle px-2.5 py-2 text-xs text-primary-subtle-foreground">
          <span className="min-w-0 flex-1">Pick a graph for the selected space.</span>
          <Button size="sm" variant="ghost" onClick={waiting.onCancel}>
            Cancel
          </Button>
        </div>
        <GraphList
          onPick={(next) => {
            setKind(next)
            figure?.fillChartSpace(next)
          }}
        />
      </aside>
    )
  }
  return (
    <aside aria-label="Graph" className="flex min-h-0 flex-col overflow-y-auto bg-panel p-3 [scrollbar-gutter:stable]">
      <GraphPanel
        // With a chart selected, the tiles show and change its kind; otherwise they turn on placing one.
        picked={chart?.kind ?? (tool === 'chart' ? kind : undefined)}
        editing={chart !== undefined}
        onPick={(next) => {
          setKind(next)
          figure?.setChartChoice({ kind: next })
          if (chart) figure?.updateChart((d) => ({ ...d, kind: next }))
          else figure?.setTool('chart')
        }}
        // With a chart selected, the buttons show and change its error bars.
        errorBars={chart?.errorBars ?? chosenBars}
        onErrorBarsChange={(errorBars) => {
          setChosenBars(errorBars)
          figure?.setChartChoice({ errorBars })
        }}
      />
    </aside>
  )
}

/** The small data card's height, in px. */
const DATA_PANEL_HEIGHT = 224
/** The gap between the floating data panel and the canvas edges, in px. */
const DATA_PANEL_GAP = 12

/** How much room the canvas leaves under the page so it can scroll up above the floating data panel. */
export function dataPanelRoom() {
  return DATA_PANEL_HEIGHT + 2 * DATA_PANEL_GAP + 16
}

/** The chart's data table, floating as a card over the bottom of the canvas (it never pushes the canvas or slide strip). */
export function ChartDataDrawer({ figure, chart, onClose, fullScreen, onFullScreenChange }: { figure: FigureCanvas | null; chart: ChartData; onClose: () => void; fullScreen: boolean; onFullScreenChange: (on: boolean) => void }) {
  const [view, setView] = useState<DataView>('table')
  const update = (change: (chart: ChartData) => ChartData) => figure?.updateChart(change)
  return (
    <ChartDataEditor
      className="absolute z-20 overflow-hidden rounded-lg border shadow-(--elevation-lg)"
      style={{ left: DATA_PANEL_GAP, right: DATA_PANEL_GAP, bottom: DATA_PANEL_GAP, ...(fullScreen ? { top: DATA_PANEL_GAP } : { height: DATA_PANEL_HEIGHT }) }}
      onClose={onClose}
      fullScreen={fullScreen}
      onFullScreenChange={onFullScreenChange}
      preview={<ChartPreview chart={chart} />}
      groups={chart.groups}
      colours={tableColours(chart)}
      view={view}
      onViewChange={setView}
      onValue={(c, r, text) => update((d) => setValue(d, c, r, text))}
      onRename={(c, name) => update((d) => renameGroup(d, c, name))}
      onPaste={(text, at) => update((d) => pasteData(d, text, at))}
      {...rowNameProps(chart, update)}
      line={lineProps(chart, update)}
      onAddGroup={() => update(addGroup)}
      onRemoveGroup={(c) => update((d) => removeGroup(d, c))}
      // The editor names the gap it lands in; once taken out, later places move up by one.
      onMoveGroup={(from, to) => update((d) => moveGroup(d, from, to > from ? to - 1 : to))}
      onAddRow={() => update(addRow)}
    />
  )
}

/**
 * A live picture of the chart for the full-screen data card's corner card: drawn as on export, on a white page, as wide
 * as the card allows (12 px of room all round) with its proportions kept, so the card's height follows the chart.
 */
function ChartPreview({ chart }: { chart: ChartData }) {
  const svg = chartSvg(chart, measureText).join('')
  return (
    <div className="grid size-full min-h-0 min-w-0 place-items-center p-3">
      <svg
        role="img"
        aria-label="Chart preview"
        viewBox={`0 0 ${chart.width} ${chart.height}`}
        className="max-h-full max-w-full rounded-md bg-white shadow-sm"
        style={{ aspectRatio: `${chart.width} / ${chart.height}`, width: '100%' }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  )
}

/**
 * Phones: the chart's data inside its Data sheet, as group columns (easier to type into than a grid on a narrow
 * screen). Removing a group happens at once, with an Undo toast rather than an "Are you sure?" (the design rules).
 */
function ChartDataSheet({ figure, chart }: { figure: FigureCanvas | null; chart: ChartData }) {
  const [view, setView] = useState<DataView>('groups')
  const toasts = useToast()
  const update = (change: (chart: ChartData) => ChartData) => figure?.updateChart(change)
  /** Make a change, with a toast that puts the data back. */
  const withUndo = (change: (chart: ChartData) => ChartData, title: string, description?: string) => {
    const before = chart
    update(change)
    const toastId = toasts.add({
      title,
      description,
      actionProps: {
        children: 'Undo',
        onClick: () => {
          toasts.close(toastId)
          update(() => before)
        },
      },
    })
  }
  const remove = (c: number) => {
    const group = chart.groups[c]
    const values = group?.values.filter((v) => v !== null).length ?? 0
    withUndo((d) => removeGroup(d, c), `Removed ${group?.name || `group ${c + 1}`}`, values === 1 ? 'With its 1 value.' : `With its ${values} values.`)
  }
  return (
    <ChartDataEditor
      className="w-full"
      groups={chart.groups}
      colours={tableColours(chart)}
      view={view}
      onViewChange={setView}
      onValue={(c, r, text) => update((d) => setValue(d, c, r, text))}
      onRename={(c, name) => update((d) => renameGroup(d, c, name))}
      onPaste={(text, at) => update((d) => pasteData(d, text, at))}
      {...rowNameProps(chart, update)}
      line={lineProps(chart, update)}
      onAddGroup={() => update(addGroup)}
      onRemoveGroup={remove}
      onRemoveRow={(r) => withUndo((d) => removeRow(d, r), `Removed row ${r + 1}`)}
      onMoveGroup={(from, to) => update((d) => moveGroup(d, from, to > from ? to - 1 : to))}
      onAddRow={() => update(addRow)}
    />
  )
}

/** A block pasted into the data table: a heatmap reads row names in it too. */
const pasteData = (chart: ChartData, text: string, at: { group: number; row: number }) =>
  chart.kind === 'heatmap' ? pasteHeatmap(chart, text, { r: Math.max(at.row, 0), c: at.group }) : pasteInto(chart, text, { r: Math.max(at.row, 0), c: at.group })

/** Heatmaps name their rows in the table's first column. */
const rowNameProps = (chart: ChartData, update: (change: (chart: ChartData) => ChartData) => void) =>
  chart.kind === 'heatmap' ? { rowNames: chart.rowNames ?? [], onRenameRow: (r: number, name: string) => update((d) => renameRow(d, r, name)) } : {}

/** Bar + line charts: the line's values, as the data card's second table. */
function lineProps(chart: ChartData, update: (change: (chart: ChartData) => ChartData) => void): DataLine | undefined {
  if (!isCombo(chart.kind)) return undefined
  return {
    barsTitle: chart.yTitle,
    title: comboOf(chart).title,
    values: chart.groups.map((g) => g.line ?? []),
    onValue: (c, r, text) => update((d) => setLineValue(d, c, r, parseNumber(text))),
    onPaste: (text, at) => {
      // A pasted block's columns go to the groups from the one pasted into, its rows down from the row; a names row is left out.
      const columns = parsePasted(text)
      const rows = Array.from({ length: Math.max(0, ...columns.map((col) => col.values.length)) }, (_, r) => columns.map((col) => col.values[r] ?? null))
      update((d) => pasteIntoLine(d, rows, { r: Math.max(at.row, 0), c: at.group }))
    },
    onAddRow: () => update(addLineRow),
  }
}
