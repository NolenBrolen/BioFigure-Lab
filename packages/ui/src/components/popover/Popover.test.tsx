import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { setup } from '../../test/render'
import { Popover } from './Popover'

function renderPopover() {
  return setup(
    <Popover title="Filter icons" trigger={<button type="button">Filters</button>}>
      <button type="button">Reset filters</button>
    </Popover>,
  )
}

describe('Popover', () => {
  it('opens from its button as a panel named by its title', async () => {
    const { user } = renderPopover()
    await user.click(screen.getByRole('button', { name: 'Filters' }))
    expect(await screen.findByRole('dialog', { name: 'Filter icons' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reset filters' })).toBeInTheDocument()
  })

  it('stays open while you work in it', async () => {
    const { user } = renderPopover()
    await user.click(screen.getByRole('button', { name: 'Filters' }))
    await user.click(await screen.findByRole('button', { name: 'Reset filters' }))
    expect(screen.getByRole('dialog', { name: 'Filter icons' })).toBeInTheDocument()
  })

  it('closes with the close button', async () => {
    const { user } = renderPopover()
    await user.click(screen.getByRole('button', { name: 'Filters' }))
    await user.click(await screen.findByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('closes with Escape and gives focus back to its button', async () => {
    const { user } = renderPopover()
    const trigger = screen.getByRole('button', { name: 'Filters' })
    await user.click(trigger)
    await screen.findByRole('dialog')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(trigger).toHaveFocus()
  })
})
