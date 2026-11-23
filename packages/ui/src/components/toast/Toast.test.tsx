import { act, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { setup } from '../../test/render'
import { ToastProvider, ToastViewport, useToast } from './Toast'

let toasts: ReturnType<typeof useToast>

/** Hands the test the toast manager, the way a feature would use it. */
function Capture() {
  toasts = useToast()
  return null
}

function renderToasts() {
  return setup(
    <ToastProvider>
      <Capture />
      <ToastViewport />
    </ToastProvider>,
  )
}

describe('Toast', () => {
  it('shows a message with its details', async () => {
    renderToasts()
    act(() => {
      toasts.add({ title: 'Deleted', description: '2 objects' })
    })
    expect(await screen.findByText('Deleted')).toBeInTheDocument()
    expect(screen.getByText('2 objects')).toBeInTheDocument()
  })

  it('runs its action, like Undo', async () => {
    const onUndo = vi.fn()
    const { user } = renderToasts()
    act(() => {
      toasts.add({ title: 'Deleted', actionProps: { children: 'Undo', onClick: onUndo } })
    })
    await user.click(await screen.findByRole('button', { name: 'Undo' }))
    expect(onUndo).toHaveBeenCalledOnce()
  })

  it('closes with its close button', async () => {
    const { user } = renderToasts()
    act(() => {
      toasts.add({ title: 'Deleted' })
    })
    // Base UI hides the × from screen readers until the toast is hovered or focused.
    await user.hover(await screen.findByText('Deleted'))
    await user.click(await screen.findByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByText('Deleted')).not.toBeInTheDocument())
  })

  it('shows progress and updates it', async () => {
    renderToasts()
    let id = ''
    act(() => {
      id = toasts.add({ title: 'Exporting', timeout: 0, data: { progress: 0.2 } })
    })
    expect(await screen.findByRole('progressbar')).toHaveAttribute('aria-valuenow', '20')
    act(() => {
      toasts.update(id, { data: { progress: 0.6 } })
    })
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '60')
  })

  it('shows no progress line on a plain message', async () => {
    renderToasts()
    act(() => {
      toasts.add({ title: 'Saved' })
    })
    await screen.findByText('Saved')
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })
})
