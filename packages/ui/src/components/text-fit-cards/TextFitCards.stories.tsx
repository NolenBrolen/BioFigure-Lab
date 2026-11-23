import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'

import { TextFitCards, type TextFit } from './TextFitCards'

const meta = {
  title: 'Components/Text fit cards',
  component: TextFitCards,
  args: { value: 'grow', onValueChange: () => undefined },
} satisfies Meta<typeof TextFitCards>

export default meta
type Story = StoryObj<typeof meta>

/** As in the properties panel when a shape is selected. */
export const InThePanel: Story = {
  render: function Render() {
    const [fit, setFit] = useState<TextFit>('grow')
    return (
      <div className="w-64 rounded-md border bg-panel px-3 pt-2 pb-3">
        <h3 className="section-label flex h-7 items-center">Text in shape</h3>
        <TextFitCards value={fit} onValueChange={setFit} />
      </div>
    )
  },
}
