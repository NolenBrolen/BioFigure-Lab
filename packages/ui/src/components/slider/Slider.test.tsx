import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { setup } from '../../test/render'
import { Slider } from './Slider'

describe('Slider', () => {
  it('is named by its label and reads out its value with the unit', () => {
    setup(<Slider label="Opacity" defaultValue={80} unit="%" />)
    const slider = screen.getByRole('slider', { name: 'Opacity' })
    expect(slider).toHaveAttribute('aria-valuenow', '80')
    expect(slider).toHaveAttribute('aria-valuetext', '80 %')
    expect(screen.getByRole('textbox', { name: 'Opacity value' })).toHaveValue('80')
  })

  it('keeps a hidden label for screen readers', () => {
    setup(<Slider label="Opacity" hideLabel defaultValue={80} />)
    expect(screen.getByRole('slider', { name: 'Opacity' })).toBeInTheDocument()
  })

  it('moves one step per arrow key and a large step with Shift', async () => {
    const onValueChange = vi.fn()
    const { user } = setup(<Slider label="Opacity" defaultValue={80} onValueChange={onValueChange} />)
    const slider = screen.getByRole('slider', { name: 'Opacity' })
    await user.click(slider)
    await user.keyboard('{ArrowRight}')
    expect(onValueChange).toHaveBeenLastCalledWith(81)
    await user.keyboard('{Shift>}{ArrowLeft}{/Shift}')
    expect(onValueChange).toHaveBeenLastCalledWith(71)
    expect(slider).toHaveAttribute('aria-valuenow', '71')
    expect(screen.getByRole('textbox', { name: 'Opacity value' })).toHaveValue('71')
  })

  it('jumps to the ends with Home and End', async () => {
    const { user } = setup(<Slider label="Opacity" defaultValue={80} />)
    const slider = screen.getByRole('slider', { name: 'Opacity' })
    await user.click(slider)
    await user.keyboard('{End}')
    expect(slider).toHaveAttribute('aria-valuenow', '100')
    await user.keyboard('{Home}')
    expect(slider).toHaveAttribute('aria-valuenow', '0')
  })

  it('steps by fractions without rounding noise', async () => {
    const onValueChange = vi.fn()
    const { user } = setup(
      <Slider label="Stroke width" min={0} max={10} step={0.25} defaultValue={1} unit="pt" onValueChange={onValueChange} />,
    )
    await user.click(screen.getByRole('slider', { name: 'Stroke width' }))
    await user.keyboard('{ArrowRight}{ArrowRight}')
    expect(onValueChange).toHaveBeenLastCalledWith(1.5)
    expect(screen.getByRole('textbox', { name: 'Stroke width value' })).toHaveValue('1.5')
  })

  it('takes a typed value once Enter is pressed, kept inside min and max', async () => {
    const onValueChange = vi.fn()
    const { user } = setup(<Slider label="Opacity" defaultValue={80} onValueChange={onValueChange} />)
    const field = screen.getByRole('textbox', { name: 'Opacity value' })
    await user.tripleClick(field)
    await user.keyboard('42{Enter}')
    expect(onValueChange).toHaveBeenLastCalledWith(42)
    expect(screen.getByRole('slider', { name: 'Opacity' })).toHaveAttribute('aria-valuenow', '42')
    expect(field).toHaveFocus()

    await user.tripleClick(field)
    await user.keyboard('150{Enter}')
    expect(onValueChange).toHaveBeenLastCalledWith(100)
  })

  it('steps with the arrow keys in the number field too', async () => {
    const onValueChange = vi.fn()
    const { user } = setup(<Slider label="Opacity" defaultValue={80} onValueChange={onValueChange} />)
    await user.click(screen.getByRole('textbox', { name: 'Opacity value' }))
    await user.keyboard('{ArrowUp}')
    expect(onValueChange).toHaveBeenLastCalledWith(81)
  })

  it('can leave out the number field', () => {
    setup(<Slider label="Opacity" defaultValue={80} showField={false} />)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('as a bar, shows the number in its handle instead of a field, and follows the keys', async () => {
    const { user } = setup(<Slider look="bar" label="Opacity" defaultValue={80} unit="%" />)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    // Base UI keeps an edge-aligned handle hidden until it has measured it, which jsdom never does.
    const slider = screen.getByRole('slider', { hidden: true })
    const handle = slider.parentElement
    expect(handle).toHaveTextContent('80%')
    slider.focus()
    await user.keyboard('{ArrowRight}')
    expect(handle).toHaveTextContent('81%')
  })

  it('ignores the keyboard when not available', async () => {
    const onValueChange = vi.fn()
    const { user } = setup(<Slider label="Opacity" defaultValue={80} disabled onValueChange={onValueChange} />)
    const slider = screen.getByRole('slider', { name: 'Opacity' })
    expect(slider).toBeDisabled()
    await user.keyboard('{ArrowRight}')
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it('keeps its label readable when not available', () => {
    setup(<Slider label="Opacity" defaultValue={80} disabled />)
    expect(screen.getByText('Opacity').closest('[class*="opacity-"]')).toBeNull()
  })
})
