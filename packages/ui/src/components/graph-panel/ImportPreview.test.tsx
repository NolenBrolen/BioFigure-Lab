import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { setup } from '../../test/render'
import { ImportPreview, type ImportTools } from './ImportPreview'

const isNumber = (cell: string) => cell.trim() !== '' && !Number.isNaN(Number(cell))

const tools: ImportTools = {
  orient: (rows, orientation) => (orientation === 'columns' ? rows : (rows[0] ?? []).map((_, c) => rows.map((row) => row[c] ?? ''))),
  looksLikeHeader: (rows, orientation) => {
    const lines = tools.orient(rows, orientation)
    return lines[0]?.some((cell) => cell !== '' && !isNumber(cell)) ?? false
  },
  textColumns: (rows, orientation, header) => {
    const lines = tools.orient(rows, orientation).slice(header ? 1 : 0)
    return (lines[0] ?? []).map((_, c) => !lines.some((row) => isNumber(row[c] ?? '')))
  },
}

const rows = [
  ['Control', 'Drug', 'Notes'],
  ['1', '2', 'a'],
  ['3', '4', ''],
]

const preview = (onUse = vi.fn()) => <ImportPreview open fileName="plate.csv" sheets={[{ name: 'plate.csv', rows }]} tools={tools} onUse={onUse} onCancel={vi.fn()} />

describe('ImportPreview', () => {
  it('starts with the first row read as names and the notes column left out', async () => {
    const onUse = vi.fn()
    const { user } = setup(preview(onUse))
    expect(screen.getByRole('checkbox', { name: 'Use Notes' })).not.toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Import' }))
    expect(onUse).toHaveBeenCalledWith({ sheet: 'plate.csv', header: true, orientation: 'columns', leftOut: [2] })
  })

  it('hands back what was changed: a column unticked, then groups in rows', async () => {
    const onUse = vi.fn()
    const { user } = setup(preview(onUse))
    await user.click(screen.getByRole('checkbox', { name: 'Use Drug' }))
    await user.click(screen.getByRole('button', { name: 'Import' }))
    expect(onUse).toHaveBeenLastCalledWith({ sheet: 'plate.csv', header: true, orientation: 'columns', leftOut: [2, 1] })

    await user.click(screen.getByRole('button', { name: 'Rows' }))
    // Turned on its side, the columns are the old rows: the hand-picked choice (Drug) is gone, and the first column, with no numbers, starts out left out.
    await user.click(screen.getByRole('button', { name: 'Import' }))
    expect(onUse).toHaveBeenLastCalledWith(expect.objectContaining({ orientation: 'rows', leftOut: [0] }))
  })
})
