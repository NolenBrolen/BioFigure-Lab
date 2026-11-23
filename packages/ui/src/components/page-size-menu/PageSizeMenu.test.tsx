import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { setup } from '../../test/render'
import { PageSizeMenu } from './PageSizeMenu'

const options = [
  { value: 'single', label: 'Single column', width: 85, height: 60 },
  { value: 'double', label: 'Double column', width: 174, height: 120 },
] as const

describe('PageSizeMenu', () => {
  it('names the current size and its millimetres on the button', () => {
    setup(<PageSizeMenu options={options} page={{ width: 174, height: 120 }} onPick={vi.fn()} onCustom={vi.fn()} />)
    const button = screen.getByRole('button', { name: 'Page size: Double column, 174 × 120 mm' })
    expect(button).toHaveTextContent('Double column')
    expect(button).toHaveTextContent('174 × 120 mm')
  })

  it('calls a size that matches no option Custom', () => {
    setup(<PageSizeMenu options={options} page={{ width: 140, height: 90 }} onPick={vi.fn()} onCustom={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Page size: Custom, 140 × 90 mm' })).toBeInTheDocument()
  })

  it('opens with the current size ticked and picks another', async () => {
    const onPick = vi.fn()
    const { user } = setup(<PageSizeMenu options={options} page={{ width: 174, height: 120 }} onPick={onPick} onCustom={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /Page size/ }))
    expect(await screen.findByRole('menuitemradio', { name: /Double column/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('menuitemradio', { name: /Single column/ })).toHaveAttribute('aria-checked', 'false')
    await user.click(screen.getByRole('menuitemradio', { name: /Single column/ }))
    expect(onPick).toHaveBeenCalledWith('single')
  })

  it('asks for a custom size', async () => {
    const onCustom = vi.fn()
    const { user } = setup(<PageSizeMenu options={options} page={{ width: 174, height: 120 }} onPick={vi.fn()} onCustom={onCustom} />)
    await user.click(screen.getByRole('button', { name: /Page size/ }))
    await user.click(await screen.findByRole('menuitem', { name: 'Custom size…' }))
    expect(onCustom).toHaveBeenCalled()
  })

  it('works with the keyboard', async () => {
    const onPick = vi.fn()
    const { user } = setup(<PageSizeMenu options={options} page={{ width: 174, height: 120 }} onPick={onPick} onCustom={vi.fn()} />)
    await user.tab()
    await user.keyboard('{Enter}')
    await screen.findByRole('menu')
    // Opening from the keyboard puts the highlight on the first size.
    await user.keyboard('{Enter}')
    expect(onPick).toHaveBeenCalledWith('single')
  })
})
