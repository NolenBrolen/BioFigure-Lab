import { ToastProvider, ToastViewport } from '@biofigure-lab/ui/components/toast/Toast'
import { TooltipProvider } from '@biofigure-lab/ui/components/tooltip/Tooltip'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { FigureCanvas, SelectionInfo } from '../editor/FigureCanvas'
import { DEFAULT_PANEL, type PanelSettings } from '../editor/panel-block'
import { PanelProperties } from './PanelProperties'

/** A stand-in for the canvas, with only what the panel's properties call. */
function fakeFigure() {
  return {
    setPanel: vi.fn(),
    selectLayer: vi.fn(),
    detachPanel: vi.fn(() => true),
    undo: vi.fn(),
    usedColours: () => [],
  }
}

function renderPanel(settings: Partial<PanelSettings> = {}, contents: NonNullable<SelectionInfo['panel']>['contents'] = []) {
  const figure = fakeFigure()
  const selection = { kind: 'panel', name: 'Panel', count: 1, panel: { ...DEFAULT_PANEL, ...settings, contents } } as unknown as SelectionInfo
  render(
    <ToastProvider>
      <TooltipProvider delay={0}>
        <PanelProperties figure={figure as unknown as FigureCanvas} panel={selection} onBack={() => undefined} />
      </TooltipProvider>
      <ToastViewport />
    </ToastProvider>,
  )
  return figure
}

describe('panel properties', () => {
  it('changes the style and preset of the panel', () => {
    const figure = renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Soft area' }))
    expect(figure.setPanel).toHaveBeenCalledWith({ style: 'soft' })
    fireEvent.click(screen.getByRole('button', { name: 'Teal, strong preset' }))
    expect(figure.setPanel).toHaveBeenCalledWith({ colour: '#009e73', strong: true })
    // The panel's own colour and wash are the ringed preset.
    expect(screen.getByRole('button', { name: 'Blue preset' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('hides the title text while the title is hidden, and shows it again', () => {
    const figure = renderPanel({ titleShown: false })
    expect(screen.queryByRole('textbox', { name: 'Title text' })).toBeNull()
    // The Letter row has a Shown | Hidden toggle too: this is the Title's.
    fireEvent.click(within(screen.getByRole('group', { name: 'Title' })).getByRole('button', { name: 'Shown' }))
    expect(figure.setPanel).toHaveBeenCalledWith({ titleShown: true })
  })

  it('sends the title as it is typed, joined into one undo step', () => {
    const figure = renderPanel()
    fireEvent.change(screen.getByRole('textbox', { name: 'Title text' }), { target: { value: 'Donors' } })
    expect(figure.setPanel).toHaveBeenLastCalledWith({ title: 'Donors' }, 'panel-title')
  })

  it('lists what the panel holds and selects one when clicked', () => {
    const figure = renderPanel({}, [
      { id: 'a', name: 'Donor mouse', kind: 'icon' },
      { id: 'b', name: 'Arrow', kind: 'arrow' },
    ])
    expect(screen.getByText('2 objects')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Donor mouse' }))
    expect(figure.selectLayer).toHaveBeenCalledWith('a')
  })

  it('detaches the panel and offers to undo it', async () => {
    const figure = renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Detach panel' }))
    expect(figure.detachPanel).toHaveBeenCalledOnce()
    expect(await screen.findByText('Panel detached')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(figure.undo).toHaveBeenCalledOnce()
  })
})
