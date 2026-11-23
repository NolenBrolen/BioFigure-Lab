import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { setup } from '../../test/render'
import { Toggle } from './Toggle'

describe.each(['switch', 'segmented'] as const)('Toggle (%s)', (variant) => {
  it('is a switch named by its label that says whether it is on', () => {
    setup(<Toggle variant={variant} label="Snap to grid" defaultChecked />)
    expect(screen.getByRole('switch', { name: 'Snap to grid' })).toHaveAttribute('aria-checked', 'true')
  })

  it('keeps its name for screen readers when the label is hidden (label-left rows)', () => {
    setup(<Toggle variant={variant} label="Legend" hideLabel defaultChecked />)
    expect(screen.getByRole('switch', { name: 'Legend' })).toHaveAttribute('aria-checked', 'true')
  })

  it('switches when clicked and reports it', async () => {
    const onCheckedChange = vi.fn()
    const { user } = setup(<Toggle variant={variant} label="Transparent background" onCheckedChange={onCheckedChange} />)
    const toggle = screen.getByRole('switch', { name: 'Transparent background' })
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    expect(onCheckedChange).toHaveBeenLastCalledWith(true)
  })

  it('switches when its label is clicked', async () => {
    const { user } = setup(<Toggle variant={variant} label="Snap to grid" />)
    await user.click(screen.getByText('Snap to grid'))
    expect(screen.getByRole('switch', { name: 'Snap to grid' })).toHaveAttribute('aria-checked', 'true')
  })

  it('switches with Space from the keyboard', async () => {
    const { user } = setup(<Toggle variant={variant} label="Snap to grid" />)
    await user.tab()
    const toggle = screen.getByRole('switch', { name: 'Snap to grid' })
    expect(toggle).toHaveFocus()
    await user.keyboard(' ')
    expect(toggle).toHaveAttribute('aria-checked', 'true')
  })

  it('reads out its help line', () => {
    setup(<Toggle variant={variant} label="Transparent background" description="Only for PNG" />)
    expect(screen.getByRole('switch', { name: 'Transparent background' })).toHaveAccessibleDescription('Only for PNG')
  })

  it('ignores clicks when not available', async () => {
    const onCheckedChange = vi.fn()
    const { user } = setup(<Toggle variant={variant} label="Snap to grid" disabled onCheckedChange={onCheckedChange} />)
    await user.click(screen.getByRole('switch', { name: 'Snap to grid' }))
    expect(onCheckedChange).not.toHaveBeenCalled()
  })

  it('keeps its label and help line readable when not available, so they can say why', () => {
    setup(<Toggle variant={variant} label="Transparent background" description="Not possible for PDF" disabled />)
    expect(screen.getByText('Not possible for PDF').closest('[class*="opacity-"]')).toBeNull()
    expect(screen.getByText('Transparent background').closest('[class*="opacity-"]')).toBeNull()
  })
})

describe('Toggle (bar)', () => {
  it('switches by click and by Space, and reports it', async () => {
    const onCheckedChange = vi.fn()
    const { user } = setup(<Toggle variant="bar" label="Show text" onCheckedChange={onCheckedChange} />)
    const toggle = screen.getByRole('switch', { name: 'Show text' })
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    expect(onCheckedChange).toHaveBeenLastCalledWith(true)
    await user.keyboard(' ')
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(onCheckedChange).toHaveBeenLastCalledWith(false)
  })

  it('shows a visible label above the bar, and still names the switch for screen readers', () => {
    setup(<Toggle variant="bar" label="Show text" />)
    const label = screen.getByText('Show text')
    const toggle = screen.getByRole('switch', { name: 'Show text' })
    expect(label).toBeVisible()
    const row = toggle.parentElement!
    expect(row).toContainElement(label)
    expect(row.className).toContain('flex-col')
    expect(toggle.className).toContain('w-full')
  })

  it('shows its own off and on icons in place of the X and the tick', () => {
    setup(<Toggle variant="bar" label="Show text" offIcon={<svg data-testid="no-text" />} onIcon={<svg data-testid="text" />} />)
    expect(screen.getAllByTestId('no-text').length).toBeGreaterThan(0)
    expect(screen.getAllByTestId('text').length).toBeGreaterThan(0)
    const toggle = screen.getByRole('switch', { name: 'Show text' })
    expect(toggle.querySelector('svg.lucide-x, svg.lucide-check')).toBeNull()
  })
})
