import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'

import { ChartDataSection, type DataGroup, type DataSetItem } from './ChartDataSection'

const meta = {
  title: 'Components/Chart data section',
  component: ChartDataSection,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="flex h-[40rem] w-[22.5rem] flex-col overflow-hidden rounded-lg border bg-panel shadow-(--elevation-sm)">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ChartDataSection>

export default meta
type Story = StoryObj<typeof meta>

const COLOURS = ['#0072B2', '#E69F00', '#009E73', '#CC79A7', '#56B4E9', '#D55E00', '#F0E442', '#000000']

const THREE: DataGroup[] = [
  { name: 'Control', values: [4.1, 3.9, 4.4, 4.0] },
  { name: 'Drug A', values: [6.8, 7.2, 6.5, 6.9] },
  { name: 'Drug B', values: [5.2, 4.8, 5.5, 5.1] },
]

const EIGHT: DataGroup[] = ['Control', '1 µM', '5 µM', '10 µM', '25 µM', '50 µM', '100 µM', 'Vehicle'].map((name, g) => ({
  name,
  values: Array.from({ length: 12 }, (_, r) => 3 + g * 0.7 + ((r * 7 + g * 3) % 10) / 10),
}))

const day = 86_400_000
const NOW = Date.UTC(2026, 10, 20)

const set = (id: string, name: string, daysAgo: number, groups: DataGroup[]): DataSetItem => ({ id, name, updatedAt: NOW - daysAgo * day, groups })

const DATASETS: DataSetItem[] = [
  set('d1', 'plate-reader-2026-11-12.csv', 8, THREE),
  set('d2', 'ELISA IL-6 standards.xlsx', 10, [
    { name: '0', values: [0.12, 0.14, 0.11] },
    { name: '10', values: [0.31, 0.29, 0.33] },
    { name: '100', values: [0.58, 0.61, 0.57] },
  ]),
  set('d3', 'Western blot densitometry.csv', 13, [
    { name: 'WT', values: [0.9, 0.85, 0.95] },
    { name: 'KO', values: [0.55, 0.5, 0.6] },
    { name: 'Rescue', values: [0.3, 0.35, 0.25] },
  ]),
  set('d4', 'Pasted 18 Nov 14:02', 2, EIGHT.slice(0, 4)),
  set('d5', 'Flow cytometry CD8 percent.csv', 30, EIGHT.slice(0, 5)),
]

const handlers = {
  onEditData: () => undefined,
  onImportFile: () => undefined,
  onPaste: () => undefined,
  onUseDataset: () => undefined,
  onRename: () => undefined,
  onDuplicate: () => undefined,
  onDelete: () => undefined,
  onCancelImport: () => undefined,
}

/** A section that really deletes, renames and duplicates, to try the list. */
function Working(props: { groups: DataGroup[]; source?: { id: string; name: string; importedAt: number } }) {
  const [items, setItems] = useState(DATASETS)
  return (
    <ChartDataSection
      {...handlers}
      {...props}
      colours={COLOURS}
      datasets={items}
      onDelete={(id) => setItems((all) => all.filter((d) => d.id !== id))}
      onRename={(id, name) => setItems((all) => all.map((d) => (d.id === id ? { ...d, name } : d)))}
      onDuplicate={(id) =>
        setItems((all) => {
          const original = all.find((d) => d.id === id)
          return original ? [{ ...original, id: `${id}-copy`, name: `${original.name} copy` }, ...all] : all
        })
      }
    />
  )
}

export const NoSource: Story = {
  name: 'Typed data, no source',
  render: () => <Working groups={THREE} />,
  args: { ...handlers, groups: THREE, colours: COLOURS, datasets: DATASETS },
}

export const ThreeGroups: Story = {
  render: () => <Working groups={THREE} source={{ id: 'd1', name: 'plate-reader-2026-11-12.csv', importedAt: NOW - 8 * day }} />,
  args: { ...handlers, groups: THREE, colours: COLOURS, datasets: DATASETS },
}

export const EightGroups: Story = {
  name: 'Eight groups',
  render: () => <Working groups={EIGHT} source={{ id: 'd5', name: 'Flow cytometry CD8 percent.csv', importedAt: NOW - 30 * day }} />,
  args: { ...handlers, groups: EIGHT, colours: COLOURS, datasets: DATASETS },
}

export const Empty: Story = {
  args: { ...handlers, groups: THREE, colours: COLOURS, datasets: [] },
}

export const Loading: Story = {
  args: { ...handlers, groups: THREE, colours: COLOURS, datasets: undefined },
}

export const Importing: Story = {
  args: { ...handlers, groups: THREE, colours: COLOURS, datasets: DATASETS, importing: { name: 'Flow cytometry export all wells.csv', fraction: 0.68, size: '41 MB' } },
}
