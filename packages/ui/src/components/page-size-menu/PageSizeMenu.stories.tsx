import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'

import { PageSizeMenu } from './PageSizeMenu'

const sizes = [
  { value: 'single', label: 'Single column', width: 85, height: 60 },
  { value: 'one-and-half', label: '1.5 column', width: 114, height: 80 },
  { value: 'double', label: 'Double column', width: 174, height: 120 },
] as const

const meta = { title: 'Components/Page size menu', parameters: { controls: { disable: true } } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

/** Above the canvas, next to the figure name. Picking a size changes the page below. */
export const OnTheCanvas: Story = {
  name: 'On the canvas',
  render: function Render() {
    const [page, setPage] = useState({ width: 174, height: 120 })
    return (
      <div className="grid min-h-screen place-items-center bg-canvas p-12 text-foreground">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="truncate">Untitled figure</span>
            <PageSizeMenu
              options={sizes}
              page={page}
              onPick={(value) => setPage(sizes.find((size) => size.value === value) ?? page)}
              onCustom={() => setPage({ width: 140, height: 90 })}
            />
          </div>
          <div className="bg-page shadow-(--elevation-page)" style={{ width: page.width * 3, height: page.height * 3 }} />
        </div>
      </div>
    )
  },
}
