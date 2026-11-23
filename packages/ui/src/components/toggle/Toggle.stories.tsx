import type { Meta, StoryObj } from '@storybook/react-vite'
import { Type } from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'

import { Example, Examples } from '../../stories/Examples'
import { Toggle } from './Toggle'

const meta = {
  title: 'Components/Toggle',
  component: Toggle,
  args: { label: 'Snap to grid', defaultChecked: true },
  argTypes: { variant: { control: 'inline-radio', options: ['switch', 'segmented', 'bar'] } },
} satisfies Meta<typeof Toggle>

export default meta
type Story = StoryObj<typeof meta>

function ToggleUses({ Section }: { Section: ComponentType<{ title: string; children: ReactNode }> }) {
  return (
    <>
      <Section title="Export dialog">
        <div className="flex w-64 flex-col gap-3">
          <Toggle label="Transparent background" description="Only for PNG; SVG and PDF are always transparent" />
          <Toggle label="Transparent background" defaultChecked />
        </div>
      </Section>

      <Section title="Canvas settings">
        <div className="flex w-64 flex-col gap-3">
          <Toggle label="Snap to grid" defaultChecked />
          <Toggle label="Snap to other objects" defaultChecked />
          <Toggle label="Show grid" />
        </div>
      </Section>

      <Section title="Off | On variant, where the state in words helps">
        <div className="flex w-64 flex-col gap-3">
          <Toggle variant="segmented" label="Transparent background" description="Only for PNG" />
          <Toggle variant="segmented" label="Snap to grid" defaultChecked />
        </div>
      </Section>

      <Section title="Bar variant: a fat bar that is hard to miss, with its own icons">
        <div className="flex w-64 flex-col gap-3">
          <Toggle variant="bar" label="Show text" defaultChecked offIcon={<svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7V4h16v3M12 4v16M9 20h6" /><path d="M3 21 21 3" /></svg>} onIcon={<Type className="size-4" strokeWidth={2.25} />} />
          <Toggle variant="bar" label="Snap to grid" />
        </div>
      </Section>

      <Section title="Not available">
        <div className="w-64">
          <Toggle label="Transparent background" description="Not possible for PDF" disabled />
        </div>
      </Section>
    </>
  )
}

/** Toggles in the places the editor will use them. Click a toggle or its label, or Tab to it and press Space. */
export const Examples_: Story = {
  name: 'Examples',
  parameters: { controls: { disable: true } },
  render: () => (
    <Examples>
      <ToggleUses Section={Example} />
    </Examples>
  ),
}

/** One toggle. Change its settings in the Controls panel below. */
export const Playground: Story = {
  render: (args) => (
    <div className="grid min-h-screen place-items-center bg-canvas">
      <div className="w-64">
        <Toggle {...args} />
      </div>
    </div>
  ),
}
