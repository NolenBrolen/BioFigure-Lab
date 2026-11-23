/*
 * The Graph tool's screens: the Graph panel on the left (pick a chart, then
 * click or drag on the page), and the data drawer under the page while a
 * chart is selected (type or paste its numbers; the chart follows).
 * Selecting a chart turns the Graph panel into its properties, under a
 * header with a back button and its name, like the Shapes panel.
 */
import { ChartDataEditor, type DataView } from '@biofigure-lab/ui/components/graph-panel/ChartDataEditor'
import { ChartPicture, GraphPanel, type ChartKind, type ErrorBars } from '@biofigure-lab/ui/components/graph-panel/GraphPanel'
import { useToast } from '@biofigure-lab/ui/components/toast/Toast'
import { useExpandedControls } from '@biofigure-lab/ui/lib/expanded-controls'
import { useState } from 'react'

import type { FigureCanvas, SelectionInfo } from '../editor/FigureCanvas'
import type { Tool } from '../editor/shapes'
import { addGroup, addRow, moveGroup, pasteInto, removeGroup, removeRow, renameGroup, setValue, type ChartData } from '../editor/chart-model'
import { ChartProperties } from './ChartProperties'
import { PropertiesHeader } from './properties-pane'

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
}

export function GraphView({ figure, tool, selection, open, onBack, onShowData }: GraphViewProps) {
  const [kind, setKind] = useState<ChartKind>('bar')
  const [chosenBars, setChosenBars] = useState<ErrorBars>('sd')
  const chart = selection?.chart
  const expanded = useExpandedControls()
  if (open && selection && chart) {
    return (
      <aside aria-label="Graph" className="flex min-h-0 flex-col overflow-y-auto bg-panel [scrollbar-gutter:stable]">
        {/* Desktop: the header lives in ChartProperties, so an open section can swap it for its own (one back arrow). */}
        {expanded && <PropertiesHeader backLabel="Back to graphs" picture={<ChartPicture kind={chart.kind} />} name={selection.name} onBack={onBack} />}
        <ChartProperties
          header={{ backLabel: 'Back to graphs', picture: <ChartPicture kind={chart.kind} className="size-5" />, name: selection.name, onBack }}
          chart={chart}
          onChange={(patch, save, mergeKey) => figure?.updateChart((current) => ({ ...current, ...patch }), save, mergeKey && `chart:${mergeKey}`)}
          onSave={() => figure?.saveChart()}
          onShowData={onShowData}
          data={<ChartDataSheet figure={figure} chart={chart} />}
          usedColours={() => figure?.usedColours() ?? []}
          size={{ width: selection.width, height: selection.height }}
          opacity={selection.opacity}
          onResize={(change, keep) => figure?.resize(change, keep)}
          onOpacity={(opacity) => figure?.change({ opacity })}
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

/** The data panel's height open, and folded to its header bar (40 px and its border), in px. */
const DATA_PANEL_HEIGHT = 224
const DATA_BAR_HEIGHT = 42
/** The gap between the floating data panel and the canvas edges, in px. */
const DATA_PANEL_GAP = 12

/** How much room the canvas leaves under the page so it can scroll up above the floating data panel. */
export function dataPanelRoom(collapsed: boolean) {
  return (collapsed ? DATA_BAR_HEIGHT : DATA_PANEL_HEIGHT) + 2 * DATA_PANEL_GAP + 16
}

/** The chart's data table, floating as a card over the bottom of the canvas (it never pushes the canvas or slide strip). */
export function ChartDataDrawer({ figure, chart, collapsed, onCollapsedChange }: { figure: FigureCanvas | null; chart: ChartData; collapsed: boolean; onCollapsedChange: (collapsed: boolean) => void }) {
  const [view, setView] = useState<DataView>('table')
  const update = (change: (chart: ChartData) => ChartData) => figure?.updateChart(change)
  return (
    <ChartDataEditor
      className="absolute z-20 overflow-hidden rounded-lg border shadow-(--elevation-lg)"
      style={{ left: DATA_PANEL_GAP, right: DATA_PANEL_GAP, bottom: DATA_PANEL_GAP, height: collapsed ? undefined : DATA_PANEL_HEIGHT }}
      collapsed={collapsed}
      onCollapsedChange={onCollapsedChange}
      groups={chart.groups}
      colours={chart.colours}
      view={view}
      onViewChange={setView}
      onValue={(c, r, text) => update((d) => setValue(d, c, r, text))}
      onRename={(c, name) => update((d) => renameGroup(d, c, name))}
      onPaste={(text, at) => update((d) => pasteInto(d, text, { r: Math.max(at.row, 0), c: at.group }))}
      onAddGroup={() => update(addGroup)}
      onRemoveGroup={(c) => update((d) => removeGroup(d, c))}
      // The editor names the gap it lands in; once taken out, later places move up by one.
      onMoveGroup={(from, to) => update((d) => moveGroup(d, from, to > from ? to - 1 : to))}
      onAddRow={() => update(addRow)}
    />
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
      colours={chart.colours}
      view={view}
      onViewChange={setView}
      onValue={(c, r, text) => update((d) => setValue(d, c, r, text))}
      onRename={(c, name) => update((d) => renameGroup(d, c, name))}
      onPaste={(text, at) => update((d) => pasteInto(d, text, { r: Math.max(at.row, 0), c: at.group }))}
      onAddGroup={() => update(addGroup)}
      onRemoveGroup={remove}
      onRemoveRow={(r) => withUndo((d) => removeRow(d, r), `Removed row ${r + 1}`)}
      onMoveGroup={(from, to) => update((d) => moveGroup(d, from, to > from ? to - 1 : to))}
      onAddRow={() => update(addRow)}
    />
  )
}
