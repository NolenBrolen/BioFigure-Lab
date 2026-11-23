import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'

import { ErrorBarPicker, type ErrorBars } from './ErrorBarPicker'

const meta = { title: 'Components/Error bar picker', parameters: { layout: 'fullscreen' } } satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/** Three common error bars and a More tile; More opens all of them with family tabs and a search field. */
export const Picker: Story = {
  render: function Render() {
    const [value, setValue] = useState<ErrorBars>('sem')
    return (
      <div className="min-h-screen bg-canvas p-6">
        <div className="w-[360px] rounded-lg bg-panel p-3">
          <ErrorBarPicker value={value} onChange={setValue} />
        </div>
      </div>
    )
  },
}
