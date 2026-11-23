/*
 * One export, start to finish: turn the text into outlines, then write the
 * file. It runs in small steps with a pause between them, so the editor stays
 * usable meanwhile; the slow parts (decoding the picture, packing the PNG)
 * already happen off the main thread in the browser. Between steps it reports
 * progress and checks whether the export was cancelled.
 */
import { parse, type Font } from 'opentype.js'

import { outlineText, usedFonts, type FontRequest } from './outline-text'
import { withPngDpi } from './png-dpi'
import { pngSize, type PngDpi } from './sizing'

export type ExportFormat = 'png' | 'svg' | 'pdf'

export type ExportSettings = {
  format: ExportFormat
  /** Only used for PNG. */
  dpi: PngDpi
  /** Leave out the white page behind the figure. */
  transparent: boolean
}

export type ExportInput = {
  /** The page as SVG, in pixels at 96 per inch, without a background. A PDF takes several pages, one SVG each. */
  svg: string | string[]
  pageMm: { width: number; height: number }
  settings: ExportSettings
  /**
   * The font files (TTF, OTF or WOFF) to draw each face the text uses with;
   * within a face the first file wins when several have a character.
   */
  loadFonts: (faces: FontRequest[]) => Promise<FontFiles[]>
  signal?: AbortSignal
  /** 0 to 1, called as the export moves on. */
  onProgress?: (fraction: number) => void
}

/** The files for one font face, best first (later files fill in missing characters). */
export type FontFiles = FontRequest & { files: ArrayBuffer[] }

/** The parts that need a real browser. Tests swap them for stand-ins. */
export type ExportSteps = {
  rasterize: (svg: string, size: { width: number; height: number }, signal?: AbortSignal) => Promise<Uint8Array>
  writePdf: (pages: string[], pageMm: { width: number; height: number }) => Promise<Uint8Array>
}

/** The figure is bigger than this browser can draw in one go. */
export class ExportTooLargeError extends Error {
  constructor() {
    super('The figure is too large to draw at this resolution in this browser. Try a lower dpi.')
    this.name = 'ExportTooLargeError'
  }
}

export const MIME_TYPES: Record<ExportFormat, string> = { png: 'image/png', svg: 'image/svg+xml', pdf: 'application/pdf' }

const SVG_NS = 'http://www.w3.org/2000/svg'

const pause = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

/** The SVG at a given size on paper or screen, with a white page behind it unless it should be transparent. */
export function sizedSvg(svg: string, width: string, height: string, transparent: boolean): string {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
  const root = doc.documentElement
  if (!root.hasAttribute('viewBox')) root.setAttribute('viewBox', `0 0 ${root.getAttribute('width')} ${root.getAttribute('height')}`)
  root.setAttribute('width', width)
  root.setAttribute('height', height)
  if (!transparent) {
    const [x = '0', y = '0', w = '0', h = '0'] = root.getAttribute('viewBox')!.trim().split(/[\s,]+/)
    const page = doc.createElementNS(SVG_NS, 'rect')
    for (const [name, value] of Object.entries({ x, y, width: w, height: h, fill: '#ffffff' })) page.setAttribute(name, value)
    const after = [...root.children].find((child) => child.localName !== 'desc' && child.localName !== 'defs') ?? null
    root.insertBefore(page, after)
  }
  return new XMLSerializer().serializeToString(doc)
}

/** Makes the file. Rejects with an AbortError when the signal is aborted. */
export async function exportFigure(input: ExportInput, steps: ExportSteps = browserSteps): Promise<Blob> {
  const { svg, pageMm, settings, signal, onProgress } = input
  const progress = async (fraction: number) => {
    signal?.throwIfAborted()
    onProgress?.(fraction)
    await pause()
    signal?.throwIfAborted()
  }

  await progress(0)
  const svgs = [svg].flat()
  // Every face any page uses, once.
  const faces = svgs.flatMap(usedFonts).filter((face, i, all) => all.findIndex((other) => other.family === face.family && other.weight === face.weight && other.italic === face.italic) === i)
  const loaded = (await input.loadFonts(faces)).map((face) => ({ ...face, fonts: face.files.map((buffer): Font => parse(buffer)) }))
  await progress(0.2)
  // A face that wasn't loaded is drawn with the first one that was.
  const pick = (face: FontRequest) => (loaded.find((other) => other.family === face.family && other.weight === face.weight && other.italic === face.italic) ?? loaded[0])?.fonts ?? []
  const pages = svgs.map((page) => outlineText(page, pick))
  const outlined = pages[0] ?? ''
  await progress(0.4)

  let bytes: Uint8Array | string
  if (settings.format === 'svg') {
    bytes = sizedSvg(outlined, `${pageMm.width}mm`, `${pageMm.height}mm`, settings.transparent)
  } else if (settings.format === 'pdf') {
    bytes = await steps.writePdf(pages.map((page) => sizedSvg(page, `${pageMm.width}mm`, `${pageMm.height}mm`, settings.transparent)), pageMm)
  } else {
    const size = pngSize(pageMm, settings.dpi)
    const png = await steps.rasterize(sizedSvg(outlined, String(size.width), String(size.height), settings.transparent), size, signal)
    await progress(0.9)
    bytes = withPngDpi(png, settings.dpi)
  }
  await progress(1)
  return new Blob([bytes as BlobPart], { type: MIME_TYPES[settings.format] })
}

/** Drawing and PDF writing in the browser. jsPDF loads only the first time someone exports a PDF. */
export const browserSteps: ExportSteps = {
  async rasterize(svg, size, signal) {
    const url = URL.createObjectURL(new Blob([svg], { type: MIME_TYPES.svg }))
    const canvas = document.createElement('canvas')
    try {
      const image = new Image(size.width, size.height)
      image.src = url
      await image.decode()
      signal?.throwIfAborted()
      canvas.width = size.width
      canvas.height = size.height
      const context = canvas.getContext('2d')
      if (!context || canvas.width !== size.width) throw new ExportTooLargeError()
      context.drawImage(image, 0, 0, size.width, size.height)
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, MIME_TYPES.png))
      if (!blob) throw new ExportTooLargeError()
      return new Uint8Array(await blob.arrayBuffer())
    } finally {
      URL.revokeObjectURL(url)
      // Hand the (possibly huge) pixel memory back straight away.
      canvas.width = 0
      canvas.height = 0
    }
  },

  async writePdf(pages, pageMm) {
    const [{ jsPDF }] = await Promise.all([import('jspdf'), import('svg2pdf.js')])
    const orientation = pageMm.width > pageMm.height ? 'landscape' : 'portrait'
    const pdf = new jsPDF({ orientation, unit: 'mm', format: [pageMm.width, pageMm.height] })
    for (const [index, svg] of pages.entries()) {
      if (index > 0) pdf.addPage([pageMm.width, pageMm.height], orientation)
      // svg2pdf reads computed styles, so the SVG has to be in the page for a moment.
      const holder = document.createElement('div')
      holder.style.cssText = 'position:fixed;left:-99999px;top:0;visibility:hidden'
      holder.innerHTML = svg
      document.body.append(holder)
      try {
        await pdf.svg(holder.firstElementChild!, { x: 0, y: 0, width: pageMm.width, height: pageMm.height })
      } finally {
        holder.remove()
      }
    }
    return new Uint8Array(pdf.output('arraybuffer'))
  },
}
