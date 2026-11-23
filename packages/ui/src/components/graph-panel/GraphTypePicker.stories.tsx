import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'

import type { ChartKind } from '../../lib/graph-kinds'
import { GraphTypePicker } from './GraphTypePicker'

const meta = { title: 'Components/Graph type picker', parameters: { layout: 'fullscreen' } } satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/** Three common graphs and a More tile; More opens all of them with family tabs and a search field. */
export const Picker: Story = {
  render: function Render() {
    const [value, setValue] = useState<ChartKind>('bar')
    return (
      <div className="min-h-screen bg-canvas p-6">
        <div className="w-[360px] rounded-lg bg-panel p-3">
          <GraphTypePicker value={value} onChange={setValue} />
        </div>
      </div>
    )
  },
}
