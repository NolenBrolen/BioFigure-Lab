import type { Meta, StoryObj } from '@storybook/react-vite'
import { ChevronLeft, Download, Plus, Redo2, Undo2 } from 'lucide-react'

import { Example, Examples } from '../../stories/Examples'
import { IconButton } from '../icon-button/IconButton'
import { Button } from './Button'

const meta = {
  title: 'Components/Button',
  component: Button,
  args: { children: 'Export', variant: 'primary', size: 'md' },
  argTypes: {
    variant: { control: 'inline-radio', options: ['primary', 'secondary', 'ghost', 'danger'] },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
  },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

/** Buttons in the places the editor uses them. */
export const Examples_: Story = {
  name: 'Examples',
  parameters: { controls: { disable: true } },
  render: () => (
    <Examples>
      <Example title="Top bar">
        <div className="flex h-11 items-center gap-1 rounded-md border bg-panel px-2">
          <IconButton icon={ChevronLeft} label="Back to your figures" />
          <span className="truncate px-1 font-medium">Phagocytosis sequence</span>
          <span className="ml-auto" />
          <IconButton icon={Undo2} label="Undo" shortcut="Mod+Z" />
          <IconButton icon={Redo2} label="Redo" shortcut="Mod+Shift+Z" />
          <Button variant="primary">Export</Button>
        </div>
      </Example>

      <Example title="Dialog footer">
        <div className="flex justify-end gap-2 rounded-md border bg-panel p-3">
          <Button variant="secondary">Cancel</Button>
          <Button variant="primary">Export PNG</Button>
        </div>
      </Example>

      <Example title="Kinds">
        <div className="flex flex-wrap gap-2">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Delete</Button>
        </div>
      </Example>

      <Example title="With an icon">
        <div className="flex flex-wrap gap-2">
          <Button variant="primary">
            <Download /> Export
          </Button>
          <Button variant="secondary">
            <Plus /> New figure
          </Button>
        </div>
      </Example>

      <Example title="Sizes: small, normal, large">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" size="sm">
            Export
          </Button>
          <Button variant="primary">Export</Button>
          <Button variant="primary" size="lg">
            Export
          </Button>
        </div>
      </Example>

      <Example title="Not available">
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" disabled>
            Export
          </Button>
          <Button variant="secondary" disabled>
            Cancel
          </Button>
        </div>
      </Example>
    </Examples>
  ),
}

/** One button. Change its settings in the Controls panel below. */
export const Playground: Story = {
  render: (args) => (
    <div className="grid min-h-screen place-items-center bg-canvas">
      <Button {...args} />
    </div>
  ),
}
