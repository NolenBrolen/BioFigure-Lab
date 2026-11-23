/*
 * The Table panel in the left panel. Picking a size places a table of that
 * size in the middle of the page; the layout and look tiles set what the next
 * table looks like. Selecting a table turns the panel into its properties,
 * under a header with a back button and its name, like the Shapes panel.
 */
import { TablePanel } from '@biofigure-lab/ui/components/table-panel/TablePanel'
import { usePhoneLayout } from '@biofigure-lab/ui/lib/use-media-query'
import { Table } from 'lucide-react'
import { useState } from 'react'

import type { FigureCanvas, SelectionInfo } from '../editor/FigureCanvas'
import { DEFAULT_TABLE_CHOICE, type TableChoice } from '../editor/table-model'
import { PropertiesHeader } from './properties-pane'
import { TableProperties } from './TableProperties'

type TableViewProps = {
  figure: FigureCanvas | null
  /** The selected table. */
  selection?: SelectionInfo
  /** Showing the selected table's properties instead of the tiles. */
  open: boolean
  /** Back to the tiles; also lets go of the table. */
  onBack: () => void
}

export function TableView({ figure, selection, open, onBack }: TableViewProps) {
  const [choice, setChoice] = useState<TableChoice>(DEFAULT_TABLE_CHOICE)
  const phone = usePhoneLayout()
  const change = (patch: Partial<TableChoice>, restyle = false) => {
    setChoice({ ...choice, ...patch })
    figure?.setTableChoice(patch, restyle)
  }
  if (open && selection?.table) {
    return (
      <aside aria-label="Table" className="flex min-h-0 flex-col overflow-y-auto bg-panel [scrollbar-gutter:stable]">
        <PropertiesHeader backLabel="Back to tables" picture={<Table className="size-5" />} name={selection.name} onBack={onBack} />
        <TableProperties
          table={selection.table}
          selection={selection}
          usedColours={() => figure?.usedColours() ?? []}
          onChange={(patch) => figure?.setTableStyle(patch)}
          onCommand={(command) => figure?.tableCommand(command)}
          onPaint={(patch) => figure?.change(patch)}
          onResize={(change, keep) => figure?.resize(change, keep)}
        />
      </aside>
    )
  }
  return (
    <aside aria-label="Table" className="flex min-h-0 flex-col overflow-y-auto bg-panel p-3 [scrollbar-gutter:stable]">
      <TablePanel
        layout={choice.layout}
        look={choice.look}
        onLayoutChange={(layout) => change({ layout }, true)}
        onLookChange={(look) => change({ look }, true)}
        // Phones: a tap only picks the size; the Place table button under the sheet places it.
        picked={phone ? { rows: choice.rows, cols: choice.cols } : undefined}
        onPickSize={(size) => {
          change(size)
          if (!phone) figure?.addTable()
        }}
      />
    </aside>
  )
}
