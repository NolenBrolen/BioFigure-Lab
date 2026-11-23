/*
 * The font files export uses to turn text into outlines: for each font face
 * the figure uses, that font's Latin, extended Latin and Greek files, then
 * Inter's and Noto Sans Math's for characters it lacks (α, µ, ⇌ and so on).
 * Files are fetched the first time an export needs them, then kept.
 */
import type { FontFiles } from '@biofigure-lab/export/export-figure'
import type { FontRequest } from '@biofigure-lab/export/outline-text'

import { DEFAULT_FONT, fontOf, nearestWeight, type FontInfo } from './fonts'

// The bundled WOFF files (opentype.js can't read WOFF2), by path. Only their
// addresses are bundled here; the files themselves load when an export asks.
const FILES = import.meta.glob<string>(
  [
    '../../../../node_modules/@fontsource/{inter,source-sans-3,open-sans,source-serif-4,merriweather,jetbrains-mono}/files/*-{latin,latin-ext,greek}-{300,400,500,600,700}-{normal,italic}.woff',
    '../../../../node_modules/@fontsource/noto-sans-math/files/noto-sans-math-latin-400-normal.woff',
  ],
  { eager: true, query: '?url', import: 'default' },
)

const SUBSETS = ['latin', 'latin-ext', 'greek']

/** The addresses of a face's files, best first. A subset the font doesn't have is skipped. */
export function faceUrls(font: FontInfo, weight: number, italic: boolean): string[] {
  const urlsFor = (f: FontInfo) =>
    SUBSETS.flatMap((subset) => FILES[`../../../../node_modules/@fontsource/${f.files}/files/${f.files}-${subset}-${nearestWeight(weight)}-${italic ? 'italic' : 'normal'}.woff`] ?? [])
  const math = FILES['../../../../node_modules/@fontsource/noto-sans-math/files/noto-sans-math-latin-400-normal.woff']
  return [...new Set([...urlsFor(font), ...urlsFor(DEFAULT_FONT), ...(math ? [math] : [])])]
}

const fetched = new Map<string, Promise<ArrayBuffer>>()

function fetchFile(url: string): Promise<ArrayBuffer> {
  let file = fetched.get(url)
  if (!file) {
    file = fetch(url).then((response) => {
      if (!response.ok) throw new Error('Could not load the font for the text')
      return response.arrayBuffer()
    })
    // Try again next time instead of keeping the failure.
    file.catch(() => fetched.delete(url))
    fetched.set(url, file)
  }
  return file
}

export function loadExportFonts(faces: FontRequest[]): Promise<FontFiles[]> {
  return Promise.all(faces.map(async (face) => ({ ...face, files: await Promise.all(faceUrls(fontOf(face.family), face.weight, face.italic).map(fetchFile)) })))
}
