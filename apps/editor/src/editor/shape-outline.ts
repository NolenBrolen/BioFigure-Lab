/**
 * The outlines of shapes from the Shapes panel, drawn at the size they have on
 * the page. Fabric resizes a shape by stretching it, which would stretch round
 * corners into ovals too; so once a resize is done, shapes whose look depends
 * on their real size (rounded corners, the pill's round ends) are drawn again
 * at their new size (see `redrawOutline`).
 */
import { CORNER_SHAPES, DOUBLE_BRACKETS, defaultCornerRadius, doubleBracketArm, doubleBracketPath, shapePath, type ShapeKind } from '@biofigure-lab/ui/lib/arrow-geometry'
import { Ellipse, Path, Rect, type FabricObject } from 'fabric'

type Outlined = FabricObject & { shapeKind?: ShapeKind; cornerRadius?: number }

/** Shapes drawn again at their new size after a resize (a double bracket keeps how deep its brackets are). */
const REDRAWN: ReadonlySet<ShapeKind> = new Set([...CORNER_SHAPES, 'pill', ...DOUBLE_BRACKETS])

/** Which shape an object is: its Shapes panel kind, or rectangle and ellipse for those drawn with their own tools. */
export function kindOf(object: FabricObject): ShapeKind | undefined {
  if (object instanceof Rect) return 'rectangle'
  if (object instanceof Ellipse) return 'ellipse'
  return object instanceof Path ? (object as Outlined).shapeKind : undefined
}

/** How round a shape's corners are, in page pixels, or nothing for shapes without corners to round. */
export function cornerRadiusOf(object: FabricObject): number | undefined {
  const kind = kindOf(object)
  if (!kind || !CORNER_SHAPES.has(kind)) return undefined
  return (object as Outlined).cornerRadius ?? defaultCornerRadius(kind, object.width * object.scaleX, object.height * object.scaleY)
}

/**
 * A shape's outline for a box `width` by `height`, and the scale that makes
 * it fill that box exactly. Rounded tips can leave the outline a little
 * smaller than its box: then it's drawn once more, that much bigger, so the
 * scale left over is close to 1 and hardly stretches the corners.
 */
export function outline(kind: ShapeKind, width: number, height: number, radius?: number): { d: string; scaleX: number; scaleY: number } {
  let d = shapePath(kind, width, height, radius)
  let drawn = new Path(d)
  if (drawn.width > 0 && drawn.height > 0 && (Math.abs(drawn.width - width) > 0.01 || Math.abs(drawn.height - height) > 0.01)) {
    d = shapePath(kind, (width * width) / drawn.width, (height * height) / drawn.height, radius)
    drawn = new Path(d)
  }
  return { d, scaleX: drawn.width > 0 ? width / drawn.width : 1, scaleY: drawn.height > 0 ? height / drawn.height : 1 }
}

/** The size and corners each shape was last drawn for, so an unchanged shape isn't drawn again. */
const drawnFor = new WeakMap<FabricObject, string>()

/**
 * Draw a shape again at the size it has on the page, keeping its top-left
 * corner and size. Returns whether it was redrawn: only shapes whose look
 * depends on their size, and only when their size or corners changed
 * (`force`: always).
 */
export function redrawOutline(object: FabricObject, force = false): boolean {
  const kind = kindOf(object)
  if (!(object instanceof Path) || !kind || !REDRAWN.has(kind)) return false
  const width = object.width * object.scaleX
  const height = object.height * object.scaleY
  const radius = cornerRadiusOf(object)
  const key = `${width.toFixed(2)} ${height.toFixed(2)} ${radius ?? ''}`
  if (!force && (drawnFor.get(object) === key || (Math.abs(object.scaleX - 1) < 1e-3 && Math.abs(object.scaleY - 1) < 1e-3))) return false
  const { d, scaleX, scaleY } = outline(kind, width, height, radius)
  object._setPath(d)
  object.set({ scaleX, scaleY, dirty: true })
  object.setCoords()
  drawnFor.set(object, key)
  return true
}

/**
 * While a double bracket is being resized, its brackets keep their depth on
 * the page and stay at its edges, instead of stretching wider with it. Only
 * the outline inside its box changes, so Fabric's resize carries on as is;
 * the shape is drawn again at its real size once the resize is done.
 */
export function keepBracketArms(object: FabricObject): void {
  const kind = kindOf(object)
  if (!(object instanceof Path) || !kind || !DOUBLE_BRACKETS.has(kind) || !object.scaleX) return
  const arm = doubleBracketArm(object.width * object.scaleX, object.height * object.scaleY) / object.scaleX
  object._setPath(doubleBracketPath(kind, object.width, object.height, arm))
  object.set({ dirty: true })
}

/** A circle keeps round: only its corner handles show, and those keep its proportions. */
export function applyShapeRules(object: FabricObject): void {
  if (kindOf(object) === 'circle') object.setControlsVisibility({ ml: false, mr: false, mt: false, mb: false })
}
