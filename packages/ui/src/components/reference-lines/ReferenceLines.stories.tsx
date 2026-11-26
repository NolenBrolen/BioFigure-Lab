import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'

import { ToastProvider, ToastViewport, useToast } from '../toast/Toast'
import { ReferenceLines, type ReferenceLine } from './ReferenceLines'

const meta = { title: 'Components/Reference lines', component: ReferenceLines, parameters: { layout: 'fullscreen' } } satisfies Meta<typeof ReferenceLines>

export default meta
type Story = StoryObj<typeof meta>

function Demo({ start }: { start: ReferenceLine[] }) {
  const [lines, setLines] = useState(start)
  const toasts = useToast()
  return (
    <div className="relative min-h-screen bg-canvas p-6">
      <div className="w-[320px] rounded-lg bg-panel p-4 shadow-(--elevation-sm)">
        <ReferenceLines
          lines={lines}
          newValue={1}
          onChange={setLines}
          onRemove={(index, line) => {
            const id = toasts.add({
              title: `Removed the line at ${line.value}`,
              actionProps: {
                children: 'Undo',
                onClick: () => {
                  toasts.close(id)
                  setLines((all) => [...all.slice(0, index), line, ...all.slice(index)])
                },
              },
            })
          }}
        />
      </div>
      <ToastViewport contained />
    </div>
  )
}

/** Two lines, as on a fold-change chart: no change at 1, and a cut-off. × removes a line, with Undo in a toast. */
export const Lines: Story = {
  args: { lines: [], onChange: () => {} },
  render: () => (
    <ToastProvider>
      <Demo
        start={[
          { value: 1, style: 'dashed', label: 'No change' },
          { value: 2.5, style: 'solid', label: 'Cut-off' },
        ]}
      />
    </ToastProvider>
  ),
}

/** No lines yet: only Add line shows; the header row comes with the first line. */
export const Empty: Story = {
  args: { lines: [], onChange: () => {} },
  render: () => (
    <ToastProvider>
      <Demo start={[]} />
    </ToastProvider>
  ),
}
