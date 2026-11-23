/*
 * Graph panel: the contents of the left panel when the Graph tool is on.
 * The graph type picker (three common graphs and a More tile, see
 * GraphTypePicker) and the error bar picker (three common error bars and a More
 * tile, see ErrorBarPicker), which only graphs that show an error bar get.
 * Picking a chart turns on placing it: click or drag on the page.
 */
import type { ReactNode } from 'react'

import { cn } from '../../lib/cn'
import { ErrorBarPicker, type ErrorBars } from './ErrorBarPicker'
import { GraphTypePicker, GraphTypePicture, usesErrorBars, type ChartKind } from './GraphTypePicker'

export type { ChartKind }
export type { ErrorBars }

/** A small picture of a chart kind, drawn with thin lines like the Shapes panel. */
export const ChartPicture = GraphTypePicture

export type GraphPanelProps = {
  /** The chart kind whose placing tool is on, if any. */
  picked?: ChartKind
  onPick: (kind: ChartKind) => void
  errorBars: ErrorBars
  onErrorBarsChange: (bars: ErrorBars) => void
  /** A chart is selected: the tiles and buttons show and change it. */
  editing?: boolean
  className?: string
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section aria-label={label} className="pt-1">
      <h3 className="section-label flex h-7 items-center">{label}</h3>
      {children}
    </section>
  )
}

export function GraphPanel({ picked, onPick, errorBars, onErrorBarsChange, editing = false, className }: GraphPanelProps) {
  return (
    <div className={cn('flex flex-col', className)}>
      <Section label="Chart">
        <GraphTypePicker value={picked} onChange={onPick} />
      </Section>
      {/* Graphs with no error bar (box, violin, before-after...) have nothing to set here. */}
      {(picked === undefined || usesErrorBars(picked)) && (
        <Section label="Error bars">
          <ErrorBarPicker value={errorBars} onChange={onErrorBarsChange} />
        </Section>
      )}
      {editing && <p className="pt-3 text-xs text-muted-foreground">These change the selected chart. To place a new one, click an empty spot on the page first, then pick a chart.</p>}
    </div>
  )
}
