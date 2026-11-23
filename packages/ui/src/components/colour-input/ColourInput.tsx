/*
 * Colour input (design G2/G3, picked 2026-11-12): one outlined field with a
 * button on the left that shows the colour, and the hex code to type on the
 * right (no #). The button opens a dropdown of swatches: the hex code again,
 * the screen colour picker (where the browser has one), a "none" button, the
 * colours already used in the figure and a fixed palette, plus "Any
 * colour…" for the browser's full colour picker. The dropdown stays open
 * while you try colours; clicking outside or Escape closes it.
 *
 * `ColourMenu` is the same dropdown on any button, such as the highlight
 * button in the text controls.
 *
 * Inside `ExpandedControls` (the phone's sheet with one colour setting open,
 * where there is room) the field shows the dropdown's contents right away,
 * swatches and all, instead of behind its button. There the + ("any colour")
 * swaps the swatches for a colour area and hue strip in the sheet itself
 * (react-colorful), with the hex code and screen picker under it, rather
 * than the system's colour popup. Its "none" button (like "No fill") sits at
 * the right of the sheet's title (owner's call, 2026-11-17).
 */
import { Ban, ChevronLeft, Pipette, Plus } from 'lucide-react'
import { HexColorPicker } from 'react-colorful'
import { useRef, useState, type KeyboardEvent, type ReactElement, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { cn } from '../../lib/cn'
import { useExpandedControls } from '../../lib/expanded-controls'
import { useSheetTitleEnd } from '../../lib/sheet-title'
import { Popover, type PopoverProps } from '../popover/Popover'
import { inputBoxClass } from '../text-field/TextField'
import { Tooltip } from '../tooltip/Tooltip'

/**
 * Colour-blind friendly: the Okabe-Ito colours (Okabe & Ito 2008, recommended
 * by Nature Methods; the charts use them too) plus Paul Tol's indigo as a
 * violet, instead of the pure red and green most colour-blind readers mix up.
 * Columns: grey, blue, sky blue, teal (bluish green), yellow, orange,
 * vermilion, purple (reddish purple), violet. Rows run light to dark: a pale
 * tint (82% white), a soft tint (50% white), the colour itself, and a dark
 * shade (50% black).
 */
export const PALETTE: readonly string[] = [
  ...['#f4f4f5', '#d1e6f1', '#e1f2fb', '#d1eee6', '#fcfadd', '#fbeed1', '#f7e2d1', '#f6e7ef', '#dad7ea'],
  ...['#d4d4d8', '#80b8d8', '#abdaf4', '#80ceb9', '#f8f2a0', '#f2cf80', '#eaae80', '#e6bcd3', '#9990c3'],
  ...['#71717a', '#0072b2', '#56b4e9', '#009e73', '#f0e442', '#e69f00', '#d55e00', '#cc79a7', '#332288'],
  ...['#18181b', '#003959', '#2b5a74', '#004f3a', '#787221', '#735000', '#6a2f00', '#663c54', '#1a1144'],
]

/** A typed hex code ("1F2937", "#1f2937" or "fff") as "#rrggbb", or undefined if it isn't one. */
export function readHex(text: string): string | undefined {
  const value = text.trim().replace(/^#/, '').toLowerCase()
  if (/^[0-9a-f]{6}$/.test(value)) return `#${value}`
  if (/^[0-9a-f]{3}$/.test(value)) return `#${[...value].map((digit) => digit + digit).join('')}`
  return undefined
}

type EyeDropperWindow = Window & { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }

const blurOnEnter = (event: KeyboardEvent<HTMLInputElement>) => {
  if (event.key === 'Enter') event.currentTarget.blur()
}

/** A bare hex input: applies a valid code when you press Enter or leave it, else shows the old one again. */
function HexInput({ label, value, onChange, className, disabled }: { label: string; value?: string; onChange: (colour: string) => void; className?: string; disabled?: boolean }) {
  const shown = value?.slice(1).toUpperCase() ?? ''
  return (
    <input
      // A new key resets the field when the colour changes elsewhere.
      key={shown}
      aria-label={label}
      defaultValue={shown}
      placeholder="None"
      disabled={disabled}
      spellCheck={false}
      onKeyDown={blurOnEnter}
      onBlur={(event) => {
        const next = readHex(event.target.value)
        if (next && next !== value) onChange(next)
        else event.target.value = shown
      }}
      className={cn('h-full w-full min-w-0 bg-transparent text-sm text-foreground tabular-nums uppercase outline-none placeholder:text-muted-foreground placeholder:normal-case', className)}
    />
  )
}

function Swatch({ colour, picked, onPick }: { colour: string; picked: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      aria-label={colour.toUpperCase()}
      aria-pressed={picked}
      onClick={onPick}
      style={{ background: colour }}
      className={cn(
        'aspect-square w-full rounded-[4px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.15)]',
        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
        picked && 'ring-2 ring-primary ring-offset-2 ring-offset-popover',
      )}
    />
  )
}

type SwatchPanelProps = {
  label: string
  value?: string
  onChange: (colour: string | null) => void
  /** Shows a button to take the colour away, e.g. "No fill". */
  noneLabel?: string
  /** The colours already in the figure, read when the dropdown opens. */
  used?: () => readonly string[]
}

/**
 * `aside`: more controls at the end of the top row, e.g. an outline's width.
 * `inline` (a phone's sheet): just the swatches, with "No colour", `aside`
 * and `end` in a top row of their own; the hex field lives in the "any
 * colour" view the + opens.
 */
function SwatchPanel({ label, value, onChange, noneLabel, used, aside, end, inline = false }: SwatchPanelProps & { aside?: ReactNode; end?: ReactNode; inline?: boolean }) {
  // Read once per opening: the dropdown's content mounts when it opens.
  // Eight, so the "any colour" button fits in the same row of nine.
  const [inFigure] = useState(() => used?.().slice(0, 8) ?? [])
  const picker = useRef<HTMLInputElement>(null)
  // Phones: the "any colour" view is open in place of the swatches.
  const [custom, setCustom] = useState(false)
  const eyeDropper = (window as EyeDropperWindow).EyeDropper
  const panel = useRef<HTMLDivElement>(null)
  const titleEnd = useSheetTitleEnd(panel)
  const none = noneLabel && (
    <PanelButton label={noneLabel} pressed={!value} onClick={() => onChange(null)}>
      <Ban className="size-4" strokeWidth={1.75} aria-hidden="true" />
    </PanelButton>
  )
  const hexRow = (
    <div className="flex items-center gap-1">
        <div className={cn(inputBoxClass, 'flex-1')}>
          <span aria-hidden="true" className="size-4 shrink-0 rounded-sm shadow-[inset_0_0_0_1px_rgb(0_0_0/0.2)]" style={value ? { background: value } : undefined} />
          <HexInput label={`${label} hex code`} value={value} onChange={onChange} />
        </div>
        {eyeDropper && (
          <PanelButton
            label="Pick from the screen"
            onClick={() => {
              new eyeDropper()
                .open()
                .then((result) => onChange(readHex(result.sRGBHex) ?? result.sRGBHex))
                .catch(() => undefined) // Escape cancels the picker.
            }}
          >
            <Pipette className="size-4" strokeWidth={1.75} aria-hidden="true" />
          </PanelButton>
        )}
        {!inline && none}
        {!inline && aside}
      </div>
  )
  // Inline, the palette sits right under the setting's own label, so it needs none of its own.
  const swatches = (name: string, colours: readonly string[], titled = true, extra?: ReactNode) => (
    <div role="group" aria-label={name} className="flex flex-col gap-1">
      {titled && <span className="text-xs text-muted-foreground">{name}</span>}
      <div className="grid grid-cols-9 gap-1">
        {colours.map((colour) => (
          <Swatch key={colour} colour={colour} picked={colour === value} onPick={() => onChange(colour)} />
        ))}
        {extra}
      </div>
    </div>
  )
  // Opens the system colour picker, for a colour outside the palette.
  const anyColour = (
    <Tooltip label="Any colour">
      <button
        type="button"
        aria-label="Any colour"
        onClick={() => (inline ? setCustom(true) : picker.current?.click())}
        className="relative grid aspect-square w-full place-items-center rounded-[4px] border border-dashed text-muted-foreground transition-colors duration-(--duration-instant) hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
      >
        <Plus className="size-4" strokeWidth={1.75} aria-hidden="true" />
        <input
          ref={picker}
          type="color"
          tabIndex={-1}
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-0 size-0 opacity-0"
          value={value ?? '#000000'}
          onChange={(event) => onChange(event.target.value)}
        />
      </button>
    </Tooltip>
  )
  if (inline && custom) {
    return (
      <div role="group" aria-label="Any colour" className="flex flex-col gap-3">
        <button type="button" onClick={() => setCustom(false)} className="-ml-1 flex h-8 items-center gap-1 self-start rounded-md pr-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
          <ChevronLeft className="size-4" strokeWidth={1.75} aria-hidden="true" />
          Swatches
        </button>
        <HexColorPicker
          color={value ?? '#000000'}
          onChange={onChange}
          aria-label={`${label}: any colour`}
          // Full width and big pointers, for fingers (the `any-colour` rules in theme.css).
          className="any-colour"
        />
        {hexRow}
      </div>
    )
  }
  return (
    <div ref={panel} className="flex flex-col gap-2">
      {inline && titleEnd && none && createPortal(none, titleEnd)}
      {inline ? ((titleEnd ? undefined : none) || aside || end) && <div className="flex items-end justify-end gap-1">{aside}{!titleEnd && none}{end}</div> : hexRow}
      {/* Without the figure's colours (`used` left out), the "any colour" button ends the palette. */}
      {inline && swatches('Palette', PALETTE, false, used ? undefined : anyColour)}
      {(used || !inline) && swatches('In this figure', inFigure, true, anyColour)}
      {!inline && swatches('Palette', PALETTE)}
    </div>
  )
}

function PanelButton({ label, pressed, onClick, children }: { label: string; pressed?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={pressed}
        onClick={onClick}
        className={cn(
          'grid size-(--control-height) shrink-0 place-items-center rounded-md text-muted-foreground transition-colors duration-(--duration-instant) hover:bg-muted hover:text-foreground',
          pressed && 'bg-primary-subtle text-primary-subtle-foreground',
        )}
      >
        {children}
      </button>
    </Tooltip>
  )
}

export type ColourMenuProps = SwatchPanelProps & { trigger: ReactElement; /** Where the popup opens; below the button by default. */ side?: 'bottom' | 'right'; align?: 'start' | 'center'; alignOffset?: PopoverProps['alignOffset'] }

/** The swatch dropdown, opened by any button. */
export function ColourMenu({ trigger, side, align, alignOffset, ...panel }: ColourMenuProps) {
  return (
    <Popover title={panel.label} trigger={trigger} side={side} align={align} alignOffset={alignOffset} className="w-64">
      <SwatchPanel {...panel} />
    </Popover>
  )
}

/** What the button shows: a filled shape, an outline, or a plain swatch. */
export type ColourLook = 'fill' | 'outline' | 'swatch'

function Preview({ look, colour }: { look: ColourLook; colour?: string }) {
  const none = !colour
  if (look === 'swatch') {
    return (
      <span
        className={cn('size-4 rounded-sm shadow-[inset_0_0_0_1px_rgb(0_0_0/0.2)]', none && 'bg-[linear-gradient(135deg,transparent_44%,var(--destructive)_44%,var(--destructive)_56%,transparent_56%)]')}
        style={colour ? { background: colour } : undefined}
      />
    )
  }
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      {look === 'fill' ? (
        <rect x="2" y="4" width="20" height="16" rx="4" fill={colour ?? 'none'} className="stroke-input-border" strokeWidth="1" strokeDasharray={none ? '2 2' : undefined} />
      ) : (
        <rect x="3.5" y="5.5" width="17" height="13" rx="3" fill="none" stroke={colour ?? 'currentColor'} strokeWidth="3" strokeDasharray={none ? '2 2' : undefined} />
      )}
    </svg>
  )
}

export type ColourInputProps = SwatchPanelProps & {
  /** A control that belongs with the colour, e.g. the outline's width: after the field, or in the swatches' top row when they show inline. */
  aside?: ReactNode
  /** A control after the field, e.g. "Original colours"; beside the hex code when the swatches show inline. */
  end?: ReactNode
  look?: ColourLook
  disabled?: boolean
  className?: string
}

export function ColourInput({ look = 'swatch', disabled, className, aside, end, ...panel }: ColourInputProps) {
  const inline = useExpandedControls()
  if (inline) {
    return (
      // Its own full-width line (the row wraps), whatever size the field is given in its row.
      <div className={cn('w-full min-w-0 shrink-0 basis-full', disabled && 'pointer-events-none opacity-50')}>
        <SwatchPanel {...panel} aside={aside} end={end} inline />
      </div>
    )
  }
  return (
    <>
      <div className={cn(inputBoxClass, 'gap-0 pl-0', disabled && 'pointer-events-none opacity-50', className)}>
        <ColourMenu
          {...panel}
          trigger={
            <button
              type="button"
              disabled={disabled}
              aria-label={`${panel.label} colours`}
              className="flex h-full shrink-0 items-center gap-0.5 rounded-l-[5px] border-r pr-1 pl-1.5 text-muted-foreground transition-colors duration-(--duration-instant) hover:bg-muted data-popup-open:bg-muted"
            >
              <Preview look={look} colour={panel.value} />
              <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          }
        />
        <HexInput label={panel.label} value={panel.value} onChange={panel.onChange} disabled={disabled} className="pl-2" />
      </div>
      {aside}
      {end}
    </>
  )
}
