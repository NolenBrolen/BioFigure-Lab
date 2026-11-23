import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { setup } from '../../test/render'
import { TablePanel, type TablePanelProps } from './TablePanel'

const panel = (props: Partial<TablePanelProps> = {}) => (
  <TablePanel layout="header" look="classic" onLayoutChange={vi.fn()} onLookChange={vi.fn()} onPickSize={vi.fn()} {...props} />
)

describe('TablePanel', () => {
  it('names the picture-only layout tiles and shows which are picked', () => {
    setup(panel({ look: 'journal' }))
    expect(screen.getByRole('radiogroup', { name: 'Layout' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Header row' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Journal' })).toBeChecked()
  })

  it('changes the layout and look with clicks and arrow keys', async () => {
    const onLayoutChange = vi.fn()
    const onLookChange = vi.fn()
    const { user } = setup(panel({ onLayoutChange, onLookChange }))
    await user.click(screen.getByRole('radio', { name: 'Striped' }))
    expect(onLayoutChange).toHaveBeenLastCalledWith('striped')
    screen.getByRole('radio', { name: 'Classic' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(onLookChange).toHaveBeenLastCalledWith('soft')
  })

  it('picks a size with the keyboard', async () => {
    const onPickSize = vi.fn()
    const { user } = setup(panel({ onPickSize }))
    screen.getByRole('grid').focus()
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowRight}{Enter}')
    expect(onPickSize).toHaveBeenCalledWith({ rows: 3, cols: 2 })
    expect(screen.getByRole('grid')).toHaveAccessibleName(/3 rows by 2 columns/)
  })
})
