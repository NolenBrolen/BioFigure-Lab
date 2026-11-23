/*
 * The phone's property bar (BIO-11). The selected object's panel lays out its
 * settings as rows; the bar groups them so it stays short. Every colour
 * setting (colour, fill, outline, cell fill, line colour) and every big
 * picker (shapes, presets, fonts, symbols) keeps its own item;
 * the small ones (size, opacity, corners, alignment...) share one
 * "Properties" item that opens them together. Some rows join a related item
 * instead: Colour mode with Colour, a text's size, weight and style under
 * "Aa" (see TEXT_JOINS), a chart's axes under Axes and its tests
 * under Statistics (and more for charts, see CHART_JOINS). Each item gets a short name and an icon. A shape's
 * Corners and Opacity keep their own Properties sheet rather than joining
 * the Shape picker: that short sheet leaves the shape in view while sliding
 * (tried with Shape and dropped, 2026-11-17).
 */
import type { PropertyBarItem } from '@biofigure-lab/ui/components/mobile-editor/PropertyBar'
import {
  ALargeSmall,
  Asterisk,
  LetterText,
  Captions,
  Brackets,
  ChartColumn,
  Circle,
  Grid3x3,
  Palette,
  PaintBucket,
  Shapes,
  SlidersHorizontal,
  Sigma,
  SquareDashed,
  Table,
  Type,
  Highlighter,
  CaseSensitive,
  Ruler,
  TextCursorInput,
  type LucideIcon,
} from 'lucide-react'

/** A text's size, weight and style (the "Aa" item). Not "Size", which is the plain size (mm) row of other objects. */
const TEXT_SIZE = 'Text size'

/** The item that holds the small settings together. */
export const PROPERTIES = 'Properties'

/** A text's first item: tapping it starts typing in the text, without a sheet (see EditorScreen). */
export const EDIT_TEXT = 'Edit text'

/** Settings with a big picker, which get their own item, and the icons of all items. */
const OWN_ITEM: Record<string, LucideIcon> = {
  [EDIT_TEXT]: TextCursorInput,
  Colour: Palette,
  Colours: Palette,
  'Line colour': Palette,
  Letters: CaseSensitive,
  Shape: Shapes,
  Preset: Palette,
  Fill: PaintBucket,
  Outline: SquareDashed,
  Highlight: Highlighter,
  Font: Type,
  Symbols: Sigma,
  Kind: ChartColumn,
  Data: Table,
  Layout: Grid3x3,
  Look: Circle,
  Bracket: Brackets,
  Axes: Ruler,
  [TEXT_SIZE]: ALargeSmall,
  Statistics: Asterisk,
  Labels: Captions,
}

/**
 * A shape that takes text, on a phone (its panel has a Type text row): the
 * Type text item starts typing in the shape when tapped, without a sheet;
 * then its text settings split up as a text's do (Font, Size, Colour,
 * Highlight, Symbols), with line and letter spacing under Spacing. How the
 * shape and its text fit together (long text, alignment, corners, opacity)
 * is one Layout item (owner's calls, 2026-11-17).
 */
export const TYPE_TEXT = 'Type text'
const SHAPE_LAYOUT = 'Shape layout'
const SHAPE_TEXT_SPACING = 'Text spacing'
const SHAPE_TEXT_JOINS: Record<string, string> = {
  'Long text': SHAPE_LAYOUT,
  Align: SHAPE_LAYOUT,
  Corners: SHAPE_LAYOUT,
  Opacity: SHAPE_LAYOUT,
  'Line spacing': SHAPE_TEXT_SPACING,
  'Letter spacing': SHAPE_TEXT_SPACING,
}
const SHAPE_TEXT_ITEMS: Record<string, { label: string; icon: LucideIcon }> = {
  [TYPE_TEXT]: { label: 'Add text', icon: TextCursorInput },
  [SHAPE_LAYOUT]: { label: 'Layout', icon: SlidersHorizontal },
  [SHAPE_TEXT_SPACING]: { label: 'Spacing', icon: LetterText },
  Colour: { label: 'Text colour', icon: Palette },
}

/** Rows that belong with another setting's item. */
const JOINS: Record<string, string> = {
  'Colour mode': 'Colour',
  Templates: 'Colours',
  'X axis': 'Axes',
  'Y axis': 'Axes',
  Range: 'Axes',
  Unit: 'Axes',
  'Tick labels': 'Axes',
  Test: 'Statistics',
  'Test note': 'Statistics',
  Against: 'Statistics',
  Correction: 'Statistics',
  'Welch’s': 'Statistics',
  'Effect size': 'Statistics',
  'Show ns': 'Statistics',
}

/**
 * Text on a phone (its panel has a "Font size" row): the font list alone under
 * Font; size, weight and style under the "Aa" item; and the rest (alignment,
 * line and letter spacing, opacity) under Layout instead of Properties
 * (owner's call, 2026-11-17).
 */
const TEXT_JOINS: Record<string, string> = {
  'Font size': TEXT_SIZE,
  Weight: TEXT_SIZE,
  Style: TEXT_SIZE,
}
const TEXT_REST = 'Layout'

/**
 * A chart on a phone (its panel has a "Kind" row): error bars with the
 * kind; its name, the text under it and the legend under Labels; the text
 * size with the font. Size and opacity stay under Properties (2026-11-17).
 */
const CHART_JOINS: Record<string, string> = {
  'Error bars': 'Kind',
  'Inside bar': 'Kind',
  Name: 'Labels',
  'Under chart': 'Labels',
  Legend: 'Labels',
  'Text size': 'Font',
  // The Axes sheet's Y axis / X axis tabs and each axis's title.
  Axis: 'Axes',
  Title: 'Axes',
}

/**
 * A table on a phone (its panel has a "Look" row): look, layout, lines and
 * header in one Style sheet; the text size with the font, as Text; alignment
 * and bold first under Properties (owner's calls, 2026-11-17).
 */
const TABLE_JOINS: Record<string, string> = { Look: 'Layout', Lines: 'Layout', Header: 'Layout', 'Text size': 'Font' }
const TABLE_STYLE = 'Style'
const TABLE_TEXT = 'Text'

export type SettingGroup = PropertyBarItem & { rows: string[] }

/** The bar's two sets for a shape that takes text: its own items, and its text's. */
export type BarSet = 'shape' | 'text'

/** A shape's text items (see SHAPE_TEXT_JOINS), which go under its Text button. */
const SHAPE_TEXT_IDS = new Set([TYPE_TEXT, 'Font', TEXT_SIZE, 'Colour', 'Highlight', SHAPE_TEXT_SPACING, 'Symbols'])

/**
 * A shape that takes text starts its bar with a Shape and a Text button, each
 * opening its set of items with Back to return (experiment B), and a Layout
 * item beside them that opens its sheet straight away: how the shape and its
 * text fit together belongs to both (owner's call, 2026-11-17). Undefined for
 * anything else, which keeps one bar.
 */
export function shapeBarSets(groups: readonly SettingGroup[]): (Record<BarSet, SettingGroup[]> & { direct: SettingGroup[] }) | undefined {
  if (!groups.some((group) => group.id === TYPE_TEXT)) return undefined
  const direct = groups.filter((group) => group.id === SHAPE_LAYOUT)
  const rest = groups.filter((group) => group.id !== SHAPE_LAYOUT)
  return { shape: rest.filter((group) => !SHAPE_TEXT_IDS.has(group.id)), text: rest.filter((group) => SHAPE_TEXT_IDS.has(group.id)), direct }
}

/** The Shape and Text buttons that open those sets, with a side arrow saying they open more buttons (option A, picked 2026-11-17). */
export const BAR_SET_ITEMS: readonly PropertyBarItem[] = [
  { id: 'set:shape', label: 'Shape', icon: Shapes, opensItems: true },
  { id: 'set:text', label: 'Text', icon: Type, opensItems: true },
]

/** Any colour setting (Colour, Fill, Outline, Cell fill, Line colour...) always gets its own item. */
const isColour = (name: string) => /colou?r|fill|outline/i.test(name) && !(name in JOINS)

/** A row's name without its unit, e.g. "Size (mm)" → "Size". */
export const shortName = (name: string) => name.replace(/\s*\(.*\)\s*$/, '')

/** The panel's rows grouped for the bar, in the order they first appear, with Properties at the end. */
export function settingGroups(names: readonly string[]): SettingGroup[] {
  const groups: SettingGroup[] = []
  const text = names.includes('Font size')
  const chart = names.includes('Kind')
  const table = names.includes('Look')
  const shape = names.includes(TYPE_TEXT)
  for (const name of names) {
    const short = shortName(name)
    const id = (shape ? (SHAPE_TEXT_JOINS[short] ?? (short === TYPE_TEXT ? TYPE_TEXT : undefined)) : undefined) ?? (text ? TEXT_JOINS[short] : undefined) ?? (chart ? CHART_JOINS[short] : undefined) ?? (table ? TABLE_JOINS[short] : undefined) ?? JOINS[short] ?? (short in OWN_ITEM || isColour(short) ? short : PROPERTIES)
    const group = groups.find((each) => each.id === id)
    if (group) group.rows.push(name)
    else {
      const own = shape ? SHAPE_TEXT_ITEMS[id] : undefined
      groups.push({ id, label: own?.label ?? (id === TEXT_SIZE ? 'Size' : id), icon: own?.icon ?? OWN_ITEM[id] ?? (isColour(id) ? PaintBucket : SlidersHorizontal), rows: [name] })
    }
  }
  // "Properties" (the catch-all) always comes last, after the named settings (owner's call, 2026-11-17).
  const small = groups.findIndex((each) => each.id === PROPERTIES)
  if (small !== -1) groups.push(...groups.splice(small, 1))
  // "Properties" holding a single setting is named after it.
  for (const group of groups) if (group.id === PROPERTIES && group.rows.length === 1) group.label = shortName(group.rows[0] ?? group.label)
  // A text's catch-all holds its alignment and spacing, so it is called Layout.
  const rest = groups.find((each) => each.id === PROPERTIES)
  if (text && !shape && rest && rest.rows.length > 1) rest.label = TEXT_REST
  const style = table && groups.find((each) => each.id === 'Layout')
  if (style && style.rows.length > 1) style.label = TABLE_STYLE
  const words = table && groups.find((each) => each.id === 'Font')
  if (words && words.rows.length > 1) words.label = TABLE_TEXT
  return groups
}
