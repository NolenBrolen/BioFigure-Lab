/**
 * Comparison blocks (BIO-95): two matching sides next to each other, for
 * "Control vs Treatment" and "Before / After" figures.
 *
 * A comparison is a sequence (BIO-75) whose steps are its two sides, so
 * carrying, copying, deleting, dropping things in, Detach and dragging one
 * side onto the other to swap them all work as they do for sequences. Each
 * side is a panel (BIO-74) holding an empty icon space to start with.
 *
 * What it adds: both sides are always the same size (resizing one resizes
 * the other the same way, every step of the drag), the gap is set by the look,
 * and between the sides it draws a divider, a "vs" or an arrow.
 *
 * Three looks (the owner asked for all of them, 2026-11-26): Twin panels (two
 * Header bar panels), Paired colours (grey and the block's colour) and Split
 * frame (one outlined frame cut in two). "vs" is never on unless picked: the
 * owner found it gimmicky for papers, but fine for posters and talks.
 */
import { FabricText, Path, Point, Rect, classRegistry, type FabricObject } from 'fabric'

import { DEFAULT_FONT, fontStack } from './fonts'
import { IconSpace, NEW_SPACE_SIZE, buildIconSpace, spaceBox, tintIconSpace } from './icon-space'
import { DEFAULT_PANEL, PanelBlock, bodyOf, innerOf, panelParts, setPanelBox, settingsOf, shade, updatePanel, wash, type Box, type PanelSettings, type PanelStyle } from './panel-block'
import { SequenceBlock, arrowPath, layOutSequence, type Mover, type SequencePlan } from './sequence-block'

export type ComparisonKind = 'versus' | 'change'
export type ComparisonLook = 'twin' | 'paired' | 'split'
/** What sits between the two sides of a Control vs Treatment block. */
export type ComparisonBetween = 'none' | 'line' | 'vs'

export type ComparisonSettings = {
  kind: ComparisonKind
  look: ComparisonLook
  /** The block's one colour (Paired colours: the second side's; the first is grey). */
  colour: string
  between: ComparisonBetween
  /** Written over a Before / After arrow ("+ LPS, 24 h"); empty for none. */
  arrowLabel: string
}

export const COMPARISON_KINDS: readonly { id: ComparisonKind; name: string; titles: [string, string] }[] = [
  { id: 'versus', name: 'Control vs Treatment', titles: ['Control', 'Treatment'] },
  { id: 'change', name: 'Before / After', titles: ['Before', 'After'] },
]

export const COMPARISON_LOOKS: readonly { id: ComparisonLook; name: string }[] = [
  { id: 'twin', name: 'Twin panels' },
  { id: 'paired', name: 'Paired colours' },
  { id: 'split', name: 'Split frame' },
]

export const COMPARISON_BETWEEN: readonly { id: ComparisonBetween; name: string }[] = [
  { id: 'none', name: 'None' },
  { id: 'line', name: 'Line' },
  { id: 'vs', name: 'vs' },
]

/** What each look starts with between Control and Treatment: a gap alone, or a divider; never "vs". */
export const LOOK_BETWEEN: Record<ComparisonLook, ComparisonBetween> = { twin: 'none', paired: 'line', split: 'line' }

export const DEFAULT_COMPARISON: ComparisonSettings = { kind: 'versus', look: 'twin', colour: '#0072b2', between: LOOK_BETWEEN.twin, arrowLabel: '' }

/** The first side in Paired colours. */
const PAIR_GREY = '#71717a'
const INK = '#27272a'
const DIVIDER_GREY = '#a1a1aa'
/** A new side's box. */
export const NEW_SIDE_SIZE = { width: 150, height: 124 }

export class ComparisonBlock extends SequenceBlock {
  static type = 'ComparisonBlock'
  declare comparison?: ComparisonSettings

  planLayout(steps: readonly FabricObject[], boxOf: (step: FabricObject) => Box, pinned?: FabricObject): SequencePlan {
    return comparisonPlan(comparisonSettingsOf(this), steps, boxOf, pinned)
  }
}
classRegistry.setClass(ComparisonBlock)

/**
 * One side of a comparison: a panel, which in the Split frame look is bare
 * (no box of its own, its title in small capitals over its middle), since the
 * comparison draws one frame round both sides.
 */
export class ComparisonSide extends PanelBlock {
  static type = 'ComparisonSide'
  declare bare?: boolean

  lookParts(settings: PanelSettings, size: { width: number; height: number }): FabricObject[] {
    return this.bare ? bareParts(settings, size) : super.lookParts(settings, size)
  }
}
classRegistry.setClass(ComparisonSide)

/** What a comparison and its sides save of their own. */
export const COMPARISON_PROPERTIES = ['comparison', 'bare'] as const

export const isComparison = (object: FabricObject | undefined): object is ComparisonBlock => object instanceof ComparisonBlock

export function comparisonSettingsOf(comparison: ComparisonBlock): ComparisonSettings {
  return { ...DEFAULT_COMPARISON, ...comparison.comparison }
}

export const comparisonName = (comparison: ComparisonBlock): string => COMPARISON_KINDS.find((kind) => kind.id === comparisonSettingsOf(comparison).kind)?.name ?? 'Comparison'

/* ---------- The sides ---------- */

/** A bare side's parts: an empty back (so a click picks it) and its title in small capitals, centred at the top. */
function bareParts(settings: PanelSettings, size: { width: number; height: number }): FabricObject[] {
  const back = new Rect({ left: 0, top: 0, width: size.width, height: size.height, fill: 'rgba(0,0,0,0)', strokeWidth: 0, originX: 'left', originY: 'top' })
  if (!settings.titleShown || !settings.title.trim()) return [back]
  const title = new FabricText(settings.title.toUpperCase(), { fontFamily: fontStack(DEFAULT_FONT), fontSize: 10, fontWeight: 700, charSpacing: 80, fill: shade(settings.colour, 0.85), strokeWidth: 0, originX: 'left', originY: 'top' })
  title.set({ left: (size.width - title.width) / 2, top: 10 })
  return [back, title]
}

/** How the side in this place (first 0) looks in a look: its panel style and colour, and whether it is bare. */
export function sideLook(settings: ComparisonSettings, index: number): { style: PanelStyle; colour: string; bare: boolean } {
  switch (settings.look) {
    case 'twin':
      return { style: 'bar', colour: settings.colour, bare: false }
    case 'paired':
      return { style: settings.kind === 'versus' ? 'tab' : 'soft', colour: index === 0 ? PAIR_GREY : settings.colour, bare: false }
    case 'split':
      return { style: 'soft', colour: settings.colour, bare: true }
  }
}

/**
 * Give a side the look of its place, and its icon spaces its colour; does
 * nothing when it already has them (it runs on every step of a drag).
 */
export function styleSide(side: FabricObject, settings: ComparisonSettings, index: number, contents: readonly FabricObject[]): void {
  if (!(side instanceof PanelBlock)) return
  const look = sideLook(settings, index)
  const now = settingsOf(side)
  const bare = side instanceof ComparisonSide && side.bare === true
  if (now.style !== look.style || now.colour !== look.colour || now.strong || bare !== look.bare) {
    if (side instanceof ComparisonSide) side.bare = look.bare
    updatePanel(side, { style: look.style, colour: look.colour, strong: false })
  }
  for (const object of contents) if (object instanceof IconSpace) tintIconSpace(object, look.colour)
}

/** A new side, its box at `box`. */
function buildSide(settings: PanelSettings, bare: boolean, box: Box): ComparisonSide {
  const side = new ComparisonSide(panelParts(settings, box).parts, { lockRotation: true })
  Object.assign(side, { panel: { ...settings }, panelWidth: box.width, panelHeight: box.height, bare })
  side.setControlVisible('mtr', false)
  setPanelBox(side, box)
  return side
}

/* ---------- Layout ---------- */

/** Each side's box when the layout last ran, to tell which edge of a resized side stayed put. Not saved. */
const lastBoxes = new WeakMap<FabricObject, Box>()

const same = (a: number, b: number) => Math.abs(a - b) < 0.01

function makeText(text: string, look: { colour: string; size: number; weight: number; italic?: boolean }): FabricText {
  return new FabricText(text, { fontFamily: fontStack(DEFAULT_FONT), fontSize: look.size, fontWeight: look.weight, fontStyle: look.italic ? 'italic' : 'normal', fill: look.colour, strokeWidth: 0, originX: 'left', originY: 'top' })
}

/** The space between the sides: each look's own, wider for an arrow, and wide enough for the arrow's label. */
function gapFor(settings: ComparisonSettings): number {
  const label = settings.kind === 'change' && settings.look !== 'split' && settings.arrowLabel.trim() ? makeText(settings.arrowLabel.trim(), { colour: INK, size: 11, weight: 500 }).width : 0
  switch (settings.look) {
    case 'twin':
      return settings.kind === 'change' ? Math.max(64, label + 24) : settings.between === 'vs' ? 48 : 32
    case 'paired':
      return settings.kind === 'change' ? Math.max(96, label + 32) : 36
    case 'split':
      return 0
  }
}

const named = <T extends FabricObject>(part: T, name: string): T => Object.assign(part, { name })

/** What goes between two sides, `left` and `right` their boxes, `y` the height of their contents' middle. */
function betweenParts(settings: ComparisonSettings, left: Box, right: Box, y: number): FabricObject[] {
  const { colour, look } = settings
  const x0 = left.x + left.width
  const x1 = right.x
  const cx = (x0 + x1) / 2
  const top = Math.min(left.y, right.y)
  const bottom = Math.max(left.y + left.height, right.y + right.height)
  const parts: FabricObject[] = []
  const vs = (fill: string) => {
    const word = makeText('vs', { colour: fill, size: look === 'twin' ? 12 : 11, weight: 700, italic: true })
    word.set({ left: cx - word.width / 2, top: y - word.height / 2 })
    return named(word, 'vs')
  }
  const label = () => {
    const text = settings.arrowLabel.trim()
    if (!text || look === 'split') return
    const word = makeText(text, { colour: look === 'twin' ? shade(colour) : INK, size: 11, weight: 500 })
    word.set({ left: cx - word.width / 2, top: y - (look === 'twin' ? 18 : 8) - word.height })
    parts.push(named(word, 'Arrow label'))
  }

  if (settings.kind === 'change') {
    if (look === 'twin') {
      // A fat block arrow in the block's colour.
      const from = x0 + 8
      const to = x1 - 8
      if (to - from >= 12) parts.push(named(arrowPath(new Point(from, y), new Point(to, y), colour, 12, Math.min(18, (to - from) / 2), 30), 'Arrow'))
      label()
    } else if (look === 'paired') {
      const from = x0 + 12
      const to = x1 - 12
      if (to - from >= 12) parts.push(named(arrowPath(new Point(from, y), new Point(to, y), INK, 2), 'Arrow'))
      label()
    } else {
      // The divider is a chevron pointing into the After side, which is tinted.
      const point = 8
      const h = bottom - top
      const end = right.x + right.width
      const r = Math.min(10, h / 2)
      parts.push(
        named(
          new Path(`M ${x0 - point} ${top} H ${end - r} Q ${end} ${top} ${end} ${top + r} V ${bottom - r} Q ${end} ${bottom} ${end - r} ${bottom} H ${x0 - point} L ${x0 + point} ${top + h / 2} Z`, { fill: wash(colour, 0.1), strokeWidth: 0, objectCaching: false }),
          'After tint',
        ),
      )
      parts.push(named(new Path(`M ${x0 - point} ${top} L ${x0 + point} ${top + h / 2} L ${x0 - point} ${bottom}`, { fill: '', stroke: colour, strokeWidth: 1.5, strokeLineJoin: 'round', objectCaching: false }), 'Divider'))
    }
    return parts
  }

  if (settings.between === 'none') return parts
  if (look === 'twin') {
    if (settings.between === 'line') parts.push(named(new Path(`M ${cx} ${top + 8} V ${bottom - 8}`, { fill: '', stroke: DIVIDER_GREY, strokeWidth: 1.25, strokeDashArray: [3, 3], objectCaching: false }), 'Divider'))
    else {
      parts.push(named(new Rect({ left: cx, top: y, width: 30, height: 30, rx: 15, ry: 15, fill: '#ffffff', stroke: colour, strokeWidth: 1.5, originX: 'center', originY: 'center' }), 'vs badge'))
      parts.push(vs(colour))
    }
  } else if (look === 'paired') {
    const word = settings.between === 'vs'
    const gapAt = (from: number, to: number) => named(new Path(`M ${cx} ${from} V ${to}`, { fill: '', stroke: DIVIDER_GREY, strokeWidth: 1.25, strokeDashArray: [3, 3], objectCaching: false }), 'Divider')
    if (word) {
      parts.push(gapAt(top + 8, y - 14), gapAt(y + 14, bottom - 8))
      parts.push(vs(PAIR_GREY))
    } else parts.push(gapAt(top + 8, bottom - 8))
  } else {
    parts.push(named(new Path(`M ${cx} ${top} V ${bottom}`, { fill: '', stroke: colour, strokeWidth: 1.5, objectCaching: false }), 'Divider'))
    if (settings.between === 'vs') {
      parts.push(named(new Rect({ left: cx, top: y, width: 30, height: 20, rx: 10, ry: 10, fill: colour, strokeWidth: 0, originX: 'center', originY: 'center' }), 'vs badge'))
      parts.push(vs('#ffffff'))
    }
  }
  return parts
}

function boxOfPart(part: FabricObject): Box {
  part.setCoords()
  const rect = part.getBoundingRect()
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
}

function union(boxes: readonly Box[]): Box {
  const x = Math.min(...boxes.map((box) => box.x))
  const y = Math.min(...boxes.map((box) => box.y))
  return { x, y, width: Math.max(...boxes.map((box) => box.x + box.width)) - x, height: Math.max(...boxes.map((box) => box.y + box.height)) - y }
}

/**
 * Where the sides go and what is drawn round them. First every side takes
 * the size of `pinned` (the one being resized, else the first): each grows
 * or shrinks from the same edge as `pinned` did, so what it holds stays put
 * in it just as in `pinned`. Then they stand in a row from `pinned`, tops
 * level, the look's gap between them.
 */
export function comparisonPlan(settings: ComparisonSettings, steps: readonly FabricObject[], boxOf: (step: FabricObject) => Box, pinned?: FabricObject): SequencePlan {
  const sides = [...steps].sort((a, b) => boxOf(a).x + boxOf(a).width / 2 - (boxOf(b).x + boxOf(b).width / 2))
  const anchor = pinned && sides.includes(pinned) ? pinned : sides[0]
  if (!anchor) return { moves: [], parts: [], frame: { x: 0, y: 0, width: 0, height: 0 } }

  // Matching sizes: the others change the way the pinned side just did.
  const size = boxOf(anchor)
  const before = lastBoxes.get(anchor)
  const keptRight = before !== undefined && !same(before.x, size.x) && same(before.x + before.width, size.x + size.width)
  const keptBottom = before !== undefined && !same(before.y, size.y) && same(before.y + before.height, size.y + size.height)
  for (const side of sides) {
    const box = boxOf(side)
    if (side === anchor || !(side instanceof PanelBlock) || (same(box.width, size.width) && same(box.height, size.height))) continue
    setPanelBox(side, { x: keptRight ? box.x + box.width - size.width : box.x, y: keptBottom ? box.y + box.height - size.height : box.y, width: size.width, height: size.height })
  }

  // The row, from the pinned side.
  const gap = gapFor(settings)
  const at = sides.indexOf(anchor)
  const moves = sides.map((side, i) => {
    const box = boxOf(side)
    return { step: side, dx: size.x + (i - at) * (size.width + gap) - box.x, dy: size.y - box.y }
  })
  const boxes = sides.map((side, i) => {
    const box = boxOf(side)
    const move = moves.at(i) ?? { dx: 0, dy: 0 }
    return { ...box, x: box.x + move.dx, y: box.y + move.dy }
  })
  for (const [i, side] of sides.entries()) {
    const box = boxes.at(i)
    if (box) lastBoxes.set(side, box)
  }

  // The contents' middle, under a header or title: where the divider's "vs" and the arrow sit.
  const first = sides[0]
  const firstBox = boxes[0]
  const inner = first instanceof PanelBlock && firstBox ? innerOf(first) : undefined
  const middle = inner && firstBox && first ? inner.y + inner.height / 2 + (firstBox.y - boxOf(first).y) : size.y + size.height / 2

  const parts: FabricObject[] = []
  if (settings.look === 'split' && boxes.length > 0) {
    // One frame round both sides; what goes between them is drawn over it.
    const all = union(boxes)
    parts.push(named(new Rect({ left: all.x, top: all.y, width: all.width, height: all.height, rx: 10, ry: 10, fill: '#ffffff', stroke: settings.colour, strokeWidth: 1.5, strokeUniform: true, originX: 'left', originY: 'top' }), 'Frame'))
  }
  for (let i = 1; i < boxes.length; i++) {
    const left = boxes.at(i - 1)
    const right = boxes.at(i)
    if (left && right) parts.push(...betweenParts(settings, left, right, middle))
  }

  // The whole area: the sides with what sticks out of them (a title tab) and the parts between.
  const outlines = sides.map((side, i) => {
    side.setCoords()
    const rect = side.getBoundingRect()
    const move = moves.at(i) ?? { dx: 0, dy: 0 }
    return { x: rect.left + move.dx, y: rect.top + move.dy, width: rect.width, height: rect.height }
  })
  const frame = union([...boxes, ...outlines, ...parts.map(boxOfPart)])
  return { moves, parts, frame }
}

/* ---------- A new comparison ---------- */

/**
 * A new comparison of `kind` in its first look, its middle at `centre`: two
 * sides, each with an empty icon space in the middle of its room. The sides
 * and spaces still need their holders' ids once they have them.
 */
export function buildComparison(kind: ComparisonKind, centre: { x: number; y: number }): { comparison: ComparisonBlock; sides: ComparisonSide[]; spaces: IconSpace[][] } {
  const settings: ComparisonSettings = { ...DEFAULT_COMPARISON, kind }
  const titles = COMPARISON_KINDS.find((each) => each.id === kind)?.titles ?? ['Control', 'Treatment']
  const sides = titles.map((title, i) => {
    const look = sideLook(settings, i)
    const box = { x: i * (NEW_SIDE_SIZE.width + 40), y: 0, ...NEW_SIDE_SIZE }
    return buildSide({ ...DEFAULT_PANEL, style: look.style, colour: look.colour, title }, look.bare, box)
  })
  const spaces = sides.map((side) => {
    const room = innerOf(side)
    return [buildIconSpace({ x: room.x + (room.width - NEW_SPACE_SIZE) / 2, y: room.y + (room.height - NEW_SPACE_SIZE) / 2 }, undefined, settingsOf(side).colour)]
  })
  const comparison = new ComparisonBlock([new Rect({ width: 1, height: 1, fill: 'rgba(0,0,0,0)', strokeWidth: 0 })], { lockRotation: true, lockScalingX: true, lockScalingY: true, lockSkewingX: true, lockSkewingY: true })
  comparison.comparison = settings
  // Each side moves with its space.
  const move: Mover = (step, dx, dy) => {
    const at = sides.indexOf(step as ComparisonSide)
    for (const object of [step, ...(spaces.at(at) ?? [])]) {
      object.set({ left: object.left + dx, top: object.top + dy })
      object.setCoords()
    }
  }
  layOutSequence(comparison, sides, sideBox, sides[0], move)
  // Then everything moves so the block's middle is at `centre`.
  const area = comparison.getBoundingRect()
  const dx = centre.x - (area.left + area.width / 2)
  const dy = centre.y - (area.top + area.height / 2)
  for (const object of [comparison, ...sides, ...spaces.flat()]) {
    object.set({ left: object.left + dx, top: object.top + dy })
    object.setCoords()
  }
  for (const side of sides) lastBoxes.set(side, bodyOf(side))
  return { comparison, sides, spaces }
}

/** A side's box on the page, for the layout (a side is a panel; anything else that became one is measured as drawn). */
export function sideBox(object: FabricObject): Box {
  if (object instanceof PanelBlock) return bodyOf(object)
  if (object instanceof IconSpace) return spaceBox(object)
  const rect = object.getBoundingRect()
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
}

/** Swap two sides' places (the first and the second, left to right): returns the moves, each side with what it holds. */
export function swapMoves(sides: readonly FabricObject[]): { side: FabricObject; dx: number }[] {
  const [a, b] = [...sides].sort((p, q) => sideBox(p).x - sideBox(q).x)
  if (!a || !b) return []
  const [boxA, boxB] = [sideBox(a), sideBox(b)]
  // Both the same size: the second takes the first's left edge, the first ends where the second ended.
  return [
    { side: b, dx: boxA.x - boxB.x },
    { side: a, dx: boxB.x + boxB.width - boxA.width - boxA.x },
  ]
}
