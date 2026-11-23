import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'

import type { LineStyle, Route } from '../../lib/arrow-geometry'
import { Example, Examples } from '../../stories/Examples'
import { ShapesPanel } from '../shapes-panel/ShapesPanel'
import type { ShapeKind } from '../../lib/arrow-geometry'
import { ArrowsPanel } from './ArrowsPanel'

const meta = {
  title: 'Components/Arrows and shapes panels',
  parameters: { controls: { disable: true } },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

function Arrows() {
  const [route, setRoute] = useState<Route>('straight')
  const [line, setLine] = useState<LineStyle>('solid')
  const [picked, setPicked] = useState<string>()
  return <ArrowsPanel className="w-64 rounded-lg border bg-panel p-3" route={route} line={line} onRouteChange={setRoute} onLineChange={setLine} picked={picked} onPick={(preset) => setPicked(preset.id)} />
}

function Shapes() {
  const [picked, setPicked] = useState<ShapeKind>()
  return <ShapesPanel className="w-64 rounded-lg border bg-panel p-3" picked={picked} onPick={setPicked} />
}

/** Both panels as they sit in the left panel, next to the tool rail. */
export const Examples_: Story = {
  name: 'Examples',
  render: () => (
    <Examples>
      <Example title="Arrows">
        <Arrows />
      </Example>
      <Example title="Shapes">
        <Shapes />
      </Example>
    </Examples>
  ),
}
