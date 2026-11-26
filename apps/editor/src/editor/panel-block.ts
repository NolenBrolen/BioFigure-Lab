/**
 * Panel blocks (BIO-74): a box on the page that holds other objects. Things
 * dropped inside belong to it and move with it; panels can sit inside panels.
 *
 * The panel object itself only draws the box: its background, the header
 * strip, title pill or side stripe of its style, and the title. What it holds
 * stays ordinary objects on the page (so every tool keeps working on them),
 * each pointing at its panel with `panelId` (the panel's `figureId`), and
 * stacked above it. FigureCanvas moves the contents along, shows where a
 * dragged object will land, and takes panels apart again (Detach).
 *
 * Resizing never stretches: the panel is laid out again at its new size on
 * every step of the drag (`bakePanelScale`), so the title, header and padding
 * keep their size. Its contents are never scaled with it.
 *
 * The five looks (picked 2026-11-25, all offered): Header bar, Title tab,
 * Soft area, Side stripe and Dashed region. One colour per panel tints the
 * header, the background and the panel's own arrows.
 */
import { FabricText, Group, IText, Path, Point, Rect, classRegistry, util, type FabricObject } from 'fabric'

import { DEFAULT_FONT, fontStack } from './fonts'
import { DEFAULT_LOOK, letterRoom, type LetterLook } from './panel-letters'

export type PanelStyle = 'bar' | 'tab' | 'soft' | 'stripe' | 'dashed'

export type PanelSettings = {
  style: PanelStyle
  /** The panel's one colour, a hex like "#0072b2". */
  colour: string
  /** A deeper wash behind the contents (the Strong presets). */
  strong: boolean
  /** Whether the title shows (the Title row's Shown | Hidden). */
  titleShown: boolean
  title: string
  /** Space between the panel's edge (or header) and what it holds, in page pixels. */
  padding: number
  /** Whether the panel has a letter (A, B…) outside its top-left corner; the slide's letter settings say how it looks (BIO-83). */
  letter: boolean
}

export const PANEL_STYLES: readonly { id: PanelStyle; name: string }[] = [
  { id: 'bar', name: 'Header bar' },
  { id: 'tab', name: 'Title tab' },
  { id: 'soft', name: 'Soft area' },
  { id: 'stripe', name: 'Side stripe' },
  { id: 'dashed', name: 'Dashed region' },
]

export const DEFAULT_PANEL: PanelSettings = { style: 'bar', colour: '#0072b2', strong: false, titleShown: true, title: 'Panel', padding: 14, letter: false }
/** The size of a new panel's box. */
export const NEW_PANEL_SIZE = { width: 240, height: 160 }
export const PADDING_RANGE = { min: 4, max: 32 }

/* ---------- Presets: "Aa" squares, the same in every style ---------- */

export type PanelPreset = { name: string; colour: string; strong: boolean }

/** The app's colour-blind-safe palette (Okabe-Ito + Paul Tol's indigo). */
const PALETTE = [
  { name: 'Blue', hex: '#0072b2' },
  { name: 'Sky', hex: '#56b4e9' },
  { name: 'Teal', hex: '#009e73' },
  { name: 'Yellow', hex: '#d9a400' },
  { name: 'Orange', hex: '#e69f00' },
  { name: 'Vermilion', hex: '#d55e00' },
  { name: 'Purple', hex: '#cc79a7' },
  { name: 'Violet', hex: '#332288' },
] as const

export const LIGHT_PRESETS: readonly PanelPreset[] = PALETTE.map((c) => ({ name: c.name, colour: c.hex, strong: false }))
export const STRONG_PRESETS: readonly PanelPreset[] = PALETTE.map((c) => ({ name: `${c.name}, strong`, colour: c.hex, strong: true }))
export const NEUTRAL_PRESETS: readonly PanelPreset[] = [
  { name: 'Grey', colour: '#71717a', strong: false },
  { name: 'Stone', colour: '#a8a29e', strong: false },
  { name: 'Slate', colour: '#475569', strong: false },
  { name: 'Dark', colour: '#27272a', strong: false },
  { name: 'Grey, strong', colour: '#71717a', strong: true },
  { name: 'Slate, strong', colour: '#475569', strong: true },
]
export const PRESET_GROUPS: readonly { name: string; presets: readonly PanelPreset[] }[] = [
  { name: 'Light', presets: LIGHT_PRESETS },
  { name: 'Strong', presets: STRONG_PRESETS },
  { name: 'Neutral', presets: NEUTRAL_PRESETS },
]
/** The row in the properties panel: eight light ones, then a few strong and neutral (fifteen, and ⋯ makes sixteen). */
export const ROW_PRESETS: readonly PanelPreset[] = [
  ...LIGHT_PRESETS,
  ...STRONG_PRESETS.filter((_, i) => i % 2 === 0),
  ...NEUTRAL_PRESETS.filter((_, i) => i === 0 || i === 3 || i === 4),
]

/* ---------- Colours ---------- */

function channels(hex: string): [number, number, number] {
  const value = /^#?([0-9a-f]{6})$/i.exec(hex.trim())?.[1] ?? '71717a'
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16)) as [number, number, number]
}
const toHex = (parts: number[]) => `#${parts.map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('')}`

/** The colour on white: share 0.1 is a pale wash, 1 the colour itself. */
export function wash(hex: string, share: number): string {
  return toHex(channels(hex).map((c) => 255 - (255 - c) * share))
}
/** A darker shade, for titles written in the colour. */
export function shade(hex: string, keep = 0.62): string {
  return toHex(channels(hex).map((c) => c * keep))
}

/** How a preset square looks: a pale fill, the colour as outline, dark text. */
export function presetLook(preset: Pick<PanelPreset, 'colour' | 'strong'>): { fill: string; outline: string; text: string } {
  return { fill: wash(preset.colour, preset.strong ? 0.4 : 0.15), outline: preset.colour, text: shade(preset.colour, preset.strong ? 0.45 : 0.62) }
}

/* ---------- Layout ---------- */

export type Box = { x: number; y: number; width: number; height: number }

const OUTLINE = 1.5
const STRIPE = 5
const EDGE_GREY = '#d4d4d8'

type TitleLook = { size: number; weight: number; colour: string; upper?: boolean; spacing?: number }

/** Each style's title and corners. */
function styleLook(settings: PanelSettings): { radius: number; title: TitleLook } {
  const c = settings.colour
  switch (settings.style) {
    case 'bar':
      return { radius: 8, title: { size: 12, weight: 600, colour: '#ffffff' } }
    case 'tab':
      return { radius: 8, title: { size: 11, weight: 600, colour: '#ffffff' } }
    case 'soft':
      return { radius: 14, title: { size: 13, weight: 700, colour: shade(c) } }
    case 'stripe':
      return { radius: 6, title: { size: 10, weight: 700, colour: shade(c, 0.85), upper: true, spacing: 80 } }
    case 'dashed':
      return { radius: 12, title: { size: 12, weight: 600, colour: shade(c, 0.85) } }
  }
}

/** The header strip's padding around the title (Header bar), and the pill's (Title tab). */
const BAR_PAD = { x: 10, y: 5 }
const PILL_PAD = { x: 8, y: 2 }
/** The gap between a Dashed region's title and its box. */
const OUTSIDE_GAP = 6

/** Where the panel's parts go, around its box's top-left corner (0, 0). */
export type PanelLayout = {
  /** The header strip (Header bar). */
  header?: Box
  /** The title pill on the top edge (Title tab). */
  pill?: Box
  /** The title's top-left corner. */
  title?: { x: number; y: number }
  /** The space for contents: the box inside its padding, under the header. */
  inner: Box
  /** How far parts stick out above the box (a tab's pill, a dashed region's title). */
  above: number
}

/** Lay a panel out at a box size, for a measured title (undefined when the title is hidden or empty). */
export function panelLayout(settings: PanelSettings, size: { width: number; height: number }, title: { width: number; height: number } | undefined): PanelLayout {
  const p = Math.max(0, settings.padding)
  const left = settings.style === 'stripe' ? p + STRIPE : p
  const box = (top: number): Box => ({ x: left, y: top, width: Math.max(0, size.width - left - p), height: Math.max(0, size.height - top - p) })
  if (!title) return { inner: box(p), above: 0 }
  switch (settings.style) {
    case 'bar': {
      const header = { x: 0, y: 0, width: size.width, height: title.height + 2 * BAR_PAD.y }
      return { header, title: { x: BAR_PAD.x, y: BAR_PAD.y }, inner: box(header.height + p), above: 0 }
    }
    case 'tab': {
      const pill = { x: 12, y: -(title.height / 2 + PILL_PAD.y), width: title.width + 2 * PILL_PAD.x, height: title.height + 2 * PILL_PAD.y }
      return { pill, title: { x: pill.x + PILL_PAD.x, y: pill.y + PILL_PAD.y }, inner: box(pill.y + pill.height + p), above: -pill.y }
    }
    case 'soft':
      return { title: { x: 12, y: 8 }, inner: box(8 + title.height + p * 0.6), above: 0 }
    case 'stripe':
      return { title: { x: STRIPE + 11, y: 8 }, inner: box(8 + title.height + p * 0.6), above: 0 }
    case 'dashed':
      return { title: { x: 4, y: -(title.height + OUTSIDE_GAP) }, inner: box(p), above: title.height + OUTSIDE_GAP }
  }
}

/** The smallest box a panel can be resized to: its header and padding, and a little room. */
export function minimumSize(layout: PanelLayout, settings: PanelSettings): { width: number; height: number } {
  const p = Math.max(0, settings.padding)
  return { width: layout.inner.x + p + 16, height: layout.inner.y + p + 16 }
}

/* ---------- The panel object ---------- */

export class PanelBlock extends Group {
  static type = 'PanelBlock'
  declare panel?: PanelSettings
  declare panelWidth?: number
  declare panelHeight?: number
  /** The text of its letter, worked out for the whole slide (`syncLetters`); none when it has no letter. */
  declare letterText?: string
  /** The weight and size its letter (and a grid's letters) is drawn in, from the slide's settings. */
  declare letterLook?: LetterLook
  /** Its look's parts for a box of this size, the box's back first; a figure grid (grid-block.ts) draws its own. */
  lookParts(settings: PanelSettings, size: { width: number; height: number }): FabricObject[] {
    return panelParts(settings, size, settings.letter && this.letterText ? { text: this.letterText, look: this.letterLook ?? DEFAULT_LOOK } : undefined).parts
  }
}
classRegistry.setClass(PanelBlock)

/** What a panel saves of its own. */
export const PANEL_PROPERTIES = ['panel', 'panelWidth', 'panelHeight', 'panelId', 'letterText', 'letterLook'] as const

export function settingsOf(panel: PanelBlock): PanelSettings {
  return { ...DEFAULT_PANEL, ...panel.panel }
}
export function sizeOf(panel: PanelBlock): { width: number; height: number } {
  return { width: panel.panelWidth ?? NEW_PANEL_SIZE.width, height: panel.panelHeight ?? NEW_PANEL_SIZE.height }
}

/** The panel an object belongs to, by id, or undefined when it's loose on the page. */
export function panelIdOf(object: FabricObject): string | undefined {
  const id = (object as FabricObject & { panelId?: unknown }).panelId
  return typeof id === 'string' && id ? id : undefined
}
export function setPanelId(object: FabricObject, id: string | undefined): void {
  if (id) Object.assign(object, { panelId: id })
  else delete (object as FabricObject & { panelId?: string }).panelId
}

function makeTitle(settings: PanelSettings): FabricText | undefined {
  if (!settings.titleShown || !settings.title.trim()) return undefined
  const look = styleLook(settings).title
  return new FabricText(look.upper ? settings.title.toUpperCase() : settings.title, {
    fontFamily: fontStack(DEFAULT_FONT),
    fontSize: look.size,
    fontWeight: look.weight,
    fill: look.colour,
    charSpacing: look.spacing ?? 0,
    originX: 'left',
    originY: 'top',
  })
}

/** A box path with only its top corners rounded (the header strip) or only its left ones (the side stripe). */
function roundedPath(box: Box, radius: number, corners: 'top' | 'left'): string {
  const { x, y, width: w, height: h } = box
  if (corners === 'top') {
    const r = Math.min(radius, h, w / 2)
    return `M ${x} ${y + h} L ${x} ${y + r} Q ${x} ${y} ${x + r} ${y} L ${x + w - r} ${y} Q ${x + w} ${y} ${x + w} ${y + r} L ${x + w} ${y + h} Z`
  }
  const r = Math.min(radius, w, h / 2)
  return `M ${x + w} ${y} L ${x + r} ${y} Q ${x} ${y} ${x} ${y + r} L ${x} ${y + h - r} Q ${x} ${y + h} ${x + r} ${y + h} L ${x + w} ${y + h} Z`
}

/** The colour behind what a panel holds, in its style; 'transparent' when the page shows through (light Dashed region). */
export function panelFill(settings: PanelSettings): string {
  const c = settings.colour
  const s = settings.strong
  switch (settings.style) {
    case 'bar':
      return wash(c, s ? 0.2 : 0.08)
    case 'tab':
      return s ? wash(c, 0.14) : '#ffffff'
    case 'soft':
      return wash(c, s ? 0.28 : 0.14)
    case 'stripe':
      return s ? wash(c, 0.1) : '#ffffff'
    case 'dashed':
      return s ? wash(c, 0.08) : 'transparent'
  }
}

/** The panel's parts for a box of this size, placed with the box's top-left corner at (0, 0). */
export function panelParts(settings: PanelSettings, size: { width: number; height: number }, letter?: { text: string; look: LetterLook }): { parts: FabricObject[]; layout: PanelLayout } {
  const title = makeTitle(settings)
  const layout = panelLayout(settings, size, title && { width: title.width, height: title.height })
  // The letter sits outside the top-left corner, where grids put theirs (BIO-83).
  const letterPart = letter && new FabricText(letter.text, { left: 0, top: -letterRoom(letter.look.px) + 1, fontFamily: fontStack(DEFAULT_FONT), fontSize: letter.look.px, fontWeight: letter.look.bold ? 700 : 400, fill: '#18181b', strokeWidth: 0, originX: 'left', originY: 'top' })
  // A title that sticks out above the box (Title tab, Dashed region) moves right, past the letter.
  if (letterPart && layout.title && (layout.pill || settings.style === 'dashed')) {
    const shift = Math.max(0, letterPart.width + 6 - (layout.pill?.x ?? layout.title.x))
    if (layout.pill) layout.pill.x += shift
    layout.title.x += shift
  }
  const { radius } = styleLook(settings)
  const c = settings.colour
  const r = Math.min(radius, size.width / 2, size.height / 2)
  const back = new Rect({ left: 0, top: 0, originX: 'left', originY: 'top', width: size.width, height: size.height, rx: r, ry: r, strokeUniform: true, fill: panelFill(settings) })
  switch (settings.style) {
    case 'bar':
    case 'tab':
      back.set({ stroke: c, strokeWidth: OUTLINE })
      break
    case 'soft':
      back.set({ strokeWidth: 0 })
      break
    case 'stripe':
      back.set({ stroke: EDGE_GREY, strokeWidth: 1 })
      break
    case 'dashed':
      back.set({ stroke: c, strokeWidth: OUTLINE, strokeDashArray: [6, 4] })
      break
  }
  const parts: FabricObject[] = [back]
  if (layout.header) parts.push(new Path(roundedPath(layout.header, r, 'top'), { fill: c, strokeWidth: 0 }))
  if (settings.style === 'stripe') parts.push(new Path(roundedPath({ x: 0, y: 0, width: STRIPE, height: size.height }, r, 'left'), { fill: c, strokeWidth: 0 }))
  if (layout.pill) parts.push(new Rect({ left: layout.pill.x, top: layout.pill.y, originX: 'left', originY: 'top', width: layout.pill.width, height: layout.pill.height, rx: layout.pill.height / 2, ry: layout.pill.height / 2, fill: c, strokeWidth: 0 }))
  if (title && layout.title) {
    title.set({ left: layout.title.x, top: layout.title.y })
    parts.push(title)
  }
  // The letter goes last, just outside the top-left corner, where a grid puts its cells' letters (BIO-83).
  if (letterPart) parts.push(letterPart)
  return { parts, layout }
}

/** The panel's box on the page (without a title sticking out above it). Panels are never turned. */
export function bodyOf(panel: PanelBlock): Box {
  const size = sizeOf(panel)
  const back = panel.getObjects()[0]
  if (!back) {
    const rect = panel.getBoundingRect()
    return { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
  }
  // The box's top-left corner (without its outline), from where it sits in the group.
  const matrix = util.multiplyTransformMatrices(panel.calcTransformMatrix(), back.calcOwnMatrix())
  const corner = util.transformPoint(new Point(-back.width / 2, -back.height / 2), matrix)
  return { x: corner.x, y: corner.y, width: size.width * panel.scaleX, height: size.height * panel.scaleY }
}

/** The space for contents on the page: the box inside its padding, under its header. */
export function innerOf(panel: PanelBlock): Box {
  const body = bodyOf(panel)
  const settings = settingsOf(panel)
  const title = makeTitle(settings)
  const { inner } = panelLayout(settings, sizeOf(panel), title && { width: title.width, height: title.height })
  return { x: body.x + inner.x, y: body.y + inner.y, width: inner.width, height: inner.height }
}

/** Put a panel's parts in it again for its settings and box size, keeping the box's top-left corner where it was. */
function refill(panel: PanelBlock, corner: Point): void {
  const parts = panel.lookParts(settingsOf(panel), sizeOf(panel))
  panel.removeAll()
  panel.set({ scaleX: 1, scaleY: 1, angle: 0 })
  panel.add(...parts)
  // The group's box now starts at its top part; move it so the panel's box is at `corner`.
  const body = bodyOf(panel)
  panel.set({ left: panel.left + corner.x - body.x, top: panel.top + corner.y - body.y })
  panel.setCoords()
}

/** A new panel with its box's top-left corner at `corner`. */
export function buildPanel(settings: PanelSettings, size: { width: number; height: number }, corner: { x: number; y: number }): PanelBlock {
  const { parts } = panelParts(settings, size)
  const panel = new PanelBlock(parts, { lockRotation: true })
  Object.assign(panel, { panel: { ...settings }, panelWidth: size.width, panelHeight: size.height })
  panel.setControlVisible('mtr', false)
  const body = bodyOf(panel)
  panel.set({ left: panel.left + corner.x - body.x, top: panel.top + corner.y - body.y })
  panel.setCoords()
  return panel
}

/** Draw a panel's parts again (its letter's text or look changed), its box staying put. */
export function redrawPanel(panel: PanelBlock): void {
  const body = bodyOf(panel)
  refill(panel, new Point(body.x, body.y))
}

/** Change a panel's settings and lay it out again in place (its box stays put). */
export function updatePanel(panel: PanelBlock, change: Partial<PanelSettings>): void {
  const body = bodyOf(panel)
  panel.panel = { ...settingsOf(panel), ...change }
  refill(panel, new Point(body.x, body.y))
}

/**
 * While a panel is resized (and when it is let go): take the stretch into the
 * box's size and lay the panel out again, so the title, header and padding
 * keep their size. The side or corner opposite the handle stays put. The
 * panel stays the same object, so a drag in progress carries on.
 */
export function bakePanelScale(panel: PanelBlock, originX: 'left' | 'center' | 'right' = 'center', originY: 'top' | 'center' | 'bottom' = 'center'): void {
  const { scaleX: sx, scaleY: sy } = panel
  if (sx === 1 && sy === 1) return
  const size = sizeOf(panel)
  const settings = settingsOf(panel)
  const title = makeTitle(settings)
  const smallest = minimumSize(panelLayout(settings, size, title && { width: title.width, height: title.height }), settings)
  // The outline and a title outside the box don't grow: only the box takes the stretch.
  const width = Math.max(smallest.width, panel.width * Math.abs(sx) - (panel.width - size.width))
  const height = Math.max(smallest.height, panel.height * Math.abs(sy) - (panel.height - size.height))
  // The side or corner Fabric holds still while the handle is dragged.
  const pinned = panel.getPointByOrigin(originX, originY)
  panel.panelWidth = width
  panel.panelHeight = height
  const body = bodyOf(panel)
  refill(panel, new Point(body.x, body.y))
  panel.setPositionByOrigin(pinned, originX, originY)
  panel.setCoords()
}

/** Give a panel's box a typed size, keeping its top-left corner where it is. */
export function resizePanel(panel: PanelBlock, size: { width?: number; height?: number }): void {
  const body = bodyOf(panel)
  const settings = settingsOf(panel)
  const title = makeTitle(settings)
  const smallest = minimumSize(panelLayout(settings, sizeOf(panel), title && { width: title.width, height: title.height }), settings)
  panel.panelWidth = Math.max(smallest.width, size.width ?? body.width)
  panel.panelHeight = Math.max(smallest.height, size.height ?? body.height)
  refill(panel, new Point(body.x, body.y))
}

/** Give a panel's box a new place and size on the page (no smaller than its header and padding allow). */
export function setPanelBox(panel: PanelBlock, box: Box): void {
  const settings = settingsOf(panel)
  const title = makeTitle(settings)
  const smallest = minimumSize(panelLayout(settings, sizeOf(panel), title && { width: title.width, height: title.height }), settings)
  panel.panelWidth = Math.max(smallest.width, box.width)
  panel.panelHeight = Math.max(smallest.height, box.height)
  refill(panel, new Point(box.x, box.y))
}

/* ---------- Contents ---------- */

const isPanel = (object: FabricObject): object is PanelBlock => object instanceof PanelBlock
const figureIdOf = (object: FabricObject) => (object as FabricObject & { figureId?: string }).figureId

/**
 * The objects a holder has directly, in stacking order: a panel's contents,
 * or a sequence's steps (BIO-75), which point at it with `panelId` too.
 */
export function contentsOf(panel: FabricObject, objects: readonly FabricObject[]): FabricObject[] {
  const id = figureIdOf(panel)
  return id ? objects.filter((object) => object !== panel && panelIdOf(object) === id) : []
}

/** Everything inside a holder (panel or sequence), what the holders inside it have too, in stacking order. */
export function descendantsOf(panel: FabricObject, objects: readonly FabricObject[]): FabricObject[] {
  const found = new Set<FabricObject>()
  const visit = (holder: FabricObject) => {
    for (const object of contentsOf(holder, objects)) {
      if (found.has(object)) continue
      found.add(object)
      visit(object)
    }
  }
  visit(panel)
  return objects.filter((object) => found.has(object))
}

/** The given objects and everything inside the holders among them, in stacking order. */
export function withDescendants(picked: readonly FabricObject[], objects: readonly FabricObject[]): FabricObject[] {
  const all = new Set(picked)
  for (const object of picked) for (const inside of descendantsOf(object, objects)) all.add(inside)
  return objects.filter((object) => all.has(object))
}

const contains = (box: Box, point: { x: number; y: number }) => point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height

/**
 * The panel a dragged object would land in at this point: the innermost
 * (topmost) panel whose box is under it, leaving out the `skipped` objects
 * (the dragged ones and everything inside them).
 */
export function panelAt(point: { x: number; y: number }, objects: readonly FabricObject[], skipped: ReadonlySet<FabricObject>): PanelBlock | undefined {
  return objects.toReversed().find((object): object is PanelBlock => isPanel(object) && !skipped.has(object) && object.visible && contains(bodyOf(object), point))
}

/* ---------- Detach ---------- */

/**
 * Take a panel apart into plain shapes where its parts are: its box (a
 * rectangle), its header strip, stripe or pill, and its title as a text box
 * that can be typed in. The panel is left empty.
 */
export function detachedShapes(panel: PanelBlock): FabricObject[] {
  const settings = settingsOf(panel)
  const parts = panel.removeAll()
  // A letter is the last part (see panelParts).
  const hasLetter = Boolean(settings.letter && panel.letterText)
  return parts.map((part, index) => {
    if (part instanceof FabricText && hasLetter && index === parts.length - 1) {
      const letter = new IText(part.text, { left: part.left, top: part.top, originX: part.originX, originY: part.originY, fontFamily: part.fontFamily, fontSize: part.fontSize, fontWeight: part.fontWeight, fill: part.fill })
      return Object.assign(letter, { name: `Letter ${part.text}` })
    }
    if (part instanceof FabricText) {
      const text = new IText(settings.style === 'stripe' ? settings.title.toUpperCase() : settings.title, {
        left: part.left,
        top: part.top,
        originX: part.originX,
        originY: part.originY,
        scaleX: part.scaleX,
        scaleY: part.scaleY,
        fontFamily: part.fontFamily,
        fontSize: part.fontSize,
        fontWeight: part.fontWeight,
        fill: part.fill,
        charSpacing: part.charSpacing,
      })
      return Object.assign(text, { name: settings.title.trim() || 'Title' })
    }
    const name = index === 0 ? `${settings.title.trim() || 'Panel'} box` : settings.style === 'stripe' ? 'Stripe' : 'Header'
    return Object.assign(part, { name })
  })
}
