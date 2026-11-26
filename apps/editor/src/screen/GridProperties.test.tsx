import { ToastProvider, ToastViewport } from '@biofigure-lab/ui/components/toast/Toast'
import { TooltipProvider } from '@biofigure-lab/ui/components/tooltip/Tooltip'
import { fireEvent, render, screen } from '@testing-library/react'
import axe from 'axe-core'
import { describe, expect, it, vi } from 'vitest'

import type { FigureCanvas, SelectionInfo } from '../editor/FigureCanvas'
import { DEFAULT_GRID, type GridSettings } from '../editor/grid-block'
import { DEFAULT_LETTERS } from '../editor/panel-letters'
import { GridProperties } from './GridProperties'

/** A stand-in for the canvas, with only what the grid's properties call. */
function fakeFigure() {
  return { setFigureGrid: vi.fn(), setSlideLetters: vi.fn(), setGridLayout: vi.fn(), detachPanel: vi.fn(() => true), undo: vi.fn() }
}

function renderGrid(settings: Partial<GridSettings> = {}, filled = 0) {
  const figure = fakeFigure()
  const selection = { kind: 'panel', name: 'Figure grid', count: 1, grid: { ...DEFAULT_GRID, ...settings, cells: 4, filled }, letters: { ...DEFAULT_LETTERS, slide: 1, first: true, startAt: 'A', goOnAt: 'A' } } as unknown as SelectionInfo
  render(
    <ToastProvider>
      <TooltipProvider delay={0}>
        <GridProperties figure={figure as unknown as FigureCanvas} grid={selection} onBack={() => undefined} />
      </TooltipProvider>
      <ToastViewport />
    </ToastProvider>,
  )
  return figure
}

describe('figure grid properties', () => {
  it('switches the letters off, and sets the slide letter weight and style', () => {
    const figure = renderGrid()
    fireEvent.click(screen.getByRole('switch', { name: 'Panel letters' }))
    expect(figure.setFigureGrid).toHaveBeenCalledWith({ letters: false })
    fireEvent.click(screen.getByRole('button', { name: 'Plain' }))
    expect(figure.setSlideLetters).toHaveBeenCalledWith({ bold: false })
    fireEvent.click(screen.getByRole('button', { name: 'Small' }))
    expect(figure.setSlideLetters).toHaveBeenCalledWith({ style: 'small' })
  })

  it('shows the slide letter settings only while this grid has letters', () => {
    renderGrid({ letters: false })
    expect(screen.queryByRole('group', { name: 'Letter weight' })).toBeNull()
  })

  it('picks another layout; one with fewer cells than the grid has charts is off', () => {
    const figure = renderGrid({ layout: 'grid' }, 3)
    expect(screen.getByRole('button', { name: '2 × 2' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '2 side by side' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: '2 × 3' }))
    expect(figure.setGridLayout).toHaveBeenCalledWith('six')
  })

  it('switches the shared legend on and sets the gap from the keyboard, joined into one undo step', () => {
    const figure = renderGrid()
    fireEvent.click(screen.getByRole('switch', { name: 'Shared legend' }))
    expect(figure.setFigureGrid).toHaveBeenCalledWith({ legend: true })
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Gap' }), { key: 'ArrowRight' })
    expect(figure.setFigureGrid).toHaveBeenLastCalledWith({ gap: 17 }, 'grid-gap')
  })

  it('detaches the grid and offers to undo it, and has nothing axe objects to', async () => {
    const figure = renderGrid()
    const result = await axe.run(document.body, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } })
    expect(result.violations).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'Detach grid' }))
    expect(figure.detachPanel).toHaveBeenCalledOnce()
    expect(await screen.findByText('Grid detached')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(figure.undo).toHaveBeenCalledOnce()
  })
})
