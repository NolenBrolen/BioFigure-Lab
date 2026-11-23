import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { setup } from '../../test/render'
import { IconTile } from './IconTile'

describe('IconTile', () => {
  it('uses the icon name in both looks', () => {
    setup(
      <>
        <IconTile name="Virus" picture={<svg />} />
        <IconTile name="Macrophage" picture={<svg />} look="row" />
      </>,
    )
    expect(screen.getByRole('button', { name: 'Virus' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Macrophage' })).toBeInTheDocument()
  })

  it('places the icon when clicked', async () => {
    const onClick = vi.fn()
    const { user } = setup(<IconTile name="Virus" picture={<svg />} onClick={onClick} />)
    await user.click(screen.getByRole('button', { name: /Virus/ }))
    expect(onClick).toHaveBeenCalledOnce()
  })
})
