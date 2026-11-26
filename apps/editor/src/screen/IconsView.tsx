/*
 * The Icons panel: the icon library, or the properties of a selected icon
 * (the Shapes panel's label-left rows, 2026-11-14) under a header with a back
 * button and its name: colour mode, colour (with a button that brings back
 * the icon's own colours), size and opacity. An icon opens its properties
 * when it is added from the library and when it is selected on the page.
 * The library stays mounted underneath, so its search and scroll position
 * are still there after going back.
 *
 * Colour mode (design A of four drafts, picked 2026-11-16): two tiles, Colour
 * and Greyscale, each showing this icon drawn in that mode; the colour field
 * fades out in Greyscale, which takes no colour. A CMYK tile was removed
 * (2026-11-17): it looked the same as RGB; CMYK belongs to print export.
 *
 * Letters (2026-11-17): chemistry molecules get a first row of two tiles,
 * None and Letters, showing both versions; picking one swaps the icon in place.
 *
 * Label text (BIO-56): an icon whose library entry has a text slot (a bottle's
 * label) gets a "Show text" bar and a text block after the Signs row.
 *
 * Frame it (BIO-73): tabs Icon and Frame, like Shape and Text for shapes, and
 * a Text tab for the caption once there is a frame. An unframed icon's Icon
 * tab ends with a big "Add frame" button, which puts a soft tile around the
 * icon and opens the Frame tab.
 */
import { Button } from '@biofigure-lab/ui/components/button/Button'
import { ColourInput } from '@biofigure-lab/ui/components/colour-input/ColourInput'
import { IconButton } from '@biofigure-lab/ui/components/icon-button/IconButton'
import { OptionCards } from '@biofigure-lab/ui/components/option-cards/OptionCards'
import { SegmentedToggle } from '@biofigure-lab/ui/components/segmented-toggle/SegmentedToggle'
import { Skeleton } from '@biofigure-lab/ui/components/skeleton/Skeleton'
import { Tabs, TabsPanel } from '@biofigure-lab/ui/components/tabs/Tabs'
import { Toggle } from '@biofigure-lab/ui/components/toggle/Toggle'
import { cn } from '@biofigure-lab/ui/lib/cn'
import { Replace, RotateCcw, Shell, SquarePlus, Type } from 'lucide-react'
import { createContext, use, useRef, useState, type ReactNode } from 'react'

import { toHex } from '../editor/colour'
import { MAX_LABEL_LINES, changeLineCount, lineCount, newLineMemory } from '../editor/label-lines'
import type { FigureCanvas, SelectionInfo } from '../editor/FigureCanvas'
import { ICON_STYLES, iconById, letterVersions, modeColour, needsLightBacking, signVersions, styleOf, styleVersion, type ColourMode, type IconStyle, type LibraryIcon } from '../editor/icon-library'
import { LiveTextArea } from './fields'
import { CaptionTextRows, FrameRows } from './FrameProperties'
import { LibraryPanel } from './LibraryPanel'
import { usePanelTab } from './panel-tab'
import { useStableCallback } from './use-stable-callback'
import { ReportIconButton } from './ReportIconButton'
import { useIconSvg } from './useIconSvg'
import { OpacityRow, PropRow, PropRows, PropertiesHeader, SizeRow } from './properties-pane'

type Props = {
  figure: FigureCanvas | null
  /** The selected icon. */
  icon?: SelectionInfo
  /** Showing the selected icon's properties instead of the library. */
  open: boolean
  /** Back to the library; also lets go of the icon. */
  onBack: () => void
  onAdd: (icon: LibraryIcon) => void
  /** Opens the feedback dialog for a library icon. Leave out when there is none: no Report issue. */
  onReport?: (icon: LibraryIcon) => void
  /** An empty icon space is selected: the next icon picked goes into it (BIO-74). Cancel lets go of it. */
  waiting?: { onCancel: () => void }
  /** An icon in a block's space is selected: Replace icon shows the library, and the next icon picked takes its place (BIO-97). */
  replace?: { replacing: boolean; onStart: () => void; onCancel: () => void }
}

export function IconsView({ figure, icon, open, onBack, onAdd, onReport, waiting, replace }: Props) {
  const library = icon?.iconId ? iconById(icon.iconId) : undefined
  const showProps = open && icon !== undefined && !replace?.replacing
  // The same functions every render, so the library (hundreds of tiles) doesn't redraw with each change on the canvas.
  const add = useStableCallback(onAdd)
  const report = useStableCallback((picked: LibraryIcon) => onReport?.(picked))
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={cn('flex min-h-0 flex-1 flex-col', showProps && 'hidden')}>
        {replace?.replacing && (
          <div role="status" className="mx-3 mt-3 flex items-center gap-2 rounded-md border border-primary/25 bg-primary-subtle px-2.5 py-2 text-xs text-primary-subtle-foreground">
            <span className="min-w-0 flex-1">Click an icon to put it in place of the selected one.</span>
            <Button size="sm" variant="ghost" onClick={replace.onCancel}>
              Cancel
            </Button>
          </div>
        )}
        {waiting && (
          <div role="status" className="mx-3 mt-3 flex items-center gap-2 rounded-md border border-primary/25 bg-primary-subtle px-2.5 py-2 text-xs text-primary-subtle-foreground">
            <span className="min-w-0 flex-1">Click an icon to put it in the selected space, or drag one onto any space.</span>
            <Button size="sm" variant="ghost" onClick={waiting.onCancel}>
              Cancel
            </Button>
          </div>
        )}
        <LibraryPanel onAdd={add} onReport={onReport ? report : undefined} />
      </div>
      {showProps && (
        <aside aria-label="Icon" className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-panel [scrollbar-gutter:stable]">
          <PropertiesHeader backLabel="Back to icons" picture={<Shell className="size-5" />} name={icon.name} onBack={onBack} />
          {/* An icon in a block's space can be swapped for another without leaving the block (BIO-97). */}
          {replace && icon.heldIcon && (
            <div className="px-3 pb-2">
              <Button variant="secondary" size="sm" className="w-full gap-1.5" onClick={replace.onStart}>
                <Replace aria-hidden="true" />
                Replace icon
              </Button>
            </div>
          )}
          <IconTabs figure={figure} icon={icon}>
            <PropRows>
              <StyleRow figure={figure} icon={icon} />
              <LettersRow figure={figure} icon={icon} />
              <SignsRow figure={figure} icon={icon} />
              <ColourModeRow figure={figure} icon={icon} />
              <PropRow label="Colour" off={icon.colourMode === 'grey'}>
                <ColourInput
                  label="Icon colour"
                  value={toHex(icon.fill)}
                  onChange={(fill) => fill && figure?.change({ fill })}
                  used={() => figure?.usedColours() ?? []}
                  className="min-w-0 flex-1"
                  // Recolouring tints every shade, so the icon's own colours can only come back from the library.
                  end={<IconButton icon={RotateCcw} label="Original colours" onClick={() => void figure?.resetIconColours()} />}
                />
              </PropRow>
              <SizeRow width={icon.width} height={icon.height} onResize={(change, keep) => figure?.resize(change, keep)} />
              <OpacityRow opacity={icon.opacity} onChange={(opacity) => figure?.change({ opacity })} />
              <LabelTextRows figure={figure} icon={icon} />
              <FrameRow figure={figure} icon={icon} />
            </PropRows>
          </IconTabs>
          {library && onReport && <ReportIconButton onClick={() => onReport(library)} />}
        </aside>
      )}
    </div>
  )
}

/** Which tab shows; "Add frame" opens the Frame tab from inside the Icon tab. */
const OpenTab = createContext<(tab: Tab) => void>(() => undefined)

type Tab = 'icon' | 'frame' | 'text'

/** The Icon and Frame tabs (BIO-73), the icon's own rows in the first. One selected icon only. */
function IconTabs({ figure, icon, children }: { figure: FigureCanvas | null; icon: SelectionInfo; children: ReactNode }) {
  const [tab, setTab] = useState<Tab>('icon')
  // A pick in the bar's Frame widget shows the Frame tab, with the frame's finer settings.
  usePanelTab((open) => open === 'icon-frame' && setTab('frame'))
  if (icon.frame === undefined) return children
  return (
    <OpenTab value={setTab}>
      {/* Text, for the caption, only once there is a frame; taking the frame off goes back to the Frame tab. */}
      <Tabs
        label="Icon properties"
        value={tab === 'text' && !icon.frame ? 'frame' : tab}
        onValueChange={(value) => setTab(value === 'frame' || value === 'text' ? value : 'icon')}
        tabs={[{ value: 'icon', label: 'Icon' }, { value: 'frame', label: 'Frame' }, ...(icon.frame ? [{ value: 'text', label: 'Text' }] : [])]}
      >
        <TabsPanel value="icon">{children}</TabsPanel>
        <TabsPanel value="frame">
          {/* More room between rows than the Icon tab (its rows are tall tile groups); a label on its own line stays close to what it names. */}
          <PropRows className="gap-y-3.5 [&_[data-wide-label]]:-mb-2">
            <FrameRows figure={figure} icon={icon} />
          </PropRows>
        </TabsPanel>
        {icon.frame && (
          <TabsPanel value="text">
            <CaptionTextRows figure={figure} icon={icon} />
          </TabsPanel>
        )}
      </Tabs>
    </OpenTab>
  )
}

/**
 * The Icon tab's last row, across the panel: a big Add frame button (version
 * A, picked 2026-11-25). It adds a soft tile and opens the Frame tab. A framed
 * icon has no Frame row: its frame is in the Frame tab, and picking No frame
 * there brings the row back.
 */
function FrameRow({ figure, icon }: { figure: FigureCanvas | null; icon: SelectionInfo }) {
  const openTab = use(OpenTab)
  if (icon.frame !== null) return null
  return (
    <PropRow label="Frame" wide>
      <Button
        className="h-10 w-full gap-2 text-sm"
        onClick={() => {
          figure?.addFrame()
          openTab('frame')
        }}
      >
        <SquarePlus className="size-5" aria-hidden="true" />
        Add frame
      </Button>
    </PropRow>
  )
}

/** The app's colour-blind-safe colours, for the colour wheel beside Colour. */
const WHEEL = ['#0072b2', '#e69f00', '#009e73', '#cc79a7']

/** A small four-part wheel: in colour, or the same colours as greyscale draws them. */
function ColourWheel({ mode }: { mode: ColourMode }) {
  const at = (deg: number) => {
    const a = ((deg - 90) * Math.PI) / 180
    return `${(8 + 7 * Math.cos(a)).toFixed(2)} ${(8 + 7 * Math.sin(a)).toFixed(2)}`
  }
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      {WHEEL.map((colour, i) => (
        <path key={colour} d={`M8 8L${at(i * 90)}A7 7 0 0 1 ${at((i + 1) * 90)}Z`} fill={modeColour(colour, mode)} />
      ))}
      <circle cx="8" cy="8" r="7" fill="none" stroke="rgb(0 0 0 / 0.15)" />
    </svg>
  )
}

const MODES: readonly { value: ColourMode; label: string; picture: ReactNode }[] = [
  { value: 'rgb', label: 'Colour', picture: <ColourWheel mode="rgb" /> },
  { value: 'grey', label: 'Greyscale', picture: <ColourWheel mode="grey" /> },
]

/** Chemistry structures sit on a white square in dark mode, as in the library, so their dark lines stay visible. */
function lightBacking(icon: SelectionInfo): string | undefined {
  const library = icon.iconId ? iconById(icon.iconId) : undefined
  return library && needsLightBacking(library) ? 'dark:rounded-sm dark:bg-white dark:p-[6%]' : undefined
}

const STYLE_NAMES: Record<IconStyle, string> = { clean: 'Clean', graphite: 'Graphite', shaded: 'Shaded', scribble: 'Scribble' }

/**
 * For icons that come in pencil styles: four tiles (Clean, Graphite, Shaded,
 * Scribble) in one row across the panel, under the label, showing this icon in each. Picking one swaps the icon in place
 * (same middle, scale, turn and opacity; one undo step). Other icons have no
 * such row.
 */
function StyleRow({ figure, icon }: { figure: FigureCanvas | null; icon: SelectionInfo }) {
  const id = icon.iconId
  const versions = id ? ICON_STYLES.flatMap((style) => {
    const version = styleVersion(id, style)
    return version ? [{ style, id: version }] : []
  }) : []
  if (!id || versions.length < 2) return null
  // A clean cell may be outlined or shaded; its Clean tile is the icon itself, not the flat one the pencil versions came from.
  const own = styleOf(id)
  const options = versions.map(({ style, id: version }) => ({ style, id: style === own ? id : version }))
  return (
    <PropRow label="Style" wide>
      <OptionCards
        compact
        label="Style"
        value={own}
        onValueChange={(style) => {
          const next = options.find((option) => option.style === style)?.id
          if (next) void figure?.swapIcon(next)
        }}
        options={options.map(({ style, id: version }) => {
          const library = iconById(version)
          return { value: style, label: STYLE_NAMES[style], picture: <LibraryPicture iconId={version} className={library && needsLightBacking(library) ? 'dark:rounded-sm dark:bg-white dark:p-[6%]' : undefined} /> }
        })}
        className="min-w-0 flex-1"
      />
    </PropRow>
  )
}

/**
 * For icons that come with and without element letters (the chemistry
 * molecules): two tiles showing both versions. Picking one swaps the icon in
 * place. Other icons have no such row.
 */
function LettersRow({ figure, icon }: { figure: FigureCanvas | null; icon: SelectionInfo }) {
  const versions = icon.iconId ? letterVersions(icon.iconId) : undefined
  if (!versions) return null
  const backing = lightBacking(icon)
  const picture = (id: string) => <LibraryPicture iconId={id} className={backing} />
  return (
    <PropRow label="Letters" top>
      <OptionCards
        compact
        label="Letters"
        value={versions.letters ? 'on' : 'off'}
        onValueChange={(value) => void figure?.swapIcon(value === 'on' ? versions.with : versions.without)}
        options={[
          { value: 'off', label: 'None', picture: picture(versions.without) },
          { value: 'on', label: 'Letters', picture: picture(versions.with) },
        ]}
        className="min-w-0 flex-1"
      />
    </PropRow>
  )
}

/**
 * For icons that come with and without charge signs on their ions (the ion
 * channels): two tiles showing both versions. Picking one swaps the icon in
 * place. Other icons have no such row.
 */
function SignsRow({ figure, icon }: { figure: FigureCanvas | null; icon: SelectionInfo }) {
  const versions = icon.iconId ? signVersions(icon.iconId) : undefined
  if (!versions) return null
  const backing = lightBacking(icon)
  const picture = (id: string) => <LibraryPicture iconId={id} className={backing} />
  return (
    <PropRow label="Signs" top>
      <OptionCards
        compact
        label="Signs"
        value={versions.signs ? 'on' : 'off'}
        onValueChange={(value) => void figure?.swapIcon(value === 'on' ? versions.with : versions.without)}
        options={[
          { value: 'off', label: 'None', picture: picture(versions.without) },
          { value: 'on', label: 'Signs', picture: picture(versions.with) },
        ]}
        className="min-w-0 flex-1"
      />
    </PropRow>
  )
}

/**
 * For icons with a text slot: a full-width "Show text" bar that hides the text
 * without losing it, and a text block (about four lines, longer text scrolls)
 * for the label's text. The text changes on the icon as you type and becomes
 * one undo step when you leave the block; Enter starts a new line, Ctrl or
 * Cmd with Enter leaves it. Other icons have no such rows.
 */
function LabelTextRows({ figure, icon }: { figure: FigureCanvas | null; icon: SelectionInfo }) {
  const memory = useRef(newLineMemory())
  const slot = icon.slot
  const text = slot?.text ?? ''
  if (!slot) return null
  const lines = lineCount(text)
  return (
    <>
      <PropRow label="Show text">
        <Toggle
          variant="bar"
          label="Show text"
          hideLabel
          checked={slot.shown}
          offIcon={<TypeOff />}
          onIcon={<Type className="size-4" strokeWidth={2.25} />}
          onCheckedChange={(shown) => void figure?.setIconText(text, shown)}
          className="min-w-0 flex-1"
        />
      </PropRow>
      <PropRow label="Lines" top>
        <OptionCards
          compact
          label="Lines"
          value={String(lines)}
          onValueChange={(next) => void figure?.setIconText(changeLineCount(text, Number(next), memory.current), slot.shown)}
          options={Array.from({ length: MAX_LABEL_LINES }, (_, i) => {
            const n = i + 1
            return { value: String(n), label: n === 1 ? '1 line' : `${n} lines`, picture: <LinesPicture lines={n} /> }
          })}
          className="min-w-0 flex-1"
        />
      </PropRow>
      <PropRow label="Label text" top>
        <LiveTextArea
          label="Label text"
          value={text}
          placeholder="Type label text"
          rows={4}
          enterIsNewLine
          className="max-h-[6.5rem] min-w-0 flex-1"
          onType={(next) => void figure?.setIconText(next, slot.shown, false)}
          onDone={() => figure?.saveIconText()}
        />
      </PropRow>
    </>
  )
}

/** A small label with n lines of text, the picture on a Lines tile. */
function LinesPicture({ lines }: { lines: number }) {
  return (
    <svg viewBox="0 0 28 22" aria-hidden="true">
      <rect x="1" y="1" width="26" height="20" rx="2" fill="#fff" stroke="currentColor" strokeOpacity="0.4" />
      {Array.from({ length: lines }, (_, i) => {
        const gap = 14 / Math.max(lines, 2)
        const y = 11 - ((lines - 1) * gap) / 2 + i * gap
        return <line key={i} x1={i % 2 ? 8 : 6} x2={i % 2 ? 20 : 22} y1={y} y2={y} stroke="#20242a" strokeWidth="1.6" strokeLinecap="round" />
      })}
    </svg>
  )
}

/** The "T" of the text icon with a slash through it: no text. */
function TypeOff() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7V4h16v3M12 4v16M9 20h6" />
      <path d="M3 21 21 3" />
    </svg>
  )
}

/** A library icon's picture for a property tile; it loads the SVG if it isn't loaded yet. */
function LibraryPicture({ iconId, className }: { iconId: string; className?: string }) {
  const svg = useIconSvg(iconId)
  return svg ? <img src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`} alt="" className={cn('size-full object-contain dark:brightness-(--page-dim)', className)} /> : <Skeleton className="size-full" />
}

/** Colour or greyscale, as a two-way toggle with a colour wheel and a grey wheel; a little taller than other controls. */
function ColourModeRow({ figure, icon }: { figure: FigureCanvas | null; icon: SelectionInfo }) {
  return (
    <PropRow label="Colour mode">
      <SegmentedToggle label="Colour mode" showLabels options={MODES} value={icon.colourMode ?? 'rgb'} onValueChange={(mode) => figure?.setIconColourMode(mode)} className="h-9 min-w-0 flex-1" />
    </PropRow>
  )
}
