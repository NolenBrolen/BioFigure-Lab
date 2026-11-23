import type { Meta, StoryObj } from '@storybook/react-vite'

import { Example, Examples } from '../../stories/Examples'
import { Button } from '../button/Button'
import { useDemoToasts } from './demo'
import { ToastProvider, ToastViewport } from './Toast'

const meta = {
  title: 'Components/Toast',
  component: ToastViewport,
  argTypes: { contained: { table: { disable: true } } },
} satisfies Meta<typeof ToastViewport>

export default meta
type Story = StoryObj<typeof meta>

function Demo() {
  const { showDeleted, startExport } = useDemoToasts()
  return (
    <div className="flex gap-2">
      <Button variant="danger" onClick={showDeleted}>
        Delete 2 objects
      </Button>
      <Button onClick={startExport}>Export</Button>
    </div>
  )
}

/** Click the buttons: the toasts appear at the bottom right of the box below. */
export const Examples_: Story = {
  name: 'Examples',
  parameters: { controls: { disable: true } },
  render: () => (
    <Examples>
      <ToastProvider>
        <Example title="Deleted · Undo, and export progress with Cancel">
          <Demo />
          <div className="relative h-56 overflow-hidden rounded-md border bg-canvas">
            <ToastViewport contained />
          </div>
        </Example>
      </ToastProvider>
    </Examples>
  ),
}

/** Toasts at the edge of the window, as in the editor. */
export const Playground: Story = {
  render: () => (
    <ToastProvider>
      <div className="grid min-h-screen place-items-center bg-canvas">
        <Demo />
      </div>
      <ToastViewport />
    </ToastProvider>
  ),
}
