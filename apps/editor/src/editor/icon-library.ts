/**
 * The icon library: every SVG in the repo's icons/ folder with the JSON file
 * next to it (name, keywords, category). In a fresh copy of the public source
 * the folder is empty until `npm run icons` downloads the pack.
 * Vite bundles them at build time, so no server is needed. The small JSON
 * files load with the app; each SVG is a file of its own that loads only when
 * it's needed (a tile scrolls into view, an icon is placed), then stays cached.
 *
 * Icons can come in pencil styles: "<id>-pencil-graphite", "-pencil-shaded"
 * and "-pencil-scribble" next to the clean original. The library lists only
 * the clean icons; the style switch shows each one's pencil version.
 */
import { matchesSearch } from './search'
import { PLACED_SIZE_PX } from './shapes'

export type LibraryIcon = {
  /** Path inside icons/ without the extension, e.g. "cells/animal-cell". */
  id: string
  name: string
  keywords: string[]
  category: string
  /** A rectangle on the icon's 128x128 grid where the user can type text (a bottle's label). */
  textSlot?: TextSlot
}

/** A rectangle in an icon's 128x128 grid units, with the text the icon starts with. */
export type TextSlot = {
  x: number
  y: number
  width: number
  height: number
  /** The text a freshly placed icon starts with (default "Label"). */
  defaultText?: string
  /**
   * How steeply the label slopes, in degrees: its horizontal edges run down to the right by this angle
   * (negative: up to the right), its vertical edges stay vertical. The text is slanted the same way, so it
   * sits on a label seen at an angle. The rectangle is then the label before it was slanted. Default 0.
   */
  skewY?: number
}

type IconMeta = Omit<LibraryIcon, 'id'>

// Each SVG is its own chunk, loaded on first use.
const svgLoaders = import.meta.glob<string>('../../../../icons/**/*.svg', { query: '?raw', import: 'default' })
const metas = import.meta.glob<IconMeta>('../../../../icons/**/*.json', { import: 'default', eager: true })

const PENCIL_SUFFIX = /-pencil-(graphite|shaded|scribble)$/
const idOf = (path: string) => path.replace(/^.*\/icons\//, '').replace(/\.(svg|json)$/, '')
const loaderOf = new Map(Object.entries(svgLoaders).map(([path, load]) => [idOf(path), load]))

/** Every icon, pencil versions included. */
export const allLibraryIcons: LibraryIcon[] = Object.entries(metas)
  .flatMap(([path, meta]) => (loaderOf.has(idOf(path)) ? [{ ...meta, id: idOf(path) }] : []))
  .sort((a, b) => a.name.localeCompare(b.name))

/** The icons the library lists: the clean originals (pencil versions show through the style switch). */
export const libraryIcons: LibraryIcon[] = allLibraryIcons.filter((icon) => !PENCIL_SUFFIX.test(icon.id))

const byId = new Map(allLibraryIcons.map((icon) => [icon.id, icon]))
export const iconById = (id: string) => byId.get(id)

const svgCache = new Map<string, string>()
const svgLoading = new Map<string, Promise<string | undefined>>()

/** An icon's SVG text, loaded once and then cached. Undefined for an id the library doesn't have. */
export function loadIconSvg(id: string): Promise<string | undefined> {
  const cached = svgCache.get(id)
  if (cached !== undefined) return Promise.resolve(cached)
  let loading = svgLoading.get(id)
  if (!loading) {
    const load = loaderOf.get(id)
    loading = load
      ? load().then(
          (svg) => {
            svgCache.set(id, svg)
            return svg
          },
          (error: unknown) => {
            // A failed load (e.g. offline after an update) may be tried again later.
            svgLoading.delete(id)
            throw error
          },
        )
      : Promise.resolve(undefined)
    svgLoading.set(id, loading)
  }
  return loading
}

/** An icon's SVG text if it has already loaded, without waiting. */
export const cachedIconSvg = (id: string) => svgCache.get(id)

// ---------- pencil styles ----------

/** How the library draws icons: clean (as drawn) or one of the pencil styles. */
export type IconStyle = 'clean' | 'graphite' | 'shaded' | 'scribble'
export const ICON_STYLES: readonly IconStyle[] = ['clean', 'graphite', 'shaded', 'scribble']

/** Which style an icon id is drawn in. */
export const styleOf = (iconId: string): IconStyle => (PENCIL_SUFFIX.exec(iconId)?.[1] as IconStyle | undefined) ?? 'clean'

/** The clean icon a pencil version was drawn from (the id itself for a clean icon). */
export const cleanIdOf = (iconId: string) => iconId.replace(PENCIL_SUFFIX, '')

/**
 * The id of an icon in another style, or undefined when it has none. Cells
 * and proteins have one pencil drawing for their flat, outlined and shaded
 * colourings (it would look the same), stored with the flat one.
 */
export function styleVersion(iconId: string, style: IconStyle, has: (id: string) => boolean = (id) => byId.has(id)): string | undefined {
  const clean = cleanIdOf(iconId)
  if (style === 'clean') return has(clean) ? clean : undefined
  const direct = `${clean}-pencil-${style}`
  if (has(direct)) return direct
  const flat = `${clean.replace(/-(outlined|shaded)$/, '-flat')}-pencil-${style}`
  return has(flat) ? flat : undefined
}

/**
 * How big an icon comes onto the page: the side of a square with the same
 * area, in page pixels. Animals (a side-view mouse is about 30 mm wide) are
 * the reference; everything else comes in 20% smaller, since cells, molecules
 * and equipment usually sit around or inside them.
 */
export const placementSize = (icon: Pick<LibraryIcon, 'category'>) => (icon.category === 'animals' ? 74 : PLACED_SIZE_PX)

/** "lab equipment" as "Lab equipment". */
export const categoryTitle = (category: string) => category.charAt(0).toUpperCase() + category.slice(1)

/**
 * The icons that match a search, by category.
 * A search finds icons by name, keyword or category.
 */
export function browseIcons(icons: readonly LibraryIcon[], query: string): { category: string; icons: LibraryIcon[] }[] {
  const byCategory = new Map<string, LibraryIcon[]>()
  for (const icon of icons) {
    if (!matchesSearch(query, [icon.name, icon.category, ...icon.keywords])) continue
    byCategory.set(icon.category, [...(byCategory.get(icon.category) ?? []), icon])
  }
  return [...byCategory]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, icons]) => ({ category, icons }))
}

/**
 * Whether an icon is drawn in a single dark colour (line art for a white page),
 * which would vanish on a dark panel. Only these are flipped light in dark mode;
 * flipping a light or multi-tone icon turns its pale parts dark.
 */
export function isDarkLineArt(svg: string): boolean {
  const colours = new Set(svg.match(/#[0-9a-f]{3,8}\b|(?:rgb|hsl)a?\([^)]*\)/gi)?.map((c) => c.toLowerCase()))
  const [colour] = colours
  const hex = colours.size === 1 ? /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(colour ?? '')?.[1] : undefined
  if (!hex) return false
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex
  const channel = (i: number) => parseInt(full.slice(i, i + 2), 16)
  return 0.299 * channel(0) + 0.587 * channel(2) + 0.114 * channel(4) < 128
}

/**
 * An icon that comes in two versions, with element letters and without (the
 * chemistry molecules: "…-letters" next to the plain one). Undefined for an
 * icon with no such pair.
 */
export function letterVersions(iconId: string, ids: readonly string[] = allLibraryIcons.map((icon) => icon.id)): { letters: boolean; without: string; with: string } | undefined {
  // A pencil version keeps its style suffix last: "…-letters-pencil-shaded" next to "…-pencil-shaded".
  const pencil = PENCIL_SUFFIX.exec(iconId)?.[0] ?? ''
  const base = iconId.slice(0, iconId.length - pencil.length)
  const letters = base.endsWith('-letters')
  const plain = letters ? base.slice(0, -'-letters'.length) : base
  const without = plain + pencil
  const withLetters = `${plain}-letters${pencil}`
  if (!ids.includes(without) || !ids.includes(withLetters)) return undefined
  return { letters, without, with: withLetters }
}

/**
 * An icon that comes in two versions, with the charge signs on its ions and
 * without ("…-unsigned…": the ion channels). The "-unsigned" part sits inside
 * the id, before the style word. Undefined for an icon with no such pair.
 */
export function signVersions(iconId: string, ids: readonly string[] = allLibraryIcons.map((icon) => icon.id)): { signs: boolean; with: string; without: string } | undefined {
  // A pencil version keeps its style suffix last, as in letterVersions.
  const pencil = PENCIL_SUFFIX.exec(iconId)?.[0] ?? ''
  const base = iconId.slice(0, iconId.length - pencil.length)
  const unsigned = /-unsigned(?=-|$)/.test(base)
  if (unsigned) {
    const withSigns = base.replace(/-unsigned(?=-|$)/, '') + pencil
    return ids.includes(withSigns) && ids.includes(iconId) ? { signs: false, with: withSigns, without: iconId } : undefined
  }
  const withSigns = iconId
  // The unsigned twin has "-unsigned" before one of the hyphens, or at the end.
  const stops = [...base.matchAll(/-/g)].map((m) => m.index).concat(base.length)
  const without = stops.map((at) => `${base.slice(0, at)}-unsigned${base.slice(at)}${pencil}`).find((id) => ids.includes(id))
  return without && ids.includes(withSigns) ? { signs: true, with: withSigns, without } : undefined
}

/**
 * The library's icons as the style switch shows them: each in its version
 * in that style; icons without one stay clean.
 * Colourings that share one pencil drawing (a cell's flat, outlined and
 * shaded) show it once.
 */
export function inStyle(icons: readonly LibraryIcon[], style: IconStyle, find: (id: string) => LibraryIcon | undefined = iconById): LibraryIcon[] {
  const seen = new Set<string>()
  return icons.flatMap((icon) => {
    const version = find(styleVersion(icon.id, style, (id) => find(id) !== undefined) ?? icon.id)
    const shown = version ?? icon
    if (seen.has(shown.id)) return []
    seen.add(shown.id)
    return [shown]
  })
}

/**
 * Whether an icon's dark-mode preview needs a white backing. Chemistry
 * structures mix dark bond lines with coloured atoms, so flipping them (as
 * isDarkLineArt icons are) would change the element colours; on a white square
 * they look as they will on the page. Pencil drawings are drawn on paper, so
 * they get the same white square.
 */
export const needsLightBacking = (icon: Pick<LibraryIcon, 'category'> & { id?: string }) =>
  icon.category === 'small molecules' || (icon.id !== undefined && styleOf(icon.id) !== 'clean')

const painted =(paint: unknown): paint is string => typeof paint === 'string' && paint !== '' && paint !== 'none' && paint !== 'transparent'


/** Drag-and-drop data type for an icon dragged from the library; the data is its id. */
export const ICON_DRAG_TYPE = 'application/x-biofigure-icon'

/**
 * How one part of an icon changes when the whole icon gets a new colour:
 * parts that are filled get the new fill, outlined parts the new outline.
 * Empty fills ("none") stay empty, so outlined shapes don't fill in. With
 * `from` (the icon's main colour), each part is tinted (see `tintColour`)
 * instead of painted flat, so a shaded icon keeps its shading.
 */
export function recolourPart(part: { fill?: unknown; stroke?: unknown }, colour: string, from?: string): { fill?: string; stroke?: string } {
  const paint = (old: string) => (from ? tintColour(old, from, colour) : colour)
  return { ...(painted(part.fill) && { fill: paint(part.fill) }), ...(painted(part.stroke) && { stroke: paint(part.stroke) }) }
}

type Rgba = { r: number; g: number; b: number; a: number }
type Hsl = { h: number; s: number; l: number }

/** A CSS colour (#rgb, #rrggbb, rgb() or rgba()) as 0–1 channels; undefined when it can't be read. */
function readColour(colour: string): Rgba | undefined {
  const text = colour.trim().toLowerCase()
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(text)?.[1]
  if (hex) {
    const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex
    const at = (i: number) => parseInt(full.slice(i, i + 2), 16) / 255
    return { r: at(0), g: at(2), b: at(4), a: 1 }
  }
  const rgb = /^rgba?\(([^)]*)\)$/.exec(text)?.[1]?.split(/[\s,/]+/).filter(Boolean).map(Number)
  if (!rgb || rgb.length < 3 || rgb.some((n) => !Number.isFinite(n))) return undefined
  const [r = 0, g = 0, b = 0, a = 1] = rgb
  return { r: r / 255, g: g / 255, b: b / 255, a }
}

function toHsl({ r, g, b }: Rgba): Hsl {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return { h: h / 6, s, l }
}

function fromHsl({ h, s, l }: Hsl, a: number): string {
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const channel = (t: number) => {
    const u = t < 0 ? t + 1 : t > 1 ? t - 1 : t
    const v = u < 1 / 6 ? p + (q - p) * 6 * u : u < 1 / 2 ? q : u < 2 / 3 ? p + (q - p) * (2 / 3 - u) * 6 : p
    return Math.round(v * 255)
  }
  const [r, g, b] = s === 0 ? [l, l, l].map((v) => Math.round(v * 255)) : [channel(h + 1 / 3), channel(h), channel(h - 1 / 3)]
  const hex = `#${[r, g, b].map((v) => (v ?? 0).toString(16).padStart(2, '0')).join('')}`
  return a < 1 ? `rgba(${r}, ${g}, ${b}, ${a})` : hex
}

/**
 * One shade of an icon moved to a new colour: it takes the new colour's hue
 * and saturation, and keeps how much lighter or darker it was than the
 * icon's main colour (`from`), so `from` itself becomes exactly `to` and
 * the shading stays. Colours it can't read are kept as they are.
 */
export function tintColour(colour: string, from: string, to: string): string {
  const own = readColour(colour)
  const base = readColour(from)
  const target = readColour(to)
  if (!own || !base || !target) return colour
  const { l } = toHsl(own)
  const b = toHsl(base).l
  const t = toHsl(target)
  // Each shade stays as much darker or lighter as it was; the difference only shrinks when it would run past black or white.
  const lightness = l <= b ? t.l - (b - l) * Math.min(1, b === 0 ? 1 : t.l / b) : t.l + (l - b) * Math.min(1, b === 1 ? 1 : (1 - t.l) / (1 - b))
  return fromHsl({ h: t.h, s: t.s, l: lightness }, own.a)
}

/**
 * An icon's main colour, for the colour field and as the starting point of
 * a tint: the shade in the middle when all its colours are sorted from dark
 * to light, so a few light details (ears, highlights) don't decide it.
 */
export function mainColour(colours: readonly string[]): string | undefined {
  const readable = colours.flatMap((colour) => {
    const rgba = readColour(colour)
    return rgba ? [{ colour, l: toHsl(rgba).l }] : []
  })
  readable.sort((a, b) => a.l - b.l)
  return readable[Math.floor((readable.length - 1) / 2)]?.colour
}

/**
 * Colours a pencil drawing keeps when it gets a new colour: its white paper,
 * and in Scribble the dark pencil outline (and letters) drawn over the colour.
 * Clean icons keep none.
 */
export function keepsColour(colour: string, iconId: string | undefined): boolean {
  const style = iconId ? styleOf(iconId) : 'clean'
  const c = style === 'clean' ? undefined : readColour(colour)
  if (!c) return false
  if (c.r > 0.97 && c.g > 0.97 && c.b > 0.97) return true
  // #262628, the Scribble outline.
  const near = (value: number, target: number) => Math.abs(value * 255 - target) < 1.5
  return style === 'scribble' && near(c.r, 38) && near(c.g, 38) && near(c.b, 40)
}

/**
 * Whether an icon is drawn in one pencil colour (Graphite and Shaded): a new
 * colour then replaces that pencil colour everywhere, instead of tinting shades.
 */
export const isOnePencilColour = (iconId: string | undefined) => iconId !== undefined && ['graphite', 'shaded'].includes(styleOf(iconId))

/** An icon's main colour (see mainColour), leaving out the colours a pencil drawing keeps. */
export const iconMainColour = (colours: readonly string[], iconId: string | undefined) => mainColour(colours.filter((colour) => !keepsColour(colour, iconId)))

/** How an icon's colours are drawn: as picked (RGB) or in shades of grey. */
export type ColourMode = 'rgb' | 'grey'

/**
 * One colour as a colour mode draws it. Greyscale keeps each shade's
 * brightness (the usual 0.299 / 0.587 / 0.114 weights), so light and dark
 * parts stay apart. Colours it can't read are kept.
 */
export function modeColour(colour: string, mode: ColourMode): string {
  if (mode === 'rgb') return colour
  const own = readColour(colour)
  if (!own) return colour
  return fromHsl({ h: 0, s: 0, l: 0.299 * own.r + 0.587 * own.g + 0.114 * own.b }, own.a)
}
