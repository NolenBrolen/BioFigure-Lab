import type { Meta, StoryObj } from '@storybook/react-vite'
import { ChartColumn, MoveRight, Shell, Table, Type } from 'lucide-react'

import { ShapesToolIcon } from './ShapesToolIcon'

import { ToolRail, type Tool } from './ToolRail'

const tools: Tool[] = [
  {
    id: 'icons',
    label: 'Icons',
    icon: Shell,
    panel: (
      <div className="grid grid-cols-3 gap-2 p-3">
        {Array.from({ length: 9 }, (_, i) => (
          <div key={i} className="aspect-square rounded-md bg-muted" />
        ))}
      </div>
    ),
  },
  { id: 'arrows', label: 'Arrows', icon: MoveRight },
  { id: 'shapes', label: 'Shapes', icon: ShapesToolIcon },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'graph', label: 'Graph', icon: ChartColumn },
  { id: 'table', label: 'Table', icon: Table },
]

const meta = {
  title: 'Components/Tool rail',
  component: ToolRail,
  args: { tools },
  argTypes: { tools: { table: { disable: true } } },
  render: (args) => (
    <div className="flex h-screen bg-canvas text-sm text-foreground">
      <ToolRail {...args} className="w-[calc(var(--rail-width)+var(--panel-left-width)+1px)] border-r" />
    </div>
  ),
} satisfies Meta<typeof ToolRail>

export default meta
type Story = StoryObj<typeof meta>

/** The rail with the left panel next to it, as in the editor. Tools without a panel show a placeholder. */
export const Default: Story = {}
