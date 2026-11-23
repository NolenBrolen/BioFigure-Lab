// opentype.js 2 ships no types; these are the few parts we use.
declare module 'opentype.js' {
  export type Path = { toPathData(decimalPlaces?: number): string }
  export type Glyph = { advanceWidth?: number; getPath(x: number, y: number, fontSize: number): Path }
  export type Font = {
    unitsPerEm: number
    charToGlyphIndex(char: string): number
    charToGlyph(char: string): Glyph
    getKerningValue(left: Glyph, right: Glyph): number
  }
  export function parse(buffer: ArrayBuffer): Font
}
