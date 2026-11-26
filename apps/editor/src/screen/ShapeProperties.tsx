/*
 * The properties under the shape tiles in the Shapes panel (design A, label-
 * left rows, with the Shape / Text tabs of design F; tried 2026-11-12 next
 * to design G3). They always show: with a shape selected they change it, and
 * with nothing selected they set the look of the next shape. Either way the
 * next shape takes what was set last, so nothing resets after placing a shape.
 *
 * Shape tab, one row per setting with its label on the left: bracket style
 * (brackets only), which shape it is (closed shapes), how round its corners
 * are (shapes with straight sides), presets, fill, outline colour and width,
 * and opacity. Text tab: the text settings in the same rows, then what
 * happens when text gets long (moved here from the Shape tab, 2026-11-14).
 * They always work: before any text is typed, and with nothing selected (then
 * they set the next shape's text). Brackets take text too, beside them. Lines
 * and membranes take no text, so the tab is greyed out for them. Opening the
 * Text tab by hand with a shape selected starts typing in it.
 */
import { ColourInput } from '@biofigure-lab/ui/components/colour-input/ColourInput'
import { Popover } from '@biofigure-lab/ui/components/popover/Popover'
import { SegmentedToggle } from '@biofigure-lab/ui/components/segmented-toggle/SegmentedToggle'
import { ShapePicture } from '@biofigure-lab/ui/components/shapes-panel/ShapesPanel'
import { Tabs, TabsPanel } from '@biofigure-lab/ui/components/tabs/Tabs'
import { useExpandedControls } from '@biofigure-lab/ui/lib/expanded-controls'
import { BRACKETS, CORNER_SHAPES, CURLY_BRACKETS, DOUBLE_BRACKETS, OPEN_SHAPES, SHAPES, bracketKind, defaultCornerRadius, type ShapeKind } from '@biofigure-lab/ui/lib/arrow-geometry'
import { Button } from '@biofigure-lab/ui/components/button/Button'
import { ALargeSmall, Braces, Brackets, Ellipsis, Scaling, TextCursorInput, WrapText } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { toHex } from '../editor/colour'
import { TYPE_TEXT } from './mobile-props'
import { usePanelTab } from './panel-tab'
import type { SelectionInfo } from '../editor/FigureCanvas'
import type { TextFit } from '../editor/shape-text'
import { clickSize, type ShapeStyle } from '../editor/shapes'
import { NumberOrSlider, OpacityRow, OptionPicker, popupAlignOffset, PropRow, PropRows, type PickerOption } from './properties-pane'

export type ShapePropertiesProps = {
  /** The selected shape; without one the properties are those of the next shape. */
  shape?: SelectionInfo
  /** The shape the Shapes panel draws next, and the look it gets. */
  next: { shape: ShapeKind; style: ShapeStyle }
  onStyle: (patch: Partial<Omit<ShapeStyle, 'size' | 'textFit'>>) => void
  onTextFit: (fit: TextFit) => void
  /** A preset's text colour, for the selected shape's text and the next shape's. */
  onTextColour: (colour: string) => void
  onBracketStyle: (kind: ShapeKind) => void
  /** Another shape: the selected one becomes it, or the next shape is it. */
  onShapeKind: (kind: ShapeKind) => void
  /** How round the corners are, in page pixels. */
  onCornerRadius: (radius: number) => void
  /** The colours already in the figure, for the swatch dropdowns. */
  usedColours?: () => readonly string[]
  /** The text settings. */
  textControls?: ReactNode
  /** The Text tab was opened by hand: start typing in the selected shape. */
  onTextTab?: () => void
  /** Phones: the Type text button was tapped; start typing in the selected shape within the tap, so the keyboard opens. */
  onTypeText?: () => void
}

const BRACKET_STYLES = [
  { value: 'square', icon: Brackets, label: 'Square' },
  { value: 'curly', icon: Braces, label: 'Curly' },
] as const

const TEXT_FITS = [
  { value: 'shrink', icon: ALargeSmall, label: 'Shrink' },
  { value: 'grow', icon: Scaling, label: 'Grow' },
  { value: 'wrap', icon: WrapText, label: 'Wrap' },
] as const

export type Preset = { name: string; fill: string; stroke: string; text: string }

/**
 * Ready-made looks, each a fill, an outline and a text colour that go
 * together. Every colour is colour-blind friendly: no pure red or green,
 * which most colour-blind readers can't tell apart. The 16 colours are the
 * Okabe-Ito ones plus Paul Tol's indigo as violet (like the swatch palette),
 * Paul Tol's rose, wine, magenta, pink, sand, olive and steel blue, and a
 * brown. The text on every preset is readable on its fill (contrast 4.5:1 or
 * more).
 *
 * Four looks per colour, one group each in the popup (two rows of 8, sorted
 * round the colour wheel: warm to cool, then blue round to pink):
 *   Light   - a pale fill (70% white), the colour as outline, dark text
 *   Bold    - the colour itself as fill, a darker outline
 *   Dark    - a deep shade of the colour as fill, white text
 *   Outline - white fill, the colour as outline and text
 * then the neutral ones. Five light ones show in the row (ROW_NAMES).
 */
export const PRESET_GROUPS: readonly { name: string; presets: readonly Preset[] }[] = [
  {
    name: 'Light',
    presets: [
      { name: 'Vermilion', fill: '#f2cfb2', stroke: '#d55e00', text: '#8a3d00' },
      { name: 'Orange', fill: '#f8e2b2', stroke: '#e69f00', text: '#7f5700' },
      { name: 'Brown', fill: '#e0d1c2', stroke: '#996633', text: '#6b4724' },
      { name: 'Sand', fill: '#f5f0d6', stroke: '#ddcc77', text: '#6e663c' },
      { name: 'Yellow', fill: '#fbf7c6', stroke: '#f0e442', text: '#6c671e' },
      { name: 'Olive', fill: '#e0e0c2', stroke: '#999933', text: '#5c5c1f' },
      { name: 'Teal', fill: '#b2e2d5', stroke: '#009e73', text: '#005f45' },
      { name: 'Sky', fill: '#cce8f8', stroke: '#56b4e9', text: '#2f6380' },
      { name: 'Blue', fill: '#b2d5e8', stroke: '#0072b2', text: '#00507d' },
      { name: 'Steel', fill: '#c7d6e5', stroke: '#4477aa', text: '#305377' },
      { name: 'Violet', fill: '#c2bddb', stroke: '#332288', text: '#24185f' },
      { name: 'Purple', fill: '#f0d7e5', stroke: '#cc79a7', text: '#7a4964' },
      { name: 'Wine', fill: '#dbbdcc', stroke: '#882255', text: '#5f183b' },
      { name: 'Magenta', fill: '#fac2d6', stroke: '#ee3377', text: '#9b214d' },
      { name: 'Rose', fill: '#f0d1d6', stroke: '#cc6677', text: '#85424d' },
      { name: 'Pink', fill: '#ffe5eb', stroke: '#ffaabb', text: '#80555e' },
    ],
  },
  {
    name: 'Bold',
    presets: [
      { name: 'Vermilion, bold', fill: '#d55e00', stroke: '#8a3d00', text: '#2b1300' },
      { name: 'Orange, bold', fill: '#e69f00', stroke: '#966700', text: '#503800' },
      { name: 'Brown, bold', fill: '#996633', stroke: '#634221', text: '#ffffff' },
      { name: 'Sand, bold', fill: '#ddcc77', stroke: '#90854d', text: '#585230' },
      { name: 'Yellow, bold', fill: '#f0e442', stroke: '#9c942b', text: '#605b1a' },
      { name: 'Olive, bold', fill: '#999933', stroke: '#636321', text: '#2e2e0f' },
      { name: 'Teal, bold', fill: '#009e73', stroke: '#00674b', text: '#00271d' },
      { name: 'Sky, bold', fill: '#56b4e9', stroke: '#387597', text: '#1e3f52' },
      { name: 'Blue, bold', fill: '#0072b2', stroke: '#004a74', text: '#ffffff' },
      { name: 'Steel, bold', fill: '#4477aa', stroke: '#2c4d6e', text: '#ffffff' },
      { name: 'Violet, bold', fill: '#332288', stroke: '#211658', text: '#ffffff' },
      { name: 'Purple, bold', fill: '#cc79a7', stroke: '#854f6d', text: '#3d2432' },
      { name: 'Wine, bold', fill: '#882255', stroke: '#581637', text: '#ffffff' },
      { name: 'Magenta, bold', fill: '#ee3377', stroke: '#9b214d', text: '#300a18' },
      { name: 'Rose, bold', fill: '#cc6677', stroke: '#85424d', text: '#291418' },
      { name: 'Pink, bold', fill: '#ffaabb', stroke: '#a66e7a', text: '#66444b' },
    ],
  },
  {
    name: 'Dark',
    presets: [
      { name: 'Vermilion, dark', fill: '#6a2f00', stroke: '#401c00', text: '#ffffff' },
      { name: 'Orange, dark', fill: '#735000', stroke: '#453000', text: '#ffffff' },
      { name: 'Brown, dark', fill: '#4c331a', stroke: '#2e1f0f', text: '#ffffff' },
      { name: 'Sand, dark', fill: '#6e663c', stroke: '#423d24', text: '#ffffff' },
      { name: 'Yellow, dark', fill: '#787221', stroke: '#484414', text: '#ffffff' },
      { name: 'Olive, dark', fill: '#4c4c1a', stroke: '#2e2e0f', text: '#ffffff' },
      { name: 'Teal, dark', fill: '#004f3a', stroke: '#002f23', text: '#ffffff' },
      { name: 'Sky, dark', fill: '#2b5a74', stroke: '#1a3646', text: '#ffffff' },
      { name: 'Blue, dark', fill: '#003959', stroke: '#002235', text: '#ffffff' },
      { name: 'Steel, dark', fill: '#223c55', stroke: '#142433', text: '#ffffff' },
      { name: 'Violet, dark', fill: '#24185f', stroke: '#000000', text: '#ffffff' },
      { name: 'Purple, dark', fill: '#663c54', stroke: '#3d2432', text: '#ffffff' },
      { name: 'Wine, dark', fill: '#44112a', stroke: '#290a1a', text: '#ffffff' },
      { name: 'Magenta, dark', fill: '#771a3c', stroke: '#470f24', text: '#ffffff' },
      { name: 'Rose, dark', fill: '#66333c', stroke: '#3d1f24', text: '#ffffff' },
      { name: 'Pink, dark', fill: '#80555e', stroke: '#4d3338', text: '#ffffff' },
    ],
  },
  {
    name: 'Outline',
    presets: [
      { name: 'Vermilion, outline', fill: '#ffffff', stroke: '#d55e00', text: '#954200' },
      { name: 'Orange, outline', fill: '#ffffff', stroke: '#e69f00', text: '#966700' },
      { name: 'Brown, outline', fill: '#ffffff', stroke: '#996633', text: '#6b4724' },
      { name: 'Sand, outline', fill: '#ffffff', stroke: '#ddcc77', text: '#7a7041' },
      { name: 'Yellow, outline', fill: '#ffffff', stroke: '#f0e442', text: '#787221' },
      { name: 'Olive, outline', fill: '#ffffff', stroke: '#999933', text: '#6b6b24' },
      { name: 'Teal, outline', fill: '#ffffff', stroke: '#009e73', text: '#006f50' },
      { name: 'Sky, outline', fill: '#ffffff', stroke: '#56b4e9', text: '#387597' },
      { name: 'Blue, outline', fill: '#ffffff', stroke: '#0072b2', text: '#00507d' },
      { name: 'Steel, outline', fill: '#ffffff', stroke: '#4477aa', text: '#305377' },
      { name: 'Violet, outline', fill: '#ffffff', stroke: '#332288', text: '#24185f' },
      { name: 'Purple, outline', fill: '#ffffff', stroke: '#cc79a7', text: '#8f5575' },
      { name: 'Wine, outline', fill: '#ffffff', stroke: '#882255', text: '#5f183b' },
      { name: 'Magenta, outline', fill: '#ffffff', stroke: '#ee3377', text: '#a72453' },
      { name: 'Rose, outline', fill: '#ffffff', stroke: '#cc6677', text: '#8f4753' },
      { name: 'Pink, outline', fill: '#ffffff', stroke: '#ffaabb', text: '#996670' },
    ],
  },
  {
    name: 'Neutral',
    presets: [
      { name: 'Grey', fill: '#e2e8f0', stroke: '#94a3b8', text: '#334155' },
      { name: 'Stone', fill: '#e7e5e4', stroke: '#a8a29e', text: '#44403c' },
      { name: 'White', fill: '#ffffff', stroke: '#a1a1aa', text: '#18181b' },
      { name: 'Dark', fill: '#52525b', stroke: '#27272a', text: '#ffffff' },
      { name: 'Black', fill: '#18181b', stroke: '#000000', text: '#ffffff' },
      { name: 'Outline only', fill: '', stroke: '#3f3f46', text: '#3f3f46' },
    ],
  },
]
/** The five light presets shown in the row, in this order (the popup has them all, sorted by colour). */
const ROW_NAMES = ['Blue', 'Orange', 'Purple', 'Yellow', 'Sky']
const ROW_PRESETS: readonly Preset[] = presetsNamed(ROW_NAMES)

/** The presets with these names, in this order. */
function presetsNamed(names: readonly string[]): Preset[] {
  return names.flatMap((name) => PRESET_GROUPS.flatMap((group) => group.presets).find((preset) => preset.name === name) ?? [])
}

/** How a preset square is drawn: its fill (none when empty), outline and the colour of its "Aa". */
export type SwatchLook = { fill: string; stroke: string; text: string }

/** One shape preset's square (also the quick widgets'). `open`: only the outline (for lines). */
export function PresetSwatch({ preset, on, open, onPick }: { preset: Preset; on: boolean; open: boolean; onPick: (preset: Preset) => void }) {
  return <LookSwatch preset={preset} look={preset} on={on} blank={open} onPick={onPick} />
}

/** One preset of any kind (shapes, frames, panels): its fill and outline, with "Aa" in its text colour. `blank`: only the outline (for lines). */
export function LookSwatch<P extends { name: string }>({ preset, look, on, blank, onPick }: { preset: P; look: SwatchLook; on: boolean; blank: boolean; onPick: (preset: P) => void }) {
  return (
    <button
      type="button"
      title={preset.name}
      aria-label={`${preset.name} preset`}
      aria-pressed={on}
      onClick={() => onPick(preset)}
      className={`grid aspect-square place-items-center rounded-md border-2 text-xs leading-none font-semibold tracking-tight outline-offset-2 transition-transform duration-(--duration-instant) hover:scale-105 focus-visible:outline-2 focus-visible:outline-ring ${on ? 'outline-2 outline-foreground' : ''}`}
      style={{ background: blank || !look.fill ? 'transparent' : look.fill, borderColor: look.stroke, color: look.text }}
    >
      {blank ? null : 'Aa'}
    </button>
  )
}

export type PresetPickerProps<P extends { name: string }> = {
  /** Every preset, in named groups, for the ⋯ popup (and a phone's sheet). */
  groups: readonly { name: string; presets: readonly P[] }[]
  /** The presets in the row. */
  row: readonly P[]
  /** How each preset's square looks. */
  look: (preset: P) => SwatchLook
  /** Whether a preset is the one in use (it gets a ring). */
  isOn: (preset: P) => boolean
  onPick: (preset: P) => void
  /** Only outlines, no fill or "Aa" (lines). */
  blank?: boolean
  /** Columns in the row, the ⋯ button included. */
  columns?: number
  /** Fine-tuning controls shown at the top of the popup, above all the presets. */
  custom?: ReactNode
  /** The heading over `custom`. */
  customLabel?: string
}

/**
 * The preset row: the first few presets and a button that opens them all to
 * its right. Any kind of preset: shapes and icon frames use a fill, outline
 * and text colour each (`Presets` below), panels one colour (PanelProperties).
 */
export function PresetPicker<P extends { name: string }>({ groups, row, look, isOn, onPick, blank = false, columns = 6, custom, customLabel = 'Custom' }: PresetPickerProps<P>) {
  const expanded = useExpandedControls()
  const all = (
    <div className="flex flex-col gap-2">
      {custom && (
        <div role="group" aria-label={customLabel} className="mb-1 flex flex-col gap-2 border-b border-border pb-3">
          <span className="text-xs text-muted-foreground">{customLabel}</span>
          {custom}
        </div>
      )}
      {groups.map((group) => (
        <div key={group.name} role="group" aria-label={group.name} className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{group.name}</span>
          <div className="grid grid-cols-8 gap-1">
            {group.presets.map((preset) => (
              <LookSwatch key={preset.name} preset={preset} look={look(preset)} on={isOn(preset)} blank={blank} onPick={onPick} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
  // The phone's sheet with only presets open shows them all, without the short row and ⋯ button.
  if (expanded) return <div className="min-w-0 flex-1">{all}</div>
  return (
    <div className="grid flex-1 gap-1" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {row.map((preset) => (
        <LookSwatch key={preset.name} preset={preset} look={look(preset)} on={isOn(preset)} blank={blank} onPick={onPick} />
      ))}
      <Popover
        title="Presets"
        side="right"
        align="start"
        alignOffset={popupAlignOffset}
        divider={false}
        className="w-80"
        trigger={
          <button
            type="button"
            aria-label="More presets"
            title="More presets"
            className="grid aspect-square place-items-center rounded-md border border-input-border text-muted-foreground transition-colors duration-(--duration-instant) hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            <Ellipsis className="size-4" aria-hidden="true" />
          </button>
        }
      >
        {all}
      </Popover>
    </div>
  )
}

type PresetsProps = {
  fill?: string
  stroke?: string
  open: boolean
  onPick: (preset: Preset) => void
  /** The presets in the row, by name (defaults to five light ones). */
  rowNames?: readonly string[]
  /** Columns in the row, the ⋯ button included. */
  columns?: number
  /** Fine-tuning controls shown at the top of the popup, above all the presets. */
  custom?: ReactNode
}

/** The shape and icon-frame presets: a fill, outline and text colour each. */
export function Presets({ fill, stroke, open, onPick, rowNames, columns = 6, custom }: PresetsProps) {
  // Lines take no fill or text, so only their outline has to match.
  const isOn = (preset: Preset) => stroke?.toLowerCase() === preset.stroke && (open || (fill?.toLowerCase() ?? '') === preset.fill)
  return (
    <PresetPicker
      groups={PRESET_GROUPS}
      row={rowNames ? presetsNamed(rowNames) : ROW_PRESETS}
      look={(preset) => preset}
      isOn={isOn}
      onPick={onPick}
      blank={open}
      columns={columns}
      custom={custom}
    />
  )
}

/** The closed shapes, which can be switched into one another. */
const CLOSED_SHAPES: PickerOption<ShapeKind>[] = SHAPES.filter((each) => each.inPanel !== false && !OPEN_SHAPES.has(each.id)).map((each) => ({
  id: each.id,
  name: each.name,
  picture: <ShapePicture shape={each.id} />,
}))

/** The shapes always in the Shape row; the picked one takes the last place when it isn't one of them. */
const ROW_SHAPES: readonly ShapeKind[] = ['rectangle', 'rounded', 'ellipse', 'triangle', 'diamond']

/** The top-left corner of a rounded rectangle, shown in the Corners field. */
export function RoundCorner() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
      <path d="M5 20V12a7 7 0 0 1 7-7h8" />
    </svg>
  )
}

/** Three lines, each thicker than the last, shown in the line thickness field. */
export function Thickness() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-muted-foreground" fill="none" stroke="currentColor" strokeLinecap="round" aria-hidden="true">
      <path d="M4 6h16" strokeWidth={1} />
      <path d="M4 12h16" strokeWidth={2} />
      <path d="M4 19h16" strokeWidth={4} />
    </svg>
  )
}

export function ShapeProperties({ shape, next, onStyle, onTextFit, onTextColour, onBracketStyle, onShapeKind, onCornerRadius, usedColours, textControls, onTextTab, onTypeText }: ShapePropertiesProps) {
  const expanded = useExpandedControls()
  const [tab, setTab] = useState('shape')
  // Starting to type in the shape, or clicking its text once, opens the Text tab; clicking the
  // shape outside its text (or finishing typing) goes back to the Shape tab. Tabs picked by hand stay put in between.
  const typing = shape?.typingInShape === true || shape?.textPicked === true
  const [wasTyping, setWasTyping] = useState(typing)
  if (typing !== wasTyping) {
    setWasTyping(typing)
    setTab(typing ? 'text' : 'shape')
  }
  // A pick in the bar's Style widget shows the Shape tab, where the colours are.
  usePanelTab((open) => open === 'shape-style' && setTab('shape'))
  const kind = shape ? shape.shapeKind : next.shape
  const style = shape ? { fill: shape.fill, stroke: shape.stroke, strokeWidth: shape.strokeWidth ?? 0, opacity: shape.opacity } : next.style
  const open = kind !== undefined && OPEN_SHAPES.has(kind)
  // Brackets are open lines but take text, beside them.
  const noText = open && !BRACKETS.has(kind)
  // A selected shape says whether it takes text; the next shape takes text unless it is an open line (a double bracket takes it inside).
  const textFit = shape ? shape.textFit : open && !DOUBLE_BRACKETS.has(kind) ? undefined : next.style.textFit
  // The next shape's corners: as set last, or that shape's own (the Rounded one's depend on its size).
  const nextCorners = (kind: ShapeKind) => {
    const size = clickSize(kind, next.style)
    return next.style.cornerRadius ?? defaultCornerRadius(kind, size.width, size.height)
  }
  const cornerRadius = kind === undefined || !CORNER_SHAPES.has(kind) ? undefined : shape ? shape.cornerRadius : nextCorners(kind)
  const shapeRows = (
    <PropRows>
      {kind !== undefined && BRACKETS.has(kind) && (
        <PropRow label="Bracket">
          <SegmentedToggle
            label="Bracket style"
            options={BRACKET_STYLES}
            value={CURLY_BRACKETS.has(kind) ? 'curly' : 'square'}
            // A single bracket stays single and a double one double.
            onValueChange={(style) => onBracketStyle(bracketKind(DOUBLE_BRACKETS.has(kind), style === 'curly'))}
          />
        </PropRow>
      )}
      {kind !== undefined && !open && (
        <PropRow label="Shape">
          <OptionPicker title="Shapes" options={CLOSED_SHAPES} rowIds={ROW_SHAPES} value={kind} onPick={onShapeKind} />
        </PropRow>
      )}
      {/* Always there next to the Shape row, faded for shapes without corners, so switching shapes doesn't move the rows below. */}
      {kind !== undefined && !open && expanded && (
        <PropRow label="Corners" off={cornerRadius === undefined}>
          <NumberOrSlider label="Corner radius" prefix={<RoundCorner />} value={Math.round(cornerRadius ?? 0)} suffix="px" max={500} sliderMax={100} onCommit={onCornerRadius} className="w-[5.5rem]" />
        </PropRow>
      )}
      <PropRow label="Preset">
        <Presets
          fill={toHex(style.fill)}
          stroke={toHex(style.stroke)}
          open={open}
          onPick={(preset) => {
            // A line only takes the outline colour.
            if (open) return onStyle({ stroke: preset.stroke })
            onStyle({ fill: preset.fill, stroke: preset.stroke })
            onTextColour(preset.text)
          }}
        />
      </PropRow>
      {/* Phones keep the short names: the property bar lists rows by label. */}
      <PropRow label={expanded ? 'Fill' : 'Fill colour'}>
        <ColourInput label="Fill" noneLabel="No fill" disabled={open} value={open ? undefined : toHex(style.fill)} onChange={(fill) => onStyle({ fill: fill ?? '' })} used={usedColours} className="min-w-0 flex-1" />
      </PropRow>
      <PropRow label={expanded ? 'Outline' : 'Outline colour'}>
        <ColourInput
          label="Outline"
          noneLabel="No outline"
          value={toHex(style.stroke)}
          onChange={(stroke) => onStyle({ stroke: stroke ?? '' })}
          used={usedColours}
          className="min-w-0 flex-1"
          aside={expanded ? <NumberOrSlider label="Outline width" showLabel value={style.strokeWidth} suffix="px" max={50} sliderMax={20} onCommit={(strokeWidth) => onStyle({ strokeWidth })} className="w-[3.75rem] shrink-0" /> : undefined}
        />
      </PropRow>
      {/* Desktop: line thickness and corners, one row each, under the outline colour (owner's call, 2026-11-19). Corners fade for shapes without them, so nothing moves. */}
      {!expanded && (
        <PropRow label="Thickness">
          <NumberOrSlider label="Line thickness" prefix={<Thickness />} value={style.strokeWidth} suffix="px" max={50} sliderMax={20} onCommit={(strokeWidth) => onStyle({ strokeWidth })} className="w-[5.5rem] shrink-0" />
        </PropRow>
      )}
      {!expanded && kind !== undefined && !open && (
        <PropRow label="Corners" off={cornerRadius === undefined}>
          <NumberOrSlider label="Corner radius" prefix={<RoundCorner />} value={Math.round(cornerRadius ?? 0)} suffix="px" max={500} sliderMax={100} onCommit={onCornerRadius} className="w-[5.5rem]" />
        </PropRow>
      )}
      <OpacityRow opacity={style.opacity} onChange={(opacity) => onStyle({ opacity })} />
    </PropRows>
  )
  // Under the text settings, in the same rows so the labels line up; pulled up to the rows' own gap.
  const longTextRow = textFit && (
    <PropRows className="-mt-1.5 pt-0">
      {/* Top-aligned with the taller toggle. */}
      <PropRow label="Long text" top>
        <SegmentedToggle label="When text gets long" stacked options={TEXT_FITS} value={textFit} onValueChange={onTextFit} className="w-full" />
      </PropRow>
    </PropRows>
  )
  // Phones: no tabs, which the property bar can't list. The text rows follow the shape's, and the bar
  // splits them into items the way it does for a text (see mobile-props). The Type text item starts typing
  // in the shape when tapped (EditorScreen): a double tap is hard to find on a phone (owner's calls, 2026-11-17).
  if (expanded) {
    return (
      <>
        {shapeRows}
        {!noText && (
          <>
            <PropRows>
              <PropRow label={TYPE_TEXT}>
                <Button variant="secondary" className="h-11 w-full" onClick={onTypeText}>
                  <TextCursorInput className="size-4" aria-hidden="true" />
                  Type text
                </Button>
              </PropRow>
            </PropRows>
            {textControls}
            {longTextRow}
          </>
        )}
      </>
    )
  }
  // Tabs, not the two sections below each other (tried 2026-11-12; the owner kept tabs).
  return (
    <Tabs
      label="Properties"
      value={noText ? 'shape' : tab}
      onValueChange={(value) => {
        setTab(value)
        if (value === 'text' && shape && !typing) onTextTab?.()
      }}
      tabs={[
        { value: 'shape', label: 'Shape' },
        { value: 'text', label: 'Text', disabled: noText },
      ]}
    >
      <TabsPanel value="shape">{shapeRows}</TabsPanel>
      <TabsPanel value="text">
        {textControls}
        {longTextRow}
      </TabsPanel>
    </Tabs>
  )
}
