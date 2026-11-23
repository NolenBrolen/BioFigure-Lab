/*
 * The tools in the rail on the far left, top to bottom. To plug in a tool's
 * panel, set its `panel`; a tool without one shows a "coming soon"
 * placeholder. Keep the ids as they are: they name the tools for good.
 */
import type { Tool } from '@biofigure-lab/ui/components/tool-rail/ToolRail'
import { ShapesToolIcon } from '@biofigure-lab/ui/components/tool-rail/ShapesToolIcon'
import { ChartColumn, Shell, Table, Type } from 'lucide-react'
import type { ReactNode } from 'react'

import type { SelectionInfo } from '../editor/FigureCanvas'
import type { Tool as DrawTool } from '../editor/shapes'

/** The rail tool whose panel holds each drawing tool, so pressing its key opens that panel too. */
export const panelForTool: Partial<Record<DrawTool, string>> = { rectangle: 'shapes', ellipse: 'shapes', shape: 'shapes', line: 'arrows', arrow: 'arrows', text: 'text', chart: 'graph', table: 'table' }

/**
 * The tool to keep when a panel opens: a drawing tool only stays on while its
 * own panel is open. The arrow and text tools stay on after placing, so
 * without this an arrow tool left on would draw arrows from objects clicked
 * in the Icons panel.
 */
export function toolForPanel(tool: DrawTool, panel: string): DrawTool {
  const home = panelForTool[tool]
  return home === undefined || home === panel ? tool : 'select'
}

/**
 * The tool to turn on when a selection ends. With the Arrows panel open and
 * Select on (an arrow was selected there to restyle it), letting go of it
 * hands back to the arrow tool, so its anchors show again and the next drag
 * draws: the open panel and the tool agree. Otherwise the tool stays.
 */
export function toolAfterSelectionEnds(tool: DrawTool, panel: string): DrawTool {
  return panel === 'arrows' && tool === 'select' ? 'arrow' : tool
}

/** The rail tool whose panel shows each kind of selected object's properties. Groups and several objects have none. */
export const panelForSelection: Partial<Record<SelectionInfo['kind'], string>> = { shape: 'shapes', line: 'arrows', text: 'text', icon: 'icons', chart: 'graph', table: 'table' }

/** Each panel's name, as the right panel mentions it. */
export const panelNames: Record<string, string> = { icons: 'Icons', arrows: 'Arrows', shapes: 'Shapes', text: 'Text', graph: 'Graph', table: 'Table' }

export function editorTools({ iconsPanel, arrowsPanel, shapesPanel, textPanel, graphPanel, tablePanel }: { iconsPanel: ReactNode; arrowsPanel: ReactNode; shapesPanel: ReactNode; textPanel: ReactNode; graphPanel: ReactNode; tablePanel: ReactNode }): Tool[] {
  return [
    { id: 'icons', label: 'Icons', icon: Shell, panel: iconsPanel },
    { id: 'arrows', label: 'Arrows and lines', icon: ArrowsAndLinesIcon, panel: arrowsPanel, shortcut: 'A, L' },
    { id: 'shapes', label: 'Shapes', icon: ShapesToolIcon, panel: shapesPanel, shortcut: 'R, O' },
    { id: 'text', label: 'Text', icon: Type, panel: textPanel, shortcut: 'T' },
    { id: 'graph', label: 'Graph', icon: ChartColumn, panel: graphPanel },
    { id: 'table', label: 'Table', icon: Table, panel: tablePanel },
  ]
}

/** The Arrows tool's rail icon: a diagonal arrow beside a plain line, drawn like a Lucide icon. */
function ArrowsAndLinesIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 14 14 4M8 4h6v6" />
      <path d="M10 20 20 10" />
    </svg>
  )
}
