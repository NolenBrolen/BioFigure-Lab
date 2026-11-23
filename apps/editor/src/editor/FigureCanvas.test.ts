// @vitest-environment jsdom
import '../test/canvas-stub'

import { IText, Rect, type FabricObject, type Group } from 'fabric'
import { afterEach, describe, expect, it } from 'vitest'

import { FigureCanvas, type CanvasState } from './FigureCanvas'
import { libraryIcons, loadIconSvg } from './icon-library'
import { labelCorners, labelOf, bracketTextArea } from './shape-text'

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

/** Mouse events the way a browser sends them to the canvas: press on it, move and let go anywhere. */
function pointer(figure: FigureCanvas) {
  const upper = figure.canvas.upperCanvasEl
  const at = (type: string, x: number, y: number, target: EventTarget, detail = 1) =>
    target.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, button: 0, buttons: type === 'mouseup' ? 0 : 1, detail }))
  return {
    press: (x: number, y: number) => at('mousedown', x, y, upper),
    move: (x: number, y: number) => at('mousemove', x, y, document),
    release: (x: number, y: number) => at('mouseup', x, y, document),
    click(x: number, y: number) {
      this.press(x, y)
      this.release(x, y)
    },
    drag(from: [number, number], to: [number, number]) {
      this.press(...from)
      for (let step = 1; step <= 5; step++) this.move(from[0] + ((to[0] - from[0]) * step) / 5, from[1] + ((to[1] - from[1]) * step) / 5)
      this.release(...to)
    },
    doubleClick(x: number, y: number) {
      this.click(x, y)
      this.click(x, y)
      at('dblclick', x, y, upper, 2)
    },
  }
}

/** A text 5 px per letter wide (the test canvas measures letters narrowly at small sizes) and 232 px tall, at 50, 50. */
function addText(figure: FigureCanvas): IText {
  const text = figure.addShape({ kind: 'text', left: 50, top: 50, text: 'Hello world', fontSize: 200, fill: '#1f2937' }) as IText
  figure.canvas.renderAll()
  return text
}

describe('moving and editing text with the Select tool', () => {
  it('drags a selected text to move it, without starting to type (bug: it highlighted letters)', () => {
    const f = makeFigure()
    const text = addText(f)
    const mouse = pointer(f)
    mouse.click(62, 100)
    expect(f.canvas.getActiveObject()).toBe(text)
    mouse.drag([62, 100], [162, 150])
    expect(text.isEditing).toBe(false)
    expect(text.left).toBeCloseTo(150)
    expect(text.top).toBeCloseTo(100)
  })

  it('a second click on a selected text keeps it selected as an object', () => {
    const f = makeFigure()
    const text = addText(f)
    const mouse = pointer(f)
    mouse.click(62, 100)
    mouse.click(62, 100)
    expect(f.canvas.getActiveObject()).toBe(text)
    expect(text.isEditing).toBe(false)
  })

  it('a double-click starts typing with the clicked word selected', () => {
    const f = makeFigure()
    const text = addText(f)
    pointer(f).doubleClick(62, 100)
    expect(text.isEditing).toBe(true)
    expect([text.selectionStart, text.selectionEnd]).toEqual([0, 5])
  })

  it('a double tap with a finger starts typing in a text (bug: phones could not edit text)', () => {
    const f = makeFigure()
    const text = addText(f)
    const upper = f.canvas.upperCanvasEl
    const tap = (timeStamp: number) => {
      for (const type of ['mousedown', 'mouseup']) {
        const event = new MouseEvent(type, { clientX: 62, clientY: 100, bubbles: true, button: 0, buttons: type === 'mouseup' ? 0 : 1 })
        Object.defineProperties(event, { pointerType: { value: 'touch' }, timeStamp: { value: timeStamp } })
        ;(type === 'mousedown' ? upper : document).dispatchEvent(event)
      }
    }
    tap(1000)
    tap(1200)
    expect(text.isEditing).toBe(true)
    text.exitEditing()
  })

  it('a drag while typing highlights letters instead of moving the text', () => {
    const f = makeFigure()
    const text = addText(f)
    const mouse = pointer(f)
    mouse.doubleClick(62, 100)
    mouse.drag([86, 100], [97, 100])
    expect(text.left).toBe(50)
    expect([text.selectionStart, text.selectionEnd]).toEqual([7, 9])
  })

  it('Ctrl+Enter stops typing and lets go of the text, like clicking empty page', () => {
    const f = makeFigure()
    const text = addText(f)
    pointer(f).doubleClick(62, 100)
    f.finishTyping()
    expect(text.isEditing).toBe(false)
    expect(f.canvas.getActiveObject()).toBeUndefined()
  })

  it('clicking empty page stops typing', () => {
    const f = makeFigure()
    const text = addText(f)
    const mouse = pointer(f)
    mouse.doubleClick(62, 100)
    mouse.click(900, 700)
    expect(text.isEditing).toBe(false)
  })
})

/** A 200 × 100 rectangle at 100, 100. */
function addBox(figure: FigureCanvas): FabricObject {
  const box = figure.addShape({ kind: 'rectangle', left: 100, top: 100, width: 200, height: 100, fill: '#dbeafe', stroke: '#1f2937', strokeWidth: 1.5 })
  figure.canvas.renderAll()
  return box
}

/** Type into the text being edited, the way Fabric's hidden text field hears it. */
function type(text: IText, characters: string): void {
  text.insertChars(characters, undefined, text.selectionStart, text.selectionEnd)
  text.fire('changed')
}

/** Let Fabric finish its click before the text box over the shape goes. */
const settle = () => new Promise((resolve) => setTimeout(resolve))

describe('text inside shapes', () => {
  it('a double-click on a shape starts typing in it, and the text stays with the shape', async () => {
    const f = makeFigure()
    const box = addBox(f)
    pointer(f).doubleClick(200, 150)
    const editing = f.canvas.getActiveObject() as IText
    expect(editing.isEditing).toBe(true)
    type(editing, 'Nucleus')
    editing.exitEditing()
    await settle()
    expect(labelOf(box)?.text).toBe('Nucleus')
    expect(f.canvas.getActiveObject()).toBe(box)
    // Only the shape is on the page: the typing box is gone.
    expect(f.canvas.getObjects()).toEqual([box])
    expect(f.toSVG()).toContain('Nucleus')
  })

  it("a double tap with a finger on a shape starts typing in it; two slow taps don't", () => {
    const f = makeFigure()
    addBox(f)
    const upper = f.canvas.upperCanvasEl
    const tap = (timeStamp: number) => {
      for (const type of ['mousedown', 'mouseup']) {
        const event = new MouseEvent(type, { clientX: 200, clientY: 150, bubbles: true, button: 0, buttons: type === 'mouseup' ? 0 : 1 })
        Object.defineProperties(event, { pointerType: { value: 'touch' }, timeStamp: { value: timeStamp } })
        ;(type === 'mousedown' ? upper : document).dispatchEvent(event)
      }
    }
    tap(1000)
    tap(2000)
    expect((f.canvas.getActiveObject() as IText).isEditing).toBeFalsy()
    tap(2200)
    const editing = f.canvas.getActiveObject() as IText
    expect(editing.isEditing).toBe(true)
    editing.exitEditing()
  })

  it('undo takes the typed text back out of the shape', async () => {
    const f = makeFigure()
    const box = addBox(f)
    pointer(f).doubleClick(200, 150)
    const editing = f.canvas.getActiveObject() as IText
    type(editing, 'Nucleus')
    editing.exitEditing()
    await settle()
    f.undo()
    await settle()
    expect(labelOf(f.canvas.getObjects()[0]!)).toBeUndefined()
    f.redo()
    await settle()
    expect(labelOf(f.canvas.getObjects()[0]!)?.text).toBe('Nucleus')
    expect(box).toBeDefined()
  })

  it('"Grow shape" makes the shape wider for a long line, keeping its middle, and taller for new lines', () => {
    const f = makeFigure()
    const box = addBox(f)
    pointer(f).doubleClick(200, 150)
    const editing = f.canvas.getActiveObject() as IText
    const middle = box.getCenterPoint().x
    // 16 px letters measure 0.4 px each here, so this line is 240 px long.
    type(editing, 'word '.repeat(120).trim())
    expect(box.width * box.scaleX).toBeGreaterThan(240)
    expect(box.getCenterPoint().x).toBeCloseTo(middle)
    expect(box.height * box.scaleY).toBe(100)
    type(editing, '\na\nb\nc\nd\ne')
    expect(box.height * box.scaleY).toBeGreaterThan(100)
    expect(box.top).toBeCloseTo(100)
  })

  it('"Wrap text" keeps the width, wraps the lines and makes the shape taller', () => {
    const f = makeFigure()
    const box = addBox(f)
    f.setTextFit('wrap')
    pointer(f).doubleClick(200, 150)
    const editing = f.canvas.getActiveObject() as IText
    type(editing, Array.from({ length: 12 }, () => 'word '.repeat(80)).join('\n'))
    expect(box.width * box.scaleX).toBeCloseTo(200)
    expect(box.height * box.scaleY).toBeGreaterThan(200)
    expect(box.top).toBe(100)
  })

  it('"Shrink text" keeps the shape the same size and draws the text smaller', () => {
    const f = makeFigure()
    const box = addBox(f)
    f.setTextFit('shrink')
    pointer(f).doubleClick(200, 150)
    const editing = f.canvas.getActiveObject() as IText
    type(editing, 'a\nb\nc\nd\ne\nf')
    expect(box.height * box.scaleY).toBe(100)
    expect(editing.scaleY).toBeLessThan(1)
    expect(editing.getScaledHeight()).toBeLessThanOrEqual(100)
  })

  it('Ctrl+Enter puts the typed text into the shape and keeps the shape selected', async () => {
    const f = makeFigure()
    const box = addBox(f)
    pointer(f).doubleClick(200, 150)
    type(f.canvas.getActiveObject() as IText, 'Nucleus')
    f.finishTyping()
    await settle()
    expect(labelOf(box)?.text).toBe('Nucleus')
    expect(f.canvas.getObjects()).toEqual([box])
    // Selected, so its properties stay open in the Shapes panel.
    expect(f.canvas.getActiveObject()).toBe(box)
  })

  it('while its side handle is dragged in, a shape stays wide enough for its text (not only once let go)', () => {
    const f = makeFigure()
    const box = addBox(f)
    // 10 px per letter at this size: 170 px wide.
    Object.assign(box, { label: { text: 'Nucleus nucleolus', styles: {}, fontSize: 400, lineHeight: 1, textAlign: 'center' } })
    f.canvas.renderAll()
    const mouse = pointer(f)
    mouse.press(301, 151)
    mouse.move(250, 151)
    mouse.move(150, 151)
    expect(box.width * box.scaleX).toBeGreaterThan(170)
    mouse.release(150, 151)
  })

  it('a shape dragged shorter than its wrapped text gets wider instead of springing back', () => {
    const f = makeFigure()
    const box = addBox(f)
    f.setTextFit('wrap')
    // 1 px per letter and 46 px per line at this size: 300 px, two lines in this shape.
    Object.assign(box, { label: { text: 'word '.repeat(60).trim(), styles: {}, fontSize: 40, textAlign: 'center' } })
    f.canvas.renderAll()
    const mouse = pointer(f)
    // The bottom handle, pulled up until there's room for one line only.
    mouse.press(201, 201)
    mouse.move(201, 180)
    mouse.move(201, 162)
    mouse.release(201, 162)
    expect(box.height * box.scaleY).toBeCloseTo(61, 0)
    expect(box.width * box.scaleX).toBeGreaterThan(300)
  })

  it('lines and arrows take no text', () => {
    const f = makeFigure()
    f.addShape({ kind: 'line', points: [100, 100, 300, 100], stroke: '#000000', strokeWidth: 2 })
    pointer(f).doubleClick(200, 100)
    expect(f.canvas.getActiveObject()).not.toBeInstanceOf(IText)
  })
})

/** A shape on "Shrink text" whose 16 px text (0.4 px per letter here) is too long for one line even at 2 pt, so it wraps in two. */
function shrunkAndWrapped(figure: FigureCanvas): FabricObject {
  const box = addBox(figure)
  figure.canvas.setActiveObject(box)
  figure.setTextFit('shrink')
  Object.assign(box, { label: { text: 'word '.repeat(600).trim(), styles: {}, fontSize: 16, textAlign: 'center' } })
  figure.canvas.renderAll()
  return box
}

describe('switching the fit keeps what is seen', () => {
  it('Shrink to Grow keeps the shrunk size and the line width, and later text makes the shape taller', () => {
    const f = makeFigure()
    const box = shrunkAndWrapped(f)
    f.setTextFit('grow')
    expect(labelOf(box)?.fontSize).toBeCloseTo((2 * 96) / 72)
    expect(box.width * box.scaleX).toBeCloseTo(200)
    expect(box.height * box.scaleY).toBeCloseTo(100)
    pointer(f).doubleClick(200, 150)
    // New lines, since text this small needs a lot of it to fill the shape's height.
    type(f.canvas.getActiveObject() as IText, '\nmore'.repeat(80))
    expect(box.width * box.scaleX).toBeCloseTo(200)
    expect(box.height * box.scaleY).toBeGreaterThan(100)
  })

  it('Shrink to Wrap keeps the shrunk size instead of going back to the bigger one', () => {
    const f = makeFigure()
    const box = shrunkAndWrapped(f)
    f.setTextFit('wrap')
    expect(labelOf(box)?.fontSize).toBeCloseTo((2 * 96) / 72)
    expect(box.width * box.scaleX).toBeCloseTo(200)
    expect(box.height * box.scaleY).toBeCloseTo(100)
  })
})

describe("picking a shape's text with one click", () => {
  /** A selected box holding "Nucleus" in its middle. */
  function selectedBoxWithText(figure: FigureCanvas): FabricObject {
    const box = addBox(figure)
    Object.assign(box, { label: { text: 'Nucleus', styles: {}, fontSize: 16, textAlign: 'center' } })
    figure.canvas.setActiveObject(box)
    figure.canvas.renderAll()
    return box
  }

  it('a click on the text of a selected shape picks it without typing, and styles then go to that text', async () => {
    const f = makeFigure()
    const box = selectedBoxWithText(f)
    let state: CanvasState | undefined
    f.subscribe((next) => (state = next))
    pointer(f).click(200, 150)
    expect(state?.selection?.textPicked).toBe(true)
    expect(f.canvas.getActiveObject()).toBe(box)
    expect(state?.selection?.typingInShape).toBeUndefined()
    await f.changeShapeText({ size: 30 })
    expect(labelOf(box)?.fontSize).toBe(30)
  })

  it('a click beside the text, or on a shape not yet selected, does not pick it', () => {
    const f = makeFigure()
    const box = addBox(f)
    Object.assign(box, { label: { text: 'Nucleus', styles: {}, fontSize: 16, textAlign: 'center' } })
    // A new shape starts selected; this one isn't yet.
    f.canvas.discardActiveObject()
    f.canvas.renderAll()
    let state: CanvasState | undefined
    f.subscribe((next) => (state = next))
    pointer(f).click(200, 150)
    expect(f.canvas.getActiveObject()).toBe(box)
    expect(state?.selection?.textPicked).toBeUndefined()
    pointer(f).click(200, 150)
    expect(state?.selection?.textPicked).toBe(true)
    pointer(f).click(120, 110)
    expect(state?.selection?.textPicked).toBeUndefined()
  })
})

describe('styling while typing in a shape', () => {
  it('on "Shrink text", the panel follows the size the text is drawn at while typing', () => {
    const f = makeFigure()
    const box = addBox(f)
    f.canvas.setActiveObject(box)
    f.setTextFit('shrink')
    let state: CanvasState | undefined
    f.subscribe((next) => (state = next))
    pointer(f).doubleClick(200, 150)
    type(f.canvas.getActiveObject() as IText, 'word '.repeat(150))
    // The shape keeps its size, so nothing else tells the panel the text got smaller.
    expect(state?.selection?.text?.size).toBeLessThan(16)
  })

  it('the panel shows the shape with the look of the text, and colours go to the shape', () => {
    const f = makeFigure()
    const box = addBox(f)
    let state: CanvasState | undefined
    f.subscribe((next) => (state = next))
    pointer(f).doubleClick(200, 150)
    type(f.canvas.getActiveObject() as IText, 'Nucleus')
    f.change({ fill: '#ff0000' })
    expect(state?.selection).toMatchObject({ kind: 'shape', textFit: 'grow', text: { size: 16 } })
    expect(box.fill).toBe('#ff0000')
    expect((f.canvas.getActiveObject() as IText).isEditing).toBe(true)
  })

  it('shrunk text shows the size it is drawn at, and a size set on highlighted letters is the size they get next to the rest', async () => {
    const f = makeFigure()
    addBox(f)
    f.setTextFit('shrink')
    pointer(f).doubleClick(200, 150)
    const editing = f.canvas.getActiveObject() as IText
    // 234 px long at 16 px: drawn at about 0.8 times its size to fit on one line.
    type(editing, 'word '.repeat(117).trim())
    const drawn = f.textStyle()?.size ?? 0
    expect(drawn).toBeCloseTo(16 * editing.scaleX, 1)
    expect(drawn).toBeLessThan(16)
    editing.selectionStart = 0
    editing.selectionEnd = 4
    await f.changeText({ size: 20 })
    expect(editing.getStyleAtPosition(0, true).fontSize! / editing.getStyleAtPosition(10, true).fontSize!).toBeCloseTo(20 / drawn, 1)
  })
})

describe('a selected shape with text, not typed in', () => {
  it('shows the look of its text, and a change goes onto all of it', async () => {
    const f = makeFigure()
    const box = addBox(f)
    let state: CanvasState | undefined
    f.subscribe((next) => (state = next))
    pointer(f).doubleClick(200, 150)
    const editing = f.canvas.getActiveObject() as IText
    type(editing, 'Nucleus')
    editing.exitEditing()
    await settle()
    expect(f.canvas.getActiveObject()).toBe(box)
    expect(state?.selection?.text).toMatchObject({ size: 16, weight: 400 })
    await f.changeText({ weight: 700 })
    expect(labelOf(box)).toMatchObject({ text: 'Nucleus', fontWeight: 700 })
    expect(state?.selection?.text).toMatchObject({ weight: 700 })
  })
})

describe('the text look of a shape, before it holds text', () => {
  it('keeps a look set on a shape without text, and typing starts in it', async () => {
    const f = makeFigure()
    const box = addBox(f)
    f.canvas.setActiveObject(box)
    await f.changeShapeText({ weight: 700 })
    expect(labelOf(box)).toMatchObject({ text: '', fontWeight: 700 })
    pointer(f).doubleClick(200, 150)
    expect((f.canvas.getActiveObject() as IText).fontWeight).toBe(700)
  })

  it('gives the next shape the text look set with nothing selected', async () => {
    const f = makeFigure()
    let state: CanvasState | undefined
    f.subscribe((next) => (state = next))
    await f.changeShapeText({ weight: 700, align: 'left' })
    expect(state?.nextShapeText).toMatchObject({ weight: 700, align: 'left' })
    f.setDrawChoice({ shape: 'rounded' })
    f.setTool('shape')
    pointer(f).click(300, 300)
    expect(labelOf(f.canvas.getActiveObject()!)).toMatchObject({ text: '', fontWeight: 700, textAlign: 'left' })
  })
})

describe('the look of new shapes', () => {
  it('a placed shape takes the look set in the Shapes panel', () => {
    const f = makeFigure()
    f.setDrawChoice({ style: { fill: '#ff0000', opacity: 0.5 } })
    f.setTool('rectangle')
    pointer(f).click(300, 300)
    const placed = f.canvas.getObjects()[0]
    expect(placed?.fill).toBe('#ff0000')
    expect(placed?.opacity).toBe(0.5)
  })

  it('a bracket takes text, beside its point, without growing (and clicking the text picks it)', async () => {
    const f = makeFigure()
    f.setDrawChoice({ shape: 'brace' })
    f.setTool('shape')
    pointer(f).click(300, 300)
    const bracket = f.canvas.getActiveObject()!
    const size = { width: bracket.width * bracket.scaleX, height: bracket.height * bracket.scaleY }
    f.typeInSelectedShape()
    const box = f.canvas.getActiveObject() as IText
    expect(box).toBeInstanceOf(IText)
    box.insertChars('Immune cells', undefined, 0)
    box.fire('changed')
    // The text starts past the bracket's right edge, centred on its height.
    const right = bracket.getBoundingRect().left + bracket.getBoundingRect().width
    expect(box.getBoundingRect().left).toBeGreaterThan(right)
    expect(box.getCenterPoint().y).toBeCloseTo(bracket.getCenterPoint().y)
    f.finishTyping()
    expect(labelOf(bracket)?.text).toBe('Immune cells')
    expect(bracket.width * bracket.scaleX).toBeCloseTo(size.width)
    expect(bracket.height * bracket.scaleY).toBeCloseTo(size.height)
    // A click on the text, outside the bracket's own box, selects the bracket
    // (once the typing box is gone: Fabric is done with the click that ended typing).
    await new Promise((done) => setTimeout(done))
    f.canvas.discardActiveObject()
    f.canvas.renderAll()
    const [topLeft, , bottomRight] = labelCorners(bracket)!
    expect(topLeft!.x).toBeGreaterThan(right)
    pointer(f).click((topLeft!.x + bottomRight!.x) / 2, (topLeft!.y + bottomRight!.y) / 2)
    expect(f.canvas.getActiveObject()).toBe(bracket)
  })

  it('a click in the empty text area beside a placed bracket starts typing there', () => {
    const f = makeFigure()
    f.setDrawChoice({ shape: 'brace' })
    f.setTool('shape')
    pointer(f).click(300, 300)
    const bracket = f.canvas.getActiveObject()!
    f.setTool('select')
    f.canvas.setActiveObject(bracket)
    const [topLeft, , bottomRight] = bracketTextArea(bracket)!.corners
    pointer(f).click((topLeft!.x + bottomRight!.x) / 2, (topLeft!.y + bottomRight!.y) / 2)
    const box = f.canvas.getActiveObject() as IText
    expect(box).toBeInstanceOf(IText)
    expect(box.isEditing).toBe(true)
    expect(box.getBoundingRect().left).toBeGreaterThan(bracket.getBoundingRect().left + bracket.getBoundingRect().width)
  })

  it('a double-click in the empty text area beside a bracket also starts typing (bug: it let go of the bracket)', () => {
    const f = makeFigure()
    f.setDrawChoice({ shape: 'brace' })
    f.setTool('shape')
    pointer(f).click(300, 300)
    const bracket = f.canvas.getActiveObject()!
    f.setTool('select')
    f.canvas.setActiveObject(bracket)
    const [topLeft, , bottomRight] = bracketTextArea(bracket)!.corners
    pointer(f).doubleClick((topLeft!.x + bottomRight!.x) / 2, (topLeft!.y + bottomRight!.y) / 2)
    const box = f.canvas.getActiveObject() as IText
    expect(box).toBeInstanceOf(IText)
    expect(box.isEditing).toBe(true)
  })

  it('a mirrored bracket has its text on the left', () => {
    const f = makeFigure()
    f.setDrawChoice({ shape: 'bracket' })
    f.setTool('shape')
    pointer(f).click(300, 300)
    const bracket = f.canvas.getActiveObject()!
    bracket.set({ flipX: true })
    f.typeInSelectedShape()
    const box = f.canvas.getActiveObject() as IText
    box.insertChars('Label', undefined, 0)
    box.fire('changed')
    expect(box.getBoundingRect().left + box.getBoundingRect().width).toBeLessThan(bracket.getBoundingRect().left)
  })

  it('opening the Text tab starts typing in the selected shape, with the cursor after its text', () => {
    const f = makeFigure()
    const shape = addBox(f)
    Object.assign(shape, { label: { text: 'Cell', styles: {}, fontSize: 16, textAlign: 'center' } })
    f.canvas.setActiveObject(shape)
    let state: CanvasState | undefined
    f.subscribe((next) => (state = next))
    f.typeInSelectedShape()
    const box = f.canvas.getActiveObject() as IText
    expect(box.isEditing).toBe(true)
    expect(box.selectionStart).toBe(4)
    expect(state?.selection?.typingInShape).toBe(true)
  })

  it('switches a bracket between square and curly, keeping where it is', () => {
    const f = makeFigure()
    f.setDrawChoice({ shape: 'bracket' })
    f.setTool('shape')
    pointer(f).click(300, 300)
    const square = f.canvas.getActiveObject()!
    const centre = square.getCenterPoint()
    f.setBracketStyle('brace')
    const curly = f.canvas.getActiveObject() as FabricObject & { shapeKind?: string }
    expect(curly.shapeKind).toBe('brace')
    expect(curly.getCenterPoint().x).toBeCloseTo(centre.x)
    expect(curly.getCenterPoint().y).toBeCloseTo(centre.y)
    expect(f.canvas.getObjects()).toHaveLength(1)
    expect(f.drawChoice.shape).toBe('brace')
  })

  it('a double bracket made wider keeps its brackets at its edges, as deep as before, also while being resized', () => {
    const f = makeFigure()
    f.setDrawChoice({ shape: 'double-bracket' })
    f.setTool('shape')
    pointer(f).click(300, 300)
    const shape = f.canvas.getActiveObject() as Shaped & { path: [string, number, number][]; pathOffset: { x: number } }
    // The opening bracket's arm starts at its depth, in the path's own units, so times the stretch on the page.
    const armOnPage = () => (shape.path[0]![1] - shape.pathOffset.x + shape.width / 2) * shape.scaleX
    const arm = armOnPage()
    shape.set({ scaleX: shape.scaleX * 3 })
    f.canvas.fire('object:scaling', { target: shape, transform: { corner: 'mr', original: { scaleX: 1, scaleY: 1 } } } as never)
    expect(armOnPage()).toBeCloseTo(arm, 1)
    f.canvas.fire('object:modified', { target: shape })
    expect(shape.scaleX).toBeCloseTo(1, 2)
    expect(armOnPage()).toBeCloseTo(arm, 1)
  })

  it('a click between the brackets of a double bracket picks what is behind it, not the bracket', () => {
    const f = makeFigure()
    const behind = addBox(f)
    f.setDrawChoice({ shape: 'double-brace' })
    f.setTool('shape')
    const middle = behind.getCenterPoint()
    pointer(f).drag([middle.x - 120, middle.y - 60], [middle.x + 120, middle.y + 60])
    const brackets = f.canvas.getActiveObject()!
    f.setTool('select')
    f.canvas.discardActiveObject()
    pointer(f).click(middle.x, middle.y)
    expect(f.canvas.getActiveObject()).toBe(behind)
    // Its brackets still pick it.
    f.canvas.discardActiveObject()
    const left = brackets.getBoundingRect().left
    pointer(f).click(left + 2, middle.y)
    expect(f.canvas.getActiveObject()).toBe(brackets)
  })

  it('a click in the empty area between a selected double bracket starts typing inside it', () => {
    const f = makeFigure()
    f.setDrawChoice({ shape: 'double-brace' })
    f.setTool('shape')
    pointer(f).click(300, 300)
    const brackets = f.canvas.getActiveObject()!
    f.setTool('select')
    f.canvas.setActiveObject(brackets)
    const [topLeft, , bottomRight] = bracketTextArea(brackets)!.corners
    pointer(f).click((topLeft!.x + bottomRight!.x) / 2, (topLeft!.y + bottomRight!.y) / 2)
    const box = f.canvas.getActiveObject() as IText
    expect(box).toBeInstanceOf(IText)
    expect(box.isEditing).toBe(true)
    box.insertChars('IgG', undefined, 0)
    box.fire('changed')
    f.finishTyping()
    expect(labelOf(brackets)?.text).toBe('IgG')
    // The text sits between the brackets.
    const [a, , c] = labelCorners(brackets)!
    expect((a!.x + c!.x) / 2).toBeCloseTo(brackets.getCenterPoint().x)
  })

  it('switching a double bracket between square and curly keeps it double', () => {
    const f = makeFigure()
    f.setDrawChoice({ shape: 'double-brace' })
    f.setTool('shape')
    pointer(f).click(300, 300)
    f.setBracketStyle('double-bracket')
    expect((f.canvas.getActiveObject() as Shaped).shapeKind).toBe('double-bracket')
    // A single style doesn't turn it into a single bracket.
    f.setBracketStyle('brace')
    expect((f.canvas.getActiveObject() as Shaped).shapeKind).toBe('double-bracket')
  })

  it('lists the colours used on the page, most used first', () => {
    const f = makeFigure()
    addBox(f)
    f.addShape({ kind: 'rectangle', left: 400, top: 100, width: 50, height: 50, fill: '#dbeafe', stroke: '#2563eb', strokeWidth: 1 })
    expect(f.usedColours()).toEqual(['#dbeafe', '#1f2937', '#2563eb'])
  })
})

type Shaped = FabricObject & { shapeKind?: string; cornerRadius?: number; figureId?: string }

describe('switching shapes and rounding corners', () => {
  it('a rectangle switched to a rounded one keeps its middle, size, colours and id, and undo brings it back', async () => {
    const f = makeFigure()
    const box = addBox(f) as Shaped
    const centre = box.getCenterPoint()
    f.setShapeKind('rounded')
    const rounded = f.canvas.getActiveObject() as Shaped
    expect(rounded.shapeKind).toBe('rounded')
    expect(rounded.cornerRadius).toBeGreaterThan(0)
    expect(rounded.getCenterPoint().x).toBeCloseTo(centre.x)
    expect(rounded.getCenterPoint().y).toBeCloseTo(centre.y)
    expect(rounded.width * rounded.scaleX).toBeCloseTo(200)
    expect(rounded.height * rounded.scaleY).toBeCloseTo(100)
    expect(rounded.fill).toBe('#dbeafe')
    expect(rounded.figureId).toBe(box.figureId)
    expect(f.canvas.getObjects()).toHaveLength(1)
    f.undo()
    await settle()
    expect((f.canvas.getObjects()[0] as Shaped).shapeKind).toBeUndefined()
  })

  it('rounds the corners of a rectangle from the rectangle tool, and the panel shows how round', () => {
    const f = makeFigure()
    let state: CanvasState | undefined
    f.subscribe((next) => (state = next))
    addBox(f)
    f.setCornerRadius(12)
    const shape = f.canvas.getActiveObject() as Shaped
    expect(shape.cornerRadius).toBe(12)
    expect(shape.width * shape.scaleX).toBeCloseTo(200)
    expect(state?.selection?.cornerRadius).toBe(12)
    expect(state?.selection?.shapeKind).toBe('rectangle')
  })

  it('a resized shape with round corners is drawn again at its new size, so the corners are not stretched', () => {
    const f = makeFigure()
    addBox(f)
    f.setCornerRadius(12)
    const shape = f.canvas.getActiveObject() as Shaped
    shape.set({ scaleX: shape.scaleX * 3 })
    f.canvas.fire('object:modified', { target: shape })
    expect(shape.width * shape.scaleX).toBeCloseTo(600)
    expect(shape.scaleX).toBeCloseTo(1, 2)
  })

  it('a shape switched to a circle becomes round and keeps round: no side handles', () => {
    const f = makeFigure()
    addBox(f)
    f.setShapeKind('circle')
    const circle = f.canvas.getActiveObject() as Shaped
    expect(circle.width * circle.scaleX).toBeCloseTo(circle.height * circle.scaleY)
    expect(circle.isControlVisible('ml')).toBe(false)
    expect(circle.isControlVisible('br')).toBe(true)
  })

  it('a closed shape does not switch into an open one such as a bracket', () => {
    const f = makeFigure()
    addBox(f)
    f.setShapeKind('bracket')
    expect((f.canvas.getActiveObject() as Shaped).shapeKind).toBeUndefined()
  })
})

describe('placing icons', () => {
  const svg = (width: number, height: number) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect x="0" y="0" width="${width}" height="${height}" fill="#345544"/></svg>`

  it('a wide icon and a tall icon get the same area, so neither comes out much bigger', async () => {
    const figure = makeFigure()
    await figure.addSvg(svg(124, 53), 'Wide')
    await figure.addSvg(svg(60, 90), 'Tall')
    const [wide, tall] = figure.canvas.getObjects()
    const area = (object: FabricObject) => object.getScaledWidth() * object.getScaledHeight()
    expect(area(tall!) / area(wide!)).toBeCloseTo(1, 1)
    // A wide icon like the side-view mouse keeps the size it had before: about 113 wide.
    expect(wide!.getScaledWidth()).toBeCloseTo(113, -1)
    expect(tall!.getScaledHeight()).toBeLessThan(wide!.getScaledWidth())
  })

  it('a recoloured icon gets every one of its own colours back from the library, in one undo step', async () => {
    const figure = makeFigure()
    // Two shades and an outline, like a small multi-tone library icon.
    const original = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="60" height="40" fill="#35333b"/><rect x="60" width="20" height="20" fill="#bc918f"/><circle cx="100" cy="20" r="10" fill="none" stroke="#161418"/></svg>`
    await figure.addSvg(original, 'Mouse', undefined, 74, 'animals/test-mouse')
    figure.canvas.setActiveObject(figure.canvas.getObjects()[0]!)
    // This icon has no gradients, so every fill and outline is a plain colour or empty.
    const colours = () => (figure.canvas.getObjects()[0] as Group).getObjects().map((part) => [part.fill, part.stroke] as unknown as (string | null)[])
    const before = colours()
    figure.change({ fill: '#d9363e' })
    expect(colours()).not.toEqual(before)
    await figure.resetIconColours((id) => (id === 'animals/test-mouse' ? original : undefined))
    expect(colours()).toEqual(before)
    // Undo goes back to the red icon in one step.
    figure.undo()
    await settle()
    expect(colours()).not.toEqual(before)
  })

  it('greyscale draws an icon in grey, and RGB brings back exactly its colours, each one undo step', async () => {
    const figure = makeFigure()
    const original = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="60" height="40" fill="#8fc6cc"/><rect x="60" width="20" height="20" fill="#cce7ea"/><circle cx="100" cy="20" r="10" fill="none" stroke="#489098"/></svg>`
    await figure.addSvg(original, 'Antibody')
    figure.canvas.setActiveObject(figure.canvas.getObjects()[0]!)
    let state: CanvasState | undefined
    figure.subscribe((next) => (state = next))
    const colours = () => (figure.canvas.getObjects()[0] as Group).getObjects().flatMap((part) => [part.fill, part.stroke].filter((paint): paint is string => typeof paint === 'string' && paint.startsWith('#')))
    const before = colours()
    figure.setIconColourMode('grey')
    expect(state?.selection?.colourMode).toBe('grey')
    // Every colour is a grey (red, green and blue alike), and light parts stay lighter than dark ones.
    for (const grey of colours()) expect(grey.slice(1, 3).repeat(3)).toBe(grey.slice(1))
    const [main, light] = colours()
    expect(parseInt(light!.slice(1, 3), 16)).toBeGreaterThan(parseInt(main!.slice(1, 3), 16))
    // The colour field keeps showing the icon's RGB colour.
    expect(state?.selection?.fill).toBe('#8fc6cc')
    figure.setIconColourMode('rgb')
    expect(colours()).toEqual(before)
    figure.undo()
    await settle()
    expect(colours()).not.toEqual(before)
    figure.undo()
    await settle()
    expect(colours()).toEqual(before)
  })

  it('a new colour picked in greyscale is the colour the icon gets back in colour', async () => {
    const figure = makeFigure()
    await figure.addSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="60" height="40" fill="#8fc6cc"/><rect x="70" width="20" height="20" fill="#8fc6cc"/></svg>`, 'Antibody')
    figure.canvas.setActiveObject(figure.canvas.getObjects()[0]!)
    const fill = () => (figure.canvas.getObjects()[0] as Group).getObjects()[0]!.fill
    figure.setIconColourMode('grey')
    figure.change({ fill: '#ff0000' })
    expect(fill()).not.toBe('#ff0000')
    figure.setIconColourMode('rgb')
    expect(fill()).toBe('#ff0000')
  })

  // The icon library is a separate download (`npm run icons`); this needs it installed.
  it.runIf(libraryIcons.length > 0)('a library icon can find its own SVG again by its id', async () => {
    expect(await loadIconSvg('animals/mouse-side-black')).toContain('<svg')
  })

  describe('swapping a molecule for its version with letters', () => {
    // Two versions on the same grid: the one with letters has an extra small part.
    const plain = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><path d="M20 20L100 100" stroke="#262b31" stroke-width="4"/><circle cx="100" cy="100" r="8" fill="#0072b2"/></svg>`
    const lettered = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><path d="M20 20L100 100" stroke="#262b31" stroke-width="4"/><circle cx="100" cy="100" r="8" fill="#0072b2"/><path d="M97 104V96L103 104V96" stroke="#ffffff"/></svg>`
    const library = (id: string) =>
      id === 'm/test' ? { svg: plain, name: 'Test, skeletal' } : id === 'm/test-letters' ? { svg: lettered, name: 'Test, skeletal, with letters' } : undefined
    const place = async () => {
      const figure = makeFigure()
      await figure.addSvg(plain, 'Test, skeletal', { x: 300, y: 200 }, 74, 'm/test')
      const icon = figure.canvas.getObjects()[0]!
      icon.set({ angle: 30, opacity: 0.6 })
      figure.canvas.setActiveObject(icon)
      return figure
    }

    it('keeps its place, scale, turn and opacity, takes the new name, and stays selected', async () => {
      const figure = await place()
      const before = figure.canvas.getObjects()[0]!
      const centre = before.getCenterPoint()
      await figure.swapIcon('m/test-letters', library)
      const after = figure.canvas.getObjects()[0]! as FabricObject & { iconId?: string; name?: string }
      expect(figure.canvas.getObjects()).toHaveLength(1)
      expect(after.iconId).toBe('m/test-letters')
      expect(after.name).toBe('Test, skeletal, with letters')
      expect(after.getCenterPoint().x).toBeCloseTo(centre.x)
      expect(after.getCenterPoint().y).toBeCloseTo(centre.y)
      expect(after.scaleX).toBeCloseTo(before.scaleX)
      expect(after.angle).toBe(30)
      expect(after.opacity).toBe(0.6)
      expect(figure.canvas.getActiveObject()).toBe(after)
    })

    it('keeps a picked colour and the colour mode', async () => {
      const figure = await place()
      figure.change({ fill: '#cc79a7' })
      figure.setIconColourMode('grey')
      let state: CanvasState | undefined
      figure.subscribe((next) => (state = next))
      await figure.swapIcon('m/test-letters', library)
      expect(state?.selection?.colourMode).toBe('grey')
      figure.setIconColourMode('rgb')
      expect(state?.selection?.fill).toBe('#cc79a7')
    })

    it('is one undo step', async () => {
      const figure = await place()
      await figure.swapIcon('m/test-letters', library)
      figure.undo()
      await settle()
      expect((figure.canvas.getObjects()[0] as FabricObject & { iconId?: string }).iconId).toBe('m/test')
    })

    it('the selection tells the panel which library icon it is', async () => {
      const figure = await place()
      let state: CanvasState | undefined
      figure.subscribe((next) => (state = next))
      figure.canvas.discardActiveObject()
      figure.canvas.setActiveObject(figure.canvas.getObjects()[0]!)
      figure.canvas.fire('selection:created', { selected: [figure.canvas.getObjects()[0]!] })
      expect(state?.selection?.iconId).toBe('m/test')
    })
  })
})

describe('pencil styles of an icon', () => {
  // A clean cell and two pencil versions: paper fill, pencil lines (Graphite), colour scribble with a dark outline (Scribble).
  const clean = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><circle cx="64" cy="64" r="40" fill="#0072b2"/><circle cx="64" cy="64" r="12" fill="#004c78"/></svg>`
  const graphite = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><path d="M24 64L64 24L104 64L64 104Z" fill="#ffffff"/><path d="M24 64L104 64" fill="none" stroke="#3b3b3d"/><path d="M64 24L64 104" fill="none" stroke="#2b2b2d"/></svg>`
  const scribble = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><path d="M24 64L64 24L104 64L64 104Z" fill="#ffffff"/><path d="M30 60L98 60" fill="none" stroke="#0072b2"/><path d="M30 70L98 70" fill="none" stroke="#4d9bd0"/><path d="M24 64L64 24L104 64" fill="none" stroke="#262628"/></svg>`
  const svgs: Record<string, string> = { 'c/cell-flat': clean, 'c/cell-flat-pencil-graphite': graphite, 'c/cell-flat-pencil-scribble': scribble }
  const library = (id: string) => (svgs[id] ? { svg: svgs[id], name: id } : undefined)
  const place = async (id: string) => {
    const figure = makeFigure()
    await figure.addSvg(svgs[id]!, id, { x: 300, y: 200 }, 74, id)
    const icon = figure.canvas.getObjects()[0]!
    icon.set({ angle: 15, opacity: 0.7 })
    figure.canvas.setActiveObject(icon)
    return figure
  }
  const paints = (figure: FigureCanvas) =>
    (figure.canvas.getObjects()[0] as Group).getObjects().map((part) => [part.fill, part.stroke].find((paint) => typeof paint === 'string' && paint !== 'none' && paint !== '') as string)

  it('a style swaps the icon in place, as one undo step', async () => {
    const figure = await place('c/cell-flat')
    const centre = figure.canvas.getObjects()[0]!.getCenterPoint()
    await figure.swapIcon('c/cell-flat-pencil-graphite', library)
    const after = figure.canvas.getObjects()[0]! as FabricObject & { iconId?: string }
    expect(figure.canvas.getObjects()).toHaveLength(1)
    expect(after.iconId).toBe('c/cell-flat-pencil-graphite')
    expect(after.getCenterPoint().x).toBeCloseTo(centre.x)
    expect(after.getCenterPoint().y).toBeCloseTo(centre.y)
    expect([after.angle, after.opacity]).toEqual([15, 0.7])
    figure.undo()
    await settle()
    expect((figure.canvas.getObjects()[0] as FabricObject & { iconId?: string }).iconId).toBe('c/cell-flat')
  })

  it('a new colour replaces the one pencil colour of a Graphite icon and leaves the paper white', async () => {
    const figure = await place('c/cell-flat-pencil-graphite')
    figure.change({ fill: '#cc79a7' })
    expect(paints(figure).map((paint) => paint.toLowerCase())).toEqual(['#ffffff', '#cc79a7', '#cc79a7'])
  })

  it('a new colour tints a Scribble icon but keeps its dark outline and paper', async () => {
    const figure = await place('c/cell-flat-pencil-scribble')
    let state: CanvasState | undefined
    figure.subscribe((next) => (state = next))
    figure.change({ fill: '#cc79a7' })
    const [paper, main, light, outline] = paints(figure).map((paint) => paint.toLowerCase())
    expect([paper, outline]).toEqual(['#ffffff', '#262628'])
    expect(main).toBe('#cc79a7')
    expect(light).not.toBe('#4d9bd0')
    // The colour field shows the scribble's colour, not the outline or the paper.
    expect(state?.selection?.fill?.toLowerCase()).toBe('#cc79a7')
  })
})

describe('changing the page size', () => {
  it('scales everything to fit the new page and keeps it centred', () => {
    const f = makeFigure()
    const rect = new Rect({ left: 0, top: 0, width: 1000, height: 800, strokeWidth: 0 })
    f.canvas.add(rect)
    f.setPage({ width: 500, height: 500 })
    const box = rect.getBoundingRect()
    expect(f.page).toEqual({ width: 500, height: 500 })
    expect(box.width).toBeCloseTo(500)
    expect(box.height).toBeCloseTo(400)
    expect(box.left).toBeCloseTo(0)
    expect(box.top).toBeCloseTo(50)
  })

  it('starts the undo steps again, so Undo never brings back objects sized for the old page', () => {
    const f = makeFigure()
    let state: CanvasState | undefined
    f.subscribe((next) => (state = next))
    addText(f)
    f.setPage({ width: 500, height: 400 })
    expect(state?.canUndo).toBe(false)
  })

  it('without fitting, leaves the objects where they are', () => {
    const f = makeFigure()
    const rect = new Rect({ left: 0, top: 0, width: 1000, height: 800, strokeWidth: 0 })
    f.canvas.add(rect)
    f.setPage({ width: 500, height: 500 }, false)
    expect(rect.getBoundingRect().width).toBeCloseTo(1000)
  })
})

describe('placing a chart with a click', () => {
  it('puts it in the middle of the page wherever the click was, sized to the page (bug: it hung off the edge)', async () => {
    const f = makeFigure()
    const { ChartObject } = await import('./ChartObject')
    f.setTool('chart')
    pointer(f).click(950, 750)
    const chart = f.canvas.getObjects().find((object) => object instanceof ChartObject)
    expect(chart).toBeDefined()
    const box = chart!.getBoundingRect()
    expect(box.left + box.width / 2).toBeCloseTo(500, 0)
    expect(box.top + box.height / 2).toBeCloseTo(400, 0)
    expect(box.left).toBeGreaterThanOrEqual(0)
    expect(box.left + box.width).toBeLessThanOrEqual(1000)
  })
})

describe('placing with the Place button', () => {
  // Arrows and text aren't here: the test canvas can't draw arrows, and new text stays in typing mode.
  it('puts shapes in the middle of the page, bigger by the place scale (bug: phones placed them low)', () => {
    const f = makeFigure()
    const centreOf = () => {
      const box = f.canvas.getActiveObject()!.getBoundingRect()
      return { x: box.left + box.width / 2, y: box.top + box.height / 2, width: box.width }
    }
    f.placeWithTool('rectangle')
    const plain = centreOf()
    f.placeScale = 1.5
    for (const tool of ['rectangle', 'ellipse'] as const) {
      expect(f.placeWithTool(tool)).toBe(true)
      const placed = centreOf()
      // Within the outline's width of the middle.
      expect(Math.abs(placed.x - 500)).toBeLessThan(2)
      expect(Math.abs(placed.y - 400)).toBeLessThan(2)
      if (tool === 'rectangle') expect(placed.width / plain.width).toBeCloseTo(1.5, 1)
    }
  })
})

describe('snapping while resizing', () => {
  it('snaps a side handle drag to the middle of the page (bug: only moving snapped)', () => {
    const f = makeFigure()
    const box = addBox(f)
    f.canvas.setActiveObject(box)
    f.canvas.renderAll()
    const left = box.getBoundingRect().left
    const mouse = pointer(f)
    mouse.press(301, 151)
    mouse.move(400, 151)
    mouse.move(497, 151)
    const rect = box.getBoundingRect()
    expect(rect.left + rect.width).toBeCloseTo(500, 1)
    expect(rect.left).toBeCloseTo(left, 1)
    mouse.release(497, 151)
  })

  it('does not snap a resize while Alt is held', () => {
    const f = makeFigure()
    const box = addBox(f)
    f.canvas.setActiveObject(box)
    f.canvas.renderAll()
    const upper = f.canvas.upperCanvasEl
    upper.dispatchEvent(new MouseEvent('mousedown', { clientX: 301, clientY: 151, bubbles: true, button: 0, buttons: 1 }))
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 497, clientY: 151, bubbles: true, buttons: 1, altKey: true }))
    expect(box.getBoundingRect().left + box.getBoundingRect().width).not.toBeCloseTo(500, 1)
    document.dispatchEvent(new MouseEvent('mouseup', { clientX: 497, clientY: 151, bubbles: true, altKey: true }))
  })

  it('snaps a dragged edge to the 4 mm margin inside the page edge', () => {
    const f = makeFigure()
    const box = addBox(f)
    f.canvas.setActiveObject(box)
    f.canvas.renderAll()
    const mouse = pointer(f)
    // 4 mm is about 15.1 px, so the margin line sits at about 984.9 px on this 1000 px page.
    mouse.press(301, 151)
    mouse.move(700, 151)
    mouse.move(982, 151)
    const rect = box.getBoundingRect()
    expect(rect.left + rect.width).toBeCloseTo(1000 - (4 * 96) / 25.4, 1)
    mouse.release(982, 151)
  })
})

describe('rotating', () => {
  /** Drag the rotate area past the box's bottom-right corner round its middle (200, 150) by `turn` degrees. */
  function turnBy(f: FigureCanvas, turn: number, shiftKey: boolean) {
    const upper = f.canvas.upperCanvasEl
    const from = { x: 312, y: 212 }
    const radius = Math.hypot(from.x - 200, from.y - 150)
    const start = Math.atan2(from.y - 150, from.x - 200)
    const at = (deg: number) => ({ x: 200 + radius * Math.cos(start + (deg * Math.PI) / 180), y: 150 + radius * Math.sin(start + (deg * Math.PI) / 180) })
    const send = (type: string, p: { x: number; y: number }, target: EventTarget) =>
      target.dispatchEvent(new MouseEvent(type, { clientX: p.x, clientY: p.y, bubbles: true, button: 0, buttons: type === 'mouseup' ? 0 : 1, shiftKey }))
    send('mousedown', from, upper)
    send('mousemove', at(turn / 2), document)
    send('mousemove', at(turn), document)
    const shownWhileTurning = f.canvas.wrapperEl.querySelector('[role="status"]')?.textContent
    send('mouseup', at(turn), document)
    return shownWhileTurning
  }

  it('turns freely away from the 15° steps', () => {
    const f = makeFigure()
    const box = addBox(f)
    f.canvas.setActiveObject(box)
    f.canvas.renderAll()
    turnBy(f, 23, false)
    expect(box.angle).toBeCloseTo(23, 0)
  })

  it('clicks onto a 15° step once close to it', () => {
    const f = makeFigure()
    const box = addBox(f)
    f.canvas.setActiveObject(box)
    f.canvas.renderAll()
    turnBy(f, 28, false)
    expect(box.angle).toBeCloseTo(30)
  })

  it('shows the angle while turning and hides it once let go', () => {
    const f = makeFigure()
    const box = addBox(f)
    f.canvas.setActiveObject(box)
    f.canvas.renderAll()
    expect(turnBy(f, 28, false)).toBe('30°')
    expect((f.canvas.wrapperEl.querySelector('[role="status"]') as HTMLElement).style.display).toBe('none')
  })

  it('the handle above the object snaps the same way (bug: it turned without snapping)', () => {
    const f = makeFigure()
    const box = addBox(f)
    f.canvas.setActiveObject(box)
    f.canvas.renderAll()
    const handle = box.oCoords.mtr!
    const radius = Math.hypot(handle.x - 200, handle.y - 150)
    const start = Math.atan2(handle.y - 150, handle.x - 200)
    const at = (deg: number) => ({ clientX: 200 + radius * Math.cos(start + (deg * Math.PI) / 180), clientY: 150 + radius * Math.sin(start + (deg * Math.PI) / 180), bubbles: true, button: 0 })
    f.canvas.upperCanvasEl.dispatchEvent(new MouseEvent('mousedown', { ...at(0), buttons: 1 }))
    document.dispatchEvent(new MouseEvent('mousemove', { ...at(14), buttons: 1 }))
    document.dispatchEvent(new MouseEvent('mousemove', { ...at(28), buttons: 1 }))
    document.dispatchEvent(new MouseEvent('mouseup', at(28)))
    expect(box.angle).toBeCloseTo(30)
  })

  it('does not snap at all while Shift is held, also close to a step', () => {
    const f = makeFigure()
    const box = addBox(f)
    f.canvas.setActiveObject(box)
    f.canvas.renderAll()
    turnBy(f, 28, true)
    expect(box.angle).toBeCloseTo(28, 0)
  })
})

describe('pinching with two fingers (phones)', () => {
  const square = (f: FigureCanvas) => {
    const rect = addBox(f)
    f.canvas.setActiveObject(rect)
    return rect
  }

  it('with nothing selected, a pinch is left to zoom the page', () => {
    const f = makeFigure()
    f.canvas.discardActiveObject()
    expect(f.startPinch(f.selectedObjects())).toBe(false)
  })

  it('resizes the selection around its middle, keeping its proportions, as one undo step', async () => {
    const f = makeFigure()
    const rect = square(f)
    const centre = rect.getCenterPoint()
    expect(f.startPinch(f.selectedObjects())).toBe(true)
    f.pinchTo(1.5)
    f.pinchTo(2)
    f.endPinch()
    expect(rect.scaleX).toBeCloseTo(2)
    expect(rect.scaleY).toBeCloseTo(2)
    expect(rect.getCenterPoint().x).toBeCloseTo(centre.x)
    expect(rect.getCenterPoint().y).toBeCloseTo(centre.y)
    f.undo()
    await settle()
    expect(f.canvas.getObjects()[0]!.scaleX).toBe(1)
  })

  it('brings back a selection the first finger let go of by landing beside it', () => {
    const f = makeFigure()
    const rect = square(f)
    const before = f.selectedObjects()
    f.canvas.discardActiveObject()
    expect(f.startPinch(before)).toBe(true)
    expect(f.canvas.getActiveObject()).toBe(rect)
  })

  it('leaves a locked selection as it is, without zooming', () => {
    const f = makeFigure()
    const rect = square(f)
    f.toggleLock()
    expect(f.startPinch(f.selectedObjects())).toBe(true)
    f.pinchTo(2)
    f.endPinch()
    expect(rect.scaleX).toBe(1)
  })

  it('draws the picture again as a pinch grows it, so it never gets blurry (bug: sharp only after letting go)', () => {
    const f = makeFigure()
    const rect = square(f)
    rect.set({ objectCaching: true })
    f.canvas.renderAll()
    f.startPinch(f.selectedObjects())
    const drawnAt = () => (rect as FabricObject & { zoomX: number }).zoomX
    for (let step = 1; step <= 20; step++) {
      f.pinchTo(1 + step * 0.2)
      f.canvas.renderAll()
      // Never stretched more than 20% past the size it was drawn at.
      expect(rect.getTotalObjectScaling().x).toBeLessThanOrEqual(drawnAt() * 1.2 + 1e-9)
    }
    // Shrinking keeps the picture: a smaller copy of a sharp picture stays sharp.
    const sharp = drawnAt()
    f.pinchTo(2)
    f.canvas.renderAll()
    expect(drawnAt()).toBe(sharp)
    f.endPinch()
  })
})

describe('figures saved with the removed CMYK preview', () => {
  it('open with the icon in its own colours', async () => {
    const f = makeFigure()
    await f.addSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="60" height="40" fill="#ff0000"/><rect x="70" width="20" height="20" fill="#ff0000"/></svg>`, 'Red')
    const saved = JSON.parse(f.serialize()) as { objects: Record<string, unknown>[] }
    const icon = saved.objects[0]!
    icon.colourMode = 'cmyk'
    icon.baseColours = [{ fill: '#ff0000', stroke: null }, { fill: '#ff0000', stroke: null }]
    for (const part of icon.objects as Record<string, unknown>[]) part.fill = '#e01f1f'
    const element = document.createElement('canvas')
    document.body.append(element)
    const reopened = new FigureCanvas(element, { width: 1000, height: 800 }, JSON.stringify(saved))
    await settle()
    const group = reopened.canvas.getObjects()[0] as Group
    expect(group.getObjects().map((part) => part.fill)).toEqual(['#ff0000', '#ff0000'])
    await reopened.dispose()
  })
})
