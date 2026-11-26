/*
 * The properties of a selected legend (BIO-106), in the Blocks panel where
 * its cards are:
 *
 * - Rows first: each with its marker, its label and a − that removes it
 *   (Undo toast; the legend keeps its last row). The marker opens one popup
 *   with a Colour | Icon switch at the top: the colour swatches, or the
 *   library as the Icons tool shows it (a button per category, and search).
 *   Switching only shows the other choices; the row changes once something
 *   is picked (owner's feedback, 2026-11-26).
 *   "+ Row" adds a row like the last one.
 * - Layout: Down | Across, as pictures. Style: the three looks as pictures.
 * - The boxed key's header text, and the block colour (boxed and chips only;
 *   the plain key has nothing in it). Detach at the bottom, with an Undo toast.
 */
import { Button } from '@biofigure-lab/ui/components/button/Button'
import { ColourInput, ColourSwatches } from '@biofigure-lab/ui/components/colour-input/ColourInput'
import { IconButton } from '@biofigure-lab/ui/components/icon-button/IconButton'
import { Popover } from '@biofigure-lab/ui/components/popover/Popover'
import { CollectionRow } from '@biofigure-lab/ui/components/collection-row/CollectionRow'
import { SearchField } from '@biofigure-lab/ui/components/search-field/SearchField'
import { SegmentedToggle } from '@biofigure-lab/ui/components/segmented-toggle/SegmentedToggle'
import { useToast } from '@biofigure-lab/ui/components/toast/Toast'
import { cn } from '@biofigure-lab/ui/lib/cn'
import { ChevronLeft, ListOrdered, Minus, Palette, Plus, Shapes, Unlink } from 'lucide-react'
import { useMemo, useState } from 'react'

import type { FigureCanvas, SelectionInfo } from '../editor/FigureCanvas'
import { browseIcons, categoryTitle, libraryIcons, loadIconSvg, type LibraryIcon } from '../editor/icon-library'
import { LEGEND_LOOKS, legendSvg, type LegendLayout, type LegendLook, type LegendRow, type LegendSettings } from '../editor/legend-block'
import { LiveTextField } from './fields'
import { Tile } from './FrameProperties'
import { detachLegendWithUndo, removeLegendRowWithUndo } from './legend-actions'
import { COLLECTION_COVERS, TilePicture } from './LibraryPanel'
import { PropertiesHeader, PropRow, PropRows } from './properties-pane'
import { PRESET_GROUPS, ROW, swatchLook } from './SequenceProperties'
import { PresetPicker } from './ShapeProperties'
import { useIconSvg } from './useIconSvg'

const svgUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

/** A look as a small picture: the legend itself in that look, with its own rows. */
function LookPicture({ settings, look }: { settings: LegendSettings; look: LegendLook }) {
  const svg = useMemo(() => legendSvg({ ...settings, look, layout: 'down', rows: settings.rows.slice(0, 3) }, { bars: true }), [settings, look])
  return <span aria-hidden="true" className="block size-full [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: svg }} />
}

/** Three rows down, or three side by side. */
function LayoutPicture({ layout }: { layout: LegendLayout }) {
  return (
    <svg viewBox="0 0 40 24" className="size-full" aria-hidden="true">
      {[0, 1, 2].map((i) =>
        layout === 'down' ? (
          <g key={i}>
            <rect x={9} y={3 + i * 7} width={5} height={5} rx={1} fill="currentColor" />
            <rect x={16.5} y={4.75 + i * 7} width={14} height={1.6} rx={0.8} fill="currentColor" opacity={0.55} />
          </g>
        ) : (
          <g key={i}>
            <rect x={2 + i * 12.5} y={9.5} width={5} height={5} rx={1} fill="currentColor" />
            <rect x={8.5 + i * 12.5} y={11.2} width={4.5} height={1.6} rx={0.8} fill="currentColor" opacity={0.55} />
          </g>
        ),
      )}
    </svg>
  )
}

/** One icon in the picker: the library's own tile picture, loaded once it scrolls near the view. */
function PickIcon({ icon, on, onPick }: { icon: LibraryIcon; on: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      title={icon.name}
      aria-label={icon.name}
      aria-pressed={on}
      onClick={onPick}
      className={cn('grid aspect-square place-items-center rounded-md border bg-muted p-1 transition-colors duration-(--duration-instant) focus-visible:outline-2 focus-visible:outline-ring [&>*]:size-full', on ? 'border-primary ring-1 ring-primary' : 'border-transparent hover:border-border-strong')}
    >
      <TilePicture icon={icon} />
    </button>
  )
}

/** Icons in a grid of six. */
function IconGrid({ icons, row, onIcon }: { icons: readonly LibraryIcon[]; row: LegendRow; onIcon: (id: string, name: string) => void }) {
  return (
    <div className="grid grid-cols-6 gap-1">
      {icons.map((icon) => (
        <PickIcon key={icon.id} icon={icon} on={row.kind === 'icon' && row.iconId === icon.id} onPick={() => onIcon(icon.id, icon.name)} />
      ))}
    </div>
  )
}

/**
 * The library as the Icons tool shows it (owner's feedback, 2026-11-26: one
 * long list of every icon scrolled slowly): a button per category, which
 * opens that category's icons; a search looks through all of them.
 */
function IconChoices({ row, onIcon }: { row: LegendRow; onIcon: (id: string, name: string) => void }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string>()
  const searching = query.trim() !== ''
  const found = useMemo(() => (searching ? browseIcons(libraryIcons, query) : []), [searching, query])
  const categories = useMemo(() => browseIcons(libraryIcons, ''), [])
  const open = categories.find((each) => each.category === category)
  return (
    <div className="flex flex-col gap-2">
      <SearchField label="Search icons" placeholder="Search icons" value={query} onValueChange={setQuery} />
      <div className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
        {searching ? (
          found.length === 0 ? (
            <p className="px-1 py-3 text-xs text-muted-foreground">No icons match “{query}”.</p>
          ) : (
            found.map((group) => (
              <div key={group.category} role="group" aria-label={categoryTitle(group.category)} className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">{categoryTitle(group.category)}</span>
                <IconGrid icons={group.icons} row={row} onIcon={onIcon} />
              </div>
            ))
          )
        ) : open ? (
          <>
            <Button variant="ghost" size="sm" className="-ml-1 gap-1 self-start" onClick={() => setCategory(undefined)}>
              <ChevronLeft aria-hidden="true" />
              {categoryTitle(open.category)}
            </Button>
            <IconGrid icons={open.icons} row={row} onIcon={onIcon} />
          </>
        ) : (
          categories.map(({ category: each, icons }) => {
            const cover = icons.find((icon) => icon.id === COLLECTION_COVERS[each]) ?? icons[0]
            return <CollectionRow key={each} name={categoryTitle(each)} selected={false} picture={cover && <TilePicture icon={cover} />} onClick={() => setCategory(each)} />
          })
        )}
      </div>
    </div>
  )
}

/**
 * What the row shows, picked in one popup: a Colour | Icon switch at the
 * top, starting on what the row has. Switching only shows the other choices;
 * the row changes once an icon or a colour is picked.
 */
function MarkerChoices({ row, onIcon, onColour, used }: { row: LegendRow; onIcon: (id: string, name: string) => void; onColour: (colour: string) => void; used: () => readonly string[] }) {
  const [tab, setTab] = useState<LegendRow['kind']>(row.kind)
  return (
    <div className="flex flex-col gap-3 p-3">
      <SegmentedToggle
        label="Show as"
        showLabels
        className="h-8 w-full"
        value={tab}
        onValueChange={setTab}
        options={[
          // Colour first: a new row starts as a colour (owner's feedback, 2026-11-26).
          { value: 'swatch', label: 'Colour', icon: Palette },
          { value: 'icon', label: 'Icon', icon: Shapes },
        ]}
      />
      {tab === 'icon' ? (
        <IconChoices row={row} onIcon={onIcon} />
      ) : (
        // Nothing is picked until a colour is: an icon row shows no colour as chosen.
        <ColourSwatches label={`Colour of ${row.label || 'row'}`} value={row.kind === 'swatch' ? row.colour : undefined} onChange={(colour) => colour && onColour(colour)} used={used} />
      )}
    </div>
  )
}

/** An icon row's marker: the icon itself. */
function IconMarker({ row }: { row: LegendRow }) {
  const loaded = useIconSvg(row.svg ? undefined : row.iconId)
  const svg = row.svg ?? loaded
  return svg ? <img src={svgUrl(svg)} alt="" className="size-6" /> : <span className="size-5 rounded-md bg-muted" />
}

type Props = {
  figure: FigureCanvas | null
  /** The selected legend; its settings are in `legend.legend`. */
  legend: SelectionInfo
  /** Back to the block cards; also lets go of the legend. */
  onBack: () => void
}

export function LegendProperties({ figure, legend, onBack }: Props) {
  const toasts = useToast()
  const settings = legend.legend
  if (!settings) return null
  const lone = settings.rows.length < 2
  // A new icon: its SVG goes with the row, so the figure draws without the library.
  const setIcon = (row: LegendRow, id: string, name: string) => {
    void loadIconSvg(id).then((svg) => {
      // Renamed only while it still has its old icon's name (or a new row's).
      const keepLabel = row.kind === 'icon' && row.label.trim() !== '' && !/^Icon \d+$/.test(row.label)
      figure?.updateLegendRow(row.id, { kind: 'icon', iconId: id, svg, ...(!keepLabel && { label: name }) })
    })
  }
  return (
    <>
      <PropertiesHeader backLabel="Back to blocks" picture={<ListOrdered />} name="Legend" onBack={onBack} />
      <div className="px-3 pt-1 pb-3">
        <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/40 p-2">
          <div className="px-1 pb-0.5 text-xs text-muted-foreground">Rows</div>
          {settings.rows.map((row) => (
            <div key={row.id} className="flex min-w-0 items-center gap-1.5">
              <Popover
                title={`Icon or colour for ${row.label || 'this row'}`}
                className="w-80"
                trigger={
                  <button
                    type="button"
                    aria-label={`Icon or colour of ${row.label || 'row'}`}
                    className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-md border border-border-strong bg-white transition-colors duration-(--duration-instant) hover:border-foreground/30 focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    {row.kind === 'icon' ? <IconMarker row={row} /> : <span className="size-full" style={{ background: row.colour }} />}
                  </button>
                }
              >
                <MarkerChoices row={row} onIcon={(id, name) => setIcon(row, id, name)} onColour={(colour) => figure?.updateLegendRow(row.id, { kind: 'swatch', colour })} used={() => figure?.usedColours() ?? []} />
              </Popover>
              <LiveTextField label={`Label of ${row.label || 'row'}`} value={row.label} placeholder="Label" onType={(label) => figure?.updateLegendRow(row.id, { label }, `legend-label-${row.id}`)} onDone={() => undefined} className="min-w-0 flex-1" />
              <IconButton icon={Minus} label={lone ? 'A legend keeps at least one row' : `Remove ${row.label || 'row'}`} disabled={lone} onClick={() => removeLegendRowWithUndo(toasts, figure, row.id, row.label)} />
            </div>
          ))}
          <Button variant="secondary" size="sm" className="mt-1 gap-1.5 self-end" onClick={() => figure?.addLegendRow()}>
            <Plus aria-hidden="true" />
            Row
          </Button>
        </div>
      </div>
      <PropRows className="border-t border-border pt-3 [&>[data-wide-label]:not(:first-child)]:mt-3">
        <PropRow label="Layout" wide>
          <div role="group" aria-label="Legend layout" className="grid w-full grid-cols-2 gap-1.5">
            {(['down', 'across'] as const).map((layout) => (
              <Tile key={layout} name={layout === 'down' ? 'Down' : 'Across'} short={layout === 'down' ? 'Down' : 'Across'} on={settings.layout === layout} onClick={() => figure?.setLegend({ layout })}>
                <LayoutPicture layout={layout} />
              </Tile>
            ))}
          </div>
        </PropRow>
        <PropRow label="Style" wide>
          <div role="group" aria-label="Legend style" className="grid w-full grid-cols-3 gap-1.5">
            {LEGEND_LOOKS.map((look) => (
              <Tile key={look.id} name={look.name} short={look.name} on={settings.look === look.id} onClick={() => figure?.setLegend({ look: look.id })}>
                <LookPicture settings={settings} look={look.id} />
              </Tile>
            ))}
          </div>
        </PropRow>
        {settings.look === 'boxed' && (
          <PropRow label="Header">
            <LiveTextField label="Header" value={settings.title} placeholder="No header text" onType={(title) => figure?.setLegend({ title }, 'legend-title')} onDone={() => undefined} className="min-w-0 flex-1" />
          </PropRow>
        )}
        {settings.look !== 'plain' && (
          <PropRow label="Preset" wide>
            <PresetPicker
              groups={PRESET_GROUPS}
              row={ROW}
              look={swatchLook}
              isOn={(preset) => preset.colour === settings.colour.toLowerCase()}
              onPick={(preset) => figure?.setLegend({ colour: preset.colour })}
              columns={6}
              customLabel="Custom colour"
              custom={<ColourInput label="Legend colour" value={settings.colour} onChange={(next) => next && figure?.setLegend({ colour: next })} used={() => figure?.usedColours() ?? []} className="min-w-0 flex-1" />}
            />
          </PropRow>
        )}
      </PropRows>
      <div className="border-t border-border p-3">
        <Button variant="secondary" size="sm" className="w-full gap-1.5" onClick={() => void detachLegendWithUndo(toasts, figure)}>
          <Unlink aria-hidden="true" />
          Detach legend
        </Button>
      </div>
    </>
  )
}
