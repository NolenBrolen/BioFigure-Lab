import type { Meta, StoryObj } from '@storybook/react-vite'
import { AlignCenter, AlignLeft, AlignRight, LayoutGrid, List } from 'lucide-react'
import { useState } from 'react'

import { SegmentedToggle } from './SegmentedToggle'

const meta = {
  title: 'Components/Segmented toggle',
  component: SegmentedToggle,
} satisfies Meta<typeof SegmentedToggle>

export default meta
type Story = StoryObj<typeof meta>

/** Tiles or list, as in the icon library. */
export const View: Story = {
  args: { label: 'View', options: [], value: '', onValueChange: () => {} },
  render: () => {
    const [view, setView] = useState<'tiles' | 'list'>('tiles')
    return (
      <SegmentedToggle
        label="View"
        value={view}
        onValueChange={setView}
        options={[
          { value: 'tiles', icon: LayoutGrid, label: 'Show as tiles' },
          { value: 'list', icon: List, label: 'Show as list' },
        ]}
      />
    )
  },
}

/** Three options work the same way. */
export const ThreeOptions: Story = {
  args: { label: 'Text alignment', options: [], value: '', onValueChange: () => {} },
  render: () => {
    const [align, setAlign] = useState<'left' | 'center' | 'right'>('left')
    return (
      <SegmentedToggle
        label="Text alignment"
        value={align}
        onValueChange={setAlign}
        options={[
          { value: 'left', icon: AlignLeft, label: 'Align left' },
          { value: 'center', icon: AlignCenter, label: 'Align centre' },
          { value: 'right', icon: AlignRight, label: 'Align right' },
        ]}
      />
    )
  },
}

// The T cell in each style, from the icon library.
const tCell = import.meta.glob<string>('../../../../../icons/cells/t-cell-simple-flat*.svg', { query: '?url', import: 'default', eager: true })
const tCellIn = (suffix: string) => tCell[`../../../../../icons/cells/t-cell-simple-flat${suffix}.svg`]

/** Pictures in place of icons: the icon library's style switch (Clean, Graphite, Shaded, Scribble). */
export const WithPictures: Story = {
  args: { label: 'Icon style', options: [], value: '', onValueChange: () => {} },
  render: () => {
    const [style, setStyle] = useState<'clean' | 'graphite' | 'shaded' | 'scribble'>('clean')
    return (
      <SegmentedToggle
        label="Icon style"
        value={style}
        onValueChange={setStyle}
        options={[
          { value: 'clean', label: 'Clean: icons as drawn', picture: <img src={tCellIn('')} alt="" /> },
          { value: 'graphite', label: 'Graphite: grey pencil outlines', picture: <img src={tCellIn('-pencil-graphite')} alt="" /> },
          { value: 'shaded', label: 'Shaded: grey pencil with hatching', picture: <img src={tCellIn('-pencil-shaded')} alt="" /> },
          { value: 'scribble', label: 'Scribble: colour scribble, dark outline', picture: <img src={tCellIn('-pencil-scribble')} alt="" /> },
        ]}
      />
    )
  },
}
