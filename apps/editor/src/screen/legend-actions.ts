/*
 * Legends (BIO-106) from the right-click menu and the properties: removing a
 * row and Detach say so with an Undo instead of asking first.
 */
import type { MenuSection } from '@biofigure-lab/ui/components/menu/Menu'
import type { useToast } from '@biofigure-lab/ui/components/toast/Toast'
import { Unlink } from 'lucide-react'

import type { FigureCanvas, SelectionInfo } from '../editor/FigureCanvas'

type Toasts = ReturnType<typeof useToast>

function undoToast(toasts: Toasts, figure: FigureCanvas, title: string): void {
  const toastId = toasts.add({
    title,
    actionProps: {
      children: 'Undo',
      onClick: () => {
        toasts.close(toastId)
        figure.undo()
      },
    },
  })
}

export async function detachLegendWithUndo(toasts: Toasts, figure: FigureCanvas | null): Promise<void> {
  if (figure && (await figure.detachLegend())) undoToast(toasts, figure, 'Legend detached')
}

export function removeLegendRowWithUndo(toasts: Toasts, figure: FigureCanvas | null, id: string, label: string): void {
  if (figure?.removeLegendRow(id)) undoToast(toasts, figure, `${label.trim() || 'Row'} removed`)
}

/** The right-click menu with "Detach legend" added before Delete, when one legend is selected. */
export function withLegendMenu(sections: MenuSection[], selection: SelectionInfo | null, toasts: Toasts, figure: FigureCanvas | null): MenuSection[] {
  if (selection?.kind !== 'legend' || selection.count !== 1) return sections
  const legend: MenuSection = { label: 'Legend', actions: [{ label: 'Detach legend', icon: Unlink, onClick: () => void detachLegendWithUndo(toasts, figure) }] }
  return [...sections.slice(0, -1), legend, ...sections.slice(-1)]
}
