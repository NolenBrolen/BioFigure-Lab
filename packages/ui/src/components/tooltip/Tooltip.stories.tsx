import type { Meta, StoryObj } from '@storybook/react-vite'
import { AlignCenterVertical, Circle, MousePointer2, Redo2, Square, Type, Undo2 } from 'lucide-react'
import type { ComponentProps } from 'react'

import { Example, Examples } from '../../stories/Examples'
import { IconButton, iconButtonVariants } from '../icon-button/IconButton'
import { Tooltip, TooltipProvider } from './Tooltip'

/** A plain trigger for tooltips that are shown open, without the icon button's own tooltip. */
function DemoTrigger({ icon: Icon, label, ...props }: ComponentProps<'button'> & { icon: typeof Undo2; label: string }) {
  return (
    <button type="button" aria-label={label} className={iconButtonVariants()} {...props}>
      <Icon strokeWidth={1.75} />
    </button>
  )
}

const shownOpen = [
  { icon: Undo2, label: 'Undo', shortcut: 'Mod+Z' },
  { icon: Redo2, label: 'Redo', shortcut: 'Mod+Shift+Z' },
  { icon: AlignCenterVertical, label: 'Align centre', shortcut: undefined },
]

const meta = {
  title: 'Components/Tooltip',
  component: Tooltip,
  args: { label: 'Undo', shortcut: 'Mod+Z', side: 'bottom', children: <DemoTrigger icon={Undo2} label="Undo" /> },
  argTypes: {
    children: { table: { disable: true } },
    side: { control: 'inline-radio', options: ['top', 'bottom', 'left', 'right'] },
  },
} satisfies Meta<typeof Tooltip>

export default meta
type Story = StoryObj<typeof meta>

/** Tooltips as the editor shows them. Some are shown open; hover the toolbar for the rest. */
export const Examples_: Story = {
  name: 'Examples',
  parameters: { controls: { disable: true } },
  render: () => (
    <Examples>
      <Example title="Shown open">
        {/* Only one tooltip opens at a time inside a provider, so each shown-open one gets its own. */}
        <div className="flex flex-col gap-3">
          {shownOpen.map(({ icon, label, shortcut }) => (
            <TooltipProvider key={label}>
              <Tooltip label={label} shortcut={shortcut} side="right" defaultOpen>
                <DemoTrigger icon={icon} label={label} />
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>
      </Example>

      <Example title="Hover these">
        <div className="flex w-fit gap-1 rounded-lg border bg-panel p-1 shadow-md">
          <IconButton icon={MousePointer2} label="Select" shortcut="V" pressed />
          <IconButton icon={Square} label="Rectangle" shortcut="R" />
          <IconButton icon={Circle} label="Ellipse" shortcut="O" />
          <IconButton icon={Type} label="Text" shortcut="T" />
          <IconButton icon={Undo2} label="Undo" shortcut="Mod+Z" />
        </div>
      </Example>
    </Examples>
  ),
}

/** One tooltip. Change its settings in the Controls panel below. */
export const Playground: Story = {
  render: (args) => (
    <div className="grid min-h-screen place-items-center bg-canvas">
      <Tooltip {...args} />
    </div>
  ),
}
