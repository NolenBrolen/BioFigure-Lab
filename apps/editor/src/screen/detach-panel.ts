/*
 * Detach a panel (BIO-74), from its properties or the right-click menu, and
 * say so with an Undo instead of asking first: the panel's box and title
 * become plain shapes and what it held stays where it was.
 */
import type { MenuSection } from '@biofigure-lab/ui/components/menu/Menu'
import type { useToast } from '@biofigure-lab/ui/components/toast/Toast'
import { Ungroup } from 'lucide-react'

import type { FigureCanvas, SelectionInfo } from '../editor/FigureCanvas'

export function detachPanelWithUndo(toasts: ReturnType<typeof useToast>, figure: FigureCanvas | null, title = 'Panel detached'): void {
  if (!figure?.detachPanel()) return
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

/** The right-click menu with "Detach panel" added before Delete, when one panel is selected. */
export function withPanelMenu(sections: MenuSection[], selection: SelectionInfo | null, toasts: ReturnType<typeof useToast>, figure: FigureCanvas | null): MenuSection[] {
  if (selection?.kind !== 'panel' || selection.count !== 1) return sections
  // A figure grid is a panel too (BIO-86), and says so.
  const panel: MenuSection = selection.grid
    ? { label: 'Grid', actions: [{ label: 'Detach grid', icon: Ungroup, onClick: () => detachPanelWithUndo(toasts, figure, 'Grid detached') }] }
    : { label: 'Panel', actions: [{ label: 'Detach panel', icon: Ungroup, onClick: () => detachPanelWithUndo(toasts, figure) }] }
  return [...sections.slice(0, -1), panel, ...sections.slice(-1)]
}
