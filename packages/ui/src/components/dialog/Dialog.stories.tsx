import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'

import { Example, Examples } from '../../stories/Examples'
import { Button } from '../button/Button'
import { Select } from '../select/Select'
import { TextField } from '../text-field/TextField'
import { useDemoToasts } from '../toast/demo'
import { ToastProvider, ToastViewport } from '../toast/Toast'
import { Dialog, DialogClose, type DialogPlacement } from './Dialog'

const formats = [
  { value: 'png', label: 'PNG', detail: 'Image, 300–1200 dpi' },
  { value: 'svg', label: 'SVG', detail: 'Vector, editable' },
  { value: 'pdf', label: 'PDF', detail: 'Vector, for print' },
] as const

const pageSizes = [
  { value: 'single', label: 'Single column', detail: '85 mm' },
  { value: 'double', label: 'Double column', detail: '174 mm' },
  { value: 'custom', label: 'Custom', detail: 'Any size' },
] as const

/** Export starts a slow task: the dialog closes straight away and a progress toast takes over. */
function ExportDialog({ placement = 'side' }: { placement?: DialogPlacement }) {
  const [open, setOpen] = useState(false)
  const { startExport } = useDemoToasts()
  return (
    <Dialog
      title="Export figure"
      description="Exports the whole page at print quality."
      placement={placement}
      trigger={<Button variant="primary">Export…</Button>}
      open={open}
      onOpenChange={setOpen}
      actions={
        <>
          <DialogClose render={<Button />}>Cancel</DialogClose>
          <Button
            variant="primary"
            onClick={() => {
              setOpen(false)
              startExport()
            }}
          >
            Export
          </Button>
        </>
      }
    >
      <Select label="Format" labelPosition="above" options={formats} defaultValue="png" />
      <TextField label="File name" defaultValue="figure" suffix=".png" />
    </Dialog>
  )
}

function NewFigureDialog({ placement = 'center' }: { placement?: DialogPlacement }) {
  return (
    <Dialog
      title="New figure"
      placement={placement}
      trigger={<Button>New figure…</Button>}
      actions={
        <>
          <DialogClose render={<Button />}>Cancel</DialogClose>
          <DialogClose render={<Button variant="primary" />}>Create</DialogClose>
        </>
      }
    >
      <TextField label="Name" defaultValue="Figure 1" />
      <Select label="Page size" labelPosition="above" options={pageSizes} defaultValue="double" />
    </Dialog>
  )
}

const meta = {
  title: 'Components/Dialog',
  component: Dialog,
  args: { title: 'Export figure', actions: null, placement: 'side' },
  argTypes: {
    actions: { table: { disable: true } },
    trigger: { table: { disable: true } },
    placement: { control: 'inline-radio', options: ['side', 'center'] },
  },
} satisfies Meta<typeof Dialog>

export default meta
type Story = StoryObj<typeof meta>

/** Export opens from the side so the figure stays in view; New figure opens in the middle. Export closes straight away and keeps going in a toast. */
export const Examples_: Story = {
  name: 'Examples',
  parameters: { controls: { disable: true } },
  render: () => (
    <ToastProvider>
      <Examples>
        <Example title="Export (side, keeps going in a toast)">
          <div>
            <ExportDialog />
          </div>
        </Example>
        <Example title="New figure (center)">
          <div>
            <NewFigureDialog />
          </div>
        </Example>
      </Examples>
      <ToastViewport />
    </ToastProvider>
  ),
}

/** The Export dialog. Switch the placement in the Controls panel. */
export const Playground: Story = {
  render: (args) => (
    <ToastProvider>
      <div className="grid min-h-screen place-items-center bg-canvas">
        <ExportDialog placement={args.placement} />
      </div>
      <ToastViewport />
    </ToastProvider>
  ),
}
