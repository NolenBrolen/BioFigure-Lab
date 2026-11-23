import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { setup } from '../../test/render'
import { ChartDataEditor, type ChartDataEditorProps } from './ChartDataEditor'
import { GraphPanel } from './GraphPanel'

describe('GraphPanel', () => {
  it('picks a chart and error bars with clicks and arrow keys', async () => {
    const onPick = vi.fn()
    const onErrorBarsChange = vi.fn()
    const { user } = setup(<GraphPanel picked="bar" onPick={onPick} errorBars="sd" onErrorBarsChange={onErrorBarsChange} />)
    expect(screen.getByRole('radio', { name: /Bar/ })).toBeChecked()
    await user.click(screen.getByRole('radio', { name: /Scatter/ }))
    expect(onPick).toHaveBeenLastCalledWith('scatter')
    screen.getByRole('radio', { name: 'SD' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(onErrorBarsChange).toHaveBeenLastCalledWith('sem')
  })
})

const editor = (props: Partial<ChartDataEditorProps> = {}) => (
  <ChartDataEditor
    groups={[
      { name: 'Control', values: [1, 2] },
      { name: 'Drug', values: [3, null] },
    ]}
    colours={['#0072B2', '#E69F00']}
    view="table"
    onViewChange={vi.fn()}
    onValue={vi.fn()}
    onRename={vi.fn()}
    onPaste={vi.fn()}
    onAddGroup={vi.fn()}
    onRemoveGroup={vi.fn()}
    onMoveGroup={vi.fn()}
    onAddRow={vi.fn()}
    {...props}
  />
)

describe('ChartDataEditor', () => {
  it('sends typed values and names as they are typed', async () => {
    const onValue = vi.fn()
    const onRename = vi.fn()
    const { user } = setup(editor({ onValue, onRename }))
    const cell = screen.getByRole('textbox', { name: 'Drug, row 2' })
    await user.type(cell, '4.5')
    expect(onValue).toHaveBeenLastCalledWith(1, 1, '4.5')
    expect(cell).toHaveValue('4.5')
    await user.type(screen.getByRole('textbox', { name: 'Group 1 name' }), 's')
    expect(onRename).toHaveBeenLastCalledWith(0, 'Controls')
  })

  it('hands a pasted block from a spreadsheet to the chart, at the cell pasted into', () => {
    const onPaste = vi.fn()
    const onValue = vi.fn()
    setup(editor({ onPaste, onValue }))
    fireEvent.paste(screen.getByRole('textbox', { name: 'Control, row 2' }), { clipboardData: { getData: () => '5\t6\n7\t8' } })
    expect(onPaste).toHaveBeenCalledWith('5\t6\n7\t8', { group: 0, row: 1 })
    expect(onValue).not.toHaveBeenCalled()
  })

  it('switches between the table and the group cards', async () => {
    const onViewChange = vi.fn()
    const { user, rerender } = setup(editor({ onViewChange }))
    await user.click(screen.getByRole('tab', { name: 'Groups' }))
    expect(onViewChange).toHaveBeenCalledWith('groups')
    rerender(editor({ view: 'groups' }))
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Drug, value 1' })).toHaveValue('3')
  })

  it('moves a group with Alt+arrow keys in its name, as dragging its grip does', async () => {
    const onMoveGroup = vi.fn()
    const { user } = setup(editor({ onMoveGroup }))
    await user.click(screen.getByRole('textbox', { name: 'Group 1 name' }))
    await user.keyboard('{Alt>}{ArrowRight}{/Alt}')
    // Lands in the gap after the second group.
    expect(onMoveGroup).toHaveBeenCalledWith(0, 2)
  })

  it('minimises to its header bar and opens again', async () => {
    const onCollapsedChange = vi.fn()
    const { user, rerender } = setup(editor({ onCollapsedChange }))
    await user.click(screen.getByRole('button', { name: 'Minimise the data' }))
    expect(onCollapsedChange).toHaveBeenCalledWith(true)
    rerender(editor({ collapsed: true, onCollapsedChange }))
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show the data' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('Enter moves down a column', async () => {
    const { user } = setup(editor())
    await user.click(screen.getByRole('textbox', { name: 'Control, row 1' }))
    await user.keyboard('{Enter}')
    expect(screen.getByRole('textbox', { name: 'Control, row 2' })).toHaveFocus()
  })
})
