/*
 * Icons drawn for the quick-actions bar (BIO-82, the owner's picks of
 * 2026-11-25), in Lucide's style (24 grid, 2 px round strokes) so they sit
 * with Lucide's own icons. Outlines only: no tinted areas.
 */
import { createLucideIcon, type IconNode } from 'lucide-react'

/** Frame: the icon in a card, with the caption line under it (draft 1B). */
export const FrameCard = createLucideIcon('frame-card', [
  ['rect', { x: '3', y: '2', width: '18', height: '20', rx: '3', key: 'card' }],
  ['circle', { cx: '12', cy: '10', r: '3.5', key: 'icon' }],
  ['path', { d: 'M8 18h8', key: 'caption' }],
])

/** Edit data: bars on an axis with a small pencil (draft 2A). */
export const ChartPencil = createLucideIcon('chart-pencil', [
  ['path', { d: 'M3 3v18h10', key: 'axis' }],
  ['path', { d: 'M7 17v-4M11 17V9M15 12V6', key: 'bars' }],
  ['path', { d: 'M17.5 21 21 17.5l-1.5-1.5-3.5 3.5V21z', key: 'pencil' }],
])

/** Ends: a line with a bar at its start and a head at its end. */
export const ArrowEnds = createLucideIcon('arrow-ends', [
  ['path', { d: 'M3 12h18', key: 'shaft' }],
  ['path', { d: 'M3 8v8', key: 'start' }],
  ['path', { d: 'm16 7 5 5-5 5', key: 'end' }],
])

const grid: IconNode[number] = ['rect', { x: '3', y: '3', width: '18', height: '18', rx: '2', key: 'grid' }]

/** Row: a table with its middle row marked. */
export const TableRow = createLucideIcon('table-row', [grid, ['path', { d: 'M3 9h18M3 15h18', key: 'row' }]])

/** Column: a table with its middle column marked. */
export const TableColumn = createLucideIcon('table-column', [grid, ['path', { d: 'M9 3v18M15 3v18', key: 'column' }]])

/** Add row above: the new row at the top, with a plus in it. */
export const RowAbove = createLucideIcon('row-above', [grid, ['path', { d: 'M3 11h18M3 16h18', key: 'lines' }], ['path', { d: 'M12 5v4M10 7h4', key: 'plus' }]])

/** Add row below: the new row at the bottom, with a plus in it. */
export const RowBelow = createLucideIcon('row-below', [grid, ['path', { d: 'M3 8h18M3 13h18', key: 'lines' }], ['path', { d: 'M12 15v4M10 17h4', key: 'plus' }]])

/** Add column left: the new column on the left, with a plus in it. */
export const ColumnLeft = createLucideIcon('column-left', [grid, ['path', { d: 'M11 3v18M16 3v18', key: 'lines' }], ['path', { d: 'M7 10v4M5 12h4', key: 'plus' }]])

/** Add column right: the new column on the right, with a plus in it. */
export const ColumnRight = createLucideIcon('column-right', [grid, ['path', { d: 'M8 3v18M13 3v18', key: 'lines' }], ['path', { d: 'M17 10v4M15 12h4', key: 'plus' }]])

/** Delete row: the middle row with an x in it. */
export const DeleteRow = createLucideIcon('delete-row', [grid, ['path', { d: 'M3 8h18M3 16h18', key: 'lines' }], ['path', { d: 'm10 10 4 4M14 10l-4 4', key: 'x' }]])

/** Delete column: the middle column with an x in it. */
export const DeleteColumn = createLucideIcon('delete-column', [grid, ['path', { d: 'M8 3v18M16 3v18', key: 'lines' }], ['path', { d: 'm10 10 4 4M14 10l-4 4', key: 'x' }]])
