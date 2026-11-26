import type { Meta, StoryObj } from '@storybook/react-vite'

import { Banner } from './Banner'

const meta = { title: 'Components/Banner', component: Banner, parameters: { layout: 'fullscreen' } } satisfies Meta<typeof Banner>

export default meta
type Story = StoryObj<typeof meta>

export const Success: Story = {
  args: { children: "Welcome back. Everything is just as you left it.", onClose: () => {} },
}

export const WithoutClose: Story = { args: { children: 'Your changes are saved.' } }
