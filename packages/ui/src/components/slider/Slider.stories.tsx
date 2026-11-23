import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ComponentType, type ReactNode } from 'react'

import { Example, Examples } from '../../stories/Examples'
import { Slider } from './Slider'

const meta = {
  title: 'Components/Slider',
  component: Slider,
  args: { label: 'Opacity', defaultValue: 80, min: 0, max: 100, step: 1, unit: '%', showField: true },
} satisfies Meta<typeof Slider>

export default meta
type Story = StoryObj<typeof meta>

/** A controlled slider that also prints its value, to show it only ever reports whole steps. */
function StrokeWidth() {
  const [width, setWidth] = useState(1.5)
  return (
    <div className="flex flex-col gap-2">
      <Slider label="Stroke width" min={0} max={10} step={0.25} unit="pt" value={width} onValueChange={setWidth} />
      <p className="text-xs text-muted-foreground">
        Value sent to the canvas: <span className="text-foreground tabular-nums">{width} pt</span>
      </p>
    </div>
  )
}

function SliderUses({ Section }: { Section: ComponentType<{ title: string; children: ReactNode }> }) {
  return (
    <>
      <Section title="Properties panel">
        <div className="flex w-60 flex-col gap-3">
          <Slider label="Opacity" defaultValue={80} unit="%" />
          <StrokeWidth />
        </div>
      </Section>

      <Section title="Without a number field">
        <div className="w-60">
          <Slider label="Corner radius" defaultValue={12} max={50} unit="px" showField={false} />
        </div>
      </Section>

      <Section title="Not available (nothing selected)">
        <div className="w-60">
          <Slider label="Opacity" defaultValue={100} unit="%" disabled />
        </div>
      </Section>
    </>
  )
}

/**
 * Sliders in the places the editor will use them. Drag a handle (it moves
 * smoothly, the number only shows whole steps), click the track to jump, or
 * Tab to it and use the arrow keys. Type into the number field and press Enter.
 */
export const Examples_: Story = {
  name: 'Examples',
  parameters: { controls: { disable: true } },
  render: () => (
    <Examples>
      <SliderUses Section={Example} />
    </Examples>
  ),
}

/** One slider. Change its settings in the Controls panel below. */
export const Playground: Story = {
  render: (args) => (
    <div className="grid min-h-screen place-items-center bg-canvas">
      <div className="w-64">
        <Slider {...args} />
      </div>
    </div>
  ),
}
