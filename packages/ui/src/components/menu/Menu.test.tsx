import { fireEvent, screen, waitFor } from '@testing-library/react'
import { AlignStartVertical, Copy, Trash2 } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'

import { setup } from '../../test/render'
import { ContextMenu, DropdownMenu } from './Menu'

function renderMenu(onDuplicate = vi.fn(), onDelete = vi.fn()) {
  const result = setup(
    <ContextMenu
      sections={[
        { label: 'Edit', actions: [{ label: 'Duplicate', icon: Copy, shortcut: 'Mod+D', onClick: onDuplicate }, { label: 'Group', disabled: true }] },
        { label: 'Remove', actions: [{ label: 'Delete', icon: Trash2, shortcut: 'Delete', danger: true, onClick: onDelete }] },
      ]}
    >
      <div>Canvas object</div>
    </ContextMenu>,
  )
  fireEvent.contextMenu(screen.getByText('Canvas object'))
  return result
}

describe('ContextMenu', () => {
  it('opens on right-click with every action and its shortcut', async () => {
    renderMenu()
    expect(await screen.findByRole('menu')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Duplicate/ })).toHaveTextContent('Ctrl+D')
    expect(screen.getAllByRole('menuitem')).toHaveLength(3)
  })

  it('runs an action on click and closes', async () => {
    const onDuplicate = vi.fn()
    const { user } = renderMenu(onDuplicate)
    await user.click(await screen.findByRole('menuitem', { name: /Duplicate/ }))
    expect(onDuplicate).toHaveBeenCalledOnce()
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
  })

  it('does not run an action that is not available', async () => {
    renderMenu()
    const group = await screen.findByRole('menuitem', { name: 'Group' })
    expect(group).toHaveAttribute('aria-disabled', 'true')
  })

  it('works from the keyboard', async () => {
    const onDelete = vi.fn()
    const { user } = renderMenu(vi.fn(), onDelete)
    await screen.findByRole('menu')
    // End jumps to the last row.
    await user.keyboard('{End}{Enter}')
    expect(onDelete).toHaveBeenCalledOnce()
  })

  it('opens a submenu beside its row from the keyboard and runs its action', async () => {
    const onFront = vi.fn()
    const { user } = setup(
      <ContextMenu sections={[{ label: 'Arrange', actions: [{ label: 'Arrange', submenu: [{ label: 'Bring to front', onClick: onFront }, { label: 'Send to back' }] }] }]}>
        <div>Canvas object</div>
      </ContextMenu>,
    )
    fireEvent.contextMenu(screen.getByText('Canvas object'))
    const arrange = await screen.findByRole('menuitem', { name: 'Arrange' })
    expect(screen.queryByRole('menuitem', { name: 'Bring to front' })).not.toBeInTheDocument()
    arrange.focus()
    await user.keyboard('{ArrowRight}')
    await user.click(await screen.findByRole('menuitem', { name: 'Bring to front' }))
    expect(onFront).toHaveBeenCalledOnce()
  })

  it('closes with Escape', async () => {
    const { user } = renderMenu()
    await screen.findByRole('menu')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
  })

  it('shows group headings and icon rows that screen readers can still name', async () => {
    const onAlign = vi.fn()
    const { user } = setup(
      <ContextMenu sections={[{ label: 'Align', showLabel: true, layout: 'icons', actions: [{ label: 'Align left', icon: AlignStartVertical, onClick: onAlign }] }]}>
        <div>Canvas object</div>
      </ContextMenu>,
    )
    fireEvent.contextMenu(screen.getByText('Canvas object'))
    expect(await screen.findByRole('group', { name: 'Align' })).toBeInTheDocument()
    await user.click(screen.getByRole('menuitem', { name: 'Align left' }))
    expect(onAlign).toHaveBeenCalledOnce()
  })
})

describe('DropdownMenu', () => {
  it('opens from its button and runs an action', async () => {
    const onDuplicate = vi.fn()
    const { user } = setup(
      <DropdownMenu sections={[{ label: 'Edit', actions: [{ label: 'Duplicate', icon: Copy, onClick: onDuplicate }] }]} trigger={<button type="button">More</button>} />,
    )
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'More' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Duplicate' }))
    expect(onDuplicate).toHaveBeenCalledOnce()
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
  })
})
