import { screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { setup } from '../../test/render'
import { PAPER_TITLE } from './paper-text'
import { PAGE_PX } from './PaperPreview'
import { columnName, PaperPreviewWindow } from './PaperPreviewWindow'

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
})

function Preview({ figureMm = { width: 174, height: 70 }, onOpenChange }: { figureMm?: { width: number; height: number }; onOpenChange?: (open: boolean) => void }) {
  const [open, setOpen] = useState(true)
  return (
    <PaperPreviewWindow
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        onOpenChange?.(next)
      }}
      figure={<svg data-testid="figure" />}
      figureMm={figureMm}
    />
  )
}

const page = () => document.querySelector('article')
/** A box's width or height in mm (the test browser turns mm into px). */
const mm = (element: Element | null, side: 'width' | 'height') => (parseFloat(getComputedStyle(element as Element)[side]) * 25.4) / 96

describe('PaperPreviewWindow', () => {
  it('opens on the title page with the figure on it, and names its column size', () => {
    setup(<Preview />)
    expect(screen.getByRole('dialog', { name: 'Paper preview' })).toBeInTheDocument()
    expect(page()).toHaveAttribute('data-layout', 'title-page')
    expect(page()).toHaveTextContent(PAPER_TITLE)
    const figure = screen.getByTestId('figure').closest('figure')
    expect(mm(figure, 'width')).toBeCloseTo(174, 1)
    expect(mm(figure, 'height')).toBeCloseTo(70, 1)
    expect(screen.getByText(/Double column · 174 × 70 mm on A4/)).toBeInTheDocument()
  })

  it('switches to the inside page and back', async () => {
    const { user } = setup(<Preview />)
    await user.click(screen.getByRole('button', { name: 'Inside page' }))
    expect(page()).toHaveAttribute('data-layout', 'inside-page')
    expect(page()).not.toHaveTextContent(PAPER_TITLE)
    await user.click(screen.getByRole('button', { name: 'Title page' }))
    expect(page()).toHaveAttribute('data-layout', 'title-page')
  })

  it('shows the page at actual size', async () => {
    const { user } = setup(<Preview />)
    await user.click(screen.getByRole('button', { name: 'Actual size' }))
    expect(parseFloat(getComputedStyle(screen.getByRole('img', { name: /A4 journal page/ })).width)).toBeCloseTo(PAGE_PX.width, 1)
  })

  it('shrinks a figure wider than both columns to the text width and says so', () => {
    setup(<Preview figureMm={{ width: 240, height: 96 }} />)
    const figure = screen.getByTestId('figure').closest('figure')
    expect(mm(figure, 'width')).toBeCloseTo(174, 1)
    expect(mm(figure, 'height')).toBeCloseTo(69.6, 1)
    expect(screen.getByText(/shown smaller to fit the page/)).toBeInTheDocument()
  })

  it('places single and 1.5 column figures the way journals do', () => {
    const { unmount } = setup(<Preview figureMm={{ width: 85, height: 60 }} />)
    expect(page()).toHaveAttribute('data-columns', 'single')
    expect(mm(screen.getByTestId('figure').closest('figure'), 'width')).toBeCloseTo(85, 1)
    expect(screen.getByText(/Single column · 85 × 60 mm on A4/)).toBeInTheDocument()
    expect(screen.queryByText(/shown smaller/)).not.toBeInTheDocument()
    unmount()

    setup(<Preview figureMm={{ width: 114, height: 80 }} />)
    expect(page()).toHaveAttribute('data-columns', 'one-and-half')
    expect(mm(screen.getByTestId('figure').closest('figure'), 'width')).toBeCloseTo(114, 1)
  })

  it('closes with the close button and with Escape', async () => {
    const onOpenChange = vi.fn()
    const { user, unmount } = setup(<Preview onOpenChange={onOpenChange} />)
    await user.click(screen.getByRole('button', { name: 'Close preview' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    unmount()

    setup(<Preview onOpenChange={onOpenChange} />)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledTimes(2))
  })

  it('names figure widths the way journals do', () => {
    expect(columnName(85)).toBe('Single column')
    expect(columnName(114)).toBe('1.5 column')
    expect(columnName(174)).toBe('Double column')
    expect(columnName(200)).toBe('Wider than a journal page')
  })

  it('on a phone moves the layout and zoom choices to a bottom bar, once', async () => {
    // jsdom has no matchMedia; this one says every query matches, so the phone layout is on.
    Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: (query: string) => ({ matches: true, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }) })
    try {
      const { user } = setup(<Preview />)
      expect(screen.getAllByRole('button', { name: 'Actual size' })).toHaveLength(1)
      await user.click(screen.getByRole('button', { name: 'Actual size' }))
      expect(parseFloat(getComputedStyle(screen.getByRole('img', { name: /A4 journal page/ })).width)).toBeCloseTo(PAGE_PX.width, 1)
    } finally {
      delete (window as { matchMedia?: unknown }).matchMedia
    }
  })
})
