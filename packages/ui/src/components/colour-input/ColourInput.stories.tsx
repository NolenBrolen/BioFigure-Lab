import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'

import { Example, Examples } from '../../stories/Examples'
import { ColourInput, type ColourLook } from './ColourInput'

function Field({ label, look, start, noneLabel }: { label: string; look: ColourLook; start?: string; noneLabel?: string }) {
  const [colour, setColour] = useState(start)
  return <ColourInput label={label} look={look} value={colour} noneLabel={noneLabel} onChange={(next) => setColour(next ?? undefined)} used={() => ['#dbeafe', '#2563eb', '#16a34a']} className="w-36" />
}

const meta = {
  title: 'Components/ColourInput',
  component: ColourInput,
  args: { label: 'Fill', onChange: () => undefined },
} satisfies Meta<typeof ColourInput>

export default meta
type Story = StoryObj<typeof meta>

/** Type a hex code, or open the swatches with the button on the left. */
export const Examples_: Story = {
  name: 'Examples',
  parameters: { controls: { disable: true } },
  render: () => (
    <Examples>
      <Example title="Fill and outline of a shape">
        <div className="flex h-96 items-start gap-2">
          <Field label="Fill" look="fill" start="#dbeafe" noneLabel="No fill" />
          <Field label="Outline" look="outline" start="#2563eb" noneLabel="No outline" />
        </div>
      </Example>
      <Example title="Plain swatch, no colour yet">
        <Field label="Text colour" look="swatch" />
      </Example>
    </Examples>
  ),
}
