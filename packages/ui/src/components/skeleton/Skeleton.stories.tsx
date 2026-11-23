import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ComponentType, type ReactNode } from 'react'

import { sampleCategories, MacrophageShape } from '../../sample/sample-shapes'
import { Example, Examples } from '../../stories/Examples'
import { Button } from '../button/Button'
import { Skeleton } from './Skeleton'

const meta = {
  title: 'Components/Skeleton',
  component: Skeleton,
  args: { shape: 'block', className: 'h-20 w-32' },
  argTypes: {
    shape: { control: 'inline-radio', options: ['block', 'text', 'circle'] },
  },
} satisfies Meta<typeof Skeleton>

export default meta
type Story = StoryObj<typeof meta>

const icons = sampleCategories.flatMap((category) => category.icons).slice(0, 6)

/** A button that swaps placeholders and content, to show nothing moves when the content arrives. */
function useLoading() {
  const [loaded, setLoaded] = useState(false)
  const toggle = (
    <Button size="sm" onClick={() => setLoaded(!loaded)} className="self-start">
      {loaded ? 'Show placeholders' : 'Load content'}
    </Button>
  )
  return { loaded, toggle }
}

/** Icon library tiles: fixed squares, so real icons drop into exactly the same place. */
function IconTiles() {
  const { loaded, toggle } = useLoading()
  return (
    <div className="flex flex-col gap-3">
      <div aria-busy={!loaded} className="grid w-60 grid-cols-3 gap-2">
        {!loaded && <span className="sr-only">Loading icons</span>}
        {icons.map(({ name, Icon }) =>
          loaded ? (
            <div key={name} className="flex min-w-0 flex-col gap-1">
              <span className="grid aspect-square w-full place-items-center rounded-md bg-muted">
                <Icon className="size-3/5" />
              </span>
              <span className="h-4 truncate text-2xs text-muted-foreground">{name}</span>
            </div>
          ) : (
            <div key={name} className="flex flex-col gap-1">
              <Skeleton className="aspect-square w-full" />
              <span className="flex h-4 items-center">
                <Skeleton shape="text" className="w-3/4" />
              </span>
            </div>
          ),
        )}
      </div>
      {toggle}
    </div>
  )
}

/** A figure in the list on the start screen: thumbnail, name and date. */
function FigureCard() {
  const { loaded, toggle } = useLoading()
  return (
    <div className="flex flex-col gap-3">
      <div aria-busy={!loaded} className="flex w-48 flex-col gap-2 rounded-lg border bg-panel p-2">
        {!loaded && <span className="sr-only">Loading figure</span>}
        {loaded ? (
          // The picture sits inside a box of fixed proportions, the same as its placeholder.
          <span className="relative block aspect-4/3 w-full rounded-md bg-page shadow-sm ring-1 ring-border">
            <svg viewBox="0 0 128 128" className="absolute inset-0 m-auto h-3/4 w-full" aria-hidden="true">
              <MacrophageShape />
            </svg>
          </span>
        ) : (
          <Skeleton className="aspect-4/3 w-full" />
        )}
        <div className="flex flex-col">
          {loaded ? (
            <>
              <span className="h-5 truncate text-sm font-medium">Phagocytosis sequence</span>
              <span className="h-4 text-xs text-muted-foreground">Edited 2 hours ago</span>
            </>
          ) : (
            <>
              <span className="flex h-5 items-center">
                <Skeleton shape="text" className="w-4/5" />
              </span>
              <span className="flex h-4 items-center">
                <Skeleton shape="text" className="h-2.5 w-1/2" />
              </span>
            </>
          )}
        </div>
      </div>
      {toggle}
    </div>
  )
}

function SkeletonUses({ Section }: { Section: ComponentType<{ title: string; children: ReactNode }> }) {
  return (
    <>
      <Section title="Icon library tiles">
        <IconTiles />
      </Section>
      <Section title="Figure list thumbnail">
        <FigureCard />
      </Section>
      <Section title="Shapes">
        <div className="flex items-center gap-3">
          <Skeleton shape="circle" className="size-8" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton shape="text" className="w-2/3" />
            <Skeleton shape="text" className="w-1/3" />
          </div>
        </div>
      </Section>
    </>
  )
}

/**
 * Placeholders in the places the editor will use them. Press "Load content"
 * to swap in the real content: nothing moves. With "reduce motion" switched
 * on in the operating system they stay still.
 */
export const Examples_: Story = {
  name: 'Examples',
  parameters: { controls: { disable: true } },
  render: () => (
    <Examples>
      <SkeletonUses Section={Example} />
    </Examples>
  ),
}

/** One placeholder. Change its shape in the Controls panel below. */
export const Playground: Story = {
  render: (args) => (
    <div className="grid min-h-screen place-items-center bg-canvas">
      <Skeleton {...args} />
    </div>
  ),
}
