import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'

import { Example, Examples } from '../../stories/Examples'
import { PageSizeIcon } from '../page-size-icon/PageSizeIcon'
import { TextField } from '../text-field/TextField'
import { OptionCards } from './OptionCards'

const meta = {
  title: 'Components/Option cards',
  component: OptionCards,
  args: { label: 'Page size', options: [] },
} satisfies Meta<typeof OptionCards>

export default meta
type Story = StoryObj<typeof meta>

// The editor's page size presets (apps/editor/src/editor/page-size.ts).
const PRESETS = [
  { value: 'single', label: 'Single column', width: 85, height: 60 },
  { value: 'one-and-half', label: '1.5 column', width: 114, height: 80 },
  { value: 'double', label: 'Double column', width: 174, height: 120 },
] as const

type Choice = (typeof PRESETS)[number]['value'] | 'custom'

/** Page sizes as in the New figure dialog: pick a column width or type your own size. */
function PageSizes() {
  const [choice, setChoice] = useState<Choice>('double')
  const [custom, setCustom] = useState({ width: '100', height: '69' })
  const preset = PRESETS.find((item) => item.value === choice)
  const size = preset ?? { width: Number(custom.width.replace(',', '.')) || 0, height: Number(custom.height.replace(',', '.')) || 0 }
  const type = (changes: Partial<typeof custom>) => {
    setChoice('custom')
    setCustom({ width: String(size.width), height: String(size.height), ...changes })
  }

  return (
    <div className="flex w-[32rem] flex-col gap-4">
      <OptionCards<Choice>
        label="Page size"
        value={choice}
        onValueChange={setChoice}
        options={[
          ...PRESETS.map((item) => ({
            value: item.value,
            label: item.label,
            detail: `${item.width} × ${item.height} mm`,
            picture: <PageSizeIcon width={item.width} height={item.height} />,
          })),
          {
            value: 'custom',
            label: 'Custom',
            detail: choice === 'custom' ? `${size.width} × ${size.height} mm` : 'Your own size',
            picture: <PageSizeIcon width={size.width} height={size.height} dashed={choice !== 'custom'} />,
          },
        ]}
      />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Width" suffix="mm" value={preset ? String(preset.width) : custom.width} onChange={(event) => type({ width: event.target.value })} />
        <TextField label="Height" suffix="mm" value={preset ? String(preset.height) : custom.height} onChange={(event) => type({ height: event.target.value })} />
      </div>
    </div>
  )
}

/** Option cards where the editor uses them. Click a card, or Tab to the group and use the arrow keys. */
export const Examples_: Story = {
  name: 'Examples',
  parameters: { controls: { disable: true } },
  render: () => (
    <Examples>
      <Example title="New figure: page size">
        <PageSizes />
      </Example>
      <Example title="One option not available">
        <OptionCards
          label="Page size"
          defaultValue="single"
          options={[
            { value: 'single', label: 'Single column', detail: '85 × 60 mm', picture: <PageSizeIcon width={85} height={60} /> },
            { value: 'double', label: 'Double column', detail: '174 × 120 mm', picture: <PageSizeIcon width={174} height={120} /> },
            { value: 'poster', label: 'Poster', detail: 'Coming later', picture: <PageSizeIcon width={174} height={230} />, disabled: true },
          ]}
        />
      </Example>
      <Example title="Compact: icon colour modes in a properties row">
        <div className="w-48">
          <OptionCards
            compact
            label="Colour mode"
            defaultValue="rgb"
            options={[
              { value: 'rgb', label: 'Colour', picture: <ModeDot colour="#8fc6cc" /> },
              { value: 'grey', label: 'Greyscale', picture: <ModeDot colour="#b3b3b3" /> },
            ]}
          />
        </div>
      </Example>
    </Examples>
  ),
}

/** A stand-in for the icon picture the editor puts in each colour-mode tile. */
function ModeDot({ colour }: { colour: string }) {
  return (
    <svg viewBox="0 0 24 24" className="size-full">
      <circle cx="12" cy="12" r="10" fill={colour} />
    </svg>
  )
}

/** The page pictures on their own, from a narrow column figure to a full page. */
export const PagePictures: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="flex min-h-screen items-start gap-6 bg-canvas p-6 text-xs text-muted-foreground">
      {[
        [85, 60],
        [114, 80],
        [174, 120],
        [85, 120],
        [174, 230],
      ].map(([width = 0, height = 0]) => (
        <figure key={`${width}x${height}`} className="flex w-24 flex-col items-center gap-2">
          <PageSizeIcon width={width} height={height} />
          {width} × {height} mm
        </figure>
      ))}
    </div>
  ),
}
