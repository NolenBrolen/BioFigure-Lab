/**
 * Graphical abstracts (BIO-107): a title across the top and three parts
 * underneath, read left to right (problem → method → finding). Each part has
 * a short heading, a space for an icon or a graph, and an optional caption.
 *
 * Like a comparison (BIO-95), an abstract is a sequence (BIO-75) whose steps
 * are what sits in its parts: an icon space, an icon, a chart space or a
 * chart, ordinary objects pointing at it with `panelId`. So moving, copying,
 * deleting, Detach and trading places by dragging all work as for sequences.
 * The block draws everything else itself from its settings (title, headings,
 * captions, the look) through `planLayout`.
 *
 * Its width is a setting: the side handles make it wider or narrower, and
 * the parts spread out or close up while the text, icons and graphs keep
 * their size (`resizeAbstract`, on every scaling step). Its height follows
 * from the text and the tallest thing in a part.
 *
 * Three looks, all kept by the owner (2026-11-26, from the drafts in
 * `packages/ui/src/drafts/graphical-abstract/`): Banner and cards, Chevron
 * flow and Spotlight.
 */
import { FabricText, Path, Point, Rect, classRegistry, type FabricObject } from 'fabric'

import { ContentSpace, buildContentSpace, contentBox } from './content-space'
import { DEFAULT_FONT, fontStack } from './fonts'
import { IconSpace, NEW_SPACE_SIZE, buildIconSpace, spaceBox, tintIconSpace } from './icon-space'
import { shade, wash, type Box } from './panel-block'
import { SequenceBlock, arrowPath, layOutSequence, sequenceBox, type Mover, type SequencePlan } from './sequence-block'

export type AbstractLook = 'cards' | 'chevrons' | 'spotlight'

export type AbstractSettings = {
  look: AbstractLook
  /** The block's one colour, a hex like "#0072b2". */
  colour: string
  title: string
  /** One per part, left to right. */
  headings: string[]
  /** One per part, left to right; shown while `captionsShown`. */
  captions: string[]
  captionsShown: boolean
  /** The block's width on the page, in pixels (it never gets narrower than its contents need). */
  width: number
}

export const ABSTRACT_LOOKS: readonly { id: AbstractLook; name: string }[] = [
  { id: 'cards', name: 'Banner and cards' },
  { id: 'chevrons', name: 'Chevron flow' },
  { id: 'spotlight', name: 'Spotlight' },
]

/** An abstract always has three parts. */
export const PARTS = 3
export const ABSTRACT_WIDTH = { min: 360, max: 2000 }

export const DEFAULT_ABSTRACT: AbstractSettings = {
  look: 'cards',
  colour: '#0072b2',
  title: 'Title of your study',
  headings: ['Problem', 'Method', 'Finding'],
  captions: ['What was wrong', 'What we did', 'What we found'],
  captionsShown: true,
  width: 600,
}

/** A new abstract's chart space (the finding). */
export const NEW_CHART_SPACE = { width: 120, height: 90 }

export class AbstractBlock extends SequenceBlock {
  static type = 'AbstractBlock'
  declare abstract?: AbstractSettings

  /** The narrowest its contents let it be, from its last layout (not saved): a side handle stops there. */
  narrowest?: number

  planLayout(steps: readonly FabricObject[], boxOf: (step: FabricObject) => Box): SequencePlan {
    const frame = sequenceBox(this)
    const settings = abstractSettingsOf(this)
    const contents = steps.map((step) => ({ step, box: boxOf(step) }))
    this.narrowest = narrowestWidth(settings.look, partWidths(settings.look, settings.width, frame.x, contents))
    return abstractPlan(settings, steps, boxOf, { x: frame.x, y: frame.y })
  }
}
classRegistry.setClass(AbstractBlock)

/** What an abstract saves of its own. */
export const ABSTRACT_PROPERTIES = ['abstract'] as const

export const isAbstract = (object: FabricObject | undefined): object is AbstractBlock => object instanceof AbstractBlock

export function abstractSettingsOf(block: AbstractBlock): AbstractSettings {
  const saved = block.abstract
  const list = (values: readonly string[] | undefined, fallback: readonly string[]) => Array.from({ length: PARTS }, (_, i) => values?.at(i) ?? fallback.at(i) ?? '')
  return { ...DEFAULT_ABSTRACT, ...saved, headings: list(saved?.headings, DEFAULT_ABSTRACT.headings), captions: list(saved?.captions, DEFAULT_ABSTRACT.captions) }
}

/* ---------- Text ---------- */

const INK = '#27272a'
const GREY = '#71717a'

type TextLook = { size: number; weight: number; colour: string; upper?: boolean; align?: 'left' | 'center' }

const named = <T extends FabricObject>(part: T, name: string): T => Object.assign(part, { name })

function textOptions(look: TextLook) {
  return { fontFamily: fontStack(DEFAULT_FONT), fontSize: look.size, fontWeight: look.weight, fill: look.colour, charSpacing: look.upper ? 60 : 0, textAlign: look.align ?? 'center', strokeWidth: 0, originX: 'left' as const, originY: 'top' as const }
}

/**
 * Text that wraps onto as many lines as it needs to fit `maxWidth` (a word
 * longer than that gets a line of its own), as one text object; none for
 * empty text.
 */
export function wrappedText(text: string, look: TextLook, maxWidth: number): FabricText | undefined {
  const words = (look.upper ? text.toUpperCase() : text).trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return undefined
  const options = textOptions(look)
  const widthOf = (line: string) => new FabricText(line, options).width
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const longer = line ? `${line} ${word}` : word
    if (line && widthOf(longer) > maxWidth) {
      lines.push(line)
      line = word
    } else line = longer
  }
  lines.push(line)
  return new FabricText(lines.join('\n'), options)
}

/** Put a text with its top-left at (x, y), or centred on x. */
function place(text: FabricText | undefined, x: number, y: number, centred = true): void {
  text?.set({ left: centred ? x - text.width / 2 : x, top: y })
}

/** White or a dark shade of the colour, whichever reads on `fill`. */
function inkOn(fill: string, colour: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(fill.slice(i, i + 2), 16) / 255)
  const light = 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0)
  return light < 0.55 ? '#ffffff' : shade(colour, 0.45)
}

const heightOf = (text: FabricText | undefined): number => text?.height ?? 0

/* ---------- Layout ---------- */

/** A part's room across the block: its left edge and width. */
type Slot = { x: number; width: number }

/** Each part's room across the block, for this look and width (from x = 0). */
function slotsFor(look: AbstractLook, width: number): Slot[] {
  switch (look) {
    case 'cards': {
      const card = (width - 2 * CARDS.gap) / 3
      return [0, 1, 2].map((i) => ({ x: i * (card + CARDS.gap), width: card }))
    }
    case 'chevrons': {
      const segment = (width - 2 * CHEVRONS.gap) / 3
      return [0, 1, 2].map((i) => ({ x: i * (segment + CHEVRONS.gap), width: segment }))
    }
    case 'spotlight': {
      const finding = width * SPOTLIGHT.findingShare
      const side = (width - finding - 2 * SPOTLIGHT.gap) / 2
      return [
        { x: 0, width: side },
        { x: side + SPOTLIGHT.gap, width: side },
        { x: width - finding, width: finding },
      ]
    }
  }
}

const CARDS = { bar: 40, barPad: 10, below: 14, gap: 40, pad: 14, space: 12, side: 14 }
const CHEVRONS = { gap: 4, point: 14, chevron: 30, rule: 2, below: 14, side: 8 }
const SPOTLIGHT = { strip: 36, below: 18, findingShare: 0.42, gap: 12, badge: 11, pad: 16 }

/**
 * The narrowest the block can be with these contents, `widths` being how
 * wide each part's content is (left to right). Cards and chevrons are all
 * the same width, so the widest sets them; in Spotlight the two side parts
 * and the wider finding each need room for their own.
 */
export function narrowestWidth(look: AbstractLook, widths: readonly number[]): number {
  const widest = (from: number, to: number) => Math.max(NEW_SPACE_SIZE, ...widths.slice(from, to))
  switch (look) {
    case 'cards':
      return Math.max(ABSTRACT_WIDTH.min, 3 * (widest(0, PARTS) + 2 * CARDS.side) + 2 * CARDS.gap)
    case 'chevrons':
      return Math.max(ABSTRACT_WIDTH.min, 3 * (widest(0, PARTS) + 2 * CHEVRONS.side) + 2 * CHEVRONS.gap)
    case 'spotlight':
      return Math.max(ABSTRACT_WIDTH.min, (widest(PARTS - 1, PARTS) + 2 * SPOTLIGHT.pad) / SPOTLIGHT.findingShare, (2 * (widest(0, PARTS - 1) + SPOTLIGHT.pad) + 2 * SPOTLIGHT.gap) / (1 - SPOTLIGHT.findingShare))
  }
}

/** How wide what sits in each part is, by the parts the contents fall in at `width`. */
function partWidths(look: AbstractLook, width: number, originX: number, contents: readonly { step: FabricObject; box: Box }[]): number[] {
  return assignParts(look, width, originX, contents).map((step) => contents.find((content) => content.step === step)?.box.width ?? 0)
}

/** The width the block is drawn at: its own, but never narrower than its contents need. */
function drawnWidth(settings: AbstractSettings, originX: number, contents: readonly { step: FabricObject; box: Box }[]): number {
  return Math.min(ABSTRACT_WIDTH.max, Math.max(settings.width, narrowestWidth(settings.look, partWidths(settings.look, settings.width, originX, contents))))
}

/**
 * Which part each content sits in: the one whose middle is nearest its own
 * middle, one content per part (nearest pairs first). A part may be empty;
 * a fourth content gets no part.
 */
export function assignParts(look: AbstractLook, width: number, originX: number, contents: readonly { step: FabricObject; box: Box }[]): (FabricObject | undefined)[] {
  const middles = slotsFor(look, width).map((slot) => originX + slot.x + slot.width / 2)
  const pairs = contents.flatMap((content) => middles.map((middle, part) => ({ content, part, distance: Math.abs(content.box.x + content.box.width / 2 - middle) }))).sort((a, b) => a.distance - b.distance)
  const parts: (FabricObject | undefined)[] = middles.map(() => undefined)
  const used = new Set<FabricObject>()
  for (const { content, part } of pairs) {
    if (used.has(content.step) || parts[part] !== undefined) continue
    parts[part] = content.step
    used.add(content.step)
  }
  return parts
}

/**
 * Where an abstract's contents go and the parts that draw it, in page
 * coordinates, its top-left corner at `origin`. Each content is centred in
 * its part's space; the row of spaces is as tall as the tallest content.
 */
export function abstractPlan(settings: AbstractSettings, steps: readonly FabricObject[], boxOf: (step: FabricObject) => Box, origin: { x: number; y: number }): SequencePlan {
  const contents = steps.map((step) => ({ step, box: boxOf(step) }))
  const width = drawnWidth(settings, origin.x, contents)
  const assigned = assignParts(settings.look, width, origin.x, contents)
  const row = Math.max(NEW_SPACE_SIZE, ...contents.map((content) => content.box.height))
  const slots = slotsFor(settings.look, width).map((slot) => ({ ...slot, x: slot.x + origin.x }))
  const drawn = LOOKS[settings.look](settings, slots, row, origin, width)

  const moves = assigned.flatMap((step, i) => {
    const content = contents.find((each) => each.step === step)
    const slot = slots.at(i)
    if (!content || !slot) return []
    const middle = { x: slot.x + slot.width / 2, y: drawn.rowTop + row / 2 }
    return [{ step: content.step, dx: middle.x - (content.box.x + content.box.width / 2), dy: middle.y - (content.box.y + content.box.height / 2) }]
  })
  // Empty icon spaces take the block's colour, as in a panel.
  for (const step of steps) if (step instanceof IconSpace) tintIconSpace(step, settings.colour)
  const frame = { x: origin.x, y: origin.y, width, height: drawn.height }
  return { moves, parts: drawn.parts, frame }
}

type Drawn = { parts: FabricObject[]; rowTop: number; height: number }
type DrawLook = (settings: AbstractSettings, slots: readonly Slot[], row: number, origin: { x: number; y: number }, width: number) => Drawn

/** The tallest of these texts, at least `least`. */
const tallest = (texts: readonly (FabricText | undefined)[], least = 0) => Math.max(least, ...texts.map(heightOf))

/** Captions under each part, as wide as its slot less `inset` on each side; none when switched off. */
function captionsFor(settings: AbstractSettings, slots: readonly Slot[], look: (i: number) => TextLook, inset: number): (FabricText | undefined)[] {
  return slots.map((slot, i) => (settings.captionsShown ? wrappedText(settings.captions.at(i) ?? '', look(i), slot.width - 2 * inset) : undefined))
}

/** A · Banner and cards: a filled title bar, three outlined cards of the same width, a fat arrow in each gap. */
const drawCards: DrawLook = (settings, slots, row, origin, width) => {
  const { colour } = settings
  const parts: FabricObject[] = []
  const title = wrappedText(settings.title, { size: 15, weight: 700, colour: '#ffffff' }, width - 24)
  const bar = Math.max(CARDS.bar, heightOf(title) + 2 * CARDS.barPad)
  parts.push(named(new Rect({ left: origin.x, top: origin.y, width, height: bar, rx: 8, ry: 8, fill: colour, strokeWidth: 0, originX: 'left', originY: 'top' }), 'Title bar'))
  place(title, origin.x + width / 2, origin.y + (bar - heightOf(title)) / 2)

  const headings = slots.map((slot, i) => wrappedText(settings.headings.at(i) ?? '', { size: 13, weight: 700, colour: shade(colour, 0.85) }, slot.width - 2 * CARDS.side))
  const captions = captionsFor(settings, slots, () => ({ size: 11, weight: 400, colour: GREY }), CARDS.side)
  const top = origin.y + bar + CARDS.below
  const headRoom = tallest(headings, 16)
  const rowTop = top + CARDS.pad + headRoom + CARDS.space
  const captionRoom = tallest(captions)
  const bottom = rowTop + row + (captionRoom > 0 ? CARDS.space + captionRoom : 0) + CARDS.pad + 2
  for (const [i, slot] of slots.entries()) {
    parts.push(named(new Rect({ left: slot.x, top, width: slot.width, height: bottom - top, rx: 10, ry: 10, fill: '#ffffff', stroke: colour, strokeWidth: 1.5, originX: 'left', originY: 'top' }), 'Card'))
    const middle = slot.x + slot.width / 2
    place(headings.at(i), middle, top + CARDS.pad)
    place(captions.at(i), middle, rowTop + row + CARDS.space)
    const next = slots.at(i + 1)
    if (next) {
      const y = (top + bottom) / 2
      parts.push(named(arrowPath(new Point(slot.x + slot.width + 6, y), new Point(next.x - 6, y), colour, 10, 12, 24), 'Arrow'))
    }
  }
  for (const text of [title, ...headings, ...captions]) if (text) parts.push(named(text, text.text))
  return { parts, rowTop, height: bottom - origin.y }
}

/** B · Chevron flow: a big title with a thin rule, the headings in a row of chevrons darkening towards the finding, the parts on open white. */
const drawChevrons: DrawLook = (settings, slots, row, origin, width) => {
  const { colour } = settings
  const parts: FabricObject[] = []
  const title = wrappedText(settings.title, { size: 19, weight: 700, colour: INK, align: 'left' }, width)
  place(title, origin.x, origin.y, false)
  const ruleY = origin.y + heightOf(title) + 6
  parts.push(named(new Rect({ left: origin.x, top: ruleY, width, height: CHEVRONS.rule, fill: colour, strokeWidth: 0, originX: 'left', originY: 'top' }), 'Rule'))

  const tints = [0.45, 0.72, 1]
  const fills = slots.map((_, i) => wash(colour, tints.at(i) ?? 1))
  const headings = slots.map((slot, i) => wrappedText(settings.headings.at(i) ?? '', { size: 12, weight: 700, colour: inkOn(fills.at(i) ?? colour, colour), upper: true }, slot.width - 2 * CHEVRONS.point - 8))
  const chevronTop = ruleY + CHEVRONS.rule + 14
  const chevron = Math.max(CHEVRONS.chevron, tallest(headings) + 14)
  const rowTop = chevronTop + chevron + CHEVRONS.below
  const captions = captionsFor(settings, slots, () => ({ size: 11, weight: 400, colour: INK }), 4)
  const captionRoom = tallest(captions)
  for (const [i, slot] of slots.entries()) {
    const notch = i === 0 ? 0 : CHEVRONS.point
    const tip = i === slots.length - 1 ? 0 : CHEVRONS.point
    const [x, y, w, h] = [slot.x, chevronTop, slot.width, chevron]
    const path = `M ${x} ${y} H ${x + w - tip} L ${x + w} ${y + h / 2} L ${x + w - tip} ${y + h} H ${x} L ${x + notch} ${y + h / 2} Z`
    parts.push(named(new Path(path, { fill: fills.at(i) ?? colour, strokeWidth: 0, objectCaching: false }), 'Chevron'))
    const heading = headings.at(i)
    place(heading, x + w / 2 + (notch - tip) / 4, y + (h - heightOf(heading)) / 2)
    place(captions.at(i), x + w / 2, rowTop + row + 10)
  }
  for (const text of [title, ...headings, ...captions]) if (text) parts.push(named(text, text.text))
  const bottom = rowTop + row + (captionRoom > 0 ? 10 + captionRoom : 0) + 4
  return { parts, rowTop, height: bottom - origin.y }
}

/** C · Spotlight: a pale title strip, numbered steps on a thin line, the finding in a wider tinted card. */
const drawSpotlight: DrawLook = (settings, slots, row, origin, width) => {
  const { colour } = settings
  const parts: FabricObject[] = []
  const title = wrappedText(settings.title, { size: 15, weight: 700, colour: shade(colour, 0.7), align: 'left' }, width - 28)
  const strip = Math.max(SPOTLIGHT.strip, heightOf(title) + 16)
  parts.push(named(new Rect({ left: origin.x, top: origin.y, width, height: strip, rx: 6, ry: 6, fill: wash(colour, 0.1), strokeWidth: 0, originX: 'left', originY: 'top' }), 'Title strip'))
  parts.push(named(new Rect({ left: origin.x, top: origin.y, width: 5, height: strip, rx: 2, ry: 2, fill: colour, strokeWidth: 0, originX: 'left', originY: 'top' }), 'Stripe'))
  place(title, origin.x + 16, origin.y + (strip - heightOf(title)) / 2, false)

  const top = origin.y + strip + SPOTLIGHT.below
  const last = slots.length - 1
  const headings = slots.map((slot, i) => wrappedText(settings.headings.at(i) ?? '', { size: i === last ? 14 : 12, weight: 700, colour: i === last ? shade(colour, 0.7) : INK, align: 'left' }, slot.width - SPOTLIGHT.pad - SPOTLIGHT.badge - 6 - 8))
  const lineY = top + Math.max(SPOTLIGHT.badge, tallest(headings) / 2) + 7
  const rowTop = lineY + Math.max(SPOTLIGHT.badge, tallest(headings) / 2) + 14
  const captions = captionsFor(settings, slots, (i) => (i === last ? { size: 12, weight: 600, colour: shade(colour, 0.7) } : { size: 11, weight: 400, colour: GREY }), 8)
  const captionRoom = tallest(captions)
  const bottom = rowTop + row + (captionRoom > 0 ? 10 + captionRoom : 0) + 14
  const finding = slots.at(last)
  if (finding) parts.push(named(new Rect({ left: finding.x, top, width: finding.width, height: bottom - top, rx: 12, ry: 12, fill: wash(colour, 0.1), stroke: colour, strokeWidth: 2, originX: 'left', originY: 'top' }), 'Finding card'))
  const line = wash(colour, 0.6)
  for (const [i, slot] of slots.entries()) {
    const badge = slot.x + SPOTLIGHT.pad
    const on = i === last
    parts.push(named(new Rect({ left: badge, top: lineY, width: 2 * SPOTLIGHT.badge, height: 2 * SPOTLIGHT.badge, rx: SPOTLIGHT.badge, ry: SPOTLIGHT.badge, fill: on ? colour : '#ffffff', stroke: colour, strokeWidth: 1.5, originX: 'center', originY: 'center' }), 'Badge'))
    const number = new FabricText(String(i + 1), textOptions({ size: 11, weight: 700, colour: on ? '#ffffff' : colour }))
    place(number, badge, lineY - number.height / 2)
    parts.push(named(number, `Number ${i + 1}`))
    const heading = headings.at(i)
    place(heading, badge + SPOTLIGHT.badge + 6, lineY - heightOf(heading) / 2, false)
    place(captions.at(i), slot.x + slot.width / 2, rowTop + row + 10)
    // A thin arrow from after this heading to the next badge.
    const next = slots.at(i + 1)
    if (next) {
      const from = badge + SPOTLIGHT.badge + 6 + (heading?.width ?? 0) + 8
      const to = next.x + SPOTLIGHT.pad - SPOTLIGHT.badge - 4
      if (to - from >= 12) parts.push(named(new Path(`M ${from} ${lineY} H ${to} M ${to - 6} ${lineY - 4} L ${to} ${lineY} L ${to - 6} ${lineY + 4}`, { fill: '', stroke: line, strokeWidth: 1.5, strokeLineCap: 'round', strokeLineJoin: 'round', objectCaching: false }), 'Arrow'))
    }
  }
  for (const text of [title, ...headings, ...captions]) if (text) parts.push(named(text, text.text))
  return { parts, rowTop, height: bottom - origin.y }
}

const LOOKS: Record<AbstractLook, DrawLook> = { cards: drawCards, chevrons: drawChevrons, spotlight: drawSpotlight }

/* ---------- A new abstract ---------- */

/** A content's box on the page (icon and chart spaces by their own box). */
export function contentBoxOf(object: FabricObject): Box {
  if (object instanceof IconSpace) return spaceBox(object)
  if (object instanceof ContentSpace) return contentBox(object)
  const rect = object.getBoundingRect()
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
}

/** An empty space for part `index`: icon spaces for the problem and method, a chart space for the finding. */
export function emptySpaceFor(index: number, middle: { x: number; y: number }, colour: string): FabricObject {
  if (index === PARTS - 1) return buildContentSpace({ x: middle.x - NEW_CHART_SPACE.width / 2, y: middle.y - NEW_CHART_SPACE.height / 2 }, NEW_CHART_SPACE)
  return buildIconSpace({ x: middle.x - NEW_SPACE_SIZE / 2, y: middle.y - NEW_SPACE_SIZE / 2 }, undefined, colour)
}

/** The middle of each part's space, for filling empty parts (the row's height as now). */
export function partMiddles(block: AbstractBlock, steps: readonly FabricObject[], boxOf: (step: FabricObject) => Box): { x: number; y: number }[] {
  const settings = abstractSettingsOf(block)
  const origin = sequenceBox(block)
  const plan = abstractPlan(settings, steps, boxOf, origin)
  const width = plan.frame.width
  const row = Math.max(NEW_SPACE_SIZE, ...steps.map((step) => boxOf(step).height))
  const rowTop = LOOKS[settings.look](settings, slotsFor(settings.look, width).map((slot) => ({ ...slot, x: slot.x + origin.x })), row, origin, width).rowTop
  return slotsFor(settings.look, width).map((slot) => ({ x: origin.x + slot.x + slot.width / 2, y: rowTop + row / 2 }))
}

/** Which parts (by index) have nothing in them. */
export function emptyParts(block: AbstractBlock, steps: readonly FabricObject[], boxOf: (step: FabricObject) => Box): number[] {
  const settings = abstractSettingsOf(block)
  const origin = sequenceBox(block)
  const width = drawnWidth(settings, origin.x, steps.map((step) => ({ step, box: boxOf(step) })))
  return assignParts(settings.look, width, origin.x, steps.map((step) => ({ step, box: boxOf(step) })))
    .map((step, i) => (step ? -1 : i))
    .filter((i) => i >= 0)
}

/**
 * A new graphical abstract in one look, its middle at `centre`: two empty
 * icon spaces and a chart space. Given the room inside an empty page's
 * margins, it is as wide as that room, as a figure grid is. The spaces still
 * need the block's id once it has one.
 */
export function buildAbstract(look: AbstractLook, centre: { x: number; y: number }, area?: { width: number; height: number }): { block: AbstractBlock; spaces: FabricObject[] } {
  const width = area ? Math.min(ABSTRACT_WIDTH.max, Math.max(ABSTRACT_WIDTH.min, area.width)) : DEFAULT_ABSTRACT.width
  const settings: AbstractSettings = { ...DEFAULT_ABSTRACT, look, width, headings: [...DEFAULT_ABSTRACT.headings], captions: [...DEFAULT_ABSTRACT.captions] }
  const block = new AbstractBlock([new Rect({ left: 0, top: 0, width: 1, height: 1, fill: 'rgba(0,0,0,0)', strokeWidth: 0, originX: 'left', originY: 'top' })], { lockRotation: true, lockScalingY: true, lockSkewingX: true, lockSkewingY: true })
  block.abstract = settings
  // Each space starts roughly under its part; the layout centres it.
  const slots = slotsFor(look, settings.width)
  const spaces = slots.map((slot, i) => emptySpaceFor(i, { x: slot.x + slot.width / 2, y: 100 }, settings.colour))
  const move: Mover = (step, dx, dy) => {
    step.set({ left: step.left + dx, top: step.top + dy })
    step.setCoords()
  }
  layOutSequence(block, spaces, contentBoxOf, undefined, move)
  // Then everything moves so the block's middle is at `centre`.
  const placed = sequenceBox(block)
  const dx = centre.x - (placed.x + placed.width / 2)
  const dy = centre.y - (placed.y + placed.height / 2)
  for (const object of [block, ...spaces]) move(object, dx, dy)
  return { block, spaces }
}

/**
 * While a side handle is dragged: the stretch goes into the block's width
 * and its scale goes back to 1, the edge opposite the handle staying about
 * where it was. The caller lays it out again (its contents are on the page)
 * and then puts the held edge back exactly where Fabric holds it.
 * `originX` is the side Fabric holds still.
 */
export function takeWidthFromScale(block: AbstractBlock, originX: 'left' | 'center' | 'right' = 'left'): boolean {
  const sx = Math.abs(block.scaleX)
  if (sx === 1 && block.scaleY === 1) return false
  const box = sequenceBox(block)
  const settings = abstractSettingsOf(block)
  // Never narrower than its contents need, so dragging back out answers straight away.
  const width = Math.min(ABSTRACT_WIDTH.max, Math.max(ABSTRACT_WIDTH.min, block.narrowest ?? 0, settings.width + block.width * (sx - 1)))
  block.abstract = { ...settings, width }
  const left = originX === 'right' ? box.x + box.width - width : originX === 'center' ? box.x + box.width / 2 - width / 2 : box.x
  block.set({ scaleX: 1, scaleY: 1 })
  const now = sequenceBox(block)
  block.set({ left: block.left + left - now.x, top: block.top + box.y - now.y })
  block.setCoords()
  return true
}
