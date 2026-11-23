import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { setup } from '../../test/render'
import { Tabs, TabsPanel } from './Tabs'

const tabs = [
  { value: 'design', label: 'Design' },
  { value: 'arrange', label: 'Arrange' },
]

function PropertiesTabs() {
  return (
    <Tabs label="Properties" tabs={tabs}>
      <TabsPanel value="design">Fill settings</TabsPanel>
      <TabsPanel value="arrange">Alignment settings</TabsPanel>
    </Tabs>
  )
}

describe('Tabs', () => {
  it('shows the first tab, and another tab when it is clicked', async () => {
    const { user } = setup(<PropertiesTabs />)
    expect(screen.getByText('Fill settings')).toBeVisible()
    await user.click(screen.getByRole('tab', { name: 'Arrange' }))
    expect(screen.getByRole('tab', { name: 'Arrange' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Alignment settings')).toBeVisible()
  })

  it('moves between tabs with the arrow keys', async () => {
    const { user } = setup(<PropertiesTabs />)
    await user.tab()
    expect(screen.getByRole('tab', { name: 'Design' })).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Arrange' })).toHaveFocus()
  })
})
