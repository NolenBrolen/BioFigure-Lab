/*
 * An earlier version of a slide, shown over the canvas while looking through its history (BIO-36): the same
 * drawing as the editor (its own FigureCanvas), at the editor's zoom, with what it is in the top-left corner.
 * Covered, so nothing on it can be picked or changed; the real slide waits underneath, untouched.
 */
import { Clock } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { FigureCanvas } from '../editor/FigureCanvas'

type VersionPreviewProps = {
  /** The page in page pixels. */
  page: { width: number; height: number }
  zoom: number
  /** The version's saved contents; undefined is an empty slide. */
  canvas: string | undefined
  /** "Today, 11:05 · Ana López". */
  label: string
}

export function VersionPreview({ page, zoom, canvas, label }: VersionPreviewProps) {
  const host = useRef<HTMLDivElement>(null)
  const [figure, setFigure] = useState<FigureCanvas | null>(null)

  useEffect(() => {
    const element = document.createElement('canvas')
    host.current?.append(element)
    const made = new FigureCanvas(element, page)
    setFigure(made)
    return () => {
      setFigure(null)
      void made.dispose().then(() => element.remove())
    }
    // One canvas while the preview is open; the page size can't change meanwhile (the editor's own canvas is covered).
  }, [])

  useEffect(() => {
    if (figure) void figure.showSlide(canvas).then(() => figure.setZoom(zoom))
  }, [figure, canvas, zoom])

  return (
    <div className="absolute inset-0 z-20 flex overflow-auto bg-canvas" aria-label={`Earlier version: ${label}`} role="img">
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 rounded-full bg-foreground/85 px-2.5 py-1 text-xs text-background">
        <Clock className="size-3.5" aria-hidden="true" /> {label}
      </div>
      <div className="relative m-auto p-12 pb-16">
        <div ref={host} className="bg-page shadow-(--elevation-page) dark:brightness-(--page-dim)" />
        <div className="absolute inset-0" aria-hidden="true" />
      </div>
    </div>
  )
}
