/**
 * Pathway cascades (BIO-105): a signalling pathway read top to bottom. A
 * ligand outside the cell, a receptor in the membrane, a chain of molecules
 * linked by arrows and, at the end, the nucleus.
 *
 * A pathway is a sequence (BIO-75) running down the page, so its steps are
 * ordinary objects (icon spaces, icons) pointing at it with `panelId`, and
 * carrying, copying, deleting, dropping in, trading places and Detach all
 * come from the sequence code. It lays itself out through
 * `SequenceBlock.planLayout`, as a comparison does. The steps' names are the
 * sequence's labels; their roles ("Kinase") and the words on the arrows
 * ("activates") are its own, all kept by position.
 *
 * Which step is which goes by place: with `ligand` on, the first step sits
 * outside the cell; the next is the receptor, in the membrane; the last
 * `nuclear` steps sit in the nucleus; the rest is the chain in between.
 *
 * Three looks, all offered (the owner, 2026-11-26, from the drafts in
 * `packages/ui/src/drafts/pathway-blocks/`): Cell cutout (a lipid bilayer and
 * a double-walled nucleus), Flow cards (a card per molecule, the membrane a
 * double rule, the nucleus a dashed box) and Compartments (bands named down
 * the left edge).
 */
import { FabricText, Path, Point, Rect, classRegistry, type FabricObject } from 'fabric'

import { DEFAULT_FONT, fontStack } from './fonts'
import { IconSpace, NEW_SPACE_SIZE, buildIconSpace, spaceBox } from './icon-space'
import { wash, type Box } from './panel-block'
import { DEFAULT_SEQUENCE, SequenceBlock, arrowPath, sequenceBox, sequenceSettingsOf, type SequencePlan } from './sequence-block'

export type PathwayLook = 'cutout' | 'cards' | 'bands'

export type PathwaySettings = {
  look: PathwayLook
  /** The arrows' and cards' colour, from the preset squares; the membrane and nucleus keep their own. */
  colour: string
  /** How wide the block is (the membrane, the nucleus, the bands); it never gets narrower than its names need. */
  width: number
  /** Whether the first step is a ligand outside the cell. */
  ligand: boolean
  /** How many of the last steps sit in the nucleus. */
  nuclear: number
  /** Each step's role under its name ("Kinase"), first step first; empty for none. */
  roles: string[]
  /** The word on the arrow after each step ("activates"); empty for none. */
  verbs: string[]
  /** How long the arrows are, times the look's own (1); a style switch sets it so the block keeps its height. */
  spread?: number
}

export const PATHWAY_LOOKS: readonly { id: PathwayLook; name: string }[] = [
  { id: 'cutout', name: 'Cell cutout' },
  { id: 'cards', name: 'Flow cards' },
  { id: 'bands', name: 'Compartments' },
]

export const DEFAULT_PATHWAY: PathwaySettings = { look: 'cutout', colour: '#0072b2', width: 360, ligand: true, nuclear: 1, roles: [], verbs: [] }

/** The width a pathway can be dragged to. */
export const PATHWAY_WIDTH = { min: 160, max: 1200 }

export class PathwayBlock extends SequenceBlock {
  static type = 'PathwayBlock'
  declare pathway?: PathwaySettings
  /** Where the "+" sits (in the gap above the nucleus), as shares of the block's box from its middle. Set by each layout; not saved. */
  plusAt?: { x: number; y: number }

  planLayout(steps: readonly FabricObject[], boxOf: (step: FabricObject) => Box, pinned?: FabricObject): SequencePlan {
    const plan = pathwayPlan(pathwaySettingsOf(this), sequenceSettingsOf(this).labels, steps, boxOf, pinned)
    const { frame } = plan
    this.plusAt = frame.width > 0 && frame.height > 0 ? { x: (plan.plus.x - frame.x) / frame.width - 0.5, y: (plan.plus.y - frame.y) / frame.height - 0.5 } : undefined
    return plan
  }
}
classRegistry.setClass(PathwayBlock)

/** What a pathway saves of its own (its names are the sequence's labels). */
export const PATHWAY_PROPERTIES = ['pathway'] as const

export const isPathway = (object: FabricObject | undefined): object is PathwayBlock => object instanceof PathwayBlock

export function pathwaySettingsOf(block: PathwayBlock): PathwaySettings {
  const saved = block.pathway
  return { ...DEFAULT_PATHWAY, ...saved, roles: [...(saved?.roles ?? [])], verbs: [...(saved?.verbs ?? [])] }
}

/* ---------- Which step is which ---------- */

export type StepPlace = 'ligand' | 'receptor' | 'chain' | 'nucleus'

/** Where each of `count` steps sits, first step first. The receptor is never in the nucleus. */
export function stepPlaces(settings: Pick<PathwaySettings, 'ligand' | 'nuclear'>, count: number): StepPlace[] {
  const ligand = settings.ligand && count >= 2
  const receptor = ligand ? 1 : 0
  const nuclear = Math.max(0, Math.min(settings.nuclear, count - receptor - 1))
  return Array.from({ length: count }, (_, i) => (i < receptor ? 'ligand' : i === receptor ? 'receptor' : i >= count - nuclear ? 'nucleus' : 'chain'))
}

/** Where Add step puts a new step: after the chain, just above the nucleus. */
export function insertIndex(settings: Pick<PathwaySettings, 'ligand' | 'nuclear'>, count: number): number {
  const places = stepPlaces(settings, count)
  const firstNuclear = places.indexOf('nucleus')
  return firstNuclear < 0 ? count : firstNuclear
}

/** The settings and names after a new step at `index` of `count`: everything from there moves down one; it is named after the chain steps before it. */
export function withStepAt(settings: PathwaySettings, names: readonly string[], index: number, count: number): { pathway: PathwaySettings; names: string[] } {
  const chain = stepPlaces(settings, count).slice(0, index).filter((place) => place === 'chain').length
  const splice = (list: readonly string[], value: string) => {
    const next = [...list]
    while (next.length < index) next.push('')
    next.splice(index, 0, value)
    return next
  }
  return { pathway: { ...settings, roles: splice(settings.roles, ''), verbs: splice(settings.verbs, '') }, names: splice(names, `Step ${chain + 1}`) }
}

/**
 * The settings after the steps at `gone` (places in order, first 0) are
 * removed from `count`: their roles and arrow words go with them, a removed
 * ligand turns the ligand off, and removed nuclear steps leave the nucleus
 * with fewer.
 */
export function withoutSteps(settings: PathwaySettings, count: number, gone: ReadonlySet<number>): PathwaySettings {
  const places = stepPlaces(settings, count)
  const keep = <T>(list: readonly T[]) => list.filter((_, i) => !gone.has(i))
  const nuclearGone = places.filter((place, i) => place === 'nucleus' && gone.has(i)).length
  const ligandGone = places.at(0) === 'ligand' && gone.has(0)
  const nuclear = places.filter((place) => place === 'nucleus').length
  return { ...settings, roles: keep(settings.roles), verbs: keep(settings.verbs), ligand: settings.ligand && !ligandGone, nuclear: nuclear - nuclearGone }
}

/* ---------- Layout ---------- */

const INK = '#27272a'
const MUTED = '#71717a'
const LIPID = '#e3cfa1'
const LIPID_EDGE = '#c9ae72'
const NUC = '#7c6bb0'
const NUC_TINT = '#f4f1fa'
const MEMBRANE_TEXT = '#8a6d2c'
const RULE = '#a1a1aa'

/** Each look's spacing: the arrow's room between steps, and the extra going into the nucleus. */
const GAPS: Record<PathwayLook, { arrow: number; ligand: number; intoNucleus: number }> = {
  cutout: { arrow: 30, ligand: 14, intoNucleus: 52 },
  cards: { arrow: 42, ligand: 42, intoNucleus: 76 },
  bands: { arrow: 28, ligand: 30, intoNucleus: 36 },
}
/** The arrows' length factor a style switch may set (the shortest still shows an arrow). */
export const SPREAD = { min: 0.4, max: 4 }

/** A card's room round its step (Flow cards). */
const CARD_PAD = 6

const named = <T extends FabricObject>(part: T, name: string): T => Object.assign(part, { name })

function makeText(text: string, look: { size: number; weight: number; colour: string; italic?: boolean; spacing?: number }): FabricText {
  return new FabricText(text, { fontFamily: fontStack(DEFAULT_FONT), fontSize: look.size, fontWeight: look.weight, fontStyle: look.italic ? 'italic' : 'normal', fill: look.colour, charSpacing: look.spacing ?? 0, strokeWidth: 0, originX: 'left', originY: 'top' })
}

/** A small capital caption (OUTSIDE, NUCLEUS...). */
const caption = (text: string, colour: string) => named(makeText(text, { size: 8.5, weight: 600, colour, spacing: 80 }), text.charAt(0) + text.slice(1).toLowerCase())

/** A step's name over its role, as one or two text parts; `left` its left edge, `middle` its height's middle. */
function nameParts(name: string, role: string, left: number, middle: number): { parts: FabricText[]; width: number; height: number } {
  const parts: FabricText[] = []
  if (name) parts.push(named(makeText(name, { size: 11.5, weight: 600, colour: INK }), name))
  if (role) parts.push(named(makeText(role, { size: 10, weight: 400, colour: MUTED }), role))
  const height = parts.reduce((sum, part) => sum + part.height, 0)
  let top = middle - height / 2
  for (const part of parts) {
    part.set({ left, top })
    top += part.height
  }
  return { parts, width: Math.max(0, ...parts.map((part) => part.width)), height }
}

/** A lipid bilayer from x0 to x1: a row of heads along each edge, tails between, as two shapes. */
function bilayer(x0: number, x1: number, top: number, height: number): FabricObject[] {
  const r = Math.max(2, Math.min(3.4, height / 8))
  const step = r * 2.25
  const heads: string[] = []
  const tails: string[] = []
  for (let x = x0 + r; x <= x1 - r; x += step) {
    for (const y of [top + r, top + height - r]) heads.push(`M ${x - r} ${y} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0`)
    const mid = top + height / 2
    tails.push(`M ${x - r * 0.32} ${top + 2 * r} V ${mid - 1} M ${x + r * 0.32} ${top + 2 * r} V ${mid - 1} M ${x - r * 0.32} ${top + height - 2 * r} V ${mid + 1} M ${x + r * 0.32} ${top + height - 2 * r} V ${mid + 1}`)
  }
  return [
    named(new Path(tails.join(' '), { fill: '', stroke: LIPID, strokeWidth: 0.9, objectCaching: false }), 'Lipid tails'),
    named(new Path(heads.join(' '), { fill: LIPID, stroke: LIPID_EDGE, strokeWidth: 0.6, objectCaching: false }), 'Lipid heads'),
  ]
}

/** A short, fat arrow straight down (Compartments). */
function chevron(x: number, y1: number, y2: number, colour: string): Path {
  const w = 8
  const head = Math.min(9, (y2 - y1) * 0.55)
  return named(new Path(`M ${x - w} ${y1} H ${x + w} V ${y2 - head} L ${x} ${y2} L ${x - w} ${y2 - head} Z`, { fill: colour, opacity: 0.9, strokeWidth: 0, objectCaching: false }), 'Arrow')
}

/** A part's box on the page. */
function partBox(part: FabricObject): Box {
  part.setCoords()
  const rect = part.getBoundingRect()
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
}

export type PathwayPlan = SequencePlan & { plus: { x: number; y: number } }

/**
 * Where the steps go and the parts that draw the look, in page coordinates.
 * The steps stand in one column, top to bottom in the order they lie, with
 * the look's gaps between them; `pinned` (the step being resized, else the
 * first) stays where it is and sets the column. Every look grows to the
 * right with the width setting.
 */
export function pathwayPlan(settings: PathwaySettings, names: readonly string[], steps: readonly FabricObject[], boxOf: (step: FabricObject) => Box, pinned?: FabricObject): PathwayPlan {
  const placed = steps
    .map((step) => ({ step, box: boxOf(step) }))
    .sort((a, b) => {
      const along = a.box.y + a.box.height / 2 - (b.box.y + b.box.height / 2)
      return Math.abs(along) > 0.5 ? along : a.box.x - b.box.x
    })
  const first = placed.at(0)
  if (!first) return { moves: [], parts: [], frame: { x: 0, y: 0, width: 0, height: 0 }, plus: { x: 0, y: 0 } }

  const { look, colour } = settings
  const places = stepPlaces(settings, placed.length)
  // The arrows are the look's own times `spread`; going into the nucleus keeps its extra room for the nucleus's edge.
  const spread = Math.max(SPREAD.min, Math.min(SPREAD.max, settings.spread ?? 1))
  const base = GAPS[look]
  const gaps = { arrow: base.arrow * spread, ligand: base.ligand * spread, intoNucleus: base.intoNucleus + base.arrow * (spread - 1) }
  const gapAfter = (i: number) => (places.at(i) === 'ligand' ? gaps.ligand : places.at(i + 1) === 'nucleus' && places.at(i) !== 'nucleus' ? gaps.intoNucleus : gaps.arrow)
  // The column: the pinned step's middle; the stack: from 0, then shifted so the pinned step keeps its top.
  const anchor = placed.find((each) => each.step === pinned) ?? first
  const column = anchor.box.x + anchor.box.width / 2
  let run = 0
  const tops = placed.map((each, i) => {
    const at = run
    run += each.box.height + gapAfter(i)
    return at
  })
  const shift = anchor.box.y - (tops.at(placed.indexOf(anchor)) ?? 0)
  const boxes = placed.map((each, i) => ({ x: column - each.box.width / 2, y: (tops.at(i) ?? 0) + shift, width: each.box.width, height: each.box.height }))
  const moves = placed.map((each, i) => {
    const box = boxes.at(i) ?? each.box
    return { step: each.step, dx: box.x - each.box.x, dy: box.y - each.box.y }
  })
  const widest = Math.max(...boxes.map((box) => box.width))
  const firstNuclear = places.indexOf('nucleus')
  const lastOutside = firstNuclear < 0 ? boxes.length - 1 : firstNuclear - 1
  const lastBox = boxes.at(-1) ?? first.box
  const receptorBox = boxes.at(places.indexOf('receptor')) ?? first.box
  const bottomOf = (box: Box) => box.y + box.height

  // Where things start left of the column, and where the names go.
  const left = look === 'cards' ? column - widest / 2 - CARD_PAD - 82 : column - Math.max(look === 'bands' ? 128 : 118, widest / 2 + (look === 'bands' ? 64 : 70))
  const cardLeft = column - widest / 2 - CARD_PAD
  const nameLeft = (i: number) => (look === 'cards' ? cardLeft + CARD_PAD + widest + 10 : column + (boxes.at(i)?.width ?? 0) / 2 + 14)

  const texts: FabricObject[] = []
  let rightmost = column + widest / 2
  placed.forEach((_, i) => {
    const box = boxes.at(i)
    if (!box) return
    const name = names.at(i)?.trim() ?? ''
    const role = settings.roles.at(i)?.trim() ?? ''
    // A receptor's name sits beside its top, clear of the membrane drawn through it.
    const receptorTop = places.at(i) === 'receptor' && look === 'cutout'
    const block = nameParts(name, role, nameLeft(i), box.y + box.height / 2)
    if (receptorTop) for (const part of block.parts) part.set({ top: part.top - (box.y + box.height / 2) + box.y + block.height / 2 + 2 })
    texts.push(...block.parts)
    rightmost = Math.max(rightmost, nameLeft(i) + block.width)
  })
  const cardWidth = Math.max(196, rightmost + 14 - cardLeft)

  // The arrows, each with its word beside it.
  const parts: FabricObject[] = []
  const arrowX = look === 'cards' ? cardLeft + cardWidth / 2 : column
  const arrows: { from: number; to: number; i: number }[] = []
  for (let i = 0; i + 1 < boxes.length; i++) {
    const a = boxes.at(i)
    const b = boxes.at(i + 1)
    if (!a || !b) continue
    const pad = look === 'cards' ? CARD_PAD + 3 : 4
    // Into the receptor, the arrow stops on the molecule, above the membrane.
    const to = look === 'cutout' && places.at(i + 1) === 'receptor' ? b.y + b.height * 0.28 : b.y - pad
    arrows.push({ from: bottomOf(a) + pad, to, i })
  }
  const nucleusBox = (() => {
    const inside = firstNuclear < 0 ? [] : boxes.slice(firstNuclear)
    const above = boxes.at(lastOutside) ?? lastBox
    const topPad = look === 'cutout' ? 22 : look === 'cards' ? CARD_PAD + 26 : (gaps.intoNucleus - 4) / 2
    const bottomPad = look === 'cutout' ? 26 : look === 'cards' ? CARD_PAD + 14 : 14
    const firstIn = inside.at(0)
    const lastIn = inside.at(-1)
    if (firstIn && lastIn) return { top: firstIn.y - topPad, bottom: bottomOf(lastIn) + bottomPad }
    // No step in the nucleus: it is still drawn, empty, the last arrow pointing into it.
    const top = bottomOf(above) + (look === 'cards' ? CARD_PAD : 0) + gaps.arrow
    return { top, bottom: top + 44 }
  })()
  if (firstNuclear < 0) arrows.push({ from: bottomOf(lastBox) + (look === 'cards' ? CARD_PAD + 3 : 4), to: nucleusBox.top + (look === 'bands' ? 14 : 16), i: boxes.length - 1 })

  const verbs: FabricObject[] = []
  for (const { from, to, i } of arrows) {
    if (to - from < 6) continue
    parts.push(look === 'bands' ? chevron(arrowX, from, to, colour) : named(arrowPath(new Point(arrowX, from), new Point(arrowX, to), colour, look === 'cards' ? 1.5 : 1.75, 7, 8), 'Arrow'))
    const verb = settings.verbs.at(i)?.trim() ?? ''
    if (!verb) continue
    const word = named(makeText(verb, { size: 10, weight: 400, colour: MUTED, italic: true }), verb)
    word.set({ left: arrowX + (look === 'bands' ? 14 : 10), top: Math.min((from + to) / 2, from + 15) - word.height / 2 })
    verbs.push(word)
    rightmost = Math.max(rightmost, arrowX + 14 + word.width)
  }

  // The block's box: as wide as the setting, or as its names need.
  const needed = (look === 'cards' ? Math.max(cardLeft + cardWidth, rightmost) + 82 : rightmost + 18) - left
  const width = Math.max(Math.min(PATHWAY_WIDTH.max, settings.width), needed)
  const right = left + width
  const top = (boxes.at(0)?.y ?? first.box.y) - (places.at(0) === 'ligand' ? (look === 'cards' ? CARD_PAD + 14 : 14) : look === 'cards' ? 44 : 34)
  const bottom = nucleusBox.bottom + (look === 'bands' ? 0 : 12)

  const back: FabricObject[] = []
  const membraneMiddle = receptorBox.y + receptorBox.height / 2
  switch (look) {
    case 'cutout': {
      // The bilayer lines up with a membrane icon's own (from 44 to 84 of its 128).
      const bandTop = receptorBox.y + (receptorBox.height * 44) / 128
      const bandHeight = Math.max(16, (receptorBox.height * 40) / 128)
      back.push(...bilayer(left + 6, right - 6, bandTop, bandHeight))
      const outside = caption('OUTSIDE', MUTED)
      outside.set({ left: left + 12, top: Math.max(top + 6, bandTop - outside.height - 8) })
      const inside = caption('CYTOPLASM', MUTED)
      inside.set({ left: left + 12, top: bandTop + bandHeight + 8 })
      back.push(outside, inside)
      const h = nucleusBox.bottom - nucleusBox.top
      const r = Math.min(46, h / 2)
      const dash = [38, 5]
      back.push(named(new Rect({ left: left + 24, top: nucleusBox.top, width: width - 48, height: h, rx: r, ry: r, fill: NUC_TINT, stroke: NUC, strokeWidth: 1.75, strokeDashArray: dash, originX: 'left', originY: 'top' }), 'Nuclear envelope'))
      back.push(named(new Rect({ left: left + 29, top: nucleusBox.top + 5, width: width - 58, height: h - 10, rx: Math.max(0, r - 5), ry: Math.max(0, r - 5), fill: '', stroke: NUC, strokeOpacity: 0.55, strokeWidth: 1, strokeDashArray: dash, originX: 'left', originY: 'top' }), 'Inner envelope'))
      const word = caption('NUCLEUS', NUC)
      // Clear of the pill's rounded end: in by its radius, from the inner wall (owner's feedback, 2026-11-26).
      word.set({ left: right - 29 - Math.max(24, r * 0.75) - word.width, top: nucleusBox.bottom - 20 - word.height / 2 })
      back.push(word)
      break
    }
    case 'cards': {
      for (const y of [membraneMiddle - 2.5, membraneMiddle + 2.5]) back.push(named(new Path(`M ${left + 10} ${y} H ${right - 10}`, { fill: '', stroke: RULE, strokeWidth: 1.25, objectCaching: false }), 'Membrane'))
      const outside = caption('OUTSIDE', MUTED)
      outside.set({ left: left + 12, top: membraneMiddle - 8 - outside.height })
      const inside = caption('CYTOPLASM', MUTED)
      inside.set({ left: left + 12, top: membraneMiddle + 8 })
      const membrane = caption('MEMBRANE', MUTED)
      membrane.set({ left: right - 12 - membrane.width, top: membraneMiddle - 8 - membrane.height })
      back.push(outside, inside, membrane)
      back.push(named(new Rect({ left: left + 18, top: nucleusBox.top, width: width - 36, height: nucleusBox.bottom - nucleusBox.top, rx: 14, ry: 14, fill: NUC_TINT, stroke: NUC, strokeWidth: 1.25, strokeDashArray: [5, 4], originX: 'left', originY: 'top' }), 'Nucleus'))
      const word = caption('NUCLEUS', NUC)
      word.set({ left: left + 30, top: nucleusBox.top + 8 })
      back.push(word)
      // A card round each step; the receptor's is tinted.
      boxes.forEach((box, i) => {
        const receptor = places.at(i) === 'receptor'
        back.push(named(new Rect({ left: cardLeft, top: box.y - CARD_PAD, width: cardWidth, height: box.height + 2 * CARD_PAD, rx: 10, ry: 10, fill: receptor ? wash(colour, 0.1) : '#ffffff', stroke: colour, strokeWidth: 1.25, originX: 'left', originY: 'top' }), 'Card'))
      })
      break
    }
    case 'bands': {
      const memTop = receptorBox.y
      const memBottom = bottomOf(receptorBox)
      const rail = left + 30
      const band = (y0: number, y1: number, fill: string, name: string) => named(new Rect({ left, top: y0, width, height: Math.max(0, y1 - y0), fill, strokeWidth: 0, originX: 'left', originY: 'top' }), name)
      // The lines stop half their width inside the edges, so their ends don't widen the block.
      back.push(band(top, memTop, '#fafafa', 'Outside band'), band(memTop, memBottom, '#f6efdc', 'Membrane band'), band(memBottom, nucleusBox.top, wash(colour, 0.07), 'Cytoplasm band'), band(nucleusBox.top, bottom, NUC_TINT, 'Nucleus band'))
      for (const y of [memTop, memBottom]) back.push(named(new Path(`M ${left + 0.5} ${y} H ${right - 0.5}`, { fill: '', stroke: LIPID_EDGE, strokeWidth: 1, objectCaching: false }), 'Membrane edge'))
      back.push(named(new Path(`M ${left + 0.5} ${nucleusBox.top} H ${right - 0.5}`, { fill: '', stroke: NUC, strokeOpacity: 0.5, strokeWidth: 1, strokeDashArray: [4, 3], objectCaching: false }), 'Nucleus edge'))
      back.push(named(new Path(`M ${rail} ${top} V ${bottom}`, { fill: '', stroke: '#e4e4e7', strokeWidth: 1, objectCaching: false }), 'Rail'))
      // Each band's name, turned, in the rail; left out where it doesn't fit.
      const railName = (text: string, y0: number, y1: number, fill: string) => {
        const word = caption(text, fill)
        if (word.width + 8 > y1 - y0) return
        word.set({ originX: 'center', originY: 'center', angle: -90, left: left + 15, top: (y0 + y1) / 2 })
        back.push(word)
      }
      railName('OUTSIDE', top, memTop, MUTED)
      railName('MEMBRANE', memTop, memBottom, MEMBRANE_TEXT)
      railName('CYTOPLASM', memBottom, nucleusBox.top, colour)
      railName('NUCLEUS', nucleusBox.top, bottom, NUC)
      break
    }
  }

  // The "+": beside the arrow into the nucleus.
  const above = boxes.at(lastOutside) ?? lastBox
  const plus = { x: arrowX - 22, y: (bottomOf(above) + (boxes.at(firstNuclear)?.y ?? nucleusBox.top + 16)) / 2 }
  const frame = { x: left, y: top, width, height: bottom - top }
  // Whatever sticks out (a long name) still counts as the block's area.
  const all = [...back, ...parts, ...texts, ...verbs]
  const reach = all.map(partBox)
  const x1 = Math.max(frame.x + frame.width, ...reach.map((box) => box.x + box.width))
  const y1 = Math.max(frame.y + frame.height, ...reach.map((box) => box.y + box.height))
  return { moves, parts: all, frame: { ...frame, width: x1 - frame.x, height: y1 - frame.y }, plus }
}

/* ---------- A new pathway ---------- */

/** What a new pathway starts with: a ligand, a receptor, two steps and a target gene in the nucleus. */
const START = {
  names: ['Ligand', 'Receptor', 'Step 1', 'Step 2', 'Target gene'],
  sizes: [48, 84, NEW_SPACE_SIZE * 0.9, NEW_SPACE_SIZE * 0.9, NEW_SPACE_SIZE * 0.9],
}

/** A new pathway of empty icon spaces in one look, its middle at `centre`. The spaces still need the pathway's id once it has one. */
export function buildPathway(look: PathwayLook, centre: { x: number; y: number }): { pathway: PathwayBlock; spaces: IconSpace[] } {
  let y = 0
  const spaces = START.sizes.map((size) => {
    const space = buildIconSpace({ x: -size / 2, y }, { width: size, height: size })
    y += size + 30
    return space
  })
  const box = (step: FabricObject) => (step instanceof IconSpace ? spaceBox(step) : { x: step.left, y: step.top, width: step.width, height: step.height })
  const settings = { ...DEFAULT_SEQUENCE, direction: 'down' as const, labels: [...START.names] }
  const pathway = new PathwayBlock([new Rect({ width: 1, height: 1, fill: 'rgba(0,0,0,0)', strokeWidth: 0 })], { lockRotation: true, lockScalingX: true, lockScalingY: true, lockSkewingX: true, lockSkewingY: true })
  pathway.sequence = settings
  pathway.pathway = { ...DEFAULT_PATHWAY, look }
  const plan = pathway.planLayout(spaces, box)
  for (const { step, dx, dy } of plan.moves) {
    step.set({ left: step.left + dx, top: step.top + dy })
    step.setCoords()
  }
  pathway.set({ scaleX: 1, scaleY: 1 })
  pathway.removeAll()
  pathway.add(new Rect({ left: plan.frame.x, top: plan.frame.y, width: plan.frame.width, height: plan.frame.height, fill: 'rgba(0,0,0,0)', strokeWidth: 0, originX: 'left', originY: 'top' }), ...plan.parts)
  const now = sequenceBox(pathway)
  pathway.set({ left: pathway.left + plan.frame.x - now.x, top: pathway.top + plan.frame.y - now.y })
  pathway.setCoords()
  // Everything moves so the block's middle is at `centre`.
  const area = sequenceBox(pathway)
  const dx = centre.x - (area.x + area.width / 2)
  const dy = centre.y - (area.y + area.height / 2)
  for (const object of [pathway, ...spaces]) {
    object.set({ left: object.left + dx, top: object.top + dy })
    object.setCoords()
  }
  return { pathway, spaces }
}
