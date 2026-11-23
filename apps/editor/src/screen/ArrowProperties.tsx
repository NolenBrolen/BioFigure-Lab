/*
 * The selected arrow's colour, width and opacity, under the tiles of the
 * Arrows panel, in the Shapes panel's label-left rows. Its path, line and
 * ends are changed with the tiles above (the owner's pick, 2026-11-14).
 */
import { ColourInput } from '@biofigure-lab/ui/components/colour-input/ColourInput'

import { toHex } from '../editor/colour'
import type { SelectionInfo, StyleChange } from '../editor/FigureCanvas'
import { NumberOrSlider, OpacityRow, PropRow, PropRows } from './properties-pane'

type Props = {
  arrow: SelectionInfo
  onChange: (patch: StyleChange) => void
  /** The colours already in the figure, for the swatch dropdown. */
  usedColours?: () => readonly string[]
}

export function ArrowProperties({ arrow, onChange, usedColours }: Props) {
  return (
    <section aria-label="Selected arrow" className="border-t">
      <h3 className="section-label flex h-7 items-center px-3 pt-2">Selected arrow</h3>
      <PropRows className="pt-1">
        <PropRow label="Colour">
          <ColourInput
            label="Colour"
            value={toHex(arrow.stroke)}
            onChange={(stroke) => stroke && onChange({ stroke })}
            used={usedColours}
            className="min-w-0 flex-1"
            aside={<NumberOrSlider label="Line width" showLabel value={arrow.strokeWidth ?? 0} suffix="px" max={50} sliderMax={20} onCommit={(strokeWidth) => onChange({ strokeWidth })} className="w-[3.75rem] shrink-0" />}
          />
        </PropRow>
        <OpacityRow opacity={arrow.opacity} onChange={(opacity) => onChange({ opacity })} />
      </PropRows>
    </section>
  )
}
