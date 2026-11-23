import { screen } from '@testing-library/react'
import { Redo2, Undo2 } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'

import { setup } from '../../test/render'
import { IconButton } from './IconButton'

describe('IconButton', () => {
  it('has its label as its name for screen readers', () => {
    setup(<IconButton icon={Undo2} label="Undo" />)
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument()
  })

  it('shows its label and shortcut as a tooltip when focused with the keyboard', async () => {
    const { user } = setup(<IconButton icon={Undo2} label="Undo" shortcut="Mod+Z" />)
    expect(screen.queryByText('Ctrl+Z')).not.toBeInTheDocument()
    await user.tab()
    expect(await screen.findByText('Ctrl+Z')).toBeInTheDocument()
    expect(screen.getByText('Undo')).toBeInTheDocument()
  })

  it('says whether it is switched on', () => {
    setup(<IconButton icon={Undo2} label="Select" pressed />)
    expect(screen.getByRole('button', { name: 'Select' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('when not available, ignores clicks but can still be focused to read its tooltip', async () => {
    const onClick = vi.fn()
    const { user } = setup(<IconButton icon={Redo2} label="Redo" shortcut="Mod+Shift+Z" disabled onClick={onClick} />)
    const button = screen.getByRole('button', { name: 'Redo' })
    await user.click(button)
    expect(onClick).not.toHaveBeenCalled()
    await user.tab()
    expect(button).toHaveFocus()
    expect(button).toHaveAttribute('aria-disabled', 'true')
  })
})
