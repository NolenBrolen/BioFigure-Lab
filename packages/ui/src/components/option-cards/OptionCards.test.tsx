import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { setup } from '../../test/render'
import { OptionCards, type OptionCard } from './OptionCards'

const options: OptionCard<'single' | 'double' | 'custom'>[] = [
  { value: 'single', label: 'Single column', detail: '85 × 60 mm', picture: <svg /> },
  { value: 'double', label: 'Double column', detail: '174 × 120 mm', picture: <svg /> },
  { value: 'custom', label: 'Custom', detail: 'Your own size', picture: <svg />, disabled: true },
]

describe('OptionCards', () => {
  it('is a named radio group whose cards are read by their name and facts', () => {
    setup(<OptionCards label="Page size" options={options} defaultValue="double" />)
    expect(screen.getByRole('radiogroup', { name: 'Page size' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Double column, 174 × 120 mm' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Single column, 85 × 60 mm' })).toHaveAttribute('aria-checked', 'false')
  })

  it('picks a card when clicked and reports it', async () => {
    const onValueChange = vi.fn()
    const { user } = setup(<OptionCards label="Page size" options={options} defaultValue="double" onValueChange={onValueChange} />)
    await user.click(screen.getByText('Single column'))
    expect(screen.getByRole('radio', { name: /Single column/ })).toHaveAttribute('aria-checked', 'true')
    expect(onValueChange).toHaveBeenLastCalledWith('single')
  })

  it('moves and picks with the arrow keys after Tab reaches the picked card', async () => {
    const onValueChange = vi.fn()
    const { user } = setup(<OptionCards label="Page size" options={options} defaultValue="single" onValueChange={onValueChange} />)
    await user.tab()
    expect(screen.getByRole('radio', { name: /Single column/ })).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: /Double column/ })).toHaveFocus()
    expect(onValueChange).toHaveBeenLastCalledWith('double')
  })

  it('follows the value it is given', () => {
    const { rerender } = setup(<OptionCards label="Page size" options={options} value="single" />)
    rerender(<OptionCards label="Page size" options={options} value="double" />)
    expect(screen.getByRole('radio', { name: /Double column/ })).toHaveAttribute('aria-checked', 'true')
  })

  it('compact tiles are still a named radio group, read by their name alone', async () => {
    const onValueChange = vi.fn()
    const modes = [
      { value: 'rgb', label: 'RGB', picture: <svg /> },
      { value: 'grey', label: 'Greyscale', picture: <svg /> },
    ] as const
    const { user } = setup(<OptionCards compact label="Colour mode" options={modes} defaultValue="rgb" onValueChange={onValueChange} />)
    expect(screen.getByRole('radiogroup', { name: 'Colour mode' })).toBeInTheDocument()
    await user.click(screen.getByText('Greyscale'))
    expect(screen.getByRole('radio', { name: 'Greyscale' })).toHaveAttribute('aria-checked', 'true')
    expect(onValueChange).toHaveBeenLastCalledWith('grey')
  })

  it('ignores clicks on a card that is not available', async () => {
    const onValueChange = vi.fn()
    const { user } = setup(<OptionCards label="Page size" options={options} defaultValue="single" onValueChange={onValueChange} />)
    await user.click(screen.getByText('Custom'))
    expect(onValueChange).not.toHaveBeenCalled()
    expect(screen.getByRole('radio', { name: /Custom/ })).toHaveAttribute('aria-disabled', 'true')
  })
})
