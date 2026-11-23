import { screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { setup } from '../../test/render'
import { Dialog, DialogClose, type DialogPlacement } from './Dialog'

function ExportDialog({ onExport = vi.fn(), placement }: { onExport?: () => void; placement?: DialogPlacement }) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog
      title="Export figure"
      description="Exports the whole page."
      placement={placement}
      trigger={<button type="button">Open export</button>}
      open={open}
      onOpenChange={setOpen}
      actions={
        <>
          <DialogClose>Cancel</DialogClose>
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              onExport()
            }}
          >
            Export
          </button>
        </>
      }
    >
      <label>
        File name <input defaultValue="figure" />
      </label>
    </Dialog>
  )
}

describe('Dialog', () => {
  it('opens as a dialog named by its title and described by its description', async () => {
    const { user } = setup(<ExportDialog />)
    await user.click(screen.getByRole('button', { name: 'Open export' }))
    const dialog = await screen.findByRole('dialog', { name: 'Export figure' })
    expect(dialog).toHaveAccessibleDescription('Exports the whole page.')
  })

  it('closes straight away when the main action starts its task', async () => {
    const onExport = vi.fn()
    const { user } = setup(<ExportDialog onExport={onExport} />)
    await user.click(screen.getByRole('button', { name: 'Open export' }))
    await user.click(await screen.findByRole('button', { name: 'Export' }))
    expect(onExport).toHaveBeenCalledOnce()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('closes with Cancel, the close button or Escape', async () => {
    const { user } = setup(<ExportDialog placement="side" />)
    const closers = [
      () => user.click(screen.getByRole('button', { name: 'Cancel' })),
      () => user.click(screen.getByRole('button', { name: 'Close' })),
      () => user.keyboard('{Escape}'),
    ]
    for (const close of closers) {
      await user.click(screen.getByRole('button', { name: 'Open export' }))
      await screen.findByRole('dialog')
      await close()
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    }
  })

  it('keeps keyboard focus inside while open', async () => {
    const { user } = setup(<ExportDialog />)
    await user.click(screen.getByRole('button', { name: 'Open export' }))
    const dialog = await screen.findByRole('dialog')
    for (let i = 0; i < 6; i++) {
      await user.tab()
      // Tabbing off the end lands on an invisible guard that hands focus back in.
      await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement))
    }
  })
})
