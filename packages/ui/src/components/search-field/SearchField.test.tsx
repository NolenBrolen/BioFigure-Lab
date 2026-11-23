import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { setup } from '../../test/render'
import { SearchField } from './SearchField'

describe('SearchField', () => {
  it('reports what is typed and offers to clear it', async () => {
    const onValueChange = vi.fn()
    const { user } = setup(<SearchField placeholder="Search icons" onValueChange={onValueChange} />)
    const input = screen.getByRole('searchbox', { name: 'Search' })
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument()

    await user.type(input, 'cell')
    expect(onValueChange).toHaveBeenLastCalledWith('cell')

    await user.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(input).toHaveValue('')
    expect(input).toHaveFocus()
  })

  it('clears with Escape, without closing the panel it sits in', async () => {
    const onPanelKey = vi.fn()
    const { user } = setup(
      <div
        onKeyDown={(event) => {
          onPanelKey(event.key)
        }}
      >
        <SearchField defaultValue="cell" />
      </div>,
    )
    await user.click(screen.getByRole('searchbox'))
    await user.keyboard('{Escape}')
    expect(screen.getByRole('searchbox')).toHaveValue('')
    expect(onPanelKey).not.toHaveBeenCalledWith('Escape')

    // Once empty, Escape goes through as usual.
    await user.keyboard('{Escape}')
    expect(onPanelKey).toHaveBeenCalledWith('Escape')
  })

  it('has its filter button directly after the field, with the number of filters on', async () => {
    const onFilterClick = vi.fn()
    const { user } = setup(<SearchField filterCount={2} onFilterClick={onFilterClick} />)
    const input = screen.getByRole('searchbox')
    const filter = screen.getByRole('button', { name: 'Filter, 2 on' })
    expect(input.compareDocumentPosition(filter) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    await user.click(filter)
    expect(onFilterClick).toHaveBeenCalledOnce()
  })

  it('leaves out the filter button when there is nothing to filter', () => {
    setup(<SearchField />)
    expect(screen.queryByRole('button', { name: /filter/i })).not.toBeInTheDocument()
  })
})
