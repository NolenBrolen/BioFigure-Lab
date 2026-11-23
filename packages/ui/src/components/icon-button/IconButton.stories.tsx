import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartVertical,
  BringToFront,
  Circle,
  Minus,
  MousePointer2,
  MoveUpRight,
  Redo2,
  SendToBack,
  Square,
  Type,
  Undo2,
} from 'lucide-react'

import { Example, Examples } from '../../stories/Examples'
import { IconButton } from './IconButton'

const meta = {
  title: 'Components/Icon button',
  component: IconButton,
  args: { icon: Undo2, label: 'Undo', shortcut: 'Mod+Z', size: 'md' },
  argTypes: {
    icon: { table: { disable: true } },
    size: { control: 'inline-radio', options: ['sm', 'md'] },
  },
} satisfies Meta<typeof IconButton>

export default meta
type Story = StoryObj<typeof meta>

const tools = [
  { icon: MousePointer2, label: 'Select', shortcut: 'V' },
  { icon: Square, label: 'Rectangle', shortcut: 'R' },
  { icon: Circle, label: 'Ellipse', shortcut: 'O' },
  { icon: Minus, label: 'Line', shortcut: 'L' },
  { icon: MoveUpRight, label: 'Arrow', shortcut: 'A' },
  { icon: Type, label: 'Text', shortcut: 'T' },
]

/** Icon buttons in the places the editor uses them. Hover a button to see its tooltip. */
export const Examples_: Story = {
  name: 'Examples',
  parameters: { controls: { disable: true } },
  render: () => (
    <Examples>
      <Example title="Drawing tools (Select is on)">
        <div className="flex w-fit gap-1 rounded-lg border bg-panel p-1 shadow-md">
          {tools.map((tool, index) => (
            <IconButton key={tool.label} {...tool} pressed={index === 0} />
          ))}
        </div>
      </Example>

      <Example title="Top bar (nothing to redo)">
        <div className="flex gap-1">
          <IconButton icon={Undo2} label="Undo" shortcut="Mod+Z" />
          <IconButton icon={Redo2} label="Redo" shortcut="Mod+Shift+Z" disabled />
        </div>
      </Example>

      <Example title="Properties panel">
        <div className="flex gap-1">
          <IconButton icon={AlignStartVertical} label="Align left" />
          <IconButton icon={AlignCenterVertical} label="Align centre" />
          <IconButton icon={AlignEndVertical} label="Align right" />
          <IconButton icon={BringToFront} label="Bring to front" shortcut="Mod+]" />
          <IconButton icon={SendToBack} label="Send to back" shortcut="Mod+[" />
        </div>
      </Example>

      <Example title="Small">
        <div className="flex gap-1">
          {tools.slice(0, 4).map((tool, index) => (
            <IconButton key={tool.label} {...tool} size="sm" pressed={index === 0} />
          ))}
        </div>
      </Example>
    </Examples>
  ),
}

/** One icon button. Change its settings in the Controls panel below. */
export const Playground: Story = {
  render: (args) => (
    <div className="grid min-h-screen place-items-center bg-canvas">
      <IconButton {...args} />
    </div>
  ),
}
