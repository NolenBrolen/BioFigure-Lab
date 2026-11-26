/**
 * Frame it (BIO-73): an icon with a frame behind it and an optional caption,
 * kept together as one object, a "card". A card is the simplest Block.
 *
 * The card is a group of its own kind holding the frame (and, for the header
 * style, a title strip), the icon itself and the caption. The icon stays a
 * whole library icon inside it, so recolouring, colour mode, swapping and its
 * label text keep working on it unchanged.
 *
 * The frame is laid out around the icon: padding and caption size are page
 * pixels and stay the same when the card is resized. Resizing scales the icon;
 * the card is then built again around it (`buildCard`), which also happens for
 * every change of frame settings. Building is also how a card comes apart
 * again (`takeIconOut`).
 *
 * The five styles (picked 2026-11-24, all offered): soft tile, outlined card,
 * circle badge, chip and header card. Each is a set of the frame settings,
 * which can then be tuned one by one.
 */
import { Group, IText, Path, Point, Rect, classRegistry, type FabricObject } from 'fabric'

import { DEFAULT_FONT, fontStack } from './fonts'
import { applyTextStyle, readTextStyle, type TextStyle } from './text-style'

export type FrameStyle = 'tile' | 'outlined' | 'circle' | 'chip' | 'header'
export type FrameShape = 'rounded' | 'square' | 'circle' | 'pill'
export type CaptionPlace = 'none' | 'below' | 'inside' | 'beside'

export type FrameSettings = {
  /** The style it started from, for the picker; tuning a setting keeps it. */
  style: FrameStyle
  shape: FrameShape
  /** Colours, or null for none. */
  fill: string | null
  outline: string | null
  /** Space between the icon (and caption) and the frame's edge, in page pixels. */
  padding: number
  /** Corner radius of a rounded frame, in page pixels. */
  corners: number
  caption: CaptionPlace
  /** A strip across the top in the outline colour, with the caption in it. */
  header: boolean
  /**
   * An icon put into an empty icon space (BIO-74) keeps that space's box: the
   * frame is at least this big, with the icon centred in it. Resizing it
   * changes this box, and the icon is fitted into it again.
   */
  holder?: { width: number; height: number }
}

/** The frame of an icon that filled an empty icon space: none to see, just the space's box. */
export function holderSettings(holder: { width: number; height: number }): FrameSettings {
  return { style: DEFAULT_FRAME_STYLE, shape: 'rounded', fill: null, outline: null, padding: 0, corners: 8, caption: 'none', header: false, holder }
}

/** A card that only holds an icon in its space's box, with no frame or caption to see. */
export function isBareHolder(settings: FrameSettings, caption: string): boolean {
  return settings.holder !== undefined && !settings.fill && !settings.outline && !settings.header && (settings.caption === 'none' || !caption.trim())
}

/** The size (the side of the square whose area it gets) for an icon to fit inside a box with a margin. */
export function fittingSize(room: { width: number; height: number }, icon: { width: number; height: number }): number {
  const aspect = icon.width > 0 && icon.height > 0 ? icon.width / icon.height : 1
  // An icon `size` across by area is size*sqrt(w/h) wide and size*sqrt(h/w) tall; the tighter side decides.
  return Math.min((room.width * 0.82) / Math.sqrt(aspect), room.height * 0.82 * Math.sqrt(aspect))
}

/** Scale an icon so it fits inside a holder's box. */
function fitInto(icon: Group, holder: { width: number; height: number }): void {
  const area = icon.width * icon.height
  const size = fittingSize(holder, icon)
  const scale = area > 0 ? size / Math.sqrt(area) : size / Math.max(icon.width, icon.height, 1)
  icon.set({ scaleX: scale * Math.sign(icon.scaleX || 1), scaleY: scale * Math.sign(icon.scaleY || 1) })
}

export const FRAME_STYLES: readonly { id: FrameStyle; name: string }[] = [
  { id: 'tile', name: 'Soft tile' },
  { id: 'outlined', name: 'Outlined card' },
  { id: 'circle', name: 'Circle badge' },
  { id: 'chip', name: 'Chip' },
  { id: 'header', name: 'Header card' },
]

/** The style "Add frame" uses. */
export const DEFAULT_FRAME_STYLE: FrameStyle = 'tile'

/** A pale version of a colour, for the frame's fill: 15% of it on white. */
export function tint(hex: string, share = 0.15): string {
  const value = /^#?([0-9a-f]{6})$/i.exec(hex.trim())?.[1]
  if (!value) return '#eef2f6'
  const channel = (i: number) => Math.round(255 - (255 - parseInt(value.slice(i, i + 2), 16)) * share)
  return `#${[0, 2, 4].map((i) => channel(i).toString(16).padStart(2, '0')).join('')}`
}

/** A style's settings, coloured to go with the icon's own main colour. */
export function styleSettings(style: FrameStyle, colour: string): FrameSettings {
  const pale = tint(colour)
  switch (style) {
    case 'tile':
      return { style, shape: 'rounded', fill: pale, outline: null, padding: 12, corners: 12, caption: 'inside', header: false }
    case 'outlined':
      return { style, shape: 'rounded', fill: '#ffffff', outline: colour, padding: 10, corners: 8, caption: 'below', header: false }
    case 'circle':
      return { style, shape: 'circle', fill: pale, outline: null, padding: 10, corners: 0, caption: 'below', header: false }
    case 'chip':
      return { style, shape: 'pill', fill: '#ffffff', outline: colour, padding: 6, corners: 0, caption: 'beside', header: false }
    case 'header':
      return { style, shape: 'rounded', fill: '#ffffff', outline: colour, padding: 10, corners: 8, caption: 'inside', header: true }
  }
}

/* ---------- Layout: where everything goes, in page pixels ---------- */

type Size = { width: number; height: number }
export type Box = { x: number; y: number; width: number; height: number }

export type CardLayout = {
  /** The whole card, the caption under the frame included. */
  width: number
  height: number
  /** The frame, from the card's top-left corner. */
  frame: Box
  /** The title strip of a header card, at the frame's top. */
  header?: Box
  /** The middle of the icon. */
  icon: { x: number; y: number }
  /** The middle of the caption, when it shows. */
  caption?: { x: number; y: number }
}

/** Space between the icon and its caption. */
export const CAPTION_GAP = 4
/** The caption's size and colour. */
export const CAPTION_SIZE = 12
const CAPTION_COLOUR = '#20242a'
/** The header strip's padding around its caption. */
const HEADER_PAD_Y = 4
const HEADER_PAD_X = 8
/** The outline's width. */
const OUTLINE_WIDTH = 1.5

/**
 * Lay a card out around an icon of the given size. `caption` is the measured
 * caption, or undefined for none (an empty caption shows nothing).
 */
export function cardLayout(icon: Size, caption: Size | undefined, settings: FrameSettings): CardLayout {
  const p = Math.max(0, settings.padding)
  const place = caption ? (settings.header ? 'header' : settings.caption) : 'none'
  const cap = caption ?? { width: 0, height: 0 }

  if (place === 'header') {
    const strip = cap.height + 2 * HEADER_PAD_Y
    const width = Math.max(icon.width + 2 * p, cap.width + 2 * HEADER_PAD_X)
    const height = strip + icon.height + 2 * p
    return {
      width,
      height,
      frame: { x: 0, y: 0, width, height },
      header: { x: 0, y: 0, width, height: strip },
      icon: { x: width / 2, y: strip + p + icon.height / 2 },
      caption: { x: width / 2, y: strip / 2 },
    }
  }

  // What sits inside the frame, and where its parts go within it.
  const beside = place === 'beside'
  const inside = place === 'inside'
  const content: Size = beside
    ? { width: icon.width + CAPTION_GAP * 2 + cap.width, height: Math.max(icon.height, cap.height) }
    : inside
      ? { width: Math.max(icon.width, cap.width), height: icon.height + CAPTION_GAP + cap.height }
      : icon

  let frame: Size
  if (settings.shape === 'circle') {
    const side = Math.max(content.width, content.height) + 2 * p
    frame = { width: side, height: side }
  } else if (settings.shape === 'pill') {
    const height = content.height + 2 * p
    // The round ends need room of their own, so nothing touches the curve.
    frame = { width: content.width + 2 * p + height * 0.3, height }
  } else {
    frame = { width: content.width + 2 * p, height: content.height + 2 * p }
  }
  // An icon in a space's box: the frame is at least that box.
  if (settings.holder) frame = { width: Math.max(frame.width, settings.holder.width), height: Math.max(frame.height, settings.holder.height) }

  const below = place === 'below'
  const width = below ? Math.max(frame.width, cap.width) : frame.width
  const height = below ? frame.height + CAPTION_GAP + cap.height : frame.height
  const fx = (width - frame.width) / 2
  const left = fx + (frame.width - content.width) / 2
  const top = (frame.height - content.height) / 2

  const iconAt = beside
    ? { x: left + icon.width / 2, y: frame.height / 2 }
    : inside
      ? { x: width / 2, y: top + icon.height / 2 }
      : { x: width / 2, y: frame.height / 2 }
  const captionAt = beside
    ? { x: left + icon.width + CAPTION_GAP * 2 + cap.width / 2, y: frame.height / 2 }
    : inside
      ? { x: width / 2, y: top + icon.height + CAPTION_GAP + cap.height / 2 }
      : below
        ? { x: width / 2, y: frame.height + CAPTION_GAP + cap.height / 2 }
        : undefined

  return { width, height, frame: { x: fx, y: 0, ...frame }, icon: iconAt, ...(captionAt && { caption: captionAt }) }
}

/* ---------- The card object ---------- */

/** What a card keeps of its own (saved with it). */
/** `cardText`: the caption's look picked in the Text tab (font, size, colour...), over the caption's own defaults. */
type CardProps = { cardFrame?: FrameSettings; cardCaption?: string; cardText?: Partial<TextStyle> }

export class IconCard extends Group {
  static type = 'IconCard'
  declare cardFrame?: FrameSettings
  declare cardCaption?: string
  declare cardText?: Partial<TextStyle>
}
classRegistry.setClass(IconCard)

/** The card's settings and caption, saved with it. */
export const CARD_PROPERTIES = ['cardFrame', 'cardCaption', 'cardText'] as const

/** The icon inside a card: its one part that is a group. */
export function cardIcon(card: IconCard): Group | undefined {
  return card.getObjects().find((part): part is Group => part instanceof Group)
}

export function frameOf(card: IconCard): FrameSettings {
  return card.cardFrame ?? styleSettings(DEFAULT_FRAME_STYLE, '#0072b2')
}

/** The properties a card takes over from the icon it frames, and hands back when the frame goes. */
const HANDED_OVER = ['figureId', 'layerId', 'locked', 'name'] as const

function handOver(from: FabricObject, to: FabricObject): void {
  for (const prop of HANDED_OVER) {
    const value = (from as unknown as Record<string, unknown>)[prop]
    if (value !== undefined) Object.assign(to, { [prop]: value })
    delete (from as unknown as Record<string, unknown>)[prop]
  }
}

/**
 * The caption: a text box that can't be typed in on the page (it is typed in
 * the Text tab), so the text tool's styling works on it as on any text. Its
 * defaults (12 px, medium, centred, dark or white to read on a header strip)
 * come first; the look picked in the Text tab goes over them.
 */
function makeCaption(text: string, light: boolean, look: Partial<TextStyle> = {}): IText {
  const caption = new IText(text, {
    fontFamily: fontStack(DEFAULT_FONT),
    fontSize: CAPTION_SIZE,
    fontWeight: 500,
    fill: light ? '#ffffff' : CAPTION_COLOUR,
    textAlign: 'center',
    originX: 'center',
    originY: 'center',
    editable: false,
  })
  if (Object.keys(look).length > 0) applyTextStyle(caption, look)
  return caption
}

/** The caption's whole look as the Text tab shows it, also when there is no caption text yet. */
export function captionStyle(card: IconCard): TextStyle {
  const settings = frameOf(card)
  const caption = card.getObjects().find((part): part is IText => part instanceof IText) ?? makeCaption('Aa', settings.header && whiteReads(settings.outline ?? HEADER_GREY), card.cardText)
  return readTextStyle(caption)
}

/** The caption text box in a card, if it shows one. */
export function cardCaptionText(card: IconCard): IText | undefined {
  return card.getObjects().find((part): part is IText => part instanceof IText)
}

/** The header strip's colour when the frame has no outline. */
const HEADER_GREY = '#71717a'

/** Whether white text reads better than black on this colour (the higher contrast of the two). */
export function whiteReads(hex: string): boolean {
  const value = /^#?([0-9a-f]{6})$/i.exec(hex.trim())?.[1]
  if (!value) return true
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(value.slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  const light = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return 1.05 / (light + 0.05) >= (light + 0.05) / 0.05
}

/** A path for a box with only its top corners rounded: the header strip. */
function topRounded(box: Box, radius: number): string {
  const r = Math.min(radius, box.height, box.width / 2)
  const { x, y, width: w, height: h } = box
  return `M ${x} ${y + h} L ${x} ${y + r} Q ${x} ${y} ${x + r} ${y} L ${x + w - r} ${y} Q ${x + w} ${y} ${x + w} ${y + r} L ${x + w} ${y + h} Z`
}

/**
 * Put an icon in a card with these settings and caption. The icon must be
 * loose (on no canvas and in no group); the card takes its middle and turn.
 */
export function buildCard(icon: Group, settings: FrameSettings, caption: string, look?: Partial<TextStyle>): IconCard {
  const middle = icon.getCenterPoint()
  const angle = icon.angle
  icon.set({ angle: 0 })
  const iconSize = { width: icon.getScaledWidth(), height: icon.getScaledHeight() }
  const text = caption.trim() ? makeCaption(caption, settings.header && whiteReads(settings.outline ?? HEADER_GREY), look) : undefined
  const layout = cardLayout(iconSize, text && { width: text.width, height: text.height }, settings)

  // Everything is placed around (0, 0), the card's middle, then the card is moved and turned.
  const at = (x: number, y: number) => new Point(x - layout.width / 2, y - layout.height / 2)
  const { frame } = layout
  const radius = settings.shape === 'circle' || settings.shape === 'pill' ? frame.height / 2 : settings.shape === 'square' ? 0 : Math.min(settings.corners, frame.width / 2, frame.height / 2)
  const back = new Rect({
    left: frame.x - layout.width / 2 + frame.width / 2,
    top: frame.y - layout.height / 2 + frame.height / 2,
    originX: 'center',
    originY: 'center',
    width: frame.width,
    height: frame.height,
    rx: radius,
    ry: radius,
    fill: settings.fill ?? 'transparent',
    stroke: settings.outline ?? undefined,
    strokeWidth: settings.outline ? OUTLINE_WIDTH : 0,
    strokeUniform: true,
  })
  const parts: FabricObject[] = [back]
  if (layout.header) {
    const strip = { ...layout.header, x: layout.header.x - layout.width / 2, y: layout.header.y - layout.height / 2 }
    parts.push(new Path(topRounded(strip, radius), { fill: settings.outline ?? HEADER_GREY, strokeWidth: 0 }))
  }
  icon.setPositionByOrigin(at(layout.icon.x, layout.icon.y), 'center', 'center')
  icon.setCoords()
  parts.push(icon)
  if (text && layout.caption) {
    text.setPositionByOrigin(at(layout.caption.x, layout.caption.y), 'center', 'center')
    parts.push(text)
  }

  const card = new IconCard(parts)
  Object.assign(card, { cardFrame: settings, cardCaption: caption, cardText: look } satisfies CardProps)
  card.setPositionByOrigin(middle, 'center', 'center')
  if (angle) card.rotate(angle)
  card.setCoords()
  return card
}

/**
 * Take the icon out of a card, loose again where it is on the page (the
 * card's turn and any stretch of it now on the icon itself).
 */
export function takeIconOut(card: IconCard): Group | undefined {
  const icon = cardIcon(card)
  if (!icon) return undefined
  card.remove(icon)
  icon.setCoords()
  return icon
}

/** Frame a loose icon: the card takes over its id, layer, lock and name. */
export function frameIcon(icon: Group, settings: FrameSettings, caption: string): IconCard {
  const opacity = icon.opacity
  const holder = {} as FabricObject
  handOver(icon, holder)
  icon.set({ opacity: 1 })
  const card = buildCard(icon, settings, caption)
  handOver(holder, card)
  card.set({ opacity })
  return card
}

/** Build a card again with new settings or caption (or after a resize), keeping what it holds of its own. */
export function rebuildCard(card: IconCard, change: { settings?: FrameSettings; caption?: string; text?: Partial<TextStyle> } = {}): IconCard | undefined {
  const opacity = card.opacity
  const settings = change.settings ?? frameOf(card)
  const caption = change.caption ?? card.cardCaption ?? ''
  const look = change.text ?? card.cardText
  const icon = takeIconOut(card)
  if (!icon) return undefined
  const next = buildCard(icon, settings, caption, look)
  handOver(card, next)
  next.set({ opacity })
  return next
}

/**
 * While a card is being resized (and when it is let go): lay it out again in
 * place, so the caption and padding keep their size instead of stretching.
 * The icon grows evenly, by the side being dragged (a corner: whichever way
 * moved more), so it never gets squashed. The point at `originX`/`originY`
 * (the side or corner opposite the handle) stays where it is. The card stays
 * the same object, so a drag in progress carries on.
 */
export function bakeCardScale(card: IconCard, originX: 'left' | 'center' | 'right', originY: 'top' | 'center' | 'bottom', handle?: string): void {
  const { scaleX: sx, scaleY: sy } = card
  if (sx === 1 && sy === 1) return
  layOutInPlace(card, originX, originY, handle)
}

/** Lay a card out again where it is, e.g. once its caption's font has loaded and measures differently. */
export function relayoutCard(card: IconCard): void {
  layOutInPlace(card, 'center', 'center')
}

function layOutInPlace(card: IconCard, originX: 'left' | 'center' | 'right', originY: 'top' | 'center' | 'bottom', handle?: string): void {
  const holder = frameOf(card).holder
  if (holder) return layOutHolder(card, holder, originX, originY)
  const { scaleX: sx, scaleY: sy } = card
  const scale = handle === 'ml' || handle === 'mr' ? sx : handle === 'mt' || handle === 'mb' ? sy : Math.abs(sx - 1) >= Math.abs(sy - 1) ? sx : sy
  const angle = card.angle
  const pinnedBefore = card.getPointByOrigin(originX, originY)
  // Turned straight and evenly scaled first, so the icon comes out upright and unsquashed.
  card.set({ scaleX: scale, scaleY: scale })
  card.rotate(0)
  card.setPositionByOrigin(card.getCenterPoint(), 'center', 'center')
  const icon = takeIconOut(card)
  if (!icon) return
  card.removeAll()
  const fresh = buildCard(icon, frameOf(card), card.cardCaption ?? '', card.cardText)
  const parts = fresh.removeAll()
  card.set({ scaleX: 1, scaleY: 1 })
  card.add(...parts)
  card.rotate(angle)
  card.setPositionByOrigin(pinnedBefore, originX, originY)
  card.setCoords()
}

/**
 * Resizing an icon in a space's box: the box takes the stretch (each way on
 * its own, like an empty space), and the icon is fitted into it again,
 * centred and unsquashed. The side opposite the handle stays put.
 */
function layOutHolder(card: IconCard, holder: { width: number; height: number }, originX: 'left' | 'center' | 'right', originY: 'top' | 'center' | 'bottom'): void {
  const pinned = card.getPointByOrigin(originX, originY)
  const next = { width: Math.max(HOLDER_SMALLEST, holder.width * Math.abs(card.scaleX)), height: Math.max(HOLDER_SMALLEST, holder.height * Math.abs(card.scaleY)) }
  const angle = card.angle
  card.set({ scaleX: 1, scaleY: 1 })
  card.rotate(0)
  card.setPositionByOrigin(card.getCenterPoint(), 'center', 'center')
  const icon = takeIconOut(card)
  if (!icon) return
  fitInto(icon, next)
  card.cardFrame = { ...frameOf(card), holder: next }
  card.removeAll()
  const fresh = buildCard(icon, frameOf(card), card.cardCaption ?? '', card.cardText)
  card.add(...fresh.removeAll())
  card.rotate(angle)
  card.setPositionByOrigin(pinned, originX, originY)
  card.setCoords()
}

/**
 * An icon in a space's box, inside a selection of several that is being
 * resized: the box takes `holder` (already stretched) and the card undoes the
 * selection's stretch on itself, so the icon is fitted in again and never
 * stretched, while dragging or after. Its middle stays where the selection puts it.
 */
export function sizeHolderInSelection(card: IconCard, holder: { width: number; height: number }, stretch: { x: number; y: number }): void {
  const middle = card.getRelativeCenterPoint()
  const next = { width: Math.max(HOLDER_SMALLEST, holder.width), height: Math.max(HOLDER_SMALLEST, holder.height) }
  // Rebuilt as if on its own: the icon taken out and put back inside the stretched selection would take on its stretch.
  const parent = card.group
  card.group = undefined
  card.set({ scaleX: 1, scaleY: 1, angle: 0 })
  const icon = takeIconOut(card)
  if (!icon) {
    card.group = parent
    return
  }
  fitInto(icon, next)
  card.cardFrame = { ...frameOf(card), holder: next }
  card.removeAll()
  const fresh = buildCard(icon, frameOf(card), card.cardCaption ?? '', card.cardText)
  card.add(...fresh.removeAll())
  card.set({ scaleX: 1 / stretch.x, scaleY: 1 / stretch.y })
  card.group = parent
  card.setPositionByOrigin(middle, 'center', 'center')
  card.setCoords()
}

/** The smallest an icon's space box gets. */
const HOLDER_SMALLEST = 28

/** An icon put into a space's box, fitted and centred in it, the box's middle at `middle`. */
export function holdIcon(icon: Group, holder: { width: number; height: number }, middle: { x: number; y: number }): IconCard {
  fitInto(icon, holder)
  icon.setPositionByOrigin(new Point(middle.x, middle.y), 'center', 'center')
  return frameIcon(icon, holderSettings(holder), '')
}

/** A card with another icon in the same place (swapping the icon for another version): same frame, caption and settings. */
export function replaceCardIcon(card: IconCard, icon: Group): IconCard {
  const opacity = card.opacity
  icon.set({ angle: card.angle })
  icon.setPositionByOrigin(card.getCenterPoint(), 'center', 'center')
  const next = buildCard(icon, frameOf(card), card.cardCaption ?? '', card.cardText)
  handOver(card, next)
  next.set({ opacity })
  return next
}

/** A held icon (in a space's box) swapped for another icon: fitted into the same box, same frame and caption. */
export function swapHeldIcon(card: IconCard, icon: Group): IconCard {
  const holder = frameOf(card).holder
  if (holder) fitInto(icon, holder)
  return replaceCardIcon(card, icon)
}

/** Take the frame away: the icon is loose again and takes back the card's id, layer, lock, name and opacity. */
export function unframe(card: IconCard): Group | undefined {
  const opacity = card.opacity
  const icon = takeIconOut(card)
  if (!icon) return undefined
  handOver(card, icon)
  icon.set({ opacity })
  return icon
}
