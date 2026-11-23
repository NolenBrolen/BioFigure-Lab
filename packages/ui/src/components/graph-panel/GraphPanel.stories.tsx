import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'

import { ChartDataEditor, type DataGroup, type DataView } from './ChartDataEditor'
import { GraphPanel, type ChartKind, type ErrorBars } from './GraphPanel'

const meta = { title: 'Components/Graph panel', parameters: { layout: 'fullscreen' } } satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/** The left panel when the Graph tool is on. Hover a tile or an error-bar button for its hint. */
export const Panel: Story = {
  render: function Render() {
    const [picked, setPicked] = useState<ChartKind>('bar')
    const [bars, setBars] = useState<ErrorBars>('sd')
    return (
      <div className="min-h-screen bg-canvas p-6">
        <GraphPanel picked={picked} onPick={setPicked} errorBars={bars} onErrorBarsChange={setBars} className="w-60 rounded-lg bg-panel p-3" />
      </div>
    )
  },
}

/** The data drawer under the page, in both views. */
export const DataEditor: Story = {
  render: function Render() {
    const [view, setView] = useState<DataView>('table')
    const [groups, setGroups] = useState<DataGroup[]>([
      { name: 'Control', values: [1, 1.2, 0.9, 1.1] },
      { name: 'Drug A', values: [2.1, 2.5, 1.8, 2.3] },
    ])
    const edit = (c: number, change: (g: DataGroup) => DataGroup) => setGroups((gs) => gs.map((g, i) => (i === c ? change(g) : g)))
    return (
      <div className="min-h-screen bg-canvas p-6">
        <ChartDataEditor
          className="h-64 rounded-lg border"
          groups={groups}
          colours={['#0072B2', '#E69F00', '#009E73']}
          view={view}
          onViewChange={setView}
          onValue={(c, r, text) => edit(c, (g) => ({ ...g, values: g.values.map((v, i) => (i === r ? Number(text) : v)) }))}
          onRename={(c, name) => edit(c, (g) => ({ ...g, name }))}
          onPaste={() => {}}
          onAddGroup={() => setGroups((gs) => [...gs, { name: `Group ${gs.length + 1}`, values: [] }])}
          onRemoveGroup={(c) => setGroups((gs) => gs.filter((_, i) => i !== c))}
          onMoveGroup={(from, to) => setGroups((gs) => { const next = [...gs]; const [g] = next.splice(from, 1); if (g) next.splice(to > from ? to - 1 : to, 0, g); return next })}
          onAddRow={() => setGroups((gs) => gs.map((g) => ({ ...g, values: [...g.values, null] })))}
        />
      </div>
    )
  },
}
