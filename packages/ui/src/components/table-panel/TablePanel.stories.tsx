import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'

import { Example, Examples } from '../../stories/Examples'
import { TablePanel, type TableLayout, type TableLook } from './TablePanel'

const meta = {
  title: 'Components/Table panel',
  parameters: { controls: { disable: true } },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

function Panel({ start }: { start?: { rows: number; cols: number } }) {
  const [layout, setLayout] = useState<TableLayout>('header')
  const [look, setLook] = useState<TableLook>('classic')
  const [picked, setPicked] = useState(start)
  return <TablePanel className="w-64 rounded-lg border bg-panel p-3" layout={layout} look={look} onLayoutChange={setLayout} onLookChange={setLook} picked={picked} onPickSize={setPicked} />
}

/** The panel as it sits in the left panel: nothing picked yet, and with a 4 × 3 table ready to place. */
export const Examples_: Story = {
  name: 'Examples',
  render: () => (
    <Examples>
      <Example title="Nothing picked">
        <Panel />
      </Example>
      <Example title="4 × 3 picked">
        <Panel start={{ rows: 4, cols: 3 }} />
      </Example>
    </Examples>
  ),
}
