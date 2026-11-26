/*
 * The properties of a selected callout block (BIO-97), in the Blocks panel
 * where its cards are, built like a sequence's:
 *
 * Zoom inset (also with its marker selected): Style (Lens, Frame, Pin),
 * what the inset shows (an icon to fill, or a magnified copy of the marked
 * spot), the preset colours, the inset's and marker's sizes (and so how much
 * it magnifies), the frame's zoom tag, the caption, and Detach.
 *
 * Labelled icon: one row per label with its text and a − that removes it,
 * Add label, Style (Plain lines, Chips, Numbers + key), colours, Detach.
 */
import { Button } from '@biofigure-lab/ui/components/button/Button'
import { ColourInput } from '@biofigure-lab/ui/components/colour-input/ColourInput'
import { IconButton } from '@biofigure-lab/ui/components/icon-button/IconButton'
import { SegmentedToggle } from '@biofigure-lab/ui/components/segmented-toggle/SegmentedToggle'
import { Slider } from '@biofigure-lab/ui/components/slider/Slider'
import { useToast } from '@biofigure-lab/ui/components/toast/Toast'
import { useExpandedControls } from '@biofigure-lab/ui/lib/expanded-controls'
import { Eye, EyeOff, Image, Minus, Plus, Tags, Unlink, ZoomIn } from 'lucide-react'

import { INSET_LOOKS, INSET_SIZE_RANGE, LABEL_LOOKS, MARKER_SIZE_RANGE, type InsetLook, type LabelLook } from '../editor/callout-block'
import type { FigureCanvas, SelectionInfo } from '../editor/FigureCanvas'
import { LIGHT_PRESETS, NEUTRAL_PRESETS, presetLook, wash, type PanelPreset } from '../editor/panel-block'
import { detachCalloutWithUndo, removeLabelWithUndo } from './callout-actions'
import { LiveTextField, NumberField } from './fields'
import { Tile } from './FrameProperties'
import { PropertiesHeader, PropRow, PropRows } from './properties-pane'
import { PresetPicker } from './ShapeProperties'

/** The panels' colours, as for sequences: the palette, then the greys. */
const NEUTRAL = NEUTRAL_PRESETS.filter((preset) => !preset.strong)
const PRESET_GROUPS: readonly { name: string; presets: readonly PanelPreset[] }[] = [
  { name: 'Colours', presets: LIGHT_PRESETS },
  { name: 'Neutral', presets: NEUTRAL },
]
const ROW = [...LIGHT_PRESETS, ...NEUTRAL.filter((preset) => preset.name !== 'Stone')]
const swatchLook = (preset: PanelPreset) => {
  const look = presetLook(preset)
  return { fill: look.fill, stroke: look.outline, text: look.text }
}

const SHOWN = [
  { value: 'shown', label: 'Shown', icon: Eye },
  { value: 'hidden', label: 'Hidden', icon: EyeOff },
] as const

const SHOWS = [
  { value: 'icon', label: 'Icon', icon: Image },
  { value: 'copy', label: 'Magnified', icon: ZoomIn },
] as const

/** One inset look, in its colour: what the Style tile makes. */
function InsetLookPicture({ look, colour }: { look: InsetLook; colour: string }) {
  return (
    <svg viewBox="0 0 48 36" className="size-full" aria-hidden="true">
      {look === 'lens' && (
        <>
          <path d="M9.6 25.5 L27.3 6.6 M12.7 29.1 L33 29.4" stroke={colour} strokeWidth="0.9" />
          <circle cx="11" cy="28" r="3" fill={wash(colour, 0.1)} stroke={colour} strokeWidth="1" />
          <circle cx="33" cy="16" r="13" fill="#ffffff" stroke={colour} strokeWidth="1.4" />
        </>
      )}
      {look === 'frame' && (
        <>
          <path d="M14 23 L22 4 M14 31 L22 30" stroke={colour} strokeWidth="0.9" strokeDasharray="2 1.5" />
          <rect x="8" y="23" width="6" height="8" fill="none" stroke={colour} strokeWidth="1" strokeDasharray="2 1.5" />
          <rect x="22" y="4" width="22" height="26" rx="2" fill="#ffffff" stroke={colour} strokeWidth="1.4" />
          <rect x="34" y="24" width="8" height="4" rx="1" fill={colour} />
        </>
      )}
      {look === 'pin' && (
        <>
          <path d="M10 28 L24 19" stroke={colour} strokeWidth="1" />
          <circle cx="10" cy="28" r="2.4" fill={colour} />
          <circle cx="33" cy="15" r="12" fill={wash(colour, 0.15)} stroke={colour} strokeWidth="1.8" />
          <path d="M27 32.5h12" stroke={colour} strokeWidth="1.6" strokeLinecap="round" />
        </>
      )}
    </svg>
  )
}

/** One labelled-icon look, in its colour. */
function LabelLookPicture({ look, colour }: { look: LabelLook; colour: string }) {
  const subject = <circle cx="20" cy="18" r="8" fill="currentColor" opacity="0.3" />
  return (
    <svg viewBox="0 0 48 36" className="size-full" aria-hidden="true">
      {subject}
      {look === 'plain' && (
        <>
          <path d="M23 13 L32 9 H34 M17 20 L10 25 H8" fill="none" stroke="currentColor" strokeWidth="0.9" />
          <path d="M36 9h9M1 25h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
        </>
      )}
      {look === 'chips' && (
        <>
          <path d="M23 13 L27 9 H31 M17 21 L14 26 H12" fill="none" stroke={colour} strokeWidth="0.9" />
          <rect x="31" y="6" width="15" height="6" rx="3" fill={wash(colour, 0.15)} stroke={colour} strokeWidth="0.8" />
          <rect x="1" y="23" width="11" height="6" rx="3" fill={wash(colour, 0.15)} stroke={colour} strokeWidth="0.8" />
        </>
      )}
      {look === 'numbers' && (
        <>
          <path d="M23 13 L28 8 M15 22 L11 27" stroke={colour} strokeWidth="0.9" />
          <circle cx="29" cy="7" r="2.6" fill={colour} />
          <circle cx="10" cy="28" r="2.6" fill={colour} />
          <circle cx="35" cy="20" r="1.8" fill={colour} />
          <circle cx="35" cy="26" r="1.8" fill={colour} />
          <path d="M39 20h7M39 26h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.6" />
        </>
      )}
    </svg>
  )
}

function ColourRow({ colour, onPick, label, figure }: { colour: string; onPick: (colour: string) => void; label: string; figure: FigureCanvas | null }) {
  return (
    <PropRow label="Preset" wide>
      <PresetPicker
        groups={PRESET_GROUPS}
        row={ROW}
        look={swatchLook}
        isOn={(preset) => preset.colour === colour.toLowerCase()}
        onPick={(preset) => onPick(preset.colour)}
        columns={6}
        customLabel="Custom colour"
        custom={<ColourInput label={label} value={colour} onChange={(next) => next && onPick(next)} used={() => figure?.usedColours() ?? []} className="min-w-0 flex-1" />}
      />
    </PropRow>
  )
}

type Props = {
  figure: FigureCanvas | null
  /** The selected callout (or a zoom inset's marker); its settings are in `callout.callout`. */
  callout: SelectionInfo
  /** Back to the block cards; also lets go of the callout. */
  onBack: () => void
}

export function CalloutProperties({ figure, callout, onBack }: Props) {
  const toasts = useToast()
  const expanded = useExpandedControls()
  const info = callout.callout
  if (!info) return null
  const detach = (
    <div className="border-t border-border p-3">
      <Button variant="secondary" size="sm" className="w-full gap-1.5" onClick={() => void detachCalloutWithUndo(toasts, figure)}>
        <Unlink aria-hidden="true" />
        {info.kind === 'inset' ? 'Detach zoom inset' : 'Detach labelled icon'}
      </Button>
    </div>
  )

  if (info.kind === 'labels') {
    const { settings, labels } = info
    return (
      <>
        <PropertiesHeader backLabel="Back to blocks" picture={<Tags />} name="Labelled icon" onBack={onBack} />
        <div className="px-3 pt-1 pb-3">
          <PropRows className="rounded-lg border border-border bg-muted/40">
            {labels.map((text, i) => (
              <PropRow key={i} label={settings.look === 'numbers' ? `${i + 1}` : `Label ${i + 1}`}>
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                  <LiveTextField label={`Label ${i + 1}`} value={text} placeholder="Label" onType={(next) => figure?.setCalloutLabel(i, next)} onDone={() => undefined} className="min-w-0 flex-1" />
                  <IconButton icon={Minus} label={labels.length < 2 ? 'A labelled icon keeps at least one label' : `Remove label ${i + 1}`} disabled={labels.length < 2} onClick={() => removeLabelWithUndo(toasts, figure, i)} />
                </div>
              </PropRow>
            ))}
            <PropRow label="Labels">
              <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">{labels.length === 1 ? '1 label' : `${labels.length} labels`}</span>
                <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => figure?.addCalloutLabel()}>
                  <Plus aria-hidden="true" />
                  Add label
                </Button>
              </div>
            </PropRow>
          </PropRows>
        </div>
        <PropRows className="border-t border-border pt-3 [&>[data-wide-label]:not(:first-child)]:mt-3">
          <PropRow label="Style" wide>
            <div role="group" aria-label="Labelled icon style" className="grid w-full grid-cols-3 gap-1.5">
              {LABEL_LOOKS.map((look) => (
                <Tile key={look.id} name={look.name} short={look.name} on={settings.look === look.id} onClick={() => figure?.setLabels({ look: look.id })}>
                  <LabelLookPicture look={look.id} colour={settings.colour} />
                </Tile>
              ))}
            </div>
          </PropRow>
          <ColourRow colour={settings.colour} label="Labelled icon colour" figure={figure} onPick={(colour) => figure?.setLabels({ colour })} />
        </PropRows>
        {detach}
      </>
    )
  }

  const { settings, insetSize, markerSize } = info
  return (
    <>
      <PropertiesHeader backLabel="Back to blocks" picture={<ZoomIn />} name="Zoom inset" onBack={onBack} />
      <PropRows className="pt-1 [&>[data-wide-label]:not(:first-child)]:mt-3">
        <PropRow label="Style" wide>
          <div className="flex w-full flex-col gap-1.5">
            <div role="group" aria-label="Zoom inset style" className="grid w-full grid-cols-3 gap-1.5">
              {INSET_LOOKS.map((look) => (
                <Tile key={look.id} name={look.name} short={look.name} on={settings.look === look.id} onClick={() => figure?.setInset({ look: look.id })}>
                  <InsetLookPicture look={look.id} colour={settings.colour} />
                </Tile>
              ))}
            </div>
          </div>
        </PropRow>
        <PropRow label="Shows">
          <SegmentedToggle label="What the inset shows" options={SHOWS} value={settings.shows} onValueChange={(shows) => figure?.setInset({ shows })} showLabels className="h-8 flex-1" />
        </PropRow>
        <ColourRow colour={settings.colour} label="Zoom inset colour" figure={figure} onPick={(colour) => figure?.setInset({ colour })} />
        <PropRow label="Inset">
          <Slider look={expanded ? 'bar' : undefined} label="Inset size" hideLabel min={INSET_SIZE_RANGE.min} max={INSET_SIZE_RANGE.max} value={Math.round(insetSize)} unit="px" onValueChange={(size) => figure?.setInsetSizes({ inset: size }, 'inset-size')} className="min-w-0 flex-1" />
        </PropRow>
        <PropRow label="Marker">
          <Slider look={expanded ? 'bar' : undefined} label="Marker size" hideLabel min={MARKER_SIZE_RANGE.min} max={MARKER_SIZE_RANGE.max} value={Math.round(markerSize)} unit="px" onValueChange={(size) => figure?.setInsetSizes({ marker: size }, 'marker-size')} className="min-w-0 flex-1" />
        </PropRow>
        {/* How much it magnifies: typed, it sets the marker's size (the inset keeps its own). */}
        <PropRow label="Zoom">
          <NumberField label="Zoom" value={insetSize / markerSize} suffix="×" min={insetSize / MARKER_SIZE_RANGE.max} max={insetSize / MARKER_SIZE_RANGE.min} onCommit={(zoom) => figure?.setInsetSizes({ marker: insetSize / zoom })} className="min-w-0 flex-1" />
        </PropRow>
        {/* The zoom tag is the frame look's only. */}
        {settings.look === 'frame' && (
          <PropRow label="Tag">
            <SegmentedToggle label="Zoom tag" options={SHOWN} value={settings.tag ? 'shown' : 'hidden'} onValueChange={(value) => figure?.setInset({ tag: value === 'shown' })} showLabels className="h-8 flex-1" />
          </PropRow>
        )}
        <PropRow label="Caption">
          <SegmentedToggle label="Caption" options={SHOWN} value={settings.captionShown ? 'shown' : 'hidden'} onValueChange={(value) => figure?.setInset({ captionShown: value === 'shown' })} showLabels className="h-8 flex-1" />
        </PropRow>
        {settings.captionShown && (
          <PropRow label="Text">
            <LiveTextField label="Caption text" value={settings.caption} placeholder="Caption" onType={(caption) => figure?.setInset({ caption }, 'inset-caption')} onDone={() => undefined} className="min-w-0 flex-1" />
          </PropRow>
        )}
      </PropRows>
      {detach}
    </>
  )
}
