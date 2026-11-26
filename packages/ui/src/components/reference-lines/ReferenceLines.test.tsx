import { screen } from '@testing-library/react'
import axe from 'axe-core'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { setup } from '../../test/render'
import { ReferenceLines, type ReferenceLine } from './ReferenceLines'

const START: ReferenceLine[] = [
  { value: 1, style: 'dashed', label: 'No change' },
  { value: 2.5, style: 'solid', label: 'Cut-off' },
]

/** The editor with its own list, as the chart panel holds it; `removed` gets each removal, and Undo puts it back. */
function Editor({ start = START, onLines }: { start?: ReferenceLine[]; onLines?: (lines: ReferenceLine[]) => void }) {
  const [lines, setLines] = useState(start)
  const [removed, setRemoved] = useState<{ index: number; line: ReferenceLine } | null>(null)
  const update = (next: ReferenceLine[]) => {
    setLines(next)
    onLines?.(next)
  }
  return (
    <>
      <ReferenceLines lines={lines} newValue={1} onChange={update} onRemove={(index, line) => setRemoved({ index, line })} />
      {removed && (
        <button type="button" onClick={() => update([...lines.slice(0, removed.index), removed.line, ...lines.slice(removed.index)])}>
          Undo
        </button>
      )}
    </>
  )
}

const last = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls.at(-1)?.[0] as ReferenceLine[]

describe('ReferenceLines', () => {
  it('adds a line and puts the cursor in its value, ready to type', async () => {
    const onLines = vi.fn()
    const { user } = setup(<Editor onLines={onLines} />)
    await user.click(screen.getByRole('button', { name: 'Add line' }))
    expect(last(onLines)).toHaveLength(3)
    expect(last(onLines)[2]).toEqual({ value: 1, style: 'dashed', label: '' })
    expect(screen.getByRole('textbox', { name: 'Line 3: value' })).toHaveFocus()
  })

  it('applies a typed value on Enter, reads a comma as the decimal mark, and puts back one it can’t read', async () => {
    const onLines = vi.fn()
    const { user } = setup(<Editor onLines={onLines} />)
    const field = screen.getByRole('textbox', { name: 'Line 1: value' })
    await user.clear(field)
    await user.type(field, '0,5{Enter}')
    expect(last(onLines)[0]?.value).toBe(0.5)
    await user.clear(field)
    await user.type(field, 'abc')
    await user.tab()
    expect(field).toHaveValue('0.5')
  })

  it('switches a line between solid and dashed, and changes its label as you type', async () => {
    const onLines = vi.fn()
    const { user } = setup(<Editor onLines={onLines} />)
    await user.click(screen.getAllByRole('button', { name: 'Solid line' })[0]!)
    expect(last(onLines)[0]?.style).toBe('solid')
    await user.type(screen.getByRole('textbox', { name: 'Line 2: label' }), '!')
    expect(last(onLines)[1]?.label).toBe('Cut-off!')
  })

  it('removes a line at once, moves focus on, and Undo brings it back in its place', async () => {
    const { user } = setup(<Editor />)
    await user.click(screen.getByRole('button', { name: 'Remove line 1 (at 1)' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    // Focus lands on what is now the first row's remove button, so several lines can be removed in a row.
    expect(screen.getByRole('button', { name: 'Remove line 1 (at 2.5)' })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByRole('textbox', { name: 'Line 1: value' })).toHaveValue('1')
    expect(screen.getByRole('textbox', { name: 'Line 1: label' })).toHaveValue('No change')
  })

  it('works from the keyboard: Add line with Enter, type the value, remove with Space', async () => {
    const onLines = vi.fn()
    const { user } = setup(<Editor start={[]} onLines={onLines} />)
    // With no lines only Add line shows; the At / Line / Label header comes with the first line.
    expect(screen.queryByText('At')).toBeNull()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Add line' })).toHaveFocus()
    await user.keyboard('{Enter}')
    await user.keyboard('3{Enter}')
    expect(last(onLines)).toEqual([{ value: 3, style: 'dashed', label: '' }])
    expect(screen.getByText('At')).toBeInTheDocument()
    screen.getByRole('button', { name: 'Remove line 1 (at 3)' }).focus()
    await user.keyboard(' ')
    expect(last(onLines)).toEqual([])
    expect(screen.getByRole('button', { name: 'Add line' })).toHaveFocus()
  })

  it('has nothing axe objects to, with lines and without', async () => {
    const run = async () => (await axe.run(document.body, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } })).violations.map((v) => v.id)
    const { unmount } = setup(<Editor />)
    expect(await run()).toEqual([])
    unmount()
    setup(<Editor start={[]} />)
    expect(await run()).toEqual([])
  })
})
