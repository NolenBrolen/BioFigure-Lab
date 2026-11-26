import type { Meta, StoryObj } from '@storybook/react-vite'
import { CollectionRow } from './CollectionRow'
import { sampleCategories } from '../../sample/sample-shapes'

const meta = { title: 'Components/Collection row', component: CollectionRow } satisfies Meta<typeof CollectionRow>
export default meta
type Story = StoryObj<typeof meta>
export const Examples: Story = { args: { name: 'Cells', selected: false, picture: null }, render: () => <div className="flex w-64 flex-col gap-2">{sampleCategories.map((category, index) => { const Icon = category.icons[0].Icon; return <CollectionRow key={category.name} name={category.name} selected={index === 0} picture={<Icon />} /> })}</div> }
