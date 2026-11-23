import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'

import { Example, Examples } from '../../stories/Examples'
import type { FontOption } from './FontPicker'
import { TextControls, type TextControlsValue } from './TextControls'

/** The fonts the editor bundles; in Storybook only Inter is loaded, the rest show in a stand-in. */
export const sampleFonts: FontOption[] = [
  { name: 'Inter', category: 'Sans serif', family: 'Inter Variable, sans-serif' },
  { name: 'Source Sans 3', category: 'Sans serif', family: '"Source Sans 3", sans-serif' },
  { name: 'Open Sans', category: 'Sans serif', family: '"Open Sans", sans-serif' },
  { name: 'Source Serif 4', category: 'Serif', family: '"Source Serif 4", serif' },
  { name: 'Merriweather', category: 'Serif', family: 'Merriweather, serif' },
  { name: 'JetBrains Mono', category: 'Monospace', family: '"JetBrains Mono", monospace' },
]

const start: TextControlsValue = {
  font: 'Inter',
  weight: 400,
  bold: false,
  size: 12,
  italic: false,
  underline: false,
  strikethrough: false,
  script: 'none',
  colour: '#1f2937',
  highlight: '',
  align: 'left',
  lineSpacing: 1.16,
  letterSpacing: 0,
}

const meta = {
  title: 'Components/Text controls',
  component: TextControls,
  args: { value: start, fonts: sampleFonts, weights: [300, 400, 500, 600, 700], onChange: () => {}, onSymbol: () => {} },
  argTypes: { fonts: { table: { disable: true } }, weights: { table: { disable: true } } },
} satisfies Meta<typeof TextControls>

export default meta
type Story = StoryObj<typeof meta>

/** Works like in the editor: the sample line below shows the changes. */
function Live({ initial }: { initial: TextControlsValue }) {
  const [value, setValue] = useState(initial)
  const [text, setText] = useState('H₂O and Ca²⁺ in lacZ')
  const font = sampleFonts.find((f) => f.name === value.font)
  return (
    <div className="flex flex-col gap-3">
      <div className="w-(--panel-right-width) rounded-md border bg-panel">
        <TextControls value={value} fonts={sampleFonts} weights={[300, 400, 500, 600, 700]} onChange={(change) => setValue((v) => ({ ...v, ...change }))} onSymbol={(s) => setText((t) => t + s)} />
      </div>
      <p
        className="rounded-md border bg-page p-3 text-gray-900"
        style={{
          fontFamily: font?.family,
          fontWeight: value.weight,
          fontSize: `${value.size}pt`,
          fontStyle: value.italic ? 'italic' : 'normal',
          textDecoration: [value.underline && 'underline', value.strikethrough && 'line-through'].filter(Boolean).join(' ') || 'none',
          color: value.colour,
          background: value.highlight || undefined,
          textAlign: value.align,
          lineHeight: value.lineSpacing,
          letterSpacing: `${value.letterSpacing / 1000}em`,
        }}
      >
        {text}
      </p>
    </div>
  )
}

export const Examples_: Story = {
  name: 'Examples',
  parameters: { controls: { disable: true } },
  render: () => (
    <Examples>
      <Example title="Plain text">
        <Live initial={start} />
      </Example>
      <Example title="Italic gene name, highlighted, centred">
        <Live initial={{ ...start, font: 'Source Serif 4', italic: true, weight: 600, highlight: '#fde68a', align: 'center' }} />
      </Example>
    </Examples>
  ),
}

export const Playground: Story = {}
