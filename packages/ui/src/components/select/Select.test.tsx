import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { setup } from '../../test/render'
import { Select } from './Select'

const pageSizes = [
  { value: 'single', label: 'Single column', detail: '85 mm' },
  { value: 'one-and-half', label: '1.5 column', detail: '114 mm' },
  { value: 'double', label: 'Double column', detail: '174 mm' },
  { value: 'custom', label: 'Custom' },
] as const

describe('Select', () => {
  it('is named by its label and shows the picked option', () => {
    setup(<Select label="Page size" options={pageSizes} defaultValue="double" />)
    const trigger = screen.getByRole('combobox', { name: 'Page size' })
    expect(trigger).toHaveTextContent('Double column')
  })

  it('shows its label inside the button, unless hidden, and is named by it either way', () => {
    setup(<Select label="Page size" options={pageSizes} defaultValue="double" />)
    expect(screen.getByRole('combobox', { name: 'Page size' })).toHaveTextContent('Page size')
  })

  it('keeps a hidden label for screen readers', () => {
    setup(<Select label="Page size" hideLabel options={pageSizes} defaultValue="double" />)
    const trigger = screen.getByRole('combobox', { name: 'Page size' })
    expect(trigger).not.toHaveTextContent('Page size')
  })

  it('can show its label above the button instead, still named by it', () => {
    setup(<Select label="Page size" labelPosition="above" options={pageSizes} defaultValue="double" />)
    const trigger = screen.getByRole('combobox', { name: 'Page size' })
    expect(trigger).not.toHaveTextContent('Page size')
    expect(screen.getByText('Page size')).toBeVisible()
  })

  it('shows a placeholder while nothing is picked', () => {
    setup(<Select label="Export format" placeholder="Pick a format" options={[{ value: 'png', label: 'PNG' }]} />)
    expect(screen.getByRole('combobox', { name: 'Export format' })).toHaveTextContent('Pick a format')
  })

  it('opens on click and picks an option', async () => {
    const onValueChange = vi.fn()
    const { user } = setup(<Select label="Page size" options={pageSizes} defaultValue="double" onValueChange={onValueChange} />)
    const trigger = screen.getByRole('combobox', { name: 'Page size' })
    await user.click(trigger)
    expect(await screen.findByRole('option', { name: /Double column/ })).toHaveAttribute('aria-selected', 'true')
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    await user.click(screen.getByRole('option', { name: /Single column/ }))
    expect(onValueChange).toHaveBeenLastCalledWith('single')
    expect(trigger).toHaveTextContent('Single column')
  })

  it('works with the keyboard', async () => {
    const onValueChange = vi.fn()
    const { user } = setup(<Select label="Page size" options={pageSizes} defaultValue="single" onValueChange={onValueChange} />)
    await user.tab()
    expect(screen.getByRole('combobox', { name: 'Page size' })).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(await screen.findByRole('listbox')).toBeInTheDocument()
    await user.keyboard('{ArrowDown}{Enter}')
    expect(onValueChange).toHaveBeenLastCalledWith('one-and-half')
  })

  it('closes with Escape without changing anything', async () => {
    const onValueChange = vi.fn()
    const { user } = setup(<Select label="Page size" options={pageSizes} defaultValue="double" onValueChange={onValueChange} />)
    const trigger = screen.getByRole('combobox', { name: 'Page size' })
    await user.click(trigger)
    await screen.findByRole('listbox')
    await user.keyboard('{Escape}')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(onValueChange).not.toHaveBeenCalled()
    expect(trigger).toHaveTextContent('Double column')
  })

  it('cannot be opened when not available, but keeps its label readable', async () => {
    const { user } = setup(<Select label="Page size" options={pageSizes} defaultValue="double" disabled />)
    const trigger = screen.getByRole('combobox', { name: 'Page size' })
    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    const labelElement = document.getElementById(trigger.getAttribute('aria-labelledby') ?? '')
    expect(labelElement).toHaveTextContent('Page size')
    expect(labelElement?.closest('[class*="opacity-"]')).toBeNull()
  })
})
