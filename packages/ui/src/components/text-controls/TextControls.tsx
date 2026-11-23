/*
 * Text controls: the sidebar sections for styling text (picked design D).
 *
 * Text: font (a dropdown with search), weight and size side by side; one
 * strip of bold, italic, underline, strikethrough, subscript and superscript;
 * then text colour and highlight. Paragraph: alignment, line and letter
 * spacing, with labels. Symbols: Greek letters and signs, inserted where the
 * text cursor is.
 *
 * `rows` (the Text tab of the Shapes panel, design A with tabs from F, tried
 * 2026-11-12): one row per setting with its label on the left: font, style
 * (weight and size), bold / italic / underline with a ⋯ button whose menu
 * has strikethrough, subscript and superscript as tiles, colour and highlight, alignment, line
 * and letter spacing, and one row of symbols with a button for the rest.
 *
 * Pressing the buttons doesn't take the keyboard away from the text being
 * typed, so the characters selected on the page stay selected.
 */
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Highlighter,
  Ellipsis,
  Italic,
  Minus,
  Plus,
  SlidersHorizontal,
  Strikethrough,
  Subscript,
  Superscript,
  Underline,
  UnfoldHorizontal,
  UnfoldVertical,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useRef, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'

import { cn } from '../../lib/cn'
import { useExpandedControls } from '../../lib/expanded-controls'
import { ColourInput, ColourMenu } from '../colour-input/ColourInput'
import { IconButton } from '../icon-button/IconButton'
import { DropdownMenu } from '../menu/Menu'
import { Popover } from '../popover/Popover'
import { Select } from '../select/Select'
import { Slider } from '../slider/Slider'
import { TextField } from '../text-field/TextField'
import { Tooltip } from '../tooltip/Tooltip'
import { FontPicker, type FontOption } from './FontPicker'

export type TextScript = 'none' | 'sub' | 'super'
export type TextAlignValue = 'left' | 'center' | 'right' | 'justify'

export type TextControlsValue = {
  font: string
  weight: number
  /** Bold, apart from the weight: drawn heavier than the weight picked. */
  bold: boolean
  /** In points. */
  size: number
  italic: boolean
  underline: boolean
  strikethrough: boolean
  script: TextScript
  /** #rrggbb */
  colour: string
  /** #rrggbb, or '' for none. */
  highlight: string
  align: TextAlignValue
  /** Times the font size. */
  lineSpacing: number
  /** Thousandths of the font size. */
  letterSpacing: number
}

export type TextControlsProps = {
  value: TextControlsValue
  fonts: readonly FontOption[]
  /** The weights every font has. */
  weights: readonly number[]
  onChange: (change: Partial<TextControlsValue>) => void
  /** A font or weight being hovered in its list, to show on the page without keeping it; `null` puts it back. */
  onPreview?: (change: Partial<TextControlsValue> | null) => void
  onSymbol: (symbol: string) => void
  /** One row per setting with its label on the left (the Shapes panel). */
  rows?: boolean
  /** The colours already in the figure, for the swatch dropdowns (rows only). */
  usedColours?: () => readonly string[]
  className?: string
}

/** How many symbols the rows layout shows before "More symbols". */
const FIRST_SYMBOLS = 5

const WEIGHT_NAMES: Record<number, string> = { 100: 'Thin', 200: 'Extra light', 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'Semibold', 700: 'Bold', 800: 'Extra bold', 900: 'Black' }

const LINE_SPACINGS = [
  { value: '1', label: 'Single' },
  { value: '1.16', label: 'Normal' },
  { value: '1.5', label: '1.5' },
  { value: '2', label: 'Double' },
]

const LETTER_SPACINGS = [
  { value: '-50', label: 'Tight' },
  { value: '0', label: 'Normal' },
  { value: '50', label: 'Wide' },
  { value: '100', label: 'Wider' },
  { value: '200', label: 'Widest' },
]

/** Symbols scientists type often, with names for screen readers. */
export const SYMBOLS: readonly (readonly [string, string])[] = [
  ['α', 'alpha'], ['β', 'beta'], ['γ', 'gamma'], ['δ', 'delta'], ['Δ', 'capital delta'], ['ε', 'epsilon'], ['θ', 'theta'], ['κ', 'kappa'], ['λ', 'lambda'], ['µ', 'micro'],
  ['π', 'pi'], ['ρ', 'rho'], ['σ', 'sigma'], ['Σ', 'capital sigma'], ['τ', 'tau'], ['φ', 'phi'], ['χ', 'chi'], ['ψ', 'psi'], ['ω', 'omega'], ['Ω', 'capital omega'],
  ['±', 'plus or minus'], ['°', 'degree'], ['×', 'times'], ['÷', 'divided by'], ['≈', 'approximately'], ['≠', 'not equal'], ['≤', 'less than or equal'], ['≥', 'greater than or equal'], ['∞', 'infinity'], ['√', 'square root'],
  ['→', 'arrow right'], ['←', 'arrow left'], ['↔', 'arrow both ways'], ['⇌', 'equilibrium'], ['↑', 'arrow up'], ['↓', 'arrow down'], ['·', 'middle dot'], ['Å', 'angstrom'], ['′', 'prime'], ['″', 'double prime'],
]

/** Opens the swatches beside the button, raised the way the presets popup is. */
const highlightOffset = ({ anchor }: { anchor: { height: number } }) => -(155 - anchor.height) / 2

/** Keeps the keyboard (and the selected characters) in the text on the page. */
const keepTextFocus = (event: MouseEvent) => event.preventDefault()

/** A titled part of the panel. Not a landmark: the panel can show twice on screen (Text tool and properties). */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-b px-3 pt-2 pb-3">
      <h3 className="section-label flex h-7 items-center">{title}</h3>
      {children}
    </section>
  )
}

/** Buttons sitting together in one outlined strip. */
function Strip({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div role="group" aria-label={label} onMouseDown={keepTextFocus} className={cn('flex items-center gap-0.5 rounded-md border p-0.5', className)}>
      {children}
    </div>
  )
}

/** `outlined`: keeps its outline while off, like the fields next to it (the Shapes panel's Style row). */
function StripButton({ icon, label, shortcut, pressed, outlined, onClick }: { icon: LucideIcon; label: string; shortcut?: string; pressed: boolean; outlined?: boolean; onClick: () => void }) {
  return (
    <IconButton
      icon={icon}
      label={label}
      shortcut={shortcut}
      pressed={pressed}
      onClick={onClick}
      className={cn('h-7 w-auto flex-1 shadow-none', !pressed && !outlined && 'border-transparent bg-transparent')}
    />
  )
}

/** A button with a colour swatch that opens the browser's colour picker. */
function ColourButton({ label, colour, onColour, onClear }: { label: string; colour: string; onColour: (colour: string) => void; onClear?: () => void }) {
  const picker = useRef<HTMLInputElement>(null)
  return (
    <div className="relative flex min-w-0 flex-1">
      <button
        type="button"
        onMouseDown={keepTextFocus}
        onClick={() => picker.current?.click()}
        aria-label={`${label}: ${colour || 'none'}`}
        className="flex h-(--control-height) min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-sm ring-1 ring-border-strong ring-inset transition-colors duration-(--duration-instant) hover:bg-accent"
      >
        <span
          aria-hidden="true"
          className={cn('size-4 shrink-0 rounded-sm border border-black/15', !colour && 'border-dashed border-muted-foreground')}
          style={colour ? { background: colour } : undefined}
        />
        <span className="truncate">{label}</span>
      </button>
      {onClear && colour && (
        <Tooltip label={`No ${label.toLowerCase()}`}>
          <button
            type="button"
            onMouseDown={keepTextFocus}
            onClick={onClear}
            aria-label={`No ${label.toLowerCase()}`}
            className="absolute top-1/2 right-1 grid size-5 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </Tooltip>
      )}
      <input
        ref={picker}
        type="color"
        tabIndex={-1}
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-0 size-0 opacity-0"
        value={colour || '#ffff00'}
        onChange={(event) => onColour(event.target.value)}
      />
    </div>
  )
}

const blurOnEnter = (event: KeyboardEvent<HTMLInputElement>) => {
  if (event.key === 'Enter') event.currentTarget.blur()
}

/** The font size in points, typed or stepped one point at a time with − and +. */
function SizeField({ size, onSize }: { size: number; onSize: (size: number) => void }) {
  const shown = String(Math.round(size * 10) / 10)
  const step = (by: number) => onSize(Math.min(1000, Math.max(1, Math.round(size) + by)))
  return (
    <div className="flex shrink-0 items-end gap-0.5" onMouseDown={(event) => (event.target as Element).closest('button') && keepTextFocus(event)}>
      <IconButton icon={Minus} label="Smaller" size="sm" className="h-(--control-height) w-6 border-transparent bg-transparent shadow-none" disabled={size <= 1} onClick={() => step(-1)} />
      <SizeInput shown={shown} size={size} onSize={onSize} />
      <IconButton icon={Plus} label="Bigger" size="sm" className="h-(--control-height) w-6 border-transparent bg-transparent shadow-none" onClick={() => step(1)} />
    </div>
  )
}

function SizeInput({ shown, size, onSize }: { shown: string; size: number; onSize: (size: number) => void }) {
  return (
    <TextField
      // A new key resets the field when the selection changes.
      key={shown}
      label="Font size"
      hideLabel
      suffix="pt"
      inputMode="decimal"
      defaultValue={shown}
      className="w-16 shrink-0"
      onKeyDown={(event) => {
        blurOnEnter(event)
        const step = event.key === 'ArrowUp' ? 1 : event.key === 'ArrowDown' ? -1 : 0
        if (!step) return
        event.preventDefault()
        const next = Math.max(1, Math.round((Number.parseFloat(event.currentTarget.value) || size) + step))
        event.currentTarget.value = String(next)
        onSize(next)
      }}
      onBlur={(event) => {
        const typed = Number.parseFloat(event.target.value.replace(',', '.'))
        if (Number.isFinite(typed) && typed > 0 && event.target.value !== shown) onSize(Math.min(typed, 1000))
        else event.target.value = shown
      }}
    />
  )
}

/** Options for a spacing dropdown, with the current value added if it isn't one of them. */
const withCurrent = (options: { value: string; label: string }[], current: number) =>
  options.some((option) => Number(option.value) === current) ? options : [...options, { value: String(current), label: String(current) }]

/** A setting's label on the left and its controls on the right, named for the phone's property bar (see `useRowFocus`). */
function Row({ label, icon: Icon, children }: { label: string; icon?: LucideIcon; children: ReactNode }) {
  return (
    <>
      <span data-prop-label={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {Icon && <Icon className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />}
        {label}
      </span>
      <div data-prop-row={label} className="flex min-w-0 items-center gap-1.5">{children}</div>
    </>
  )
}

function SymbolButton({ symbol, name, onSymbol }: { symbol: string; name: string; onSymbol: (symbol: string) => void }) {
  return (
    <Tooltip label={name}>
      <button
        type="button"
        aria-label={`Insert ${name}`}
        onClick={() => onSymbol(symbol)}
        className="grid h-7 place-items-center rounded-md border border-input-border bg-input text-[0.9375rem] transition-colors duration-(--duration-instant) hover:bg-muted"
      >
        {symbol}
      </button>
    </Tooltip>
  )
}

/** Dark or white, whichever reads on a #rrggbb colour. */
function inkOn(colour: string): string {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((at) => Number.parseInt(colour.slice(at, at + 2), 16) / 255)
  return 0.299 * r + 0.587 * g + 0.114 * b > 0.55 ? '#18181b' : '#ffffff'
}

function TextControlsRows({ value, fonts, weights, onChange, onPreview, onSymbol, usedColours, className }: TextControlsProps) {
  const script = (pressed: Exclude<TextScript, 'none'>) => onChange({ script: value.script === pressed ? 'none' : pressed })
  // The ⋯ button shows pressed while one of the styles in its menu is on.
  const moreOn = value.strikethrough || value.script !== 'none'
  // The phone's sheet with one setting open has room for every option, so nothing hides behind a ⋯ button.
  const expanded = useExpandedControls()
  return (
    <div className={cn('grid grid-cols-[5.25rem_minmax(0,1fr)] items-center gap-x-13 gap-y-1.5 px-3 py-3', className)}>
      <Row label="Font">
        <FontPicker fonts={fonts} value={value.font} onValueChange={(font) => onChange({ font })} onPreview={(font) => onPreview?.(font === null ? null : { font })} className="flex-1" />
      </Row>
      <Row label="Weight">
        {expanded ? (
          // Phones: every weight in view as a button, no dropdown.
          <div role="radiogroup" aria-label="Weight" className="grid min-w-0 flex-1 basis-full grid-cols-5 gap-1">
            {weights.map((weight) => (
              <button
                key={weight}
                type="button"
                role="radio"
                aria-checked={value.weight === weight}
                onClick={() => onChange({ weight })}
                style={{ fontWeight: weight }}
                className={cn(
                  'h-9 min-w-0 truncate rounded-md px-1 text-xs ring-1 ring-border-strong ring-inset outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  value.weight === weight && 'bg-primary-subtle text-primary-subtle-foreground ring-2 ring-primary',
                )}
              >
                {WEIGHT_NAMES[weight] ?? weight}
              </button>
            ))}
          </div>
        ) : (
          <Select
            label="Weight"
            hideLabel
            className="min-w-0 flex-1"
            value={String(value.weight)}
            options={weights.map((weight) => ({ value: String(weight), label: WEIGHT_NAMES[weight] ?? String(weight), style: { fontWeight: weight } }))}
            onValueChange={(weight) => onChange({ weight: Number(weight) })}
            onPreview={(weight) => onPreview?.(weight === null ? null : { weight: Number(weight) })}
          />
        )}
        {!expanded && <SizeInput shown={String(Math.round(value.size * 10) / 10)} size={value.size} onSize={(size) => onChange({ size })} />}
      </Row>
      <Row label="Style">
        <Strip label="Text style" className="min-w-0 flex-1 gap-1.5 border-0 p-0">
          <StripButton icon={Bold} label="Bold" outlined shortcut="Mod+B" pressed={value.bold} onClick={() => onChange({ bold: !value.bold })} />
          <StripButton icon={Italic} label="Italic" outlined shortcut="Mod+I" pressed={value.italic} onClick={() => onChange({ italic: !value.italic })} />
          <StripButton icon={Underline} label="Underline" outlined shortcut="Mod+U" pressed={value.underline} onClick={() => onChange({ underline: !value.underline })} />
          {expanded ? (
            <>
              <StripButton icon={Strikethrough} label="Strikethrough" outlined pressed={value.strikethrough} onClick={() => onChange({ strikethrough: !value.strikethrough })} />
              <StripButton icon={Subscript} label="Subscript" outlined pressed={value.script === 'sub'} onClick={() => script('sub')} />
              <StripButton icon={Superscript} label="Superscript" outlined pressed={value.script === 'super'} onClick={() => script('super')} />
            </>
          ) : (
          <DropdownMenu
            side="right"
            align="center"
            sections={[
              {
                label: 'More text styles',
                showLabel: true,
                layout: 'tiles',
                actions: [
                  { label: 'Strikethrough', icon: Strikethrough, checked: value.strikethrough, onClick: () => onChange({ strikethrough: !value.strikethrough }) },
                  { label: 'Subscript', icon: Subscript, shortcut: 'Mod+=', checked: value.script === 'sub', onClick: () => script('sub') },
                  { label: 'Superscript', icon: Superscript, shortcut: 'Mod+Shift+=', checked: value.script === 'super', onClick: () => script('super') },
                ],
              },
            ]}
            trigger={<IconButton icon={Ellipsis} label="More text styles" pressed={moreOn} className="h-7 w-auto flex-1 shadow-none" />}
          />
          )}
        </Strip>
      </Row>
      {/* Phones: the size as a slider, its own setting, last in the "Aa" sheet, under weight and style (see mobile-props in the editor). */}
      {expanded && (
        <Row label="Font size">
          <Slider look="bar" label="Font size" hideLabel value={Math.min(Math.max(value.size, 4), 72)} min={4} max={72} step={0.5} unit="pt" onValueChange={(size) => onChange({ size })} className="min-w-0 flex-1" />
        </Row>
      )}
      <Row label="Colour">
        <ColourInput label="Text colour" value={value.colour} onChange={(colour) => colour && onChange({ colour })} used={usedColours} className="min-w-0 flex-1" />
        {/* Phones: the highlight gets its own setting below, so one sheet never shows two sets of swatches. */}
        {!expanded && (
        /* The highlight: a small button with a marker icon on the highlight colour (owner's pick 2026-11-12), opening the same swatches. */
        <ColourMenu
          label="Highlight"
          side="right"
          align="start"
          alignOffset={highlightOffset}
          noneLabel="No highlight"
          value={value.highlight || undefined}
          onChange={(highlight) => onChange({ highlight: highlight ?? '' })}
          used={usedColours}
          trigger={
            <button
              type="button"
              aria-label="Highlight colours"
              title={`Highlight: ${value.highlight || 'none'}`}
              className="flex h-(--control-height) shrink-0 items-center gap-1 rounded-md border border-input-border bg-input pr-1 pl-1.5 transition-colors duration-(--duration-instant) hover:bg-muted data-popup-open:bg-muted"
            >
              {/* The marker sits on the highlight colour; with none the box is see-through. */}
              <span
                aria-hidden="true"
                className="grid size-4 place-items-center rounded-[3px]"
                style={value.highlight ? { background: value.highlight, color: inkOn(value.highlight) } : undefined}
              >
                <Highlighter className="size-4 shrink-0" strokeWidth={1.75} />
              </span>
              <svg viewBox="0 0 24 24" className="size-3 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="m9 6 6 6-6 6" />
              </svg>
            </button>
          }
        />
        )}
      </Row>
      {expanded && (
        <Row label="Highlight">
          <ColourInput label="Highlight" noneLabel="No highlight" value={value.highlight || undefined} onChange={(highlight) => onChange({ highlight: highlight ?? '' })} used={usedColours} className="min-w-0 flex-1" />
        </Row>
      )}
      <Row label="Align">
        <Strip label="Alignment" className="flex-1 border-0 bg-muted">
          {(
            [
              ['left', AlignLeft, 'Align left'],
              ['center', AlignCenter, 'Centre'],
              ['right', AlignRight, 'Align right'],
              ['justify', AlignJustify, 'Justify'],
            ] as const
          ).map(([align, icon, label]) => (
            <StripButton key={align} icon={icon} label={label} pressed={value.align === align} onClick={() => onChange({ align })} />
          ))}
        </Strip>
        {/* Line and letter spacing are seldom changed in a shape, so they wait behind this button (phones show them as sliders with the font). */}
        {!expanded && (
        <Popover title="Spacing" side="right" align="center" divider={false} trigger={<IconButton icon={SlidersHorizontal} label="Line and letter spacing" />} className="w-72">
          {/* Label-left rows, like the panel itself. */}
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-1.5">
            <Row label="Line spacing" icon={UnfoldVertical}>
              <Select label="Line spacing" hideLabel className="flex-1" value={String(value.lineSpacing)} options={withCurrent(LINE_SPACINGS, value.lineSpacing)} onValueChange={(v) => onChange({ lineSpacing: Number(v) })} />
            </Row>
            <Row label="Letter spacing" icon={UnfoldHorizontal}>
              <Select label="Letter spacing" hideLabel className="flex-1" value={String(value.letterSpacing)} options={withCurrent(LETTER_SPACINGS, value.letterSpacing)} onValueChange={(v) => onChange({ letterSpacing: Number(v) })} />
            </Row>
          </div>
        </Popover>
        )}
      </Row>
      {/* Phones: line and letter spacing as sliders, under the alignment in the Layout sheet. */}
      {expanded && (
        <>
          <Row label="Line spacing">
            <Slider look="bar" label="Line spacing" hideLabel value={Math.min(Math.max(value.lineSpacing, 0.8), 3)} min={0.8} max={3} step={0.01} onValueChange={(lineSpacing) => onChange({ lineSpacing })} className="min-w-0 flex-1" />
          </Row>
          <Row label="Letter spacing">
            <Slider look="bar" label="Letter spacing" hideLabel value={Math.min(Math.max(value.letterSpacing, -100), 400)} min={-100} max={400} step={10} onValueChange={(letterSpacing) => onChange({ letterSpacing })} className="min-w-0 flex-1" />
          </Row>
        </>
      )}
      <Row label="Symbols">
        {expanded ? (
          <div role="group" aria-label="Insert a symbol" onMouseDown={keepTextFocus} className="grid flex-1 grid-cols-8 gap-1">
            {SYMBOLS.map(([symbol, name]) => (
              <SymbolButton key={symbol} symbol={symbol} name={name} onSymbol={onSymbol} />
            ))}
          </div>
        ) : (
        <div role="group" aria-label="Insert a symbol" onMouseDown={keepTextFocus} className="grid flex-1 grid-cols-6 gap-1">
          {SYMBOLS.slice(0, FIRST_SYMBOLS).map(([symbol, name]) => (
            <SymbolButton key={symbol} symbol={symbol} name={name} onSymbol={onSymbol} />
          ))}
          {/* Every symbol, the first ones too, in a popup beside the panel. */}
          <Popover
            title="Symbols"
            divider={false}
            side="right"
            align="center"
            className="w-72"
            trigger={
              <button
                type="button"
                aria-label="More symbols"
                title="More symbols"
                className="grid h-7 place-items-center rounded-md border border-input-border bg-input text-muted-foreground transition-colors duration-(--duration-instant) hover:bg-muted hover:text-foreground data-popup-open:bg-muted"
              >
                <Ellipsis className="size-4" strokeWidth={1.75} aria-hidden="true" />
              </button>
            }
          >
            <div role="group" aria-label="Insert a symbol" onMouseDown={keepTextFocus} className="grid grid-cols-8 gap-1">
              {SYMBOLS.map(([symbol, name]) => (
                <SymbolButton key={symbol} symbol={symbol} name={name} onSymbol={onSymbol} />
              ))}
            </div>
          </Popover>
        </div>
        )}
      </Row>
    </div>
  )
}

export function TextControls(props: TextControlsProps) {
  if (props.rows) return <TextControlsRows {...props} />
  const { value, fonts, weights, onChange, onPreview, onSymbol, className } = props
  const script = (pressed: Exclude<TextScript, 'none'>) => onChange({ script: value.script === pressed ? 'none' : pressed })
  const lineOptions = withCurrent(LINE_SPACINGS, value.lineSpacing)
  const letterOptions = withCurrent(LETTER_SPACINGS, value.letterSpacing)
  return (
    <div className={cn('flex flex-col', className)}>
      <Section title="Text">
        <FontPicker fonts={fonts} value={value.font} onValueChange={(font) => onChange({ font })} onPreview={(font) => onPreview?.(font === null ? null : { font })} />
        <div className="flex gap-2">
          <Select
            label="Weight"
            hideLabel
            className="flex-1"
            value={String(value.weight)}
            options={weights.map((weight) => ({ value: String(weight), label: WEIGHT_NAMES[weight] ?? String(weight), style: { fontWeight: weight } }))}
            onValueChange={(weight) => onChange({ weight: Number(weight) })}
            onPreview={(weight) => onPreview?.(weight === null ? null : { weight: Number(weight) })}
          />
          <SizeField size={value.size} onSize={(size) => onChange({ size })} />
        </div>
        <Strip label="Text style">
          <StripButton icon={Bold} label="Bold" shortcut="Mod+B" pressed={value.bold} onClick={() => onChange({ bold: !value.bold })} />
          <StripButton icon={Italic} label="Italic" shortcut="Mod+I" pressed={value.italic} onClick={() => onChange({ italic: !value.italic })} />
          <StripButton icon={Underline} label="Underline" shortcut="Mod+U" pressed={value.underline} onClick={() => onChange({ underline: !value.underline })} />
          <StripButton icon={Strikethrough} label="Strikethrough" pressed={value.strikethrough} onClick={() => onChange({ strikethrough: !value.strikethrough })} />
          <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-border" />
          <StripButton icon={Subscript} label="Subscript" shortcut="Mod+=" pressed={value.script === 'sub'} onClick={() => script('sub')} />
          <StripButton icon={Superscript} label="Superscript" shortcut="Mod+Shift+=" pressed={value.script === 'super'} onClick={() => script('super')} />
        </Strip>
        <div className="flex gap-2">
          <ColourButton label="Colour" colour={value.colour} onColour={(colour) => onChange({ colour })} />
          <ColourButton label="Highlight" colour={value.highlight} onColour={(highlight) => onChange({ highlight })} onClear={() => onChange({ highlight: '' })} />
        </div>
      </Section>
      <Section title="Paragraph">
        <Strip label="Alignment" className="border-0 bg-muted">
          {(
            [
              ['left', AlignLeft, 'Align left'],
              ['center', AlignCenter, 'Centre'],
              ['right', AlignRight, 'Align right'],
              ['justify', AlignJustify, 'Justify'],
            ] as const
          ).map(([align, icon, label]) => (
            <StripButton key={align} icon={icon} label={label} pressed={value.align === align} onClick={() => onChange({ align })} />
          ))}
        </Strip>
        <div className="flex gap-2">
          <Select label="Line spacing" labelPosition="above" className="flex-1" value={String(value.lineSpacing)} options={lineOptions} onValueChange={(v) => onChange({ lineSpacing: Number(v) })} />
          <Select label="Letter spacing" labelPosition="above" className="flex-1" value={String(value.letterSpacing)} options={letterOptions} onValueChange={(v) => onChange({ letterSpacing: Number(v) })} />
        </div>
      </Section>
      <Section title="Symbols">
        <div role="group" aria-label="Insert a symbol" onMouseDown={keepTextFocus} className="grid grid-cols-10 gap-0.5">
          {SYMBOLS.map(([symbol, name]) => (
            <Tooltip key={symbol} label={name}>
              <button
                type="button"
                aria-label={`Insert ${name}`}
                onClick={() => onSymbol(symbol)}
                className="grid h-7 place-items-center rounded text-[0.9375rem] transition-colors duration-(--duration-instant) hover:bg-muted"
              >
                {symbol}
              </button>
            </Tooltip>
          ))}
        </div>
      </Section>
    </div>
  )
}
