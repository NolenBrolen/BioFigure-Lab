/**
 * Experiment timeline blocks (BIO-96): a real day axis with events placed by
 * their day (dosing, sampling, the endpoint...), as in in-vivo study figures.
 * Unlike the sequence's Timeline look, which spaces its steps evenly whatever
 * their time, day 3 here sits closer to day 0 than day 14 does to day 7.
 *
 * The block draws itself from its settings (kinds of event, events by day,
 * phases, length): nothing else on the page belongs to it, so it moves, copies
 * and deletes as one object. Resizing it sideways lengthens the axis; the
 * markers and text keep their size (`bakeTimelineScale`, every scaling step).
 *
 * Three styles, all picked by the owner (2026-11-26): Lanes (the default),
 * Ruler and Bar with pins.
 */
import { Circle, FabricText, Group, IText, Path, Point, Rect, classRegistry, util, type FabricObject } from 'fabric'

import { DEFAULT_FONT, fontStack } from './fonts'
import { shade, wash, type Box } from './panel-block'

export type TimelineStyle = 'lanes' | 'ruler' | 'pins'
export type MarkerShape = 'triangle' | 'dot' | 'flag' | 'diamond' | 'star' | 'square'
export type EventKind = { name: string; marker: MarkerShape }
export type TimelineEvent = { kind: number; day: number }
export type TimelinePhase = { name: string; end: number }

export type TimelineSettings = {
  style: TimelineStyle
  /** The block's one colour (the axis, bar and lanes, and the first kind's markers). */
  colour: string
  /** How many days the axis runs, from day 0. */
  length: number
  /** The word before each day number: "Day", "Week"... */
  unit: string
  /** The axis's length on the page, in pixels. */
  width: number
  kinds: EventKind[]
  events: TimelineEvent[]
  /** Bar with pins: the bar's phases, each up to its last day. */
  phases: TimelinePhase[]
}

export const TIMELINE_STYLES: readonly { id: TimelineStyle; name: string }[] = [
  { id: 'lanes', name: 'Lanes' },
  { id: 'ruler', name: 'Ruler' },
  { id: 'pins', name: 'Bar with pins' },
]
export const MARKERS: readonly MarkerShape[] = ['triangle', 'dot', 'flag', 'diamond', 'star', 'square']
/** The kinds after the first take these colour-blind-safe colours in turn; the first takes the block's colour. */
const KIND_COLOURS = ['#e69f00', '#d55e00', '#009e73', '#cc79a7', '#56b4e9']
export const kindColour = (settings: Pick<TimelineSettings, 'colour'>, kind: number): string => (kind <= 0 ? settings.colour : (KIND_COLOURS.at((kind - 1) % KIND_COLOURS.length) ?? settings.colour))

export const TIMELINE_LENGTH = { min: 1, max: 365 }
export const TIMELINE_WIDTH = { min: 160, max: 2000 }

/** A study's schedule to start from: dosing on days 0, 3, 7 and 10, blood on 7, 14 and 21, the endpoint on day 28. */
export const DEFAULT_TIMELINE: TimelineSettings = {
  style: 'lanes',
  colour: '#0072b2',
  length: 28,
  unit: 'Day',
  width: 400,
  kinds: [
    { name: 'Dosing', marker: 'triangle' },
    { name: 'Blood sample', marker: 'dot' },
    { name: 'Endpoint', marker: 'flag' },
  ],
  events: [
    { kind: 0, day: 0 },
    { kind: 0, day: 3 },
    { kind: 0, day: 7 },
    { kind: 0, day: 10 },
    { kind: 1, day: 7 },
    { kind: 1, day: 14 },
    { kind: 1, day: 21 },
    { kind: 2, day: 28 },
  ],
  phases: [
    { name: 'Treatment', end: 10 },
    { name: 'Follow-up', end: 28 },
  ],
}

export class TimelineBlock extends Group {
  static type = 'TimelineBlock'
  declare timeline?: TimelineSettings
}
classRegistry.setClass(TimelineBlock)

/** What a timeline saves of its own. */
export const TIMELINE_PROPERTIES = ['timeline'] as const

export const isTimeline = (object: FabricObject | undefined): object is TimelineBlock => object instanceof TimelineBlock

export function timelineSettingsOf(block: TimelineBlock): TimelineSettings {
  const saved = block.timeline
  return {
    ...DEFAULT_TIMELINE,
    ...saved,
    kinds: (saved?.kinds ?? DEFAULT_TIMELINE.kinds).map((kind) => ({ ...kind })),
    events: (saved?.events ?? DEFAULT_TIMELINE.events).map((event) => ({ ...event })),
    phases: (saved?.phases ?? DEFAULT_TIMELINE.phases).map((phase) => ({ ...phase })),
  }
}

/** The events in day order (kinds in their order on the same day), each with its place in `events`. */
export function eventsByDay(settings: TimelineSettings): (TimelineEvent & { index: number })[] {
  return settings.events.map((event, index) => ({ ...event, index })).toSorted((a, b) => a.day - b.day || a.kind - b.kind || a.index - b.index)
}

/** The event the "+" adds: the last event's kind, as far after it as it is after the one before (else a week). */
export function nextEvent(settings: TimelineSettings): TimelineEvent {
  const days = eventsByDay(settings)
  const last = days.at(-1)
  if (!last) return { kind: 0, day: 0 }
  const before = days.filter((event) => event.day < last.day).at(-1)
  const step = before ? last.day - before.day : 7
  return { kind: last.kind, day: last.day + step }
}

/* ---------- Drawing ---------- */

const INK = '#27272a'
const MUTED = '#71717a'

function text(content: string, look: { colour?: string; weight?: number; size?: number } = {}): FabricText {
  // No outline width: text parts keep their place to the half pixel (notes/blocks.md).
  return new FabricText(content, { fontFamily: fontStack(DEFAULT_FONT), fontSize: look.size ?? 10, fontWeight: look.weight ?? 500, fill: look.colour ?? INK, strokeWidth: 0, originX: 'left', originY: 'top' })
}

/** A text placed by its width and height. */
function placed(content: string, look: Parameters<typeof text>[1], place: (width: number, height: number) => { left: number; top: number }): FabricText {
  const part = text(content, look)
  part.set(place(part.width, part.height))
  return part
}

function path(d: string, fill: string, stroke?: { colour: string; width: number; dash?: number[] }): Path {
  return new Path(d, { fill, stroke: stroke?.colour ?? null, strokeWidth: stroke?.width ?? 0, strokeDashArray: stroke?.dash ?? null, strokeLineCap: 'round', objectCaching: false })
}

const hline = (x1: number, x2: number, y: number, colour: string, width: number, dash?: number[]) => path(`M ${x1} ${y} H ${x2}`, '', { colour, width, dash })
const vline = (x: number, y1: number, y2: number, colour: string, width: number, dash?: number[]) => path(`M ${x} ${y1} V ${y2}`, '', { colour, width, dash })

/** A marker centred at (x, y), about `r` across its middle. A flag stands on (x, y + r). */
export function marker(shape: MarkerShape, x: number, y: number, r: number, colour: string): FabricObject[] {
  switch (shape) {
    case 'triangle':
      return [path(`M ${x} ${y + r} L ${x - r * 1.1} ${y - r} L ${x + r * 1.1} ${y - r} Z`, colour)]
    case 'dot':
      return [new Circle({ left: x, top: y, radius: r, fill: colour, strokeWidth: 0, originX: 'center', originY: 'center' })]
    case 'diamond':
      return [path(`M ${x} ${y - r * 1.2} L ${x + r * 1.2} ${y} L ${x} ${y + r * 1.2} L ${x - r * 1.2} ${y} Z`, colour)]
    case 'square':
      return [new Rect({ left: x - r, top: y - r, width: 2 * r, height: 2 * r, fill: colour, strokeWidth: 0, originX: 'left', originY: 'top' })]
    case 'star': {
      const points = Array.from({ length: 10 }, (_, i) => {
        const a = -Math.PI / 2 + (i * Math.PI) / 5
        const radius = i % 2 === 0 ? r * 1.35 : r * 0.6
        return `${x + radius * Math.cos(a)} ${y + radius * Math.sin(a)}`
      })
      return [path(`M ${points.join(' L ')} Z`, colour)]
    }
    case 'flag':
      return flag(x, y + r, 2 * r + 4, colour)
  }
}

/** A flag on a pole standing on (x, base), `height` tall. */
function flag(x: number, base: number, height: number, colour: string): FabricObject[] {
  const top = base - height
  return [vline(x, base, top, colour, 2), path(`M ${x} ${top} L ${x + 12} ${top + 5} L ${x} ${top + 10} Z`, colour)]
}

/** How often the axis has a tick and a numbered day, for this many days. */
function tickEvery(length: number): number {
  return length <= 42 ? 1 : length <= 140 ? 7 : 30
}
function numberEvery(length: number): number {
  return length <= 14 ? 1 : length <= 84 ? 7 : length <= 200 ? 28 : 56
}
const range = (length: number, every: number) => [...Array.from({ length: Math.floor(length / every) + 1 }, (_, i) => i * every), ...(length % every === 0 ? [] : [length])]

/** The day labels that fit side by side: each one only if it clears the last one shown. */
function dayLabels(days: readonly number[], at: (day: number) => number, content: (day: number) => string, y: number, look: Parameters<typeof text>[1]): FabricText[] {
  let clear = -Infinity
  const out: FabricText[] = []
  for (const day of [...new Set(days)].toSorted((a, b) => a - b)) {
    const label = text(content(day), look)
    const left = at(day) - label.width / 2
    if (left < clear + 4) continue
    label.set({ left, top: y })
    clear = left + label.width
    out.push(label)
  }
  return out
}

/** The parts that draw a timeline, with day 0 of the axis at x = 0. */
export function timelineParts(settings: TimelineSettings): FabricObject[] {
  const length = Math.max(TIMELINE_LENGTH.min, settings.length)
  const width = Math.max(TIMELINE_WIDTH.min, settings.width)
  const px = (day: number) => (Math.min(length, Math.max(0, day)) * width) / length
  const unit = settings.unit.trim()
  const dayText = (day: number) => (unit ? `${unit} ${day}` : String(day))
  const events = eventsByDay(settings)
  const colourOf = (kind: number) => kindColour(settings, kind)
  const shapeOf = (kind: number): MarkerShape => settings.kinds.at(kind)?.marker ?? 'dot'
  const parts: FabricObject[] = []
  const ticks = (axis: number, major: readonly number[]) => {
    for (const day of range(length, tickEvery(length))) {
      const big = major.includes(day)
      parts.push(vline(px(day), axis, axis + (big ? 6 : 3), INK, big ? 1.25 : 1))
    }
  }

  if (settings.style === 'ruler') {
    // A thin axis, each kind's markers on its own row above it, a key underneath.
    const rows = Math.max(1, settings.kinds.length)
    const axis = 22 + 18 * rows
    const rowY = (kind: number) => axis - 11 - 18 * kind
    parts.push(hline(-8, width + 8, axis, INK, 1.5))
    const named = [0, length, ...events.map((event) => Math.min(length, Math.max(0, event.day)))]
    ticks(axis, named)
    for (const event of events) {
      const x = px(event.day)
      const colour = colourOf(event.kind)
      const y = rowY(event.kind)
      if (shapeOf(event.kind) === 'flag') {
        parts.push(...flag(x, axis, axis - y + 10, colour))
        continue
      }
      if (event.kind > 0) parts.push(vline(x, y + 6, axis - 4, colour, 1.25, [2, 2]))
      parts.push(...marker(shapeOf(event.kind), x, y, 5, colour))
    }
    parts.push(...dayLabels(named, px, dayText, axis + 10, { size: 10 }))
    // The key: each kind's marker and name, side by side.
    let x = 0
    const keyY = axis + 34
    settings.kinds.forEach((kind, i) => {
      const colour = colourOf(i)
      parts.push(...(kind.marker === 'flag' ? flag(x, keyY + 8, 16, colour) : marker(kind.marker, x + 5, keyY, 5, colour)))
      const name = placed(kind.name || `Kind ${i + 1}`, { size: 10 }, (_, height) => ({ left: x + 16, top: keyY - height / 2 }))
      parts.push(name)
      x += 16 + name.width + 18
    })
    return parts
  }

  if (settings.style === 'lanes') {
    // One pale row per kind, named on the left, over one day axis with a dashed line at each numbered day.
    const names = settings.kinds.map((kind, i) => text(kind.name || `Kind ${i + 1}`, { size: 11 }))
    const column = Math.max(40, ...names.map((name) => name.width)) + 26
    const laneY = (kind: number) => 13 + 36 * kind
    const axis = 36 * Math.max(1, settings.kinds.length) + 6
    const numbered = range(length, numberEvery(length))
    settings.kinds.forEach((_, i) => parts.push(new Rect({ left: -12, top: laneY(i) - 13, width: width + 24, height: 26, rx: 4, ry: 4, fill: wash(settings.colour, 0.07), strokeWidth: 0, originX: 'left', originY: 'top' })))
    names.forEach((name, i) => {
      name.set({ left: -column, top: laneY(i) - name.height / 2 })
      parts.push(name)
    })
    for (const day of numbered) parts.push(vline(px(day), 0, axis, '#a1a1aa', 1, [3, 3]))
    for (const event of events) {
      if (event.kind >= settings.kinds.length) continue
      parts.push(...marker(shapeOf(event.kind), px(event.day), laneY(event.kind), 6, colourOf(event.kind)))
    }
    parts.push(hline(-12, width + 12, axis, INK, 1.25))
    ticks(axis, numbered)
    parts.push(...dayLabels(numbered, px, dayText, axis + 10, { size: 10 }))
    return parts
  }

  // Bar with pins: a thick bar in phases with the days written on it; kinds take turns above and below, each on its own pin height.
  const bar = { top: 0, height: 16, end: 14 }
  const middle = bar.top + bar.height / 2
  const start = -bar.end
  const stop = width + bar.end
  const phases = settings.phases.filter((phase) => phase.end > 0).toSorted((a, b) => a.end - b.end)
  const bands: { from: number; to: number; fill: string; dark: boolean; name: string }[] = []
  let from = start
  phases.forEach((phase, i) => {
    const to = phase.end >= length ? stop : px(phase.end) + 10
    if (to > from) bands.push({ from, to, fill: i % 2 === 0 ? settings.colour : wash(settings.colour, 0.3), dark: i % 2 === 0, name: phase.name })
    from = Math.max(from, to)
  })
  if (from < stop) bands.push({ from, to: stop, fill: wash(settings.colour, 0.15), dark: false, name: '' })
  // The bar's round ends belong to its first and last bands.
  const r = bar.height / 2
  const piece = (left: number, right: number, fill: string, round = false) =>
    new Rect({ left, top: bar.top, width: Math.max(0, right - left), height: bar.height, rx: round ? r : 0, ry: round ? r : 0, fill, strokeWidth: 0, originX: 'left', originY: 'top' })
  const firstBand = bands.at(0)
  const lastBand = bands.at(-1)
  if (firstBand) parts.push(piece(start, start + 2 * r, firstBand.fill, true))
  if (lastBand) parts.push(piece(stop - 2 * r, stop, lastBand.fill, true))
  for (const band of bands) parts.push(piece(Math.max(band.from, start + r), Math.min(band.to, stop - r), band.fill))
  if (unit) parts.push(placed(unit, { size: 10, colour: MUTED }, (w, h) => ({ left: start - 6 - w, top: middle - h / 2 })))
  const onBar = [0, length, ...events.map((event) => Math.min(length, Math.max(0, event.day)))]
  for (const label of dayLabels(onBar, px, String, 0, { size: 9, weight: 700 })) {
    const x = (label.left ?? 0) + label.width / 2
    const dark = bands.find((band) => x >= band.from && x < band.to)?.dark ?? false
    label.set({ top: middle - label.height / 2, fill: dark ? '#ffffff' : shade(settings.colour, 0.45) })
    parts.push(label)
  }
  // The phases' names go in a row of brackets under everything, clear of the pins (they crossed the names under the bar).
  const belowKinds = settings.kinds.map((_, kind) => kind).filter((kind) => kind % 2 === 1)
  const lowest = bar.top + bar.height + (belowKinds.length > 0 ? 30 + Math.floor(Math.max(...belowKinds) / 2) * 34 + 12 + 20 : 0)
  const bracketY = lowest + 10
  bands.forEach((band, i) => {
    if (!band.name) return
    const left = Math.max(band.from, start) + (i === 0 ? 0 : 2)
    const right = Math.min(band.to, stop) - 2
    parts.push(path(`M ${left} ${bracketY - 4} V ${bracketY} H ${right} V ${bracketY - 4}`, '', { colour: band.dark ? settings.colour : wash(settings.colour, 0.55), width: 1.25 }))
    parts.push(placed(band.name, { size: 10, colour: MUTED }, (w) => ({ left: (left + right) / 2 - w / 2, top: bracketY + 4 })))
  })
  const captioned = new Set<number>()
  for (const event of events) {
    const kind = event.kind
    if (kind >= settings.kinds.length) continue
    const above = kind % 2 === 0
    const reach = 30 + Math.floor(kind / 2) * 34
    const x = px(event.day)
    const colour = colourOf(kind)
    const end = above ? bar.top - reach : bar.top + bar.height + reach
    parts.push(vline(x, above ? bar.top : bar.top + bar.height, above ? end + 12 : end - 12, colour, 1.5))
    parts.push(new Circle({ left: x, top: end, radius: 12, fill: '#ffffff', stroke: colour, strokeWidth: 2, originX: 'center', originY: 'center' }))
    parts.push(...(shapeOf(kind) === 'flag' ? flag(x - 3, end + 6, 12, colour) : marker(shapeOf(kind), x, end, 4.5, colour)))
    // The kind's name by its first pin.
    if (captioned.has(kind)) continue
    captioned.add(kind)
    const name = settings.kinds.at(kind)?.name ?? ''
    if (name) parts.push(placed(name, { size: 10, weight: 600 }, (w, h) => ({ left: Math.max(start, x - w / 2), top: above ? end - 16 - h : end + 16 })))
  }
  return parts
}

/* ---------- The block ---------- */

function frameRect(box: Box): Rect {
  return new Rect({ left: box.x, top: box.y, width: box.width, height: box.height, fill: 'rgba(0,0,0,0)', strokeWidth: 0, originX: 'left', originY: 'top' })
}

function areaOf(parts: readonly FabricObject[]): Box {
  const boxes = parts.map((part) => {
    part.setCoords()
    const rect = part.getBoundingRect()
    return rect
  })
  const x = Math.min(...boxes.map((box) => box.left)) - 4
  const y = Math.min(...boxes.map((box) => box.top)) - 4
  return { x, y, width: Math.max(...boxes.map((box) => box.left + box.width)) + 4 - x, height: Math.max(...boxes.map((box) => box.top + box.height)) + 4 - y }
}

/** The timeline's whole area on the page. */
export function timelineBox(block: TimelineBlock): Box {
  const frame = block.getObjects()[0]
  if (!frame) {
    const rect = block.getBoundingRect()
    return { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
  }
  const matrix = util.multiplyTransformMatrices(block.calcTransformMatrix(), frame.calcOwnMatrix())
  const corner = util.transformPoint(new Point(-frame.width / 2, -frame.height / 2), matrix)
  return { x: corner.x, y: corner.y, width: frame.width * block.scaleX, height: frame.height * block.scaleY }
}

/** A new timeline, its area's middle at `centre`. */
export function buildTimeline(settings: TimelineSettings, centre: { x: number; y: number }): TimelineBlock {
  const parts = timelineParts(settings)
  const area = areaOf(parts)
  const block = new TimelineBlock([frameRect(area), ...parts], { lockRotation: true, lockScalingY: true, lockSkewingX: true, lockSkewingY: true })
  block.timeline = { ...settings, kinds: settings.kinds.map((kind) => ({ ...kind })), events: settings.events.map((event) => ({ ...event })), phases: settings.phases.map((phase) => ({ ...phase })) }
  const now = timelineBox(block)
  block.set({ left: block.left + centre.x - (now.x + now.width / 2), top: block.top + centre.y - (now.y + now.height / 2) })
  block.setCoords()
  return block
}

/**
 * The axis length that makes the whole timeline `area` wide in these
 * settings' style: switching style keeps the block's width (owner's
 * feedback, 2026-11-26). Each style takes its own room beside the axis
 * (lane names, the bar's ends, the key), so it is measured, a few times
 * over because the key may set the width when the axis is short.
 */
export function axisWidthFor(settings: TimelineSettings, area: number): number {
  let width = settings.width
  for (let round = 0; round < 4; round++) {
    const total = areaOf(timelineParts({ ...settings, width })).width
    const next = Math.min(TIMELINE_WIDTH.max, Math.max(TIMELINE_WIDTH.min, width + area - total))
    if (Math.abs(next - width) < 0.01) break
    width = next
  }
  return width
}

/**
 * Draw the timeline again from its settings. `keep` says which side stays
 * put: the left edge (settings changes, the right handle), or the right edge
 * (the left handle). The top stays.
 */
export function redrawTimeline(block: TimelineBlock, keep: 'left' | 'right' = 'left'): void {
  const before = timelineBox(block)
  block.set({ scaleX: 1, scaleY: 1, angle: 0 })
  const parts = timelineParts(timelineSettingsOf(block))
  block.removeAll()
  block.add(frameRect(areaOf(parts)), ...parts)
  const now = timelineBox(block)
  const x = keep === 'right' ? before.x + before.width - now.width : before.x
  block.set({ left: block.left + x - now.x, top: block.top + before.y - now.y })
  block.setCoords()
}

/**
 * While its side handle is dragged, the timeline takes the stretch into its
 * axis's length and is drawn again at scale 1: markers, text and gaps keep
 * their size, and the side opposite the handle stays where it was.
 */
export function bakeTimelineScale(block: TimelineBlock, originX: 'left' | 'center' | 'right' = 'left'): void {
  const sx = block.scaleX
  if (sx === 1 && block.scaleY === 1) return
  const settings = timelineSettingsOf(block)
  const area = block.width
  const width = Math.min(TIMELINE_WIDTH.max, Math.max(TIMELINE_WIDTH.min, settings.width + area * (Math.abs(sx) - 1)))
  // The edge Fabric holds still is where the drag started from the other side.
  const pinned = block.getPointByOrigin(originX, 'top')
  block.timeline = { ...settings, width }
  redrawTimeline(block)
  block.setPositionByOrigin(pinned, originX, 'top')
  block.setCoords()
}

/** Take a timeline apart into plain shapes and text boxes where they are (its invisible frame goes). The block is left empty. */
export function detachedTimelineParts(block: TimelineBlock): FabricObject[] {
  const parts = block.removeAll().slice(1)
  return parts.map((part) => {
    if (part instanceof FabricText) {
      const typed = new IText(part.text, { left: part.left, top: part.top, originX: part.originX, originY: part.originY, fontFamily: part.fontFamily, fontSize: part.fontSize, fontWeight: part.fontWeight, fill: part.fill, strokeWidth: 0 })
      return Object.assign(typed, { name: part.text })
    }
    const name = part instanceof Circle ? 'Marker' : part instanceof Rect ? 'Bar' : 'Line'
    return Object.assign(part, { name })
  })
}
