import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { setup } from '../../test/render'
import { ChoicePills } from './ChoicePills'

const options = [
  { value: 'science', label: 'Scientifically inaccurate' },
  { value: 'broken', label: 'Looks wrong / broken' },
  { value: 'name', label: 'Wrong name or search words' },
]

describe('ChoicePills', () => {
  it('is a named group of buttons that are announced as pressed or not', () => {
    setup(<ChoicePills label="What's wrong?" options={options} defaultValue={['broken']} />)
    expect(screen.getByRole('group', { name: "What's wrong?" })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Looks wrong / broken' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Scientifically inaccurate' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('reports the picked values when a pill is switched on and off', async () => {
    const onValueChange = vi.fn()
    const { user } = setup(<ChoicePills label="What's wrong?" options={options} onValueChange={onValueChange} />)
    await user.click(screen.getByRole('button', { name: 'Scientifically inaccurate' }))
    expect(onValueChange).toHaveBeenLastCalledWith(['science'])
    await user.click(screen.getByRole('button', { name: 'Scientifically inaccurate' }))
    expect(onValueChange).toHaveBeenLastCalledWith([])
  })

  it('lets several pills be on at once, also from the keyboard', async () => {
    const onValueChange = vi.fn()
    const { user } = setup(<ChoicePills label="What's wrong?" options={options} onValueChange={onValueChange} />)
    await user.click(screen.getByRole('button', { name: 'Scientifically inaccurate' }))
    await user.keyboard('{ArrowRight}{ArrowRight}{Enter}')
    expect(onValueChange).toHaveBeenLastCalledWith(['science', 'name'])
  })
})
