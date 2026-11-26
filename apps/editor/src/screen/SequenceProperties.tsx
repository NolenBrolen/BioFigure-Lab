/*
 * The properties of a selected sequence block (BIO-75), in the Blocks panel
 * where its cards are:
 *
 * - First (the owner's order, 2026-11-25): Labels Shown | Hidden, one row
 *   per step with its label (faded while hidden) and a − that removes it,
 *   then how many steps, with Add step.
 * - Style: the four looks as small pictures in the sequence's colour.
 * - Direction: Across | Down. Preset colours, and the gap as a slider.
 * - Detach at the bottom, with an Undo toast.
 */
import { Button } from '@biofigure-lab/ui/components/button/Button'
import { ColourInput } from '@biofigure-lab/ui/components/colour-input/ColourInput'
import { SegmentedToggle } from '@biofigure-lab/ui/components/segmented-toggle/SegmentedToggle'
import { Slider } from '@biofigure-lab/ui/components/slider/Slider'
import { useToast } from '@biofigure-lab/ui/components/toast/Toast'
import { useExpandedControls } from '@biofigure-lab/ui/lib/expanded-controls'
import { IconButton } from '@biofigure-lab/ui/components/icon-button/IconButton'
import { ArrowDown, ArrowRight, Eye, EyeOff, GitFork, Minus, Plus, RefreshCw, Unlink, Workflow } from 'lucide-react'

import type { FigureCanvas, SelectionInfo } from '../editor/FigureCanvas'
import { LIGHT_PRESETS, NEUTRAL_PRESETS, presetLook, shade, wash, type PanelPreset } from '../editor/panel-block'
import { BRANCH_LOOKS, CYCLE_LOOKS, canAddStep, familyOf, minSteps, type LookFamily } from '../editor/process-looks'
import { GAP_RANGE, SEQUENCE_LOOKS, type SequenceLook } from '../editor/sequence-block'
import { LiveTextField } from './fields'
import { Tile } from './FrameProperties'
import { PropertiesHeader, PropRow, PropRows } from './properties-pane'
import { detachSequenceWithUndo, removeStepWithUndo } from './sequence-actions'
import { PresetPicker } from './ShapeProperties'

/** The panel's colours, one each (a sequence has no strong wash): the palette, then the greys. */
const NEUTRAL = NEUTRAL_PRESETS.filter((preset) => !preset.strong)
export const PRESET_GROUPS: readonly { name: string; presets: readonly PanelPreset[] }[] = [
  { name: 'Colours', presets: LIGHT_PRESETS },
  { name: 'Neutral', presets: NEUTRAL },
]
/** The row in the panel: the eight colours and three greys (with ⋯, two rows of six). */
export const ROW = [...LIGHT_PRESETS, ...NEUTRAL.filter((preset) => preset.name !== 'Stone')]
export const swatchLook = (preset: PanelPreset) => {
  const look = presetLook(preset)
  return { fill: look.fill, stroke: look.outline, text: look.text }
}

const DIRECTIONS = [
  { value: 'across', label: 'Across', icon: ArrowRight },
  { value: 'down', label: 'Down', icon: ArrowDown },
] as const

const LABELS_SHOWN = [
  { value: 'shown', label: 'Shown', icon: Eye },
  { value: 'hidden', label: 'Hidden', icon: EyeOff },
] as const

/** One look of a sequence, three steps across, in its colour: what the Style tile makes. */
function SequenceLookPicture({ look, colour }: { look: SequenceLook; colour: string }) {
  const step = (x: number, y = 12) => <rect key={`${x}-${y}`} x={x} y={y} width="9" height="9" rx="2" fill="currentColor" opacity="0.3" />
  return (
    <svg viewBox="0 0 48 36" className="size-full" aria-hidden="true">
      {look === 'arrows' && (
        <>
          {[3, 19.5, 36].map((x) => step(x))}
          <path d="M13.5 16.5h3.5m-1.6-1.8 1.8 1.8-1.8 1.8M30 16.5h3.5m-1.6-1.8 1.8 1.8-1.8 1.8" fill="none" stroke={colour} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {look === 'timeline' && (
        <>
          {[4, 19.5, 35].map((x) => step(x, 8))}
          <path d="M2 24h40" stroke={colour} strokeWidth="1.6" />
          <path d="M41 21.5 45 24l-4 2.5Z" fill={colour} />
          {[8.5, 24, 39.5].map((x) => (
            <circle key={x} cx={x} cy="24" r="1.9" fill="#ffffff" stroke={colour} strokeWidth="1.2" />
          ))}
        </>
      )}
      {look === 'cards' && (
        <>
          {[2.5, 18.5, 34.5].map((x) => (
            <rect key={x} x={x} y="8" width="11" height="20" rx="2" fill={wash(colour, 0.1)} stroke={wash(colour, 0.5)} strokeWidth="0.8" />
          ))}
          {[4.5, 20.5, 36.5].map((x) => step(x, 12.5))}
          {[3.5, 19.5, 35.5].map((x) => (
            <circle key={x} cx={x} cy="9" r="2.2" fill={colour} />
          ))}
        </>
      )}
      {look === 'ring' && (
        <>
          <circle cx="24" cy="18" r="12" fill="none" stroke={colour} strokeWidth="1.3" />
          {[
            [24, 6],
            [36, 18],
            [24, 30],
            [12, 18],
          ].map(([x = 0, y = 0]) => (
            <rect key={`${x}-${y}`} x={x - 4.5} y={y - 4.5} width="9" height="9" rx="2" fill="currentColor" opacity="0.3" />
          ))}
        </>
      )}
      {look === 'segments' && (
        <>
          <circle cx="24" cy="18" r="9" fill="none" stroke={colour} strokeWidth="5" strokeDasharray="12 2.2" transform="rotate(-80 24 18)" />
          {[
            [24, 2],
            [40, 18],
            [24, 34],
            [8, 18],
          ].map(([x = 0, y = 0]) => (
            <rect key={`${x}-${y}`} x={x - 2.5} y={y - 2.5} width="5" height="5" rx="1" fill="currentColor" opacity="0.35" />
          ))}
        </>
      )}
      {look === 'loop' && (
        <>
          <path d="M29 5.5c4 0 7 3 7.5 6.5M36.5 24c0 4-3 6.5-6.5 7M18 31c-4 0-6.5-3-7-6.5M11.5 12c0-4 3-6.5 6.5-7" fill="none" stroke={colour} strokeWidth="1.5" strokeLinecap="round" />
          {[
            [24, 6],
            [37, 18],
            [24, 30],
            [11, 18],
          ].map(([x = 0, y = 0]) => (
            <rect key={`${x}-${y}`} x={x - 5} y={y - 5} width="10" height="10" rx="2" fill={wash(colour, 0.12)} stroke={wash(colour, 0.5)} strokeWidth="0.8" />
          ))}
        </>
      )}
      {look === 'tree' && (
        <>
          {step(3, 13.5)}
          <path d="M13 18h6M19 18V7.5h9M19 18h9M19 18v10.5h9" fill="none" stroke={colour} strokeWidth="1.3" strokeLinejoin="round" />
          {[3, 13.5, 24].map((y) => step(31, y))}
        </>
      )}
      {look === 'fan' && (
        <>
          {step(19.5, 2)}
          <path d="M24 12c0 6-17 4-17 12M24 12v12M24 12c0 6 17 4 17 12" fill="none" stroke={colour} strokeWidth="1.3" strokeLinecap="round" />
          {[2.5, 19.5, 36.5].map((x) => step(x, 25))}
        </>
      )}
      {look === 'rows' && (
        <>
          {step(1, 13.5)}
          <path d="M15 4.5q-1.5 0-1.5 1.5v10.5l-1.5 1.5 1.5 1.5v10.5q0 1.5 1.5 1.5" fill="none" stroke={colour} strokeWidth="1.2" />
          {[3, 13.5, 24].map((y, i) => (
            <g key={y}>
              <rect x="17" y={y} width="30" height="9" rx="2" fill={wash(colour, 0.12)} />
              <rect x="18.5" y={y + 2.5} width="11" height="4" rx="2" fill={wash(colour, 0.35 + 0.3 * i)} />
              <rect x="36" y={y + 1.5} width="6" height="6" rx="1.5" fill="currentColor" opacity="0.3" />
            </g>
          ))}
        </>
      )}
      {look === 'ribbon' && (
        <>
          <path d="M2 9h12l4 9-4 9H2Z" fill={wash(colour, 0.16)} />
          <path d="M16 9h12l4 9-4 9H16l4-9Z" fill={wash(colour, 0.3)} />
          <path d="M30 9h12l4 9-4 9H30l4-9Z" fill={wash(colour, 0.44)} />
          {[5, 20, 34].map((x) => (
            <rect key={x} x={x} y="13.5" width="8" height="8" rx="2" fill={shade(colour, 0.5)} opacity="0.35" />
          ))}
        </>
      )}
    </svg>
  )
}

/** What a cycle or branching (BIO-96) calls itself and its parts, beside a plain sequence. */
const FAMILY: Record<LookFamily, { name: string; icon: typeof Workflow; looks: readonly { id: SequenceLook; name: string }[]; step: (i: number) => string; add: string }> = {
  sequence: { name: 'Sequence', icon: Workflow, looks: SEQUENCE_LOOKS, step: (i) => `Step ${i + 1}`, add: 'Add step' },
  cycle: { name: 'Cycle', icon: RefreshCw, looks: CYCLE_LOOKS, step: (i) => `Step ${i + 1}`, add: 'Add step' },
  branch: { name: 'Branching', icon: GitFork, looks: BRANCH_LOOKS, step: (i) => (i === 0 ? 'Start' : `Arm ${i}`), add: 'Add arm' },
}

/** Why the − is off at the fewest steps. */
const KEEPS: Record<LookFamily, string> = { sequence: 'A sequence keeps at least one step', cycle: 'A cycle keeps at least two steps', branch: 'Branching keeps its start and two arms' }

/** How many steps (or arms) there are, in words. */
function countText(family: LookFamily, steps: number): string {
  if (family === 'branch') return steps - 1 === 1 ? '1 arm' : `${steps - 1} arms`
  return steps === 1 ? '1 step' : `${steps} steps`
}

type Props = {
  figure: FigureCanvas | null
  /** The selected sequence; its settings are in `sequence.sequence`. */
  sequence: SelectionInfo
  /** Back to the block cards; also lets go of the sequence. */
  onBack: () => void
}

export function SequenceProperties({ figure, sequence, onBack }: Props) {
  const toasts = useToast()
  const expanded = useExpandedControls()
  const settings = sequence.sequence
  if (!settings) return null
  const steps = settings.steps
  const family = familyOf(settings.look)
  const own = FAMILY[family]
  const Picture = own.icon
  const fewest = minSteps(family)
  return (
    <>
      <PropertiesHeader backLabel="Back to blocks" picture={<Picture />} name={own.name} onBack={onBack} />
      {/* The labels and steps together in a card of their own. */}
      <div className="px-3 pt-1 pb-3">
      <PropRows className="rounded-lg border border-border bg-muted/40">
        <PropRow label="Labels">
          <SegmentedToggle
            label="Labels"
            options={LABELS_SHOWN}
            value={settings.labelsShown ? 'shown' : 'hidden'}
            onValueChange={(value) => figure?.setSequence({ labelsShown: value === 'shown' })}
            showLabels
            className="h-8 flex-1"
          />
        </PropRow>
        {/* Faded, not taken away, while labels are hidden: the text is kept for when they show again. */}
        {/* A cycle's middle text, e.g. "Cell cycle" (BIO-96). */}
        {family === 'cycle' && (
          <PropRow label="Middle">
            <div className={settings.labelsShown ? 'min-w-0 flex-1' : 'min-w-0 flex-1 opacity-40'}>
              <LiveTextField label="Middle text" value={settings.title ?? ''} placeholder="No text" onType={(title) => figure?.setSequence({ title }, 'sequence-title')} onDone={() => undefined} className="w-full" />
            </div>
          </PropRow>
        )}
        {Array.from({ length: steps }, (_, i) => (
          <PropRow key={i} label={own.step(i)}>
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              {/* The label field fades while labels are hidden; the remove button always works. */}
              <div className={settings.labelsShown ? 'min-w-0 flex-1' : 'min-w-0 flex-1 opacity-40'}>
                <LiveTextField label={`${own.step(i)} label`} value={settings.labels[i] ?? ''} placeholder="No label" onType={(text) => figure?.setStepLabel(i, text)} onDone={() => undefined} className="w-full" />
              </div>
              <IconButton
                icon={Minus}
                label={steps <= fewest ? KEEPS[family] : `Remove ${own.step(i).toLowerCase()}`}
                disabled={steps <= fewest}
                onClick={() => removeStepWithUndo(toasts, figure, i)}
              />
            </div>
          </PropRow>
        ))}
        <PropRow label={family === 'branch' ? 'Arms' : 'Steps'}>
          <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">{countText(family, steps)}</span>
            <Button variant="secondary" size="sm" className="gap-1.5" disabled={!canAddStep(family, steps)} title={canAddStep(family, steps) ? undefined : 'Branching has at most five arms'} onClick={() => figure?.addStep()}>
              <Plus aria-hidden="true" />
              {own.add}
            </Button>
          </div>
        </PropRow>
      </PropRows>
      </div>
      {/* A line between the steps and how they look; more room between these settings (before each one's label). */}
      <PropRows className="border-t border-border pt-3 [&>[data-prop-label=Gap]]:mt-3 [&>[data-prop-row=Gap]]:mt-3 [&>[data-wide-label]:not(:first-child)]:mt-3">
        {/* One Style setting: the four looks, and under them which way the row runs. */}
        <PropRow label="Style" wide>
          <div className="flex w-full flex-col gap-1.5">
            <div role="group" aria-label={`${own.name} style`} className={own.looks.length > 3 ? 'grid w-full grid-cols-4 gap-1.5' : 'grid w-full grid-cols-3 gap-1.5'}>
              {own.looks.map((look) => (
                <Tile key={look.id} name={look.name} short={look.name} on={settings.look === look.id} onClick={() => figure?.setSequence({ look: look.id })}>
                  <SequenceLookPicture look={look.id} colour={settings.colour} />
                </Tile>
              ))}
            </div>
            {family === 'sequence' && <SegmentedToggle label="Direction" options={DIRECTIONS} value={settings.direction} onValueChange={(direction) => figure?.setSequence({ direction })} showLabels className="h-8 w-full" />}
          </div>
        </PropRow>
        <PropRow label="Preset" wide>
          <PresetPicker
            groups={PRESET_GROUPS}
            row={ROW}
            look={swatchLook}
            isOn={(preset) => preset.colour === settings.colour.toLowerCase()}
            onPick={(preset) => figure?.setSequence({ colour: preset.colour })}
            columns={6}
            customLabel="Custom colour"
            custom={<ColourInput label="Sequence colour" value={settings.colour} onChange={(next) => next && figure?.setSequence({ colour: next })} used={() => figure?.usedColours() ?? []} className="min-w-0 flex-1" />}
          />
        </PropRow>
        <PropRow label="Gap">
          <Slider
            look={expanded ? 'bar' : undefined}
            label="Gap"
            hideLabel
            min={GAP_RANGE.min}
            max={GAP_RANGE.max}
            value={Math.round(settings.gap)}
            unit="px"
            onValueChange={(gap) => figure?.setSequence({ gap }, 'sequence-gap')}
            className="min-w-0 flex-1"
          />
        </PropRow>
      </PropRows>
      <div className="border-t border-border p-3">
        <Button variant="secondary" size="sm" className="w-full gap-1.5" onClick={() => detachSequenceWithUndo(toasts, figure, own.name)}>
          <Unlink aria-hidden="true" />
          Detach {own.name.toLowerCase()}
        </Button>
      </div>
    </>
  )
}
