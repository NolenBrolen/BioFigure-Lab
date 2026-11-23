/*
 * Shapes panel: the contents of the left panel when the Shapes tool is on.
 * One list of square tiles (no headings, the owner's pick 2026-11-12; one
 * Bracket tile for both styles of a single bracket, one Double bracket tile
 * for both styles of a double one); picking
 * one turns on drawing that shape (drag on the page, or click for the default size).
 */
import { BRACKETS, DOUBLE_BRACKETS, SHAPE_ASPECT, SHAPES, TALL_SHAPES, shapePath, type ShapeKind } from '../../lib/arrow-geometry'
import { cn } from '../../lib/cn'
import { DrawTile } from '../draw-tile/DrawTile'

export type ShapesPanelProps = {
  /** The shape whose tool is on, if any. */
  picked?: ShapeKind
  onPick: (shape: ShapeKind) => void
  className?: string
}

/** A rectangle reads better a little wider than tall, as on the page after a drag. */
const WIDER_SHAPES = new Set<ShapeKind>(['rectangle', 'rounded', 'callout'])

/** The box a shape's picture is drawn in: the shape's own proportions, at most 36 wide and 32 high. */
function pictureBox(shape: ShapeKind): [number, number] {
  if (TALL_SHAPES.has(shape)) return [10, 32]
  if (shape === 'membrane') return [36, 16]
  if (WIDER_SHAPES.has(shape)) return [36, 28]
  const aspect = SHAPE_ASPECT[shape] ?? 1
  return aspect >= 36 / 32 ? [36, 36 / aspect] : [32 * aspect, 32]
}

/** A small picture of a shape, drawn with the same outline as the canvas: a thin line, no fill (picked look A). */
export function ShapePicture({ shape, className }: { shape: ShapeKind; className?: string }) {
  const [w, h] = pictureBox(shape)
  return (
    <svg aria-hidden viewBox={`${-(40 - w) / 2} ${-(40 - h) / 2} 40 40`} className={className} fill="none" stroke="currentColor" strokeWidth={1.25} strokeLinejoin="round" strokeLinecap="round">
      <path d={shapePath(shape, w, h)} />
    </svg>
  )
}

/** The Bracket tile's picture: a curly bracket with a light, faded "Aa" beside it (the owner's pick, 2026-11-15), as the bracket is meant to label what it marks. */
function LabelledBracketPicture() {
  return (
    <svg aria-hidden viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth={1.25} strokeLinejoin="round" strokeLinecap="round">
      <path d={shapePath('brace', 8, 28)} transform="translate(5 6)" />
      <text x="17" y="24.5" fill="currentColor" stroke="none" fontSize="12" fontWeight="300" opacity={0.6} fontFamily="inherit">
        Aa
      </text>
    </svg>
  )
}

/** Which tile stands for a shape: one tile for both styles of each bracket. */
function tileOf(shape: ShapeKind): ShapeKind {
  if (DOUBLE_BRACKETS.has(shape)) return 'double-bracket'
  return BRACKETS.has(shape) ? 'bracket' : shape
}

export function ShapesPanel({ picked, onPick, className }: ShapesPanelProps) {
  return (
    <div className={cn('grid grid-cols-3 gap-2', className)}>
      {SHAPES.filter((shape) => shape.inPanel !== false).map((shape) => (
        <DrawTile
          key={shape.id}
          name={shape.name}
          title={`Draw ${shape.name.toLowerCase()}`}
          picked={picked !== undefined && tileOf(picked) === shape.id}
          onClick={() => onPick(shape.id)}
          // The bracket tiles show the curly style, which they draw by default.
          picture={shape.id === 'bracket' ? <LabelledBracketPicture /> : <ShapePicture shape={shape.id === 'double-bracket' ? 'double-brace' : shape.id} />}
        />
      ))}
    </div>
  )
}
