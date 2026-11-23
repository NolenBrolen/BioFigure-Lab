import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { setup } from '../../test/render'
import { TextField } from './TextField'

describe('TextField', () => {
  it('links its label and help line to the input', () => {
    setup(<TextField label="Figure name" defaultValue="Phagocytosis" description="Shown in your list" />)
    const input = screen.getByLabelText('Figure name')
    expect(input).toHaveValue('Phagocytosis')
    expect(input).toHaveAccessibleDescription('Shown in your list')
  })

  it('keeps a hidden label for screen readers', () => {
    setup(<TextField label="X position" hideLabel prefix="X" suffix="mm" defaultValue="13.9" />)
    expect(screen.getByLabelText('X position')).toHaveValue('13.9')
  })

  it('marks the input invalid and reads out the error', () => {
    setup(<TextField label="Width" defaultValue="-5" error="Width must be more than 0 mm" />)
    const input = screen.getByLabelText('Width')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Width must be more than 0 mm')
  })

  it('reports each change', async () => {
    const onValueChange = vi.fn()
    const { user } = setup(<TextField label="Width" onValueChange={onValueChange} />)
    await user.type(screen.getByLabelText('Width'), '12')
    expect(onValueChange).toHaveBeenLastCalledWith('12', expect.anything())
  })

  it('puts the cursor in the input when the unit next to it is clicked', async () => {
    const { user } = setup(<TextField label="Width" suffix="mm" />)
    await user.click(screen.getByText('mm'))
    expect(screen.getByLabelText('Width')).toHaveFocus()
  })

  it('lets a button inside the field, like a colour swatch, keep its own click', async () => {
    const onPick = vi.fn()
    const { user } = setup(<TextField label="Fill colour" prefix={<button type="button" aria-label="Pick fill colour" onClick={onPick} />} />)
    const swatch = screen.getByRole('button', { name: 'Pick fill colour' })
    await user.click(swatch)
    expect(onPick).toHaveBeenCalledOnce()
    expect(swatch).toHaveFocus()
  })
})
