/**
 * What each drawing tool makes, as plain settings. The canvas code turns these
 * into Fabric objects; keeping them here makes the defaults easy to see and test.
 */
import { SHAPE_ASPECT, TALL_SHAPES, type ArrowLook, type ShapeKind } from '@biofigure-lab/ui/lib/arrow-geometry'

import type { XY } from './geometry'
import type { TextFit } from './shape-text'
import type { TextStyle } from './text-style'
import { mmToPx } from './units'

/** `chart` places the chart picked in the Graph panel. `table` places the table picked in the Table panel. `shape` draws the shape picked in the Shapes panel; `arrow` the arrow picked in the Arrows panel. */
export type Tool = 'select' | 'rectangle' | 'ellipse' | 'line' | 'arrow' | 'shape' | 'text' | 'table' | 'chart'
/** The table and chart tools place tables and charts (see table-model.ts, chart-model.ts); the others place a shape. */
export type ShapeTool = Exclude<Tool, 'select' | 'table' | 'chart'>

/** The palest blue of the colour-blind friendly swatch palette (see ColourInput's PALETTE). */
export const DEFAULT_FILL = '#d1e6f1'
export const DEFAULT_STROKE = '#1f2937'

/** The arrow the arrow tool draws until another one is picked: straight, solid, filled head. */
export const DEFAULT_ARROW: ArrowLook = { route: 'straight', line: 'solid', start: 'none', end: 'open', mid: 'none' }

/** The look of new shapes, set in the Shapes panel. `size` is what a click places; unset, a click places the default size. */
export type ShapeStyle = {
  fill: string
  stroke: string
  strokeWidth: number
  opacity: number
  textFit: TextFit
  /** How round the corners of shapes with straight sides are, in page pixels; unset, each shape's own (see `defaultCornerRadius`). */
  cornerRadius?: number
  size?: { width: number; height: number }
  /** The look of the text typed in the shape; none: the look of new text, centred. */
  text?: TextStyle
}
export const DEFAULT_SHAPE_STYLE: ShapeStyle = { fill: DEFAULT_FILL, stroke: DEFAULT_STROKE, strokeWidth: 1.5, opacity: 1, textFit: 'shrink' }

/** What the shape and arrow tools draw: the picks from the Shapes and Arrows panels. */
export type DrawChoice = { shape: ShapeKind; look: ArrowLook; style: ShapeStyle }
export const DEFAULT_CHOICE: DrawChoice = { shape: 'rounded', look: DEFAULT_ARROW, style: DEFAULT_SHAPE_STYLE }

/**
 * How big icons other than animals come onto the page: the side of a square
 * with the same area, in page pixels (about 15.6 mm; see `placementSize`).
 */
export const PLACED_SIZE_PX = 59

/**
 * How big a clicked shape comes onto the page: the side of a square with the
 * same area, in page pixels (about 18 mm; the owner's pick of 2026-11-12, down
 * from 20 mm).
 */
export const SHAPE_SIZE_PX = 68

/**
 * The size a click places a shape at: the size set in the Shapes panel, or
 * the area of a `SHAPE_SIZE_PX` square (brackets start tall and thin, like
 * the things they mark; wide shapes such as the pill take the same room,
 * wider and less tall).
 */
export function clickSize(shape: ShapeKind, style: ShapeStyle): { width: number; height: number } {
  if (style.size) return style.size
  const size = SHAPE_SIZE_PX
  if (TALL_SHAPES.has(shape)) return { width: size * 0.3, height: size }
  const aspect = Math.sqrt(SHAPE_ASPECT[shape] ?? 1)
  return { width: size * aspect, height: size / aspect }
}

/** Extras a closed shape can start with. */
type ShapeExtras = { opacity?: number; textFit?: TextFit; cornerRadius?: number }

export type ShapeSpec =
  | ({ kind: 'rectangle'; left: number; top: number; width: number; height: number; fill: string; stroke: string; strokeWidth: number } & ShapeExtras)
  | ({ kind: 'ellipse'; left: number; top: number; rx: number; ry: number; fill: string; stroke: string; strokeWidth: number } & ShapeExtras)
  | { kind: 'line'; points: [number, number, number, number]; stroke: string; strokeWidth: number }
  | { kind: 'arrow'; points: [number, number, number, number]; look: ArrowLook; stroke: string; strokeWidth: number }
  | ({ kind: 'path'; shape: ShapeKind; left: number; top: number; width: number; height: number; fill: string; stroke: string; strokeWidth: number } & ShapeExtras)
  | { kind: 'text'; left: number; top: number; text: string; fontSize: number; fill: string; /** Set for a text box that wraps its text at this width. */ width?: number }

/** The look a new shape takes from the Shapes panel. */
const shapeLook = ({ fill, stroke, strokeWidth, opacity, textFit, cornerRadius }: ShapeStyle) => ({ fill, stroke, strokeWidth, opacity, textFit, ...(cornerRadius !== undefined && { cornerRadius }) })

/**
 * A new shape of the size set in the Shapes panel (see `clickSize`), centred where the person clicked; lines and arrows start 20 mm long.
 * `scale` makes it bigger, as phones do (see `FigureCanvas.placeScale`); a size picked in the panel stays as picked.
 */
export function shapeAt(tool: ShapeTool, x: number, y: number, choice: DrawChoice = DEFAULT_CHOICE, scale = 1): ShapeSpec {
  const size = mmToPx(20) * scale
  const look = shapeLook(choice.style)
  const sized = (shape: ShapeKind) => {
    const { width, height } = clickSize(shape, choice.style)
    return choice.style.size ? { width, height } : { width: width * scale, height: height * scale }
  }
  switch (tool) {
    case 'rectangle': {
      const { width, height } = sized('rectangle')
      return { kind: 'rectangle', left: x - width / 2, top: y - height / 2, width, height, ...look }
    }
    case 'ellipse': {
      const { width, height } = sized('ellipse')
      return { kind: 'ellipse', left: x - width / 2, top: y - height / 2, rx: width / 2, ry: height / 2, ...look }
    }
    case 'shape': {
      const { width, height } = sized(choice.shape)
      return { kind: 'path', shape: choice.shape, left: x - width / 2, top: y - height / 2, width, height, ...look }
    }
    case 'line':
      return { kind: 'line', points: [x - size / 2, y, x + size / 2, y], stroke: DEFAULT_STROKE, strokeWidth: 2 }
    case 'arrow':
      return { kind: 'arrow', points: [x - size / 2, y, x + size / 2, y], look: choice.look, stroke: DEFAULT_STROKE, strokeWidth: 2 }
    case 'text':
      // Starts where you click, like typing in a text editor.
      return { kind: 'text', left: x, top: y - 10 * scale, text: 'Label', fontSize: 16 * scale, fill: DEFAULT_STROKE }
  }
}

/**
 * A shape drawn by dragging from `start` to `end`. With `constrain` (Shift held)
 * boxes become squares and circles, and lines snap to steps of 45°.
 */
export function shapeFromDrag(tool: Exclude<ShapeTool, 'text'>, start: XY, end: XY, constrain = false, choice: DrawChoice = DEFAULT_CHOICE): ShapeSpec {
  let dx = end.x - start.x
  let dy = end.y - start.y
  if (tool === 'line' || tool === 'arrow') {
    if (constrain) {
      const length = Math.hypot(dx, dy)
      const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4)
      dx = length * Math.cos(angle)
      dy = length * Math.sin(angle)
    }
    const points: [number, number, number, number] = [start.x, start.y, start.x + dx, start.y + dy]
    return tool === 'arrow' ? { kind: 'arrow', points, look: choice.look, stroke: DEFAULT_STROKE, strokeWidth: 2 } : { kind: 'line', points, stroke: DEFAULT_STROKE, strokeWidth: 2 }
  }
  if (constrain) {
    const side = Math.max(Math.abs(dx), Math.abs(dy))
    dx = Math.sign(dx || 1) * side
    dy = Math.sign(dy || 1) * side
  }
  const left = Math.min(start.x, start.x + dx)
  const top = Math.min(start.y, start.y + dy)
  const width = Math.abs(dx)
  const height = Math.abs(dy)
  const style = shapeLook(choice.style)
  if (tool === 'shape') return { kind: 'path', shape: choice.shape, left, top, width, height, ...style }
  return tool === 'rectangle'
    ? { kind: 'rectangle', left, top, width, height, ...style }
    : { kind: 'ellipse', left, top, rx: width / 2, ry: height / 2, ...style }
}

/**
 * What pressing on an existing object does while a drawing tool is on. Shape
 * tools grab the object (select it, and a drag moves it); arrows and lines
 * still start drawing there, so they can start on an object and stick to it.
 */
export function pressOnObject(tool: Exclude<ShapeTool, 'text'>): 'select' | 'draw' {
  return tool === 'arrow' || tool === 'line' ? 'draw' : 'select'
}

/**
 * Drawing tools place one object, then hand back to Select. The arrow tool
 * stays on, so several arrows can be drawn in a row (Escape stops it); the
 * text tool has its own rules.
 */
export const toolAfterPlacing = (tool: ShapeTool): Tool => (tool === 'text' || tool === 'arrow' ? tool : 'select')
