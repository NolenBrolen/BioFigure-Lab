/*
 * A figure someone shared with you as "Can view" (BIO-34, draft A picked 2026-11-24): look through its slides,
 * export them, or make your own copy to change. The same screen will serve view links (BIO-36).
 *
 * The slides are drawn by the editor's own canvas (same fonts and quality), covered so nothing on it can be
 * picked or changed.
 */
import type { ExportSettings } from '@biofigure-lab/export/export-figure'
import { Button } from '@biofigure-lab/ui/components/button/Button'
import { IconButton } from '@biofigure-lab/ui/components/icon-button/IconButton'
import { SlideStrip } from '@biofigure-lab/ui/components/slide-strip/SlideStrip'
import { useToast } from '@biofigure-lab/ui/components/toast/Toast'
import { ChevronLeft, Copy, Download, Eye } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { FigureCanvas } from '../editor/FigureCanvas'
import { letterContexts } from '../editor/panel-letters'
import type { Figure, FigureStore } from '../editor/storage'
import { fitZoom, mmToPx } from '../editor/units'
import { ExportDialog } from './ExportDialog'
import { site } from '../site/site'
import { useExport } from './useExport'

type ViewerScreenProps = {
  figure: Figure
  store: FigureStore
  onBack: () => void
  /** Open another figure (the copy just made). */
  onOpen: (id: string) => void
  /** Where Make a copy puts the copy, when not `store` (a figure opened through a share link: your own figures). */
  copyStore?: FigureStore
}

export function ViewerScreen({ figure, store, onBack, onOpen, copyStore = store }: ViewerScreenProps) {
  const toasts = useToast()
  const page = { width: mmToPx(figure.page.width), height: mmToPx(figure.page.height) }
  const host = useRef<HTMLDivElement>(null)
  const space = useRef<HTMLDivElement>(null)
  const [canvas, setCanvas] = useState<FigureCanvas | null>(null)
  const [currentId, setCurrentId] = useState(figure.slides[0]?.id ?? '')
  const [exportOpen, setExportOpen] = useState(false)
  const [exportAll, setExportAll] = useState(false)
  const [settings, setSettings] = useState<ExportSettings>({ format: 'png', dpi: 300, transparent: false })
  const startExport = useExport()
  const current = figure.slides.find((slide) => slide.id === currentId) ?? figure.slides[0]

  // One canvas for the whole visit; it shows the slide picked in the strip.
  useEffect(() => {
    const element = document.createElement('canvas')
    host.current?.append(element)
    const made = new FigureCanvas(element, page, figure.slides[0]?.canvas)
    setCanvas(made)
    return () => {
      setCanvas(null)
      void made.dispose().then(() => element.remove())
    }
    // Made once: the page and first slide are fixed for this screen (a change from the owner opens it again).
  }, [])

  const fit = useCallback(() => {
    const box = space.current
    if (canvas && box) canvas.setZoom(fitZoom(page, { width: box.clientWidth, height: box.clientHeight }))
  }, [canvas, page])
  useEffect(() => {
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [fit])

  const show = (id: string) => {
    const slide = figure.slides.find((item) => item.id === id)
    if (!canvas || !slide) return
    setCurrentId(id)
    void canvas.showSlide(slide.canvas, undefined, letterContexts(figure.slides.map((each) => each.canvas)).at(figure.slides.indexOf(slide))).then(fit)
  }

  const makeCopy = () => {
    void copyStore.createFrom({ name: `${figure.name} (copy)`, page: figure.page, slides: figure.slides, thumbnail: figure.thumbnail }).then((copy) => {
      toasts.add({ title: 'Copy made', description: 'It’s yours to change.' })
      onOpen(copy.id)
    })
  }

  const exportNow = () => {
    setExportOpen(false)
    if (!canvas) return
    if (!exportAll || figure.slides.length === 1) return startExport({ svg: canvas.toSVG({ background: false }), pageMm: figure.page, settings, name: figure.name })
    // Each slide on a hidden canvas of its own, so the one on screen stays.
    void (async () => {
      const hidden = new FigureCanvas(document.createElement('canvas'), page)
      const svgs: string[] = []
      const contexts = letterContexts(figure.slides.map((each) => each.canvas))
      for (const [i, slide] of figure.slides.entries()) {
        await hidden.showSlide(slide.canvas, undefined, contexts.at(i))
        svgs.push(hidden.toSVG({ background: false }))
      }
      void hidden.dispose()
      startExport({ svg: svgs, pageMm: figure.page, settings, name: figure.name })
    })()
  }

  const owner = figure.access?.owner
  return (
    <div className="flex h-dvh flex-col bg-canvas text-sm text-foreground">
      <header className="flex h-(--topbar-height) shrink-0 items-center gap-2 border-b bg-panel px-2">
        <IconButton icon={ChevronLeft} label="Back to your figures" onClick={onBack} />
        <h1 className="min-w-0 truncate px-1 font-medium">{figure.name}</h1>
        <span className="flex shrink-0 items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground" title={owner ? `Shared with you by ${owner.name || owner.email}` : undefined}>
          <Eye className="size-3.5" aria-hidden="true" /> View only
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Button onClick={makeCopy}>
            <Copy className="size-4" aria-hidden="true" /> Make a copy
          </Button>
          <Button variant="primary" onClick={() => setExportOpen(true)}>
            <Download className="size-4" aria-hidden="true" /> Export
          </Button>
          {site.AccountControl && (
            <>
              <div className="mx-1 h-5 w-px bg-border" />
              <site.AccountControl />
            </>
          )}
        </div>
      </header>
      <div ref={space} className="relative grid min-h-0 flex-1 place-items-center overflow-hidden p-6">
        <div className="relative shadow-lg">
          <div ref={host} />
          {/* Covers the canvas: nothing can be picked, moved or typed into. */}
          <div className="absolute inset-0" aria-hidden="true" />
        </div>
      </div>
      {figure.slides.length > 1 && current && (
        <SlideStrip
          className="shrink-0 justify-center border-t bg-panel"
          slides={figure.slides}
          currentId={current.id}
          aspect={page.width / page.height}
          onSelect={show}
          // A view-only figure can't be changed: these do nothing.
          onAdd={() => undefined}
          onDuplicate={() => undefined}
          onDelete={() => undefined}
          onMove={() => undefined}
          readOnly
        />
      )}
      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        pageMm={figure.page}
        settings={settings}
        onSettingsChange={setSettings}
        slideCount={figure.slides.length}
        allSlides={exportAll}
        onAllSlidesChange={setExportAll}
        onExport={exportNow}
      />
    </div>
  )
}
