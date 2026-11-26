import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { setup } from '../../test/render'
import { SyncBanner } from './SyncBanner'
import { SyncStatus } from './SyncStatus'

describe('SyncStatus', () => {
  it('says where the figure is saved', () => {
    setup(<SyncStatus state="waiting" />)
    expect(screen.getByRole('status')).toHaveTextContent('Saved on this device')
  })

  it('keeps the words for screen readers when only the icon shows', () => {
    setup(<SyncStatus state="synced" compact />)
    expect(screen.getByRole('status')).toHaveTextContent('Saved')
    expect(screen.getByRole('status')).toHaveClass('sr-only')
  })

  it('shows the details in a tooltip on hover', async () => {
    const { user } = setup(<SyncStatus state="waiting" />)
    await user.hover(screen.getByRole('button'))
    expect(await screen.findByText(/go to your account when you’re back online/)).toBeInTheDocument()
  })

  it('does nothing on click while syncing', async () => {
    const onRetry = vi.fn()
    const { user } = setup(<SyncStatus state="syncing" onRetry={onRetry} />)
    await user.click(screen.getByRole('button'))
    expect(onRetry).not.toHaveBeenCalled()
  })

  it('tries again on click when syncing failed', async () => {
    const onRetry = vi.fn()
    const { user } = setup(<SyncStatus state="failed" onRetry={onRetry} />)
    await user.click(screen.getByRole('button'))
    expect(onRetry).toHaveBeenCalledOnce()
  })
})

describe('SyncBanner', () => {
  it('counts the figures and stops on Cancel', async () => {
    const onCancel = vi.fn()
    const { user } = setup(<SyncBanner done={2} total={5} onCancel={onCancel} />)
    expect(screen.getByRole('status')).toHaveTextContent('Syncing 3 of 5 figures to your account…')
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledOnce()
  })
})
