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
  /** Shown over the canvas, covering it (an earlier version of the slide, BIO-36). */
  cover?: ReactNode
  tool: Tool
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomFit: () => void
  /** Opens the paper preview: the figure on an A4 journal page. */
  onPreview: () => void
  /** Something dragged in (an icon from the library) was let go over the page area. */
  onDropIcon: (id: string, clientX: number, clientY: number) => void
  /** An icon from the Icons panel is dragged over the page (a screen point), or has left it (none). */
  onDragIconOver?: (point: { clientX: number; clientY: number } | undefined) => void
  selection: SelectionInfo | null
  /** The selection is being dragged, resized or rotated: the toolbar steps aside. */
  transforming: boolean
  quickActions: (openMenu: (button: HTMLElement) => void) => QuickActionGroup[]
  menuSections: MenuSection[]
  /** Right-click at a point relative to the page's top-left corner, in screen pixels. */
  onRightClick: (x: number, y: number) => void
  /** A press on the grey area round the page (not the page, its label's controls or the buttons over it). */
  onBackdropPress?: () => void
  /** The phone layout: less room around the page, and only Fit page in the corner (pinch zooms). */
  compact?: boolean
}

export function CanvasArea(props: CanvasAreaProps) {
  const { canvasHostRef, viewportRef, pageLabel, tool, zoom, onZoomIn, onZoomOut, onZoomFit, onPreview, onDropIcon, onDragIconOver, bottomInset } = props
  const { selection, transforming, quickActions, menuSections, onRightClick, onBackdropPress, compact = false } = props
  const areaRef = useRef<HTMLElement>(null)
  // Which way the menu opened: from the bar's More actions button the bar stays, so the menu is seen to come from it (BIO-82).
  const [menuOpen, setMenuOpen] = useState<'more' | 'click' | false>(false)
  const fromMore = useRef(false)
  const onContextMenu = (event: MouseEvent) => {
    // "More actions" opens the menu with a made-up right-click: the selection stays then.
    const host = canvasHostRef.current?.getBoundingClientRect()
    if (!event.nativeEvent.isTrusted || !host) return
    onRightClick(event.clientX - host.left, event.clientY - host.top)
  }
  const openMenuBelow = (button: Element) => {
    const box = button.getBoundingClientRect()
    fromMore.current = true
    viewportRef.current?.dispatchEvent(new globalThis.MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: box.left, clientY: box.bottom + 4 }))
  }
  const acceptIcon = (event: DragEvent) => {
    if (!event.dataTransfer.types.includes(ICON_DRAG_TYPE)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    onDragIconOver?.({ clientX: event.clientX, clientY: event.clientY })
  }
  return (
    <main ref={areaRef} aria-label="Canvas" className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-canvas">
      {/* The page scrolls when zoomed in past the window; `m-auto` keeps it centred otherwise. */}
      <ContextMenu
        sections={menuSections}
        onOpenChange={(open) => {
          setMenuOpen(open ? (fromMore.current ? 'more' : 'click') : false)
          fromMore.current = false
        }}
      >
        <div
          ref={viewportRef}
          onContextMenu={onContextMenu}
          data-canvas-backdrop=""
          onPointerDown={(event) => {
            // A click on the grey area round the page drops the selection, like a click on an empty spot of the page.
            if (event.button === 0 && event.target instanceof Element && event.target.hasAttribute('data-canvas-backdrop')) onBackdropPress?.()
          }}
          className={cn('absolute inset-0 flex overflow-auto', compact ? 'touch-pan-x touch-pan-y' : '[scrollbar-gutter:stable_both-edges]')}
          onDragOver={acceptIcon}
          onDragLeave={(event) => {
            // Only when it leaves the page area, not when it passes from one part of it to another.
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onDragIconOver?.(undefined)
          }}
          onDrop={(event) => {
            const id = event.dataTransfer.getData(ICON_DRAG_TYPE)
            onDragIconOver?.(undefined)
            if (!id) return
            event.preventDefault()
            onDropIcon(id, event.clientX, event.clientY)
          }}
        >
          <div data-canvas-backdrop="" className={cn('m-auto flex flex-col gap-2', compact ? 'p-4 pb-6 transition-[padding] duration-(--duration-slow) ease-out motion-reduce:transition-none' : 'p-12 pb-16')} style={bottomInset ? { paddingBottom: bottomInset } : undefined}>
            {/* Wraps on a narrow page, so the dark-mode brightness slider never sticks out past it. */}
            <div data-canvas-backdrop="" className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">{pageLabel}</div>
            {/* Dimmed on screen in dark mode so it doesn't glare; the figure and its export stay white. */}
            <div ref={canvasHostRef} className="bg-page shadow-(--elevation-page) dark:brightness-(--page-dim)" />
          </div>
        </div>
      </ContextMenu>
      {props.cover}

      {/* Also over text whose characters are selected while typing, with any tool, and over an arrow picked with the Arrow tool on (BIO-82). */}
      {selection && (tool === 'select' || selection.textRange || (tool === 'arrow' && selection.kind === 'line')) && !transforming && menuOpen !== 'click' && (
        <SelectionToolbar
          selection={selection}
          zoom={zoom}
          groups={quickActions(openMenuBelow)}
          // Names under the icons on desktop (BIO-82); phones keep the short bar, and so does the formatting bar over highlighted letters.
          showLabels={!compact && !selection.textRange}
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

type SelectionToolbarProps = {
  selection: SelectionInfo
  zoom: number
  groups: QuickActionGroup[]
  showLabels: boolean
  areaRef: RefObject<HTMLElement | null>
  canvasHostRef: RefObject<HTMLDivElement | null>
  viewportRef: RefObject<HTMLDivElement | null>
}

/**
 * The quick-actions toolbar, centred just above the selection, or just below
 * it when there's no room above. It follows the selection as it changes and
 * as the page scrolls.
 */
function SelectionToolbar({ selection, zoom, groups, showLabels, areaRef, canvasHostRef, viewportRef }: SelectionToolbarProps) {
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
      // Highlighted characters get their bar in the same place as the text's own bar, so it doesn't jump (BIO-82).
      const bounds = selection.bounds
      const centre = hostBox.left - areaBox.left + (bounds.left + bounds.width / 2) * zoom
      const top = hostBox.top - areaBox.top + bounds.top * zoom
      const bottom = top + bounds.height * zoom
      const height = toolbar.offsetHeight
      const above = top - TOOLBAR_GAP_PX - ROTATE_HANDLE_PX - height
      const below = above < TOOLBAR_GAP_PX
      const half = toolbar.offsetWidth / 2
      setPlace({
        left: Math.min(Math.max(centre, half + TOOLBAR_GAP_PX), areaBox.width - half - TOOLBAR_GAP_PX),
        top: below ? bottom + TOOLBAR_GAP_PX : above,
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
      <QuickActions ref={toolbarRef} label={`${selection.name} actions`} groups={groups} showLabels={showLabels} keepFocus={selection.text !== undefined} tooltipSide={place?.below ? 'bottom' : 'top'} />
    </div>
  )
}
