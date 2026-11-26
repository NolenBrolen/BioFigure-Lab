/*
 * The properties of a selected pathway cascade (BIO-105), in the Blocks panel
 * where its cards are, laid out like a sequence's:
 *
 * - A card with the steps: Ligand Shown | None, one row per step (named by
 *   its place: Ligand, Receptor, Step 1..., Nucleus 1...) with its name, its
 *   role and the word on the arrow under it, and a − that removes it (Undo
 *   toast); how many steps, with Add step; how many sit in the nucleus.
 * - Style: the three looks as small pictures. Preset colours. Width.
 * - Detach at the bottom, with an Undo toast.
 */
import { Button } from '@biofigure-lab/ui/components/button/Button'
import { ColourInput } from '@biofigure-lab/ui/components/colour-input/ColourInput'
import { IconButton } from '@biofigure-lab/ui/components/icon-button/IconButton'
import { SegmentedToggle } from '@biofigure-lab/ui/components/segmented-toggle/SegmentedToggle'
import { Slider } from '@biofigure-lab/ui/components/slider/Slider'
import { useToast } from '@biofigure-lab/ui/components/toast/Toast'
import { useExpandedControls } from '@biofigure-lab/ui/lib/expanded-controls'
import { Eye, EyeOff, Minus, Plus, Unlink, Workflow } from 'lucide-react'

import type { FigureCanvas, SelectionInfo } from '../editor/FigureCanvas'
import { wash } from '../editor/panel-block'
import { PATHWAY_LOOKS, PATHWAY_WIDTH, stepPlaces, type PathwayLook, type StepPlace } from '../editor/pathway-block'
import { LiveTextField } from './fields'
import { Tile } from './FrameProperties'
import { PropertiesHeader, PropRow, PropRows } from './properties-pane'
import { detachSequenceWithUndo, removeStepWithUndo } from './sequence-actions'
import { PRESET_GROUPS, ROW, swatchLook } from './SequenceProperties'
import { PresetPicker } from './ShapeProperties'

const LIGAND = [
  { value: 'on', label: 'Shown', icon: Eye },
  { value: 'off', label: 'None', icon: EyeOff },
] as const

/** One look, small, in the block's colour: what its Style tile makes. */
function PathwayLookPicture({ look, colour }: { look: PathwayLook; colour: string }) {
  const step = (y: number, x = 14) => <rect key={y} x={x} y={y} width="7" height="7" rx="1.5" fill="currentColor" opacity="0.35" />
  return (
    <svg viewBox="0 0 48 36" className="size-full" aria-hidden="true">
      {look === 'cutout' && (
        <>
          <rect x="2" y="7" width="44" height="4" rx="2" fill="#e3cfa1" />
          <rect x="8" y="24" width="32" height="11" rx="5" fill="#f4f1fa" stroke="#7c6bb0" strokeWidth="0.9" strokeDasharray="5 1.2" />
          {[5.5, 15.5, 26].map((y) => step(y, 20.5))}
          <path d="M24 13.5v1.5M24 23.5v2" stroke={colour} strokeWidth="1.1" strokeLinecap="round" />
        </>
      )}
      {look === 'cards' && (
        <>
          <path d="M2 10.5h44M2 12.5h44" stroke="#a1a1aa" strokeWidth="0.7" />
          {[4, 15].map((y) => (
            <rect key={y} x="12" y={y} width="24" height="8" rx="2" fill={y === 4 ? wash(colour, 0.12) : '#ffffff'} stroke={colour} strokeWidth="0.8" />
          ))}
          <rect x="6" y="25.5" width="36" height="10" rx="2.5" fill="#f4f1fa" stroke="#7c6bb0" strokeWidth="0.7" strokeDasharray="1.6 1.2" />
          <rect x="12" y="27" width="24" height="7" rx="2" fill="#ffffff" stroke={colour} strokeWidth="0.8" />
          {[6, 17, 28.5].map((y) => step(y, 13.5))}
        </>
      )}
      {look === 'bands' && (
        <>
          <rect x="0" y="0" width="48" height="6" fill="#f4f4f5" />
          <rect x="0" y="6" width="48" height="7" fill="#f6efdc" />
          <rect x="0" y="13" width="48" height="13" fill={wash(colour, 0.1)} />
          <rect x="0" y="26" width="48" height="10" fill="#f4f1fa" />
          <path d="M7 0v36" stroke="#d4d4d8" strokeWidth="0.6" />
          {[6.5, 16, 27.5].map((y) => step(y, 21))}
        </>
      )}
    </svg>
  )
}

/** A step's name in the list, by its place: Ligand, Receptor, Step 1..., Nucleus 1... */
function placeNames(places: readonly StepPlace[]): string[] {
  let chain = 0
  let nucleus = 0
  return places.map((place) => (place === 'ligand' ? 'Ligand' : place === 'receptor' ? 'Receptor' : place === 'chain' ? `Step ${++chain}` : `Nucleus ${++nucleus}`))
}

type Props = {
  figure: FigureCanvas | null
  /** The selected pathway: its sequence settings (step names) and its own in `pathway`. */
  selection: SelectionInfo
  /** Back to the block cards; also lets go of the pathway. */
  onBack: () => void
}

export function PathwayProperties({ figure, selection, onBack }: Props) {
  const toasts = useToast()
  const expanded = useExpandedControls()
  const sequence = selection.sequence
  const settings = selection.pathway
  if (!sequence || !settings) return null
  const steps = sequence.steps
  const places = stepPlaces(settings, steps)
  const names = placeNames(places)
  const inNucleus = places.filter((place) => place === 'nucleus').length
  const canNucleus = places.filter((place) => place === 'chain' || place === 'nucleus').length
  return (
    <>
      <PropertiesHeader backLabel="Back to blocks" picture={<Workflow />} name="Pathway" onBack={onBack} />
      <div className="px-3 pt-1 pb-3">
        <PropRows className="rounded-lg border border-border bg-muted/40">
          <PropRow label="Ligand">
            <SegmentedToggle label="Ligand" options={LIGAND} value={settings.ligand ? 'on' : 'off'} onValueChange={(value) => figure?.setPathway({ ligand: value === 'on' })} showLabels className="h-8 flex-1" />
          </PropRow>
          {names.map((name, i) => {
            // The word on the arrow under this step; the last step has an arrow only into an empty nucleus.
            const arrow = i < steps - 1 || inNucleus === 0
            return (
              <PropRow key={i} label={name} top>
                <div className="flex min-w-0 flex-1 items-start gap-1.5">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <LiveTextField label={`${name} name`} value={sequence.labels[i] ?? ''} placeholder="No name" onType={(text) => figure?.setPathwayStep(i, { name: text })} onDone={() => undefined} className="w-full" />
                    <LiveTextField label={`${name} role`} value={settings.roles[i] ?? ''} placeholder="Role (Kinase…)" onType={(text) => figure?.setPathwayStep(i, { role: text })} onDone={() => undefined} className="w-full" />
                    {arrow && <LiveTextField label={`Word on the arrow after ${name.toLowerCase()}`} value={settings.verbs[i] ?? ''} placeholder="↓ Arrow word (activates…)" onType={(text) => figure?.setPathwayStep(i, { verb: text })} onDone={() => undefined} className="w-full" />}
                  </div>
                  <IconButton icon={Minus} label={steps <= 2 ? 'A pathway keeps at least two steps' : `Remove ${name.toLowerCase()}`} disabled={steps <= 2} onClick={() => removeStepWithUndo(toasts, figure, i)} />
                </div>
              </PropRow>
            )
          })}
          <PropRow label="Steps">
            <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">{steps} steps</span>
              <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => figure?.addStep()}>
                <Plus aria-hidden="true" />
                Add step
              </Button>
            </div>
          </PropRow>
          <PropRow label="Nucleus">
            <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">{inNucleus === 1 ? '1 step inside' : `${inNucleus} steps inside`}</span>
              <div className="flex items-center gap-1">
                <IconButton icon={Minus} label="One step fewer in the nucleus" disabled={inNucleus === 0} onClick={() => figure?.setPathway({ nuclear: inNucleus - 1 })} />
                <IconButton icon={Plus} label="One more step in the nucleus" disabled={inNucleus >= canNucleus} onClick={() => figure?.setPathway({ nuclear: inNucleus + 1 })} />
              </div>
            </div>
          </PropRow>
        </PropRows>
      </div>
      <PropRows className="border-t border-border pt-3 [&>[data-prop-label=Width]]:mt-3 [&>[data-prop-row=Width]]:mt-3 [&>[data-wide-label]:not(:first-child)]:mt-3">
        <PropRow label="Style" wide>
          <div role="group" aria-label="Pathway style" className="grid w-full grid-cols-3 gap-1.5">
            {PATHWAY_LOOKS.map((look) => (
              <Tile key={look.id} name={look.name} short={look.name} on={settings.look === look.id} onClick={() => figure?.setPathway({ look: look.id })}>
                <PathwayLookPicture look={look.id} colour={settings.colour} />
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
            onPick={(preset) => figure?.setPathway({ colour: preset.colour })}
            columns={6}
            customLabel="Custom colour"
            custom={<ColourInput label="Pathway colour" value={settings.colour} onChange={(next) => next && figure?.setPathway({ colour: next })} used={() => figure?.usedColours() ?? []} className="min-w-0 flex-1" />}
          />
        </PropRow>
        <PropRow label="Width">
          <Slider
            look={expanded ? 'bar' : undefined}
            label="Width"
            hideLabel
            min={PATHWAY_WIDTH.min}
            max={800}
            value={Math.round(selection.width)}
            unit="px"
            onValueChange={(width) => figure?.setPathway({ width }, 'pathway-width')}
            className="min-w-0 flex-1"
          />
        </PropRow>
      </PropRows>
      <div className="border-t border-border p-3">
        <Button variant="secondary" size="sm" className="w-full gap-1.5" onClick={() => detachSequenceWithUndo(toasts, figure, 'Pathway')}>
          <Unlink aria-hidden="true" />
          Detach pathway
        </Button>
      </div>
    </>
  )
}
