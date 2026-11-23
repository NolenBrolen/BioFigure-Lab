// @vitest-environment jsdom
import '../test/canvas-stub'

import { Point, Textbox, util, type FabricObject, type Group, type TPointerEvent } from 'fabric'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { FigureCanvas, type CanvasState } from './FigureCanvas'
import { MIN_FONT_UNITS, fitInto, hitsSlot, slotInGroup } from './icon-text'

// Icons with and without a text slot, in place of library files (bottle icons come from the library itself).
const fixtures = vi.hoisted(() => ({
  'test/bottle': { id: 'test/bottle', name: 'Bottle', textSlot: { x: 20, y: 30, width: 80, height: 30 } },
  'test/bottle-b': { id: 'test/bottle-b', name: 'Bottle B', textSlot: { x: 20, y: 30, width: 80, height: 30 } },
  'test/plain': { id: 'test/plain', name: 'Plain' },
  'test/slanted': { id: 'test/slanted', name: 'Slanted', textSlot: { x: 20, y: 30, width: 80, height: 30, skewY: 20 } },
  'test/named': { id: 'test/named', name: 'Named', textSlot: { x: 20, y: 30, width: 80, height: 30, defaultText: 'Ethanol' } },
}))

vi.mock('./icon-library', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./icon-library')>()
  return { ...actual, iconById: (id: string) => (id in fixtures ? (fixtures as Record<string, unknown>)[id] : actual.iconById(id)) }
})

// The body is off-centre on the grid (its middle is 60, 70), so the slot has to be mapped, not just centred on the group.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect x="20" y="30" width="80" height="30" fill="#345544"/><rect x="40" y="70" width="20" height="40" fill="#345544"/></svg>`
const library = (id: string) => (id === 'test/bottle-b' ? { svg, name: 'Bottle B' } : undefined)
const settle = () => new Promise((resolve) => setTimeout(resolve))

let figure: FigureCanvas | undefined
afterEach(async () => {
  await figure?.dispose()
  figure = undefined
})

async function placeBottle(id = 'test/bottle'): Promise<{ figure: FigureCanvas; icon: Group; state: () => CanvasState | undefined }> {
  const element = document.createElement('canvas')
  document.body.append(element)
  figure = new FigureCanvas(element, { width: 1000, height: 800 })
  let state: CanvasState | undefined
  figure.subscribe((next) => (state = next))
  await figure.addSvg(svg, 'Bottle', { x: 300, y: 200 }, 74, id)
  const icon = figure.canvas.getObjects()[0] as Group
  figure.canvas.setActiveObject(icon)
  return { figure, icon, state: () => state }
}

type Own = FabricObject & { slotText?: string; slotShown?: boolean }
const markup = (f: FigureCanvas) => f.toSVG()

describe('text slots on icons', () => {
  it('maps the slot from the SVG grid into the icon group, wherever the shapes sit on the grid', async () => {
    const { icon } = await placeBottle()
    // The slot is the first rectangle's area, so it must land exactly on that shape.
    const body = icon.getObjects()[0]!
    const middle = body.getRelativeCenterPoint()
    expect(slotInGroup(icon)).toEqual({ x: middle.x, y: middle.y, width: body.width, height: body.height })
  })

  it('shows the field only for an icon with a slot, and keeps text and the shown flag through saving and reopening', async () => {
    const { figure, state } = await placeBottle()
    expect(state()?.selection?.slot).toEqual({ text: 'Label', shown: true })
    await figure.setIconText('Ethanol 70%', true)
    await figure.setIconText('Ethanol 70%', false)
    const saved = figure.serialize()
    expect((JSON.parse(saved) as { objects: unknown[] }).objects[0]).toMatchObject({ slotText: 'Ethanol 70%', slotShown: false })
    const element = document.createElement('canvas')
    document.body.append(element)
    const reopened = new FigureCanvas(element, { width: 1000, height: 800 }, saved)
    await settle()
    expect(reopened.canvas.getObjects()[0]).toMatchObject({ slotText: 'Ethanol 70%', slotShown: false })
    await reopened.dispose()

    // An icon without a slot has no text settings, and typing does nothing to it.
    const plain = await placeBottle('test/plain')
    expect(plain.state()?.selection?.slot).toBeNull()
    await plain.figure.setIconText('x', true)
    expect((plain.icon as Own).slotText).toBeUndefined()
  })

  it('is one undo step per save, and undo brings back the old text', async () => {
    const { figure, icon } = await placeBottle()
    await figure.setIconText('A', true)
    // Typing changes the page at once but saves nothing until the field is left.
    await figure.setIconText('AB', true, false)
    await figure.setIconText('ABC', true, false)
    expect((icon as Own).slotText).toBe('ABC')
    figure.saveIconText()
    figure.undo()
    await settle()
    expect((figure.canvas.getObjects()[0] as Own).slotText).toBe('A')
    figure.redo()
    await settle()
    expect((figure.canvas.getObjects()[0] as Own).slotText).toBe('ABC')
  })

  it('copies with the icon and stays when the icon is swapped for another', async () => {
    const { figure } = await placeBottle()
    await figure.setIconText('Water', true)
    await figure.copy()
    await figure.paste()
    const [, pasted] = figure.canvas.getObjects() as Own[]
    expect(pasted).toMatchObject({ slotText: 'Water', slotShown: true })

    figure.canvas.setActiveObject(figure.canvas.getObjects()[0]!)
    await figure.swapIcon('test/bottle-b', library)
    const swapped = figure.canvas.getObjects()[0] as Own & { iconId?: string }
    expect(swapped.iconId).toBe('test/bottle-b')
    expect(swapped.slotText).toBe('Water')
    // Its slot is mapped from the new icon's own origin.
    expect(slotInGroup(swapped)).toBeDefined()
  })

  it('exports the text only when it is shown and not empty, and recolouring leaves its colour alone', async () => {
    const { figure } = await placeBottle()
    await figure.setIconText('', true)
    expect(markup(figure)).not.toContain('<text')
    await figure.setIconText('Water', true)
    const shown = markup(figure)
    expect(shown).toContain('<text')
    expect(shown).toContain('Water')
    expect(shown).toContain('rgb(32,36,42)')
    figure.change({ fill: '#ff0000' })
    figure.setIconColourMode('grey')
    expect(markup(figure)).toContain('rgb(32,36,42)')
    await figure.setIconText('Water', false)
    expect(markup(figure)).not.toContain('<text')
    await figure.setIconText('   ', true)
    expect(markup(figure)).not.toContain('<text')
  })

  it('slants the text with a slanted label: the export carries the slant and the click area follows it', async () => {
    const { figure, icon } = await placeBottle('test/slanted')
    await figure.setIconText('Water', true)
    expect(markup(figure)).toContain('skewY(20)')
    const slot = slotInGroup(icon)!
    const at = (dx: number, dy: number) => util.transformPoint(new Point(slot.x + dx, slot.y + dy), icon.calcTransformMatrix())
    const rise = Math.tan((20 * Math.PI) / 180) * slot.width * 0.4
    // On the right half the label has run down by the slant: a point there is inside, and the same height without the slant is not.
    expect(hitsSlot(icon, at(slot.width * 0.4, slot.height * 0.4 + rise))).toBe(true)
    expect(hitsSlot(icon, at(slot.width * 0.4, -slot.height * 0.4))).toBe(false)
    // A straight label has no slant in its export.
    const straight = await placeBottle('test/bottle')
    await straight.figure.setIconText('Water', true)
    expect(markup(straight.figure)).not.toContain('skewY')
  })

  it('does not change the icon\'s size or bounds when its text is shown, hidden or typed', async () => {
    const { figure, icon } = await placeBottle()
    const size = () => ({ w: icon.width, h: icon.height, sx: icon.scaleX, sy: icon.scaleY, box: icon.getBoundingRect() })
    const before = size()
    await figure.setIconText('Pneumonoultramicroscopicsilicovolcano', true)
    await figure.setIconText('Pneumonoultramicroscopicsilicovolcano', false)
    expect(size()).toEqual(before)
  })

  it('starts a placed icon with the word Label, or the text its library entry names, and swapping keeps typed text', async () => {
    const { icon } = await placeBottle()
    expect(icon as Own).toMatchObject({ slotText: 'Label', slotShown: true })
    const named = await placeBottle('test/named')
    expect(named.icon as Own).toMatchObject({ slotText: 'Ethanol', slotShown: true })
    // An icon without a slot has no text at all.
    expect(((await placeBottle('test/plain')).icon as Own).slotText).toBeUndefined()
  })

  it('breaks lines where Enter was typed, and shrinks to fit every line in the slot', async () => {
    const { figure } = await placeBottle()
    const lines = () => (markup(figure).match(/<tspan/g) ?? []).length
    const size = () => Number(/font-size="([\d.]+)"/.exec(markup(figure))?.[1])
    await figure.setIconText('Ab', true)
    const oneLine = size()
    expect(lines()).toBe(1)
    await figure.setIconText('Ab\nCd', true)
    expect(lines()).toBe(2)
    await figure.setIconText('Ab\nCd\nEf\nGh\nIj', true)
    expect(lines()).toBe(5)
    expect(size()).toBeLessThan(oneLine)
  })

  describe('fitting long text', () => {
    // The test canvas measures a character as 0.05 of the font size wide, so these slots are narrow in proportion.
    const fit = (text: string, width: number) => {
      const box = new Textbox(text, { width, fontSize: 18, lineHeight: 1.16 })
      fitInto(box, width, 30, MIN_FONT_UNITS)
      return { box, lines: box.textLines }
    }
    const LONG = 'Pneumonoultramicroscopicsilicovolcano'

    it('breaks a single word wider than the slot at the smallest size by character, within the slot width', () => {
      const { box, lines } = fit(LONG, 0.5)
      expect(box.splitByGrapheme).toBe(true)
      expect(lines.length).toBeGreaterThan(1)
      expect(lines.join('')).toBe(LONG)
      for (let i = 0; i < lines.length; i++) expect(box.getLineWidth(i)).toBeLessThanOrEqual(0.5)
    })

    it('shrinks a word that fits at a smaller size instead of breaking it, and wraps normal text at word boundaries only', () => {
      expect(fit(LONG, 4).lines).toEqual([LONG])
      const { box, lines } = fit('Ethanol and water', 4)
      expect(box.splitByGrapheme).toBe(false)
      expect(lines.join(' ')).toBe('Ethanol and water')
      expect(lines.length).toBeGreaterThan(1)
    })

    it('never shrinks below the floor', () => {
      expect(fit(LONG, 0.5).box.fontSize).toBeGreaterThanOrEqual(MIN_FONT_UNITS)
      expect(fit(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].join('\n'), 4).box.fontSize).toBeGreaterThanOrEqual(MIN_FONT_UNITS)
    })
  })

  describe('double-clicking the label', () => {
    /** A page point: the middle of the slot, or the same point `down` grid units lower (on the bottle's body, outside the slot). */
    const pointOf = (icon: Group, down = 0) => {
      const slot = slotInGroup(icon)!
      return util.transformPoint(new Point(slot.x, slot.y + down), icon.calcTransformMatrix())
    }
    const dblclick = (figure: FigureCanvas, icon: Group, scenePoint: Point) =>
      figure.canvas.fire('mouse:dblclick', { e: new MouseEvent('dblclick') as unknown as TPointerEvent, target: icon, scenePoint } as never)

    it('types in place, keeps the text on screen live, and saves one undo step when typing ends', async () => {
      const { figure, icon, state } = await placeBottle()
      await figure.setIconText('Label', false)
      dblclick(figure, icon, pointOf(icon))
      const box = figure.canvas.getActiveObject() as Textbox
      expect(box).toBeInstanceOf(Textbox)
      expect(box.isEditing).toBe(true)
      // Hidden text is shown again, and the Icons panel still shows the icon, not the box.
      expect((icon as Own).slotShown).toBe(true)
      expect(state()?.selection?.kind).toBe('icon')

      box.text = 'Ethanol 70%'
      box.fire('changed')
      expect(state()?.selection?.slot?.text).toBe('Ethanol 70%')
      figure.canvas.discardActiveObject()
      await settle()
      expect(box.isEditing).toBe(false)
      expect(figure.canvas.getObjects()).toEqual([icon])
      expect((icon as Own).slotText).toBe('Ethanol 70%')
      figure.undo()
      await settle()
      expect((figure.canvas.getObjects()[0] as Own).slotText).toBe('Label')
    })

    it('does nothing for a double-click elsewhere on the icon, or on a locked icon', async () => {
      const { figure, icon } = await placeBottle()
      dblclick(figure, icon, pointOf(icon, 60))
      expect(figure.canvas.getActiveObject()).toBe(icon)
      expect((figure.canvas.getActiveObject() as Textbox).isEditing).toBeFalsy()
      Object.assign(icon, { locked: true })
      dblclick(figure, icon, pointOf(icon))
      expect(figure.canvas.getActiveObject()).toBe(icon)
    })
  })
})
