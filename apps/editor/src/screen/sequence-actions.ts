/*
 * Sequence blocks (BIO-75) from the bar, the right-click menu and the
 * properties: Make a row and Detach say so with an Undo instead of asking first.
 */
import type { MenuSection } from '@biofigure-lab/ui/components/menu/Menu'
import type { useToast } from '@biofigure-lab/ui/components/toast/Toast'
import { Unlink } from 'lucide-react'

import type { SequenceActions } from '../editor/canvas-actions'
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

export function detachSequenceWithUndo(toasts: Toasts, figure: FigureCanvas | null, what = 'Sequence'): void {
  if (figure?.detachSequence()) undoToast(toasts, figure, `${what} detached`)
}

export function removeStepWithUndo(toasts: Toasts, figure: FigureCanvas | null, index: number): void {
  if (figure?.removeStep(index)) undoToast(toasts, figure, `Step ${index + 1} removed`)
}

/* Experiment timelines (BIO-96): removing and detaching say so with an Undo. */

export function detachTimelineWithUndo(toasts: Toasts, figure: FigureCanvas | null): void {
  if (figure?.detachTimeline()) undoToast(toasts, figure, 'Timeline detached')
}

/** `index` is the event's place in the settings, `shown` its place in day order (as the list shows it). */
export function removeEventWithUndo(toasts: Toasts, figure: FigureCanvas | null, index: number, shown: number): void {
  if (figure?.removeEvent(index)) undoToast(toasts, figure, `Event ${shown + 1} removed`)
}

export function removeEventKindWithUndo(toasts: Toasts, figure: FigureCanvas | null, kind: number, name: string): void {
  if (figure?.removeEventKind(kind)) undoToast(toasts, figure, `${name || `Kind ${kind + 1}`} removed with its events`)
}

/** What the bar's sequence buttons do. */
export function sequenceActions(toasts: Toasts, figure: FigureCanvas): SequenceActions {
  return {
    makeRow: () => {
      const count = figure.makeRow()
      if (count > 0) undoToast(toasts, figure, `Made a row of ${count}`)
    },
    addStep: () => figure.addStep(),
    setDirection: (direction) => figure.setSequence({ direction }),
    detach: () => detachSequenceWithUndo(toasts, figure, figure.comparisonSelected() ? 'Comparison' : figure.abstractSelected() ? 'Graphical abstract' : 'Sequence'),
    swapSides: () => figure.swapSides(),
    addEvent: () => figure.addEvent(),
    detachTimeline: () => detachTimelineWithUndo(toasts, figure),
  }
}

/** The right-click menu with "Detach sequence" added before Delete, when one sequence is selected. */
export function withSequenceMenu(sections: MenuSection[], selection: SelectionInfo | null, toasts: Toasts, figure: FigureCanvas | null): MenuSection[] {
  if (selection?.kind === 'timeline' && selection.count === 1) {
    const timeline: MenuSection = { label: 'Timeline', actions: [{ label: 'Detach timeline', icon: Unlink, onClick: () => detachTimelineWithUndo(toasts, figure) }] }
    return [...sections.slice(0, -1), timeline, ...sections.slice(-1)]
  }
  if (selection?.kind !== 'sequence' || selection.count !== 1) return sections
  const what = selection.comparison ? 'Comparison' : selection.name
  const sequence: MenuSection = { label: what, actions: [{ label: `Detach ${what.toLowerCase()}`, icon: Unlink, onClick: () => detachSequenceWithUndo(toasts, figure, what) }] }
  return [...sections.slice(0, -1), sequence, ...sections.slice(-1)]
}
