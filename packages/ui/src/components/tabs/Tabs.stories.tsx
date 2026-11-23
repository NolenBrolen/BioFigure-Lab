import type { Meta, StoryObj } from '@storybook/react-vite'

import { Example, Examples } from '../../stories/Examples'
import { PropertiesTabs } from '../../stories/layout-demos'
import { Tabs } from './Tabs'

const meta = {
  title: 'Components/Tabs',
  component: Tabs,
  args: {
    label: 'Properties',
    tabs: [
      { value: 'design', label: 'Design' },
      { value: 'arrange', label: 'Arrange' },
      { value: 'layers', label: 'Layers', disabled: true },
    ],
    variant: 'underline',
  },
  argTypes: {
    variant: { control: 'inline-radio', options: ['underline', 'segmented'] },
  },
} satisfies Meta<typeof Tabs>

export default meta
type Story = StoryObj<typeof meta>

/** Tabs in the places the editor uses them. */
export const Examples_: Story = {
  name: 'Examples',
  parameters: { controls: { disable: true } },
  render: () => (
    <Examples>
      <Example title="Properties panel (underline)">
        <PropertiesTabs />
      </Example>
      <Example title="Segmented, for tabs that read as one control">
        <PropertiesTabs variant="segmented" />
      </Example>
    </Examples>
  ),
}

/** One set of tabs. Change its settings in the Controls panel below. */
export const Playground: Story = {
  render: (args) => (
    <div className="min-h-screen bg-canvas p-6">
      <div className="w-80 bg-panel">
        <Tabs {...args} />
      </div>
    </div>
  ),
}
