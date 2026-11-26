import { TooltipProvider } from '@biofigure-lab/ui/components/tooltip/Tooltip'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { SelectionInfo } from '../editor/FigureCanvas'
import { ArrowProperties } from './ArrowProperties'

const look = { route: 'straight', line: 'solid', start: 'none', end: 'filled', mid: 'none' } as const

function renderArrow(arrow: Partial<SelectionInfo>) {
  const onStyle = vi.fn()
  const selection = { kind: 'line', name: 'Arrow', count: 1, opacity: 1, strokeWidth: 20, arrowLook: look, ...arrow } as unknown as SelectionInfo
  render(
    <TooltipProvider>
      <ArrowProperties arrow={selection} onChange={vi.fn()} onStyle={onStyle} />
    </TooltipProvider>,
  )
  return onStyle
}

describe('arrow presets (BIO-91)', () => {
  it('Default, first in the row, takes an arrow back to plain dark with no outline', () => {
    const onStyle = renderArrow({ stroke: '#d55e00', arrowStyle: { outline: '#8a3d00', outlineWidth: 2 } })
    const swatches = screen.getAllByRole('button', { name: / preset$/ })
    expect(swatches[0]).toHaveAccessibleName('Default preset')
    fireEvent.click(swatches[0]!)
    expect(onStyle).toHaveBeenCalledWith({ colour: '#1f2937', outline: undefined })
  })

  it('shows Default as picked on a plain dark arrow', () => {
    renderArrow({ stroke: '#1f2937', arrowStyle: { outlineWidth: 0 } })
    expect(screen.getByRole('button', { name: 'Default preset' })).toHaveAttribute('aria-pressed', 'true')
  })
})
