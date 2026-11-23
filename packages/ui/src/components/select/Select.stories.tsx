import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ComponentType, ReactNode } from 'react'

import { Example, Examples } from '../../stories/Examples'
import { Select } from './Select'

const pageSizes = [
  { value: 'single', label: 'Single column', detail: '85 mm' },
  { value: 'one-and-half', label: '1.5 column', detail: '114 mm' },
  { value: 'double', label: 'Double column', detail: '174 mm' },
  { value: 'custom', label: 'Custom', detail: 'Any size' },
] as const

const exportFormats = [
  { value: 'png', label: 'PNG', detail: 'Image, 300–1200 dpi' },
  { value: 'svg', label: 'SVG', detail: 'Vector, editable' },
  { value: 'pdf', label: 'PDF', detail: 'Vector, for print' },
] as const

const meta = {
  title: 'Components/Select',
  component: Select,
  args: { label: 'Page size', options: pageSizes, defaultValue: 'double' },
  argTypes: {
    options: { table: { disable: true } },
  },
} satisfies Meta<typeof Select<string>>

export default meta
type Story = StoryObj<typeof meta>

function SelectUses({ Section }: { Section: ComponentType<{ title: string; children: ReactNode }> }) {
  return (
    <>
      <Section title="Page settings (nothing selected)">
        <div className="w-60">
          <Select label="Page size" options={pageSizes} defaultValue="double" />
        </div>
      </Section>

      <Section title="Export dialog">
        <div className="w-60">
          <Select label="Format" options={exportFormats} defaultValue="png" />
        </div>
      </Section>

      <Section title="Nothing picked yet">
        <div className="w-60">
          <Select label="Format" options={exportFormats} placeholder="Pick a format" />
        </div>
      </Section>

      <Section title="Not available">
        <div className="w-60">
          <Select label="Page size" options={pageSizes} defaultValue="single" disabled />
        </div>
      </Section>
    </>
  )
}

/** Selects in the places the editor will use them. Click one open, or Tab to it and use the arrow keys, Enter and Escape. */
export const Examples_: Story = {
  name: 'Examples',
  parameters: { controls: { disable: true } },
  render: () => (
    <Examples>
      <SelectUses Section={Example} />
    </Examples>
  ),
}

/** One select. Change its settings in the Controls panel below. */
export const Playground: Story = {
  render: (args) => (
    <div className="grid min-h-screen place-items-center bg-canvas">
      <div className="w-64">
        <Select {...args} />
      </div>
    </div>
  ),
}
