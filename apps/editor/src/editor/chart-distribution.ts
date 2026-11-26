/*
 * The numbers behind box plots, violins and spread dots: quartiles, a smooth
 * outline of how the values are spread, and dot positions that don't overlap.
 */

/**
 * The value a fraction q (0 to 1) of the way through sorted numbers, the way
 * common statistics software finds quartiles and percentiles: rank q * (n + 1), counted
 * from 1 and interpolated between neighbours (Hyndman and Fan's definition 6,
 * R's type 6). A rank outside the data gives the smallest or largest value.
 * The median is the same in every method.
 */
export function quantile(sorted: number[], q: number): number {
  const n = sorted.length
  if (n === 0) return NaN
  const rank = Math.min(Math.max(q * (n + 1), 1), n)
  const low = Math.floor(rank)
  const high = Math.ceil(rank)
  return (sorted[low - 1] ?? 0) + ((sorted[high - 1] ?? 0) - (sorted[low - 1] ?? 0)) * (rank - low)
}

export type BoxStats = { min: number; q1: number; median: number; q3: number; max: number }

/** Smallest, quartiles and largest of some numbers: whiskers run from the smallest to the largest value. */
export function boxStats(values: number[]): BoxStats | undefined {
  if (values.length === 0) return undefined
  const sorted = [...values].sort((a, b) => a - b)
  return { min: sorted[0] ?? 0, q1: quantile(sorted, 0.25), median: quantile(sorted, 0.5), q3: quantile(sorted, 0.75), max: sorted.at(-1) ?? 0 }
}

/**
 * How densely values lie at `steps + 1` even places from their smallest to
 * largest (a Gaussian smoothing, bandwidth by Silverman's rule). One value or
 * identical values give a plain spike in the middle.
 */
export function violinProfile(values: number[], steps = 24): { value: number; density: number }[] {
  if (values.length === 0) return []
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const sd = Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / Math.max(values.length - 1, 1))
  const spread = hi - lo
  if (spread === 0) return [{ value: lo, density: 1 }]
  const sorted = [...values].sort((a, b) => a - b)
  const iqr = quantile(sorted, 0.75) - quantile(sorted, 0.25)
  const scale = Math.min(sd || spread, iqr / 1.34 || spread)
  const bandwidth = Math.max(0.9 * scale * values.length ** -0.2, spread / 50)
  return Array.from({ length: steps + 1 }, (_, i) => {
    const value = lo + (spread * i) / steps
    const density = values.reduce((sum, v) => sum + Math.exp(-0.5 * ((value - v) / bandwidth) ** 2), 0) / (values.length * bandwidth * Math.sqrt(2 * Math.PI))
    return { value, density }
  })
}

/**
 * Sideways offsets (px) for dots at these heights (px, from the page's top) so
 * none overlaps another: each dot takes the place closest to the middle that
 * is clear, alternating left and right. Offsets stay within `reach`.
 */
export function beeswarm(heights: number[], radius: number, reach: number): number[] {
  const placed: { x: number; y: number }[] = []
  const offsets = heights.map(() => 0)
  const order = heights.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y)
  const step = radius * 0.5
  for (const { i, y } of order) {
    let x = 0
    for (let k = 0; k <= Math.ceil(reach / step); k++) {
      const clear = (candidate: number) => placed.every((p) => (p.x - candidate) ** 2 + (p.y - y) ** 2 >= (radius * 2) ** 2)
      const options = k === 0 ? [0] : [k * step, -k * step]
      const found = options.find((o) => Math.abs(o) <= reach && clear(o))
      if (found !== undefined) {
        x = found
        break
      }
      x = Math.max(-reach, Math.min(reach, x))
    }
    placed.push({ x, y })
    offsets[i] = x
  }
  return offsets
}

/** A colour mixed with white, for the soft fill behind dots and lines (share 0 keeps the colour, 1 is white). */
export function tint(colour: string, share: number): string {
  const hex = colour.replace('#', '')
  if (!/^[0-9a-f]{6}$/i.test(hex)) return colour
  const channel = (at: number) => Math.round(parseInt(hex.slice(at, at + 2), 16) * (1 - share) + 255 * share)
  return `#${[0, 2, 4].map((at) => channel(at).toString(16).padStart(2, '0')).join('')}`
}
