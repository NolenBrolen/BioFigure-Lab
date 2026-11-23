import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { setup } from '../../test/render'
import { LayersPanel, type LayerItem, type LayersPanelProps } from './LayersPanel'

const layer = (id: string, extra: Partial<LayerItem> = {}): LayerItem => ({ id, name: id, kind: 'shape', hidden: false, locked: false, ...extra })
const layers = [layer('Title', { kind: 'text' }), layer('Cell', { kind: 'group', children: [layer('Nucleus', { kind: 'icon' })] }), layer('Background')]

function panel(props: Partial<LayersPanelProps> = {}) {
  const handlers = { onSelect: vi.fn(), onRename: vi.fn(), onMove: vi.fn(), onToggleHidden: vi.fn(), onToggleLocked: vi.fn() }
  const result = setup(<LayersPanel layers={layers} selectedIds={[]} {...handlers} {...props} />)
  return { ...result, ...handlers }
}

describe('LayersPanel', () => {
  it('selects a layer on click, adding with Shift, and marks the selected one', async () => {
    const { user, onSelect } = panel({ selectedIds: ['Title'] })
    expect(screen.getByRole('button', { name: 'Title' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Background' }))
    expect(onSelect).toHaveBeenLastCalledWith('Background', false)
    await user.keyboard('{Shift>}')
    await user.click(screen.getByRole('button', { name: 'Title' }))
    expect(onSelect).toHaveBeenLastCalledWith('Title', true)
  })

  it('moves the focused layer with Alt+Up/Down, and the arrow keys walk the rows', async () => {
    const { user, onMove } = panel({ selectedIds: ['Cell'] })
    await user.click(screen.getByRole('button', { name: 'Cell' }))
    await user.keyboard('{Alt>}{ArrowDown}{/Alt}')
    expect(onMove).toHaveBeenLastCalledWith('Cell', 2)
    await user.keyboard('{Alt>}{ArrowUp}{/Alt}')
    expect(onMove).toHaveBeenLastCalledWith('Cell', 0)
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('button', { name: 'Background' })).toHaveFocus()
  })

  it('does not move past the top with the up button', async () => {
    const { user, onMove } = panel({ selectedIds: ['Title'] })
    await user.click(screen.getByRole('button', { name: 'Move layer up' }))
    expect(onMove).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Move layer down' }))
    expect(onMove).toHaveBeenCalledWith('Title', 1)
  })

  it('opens a group with the right arrow key to show its objects', async () => {
    const { user } = panel({ selectedIds: ['Cell'] })
    expect(screen.queryByRole('button', { name: 'Nucleus' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cell' }))
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('button', { name: 'Nucleus' })).toBeInTheDocument()
  })

  it('renames with F2 and Enter, and Escape keeps the old name', async () => {
    const { user, onRename } = panel({ selectedIds: ['Title'] })
    await user.click(screen.getByRole('button', { name: 'Title' }))
    await user.keyboard('{F2}Heading{Enter}')
    expect(onRename).toHaveBeenCalledExactlyOnceWith('Title', 'Heading')
    await user.dblClick(screen.getByRole('button', { name: 'Background' }))
    await user.keyboard('x{Escape}')
    expect(onRename).toHaveBeenCalledOnce()
  })

  it('hides and locks from the row buttons', async () => {
    const { user, onToggleHidden, onToggleLocked } = panel()
    await user.click(screen.getByRole('button', { name: 'Hide Title' }))
    await user.click(screen.getByRole('button', { name: 'Lock Background' }))
    expect(onToggleHidden).toHaveBeenCalledWith('Title')
    expect(onToggleLocked).toHaveBeenCalledWith('Background')
  })

  it('folds shut from its header', async () => {
    const onCollapsedChange = vi.fn()
    const { user, rerender } = panel({ onCollapsedChange })
    const header = screen.getByRole('button', { name: 'Layers' })
    expect(header).toHaveAttribute('aria-expanded', 'true')
    await user.click(header)
    expect(onCollapsedChange).toHaveBeenCalledWith(true)
    rerender(<LayersPanel layers={layers} selectedIds={[]} onSelect={vi.fn()} onRename={vi.fn()} onMove={vi.fn()} onToggleHidden={vi.fn()} onToggleLocked={vi.fn()} collapsed onCollapsedChange={onCollapsedChange} />)
    expect(screen.queryByRole('button', { name: 'Title' })).not.toBeInTheDocument()
  })
})
