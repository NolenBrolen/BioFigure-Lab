/* Centre: the white figure page, the zoom controls and Preview. The drawing tools live in the tool rail. */
import { Button } from '@biofigure-lab/ui/components/button/Button'
import { IconButton } from '@biofigure-lab/ui/components/icon-button/IconButton'
import { cn } from '@biofigure-lab/ui/lib/cn'
import { ContextMenu, type MenuSection } from '@biofigure-lab/ui/components/menu/Menu'
import { QuickActions, type QuickActionGroup } from '@biofigure-lab/ui/components/quick-actions/QuickActions'
import { Eye, Maximize, ZoomIn, ZoomOut } from 'lucide-react'
import { useLayoutEffect, useRef, useState, type DragEvent, type MouseEvent, type ReactNode, type RefObject } from 'react'

import type { SelectionInfo } from '../editor/FigureCanvas'

import type { Tool } from '../editor/shapes'
import { ICON_DRAG_TYPE } from '../editor/icon-library'
import { MAX_ZOOM, MIN_ZOOM } from '../editor/units'

type CanvasAreaProps = {
  canvasHostRef: RefObject<HTMLDivElement | null>
  viewportRef: RefObject<HTMLDivElement | null>
  /** Room under the page for a panel floating over the canvas (the chart data), in px. */
  bottomInset?: number
  /** Above the page: the figure's name and its size menu. */
  pageLabel: ReactNode
  tool: Tool
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomFit: () => void
  /** Opens the paper preview: the figure on an A4 journal page. */
  onPreview: () => void
  /** Something dragged in (an icon from the library) was let go over the page area. */
  onDropIcon: (id: string, clientX: number, clientY: number) => void
  selection: SelectionInfo | null
  /** The selection is being dragged, resized or rotated: the toolbar steps aside. */
  transforming: boolean
  quickActions: (openMenu: (button: HTMLElement) => void) => QuickActionGroup[]
  menuSections: MenuSection[]
  /** Right-click at a point relative to the page's top-left corner, in screen pixels. */
  onRightClick: (x: number, y: number) => void
  /** The phone layout: less room around the page, and only Fit page in the corner (pinch zooms). */
  compact?: boolean
}

export function CanvasArea(props: CanvasAreaProps) {
  const { canvasHostRef, viewportRef, pageLabel, tool, zoom, onZoomIn, onZoomOut, onZoomFit, onPreview, onDropIcon, bottomInset } = props
  const { selection, transforming, quickActions, menuSections, onRightClick, compact = false } = props
  const areaRef = useRef<HTMLElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const onContextMenu = (event: MouseEvent) => {
    // "More actions" opens the menu with a made-up right-click: the selection stays then.
    const host = canvasHostRef.current?.getBoundingClientRect()
    if (!event.nativeEvent.isTrusted || !host) return
    onRightClick(event.clientX - host.left, event.clientY - host.top)
  }
  const openMenuBelow = (button: Element) => {
    const box = button.getBoundingClientRect()
    viewportRef.current?.dispatchEvent(new globalThis.MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: box.left, clientY: box.bottom + 4 }))
  }
  const acceptIcon = (event: DragEvent) => {
    if (!event.dataTransfer.types.includes(ICON_DRAG_TYPE)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }
  return (
    <main ref={areaRef} aria-label="Canvas" className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-canvas">
      {/* The page scrolls when zoomed in past the window; `m-auto` keeps it centred otherwise. */}
      <ContextMenu sections={menuSections} onOpenChange={setMenuOpen}>
        <div
          ref={viewportRef}
          onContextMenu={onContextMenu}
          className={cn('absolute inset-0 flex overflow-auto', compact ? 'touch-pan-x touch-pan-y' : '[scrollbar-gutter:stable_both-edges]')}
          onDragOver={acceptIcon}
          onDrop={(event) => {
            const id = event.dataTransfer.getData(ICON_DRAG_TYPE)
            if (!id) return
            event.preventDefault()
            onDropIcon(id, event.clientX, event.clientY)
          }}
        >
          <div className={cn('m-auto flex flex-col gap-2', compact ? 'p-4 pb-6 transition-[padding] duration-(--duration-slow) ease-out motion-reduce:transition-none' : 'p-12 pb-16')} style={bottomInset ? { paddingBottom: bottomInset } : undefined}>
            <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">{pageLabel}</div>
            <div ref={canvasHostRef} className="bg-page shadow-(--elevation-page)" />
          </div>
        </div>
      </ContextMenu>

      {/* Also over text whose characters are selected while typing, with any tool. */}
      {selection && (tool === 'select' || selection.textRange) && !transforming && !menuOpen && (
        <SelectionToolbar
          selection={selection}
          zoom={zoom}
          groups={quickActions(openMenuBelow)}
          areaRef={areaRef}
          canvasHostRef={canvasHostRef}
          viewportRef={viewportRef}
        />
      )}

      {/* Phones: Preview, Fit page and the zoom level only; pinching zooms. */}
      {compact ? (
        <div className="absolute top-2 right-2 flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground/80 tabular-nums">{Math.round(zoom * 100)}%</span>
          <Button className="h-[30px] bg-panel shadow-md" onClick={onPreview}>
            <Eye strokeWidth={1.75} aria-hidden="true" />
            Preview
          </Button>
          <div className="rounded-lg border bg-panel p-0.5 shadow-md">
            <IconButton icon={Maximize} label="Fit page" size="sm" tooltipSide="bottom" onClick={onZoomFit} />
          </div>
        </div>
      ) : (
      /* Top right corner: Preview, then the zoom controls with the zoom level faintly under them. */
      <div className="absolute top-3 right-3 flex items-start gap-2">
        <Button className="h-[30px] bg-panel shadow-md" onClick={onPreview}>
          <Eye strokeWidth={1.75} aria-hidden="true" />
          Preview
        </Button>
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-0.5 rounded-lg border bg-panel p-0.5 shadow-md">
            <IconButton icon={ZoomOut} label="Zoom out" shortcut="Mod+-" size="sm" tooltipSide="bottom" disabled={zoom <= MIN_ZOOM} onClick={onZoomOut} />
            <IconButton icon={ZoomIn} label="Zoom in" shortcut="Mod+=" size="sm" tooltipSide="bottom" disabled={zoom >= MAX_ZOOM} onClick={onZoomIn} />
            <IconButton icon={Maximize} label="Fit page" shortcut="Shift+1" size="sm" tooltipSide="bottom" onClick={onZoomFit} />
          </div>
          <span className="text-[11px] text-muted-foreground/80 tabular-nums">{Math.round(zoom * 100)}%</span>
        </div>
      </div>
      )}
    </main>
  )
}

/** Space between the toolbar and the selection, and from the canvas area's edges. */
const TOOLBAR_GAP_PX = 12
/** Above the selection the toolbar also clears the rotate handle: Fabric puts it 40 px above the edge, and it's 9 px across. */
const ROTATE_HANDLE_PX = 52
/** The small bar over highlighted characters sits this close above them. */
const RANGE_GAP_PX = 6

type SelectionToolbarProps = {
  selection: SelectionInfo
  zoom: number
  groups: QuickActionGroup[]
  areaRef: RefObject<HTMLElement | null>
  canvasHostRef: RefObject<HTMLDivElement | null>
  viewportRef: RefObject<HTMLDivElement | null>
}

/**
 * The quick-actions toolbar, centred just above the selection, or just below
 * it when there's no room above. It follows the selection as it changes and
 * as the page scrolls.
 */
function SelectionToolbar({ selection, zoom, groups, areaRef, canvasHostRef, viewportRef }: SelectionToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null)
  const [place, setPlace] = useState<{ left: number; top: number; below: boolean }>()

  useLayoutEffect(() => {
    const area = areaRef.current
    const host = canvasHostRef.current
    const toolbar = toolbarRef.current
    const viewport = viewportRef.current
    if (!area || !host || !toolbar || !viewport) return
    const position = () => {
      const areaBox = area.getBoundingClientRect()
      const hostBox = host.getBoundingClientRect()
      // Over highlighted characters the small bar sits right above them; it styles just those.
      const range = selection.textRangeBounds
      const bounds = range ?? selection.bounds
      const centre = hostBox.left - areaBox.left + (bounds.left + bounds.width / 2) * zoom
      const top = hostBox.top - areaBox.top + bounds.top * zoom
      const bottom = top + bounds.height * zoom
      const height = toolbar.offsetHeight
      const above = top - (range ? RANGE_GAP_PX : TOOLBAR_GAP_PX + ROTATE_HANDLE_PX) - height
      const below = above < TOOLBAR_GAP_PX
      const half = toolbar.offsetWidth / 2
      setPlace({
        left: Math.min(Math.max(centre, half + TOOLBAR_GAP_PX), areaBox.width - half - TOOLBAR_GAP_PX),
        top: below ? bottom + (range ? RANGE_GAP_PX : TOOLBAR_GAP_PX) : above,
        below,
      })
    }
    position()
    viewport.addEventListener('scroll', position, { passive: true })
    window.addEventListener('resize', position)
    return () => {
      viewport.removeEventListener('scroll', position)
      window.removeEventListener('resize', position)
    }
  }, [selection, zoom, areaRef, canvasHostRef, viewportRef])

  return (
    <div className="absolute z-10 -translate-x-1/2" style={place ? { left: place.left, top: place.top } : { visibility: 'hidden' }}>
      <QuickActions ref={toolbarRef} label={`${selection.name} actions`} groups={groups} size={selection.textRangeBounds ? 'sm' : 'md'} keepFocus={selection.text !== undefined} tooltipSide={place?.below ? 'bottom' : 'top'} />
    </div>
  )
}
