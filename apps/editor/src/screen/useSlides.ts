/*
 * The figure's slides in the editor. One FigureCanvas shows the current
 * slide; switching saves what's on it into the list and loads the next one,
 * each slide with its own undo steps. Deleting a slide shows a toast with Undo.
 * Changing the page size scales what's on every slide to fit the new page.
 */
import { useToast } from '@biofigure-lab/ui/components/toast/Toast'
import { useCallback, useRef, useState } from 'react'

import { FigureCanvas } from '../editor/FigureCanvas'
import type { History } from '../editor/history'
import { letterContexts, newSlideCanvas } from '../editor/panel-letters'
import { oneSlide, type Slide } from '../editor/storage'
import { newId } from '../editor/new-id'

export function useSlides(initial: Slide[], figure: FigureCanvas | null) {
  const toasts = useToast()
  const [slides, setSlidesState] = useState(initial)
  const [currentId, setCurrentIdState] = useState(initial[0].id)
  // Refs hold the latest values for switches that wait in the queue.
  const slidesRef = useRef(initial)
  const currentRef = useRef(initial[0].id)
  const histories = useRef(new Map<string, History>())
  // Switches run one after another, so quick clicks never load two slides at once.
  const queue = useRef(Promise.resolve())

  const setSlides = (list: Slide[]) => {
    slidesRef.current = list
    setSlidesState(list)
  }

  /** The slides with the current one as it is on the canvas right now. */
  const withCurrent = useCallback(
    (list: Slide[] = slidesRef.current, thumbnail = false): Slide[] => {
      if (!figure || figure.loading) return list
      return list.map((slide) => {
        if (slide.id !== currentRef.current) return slide
        const canvas = figure.serialize()
        // A sync clash copy stops being marked as one once it's edited.
        const clashCopy = canvas === slide.canvas ? slide.clashCopy : undefined
        return { ...slide, canvas, thumbnail: thumbnail ? figure.thumbnail() : slide.thumbnail, clashCopy }
      })
    },
    [figure],
  )

  /** The slides with a new small picture of the one on the canvas, without turning the page into text again. */
  const withPicture = useCallback(
    (list: Slide[]): Slide[] => (figure && !figure.loading ? list.map((slide) => (slide.id === currentRef.current ? { ...slide, thumbnail: figure.thumbnail() } : slide)) : list),
    [figure],
  )

  /** Show another slide; `change` edits the list first (it gets the list with the current slide up to date). */
  const show = (targetId: string | ((list: Slide[]) => string), change: (list: Slide[]) => Slide[] = (list) => list) => {
    if (!figure) return
    queue.current = queue.current.then(async () => {
      const leaving = currentRef.current
      const next = change(withCurrent(slidesRef.current, true))
      const target = typeof targetId === 'string' ? targetId : targetId(next)
      setSlides(next)
      const slide = next.find((item) => item.id === target)
      if (!slide || target === leaving) return
      currentRef.current = target
      setCurrentIdState(target)
      const left = await figure.showSlide(slide.canvas, histories.current.get(target), lettersOf(next, target))
      histories.current.set(leaving, left)
      histories.current.delete(target)
    })
  }

  const indexOf = (list: Slide[], id: string) => list.findIndex((slide) => slide.id === id)

  /** Where a slide's letters start, from the slides before it (BIO-83). */
  const lettersOf = (list: Slide[], id: string) => letterContexts(list.map((slide) => slide.canvas)).at(indexOf(list, id))

  const add = () => {
    const slide = oneSlide()
    // A new slide starts with the letter look of the slide it follows.
    show(slide.id, (list) => list.toSpliced(indexOf(list, currentRef.current) + 1, 0, { ...slide, canvas: newSlideCanvas(list.at(indexOf(list, currentRef.current))?.canvas) }))
  }

  const duplicate = (id: string) => {
    const copyId = newId()
    show(copyId, (list) => {
      const original = list[indexOf(list, id)]
      return original ? list.toSpliced(indexOf(list, id) + 1, 0, { ...original, id: copyId }) : list
    })
  }

  const move = (id: string, index: number) => {
    const list = slidesRef.current
    const slide = list[indexOf(list, id)]
    if (!slide) return
    const moved = list.filter((item) => item.id !== id).toSpliced(index, 0, slide)
    setSlides(moved)
    // The slide on screen may now come after other letters.
    const letters = lettersOf(moved, currentRef.current)
    if (letters) figure?.setLetterStart(letters)
  }

  const remove = (id: string) => {
    const index = indexOf(slidesRef.current, id)
    if (index < 0 || slidesRef.current.length === 1) return
    let removed: Slide | undefined
    const take = (list: Slide[]) => {
      removed = list[indexOf(list, id)]
      return list.filter((slide) => slide.id !== id)
    }
    if (id === currentRef.current) {
      // Show the neighbour; the removed slide's undo steps stay kept in case of Undo.
      show((list) => list[Math.min(index, list.length - 1)].id, take)
    } else {
      const rest = take(slidesRef.current)
      setSlides(rest)
      const letters = lettersOf(rest, currentRef.current)
      if (letters) figure?.setLetterStart(letters)
    }
    const toastId = toasts.add({
      title: 'Slide deleted',
      actionProps: {
        children: 'Undo',
        onClick: () => {
          toasts.close(toastId)
          // Wait for the delete to finish, then put the slide back where it was.
          queue.current = queue.current.then(() => {
            const slide = removed
            if (slide) show(slide.id, (list) => list.toSpliced(Math.min(index, list.length), 0, slide))
          })
        },
      },
    })
  }

  const step = (by: 1 | -1) => {
    const next = slidesRef.current[indexOf(slidesRef.current, currentRef.current) + by]
    if (next) show(next.id)
  }

  type Size = { width: number; height: number }

  /**
   * Give every slide a new page size (in page pixels): what's on each scales
   * to fit. Resolves to a function that puts the old size, contents and undo
   * steps back, or to undefined when nothing was changed.
   */
  const resizePage = (from: Size, to: Size): Promise<(() => void) | undefined> => {
    if (!figure) return Promise.resolve(undefined)
    const done = queue.current.then(async () => {
      const before = withCurrent(slidesRef.current, true)
      const resizedOn = currentRef.current
      const keptHistories = new Map(histories.current)
      keptHistories.set(resizedOn, figure.setPage(to))
      const contexts = letterContexts(before.map((slide) => slide.canvas))
      const after = await Promise.all(
        before.map(async (slide, i) => {
          if (slide.id === resizedOn) return { ...slide, canvas: figure.serialize(), thumbnail: figure.thumbnail() }
          return slide.canvas ? { ...slide, ...(await FigureCanvas.fitSaved(slide.canvas, from, to, contexts.at(i))) } : slide
        }),
      )
      histories.current.clear()
      setSlides(after)
      return () => {
        queue.current = queue.current.then(async () => {
          // Slides added since stay as they are.
          const old = new Map(before.map((slide) => [slide.id, slide]))
          const list = slidesRef.current.map((slide) => old.get(slide.id) ?? slide)
          setSlides(list)
          figure.setPage(from, false)
          histories.current = keptHistories
          const showing = currentRef.current
          await figure.showSlide(list.find((slide) => slide.id === showing)?.canvas, keptHistories.get(showing), lettersOf(list, showing))
          histories.current.delete(showing)
        })
      }
    })
    queue.current = done.then(
      () => undefined,
      () => undefined,
    )
    return done
  }

  /** Swap in the list with fresh pictures after a save, unless a switch changed it meanwhile. */
  const refresh = (list: Slide[]) => {
    const same = list.length === slidesRef.current.length && list.every((slide, i) => slide.id === slidesRef.current[i]?.id)
    if (same) setSlides(list)
  }

  /**
   * Take the slides as sync wrote them (changes from another device). The slide on the canvas is loaded again
   * when it changed, unless it has edits not saved yet (`keepCanvas`): those stay, and the next save sends them.
   * Slides whose contents changed lose their undo steps. Resolves to the list now shown.
   */
  const applyFromSync = (list: Slide[], keepCanvas: boolean): Promise<Slide[]> => {
    const done = queue.current.then(async () => {
      if (!figure) return slidesRef.current
      const before = new Map(slidesRef.current.map((slide) => [slide.id, slide.canvas]))
      for (const slide of list) if (before.get(slide.id) !== slide.canvas) histories.current.delete(slide.id)
      const showing = currentRef.current
      const incoming = list.find((slide) => slide.id === showing)
      let next = list
      if (!incoming) {
        // The slide on screen was deleted elsewhere: show the first one.
        const first = list[0]
        setSlides(list)
        if (first) {
          currentRef.current = first.id
          setCurrentIdState(first.id)
          await figure.showSlide(first.canvas, histories.current.get(first.id), lettersOf(list, first.id))
          histories.current.delete(first.id)
        }
        return list
      }
      if (keepCanvas) next = withCurrent(list)
      else if (incoming.canvas !== before.get(showing)) await figure.showSlide(incoming.canvas, undefined, lettersOf(next, showing))
      setSlides(next)
      // Slides before this one may have come or gone.
      const letters = lettersOf(next, showing)
      if (letters) figure.setLetterStart(letters)
      return next
    })
    queue.current = done.then(
      () => undefined,
      () => undefined,
    )
    return done
  }

  return { slides, currentId, withCurrent, withPicture, refresh, select: (id: string) => show(id), add, duplicate, move, remove, step, resizePage, applyFromSync }
}
