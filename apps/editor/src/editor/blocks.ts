/*
 * The blocks in the Blocks tool (panels from BIO-74, sequences from BIO-75;
 * the full tool is BIO-76), built the same way for the page and for the
 * picture on their card, so a card shows exactly what clicking it places.
 */
import type { FabricObject } from 'fabric'

import { buildAbstract, type AbstractLook } from './abstract-block'
import { buildLabelledIcon, buildZoomInset, type CalloutInset, type CalloutLabels, type InsetLook, type LabelLook } from './callout-block'
import { buildComparison, type ComparisonKind } from './comparison-block'
import { buildGrid, gridLayout, type GridLayoutId } from './grid-block'
import { IconSpace, NEW_SPACE_SIZE, buildIconSpace, spaceBox } from './icon-space'
import { DEFAULT_PANEL, NEW_PANEL_SIZE, PanelBlock, buildPanel, innerOf } from './panel-block'
import { familyOf, type BranchLook, type CycleLook } from './process-looks'
import { LegendBlock, buildLegend, type LegendLook } from './legend-block'
import { buildPathway, type PathwayLook } from './pathway-block'
import { WellPlate, buildPlate, type PlateLook } from './well-plate'
import { DEFAULT_SEQUENCE, LOOK_GAP, SequenceBlock, buildSequence, sequenceBox, type SequenceLook } from './sequence-block'
import { DEFAULT_TIMELINE, TimelineBlock, buildTimeline, type TimelineStyle } from './timeline-block'

/**
 * A block: the panel (a figure grid is one too) or sequence, and the empty
 * spaces it holds (which still need its id once it has one; a callout's
 * marker and labels too, BIO-97). `inner` is what
 * those hold in turn (a comparison's sides hold an icon space each, BIO-95).
 */
export type Block = { panel: PanelBlock | SequenceBlock | TimelineBlock | WellPlate | LegendBlock | CalloutInset | CalloutLabels; spaces: FabricObject[]; inner?: { holder: FabricObject; objects: FabricObject[] }[] }

/** A comparison (BIO-95): two matching sides, each with an empty icon space, its middle at `centre`. */
export const comparisonOfSpaces =
  (kind: ComparisonKind) =>
  (centre: { x: number; y: number }): Block => {
    const { comparison, sides, spaces } = buildComparison(kind, centre)
    return { panel: comparison, spaces: sides, inner: sides.map((side, i) => ({ holder: side, objects: spaces.at(i) ?? [] })) }
  }

/** A figure grid (BIO-86) of empty chart spaces in a layout, centred at `centre`; given the page's room inside its margins (an empty page), it fills it. */
export const figureGrid =
  (layout: GridLayoutId) =>
  (centre: { x: number; y: number }, area?: { width: number; height: number }): Block =>
    buildGrid(layout, centre, {}, area)

/** How a layout card's picture looks (design D "Placeholders", picked 2026-11-25): the panels' blue, a paler fill, a paler chart. */
const CARD = { view: { width: 120, height: 80 }, margin: 4, gap: 5, blue: '#0072b2', fill: '#f0f6fc', chart: '#7fb3d8' }

/**
 * A layout's card picture (BIO-86): each cell as a dashed blue slot with a
 * small bar chart and a plus in its middle, so the card shows what clicking
 * it places: empty slots waiting for a graph. Drawn on a 120 x 80 card in the
 * layout's proportions, in the panels' blue so it sits well beside them.
 */
export function figureGridSvg(id: GridLayoutId): string {
  const layout = gridLayout(id)
  const { view, margin, gap } = CARD
  const cw = (view.width - 2 * margin - gap * (layout.cols - 1)) / layout.cols
  const ch = (view.height - 2 * margin - gap * (layout.rows - 1)) / layout.rows
  const slots = layout.cells.map((cell) => {
    const x = margin + cell.col * (cw + gap)
    const y = margin + cell.row * (ch + gap)
    const w = cw * (cell.cols ?? 1) + gap * ((cell.cols ?? 1) - 1)
    const h = ch * (cell.rows ?? 1) + gap * ((cell.rows ?? 1) - 1)
    const s = Math.min(w, h) * 0.38
    const cx = x + w / 2
    const cy = y + h / 2
    const left = cx - s / 2
    const top = cy - s / 2
    const bars = [0.5, 0.85, 0.65].map((v, i) => `<rect x="${left + s * (0.18 + i * 0.27)}" y="${top + s * (1 - v)}" width="${s * 0.16}" height="${s * v - 1.6}" rx="${s * 0.03}" fill="${CARD.chart}"/>`).join('')
    const badge = { x: cx + s / 2 + 1, y: cy + s / 2 - 1, r: s * 0.22, arm: s * 0.11 }
    return (
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${CARD.fill}" stroke="${CARD.blue}" stroke-width="0.9" stroke-dasharray="2.5 2"/>` +
      `<path d="M ${left} ${top} V ${top + s} H ${left + s}" stroke="${CARD.chart}" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
      bars +
      `<circle cx="${badge.x}" cy="${badge.y}" r="${badge.r}" fill="${CARD.blue}" stroke="${CARD.fill}" stroke-width="1"/>` +
      `<path d="M ${badge.x - badge.arm} ${badge.y} h ${2 * badge.arm} M ${badge.x} ${badge.y - badge.arm} v ${2 * badge.arm}" stroke="#ffffff" stroke-width="0.8" stroke-linecap="round"/>`
    )
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${view.width} ${view.height}" width="100%" height="100%" aria-hidden="true">${slots.join('')}</svg>`
}

/** An empty panel, its box's middle at `centre`. */
export function emptyPanel(centre: { x: number; y: number }): Block {
  const { width, height } = NEW_PANEL_SIZE
  return { panel: buildPanel(DEFAULT_PANEL, NEW_PANEL_SIZE, { x: centre.x - width / 2, y: centre.y - height / 2 }), spaces: [] }
}

/** A panel holding a row of `count` empty icon spaces, its box's middle at `centre`. The spaces still need the panel's id once it has one. */
export function panelWithIcons(centre: { x: number; y: number }, count = 3): Block {
  const gap = 20
  const side = NEW_SPACE_SIZE
  const width = count * side + (count - 1) * gap + 2 * DEFAULT_PANEL.padding
  // As tall as its header and the row of spaces, with the padding around them.
  const probe = innerOf(buildPanel(DEFAULT_PANEL, { width, height: 200 }, { x: 0, y: 0 }))
  const height = 200 - probe.height + side
  const panel = buildPanel(DEFAULT_PANEL, { width, height }, { x: centre.x - width / 2, y: centre.y - height / 2 })
  const room = innerOf(panel)
  const spaces = Array.from({ length: count }, (_, i) => buildIconSpace({ x: room.x + i * (side + gap), y: room.y }, { width: side, height: side }, DEFAULT_PANEL.colour))
  return { panel, spaces }
}

/** The labels a new sequence starts with: times on a timeline, numbered steps otherwise. */
function startLabels(look: SequenceLook, count: number): string[] {
  return Array.from({ length: count }, (_, i) => (look === 'timeline' ? `t = ${i}` : `Step ${i + 1}`))
}

/** A sequence of `count` empty icon spaces across the page in one of the four looks, its middle at `centre` (BIO-75). */
export function sequenceOfSpaces(look: SequenceLook, count = 3): (centre: { x: number; y: number }) => Block {
  return (centre) => {
    const side = NEW_SPACE_SIZE
    const spaces = Array.from({ length: count }, (_, i) => buildIconSpace({ x: i * (side + LOOK_GAP[look]), y: 0 }, { width: side, height: side }))
    const box = (step: FabricObject) => (step instanceof IconSpace ? spaceBox(step) : { x: step.left, y: step.top, width: step.width, height: step.height })
    const panel = buildSequence({ ...DEFAULT_SEQUENCE, look, gap: LOOK_GAP[look], labels: startLabels(look, count) }, spaces, box)
    // Everything moves so the sequence's middle is at `centre`.
    const area = sequenceBox(panel)
    const dx = centre.x - (area.x + area.width / 2)
    const dy = centre.y - (area.y + area.height / 2)
    for (const object of [panel, ...spaces]) {
      object.set({ left: object.left + dx, top: object.top + dy })
      object.setCoords()
    }
    return { panel, spaces }
  }
}

/** A block as SVG, cropped to its outline, for its card. */
export function blockSvg({ panel, spaces, inner = [] }: Block): string {
  const parts = [panel, ...spaces, ...inner.flatMap((each) => each.objects)]
  // Round what sticks out too (a comparison's title tabs).
  const rects = parts.map((part) => part.getBoundingRect())
  const left = Math.min(...rects.map((rect) => rect.left))
  const top = Math.min(...rects.map((rect) => rect.top))
  const width = Math.max(...rects.map((rect) => rect.left + rect.width)) - left
  const height = Math.max(...rects.map((rect) => rect.top + rect.height)) - top
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${left} ${top} ${width} ${height}" width="100%" height="100%" aria-hidden="true">${parts.map((part) => part.toSVG()).join('')}</svg>`
}

/*
 * Process blocks (BIO-96): an experiment timeline in each of its three
 * styles, and a cycle and branching of empty icon spaces in each of theirs.
 */

/** An experiment timeline in one style, its middle at `centre`: a study's schedule to start from. */
export const experimentTimeline =
  (style: TimelineStyle) =>
  (centre: { x: number; y: number }): Block => ({ panel: buildTimeline({ ...DEFAULT_TIMELINE, style }, centre), spaces: [] })

/** What a new cycle or branching starts with: four numbered steps round a cycle; a start and three groups. */
const PROCESS_START: Record<'cycle' | 'branch', { count: number; labels: string[]; title?: string }> = {
  cycle: { count: 4, labels: ['Step 1', 'Step 2', 'Step 3', 'Step 4'], title: 'Cycle' },
  branch: { count: 4, labels: ['Start', 'Group 1', 'Group 2', 'Group 3'] },
}

/**
 * A cycle or branching of empty icon spaces in one look, its middle at
 * `centre`. The spaces start roughly where they belong (round a circle; the
 * start, then its arms) so they come out in order; the layout does the rest.
 */
export function processOfSpaces(look: CycleLook | BranchLook): (centre: { x: number; y: number }) => Block {
  return (centre) => {
    const family = familyOf(look) === 'cycle' ? 'cycle' : 'branch'
    const start = PROCESS_START[family]
    const side = NEW_SPACE_SIZE
    const rough = (i: number) =>
      family === 'cycle'
        ? { x: 100 * Math.cos(-Math.PI / 2 + (i * 2 * Math.PI) / start.count), y: 100 * Math.sin(-Math.PI / 2 + (i * 2 * Math.PI) / start.count) }
        : i === 0
          ? { x: 0, y: 0 }
          : look === 'fan'
            ? { x: (i - 2) * 120, y: 200 }
            : { x: 200, y: (i - 2) * 100 }
    const spaces = Array.from({ length: start.count }, (_, i) => buildIconSpace(rough(i), { width: side, height: side }))
    const box = (step: FabricObject) => (step instanceof IconSpace ? spaceBox(step) : { x: step.left, y: step.top, width: step.width, height: step.height })
    const panel = buildSequence({ ...DEFAULT_SEQUENCE, look, gap: LOOK_GAP[look], labels: [...start.labels], title: start.title ?? '' }, spaces, box)
    const area = sequenceBox(panel)
    const dx = centre.x - (area.x + area.width / 2)
    const dy = centre.y - (area.y + area.height / 2)
    for (const object of [panel, ...spaces]) {
      object.set({ left: object.left + dx, top: object.top + dy })
      object.setCoords()
    }
    return { panel, spaces }
  }
}

/** A well plate map (BIO-98) in one look, with the example dose series on a 96-well plate, its middle at `centre`. */
export const wellPlate =
  (look: PlateLook) =>
  (centre: { x: number; y: number }): Block => ({ panel: buildPlate(look, centre), spaces: [] })

/** A graphical abstract (BIO-107) in one look: a title over three parts, two icon spaces and a chart space, its middle at `centre`. */
export const graphicalAbstract =
  (look: AbstractLook) =>
  (centre: { x: number; y: number }, area?: { width: number; height: number }): Block => {
    const { block, spaces } = buildAbstract(look, centre, area)
    return { panel: block, spaces }
  }

/** A legend (BIO-106) in one look: two icon rows and a colour row, its middle at `centre`. */
export const legendBlock =
  (look: LegendLook) =>
  (centre: { x: number; y: number }): Block => ({ panel: buildLegend(look, centre), spaces: [] })

/* ---------- Callouts (BIO-97) ---------- */

/** A zoom inset in one of its looks: the inset with an empty icon space, and its marker, around `centre`. */
export const zoomInset =
  (look: InsetLook) =>
  (centre: { x: number; y: number }): Block => {
    const { inset, marker, space } = buildZoomInset(look, centre)
    return { panel: inset, spaces: [space, marker] }
  }

/** A labelled icon in one of its looks: an empty icon space with three labels, its middle at `centre`. */
export const labelledIcon =
  (look: LabelLook) =>
  (centre: { x: number; y: number }): Block => {
    const { block, space, labels } = buildLabelledIcon(look, centre)
    return { panel: block, spaces: [space, ...labels] }
  }

/* ---------- Pathway cascades (BIO-105) ---------- */

/** A pathway cascade in one look: a ligand, a receptor in the membrane, two steps and a target gene in the nucleus, all empty icon spaces, its middle at `centre`. */
export const pathwayCascade =
  (look: PathwayLook) =>
  (centre: { x: number; y: number }): Block => {
    const { pathway, spaces } = buildPathway(look, centre)
    return { panel: pathway, spaces }
  }
