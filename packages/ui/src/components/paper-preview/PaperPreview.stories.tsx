import type { Meta, StoryObj } from '@storybook/react-vite'
import { Eye } from 'lucide-react'
import { useState } from 'react'

import { BacteriumShape, MacrophageShape, macrophageColours } from '../../sample/sample-shapes'
import { Example, Examples } from '../../stories/Examples'
import { Button } from '../button/Button'
import { PaperPreview, type PaperLayout } from './PaperPreview'
import { PaperPreviewWindow } from './PaperPreviewWindow'

const meta = {
  title: 'Components/Paper preview',
  parameters: { layout: 'fullscreen' },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/** A double-column figure (174 × 70 mm): the phagocytosis sample from the editor mock-up. */
const doubleColumn = { width: 174, height: 70 }

const engulfArms = 'M338 100 C334 84 337 70 345 64 M364 110 C378 106 386 94 384 80'

function SampleFigure() {
  const s = 0.9
  const iconAt = (cx: number, cy: number) => `translate(${cx - 64 * s} ${cy - 64 * s}) scale(${s})`
  const small = (cx: number, cy: number, scale: number) => `translate(${cx - 64 * scale} ${cy - 64 * scale}) scale(${scale})`
  const font = { fontFamily: 'Inter Variable, Inter, sans-serif' }
  const label = { fontSize: 13, fill: '#1f2937', textAnchor: 'middle' as const, style: font }
  const letter = { fontSize: 15, fontWeight: 700, fill: '#111827', style: font }
  const arrow = (x1: number, x2: number) => (
    <g fill="#4b5563">
      <path d={`M${x1} 120 H${x2 - 8}`} stroke="#4b5563" strokeWidth={2.5} strokeLinecap="round" />
      <path d={`M${x2 - 10} 113 L${x2} 120 L${x2 - 10} 127 Z`} />
    </g>
  )
  return (
    <svg viewBox="0 0 658 265" role="img" aria-label="Sample figure: a macrophage engulfs a bacterium">
      <text x={18} y={30} {...letter}>A</text>
      <g transform={iconAt(110, 120)}>
        <MacrophageShape />
      </g>
      <g transform={small(178, 74, 0.42)}>
        <BacteriumShape />
      </g>
      <text x={115} y={232} {...label}>Recognition</text>
      {arrow(198, 258)}
      <text x={238} y={30} {...letter}>B</text>
      <g transform={small(358, 80, 0.42)}>
        <BacteriumShape />
      </g>
      <path d={engulfArms} fill="none" stroke={macrophageColours.stroke} strokeWidth={11} strokeLinecap="round" />
      <g transform={iconAt(329, 126)}>
        <MacrophageShape nucleus={[48, 78]} />
      </g>
      <path d={engulfArms} fill="none" stroke={macrophageColours.fill} strokeWidth={6} strokeLinecap="round" />
      <text x={334} y={232} {...label}>Engulfment</text>
      {arrow(414, 474)}
      <text x={458} y={30} {...letter}>C</text>
      <g transform={iconAt(548, 120)}>
        <MacrophageShape nucleus={[46, 76]} />
      </g>
      <circle cx={566} cy={106} r={17} fill="#fbe7da" stroke={macrophageColours.stroke} strokeWidth={2} strokeDasharray="4 3" />
      <g transform={small(566, 106, 0.24)}>
        <BacteriumShape />
      </g>
      <text x={548} y={232} {...label}>Phagosome</text>
    </svg>
  )
}

const layouts: { id: PaperLayout; title: string }[] = [
  { id: 'title-page', title: 'Title page (default)' },
  { id: 'inside-page', title: 'Inside page' },
]

const sizes = [
  { name: 'Double column', mm: doubleColumn },
  { name: '1.5 column', mm: { width: 114, height: 46 } },
  { name: 'Single column', mm: { width: 85, height: 34 } },
]

/** Every page type at every column width, each fitted to its card. */
export const Layouts: Story = {
  render: () => (
    <Examples>
      {sizes.flatMap(({ name, mm }) =>
        layouts.map(({ id, title }) => (
          <Example key={`${name}-${id}`} title={`${name} · ${title}`}>
            <PaperPreview layout={id} figure={<SampleFigure />} figureMm={mm} className="shadow-(--elevation-page)" />
          </Example>
        )),
      )}
    </Examples>
  ),
}

/** A figure wider than the 174 mm text width is shrunk to fit, keeping its shape. */
export const TooWide: Story = {
  render: () => (
    <Examples>
      <Example title="240 × 96 mm figure">
        <PaperPreview figure={<SampleFigure />} figureMm={{ width: 240, height: 96 }} className="shadow-(--elevation-page)" />
      </Example>
    </Examples>
  ),
}

/** How it opens from the editor: Preview in the top bar opens the full-window view. */
export const Window: Story = {
  render: () => {
    const [open, setOpen] = useState(true)
    return (
      <div className="flex h-screen flex-col bg-canvas text-sm text-foreground">
        <div className="flex h-12 items-center justify-end gap-2 border-b bg-panel px-3">
          <Button onClick={() => setOpen(true)}>
            <Eye className="size-4" /> Preview
          </Button>
          <Button variant="primary">Export</Button>
        </div>
        <PaperPreviewWindow open={open} onOpenChange={setOpen} figure={<SampleFigure />} figureMm={doubleColumn} />
      </div>
    )
  },
}
