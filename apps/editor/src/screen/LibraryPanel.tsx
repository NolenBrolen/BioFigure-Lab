/*
 * Icon library with search and categories. It opens on a list of collections
 * (one row per category); a row opens that collection, with a back arrow.
 * Searching from the list looks through every collection (BIO-92).
 * Click a tile to put the icon in
 * the middle of the page, or drag
 * it to where you want it. Tiles (the default) or a list, switched at the top.
 * Beside that, the style switch (Clean, Graphite, Shaded, Scribble) shows every
 * tile in that style; clicking or dragging then adds that version.
 * Each tile's picture loads only when the tile scrolls near the screen.
 * The panel and its tiles are memoised: the canvas changes many times a
 * second while dragging, and redrawing hundreds of tiles each time made the
 * editor slow (BIO-88).
 */
import { CollectionRow } from '@biofigure-lab/ui/components/collection-row/CollectionRow'
import { DropdownMenu } from '@biofigure-lab/ui/components/menu/Menu'
import { IconButton } from '@biofigure-lab/ui/components/icon-button/IconButton'
import { IconTile, type IconTileLook } from '@biofigure-lab/ui/components/icon-tile/IconTile'
import { cn } from '@biofigure-lab/ui/lib/cn'
import { SearchField } from '@biofigure-lab/ui/components/search-field/SearchField'
import { SegmentedToggle } from '@biofigure-lab/ui/components/segmented-toggle/SegmentedToggle'
import { Skeleton } from '@biofigure-lab/ui/components/skeleton/Skeleton'
import { Flag, LayoutGrid, List, MoreHorizontal } from 'lucide-react'
import { memo, useMemo, useRef, useState } from 'react'

import { browseIcons, categoryTitle, ICON_DRAG_TYPE, inStyle, isDarkLineArt, libraryIcons, needsLightBacking, styleVersion, type IconStyle, type LibraryIcon } from '../editor/icon-library'
import { PropertiesHeader } from './properties-pane'
import { useIconSvg } from './useIconSvg'

const viewOptions = [
  { value: 'badge', icon: LayoutGrid, label: 'Show as tiles' },
  { value: 'row', icon: List, label: 'Show as list' },
] as const satisfies readonly { value: IconTileLook; icon: typeof List; label: string }[]

export const pictureUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

/** The styles, each pictured as a T cell drawn that way. */
const STYLE_OPTIONS: readonly { value: IconStyle; label: string }[] = [
  { value: 'clean', label: 'Clean: icons as drawn' },
  { value: 'graphite', label: 'Graphite: grey pencil outlines' },
  { value: 'shaded', label: 'Shaded: grey pencil with hatching' },
  { value: 'scribble', label: 'Scribble: colour scribble, dark outline' },
]
const STYLE_SAMPLE = 'cells/t-cell-simple-flat'

function StylePicture({ style }: { style: IconStyle }) {
  const svg = useIconSvg(styleVersion(STYLE_SAMPLE, style))
  return svg ? <img src={pictureUrl(svg)} alt="" draggable={false} /> : <Skeleton className="size-full" />
}

/**
 * A tile's picture, loaded when the tile comes near the screen. Dark one-colour line icons are drawn for a
 * white page; in dark mode their previews are flipped light so they stay visible. Chemistry structures and
 * pencil drawings sit on a white square instead, which keeps their colours. Other icons keep their own colours.
 */
export function TilePicture({ icon }: { icon: LibraryIcon }) {
  const near = useRef<HTMLSpanElement>(null)
  const svg = useIconSvg(icon.id, near)
  const src = useMemo(() => svg && pictureUrl(svg), [svg])
  if (!svg) {
    return (
      <span ref={near} className="block">
        <Skeleton className="size-full" />
      </span>
    )
  }
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      // Dimmed in dark mode like the page (page brightness slider), so white parts don't glare.
      className={cn(
        'dark:brightness-(--page-dim)',
        needsLightBacking(icon) ? 'dark:rounded-sm dark:bg-white dark:p-[6%]' : isDarkLineArt(svg) && 'dark:invert dark:hue-rotate-180',
      )}
    />
  )
}

/** The icon each collection row shows, picked by the owner; collections not listed show their first icon. */
export const COLLECTION_COVERS: Record<string, string> = {
  cells: 'cells/t-cell-glyph-outlined',
  'lab equipment': 'equipment/erlenmeyer-flask',
  'small molecules': 'small-molecules/aspirin-filled-rings',
}

type TileProps ={ icon: LibraryIcon; look: IconTileLook; onAdd: (icon: LibraryIcon) => void; onReport?: (icon: LibraryIcon) => void }

/** One library tile, with its ⋯ menu over the corner when there is a way to report an icon. */
const LibraryTile = memo(function LibraryTile({ icon, look, onAdd, onReport }: TileProps) {
  // The menu is only made once the tile is hovered, focused or its ⋯ pressed: hundreds of ready-made menus were slow (BIO-88).
  const [menu, setMenu] = useState<'none' | 'ready' | 'open'>('none')
  const ready = () => setMenu((now) => (now === 'none' ? 'ready' : now))
  const tile = (
    <IconTile
      look={look}
      name={icon.name}
      picture={<TilePicture icon={icon} />}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(ICON_DRAG_TYPE, icon.id)
        event.dataTransfer.effectAllowed = 'copy'
      }}
      onClick={() => onAdd(icon)}
    />
  )
  if (!onReport) return tile
  const label = `More about ${icon.name}`
  // The ⋯ button sits over the tile's corner; it shows on hover or focus, and always on touch screens.
  return (
    <div className="group/tile relative min-w-0" onPointerEnter={ready} onFocus={ready}>
      {tile}
      <div className={cn('absolute opacity-0 transition-opacity duration-(--duration-instant) group-focus-within/tile:opacity-100 group-hover/tile:opacity-100 pointer-coarse:opacity-100', look === 'row' ? 'top-2 right-1' : 'top-1 right-1')}>
        {menu === 'none' ? (
          // A tap on a touch screen can land before any hover: the menu is then made already open.
          <IconButton icon={MoreHorizontal} label={label} size="sm" onClick={() => setMenu('open')} />
        ) : (
          <DropdownMenu
            align="end"
            defaultOpen={menu === 'open'}
            trigger={<IconButton icon={MoreHorizontal} label={label} size="sm" />}
            sections={[{ label: icon.name, actions: [{ label: 'Report issue…', icon: Flag, onClick: () => onReport(icon) }] }]}
          />
        )}
      </div>
    </div>
  )
})

export const LibraryPanel = memo(function LibraryPanel({ icons = libraryIcons, onAdd, onReport }: { icons?: readonly LibraryIcon[]; onAdd: (icon: LibraryIcon) => void; onReport?: (icon: LibraryIcon) => void }) {
  const [query, setQuery] = useState('')
  const [look, setLook] = useState<IconTileLook>('badge')
  const [style, setStyle] = useState<IconStyle>('clean')
  // The open collection (a category), or none: then the panel lists the collections (BIO-92).
  const [collection, setCollection] = useState<string | null>(null)
  // Each tile shows (and adds) its version in the chosen style.
  const categories = useMemo(
    () =>
      browseIcons(collection ? icons.filter((icon) => icon.category === collection) : icons, query).map(({ category, icons: found }) => ({
        category,
        icons: inStyle(found, style),
      })),
    [icons, query, style, collection],
  )
  const searching = query.trim() !== ''
  /** The collection's picture: its chosen cover (in the current style) when it has one, else its first icon. */
  const coverOf = (category: string, inCategory: LibraryIcon[]) => {
    const cover = icons.find((icon) => icon.id === COLLECTION_COVERS[category])
    return (cover && inStyle([cover], style)[0]) ?? inCategory[0]
  }
  const closeCollection = () => {
    setCollection(null)
    setQuery('')
  }

  const switches = (
    <div className="flex items-center gap-1.5">
      <SegmentedToggle label="Icon style" options={STYLE_OPTIONS.map((option) => ({ ...option, picture: <StylePicture style={option.value} /> }))} value={style} onValueChange={setStyle} />
      <SegmentedToggle label="View" options={viewOptions} value={look} onValueChange={setLook} />
    </div>
  )
  const tiles = (shown: LibraryIcon[]) => (
    <div className={look === 'row' ? 'flex flex-col' : 'grid grid-cols-3 gap-2'}>
      {shown.map((icon) => (
        // Tiles off screen are skipped by the browser until scrolled near, each holding its place at a tile's height,
        // so showing the library again (selecting an icon space) doesn't lay out hundreds of tiles (BIO-90).
        // The 3 px around the tile (taken back by the margin) leave room for its focus ring, which would be clipped otherwise.
        <div key={icon.id} className={cn('-m-[3px] min-w-0 p-[3px] [content-visibility:auto]', look === 'row' ? '[contain-intrinsic-size:auto_40px]' : '[contain-intrinsic-size:auto_140px]')}>
          <LibraryTile icon={icon} look={look} onAdd={onAdd} onReport={onReport} />
        </div>
      ))}
    </div>
  )

  return (
    <aside aria-label="Icon library" className="flex min-h-0 flex-1 flex-col overflow-hidden bg-panel">
      {/* Both headers are the same height, so the search field stays put when a collection opens. */}
      {collection ? (
        <PropertiesHeader backLabel="Back to collections" name={categoryTitle(collection)} onBack={closeCollection} />
      ) : (
        <div className="flex h-12 shrink-0 items-center px-3 text-sm font-semibold">Icons</div>
      )}
      <div className="flex flex-col gap-2 p-3 pt-0 pb-2">
        <SearchField
          label="Search icons"
          placeholder="Search icons"
          value={query}
          onValueChange={setQuery}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3 [scrollbar-gutter:stable]">
        {icons.length === 0 ? (
          // A copy of the source code without the separately downloaded icon pack.
          <div role="status" className="flex flex-col gap-1.5 pt-4 text-center text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Icon library not installed</p>
            <p>
              Run <code className="rounded-sm bg-muted px-1 py-0.5 font-mono">npm run icons</code> to download it, then restart the editor.
            </p>
          </div>
        ) : (
          categories.length === 0 && (
            <p className="pt-4 text-center text-xs text-muted-foreground">
              {query ? `No icons match “${query}”.` : 'No icons to show.'}
            </p>
          )
        )}
        {!collection && !searching && categories.length > 0 && (
          // The start: one row per collection, its first icon (in the chosen style) as the picture.
          <nav aria-label="Icon collections" className="flex flex-col gap-2 pt-2">
            {categories.map(({ category, icons: inCategory }) => {
              const cover = coverOf(category, inCategory)
              return <CollectionRow key={category} name={categoryTitle(category)} selected={false} picture={cover && <TilePicture icon={cover} />} onClick={() => setCollection(category)} />
            })}
          </nav>
        )}
        {(collection || searching) &&
          categories.map(({ category, icons: inCategory }, index) => (
            <section key={category} aria-label={categoryTitle(category)} className="pt-2">
              {/* Inside a collection the header above already names it; the switches get the row to themselves. */}
              <div className={cn('mb-2 flex h-7 items-center', collection ? 'justify-end' : 'justify-between')}>
                {!collection && <h3 className="section-label">{categoryTitle(category)}</h3>}
                {/* The style and view switches sit beside the first heading, so they cost no extra row. */}
                {index === 0 && switches}
              </div>
              {tiles(inCategory)}
            </section>
          ))}
      </div>
    </aside>
  )
})
