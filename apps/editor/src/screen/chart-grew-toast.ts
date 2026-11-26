/*
 * When picking a test or putting data in made a chart taller (so its
 * significance brackets don't squash the plot), say so with an Undo that puts
 * the old height and spot back and keeps the rest of the change.
 */
import type { useToast } from '@biofigure-lab/ui/components/toast/Toast'

import type { FigureCanvas } from '../editor/FigureCanvas'

export function announceChartGrew(toasts: ReturnType<typeof useToast>, figure: FigureCanvas | null, grewFrom: number | undefined): void {
  if (grewFrom === undefined) return
  const toastId = toasts.add({
    title: 'Chart made taller to fit the brackets',
    actionProps: {
      children: 'Undo',
      onClick: () => {
        toasts.close(toastId)
        figure?.shrinkChartBack()
      },
    },
  })
}
