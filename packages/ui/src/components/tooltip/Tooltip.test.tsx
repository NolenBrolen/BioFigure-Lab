import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { setup } from '../../test/render'
import { Tooltip } from './Tooltip'

describe('Tooltip', () => {
  it('appears on keyboard focus and shows the shortcut for this computer', async () => {
    const { user } = setup(
      <Tooltip label="Redo" shortcut="Mod+Shift+Z">
        <button type="button" aria-label="Redo" />
      </Tooltip>,
    )
    expect(screen.queryByText('Redo')).not.toBeInTheDocument()
    await user.tab()
    expect(await screen.findByText('Redo')).toBeInTheDocument()
    // jsdom isn't a Mac, so the shortcut uses Ctrl.
    expect(screen.getByText('Ctrl+Shift+Z')).toBeInTheDocument()
  })

  it('goes away when focus moves on', async () => {
    const { user } = setup(
      <>
        <Tooltip label="Undo">
          <button type="button" aria-label="Undo" />
        </Tooltip>
        <button type="button">Next</button>
      </>,
    )
    await user.tab()
    expect(await screen.findByText('Undo')).toBeInTheDocument()
    await user.tab()
    await expect.poll(() => screen.queryByText('Undo')).toBeNull()
  })
})
