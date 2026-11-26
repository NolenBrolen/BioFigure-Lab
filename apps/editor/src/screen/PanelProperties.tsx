/*
 * The properties of a selected panel block (BIO-74), in the Blocks panel
 * where its tiles are. The owner's pick of 2026-11-25 (round 3, version B),
 * without the Size row for now:
 *
 * - Title: Shown | Hidden in plain words, then the title's text (only while
 *   the title shows); the Letter row and, under it, the slide's letter settings
 *   (BIO-83) sit in the same card, as in the comparison blocks' properties.
 * - Style: the five looks as named tiles, each drawn in the panel's colour.
 * - Preset: "Aa" squares, the same in every style; ⋯ opens them all, with a
 *   custom colour on top.
 * - Padding as a slider, then what the panel holds (click one to select it),
 *   and Detach at the bottom, with an Undo toast instead of a question.
 */
import { Button } from '@biofigure-lab/ui/components/button/Button'
import { ColourInput } from '@biofigure-lab/ui/components/colour-input/ColourInput'
import { layerKindIcon } from '@biofigure-lab/ui/components/layers-panel/LayersPanel'
import { SegmentedToggle } from '@biofigure-lab/ui/components/segmented-toggle/SegmentedToggle'
import { Slider } from '@biofigure-lab/ui/components/slider/Slider'
import { useToast } from '@biofigure-lab/ui/components/toast/Toast'
import { useExpandedControls } from '@biofigure-lab/ui/lib/expanded-controls'
import { Eye, EyeOff, LayoutPanelTop, Ungroup } from 'lucide-react'

import type { FigureCanvas, PanelContent, SelectionInfo } from '../editor/FigureCanvas'
import { PADDING_RANGE, PANEL_STYLES, PRESET_GROUPS, ROW_PRESETS, presetLook, type PanelPreset } from '../editor/panel-block'
import { LiveTextField } from './fields'
import { Tile } from './FrameProperties'
import { detachPanelWithUndo } from './detach-panel'
import { PanelLookPicture } from './panel-pictures'
import { PropertiesHeader, PropRow, PropRows } from './properties-pane'
import { PresetPicker } from './ShapeProperties'
import { SlideLettersRows } from './SlideLetters'

const TITLE_SHOWN = [
  { value: 'shown', label: 'Shown', icon: Eye },
  { value: 'hidden', label: 'Hidden', icon: EyeOff },
] as const

/** A preset's square: a pale wash, the colour as outline, dark "Aa". */
const swatchLook = (preset: PanelPreset) => {
  const look = presetLook(preset)
  return { fill: look.fill, stroke: look.outline, text: look.text }
}

/** What the panel holds, the top one first; click one to select it. */
function ContentsList({ contents, onSelect }: { contents: readonly PanelContent[]; onSelect: (id: string) => void }) {
  const count = contents.length === 0 ? 'Empty' : contents.length === 1 ? '1 object' : `${contents.length} objects`
  return (
    <section aria-label="Contents" className="border-t border-border px-3 pt-2.5 pb-3">
      <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
        <span>Contents</span>
        <span>{count}</span>
      </div>
      {contents.length === 0 ? (
        <p className="text-xs text-muted-foreground">Drag things onto the panel to put them in it.</p>
      ) : (
        <ul className="flex flex-col">
          {contents.map((item) => {
            const Icon = layerKindIcon[item.kind]
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSelect(item.id)}
                  className="flex h-8 w-full min-w-0 items-center gap-2 rounded-md px-1.5 text-left text-sm transition-colors duration-(--duration-instant) hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 truncate">{item.name}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

type Props = {
  figure: FigureCanvas | null
  /** The selected panel; its settings are in `panel.panel`. */
  panel: SelectionInfo
  /** Back to the shape tiles; also lets go of the panel. */
  onBack: () => void
}

export function PanelProperties({ figure, panel, onBack }: Props) {
  const toasts = useToast()
  const expanded = useExpandedControls()
  const settings = panel.panel
  if (!settings) return null
  const colour = settings.colour.toLowerCase()
  return (
    <>
      <PropertiesHeader backLabel="Back to blocks" picture={<LayoutPanelTop />} name="Panel" onBack={onBack} />
      <div className="px-3 pt-1 pb-3">
        <PropRows className="rounded-lg border border-border bg-muted/40">
          <PropRow label="Title">
            <SegmentedToggle
              label="Title"
              options={TITLE_SHOWN}
              value={settings.titleShown ? 'shown' : 'hidden'}
              onValueChange={(value) => figure?.setPanel({ titleShown: value === 'shown' })}
              showLabels
              className="h-8 flex-1"
            />
          </PropRow>
          {/* The text only shows while the title does. */}
          {settings.titleShown && (
            <PropRow label="Text">
              <LiveTextField label="Title text" value={settings.title} placeholder="Panel" onType={(title) => figure?.setPanel({ title }, 'panel-title')} onDone={() => undefined} className="min-w-0 flex-1" />
            </PropRow>
          )}
          <PropRow label="Letter">
            <SegmentedToggle label="Panel letter" options={TITLE_SHOWN} value={settings.letter ? 'shown' : 'hidden'} onValueChange={(value) => figure?.setPanel({ letter: value === 'shown' })} showLabels className="h-8 flex-1" />
          </PropRow>
          {settings.letter && panel.letters && <SlideLettersRows figure={figure} letters={panel.letters} />}
        </PropRows>
      </div>
      <PropRows className="border-t border-border pt-3 [&>[data-wide-label]:not(:first-child)]:mt-3">
        <PropRow label="Style" wide>
          <div role="group" aria-label="Panel style" className="grid w-full grid-cols-3 gap-1.5">
            {PANEL_STYLES.map((style) => (
              <Tile key={style.id} name={style.name} short={style.name} on={settings.style === style.id} onClick={() => figure?.setPanel({ style: style.id })}>
                <PanelLookPicture style={style.id} colour={settings.colour} strong={settings.strong} />
              </Tile>
            ))}
          </div>
        </PropRow>
        <PropRow label="Preset" wide>
          <PresetPicker
            groups={PRESET_GROUPS}
            row={ROW_PRESETS}
            look={swatchLook}
            isOn={(preset) => preset.colour === colour && preset.strong === settings.strong}
            onPick={(preset) => figure?.setPanel({ colour: preset.colour, strong: preset.strong })}
            columns={8}
            customLabel="Custom colour"
            custom={<ColourInput label="Panel colour" value={settings.colour} onChange={(next) => next && figure?.setPanel({ colour: next })} used={() => figure?.usedColours() ?? []} className="min-w-0 flex-1" />}
          />
        </PropRow>
        <PropRow label="Padding">
          <Slider
            look={expanded ? 'bar' : undefined}
            label="Padding"
            hideLabel
            min={PADDING_RANGE.min}
            max={PADDING_RANGE.max}
            value={Math.round(settings.padding)}
            unit="px"
            onValueChange={(padding) => figure?.setPanel({ padding }, 'panel-padding')}
            className="min-w-0 flex-1"
          />
        </PropRow>
      </PropRows>
      <ContentsList contents={settings.contents} onSelect={(id) => figure?.selectLayer(id)} />
      <div className="border-t border-border p-3">
        <Button variant="secondary" size="sm" className="w-full gap-1.5" onClick={() => detachPanelWithUndo(toasts, figure)}>
          <Ungroup aria-hidden="true" />
          Detach panel
        </Button>
      </div>
    </>
  )
}
