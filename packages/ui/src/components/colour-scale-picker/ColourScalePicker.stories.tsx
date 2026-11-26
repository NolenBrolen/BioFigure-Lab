import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'

import type { ColourScaleId } from '../../lib/colour-scales'
import { ColourScalePicker } from './ColourScalePicker'

const meta = { title: 'Components/Colour scale picker', parameters: { layout: 'fullscreen' } } satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/** Every scale as a row with its strip, under Sequential and Two-sided; the picked one tinted blue. */
export const Picker: Story = {
  render: function Render() {
    const [value, setValue] = useState<ColourScaleId>('blue-red')
    return (
      <div className="min-h-screen bg-canvas p-6">
        <div className="w-[360px] rounded-lg bg-panel p-4">
          <ColourScalePicker value={value} onChange={setValue} />
        </div>
      </div>
    )
  },
}
