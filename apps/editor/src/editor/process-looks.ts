/**
 * Process blocks (BIO-96) built on the sequence block: a **cycle** (steps
 * evenly round a circle with curved arrows) and **branching** (one step that
 * splits into arms). Each is a `SequenceBlock` with a look of its own, so the
 * steps stay ordinary objects pointing at it with `panelId` and carrying,
 * dropping in, deleting, copying, Add step and Detach all work as they do for
 * a sequence. Only where the steps go, their order and the look differ.
 *
 * Three looks each, all picked by the owner (2026-11-26, from the drafts in
 * packages/ui/src/drafts/process-blocks): cycle Ring (the default), Segments
 * and Loop of cards; branching Tree (the default), Fan and Arm rows.
 */
import { Path, Point, Rect, type FabricObject } from 'fabric'

import { shade, wash, type Box } from './panel-block'
import { boxOfPart, makeLabel, union, type SequenceSettings } from './sequence-block'

export type CycleLook = 'ring' | 'segments' | 'loop'
export type BranchLook = 'tree' | 'fan' | 'rows'
/** Which block a sequence look belongs to: a plain sequence, a cycle or branching. */
export type LookFamily = 'sequence' | 'cycle' | 'branch'

export const CYCLE_LOOKS: readonly { id: CycleLook; name: string }[] = [
  { id: 'ring', name: 'Ring' },
  { id: 'segments', name: 'Segments' },
  { id: 'loop', name: 'Loop of cards' },
]
export const BRANCH_LOOKS: readonly { id: BranchLook; name: string }[] = [
  { id: 'tree', name: 'Tree' },
  { id: 'fan', name: 'Fan' },
  { id: 'rows', name: 'Arm rows' },
]

export const familyOf = (look: string): LookFamily => (CYCLE_LOOKS.some((each) => each.id === look) ? 'cycle' : BRANCH_LOOKS.some((each) => each.id === look) ? 'branch' : 'sequence')

/** Branching keeps its start and at least two arms, and has at most five. */
export const BRANCH_ARMS = { min: 2, max: 5 }
/** The fewest steps each block keeps (the − buttons stop there). */
export const minSteps = (family: LookFamily): number => (family === 'branch' ? 1 + BRANCH_ARMS.min : family === 'cycle' ? 2 : 1)
/** Whether the block can take another step ("+", Add step). */
export const canAddStep = (family: LookFamily, steps: number): boolean => family !== 'branch' || steps < 1 + BRANCH_ARMS.max

const INK = '#27272a'
const RING = { width: 2, head: 9, clear: 8, min: 60 }
const SEGMENT = { thick: 34, gap: 3, point: 10, outside: 14, least: 72 }
const LOOP = { pad: 12, radius: 10, width: 3, head: 12 }
const TREE = { spread: 90, corner: 10, width: 2 }
const FAN = { drop: 70, width: 2 }
const ROWS = { brace: 40, pad: 14, chip: 26, inner: 12, width: 2 }
const LABEL_GAP = 8

type Item = { step: FabricObject; box: Box; x: number; y: number }
type Plan = { moves: { step: FabricObject; dx: number; dy: number }[]; parts: FabricObject[]; frame: Box }

const itemOf = (step: FabricObject, box: Box): Item => ({ step, box, x: box.x + box.width / 2, y: box.y + box.height / 2 })
const TAU = Math.PI * 2
const mod = (value: number, by: number) => ((value % by) + by) % by

/* ---------- Order ---------- */

/**
 * The steps' order. Round a cycle: clockwise from the top, starting half a
 * slot before it, so the first step (at the top) is first and a new step put
 * in the gap before the top is last. Branching: the start is the step furthest
 * left (furthest up for a fan), then the arms top to bottom (left to right).
 */
export function processOrder<T extends { step: FabricObject; box: Box }>(look: string, items: readonly T[]): T[] {
  const placed = items.map((item) => ({ item, ...itemOf(item.step, item.box) }))
  if (familyOf(look) === 'cycle') {
    const n = placed.length
    const cx = placed.reduce((sum, each) => sum + each.x, 0) / Math.max(1, n)
    const cy = placed.reduce((sum, each) => sum + each.y, 0) / Math.max(1, n)
    const start = -Math.PI / 2 - Math.PI / Math.max(1, n)
    const turn = (each: { x: number; y: number }) => (Math.hypot(each.x - cx, each.y - cy) < 0.5 ? 0 : mod(Math.atan2(each.y - cy, each.x - cx) - start, TAU))
    return placed.toSorted((a, b) => turn(a) - turn(b)).map((each) => each.item)
  }
  const fan = look === 'fan'
  const main = (each: { x: number; y: number }) => (fan ? each.y : each.x)
  const cross = (each: { x: number; y: number }) => (fan ? each.x : each.y)
  const first = placed.toSorted((a, b) => main(a) - main(b) || cross(a) - cross(b)).at(0)
  if (!first) return []
  const arms = placed.filter((each) => each !== first).toSorted((a, b) => cross(a) - cross(b) || main(a) - main(b))
  return [first, ...arms].map((each) => each.item)
}

/**
 * Where a new last step goes (its top-left corner), so it is put last:
 * round a cycle in the gap before the top, when branching after the last arm.
 */
export function newStepCorner(look: string, ordered: readonly Box[], size: { width: number; height: number }, gap: number): { x: number; y: number } {
  const middles = ordered.map((box) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 }))
  const last = ordered.at(-1) ?? { x: 0, y: 0, width: size.width, height: size.height }
  if (familyOf(look) === 'cycle') {
    const first = middles.at(0)
    const end = middles.at(-1)
    if (!first || !end || middles.length < 2) return { x: last.x + last.width + gap, y: last.y }
    const cx = middles.reduce((sum, each) => sum + each.x, 0) / middles.length
    const cy = middles.reduce((sum, each) => sum + each.y, 0) / middles.length
    const r = Math.hypot(first.x - cx, first.y - cy)
    const a1 = Math.atan2(end.y - cy, end.x - cx)
    const a2 = a1 + mod(Math.atan2(first.y - cy, first.x - cx) - a1, TAU)
    const a = (a1 + a2) / 2
    return { x: cx + r * Math.cos(a) - size.width / 2, y: cy + r * Math.sin(a) - size.height / 2 }
  }
  if (look === 'fan') return { x: last.x + last.width + gap, y: last.y + (last.height - size.height) / 2 }
  if (ordered.length < 2) return { x: last.x + last.width + TREE.spread, y: last.y }
  return { x: last.x + (last.width - size.width) / 2, y: last.y + last.height + gap }
}

/* ---------- Drawing helpers ---------- */

/** A filled arrowhead with its tip at `tip`, pointing along `angle`. */
function head(tip: Point, angle: number, colour: string, size: number): Path {
  const side = (turn: number) => `${tip.x - size * Math.cos(angle + turn)} ${tip.y - size * Math.sin(angle + turn)}`
  return new Path(`M ${tip.x} ${tip.y} L ${side(0.45)} L ${side(-0.45)} Z`, { fill: colour, strokeWidth: 0, objectCaching: false })
}

function line(d: string, colour: string, width: number): Path {
  return new Path(d, { fill: '', stroke: colour, strokeWidth: width, strokeLineCap: 'round', strokeLineJoin: 'round', objectCaching: false })
}

const polar = (c: Point, r: number, a: number) => new Point(c.x + r * Math.cos(a), c.y + r * Math.sin(a))

/** A clockwise arc round `c` from angle a1 to a2 (a2 > a1). */
function arc(c: Point, r: number, a1: number, a2: number): string {
  const p1 = polar(c, r, a1)
  const p2 = polar(c, r, a2)
  return `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${a2 - a1 > Math.PI ? 1 : 0} 1 ${p2.x} ${p2.y}`
}

/** A label with its box placed by `place` (given its width and height). */
function label(text: string, look: { colour: string; weight: number; size?: number }, place: (width: number, height: number) => { left: number; top: number }): FabricObject {
  const part = makeLabel(text, look)
  part.set(place(part.width, part.height))
  return part
}

/* ---------- Layout ---------- */

/**
 * Where the steps go and the parts that draw the look, in page coordinates.
 * Everything is worked out round the first step at (0, 0), then shifted so
 * the `pinned` step (else the first) stays where it is.
 */
export function processPlan(settings: SequenceSettings, steps: readonly FabricObject[], boxOf: (step: FabricObject) => Box, pinned?: FabricObject): Plan {
  const items = processOrder(
    settings.look,
    steps.map((step) => ({ step, box: boxOf(step) })),
  ).map((each) => itemOf(each.step, each.box))
  if (items.length === 0) return { moves: [], parts: [], frame: { x: 0, y: 0, width: 0, height: 0 } }
  const targets = familyOf(settings.look) === 'cycle' ? cycleTargets(settings, items) : branchTargets(settings, items)
  const anchor = items.findIndex((item) => item.step === pinned)
  const at = Math.max(0, anchor)
  const pin = items.at(at)
  const goal = targets.middles.at(at)
  const shift = pin && goal ? new Point(pin.x - goal.x, pin.y - goal.y) : new Point(0, 0)
  const middles = targets.middles.map((point) => point.add(shift))
  const moves = items.map((item, i) => {
    const to = middles.at(i) ?? new Point(item.x, item.y)
    return { step: item.step, dx: to.x - item.x, dy: to.y - item.y }
  })
  const boxes = items.map((item, i) => {
    const move = moves.at(i) ?? { dx: 0, dy: 0 }
    return { ...item.box, x: item.box.x + move.dx, y: item.box.y + move.dy }
  })
  const labels = items.map((_, i) => (settings.labelsShown ? (settings.labels.at(i)?.trim() ?? '') : ''))
  const parts = familyOf(settings.look) === 'cycle' ? cycleParts(settings, boxes, labels, targets.centre.add(shift), targets.radius) : branchParts(settings, boxes, labels)
  return { moves, parts, frame: union([...boxes, ...parts.map(boxOfPart)]) }
}

type Targets = { middles: Point[]; centre: Point; radius: number }

const sideOf = (box: Box) => Math.max(box.width, box.height)

/** Round a circle, the first at the top, clockwise; the radius leaves `gap` between the biggest neighbours. */
function cycleTargets(settings: SequenceSettings, items: readonly Item[]): Targets {
  const n = items.length
  const biggest = Math.max(...items.map((item) => sideOf(item.box)))
  const labelRoom = settings.look === 'loop' ? loopLabelRoom(settings, n) : 0
  // A loop of cards spaces the cards, the segments their steps outside the ring.
  const slot = settings.look === 'loop' ? biggest + 2 * LOOP.pad + labelRoom / 2 : biggest
  const fit = n < 2 ? 0 : (slot + Math.max(0, settings.gap)) / (2 * Math.sin(Math.PI / n))
  const least = settings.look === 'segments' ? SEGMENT.least + SEGMENT.thick / 2 + SEGMENT.outside + biggest / 2 : RING.min
  const radius = n < 2 ? 0 : Math.max(least, fit)
  const centre = new Point(0, radius)
  const middles = items.map((_, i) => {
    const point = polar(centre, radius, angleOf(i, n))
    // In a card, the step sits above its label.
    return settings.look === 'loop' ? point.add(new Point(0, -labelRoom / 2)) : point
  })
  return { middles, centre, radius }
}

const angleOf = (i: number, n: number) => -Math.PI / 2 + (i * TAU) / n

/** The height a loop card's label takes. */
function loopLabelRoom(settings: SequenceSettings, n: number): number {
  if (!settings.labelsShown) return 0
  const tallest = Math.max(0, ...Array.from({ length: n }, (_, i) => settings.labels.at(i)?.trim() ?? '').map((text) => (text ? makeLabel(text, { colour: INK, weight: 600 }).height : 0)))
  return tallest ? tallest + 6 : 0
}

function cycleParts(settings: SequenceSettings, boxes: readonly Box[], labels: readonly string[], centre: Point, radius: number): FabricObject[] {
  const { colour, look } = settings
  const n = boxes.length
  const parts: FabricObject[] = []
  const middleOf = (box: Box) => new Point(box.x + box.width / 2, box.y + box.height / 2)
  if (look === 'ring') {
    // Each arrow follows the circle from just past one step to just before the next.
    const clear = (box: Box) => (sideOf(box) / 2 + RING.clear) / Math.max(1, radius)
    for (let i = 0; n > 1 && i < n; i++) {
      const here = boxes.at(i)
      const next = boxes.at((i + 1) % n)
      if (!here || !next) continue
      const from = angleOf(i, n) + clear(here)
      const to = angleOf(i, n) + TAU / n - clear(next)
      if (to - from < 0.08) continue
      parts.push(line(arc(centre, radius, from, to - RING.head / 2 / radius), colour, RING.width))
      parts.push(head(polar(centre, radius, to), to + Math.PI / 2, colour, RING.head))
    }
    labels.forEach((text, i) => {
      const box = boxes.at(i)
      if (!text || !box) return
      const a = angleOf(i, n)
      const point = n < 2 ? new Point(box.x + box.width / 2, box.y + box.height + LABEL_GAP) : polar(centre, radius + sideOf(box) / 2 + LABEL_GAP, a)
      const cos = n < 2 ? 0 : Math.cos(a)
      const below = n < 2 || Math.sin(a) > 0
      parts.push(
        label(text, { colour: INK, weight: 600, size: 12 }, (width, height) =>
          cos > 0.35 ? { left: point.x, top: point.y - height / 2 } : cos < -0.35 ? { left: point.x - width, top: point.y - height / 2 } : { left: point.x - width / 2, top: below ? point.y : point.y - height },
        ),
      )
    })
  }
  if (look === 'segments' && n > 0) {
    // A ring of arrow-shaped pieces inside the steps, darker round the circle; each name inside its piece.
    const biggest = Math.max(...boxes.map(sideOf))
    const mid = Math.max(SEGMENT.least, radius - biggest / 2 - SEGMENT.outside - SEGMENT.thick / 2)
    const outer = mid + SEGMENT.thick / 2
    const inner = mid - SEGMENT.thick / 2
    const span = TAU / n
    const gap = SEGMENT.gap / mid
    const point = SEGMENT.point / mid
    for (let i = 0; i < n; i++) {
      const a = angleOf(i, n)
      const s = a - span / 2 + gap
      const e = a + span / 2 - gap
      const big = e - s > Math.PI ? 1 : 0
      const o1 = polar(centre, outer, s)
      const o2 = polar(centre, outer, e)
      const tip = polar(centre, mid, e + point)
      const i2 = polar(centre, inner, e)
      const i1 = polar(centre, inner, s)
      const notch = polar(centre, mid, s + point)
      const share = n < 2 ? 0.6 : 0.3 + (0.7 * i) / (n - 1)
      parts.push(
        new Path(`M ${o1.x} ${o1.y} A ${outer} ${outer} 0 ${big} 1 ${o2.x} ${o2.y} L ${tip.x} ${tip.y} L ${i2.x} ${i2.y} A ${inner} ${inner} 0 ${big} 0 ${i1.x} ${i1.y} L ${notch.x} ${notch.y} Z`, {
          fill: wash(colour, share),
          strokeWidth: 0,
          objectCaching: false,
        }),
      )
      const text = labels.at(i)
      if (text) {
        const where = polar(centre, mid, a + point / 2)
        parts.push(label(text, { colour: share > 0.55 ? '#ffffff' : shade(colour, 0.45), weight: 700, size: 11 }, (width, height) => ({ left: where.x - width / 2, top: where.y - height / 2 })))
      }
    }
  }
  if (look === 'loop' && n > 0) {
    const biggest = Math.max(...boxes.map(sideOf))
    const labelRoom = loopLabelRoom(settings, n)
    const card = biggest + 2 * LOOP.pad
    const height = card + labelRoom
    const cards = boxes.map((box) => {
      const middle = middleOf(box)
      return { x: middle.x - card / 2, y: middle.y - biggest / 2 - LOOP.pad, middle }
    })
    // Thick arrows bow outward from one card to the next.
    const reach = radius + 16
    const clear = (card / 2 + 12) / Math.max(1, reach)
    const bow = 1 + 1.6 / Math.max(1, n)
    for (let i = 0; n > 1 && i < n; i++) {
      const a = angleOf(i, n)
      const next = a + TAU / n
      if (next - clear - (a + clear) < 0.05) continue
      const start = polar(centre, reach, a + clear)
      const end = polar(centre, reach, next - clear)
      const bend = polar(centre, reach * bow, (a + next) / 2)
      const angle = Math.atan2(end.y - bend.y, end.x - bend.x)
      const neck = new Point(end.x - (LOOP.head / 2) * Math.cos(angle), end.y - (LOOP.head / 2) * Math.sin(angle))
      parts.push(line(`M ${start.x} ${start.y} Q ${bend.x} ${bend.y} ${neck.x} ${neck.y}`, colour, LOOP.width))
      parts.push(head(end, angle, colour, LOOP.head))
    }
    cards.forEach(({ x, y }) => parts.push(new Rect({ left: x, top: y, width: card, height, rx: LOOP.radius, ry: LOOP.radius, fill: wash(colour, 0.08), stroke: wash(colour, 0.45), strokeWidth: 1, originX: 'left', originY: 'top' })))
    labels.forEach((text, i) => {
      const at = cards.at(i)
      if (!text || !at) return
      parts.push(label(text, { colour: shade(colour, 0.45), weight: 600 }, (width) => ({ left: at.middle.x - width / 2, top: at.middle.y + biggest / 2 + 6 })))
    })
  }
  // The middle text, e.g. "Cell cycle".
  const title = settings.title?.trim()
  if (title && n > 1) parts.push(label(title, { colour: INK, weight: 600, size: 13 }, (width, height) => ({ left: centre.x - width / 2, top: centre.y - height / 2 })))
  return parts
}

/** The start at (0, 0); the arms stacked down its right (tree, rows) or side by side under it (fan). */
function branchTargets(settings: SequenceSettings, items: readonly Item[]): Targets {
  const [source, ...arms] = items
  const gap = Math.max(0, settings.gap)
  const start = new Point(0, 0)
  if (!source) return { middles: [], centre: start, radius: 0 }
  const half = { x: source.box.width / 2, y: source.box.height / 2 }
  if (settings.look === 'fan') {
    const total = arms.reduce((sum, arm) => sum + arm.box.width, 0) + gap * Math.max(0, arms.length - 1)
    const tallest = Math.max(0, ...arms.map((arm) => arm.box.height))
    const lineY = half.y + FAN.drop + tallest / 2
    let x = -total / 2
    const middles = arms.map((arm) => {
      const point = new Point(x + arm.box.width / 2, lineY)
      x += arm.box.width + gap
      return point
    })
    return { middles: [start, ...middles], centre: start, radius: 0 }
  }
  const rows = settings.look === 'rows'
  const heights = arms.map((arm) => (rows ? Math.max(arm.box.height, ROWS.chip) + 2 * ROWS.pad : arm.box.height))
  const total = heights.reduce((sum, h) => sum + h, 0) + gap * Math.max(0, arms.length - 1)
  const widest = Math.max(0, ...arms.map((arm) => arm.box.width))
  // Arm rows: the brace, the band's edge, the chip, room for a short arrow, then the arms' column (as drawn in branchParts).
  const column = rows ? half.x + ROWS.brace + 2 * ROWS.inner + rowChipWidth(settings, arms.length) + 2 * ROWS.inner + 14 + widest / 2 : half.x + TREE.spread + widest / 2
  let y = -total / 2
  const middles = heights.map((h) => {
    const point = new Point(column, y + h / 2)
    y += h + gap
    return point
  })
  return { middles: [start, ...middles], centre: start, radius: 0 }
}

/** How wide every arm's name chip is in the Arm rows look: as wide as the longest name. */
function rowChipWidth(settings: SequenceSettings, arms: number): number {
  if (!settings.labelsShown) return 0
  const names = Array.from({ length: arms }, (_, i) => settings.labels.at(i + 1)?.trim() ?? '')
  const widest = Math.max(0, ...names.map((text) => (text ? makeLabel(text, { colour: INK, weight: 600 }).width : 0)))
  return widest ? Math.max(60, widest + 24) : 0
}

function branchParts(settings: SequenceSettings, boxes: readonly Box[], labels: readonly string[]): FabricObject[] {
  const { colour, look } = settings
  const [source, ...arms] = boxes
  if (!source) return []
  const parts: FabricObject[] = []
  const sx = source.x + source.width / 2
  const sy = source.y + source.height / 2
  const right = source.x + source.width
  const sourceLabel = labels.at(0)
  if (look === 'tree') {
    const trunk = right + TREE.spread * 0.45
    if (arms.length > 0) parts.push(line(`M ${right + 8} ${sy} H ${trunk}`, colour, TREE.width))
    for (const arm of arms) {
      const y = arm.y + arm.height / 2
      const end = arm.x - 6
      const dy = y - sy
      const r = Math.min(TREE.corner, Math.abs(dy))
      const d = Math.abs(dy) < 0.5 ? `M ${trunk} ${sy} H ${end - TREE.width * 3}` : `M ${trunk} ${sy} V ${y - Math.sign(dy) * r} Q ${trunk} ${y} ${trunk + r} ${y} H ${end - TREE.width * 3}`
      parts.push(line(d, colour, TREE.width), head(new Point(end, y), 0, colour, 9))
    }
    if (sourceLabel) parts.push(label(sourceLabel, { colour: INK, weight: 500 }, (width) => ({ left: sx - width / 2, top: source.y + source.height + LABEL_GAP })))
    arms.forEach((arm, i) => {
      const text = labels.at(i + 1)
      if (text) parts.push(label(text, { colour: INK, weight: 600, size: 12 }, (_, height) => ({ left: arm.x + arm.width + 10, top: arm.y + arm.height / 2 - height / 2 })))
    })
  }
  if (look === 'fan') {
    const from = new Point(sx, source.y + source.height + 6)
    for (const arm of arms) {
      const x = arm.x + arm.width / 2
      const tip = new Point(x, arm.y - 4)
      parts.push(line(`M ${from.x} ${from.y} C ${from.x} ${from.y + 34} ${x} ${tip.y - 40} ${x} ${tip.y - 8}`, colour, FAN.width), head(tip, Math.PI / 2, colour, 9))
    }
    if (sourceLabel) parts.push(label(sourceLabel, { colour: INK, weight: 500 }, (_, height) => ({ left: right + 10, top: sy - height / 2 })))
    const bottom = Math.max(...arms.map((arm) => arm.y + arm.height))
    arms.forEach((arm, i) => {
      const text = labels.at(i + 1)
      if (text) parts.push(label(text, { colour: INK, weight: 600, size: 12 }, (width) => ({ left: arm.x + arm.width / 2 - width / 2, top: bottom + LABEL_GAP })))
    })
  }
  if (look === 'rows' && arms.length > 0) {
    const brace = right + ROWS.brace
    const chip = rowChipWidth(settings, arms.length)
    const widest = Math.max(...arms.map((arm) => arm.width))
    const bandLeft = brace + ROWS.inner
    const armLeft = bandLeft + ROWS.inner + chip + 2 * ROWS.inner + 14
    const bandRight = armLeft + widest + ROWS.inner + 4
    const rows = arms.map((arm) => {
      const h = Math.max(arm.height, ROWS.chip) + 2 * ROWS.pad
      return { arm, top: arm.y + arm.height / 2 - h / 2, h, y: arm.y + arm.height / 2 }
    })
    const top = (rows.at(0)?.top ?? sy) + 4
    const bottom = Math.max(...rows.map((row) => row.top + row.h)) - 4
    const tipY = Math.min(bottom - 10, Math.max(top + 10, sy))
    parts.push(
      head(new Point(brace - 9, sy), 0, colour, 9),
      line(`M ${right + 6} ${sy} H ${brace - 14}`, colour, ROWS.width),
      line(`M ${brace + 8} ${top} Q ${brace} ${top} ${brace} ${top + 8} V ${tipY - 8} Q ${brace} ${tipY} ${brace - 8} ${tipY} Q ${brace} ${tipY} ${brace} ${tipY + 8} V ${bottom - 8} Q ${brace} ${bottom} ${brace + 8} ${bottom}`, colour, ROWS.width),
    )
    rows.forEach(({ top: rowTop, h, y }, i) => {
      parts.push(new Rect({ left: bandLeft, top: rowTop, width: bandRight - bandLeft, height: h, rx: 10, ry: 10, fill: wash(colour, 0.08), strokeWidth: 0, originX: 'left', originY: 'top' }))
      const text = labels.at(i + 1)
      if (text && chip) {
        const share = arms.length < 2 ? 0.6 : 0.35 + (0.65 * i) / (arms.length - 1)
        parts.push(new Rect({ left: bandLeft + ROWS.inner, top: y - ROWS.chip / 2, width: chip, height: ROWS.chip, rx: ROWS.chip / 2, ry: ROWS.chip / 2, fill: wash(colour, share), strokeWidth: 0, originX: 'left', originY: 'top' }))
        parts.push(label(text, { colour: share > 0.55 ? '#ffffff' : shade(colour, 0.45), weight: 600 }, (width, height) => ({ left: bandLeft + ROWS.inner + chip / 2 - width / 2, top: y - height / 2 })))
      }
      const from = bandLeft + ROWS.inner + chip + 6
      const arm = rows.at(i)?.arm
      if (arm && chip) parts.push(line(`M ${from} ${y} H ${arm.x - 11}`, INK, 1.5), head(new Point(arm.x - 5, y), 0, INK, 7))
    })
    if (sourceLabel) parts.push(label(sourceLabel, { colour: INK, weight: 500 }, (width) => ({ left: sx - width / 2, top: source.y + source.height + LABEL_GAP })))
  }
  return parts
}
