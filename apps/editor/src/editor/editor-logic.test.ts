import { describe, expect, it } from 'vitest'

import { hexToRgb, parseHex, rgbToHex, toHex } from './colour'
import { resizedScale } from './resize'
import { matchesSearch } from './search'
import { HIT_TOLERANCE_PX, cornerCursor, distanceToPolygon, rotateCursor, distanceToSegment } from './geometry'
import { DEFAULT_SHAPE_STYLE, pressOnObject, shapeAt, shapeFromDrag, toolAfterPlacing } from './shapes'
import { actionForKey, finishesTyping, textActionForKey, type KeyPress } from './shortcuts'
import { fitZoom, formatMm, mmToPx, nextZoom } from './units'

const press = (key: string, extra: Partial<KeyPress> = {}): KeyPress => ({ key, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...extra })

describe('text shortcuts', () => {
  it('styles text with Ctrl or ⌘ + B, I and U', () => {
    expect(textActionForKey(press('b', { ctrlKey: true }), false)).toBe('bold')
    expect(textActionForKey(press('I', { metaKey: true }), true)).toBe('italic')
    expect(textActionForKey(press('u', { ctrlKey: true }), true)).toBe('underline')
    expect(textActionForKey(press('b'), true)).toBeUndefined()
  })

  it('makes sub- and superscripts with Ctrl + = and Ctrl + Shift + = only while typing', () => {
    expect(textActionForKey(press('=', { ctrlKey: true, code: 'Equal' }), true)).toBe('subscript')
    expect(textActionForKey(press('+', { ctrlKey: true, shiftKey: true, code: 'Equal' }), true)).toBe('superscript')
    // Outside typing, Ctrl + = keeps zooming in.
    expect(textActionForKey(press('=', { ctrlKey: true, code: 'Equal' }), false)).toBeUndefined()
  })
})

describe('keyboard shortcuts', () => {
  it('stops typing with Ctrl or ⌘ + Enter, not with plain Enter', () => {
    expect(finishesTyping(press('Enter', { ctrlKey: true }))).toBe(true)
    expect(finishesTyping(press('Enter', { metaKey: true }))).toBe(true)
    expect(finishesTyping(press('Enter'))).toBe(false)
    expect(finishesTyping(press('Enter', { ctrlKey: true, shiftKey: true }))).toBe(false)
  })

  it('picks tools with single letters', () => {
    expect(actionForKey(press('r'))).toEqual({ type: 'tool', tool: 'rectangle' })
    expect(actionForKey(press('V'))).toEqual({ type: 'tool', tool: 'select' })
    expect(actionForKey(press('PageDown'))).toEqual({ type: 'next-slide' })
    expect(actionForKey(press('PageUp'))).toEqual({ type: 'previous-slide' })
    expect(actionForKey(press('q'))).toBeUndefined()
  })

  it('undoes with Ctrl or ⌘ + Z and redoes with Shift or Y', () => {
    expect(actionForKey(press('z', { ctrlKey: true }))).toEqual({ type: 'undo' })
    expect(actionForKey(press('Z', { metaKey: true, shiftKey: true }))).toEqual({ type: 'redo' })
    expect(actionForKey(press('y', { ctrlKey: true }))).toEqual({ type: 'redo' })
  })

  it('does not treat Ctrl + a tool letter as the tool', () => {
    expect(actionForKey(press('r', { ctrlKey: true }))).toBeUndefined()
  })

  it('fits the page with Shift + 1 on any keyboard layout', () => {
    expect(actionForKey(press('!', { shiftKey: true, code: 'Digit1' }))).toEqual({ type: 'zoom-fit' })
  })

  it('copies, cuts, pastes and duplicates with Ctrl or ⌘', () => {
    expect(actionForKey(press('c', { ctrlKey: true }))).toEqual({ type: 'copy' })
    expect(actionForKey(press('x', { metaKey: true }))).toEqual({ type: 'cut' })
    expect(actionForKey(press('v', { ctrlKey: true }))).toEqual({ type: 'paste' })
    expect(actionForKey(press('d', { ctrlKey: true }))).toEqual({ type: 'duplicate' })
  })

  it('groups with Ctrl + G and ungroups with Ctrl + Shift + G', () => {
    expect(actionForKey(press('g', { ctrlKey: true }))).toEqual({ type: 'group' })
    expect(actionForKey(press('G', { ctrlKey: true, shiftKey: true }))).toEqual({ type: 'ungroup' })
  })

  it('deletes with Delete and Backspace', () => {
    expect(actionForKey(press('Delete'))).toEqual({ type: 'delete' })
    expect(actionForKey(press('Backspace'))).toEqual({ type: 'delete' })
  })
})

describe('arrow and layer shortcuts', () => {
  it('picks the arrow tool with A', () => {
    expect(actionForKey(press('a'))).toEqual({ type: 'tool', tool: 'arrow' })
  })

  it('brings to front with Ctrl + ] and sends to back with Ctrl + [', () => {
    expect(actionForKey(press(']', { ctrlKey: true }))).toEqual({ type: 'bring-to-front' })
    expect(actionForKey(press('[', { metaKey: true }))).toEqual({ type: 'send-to-back' })
    expect(actionForKey(press('}', { ctrlKey: true, shiftKey: true, code: 'BracketRight' }))).toEqual({ type: 'bring-forward' })
    expect(actionForKey(press('{', { ctrlKey: true, shiftKey: true, code: 'BracketLeft' }))).toEqual({ type: 'send-backward' })
    expect(actionForKey(press('L', { ctrlKey: true, shiftKey: true }))).toEqual({ type: 'lock' })
    expect(actionForKey(press('a', { ctrlKey: true }))).toEqual({ type: 'select-all' })
  })
})

describe('typed sizes', () => {
  const box = { width: 100, height: 50, scaleX: 1, scaleY: 1 }

  it('changes only the typed side when proportions are free', () => {
    expect(resizedScale(box, { width: 200 }, false)).toEqual({ scaleX: 2, scaleY: 1 })
    expect(resizedScale(box, { height: 25 }, false)).toEqual({ scaleX: 1, scaleY: 0.5 })
  })

  it('scales the other side along when keeping proportions', () => {
    expect(resizedScale(box, { width: 200 }, true)).toEqual({ scaleX: 2, scaleY: 2 })
    expect(resizedScale({ ...box, scaleX: 2, scaleY: 3 }, { height: 75 }, true)).toEqual({ scaleX: 1, scaleY: 1.5 })
  })

  it('leaves a flat line flat and never shrinks to nothing', () => {
    expect(resizedScale({ width: 100, height: 0, scaleX: 1, scaleY: 1 }, { width: 50 }, true)).toEqual({ scaleX: 0.5, scaleY: 0.5 })
    expect(resizedScale(box, { width: 0 }, false).scaleX).toBeGreaterThan(0)
  })
})

describe('units and zoom', () => {
  it('converts mm to px at 96 per inch', () => {
    expect(mmToPx(25.4)).toBeCloseTo(96)
    expect(formatMm(mmToPx(30.54))).toBe('30.5')
  })

  it('steps zoom in and out, also from a zoom between steps', () => {
    expect(nextZoom(1, 'in')).toBe(1.25)
    expect(nextZoom(1, 'out')).toBe(0.75)
    expect(nextZoom(0.9, 'in')).toBe(1)
    expect(nextZoom(4, 'in')).toBe(4)
    expect(nextZoom(0.25, 'out')).toBe(0.25)
  })

  it('fits the page inside the space with a margin', () => {
    expect(fitZoom({ width: 600, height: 400 }, { width: 696, height: 1000 })).toBeCloseTo(1)
    expect(fitZoom({ width: 600, height: 400 }, { width: 10, height: 10 })).toBe(0.25)
  })
})

describe('new shapes', () => {
  it('centres a new rectangle where the page was clicked', () => {
    const shape = shapeAt('rectangle', 200, 100)
    if (shape.kind !== 'rectangle') throw new Error('expected a rectangle')
    expect(shape.left + shape.width / 2).toBeCloseTo(200)
    expect(shape.top + shape.height / 2).toBeCloseTo(100)
    // About 18 mm, down from 20 mm.
    expect(formatMm(shape.width)).toBe('18')
  })

  it('makes a horizontal line through the click', () => {
    const shape = shapeAt('line', 200, 100)
    if (shape.kind !== 'line') throw new Error('expected a line')
    const [x1, y1, x2, y2] = shape.points
    expect((x1 + x2) / 2).toBeCloseTo(200)
    expect([y1, y2]).toEqual([100, 100])
  })
})

describe('drawing by dragging', () => {
  const start = { x: 100, y: 100 }

  it('draws a box from any corner to any corner', () => {
    expect(shapeFromDrag('rectangle', start, { x: 40, y: 160 })).toMatchObject({ left: 40, top: 100, width: 60, height: 60 })
  })

  it('makes an ellipse that fills the dragged box', () => {
    expect(shapeFromDrag('ellipse', start, { x: 180, y: 140 })).toMatchObject({ left: 100, top: 100, rx: 40, ry: 20 })
  })

  it('keeps boxes square with Shift, towards the drag', () => {
    expect(shapeFromDrag('rectangle', start, { x: 60, y: 110 }, true)).toMatchObject({ left: 60, top: 100, width: 40, height: 40 })
  })

  it('draws an arrow from where the drag starts to where it ends', () => {
    expect(shapeFromDrag('arrow', start, { x: 150, y: 130 })).toMatchObject({ kind: 'arrow', points: [100, 100, 150, 130] })
  })

  it('snaps lines to 45° steps with Shift', () => {
    const shape = shapeFromDrag('line', start, { x: 200, y: 108 }, true)
    if (shape.kind !== 'line') throw new Error('expected a line')
    expect(shape.points[3]).toBeCloseTo(100)
    expect(shape.points[2]).toBeCloseTo(100 + Math.hypot(100, 8))
  })
})

describe('hit areas', () => {
  const square = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ]

  it('is 0 inside an object and the edge distance outside', () => {
    expect(distanceToPolygon({ x: 5, y: 5 }, square)).toBe(0)
    expect(distanceToPolygon({ x: 14, y: 5 }, square)).toBeCloseTo(4)
  })

  it('measures lines along the line, not their box', () => {
    const a = { x: 0, y: 0 }
    const b = { x: 100, y: 100 }
    expect(distanceToSegment({ x: 50, y: 52 }, a, b)).toBeLessThan(HIT_TOLERANCE_PX)
    // Inside the line's bounding box but far from the line itself.
    expect(distanceToSegment({ x: 90, y: 10 }, a, b)).toBeGreaterThan(HIT_TOLERANCE_PX)
    expect(distanceToSegment({ x: 103, y: 104 }, a, b)).toBeCloseTo(5)
  })
})

describe('colours', () => {
  it('reads typed hex codes, with or without # and in short form', () => {
    expect(parseHex('1F2937')).toBe('#1f2937')
    expect(parseHex(' #fff ')).toBe('#ffffff')
    expect(parseHex('blue')).toBeUndefined()
  })

  it('turns Fabric colours into hex codes', () => {
    expect(toHex('rgb(255, 0, 16)')).toBe('#ff0010')
    expect(toHex('#ABC')).toBe('#aabbcc')
    expect(toHex(undefined)).toBeUndefined()
  })

  it('converts hex codes to RGB channels and back', () => {
    expect(hexToRgb('#8fc6cc')).toEqual([143, 198, 204])
    expect(rgbToHex([143, 198, 300])).toBe('#8fc6ff')
  })
})

describe('icon search', () => {
  it('matches every typed word at the start of a word', () => {
    expect(matchesSearch('red cell', ['Red blood cell', 'Cells'])).toBe(true)
    expect(matchesSearch('ell', ['Red blood cell'])).toBe(false)
    expect(matchesSearch('  ', ['Anything'])).toBe(true)
  })
})


describe('shapes and arrows from the panels', () => {
  const choice = { shape: 'star' as const, look: { route: 'elbow' as const, line: 'dotted' as const, start: 'none' as const, end: 'inhibition' as const, mid: 'none' as const }, style: DEFAULT_SHAPE_STYLE }

  it('gives new shapes the look and size set in the Shapes panel', () => {
    const style = { ...DEFAULT_SHAPE_STYLE, fill: '#ff0000', opacity: 0.5, textFit: 'wrap' as const, size: { width: 80, height: 40 } }
    expect(shapeAt('shape', 100, 100, { ...choice, style })).toMatchObject({ fill: '#ff0000', opacity: 0.5, textFit: 'wrap', left: 60, top: 80, width: 80, height: 40 })
    expect(shapeFromDrag('rectangle', { x: 0, y: 0 }, { x: 10, y: 10 }, false, { ...choice, style })).toMatchObject({ fill: '#ff0000', opacity: 0.5 })
  })

  it('draws the shape picked in the Shapes panel', () => {
    expect(shapeFromDrag('shape', { x: 10, y: 10 }, { x: 50, y: 30 }, false, choice)).toMatchObject({ kind: 'path', shape: 'star', left: 10, top: 10, width: 40, height: 20 })
  })

  it('draws the arrow picked in the Arrows panel', () => {
    expect(shapeAt('arrow', 0, 0, choice)).toMatchObject({ kind: 'arrow', look: choice.look })
  })

  it('places brackets tall and thin', () => {
    const bracket = shapeAt('shape', 0, 0, { ...choice, shape: 'bracket' })
    expect(bracket.kind === 'path' && bracket.height > bracket.width).toBe(true)
  })
})

describe('placing a shape and then grabbing it (bug: clicking a placed square added a new one)', () => {
  it('grabs an existing object instead of drawing a new shape on it', () => {
    expect(pressOnObject('rectangle')).toBe('select')
    expect(pressOnObject('shape')).toBe('select')
  })

  it('still starts arrows and lines on objects, so they can stick to them', () => {
    expect(pressOnObject('arrow')).toBe('draw')
    expect(pressOnObject('line')).toBe('draw')
  })

  it('goes back to Select after placing one shape, but keeps the arrow tool on', () => {
    expect(toolAfterPlacing('rectangle')).toBe('select')
    expect(toolAfterPlacing('shape')).toBe('select')
    expect(toolAfterPlacing('arrow')).toBe('arrow')
  })
})

describe('corner resize cursor', () => {
  it('shows a diagonal arrow on every corner, whatever the shape is like', () => {
    expect(cornerCursor({ x: -0.5, y: -0.5 }, 0)).toBe('nw-resize')
    expect(cornerCursor({ x: 0.5, y: -0.5 }, 0)).toBe('ne-resize')
    expect(cornerCursor({ x: 0.5, y: 0.5 }, 0)).toBe('se-resize')
    expect(cornerCursor({ x: -0.5, y: 0.5 }, 0)).toBe('sw-resize')
  })

  it('turns with the shape and follows flips', () => {
    expect(cornerCursor({ x: 0.5, y: 0.5 }, 90)).toBe('sw-resize')
    expect(cornerCursor({ x: 0.5, y: 0.5 }, 45)).toBe('s-resize')
    expect(cornerCursor({ x: 0.5, y: 0.5 }, 0, true)).toBe('sw-resize')
  })
})

describe('corner rotate cursor', () => {
  const turn = (cursor: string) => /rotate\((\d+) 12 12\)/.exec(decodeURIComponent(cursor))?.[1]

  it('points the curved arrow away from each corner', () => {
    expect(turn(rotateCursor({ x: 0.5, y: 0.5 }, 0))).toBe('45')
    expect(turn(rotateCursor({ x: -0.5, y: 0.5 }, 0))).toBe('135')
    expect(turn(rotateCursor({ x: -0.5, y: -0.5 }, 0))).toBe('225')
    expect(turn(rotateCursor({ x: 0.5, y: -0.5 }, 0))).toBe('315')
  })

  it('turns with the shape and follows flips', () => {
    expect(turn(rotateCursor({ x: 0.5, y: 0.5 }, 30))).toBe('75')
    expect(turn(rotateCursor({ x: 0.5, y: 0.5 }, 0, true))).toBe('135')
  })

  it('falls back to a plain cursor if the picture cannot load', () => {
    expect(rotateCursor({ x: 0.5, y: 0.5 }, 0)).toMatch(/, grab$/)
  })
})
