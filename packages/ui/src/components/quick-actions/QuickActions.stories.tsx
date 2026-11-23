import type { Meta, StoryObj } from '@storybook/react-vite'
import { CopyPlus, Lock, MoreHorizontal, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'

import { Example, Examples } from '../../stories/Examples'
import { QuickActions, type QuickActionGroup } from './QuickActions'

const shapeActions: QuickActionGroup[] = [
  {
    id: 'colour',
    actions: [
      { id: 'fill', label: 'Fill', swatch: 'fill', colour: '#93c5fd', onColour: () => {} },
      { id: 'stroke', label: 'Line colour', swatch: 'line', colour: '#2563eb', onColour: () => {} },
    ],
  },
  {
    id: 'edit',
    actions: [
      { id: 'duplicate', label: 'Duplicate', icon: CopyPlus, shortcut: 'Mod+D', onClick: () => {} },
      { id: 'lock', label: 'Lock', icon: Lock, shortcut: 'Mod+Shift+L', onClick: () => {} },
      { id: 'delete', label: 'Delete', icon: Trash2, shortcut: 'Delete', danger: true, onClick: () => {} },
    ],
  },
  { id: 'more', actions: [{ id: 'more', label: 'More actions', icon: MoreHorizontal, onClick: () => {} }] },
]

const meta = {
  title: 'Components/Quick actions',
  component: QuickActions,
  args: { label: 'Rectangle actions', groups: shapeActions },
  argTypes: { groups: { table: { disable: true } } },
} satisfies Meta<typeof QuickActions>

export default meta
type Story = StoryObj<typeof meta>

/** A selected cell on a bit of page, with the toolbar above it. */
function Stage({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-56 flex-col items-center justify-end gap-11 rounded-md border bg-page pb-8">
      {children}
      <div className="grid size-20 place-items-center rounded-full bg-primary-subtle text-xs text-primary-subtle-foreground ring-1 ring-primary outline-1 outline-offset-4 outline-primary outline-dashed">
        Cell
      </div>
    </div>
  )
}

/** Hover a button for its name; Tab into the toolbar, then arrow keys. */
export const Examples_: Story = {
  name: 'Examples',
  parameters: { controls: { disable: true } },
  render: () => (
    <Examples>
      <Example title="A selected shape">
        <Stage>
          <QuickActions label="Rectangle actions" groups={shapeActions} />
        </Stage>
      </Example>
      <Example title="Names under the icons (for longer lists)">
        <Stage>
          <QuickActions label="Rectangle actions" groups={shapeActions} showLabels />
        </Stage>
      </Example>
      <Example title="Locked, no line colour">
        <Stage>
          <QuickActions
            label="Text actions"
            groups={[
              { id: 'colour', actions: [{ id: 'fill', label: 'Colour', swatch: 'fill', colour: '#1f2937', onColour: () => {} }] },
              { id: 'edit', actions: [{ id: 'lock', label: 'Unlock', icon: Lock, pressed: true, onClick: () => {} }] },
            ]}
          />
        </Stage>
      </Example>
    </Examples>
  ),
}

export const Playground: Story = {
  render: (args) => (
    <div className="grid min-h-screen place-items-center bg-canvas">
      <QuickActions {...args} />
    </div>
  ),
}
