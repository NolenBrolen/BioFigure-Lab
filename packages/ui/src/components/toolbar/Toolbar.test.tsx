import { screen } from '@testing-library/react'
import { Redo2, Undo2 } from 'lucide-react'
import { describe, expect, it } from 'vitest'

import { setup } from '../../test/render'
import { Toolbar, ToolbarIconButton, ToolbarSeparator, ToolbarTextButton } from './Toolbar'

function TopBar() {
  return (
    <>
      <Toolbar label="Figure">
        <ToolbarIconButton icon={Undo2} label="Undo" />
        <ToolbarIconButton icon={Redo2} label="Redo" disabled />
        <ToolbarSeparator />
        <ToolbarTextButton variant="primary">Export</ToolbarTextButton>
      </Toolbar>
      <button type="button">After</button>
    </>
  )
}

describe('Toolbar', () => {
  it('moves between its buttons with the arrow keys, including ones not available now', async () => {
    const { user } = setup(<TopBar />)
    expect(screen.getByRole('toolbar', { name: 'Figure' })).toBeInTheDocument()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Undo' })).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('button', { name: 'Redo' })).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('button', { name: 'Export' })).toHaveFocus()
  })

  it('is one stop for Tab, so Tab jumps past the whole toolbar', async () => {
    const { user } = setup(<TopBar />)
    await user.tab()
    await user.tab()
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus()
  })
})
