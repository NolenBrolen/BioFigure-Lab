import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ExpandedControls } from '../../lib/expanded-controls'
import { setup } from '../../test/render'
import { ChartDataEditor, type ChartDataEditorProps, type DataLine } from './ChartDataEditor'

const line = (): DataLine => ({
  barsTitle: 'Fold change',
  title: 'Viability',
  values: [[96, 94], [80, 84]],
  onValue: vi.fn(),
  onPaste: vi.fn(),
  onAddRow: vi.fn(),
})

const props = (patch: Partial<ChartDataEditorProps> = {}): ChartDataEditorProps => ({
  groups: [
    { name: 'Control', values: [1, 1.2] },
    { name: 'Drug A', values: [2.1, 2.5] },
  ],
  colours: ['#0072B2', '#E69F00'],
  view: 'table',
  onViewChange: vi.fn(),
  onValue: vi.fn(),
  onRename: vi.fn(),
  onPaste: vi.fn(),
  onAddGroup: vi.fn(),
  onRemoveGroup: vi.fn(),
  onMoveGroup: vi.fn(),
  onAddRow: vi.fn(),
  ...patch,
})

describe('ChartDataEditor for bar + line charts', () => {
  it('shows the line’s values in their own table, where typing changes the line and not the bars', async () => {
    const data = line()
    const onValue = vi.fn()
    const { user } = setup(<ChartDataEditor {...props({ line: data, onValue })} />)
    expect(screen.getByRole('table', { name: 'Line values' })).toBeInTheDocument()
    const cell = screen.getByRole('textbox', { name: 'Line, Drug A, row 2' })
    expect(cell).toHaveValue('84')
    await user.clear(cell)
    await user.type(cell, '70')
    expect(data.onValue).toHaveBeenLastCalledWith(1, 1, '70')
    expect(onValue).not.toHaveBeenCalled()
  })

  it('switches a phone’s group columns between the bars’ and the line’s values', async () => {
    const data = line()
    const { user } = setup(
      <ExpandedControls.Provider value>
        <ChartDataEditor {...props({ line: data, view: 'groups' })} />
      </ExpandedControls.Provider>,
    )
    expect(screen.getByRole('textbox', { name: 'Control, value 1' })).toHaveValue('1')
    await user.click(screen.getByRole('tab', { name: 'Line' }))
    expect(screen.getByRole('textbox', { name: 'Control, value 1' })).toHaveValue('96')
    await user.click(screen.getByRole('button', { name: 'Row' }))
    expect(data.onAddRow).toHaveBeenCalledOnce()
  })
})
