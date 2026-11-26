/*
 * Callout blocks (BIO-97) from the properties and the right-click menu:
 * removing a label and Detach say so with an Undo instead of asking first.
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

export async function detachCalloutWithUndo(toasts: Toasts, figure: FigureCanvas | null): Promise<void> {
  if (figure && (await figure.detachCallout())) undoToast(toasts, figure, 'Callout detached')
}

export function removeLabelWithUndo(toasts: Toasts, figure: FigureCanvas | null, index: number): void {
  if (figure?.removeCalloutLabel(index)) undoToast(toasts, figure, `Label ${index + 1} removed`)
}

/** The right-click menu with "Detach callout" added before Delete, when one callout (or a zoom marker) is selected. */
export function withCalloutMenu(sections: MenuSection[], selection: SelectionInfo | null, toasts: Toasts, figure: FigureCanvas | null): MenuSection[] {
  if (selection?.kind !== 'callout' || selection.count !== 1) return sections
  const callout: MenuSection = { label: 'Callout', actions: [{ label: 'Detach callout', icon: Unlink, onClick: () => void detachCalloutWithUndo(toasts, figure) }] }
  return [...sections.slice(0, -1), callout, ...sections.slice(-1)]
}
