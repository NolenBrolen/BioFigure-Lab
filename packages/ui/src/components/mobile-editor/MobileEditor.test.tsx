import { fireEvent, screen } from '@testing-library/react'
import { Palette, Scaling, Shell, Type } from 'lucide-react'
import { useRef, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { useRowFocus } from '../../lib/row-focus'
import { setup } from '../../test/render'
import { BottomSheet } from './BottomSheet'
import { MobileTabBar } from './MobileTabBar'
import { PropertyBar } from './PropertyBar'

describe('MobileTabBar', () => {
  it('shows which tool is open and passes on the tapped one', async () => {
    const onPick = vi.fn()
    const { user } = setup(
      <MobileTabBar
        tabs={[
          { id: 'icons', label: 'Icons', icon: Shell },
          { id: 'text', label: 'Text', icon: Type },
        ]}
        value="icons"
        onPick={onPick}
      />,
    )
    expect(screen.getByRole('button', { name: 'Icons' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Text' })).toHaveAttribute('aria-pressed', 'false')
    await user.click(screen.getByRole('button', { name: 'Text' }))
    expect(onPick).toHaveBeenCalledWith('text')
  })
})

describe('PropertyBar', () => {
  it('lists the settings and opens the tapped one', async () => {
    const onPick = vi.fn()
    const { user } = setup(
      <PropertyBar
        label="B cell settings"
        items={[
          { id: 'Colour', label: 'Colour', icon: Palette },
          { id: 'Size (mm)', label: 'Size', icon: Scaling },
        ]}
        value="Colour"
        onPick={onPick}
      />,
    )
    const bar = screen.getByRole('toolbar', { name: 'B cell settings' })
    expect([...bar.querySelectorAll('button')].map((button) => button.textContent || button.getAttribute('aria-label'))).toEqual(['Colour', 'Size'])
    expect(screen.getByRole('button', { name: 'Colour' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Size' }))
    expect(onPick).toHaveBeenCalledWith('Size (mm)')
  })

  it('says why a faded item is off on the first tap, and opens the item it points to on the second', async () => {
    const onPick = vi.fn()
    const { user } = setup(
      <PropertyBar
        label="Table settings"
        items={[
          { id: 'Layout', label: 'Style', icon: Palette },
          { id: 'Line colour', label: 'Line colour', icon: Palette, off: { why: 'This table has no lines.', goTo: 'Layout' } },
        ]}
        onPick={onPick}
      />,
    )
    const off = screen.getByRole('button', { name: 'Line colour' })
    expect(off).toHaveAttribute('aria-disabled', 'true')
    await user.click(off)
    expect(onPick).not.toHaveBeenCalled()
    expect(await screen.findByText('This table has no lines.')).toBeInTheDocument()
    await user.click(off)
    expect(onPick).toHaveBeenCalledWith('Layout')
  })

  it('leaves the item a faded one points to open when it already is', async () => {
    const onPick = vi.fn()
    const { user } = setup(
      <PropertyBar
        label="Table settings"
        items={[
          { id: 'Layout', label: 'Style', icon: Palette },
          { id: 'Line colour', label: 'Line colour', icon: Palette, off: { why: 'This table has no lines.', goTo: 'Layout' } },
        ]}
        value="Layout"
        onPick={onPick}
      />,
    )
    const off = screen.getByRole('button', { name: 'Line colour' })
    await user.click(off)
    await user.click(off)
    expect(onPick).not.toHaveBeenCalled()
  })
})

describe('BottomSheet', () => {
  function Sheet({ onOpenChange = vi.fn() }: { onOpenChange?: (open: boolean) => void }) {
    const [open, setOpen] = useState(true)
    return (
      <>
        <button type="button" onClick={() => setOpen(!open)}>
          Toggle
        </button>
        <BottomSheet
          open={open}
          onOpenChange={(next) => {
            setOpen(next)
            onOpenChange(next)
          }}
          label="Icons"
        >
          <input aria-label="Search icons" />
        </BottomSheet>
      </>
    )
  }

  it('keeps its contents while closed, but out of reach', async () => {
    const { user } = setup(<Sheet />)
    await user.type(screen.getByRole('textbox', { name: 'Search icons' }), 'mouse')
    await user.click(screen.getByRole('button', { name: 'Toggle' }))
    expect(screen.queryByRole('region', { name: 'Icons' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Toggle' }))
    expect(screen.getByRole('textbox', { name: 'Search icons' })).toHaveValue('mouse')
  })

  it('closes when its handle is dragged down, and grows when tapped', async () => {
    const onOpenChange = vi.fn()
    const { user } = setup(<Sheet onOpenChange={onOpenChange} />)
    await user.click(screen.getByRole('button', { name: 'Make the panel bigger' }))
    expect(screen.getByRole('button', { name: 'Make the panel smaller' })).toBeInTheDocument()
    const handle = screen.getByRole('button', { name: 'Make the panel smaller' })
    // From full height a drag down goes back to half; another closes it.
    for (let i = 0; i < 2; i++) {
      fireEvent.pointerDown(handle, { pointerId: 1, clientY: 100 })
      fireEvent.pointerMove(handle, { pointerId: 1, clientY: 300 })
      fireEvent.pointerUp(handle, { pointerId: 1, clientY: 300 })
    }
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})

describe('useRowFocus', () => {
  function Panel({ focus }: { focus?: string }) {
    const ref = useRef<HTMLDivElement>(null)
    const names = useRowFocus(ref, focus)
    return (
      <>
        <output>{names.join(', ')}</output>
        <div ref={ref}>
          <h2>B cell</h2>
          <div>
            <span data-prop-label="Colour">Colour</span>
            <div data-prop-row="Colour">
              <input aria-label="Icon colour" />
            </div>
            <span data-prop-label="" />
            <div data-prop-row="">
              <input aria-label="Red" />
            </div>
            <span data-prop-label="Opacity">Opacity</span>
            <div data-prop-row="Opacity">
              <input aria-label="Opacity" />
            </div>
          </div>
        </div>
      </>
    )
  }

  it('lists the named settings and shows only the focused one, with the unnamed row under it', () => {
    const { rerender } = setup(<Panel />)
    expect(screen.getByRole('status')).toHaveTextContent('Colour, Opacity')
    rerender(<Panel focus="Colour" />)
    expect(screen.getByRole('textbox', { name: 'Icon colour' })).toBeVisible()
    expect(screen.getByRole('textbox', { name: 'Red' })).toBeVisible()
    expect(screen.queryByRole('textbox', { name: 'Opacity' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'B cell' })).not.toBeInTheDocument()
    rerender(<Panel />)
    expect(screen.getByRole('textbox', { name: 'Opacity' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'B cell' })).toBeVisible()
  })
})
