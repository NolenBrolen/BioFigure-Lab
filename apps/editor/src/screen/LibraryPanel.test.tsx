import { TooltipProvider } from '@biofigure-lab/ui/components/tooltip/Tooltip'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { LibraryIcon } from '../editor/icon-library'
import { LibraryPanel } from './LibraryPanel'

// Pictures are fetched one by one in the real panel; the tests only need the names.
vi.mock('./useIconSvg', () => ({ useIconSvg: () => undefined }))

const icons: LibraryIcon[] = [
  { id: 'cells/test', name: 'Cell sample', category: 'cells', keywords: ['shared'] },
  { id: 'animals/test', name: 'Mouse sample', category: 'animals', keywords: ['shared'] },
]

function setup(onAdd = vi.fn()) {
  const user = userEvent.setup()
  render(
    <TooltipProvider delay={0}>
      <LibraryPanel icons={icons} onAdd={onAdd} />
    </TooltipProvider>,
  )
  return { user, onAdd, search: () => screen.getByRole('searchbox', { name: 'Search icons' }) }
}

describe('icon collections (BIO-92)', () => {
  it('starts on the list of collections, without any icons', () => {
    setup()
    expect(screen.getByRole('button', { name: 'Cells' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Animals' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Cell sample/ })).toBeNull()
  })

  it('opens a collection, adds an icon from it, and goes back to the list', async () => {
    const { user, onAdd } = setup()
    await user.click(screen.getByRole('button', { name: 'Animals' }))
    expect(screen.queryByRole('button', { name: /Cell sample/ })).toBeNull()
    await user.click(screen.getByRole('button', { name: /Mouse sample/ }))
    expect(onAdd).toHaveBeenCalledWith(icons[1])
    await user.click(screen.getByRole('button', { name: 'Back to collections' }))
    expect(screen.getByRole('button', { name: 'Cells' })).toBeInTheDocument()
  })

  it('searches every collection from the list, and the list returns when the search is cleared', async () => {
    const { user, search } = setup()
    await user.type(search(), 'shared')
    expect(screen.getByRole('button', { name: /Cell sample/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Mouse sample/ })).toBeInTheDocument()
    await user.clear(search())
    expect(screen.getByRole('button', { name: 'Cells' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Cell sample/ })).toBeNull()
  })

  it('searches only inside an open collection, and going back clears the search', async () => {
    const { user, search } = setup()
    await user.click(screen.getByRole('button', { name: 'Cells' }))
    await user.type(search(), 'mouse')
    expect(screen.queryByRole('button', { name: /Mouse sample/ })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Back to collections' }))
    expect(search()).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Animals' })).toBeInTheDocument()
  })
})
