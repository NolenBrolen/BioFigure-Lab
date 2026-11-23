/** Colours as six-digit hex codes, like "#1f2937". */

/** A typed hex code ("1F2937", "#1f2937" or the short "#fff") as "#rrggbb", or undefined if it isn't one. */
export function parseHex(text: string): string | undefined {
  const value = text.trim().replace(/^#/, '').toLowerCase()
  if (/^[0-9a-f]{6}$/.test(value)) return `#${value}`
  if (/^[0-9a-f]{3}$/.test(value)) return `#${[...value].map((digit) => digit + digit).join('')}`
  return undefined
}

/** A colour from Fabric (hex or "rgb(…)") as "#rrggbb"; undefined for none or a gradient. */
export function toHex(colour: string | undefined): string | undefined {
  if (!colour) return undefined
  const hex = parseHex(colour)
  if (hex) return hex
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(colour)
  if (!rgb) return undefined
  return `#${rgb
    .slice(1, 4)
    .map((part) => Math.min(255, Number(part)).toString(16).padStart(2, '0'))
    .join('')}`
}

/** "#rrggbb" as red, green and blue, 0–255. */
export function hexToRgb(hex: string): [number, number, number] {
  const value = parseHex(hex) ?? '#000000'
  return [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16)) as [number, number, number]
}

/** Red, green and blue (0–255, rounded and kept in range) as "#rrggbb". */
export function rgbToHex(channels: readonly number[]): string {
  return `#${channels
    .slice(0, 3)
    .map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0'))
    .join('')}`
}
