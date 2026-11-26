import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'

import { Button } from '../button/Button'
import { ImportPreview, type ImportOrientation, type ImportTools } from './ImportPreview'

const meta = { title: 'Components/Import preview', component: ImportPreview } satisfies Meta<typeof ImportPreview>

export default meta

const isNumber = (cell: string) => cell.trim() !== '' && Number.isFinite(Number(cell.replace(',', '.')))

const tools: ImportTools = {
  orient: (rows, orientation: ImportOrientation) => {
    const width = Math.max(0, ...rows.map((r) => r.length))
    const even = rows.map((r) => Array.from({ length: width }, (_, i) => r[i] ?? ''))
    return orientation === 'columns' ? even : Array.from({ length: width }, (_, c) => even.map((r) => r[c] ?? ''))
  },
  looksLikeHeader: (rows, orientation) => {
    const lines = tools.orient(rows, orientation)
    return lines[0]?.some((c) => c !== '' && !isNumber(c)) ?? false
  },
  textColumns: (rows, orientation, header) => {
    const lines = tools.orient(rows, orientation).slice(header ? 1 : 0)
    return Array.from({ length: lines[0]?.length ?? 0 }, (_, c) => !lines.some((r) => isNumber(r[c] ?? '')))
  },
}

const SHEET_ROWS = [
  ['Control', 'Drug A', 'Drug B', 'Notes'],
  ['4.12', '6.81', '5.24', 'plate 1'],
  ['3.94', '7.20', '4.83', ''],
  ['4.41', '6.52', '5.51', ''],
  ['4.03', '6.94', '5.10', 'edge well'],
  ['4.27', '7.05', '5.36', ''],
  ['3.88', '6.60', '4.97', ''],
  ['4.19', '6.77', '5.22', ''],
  ['4.35', '7.11', '5.40', ''],
  ['4.08', '6.90', '5.15', ''],
  ['4.30', '7.00', '5.30', ''],
  ['4.22', '6.85', '5.20', ''],
  ['4.15', '6.95', '5.25', ''],
]

export const Default: StoryObj = {
  name: 'Several sheets',
  parameters: { layout: 'fullscreen' },
  render: function Render() {
    const [open, setOpen] = useState(true)
    return (
      <div className="min-h-screen bg-canvas p-6">
        <Button onClick={() => setOpen(true)}>Open import preview</Button>
        {open && (
          <ImportPreview
            open
            fileName="ELISA IL-6 standards.xlsx"
            sheets={[
              { name: 'Plate 1', rows: SHEET_ROWS },
              { name: 'Plate 2', rows: SHEET_ROWS },
              { name: 'Summary', rows: SHEET_ROWS.slice(0, 4) },
            ]}
            tools={tools}
            onUse={() => setOpen(false)}
            onCancel={() => setOpen(false)}
          />
        )}
      </div>
    )
  },
}

export const OneSheet: StoryObj = {
  name: 'One sheet',
  parameters: { layout: 'fullscreen' },
  render: () => (
    <ImportPreview open fileName="plate-reader-2026-11-12.csv" sheets={[{ name: 'plate-reader-2026-11-12.csv', rows: SHEET_ROWS }]} tools={tools} onUse={() => undefined} onCancel={() => undefined} />
  ),
}
