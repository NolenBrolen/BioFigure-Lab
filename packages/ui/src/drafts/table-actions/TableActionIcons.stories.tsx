/*
 * BIO-82 design drafts: clearer icons for a table's row and column actions
 * in the quick-actions bar. Visual drafts only: no tests, no accessibility
 * pass, nothing wired up. After the owner picks, the chosen set gets built
 * properly and replaces lucide's Between* icons in the bar and the menu.
 *
 * Each version shows the bar for a whole table (Add row, Add column) and
 * for a picked cell (rows and columns next to it, and deleting them).
 *
 *   Now  lucide's Between* icons, as in the app today
 *   A    Dashed new row or column with a plus; an x beside the one to delete
 *   B    The row or column itself tinted, with a plus or x inside it
 *   C    A's icons with their names under them
 */
import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  BetweenHorizontalEnd,
  BetweenHorizontalStart,
  BetweenVerticalEnd,
  BetweenVerticalStart,
  Columns3,
  Lock,
  MoreHorizontal,
  Rows3,
  createLucideIcon,
  type IconNode,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'

import { QuickActions, type QuickActionGroup } from '../../components/quick-actions/QuickActions'

const meta = {
  title: 'Drafts/BIO-82 Table actions',
  parameters: { controls: { disable: true }, layout: 'fullscreen' },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

type IconSet = { rowAbove: LucideIcon; rowBelow: LucideIcon; colLeft: LucideIcon; colRight: LucideIcon; deleteRow: LucideIcon; deleteCol: LucideIcon }

const icon = (name: string, node: IconNode) => createLucideIcon(name, node)
const dashed = { strokeDasharray: '2 2' }
const tint = { fill: 'currentColor', fillOpacity: 0.28, stroke: 'none' }

/* ---------- A: the new row or column dashed, with a plus; an x beside the one to delete ---------- */

const setA: IconSet = {
  rowAbove: icon('a-row-above', [
    ['rect', { x: '3', y: '11', width: '18', height: '10', rx: '2', key: 't' }],
    ['path', { d: 'M3 16h18', key: 'l' }],
    ['rect', { x: '3', y: '3', width: '12', height: '5', rx: '1', ...dashed, key: 'n' }],
    ['path', { d: 'M19.5 3v5M17 5.5h5', key: 'p' }],
  ]),
  rowBelow: icon('a-row-below', [
    ['rect', { x: '3', y: '3', width: '18', height: '10', rx: '2', key: 't' }],
    ['path', { d: 'M3 8h18', key: 'l' }],
    ['rect', { x: '3', y: '16', width: '12', height: '5', rx: '1', ...dashed, key: 'n' }],
    ['path', { d: 'M19.5 16v5M17 18.5h5', key: 'p' }],
  ]),
  colLeft: icon('a-col-left', [
    ['rect', { x: '11', y: '3', width: '10', height: '18', rx: '2', key: 't' }],
    ['path', { d: 'M16 3v18', key: 'l' }],
    ['rect', { x: '3', y: '3', width: '5', height: '12', rx: '1', ...dashed, key: 'n' }],
    ['path', { d: 'M5.5 17v5M3 19.5h5', key: 'p' }],
  ]),
  colRight: icon('a-col-right', [
    ['rect', { x: '3', y: '3', width: '10', height: '18', rx: '2', key: 't' }],
    ['path', { d: 'M8 3v18', key: 'l' }],
    ['rect', { x: '16', y: '3', width: '5', height: '12', rx: '1', ...dashed, key: 'n' }],
    ['path', { d: 'M18.5 17v5M16 19.5h5', key: 'p' }],
  ]),
  deleteRow: icon('a-delete-row', [
    ['rect', { x: '2', y: '3', width: '14', height: '18', rx: '2', key: 't' }],
    ['path', { d: 'M2 9h14M2 15h14', key: 'l' }],
    ['path', { d: 'm19 10 4 4M23 10l-4 4', key: 'x' }],
  ]),
  deleteCol: icon('a-delete-col', [
    ['rect', { x: '3', y: '8', width: '18', height: '14', rx: '2', key: 't' }],
    ['path', { d: 'M9 8v14M15 8v14', key: 'l' }],
    ['path', { d: 'm10 1 4 4M14 1l-4 4', key: 'x' }],
  ]),
}

/* ---------- B: the row or column itself tinted, with a plus or x inside it ---------- */

const gridB: IconNode = [['rect', { x: '3', y: '3', width: '18', height: '18', rx: '2', key: 't' }]]
const setB: IconSet = {
  rowAbove: icon('b-row-above', [
    ...gridB,
    ['rect', { x: '3', y: '3', width: '18', height: '8', rx: '2', ...tint, key: 'b' }],
    ['path', { d: 'M3 11h18M3 16h18', key: 'l' }],
    ['path', { d: 'M12 5v4M10 7h4', key: 'p' }],
  ]),
  rowBelow: icon('b-row-below', [
    ...gridB,
    ['rect', { x: '3', y: '13', width: '18', height: '8', rx: '2', ...tint, key: 'b' }],
    ['path', { d: 'M3 8h18M3 13h18', key: 'l' }],
    ['path', { d: 'M12 15v4M10 17h4', key: 'p' }],
  ]),
  colLeft: icon('b-col-left', [
    ...gridB,
    ['rect', { x: '3', y: '3', width: '8', height: '18', rx: '2', ...tint, key: 'b' }],
    ['path', { d: 'M11 3v18M16 3v18', key: 'l' }],
    ['path', { d: 'M7 10v4M5 12h4', key: 'p' }],
  ]),
  colRight: icon('b-col-right', [
    ...gridB,
    ['rect', { x: '13', y: '3', width: '8', height: '18', rx: '2', ...tint, key: 'b' }],
    ['path', { d: 'M8 3v18M13 3v18', key: 'l' }],
    ['path', { d: 'M17 10v4M15 12h4', key: 'p' }],
  ]),
  deleteRow: icon('b-delete-row', [
    ...gridB,
    ['rect', { x: '3', y: '8', width: '18', height: '8', ...tint, key: 'b' }],
    ['path', { d: 'M3 8h18M3 16h18', key: 'l' }],
    ['path', { d: 'm10 10 4 4M14 10l-4 4', key: 'x' }],
  ]),
  deleteCol: icon('b-delete-col', [
    ...gridB,
    ['rect', { x: '8', y: '3', width: '8', height: '18', ...tint, key: 'b' }],
    ['path', { d: 'M8 3v18M16 3v18', key: 'l' }],
    ['path', { d: 'm10 10 4 4M14 10l-4 4', key: 'x' }],
  ]),
}

const setNow: IconSet = { rowAbove: BetweenHorizontalStart, rowBelow: BetweenHorizontalEnd, colLeft: BetweenVerticalStart, colRight: BetweenVerticalEnd, deleteRow: Rows3, deleteCol: Columns3 }

/* ---------- The two bars, as the app builds them ---------- */

const noop = () => undefined
const tail: QuickActionGroup[] = [
  { id: 'lock', actions: [{ id: 'lock', label: 'Lock', icon: Lock, onClick: noop }] },
  { id: 'more', actions: [{ id: 'more', label: 'More actions', icon: MoreHorizontal, onClick: noop }] },
]

function wholeTable(set: IconSet, short: boolean): QuickActionGroup[] {
  return [
    {
      id: 'kind',
      actions: [
        { id: 'row', label: short ? 'Row' : 'Add row', icon: set.rowBelow, onClick: noop },
        { id: 'col', label: short ? 'Column' : 'Add column', icon: set.colRight, onClick: noop },
      ],
    },
    ...tail,
  ]
}

function pickedCell(set: IconSet, short: boolean): QuickActionGroup[] {
  return [
    {
      id: 'add',
      actions: [
        { id: 'ra', label: short ? 'Above' : 'Add row above', icon: set.rowAbove, onClick: noop },
        { id: 'rb', label: short ? 'Below' : 'Add row below', icon: set.rowBelow, onClick: noop },
        { id: 'cl', label: short ? 'Left' : 'Add column left', icon: set.colLeft, onClick: noop },
        { id: 'cr', label: short ? 'Right' : 'Add column right', icon: set.colRight, onClick: noop },
      ],
    },
    {
      id: 'delete',
      actions: [
        { id: 'dr', label: short ? 'Del. row' : 'Delete row', icon: set.deleteRow, onClick: noop },
        { id: 'dc', label: short ? 'Del. col.' : 'Delete column', icon: set.deleteCol, onClick: noop },
      ],
    },
    ...tail,
  ]
}

/* ---------- Page pieces ---------- */

const ROWS = [
  ['Sample', 'Day 1', 'Day 3', 'Day 7'],
  ['Control', '1.00', '1.12', '1.05'],
  ['Drug A', '0.94', '0.71', '0.52'],
  ['Drug B', '0.98', '0.88', '0.80'],
]

/** A small table on white, like one on the page; `picked` marks one cell blue. */
function MockTable({ picked }: { picked?: [number, number] }) {
  return (
    <table className="border-collapse bg-white text-[12px] text-neutral-800 outline-2 outline-offset-2 outline-[#2563eb]">
      <tbody>
        {ROWS.map((row, r) => (
          <tr key={r} className={r === 0 ? 'bg-[#D1E6F1] font-semibold' : undefined}>
            {row.map((cell, c) => {
              const on = picked?.[0] === r && picked[1] === c
              return (
                <td key={c} className="relative border border-neutral-300 px-3 py-1.5">
                  {on && <span className="pointer-events-none absolute inset-0 bg-[#2563eb]/15 outline-2 -outline-offset-1 outline-[#2563eb]" />}
                  {cell}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Scene({ caption, bar, picked }: { caption: string; bar: ReactNode; picked?: [number, number] }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="text-xs text-muted-foreground">{caption}</div>
      <div className="flex min-h-[260px] w-full flex-col items-center justify-end gap-3 rounded-lg bg-neutral-100 px-6 pb-10 pt-6 dark:bg-neutral-800">
        {bar}
        <MockTable picked={picked} />
      </div>
    </div>
  )
}

function Version({ letter, title, about, set, labels = false }: { letter: string; title: string; about: string; set: IconSet; labels?: boolean }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-panel p-5">
      <header>
        <h2 className="text-base font-semibold">
          {letter} · {title}
        </h2>
        <p className="mt-1 max-w-[70ch] text-sm text-muted-foreground">{about}</p>
      </header>
      <div className="grid grid-cols-2 gap-5">
        <Scene caption="Whole table selected" bar={<QuickActions label="Table actions" groups={wholeTable(set, labels)} showLabels={labels} />} />
        <Scene caption="One cell picked" picked={[2, 2]} bar={<QuickActions label="Cell actions" groups={pickedCell(set, labels)} showLabels={labels} />} />
      </div>
      <IconSheet set={set} />
    </section>
  )
}

/** Every icon of the set larger, with its name, to judge the drawing. */
function IconSheet({ set }: { set: IconSet }) {
  const list: [string, LucideIcon][] = [
    ['Row above', set.rowAbove],
    ['Row below', set.rowBelow],
    ['Column left', set.colLeft],
    ['Column right', set.colRight],
    ['Delete row', set.deleteRow],
    ['Delete column', set.deleteCol],
  ]
  return (
    <div className="flex flex-wrap gap-6 border-t pt-4">
      {list.map(([name, Icon]) => (
        <div key={name} className="flex w-20 flex-col items-center gap-1.5 text-xs text-muted-foreground">
          <Icon className="size-9 text-foreground" strokeWidth={1.5} />
          <Icon className="size-4 text-foreground" />
          {name}
        </div>
      ))}
    </div>
  )
}

export const TableActions: Story = {
  render: () => (
    <div className="flex min-h-screen flex-col gap-6 bg-background p-8 text-foreground">
      <Version letter="Now" title="Lucide's Between icons (today)" about="What the bar uses today, for comparison: the four add icons differ only in which end has the thick line, and the two deletes are plain rows and columns." set={setNow} />
      <Version letter="A" title="Dashed new row or column" about="The table stays solid; the row or column that will appear is dashed on the side it goes, with a plus. Delete puts an x beside the row or column that goes." set={setA} />
      <Version letter="B" title="Tinted row or column" about="A small grid with the row or column that changes tinted, a plus or x inside it. Reads like the cell picker in spreadsheets." set={setB} />
      <Version letter="C" title="A with names under them" about="Version A's icons with short names under each, so nothing has to be guessed. The bar gets taller and wider." set={setA} labels />
    </div>
  ),
}
