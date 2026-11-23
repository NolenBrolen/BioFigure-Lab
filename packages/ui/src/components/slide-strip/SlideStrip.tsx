/*
 * The slide strip: a filmstrip of slide pictures along the bottom of the
 * canvas. Click a slide to show it, drag it sideways to reorder, right-click
 * for duplicate and delete, and "+" at the end adds one.
 *
 * Keyboard: Left/Right move between slides, Alt+Left/Right move the slide
 * itself, Delete removes it. Deleting has no confirmation; the editor offers Undo.
 */
import { Copy, Plus, Trash2 } from 'lucide-react'
import { useRef, useState, type KeyboardEvent } from 'react'

import { cn } from '../../lib/cn'
import { ContextMenu } from '../menu/Menu'

export type SlideItem = {
  id: string
  /** A small picture of the slide, as a URL. Missing while it is being drawn. */
  thumbnail?: string
}

export type SlideStripProps = {
  slides: SlideItem[]
  currentId: string
  /** Page width divided by height, so the pictures have the page's shape. */
  aspect: number
  onSelect: (id: string) => void
  onAdd: () => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  /** Move a slide to a new position (counted in the list without it). */
  onMove: (id: string, index: number) => void
  className?: string
}

const THUMB_HEIGHT = 64

export function SlideStrip({ slides, currentId, aspect, onSelect, onAdd, onDuplicate, onDelete, onMove, className }: SlideStripProps) {
  const [drag, setDrag] = useState<{ id: string; over?: number }>()
  const buttons = useRef(new Map<string, HTMLButtonElement>())
  const width = Math.round(THUMB_HEIGHT * aspect)
  const only = slides.length === 1

  const focus = (id: string | undefined) => id && requestAnimationFrame(() => buttons.current.get(id)?.focus())

  const onKeyDown = (event: KeyboardEvent, index: number, id: string) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (step && event.altKey) {
      event.preventDefault()
      const to = index + step
      if (to < 0 || to >= slides.length) return
      onMove(id, to)
      focus(id)
    } else if (step) {
      event.preventDefault()
      const next = slides[index + step]
      if (next) {
        onSelect(next.id)
        focus(next.id)
      }
    } else if ((event.key === 'Delete' || event.key === 'Backspace') && !only) {
      event.preventDefault()
      onDelete(id)
      focus((slides[index + 1] ?? slides[index - 1])?.id)
    }
  }

  const drop = () => {
    if (drag?.over === undefined) return setDrag(undefined)
    const from = slides.findIndex((slide) => slide.id === drag.id)
    // `over` is a gap between slides; without the dragged slide, gaps after it shift by one.
    const to = drag.over > from ? drag.over - 1 : drag.over
    setDrag(undefined)
    if (from >= 0 && to !== from) onMove(drag.id, to)
  }

  return (
    <div className={cn('flex items-start gap-3 overflow-x-auto px-4 py-3', className)} role="region" aria-label="Slides">
      <ol className="flex items-start gap-3">
        {slides.map((slide, index) => {
          const current = slide.id === currentId
          return (
            <li
              key={slide.id}
              className="relative shrink-0"
              onDragOver={(event) => {
                if (!drag) return
                event.preventDefault()
                const box = event.currentTarget.getBoundingClientRect()
                const over = event.clientX > box.left + box.width / 2 ? index + 1 : index
                if (over !== drag.over) setDrag({ ...drag, over })
              }}
              onDrop={(event) => {
                event.preventDefault()
                drop()
              }}
            >
              {drag?.over === index && <span aria-hidden className="absolute top-0 -left-2 h-16 w-0.5 rounded bg-primary" />}
              {drag?.over === index + 1 && index === slides.length - 1 && (
                <span aria-hidden className="absolute top-0 -right-2 h-16 w-0.5 rounded bg-primary" />
              )}
              <ContextMenu
                sections={[
                  {
                    label: 'Slide',
                    actions: [
                      { label: 'Duplicate slide', icon: Copy, onClick: () => onDuplicate(slide.id) },
                      { label: 'Delete slide', icon: Trash2, danger: true, disabled: only, onClick: () => onDelete(slide.id) },
                    ],
                  },
                ]}
              >
                <button
                  ref={(element) => {
                    if (element) buttons.current.set(slide.id, element)
                    else buttons.current.delete(slide.id)
                  }}
                  type="button"
                  draggable
                  aria-label={`Slide ${index + 1}`}
                  aria-current={current ? 'true' : undefined}
                  // One stop in the Tab order: the current slide; arrows move between the others.
                  tabIndex={current ? 0 : -1}
                  onClick={() => onSelect(slide.id)}
                  onKeyDown={(event) => onKeyDown(event, index, slide.id)}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = 'move'
                    event.dataTransfer.setData('text/plain', slide.id)
                    setDrag({ id: slide.id })
                  }}
                  onDragEnd={() => setDrag(undefined)}
                  className={cn('group flex flex-col items-center gap-1 rounded-md outline-none', drag?.id === slide.id && 'opacity-50')}
                >
                  <span
                    style={{ width, height: THUMB_HEIGHT }}
                    className={cn(
                      'block overflow-hidden rounded-md bg-white ring-offset-2 ring-offset-canvas transition-shadow duration-(--duration-fast)',
                      current ? 'ring-2 ring-primary' : 'ring-1 ring-border group-hover:ring-foreground/30',
                      'group-focus-visible:ring-2 group-focus-visible:ring-ring',
                    )}
                  >
                    {slide.thumbnail ? (
                      <img src={slide.thumbnail} alt="" draggable={false} className="size-full object-contain" />
                    ) : (
                      <span className="block size-full animate-pulse bg-muted" />
                    )}
                  </span>
                  <span className={cn('text-xs tabular-nums', current ? 'text-foreground' : 'text-muted-foreground')}>{index + 1}</span>
                </button>
              </ContextMenu>
            </li>
          )
        })}
      </ol>
      <button
        type="button"
        onClick={onAdd}
        aria-label="Add slide"
        title="Add slide"
        style={{ width, height: THUMB_HEIGHT }}
        className="flex shrink-0 items-center justify-center rounded-md border border-dashed text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Plus className="size-5" aria-hidden />
      </button>
    </div>
  )
}
