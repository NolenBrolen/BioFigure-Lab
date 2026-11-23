/*
 * What every properties view in the left panel shares (design A, label-left
 * rows, with the header of design F; first built for shapes on 2026-11-12,
 * then used for arrows, text, icons, charts and tables): a header with a back
 * button, a small picture and the object's name; rows with the label in an
 * 84 px column on the left; a picker row of outlined buttons whose ⋯ button
 * opens every option beside the panel; and size and opacity rows.
 */
import { IconButton } from '@biofigure-lab/ui/components/icon-button/IconButton'
import { Popover } from '@biofigure-lab/ui/components/popover/Popover'
import { Slider } from '@biofigure-lab/ui/components/slider/Slider'
import { cn } from '@biofigure-lab/ui/lib/cn'
import { useExpandedControls } from '@biofigure-lab/ui/lib/expanded-controls'
import { ChevronLeft, Ellipsis, Link2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { MmField, NumberField } from './fields'

/** The header over an object's properties: back to the panel's tiles, and which object they belong to. */
export function PropertiesHeader({ backLabel, picture, name, onBack }: { backLabel: string; picture?: ReactNode; name: string; onBack: () => void }) {
  return (
    <div className="flex h-12 shrink-0 items-center gap-2 px-2">
      <IconButton icon={ChevronLeft} label={backLabel} onClick={onBack} />
      {picture && <span className="grid size-6 shrink-0 place-items-center text-muted-foreground [&>svg]:max-h-full [&>svg]:max-w-full">{picture}</span>}
      <span className="min-w-0 truncate text-sm font-semibold">{name}</span>
    </div>
  )
}

/** The grid the rows sit in: labels in an 84 px column, 52 px before the controls. */
export function PropRows({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-[5.25rem_minmax(0,1fr)] items-center gap-x-13 gap-y-1.5 px-3 py-3', className)}>{children}</div>
}

/**
 * A setting's label on the left and its controls on the right. Both carry the
 * setting's name, so the phone's property bar can list and open it on its own
 * (see `useRowFocus` in packages/ui). `off`: faded
 * out and out of reach, for a setting the object doesn't have (so the rows
 * below don't move). `top`: the label lines up with the top of taller controls.
 * `hideLabel`: the label only for screen readers, when the controls say it (like the Y axis / X axis tabs).
 * `wide`: the label on a line of its own, with the controls under it across the panel's whole width (the icon's Style tiles).
 */
export function PropRow({ label, off = false, top = false, hideLabel = false, wide = false, children }: { label: string; off?: boolean; top?: boolean; hideLabel?: boolean; wide?: boolean; children: ReactNode }) {
  return (
    <>
      <span data-prop-label={label} className={cn('text-xs text-muted-foreground', off && 'opacity-50', top && 'self-start pt-1', wide && 'col-span-2', hideLabel && 'sr-only')}>{label}</span>
      <div data-prop-row={label} inert={off} aria-disabled={off || undefined} className={cn('flex min-w-0 items-center gap-1.5', wide && 'col-span-2', off && 'opacity-50')}>
        {children}
      </div>
    </>
  )
}

/** A line of help under the rows, across both columns. */
export function PropNote({ children }: { children: ReactNode }) {
  return <p className="col-span-2 pt-1 text-xs text-muted-foreground">{children}</p>
}

export type PickerOption<T extends string> = { id: T; name: string; picture: ReactNode }

/**
 * One option to pick: its picture in an outlined button, the picked one blue.
 * `named`: its name under the picture (in the ⋯ popup), instead of only in its tooltip.
 */
function PickerButton<T extends string>({ option, on, onPick, named = false, wide = false }: { option: PickerOption<T>; on: boolean; onPick: (id: T) => void; named?: boolean; wide?: boolean }) {
  return (
    <button
      type="button"
      title={named ? undefined : option.name}
      aria-label={named ? undefined : option.name}
      aria-pressed={on}
      onClick={() => onPick(option.id)}
      className={cn(
        'rounded-md border transition-colors duration-(--duration-instant) focus-visible:outline-2 focus-visible:outline-ring',
        named ? cn('flex min-w-0 flex-col items-center justify-center px-1 py-2', wide ? 'h-20 gap-1.5' : 'aspect-square gap-3') : 'grid aspect-square place-items-center',
        on ? 'border-primary/25 bg-primary-subtle text-primary-subtle-foreground hover:bg-primary-subtle-hover' : 'border-border-strong bg-panel text-foreground hover:bg-muted',
      )}
    >
      {/* Smaller than the button, so wide pictures keep some room to its edge. */}
      <span className={cn('grid place-items-center [&>svg]:size-full', named ? (wide ? 'size-7 shrink-0' : 'size-8 shrink-0') : 'size-[60%]')}>{option.picture}</span>
      {/* In a row of a few wide tiles, a long name ("Header row and column") takes two lines rather than being cut off. */}
      {named && <span className={cn('w-full text-center text-[11px] leading-tight', wide ? 'line-clamp-2' : 'truncate', !on && 'text-muted-foreground')}>{option.name}</span>}
    </button>
  )
}

/**
 * Where a ⋯ popup opening to the right of its button starts: its top sits as
 * far above the button as a 155 px popup centred on it would (the shape
 * presets popup's height on 2026-11-12, when the owner picked this for the
 * More shapes popup). The presets popup uses it too since it grew
 * (2026-11-16), so both open at the same height instead of centred.
 */
export const popupAlignOffset = ({ anchor }: { anchor: { height: number } }) => -(155 - anchor.height) / 2

/**
 * A row of common options and a ⋯ button that opens all of them to its right,
 * three per row with their names (92 px square, 10 px apart). The picked
 * option takes the row's last place when it isn't one of the common ones.
 * `more={false}`: every option fits in the row, so there is no ⋯ button.
 */
export function OptionPicker<T extends string>({ title, options, rowIds, value, onPick, more = true }: { title: string; options: readonly PickerOption<T>[]; rowIds: readonly T[]; value?: T; onPick: (id: T) => void; more?: boolean }) {
  // The phone's sheet with this one setting open has room for every option, with its name.
  const expanded = useExpandedControls()
  if (expanded) {
    // Every option in one row (no ⋯): they share the row's width, as tall as four square ones (owner's call, 2026-11-17).
    const oneRow = !more && options.length <= 4
    return (
      <div role="group" aria-label={title} className="grid flex-1 grid-cols-4 gap-2" style={oneRow ? { gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` } : undefined}>
        {options.map((option) => (
          <PickerButton key={option.id} option={option} on={option.id === value} onPick={onPick} named wide={oneRow} />
        ))}
      </div>
    )
  }
  const ids = !more || value === undefined || rowIds.includes(value) ? rowIds : [...rowIds.slice(0, -1), value]
  const row = ids.flatMap((id) => options.find((option) => option.id === id) ?? [])
  return (
    <div className="grid flex-1 grid-cols-6 gap-1">
      {row.map((option) => (
        <PickerButton key={option.id} option={option} on={option.id === value} onPick={onPick} />
      ))}
      {more && <Popover
        title={title}
        side="right"
        align="start"
        alignOffset={popupAlignOffset}
        divider={false}
        className="w-auto"
        trigger={
          <button
            type="button"
            aria-label={`More ${title.toLowerCase()}`}
            title={`More ${title.toLowerCase()}`}
            className="grid aspect-square place-items-center rounded-md border border-input-border text-muted-foreground transition-colors duration-(--duration-instant) hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            <Ellipsis className="size-4" aria-hidden="true" />
          </button>
        }
      >
        <div className="grid grid-cols-[repeat(3,92px)] gap-2.5">
          {options.map((option) => (
            <PickerButton key={option.id} option={option} on={option.id === value} onPick={onPick} named />
          ))}
        </div>
      </Popover>}
    </div>
  )
}

export type SizeChange = { width?: number; height?: number }

/**
 * Width and height in mm (the unit is in the label, so the narrow fields keep
 * room for the numbers), with the keep-proportions link between them.
 */
export function SizeRow({ width, height, onResize }: { width: number; height: number; onResize: (change: SizeChange, keepProportions: boolean) => void }) {
  // On by default, like most drawing apps; kept while switching between objects.
  const [keep, setKeep] = useState(true)
  return (
    <PropRow label="Size (mm)">
      <MmField label="Width" prefix="W" hideUnit px={width} onCommit={(next) => onResize({ width: next }, keep)} className="min-w-0 flex-1" />
      <IconButton icon={Link2} label={keep ? 'Keep proportions: on' : 'Keep proportions: off'} pressed={keep} onClick={() => setKeep(!keep)} />
      <MmField label="Height" prefix="H" hideUnit px={height} onCommit={(next) => onResize({ height: next }, keep)} className="min-w-0 flex-1" />
    </PropRow>
  )
}

/**
 * A number setting that becomes a slider in a phone's sheet (BIO-11), like
 * corner radius or outline width; elsewhere the plain number field. The
 * slider stops at `sliderMax` (a sensible top for dragging); the field
 * still takes up to `max` typed.
 */
export function NumberOrSlider({ label, showLabel = false, value, suffix, min = 0, max, sliderMax = max, prefix, onCommit, className }: { label: string; showLabel?: boolean; value: number; suffix?: string; min?: number; max: number; sliderMax?: number; prefix?: ReactNode; onCommit: (value: number) => void; className?: string }) {
  const expanded = useExpandedControls()
  if (expanded) return <Slider look="bar" label={label} hideLabel={!showLabel} value={Math.min(Math.round(value), sliderMax)} min={min} max={sliderMax} unit={suffix} onValueChange={onCommit} className="min-w-0 flex-1" />
  return <NumberField label={label} prefix={prefix} value={value} suffix={suffix} min={min} max={max} onCommit={onCommit} className={className} />
}

/** How see-through the object is, in %. A slider where there is room (the phone's sheet with only opacity open). */
export function OpacityRow({ opacity, onChange, off }: { opacity: number; onChange: (opacity: number) => void; off?: boolean }) {
  const expanded = useExpandedControls()
  return (
    <PropRow label="Opacity" off={off}>
      {expanded ? (
        <Slider look="bar" label="Opacity" hideLabel value={Math.round(opacity * 100)} min={0} max={100} unit="%" onValueChange={(value) => onChange(value / 100)} className="min-w-0 flex-1" />
      ) : (
      <NumberField label="Opacity" value={Math.round(opacity * 100)} suffix="%" min={0} max={100} onCommit={(value) => onChange(value / 100)} className="w-[4.5rem]" />
      )}
    </PropRow>
  )
}
