import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { setup } from '../../test/render'
import { Button } from './Button'

describe('Button', () => {
  it('is a plain button, so it never submits a form by accident', () => {
    setup(<Button>Export</Button>)
    expect(screen.getByRole('button', { name: 'Export' })).toHaveAttribute('type', 'button')
  })

  it('runs its action when clicked', async () => {
    const onClick = vi.fn()
    const { user } = setup(
      <Button variant="primary" onClick={onClick}>
        Export
      </Button>,
    )
    await user.click(screen.getByRole('button', { name: 'Export' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('does nothing when not available', async () => {
    const onClick = vi.fn()
    const { user } = setup(
      <Button disabled onClick={onClick}>
        Export
      </Button>,
    )
    await user.click(screen.getByRole('button', { name: 'Export' }))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('works with the keyboard', async () => {
    const onClick = vi.fn()
    const { user } = setup(<Button onClick={onClick}>Export</Button>)
    await user.tab()
    expect(screen.getByRole('button', { name: 'Export' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(onClick).toHaveBeenCalledOnce()
  })
})
