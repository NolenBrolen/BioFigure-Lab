import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { setup } from '../../test/render'
import { TooltipProvider } from '../tooltip/Tooltip'
import { ChartDataSection, type ChartDataSectionProps, type DataGroup } from './ChartDataSection'

const groups = (rows: number): DataGroup[] => [
  { name: 'Control', values: Array.from({ length: rows }, (_, i) => 1 + i) },
  { name: 'Drug', values: Array.from({ length: rows }, (_, i) => 2 + i) },
]

const datasets = [
  { id: 'a', name: 'plate-reader.csv', updatedAt: Date.UTC(2026, 10, 12), groups: groups(4) },
  { id: 'b', name: 'ELISA standards.xlsx', updatedAt: Date.UTC(2026, 10, 10), groups: groups(8) },
]

const section = (props: Partial<ChartDataSectionProps> = {}) => (
  <ChartDataSection
    groups={groups(3)}
    colours={['#0072B2', '#E69F00']}
    datasets={datasets}
    onEditData={vi.fn()}
    onImportFile={vi.fn()}
    onPaste={vi.fn()}
    onUseDataset={vi.fn()}
    onRename={vi.fn()}
    onDuplicate={vi.fn()}
    onDelete={vi.fn()}
    onCancelImport={vi.fn()}
    {...props}
  />
)

describe('ChartDataSection', () => {
  it('lists the saved data sets under Your data, and search narrows them', async () => {
    const { user } = setup(section())
    await user.click(screen.getByRole('tab', { name: 'Your data' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    await user.type(screen.getByRole('searchbox', { name: 'Search your data' }), 'elisa')
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByText('ELISA standards.xlsx')).toBeVisible()
  })

  it('uses a data set when its row is clicked', async () => {
    const onUseDataset = vi.fn()
    const { user } = setup(section({ onUseDataset }))
    await user.click(screen.getByRole('tab', { name: 'Your data' }))
    await user.click(screen.getByRole('button', { name: /^plate-reader\.csv/ }))
    expect(onUseDataset).toHaveBeenCalledWith('a')
  })

  it('deletes from the ⋯ menu at once, without asking', async () => {
    const onDelete = vi.fn()
    const { user } = setup(section({ onDelete }))
    await user.click(screen.getByRole('tab', { name: 'Your data' }))
    await user.click(screen.getByRole('button', { name: 'More for plate-reader.csv' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    expect(onDelete).toHaveBeenCalledWith('a')
  })

  it('renames in place: Enter keeps the new name', async () => {
    const onRename = vi.fn()
    const { user } = setup(section({ onRename }))
    await user.click(screen.getByRole('tab', { name: 'Your data' }))
    await user.click(screen.getByRole('button', { name: 'More for plate-reader.csv' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Rename' }))
    const field = await screen.findByRole('textbox', { name: 'Data set name' })
    await user.clear(field)
    await user.type(field, 'Plate 3{Enter}')
    expect(onRename).toHaveBeenCalledWith('a', 'Plate 3')
  })

  it('opens on Your data and moves between the tabs with the arrow keys', async () => {
    const { user } = setup(section())
    expect(screen.queryByRole('tab', { name: 'This chart' })).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Your data' })).toHaveAttribute('aria-selected', 'true')
    screen.getByRole('tab', { name: 'Your data' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Import' })).toHaveFocus()
  })

  it('shows the source and size in the In this chart strip, or only the size without a source', async () => {
    const onEditData = vi.fn()
    const { user, rerender } = setup(section({ groups: groups(12), onEditData, source: { id: 'a', name: 'plate-reader.csv', importedAt: Date.UTC(2026, 10, 12) } }))
    const strip = screen.getByRole('region', { name: 'In this chart' })
    expect(within(strip).getByText('plate-reader.csv')).toBeVisible()
    expect(within(strip).getByText('2 groups × 12 rows')).toBeVisible()
    expect(within(screen.getByRole('list', { name: 'Your data' })).getByText('In chart')).toBeVisible()
    await user.click(within(strip).getByRole('button', { name: 'Edit data' }))
    expect(onEditData).toHaveBeenCalledOnce()

    rerender(<TooltipProvider delay={0}>{section({ groups: groups(4) })}</TooltipProvider>)
    expect(within(screen.getByRole('region', { name: 'In this chart' })).getAllByText(/groups/)).toHaveLength(1)
    expect(screen.getByText('2 groups × 4 rows')).toBeVisible()
    expect(screen.queryByText(/Typed or pasted/)).not.toBeInTheDocument()
  })

  it('offers Cancel while a big file is read, and a hint when nothing is saved yet', async () => {
    const onCancelImport = vi.fn()
    const { user } = setup(section({ importing: { name: 'big.csv', fraction: 0.4 }, onCancelImport, datasets: [] }))
    await user.click(screen.getByRole('tab', { name: 'Import' }))
    expect(screen.getByText(/Reading… 40%/)).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancelImport).toHaveBeenCalledOnce()
    await user.click(screen.getByRole('tab', { name: 'Your data' }))
    expect(screen.getByText('Your data will be kept here')).toBeVisible()
  })

  it('turns Edit data into Close while the data card is open', async () => {
    const onEditData = vi.fn()
    const onCloseData = vi.fn()
    const { user } = setup(section({ onEditData, onCloseData, dataOpen: true }))
    const strip = screen.getByRole('region', { name: 'In this chart' })
    expect(within(strip).queryByRole('button', { name: 'Edit data' })).not.toBeInTheDocument()
    await user.click(within(strip).getByRole('button', { name: 'Close' }))
    expect(onCloseData).toHaveBeenCalledOnce()
    expect(onEditData).not.toHaveBeenCalled()
  })

  it('opens on Import while there is no saved data, and on Your data once there is', () => {
    const { rerender } = setup(section({ datasets: [] }))
    expect(screen.getByRole('tab', { name: 'Import' })).toHaveAttribute('aria-selected', 'true')
    rerender(<TooltipProvider delay={0}>{section({ datasets })}</TooltipProvider>)
    // Nothing was clicked, so it follows the data.
    expect(screen.getByRole('tab', { name: 'Your data' })).toHaveAttribute('aria-selected', 'true')
  })

  it('keeps the tab the user clicked, even when there is no saved data', async () => {
    const { user } = setup(section({ datasets: [] }))
    await user.click(screen.getByRole('tab', { name: 'Your data' }))
    expect(screen.getByRole('tab', { name: 'Your data' })).toHaveAttribute('aria-selected', 'true')
  })

  it('opens the file picker from a click anywhere in the drop zone, and not from Paste', async () => {
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => undefined)
    try {
      const onPaste = vi.fn()
      const { user } = setup(section({ onPaste }))
      await user.click(screen.getByRole('tab', { name: 'Import' }))
      await user.click(screen.getByText('Drop a file here'))
      expect(click).toHaveBeenCalledTimes(1)
      await user.click(screen.getByRole('button', { name: 'Paste from clipboard' }))
      expect(onPaste).toHaveBeenCalledOnce()
      expect(click).toHaveBeenCalledTimes(1)
      await user.click(screen.getByRole('button', { name: 'Import file…' }))
      expect(click).toHaveBeenCalledTimes(2)
    } finally {
      click.mockRestore()
    }
  })

  it('pastes on Ctrl+V on the Import tab before the editor sees the key, but not after a click elsewhere', async () => {
    const onPaste = vi.fn()
    const editorKey = vi.fn()
    window.addEventListener('keydown', editorKey)
    try {
      const { user } = setup(
        <>
          {section({ onPaste })}
          <button type="button">Canvas</button>
        </>,
      )
      await user.click(screen.getByRole('tab', { name: 'Import' }))
      await user.keyboard('{Control>}v{/Control}')
      expect(onPaste).toHaveBeenCalledOnce()
      expect(editorKey).not.toHaveBeenCalledWith(expect.objectContaining({ key: 'v' }))
      await user.click(screen.getByRole('button', { name: 'Canvas' }))
      await user.keyboard('{Control>}v{/Control}')
      expect(onPaste).toHaveBeenCalledOnce()
    } finally {
      window.removeEventListener('keydown', editorKey)
    }
  })
})
