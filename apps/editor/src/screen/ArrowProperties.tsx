/*
 * The selected arrow's preset, thickness, curve and opacity, under the tiles
 * of the Arrows panel, in the Shapes panel's label-left rows. Its path, line
 * and ends are changed with the tiles above (the owner's pick, 2026-11-14).
 * A thick arrow with a filled head is a block arrow, and the outline goes
 * round all of it (BIO-91). Its own colour and outline sit at the top of the
 * presets (Custom), in the panel and in the quick bar's Style widget, as an
 * icon frame's do.
 */
import { ColourInput } from '@biofigure-lab/ui/components/colour-input/ColourInput'
import { IconButton } from '@biofigure-lab/ui/components/icon-button/IconButton'
import { Slider } from '@biofigure-lab/ui/components/slider/Slider'
import { useExpandedControls } from '@biofigure-lab/ui/lib/expanded-controls'
import { MAX_BEND } from '@biofigure-lab/ui/lib/arrow-geometry'
import { FlipVertical2, Sparkles } from 'lucide-react'

import { toHex } from '../editor/colour'
import { DEFAULT_STROKE } from '../editor/shapes'
import type { ArrowStyleChange, FigureCanvas, SelectionInfo, StyleChange } from '../editor/FigureCanvas'
import { CustomRow } from './FrameProperties'
import { NumberOrSlider, OpacityRow, PropRow, PropRows } from './properties-pane'
import { LookSwatch, PRESET_GROUPS, PresetPicker, Thickness, type SwatchLook } from './ShapeProperties'

type Props = {
  arrow: SelectionInfo
  onChange: (patch: StyleChange) => void
  /** The colours already in the figure, for the swatch dropdown. */
  usedColours?: () => readonly string[]
  /** Sets the bow of the selected curved arrows (share of length, negative the other way); `undefined` for automatic. */
  onBend?: (bend: number | undefined) => void
  /** Sets the selected arrows' outline (a colour or none, and its width), and with a preset their colour too. */
  onStyle?: (change: ArrowStyleChange) => void
}

/** An arrow preset: the arrow's colour and its outline's (none: no outline). */
export type ArrowPreset = { name: string; colour: string; outline?: string }

const shapePresets = (group: string) => PRESET_GROUPS.find((each) => each.name === group)?.presets ?? []

/**
 * The arrow presets, made from the shape presets' colours, so arrows and
 * shapes match: first Neutral, whose Default is the look every arrow starts
 * with (dark, no outline), the way back from any preset; then Plain (the
 * colour, no outline), Bold (the colour with a darker outline) and Light (a
 * pale arrow with the colour as outline).
 */
export const ARROW_PRESET_GROUPS: readonly { name: string; presets: readonly ArrowPreset[] }[] = [
  {
    name: 'Neutral',
    presets: [
      { name: 'Default', colour: DEFAULT_STROKE },
      { name: 'Black', colour: '#000000' },
    ],
  },
  { name: 'Plain', presets: shapePresets('Bold').map((preset) => ({ name: preset.name.replace(', bold', ''), colour: preset.fill })) },
  { name: 'Bold', presets: shapePresets('Bold').map((preset) => ({ name: preset.name, colour: preset.fill, outline: preset.stroke })) },
  { name: 'Light', presets: shapePresets('Light').map((preset) => ({ name: `${preset.name}, light`, colour: preset.fill, outline: preset.stroke })) },
]

/** In the row: Default first (back to a plain arrow, the owner's call, 2026-11-26), then bold ones, the block arrow look. */
const ROW_NAMES = ['Default', 'Blue, bold', 'Vermilion, bold', 'Orange, bold', 'Teal, bold']
const ROW_PRESETS = ROW_NAMES.flatMap((name) => ARROW_PRESET_GROUPS.flatMap((group) => group.presets).find((preset) => preset.name === name) ?? [])

/** A preset's square: the arrow's colour with its outline round it; no "Aa", arrows hold no text. */
const presetLook = (preset: ArrowPreset): SwatchLook => ({ fill: preset.colour, stroke: preset.outline ?? preset.colour, text: 'transparent' })

/** Whether a preset is the arrow's look now. */
function presetOn(arrow: SelectionInfo): (preset: ArrowPreset) => boolean {
  const colour = toHex(arrow.stroke)?.toLowerCase()
  const outline = arrow.arrowStyle?.outline ? toHex(arrow.arrowStyle.outline)?.toLowerCase() : undefined
  return (preset) => colour === preset.colour && outline === preset.outline
}

/** The arrow's own colour and outline (with the outline's width), at the top of the presets. */
function CustomColours({ arrow, onChange, onStyle, usedColours }: Pick<Props, 'arrow' | 'onChange' | 'onStyle' | 'usedColours'>) {
  const style = arrow.arrowStyle ?? { outlineWidth: 0 }
  return (
    <>
      <CustomRow label="Colour">
        <ColourInput label="Colour" look="fill" value={toHex(arrow.stroke)} onChange={(stroke) => stroke && onChange({ stroke })} used={usedColours} className="min-w-0 flex-1" />
      </CustomRow>
      <CustomRow label="Outline">
        <ColourInput
          label="Outline"
          look="outline"
          noneLabel="No outline"
          value={style.outline ? toHex(style.outline) : undefined}
          onChange={(picked) => onStyle?.({ outline: picked || undefined })}
          used={usedColours}
          className="min-w-0 flex-1"
          aside={<NumberOrSlider label="Outline width" showLabel value={style.outline ? style.outlineWidth : 0} suffix="px" max={50} sliderMax={20} onCommit={(outlineWidth) => onStyle?.({ outlineWidth })} className="w-[3.75rem] shrink-0" />}
        />
      </CustomRow>
    </>
  )
}

/**
 * The quick bar's Style widget for an arrow: its own colour and outline at
 * the top, then every preset, a row per look, as a shape's Style shows them.
 */
export function ArrowStyleGrid({ figure, arrow }: { figure: FigureCanvas; arrow: SelectionInfo }) {
  const isOn = presetOn(arrow)
  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label="Custom" className="flex flex-col gap-2 border-b border-border pb-3">
        <span className="text-xs text-muted-foreground">Custom</span>
        <CustomColours arrow={arrow} onChange={(patch) => figure.change(patch)} onStyle={(change) => figure.setArrowStyle(change)} usedColours={() => figure.usedColours()} />
      </div>
      <div className="grid grid-cols-[auto_repeat(16,22px)] items-center gap-1">
        {ARROW_PRESET_GROUPS.map((group) => (
          <div key={group.name} role="group" aria-label={group.name} className="contents">
            <span className="pr-2 text-xs text-muted-foreground">{group.name}</span>
            {group.presets.map((preset) => (
              <LookSwatch key={preset.name} preset={preset} look={presetLook(preset)} on={isOn(preset)} blank={false} onPick={(picked) => figure.setArrowStyle({ colour: picked.colour, outline: picked.outline })} />
            ))}
            {/* A shorter row (Neutral) ends early, and the next look starts on a new line. */}
            {group.presets.length < 16 && <span style={{ gridColumn: `span ${16 - group.presets.length}` }} />}
          </div>
        ))}
      </div>
    </div>
  )
}

export function ArrowProperties({ arrow, onChange, usedColours, onBend, onStyle }: Props) {
  const expanded = useExpandedControls()
  const curved = arrow.arrowLook?.route === 'curved'
  const auto = arrow.arrowLook?.bend === undefined
  const bend = arrow.arrowBend ?? 0
  return (
    <section aria-label="Selected arrow" className="border-t">
      <h3 className="section-label flex h-7 items-center px-3 pt-2">Selected arrow</h3>
      <PropRows className="pt-1">
        <PropRow label="Preset">
          <PresetPicker
            groups={ARROW_PRESET_GROUPS}
            row={ROW_PRESETS}
            look={presetLook}
            isOn={presetOn(arrow)}
            onPick={(preset) => onStyle?.({ colour: preset.colour, outline: preset.outline })}
            // The arrow's own colour and outline, at the top of the presets (as an icon frame's).
            custom={<CustomColours arrow={arrow} onChange={onChange} onStyle={onStyle} usedColours={usedColours} />}
          />
        </PropRow>
        {/* Its own row, as for shapes (the owner's call, 2026-11-26). */}
        <PropRow label="Thickness">
          <NumberOrSlider label="Thickness" showLabel={expanded} prefix={<Thickness />} value={arrow.strokeWidth ?? 0} suffix="px" max={200} sliderMax={40} onCommit={(strokeWidth) => onChange({ strokeWidth })} className="w-[5.5rem] shrink-0" />
        </PropRow>
        {/* Only for curved arrows (the owner's call, 2026-11-26: a faded row was confusing). */}
        {curved && (
          <PropRow label="Curve">
            <Slider
              label="Curve strength"
              hideLabel
              showField={false}
              value={Math.round((Math.abs(bend) / MAX_BEND) * 100)}
              min={0}
              max={100}
              unit="%"
              // Keeps the side it bows to.
              onValueChange={(percent) => onBend?.((bend < 0 ? -1 : 1) * (percent / 100) * MAX_BEND)}
              className="min-w-0 flex-1"
            />
            <IconButton icon={FlipVertical2} label="Flip curve" onClick={() => onBend?.(-bend)} />
            <IconButton icon={Sparkles} label="Automatic curve" pressed={auto} onClick={() => !auto && onBend?.(undefined)} />
          </PropRow>
        )}
        <OpacityRow opacity={arrow.opacity} onChange={(opacity) => onChange({ opacity })} />
      </PropRows>
    </section>
  )
}
