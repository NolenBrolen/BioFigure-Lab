/*
 * The properties of a selected comparison block (BIO-95), or of one of its
 * sides, in the Blocks panel where its cards are:
 *
 * - Titles: one field per side, left to right, and Swap sides.
 * - Style: the three looks as small pictures in the block's colour.
 * - Between (Control vs Treatment): Nothing, Line or "vs"; Arrow label
 *   (Before / After, not in Split frame, whose divider is the arrow).
 * - Preset colours, as for sequences. Detach at the bottom, with Undo.
 */
import { Button } from '@biofigure-lab/ui/components/button/Button'
import { ColourInput } from '@biofigure-lab/ui/components/colour-input/ColourInput'
import { SegmentedToggle } from '@biofigure-lab/ui/components/segmented-toggle/SegmentedToggle'
import { useToast } from '@biofigure-lab/ui/components/toast/Toast'
import { ArrowLeftRight, Columns2, SeparatorVertical, Unlink } from 'lucide-react'

import { COMPARISON_KINDS, COMPARISON_LOOKS, type ComparisonBetween, type ComparisonKind, type ComparisonLook } from '../editor/comparison-block'
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

/** "vs" as a tiny picture, for the Between toggle. */
function VsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <text x="12" y="16" textAnchor="middle" fontSize="12" fontWeight="700" fontStyle="italic" fill="currentColor">
        vs
      </text>
    </svg>
  )
}

const BETWEEN = [
  { value: 'none', label: 'None', icon: Columns2 },
  { value: 'line', label: 'Line', icon: SeparatorVertical },
  { value: 'vs', label: 'vs', icon: VsIcon },
] as const

/** One look of a comparison, in its colour: what the Style tile makes. */
function ComparisonLookPicture({ look, kind, colour }: { look: ComparisonLook; kind: ComparisonKind; colour: string }) {
  const cell = (x: number, y = 19) => <rect x={x} y={y} width="7" height="7" rx="1.5" fill="currentColor" opacity="0.3" />
  const arrow = kind === 'change'
  return (
    <svg viewBox="0 0 48 36" className="size-full" aria-hidden="true">
      {look === 'twin' && (
        <>
          {[3, 28].map((x) => (
            <g key={x}>
              <rect x={x} y="8" width="17" height="21" rx="2.5" fill={wash(colour, 0.08)} stroke={colour} strokeWidth="1" />
              <path d={`M${x} 13V10.5A2.5 2.5 0 0 1 ${x + 2.5} 8H${x + 14.5}A2.5 2.5 0 0 1 ${x + 17} 10.5V13Z`} fill={colour} />
              {cell(x + 5)}
            </g>
          ))}
          {arrow && <path d="M21.5 20.5h2.5v-2l3 3-3 3v-2h-2.5Z" fill={colour} />}
        </>
      )}
      {look === 'paired' && (
        <>
          {[2, 29].map((x, i) => (
            <g key={x}>
              <rect x={x} y="8" width="17" height="21" rx={arrow ? 4 : 2.5} fill={arrow ? wash(i === 0 ? '#71717a' : colour, 0.16) : '#ffffff'} stroke={arrow ? 'none' : i === 0 ? '#71717a' : colour} strokeWidth="1" />
              {!arrow && <rect x={x + 2.5} y="6" width="8" height="4" rx="2" fill={i === 0 ? '#71717a' : colour} />}
              {cell(x + 5)}
            </g>
          ))}
          {arrow ? <path d="M20.5 22.5h5m-1.6-1.8 1.8 1.8-1.8 1.8" stroke="#27272a" strokeWidth="1" fill="none" strokeLinecap="round" /> : <path d="M24 9v19" stroke="#a1a1aa" strokeWidth="0.8" strokeDasharray="1.5 1.5" />}
        </>
      )}
      {look === 'split' && (
        <>
          <rect x="3" y="8" width="42" height="21" rx="3" fill="#ffffff" stroke={colour} strokeWidth="1" />
          {arrow ? (
            <>
              <path d="M22 8h20.5a2.5 2.5 0 0 1 2.5 2.5v16a2.5 2.5 0 0 1-2.5 2.5H22l4-10.5Z" fill={wash(colour, 0.14)} />
              <path d="M22 8l4 10.5-4 10.5" stroke={colour} strokeWidth="1" fill="none" />
            </>
          ) : (
            <path d="M24 8v21" stroke={colour} strokeWidth="1" />
          )}
          {[6, 32].map((x) => (
            <rect key={x} x={x + 3} y="10.5" width="6" height="1.6" rx="0.8" fill={shade(colour, 0.85)} />
          ))}
          {cell(9.5)}
          {cell(31.5)}
        </>
      )}
    </svg>
  )
}

type Props = {
  figure: FigureCanvas | null
  /** The selected comparison or side; its settings are in `selection.comparison`. */
  selection: SelectionInfo
  /** Back to the block cards; also lets go of the comparison. */
  onBack: () => void
}

export function ComparisonProperties({ figure, selection, onBack }: Props) {
  const toasts = useToast()
  const settings = selection.comparison
  if (!settings) return null
  const kind = COMPARISON_KINDS.find((each) => each.id === settings.kind) ?? COMPARISON_KINDS[0]
  const versus = settings.kind === 'versus'
  return (
    <>
      <PropertiesHeader backLabel="Back to blocks" picture={<Columns2 />} name={kind?.name ?? 'Comparison'} onBack={onBack} />
      <div className="px-3 pt-1 pb-3">
        <PropRows className="rounded-lg border border-border bg-muted/40">
          {settings.titles.map((title, i) => (
            <PropRow key={i} label={i === 0 ? 'Left' : i === 1 ? 'Right' : `Side ${i + 1}`}>
              <LiveTextField label={`${i === 0 ? 'Left' : 'Right'} title`} value={title} placeholder="No title" onType={(text) => figure?.setComparisonTitle(i, text)} onDone={() => undefined} className="w-full" />
            </PropRow>
          ))}
          <PropRow label="Sides">
            <Button variant="secondary" size="sm" className="w-full gap-1.5" disabled={settings.titles.length < 2} onClick={() => figure?.swapSides()}>
              <ArrowLeftRight aria-hidden="true" />
              Swap sides
            </Button>
          </PropRow>
        </PropRows>
      </div>
      <PropRows className="border-t border-border pt-3 [&>[data-wide-label]:not(:first-child)]:mt-3">
        <PropRow label="Style" wide>
          <div role="group" aria-label="Comparison style" className="grid w-full grid-cols-3 gap-1.5">
            {COMPARISON_LOOKS.map((look) => (
              <Tile key={look.id} name={look.name} short={look.name} on={settings.look === look.id} onClick={() => figure?.setComparison({ look: look.id })}>
                <ComparisonLookPicture look={look.id} kind={settings.kind} colour={settings.colour} />
              </Tile>
            ))}
          </div>
        </PropRow>
        {/* Only the rows that apply to this kind and look show. */}
        {versus && (
          <PropRow label="Between">
            <SegmentedToggle label="Between" options={BETWEEN} value={settings.between} onValueChange={(between: ComparisonBetween) => figure?.setComparison({ between })} showLabels className="h-8 flex-1" />
          </PropRow>
        )}
        {!versus && settings.look !== 'split' && (
          <PropRow label="Arrow label">
            <LiveTextField label="Arrow label" value={settings.arrowLabel} placeholder="e.g. + LPS, 24 h" onType={(arrowLabel) => figure?.setComparison({ arrowLabel }, 'comparison-arrow-label')} onDone={() => undefined} className="w-full" />
          </PropRow>
        )}
        <PropRow label="Preset" wide>
          <PresetPicker
            groups={PRESET_GROUPS}
            row={ROW}
            look={swatchLook}
            isOn={(preset) => preset.colour === settings.colour.toLowerCase()}
            onPick={(preset) => figure?.setComparison({ colour: preset.colour })}
            columns={6}
            customLabel="Custom colour"
            custom={<ColourInput label="Comparison colour" value={settings.colour} onChange={(next) => next && figure?.setComparison({ colour: next })} used={() => figure?.usedColours() ?? []} className="min-w-0 flex-1" />}
          />
        </PropRow>
      </PropRows>
      <div className="border-t border-border p-3">
        <Button variant="secondary" size="sm" className="w-full gap-1.5" onClick={() => detachSequenceWithUndo(toasts, figure, 'Comparison')}>
          <Unlink aria-hidden="true" />
          Detach comparison
        </Button>
      </div>
    </>
  )
}
