import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { setup } from '../../test/render'
import { ErrorBarPicker } from './ErrorBarPicker'

describe('ErrorBarPicker', () => {
  it('shows the three common error bars and picks one with a click or arrow keys', async () => {
    const onChange = vi.fn()
    const { user } = setup(<ErrorBarPicker value="sd" onChange={onChange} />)
    expect(screen.getAllByRole('radio').map((r) => r.textContent)).toEqual(['SD', 'SEM', '95% CI'])
    await user.click(screen.getByRole('radio', { name: /95% CI/ }))
    expect(onChange).toHaveBeenLastCalledWith('ci95')
    screen.getByRole('radio', { name: /SD/ }).focus()
    await user.keyboard('{ArrowRight}')
    expect(onChange).toHaveBeenLastCalledWith('sem')
  })

  it('gives an error bar picked from More the third place', () => {
    setup(<ErrorBarPicker value="range" onChange={vi.fn()} />)
    expect(screen.getAllByRole('radio').map((r) => r.textContent)).toEqual(['SD', 'SEM', 'Range'])
    expect(screen.getByRole('radio', { name: /Range/ })).toBeChecked()
  })

  it('opens every error bar under family tabs, picks one and closes', async () => {
    const onChange = vi.fn()
    const { user } = setup(<ErrorBarPicker value="sd" onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: 'More error bars' }))
    const popup = await screen.findByRole('dialog')
    await user.click(within(popup).getByRole('tab', { name: 'Distribution' }))
    expect(within(popup).getAllByRole('radio').map((r) => r.textContent)).toEqual(['Range', 'IQR', 'MAD'])
    await user.click(within(popup).getByRole('radio', { name: 'IQR' }))
    expect(onChange).toHaveBeenLastCalledWith('iqr')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('searches every family at once, whichever tab is open', async () => {
    const { user } = setup(<ErrorBarPicker value="sd" onChange={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'More error bars' }))
    const popup = await screen.findByRole('dialog')
    await user.type(within(popup).getByRole('searchbox'), 'interval')
    expect(within(popup).getAllByRole('radio').map((r) => r.textContent)).toEqual(['2 × SEM', '95% CI', '90% CI', '99% CI'])
    await user.clear(within(popup).getByRole('searchbox'))
    await user.type(within(popup).getByRole('searchbox'), 'zzz')
    expect(within(popup).getByText('No error bar matches that search.')).toBeInTheDocument()
  })
})
