import type { Meta, StoryObj } from '@storybook/react-vite'

import { Example, Examples } from '../../stories/Examples'
import { IconLibraryPanel, PropertiesPanel } from '../../stories/layout-demos'
import { Panel, PanelSection } from './Panel'

const meta = {
  title: 'Components/Panel',
  component: Panel,
  args: {
    title: 'Properties',
    variant: 'docked',
    children: null,
    onClose: () => {},
  },
  argTypes: {
    variant: { control: 'inline-radio', options: ['docked', 'rail'] },
    children: { table: { disable: true } },
  },
} satisfies Meta<typeof Panel>

export default meta
type Story = StoryObj<typeof meta>

/** Panels in the places the editor uses them. */
export const Examples_: Story = {
  name: 'Examples',
  parameters: { controls: { disable: true } },
  render: () => (
    <Examples>
      <Example title="Left: icon library (rail)">
        <IconLibraryPanel />
      </Example>
      <Example title="Right: properties (docked)">
        <PropertiesPanel />
      </Example>
    </Examples>
  ),
}

/** One panel. Change its settings in the Controls panel below. */
export const Playground: Story = {
  render: (args) => (
    <div className="min-h-screen bg-canvas p-6">
      <Panel {...args} className="h-96 w-(--panel-right-width) border">
        <PanelSection title="Fill">
          <p className="text-xs text-muted-foreground">Section content</p>
        </PanelSection>
        <PanelSection title="Line" defaultOpen={false}>
          <p className="text-xs text-muted-foreground">Section content</p>
        </PanelSection>
      </Panel>
    </div>
  ),
}
