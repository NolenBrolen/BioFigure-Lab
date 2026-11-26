import { screen } from '@testing-library/react'
import axe from 'axe-core'
import { describe, expect, it, vi } from 'vitest'

import { setup } from '../../test/render'
import { Banner } from './Banner'

describe('Banner', () => {
  it('says its message as a status, and closes with its own button', async () => {
    const onClose = vi.fn()
    const { user } = setup(<Banner onClose={onClose}>Welcome back.</Banner>)
    expect(screen.getByRole('status')).toHaveTextContent('Welcome back.')
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('has no close button when it cannot be closed, and nothing axe objects to', async () => {
    setup(<Banner>Saved.</Banner>)
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
    const result = await axe.run(document.body, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } })
    expect(result.violations).toEqual([])
  })
})
