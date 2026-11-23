import { fireEvent, screen } from '@testing-library/react'
import { CopyPlus, Lock, Trash2 } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'

import { setup } from '../../test/render'
import { QuickActions, type QuickActionGroup } from './QuickActions'

function groups({ onDuplicate = vi.fn(), onDelete = vi.fn(), onFill = vi.fn() } = {}): QuickActionGroup[] {
  return [
    { id: 'colour', actions: [{ id: 'fill', label: 'Fill', swatch: 'fill', colour: '#93c5fd', onColour: onFill }] },
    {
      id: 'edit',
      actions: [
        { id: 'duplicate', label: 'Duplicate', icon: CopyPlus, shortcut: 'Mod+D', onClick: onDuplicate },
        { id: 'lock', label: 'Lock', icon: Lock, pressed: true, onClick: vi.fn() },
        { id: 'delete', label: 'Delete', icon: Trash2, danger: true, disabled: true, onClick: onDelete },
      ],
    },
  ]
}

describe('QuickActions', () => {
  it('names every button for screen readers and shows switched-on ones as pressed', () => {
    setup(<QuickActions label="Rectangle actions" groups={groups()} />)
    expect(screen.getByRole('toolbar', { name: 'Rectangle actions' })).toBeInTheDocument()
    expect(screen.getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual(['Fill', 'Duplicate', 'Lock', 'Delete'])
    expect(screen.getByRole('button', { name: 'Lock' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('runs an action with its button, but not one that is unavailable', async () => {
    const onDuplicate = vi.fn()
    const onDelete = vi.fn()
    const { user } = setup(<QuickActions label="Actions" groups={groups({ onDuplicate, onDelete })} />)
    await user.click(screen.getByRole('button', { name: 'Duplicate' }))
    expect(onDuplicate).toHaveBeenCalledWith(screen.getByRole('button', { name: 'Duplicate' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('shows the name and shortcut as a tooltip', async () => {
    const { user } = setup(<QuickActions label="Actions" groups={groups()} />)
    await user.hover(screen.getByRole('button', { name: 'Duplicate' }))
    expect(await screen.findByText('Ctrl+D')).toBeInTheDocument()
  })

  it('puts the names under the icons when asked', () => {
    setup(<QuickActions label="Actions" groups={groups()} showLabels />)
    expect(screen.getByRole('button', { name: 'Duplicate' })).toHaveTextContent('Duplicate')
  })

  it('moves between buttons with the arrow keys', async () => {
    const { user } = setup(<QuickActions label="Actions" groups={groups()} />)
    await user.tab()
    expect(screen.getByRole('button', { name: 'Fill' })).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('button', { name: 'Duplicate' })).toHaveFocus()
  })

  it('passes a picked colour on', () => {
    const onFill = vi.fn()
    const { container } = setup(<QuickActions label="Actions" groups={groups({ onFill })} />)
    const picker = container.querySelector('input[type="color"]')
    if (!picker) throw new Error('no colour picker')
    fireEvent.change(picker, { target: { value: '#ff0000' } })
    expect(onFill).toHaveBeenCalledWith('#ff0000')
  })
})
