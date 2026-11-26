import type { Meta, StoryObj } from '@storybook/react-vite'

import { Callout } from './Callout'

const meta = {
  title: 'Components/Callout',
  component: Callout,
  args: { children: 'The brackets don’t fit, so the chart is squashed. To make room, try ANOVA + Dunnett (each group against the first), or making the chart taller.' },
  decorators: [(Story) => <div className="w-[328px] bg-panel p-4">{Story()}</div>],
} satisfies Meta<typeof Callout>

export default meta
type Story = StoryObj<typeof meta>

/** In the chart's Statistics section, when its brackets crowd the plot. */
export const Warning: Story = {}
