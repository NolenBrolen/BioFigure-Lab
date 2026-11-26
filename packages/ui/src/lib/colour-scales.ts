/*
 * Colour scales as plain data: a value from 0 to 1 becomes a colour. Free of
 * any component, so the chart model (heatmap cells, its colour bar, and later
 * XY dots coloured by a third value) and the colour-scale picker share them.
 *
 * Sequential scales run from low to high (viridis, magma: colour-blind safe and
 * readable in greyscale; their colour stops are public domain, CC0, from
 * matplotlib). Two-sided scales have a neutral middle for a centre value such as
 * 0, blue below it and red above (Paul Tol's BuRd, which avoids pure red and
 * green and is free to use), for correlations and changes either way.
 */

export type ColourScaleId = 'viridis' | 'magma' | 'greys' | 'blue-red'

export type ColourScaleInfo = {
  id: ColourScaleId
  name: string
  /** Sequential: low to high. Two-sided: a neutral middle at the centre value, colours either side. */
  kind: 'sequential' | 'two-sided'
  /** Evenly spaced colour stops from the low end (0) to the high end (1). */
  stops: readonly string[]
  hint: string
}

const VIRIDIS: ColourScaleInfo = {
  id: 'viridis',
  name: 'Viridis',
  kind: 'sequential',
  hint: 'Purple to yellow; colour-blind safe, reads in greyscale',
  stops: ['#440154', '#482475', '#414487', '#355f8d', '#2a788e', '#21918c', '#22a884', '#44bf70', '#7ad151', '#bddf26', '#fde725'],
}

export const COLOUR_SCALES: readonly ColourScaleInfo[] = [
  VIRIDIS,
  {
    id: 'magma',
    name: 'Magma',
    kind: 'sequential',
    hint: 'Black to pale yellow; colour-blind safe',
    stops: ['#000004', '#140e36', '#3b0f70', '#641a80', '#8c2981', '#b73779', '#de4968', '#f7705c', '#fe9f6d', '#fecf92', '#fcfdbf'],
  },
  {
    id: 'greys',
    name: 'Greys',
    kind: 'sequential',
    hint: 'White to black, for print in one colour',
    stops: ['#f7f7f7', '#d9d9d9', '#bdbdbd', '#969696', '#737373', '#525252', '#252525'],
  },
  {
    id: 'blue-red',
    name: 'Blue–white–red',
    kind: 'two-sided',
    hint: 'Blue below the centre, red above; for correlations',
    stops: ['#2166ac', '#4393c3', '#92c5de', '#d1e5f0', '#f7f7f7', '#fddbc7', '#f4a582', '#d6604d', '#b2182b'],
  },
]

/** A scale by id; an unknown id (from a newer figure) falls back to viridis. */
export const colourScaleInfo = (id: ColourScaleId): ColourScaleInfo => COLOUR_SCALES.find((s) => s.id === id) ?? VIRIDIS

export const isTwoSided = (id: ColourScaleId) => colourScaleInfo(id).kind === 'two-sided'

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const toHex = (channels: number[]) => '#' + channels.map((v) => Math.round(Math.min(Math.max(v, 0), 255)).toString(16).padStart(2, '0')).join('')

/** The scale's colour at `t` (0 is the low end, 1 the high end; outside that it keeps the end colour), mixed between the two nearest stops. */
export function colourAt(id: ColourScaleId, t: number): string {
  const stops = colourScaleInfo(id).stops
  const at = (Number.isFinite(t) ? Math.min(Math.max(t, 0), 1) : 0) * (stops.length - 1)
  const lo = Math.floor(at)
  const a = rgb(stops[lo] ?? '#000000')
  const b = rgb(stops[Math.min(lo + 1, stops.length - 1)] ?? '#000000')
  return toHex(a.map((v, k) => v + ((b[k] ?? v) - v) * (at - lo)))
}

/** A CSS gradient of the scale, left (low) to right (high) unless told otherwise, for pictures of it. */
export const scaleGradient = (id: ColourScaleId, direction = 'to right') => `linear-gradient(${direction}, ${colourScaleInfo(id).stops.join(', ')})`
