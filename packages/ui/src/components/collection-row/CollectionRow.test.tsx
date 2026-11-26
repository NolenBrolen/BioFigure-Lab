import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { setup } from '../../test/render'
import { CollectionRow } from './CollectionRow'

describe('CollectionRow', () => {
  it('shows the collection name and selected state', () => {
    setup(<CollectionRow name="Cells" picture={<svg />} selected />)
    expect(screen.getByRole('button', { name: 'Cells', pressed: true })).toBeInTheDocument()
  })
  it('selects a collection with the keyboard', async () => {
    const onClick = vi.fn()
    const { user } = setup(<CollectionRow name="Equipment" picture={<svg />} selected={false} onClick={onClick} />)
    await user.tab()
    await user.keyboard('{Enter}')
    expect(onClick).toHaveBeenCalledOnce()
  })
})
