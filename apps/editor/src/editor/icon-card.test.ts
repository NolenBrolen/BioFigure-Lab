// @vitest-environment jsdom
import '../test/canvas-stub'

import { FabricText, Rect, type FabricObject, type Group } from 'fabric'
import { afterEach, describe, expect, it } from 'vitest'

import { FigureCanvas, type CanvasState } from './FigureCanvas'
import { IconCard, bakeCardScale, cardIcon, cardLayout, styleSettings, whiteReads } from './icon-card'

let figure: FigureCanvas | undefined

afterEach(async () => {
  await figure?.dispose()
  figure = undefined
})

function makeFigure(): FigureCanvas {
  const element = document.createElement('canvas')
  document.body.append(element)
  figure = new FigureCanvas(element, { width: 1000, height: 800 })
  return figure
}

/** What the panels were last told. */
let shown: CanvasState | undefined

const settle = () => new Promise((resolve) => setTimeout(resolve))

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="100" fill="#0072b2"/><circle cx="64" cy="114" r="14" fill="#56b4e9"/></svg>`

/** A figure with one icon, selected. */
async function withIcon() {
  const f = makeFigure()
  f.subscribe((next) => (shown = next))
  await f.addSvg(SVG, 'Antibody', { x: 300, y: 200 })
  const icon = f.canvas.getObjects()[0]!
  f.canvas.setActiveObject(icon)
  return { f, icon }
}

const only = (f: FigureCanvas) => f.canvas.getObjects()[0]!
const frameRect = (card: IconCard) => card.getObjects().find((part): part is Rect => part instanceof Rect)!

describe('card layout', () => {
  const icon = { width: 60, height: 60 }
  const caption = { width: 50, height: 14 }

  it('keeps the padding on every side, and puts a caption below, inside or beside', () => {
    const tile = cardLayout(icon, undefined, { ...styleSettings('tile', '#0072b2'), padding: 10 })
    expect(tile.frame).toMatchObject({ width: 80, height: 80 })
    // Under the frame: the card gets taller, the frame stays around the icon only.
    const below = cardLayout(icon, caption, { ...styleSettings('outlined', '#0072b2'), padding: 10 })
    expect(below.frame.height).toBe(80)
    expect(below.height).toBeGreaterThan(80 + caption.height)
    expect(below.caption!.y).toBeGreaterThan(below.frame.height)
    // Inside: the frame grows to hold the caption under the icon.
    const inside = cardLayout(icon, caption, { ...styleSettings('tile', '#0072b2'), padding: 10 })
    expect(inside.frame.height).toBeGreaterThan(80 + caption.height)
    expect(inside.caption!.y).toBeGreaterThan(inside.icon.y)
    // Beside: a wide chip with the caption to the right of the icon.
    const chip = cardLayout(icon, caption, styleSettings('chip', '#0072b2'))
    expect(chip.width).toBeGreaterThan(chip.height)
    expect(chip.caption!.x).toBeGreaterThan(chip.icon.x)
  })

  it('a header card puts the caption in a strip across the top, above the icon', () => {
    const card = cardLayout(icon, caption, styleSettings('header', '#0072b2'))
    expect(card.header).toMatchObject({ x: 0, y: 0, width: card.width })
    expect(card.caption!.y).toBeLessThan(card.header!.height)
    expect(card.icon.y).toBeGreaterThan(card.header!.height)
  })
})

describe('framing an icon', () => {
  it('Add frame puts the icon in a card where it was, captioned with its name; Remove frame and Undo give the plain icon back', async () => {
    const { f, icon } = await withIcon()
    const middle = icon.getCenterPoint()
    const id = (icon as FabricObject & { figureId?: string }).figureId
    f.addFrame('tile')
    const card = only(f)
    expect(card).toBeInstanceOf(IconCard)
    expect(f.canvas.getObjects()).toHaveLength(1)
    expect(card.getCenterPoint().x).toBeCloseTo(middle.x, 0)
    expect(card.getCenterPoint().y).toBeCloseTo(middle.y, 0)
    // Arrows stuck to the icon now stick to the card.
    expect((card as FabricObject & { figureId?: string }).figureId).toBe(id)
    expect((card as IconCard).cardCaption).toBe('Antibody')
    // The panel sees an icon with a frame.
    expect(shown?.selection).toMatchObject({ kind: 'icon', frame: { style: 'tile', captionText: 'Antibody' } })

    f.removeFrame()
    const loose = only(f)
    expect(loose).not.toBeInstanceOf(IconCard)
    expect((loose as FabricObject & { figureId?: string }).figureId).toBe(id)
    expect(loose.getCenterPoint().x).toBeCloseTo(middle.x, 0)
    expect(shown?.selection).toMatchObject({ kind: 'icon', frame: null })

    // Undo brings the frame back, redo takes it off: one step each, settings and caption kept.
    f.undo()
    await settle()
    expect(only(f)).toBeInstanceOf(IconCard)
    expect((only(f) as IconCard).cardFrame?.style).toBe('tile')
    expect((only(f) as IconCard).cardCaption).toBe('Antibody')
  })

  it('resizing a card makes the icon bigger but keeps the padding and caption size', async () => {
    const { f } = await withIcon()
    f.addFrame('outlined')
    const before = only(f) as IconCard
    const iconBefore = cardIcon(before)!.getScaledWidth()
    f.canvas.setActiveObject(before)
    f.resize({ width: before.getScaledWidth() * 2 }, true)
    const after = only(f) as IconCard
    expect(after.scaleX).toBe(1)
    const icon = cardIcon(after)!
    expect(icon.getScaledWidth()).toBeGreaterThan(iconBefore * 1.5)
    // The frame is the icon plus the padding on each side, still.
    expect(frameRect(after).width - icon.getScaledWidth()).toBeCloseTo(2 * after.cardFrame!.padding, 0)
  })

  it('the colour field recolours the icon inside, not its frame; frame settings and caption change one undo step at a time', async () => {
    const { f } = await withIcon()
    f.addFrame('tile')
    const fillBefore = frameRect(only(f) as IconCard).fill
    f.change({ fill: '#d55e00' })
    const card = only(f) as IconCard
    expect(frameRect(card).fill).toBe(fillBefore)
    const parts = (cardIcon(card) as Group).getObjects()
    expect(parts.some((part) => part.fill === '#d55e00')).toBe(true)

    f.setFrame({ padding: 20 })
    expect(frameRect(only(f) as IconCard).width - cardIcon(only(f) as IconCard)!.getScaledWidth()).toBeCloseTo(40, 0)
    f.setCaption('IgG')
    f.setCaption('IgG1')
    expect((only(f) as IconCard).cardCaption).toBe('IgG1')
    // Typing the caption is one step: undo goes back to the name, then to the old padding.
    f.undo()
    await settle()
    expect((only(f) as IconCard).cardCaption).toBe('Antibody')
    expect((only(f) as IconCard).cardFrame?.padding).toBe(20)
  })

  it('dragging a side handle lays the card out again on the spot: the caption never stretches, the icon grows evenly, the far side stays put', async () => {
    const { f } = await withIcon()
    f.addFrame('header')
    const card = only(f) as IconCard
    const left = card.getBoundingRect().left
    const iconBefore = cardIcon(card)!
    const widthBefore = iconBefore.getScaledWidth()
    const heightBefore = iconBefore.getScaledHeight()
    // Mid-drag: Fabric has stretched the card twice as wide from its right handle.
    card.set({ scaleX: 2 })
    bakeCardScale(card, 'left', 'center', 'mr')
    expect(only(f)).toBe(card)
    expect(card.scaleX).toBe(1)
    expect(card.scaleY).toBe(1)
    const caption = card.getObjects().find((part): part is FabricText => part instanceof FabricText)!
    expect(caption.scaleX * card.scaleX).toBe(1)
    const icon = cardIcon(card)!
    expect(icon.getScaledWidth()).toBeCloseTo(widthBefore * 2, 0)
    expect(icon.getScaledHeight()).toBeCloseTo(heightBefore * 2, 0)
    expect(card.getBoundingRect().left).toBeCloseTo(left, 0)
  })

  it('the Text tab styles the whole caption: it stays styled through a resize, and undo takes it back', async () => {
    const { f } = await withIcon()
    f.addFrame('outlined')
    await f.setCaptionStyle({ size: 20, colour: '#d55e00', italic: true })
    const caption = () => (only(f) as IconCard).getObjects().find((part): part is FabricText => part instanceof FabricText)!
    expect(caption()).toMatchObject({ fontSize: 20, fill: '#d55e00', fontStyle: 'italic' })
    expect(shown?.selection).toMatchObject({ frame: { captionStyle: { size: 20, colour: '#d55e00', italic: true } } })
    const card = only(f) as IconCard
    card.set({ scaleX: 1.5, scaleY: 1.5 })
    bakeCardScale(card, 'center', 'center')
    expect(caption()).toMatchObject({ fontSize: 20, scaleX: 1 })
    f.undo()
    await settle()
    expect(caption().fontSize).toBe(12)
  })

  it('a header strip in a light colour gets black text, a dark one white', () => {
    expect(whiteReads('#f0e442')).toBe(false)
    expect(whiteReads('#0072b2')).toBe(true)
  })

  it('switching style keeps colours picked from a preset; untouched colours follow the new style', async () => {
    const { f } = await withIcon()
    f.addFrame('tile')
    f.addFrame('outlined')
    expect((only(f) as IconCard).cardFrame).toMatchObject({ style: 'outlined', fill: '#ffffff' })
    f.setFrame({ fill: '#f8e2b2', outline: '#e69f00' })
    f.addFrame('circle')
    expect((only(f) as IconCard).cardFrame).toMatchObject({ style: 'circle', shape: 'circle', fill: '#f8e2b2', outline: '#e69f00' })
  })
})
