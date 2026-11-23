// @vitest-environment jsdom
import '../test/canvas-stub'

import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { FigureCanvas } from '../editor/FigureCanvas'
import { usePinchZoom } from './usePinchZoom'

let figure: FigureCanvas | undefined

afterEach(async () => {
  cleanup()
  await figure?.dispose()
  figure = undefined
  document.body.innerHTML = ''
})

type Finger = { id: number; x: number; y: number }

/** A touch event the way a phone sends it: every finger down, and the ones that just changed. */
function touch(type: string, target: EventTarget, down: Finger[], changed: Finger[]) {
  const list = (fingers: Finger[]) => fingers.map(({ id, x, y }) => ({ identifier: id, clientX: x, clientY: y, pageX: x, pageY: y, target }))
  const event = new Event(type, { bubbles: true, cancelable: true })
  const touchList = (fingers: Finger[]) => Object.assign(list(fingers), { item: (i: number) => list(fingers)[i] ?? null })
  Object.defineProperties(event, { touches: { value: touchList(down) }, changedTouches: { value: touchList(changed) } })
  target.dispatchEvent(event)
}

/** The phone screen: a scrolling space around the canvas, with a 200 × 100 box at 100, 100 selected. */
function setUp() {
  const space = document.createElement('div')
  const host = document.createElement('div')
  const element = document.createElement('canvas')
  host.append(element)
  space.append(host)
  document.body.append(space)
  figure = new FigureCanvas(element, { width: 1000, height: 800 })
  const box = figure.addShape({ kind: 'rectangle', left: 100, top: 100, width: 200, height: 100, fill: '#dbeafe', stroke: '#1f2937', strokeWidth: 1.5 })
  figure.canvas.renderAll()
  renderHook(() => usePinchZoom({ current: space }, { current: host }, figure!, true, () => 1))
  return { figure, box, upper: figure.canvas.upperCanvasEl }
}

describe('pinching on a phone', () => {
  it('resizes the selection when both fingers land at once (bug: it zoomed the page)', () => {
    const { figure, box, upper } = setUp()
    figure.canvas.discardActiveObject()
    // The tap that selects the box.
    const tap = { id: 1, x: 200, y: 150 }
    touch('touchstart', upper, [tap], [tap])
    figure.canvas.setActiveObject(box)
    touch('touchend', upper, [], [tap])
    const zoom = figure.zoom
    const [a, b] = [{ id: 2, x: 150, y: 150 }, { id: 3, x: 250, y: 150 }]
    touch('touchstart', upper, [a, b], [a, b])
    const wider = [{ ...a, x: 100 }, { ...b, x: 300 }]
    touch('touchmove', upper, wider, wider)
    touch('touchend', upper, [], wider)
    expect(box.scaleX).toBeCloseTo(2)
    expect(figure.zoom).toBe(zoom)
  })

  it('keeps the selection when the fingers land one by one beside it', () => {
    const { figure, box, upper } = setUp()
    figure.canvas.setActiveObject(box)
    const a = { id: 1, x: 600, y: 500 }
    const b = { id: 2, x: 700, y: 500 }
    touch('touchstart', upper, [a], [a])
    touch('touchstart', upper, [a, b], [b])
    touch('touchmove', upper, [{ ...a, x: 550 }, { ...b, x: 750 }], [{ ...a, x: 550 }, { ...b, x: 750 }])
    touch('touchend', upper, [], [a, b])
    expect(figure.canvas.getActiveObject()).toBe(box)
    expect(box.scaleX).toBeCloseTo(2)
  })

  it('zooms the page when nothing is selected', () => {
    const { figure, box, upper } = setUp()
    figure.canvas.discardActiveObject()
    const zoom = figure.zoom
    const [a, b] = [{ id: 1, x: 600, y: 500 }, { id: 2, x: 700, y: 500 }]
    touch('touchstart', upper, [a, b], [a, b])
    touch('touchmove', upper, [{ ...a, x: 550 }, { ...b, x: 750 }], [{ ...a, x: 550 }, { ...b, x: 750 }])
    touch('touchend', upper, [], [a, b])
    expect(figure.zoom).toBeGreaterThan(zoom)
    expect(box.scaleX).toBe(1)
  })

  it('redraws the canvas only when the fingers lift, and springs back to fit from below it', () => {
    const { figure, upper } = setUp()
    figure.canvas.discardActiveObject()
    const fit = figure.zoom
    const [a, b] = [{ id: 1, x: 500, y: 500 }, { id: 2, x: 700, y: 500 }]
    touch('touchstart', upper, [a, b], [a, b])
    const pinchedIn = [{ ...a, x: 560 }, { ...b, x: 640 }]
    touch('touchmove', upper, pinchedIn, pinchedIn)
    // While pinching only the page's frame is stretched on screen.
    expect(figure.zoom).toBe(fit)
    expect(figure.canvas.upperCanvasEl.closest('div:not(.canvas-container)')?.parentElement?.style.transform).toMatch(/scale\(0\.\d+\)/)
    touch('touchend', upper, [], pinchedIn)
    expect(figure.zoom).toBe(fit)
  })

  it('hides the quick-actions bar while resizing, without updating the panels at every step', () => {
    const { figure, box, upper } = setUp()
    figure.canvas.setActiveObject(box)
    const states: boolean[] = []
    figure.subscribe((state) => states.push(state.transforming))
    states.length = 0
    const [a, b] = [{ id: 1, x: 150, y: 150 }, { id: 2, x: 250, y: 150 }]
    touch('touchstart', upper, [a, b], [a, b])
    for (let step = 1; step <= 10; step++) {
      const apart = [{ ...a, x: 150 - step * 5 }, { ...b, x: 250 + step * 5 }]
      touch('touchmove', upper, apart, apart)
    }
    // Once when the fingers land (bar hidden), then nothing until they lift (bar back, new size).
    expect(states).toEqual([true])
    touch('touchend', upper, [], [a, b])
    expect(states.at(-1)).toBe(false)
  })

  it('ignores a tap and the long-press menu right after a pinch (bug: More actions opened by accident)', () => {
    const { figure, upper } = setUp()
    figure.canvas.discardActiveObject()
    const button = document.createElement('button')
    let clicks = 0
    button.addEventListener('click', () => clicks++)
    document.body.append(button)
    let menuCancelled = false
    // The right-click menu listens on the scrolling space around the canvas.
    document.body.firstElementChild?.addEventListener('touchcancel', () => (menuCancelled = true))
    const [a, b] = [{ id: 1, x: 500, y: 500 }, { id: 2, x: 700, y: 500 }]
    touch('touchstart', upper, [a, b], [a, b])
    expect(menuCancelled).toBe(true)
    touch('touchend', upper, [], [a, b])
    button.click()
    expect(clicks).toBe(0)
  })
})
