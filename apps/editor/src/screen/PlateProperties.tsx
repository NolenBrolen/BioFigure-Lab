/*
 * The properties of a selected well plate map (BIO-98), in the Blocks panel
 * where its cards are:
 *
 * - Conditions first: each with its colour (the preset squares), its name,
 *   how many wells it has and a − that removes it (Undo toast). Clicking a
 *   condition (or its brush) paints with it: then a click or a box dragged
 *   over wells gives them that condition, and a row letter or column number
 *   fills the row or column. "Empty" clears wells. Add condition paints with
 *   the new one straight away. In the Labelled look each also has the short
 *   label drawn in its wells.
 * - Style: Plate | Grid | Labelled. Wells: 6 to 384, as small plates.
 * - Labels and legend on or off. Detach at the bottom, with an Undo toast.
 */
import { Button } from '@biofigure-lab/ui/components/button/Button'
import { ColourMenu } from '@biofigure-lab/ui/components/colour-input/ColourInput'
import { IconButton } from '@biofigure-lab/ui/components/icon-button/IconButton'
import { useToast } from '@biofigure-lab/ui/components/toast/Toast'
import { Toggle } from '@biofigure-lab/ui/components/toggle/Toggle'
import { cn } from '@biofigure-lab/ui/lib/cn'
import { Eraser, Grid3x3, Minus, Paintbrush, Plus, Ungroup } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'

import type { FigureCanvas, SelectionInfo } from '../editor/FigureCanvas'
import { PLATE_LOOKS, PLATE_SIZES, plateSvg, type PlateLook } from '../editor/well-plate'
import { LiveTextField } from './fields'
import { Tile } from './FrameProperties'
import { PropertiesHeader, PropRow, PropRows } from './properties-pane'

type Toasts = ReturnType<typeof useToast>

function undoToast(toasts: Toasts, figure: FigureCanvas, title: string): void {
  const toastId = toasts.add({
    title,
    actionProps: {
      children: 'Undo',
      onClick: () => {
        toasts.close(toastId)
        figure.undo()
      },
    },
  })
}

/** A look as a small picture: the same plate as its card in the Blocks list. */
function LookPicture({ look }: { look: PlateLook }) {
  const svg = useMemo(() => plateSvg(look, 24), [look])
  return <span aria-hidden="true" className="block size-full" dangerouslySetInnerHTML={{ __html: svg }} />
}

/** A plate size as a tiny grid of its wells, so 6 and 384 look different. */
function SizePicture({ rows, cols, on }: { rows: number; cols: number; on: boolean }) {
  const pitch = Math.min(28 / cols, 18 / rows)
  const x0 = (32 - pitch * cols) / 2
  const y0 = (22 - pitch * rows) / 2
  return (
    <svg viewBox="0 0 32 22" className="h-[18px] w-[26px]" aria-hidden="true">
      {Array.from({ length: rows * cols }, (_, i) => (
        <circle key={i} cx={x0 + (i % cols) * pitch + pitch / 2} cy={y0 + Math.floor(i / cols) * pitch + pitch / 2} r={pitch * 0.38} fill={on ? '#0072b2' : '#a1a1aa'} />
      ))}
    </svg>
  )
}

/** One condition's line; a click anywhere but its controls paints with it. */
function ConditionLine({ active, onPick, children }: { active: boolean; onPick: () => void; children: ReactNode }) {
  return (
    <div
      onClick={(event) => {
        if ((event.target as Element).closest('button, input')) return
        onPick()
      }}
      className={cn('flex h-10 cursor-pointer items-center gap-1.5 rounded-md border px-1', active ? 'border-primary/40 bg-primary-subtle' : 'border-transparent hover:bg-muted')}
    >
      {children}
    </div>
  )
}

type Props = {
  figure: FigureCanvas | null
  /** The selected plate; its settings are in `plate.plate`. */
  plate: SelectionInfo
  /** Back to the block cards; also lets go of the plate. */
  onBack: () => void
}

export function PlateProperties({ figure, plate, onBack }: Props) {
  const toasts = useToast()
  const settings = plate.plate
  if (!settings) return null
  const counts = new Map<string, number>()
  for (const id of Object.values(settings.map)) counts.set(id, (counts.get(id) ?? 0) + 1)
  const empty = settings.wells - Object.keys(settings.map).length
  // Clicking the condition already painted with stops painting.
  const pick = (id: string | null) => figure?.setPlateBrush(settings.brush === id ? undefined : id)
  return (
    <>
      <PropertiesHeader backLabel="Back to blocks" picture={<Grid3x3 />} name="Well plate" onBack={onBack} />
      <div className="px-3 pt-1 pb-3">
        <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-muted/40 p-1.5">
          <div className="flex items-center justify-between px-1 pb-1 text-xs text-muted-foreground">
            <span>Conditions</span>
            <span>Wells</span>
          </div>
          <ConditionLine active={settings.brush === null} onPick={() => pick(null)}>
            <IconButton icon={Eraser} size="sm" label="Empty wells" pressed={settings.brush === null} onClick={() => pick(null)} />
            <span className="min-w-0 flex-1 truncate px-1 text-sm text-muted-foreground">Empty</span>
            <span className="w-8 text-right text-xs text-muted-foreground tabular-nums">{empty}</span>
            <span className="size-8 shrink-0" />
          </ConditionLine>
          {settings.conditions.map((condition) => (
            <ConditionLine key={condition.id} active={settings.brush === condition.id} onPick={() => pick(condition.id)}>
              <IconButton icon={Paintbrush} size="sm" label={`Paint wells with ${condition.name}`} pressed={settings.brush === condition.id} onClick={() => pick(condition.id)} />
              <ColourMenu
                label={`Colour of ${condition.name}`}
                value={condition.colour}
                onChange={(colour) => colour && figure?.updatePlateCondition(condition.id, { colour })}
                used={() => figure?.usedColours() ?? []}
                trigger={<button type="button" aria-label={`Colour of ${condition.name}`} className="size-6 shrink-0 rounded-full border border-black/15" style={{ background: condition.colour }} />}
              />
              {settings.look === 'labelled' && (
                <LiveTextField label={`Label in the wells for ${condition.name}`} value={condition.short} placeholder="–" onType={(short) => figure?.updatePlateCondition(condition.id, { short: short.slice(0, 4) }, `plate-short-${condition.id}`)} onDone={() => undefined} className="w-12 shrink-0" />
              )}
              <LiveTextField label={`Name of ${condition.name}`} value={condition.name} placeholder="Condition" onType={(name) => figure?.updatePlateCondition(condition.id, { name }, `plate-name-${condition.id}`)} onDone={() => undefined} className="min-w-0 flex-1" />
              <span className="w-8 text-right text-xs text-muted-foreground tabular-nums">{counts.get(condition.id) ?? 0}</span>
              <IconButton
                icon={Minus}
                size="sm"
                label={`Remove ${condition.name}`}
                onClick={() => {
                  if (figure?.removePlateCondition(condition.id)) undoToast(toasts, figure, `${condition.name} removed`)
                }}
              />
            </ConditionLine>
          ))}
          <Button variant="ghost" size="sm" className="mt-1 justify-start gap-1.5" onClick={() => figure?.addPlateCondition()}>
            <Plus aria-hidden="true" />
            Add condition
          </Button>
        </div>
      </div>
      <PropRows className="border-t border-border pt-3 [&>[data-wide-label]:not(:first-child)]:mt-3">
        <PropRow label="Style" wide>
          <div role="group" aria-label="Plate style" className="grid w-full grid-cols-3 gap-1.5">
            {PLATE_LOOKS.map((look) => (
              <Tile key={look.id} name={look.name} short={look.name} on={settings.look === look.id} onClick={() => figure?.setPlate({ look: look.id })}>
                <LookPicture look={look.id} />
              </Tile>
            ))}
          </div>
        </PropRow>
        <PropRow label="Wells" wide>
          <div role="group" aria-label="Number of wells" className="grid w-full grid-cols-6 gap-1">
            {PLATE_SIZES.map((size) => {
              const on = size.wells === settings.wells
              return (
                <button
                  key={size.wells}
                  type="button"
                  title={`${size.wells}-well plate`}
                  aria-label={`${size.wells} wells`}
                  aria-pressed={on}
                  onClick={() => figure?.setPlate({ wells: size.wells })}
                  className={cn(
                    'flex flex-col items-center gap-0.5 rounded-md border px-0.5 pt-1 pb-0.5 transition-colors duration-(--duration-instant) focus-visible:outline-2 focus-visible:outline-ring',
                    on ? 'border-primary/25 bg-primary-subtle text-primary-subtle-foreground' : 'border-border-strong bg-panel text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <SizePicture rows={size.rows} cols={size.cols} on={on} />
                  <span className="text-[10px] leading-none tabular-nums">{size.wells}</span>
                </button>
              )
            })}
          </div>
        </PropRow>
        <PropRow label="Labels">
          <Toggle label="Row letters and column numbers" hideLabel checked={settings.labels} onCheckedChange={(labels) => figure?.setPlate({ labels })} />
        </PropRow>
        <PropRow label="Legend">
          <Toggle label="Legend" hideLabel checked={settings.legend} onCheckedChange={(legend) => figure?.setPlate({ legend })} />
        </PropRow>
      </PropRows>
      <div className="border-t border-border p-3">
        <Button
          variant="secondary"
          size="sm"
          className="w-full gap-1.5"
          onClick={() => {
            if (figure?.detachPlate()) undoToast(toasts, figure, 'Plate detached')
          }}
        >
          <Ungroup aria-hidden="true" />
          Detach plate
        </Button>
      </div>
    </>
  )
}
