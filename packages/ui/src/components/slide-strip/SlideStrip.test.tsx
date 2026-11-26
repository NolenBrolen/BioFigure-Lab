import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { setup } from '../../test/render'
import { SlideStrip, type SlideStripProps } from './SlideStrip'

const slides = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

function strip(props: Partial<SlideStripProps> = {}) {
  const handlers = { onSelect: vi.fn(), onAdd: vi.fn(), onDuplicate: vi.fn(), onDelete: vi.fn(), onMove: vi.fn() }
  const result = setup(<SlideStrip slides={slides} currentId="b" aspect={1.5} {...handlers} {...props} />)
  return { ...result, ...handlers }
}

describe('SlideStrip', () => {
  it('numbers the slides, marks the current one and jumps to a clicked slide', async () => {
    const { user, onSelect } = strip()
    expect(screen.getByRole('button', { name: 'Slide 2' })).toHaveAttribute('aria-current', 'true')
    await user.click(screen.getByRole('button', { name: 'Slide 3' }))
    expect(onSelect).toHaveBeenCalledWith('c')
  })

  it('shows a slide’s badge and says it in the slide’s name', () => {
    strip({ slides: [{ id: 'a' }, { id: 'b', badge: 'This computer' }] })
    expect(screen.getByRole('button', { name: 'Slide 2, This computer' })).toHaveTextContent('This computer')
  })

  it('adds a slide with the + button', async () => {
    const { user, onAdd } = strip()
    await user.click(screen.getByRole('button', { name: 'Add slide' }))
    expect(onAdd).toHaveBeenCalled()
  })

  it('moves between slides with the arrow keys and moves the slide itself with Alt', async () => {
    const { user, onSelect, onMove } = strip()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Slide 2' })).toHaveFocus()
    await user.keyboard('{Alt>}{ArrowRight}{/Alt}')
    expect(onMove).toHaveBeenCalledWith('b', 2)
    await user.keyboard('{ArrowLeft}')
    expect(onSelect).toHaveBeenCalledWith('a')
  })

  it('reorders by dragging a slide onto another', () => {
    const { onMove } = strip()
    const first = screen.getByRole('button', { name: 'Slide 1' })
    const third = screen.getByRole('button', { name: 'Slide 3' }).closest('li')!
    // jsdom has no layout or pointer position, so the drop lands in front of slide 3.
    fireEvent.dragStart(first, { dataTransfer: { setData: () => {}, effectAllowed: '' } })
    fireEvent.dragOver(third)
    fireEvent.drop(third)
    expect(onMove).toHaveBeenCalledWith('a', 1)
  })

  it('deletes with the Delete key, but never the last slide', async () => {
    const { user, onDelete, unmount } = strip()
    await user.tab()
    await user.keyboard('{Delete}')
    expect(onDelete).toHaveBeenCalledWith('b')
    unmount()

    const single = strip({ slides: [{ id: 'a' }], currentId: 'a' })
    await single.user.tab()
    await single.user.keyboard('{Delete}')
    expect(single.onDelete).not.toHaveBeenCalled()
  })
})
