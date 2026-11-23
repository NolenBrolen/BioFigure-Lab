import type { Meta, StoryObj } from '@storybook/react-vite'
import { RotateCw } from 'lucide-react'

import { Example, Examples } from '../../stories/Examples'
import { TextField } from './TextField'

const meta = {
  title: 'Components/Text field',
  component: TextField,
  args: { label: 'Figure name', defaultValue: 'Phagocytosis sequence', description: 'Shown in your list of figures' },
  argTypes: {
    prefix: { table: { disable: true } },
    suffix: { table: { disable: true } },
  },
} satisfies Meta<typeof TextField>

export default meta
type Story = StoryObj<typeof meta>

/** Text fields in the places the editor uses them. Click into one to see focus. */
export const Examples_: Story = {
  name: 'Examples',
  parameters: { controls: { disable: true } },
  render: () => (
    <Examples>
      <Example title="Properties panel">
        <div className="grid w-60 grid-cols-2 gap-2">
          <TextField label="X position" hideLabel prefix="X" suffix="mm" defaultValue="13.9" />
          <TextField label="Y position" hideLabel prefix="Y" suffix="mm" defaultValue="16.5" />
          <TextField label="Width" hideLabel prefix="W" suffix="mm" defaultValue="30.5" />
          <TextField label="Height" hideLabel prefix="H" suffix="mm" defaultValue="30.5" />
          <TextField label="Rotation" hideLabel prefix={<RotateCw />} suffix="°" defaultValue="0" />
        </div>
      </Example>

      <Example title="With a label and help line">
        <TextField label="Figure name" defaultValue="Phagocytosis sequence" description="Shown in your list of figures" />
      </Example>

      <Example title="Page size">
        <div className="grid grid-cols-2 gap-2">
          <TextField label="Width" suffix="mm" defaultValue="174" />
          <TextField label="Height" suffix="mm" defaultValue="70" />
        </div>
      </Example>

      <Example title="With an error">
        <TextField label="Width" suffix="mm" defaultValue="-5" error="Width must be more than 0 mm" />
      </Example>

      <Example title="Not available">
        <TextField label="Figure name" defaultValue="Phagocytosis sequence" disabled />
      </Example>
    </Examples>
  ),
}

/** One text field. Change its settings in the Controls panel below. */
export const Playground: Story = {
  render: (args) => (
    <div className="grid min-h-screen place-items-center bg-canvas">
      <div className="w-64">
        <TextField {...args} />
      </div>
    </div>
  ),
}
