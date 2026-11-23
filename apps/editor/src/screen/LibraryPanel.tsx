/*
 * Icon library with search and categories. Click a tile to put the icon in
 * the middle of the page, or drag
 * it to where you want it. Tiles (the default) or a list, switched at the top.
 * Beside that, the style switch (Clean, Graphite, Shaded, Scribble) shows every
 * tile in that style; clicking or dragging then adds that version.
 * Each tile's picture loads only when the tile scrolls near the screen.
 */
import { IconTile, type IconTileLook } from '@biofigure-lab/ui/components/icon-tile/IconTile'
import { SearchField } from '@biofigure-lab/ui/components/search-field/SearchField'
import { SegmentedToggle } from '@biofigure-lab/ui/components/segmented-toggle/SegmentedToggle'
import { Skeleton } from '@biofigure-lab/ui/components/skeleton/Skeleton'
import { LayoutGrid, List } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'

import { browseIcons, categoryTitle, ICON_DRAG_TYPE, inStyle, isDarkLineArt, libraryIcons, needsLightBacking, styleVersion, type IconStyle, type LibraryIcon } from '../editor/icon-library'
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
function TilePicture({ icon }: { icon: LibraryIcon }) {
  const near = useRef<HTMLSpanElement>(null)
  const svg = useIconSvg(icon.id, near)
  if (!svg) {
    return (
      <span ref={near} className="block">
        <Skeleton className="size-full" />
      </span>
    )
  }
  return (
    <img
      src={pictureUrl(svg)}
      alt=""
      draggable={false}
      className={needsLightBacking(icon) ? 'dark:rounded-sm dark:bg-white dark:p-[6%]' : isDarkLineArt(svg) ? 'dark:invert dark:hue-rotate-180' : undefined}
    />
  )
}

export function LibraryPanel({ icons = libraryIcons, onAdd }: { icons?: readonly LibraryIcon[]; onAdd: (icon: LibraryIcon) => void }) {
  const [query, setQuery] = useState('')
  const [look, setLook] = useState<IconTileLook>('badge')
  const [style, setStyle] = useState<IconStyle>('clean')
  // Each tile shows (and adds) its version in the chosen style.
  const categories = useMemo(
    () => browseIcons(icons, query).map(({ category, icons: found }) => ({ category, icons: inStyle(found, style) })),
    [icons, query, style],
  )

  return (
    <aside aria-label="Icon library" className="flex min-h-0 flex-1 flex-col overflow-hidden bg-panel">
      <div className="flex flex-col gap-2 p-3 pb-2">
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
        {categories.map(({ category, icons }, index) => (
          <section key={category} aria-label={categoryTitle(category)} className="pt-2">
            <div className="mb-2 flex h-7 items-center justify-between">
              <h3 className="section-label">{categoryTitle(category)}</h3>
              {/* The style and view switches sit beside the first heading, so they cost no extra row. */}
              {index === 0 && (
                <div className="flex items-center gap-1.5">
                  <SegmentedToggle label="Icon style" options={STYLE_OPTIONS.map((option) => ({ ...option, picture: <StylePicture style={option.value} /> }))} value={style} onValueChange={setStyle} />
                  <SegmentedToggle label="View" options={viewOptions} value={look} onValueChange={setLook} />
                </div>
              )}
            </div>
            <div className={look === 'row' ? 'flex flex-col' : 'grid grid-cols-3 gap-2'}>
              {icons.map((icon) => {
                return (
                  <IconTile
                    key={icon.id}
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
              })}
            </div>
          </section>
        ))}
      </div>
    </aside>
  )
}
