import type { FontFiles } from '../export-figure'
import type { FontRequest } from '../outline-text'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

/** Inter's Latin and Greek files, the way the app loads them. */
export function loadTestFonts(): Promise<ArrayBuffer[]> {
  const files = ['latin', 'greek'].map((subset) => {
    const bytes = readFileSync(require.resolve(`@fontsource/inter/files/inter-${subset}-400-normal.woff`))
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  })
  return Promise.resolve(files)
}

/** A figure page like Fabric writes it: one shape and one text box with two lines. */
export const FIGURE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="643" height="454" viewBox="0 0 643 454" xml:space="preserve">
<desc>Created with Fabric.js</desc>
<defs></defs>
<g transform="matrix(1 0 0 1 100 100)"><rect x="-20" y="-20" width="40" height="40" style="fill: rgb(37,99,235);"/></g>
<g transform="matrix(1 0 0 1 300 200)" style="">
		<text xml:space="preserve" font-family="Inter Variable, sans-serif" font-size="24" font-style="normal" font-weight="normal" style="stroke: none; fill: rgb(220,38,38); white-space: pre;" ><tspan x="-40" y="7.5" >Cell αβ</tspan><tspan x="-40" y="37.5" style="fill: rgb(0,0,0); ">line 2</tspan></text>
</g>
</svg>`

/** The same files for every face asked for, the way `exportFigure` wants them. */
export async function loadTestFontFiles(faces: FontRequest[]): Promise<FontFiles[]> {
  const files = await loadTestFonts()
  return faces.map((face) => ({ ...face, files }))
}
