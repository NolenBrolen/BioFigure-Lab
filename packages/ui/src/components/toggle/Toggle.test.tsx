import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ExpandedControls } from '../../lib/expanded-controls'
import { setup } from '../../test/render'
import { Toggle } from './Toggle'

describe.each(['bar', 'segmented'] as const)('Toggle (%s)', (variant) => {
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

  it('is the default: the fat bar with an X and a tick', () => {
    setup(<Toggle label="Snap to grid" />)
    const toggle = screen.getByRole('switch', { name: 'Snap to grid' })
    expect(toggle.className).toContain('h-11')
    expect(toggle.querySelector('svg.lucide-x')).not.toBeNull()
    expect(toggle.querySelector('svg.lucide-check')).not.toBeNull()
  })

  it('sits at the end of the row at a fixed width next to a visible label, and fills a label-left row', () => {
    const { unmount } = setup(<Toggle label="Show text" />)
    const label = screen.getByText('Show text')
    const toggle = screen.getByRole('switch', { name: 'Show text' })
    expect(label).toBeVisible()
    const row = toggle.parentElement!
    expect(row).toContainElement(label)
    expect(row.className).toContain('justify-between')
    expect(toggle.className).toContain('w-24')
    unmount()

    setup(<Toggle label="Legend" hideLabel />)
    expect(screen.getByRole('switch', { name: 'Legend' }).className).toContain('w-full')
  })

  it("keeps the phone's 96 px fat switch in a phone's sheet, even with a hidden label", () => {
    setup(
      <ExpandedControls.Provider value>
        <Toggle label="Legend" hideLabel />
      </ExpandedControls.Provider>,
    )
    const toggle = screen.getByRole('switch', { name: 'Legend' })
    expect(toggle.className).toContain('w-24')
    expect(toggle.className).not.toContain('w-full')
    expect(toggle.parentElement!.className).not.toContain('w-full')
  })

  it('shows its own off and on icons in place of the X and the tick', () => {
    setup(<Toggle variant="bar" label="Show text" offIcon={<svg data-testid="no-text" />} onIcon={<svg data-testid="text" />} />)
    expect(screen.getAllByTestId('no-text').length).toBeGreaterThan(0)
    expect(screen.getAllByTestId('text').length).toBeGreaterThan(0)
    const toggle = screen.getByRole('switch', { name: 'Show text' })
    expect(toggle.querySelector('svg.lucide-x, svg.lucide-check')).toBeNull()
  })
})
