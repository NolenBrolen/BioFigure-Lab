import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'

import { SlideStrip, type SlideItem } from './SlideStrip'

/** A plain coloured picture standing in for a slide thumbnail. */
const picture = (colour: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 100"><rect width="150" height="100" fill="#fff"/><circle cx="60" cy="50" r="28" fill="${colour}"/></svg>`)}`

const start: SlideItem[] = [
  { id: 'a', thumbnail: picture('#f8d3bf') },
  { id: 'b', thumbnail: picture('#bfe3c8') },
  { id: 'c', thumbnail: picture('#c7d7f5') },
  { id: 'd' },
]

function Working() {
  const [slides, setSlides] = useState(start)
  const [current, setCurrent] = useState('b')
  const at = (id: string) => slides.findIndex((slide) => slide.id === id)
  return (
    <div className="w-[48rem] border-t">
      <SlideStrip
        slides={slides}
        currentId={current}
        aspect={1.5}
        onSelect={setCurrent}
        onAdd={() => {
          const id = crypto.randomUUID()
          setSlides((all) => [...all, { id, thumbnail: picture('#eee') }])
          setCurrent(id)
        }}
        onDuplicate={(id) => setSlides((all) => all.toSpliced(at(id) + 1, 0, { ...all[at(id)], id: crypto.randomUUID() }))}
        onDelete={(id) => {
          setSlides((all) => all.filter((slide) => slide.id !== id))
          if (id === current) setCurrent((slides[at(id) + 1] ?? slides[at(id) - 1]).id)
        }}
        onMove={(id, index) =>
          setSlides((all) => {
            const rest = all.filter((slide) => slide.id !== id)
            return rest.toSpliced(index, 0, all[at(id)])
          })
        }
      />
    </div>
  )
}

const meta = { title: 'Components/Slide strip', parameters: { controls: { disable: true } } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = { render: () => <Working /> }
