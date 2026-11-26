import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { setup } from '../../test/render'
import { ColourScalePicker } from './ColourScalePicker'

describe('ColourScalePicker', () => {
  it('picks a scale with a click', async () => {
    const onChange = vi.fn()
    const { user } = setup(<ColourScalePicker value="viridis" onChange={onChange} />)
    await user.click(screen.getByRole('radio', { name: /Magma/ }))
    expect(onChange).toHaveBeenLastCalledWith('magma')
  })

  it('marks only the picked scale, and Tab lands on it', async () => {
    const { user } = setup(<ColourScalePicker value="greys" onChange={vi.fn()} />)
    expect(screen.getAllByRole('radio').filter((r) => r.getAttribute('aria-checked') === 'true').map((r) => r.textContent)).toEqual(['Greys'])
    await user.tab()
    expect(screen.getByRole('radio', { name: /Greys/ })).toHaveFocus()
  })

  it('moves through every scale with the arrow keys, across both headings, and wraps', async () => {
    const onChange = vi.fn()
    const { user } = setup(<ColourScalePicker value="greys" onChange={onChange} />)
    screen.getByRole('radio', { name: /Greys/ }).focus()
    await user.keyboard('{ArrowDown}')
    expect(onChange).toHaveBeenLastCalledWith('blue-red')
    expect(screen.getByRole('radio', { name: /Blue–white–red/ })).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(onChange).toHaveBeenLastCalledWith('viridis')
    await user.keyboard('{ArrowUp}')
    expect(onChange).toHaveBeenLastCalledWith('blue-red')
  })

  it('lists the two-sided scales under their own heading', () => {
    setup(<ColourScalePicker value="viridis" onChange={vi.fn()} />)
    expect(within(screen.getByRole('group', { name: 'Two-sided' })).getAllByRole('radio').map((r) => r.textContent)).toEqual(['Blue–white–red'])
    expect(within(screen.getByRole('group', { name: 'Sequential' })).getAllByRole('radio').map((r) => r.textContent)).toEqual(['Viridis', 'Magma', 'Greys'])
  })
})
