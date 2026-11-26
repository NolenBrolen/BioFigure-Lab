import { TooltipProvider } from '@biofigure-lab/ui/components/tooltip/Tooltip'
import { fireEvent, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { CanvasArea } from './CanvasArea'

function renderArea() {
  const onBackdropPress = vi.fn()
  const canvasHostRef = createRef<HTMLDivElement>()
  const viewportRef = createRef<HTMLDivElement>()
  render(
    <TooltipProvider delay={0}>
      <CanvasArea
        canvasHostRef={canvasHostRef}
        viewportRef={viewportRef}
        pageLabel={<button type="button">Page size</button>}
        tool="select"
        zoom={1}
        onZoomIn={() => undefined}
        onZoomOut={() => undefined}
        onZoomFit={() => undefined}
        onPreview={() => undefined}
        onDropIcon={() => undefined}
        selection={null}
        transforming={false}
        quickActions={() => []}
        menuSections={[]}
        onRightClick={() => undefined}
        onBackdropPress={onBackdropPress}
      />
    </TooltipProvider>,
  )
  return { onBackdropPress, host: canvasHostRef.current!, viewport: viewportRef.current! }
}

describe('canvas area', () => {
  it('reports a left press on the grey area round the page, and its padding', () => {
    const { onBackdropPress, host, viewport } = renderArea()
    fireEvent.pointerDown(viewport, { button: 0 })
    fireEvent.pointerDown(host.parentElement!, { button: 0 })
    expect(onBackdropPress).toHaveBeenCalledTimes(2)
  })

  it('leaves presses on the page, the page label controls and right clicks alone', () => {
    const { onBackdropPress, host, viewport } = renderArea()
    fireEvent.pointerDown(host, { button: 0 })
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Page size' }), { button: 0 })
    fireEvent.pointerDown(viewport, { button: 2 })
    expect(onBackdropPress).not.toHaveBeenCalled()
  })
})
