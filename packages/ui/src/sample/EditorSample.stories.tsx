import type { Meta, StoryObj } from '@storybook/react-vite'

import { EditorSample } from './EditorSample'
import { ScaledPreview } from './ScaledPreview'

const meta = {
  title: 'Editor sample',
  component: EditorSample,
  argTypes: {
    theme: { control: 'inline-radio', options: ['light', 'dark'] },
    className: { table: { disable: true } },
  },
} satisfies Meta<typeof EditorSample>

export default meta
type Story = StoryObj<typeof meta>

/** Full size. The paintbrush in the toolbar switches light and dark. */
export const Editor: Story = {}

/** Light and dark next to each other. */
export const LightAndDark: Story = {
  name: 'Light and dark',
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="min-h-screen bg-canvas p-6 text-sm text-foreground">
      <header className="mb-5 max-w-3xl">
        <h1 className="text-xl font-semibold">Light and dark</h1>
        <p className="mt-1 text-muted-foreground">The same screen in both modes. The figure page stays white in both.</p>
      </header>
      <div className="grid grid-cols-2 gap-6">
        {(['light', 'dark'] as const).map((mode) => (
          <div key={mode} className="overflow-hidden rounded-lg shadow-md ring-1 ring-border">
            <ScaledPreview>
              <EditorSample theme={mode} className="h-[900px] w-[1440px]" />
            </ScaledPreview>
          </div>
        ))}
      </div>
    </div>
  ),
}
