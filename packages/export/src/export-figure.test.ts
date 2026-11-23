// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'

import { exportFigure, type ExportInput, type ExportSteps } from './export-figure'
import { readPngDpi } from './png-dpi'
import { FIGURE_SVG, loadTestFontFiles } from './test/fonts'

/** The smallest thing that looks like a PNG: signature, header, end. */
const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, ...Array<number>(17).fill(0), 0, 0, 0, 0, 73, 69, 78, 68, 0, 0, 0, 0])

/** Stand-ins for the browser-only drawing and PDF writing. */
const standIns = () => ({
  rasterize: vi.fn<ExportSteps['rasterize']>(() => Promise.resolve(PNG)),
  writePdf: vi.fn<ExportSteps['writePdf']>(() => Promise.resolve(new Uint8Array([37, 80, 68, 70]))),
})

const input = (settings: Partial<ExportInput['settings']>, extra: Partial<ExportInput> = {}): ExportInput => ({
  svg: FIGURE_SVG,
  pageMm: { width: 170, height: 120 },
  settings: { format: 'png', dpi: 300, transparent: false, ...settings },
  loadFonts: loadTestFontFiles,
  ...extra,
})

const svgOf = async (blob: Blob) => new DOMParser().parseFromString(await blob.text(), 'image/svg+xml').documentElement

describe('export', () => {
  it('writes an SVG sized in mm, text as outlines, on a white page', async () => {
    const blob = await exportFigure(input({ format: 'svg' }), standIns())
    expect(blob.type).toBe('image/svg+xml')
    const svg = await svgOf(blob)
    expect(svg.getAttribute('width')).toBe('170mm')
    expect(svg.getAttribute('height')).toBe('120mm')
    expect(svg.getElementsByTagName('text')).toHaveLength(0)
    expect(svg.querySelector('rect[fill="#ffffff"]')).not.toBeNull()
  })

  it('leaves the page out when the background is transparent', async () => {
    const svg = await svgOf(await exportFigure(input({ format: 'svg', transparent: true }), standIns()))
    expect(svg.querySelector('rect[fill="#ffffff"]')).toBeNull()
  })

  it('draws a PNG at the pixel size for the dpi and records the dpi', async () => {
    const steps = standIns()
    const blob = await exportFigure(input({ format: 'png', dpi: 600 }), steps)
    expect(steps.rasterize).toHaveBeenCalledWith(expect.any(String), { width: 4016, height: 2835 }, undefined)
    const drawn = new DOMParser().parseFromString(steps.rasterize.mock.calls[0]![0], 'image/svg+xml').documentElement
    expect(drawn.getAttribute('width')).toBe('4016')
    expect(readPngDpi(new Uint8Array(await blob.arrayBuffer()))).toBe(600)
  })

  it('hands the PDF writer the page size in mm', async () => {
    const steps = standIns()
    const blob = await exportFigure(input({ format: 'pdf' }), steps)
    expect(blob.type).toBe('application/pdf')
    expect(steps.writePdf).toHaveBeenCalledWith([expect.any(String)], { width: 170, height: 120 })
  })

  it('puts every slide on its own PDF page', async () => {
    const steps = standIns()
    const one = input({ format: 'pdf' })
    await exportFigure({ ...one, svg: [one.svg as string, one.svg as string] }, steps)
    expect(steps.writePdf.mock.calls[0]![0]).toHaveLength(2)
  })

  it('reports progress up to the end', async () => {
    const seen: number[] = []
    await exportFigure(input({}, { onProgress: (fraction) => seen.push(fraction) }), standIns())
    expect(seen[0]).toBe(0)
    expect(seen.at(-1)).toBe(1)
    expect(seen).toEqual([...seen].sort((a, b) => a - b))
  })

  it('stops when cancelled, before drawing anything', async () => {
    const steps = standIns()
    const controller = new AbortController()
    const run = exportFigure(input({}, { signal: controller.signal, onProgress: () => controller.abort() }), steps)
    await expect(run).rejects.toMatchObject({ name: 'AbortError' })
    expect(steps.rasterize).not.toHaveBeenCalled()
  })
})
