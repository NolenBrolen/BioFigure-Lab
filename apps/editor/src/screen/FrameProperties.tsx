/*
 * The Frame and Text tabs of a selected icon (BIO-73). Redone from the
 * owner's notes of 2026-11-25:
 *
 * - Style: every style at once (No frame and the five), under the label and
 *   across the panel, two rows of named tiles.
 * - Preset: two rows of presets across the panel; ⋯ opens them all, with the
 *   custom fill and outline above them. Switching style keeps a picked preset
 *   (FigureCanvas.addFrame).
 * - Caption place, then Corners and Padding side by side.
 * - The Text tab (once there is a frame): the caption's text box on top, then
 *   the text tool's own settings, styling the whole caption.
 *
 * The style and caption tiles use stand-in pictures (frame-pictures.tsx), not
 * the selected icon and its name.
 */
import { ColourInput } from '@biofigure-lab/ui/components/colour-input/ColourInput'
import { cn } from '@biofigure-lab/ui/lib/cn'
import type { ReactNode } from 'react'

import type { FigureCanvas, SelectionInfo } from '../editor/FigureCanvas'
import { FRAME_STYLES, type CaptionPlace, type FrameStyle } from '../editor/icon-card'
import { TextStyleControls } from './TextView'
import { LiveTextArea, NumberField } from './fields'
import { CaptionPicture, StylePicture } from './frame-pictures'
import { PropRow, PropRows } from './properties-pane'
import { Presets, RoundCorner } from './ShapeProperties'

type StyleId = FrameStyle | 'none'

const STYLES: readonly { id: StyleId; name: string }[] = [{ id: 'none', name: 'No frame' }, ...FRAME_STYLES]

const CAPTIONS: readonly { id: CaptionPlace; name: string; short: string }[] = [
  { id: 'none', name: 'No caption', short: 'None' },
  { id: 'below', name: 'Under the frame', short: 'Under' },
  { id: 'inside', name: 'Inside, under the icon', short: 'Inside' },
  { id: 'beside', name: 'Beside the icon', short: 'Beside' },
]

/** The caption places each style can use; the others fade out (a circle has no room inside or beside, a header card's caption is its strip). */
const CAPTION_FITS: Record<FrameStyle, readonly CaptionPlace[]> = {
  tile: ['none', 'below', 'inside', 'beside'],
  outlined: ['none', 'below', 'inside', 'beside'],
  circle: ['none', 'below'],
  chip: ['none', 'below', 'beside'],
  header: ['none', 'inside'],
}

/** The presets in the row: eight light ones, four outlined, three neutral; ⋯ makes sixteen. */
const ROW_PRESETS = [
  'Blue',
  'Sky',
  'Teal',
  'Olive',
  'Yellow',
  'Orange',
  'Vermilion',
  'Purple',
  'Blue, outline',
  'Teal, outline',
  'Orange, outline',
  'Purple, outline',
  'Grey',
  'White',
  'Outline only',
]

/** A box inside a dashed box: the space between the icon and the frame, shown in the Padding field. */
function PaddingIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" strokeDasharray="2.5 3" />
      <rect x="8.5" y="8.5" width="7" height="7" rx="1" />
    </svg>
  )
}

/** A picture tile with its name under it, the picked one blue (also the panel styles, PanelProperties). */
export function Tile({ name, short, on, off = false, onClick, children }: { name: string; short: string; on: boolean; off?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={off ? `${name} (doesn't fit this frame style)` : name}
      aria-label={name}
      aria-pressed={on}
      disabled={off}
      onClick={onClick}
      className={cn(
        'disabled:pointer-events-none disabled:opacity-40',
        'flex min-w-0 flex-col items-center gap-0.5 rounded-md border px-1 pt-1.5 pb-1 transition-colors duration-(--duration-instant) focus-visible:outline-2 focus-visible:outline-ring',
        on ? 'border-primary/25 bg-primary-subtle text-primary-subtle-foreground hover:bg-primary-subtle-hover' : 'border-border-strong bg-panel text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <span className="block h-9 w-full">{children}</span>
      <span className="truncate text-[11px] leading-tight">{short}</span>
    </button>
  )
}

/** A label above its field, for two fields sharing a row. */
function SmallField({ label, off = false, children }: { label: string; off?: boolean; children: ReactNode }) {
  return (
    <div inert={off} aria-disabled={off || undefined} className={cn('flex min-w-0 flex-col gap-1', off && 'opacity-50')}>
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

/** A label and its control, inside the presets popup. */
export function CustomRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex min-w-0 items-center">{children}</div>
    </div>
  )
}

type Props = {
  figure: FigureCanvas | null
  icon: SelectionInfo
}

/** No frame and the five frame styles as picture tiles, three to a row; also the quick-actions bar's Frame widget (BIO-82). */
export function FrameStyleTiles({ figure, icon, className, onPicked }: Props & { className?: string; /** After a pick, e.g. to close the bar's widget. */ onPicked?: () => void }) {
  const style = icon.frame?.style ?? 'none'
  const pick = (id: StyleId) => {
    if (id === 'none') figure?.removeFrame()
    else figure?.addFrame(id)
    onPicked?.()
  }
  return (
    <div role="group" aria-label="Frame style" className={cn('grid w-full grid-cols-3 gap-1.5', className)}>
      {STYLES.map((each) => (
        <Tile key={each.id} name={each.name} short={each.name} on={style === each.id} onClick={() => pick(each.id)}>
          <StylePicture style={each.id} />
        </Tile>
      ))}
    </div>
  )
}

export function FrameRows({ figure, icon }: Props) {
  const frame = icon.frame ?? undefined

  return (
    <>
      <PropRow label="Style" wide>
        <FrameStyleTiles figure={figure} icon={icon} />
      </PropRow>
      <PropRow label="Preset" wide off={!frame}>
        <Presets
          fill={frame?.fill ?? ''}
          stroke={frame?.outline ?? undefined}
          open={false}
          rowNames={ROW_PRESETS}
          columns={8}
          onPick={(preset) => figure?.setFrame({ fill: preset.fill || null, outline: preset.stroke })}
          custom={
            <>
              <CustomRow label="Fill">
                <ColourInput label="Frame fill" look="fill" value={frame?.fill ?? undefined} noneLabel="No fill" onChange={(fill) => figure?.setFrame({ fill })} used={() => figure?.usedColours() ?? []} className="min-w-0 flex-1" />
              </CustomRow>
              <CustomRow label="Outline">
                <ColourInput label="Frame outline" look="outline" value={frame?.outline ?? undefined} noneLabel="No outline" onChange={(outline) => figure?.setFrame({ outline })} used={() => figure?.usedColours() ?? []} className="min-w-0 flex-1" />
              </CustomRow>
            </>
          }
        />
      </PropRow>
      <PropRow label="Caption" wide off={!frame}>
        <div role="group" aria-label="Caption" className="grid w-full grid-cols-4 gap-1.5">
          {CAPTIONS.map((place) => (
            <Tile
              key={place.id}
              name={place.name}
              short={place.short}
              on={frame?.caption === place.id}
              off={frame !== undefined && !CAPTION_FITS[frame.style].includes(place.id)}
              onClick={() => figure?.setFrame({ caption: place.id })}
            >
              <CaptionPicture place={place.id} />
            </Tile>
          ))}
        </div>
      </PropRow>
      {/* Corners and padding side by side, labels above their fields (the owner's pick, 2026-11-25). */}
      <PropRow label="Corners and padding" wide hideLabel off={!frame}>
        <div className="grid w-full grid-cols-2 gap-3">
          {/* Faded for frames without corners (circle, pill), so nothing moves. */}
          <SmallField label="Corners" off={frame !== undefined && frame.shape !== 'rounded' && frame.shape !== 'square'}>
            <NumberField label="Corner radius" prefix={<RoundCorner />} value={frame?.shape === 'square' ? 0 : (frame?.corners ?? 0)} suffix="px" min={0} max={200} onCommit={(corners) => figure?.setFrame({ corners, shape: corners === 0 ? 'square' : 'rounded' })} className="w-full" />
          </SmallField>
          <SmallField label="Padding">
            <NumberField label="Padding" prefix={<PaddingIcon />} value={frame?.padding ?? 0} suffix="px" min={0} max={200} onCommit={(padding) => figure?.setFrame({ padding })} className="w-full" />
          </SmallField>
        </div>
      </PropRow>
    </>
  )
}

/** The Text tab of a framed icon: the caption's text, then the text tool's settings for it. */
export function CaptionTextRows({ figure, icon }: Props) {
  const frame = icon.frame
  if (!frame) return null
  return (
    <>
      <PropRows className="pb-0">
        <PropRow label="Text" wide>
          <LiveTextArea label="Caption text" value={frame.captionText} placeholder={icon.name} rows={3} enterIsNewLine onType={(text) => figure?.setCaption(text)} onDone={() => undefined} className="w-full" />
        </PropRow>
      </PropRows>
      <TextStyleControls figure={figure} style={frame.captionStyle} forCaption className="pb-3" />
    </>
  )
}
