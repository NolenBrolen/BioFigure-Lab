import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { setup } from '../../test/render'
import { TextFitCards } from './TextFitCards'

describe('TextFitCards', () => {
  it('names the three fits and shows the picked one', () => {
    setup(<TextFitCards value="wrap" onValueChange={() => undefined} />)
    expect(screen.getByRole('radiogroup', { name: 'When the text gets long' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Wrap text' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Grow shape' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('radio', { name: 'Shrink text' })).toHaveAttribute('aria-checked', 'false')
  })

  it('reports a clicked fit', async () => {
    const onValueChange = vi.fn()
    const { user } = setup(<TextFitCards value="grow" onValueChange={onValueChange} />)
    await user.click(screen.getByText('Shrink text'))
    expect(onValueChange).toHaveBeenLastCalledWith('shrink')
  })

  it('picks with the arrow keys', async () => {
    const onValueChange = vi.fn()
    const { user } = setup(<TextFitCards value="grow" onValueChange={onValueChange} />)
    await user.tab()
    await user.keyboard('{ArrowRight}')
    expect(onValueChange).toHaveBeenLastCalledWith('wrap')
  })
})
