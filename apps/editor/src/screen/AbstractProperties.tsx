/*
 * The properties of a selected graphical abstract (BIO-107), in the Blocks
 * panel where its cards are, laid out like the comparison's:
 *
 * - A card with the Title, then each part's Heading and Caption, and the
 *   Captions toggle (the caption fields fade while captions are hidden, so
 *   the text is kept for when they show again).
 * - Style: the three looks as small pictures in the block's colour.
 * - Preset colours, as for sequences. Detach at the bottom, with Undo.
 *
 * What goes in each part's space is picked by selecting the space (or the
 * icon or graph in it), as everywhere else.
 */
import { Button } from '@biofigure-lab/ui/components/button/Button'
import { ColourInput } from '@biofigure-lab/ui/components/colour-input/ColourInput'
import { SegmentedToggle } from '@biofigure-lab/ui/components/segmented-toggle/SegmentedToggle'
import { useToast } from '@biofigure-lab/ui/components/toast/Toast'
import { Eye, EyeOff, PanelsTopLeft, Unlink } from 'lucide-react'

import { ABSTRACT_LOOKS, PARTS, type AbstractLook } from '../editor/abstract-block'
import type { FigureCanvas, SelectionInfo } from '../editor/FigureCanvas'
import { LIGHT_PRESETS, NEUTRAL_PRESETS, presetLook, shade, wash, type PanelPreset } from '../editor/panel-block'
import { LiveTextField } from './fields'
import { Tile } from './FrameProperties'
import { PropertiesHeader, PropRow, PropRows } from './properties-pane'
import { detachSequenceWithUndo } from './sequence-actions'
import { PresetPicker } from './ShapeProperties'

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

const CAPTIONS_SHOWN = [
  { value: 'shown', label: 'Shown', icon: Eye },
  { value: 'hidden', label: 'Hidden', icon: EyeOff },
] as const

/** One look of an abstract, in its colour: what the Style tile makes. */
function AbstractLookPicture({ look, colour }: { look: AbstractLook; colour: string }) {
  const cell = (x: number, y: number) => <rect x={x} y={y} width="6" height="6" rx="1.5" fill="currentColor" opacity="0.3" />
  return (
    <svg viewBox="0 0 48 36" className="size-full" aria-hidden="true">
      {look === 'cards' && (
        <>
          <rect x="3" y="5" width="42" height="6" rx="1.5" fill={colour} />
          {[3, 18, 33].map((x) => (
            <g key={x}>
              <rect x={x} y="14" width="12" height="17" rx="2" fill="#ffffff" stroke={colour} strokeWidth="0.9" />
              {cell(x + 3, 20)}
            </g>
          ))}
        </>
      )}
      {look === 'chevrons' && (
        <>
          <rect x="3" y="5" width="26" height="2.6" rx="1" fill="currentColor" opacity="0.7" />
          <rect x="3" y="10" width="42" height="1" fill={colour} />
          {[0, 1, 2].map((i) => {
            const x = 3 + i * 14.3
            const tip = i === 2 ? 0 : 3
            const notch = i === 0 ? 0 : 3
            return <path key={i} d={`M${x} 14h${13.5 - tip}l${tip} 3.5-${tip} 3.5h-${13.5 - tip}l${notch}-3.5Z`} fill={wash(colour, [0.45, 0.72, 1][i] ?? 1)} />
          })}
          {[6.5, 20.8, 35.1].map((x) => cell(x, 25))}
        </>
      )}
      {look === 'spotlight' && (
        <>
          <rect x="3" y="5" width="42" height="6" rx="1.5" fill={wash(colour, 0.14)} />
          <rect x="3" y="5" width="1.5" height="6" fill={colour} />
          <rect x="27" y="14" width="18" height="18" rx="2.5" fill={wash(colour, 0.12)} stroke={colour} strokeWidth="1" />
          {[6, 16].map((x) => (
            <circle key={x} cx={x} cy="17.5" r="2" fill="#ffffff" stroke={colour} strokeWidth="0.8" />
          ))}
          <circle cx="30.5" cy="17.5" r="2" fill={colour} />
          <path d="M9 17.5h4M19 17.5h7" stroke={shade(colour, 1)} strokeOpacity="0.5" strokeWidth="0.7" />
          {cell(5, 23)}
          {cell(15, 23)}
          <rect x="32" y="21.5" width="8" height="8" rx="1.5" fill="currentColor" opacity="0.3" />
        </>
      )}
    </svg>
  )
}

type Props = {
  figure: FigureCanvas | null
  /** The selected abstract; its settings are in `abstract.abstract`. */
  abstract: SelectionInfo
  /** Back to the block cards; also lets go of the abstract. */
  onBack: () => void
}

export function AbstractProperties({ figure, abstract, onBack }: Props) {
  const toasts = useToast()
  const settings = abstract.abstract
  if (!settings) return null
  const fade = settings.captionsShown ? 'min-w-0 flex-1' : 'min-w-0 flex-1 opacity-40'
  return (
    <>
      <PropertiesHeader backLabel="Back to blocks" picture={<PanelsTopLeft />} name="Graphical abstract" onBack={onBack} />
      <div className="px-3 pt-1 pb-3">
        <PropRows className="rounded-lg border border-border bg-muted/40">
          <PropRow label="Title">
            <LiveTextField label="Title" value={settings.title} placeholder="No title" onType={(title) => figure?.setAbstract({ title }, 'abstract-title')} onDone={() => undefined} className="w-full" />
          </PropRow>
          {Array.from({ length: PARTS }, (_, i) => (
            <PropRow key={i} label={`Part ${i + 1}`}>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <LiveTextField label={`Part ${i + 1} heading`} value={settings.headings[i] ?? ''} placeholder="No heading" onType={(text) => figure?.setAbstractText('headings', i, text)} onDone={() => undefined} className="w-full" />
                <div className={fade}>
                  <LiveTextField label={`Part ${i + 1} caption`} value={settings.captions[i] ?? ''} placeholder="No caption" onType={(text) => figure?.setAbstractText('captions', i, text)} onDone={() => undefined} className="w-full" />
                </div>
              </div>
            </PropRow>
          ))}
          <PropRow label="Captions">
            <SegmentedToggle
              label="Captions"
              options={CAPTIONS_SHOWN}
              value={settings.captionsShown ? 'shown' : 'hidden'}
              onValueChange={(value) => figure?.setAbstract({ captionsShown: value === 'shown' })}
              showLabels
              className="h-8 flex-1"
            />
          </PropRow>
        </PropRows>
      </div>
      <PropRows className="border-t border-border pt-3 [&>[data-wide-label]:not(:first-child)]:mt-3">
        <PropRow label="Style" wide>
          <div role="group" aria-label="Graphical abstract style" className="grid w-full grid-cols-3 gap-1.5">
            {ABSTRACT_LOOKS.map((look) => (
              <Tile key={look.id} name={look.name} short={look.name} on={settings.look === look.id} onClick={() => figure?.setAbstract({ look: look.id })}>
                <AbstractLookPicture look={look.id} colour={settings.colour} />
              </Tile>
            ))}
          </div>
        </PropRow>
        <PropRow label="Preset" wide>
          <PresetPicker
            groups={PRESET_GROUPS}
            row={ROW}
            look={swatchLook}
            isOn={(preset) => preset.colour === settings.colour.toLowerCase()}
            onPick={(preset) => figure?.setAbstract({ colour: preset.colour })}
            columns={6}
            customLabel="Custom colour"
            custom={<ColourInput label="Graphical abstract colour" value={settings.colour} onChange={(next) => next && figure?.setAbstract({ colour: next })} used={() => figure?.usedColours() ?? []} className="min-w-0 flex-1" />}
          />
        </PropRow>
      </PropRows>
      <div className="border-t border-border p-3">
        <Button variant="secondary" size="sm" className="w-full gap-1.5" onClick={() => detachSequenceWithUndo(toasts, figure, 'Graphical abstract')}>
          <Unlink aria-hidden="true" />
          Detach graphical abstract
        </Button>
      </div>
    </>
  )
}
