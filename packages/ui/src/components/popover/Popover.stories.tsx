import type { Meta, StoryObj } from '@storybook/react-vite'
import { SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'

import { Example, Examples } from '../../stories/Examples'
import { Button } from '../button/Button'
import { TextField } from '../text-field/TextField'
import { Toggle } from '../toggle/Toggle'
import { Popover } from './Popover'

const colours = ['#1f2937', '#2563eb', '#0891b2', '#16a34a', '#ca8a04', '#ea580c', '#dc2626', '#9333ea', '#db2777', '#ffffff']

function ColourPicker() {
  const [colour, setColour] = useState('#2563eb')
  return (
    <Popover
      title="Fill colour"
      trigger={<button type="button" aria-label={`Fill colour ${colour}`} className="size-7 rounded-md ring-1 ring-border-strong ring-offset-2 ring-offset-panel" style={{ background: colour }} />}
      className="w-56"
    >
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-5 gap-1.5">
          {colours.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              aria-pressed={c === colour}
              onClick={() => setColour(c)}
              className="aspect-square rounded-sm ring-1 ring-border ring-inset aria-pressed:ring-2 aria-pressed:ring-foreground"
              style={{ background: c }}
            />
          ))}
        </div>
        <TextField label="Hex" value={colour} onChange={(event) => setColour(event.currentTarget.value)} />
      </div>
    </Popover>
  )
}

function IconFilters({ side, align }: { side?: 'top' | 'bottom' | 'left' | 'right'; align?: 'start' | 'center' | 'end' }) {
  return (
    <Popover
      title="Filter icons"
      side={side}
      align={align}
      trigger={
        <Button>
          <SlidersHorizontal />
          Filters
        </Button>
      }
      className="w-64"
    >
      <div className="flex flex-col gap-3">
        <Toggle label="Show grid" defaultChecked />
        <Toggle label="Snap to grid" defaultChecked />
        <Toggle label="Only my uploads" />
        <div className="flex justify-end">
          <Button variant="ghost" size="sm">
            Reset filters
          </Button>
        </div>
      </div>
    </Popover>
  )
}

const meta = {
  title: 'Components/Popover',
  component: Popover,
  args: { title: 'Filter icons', trigger: <button />, children: null },
  argTypes: { trigger: { table: { disable: true } }, children: { table: { disable: true } } },
} satisfies Meta<typeof Popover>

export default meta
type Story = StoryObj<typeof meta>

/** Click the swatch or the Filters button. Escape or a click outside closes the panel. */
export const Examples_: Story = {
  name: 'Examples',
  parameters: { controls: { disable: true } },
  render: () => (
    <Examples>
      <Example title="Colour picker on a swatch">
        <div className="flex h-64 items-start gap-2">
          <ColourPicker />
          <span className="pt-1 text-muted-foreground">Fill</span>
        </div>
      </Example>
      <Example title="Canvas options">
        <div className="h-52">
          <IconFilters />
        </div>
      </Example>
    </Examples>
  ),
}

/** One popover. Change where it opens in the Controls panel. */
export const Playground: Story = {
  render: (args) => (
    <div className="grid min-h-screen place-items-center bg-canvas">
      <IconFilters side={args.side} align={args.align} />
    </div>
  ),
}
