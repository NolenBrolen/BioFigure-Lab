/**
 * Bar + line charts (BIO-72): bars for one measure and a line with markers for
 * a second measure on the same groups, such as a scree plot (variance per
 * component as bars, the running total as a line). The line's numbers sit on
 * each group next to its bar values (`ChartGroup.line`), so moving or removing
 * a group takes its line values along. The line can share the bars' axis or
 * have its own on the right, with its own title, unit and range.
 */
import { uprightKind, type ChartKind } from '@biofigure-lab/ui/lib/graph-kinds'

import type { ChartData, ChartGroup } from './chart-model'

export type ComboLine = {
  /** The line's measure: its legend name and its axis title. */
  title: string
  unit: string
  /** The line gets its own axis on the right; off, it shares the bars' axis. */
  rightAxis: boolean
  /** The right axis's range; null works it out from the line's values. */
  min: number | null
  max: number | null
  /** The line's and its markers' colour. */
  colour: string
}

export const COMBO_DEFAULTS: ComboLine = { title: 'Line', unit: '', rightAxis: true, min: null, max: null, colour: '#000000' }

export const isCombo = (kind: ChartKind) => uprightKind(kind) === 'bar-line'

/** A chart's line settings, with any it predates filled in. */
export const comboOf = (chart: Pick<ChartData, 'combo'>): ComboLine => ({ ...COMBO_DEFAULTS, ...chart.combo })

/** The line's axis title with its unit, as "Cumulative (%)". */
export const lineLabel = (combo: ComboLine) => (combo.unit.trim() ? `${combo.title} (${combo.unit.trim()})`.trim() : combo.title)

/**
 * The line's measure as a line chart of its own, with the same groups and
 * error bars: its axis and its means are worked out from this. On its own
 * axis it has the line's range and no reference lines, and stays linear.
 */
export function lineChart(chart: ChartData): ChartData {
  const combo = comboOf(chart)
  const own = combo.rightAxis
  return {
    ...chart,
    kind: 'line',
    groups: chart.groups.map((g) => ({ name: g.name, values: g.line ?? [] })),
    yMin: own ? combo.min : chart.yMin,
    yMax: own ? combo.max : chart.yMax,
    referenceLines: own ? [] : chart.referenceLines,
    yScale: own ? 'linear' : chart.yScale,
  }
}

/** A new bar + line chart's numbers: three groups' fold change as bars and their viability as the line, on its own axis. */
export function comboStart(): Pick<ChartData, 'groups' | 'yTitle' | 'combo' | 'colours'> {
  return {
    groups: [
      { name: 'Control', values: [1.0, 1.2, 0.9, 1.1], line: [96, 94, 95, 97] },
      { name: 'Drug A', values: [2.1, 2.5, 1.8, 2.3], line: [80, 84, 81, 83] },
      { name: 'Drug B', values: [1.6, 1.4, 1.9, 1.7], line: [87, 90, 88, 89] },
    ],
    yTitle: 'Fold change',
    combo: { ...COMBO_DEFAULTS, title: 'Viability', unit: '%' },
    // One colour for every bar, so the line stands out against them.
    colours: Array.from({ length: 8 }, () => '#56B4E9'),
  }
}

/* Editing the line's numbers (the data card's Line table) */

const lineOf = (g: ChartGroup) => g.line ?? []

/** How many rows the line's table has: its longest group, at least one. */
export const lineRowCount = (chart: Pick<ChartData, 'groups'>) => Math.max(1, ...chart.groups.map((g) => lineOf(g).length))

/** A number typed into the line's table (`value` already read; null clears it). */
export function setLineValue(chart: ChartData, c: number, r: number, value: number | null): ChartData {
  return {
    ...chart,
    groups: chart.groups.map((g, i) => {
      if (i !== c) return g
      const line = [...lineOf(g)]
      while (line.length <= r) line.push(null)
      line[r] = value
      return { ...g, line }
    }),
  }
}

/** One more empty row in the line's table. */
export function addLineRow(chart: ChartData): ChartData {
  const rows = lineRowCount(chart)
  return { ...chart, groups: chart.groups.map((g) => ({ ...g, line: [...lineOf(g), ...Array<null>(rows - lineOf(g).length + 1).fill(null)] })) }
}

/** A block of numbers pasted into the line's table at a cell, filling to the right and down; columns past the last group are left out. */
export function pasteIntoLine(chart: ChartData, rows: (number | null)[][], at: { r: number; c: number }): ChartData {
  let next = chart
  rows.forEach((row, dr) => row.forEach((value, dc) => {
    if (at.c + dc < chart.groups.length) next = setLineValue(next, at.c + dc, at.r + dr, value)
  }))
  return next
}
