/*
 * The properties of a selected figure grid (BIO-86, design A "Open grid"
 * picked 2026-11-25), in the Blocks panel where its cards are:
 *
 * - Layout: the five layouts as small pictures; one with fewer cells than
 *   the grid has charts is faded (switching would drop a chart).
 * - Letters on or off; on, the slide's letter settings (style, weight, size,
 *   numbering) come in their own section below, shared with the panels (BIO-83).
 * - The shared legend under the cells, on or off.
 * - Gap: the space between cells, as a slider.
 * - Detach at the bottom, with an Undo toast instead of a question.
 */
import { Button } from '@biofigure-lab/ui/components/button/Button'
import { Slider } from '@biofigure-lab/ui/components/slider/Slider'
import { useToast } from '@biofigure-lab/ui/components/toast/Toast'
import { Toggle } from '@biofigure-lab/ui/components/toggle/Toggle'
import { cn } from '@biofigure-lab/ui/lib/cn'
import { useExpandedControls } from '@biofigure-lab/ui/lib/expanded-controls'
import { LayoutGrid, Ungroup } from 'lucide-react'
import { useMemo } from 'react'

import { figureGridSvg } from '../editor/blocks'
import type { FigureCanvas, SelectionInfo } from '../editor/FigureCanvas'
import { GAP_RANGE, GRID_LAYOUTS, type GridLayout } from '../editor/grid-block'
import { detachPanelWithUndo } from './detach-panel'
import { PropertiesHeader, PropRow, PropRows } from './properties-pane'
import { SlideLettersRows } from './SlideLetters'

/** A layout as a small picture: the same dashed blue slots as its card in the Blocks list (design D). */
export function GridLayoutPicture({ layout, className }: { layout: GridLayout; className?: string }) {
  const svg = useMemo(() => figureGridSvg(layout.id), [layout.id])
  return <span aria-hidden="true" className={cn('block', className)} dangerouslySetInnerHTML={{ __html: svg }} />
}

type Props = {
  figure: FigureCanvas | null
  /** The selected grid; its settings are in `grid.grid`. */
  grid: SelectionInfo
  /** Back to the block cards; also lets go of the grid. */
  onBack: () => void
}

export function GridProperties({ figure, grid, onBack }: Props) {
  const toasts = useToast()
  const expanded = useExpandedControls()
  const settings = grid.grid
  if (!settings) return null
  return (
    <>
      <PropertiesHeader backLabel="Back to blocks" picture={<LayoutGrid />} name="Figure grid" onBack={onBack} />
      <div className="px-3 pt-1 pb-3">
        <PropRows className="rounded-lg border border-border bg-muted/40">
        <PropRow label="Layout" wide>
          <div role="group" aria-label="Grid layout" className="grid w-full grid-cols-5 gap-1.5">
            {GRID_LAYOUTS.map((layout) => {
              const on = settings.layout === layout.id
              // Fewer cells than charts: switching would drop one.
              const off = !on && layout.cells.length < settings.filled
              return (
                <button
                  key={layout.id}
                  type="button"
                  title={off ? `${layout.name} (has fewer cells than this grid has charts)` : layout.name}
                  aria-label={layout.name}
                  aria-pressed={on}
                  disabled={off}
                  onClick={() => figure?.setGridLayout(layout.id)}
                  className={cn(
                    'flex h-10 items-center justify-center rounded-md border p-1 transition-colors duration-(--duration-instant) focus-visible:outline-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-40',
                    on ? 'border-primary/25 bg-primary-subtle text-primary-subtle-foreground hover:bg-primary-subtle-hover' : 'border-border-strong bg-panel text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <GridLayoutPicture layout={layout} className="h-full w-full" />
                </button>
              )
            })}
          </div>
        </PropRow>
        <PropRow label="Letters">
          <Toggle label="Panel letters" hideLabel checked={settings.letters} onCheckedChange={(letters) => figure?.setFigureGrid({ letters })} />
        </PropRow>
          {settings.letters && grid.letters && <SlideLettersRows figure={figure} letters={grid.letters} />}
        <PropRow label="Legend">
          <Toggle label="Shared legend" hideLabel checked={settings.legend} onCheckedChange={(legend) => figure?.setFigureGrid({ legend })} />
        </PropRow>
        </PropRows>
      </div>
      <PropRows className="border-t border-border pt-3">
        <PropRow label="Gap">
          <Slider
            look={expanded ? 'bar' : undefined}
            label="Gap"
            hideLabel
            min={GAP_RANGE.min}
            max={GAP_RANGE.max}
            value={Math.round(settings.gap)}
            unit="px"
            onValueChange={(gap) => figure?.setFigureGrid({ gap }, 'grid-gap')}
            className="min-w-0 flex-1"
          />
        </PropRow>
      </PropRows>
      <div className="border-t border-border p-3">
        <Button variant="secondary" size="sm" className="w-full gap-1.5" onClick={() => detachPanelWithUndo(toasts, figure, 'Grid detached')}>
          <Ungroup aria-hidden="true" />
          Detach grid
        </Button>
      </div>
    </>
  )
}
