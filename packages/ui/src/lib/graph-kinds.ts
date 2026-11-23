/* The chart kinds as plain data, free of any component so the chart model can use them. */

/** The graphs drawn upright. Each also has a lying-down version, written with "-h" ("bar-h"). */
export type UprightKind = 'bar' | 'line' | 'scatter' | 'point' | 'slope' | 'dots-bars' | 'before-after' | 'dots-spread' | 'dots-box' | 'dots-violin' | 'floating' | 'box' | 'violin'

export type LyingKind = 'bar-h' | 'point-h' | 'floating-h' | 'box-h' | 'violin-h'

export type ChartKind = UprightKind | LyingKind

/** Whether a graph lies down: groups run down the side and the values along the bottom. */
export const isHorizontal = (kind: ChartKind): kind is LyingKind => kind.endsWith('-h')

/** The upright graph a lying-down one is drawn from (an upright graph is its own). */
export const uprightKind = (kind: ChartKind): UprightKind => (isHorizontal(kind) ? (kind.slice(0, -2) as UprightKind) : kind)

/** Graphs that show an error bar around the mean; the others show the data's own spread. */
const WITH_ERROR_BARS: UprightKind[] = ['bar', 'line', 'scatter', 'point', 'slope', 'dots-bars', 'dots-spread']
export const usesErrorBars = (kind: ChartKind) => WITH_ERROR_BARS.includes(uprightKind(kind))

/** Graphs that draw every replicate as a dot. */
const WITH_DOTS: UprightKind[] = ['scatter', 'dots-bars', 'before-after', 'dots-spread', 'dots-box', 'dots-violin']
export const showsDots = (kind: ChartKind) => WITH_DOTS.includes(uprightKind(kind))

/** Graphs that depend on the whole spread of values (their range reaches the axis), not only the mean. */
export const usesSpread = (kind: ChartKind) => showsDots(kind) || ['floating', 'box', 'violin'].includes(uprightKind(kind))

/** Graphs whose bars grow from zero, so their axis always includes it. */
export const startsAtZero = (kind: ChartKind) => ['bar', 'dots-bars'].includes(uprightKind(kind))
