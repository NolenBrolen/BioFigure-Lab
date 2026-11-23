import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'

import { Example, Examples } from '../../stories/Examples'
import { LayersPanel, type LayerItem } from './LayersPanel'

const sample: LayerItem[] = [
  { id: 't1', name: 'Figure 1 title', kind: 'text', hidden: false, locked: false },
  { id: 'a1', name: 'Arrow', kind: 'arrow', hidden: false, locked: false },
  {
    id: 'g1', name: 'Cell with nucleus', kind: 'group', hidden: false, locked: false,
    children: [
      { id: 'i1', name: 'Nucleus', kind: 'icon', hidden: false, locked: false },
      { id: 'i2', name: 'Mitochondrion', kind: 'icon', hidden: false, locked: true },
      { id: 's1', name: 'Cell membrane', kind: 'shape', hidden: false, locked: false },
    ],
  },
  { id: 'gr1', name: 'Growth curve', kind: 'graph', hidden: true, locked: false },
  { id: 'tb1', name: 'Results table', kind: 'table', hidden: false, locked: false },
  { id: 's2', name: 'Background', kind: 'shape', hidden: false, locked: true },
]

/** Changes one layer anywhere in the tree. */
function edit(layers: LayerItem[], id: string, change: (siblings: LayerItem[], index: number) => LayerItem[]): LayerItem[] {
  const index = layers.findIndex((layer) => layer.id === id)
  if (index >= 0) return change(layers, index)
  return layers.map((layer) => (layer.children ? { ...layer, children: edit(layer.children, id, change) } : layer))
}

function Working() {
  const [layers, setLayers] = useState(sample)
  const [selected, setSelected] = useState<string[]>(['a1'])
  const patch = (id: string, values: (layer: LayerItem) => Partial<LayerItem>) =>
    setLayers((all) => edit(all, id, (list, i) => list.map((layer, j) => (j === i ? { ...layer, ...values(layer) } : layer))))
  return (
    <div className="flex h-[26rem] w-(--panel-right-width) flex-col border-l bg-panel">
      <div className="h-28 shrink-0 border-b p-3">
        <h3 className="section-label">Properties</h3>
      </div>
      <LayersPanel
        className="flex-1"
        layers={layers}
        selectedIds={selected}
        onSelect={(id, add) => setSelected((current) => (add ? [...current, id] : [id]))}
        onRename={(id, name) => patch(id, () => ({ name }))}
        onToggleHidden={(id) => patch(id, (layer) => ({ hidden: !layer.hidden }))}
        onToggleLocked={(id) => patch(id, (layer) => ({ locked: !layer.locked }))}
        onMove={(id, to) =>
          setLayers((all) =>
            edit(all, id, (list, from) => {
              const next = [...list]
              const [moved] = next.splice(from, 1)
              if (moved) next.splice(to, 0, moved)
              return next
            }),
          )
        }
      />
    </div>
  )
}

const noop = () => {}

const meta = { title: 'Components/Layers panel', parameters: { controls: { disable: true } } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Examples_: Story = {
  name: 'Examples',
  render: () => (
    <Examples>
      <Example title="Under Properties, right side">
        <Working />
      </Example>
      <Example title="Empty page">
        <div className="w-(--panel-right-width) border-l">
          <LayersPanel layers={[]} selectedIds={[]} onSelect={noop} onRename={noop} onMove={noop} onToggleHidden={noop} onToggleLocked={noop} />
        </div>
      </Example>
    </Examples>
  ),
}
