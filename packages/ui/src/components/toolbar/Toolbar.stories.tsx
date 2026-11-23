import type { Meta, StoryObj } from '@storybook/react-vite'
import { Redo2, Undo2 } from 'lucide-react'

import { Example, Examples } from '../../stories/Examples'
import { DrawingTools, TopBar } from '../../stories/layout-demos'
import { Toolbar, ToolbarIconButton } from './Toolbar'

const meta = {
  title: 'Components/Toolbar',
  component: Toolbar,
  args: { label: 'History', variant: 'bar', children: null },
  argTypes: {
    variant: { control: 'inline-radio', options: ['bar', 'floating'] },
    children: { table: { disable: true } },
  },
} satisfies Meta<typeof Toolbar>

export default meta
type Story = StoryObj<typeof meta>

/** Toolbars in the places the editor uses them. */
export const Examples_: Story = {
  name: 'Examples',
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="flex min-h-screen flex-col bg-canvas">
      <TopBar />
      <Examples>
        <Example title="Drawing tools">
          <DrawingTools />
        </Example>
      </Examples>
    </div>
  ),
}

/** One toolbar. Change its settings in the Controls panel below. */
export const Playground: Story = {
  render: (args) => (
    <div className="min-h-screen bg-canvas p-6">
      <Toolbar {...args}>
        <ToolbarIconButton icon={Undo2} label="Undo" />
        <ToolbarIconButton icon={Redo2} label="Redo" />
      </Toolbar>
    </div>
  ),
}
