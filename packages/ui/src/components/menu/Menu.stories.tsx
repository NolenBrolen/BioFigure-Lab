import type { Meta, StoryObj } from '@storybook/react-vite'
import { AlignCenterVertical, AlignEndVertical, AlignStartVertical, ArrowDownToLine, ArrowUpToLine, Copy, Group, Trash2 } from 'lucide-react'

import { Example, Examples } from '../../stories/Examples'
import { ContextMenu, type MenuSection } from './Menu'

const objectActions: MenuSection[] = [
  {
    label: 'Edit',
    actions: [
      { label: 'Duplicate', icon: Copy, shortcut: 'Mod+D' },
      { label: 'Group', icon: Group, shortcut: 'Mod+G' },
    ],
  },
  {
    label: 'Arrange',
    showLabel: true,
    actions: [
      { label: 'Bring to front', icon: ArrowUpToLine, shortcut: 'Mod+Shift+]' },
      { label: 'Send to back', icon: ArrowDownToLine, shortcut: 'Mod+Shift+[' },
    ],
  },
  {
    label: 'Align',
    showLabel: true,
    layout: 'icons',
    actions: [
      { label: 'Align left', icon: AlignStartVertical },
      { label: 'Align centre', icon: AlignCenterVertical },
      { label: 'Align right', icon: AlignEndVertical },
    ],
  },
  { label: 'Remove', actions: [{ label: 'Delete', icon: Trash2, shortcut: 'Delete', danger: true }] },
]

const meta = {
  title: 'Components/Menu',
  component: ContextMenu,
  args: { sections: objectActions, children: <div /> },
  argTypes: { sections: { table: { disable: true } }, children: { table: { disable: true } } },
} satisfies Meta<typeof ContextMenu>

export default meta
type Story = StoryObj<typeof meta>

/** A selected cell on the canvas. */
function CanvasObject({ label = 'Cell' }: { label?: string }) {
  return (
    <div className="grid h-44 place-items-center rounded-md border bg-page">
      <div className="grid size-20 place-items-center rounded-full bg-primary-subtle text-xs text-primary-subtle-foreground ring-1 ring-primary outline-1 outline-offset-4 outline-primary outline-dashed">
        {label}
      </div>
    </div>
  )
}

/** Right-click the objects. Arrow keys move through the rows, Enter runs one, Escape closes. */
export const Examples_: Story = {
  name: 'Examples',
  parameters: { controls: { disable: true } },
  render: () => (
    <Examples>
      <Example title="Right-click a canvas object">
        <ContextMenu sections={objectActions}>
          <div>
            <CanvasObject />
          </div>
        </ContextMenu>
      </Example>
      <Example title="Some actions not available">
        <ContextMenu
          sections={[
            {
              label: 'Edit',
              actions: [
                { label: 'Duplicate', icon: Copy, shortcut: 'Mod+D' },
                { label: 'Group', icon: Group, shortcut: 'Mod+G', disabled: true },
              ],
            },
            { label: 'Remove', actions: [{ label: 'Delete', icon: Trash2, shortcut: 'Delete', danger: true }] },
          ]}
        >
          <div>
            <CanvasObject label="1 object" />
          </div>
        </ContextMenu>
      </Example>
    </Examples>
  ),
}

/** One menu. Right-click the cell. */
export const Playground: Story = {
  render: (args) => (
    <div className="grid min-h-screen place-items-center bg-canvas">
      <ContextMenu {...args}>
        <div className="w-96">
          <CanvasObject />
        </div>
      </ContextMenu>
    </div>
  ),
}
