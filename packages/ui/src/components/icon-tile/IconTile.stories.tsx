import type { Meta, StoryObj } from '@storybook/react-vite'

import { Example, Examples } from '../../stories/Examples'
import { sampleCategories } from '../../sample/sample-shapes'
import { IconTile, type IconTileLook } from './IconTile'

const meta = {
  title: 'Components/Icon tile',
  parameters: { controls: { disable: true } },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/** A left-panel-sized column of the sample icons in one look. */
function Library({ look }: { look: IconTileLook }) {
  return (
    <div className="w-64 rounded-lg border bg-panel p-3">
      {sampleCategories.slice(0, 2).map((category) => (
        <section key={category.name} className="pt-2">
          <h3 className="section-label flex h-7 items-center">{category.name}</h3>
          <div className={look === 'row' ? 'flex flex-col' : 'grid grid-cols-3 gap-2'}>
            {category.icons.map(({ name, Icon }) => (
              <IconTile key={name} look={look} name={name} picture={<Icon />} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

/** Both looks as they sit in the icon library panel. */
export const Examples_: Story = {
  name: 'Examples',
  render: () => (
    <Examples>
      <Example title="Tiles (default)">
        <Library look="badge" />
      </Example>
      <Example title="List">
        <Library look="row" />
      </Example>
    </Examples>
  ),
}
