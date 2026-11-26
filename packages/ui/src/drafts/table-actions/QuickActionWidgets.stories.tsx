/*
 * BIO-82 design drafts, round 2: the quick-actions bar after the owner's
 * feedback (2026-11-25). Visual drafts only: no tests, no accessibility
 * pass, nothing wired up. Widgets are drawn open so they can be judged.
 *
 *   1  Icon: a clearer Frame icon, and Frame opening a style widget (no ▾ arrow)
 *   2  Chart: a data icon that doesn't look like a table
 *   3  Shape: a Style button opening the presets
 *   4  Arrow: Reverse, with or without an Ends widget
 *   5  Table: Row and Column buttons with a widget each, or tinted icons with full names
 */
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ArrowLeftRight, Database, Lock, MoreHorizontal, createLucideIcon, type IconNode, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '../../lib/cn'
import { QuickActions, type QuickAction, type QuickActionGroup } from '../../components/quick-actions/QuickActions'

const meta = {
  title: 'Drafts/BIO-82 Quick-action widgets',
  parameters: { controls: { disable: true }, layout: 'fullscreen' },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const icon = (name: string, node: IconNode) => createLucideIcon(name, node)
const tint = { fill: 'currentColor', fillOpacity: 0.28, stroke: 'none' }
const noop = () => undefined

/* ---------- Shared pieces ---------- */

const LOCK: QuickAction = { id: 'lock', label: 'Lock', icon: Lock, onClick: noop }
const MORE: QuickAction = { id: 'more', label: 'More actions', icon: MoreHorizontal, onClick: noop }

function bar(own: QuickAction[], labels = false, name = 'Actions') {
  const groups: QuickActionGroup[] = [{ id: 'own', actions: own }, { id: 'lock', actions: [LOCK] }, { id: 'more', actions: [MORE] }]
  return <QuickActions label={name} groups={groups} showLabels={labels} />
}

/** A small white card like the app's popovers, standing for a widget opened from a bar button. */
function Widget({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-lg border bg-popover p-2 text-popover-foreground shadow-lg', className)}>
      {title && <div className="section-label px-1 pb-1.5">{title}</div>}
      {children}
    </div>
  )
}

/** One draft: heading, then the canvas with the widget, the bar and the object stacked upwards. */
function Draft({ letter, title, about, widget, barNode, object }: { letter: string; title: string; about: string; widget?: ReactNode; barNode: ReactNode; object: ReactNode }) {
  return (
    <section className="flex w-[430px] shrink-0 flex-col gap-3">
      <header>
        <h3 className="text-sm font-semibold">
          {letter} · {title}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">{about}</p>
      </header>
      <div className="flex min-h-[380px] flex-col items-center justify-end gap-3 rounded-lg bg-neutral-100 px-4 pt-4 pb-8 dark:bg-neutral-800">
        {widget}
        {barNode}
        <div className="mt-6 rounded-sm bg-white p-3 outline-1 outline-offset-4 outline-[#2563eb]">{object}</div>
      </div>
    </section>
  )
}

function Part({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-panel p-5">
      <h2 className="text-base font-semibold">
        {number} · {title}
      </h2>
      <div className="flex flex-wrap gap-6">{children}</div>
    </section>
  )
}

/* ---------- 1 Icon: Frame ---------- */

/** The selected icon: a simple cell. */
function CellPicture({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="26" fill="#cce8f8" stroke="#0072b2" strokeWidth="2.5" />
      <circle cx="36" cy="28" r="9" fill="#c2bddb" stroke="#332288" strokeWidth="2" />
      <circle cx="21" cy="40" r="3" fill="#56b4e9" />
      <circle cx="40" cy="44" r="2.5" fill="#56b4e9" />
    </svg>
  )
}

const frameA = icon('frame-a', [
  ['rect', { x: '3', y: '3', width: '18', height: '18', rx: '4', key: 'f' }],
  ['circle', { cx: '12', cy: '12', r: '4', key: 'c' }],
])
const frameB = icon('frame-b', [
  ['rect', { x: '3', y: '2', width: '18', height: '20', rx: '3', key: 'f' }],
  ['circle', { cx: '12', cy: '10', r: '3.5', key: 'c' }],
  ['path', { d: 'M8 18h8', key: 'l' }],
])
const frameC = icon('frame-c', [
  ['path', { d: 'M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3', key: 'f' }],
  ['circle', { cx: '12', cy: '12', r: '4', ...tint, key: 't' }],
  ['circle', { cx: '12', cy: '12', r: '4', key: 'c' }],
])

type FrameLook = { name: string; radius: string; fill: string; outline?: string; caption?: 'below' | 'inside' | 'header'; round?: boolean; pill?: boolean }
const FRAME_LOOKS: FrameLook[] = [
  { name: 'Soft tile', radius: '10px', fill: '#e8f1f8', caption: 'inside' },
  { name: 'Outlined card', radius: '8px', fill: '#ffffff', outline: '#94a3b8', caption: 'below' },
  { name: 'Circle badge', radius: '999px', fill: '#e8f1f8', round: true },
  { name: 'Chip', radius: '999px', fill: '#f1f5f9', outline: '#cbd5e1', pill: true },
  { name: 'Header card', radius: '8px', fill: '#ffffff', outline: '#94a3b8', caption: 'header' },
]

/** A tile showing one frame style around the cell, with its name under it. */
function FrameTile({ look, on }: { look?: FrameLook; on?: boolean }) {
  return (
    <div className={cn('flex w-[74px] flex-col items-center gap-1 rounded-md border p-1.5 text-[11px]', on ? 'border-primary bg-primary-subtle text-primary-subtle-foreground' : 'border-transparent hover:bg-accent')}>
      <div className="grid h-12 w-full place-items-center rounded-sm bg-white">
        {!look ? (
          <CellPicture size={30} />
        ) : look.pill ? (
          <div className="flex items-center gap-1 px-1.5 py-0.5" style={{ borderRadius: look.radius, background: look.fill, border: `1px solid ${look.outline ?? 'transparent'}` }}>
            <CellPicture size={16} />
            <span className="text-[8px] text-neutral-700">IgG</span>
          </div>
        ) : (
          <div className="flex flex-col items-center overflow-hidden" style={{ borderRadius: look.radius, background: look.fill, border: `1px solid ${look.outline ?? 'transparent'}`, padding: look.round ? 5 : 0 }}>
            {look.caption === 'header' && <div className="w-full bg-[#0072b2] px-1.5 text-center text-[7px] leading-[10px] text-white">IgG</div>}
            <div className={look.round ? '' : 'px-2 pt-1'}>
              <CellPicture size={look.round ? 22 : 20} />
            </div>
            {(look.caption === 'below' || look.caption === 'inside') && <div className="pb-0.5 text-[7px] leading-[9px] text-neutral-700">IgG</div>}
          </div>
        )}
      </div>
      {look?.name ?? 'No frame'}
    </div>
  )
}

function FrameWidget({ picked }: { picked: string }) {
  return (
    <Widget title="Frame">
      <div className="grid grid-cols-3 gap-1">
        <FrameTile on={picked === 'No frame'} />
        {FRAME_LOOKS.map((look) => (
          <FrameTile key={look.name} look={look} on={picked === look.name} />
        ))}
      </div>
    </Widget>
  )
}

/* ---------- 2 Chart: data icon ---------- */

const dataA = icon('data-a', [
  ['path', { d: 'M3 3v18h10', key: 'axis' }],
  ['path', { d: 'M7 17v-4M11 17V9M15 12V6', key: 'bars' }],
  ['path', { d: 'M17.5 21 21 17.5l-1.5-1.5-3.5 3.5V21z', key: 'pen' }],
])
const dataB = icon('data-b', [
  ['path', { d: 'M4 5h2M4 12h2M4 19h2', key: 'dots' }],
  ['path', { d: 'M10 5h10M10 12h6M10 19h8', key: 'values' }],
])
const dataC = Database

function ChartPicture() {
  return (
    <svg width="150" height="100" viewBox="0 0 150 100" aria-hidden="true">
      <path d="M20 8v80h124" fill="none" stroke="#1f2937" strokeWidth="1.5" />
      <rect x="34" y="40" width="22" height="48" fill="#0072b2" />
      <rect x="70" y="22" width="22" height="66" fill="#e69f00" />
      <rect x="106" y="52" width="22" height="36" fill="#009e73" />
      <path d="M45 34v12M81 14v14M117 46v12" stroke="#1f2937" strokeWidth="1.2" />
    </svg>
  )
}

/* ---------- 3 Shape: Style ---------- */

type Preset = { name: string; fill: string; stroke: string; text: string }
const LIGHT: Preset[] = [
  { name: 'Vermilion', fill: '#f2cfb2', stroke: '#d55e00', text: '#8a3d00' },
  { name: 'Orange', fill: '#f8e2b2', stroke: '#e69f00', text: '#7f5700' },
  { name: 'Yellow', fill: '#fbf7c6', stroke: '#f0e442', text: '#6c671e' },
  { name: 'Teal', fill: '#b2e2d5', stroke: '#009e73', text: '#005f45' },
  { name: 'Sky', fill: '#cce8f8', stroke: '#56b4e9', text: '#2f6380' },
  { name: 'Blue', fill: '#b2d5e8', stroke: '#0072b2', text: '#00507d' },
  { name: 'Violet', fill: '#c2bddb', stroke: '#332288', text: '#24185f' },
  { name: 'Purple', fill: '#f0d7e5', stroke: '#cc79a7', text: '#7a4964' },
]
const BOLD: Preset[] = [
  { name: 'Vermilion, bold', fill: '#d55e00', stroke: '#8a3d00', text: '#2b1300' },
  { name: 'Orange, bold', fill: '#e69f00', stroke: '#966700', text: '#503800' },
  { name: 'Yellow, bold', fill: '#f0e442', stroke: '#9c942b', text: '#605b1a' },
  { name: 'Teal, bold', fill: '#009e73', stroke: '#00674b', text: '#00271d' },
  { name: 'Sky, bold', fill: '#56b4e9', stroke: '#387597', text: '#1e3f52' },
  { name: 'Blue, bold', fill: '#0072b2', stroke: '#004a74', text: '#ffffff' },
  { name: 'Violet, bold', fill: '#332288', stroke: '#211658', text: '#ffffff' },
  { name: 'Purple, bold', fill: '#cc79a7', stroke: '#854f6d', text: '#3d2432' },
]
const DARK: Preset[] = [
  { name: 'Vermilion, dark', fill: '#6a2f00', stroke: '#401c00', text: '#ffffff' },
  { name: 'Orange, dark', fill: '#735000', stroke: '#453000', text: '#ffffff' },
  { name: 'Yellow, dark', fill: '#787221', stroke: '#484414', text: '#ffffff' },
  { name: 'Teal, dark', fill: '#004f3a', stroke: '#002f23', text: '#ffffff' },
  { name: 'Sky, dark', fill: '#2b5a74', stroke: '#1a3646', text: '#ffffff' },
  { name: 'Blue, dark', fill: '#003959', stroke: '#002235', text: '#ffffff' },
  { name: 'Violet, dark', fill: '#24185f', stroke: '#000000', text: '#ffffff' },
  { name: 'Purple, dark', fill: '#663c54', stroke: '#3d2432', text: '#ffffff' },
]
const OUTLINE: Preset[] = LIGHT.map((preset) => ({ ...preset, name: `${preset.name}, outline`, fill: '#ffffff' }))

function Swatch({ preset, on, size = 26 }: { preset: Preset; on?: boolean; size?: number }) {
  return (
    <span
      title={preset.name}
      className={cn('grid place-items-center rounded-[5px] text-[10px] font-semibold', on && 'ring-2 ring-primary ring-offset-1')}
      style={{ width: size, height: size, background: preset.fill, border: `1.5px solid ${preset.stroke}`, color: preset.text }}
    >
      Aa
    </span>
  )
}

const BLUE = LIGHT[5]
const styleIcon = icon('style', [
  ['rect', { x: '3', y: '3', width: '18', height: '18', rx: '4', ...tint, key: 't' }],
  ['rect', { x: '3', y: '3', width: '18', height: '18', rx: '4', key: 'f' }],
  ['path', { d: 'M8 16l4-9 4 9M9.5 13h5', key: 'a' }],
])

function ShapePicture() {
  return (
    <div className="grid h-[70px] w-[140px] place-items-center rounded-[10px] text-sm font-medium" style={{ background: BLUE.fill, border: `2px solid ${BLUE.stroke}`, color: BLUE.text }}>
      Nucleus
    </div>
  )
}

/* ---------- 4 Arrow ---------- */

function ArrowPicture() {
  return (
    <svg width="160" height="40" viewBox="0 0 160 40" aria-hidden="true">
      <path d="M8 20h140" stroke="#1f2937" strokeWidth="2" />
      <path d="M140 13l10 7-10 7z" fill="#1f2937" />
    </svg>
  )
}

const ENDS: { name: string; d: string; filled?: boolean }[] = [
  { name: 'None', d: '' },
  { name: 'Open', d: 'M30 8l8 6-8 6' },
  { name: 'Filled', d: 'M30 8l8 6-8 6z', filled: true },
  { name: 'Inhibition', d: 'M38 6v16' },
  { name: 'Activation', d: 'M30 8l8 6-8 6z' },
  { name: 'Binding', d: 'M33 8a6 6 0 0 1 0 12' },
]

function EndTile({ end, flip, on }: { end: (typeof ENDS)[number]; flip?: boolean; on?: boolean }) {
  return (
    <div className={cn('flex flex-col items-center gap-0.5 rounded-md border p-1 text-[10px]', on ? 'border-primary bg-primary-subtle text-primary-subtle-foreground' : 'border-transparent')}>
      <svg width="44" height="28" viewBox="0 0 44 28" aria-hidden="true" style={flip ? { transform: 'scaleX(-1)' } : undefined}>
        <path d="M6 14h32" stroke="currentColor" strokeWidth="1.6" />
        {end.d && <path d={end.d} stroke="currentColor" strokeWidth="1.6" fill={end.filled ? 'currentColor' : end.name === 'Activation' ? 'white' : 'none'} />}
      </svg>
      {end.name}
    </div>
  )
}

/* ---------- 5 Table ---------- */

const gridB: IconNode = [['rect', { x: '3', y: '3', width: '18', height: '18', rx: '2', key: 't' }]]
const rowAbove = icon('row-above', [...gridB, ['rect', { x: '3', y: '3', width: '18', height: '8', rx: '2', ...tint, key: 'b' }], ['path', { d: 'M3 11h18M3 16h18', key: 'l' }], ['path', { d: 'M12 5v4M10 7h4', key: 'p' }]])
const rowBelow = icon('row-below', [...gridB, ['rect', { x: '3', y: '13', width: '18', height: '8', rx: '2', ...tint, key: 'b' }], ['path', { d: 'M3 8h18M3 13h18', key: 'l' }], ['path', { d: 'M12 15v4M10 17h4', key: 'p' }]])
const colLeft = icon('col-left', [...gridB, ['rect', { x: '3', y: '3', width: '8', height: '18', rx: '2', ...tint, key: 'b' }], ['path', { d: 'M11 3v18M16 3v18', key: 'l' }], ['path', { d: 'M7 10v4M5 12h4', key: 'p' }]])
const colRight = icon('col-right', [...gridB, ['rect', { x: '13', y: '3', width: '8', height: '18', rx: '2', ...tint, key: 'b' }], ['path', { d: 'M8 3v18M13 3v18', key: 'l' }], ['path', { d: 'M17 10v4M15 12h4', key: 'p' }]])
const deleteRow = icon('delete-row', [...gridB, ['rect', { x: '3', y: '8', width: '18', height: '8', ...tint, key: 'b' }], ['path', { d: 'M3 8h18M3 16h18', key: 'l' }], ['path', { d: 'm10 10 4 4M14 10l-4 4', key: 'x' }]])
const deleteCol = icon('delete-col', [...gridB, ['rect', { x: '8', y: '3', width: '8', height: '18', ...tint, key: 'b' }], ['path', { d: 'M8 3v18M16 3v18', key: 'l' }], ['path', { d: 'm10 10 4 4M14 10l-4 4', key: 'x' }]])
const rowIcon = icon('row', [...gridB, ['rect', { x: '3', y: '9', width: '18', height: '6', ...tint, key: 'b' }], ['path', { d: 'M3 9h18M3 15h18', key: 'l' }]])
const colIcon = icon('col', [...gridB, ['rect', { x: '9', y: '3', width: '6', height: '18', ...tint, key: 'b' }], ['path', { d: 'M9 3v18M15 3v18', key: 'l' }]])

const ROWS = [
  ['Sample', 'Day 1', 'Day 3'],
  ['Control', '1.00', '1.12'],
  ['Drug A', '0.94', '0.71'],
]

function TablePicture() {
  return (
    <table className="border-collapse bg-white text-[11px] text-neutral-800">
      <tbody>
        {ROWS.map((row, r) => (
          <tr key={r} className={r === 0 ? 'bg-[#D1E6F1] font-semibold' : undefined}>
            {row.map((cell, c) => (
              <td key={c} className={cn('relative border border-neutral-300 px-2.5 py-1', r === 2 && c === 1 && 'bg-[#2563eb]/15 outline-2 -outline-offset-1 outline-[#2563eb]')}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** A widget row: icon and name, like a menu row but with the picture. */
function WidgetRow({ Icon, name, danger }: { Icon: LucideIcon; name: string; danger?: boolean }) {
  return (
    <div className={cn('flex h-8 items-center gap-2 rounded-sm px-2 text-sm hover:bg-accent', danger && 'text-destructive-text')}>
      <Icon className="size-[18px]" strokeWidth={1.75} />
      {name}
    </div>
  )
}

/* ---------- The page ---------- */

export const Widgets: Story = {
  render: () => (
    <div className="flex min-h-screen flex-col gap-6 bg-background p-8 text-foreground">
      <Part number={1} title="Icon: Frame">
        <Draft
          letter="A"
          title="Icon in a rounded tile"
          about="Frame opens the styles right above it; No frame is the first tile, so taking a frame off is a pick like any other. No ▾ arrow."
          barNode={bar([{ id: 'frame', label: 'Frame', icon: frameA, onClick: noop }], true)}
          widget={<FrameWidget picked="Soft tile" />}
          object={<CellPicture />}
        />
        <Draft letter="B" title="Card with a caption line" about="The icon in a card with a line under it, for the caption most frames carry." barNode={bar([{ id: 'frame', label: 'Frame', icon: frameB, onClick: noop }], true)} widget={<FrameWidget picked="Outlined card" />} object={<CellPicture />} />
        <Draft letter="C" title="Corner marks around a dot" about="Four corners around a tinted dot: 'put something around this'." barNode={bar([{ id: 'frame', label: 'Frame', icon: frameC, onClick: noop }], true)} widget={<FrameWidget picked="No frame" />} object={<CellPicture />} />
      </Part>

      <Part number={2} title="Chart: Edit data">
        <Draft letter="A" title="Chart with a pencil" about="Bars on an axis with a small pencil: change what the chart shows." barNode={bar([{ id: 'data', label: 'Edit data', icon: dataA, onClick: noop }], true)} object={<ChartPicture />} />
        <Draft letter="B" title="A list of values" about="Dots with value lines, like a column of numbers, nothing table-like." barNode={bar([{ id: 'data', label: 'Edit data', icon: dataB, onClick: noop }], true)} object={<ChartPicture />} />
        <Draft letter="C" title="Database" about="Lucide's database drum: the common sign for 'data', but it can also read as storage." barNode={bar([{ id: 'data', label: 'Edit data', icon: dataC, onClick: noop }], true)} object={<ChartPicture />} />
      </Part>

      <Part number={3} title="Shape: Style">
        <Draft
          letter="A"
          title="Light colours, then More"
          about="Style shows the shape's own preset as its icon. The widget holds the eight light presets and a More link to every preset in the side panel."
          barNode={<QuickActions label="Shape actions" showLabels groups={[{ id: 'own', actions: [{ id: 'style', label: 'Style', icon: styleIcon, onClick: noop }] }, { id: 'lock', actions: [LOCK] }, { id: 'more', actions: [MORE] }]} />}
          widget={
            <Widget title="Style">
              <div className="grid grid-cols-8 gap-1.5 p-1">
                {LIGHT.map((preset) => (
                  <Swatch key={preset.name} preset={preset} on={preset.name === 'Blue'} />
                ))}
              </div>
              <div className="px-1 pt-1 text-xs text-primary">All styles…</div>
            </Widget>
          }
          object={<ShapePicture />}
        />
        <Draft
          letter="B"
          title="Every look in one grid"
          about="Light, Bold, Dark and Outline as four rows of the same colours, so a look and a colour are both one glance away."
          barNode={<QuickActions label="Shape actions" showLabels groups={[{ id: 'own', actions: [{ id: 'style', label: 'Style', icon: styleIcon, onClick: noop }] }, { id: 'lock', actions: [LOCK] }, { id: 'more', actions: [MORE] }]} />}
          widget={
            <Widget>
              <div className="grid grid-cols-[auto_repeat(8,auto)] items-center gap-1.5 p-1">
                {[
                  ['Light', LIGHT],
                  ['Bold', BOLD],
                  ['Dark', DARK],
                  ['Outline', OUTLINE],
                ].map(([name, presets]) => (
                  <Row key={name as string} name={name as string} presets={presets as Preset[]} />
                ))}
              </div>
            </Widget>
          }
          object={<ShapePicture />}
        />
      </Part>

      <Part number={4} title="Arrow">
        <Draft letter="A" title="Reverse only" about="One action: point the arrow the other way. Path, line and ends stay in the Arrows panel, whose tiles already change the arrow in one click." barNode={bar([{ id: 'reverse', label: 'Reverse', icon: ArrowLeftRight, onClick: noop }], true)} object={<ArrowPicture />} />
        <Draft
          letter="B"
          title="Reverse and Ends"
          about="Ends opens both ends side by side, so a head can be changed on the canvas without the side panel."
          barNode={
            bar(
              [
                { id: 'reverse', label: 'Reverse', icon: ArrowLeftRight, onClick: noop },
                { id: 'ends', label: 'Ends', icon: icon('ends', [['path', { d: 'M3 12h18', key: 'l' }], ['path', { d: 'M3 8v8', key: 's' }], ['path', { d: 'm16 7 5 5-5 5', key: 'e' }]]), onClick: noop },
              ],
              true,
            )
          }
          widget={
            <Widget>
              <div className="flex gap-3">
                <div>
                  <div className="section-label px-1 pb-1">Start</div>
                  <div className="grid grid-cols-3 gap-0.5">
                    {ENDS.map((end) => (
                      <EndTile key={end.name} end={end} flip on={end.name === 'None'} />
                    ))}
                  </div>
                </div>
                <div className="w-px bg-border" />
                <div>
                  <div className="section-label px-1 pb-1">End</div>
                  <div className="grid grid-cols-3 gap-0.5">
                    {ENDS.map((end) => (
                      <EndTile key={end.name} end={end} on={end.name === 'Filled'} />
                    ))}
                  </div>
                </div>
              </div>
            </Widget>
          }
          object={<ArrowPicture />}
        />
      </Part>

      <Part number={5} title="Table, one cell picked">
        <Draft
          letter="D"
          title="Row and Column, each with a widget"
          about="Two named buttons. Each opens its own short list with pictures: add above or below (left or right), or delete. The names say what they do in full."
          barNode={
            bar(
              [
                { id: 'row', label: 'Row', icon: rowIcon, onClick: noop },
                { id: 'col', label: 'Column', icon: colIcon, onClick: noop },
              ],
              true,
            )
          }
          widget={
            <Widget title="Row" className="w-52 self-start ml-16">
              <WidgetRow Icon={rowAbove} name="Add row above" />
              <WidgetRow Icon={rowBelow} name="Add row below" />
              <div className="my-1 h-px bg-border" />
              <WidgetRow Icon={deleteRow} name="Delete row" danger />
            </Widget>
          }
          object={<TablePicture />}
        />
        <Draft
          letter="E"
          title="Version B's icons with full names"
          about="All six in the bar, each with a two-word name under it so 'above' always says what goes above. Wide: it needs about 520 px."
          barNode={
            <div className="scale-[0.8]">
              {bar(
                [
                  { id: 'ra', label: 'Row above', icon: rowAbove, onClick: noop },
                  { id: 'rb', label: 'Row below', icon: rowBelow, onClick: noop },
                  { id: 'cl', label: 'Column left', icon: colLeft, onClick: noop },
                  { id: 'cr', label: 'Column right', icon: colRight, onClick: noop },
                  { id: 'dr', label: 'Delete row', icon: deleteRow, onClick: noop },
                  { id: 'dc', label: 'Delete column', icon: deleteCol, onClick: noop },
                ],
                true,
              )}
            </div>
          }
          object={<TablePicture />}
        />
        <Draft
          letter="D"
          title="…whole table selected"
          about="With no cell picked, D's buttons add at the end: Row adds one at the bottom, Column one at the right, in one click."
          barNode={
            bar(
              [
                { id: 'row', label: 'Add row', icon: rowBelow, onClick: noop },
                { id: 'col', label: 'Add column', icon: colRight, onClick: noop },
              ],
              true,
            )
          }
          object={<TablePicture />}
        />
      </Part>
    </div>
  ),
}

function Row({ name, presets }: { name: string; presets: Preset[] }) {
  return (
    <>
      <span className="pr-1 text-[11px] text-muted-foreground">{name}</span>
      {presets.map((preset) => (
        <Swatch key={preset.name} preset={preset} on={preset.name === 'Blue'} size={24} />
      ))}
    </>
  )
}
