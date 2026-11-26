import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'

import { Example, Examples } from '../../stories/Examples'
import { ChoicePills } from './ChoicePills'

const meta = {
  title: 'Components/Choice pills',
  component: ChoicePills,
  args: { label: "What's wrong?", options: [] },
} satisfies Meta<typeof ChoicePills>

export default meta
type Story = StoryObj<typeof meta>

const reasons = [
  { value: 'science', label: 'Scientifically inaccurate' },
  { value: 'broken', label: 'Looks wrong / broken' },
  { value: 'name', label: 'Wrong name or search words' },
  { value: 'other', label: 'Something else' },
]

function Picker() {
  const [picked, setPicked] = useState<string[]>(['science'])
  return (
    <div className="flex flex-col gap-2">
      <ChoicePills label="What's wrong?" hint="pick any" options={reasons} value={picked} onValueChange={setPicked} />
      <span className="text-xs text-muted-foreground">Picked: {picked.length ? picked.join(', ') : 'nothing'}</span>
    </div>
  )
}

/** Pick any number of pills; click again to take one back. */
export const Examples_: Story = {
  name: 'Examples',
  parameters: { controls: { disable: true } },
  render: () => (
    <Examples>
      <Example title="Reasons for an icon report">
        <Picker />
      </Example>
      <Example title="Nothing picked yet">
        <ChoicePills label="Topics" options={reasons} />
      </Example>
    </Examples>
  ),
}
