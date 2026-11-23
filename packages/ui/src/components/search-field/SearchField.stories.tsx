import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { Example, Examples } from '../../stories/Examples'
import { SearchField } from './SearchField'
import { Skeleton } from '../skeleton/Skeleton'

const meta = {
  title: 'Components/Search field',
  component: SearchField,
  args: { placeholder: 'Search icons', onFilterClick: fn(), filterCount: 0 },
} satisfies Meta<typeof SearchField>

export default meta
type Story = StoryObj<typeof meta>

const onFilterClick = () => {}

/** Search fields in the places the editor uses them. Type in one, press Escape to clear. */
export const Examples_: Story = {
  name: 'Examples',
  parameters: { controls: { disable: true } },
  render: () => (
    <Examples>
      <Example title="Icon library panel">
        <div className="w-60 rounded-md border bg-panel p-3">
          <SearchField placeholder="Search icons" onFilterClick={onFilterClick} />
          <div className="mt-3 grid grid-cols-3 gap-2" aria-hidden="true">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="aspect-square motion-safe:animate-none" />
            ))}
          </div>
        </div>
      </Example>

      <Example title="While typing (× clears)">
        <div className="w-60">
          <SearchField placeholder="Search icons" defaultValue="macrophage" onFilterClick={onFilterClick} />
        </div>
      </Example>

      <Example title="With two filters on">
        <div className="w-60">
          <SearchField placeholder="Search icons" filterCount={2} onFilterClick={onFilterClick} />
        </div>
      </Example>

      <Example title="Without a filter button">
        <div className="w-60">
          <SearchField placeholder="Search figures" />
        </div>
      </Example>
    </Examples>
  ),
}

/** One search field. Change its settings in the Controls panel below. */
export const Playground: Story = {
  render: (args) => (
    <div className="grid min-h-screen place-items-center bg-canvas">
      <div className="w-60">
        <SearchField {...args} />
      </div>
    </div>
  ),
}
