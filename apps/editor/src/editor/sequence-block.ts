/**
 * Sequence blocks (BIO-75): a row of steps with even gaps and something
 * between them that says "then" (arrows, a timeline, numbered cards or one
 * ribbon), across the page or down it, each step with an optional label.
 *
 * Like a panel (BIO-74), the sequence object only draws its own look. The
 * steps stay ordinary objects on the page (icons, icon spaces, panels...),
 * each pointing at the sequence with `panelId` (the sequence's `figureId`),
 * so every tool keeps working on them and moving, copying and deleting the
 * sequence takes them along. The steps' order is where they lie: left to
 * right across, top to bottom down.
 *
 * `layOutSequence` keeps it tidy: the steps' middles on one line, the gaps
 * between them even, and the look drawn again around them. FigureCanvas runs
 * it whenever a step is resized, dropped, added or taken away, holding one
 * step still (the one being resized, or the first) so nothing jumps.
 *
 * The four looks (the owner asked for all of them, 2026-11-25): Arrows,
 * Timeline, Step cards and Ribbon.
 */
import { Circle, FabricText, Group, IText, Path, Point, Rect, classRegistry, util, type FabricObject } from 'fabric'

import { DEFAULT_FONT, fontStack } from './fonts'
import { shade, wash, type Box } from './panel-block'
import { familyOf, processOrder, processPlan, type BranchLook, type CycleLook } from './process-looks'

/** The four sequence looks, and the cycle and branching looks built on them (BIO-96, `process-looks.ts`). */
export type SequenceLook = 'arrows' | 'timeline' | 'cards' | 'ribbon' | CycleLook | BranchLook
export type SequenceDirection = 'across' | 'down'

export type SequenceSettings = {
  look: SequenceLook
  direction: SequenceDirection
  /** The look's one colour, a hex like "#0072b2". */
  colour: string
  /** Space between one step (or card) and the next, in page pixels. */
  gap: number
  /** Whether the step labels show. */
  labelsShown: boolean
  /** Each step's label, first step first. Kept when steps go, for when they come back. */
  labels: string[]
  /** A cycle's middle text, e.g. "Cell cycle" (BIO-96); other looks have none. */
  title?: string
}

export const SEQUENCE_LOOKS: readonly { id: SequenceLook; name: string }[] = [
  { id: 'arrows', name: 'Arrows' },
  { id: 'timeline', name: 'Timeline' },
  { id: 'cards', name: 'Step cards' },
  { id: 'ribbon', name: 'Ribbon' },
]

/** Each look's own gap, which picking the look starts it on. */
// The cycle and branching gaps (BIO-96) are written out here, not read from process-looks.ts: that file imports this one, so its values aren't there yet when this line runs.
export const LOOK_GAP: Record<SequenceLook, number> = { arrows: 48, timeline: 32, cards: 30, ribbon: 4, ring: 40, segments: 30, loop: 40, tree: 24, fan: 40, rows: 12 }
export const GAP_RANGE = { min: 0, max: 120 }

/** Every look starts in the panels' blue, and keeps its colour when the style changes (like a panel's). */
export const DEFAULT_SEQUENCE: SequenceSettings = { look: 'arrows', direction: 'across', colour: '#0072b2', gap: LOOK_GAP.arrows, labelsShown: true, labels: [] }

/** Where a sequence's steps go and the parts that draw its look, in page coordinates. */
export type SequencePlan = { moves: { step: FabricObject; dx: number; dy: number }[]; parts: FabricObject[]; frame: Box }

export class SequenceBlock extends Group {
  static type = 'SequenceBlock'
  declare sequence?: SequenceSettings
  /** Where its steps go and its look's parts; a comparison (comparison-block.ts, BIO-95) lays itself out its own way. */
  planLayout(steps: readonly FabricObject[], boxOf: (step: FabricObject) => Box, pinned?: FabricObject): SequencePlan {
    return sequencePlan(sequenceSettingsOf(this), steps, boxOf, pinned)
  }
}
classRegistry.setClass(SequenceBlock)

/** What a sequence saves of its own (its own panel is `panelId`, saved with the panel's). */
export const SEQUENCE_PROPERTIES = ['sequence'] as const

export const isSequence = (object: FabricObject | undefined): object is SequenceBlock => object instanceof SequenceBlock

export function sequenceSettingsOf(sequence: SequenceBlock): SequenceSettings {
  const saved = sequence.sequence
  return { ...DEFAULT_SEQUENCE, ...saved, labels: [...(saved?.labels ?? [])] }
}

/* ---------- Labels ---------- */

/**
 * The label a new last step gets: the next in the labels' own count when
 * there is one ("Day 0", "Day 5" → "Day 10"; "Step 2" → "Step 3"), else none.
 */
export function nextLabel(labels: readonly string[], index: number): string {
  const kept = labels[index]
  if (kept) return kept
  const numbered = (label: string | undefined) => (label === undefined ? undefined : /^(.*?)(-?\d+(?:\.\d+)?)(\D*)$/.exec(label))
  const last = numbered(labels[index - 1])
  if (!last) return ''
  const before = numbered(labels[index - 2])
  const step = before && before[1] === last[1] && before[3] === last[3] ? Number(last[2]) - Number(before[2]) : 1
  return `${last[1]}${Number(last[2]) + (step || 1)}${last[3]}`
}

/* ---------- Layout ---------- */

const INK = '#27272a'
const ARROW = { width: 2, head: 9, headWidth: 9, inset: 8 }
const AXIS = { width: 3, gap: 14, dot: 5, before: 10, after: 24 }
const CARD = { pad: 14, radius: 10, badge: 10 }
const RIBBON = { pad: 18, point: 16, crossPad: 12 }
const LABEL_GAP = 10

/** One step as the layout sees it: its box on the page before and after. */
type Placed = { step: FabricObject; box: Box; main: number; cross: number; size: number; crossSize: number }

/** Moves a step by (dx, dy), with whatever it holds. */
export type Mover = (step: FabricObject, dx: number, dy: number) => void

const moveOnly: Mover = (step, dx, dy) => {
  if (dx === 0 && dy === 0) return
  step.set({ left: step.left + dx, top: step.top + dy })
  step.setCoords()
}

/** A filled arrow (shaft and head in one shape) from `from` to `to`, in page coordinates. */
export function arrowPath(from: Point, to: Point, colour: string, width: number, head = ARROW.head, headWidth = ARROW.headWidth): Path {
  const length = Math.max(0.01, from.distanceFrom(to))
  const ux = (to.x - from.x) / length
  const uy = (to.y - from.y) / length
  const nx = -uy
  const ny = ux
  const neck = { x: to.x - ux * Math.min(head, length), y: to.y - uy * Math.min(head, length) }
  const w = width / 2
  const h = headWidth / 2
  const points = [
    [from.x + nx * w, from.y + ny * w],
    [neck.x + nx * w, neck.y + ny * w],
    [neck.x + nx * h, neck.y + ny * h],
    [to.x, to.y],
    [neck.x - nx * h, neck.y - ny * h],
    [neck.x - nx * w, neck.y - ny * w],
    [from.x - nx * w, from.y - ny * w],
  ]
  return new Path(`M ${points.map(([x, y]) => `${x} ${y}`).join(' L ')} Z`, { fill: colour, strokeWidth: 0, objectCaching: false })
}

export function makeLabel(text: string, look: { colour: string; weight: number; size?: number }): FabricText {
  return new FabricText(text, { fontFamily: fontStack(DEFAULT_FONT), fontSize: look.size ?? 11, fontWeight: look.weight, fill: look.colour, originX: 'left', originY: 'top' })
}

export function boxOfPart(part: FabricObject): Box {
  part.setCoords()
  const rect = part.getBoundingRect()
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
}

export function union(boxes: readonly Box[]): Box {
  const x = Math.min(...boxes.map((box) => box.x))
  const y = Math.min(...boxes.map((box) => box.y))
  return { x, y, width: Math.max(...boxes.map((box) => box.x + box.width)) - x, height: Math.max(...boxes.map((box) => box.y + box.height)) - y }
}

/**
 * The steps' order: along the row; steps level with each other (within half
 * a pixel) go by the other direction, so a row turned from across to down
 * keeps its order, and the stack decides the rest.
 */
function byPlace(a: { main: number; cross: number }, b: { main: number; cross: number }): number {
  const along = a.main - b.main
  if (Math.abs(along) > 0.5) return along
  const beside = a.cross - b.cross
  return Math.abs(beside) > 0.5 ? beside : 0
}

/**
 * Where the steps go and the parts that draw the look, in page coordinates.
 * The steps are put in order by where they lie; `pinned` (else the first)
 * stays where it is and sets the line the others' middles sit on.
 */
export function sequencePlan(settings: SequenceSettings, steps: readonly FabricObject[], boxOf: (step: FabricObject) => Box, pinned?: FabricObject): SequencePlan {
  // A cycle or branching (BIO-96) places its steps its own way.
  if (familyOf(settings.look) !== 'sequence') return processPlan(settings, steps, boxOf, pinned)
  const across = settings.direction === 'across'
  // Work along the row (main) and across it (cross); P turns that back into page x and y.
  const P = (main: number, cross: number) => (across ? new Point(main, cross) : new Point(cross, main))
  const placed: Placed[] = steps
    .map((step) => {
      const box = boxOf(step)
      return across
        ? { step, box, main: box.x + box.width / 2, cross: box.y + box.height / 2, size: box.width, crossSize: box.height }
        : { step, box, main: box.y + box.height / 2, cross: box.x + box.width / 2, size: box.height, crossSize: box.width }
    })
    .sort(byPlace)
  const [firstPlaced] = placed
  if (!firstPlaced) return { moves: [], parts: [], frame: { x: 0, y: 0, width: 0, height: 0 } }

  const { look, colour } = settings
  const gap = Math.max(0, settings.gap)
  const biggest = Math.max(...placed.map((each) => each.size))
  const half = Math.max(...placed.map((each) => each.crossSize)) / 2
  // Cards and ribbon pieces are all the same size; arrows and timeline steps take their own room.
  const slot = (each: Placed) => (look === 'cards' ? biggest + 2 * CARD.pad : look === 'ribbon' ? biggest + 2 * RIBBON.pad + RIBBON.point : each.size)
  // A ribbon piece's notch takes the point of the one before, so its step sits a little further along.
  const offset = look === 'ribbon' ? RIBBON.point / 2 : 0

  // Each step's room along the row, one after the other from 0, gaps between.
  let run = 0
  const rooms = placed.map((each) => {
    const room = { each, start: run, end: run + slot(each) }
    run = room.end + gap
    return room
  })
  // Then shifted so the pinned step (else the first) stays where it is; its middle sets the line.
  const anchor = rooms.find((room) => room.each.step === pinned) ?? { each: firstPlaced, start: 0, end: slot(firstPlaced) }
  const shift = anchor.each.main - offset - (anchor.end - anchor.start) / 2 - anchor.start
  const slots = rooms.map(({ each, start, end }) => ({ each, start: start + shift, end: end + shift, centre: start + shift + offset + (end - start) / 2 }))
  const line = anchor.each.cross
  /** Each step with the next one, for what goes in the gaps. */
  const gapsBetween = slots.slice(1).map((next, i) => ({ before: slots.at(i) ?? next, next }))

  const moves = slots.map(({ each, centre }) => {
    const dMain = centre - each.main
    const dCross = line - each.cross
    return across ? { step: each.step, dx: dMain, dy: dCross } : { step: each.step, dx: dCross, dy: dMain }
  })
  // The steps' boxes where they will be.
  const boxes = placed.map((each) => {
    const move = moves.find((m) => m.step === each.step) ?? { dx: 0, dy: 0 }
    return { ...each.box, x: each.box.x + move.dx, y: each.box.y + move.dy }
  })

  // The labels: under the steps across, to their right down the page.
  const shown = settings.labelsShown ? placed.map((_, i) => settings.labels.at(i)?.trim() ?? '') : placed.map(() => '')
  const labelLook = look === 'timeline' ? { colour: shade(colour, 0.85), weight: 600 } : look === 'ribbon' ? { colour: shade(colour, 0.45), weight: 600 } : { colour: INK, weight: 500 }
  const labels = shown.map((text) => (text ? makeLabel(text, labelLook) : undefined))
  // How much room labels take across the row (their height across, their width down).
  const labelRoom = Math.max(0, ...labels.map((label) => (label ? (across ? label.height : label.width) : 0)))
  const placeLabel = (label: FabricText | undefined, centre: number, at: number) => {
    if (!label) return
    // Centred on the step along the row; its near edge `at` across it.
    const corner = P(centre - (across ? label.width : label.height) / 2, at)
    label.set({ left: corner.x, top: corner.y })
  }

  const parts: FabricObject[] = []
  switch (look) {
    case 'arrows': {
      for (const { before, next } of gapsBetween) {
        const from = before.end + ARROW.inset
        const to = next.start - ARROW.inset
        if (to - from >= 6) parts.push(arrowPath(P(from, line), P(to, line), colour, ARROW.width))
      }
      slots.forEach(({ centre }, i) => placeLabel(labels.at(i), centre, line + half + LABEL_GAP))
      break
    }
    case 'timeline': {
      const axis = line + half + AXIS.gap
      const start = (slots.at(0)?.start ?? 0) - AXIS.before
      const end = (slots.at(-1)?.end ?? 0) + AXIS.after
      parts.push(arrowPath(P(start, axis), P(end, axis), colour, AXIS.width, 11, 11))
      for (const { centre } of slots) {
        const dot = P(centre, axis)
        parts.push(new Circle({ left: dot.x, top: dot.y, radius: AXIS.dot, fill: '#ffffff', stroke: colour, strokeWidth: 2.5, originX: 'center', originY: 'center' }))
      }
      slots.forEach(({ centre }, i) => placeLabel(labels.at(i), centre, axis + AXIS.dot + LABEL_GAP))
      break
    }
    case 'cards': {
      const top = line - half - CARD.pad
      const bottom = line + half + CARD.pad + (labelRoom ? labelRoom + 6 : 0)
      for (const { start, end } of slots) {
        const a = P(start, top)
        const b = P(end, bottom)
        parts.push(new Rect({ left: Math.min(a.x, b.x), top: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y), rx: CARD.radius, ry: CARD.radius, fill: wash(colour, 0.08), stroke: wash(colour, 0.45), strokeWidth: 1, originX: 'left', originY: 'top' }))
      }
      slots.forEach(({ centre }, i) => placeLabel(labels.at(i), centre, line + half + 6))
      // The step's number on the card's top-left corner.
      slots.forEach(({ start }, i) => {
        const a = P(start, top)
        const corner = { x: a.x + 2, y: a.y + 2 }
        parts.push(new Circle({ left: corner.x, top: corner.y, radius: CARD.badge, fill: colour, strokeWidth: 0, originX: 'center', originY: 'center' }))
        const number = makeLabel(String(i + 1), { colour: '#ffffff', weight: 700, size: 10 })
        number.set({ left: corner.x - number.width / 2, top: corner.y - number.height / 2 })
        parts.push(number)
      })
      // A chevron in each gap.
      for (const { before } of gap >= 14 ? gapsBetween : []) {
        const middle = before.end + gap / 2
        const tip = P(middle + 4.5, line)
        const wingA = P(middle - 4.5, line - 9)
        const wingB = P(middle - 4.5, line + 9)
        parts.push(new Path(`M ${wingA.x} ${wingA.y} L ${tip.x} ${tip.y} L ${wingB.x} ${wingB.y}`, { fill: '', stroke: colour, strokeWidth: 3, strokeLineCap: 'round', strokeLineJoin: 'round', objectCaching: false }))
      }
      break
    }
    case 'ribbon': {
      const top = line - half - RIBBON.crossPad
      const bottom = line + half + RIBBON.crossPad + (labelRoom ? labelRoom + 4 : 0)
      const middle = (top + bottom) / 2
      slots.forEach(({ start: s, end: e }, i) => {
        const points = [P(s, top), P(e, top), P(e + RIBBON.point, middle), P(e, bottom), P(s, bottom), ...(i > 0 ? [P(s + RIBBON.point, middle)] : [])]
        const fill = wash(colour, Math.min(0.75, 0.14 + 0.13 * i))
        parts.push(new Path(`M ${points.map((point) => `${point.x} ${point.y}`).join(' L ')} Z`, { fill, strokeWidth: 0, objectCaching: false }))
      })
      slots.forEach(({ centre }, i) => placeLabel(labels.at(i), centre, line + half + 4))
      break
    }
  }
  for (const label of labels) if (label) parts.push(label)

  const frame = union([...boxes, ...parts.map(boxOfPart)])
  return { moves, parts, frame }
}

/** The invisible box under the look: the sequence's whole area, which selects it and sets where it sits. */
function frameRect(frame: Box): Rect {
  return new Rect({ left: frame.x, top: frame.y, width: frame.width, height: frame.height, fill: 'rgba(0,0,0,0)', strokeWidth: 0, originX: 'left', originY: 'top' })
}

/** The sequence's whole area on the page (its steps and its look). Sequences are never turned or stretched. */
export function sequenceBox(sequence: SequenceBlock): Box {
  const frame = sequence.getObjects()[0]
  if (!frame) {
    const rect = sequence.getBoundingRect()
    return { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
  }
  const matrix = util.multiplyTransformMatrices(sequence.calcTransformMatrix(), frame.calcOwnMatrix())
  const corner = util.transformPoint(new Point(-frame.width / 2, -frame.height / 2), matrix)
  return { x: corner.x, y: corner.y, width: frame.width * sequence.scaleX, height: frame.height * sequence.scaleY }
}

/** Put the look's parts into the sequence, with its frame first, and move it so the frame is at `frame` on the page. */
function fill(sequence: SequenceBlock, parts: FabricObject[], frame: Box): void {
  sequence.set({ scaleX: 1, scaleY: 1, angle: 0 })
  sequence.removeAll()
  sequence.add(frameRect(frame), ...parts)
  const now = sequenceBox(sequence)
  sequence.set({ left: sequence.left + frame.x - now.x, top: sequence.top + frame.y - now.y })
  sequence.setCoords()
}

/** A new sequence around these steps (laid out from the first), and the moves that line the steps up. */
export function buildSequence(settings: SequenceSettings, steps: readonly FabricObject[], boxOf: (step: FabricObject) => Box, move: Mover = moveOnly): SequenceBlock {
  const plan = sequencePlan(settings, steps, boxOf)
  for (const { step, dx, dy } of plan.moves) move(step, dx, dy)
  const sequence = new SequenceBlock([frameRect(plan.frame), ...plan.parts], { lockRotation: true, lockScalingX: true, lockScalingY: true, lockSkewingX: true, lockSkewingY: true })
  sequence.sequence = { ...settings, labels: [...settings.labels] }
  const now = sequenceBox(sequence)
  sequence.set({ left: sequence.left + plan.frame.x - now.x, top: sequence.top + plan.frame.y - now.y })
  sequence.setCoords()
  return sequence
}

/**
 * Line the steps up again and draw the look around them: the middles on one
 * line, the gaps even, the `pinned` step (else the first) left where it is.
 */
export function layOutSequence(sequence: SequenceBlock, steps: readonly FabricObject[], boxOf: (step: FabricObject) => Box, pinned?: FabricObject, move: Mover = moveOnly): void {
  if (steps.length === 0) return
  const plan = sequence.planLayout(steps, boxOf, pinned)
  for (const { step, dx, dy } of plan.moves) move(step, dx, dy)
  fill(sequence, plan.parts, plan.frame)
}

/** The steps in order, first first (left to right across, top to bottom down). */
export function orderedSteps(sequence: SequenceBlock, steps: readonly FabricObject[], boxOf: (step: FabricObject) => Box): FabricObject[] {
  const { look, direction } = sequenceSettingsOf(sequence)
  if (familyOf(look) !== 'sequence') return processOrder(look, steps.map((step) => ({ step, box: boxOf(step) }))).map((each) => each.step)
  const across = direction === 'across'
  const place = (step: FabricObject) => {
    const box = boxOf(step)
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    return { step, main: across ? x : y, cross: across ? y : x }
  }
  return steps
    .map(place)
    .sort(byPlace)
    .map((each) => each.step)
}

/* ---------- Detach ---------- */

/** Take a sequence's look apart into plain shapes and text boxes where they are (its invisible frame goes). The sequence is left empty. */
export function detachedSequenceParts(sequence: SequenceBlock): FabricObject[] {
  const look = SEQUENCE_LOOKS.find((each) => each.id === sequenceSettingsOf(sequence).look)?.name ?? 'Sequence'
  const parts = sequence.removeAll().slice(1)
  return parts.map((part) => {
    if (part instanceof FabricText) {
      const text = new IText(part.text, { left: part.left, top: part.top, originX: part.originX, originY: part.originY, angle: part.angle, fontFamily: part.fontFamily, fontSize: part.fontSize, fontWeight: part.fontWeight, fontStyle: part.fontStyle, charSpacing: part.charSpacing, fill: part.fill })
      return Object.assign(text, { name: (part as FabricObject & { name?: string }).name ?? part.text })
    }
    const own = (part as FabricObject & { name?: string }).name
    if (own) return part
    const name = part instanceof Circle ? 'Dot' : part instanceof Rect ? 'Card' : look === 'Ribbon' ? 'Ribbon piece' : 'Arrow'
    return Object.assign(part, { name })
  })
}
