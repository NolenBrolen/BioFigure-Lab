/*
 * How arrows and shapes are drawn, as plain SVG path data. The Arrows and
 * Shapes panels draw their tile pictures with it, and the editor draws the
 * real canvas objects (and their SVG/PDF export) with the same functions, so
 * a tile always looks like what it puts on the page.
 */

export type XY = { x: number; y: number }

export type Route = 'straight' | 'curved' | 'elbow' | 'u-shape'
export type LineStyle = 'solid' | 'dashed' | 'dotted'
export type EndKind = 'none' | 'open' | 'filled' | 'activation' | 'inhibition' | 'catalysis' | 'binding' | 'half' | 'synapse' | 'axon'
export type MidMark = 'none' | 'tick'

/** Everything that decides an arrow's look, apart from its colour and width. */
export type ArrowLook = {
  route: Route
  line: LineStyle
  start: EndKind
  end: EndKind
  mid: MidMark
  /** How far a curved arrow bows, as a share of its length (-0.5 to 0.5, 0.2 is the classic bow); left out, it is worked out from the arrow's angle (see `autoBend`). */
  bend?: number | undefined
}

export type ArrowPreset = { id: string; name: string; start: EndKind; end: EndKind; mid: MidMark }

/** The arrow ends offered in the Arrows panel. */
export const ARROW_PRESETS: ArrowPreset[] = [
  { id: 'line', name: 'No head', start: 'none', end: 'none', mid: 'none' },
  { id: 'open', name: 'Open head', start: 'none', end: 'open', mid: 'none' },
  { id: 'filled', name: 'Filled head', start: 'none', end: 'filled', mid: 'none' },
  { id: 'double', name: 'Double head', start: 'filled', end: 'filled', mid: 'none' },
  { id: 'activation', name: 'Activation', start: 'none', end: 'activation', mid: 'none' },
  { id: 'inhibition', name: 'Inhibition', start: 'none', end: 'inhibition', mid: 'none' },
  { id: 'catalysis', name: 'Catalysis', start: 'none', end: 'catalysis', mid: 'none' },
  { id: 'binding', name: 'Binding', start: 'none', end: 'binding', mid: 'none' },
  { id: 'translocation', name: 'Translocation', start: 'none', end: 'filled', mid: 'tick' },
  { id: 'reversible', name: 'Reversible', start: 'half', end: 'half', mid: 'none' },
  { id: 'synapse', name: 'Synapse', start: 'none', end: 'synapse', mid: 'none' },
  { id: 'axon', name: 'Axon', start: 'none', end: 'axon', mid: 'none' },
]

export const ROUTES: { id: Route; name: string }[] = [
  { id: 'straight', name: 'Straight' },
  { id: 'curved', name: 'Curved' },
  { id: 'elbow', name: 'Elbow' },
  { id: 'u-shape', name: 'U-shape' },
]

/**
 * Routes that turn corners: their path is worked out from the ends in the
 * arrow's own space, so a turned arrow keeps its turn (see `Connector.squareUp`).
 */
export const CORNER_ROUTES: ReadonlySet<Route> = new Set(['elbow', 'u-shape'])

export const LINE_STYLES: { id: LineStyle; name: string }[] = [
  { id: 'solid', name: 'Solid' },
  { id: 'dashed', name: 'Dashed' },
  { id: 'dotted', name: 'Dotted' },
]

const CURVE_STEPS = 48
/** How far a curved arrow bows out at most, as a share of its length. */
const CURVE_BEND = 0.2
/** The furthest a curve may bow either way, as a share of the arrow's length. */
export const MAX_BEND = 0.5

/**
 * The bow of a curved arrow that has none set: the full 0.2 for near-horizontal
 * and near-vertical arrows, softening to 0.08 on 45 degree diagonals, where
 * the same bow looks forced.
 */
export function autoBend(a: XY, b: XY): number {
  const angle = Math.atan2(b.y - a.y, b.x - a.x)
  return CURVE_BEND * (1 - 0.6 * Math.abs(Math.sin(2 * angle)))
}

/** The bow an arrow really has: its own, or the automatic one. */
export const effectiveBend = (a: XY, b: XY, bend?: number): number => bend ?? autoBend(a, b)
/** How far a U-shaped arrow dips below both of its ends, as a share of the gap between them. */
const U_DIP = 0.2
/** The least a U-shaped arrow dips, so its two arms have room for their ends; never more than half the gap. */
const U_MIN_DIP = 16

const fmt = (n: number) => String(Math.round(n * 100) / 100)
const polyline = (points: readonly XY[], close = false) =>
  points.map((p, i) => `${i === 0 ? 'M' : 'L'}${fmt(p.x)} ${fmt(p.y)}`).join(' ') + (close ? ' Z' : '')

/**
 * Which way the corner routes (elbow, U-shape) leave and enter an end, when an
 * end is attached to a chosen side of an object: the way that side faces
 * (outward), as a unit direction along an axis in the arrow's own frame. The
 * path leaves `a` along `start`, and comes into `b` travelling against `end`.
 * Left out, an elbow leaves sideways and a U-shape dips down.
 */
export type EndDirs = { start?: XY; end?: XY }

/** The arrow's path from `a` to `b` as a list of points (curves are finely sampled). */
export function routePoints(a: XY, b: XY, route: Route, dirs?: EndDirs, bend?: number): XY[] {
  if (route === 'u-shape') {
    // Out from the start (down, unless an end is attached to another side),
    // across beyond both ends, and back into the end, so it passes under
    // (or over, or beside) whatever sits between them. The dip follows the
    // gap, so it stays in proportion, with a floor that keeps the arms long
    // enough for their ends however short the arrow is.
    const d = dirs?.start ?? dirs?.end ?? { x: 0, y: 1 }
    if (d.x === 0) {
      const gap = Math.abs(b.x - a.x)
      const dip = Math.min(gap / 2, Math.max(gap * U_DIP, U_MIN_DIP))
      const y = d.y >= 0 ? Math.max(a.y, b.y) + dip : Math.min(a.y, b.y) - dip
      return [a, { x: a.x, y }, { x: b.x, y }, b]
    }
    const gap = Math.abs(b.y - a.y)
    const dip = Math.min(gap / 2, Math.max(gap * U_DIP, U_MIN_DIP))
    const x = d.x >= 0 ? Math.max(a.x, b.x) + dip : Math.min(a.x, b.x) - dip
    return [a, { x, y: a.y }, { x, y: b.y }, b]
  }
  if (route === 'elbow') {
    // Sideways, up/down, sideways; or up/down, sideways, up/down when the end it leaves from faces up or down.
    const lead = dirs?.start ?? dirs?.end
    if (lead && Math.abs(lead.y) > Math.abs(lead.x)) {
      const midY = (a.y + b.y) / 2
      return [a, { x: a.x, y: midY }, { x: b.x, y: midY }, b]
    }
    const midX = (a.x + b.x) / 2
    return [a, { x: midX, y: a.y }, { x: midX, y: b.y }, b]
  }
  if (route === 'straight') return [a, b]
  const bow = effectiveBend(a, b, bend) * 2
  const control = { x: (a.x + b.x) / 2 + (b.y - a.y) * bow, y: (a.y + b.y) / 2 - (b.x - a.x) * bow }
  return Array.from({ length: CURVE_STEPS + 1 }, (_, i) => {
    const t = i / CURVE_STEPS
    const u = 1 - t
    return { x: u * u * a.x + 2 * u * t * control.x + t * t * b.x, y: u * u * a.y + 2 * u * t * control.y + t * t * b.y }
  })
}

/** The points with `fromStart` cut off the start and `fromEnd` off the end, measured along the path. */
function trim(points: readonly XY[], fromStart: number, fromEnd: number): XY[] {
  const cutStart = (list: readonly XY[], amount: number): XY[] => {
    let left = amount
    for (let i = 1; i < list.length; i++) {
      const a = list.at(i - 1)!
      const b = list.at(i)!
      const length = Math.hypot(b.x - a.x, b.y - a.y)
      if (length >= left && length > 0) {
        const t = left / length
        return [{ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, ...list.slice(i)]
      }
      left -= length
    }
    return [list.at(-1)!, list.at(-1)!]
  }
  return cutStart(cutStart(points, fromStart).toReversed(), fromEnd).toReversed()
}

const pathLength = (points: readonly XY[]) => points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - points.at(i)!.x, p.y - points.at(i)!.y), 0)

/** Direction (unit vector) the path is heading at its very end. */
function headingAtEnd(points: readonly XY[]): XY {
  const tip = points.at(-1)!
  for (let i = points.length - 2; i >= 0; i--) {
    const p = points.at(i)!
    const length = Math.hypot(tip.x - p.x, tip.y - p.y)
    if (length > 1e-6) return { x: (tip.x - p.x) / length, y: (tip.y - p.y) / length }
  }
  return { x: 1, y: 0 }
}

/**
 * One drawn piece of an arrow end: a path stroked like the line, or a solid
 * shape filled with the arrow's colour (and not stroked, so a thick arrow's
 * head keeps its shape and sharp corners).
 */
export type ArrowPart = { d: string; filled: boolean }

/**
 * Size of an arrowhead for a given line width. It grows more slowly than the
 * line: thin arrows keep their usual heads, and a thick one gets a head not
 * much longer than the line is wide, like a block arrow. A longer arrow only
 * gets a longer line.
 */
export const headSize = (strokeWidth: number) => Math.max(8, 6 + strokeWidth * 1.25)

/** Ends drawn as lines (open heads, bars, circles, cups, forks): solid shapes take none of this. */
const STROKED_ENDS: ReadonlySet<EndKind> = new Set(['open', 'activation', 'inhibition', 'catalysis', 'binding', 'axon'])

/**
 * Size of an end drawn as lines: as `headSize`, plus room for a thick line's
 * own width, so a thick open head or circle keeps its shape instead of
 * closing up into a blob. Thin arrows (2 px or less) are unchanged.
 */
const strokedSize = (strokeWidth: number) => headSize(strokeWidth) + Math.max(0, strokeWidth - 2)

/** The most of an arrow's length its heads take together, so a short arrow keeps some line. */
export const MAX_HEADS_SHARE = 0.8

/** The head size an arrow along these points really gets: the usual one, made smaller when the arrow is too short for it. */
function fittedHead(points: readonly XY[], look: ArrowLook, strokeWidth: number, kind?: EndKind): number {
  const heads = [look.start, look.end].filter((end) => end !== 'none').length
  const s = kind && STROKED_ENDS.has(kind) ? strokedSize(strokeWidth) : headSize(strokeWidth)
  return heads === 0 ? s : Math.min(s, (pathLength(points) * MAX_HEADS_SHARE) / heads)
}

/** The drawn pieces of one end, and how much the line is shortened so it doesn't poke through them. */
function endParts(kind: EndKind, tip: XY, dir: XY, s: number, strokeWidth = 0): { parts: ArrowPart[]; inset: number } {
  const n = { x: -dir.y, y: dir.x }
  // Solid shapes aren't stroked, so they reach as far round the line as a stroked one would: half its width more.
  const half = strokeWidth / 2
  // A point `back` along the line from the tip and `side` across it.
  const at = (back: number, side: number): XY => ({ x: tip.x - dir.x * back + n.x * side, y: tip.y - dir.y * back + n.y * side })
  const arc = (centreBack: number, r: number, from: number, to: number, steps = 16) =>
    Array.from({ length: steps + 1 }, (_, i) => {
      const angle = from + ((to - from) * i) / steps
      return at(centreBack - r * Math.cos(angle), r * Math.sin(angle))
    })
  switch (kind) {
    case 'none':
      return { parts: [], inset: 0 }
    case 'open':
      return { parts: [{ d: polyline([at(s, s * 0.5), tip, at(s, -s * 0.5)]), filled: false }], inset: 0 }
    case 'filled': {
      // The line ends well inside the head, so it stays hidden on a curve too.
      const w = s * 0.45 + half
      return { parts: [{ d: polyline([tip, at(s, w), at(s, -w)], true), filled: true }], inset: s * 0.7 }
    }
    case 'activation':
      return { parts: [{ d: polyline([tip, at(s, s * 0.45), at(s, -s * 0.45)], true), filled: false }], inset: s }
    case 'inhibition':
      return { parts: [{ d: polyline([at(0, s * 0.7), at(0, -s * 0.7)]), filled: false }], inset: 0 }
    case 'catalysis': {
      const r = s * 0.4
      return { parts: [{ d: polyline(arc(r, r, 0, Math.PI * 2, 24), true), filled: false }], inset: r * 2 }
    }
    case 'binding': {
      // A cup that holds what the arrow points at, open towards the target.
      const r = s * 0.55
      return { parts: [{ d: polyline(arc(0, r, -Math.PI / 2, Math.PI / 2)), filled: false }], inset: r }
    }
    case 'half': {
      // A barb on one side, its long edge along the line's far edge; the line stops where the barb covers it.
      const w = s * 0.5 + strokeWidth
      return { parts: [{ d: polyline([at(0, -half), at(s, w - half), at(s, -half)], true), filled: true }], inset: (strokeWidth * s) / w }
    }
    case 'synapse': {
      // A filled bulb with its flat face at the tip.
      const r = s * 0.6 + half
      // The line runs up to its flat face, so the bulb sits on it with no gap.
      return { parts: [{ d: polyline(arc(0, r, -Math.PI / 2, Math.PI / 2), true), filled: true }], inset: 0 }
    }
    case 'axon':
      return {
        parts: [at(0, s * 0.6), tip, at(0, -s * 0.6)].map((end) => ({ d: polyline([at(s * 0.8, 0), end]), filled: false })),
        inset: s * 0.8,
      }
  }
}

export type ArrowDrawing = {
  /** The line itself, stroked. */
  shaft: string
  /** How the line's ends are drawn: flat for a solid line (so a thick arrow has a square tail), round for dashes and dots. */
  cap: 'butt' | 'round'
  /** The line for the outline, made longer by the outline's width at flat ends, so the outline goes round them; set when the arrow has an outline. */
  outlineShaft?: string
  /** Dash pattern for the line, in the same units as the points; undefined for a solid line. */
  dash?: number[]
  /** Heads, bars and other end pieces. */
  parts: ArrowPart[]
}

/** An arrow's own sizes, besides its line width: its outline's width (0: none). */
export type ArrowSize = { outline?: number }

/** The points made `atStart` longer before the start and `atEnd` longer past the end, straight on. */
function extend(points: readonly XY[], atStart: number, atEnd: number): XY[] {
  const out = (end: XY, dir: XY, by: number): XY => ({ x: end.x + dir.x * by, y: end.y + dir.y * by })
  const list = [...points]
  if (atStart > 0) list.unshift(out(points.at(0)!, headingAtEnd(points.toReversed()), atStart))
  if (atEnd > 0) list.push(out(points.at(-1)!, headingAtEnd(points), atEnd))
  return list
}

/** Everything needed to draw an arrow from `a` to `b` with this look and line width. */
export function drawArrow(a: XY, b: XY, look: ArrowLook, strokeWidth: number, dirs?: EndDirs, size: ArrowSize = {}): ArrowDrawing {
  const points = routePoints(a, b, look.route, dirs, look.bend)
  const s = fittedHead(points, look, strokeWidth)
  const endSize = (kind: EndKind) => fittedHead(points, look, strokeWidth, kind)
  // A curve's head points along the curve over the head's length, not just its last bit, so a thick head sits straight on the line.
  const heading = (list: readonly XY[]) => (look.route === 'curved' ? headingAtEnd([trim(list, 0, s).at(-1)!, list.at(-1)!]) : headingAtEnd(list))
  const end = endParts(look.end, b, heading(points), endSize(look.end), strokeWidth)
  const start = endParts(look.start, a, heading(points.toReversed()), endSize(look.start), strokeWidth)
  const parts = [...start.parts, ...end.parts]
  if (look.mid === 'tick') {
    // A short bar across the middle of the line, like a membrane being crossed.
    const total = pathLength(points)
    const firstHalf = trim(points, 0, total / 2)
    const centre = firstHalf.at(-1)!
    const dir = headingAtEnd(firstHalf)
    parts.push({ d: polyline([{ x: centre.x - dir.y * s * 0.7, y: centre.y + dir.x * s * 0.7 }, { x: centre.x + dir.y * s * 0.7, y: centre.y - dir.x * s * 0.7 }]), filled: false })
  }
  const dash = look.line === 'dashed' ? [strokeWidth * 3, strokeWidth * 2.5] : look.line === 'dotted' ? [0.01, strokeWidth * 2.5] : undefined
  const shaft = trim(points, start.inset, end.inset)
  const cap = look.line === 'solid' ? 'butt' : 'round'
  // A flat end with nothing on it needs the outline across it too.
  const outline = size.outline ?? 0
  const flat = (kind: EndKind) => (cap === 'butt' && kind === 'none' ? outline : 0)
  return {
    shaft: polyline(shaft),
    cap,
    ...(outline > 0 && { outlineShaft: polyline(extend(shaft, flat(look.start), flat(look.end))) }),
    ...(dash && { dash }),
    parts,
  }
}

/**
 * One path to draw for an arrow, in order: the outline's paths first (when it
 * has one: the same paths, wider, in the outline colour), then the arrow's
 * own on top, so the outline shows only round its edge. `width` 0: only
 * filled, not stroked (solid pieces). Outlines of solid pieces get sharp
 * corners, like the pieces.
 */
export type ArrowStroke = { d: string; role: 'outline' | 'line'; width: number; filled: boolean; cap: 'butt' | 'round'; join: 'miter' | 'round'; dash?: number[] }

export function arrowStrokes(drawing: ArrowDrawing, strokeWidth: number, outlineWidth = 0): ArrowStroke[] {
  const pass = (role: 'outline' | 'line', extra: number): ArrowStroke[] => [
    { d: role === 'outline' ? (drawing.outlineShaft ?? drawing.shaft) : drawing.shaft, role, width: strokeWidth + 2 * extra, filled: false, cap: drawing.cap, join: 'round', ...(drawing.dash && { dash: drawing.dash }) },
    ...drawing.parts.map((part): ArrowStroke => ({ d: part.d, role, width: part.filled ? 2 * extra : strokeWidth + 2 * extra, filled: part.filled, cap: 'round', join: part.filled ? 'miter' : 'round' })),
  ]
  return outlineWidth > 0 ? [...pass('outline', outlineWidth), ...pass('line', 0)] : pass('line', 0)
}

/**
 * Room between what an arrow draws and its box, in page pixels: the same for
 * every thickness, so a thick arrow's box still fits it closely. Enough that,
 * at 100% zoom, the side pills sit clear of the round end handles just past
 * the arrow's tips (the owner's call, 2026-11-26: 8 px made them overlap).
 */
const BOX_MARGIN = 18

/** The points a path written as M/L commands goes through. */
const pathPoints = (d: string): XY[] => [...d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) }))

/**
 * The box an arrow takes up: round what is drawn (its line, heads and
 * outline) with a fixed margin, so a thick arrow's box fits it as closely as
 * a thin one's.
 */
export function arrowBounds(a: XY, b: XY, look: ArrowLook, strokeWidth: number, dirs?: EndDirs, size: ArrowSize = {}): { left: number; top: number; width: number; height: number } {
  const drawing = drawArrow(a, b, look, strokeWidth, dirs, size)
  const outline = size.outline ?? 0
  // Lines reach half their width past their points; solid heads only their outline, which a sharp tip pushes out further.
  const reach = [
    ...pathPoints(drawing.outlineShaft ?? drawing.shaft).map((p) => ({ p, pad: strokeWidth / 2 + outline })),
    ...drawing.parts.flatMap((part) => pathPoints(part.d).map((p) => ({ p, pad: part.filled ? outline * 2.5 : strokeWidth / 2 + outline }))),
  ]
  const left = Math.min(...reach.map(({ p, pad }) => p.x - pad)) - BOX_MARGIN
  const top = Math.min(...reach.map(({ p, pad }) => p.y - pad)) - BOX_MARGIN
  const right = Math.max(...reach.map(({ p, pad }) => p.x + pad)) + BOX_MARGIN
  const bottom = Math.max(...reach.map(({ p, pad }) => p.y + pad)) + BOX_MARGIN
  return { left, top, width: right - left, height: bottom - top }
}

/* Shapes */

export type ShapeKind =
  | 'rectangle'
  | 'rounded'
  | 'ellipse'
  | 'circle'
  | 'pill'
  | 'triangle'
  | 'right-triangle'
  | 'diamond'
  | 'trapezoid'
  | 'parallelogram'
  | 'pentagon'
  | 'polygon'
  | 'octagon'
  | 'star'
  | 'pie'
  | 'slice'
  | 'line'
  | 'cell'
  | 'membrane'
  | 'callout'
  | 'bracket'
  | 'brace'
  | 'double-bracket'
  | 'double-brace'

/**
 * Every shape, in the order of the Shapes panel. A brace is a bracket in its
 * curly style, so it has no tile of its own (`inPanel: false`); the same goes
 * for the double brace. The hexagon
 * keeps its first id, `polygon`, so figures saved with it still open.
 */
export const SHAPES: { id: ShapeKind; name: string; inPanel?: false }[] = [
  { id: 'rectangle', name: 'Rectangle' },
  { id: 'rounded', name: 'Rounded' },
  { id: 'ellipse', name: 'Ellipse' },
  { id: 'circle', name: 'Circle' },
  { id: 'pill', name: 'Pill' },
  { id: 'triangle', name: 'Triangle' },
  { id: 'right-triangle', name: 'Right triangle' },
  { id: 'diamond', name: 'Diamond' },
  { id: 'trapezoid', name: 'Trapezoid' },
  { id: 'parallelogram', name: 'Parallelogram' },
  { id: 'pentagon', name: 'Pentagon' },
  { id: 'polygon', name: 'Hexagon' },
  { id: 'octagon', name: 'Octagon' },
  { id: 'star', name: 'Star' },
  { id: 'pie', name: 'Pie' },
  { id: 'slice', name: 'Pie slice' },
  { id: 'cell', name: 'Cell' },
  { id: 'callout', name: 'Callout' },
  { id: 'membrane', name: 'Membrane' },
  { id: 'bracket', name: 'Bracket' },
  { id: 'brace', name: 'Brace', inPanel: false },
  { id: 'double-bracket', name: 'Double bracket' },
  { id: 'double-brace', name: 'Double brace', inPanel: false },
]

/**
 * Brackets, in their two styles, square and curly (a brace): single ones,
 * with their text beside them, and double ones (an opening and a closing
 * bracket in one shape), with their text, or a picture, between them.
 */
export const BRACKETS: ReadonlySet<ShapeKind> = new Set(['bracket', 'brace', 'double-bracket', 'double-brace'])
/** The double brackets: both brackets in one shape. */
export const DOUBLE_BRACKETS: ReadonlySet<ShapeKind> = new Set(['double-bracket', 'double-brace'])
/** Curly brackets (braces). */
export const CURLY_BRACKETS: ReadonlySet<ShapeKind> = new Set(['brace', 'double-brace'])

/** The bracket kind for a style: single or double, square or curly. */
export const bracketKind = (double: boolean, curly: boolean): ShapeKind => (double ? (curly ? 'double-brace' : 'double-bracket') : curly ? 'brace' : 'bracket')

/** Shapes that are open lines: they take a line colour but no fill. */
export const OPEN_SHAPES: ReadonlySet<ShapeKind> = new Set(['line', 'membrane', ...BRACKETS])

/** Shapes that are tall and thin by default. */
export const TALL_SHAPES: ReadonlySet<ShapeKind> = new Set(['bracket', 'brace'])

/** How much wider than tall a shape starts (1: square). */
export const SHAPE_ASPECT: Partial<Record<ShapeKind, number>> = { ellipse: 1.4, pill: 2, trapezoid: 1.3, parallelogram: 1.4, 'double-bracket': 1.8, 'double-brace': 1.8 }

/**
 * How deep each bracket of a double bracket is, in page pixels, for a double
 * bracket `w` wide and `h` high: it follows the height, not the width, so a
 * wider double bracket keeps its brackets at the edges and only the room
 * between them grows.
 */
export const doubleBracketArm = (w: number, h: number): number => Math.min(w * 0.4, Math.max(4, h * 0.14))

/** Shapes made of straight sides, whose corners can be rounded. */
export const CORNER_SHAPES: ReadonlySet<ShapeKind> = new Set([
  'rectangle',
  'rounded',
  'triangle',
  'right-triangle',
  'diamond',
  'trapezoid',
  'parallelogram',
  'pentagon',
  'polygon',
  'octagon',
  'star',
  'callout',
])

/** How round a shape's corners are when none is set: the Rounded shape a fifth of its shorter side, the others sharp. */
export const defaultCornerRadius = (kind: ShapeKind, w: number, h: number): number => (kind === 'rounded' ? Math.min(w, h) * 0.2 : 0)

/** Points around an ellipse, starting at the top, stretched to fill the box. */
const around = (w: number, h: number, count: number, radius: (i: number) => number = () => 1): XY[] =>
  fillBox(
    Array.from({ length: count }, (_, i) => {
      const angle = -Math.PI / 2 + (i * Math.PI * 2) / count
      return { x: radius(i) * Math.cos(angle), y: radius(i) * Math.sin(angle) }
    }),
    w,
    h,
  )

/** The points moved and stretched so they just fill a box `w` wide and `h` high from (0, 0). */
function fillBox(points: readonly XY[], w: number, h: number): XY[] {
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const [left, top] = [Math.min(...xs), Math.min(...ys)]
  const [width, height] = [Math.max(...xs) - left || 1, Math.max(...ys) - top || 1]
  return points.map((p) => ({ x: ((p.x - left) / width) * w, y: ((p.y - top) / height) * h }))
}

/** The corners of a shape made of straight sides, in drawing order, or nothing for the others. */
function cornerPoints(kind: ShapeKind, w: number, h: number): XY[] | undefined {
  const at = (pairs: [number, number][]) => pairs.map(([x, y]) => ({ x: x * w, y: y * h }))
  switch (kind) {
    case 'rectangle':
    case 'rounded':
    case 'pill':
      return at([[0, 0], [1, 0], [1, 1], [0, 1]])
    case 'triangle':
      return at([[0.5, 0], [1, 1], [0, 1]])
    case 'right-triangle':
      return at([[0, 0], [1, 1], [0, 1]])
    case 'diamond':
      return at([[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]])
    case 'trapezoid':
      return at([[0.2, 0], [0.8, 0], [1, 1], [0, 1]])
    case 'parallelogram':
      return at([[0.25, 0], [1, 0], [0.75, 1], [0, 1]])
    case 'pentagon':
      return around(w, h, 5)
    case 'polygon':
      return around(w, h, 6)
    case 'octagon': {
      // Flat on all four sides, like a stop sign.
      const c = 1 - Math.SQRT1_2
      return at([[c, 0], [1 - c, 0], [1, c], [1, 1 - c], [1 - c, 1], [c, 1], [0, 1 - c], [0, c]])
    }
    case 'star':
      return around(w, h, 10, (i) => (i % 2 === 0 ? 1 : 0.42))
    case 'callout':
      return at([[0, 0], [1, 0], [1, 0.75], [0.4, 0.75], [0.2, 1], [0.25, 0.75], [0, 0.75]])
    default:
      return undefined
  }
}

/**
 * A closed outline through the points with each corner rounded off by a
 * circle of radius `r`. A corner never takes more than half of either side
 * next to it, so a big radius makes the roundest shape that fits (a pill from
 * a rectangle).
 */
export function roundedPolygon(points: readonly XY[], r: number): string {
  if (!(r > 0)) return polyline(points, true)
  const count = points.length
  let d = ''
  for (let i = 0; i < count; i++) {
    const [prev, corner, next] = [points[(i + count - 1) % count], points[i], points[(i + 1) % count]] as [XY, XY, XY]
    const a = { x: prev.x - corner.x, y: prev.y - corner.y }
    const b = { x: next.x - corner.x, y: next.y - corner.y }
    const [la, lb] = [Math.hypot(a.x, a.y), Math.hypot(b.x, b.y)]
    if (la === 0 || lb === 0) continue
    const half = Math.acos(Math.max(-1, Math.min(1, (a.x * b.x + a.y * b.y) / (la * lb)))) / 2
    // How far from the corner the curve starts on each side, and the radius that gives.
    const cut = Math.min(r / Math.tan(half), la / 2, lb / 2)
    const radius = cut * Math.tan(half)
    const from = { x: corner.x + (a.x / la) * cut, y: corner.y + (a.y / la) * cut }
    const to = { x: corner.x + (b.x / lb) * cut, y: corner.y + (b.y / lb) * cut }
    // Turning right on the page (y points down) goes clockwise.
    const sweep = (corner.x - prev.x) * (next.y - corner.y) - (corner.y - prev.y) * (next.x - corner.x) > 0 ? 1 : 0
    d += `${d ? ' L' : 'M'}${fmt(from.x)} ${fmt(from.y)} A${fmt(radius)} ${fmt(radius)} 0 0 ${sweep} ${fmt(to.x)} ${fmt(to.y)}`
  }
  return `${d} Z`
}

/** A smooth closed curve through the points (Catmull-Rom turned into cubic curves). */
function smoothClosed(points: readonly XY[]): string {
  const p = (i: number) => points.at(i % points.length)!
  let d = `M${fmt(p(0).x)} ${fmt(p(0).y)}`
  for (let i = 0; i < points.length; i++) {
    const [a, b, c, e] = [p(i - 1), p(i), p(i + 1), p(i + 2)]
    d += ` C${fmt(b.x + (c.x - a.x) / 6)} ${fmt(b.y + (c.y - a.y) / 6)} ${fmt(c.x - (e.x - b.x) / 6)} ${fmt(c.y - (e.y - b.y) / 6)} ${fmt(c.x)} ${fmt(c.y)}`
  }
  return `${d} Z`
}

/** A cell's slightly irregular outline: fixed, so every cell starts out the same. */
const CELL_WOBBLE = [1, 0.93, 0.99, 0.9, 0.97, 0.92, 1, 0.91]

/**
 * The shape's outline as SVG path data, filling a box `w` wide and `h` high
 * from (0, 0). `radius` rounds the corners of shapes made of straight sides
 * (see `CORNER_SHAPES`); left out, they get `defaultCornerRadius`.
 */
export function shapePath(kind: ShapeKind, w: number, h: number, radius?: number): string {
  const corners = cornerPoints(kind, w, h)
  if (kind === 'pill') return roundedPolygon(corners!, Infinity)
  if (corners) return roundedPolygon(corners, radius ?? defaultCornerRadius(kind, w, h))
  switch (kind) {
    case 'ellipse':
    case 'circle':
      return `M0 ${fmt(h / 2)} A${fmt(w / 2)} ${fmt(h / 2)} 0 1 0 ${fmt(w)} ${fmt(h / 2)} A${fmt(w / 2)} ${fmt(h / 2)} 0 1 0 0 ${fmt(h / 2)} Z`
    case 'pie':
      // Three quarters of a disc, the top-right quarter cut out.
      return `M${fmt(w / 2)} ${fmt(h / 2)} V0 A${fmt(w / 2)} ${fmt(h / 2)} 0 1 0 ${fmt(w)} ${fmt(h / 2)} Z`
    case 'slice':
      // A quarter of a disc, its point at the bottom left: the piece cut out of the pie, so it fits back in.
      return `M0 ${fmt(h)} V0 A${fmt(w)} ${fmt(h)} 0 0 1 ${fmt(w)} ${fmt(h)} Z`
    case 'line':
      return `M0 ${fmt(h)} L${fmt(w)} 0`
    case 'cell':
      return smoothClosed(around(w, h, CELL_WOBBLE.length, (i) => CELL_WOBBLE.at(i)!))
    case 'membrane': {
      // A lipid bilayer seen from the side: two wavy lines.
      const waves = Math.max(2, Math.round((w / Math.max(h, 1)) * 1.5))
      const wave = (y: number) => {
        const step = w / waves
        let d = `M0 ${fmt(y)}`
        for (let i = 0; i < waves; i++) d += ` Q${fmt(step * i + step / 4)} ${fmt(y - h * 0.15)} ${fmt(step * i + step / 2)} ${fmt(y)} T${fmt(step * (i + 1))} ${fmt(y)}`
        return d
      }
      return `${wave(h * 0.3)} ${wave(h * 0.7)}`
    }
    // Brackets open to the left and point right, like ] and }, so they can group things with a label to their right.
    case 'bracket':
      return `M0 0 H${fmt(w)} V${fmt(h)} H0`
    case 'brace': {
      const [x, m, W] = [fmt(w), fmt(w / 2), 0]
      return `M${W} 0 C${m} 0 ${m} 0 ${m} ${fmt(h * 0.1)} V${fmt(h * 0.4)} C${m} ${fmt(h * 0.5)} ${x} ${fmt(h * 0.5)} ${x} ${fmt(h * 0.5)} C${x} ${fmt(h * 0.5)} ${m} ${fmt(h * 0.5)} ${m} ${fmt(h * 0.6)} V${fmt(h * 0.9)} C${m} ${fmt(h)} ${m} ${fmt(h)} ${W} ${fmt(h)}`
    }
    case 'double-bracket':
    case 'double-brace':
      return doubleBracketPath(kind, w, h, doubleBracketArm(w, h))
    default:
      return polyline([], true)
  }
}

/**
 * A double bracket filling a box `w` by `h` from (0, 0): an opening bracket
 * on the left edge and a closing one on the right, each `arm` deep.
 */
export function doubleBracketPath(kind: ShapeKind, w: number, h: number, arm: number): string {
  if (kind === 'double-bracket') return `M${fmt(arm)} 0 H0 V${fmt(h)} H${fmt(arm)} M${fmt(w - arm)} 0 H${fmt(w)} V${fmt(h)} H${fmt(w - arm)}`
  // A closing brace's points from its open side (x 0) to its tip (x 1, in arms); the opening one is the same mirrored.
  const points: [number, number][][] = [
    [[0.5, 0], [0.5, 0], [0.5, 0.1]],
    [[0.5, 0.4]],
    [[0.5, 0.5], [1, 0.5], [1, 0.5]],
    [[1, 0.5], [0.5, 0.5], [0.5, 0.6]],
    [[0.5, 0.9]],
    [[0.5, 1], [0.5, 1], [0, 1]],
  ]
  const brace = (x: (share: number) => number) =>
    `M${fmt(x(0))} 0 ` + points.map((step) => (step.length === 1 ? 'L' : 'C') + step.map(([sx, sy]) => `${fmt(x(sx))} ${fmt(sy * h)}`).join(' ')).join(' ')
  return `${brace((share) => (1 - share) * arm)} ${brace((share) => w - arm + share * arm)}`
}
