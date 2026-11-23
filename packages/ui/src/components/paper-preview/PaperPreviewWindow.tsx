/*
 * Paper preview window: covers the whole editor and shows the figure on an
 * A4 journal page (see PaperPreview). The bar at the top has the title and
 * the figure's size on the left, then the page layout (title page or inside
 * page), the zoom (fit the page in the window, or actual size) and close (X)
 * on the outer right. Escape closes it too.
 *
 * Built on Base UI's Dialog, so focus stays inside while it's open.
 */
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { BookOpen, FileText, Maximize, Ruler, X } from 'lucide-react'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

import { usePhoneLayout } from '../../lib/use-media-query'
import { IconButton } from '../icon-button/IconButton'
import { SegmentedToggle } from '../segmented-toggle/SegmentedToggle'
import { figureColumns, fittedFigureMm, PAGE_PX, PaperPreview, TEXT_WIDTH_MM, type PaperLayout } from './PaperPreview'

export type PaperZoom = 'fit' | 'actual'

export type PaperPreviewWindowProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The figure, e.g. its SVG. An `<svg>` child is stretched to its size on paper. */
  figure: ReactNode
  figureMm: { width: number; height: number }
  caption?: string
}

const layouts = [
  { value: 'title-page', icon: BookOpen, label: 'Title page' },
  { value: 'inside-page', icon: FileText, label: 'Inside page' },
] as const

const zooms = [
  { value: 'fit', icon: Maximize, label: 'Fit page' },
  { value: 'actual', icon: Ruler, label: 'Actual size' },
] as const

/** Room around the page inside the window, in px. */
const MARGIN = 32
/** Below this width (the app's phone width) the page gets a slimmer margin and no scrollbar gutter, to be as big as it can. */
const PHONE_WIDTH = 768
const PHONE_MARGIN = 10

/** What journals call a figure this wide. */
export function columnName(widthMm: number): string {
  if (widthMm > TEXT_WIDTH_MM + 6) return 'Wider than a journal page'
  return { single: 'Single column', 'one-and-half': '1.5 column', double: 'Double column' }[figureColumns(widthMm)]
}

export function PaperPreviewWindow({ open, onOpenChange, figure, figureMm, caption }: PaperPreviewWindowProps) {
  const [layout, setLayout] = useState<PaperLayout>('title-page')
  const [zoom, setZoom] = useState<PaperZoom>('fit')
  const shrunk = fittedFigureMm(figureMm, layout).shrunk
  const phone = usePhoneLayout()

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Popup className="fixed inset-0 z-50 flex flex-col bg-canvas text-sm text-foreground outline-none transition-opacity duration-(--duration-base) data-ending-style:opacity-0 data-starting-style:opacity-0">
          <div className="flex shrink-0 items-center gap-3 border-b bg-panel px-3 max-md:flex-wrap max-md:gap-x-3 max-md:gap-y-0 max-md:py-1.5 md:h-(--topbar-height,3rem)">
            <DialogPrimitive.Title className="font-medium">Paper preview</DialogPrimitive.Title>
            {/* On phones the close button sits top right and the figure's size wraps onto a line of its own. */}
            <DialogPrimitive.Description className="text-muted-foreground max-md:order-last max-md:w-full max-md:text-xs md:truncate">
              {columnName(figureMm.width)} · {figureMm.width} × {figureMm.height} mm on A4
              {shrunk && ' · shown smaller to fit the page'}
            </DialogPrimitive.Description>
            <div className="ml-auto flex items-center gap-2">
              {!phone && (
                <>
                  <SegmentedToggle label="Page layout" showLabels options={layouts} value={layout} onValueChange={setLayout} />
                  <SegmentedToggle label="Zoom" showLabels options={zooms} value={zoom} onValueChange={setZoom} />
                  <div className="mx-1 h-5 w-px bg-border" />
                </>
              )}
              <DialogPrimitive.Close render={<IconButton icon={X} label="Close preview" />} />
            </div>
          </div>
          <PageArea zoom={zoom}>{(scale) => <PaperPreview figure={figure} figureMm={figureMm} caption={caption} layout={layout} scale={scale} className="shadow-(--elevation-page)" />}</PageArea>
          {/* Phones: the two toggles move to a bar along the bottom, each option's name under its icon. */}
          {phone && (
            <div className="flex shrink-0 gap-2 border-t bg-panel p-2">
              <SegmentedToggle stacked label="Page layout" options={layouts} value={layout} onValueChange={setLayout} className="flex-1" />
              <SegmentedToggle stacked label="Zoom" options={zooms} value={zoom} onValueChange={setZoom} className="flex-1" />
            </div>
          )}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/** The scrolling area under the bar. Works out the scale that fits the whole page in it. */
function PageArea({ zoom, children }: { zoom: PaperZoom; children: (scale: number) => ReactNode }) {
  const area = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState(0)

  useLayoutEffect(() => {
    const element = area.current
    if (!element) return
    const update = () => {
      const margin = element.clientWidth < PHONE_WIDTH ? PHONE_MARGIN : MARGIN
      const width = element.clientWidth - 2 * margin
      const height = element.clientHeight - 2 * margin
      setFit(Math.max(0.1, Math.min(width / PAGE_PX.width, height / PAGE_PX.height)))
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const scale = zoom === 'actual' ? 1 : fit
  return (
    <div ref={area} className="min-h-0 flex-1 overflow-auto p-8 max-md:p-2.5 md:[scrollbar-gutter:stable]">
      {/* The page is only drawn once the fitting scale is known, so it doesn't jump. */}
      <div className="mx-auto w-fit">{scale > 0 && children(scale)}</div>
    </div>
  )
}
